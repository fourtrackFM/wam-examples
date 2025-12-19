/* eslint-disable object-curly-newline */
/* eslint-disable prefer-destructuring */
/* eslint-disable class-methods-use-this */
/* eslint-disable no-underscore-dangle */
/* eslint-disable max-len */
/* eslint-disable no-undef */
/* eslint-disable no-plusplus */
/* eslint-disable no-bitwise */
/* eslint-disable max-classes-per-file */

/** @typedef {import('../../api').AudioWorkletGlobalScope} AudioWorkletGlobalScope */
/** @typedef {import('../../api').WamParameterInfoMap} WamParameterInfoMap */
/** @typedef {import('../../sdk').WamParameterInterpolatorMap} WamParameterInterpolatorMap */
/** @typedef {import('./types').WamExampleTemplateModuleScope} WamExampleTemplateModuleScope */
/** @typedef {import('./types').WamExampleTemplateSynth} IWamExampleTemplateSynth */
/** @typedef {typeof import('./types').WamExampleTemplateSynth} WamExampleTemplateSynthConstructor */

/**
 * @param {string} [moduleId]
 * @returns {WamExampleTemplateSynthConstructor}
 */
const getWamExampleTemplateSynth = (moduleId) => {
	/** @type {AudioWorkletGlobalScope} */
	// @ts-ignore
	const audioWorkletGlobalScope = globalThis;

	/** @type {WamExampleTemplateModuleScope} */
	const ModuleScope =
		audioWorkletGlobalScope.webAudioModules.getModuleScope(moduleId);
	const { WamParameterInfo } = ModuleScope;

	/**
	 * @param {number} note
	 */
	function noteToHz(note) {
		return 2.0 ** ((note - 69) / 12.0) * 440.0;
	}

	/**
	 * Template for synth part (mono output)
	 *
	 * @class
	 */
	class WamExampleTemplateSynthPart {
		/**
		 * @param {number} samplesPerQuantum
		 * @param {number} sampleRate
		 */
		constructor(samplesPerQuantum, sampleRate) {
			/** @private @type {number} current sample rate */
			this._sampleRate = sampleRate;

			/** @private @type {number} current gain */
			this._gain = 0.0;

			/** @private @type {number} oscillator phase */
			this._phase = 0.0;

			/** @private @type {number} phase increment per sample */
			this._phaseIncrement = 0.0;

			/** @private @type {boolean} whether or not the part is currently active */
			this._active = false;

			/** @private @type {Int16Array} sample data from soundfont */
			this._sampleData = null;

			/** @private @type {number} current position in sample playback */
			this._samplePosition = 0;

			/** @private @type {number} playback speed ratio */
			this._playbackRate = 1.0;

			/** @private @type {number} root key from sample metadata */
			this._rootKey = 60; // Default middle C

			/** @private @type {number} sample loop start */
			this._loopStart = 0;

			/** @private @type {number} sample loop end */
			this._loopEnd = 0;
		}

		/**
		 * Put the part into idle state
		 */
		reset() {
			this._active = false;
			this._phase = 0.0;
			this._gain = 0.0;
			this._samplePosition = 0;
		}

		/**
		 * Set sample data for playback
		 * @param {Int16Array} sampleData
		 * @param {Object} metadata - Sample metadata with rootKey and loop points
		 */
		setSampleData(sampleData, metadata = {}) {
			this._sampleData = sampleData;
			this._rootKey = metadata.rootKey || 60;
			this._loopStart = metadata.loopStart || 0;
			this._loopEnd =
				metadata.loopEnd || (sampleData ? sampleData.length : 0);
			console.log('[Part] Sample metadata:', {
				rootKey: this._rootKey,
				loopStart: this._loopStart,
				loopEnd: this._loopEnd,
				sampleLength: sampleData ? sampleData.length : 0,
			});
		}

		/**
		 * Trigger envelope attack and start oscillator(s)
		 * @param {number} gain - velocity-based gain
		 * @param {number} frequency - frequency in Hz
		 */
		start(gain, frequency) {
			this._active = true;
			this._gain = gain * 0.3;
			this._phase = 0.0;
			this._phaseIncrement = (frequency * 2 * Math.PI) / this._sampleRate;
			this._samplePosition = 0;
			// Calculate playback rate based on root key
			// Convert MIDI note to frequency: f = 440 * 2^((n-69)/12)
			const rootFreq = 440.0 * Math.pow(2.0, (this._rootKey - 69) / 12.0);
			this._playbackRate = frequency / rootFreq;
		}

		/**
		 * Trigger envelope release
		 * @param {boolean} force whether or not to force a fast release
		 */
		stop(force) {
			this._active = false;
			this._gain = 0.0;
		}

		/**
		 * Add output to the signal buffer
		 * @param {number} startSample beginning of processing slice
		 * @param {number} endSample end of processing slice
		 * @param {Float32Array} signal single-channel signal buffer
		 */
		process(startSample, endSample, signal) {
			if (!this._active) {
				return false;
			}

			let n = startSample;
			while (n < endSample) {
				if (this._sampleData && this._sampleData.length > 0) {
					// Play back sample data with pitch shifting and looping
					const sampleIndex = Math.floor(this._samplePosition);

					// Check if we've reached the end
					if (sampleIndex >= this._sampleData.length) {
						// If loop points are valid, loop back
						if (
							this._loopEnd > this._loopStart &&
							this._loopStart >= 0
						) {
							const loopLength = this._loopEnd - this._loopStart;
							this._samplePosition =
								this._loopStart +
								((sampleIndex - this._loopEnd) % loopLength);
						} else {
							// No loop, end playback
							this._active = false;
							break;
						}
					}

					const finalIndex = Math.floor(this._samplePosition);
					if (
						finalIndex >= 0 &&
						finalIndex < this._sampleData.length
					) {
						// Convert Int16 to float (-1 to 1)
						const sampleValue =
							this._sampleData[finalIndex] / 32768.0;
						signal[n] += this._gain * sampleValue;
						this._samplePosition += this._playbackRate;
					} else {
						this._active = false;
						break;
					}
				} else {
					// Fallback to sine wave if no sample data
					signal[n] += this._gain * Math.sin(this._phase);
					this._phase += this._phaseIncrement;
					if (this._phase >= 2 * Math.PI) this._phase -= 2 * Math.PI;
				}
				n++;
			}

			return this._active;
		}
	}

	/**
	 * Template for stereo synth voice
	 *
	 * @class
	 */
	class WamExampleTemplateSynthVoice {
		/**
		 * @param {number} samplesPerQuantum
		 * @param {number} sampleRate
		 * @param {number} voiceIdx unique int to identify voice
		 */
		constructor(samplesPerQuantum, sampleRate, voiceIdx) {
			/** @private @type {number} just two (stereo) */
			this._numChannels = 2;

			/** @private @type {number} current sample rate */
			this._sampleRate = sampleRate;

			/** @private @type {number} current MIDI channel (when active) */
			this._channel = -1;

			/** @private @type {number} current MIDI note (when active) */
			this._note = -1;

			/** @private @type {number} current MIDI velocity (when active) */
			this._velocity = -1;

			/** @private @type {number} time corresponding to when current note began (when active) */
			this._timestamp = -1;

			/** @private @type {boolean} whether or not the voice is currently active */
			this._active = false;

			/** @private @type {number} counter to track number of times note-off has been received */
			this._deactivating = 0;

			/** @private @type {WamExampleTemplateSynthPart} part for rendering left channel */
			this._leftPart = new WamExampleTemplateSynthPart(
				samplesPerQuantum,
				sampleRate
			);

			/** @private @type {WamExampleTemplateSynthPart} part for rendering right channel */
			this._rightPart = new WamExampleTemplateSynthPart(
				samplesPerQuantum,
				sampleRate
			);
		}

		// read-only properties
		get channel() {
			return this._channel;
		}
		get note() {
			return this._note;
		}
		get velocity() {
			return this._velocity;
		}
		get timestamp() {
			return this._timestamp;
		}
		get active() {
			return this._active;
		}

		/**
		 * Check if the voice is on the channel and note
		 * @param {number} channel MIDI channel number
		 * @param {number} note MIDI note number
		 * @returns {boolean}
		 */
		matches(channel, note) {
			return this._channel === channel && this._note === note;
		}

		/**
		 * Put the voice into idle state
		 */
		reset() {
			this._channel = -1;
			this._note = -1;
			this._velocity = -1;
			this._timestamp = -1;
			this._active = false;
			this._deactivating = 0;

			this._leftPart.reset();
			this._rightPart.reset();
		}

		/**
		 * Trigger the attack of a new note
		 * @param {number} channel MIDI channel number
		 * @param {number} note MIDI note number
		 * @param {number} velocity MIDI velocity number
		 */
		noteOn(channel, note, velocity) {
			console.log(
				`Voice noteOn: channel ${channel} note ${note} velocity ${velocity}`
			);
			this._channel = channel;
			this._note = note;
			this._velocity = velocity;
			this._timestamp = globalThis.currentTime;
			this._active = true;
			this._deactivating = 0;
			const gain = this.velocity / 127;
			const frequency = noteToHz(note);

			this._leftPart.start(gain, frequency);
			this._rightPart.start(gain, frequency);
		}

		/**
		 * Trigger the release of an active note
		 * @param {number} channel MIDI channel number
		 * @param {number} note MIDI note number
		 * @param {number} velocity MIDI velocity number
		 */
		// eslint-disable-next-line no-unused-vars
		noteOff(channel, note, velocity) {
			this._deactivating += 1;
			const force = this._deactivating > 2;
			this._leftPart.stop(force);
			this._rightPart.stop(force);
		}

		/**
		 * Add output from each part to the output buffers
		 * @param {number} startSample beginning of processing slice
		 * @param {number} endSample end of processing slice
		 * @param {Float32Array[]} inputs
		 * @param {Float32Array[]} outputs
		 * @returns {boolean} whether or not the voice is still active
		 */
		process(startSample, endSample, inputs, outputs) {
			if (!this._active) return false;

			const leftActive = this._leftPart.process(
				startSample,
				endSample,
				outputs[0]
			);
			const rightActive = this._rightPart.process(
				startSample,
				endSample,
				outputs[1]
			);

			this._active = leftActive || rightActive;
			return this._active;
		}
	}

	/**
	 * Example polyphonic stereo synth.
	 *
	 * @class
	 * @implements {IWamExampleTemplateSynth}
	 */
	class WamExampleTemplateSynth {
		/**
		 * @param {WamParameterInterpolatorMap} parameterInterpolators
		 * @param {number} samplesPerQuantum
		 * @param {number} sampleRate
		 * @param {Object} config optional config object
		 */
		/* eslint-disable-next-line no-unused-vars */
		constructor(
			parameterInterpolators,
			samplesPerQuantum,
			sampleRate,
			config = {}
		) {
			/** @private @type {number} just two (stereo) */
			this._numChannels = 2;

			/** @private @type {number} number of voices allocated */
			this._numVoices = config.numVoices ?? 16;

			/** @private @type {boolean} whether or not to add the input to the synth's output */
			this._passInput = config.passInput ?? false;

			/** @private @type {Uint8Array} array of voice state flags */
			this._voiceStates = new Uint8Array(this._numVoices);
			this._voiceStates.fill(0);

			/** @private @type {WamExampleTemplateSynthVoice[]} list of allocated voices */
			this._voices = [];
			let i = 0;
			while (i < this._numVoices) {
				this._voices.push(
					new WamExampleTemplateSynthVoice(
						samplesPerQuantum,
						sampleRate,
						i
					)
				);
				i++;
			}

			/** @private @type {ArrayBuffer} full soundfont file buffer */
			this._sf2Buffer = null;

			/** @private @type {Map<number, Object>} map of program number to sample data */
			this._programMap = new Map();

			/** @private @type {number} current program number */
			this._currentProgram = 0;
		}

		/**
		 * Handle MIDI program change
		 * @param {number} program - MIDI program number (0-127)
		 */
		programChange(program) {
			if (program === this._currentProgram) {
				console.log(
					'[Synth] Program change to same program, no action taken'
				);
				return; // No change
			}

			this._currentProgram = program;
			// Load the sample data for this program
			const programData = this._programMap.get(program);
			this._sampleData = programData.sampleData;

			// Update all voices with the new sample data
			const metadata = programData.metadata;
			for (let i = 0; i < this._numVoices; i++) {
				// @ts-ignore
				this._voices[i]._leftPart.setSampleData(
					this._sampleData,
					metadata
				);
				// @ts-ignore
				this._voices[i]._rightPart.setSampleData(
					this._sampleData,
					metadata
				);
			}

			console.log(
				'[Synth] Switched to program',
				program,
				', sample length:',
				this._sampleData?.length
			);
		}

		loadSoundFontData(data) {
			console.log('[Synth] Loading SoundFont data', data);

			// Extract metadata from selected sample
			const metadata = {};
			if (data.selectedSample) {
				metadata.rootKey =
					data.selectedSample.rootKey ||
					data.selectedSample.originalPitch ||
					60;
				metadata.loopStart = data.selectedSample.loopStart || 0;
				metadata.loopEnd =
					data.selectedSample.loopEnd || data.sampleData.length;
				console.log('[Synth] Sample metadata:', metadata);
			}

			// Store this program's data in the map
			const program = data.program || 0;
			this._programMap.set(program, {
				sampleData: data.sampleData,
				metadata: metadata,
			});

			// If this is the current program, activate it now
			if (program === this._currentProgram) {
				this._sampleData = data.sampleData;

				// Distribute sample data to all voice parts
				for (let i = 0; i < this._numVoices; i++) {
					// @ts-ignore
					this._voices[i]._leftPart.setSampleData(
						this._sampleData,
						metadata
					);
					// @ts-ignore
					this._voices[i]._rightPart.setSampleData(
						this._sampleData,
						metadata
					);
				}
			}

			console.log(
				'[Synth] SoundFont program',
				program,
				'loaded, sample length:',
				data.sampleData?.length,
				'total programs:',
				this._programMap.size
			);
		}

		/** Put all voices into idle state */
		reset() {
			this._voiceStates.fill(0);
			let i = 0;
			while (i < this._numVoices) {
				this._voices[i].reset();
				i++;
			}
		}

		/**
		 * Start a new voice on the channel and note
		 * @param {number} channel MIDI channel number
		 * @param {number} note MIDI note number
		 * @param {number} velocity MIDI velocity number
		 */
		noteOn(channel, note, velocity) {
			console.log('[Synth] noteOn called:', { channel, note, velocity });

			/* stop any matching voices */
			this.noteOff(channel, note, velocity);

			/* start an idle voice, stealing the eldest active one if necessary */
			let oldestTimestamp = globalThis.currentTime;
			let oldestIdx = 0;
			let allocatedIdx = -1;
			let i = 0;
			while (i < this._numVoices) {
				if (this._voiceStates[i] === 0) {
					allocatedIdx = i;
					break;
				}
				if (this._voices[i].timestamp <= oldestTimestamp) {
					oldestTimestamp = this._voices[i].timestamp;
					oldestIdx = i;
				}
				i++;
			}
			if (allocatedIdx === -1) {
				/* no idle voices, steal the oldest one */
				this.noteEnd(oldestIdx);
				allocatedIdx = oldestIdx;
			}

			console.log('[Synth] Allocating voice:', allocatedIdx);
			this._voiceStates[allocatedIdx] = 1;
			this._voices[allocatedIdx].noteOn(channel, note, velocity);
		}

		/**
		 * Stop active voices on the channel and note
		 * @param {number} channel MIDI channel number
		 * @param {number} note MIDI note number
		 * @param {number} velocity MIDI velocity number
		 */
		noteOff(channel, note, velocity) {
			/* stop all matching voices */
			let i = 0;
			while (i < this._numVoices) {
				if (
					this._voiceStates[i] === 1 &&
					this._voices[i].matches(channel, note)
				) {
					this._voices[i].noteOff(channel, note, velocity);
				}
				i++;
			}
		}

		/**
		 * Terminate a voice
		 * @param {number} voiceIdx the index of the ending voice
		 */
		noteEnd(voiceIdx) {
			/* update voice state */
			this._voiceStates[voiceIdx] = 0;
			this._voices[voiceIdx].reset();
		}

		/**
		 * Add output from all active voices to the output buffers
		 * @param {number} startSample beginning of processing slice
		 * @param {number} endSample end of processing slice
		 * @param {Float32Array[]} inputs
		 * @param {Float32Array[]} outputs
		 */
		process(startSample, endSample, inputs, outputs) {
			const activeVoices = this._voiceStates.reduce(
				(sum, state) => sum + state,
				0
			);

			// clear/initialize output buffers
			for (let c = 0; c < this._numChannels; ++c) {
				let n = startSample;
				while (n < endSample) {
					outputs[c][n] = 0;
					n++;
				}
			}

			// render active voices
			let i = 0;
			while (i < this._numVoices) {
				if (this._voiceStates[i] === 1) {
					const stillActive = this._voices[i].process(
						startSample,
						endSample,
						inputs,
						outputs
					);
					if (!stillActive) this.noteEnd(i);
				}
				i++;
			}
		}

		static generateWamParameterInfo() {
			return {
				// SoundFont synth parameters
			};
		}
	}

	if (audioWorkletGlobalScope.AudioWorkletProcessor) {
		if (!ModuleScope.WamExampleTemplateSynth)
			ModuleScope.WamExampleTemplateSynth = WamExampleTemplateSynth;
	}

	return WamExampleTemplateSynth;
};

export default getWamExampleTemplateSynth;
