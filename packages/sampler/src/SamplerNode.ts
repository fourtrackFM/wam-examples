/* eslint-disable no-underscore-dangle */
import {
	CompositeAudioNode,
	ParamMgrNode,
} from '@webaudiomodules/sdk-parammgr';
import { WamNode } from '@webaudiomodules/api';

export type Params = 'gain' | 'playbackRate' | 'loop' | 'loopStart' | 'loopEnd';
export type InternalParams = Params;

export class MIDI {
	static NOTE_ON = 0x90;
	static NOTE_OFF = 0x80;
	static CC = 0xb0;
}

export type MIDIEvent = Uint8Array | [number, number, number];
export type ScheduledMIDIEvent = {
	event: MIDIEvent;
	time: number;
};

/**
 * SamplerNode - A WebAudio module for sample playback
 */
export default class SamplerNode extends CompositeAudioNode {
	/**
	 * @type {ParamMgrNode<Params, InternalParams>}
	 */
	_wamNode: ParamMgrNode<Params, InternalParams> = undefined;

	get paramMgr(): ParamMgrNode {
		return this._wamNode;
	}

	// The actual AudioWorkletNode
	private _samplerWorklet: AudioWorkletNode;

	// Parameters
	parameters = {
		gain: 1.0,
		playbackRate: 1.0,
		loop: false,
		loopStart: 0,
		loopEnd: 0,
	};

	constructor(audioContext: BaseAudioContext, options = {}) {
		super(audioContext, options);
		console.log('SamplerNode constructor()');

		// Will be initialized in setup()
		this._samplerWorklet = null;

		this.createNodes();
	}

	/**
	 * Static method to load required modules
	 */
	static async addModules(audioContext: AudioContext, moduleId: string) {
		// Get the URL for the processor code
		const baseUrl = new URL('.', import.meta.url).href;
		const processorUrl = `${baseUrl}SamplerProcessor.js`;

		// Register the processor with the AudioWorklet
		try {
			await audioContext.audioWorklet.addModule(processorUrl);
			console.log(`SamplerProcessor registered as '${moduleId}'`);
		} catch (e) {
			console.error(
				`Failed to load sampler worklet module: ${e.message}`
			);
			throw e;
		}
	}

	setup(paramMgr: ParamMgrNode<Params, InternalParams>) {
		// Setup MIDI event handling
		paramMgr.addEventListener('wam-midi', (e) =>
			this.processMIDIEvents([{ event: e.detail.data.bytes, time: 0 }])
		);
		this._wamNode = paramMgr;

		// Create the AudioWorkletNode
		const processorOptions = {
			moduleId: 'com.webaudiomodules.wam-examples.sampler',
		};

		this._samplerWorklet = new AudioWorkletNode(
			this.context as AudioContext,
			processorOptions.moduleId,
			{
				numberOfInputs: 0,
				numberOfOutputs: 1,
				outputChannelCount: [2], // Stereo output
				processorOptions,
			}
		);

		// Connect the AudioWorkletNode to output
		this._samplerWorklet.connect(this._output);

		// Connect parameter changes
		this._samplerWorklet.port.onmessage = (e) => {
			const { type, data } = e.data;
			if (type === 'bufferLoaded') {
				console.log('Sample buffer loaded successfully');
			}
		};

		// Apply initial parameters
		this.updateFromState();
	}

	isEnabled = true;

	set status(_sig: boolean) {
		this.isEnabled = _sig;
	}

	/**
	 * Create the audio nodes
	 */
	createNodes() {
		// Create a stereo output
		this._output = this.context.createChannelMerger(2);
	}

	/**
	 * Load an audio buffer from URL
	 * @param url URL to the audio file
	 */
	async loadSample(url: string) {
		try {
			// Fetch the audio file
			const response = await fetch(url);
			const arrayBuffer = await response.arrayBuffer();

			// Decode the audio data
			const audioBuffer = await this.context.decodeAudioData(arrayBuffer);

			// Convert to a format that can be shared with the AudioWorkletProcessor
			const numChannels = audioBuffer.numberOfChannels;
			const numSamples = audioBuffer.length;

			// Create a shared buffer to hold all channels
			const bytesPerSample = Float32Array.BYTES_PER_ELEMENT;
			const sharedBuffer = new SharedArrayBuffer(
				numChannels * numSamples * bytesPerSample
			);

			// Copy each channel's data to the shared buffer
			for (let channel = 0; channel < numChannels; channel++) {
				const channelData = audioBuffer.getChannelData(channel);
				const sharedChannelView = new Float32Array(
					sharedBuffer,
					channel * numSamples * bytesPerSample,
					numSamples
				);

				// Copy the data
				sharedChannelView.set(channelData);
			}

			// Send the buffer to the processor
			this._samplerWorklet.port.postMessage({
				type: 'loadBuffer',
				buffer: sharedBuffer,
				sampleRate: audioBuffer.sampleRate,
				channels: numChannels,
			});

			// Update loop end to match buffer length
			this.parameters.loopEnd = numSamples;
			this.updateFromState();

			console.log(
				`Loaded sample: ${url}, length: ${numSamples} samples, channels: ${numChannels}`
			);
			return true;
		} catch (error) {
			console.error(`Failed to load sample: ${error.message}`);
			return false;
		}
	}

	/**
	 * Process MIDI events
	 */
	processMIDIEvents(midiEvents: ScheduledMIDIEvent[]) {
		midiEvents.forEach((message) => {
			if (message.event[0] == MIDI.NOTE_ON) {
				const midiNote = message.event[1];
				const velocity = message.event[2];
				if (velocity) {
					this.noteOn(midiNote, velocity, message.time);
				} else {
					this.noteOff(midiNote, message.time);
				}
			} else if (message.event[0] == MIDI.NOTE_OFF) {
				const midiNote = message.event[1];
				this.noteOff(midiNote, message.time);
			}
		});
	}

	/**
	 * Trigger a note on event
	 */
	noteOn(note: number, velocity: number, time: number = 0) {
		if (!this._samplerWorklet) return;

		this._samplerWorklet.port.postMessage({
			type: 'noteOn',
			note,
			velocity,
		});
	}

	/**
	 * Trigger a note off event
	 */
	noteOff(note: number, time: number = 0) {
		if (!this._samplerWorklet) return;

		this._samplerWorklet.port.postMessage({
			type: 'noteOff',
			note,
		});
	}

	/**
	 * Stop all notes
	 */
	allNotesOff(time: number = 0) {
		if (!this._samplerWorklet) return;

		this._samplerWorklet.port.postMessage({
			type: 'allNotesOff',
		});
	}

	/**
	 * Update processor parameters from state
	 */
	updateFromState() {
		if (!this._samplerWorklet) return;

		const state = this.parameters;

		// Send each parameter to the processor
		Object.entries(state).forEach(([name, value]) => {
			this._samplerWorklet.port.postMessage({
				type: 'setParam',
				name,
				value,
			});
		});
	}
}
