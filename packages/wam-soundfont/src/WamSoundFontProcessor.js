/* eslint-disable object-curly-newline */
/* eslint-disable prefer-destructuring */
/* eslint-disable class-methods-use-this */
/* eslint-disable no-underscore-dangle */
/* eslint-disable max-len */
/* eslint-disable no-undef */
/* eslint-disable no-plusplus */
/* eslint-disable no-bitwise */
/* eslint-disable max-classes-per-file */

/** @typedef {import('../../api/src').AudioWorkletGlobalScope} AudioWorkletGlobalScope */
/** @typedef {import('../../api/src').AudioWorkletProcessor} AudioWorkletProcessor */
/** @typedef {import('../../api/src').WamProcessor} WamProcessor */
/** @typedef {import('../../api/src').WamParameter} WamParameter */
/** @typedef {import('../../api/src').WamParameterInfo} WamParameterInfo */
/** @typedef {import('../../api/src').WamParameterInfoMap} WamParameterInfoMap */
/** @typedef {import('../../api/src').WamParameterData} WamParameterData */
/** @typedef {import('../../api/src').WamParameterDataMap} WamParameterDataMap */
/** @typedef {import('../../api/src').WamMidiData} WamMidiData */
/** @typedef {import('./types').WamExampleTemplateModuleScope} WamExampleTemplateModuleScope */
/** @typedef {import('./types').WamExampleTemplateProcessor} IWamExampleTemplateProcessor */
/** @typedef {typeof import('./types').WamExampleTemplateProcessor} WamExampleTemplateProcessorConstructor */
/** @typedef {import('./types').WamExampleTemplateSynth} IWamExampleTemplateSynth */

/**
 * @param {string} [moduleId]
 * @returns {WamExampleTemplateProcessorConstructor}
 */
