/* eslint-disable no-underscore-dangle */
/* eslint-disable max-len */

// This processor acts as a passthrough WAM wrapper
// The actual synthesis is done by spessasynth's worklet processor
const getWamSoundFontProcessor = (moduleId) => {
	const audioWorkletGlobalScope = globalThis;
	const { registerProcessor } = audioWorkletGlobalScope;

	const ModuleScope =
		audioWorkletGlobalScope.webAudioModules.getModuleScope(moduleId);
	const { WamProcessor } = ModuleScope;

	// Import SpessaSynthProcessor from the previously loaded module
	// Since spessasynth_core.js is loaded via addModule, check for its exports in globalThis
	const { SpessaSynthProcessor, SoundBankLoader } = audioWorkletGlobalScope;

	class WamSoundFontProcessor extends WamProcessor {
		/**
		 * @param {AudioWorkletNodeOptions} options
		 */
		constructor(options) {
			console.log(
				'[WamSoundFontProcessor] constructor called with options:',
				options
			);
			super(options);
			console.log('[WamSoundFontProcessor] super() completed');
			this._ready = false;
			this._soundFontLoaded = false;

			// Store the soundfont buffer from processorOptions
			this._sf2Buffer = options.processorOptions?.sf2Buffer;
			console.log(
				'[WamSoundFontProcessor] sf2Buffer received:',
				!!this._sf2Buffer
			);
		}

		_initialize() {
			try {
				console.log('[WamSoundFontProcessor] _initialize() called');
				super._initialize();
				console.log(
					'[WamSoundFontProcessor] super._initialize() completed'
				);

				// Initialize the spessasynth processor
				console.log(
					'[WamSoundFontProcessor] Creating SpessaSynthProcessor...'
				);
				this._synthesizer = new SpessaSynthProcessor(44100); // this.sampleRate

				// Load the soundfont if it was provided
				if (this._sf2Buffer) {
					console.log(
						'[WamSoundFontProcessor] Loading soundfont from constructor options...'
					);
					this._loadSoundFont(this._sf2Buffer);
				} else {
					console.log(
						'[WamSoundFontProcessor] No soundfont provided in options'
					);
				}

				console.log(
					'[WamSoundFontProcessor] SpessaSynthProcessor created'
				);

				this._ready = true;
			} catch (err) {
				console.error(
					'[WamSoundFontProcessor] _initialize() error:',
					err
				);
				throw err;
			}
		}

		_loadSoundFont(arrayBuffer) {
			try {
				console.log(
					'[WamSoundFontProcessor] Loading SoundFont, size:',
					arrayBuffer.byteLength
				);

				const soundBank = SoundBankLoader.fromArrayBuffer(arrayBuffer);
				this._synthesizer.soundBankManager.addSoundBank(soundBank);
				this._soundFontLoaded = true;

				console.log(
					'[WamSoundFontProcessor] SoundFont loaded successfully'
				);
			} catch (error) {
				console.error(
					'[WamSoundFontProcessor] Error loading SoundFont:',
					error
				);
			}
		}

		/**
		 * Handle incoming messages from the main thread
		 */
		_onSysex(sysexData) {
			console.log(
				'[WamSoundFontProcessor] _onMessage received:',
				sysexData
			);

			try {
				this._handleLoadSoundFont(sysexData.data.bytes);
				return { success: true };
			} catch (error) {
				console.error('[WamSoundFontProcessor] Load error:', error);
				return { success: false, error: error.message };
			}
		}

		async _handleLoadSoundFont(arrayBuffer) {
			console.log(
				'[WamSoundFontProcessor] Loading SoundFont, size:',
				arrayBuffer.byteLength
			);

			const soundBank = SoundBankLoader.fromArrayBuffer(arrayBuffer);
			await this._synthesizer.soundBankManager.addSoundBank(soundBank);
			this._soundFontLoaded = true;

			console.log(
				'[WamSoundFontProcessor] SoundFont loaded successfully'
			);
		}

		/**
		 * Handle MIDI events
		 * @param {WamMidiData} midiData
		 */
		_onMidi(midiData) {
			if (this._synthesizer) {
				console.log(
					'[WamSoundFontProcessor] _onMidi received:',
					midiData
				);
				console.log(
					'[WamSoundFontProcessor] Synthesizer state:',
					this._synthesizer
				);
			}

			if (!this._synthesizer || !this._soundFontLoaded) {
				console.warn(
					'[WamSoundFontProcessor] Synth not ready for MIDI'
				);
				return;
			}

			const [status, data1, data2] = midiData.bytes;
			const command = status & 0xf0;
			const channel = status & 0x0f;

			switch (command) {
				case 0x90: // Note On
					if (data2 > 0) {
						this._synthesizer.noteOn(channel, data1, data2);
					} else {
						this._synthesizer.noteOff(channel, data1);
					}
					break;
				case 0x80: // Note Off
					this._synthesizer.noteOff(channel, data1);
					break;
				case 0xb0: // Control Change
					this._synthesizer.controllerChange(channel, data1, data2);
					break;
				case 0xc0: // Program Change
					this._synthesizer.programChange(channel, data1);
					break;
				case 0xe0: // Pitch Bend
					this._synthesizer.pitchWheel(channel, (data2 << 7) | data1);
					break;
			}
		}

		/**
		 * Process audio
		 * @param {Float32Array[][]} inputs
		 * @param {Float32Array[][]} outputs
		 * @param {Object} parameters
		 * @returns {boolean}
		 */
		_process(inputs, outputs, parameters) {
			if (!this._synthesizer || !this._soundFontLoaded) {
				return true;
			}

			const output = outputs[0];
			if (!output || output.length < 2) {
				return true;
			}

			const leftChannel = output[0];
			const rightChannel = output[1];
			const bufferSize = leftChannel.length;

			// Render audio from synthesizer directly into output buffers
			this._synthesizer.renderAudio(
				[leftChannel, rightChannel],
				[],
				[[]],
				0,
				bufferSize
			);

			return true;
		}
	}

	// Register the processor with the moduleId
	try {
		registerProcessor(moduleId, WamSoundFontProcessor);
		console.log(`[WamSoundFontProcessor] Registered as: ${moduleId}`);
	} catch (error) {
		console.error('[WamSoundFontProcessor] Registration error:', error);
	}

	return WamSoundFontProcessor;
};

export default getWamSoundFontProcessor;
