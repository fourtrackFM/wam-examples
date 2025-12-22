/* eslint-disable no-underscore-dangle */
/* eslint-disable max-len */

// This processor acts as a passthrough WAM wrapper
// The actual synthesis is done by spessasynth's worklet processor
// which is managed by WorkletSynthesizer in the main thread
const getWamSoundFontProcessor = (moduleId) => {
	const audioWorkletGlobalScope = globalThis;
	const { registerProcessor } = audioWorkletGlobalScope;

	const ModuleScope =
		audioWorkletGlobalScope.webAudioModules.getModuleScope(moduleId);
	const { WamProcessor } = ModuleScope;

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
		}

		_initialize() {
			try {
				console.log('[WamSoundFontProcessor] _initialize() called');
				super._initialize();
				console.log(
					'[WamSoundFontProcessor] super._initialize() completed'
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

		/**
		 * Handle incoming messages from the main thread
		 */
		_onMessage(e) {
			console.log('[WamSoundFontProcessor] _onMessage received:', e);

			if (e.request === 'loadSoundFont') {
				this._handleLoadSoundFont(e.content);
			} else {
				super._onMessage(e);
			}
		}

		async _handleLoadSoundFont(arrayBuffer) {
			try {
				console.log(
					'[WamSoundFontProcessor] Loading SoundFont, size:',
					arrayBuffer.byteLength
				);

				const soundBank = SoundBankLoader.fromArrayBuffer(arrayBuffer);
				await this._synthesizer.soundBankManager.addSoundBank(
					soundBank
				);
				this._soundFontLoaded = true;

				console.log(
					'[WamSoundFontProcessor] SoundFont loaded successfully'
				);

				this.port.postMessage({
					type: 'soundFontLoaded',
					success: true,
				});
			} catch (error) {
				console.error(
					'[WamSoundFontProcessor] Error loading SoundFont:',
					error
				);
				this.port.postMessage({
					type: 'soundFontLoaded',
					success: false,
					error: error.message,
				});
			}
		}

		/**
		 * Handle MIDI events
		 * @param {WamMidiData} midiData
		 */
		_onMidi(midiData) {
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

			// Render audio from synthesizer
			const audioData = new Float32Array(bufferSize * 2);
			this._synthesizer.renderAudio(
				[
					audioData.subarray(0, bufferSize),
					audioData.subarray(bufferSize),
				],
				[],
				[[]],
				0,
				bufferSize
			);

			// Copy to output buffers
			leftChannel.set(audioData.subarray(0, bufferSize));
			rightChannel.set(audioData.subarray(bufferSize));

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
