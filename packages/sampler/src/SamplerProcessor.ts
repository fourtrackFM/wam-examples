/* eslint-disable no-underscore-dangle */
import { WamProcessor } from '@webaudiomodules/api';

export type SamplerProcessorOptions = {
	numberOfInputs: number;
	numberOfOutputs: number;
	processorOptions?: {
		moduleId: string;
	};
};

export type SamplerProcessorParams = {
	gain: number;
	playbackRate: number;
	loop: boolean;
	loopStart: number;
	loopEnd: number;
};

export type SamplerProcessorEvents = {
	loadBuffer: {
		buffer: SharedArrayBuffer; // Shared array buffer containing audio data
		sampleRate: number; // Sample rate of the audio data
		channels: number; // Number of channels
	};
	noteOn: {
		note: number; // MIDI note number
		velocity: number; // MIDI velocity (0-127)
	};
	noteOff: {
		note: number; // MIDI note number
	};
	allNotesOff: {};
};

interface WamSDKBaseModuleScope {
	AudioWorkletProcessor: any;
	WamProcessor: any;
	sampleRate: number;
	currentFrame: number;
	currentTime: number;
	registerProcessor: (name: string, processor: any) => void;
}

declare const audioWorkletGlobalScope: WamSDKBaseModuleScope;
const { registerProcessor, currentTime, sampleRate } = audioWorkletGlobalScope;

/**
 * Sampler Processor - The AudioWorklet processor for a sample-based instrument
 */
class SamplerProcessor extends WamProcessor {
	private _buffer: Float32Array[] | null = null;
	private _sampleRate: number = 44100;
	private _playbackPositions: Map<number, number> = new Map();
	private _activeNotes: Map<number, { velocity: number; startTime: number }> =
		new Map();
	private _gain: number = 1.0;
	private _playbackRate: number = 1.0;
	private _loop: boolean = false;
	private _loopStart: number = 0;
	private _loopEnd: number = 0;

	constructor(options: SamplerProcessorOptions) {
		super(options);

		// Initialize parameters
		this._gain = 1.0;
		this._playbackRate = 1.0;
		this._loop = false;
		this._loopStart = 0;
		this._loopEnd = 0;

		// Register event handlers
		this.port.onmessage = this._onMessage.bind(this);
	}

	_onMessage(event: MessageEvent) {
		const { data } = event;

		if (data.type === 'loadBuffer') {
			this._loadBuffer(data.buffer, data.sampleRate, data.channels);
		} else if (data.type === 'setParam') {
			this._setParam(data.name, data.value);
		}
	}

	_loadBuffer(
		sharedBuffer: SharedArrayBuffer,
		sampleRate: number,
		numChannels: number
	) {
		// Create a Float32Array view for each channel from the shared buffer
		const bytesPerSample = Float32Array.BYTES_PER_ELEMENT;
		const samplesPerChannel =
			sharedBuffer.byteLength / (bytesPerSample * numChannels);

		this._buffer = [];
		for (let i = 0; i < numChannels; i++) {
			const channelData = new Float32Array(
				sharedBuffer,
				i * samplesPerChannel * bytesPerSample,
				samplesPerChannel
			);
			this._buffer.push(channelData);
		}

		this._sampleRate = sampleRate;
		this._loopEnd = samplesPerChannel;

		// Notify the main thread that the buffer is loaded
		this.port.postMessage({ type: 'bufferLoaded' });
	}

	_setParam(name: keyof SamplerProcessorParams, value: number | boolean) {
		switch (name) {
			case 'gain':
				this._gain = value as number;
				break;
			case 'playbackRate':
				this._playbackRate = value as number;
				break;
			case 'loop':
				this._loop = value as boolean;
				break;
			case 'loopStart':
				this._loopStart = value as number;
				break;
			case 'loopEnd':
				this._loopEnd = value as number;
				break;
		}
	}