const getWamExampleTemplateProcessor = (moduleId) => {
	console.log('[Processor Module] ===== LOADING PROCESSOR MODULE =====');
	console.log('[Processor Module] Loading with moduleId:', moduleId);
	console.log('[Processor Module] globalThis:', typeof globalThis);
	console.log('[Processor Module] sampleRate:', globalThis.sampleRate);

	/** @type {AudioWorkletGlobalScope} */
	// @ts-ignore
	const audioWorkletGlobalScope = globalThis;
	const { registerProcessor } = audioWorkletGlobalScope;

	console.log('[Processor Module] Getting module scope');
	/** @type {WamExampleTemplateModuleScope} */
	const ModuleScope =
		audioWorkletGlobalScope.webAudioModules.getModuleScope(moduleId);
	const { WamProcessor, WamParameterInfo, WamExampleTemplateSynth } =
		ModuleScope;

	console.log('[Processor Module] Module scope obtained', {
		hasWamProcessor: !!WamProcessor,
		hasWamParameterInfo: !!WamParameterInfo,
		hasWamExampleTemplateSynth: !!WamExampleTemplateSynth,
	});

	/**
	 * `WamExampleTemplate`'s `AudioWorkletProcessor`
	 *
	 * @class
	 * @extends {WamProcessor}
	 * @implements {IWamExampleTemplateProcessor}
	 */
	class WamExampleTemplateProcessor extends WamProcessor {
		/**
		 * @param {AudioWorkletNodeOptions} options
		 */
		constructor(options) {
			console.log('[Processor] Constructor called');
			super(options);
			// your plugin initialization code here
			/** @private @type {IWamExampleTemplateSynth} */
			this._synth = null;

			/** @private @type {ArrayBuffer} */
			this._sf2Buffer = options.processorOptions
				? options.processorOptions.sf2Buffer
				: null;

			/** @private @type {number} */
			this._currentProgram = 0;

			/** @private @type {Object} */
			this._debugData = null;

			// Initialize synth with SF2 buffer
			if (this._sf2Buffer) {
				const synthConfig = {
					passInput: false,
					sf2Buffer: this._sf2Buffer,
				};
				this._synth = new WamExampleTemplateSynth(
					this._parameterInterpolators,
					this._samplesPerQuantum,
					globalThis.sampleRate,
					synthConfig
				);
				console.log('[Processor] Synth created with SF2 buffer');

				// Store debug data for parameter generation
				this._debugData = this._synth.getDebugData();
				console.log('[Processor] Debug data obtained');
			} else {
				console.error('[Processor] No SF2 buffer provided in options');
			}

			this.params = this._generateWamParameterInfo();

			// Call post-constructor initialization
			this._initialize();
		}

		/**
		 * Fetch plugin's params.
		 * @returns {WamParameterInfoMap}
		 */
		_generateWamParameterInfo() {
			const params = {
				// Control parameters - always available
				bypass: new WamParameterInfo('bypass', {
					type: 'boolean',
					label: 'Bypass',
					defaultValue: 0,
				}),
				program: new WamParameterInfo('program', {
					type: 'int',
					label: 'Program',
					defaultValue: 0,
					minValue: 0,
					maxValue: 127,
				}),
			};

			// Add SF2 metadata parameters if debug data is available
			if (!this._debugData) {
				return params;
			}
			const { hydra, programs } = this._debugData;

			// Current program metadata (updated dynamically)
			const currentProgramData =
				programs && programs.length > 0
					? programs.find(
							(p) => p.program === this._currentProgram
					  ) || programs[0]
					: null;

			// Get generators for current program
			const currentGenerators = this._getCurrentProgramGenerators(
				hydra,
				this._currentProgram
			);

			// SF2 structure counts
			if (hydra) {
				params.sf2_preset_count = new WamParameterInfo(
					'sf2_preset_count',
					{
						type: 'int',
						label: 'SF2 Preset Count',
						defaultValue: hydra.presetHeaders
							? hydra.presetHeaders.length - 1
							: 0,
						minValue: 0,
						maxValue: 10000,
					}
				);

				params.sf2_instrument_count = new WamParameterInfo(
					'sf2_instrument_count',
					{
						type: 'int',
						label: 'SF2 Instrument Count',
						defaultValue: hydra.instruments
							? hydra.instruments.length - 1
							: 0,
						minValue: 0,
						maxValue: 10000,
					}
				);

				params.sf2_sample_count = new WamParameterInfo(
					'sf2_sample_count',
					{
						type: 'int',
						label: 'SF2 Sample Count',
						defaultValue: hydra.sampleHeaders
							? hydra.sampleHeaders.length
							: 0,
						minValue: 0,
						maxValue: 10000,
					}
				);
			}

			// Add generator values for current program
			if (currentGenerators) {
				// Envelope generators
				if (currentGenerators.attackVolEnv !== undefined) {
					params.gen_attack_vol_env = new WamParameterInfo(
						'gen_attack_vol_env',
						{
							type: 'float',
							label: 'Volume Envelope Attack (ms)',
							defaultValue: currentGenerators.attackVolEnv,
							minValue: 0,
							maxValue: 100000,
						}
					);
				}
				if (currentGenerators.decayVolEnv !== undefined) {
					params.gen_decay_vol_env = new WamParameterInfo(
						'gen_decay_vol_env',
						{
							type: 'float',
							label: 'Volume Envelope Decay (ms)',
							defaultValue: currentGenerators.decayVolEnv,
							minValue: 0,
							maxValue: 100000,
						}
					);
				}
				if (currentGenerators.sustainVolEnv !== undefined) {
					params.gen_sustain_vol_env = new WamParameterInfo(
						'gen_sustain_vol_env',
						{
							type: 'float',
							label: 'Volume Envelope Sustain (dB)',
							defaultValue: currentGenerators.sustainVolEnv,
							minValue: -96,
							maxValue: 0,
						}
					);
				}
				if (currentGenerators.releaseVolEnv !== undefined) {
					params.gen_release_vol_env = new WamParameterInfo(
						'gen_release_vol_env',
						{
							type: 'float',
							label: 'Volume Envelope Release (ms)',
							defaultValue: currentGenerators.releaseVolEnv,
							minValue: 0,
							maxValue: 100000,
						}
					);
				}

				// Filter generators
				if (currentGenerators.initialFilterFc !== undefined) {
					params.gen_filter_cutoff = new WamParameterInfo(
						'gen_filter_cutoff',
						{
							type: 'float',
							label: 'Filter Cutoff (Hz)',
							defaultValue: currentGenerators.initialFilterFc,
							minValue: 20,
							maxValue: 20000,
						}
					);
				}
				if (currentGenerators.initialFilterQ !== undefined) {
					params.gen_filter_q = new WamParameterInfo('gen_filter_q', {
						type: 'float',
						label: 'Filter Resonance (Q)',
						defaultValue: currentGenerators.initialFilterQ / 10,
						minValue: 0,
						maxValue: 96,
					});
				}

				// Attenuation
				if (currentGenerators.initialAttenuation !== undefined) {
					params.gen_attenuation = new WamParameterInfo(
						'gen_attenuation',
						{
							type: 'float',
							label: 'Initial Attenuation (cB)',
							defaultValue: currentGenerators.initialAttenuation,
							minValue: 0,
							maxValue: 1440,
						}
					);
				}

				// Pan
				if (currentGenerators.pan !== undefined) {
					params.gen_pan = new WamParameterInfo('gen_pan', {
						type: 'float',
						label: 'Pan Position',
						defaultValue: currentGenerators.pan,
						minValue: -500,
						maxValue: 500,
					});
				}

				// LFO generators
				if (currentGenerators.freqModLFO !== undefined) {
					params.gen_mod_lfo_freq = new WamParameterInfo(
						'gen_mod_lfo_freq',
						{
							type: 'float',
							label: 'Mod LFO Frequency (Hz)',
							defaultValue: currentGenerators.freqModLFO,
							minValue: 0,
							maxValue: 100,
						}
					);
				}
				if (currentGenerators.delayModLFO !== undefined) {
					params.gen_mod_lfo_delay = new WamParameterInfo(
						'gen_mod_lfo_delay',
						{
							type: 'float',
							label: 'Mod LFO Delay (ms)',
							defaultValue: currentGenerators.delayModLFO,
							minValue: 0,
							maxValue: 100000,
						}
					);
				}

				// Tuning
				if (currentGenerators.coarseTune !== undefined) {
					params.gen_coarse_tune = new WamParameterInfo(
						'gen_coarse_tune',
						{
							type: 'int',
							label: 'Coarse Tune (semitones)',
							defaultValue: currentGenerators.coarseTune,
							minValue: -120,
							maxValue: 120,
						}
					);
				}
				if (currentGenerators.fineTune !== undefined) {
					params.gen_fine_tune = new WamParameterInfo(
						'gen_fine_tune',
						{
							type: 'int',
							label: 'Fine Tune (cents)',
							defaultValue: currentGenerators.fineTune,
							minValue: -99,
							maxValue: 99,
						}
					);
				}

				// Effects send
				if (currentGenerators.reverbEffectsSend !== undefined) {
					params.gen_reverb_send = new WamParameterInfo(
						'gen_reverb_send',
						{
							type: 'float',
							label: 'Reverb Send (%)',
							defaultValue: currentGenerators.reverbEffectsSend,
							minValue: 0,
							maxValue: 100,
						}
					);
				}
				if (currentGenerators.chorusEffectsSend !== undefined) {
					params.gen_chorus_send = new WamParameterInfo(
						'gen_chorus_send',
						{
							type: 'float',
							label: 'Chorus Send (%)',
							defaultValue: currentGenerators.chorusEffectsSend,
							minValue: 0,
							maxValue: 100,
						}
					);
				}
			}

			// Current program metadata
			if (currentProgramData) {
				params.current_program_sample_rate = new WamParameterInfo(
					'current_program_sample_rate',
					{
						type: 'int',
						label: 'Current Program Sample Rate',
						defaultValue: currentProgramData.sampleRate || 44100,
						minValue: 8000,
						maxValue: 192000,
					}
				);

				params.current_program_sample_length = new WamParameterInfo(
					'current_program_sample_length',
					{
						type: 'int',
						label: 'Current Program Sample Length',
						defaultValue: currentProgramData.sampleLength || 0,
						minValue: 0,
						maxValue: 10000000,
					}
				);

				params.current_program_loop_start = new WamParameterInfo(
					'current_program_loop_start',
					{
						type: 'int',
						label: 'Current Program Loop Start',
						defaultValue: currentProgramData.loopStart || 0,
						minValue: 0,
						maxValue: 10000000,
					}
				);

				params.current_program_loop_end = new WamParameterInfo(
					'current_program_loop_end',
					{
						type: 'int',
						label: 'Current Program Loop End',
						defaultValue: currentProgramData.loopEnd || 0,
						minValue: 0,
						maxValue: 10000000,
					}
				);
			}

			// Total programs loaded
			if (programs) {
				params.total_programs_loaded = new WamParameterInfo(
					'total_programs_loaded',
					{
						type: 'int',
						label: 'Total Programs Loaded',
						defaultValue: programs.length,
						minValue: 0,
						maxValue: 128,
					}
				);
			}

			// Current program preset and instrument indices (for name lookup)
			if (hydra && hydra.presetHeaders) {
				const preset = hydra.presetHeaders.find(
					(p) => p.preset === this._currentProgram && p.bank === 0
				);
				if (preset) {
					const presetIndex = hydra.presetHeaders.indexOf(preset);
					params.current_program_preset_index = new WamParameterInfo(
						'current_program_preset_index',
						{
							type: 'int',
							label: 'Current Preset Index',
							defaultValue: presetIndex,
							minValue: 0,
							maxValue: 1000,
						}
					);

					params.current_program_bank = new WamParameterInfo(
						'current_program_bank',
						{
							type: 'int',
							label: 'Current Program Bank',
							defaultValue: preset.bank,
							minValue: 0,
							maxValue: 128,
						}
					);

					// Get the instrument index from preset bags
					if (hydra.presetBags && hydra.instruments) {
						const bagStart = preset.presetBagNdx;
						const nextPreset = hydra.presetHeaders[presetIndex + 1];
						const bagEnd = nextPreset
							? nextPreset.presetBagNdx
							: hydra.presetBags.length;

						for (let bagIdx = bagStart; bagIdx < bagEnd; bagIdx++) {
							const bag = hydra.presetBags[bagIdx];
							if (!bag) continue;

							const genStart = bag.genIndex;
							const genEnd =
								bagIdx + 1 < hydra.presetBags.length
									? hydra.presetBags[bagIdx + 1].genIndex
									: hydra.presetGens.length;

							for (
								let genIdx = genStart;
								genIdx < genEnd;
								genIdx++
							) {
								const gen = hydra.presetGens[genIdx];
								if (gen && gen.oper === 41) {
									// instrument generator
									params.current_program_instrument_index =
										new WamParameterInfo(
											'current_program_instrument_index',
											{
												type: 'int',
												label: 'Current Instrument Index',
												defaultValue: gen.amount,
												minValue: 0,
												maxValue: 1000,
											}
										);
									break;
								}
							}
						}
					}
				}
			}

			// Generator counts
			if (hydra) {
				if (hydra.presetGens) {
					params.preset_generator_count = new WamParameterInfo(
						'preset_generator_count',
						{
							type: 'int',
							label: 'Preset Generator Count',
							defaultValue: hydra.presetGens.length,
							minValue: 0,
							maxValue: 100000,
						}
					);
				}
				if (hydra.instrumentGens) {
					params.instrument_generator_count = new WamParameterInfo(
						'instrument_generator_count',
						{
							type: 'int',
							label: 'Instrument Generator Count',
							defaultValue: hydra.instrumentGens.length,
							minValue: 0,
							maxValue: 100000,
						}
					);
				}
				if (hydra.presetBags) {
					params.preset_bag_count = new WamParameterInfo(
						'preset_bag_count',
						{
							type: 'int',
							label: 'Preset Bag Count',
							defaultValue: hydra.presetBags.length,
							minValue: 0,
							maxValue: 100000,
						}
					);
				}
				if (hydra.instrumentBags) {
					params.instrument_bag_count = new WamParameterInfo(
						'instrument_bag_count',
						{
							type: 'int',
							label: 'Instrument Bag Count',
							defaultValue: hydra.instrumentBags.length,
							minValue: 0,
							maxValue: 100000,
						}
					);
				}
			}

			// Add current program originalPitch if available
			if (
				currentProgramData &&
				currentProgramData.originalPitch !== undefined
			) {
				params.current_program_original_pitch = new WamParameterInfo(
					'current_program_original_pitch',
					{
						type: 'int',
						label: 'Current Program Original Pitch',
						defaultValue: currentProgramData.originalPitch,
						minValue: 0,
						maxValue: 127,
					}
				);
			}

			return params;
		}

		/**
		 * Extract generator values for the current program from hydra structure
		 * @param {Object} hydra - The hydra structure
		 * @param {number} programNumber - MIDI program number (0-127)
		 * @returns {Object} Generator values with human-readable names
		 */
		_getCurrentProgramGenerators(hydra, programNumber) {
			if (
				!hydra ||
				!hydra.presetHeaders ||
				!hydra.presetBags ||
				!hydra.presetGens
			) {
				return null;
			}

			// Find the preset for this program number (bank 0)
			const preset = hydra.presetHeaders.find(
				(p) => p.preset === programNumber && p.bank === 0
			);
			if (!preset) {
				return null;
			}

			const generators = {};
			const genMap = {
				0: 'startAddrsOffset',
				1: 'endAddrsOffset',
				2: 'startloopAddrsOffset',
				3: 'endloopAddrsOffset',
				4: 'startAddrsCoarseOffset',
				5: 'modLfoToPitch',
				6: 'vibLfoToPitch',
				7: 'modEnvToPitch',
				8: 'initialFilterFc',
				9: 'initialFilterQ',
				10: 'modLfoToFilterFc',
				11: 'modEnvToFilterFc',
				12: 'endAddrsCoarseOffset',
				13: 'modLfoToVolume',
				15: 'chorusEffectsSend',
				16: 'reverbEffectsSend',
				17: 'pan',
				21: 'delayModLFO',
				22: 'freqModLFO',
				23: 'delayVibLFO',
				24: 'freqVibLFO',
				25: 'delayModEnv',
				26: 'attackModEnv',
				27: 'holdModEnv',
				28: 'decayModEnv',
				29: 'sustainModEnv',
				30: 'releaseModEnv',
				33: 'delayVolEnv',
				34: 'attackVolEnv',
				35: 'holdVolEnv',
				36: 'decayVolEnv',
				37: 'sustainVolEnv',
				38: 'releaseVolEnv',
				43: 'keyRange',
				44: 'velRange',
				45: 'startloopAddrsCoarseOffset',
				46: 'keynum',
				47: 'velocity',
				48: 'initialAttenuation',
				50: 'endloopAddrsCoarseOffset',
				51: 'coarseTune',
				52: 'fineTune',
				53: 'sampleID',
				54: 'sampleModes',
				56: 'scaleTuning',
				57: 'exclusiveClass',
				58: 'overridingRootKey',
			};

			// Get preset bags for this preset
			const bagStart = preset.presetBagNdx;
			const nextPreset =
				hydra.presetHeaders[hydra.presetHeaders.indexOf(preset) + 1];
			const bagEnd = nextPreset
				? nextPreset.presetBagNdx
				: hydra.presetBags.length;

			// Process all bags for this preset
			for (let bagIdx = bagStart; bagIdx < bagEnd; bagIdx++) {
				const bag = hydra.presetBags[bagIdx];
				if (!bag) continue;

				const genStart = bag.genIndex;
				const genEnd =
					bagIdx + 1 < hydra.presetBags.length
						? hydra.presetBags[bagIdx + 1].genIndex
						: hydra.presetGens.length;

				// Process generators in this bag
				for (let genIdx = genStart; genIdx < genEnd; genIdx++) {
					const gen = hydra.presetGens[genIdx];
					if (!gen) continue;

					const genName = genMap[gen.oper];
					if (genName) {
						// Convert timecents to milliseconds for envelope times
						if (
							[
								21, 23, 25, 26, 27, 28, 30, 33, 34, 35, 36, 38,
							].includes(gen.oper)
						) {
							const signed =
								gen.amount > 32767
									? gen.amount - 65536
									: gen.amount;
							generators[genName] =
								Math.pow(2, signed / 1200) * 1000;
						}
						// Convert centibels to decibels for sustain
						else if ([29, 37].includes(gen.oper)) {
							generators[genName] = gen.amount / 10;
						}
						// Convert cents to Hz for filter cutoff
						else if (gen.oper === 8) {
							const signed =
								gen.amount > 32767
									? gen.amount - 65536
									: gen.amount;
							generators[genName] =
								8.176 * Math.pow(2, signed / 1200);
						}
						// Convert cents to Hz for LFO frequency
						else if ([22, 24].includes(gen.oper)) {
							const signed =
								gen.amount > 32767
									? gen.amount - 65536
									: gen.amount;
							generators[genName] =
								8.176 * Math.pow(2, signed / 1200);
						}
						// Percent values
						else if ([15, 16].includes(gen.oper)) {
							generators[genName] = gen.amount / 10;
						}
						// Pan
						else if (gen.oper === 17) {
							const signed =
								gen.amount > 32767
									? gen.amount - 65536
									: gen.amount;
							generators[genName] = signed;
						}
						// Direct values
						else {
							const signed =
								gen.amount > 32767
									? gen.amount - 65536
									: gen.amount;
							generators[genName] = signed;
						}
					}
				}
			}

			return generators;
		}

		/**
		 * Get string lookup table for SF2 names and detailed metadata
		 * @returns {Object} Lookup tables for preset names, instrument names, sample names, and generator info
		 */
		getNameLookupTable() {
			const { hydra, programs } = this._debugData;
			const lookup = {
				presets: {},
				instruments: {},
				samples: {},
				programs: {},
				generators: {
					preset: {},
					instrument: {},
				},
			};

			// Preset names from hydra
			if (hydra && hydra.presetHeaders) {
				hydra.presetHeaders.forEach((preset, index) => {
					if (preset.name) {
						lookup.presets[index] = {
							name: preset.name,
							preset: preset.preset,
							bank: preset.bank,
							bagIndex: preset.presetBagNdx,
						};
					}
				});
			}

			// Instrument names from hydra
			if (hydra && hydra.instruments) {
				hydra.instruments.forEach((instrument, index) => {
					if (instrument.name) {
						lookup.instruments[index] = {
							name: instrument.name,
							bagIndex: instrument.bagIndex,
						};
					}
				});
			}

			// Sample names from hydra
			if (hydra && hydra.sampleHeaders) {
				hydra.sampleHeaders.forEach((sample, index) => {
					if (sample.name) {
						lookup.samples[index] = {
							name: sample.name,
							sampleRate: sample.sampleRate,
							originalPitch: sample.originalPitch,
							pitchCorrection: sample.pitchCorrection,
							loopStart: sample.loopStart,
							loopEnd: sample.loopEnd,
							start: sample.start,
							end: sample.end,
						};
					}
				});
			}

			// Program names and metadata
			if (programs) {
				programs.forEach((prog) => {
					lookup.programs[prog.program] = {
						name: prog.presetName,
						sampleRate: prog.sampleRate,
						sampleLength: prog.sampleLength,
						loopStart: prog.loopStart,
						loopEnd: prog.loopEnd,
						originalPitch: prog.originalPitch,
					};
				});
			}

			// Add quick lookup for current program
			if (hydra && hydra.presetHeaders) {
				const preset = hydra.presetHeaders.find(
					(p) => p.preset === this._currentProgram && p.bank === 0
				);
				if (preset) {
					lookup.currentProgram = {
						number: this._currentProgram,
						presetName: preset.name,
						bank: preset.bank,
						presetIndex: hydra.presetHeaders.indexOf(preset),
					};

					// Find instrument name
					if (
						hydra.presetBags &&
						hydra.instruments &&
						hydra.presetGens
					) {
						const bagStart = preset.presetBagNdx;
						const presetIndex = hydra.presetHeaders.indexOf(preset);
						const nextPreset = hydra.presetHeaders[presetIndex + 1];
						const bagEnd = nextPreset
							? nextPreset.presetBagNdx
							: hydra.presetBags.length;

						for (let bagIdx = bagStart; bagIdx < bagEnd; bagIdx++) {
							const bag = hydra.presetBags[bagIdx];
							if (!bag) continue;

							const genStart = bag.genIndex;
							const genEnd =
								bagIdx + 1 < hydra.presetBags.length
									? hydra.presetBags[bagIdx + 1].genIndex
									: hydra.presetGens.length;

							for (
								let genIdx = genStart;
								genIdx < genEnd;
								genIdx++
							) {
								const gen = hydra.presetGens[genIdx];
								if (gen && gen.oper === 41) {
									// instrument generator
									const instrument =
										hydra.instruments[gen.amount];
									if (instrument) {
										lookup.currentProgram.instrumentName =
											instrument.name;
										lookup.currentProgram.instrumentIndex =
											gen.amount;
									}
									break;
								}
							}
						}
					}
				}
			}

			return lookup;
		}

		/**
		 * Post-constructor initialization method.
		 */
		_initialize() {
			console.log('[Processor] _initialize called');
			super._initialize();
			console.log(
				'[Processor] _initialize complete (synth already initialized in constructor)'
			);
		}

		/**
		 * Override to handle parameter changes, particularly program changes
		 * @param {import('../../api/src').WamParameterData} parameterUpdate
		 * @param {boolean} interpolate
		 */
		_setParameterValue(parameterUpdate, interpolate) {
			// Call parent implementation first
			super._setParameterValue(parameterUpdate, interpolate);

			// Handle program changes
			if (parameterUpdate.id === 'program') {
				const newProgram = Math.round(
					parameterUpdate.normalized
						? parameterUpdate.value * 127
						: parameterUpdate.value
				);

				// Only change if different and synth is initialized
				if (this._synth && newProgram !== this._currentProgram) {
					this._currentProgram = newProgram;
					this._synth.programChange(newProgram);

					// Update debug parameter
					if (this._debugData) {
						this._debugData.currentProgram = newProgram;
					}

					// Update program-specific parameters
					this._updateProgramParameters(newProgram);

					console.log(
						'[Processor] Program changed via automation to:',
						newProgram
					);
				}
			}
		}

		/**
		 * Get debug data from synth
		 * @returns {Object}
		 */
		getDebugData() {
			if (!this._synth) return null;
			return this._synth.getDebugData();
		}

		/**
		 * Update current program parameters when program changes
		 * @param {number} programNumber
		 */
		_updateProgramParameters(programNumber) {
			if (!this._debugData || !this._debugData.programs) return;

			const programData = this._debugData.programs.find(
				(p) => p.program === programNumber
			);
			if (!programData) {
				console.warn(
					'[Processor] No program data found for program:',
					programNumber
				);
				return;
			}

			console.log(
				'[Processor] Updating parameters for program:',
				programNumber,
				programData
			);

			// Note: WamParameterInfo objects are immutable after creation
			// We can't update their default values dynamically
			// Instead, we could create new parameter info objects, but that's expensive
			// For now, just log the change - the GUI can query the current values
		}

		/**
		 * Optimized MIDI handler - handles note on/off and program change
		 * @param {WamMidiData} midiData
		 */
		_onMidi(midiData) {
			const bytes = midiData.bytes;
			let type = bytes[0] & 0xf0;
			const channel = bytes[0] & 0x0f;
			const data1 = bytes[1];
			const data2 = bytes[2];

			console.log('[Processor] MIDI received:', {
				type: type.toString(16),
				channel,
				data1,
				data2,
				synthExists: !!this._synth,
			});

			// Convert note-on with velocity 0 to note-off
			if (type === 0x90 && data2 === 0) type = 0x80;

			// Handle note on/off
			if (type === 0x80) {
				this._synth.noteOff(channel, data1, data2);
				console.log('[Processor] Note OFF:', data1);
			} else if (type === 0x90) {
				this._synth.noteOn(channel, data1, data2);
				console.log('[Processor] Note ON:', data1, 'velocity:', data2);
			} else if (type === 0xc0) {
				// MIDI program change
				const newProgram = data1;
				if (newProgram !== this._currentProgram) {
					this._currentProgram = newProgram;

					// Update debug parameter

					// Update program-specific parameters
					this._updateProgramParameters(newProgram);
					if (this._debugData) {
						this._debugData.currentProgram = newProgram;
					}
				}
				this._synth.programChange(newProgram);
			}
		}

		/**
		 * Process audio - called by the base class process() method
		 * @param {number} startSample
		 * @param {number} endSample
		 * @param {Float32Array[][]} inputs
		 * @param {Float32Array[][]} outputs
		 */
		_process(startSample, endSample, inputs, outputs) {
			const input = inputs[0];
			const output = outputs[0];

			if (!this._synth) {
				console.error('[Processor] No synth in _process!');
				return;
			}

			// Process audio through the synth
			this._synth.process(startSample, endSample, input, output);
		}
	}

	console.log('[Processor Module] Registering processor');
	try {
		registerProcessor(moduleId, WamExampleTemplateProcessor);
		console.log('[Processor Module] Registration successful');
	} catch (error) {
		console.error('[Processor Module] Registration failed:', error);
	}

	return WamExampleTemplateProcessor;
};

export default getWamExampleTemplateProcessor;
