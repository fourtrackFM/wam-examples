/* eslint-disable no-underscore-dangle */
/* eslint-disable max-len */

import { WamSoundFontSynth } from './WamSoundFontSynth.js';

/**
 * @param {string} [moduleId]
 */
const getWamSoundFontProcessor = (moduleId) => {
	const audioWorkletGlobalScope = globalThis;
	const { registerProcessor } = audioWorkletGlobalScope;

	const ModuleScope =
		audioWorkletGlobalScope.webAudioModules.getModuleScope(moduleId);
	const { WamProcessor, WamSoundFontSynth, WamParameterInfo } = ModuleScope;

	class WamSoundFontProcessor extends WamProcessor {
		/**
		 * @param {AudioWorkletNodeOptions} options
		 */
		constructor(options) {
			super(options);

			/** @private @type {WamSoundFontSynth} */
			this._synth = new WamSoundFontSynth(
				this._parameterInterpolators,
				this._samplesPerQuantum,
				globalThis.sampleRate
			);

			/** @private @type {ArrayBuffer} */
			this._sf2Buffer = options.processorOptions?.sf2Buffer || null;

			if (this._sf2Buffer) {
				this._synth.loadSoundFont(this._sf2Buffer).catch((err) => {
					console.error(
						'[WamSoundFontProcessor] Failed to load soundfont:',
						err
					);
				});
			}

			this.params = this._synth.generateWamParameterInfo();
		}

		/**
		 * Fetch plugin's params.
		 * @returns {WamParameterInfoMap}
		 */
		_generateWamParameterInfo() {
			return this._synth.generateWamParameterInfo();
		}

		/**
		 * Handle MIDI events
		 * @param {WamMidiData} midiData
		 */
		_onMidi(midiData) {
			if (this._synth) {
				this._synth._onMidi(midiData);
			}
		}

		/**
		 * Implement custom DSP here.
		 * @param {number} startSample beginning of processing slice
		 * @param {number} endSample end of processing slice
		 * @param {Float32Array[][]} inputs
		 * @param {Float32Array[][]} outputs
		 */
		_process(startSample, endSample, inputs, outputs) {
			if (this._synth) {
				this._synth._process(inputs, outputs, this._parameterValues);
			}
			return true;
		}

		/**
		 * Messages from main thread appear here.
		 * @param {MessageEvent} message
		 */
		async _onMessage(message) {
			const { data } = message;

			if (data?.type === 'loadSoundFont' && data.buffer) {
				try {
					await this._synth.loadSoundFont(data.buffer);
					this.params = this._synth.generateWamParameterInfo();
					this.port.postMessage({
						type: 'soundFontLoaded',
						success: true,
					});
				} catch (error) {
					console.error(
						'[WamSoundFontProcessor] Failed to load soundfont:',
						error
					);
					this.port.postMessage({
						type: 'soundFontLoaded',
						success: false,
						error: error.message,
					});
				}
			}
		}
	}

	try {
		registerProcessor(moduleId, WamSoundFontProcessor);
	} catch (error) {
		console.warn(error);
	}

	return WamSoundFontProcessor;
};

export default getWamSoundFontProcessor;