	/**
	 * Process MIDI events
	 */
	_processEvents(startSample: number, endSample: number, events: any[]) {
		for (let event of events) {
			if (event.type === 'wam-midi') {
				const midiData = event.data.bytes;
				const midiChannel = midiData[0] & 0x0f;
				const midiStatus = midiData[0] & 0xf0;

				// Note On
				if (midiStatus === 0x90 && midiData[2] > 0) {
					const note = midiData[1];
					const velocity = midiData[2] / 127;
					this._startNote(note, velocity, startSample);
				}
				// Note Off
				else if (
					midiStatus === 0x80 ||
					(midiStatus === 0x90 && midiData[2] === 0)
				) {
					const note = midiData[1];
					this._stopNote(note, startSample);
				}
				// All Notes Off
				else if (midiStatus === 0xb0 && midiData[1] === 123) {
					this._stopAllNotes(startSample);
				}
			} else if (event.type === 'noteOn') {
				this._startNote(
					event.data.note,
					event.data.velocity / 127,
					startSample
				);
			} else if (event.type === 'noteOff') {
				this._stopNote(event.data.note, startSample);
			} else if (event.type === 'allNotesOff') {
				this._stopAllNotes(startSample);
			}
		}
	}

	_startNote(note: number, velocity: number, startSample: number) {
		// Ignore if we don't have a buffer loaded
		if (!this._buffer || !this._buffer.length) return;

		const startTime = currentTime + startSample / sampleRate;
		this._activeNotes.set(note, { velocity, startTime });
		this._playbackPositions.set(note, 0); // Start from the beginning of the sample
	}

	_stopNote(note: number, startSample: number) {
		this._activeNotes.delete(note);
		this._playbackPositions.delete(note);
	}

	_stopAllNotes(startSample: number) {
		this._activeNotes.clear();
		this._playbackPositions.clear();
	}

	/**
	 * Process a buffer of audio
	 */
	process(
		inputs: Float32Array[][],
		outputs: Float32Array[][],
		parameters: Record<string, Float32Array>
	) {
		// Early return if we have no buffer loaded
		if (!this._buffer || !this._buffer.length) return true;

		// Get output channels
		const output = outputs[0];
		const numOutputChannels = output.length;
		const numBufferChannels = this._buffer.length;

		// Process incoming events - we need to access the events from WamProcessor
		// The exact property might vary based on the WamProcessor implementation
		const events = [];
		try {
			// First try using a standard interface
			if (typeof (this as any).getEvents === 'function') {
				events.push(...(this as any).getEvents());
			}
			// Then try accessing internal properties that might exist
			else if ((this as any)._events) {
				events.push(...(this as any)._events);
			}
		} catch (e) {
			// Ignore errors - events will be empty
		}
		this._processEvents(0, 128, events);

		// Process each active note
		for (const [note, noteInfo] of this._activeNotes) {
			// Calculate playback position and rate
			const semitoneRatio = Math.pow(2, (note - 60) / 12); // Middle C (note 60) plays at normal speed
			const playbackRateForNote = this._playbackRate * semitoneRatio;

			// Get the current playback position for this note
			let playbackPosition = this._playbackPositions.get(note) || 0;

			// Process each sample
			for (let i = 0; i < 128; i++) {
				const sampleIdx = Math.floor(playbackPosition);

				// If we've reached the end of the buffer
				if (sampleIdx >= this._buffer[0].length) {
					if (this._loop && this._loopEnd > this._loopStart) {
						// Loop back to loop start
						playbackPosition = this._loopStart;
						continue;
					} else {
						// End of sample, no loop - stop playing this note
						this._activeNotes.delete(note);
						this._playbackPositions.delete(note);
						break;
					}
				}

				// Apply the sample value to output channels with velocity and gain scaling
				for (let channel = 0; channel < numOutputChannels; channel++) {
					const sourceChannel = Math.min(
						channel,
						numBufferChannels - 1
					);
					output[channel][i] +=
						this._buffer[sourceChannel][sampleIdx] *
						noteInfo.velocity *
						this._gain;
				}

				// Advance the playback position
				playbackPosition += playbackRateForNote;
			}

			// Update the playback position for this note
			if (this._activeNotes.has(note)) {
				this._playbackPositions.set(note, playbackPosition);
			}
		}

		return true;
	}

	/**
	 * Register the processor with the audio worklet global scope
	 */
	static register(moduleId: string) {
		try {
			registerProcessor(moduleId, SamplerProcessor);
		} catch (error) {
			console.warn(`Error registering SamplerProcessor: ${error}`);
		}
	}
}

// Register this processor
if (audioWorkletGlobalScope.AudioWorkletProcessor) {
	SamplerProcessor.register('com.webaudiomodules.wam-examples.sampler');
}

// Export the processor class
export default SamplerProcessor;
