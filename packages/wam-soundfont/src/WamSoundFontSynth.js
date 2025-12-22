/* eslint-disable class-methods-use-this */
/* eslint-disable no-underscore-dangle */
/* eslint-disable max-len */
/* eslint-disable no-undef */

import { SpessaSynthProcessor, SoundBankLoader } from './spessasynth_core.js';

/**
 * Factory function for WamSoundFontSynth
 * @param {string} [moduleId]
 */
export const getWamSoundFontSynth = (moduleId) => {
	const audioWorkletGlobalScope = globalThis;
	const ModuleScope =
		audioWorkletGlobalScope.webAudioModules.getModuleScope(moduleId);

	/**
	 * WamSoundFontSynth - A synth engine wrapping spessasynth_core
	 */
	class WamSoundFontSynth {
		/**
		 * @param {object} parameterInterpolators
		 * @param {number} samplesPerQuantum
		 * @param {number} sampleRate
		 */
		constructor(parameterInterpolators, samplesPerQuantum, sampleRate) {
			this.parameterInterpolators = parameterInterpolators;
			this.samplesPerQuantum = samplesPerQuantum;
			this.sampleRate = sampleRate;

			// Initialize spessasynth_core synthesizer
			this.synthesizer = new SpessaSynthProcessor(sampleRate, {
				enableEventSystem: false,
				enableEffects: true,
				initialTime: 0,
			});

			// State
			this.soundFontLoaded = false;

			console.log(
				'[WamSoundFontSynth] Initialized with spessasynth_core'
			);
		}

		/**
		 * Load a SoundFont file
		 * @param {ArrayBuffer} arrayBuffer
		 */
		async loadSoundFont(arrayBuffer) {
			try {
				console.log('[WamSoundFontSynth] Loading SoundFont...');

				// Wait for processor initialization (needed for SF3 decompression)
				await this.synthesizer.processorInitialized;

				// Load soundfont using spessasynth_core's loader
				const soundBank = SoundBankLoader.fromArrayBuffer(arrayBuffer);
				this.synthesizer.soundBankManager.addSoundBank(
					soundBank,
					'main'
				);

				this.soundFontLoaded = true;

				console.log(
					'[WamSoundFontSynth] SoundFont loaded successfully'
				);

				// Notify main thread
				this.port.postMessage({
					type: 'soundFontLoaded',
					success: true,
				});
			} catch (error) {
				console.error(
					'[WamSoundFontSynth] Error loading SoundFont:',
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
		 * Handle MIDI events from WAM
		 * @param {WamMidiEvent} midiEvent
		 */
		_onMidi(midiEvent) {
			if (!this.soundFontLoaded) {
				return;
			}

			const { data } = midiEvent;

			// Pass MIDI data directly to spessasynth_core
			// data is [status, data1, data2]
			this.synthesizer.processMessage(new Uint8Array(data));
		}

		/**
		 * Process audio rendering
		 * @param {Float32Array[][]} inputs
		 * @param {Float32Array[][]} outputs
		 * @param {Object} parameters
		 * @returns {boolean}
		 */
		_process(inputs, outputs, parameters) {
			if (!this.soundFontLoaded) {
				return true;
			}

			const output = outputs[0];
			if (!output || output.length < 2) {
				return true;
			}

			const leftChannel = output[0];
			const rightChannel = output[1];
			const bufferSize = leftChannel.length;

			// Update synthesizer time
			this.synthesizer.currentSynthTime = currentTime;

			// Render audio using spessasynth_core
			const outputArray = [leftChannel, rightChannel];
			const emptyEffects = [
				new Float32Array(bufferSize),
				new Float32Array(bufferSize),
			];

			this.synthesizer.renderAudio(
				outputArray, // Main stereo output
				emptyEffects, // Reverb channels (empty for now)
				emptyEffects, // Chorus channels (empty for now)
				0, // Start index
				bufferSize // Number of samples to render
			);

			return true;
		}

		/**
		 * Generate WAM parameter info definitions (without WamParameterInfo class)
		 */
		static getParameterConfig() {
			return {
				masterVolume: {
					type: 'float',
					label: 'Master Volume',
					defaultValue: 1.0,
					minValue: 0.0,
					maxValue: 2.0,
				},
				masterPan: {
					type: 'float',
					label: 'Master Pan',
					defaultValue: 0.0,
					minValue: -1.0,
					maxValue: 1.0,
				},
				reverbGain: {
					type: 'float',
					label: 'Reverb',
					defaultValue: 1.0,
					minValue: 0.0,
					maxValue: 2.0,
				},
				chorusGain: {
					type: 'float',
					label: 'Chorus',
					defaultValue: 1.0,
					minValue: 0.0,
					maxValue: 2.0,
				},
			};
		}

		/**
		 * Handle parameter changes
		 * @param {string} parameterId
		 * @param {number} value
		 */
		_onParamChange(parameterId, value) {
			if (!this.synthesizer) return;

			switch (parameterId) {
				case 'masterVolume':
					this.synthesizer.setMasterParameter('masterGain', value);
					break;
				case 'masterPan':
					this.synthesizer.setMasterParameter('masterPan', value);
					break;
				case 'reverbGain':
					this.synthesizer.setMasterParameter('reverbGain', value);
					break;
				case 'chorusGain':
					this.synthesizer.setMasterParameter('chorusGain', value);
					break;
			}
		}
	}

	// Store in module scope for processor to access
	if (!ModuleScope.WamSoundFontSynth) {
		ModuleScope.WamSoundFontSynth = WamSoundFontSynth;
	}

	return WamSoundFontSynth;
};

export default getWamSoundFontSynth;
