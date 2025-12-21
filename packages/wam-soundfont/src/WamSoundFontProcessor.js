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

			this.params = this._generateWamParameterInfo();
		}

		/**
		 * Fetch plugin's params.
		 * @returns {WamParameterInfoMap}
		 */
		_generateWamParameterInfo() {
			const params = {
				// your plugin parameters here
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

			// Add debug info parameters as read-only strings
			if (this._debugData) {
				params.sf2_debug_hydra = new WamParameterInfo(
					'sf2_debug_hydra',
					{
						type: 'string',
						label: 'SF2 Hydra Structure (Debug)',
						defaultValue: JSON.stringify(
							this._debugData.hydra || {}
						),
						readOnly: true,
					}
				);
				params.sf2_debug_programs = new WamParameterInfo(
					'sf2_debug_programs',
					{
						type: 'string',
						label: 'SF2 Programs Metadata (Debug)',
						defaultValue: JSON.stringify(
							this._debugData.programs || []
						),
						readOnly: true,
					}
				);
				params.sf2_debug_current_program = new WamParameterInfo(
					'sf2_debug_current_program',
					{
						type: 'int',
						label: 'Current Program (Debug)',
						defaultValue: this._debugData.currentProgram || 0,
						readOnly: true,
					}
				);
			}

			return params;
		}

		/**
		 * Post-constructor initialization method.
		 */
		_initialize() {
			console.log('[Processor] _initialize called');
			super._initialize();

			// Get SF2 buffer from constructor
			const sf2Buffer = this._sf2Buffer;
			if (!sf2Buffer) {
				console.error('[Processor] No SF2 buffer provided in options');
				return;
			}

			const synthConfig = {
				passInput: false,
				sf2Buffer: sf2Buffer, // Pass SF2 buffer in config so synth can parse all programs
			};
			// Create synth with SF2 buffer - it will parse all programs in constructor
			this._synth = new WamExampleTemplateSynth(
				this._parameterInterpolators,
				this._samplesPerQuantum,
				globalThis.sampleRate,
				synthConfig
			);
			console.log('[Processor] Synth created with SF2 buffer');

			// Store debug data for parameter generation
			this._debugData = this._synth.getDebugData();

			// Regenerate parameters to include debug data
			this.params = this._generateWamParameterInfo();

			console.log('[Processor] _initialize complete');
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
		 * Optimized MIDI handler - handles note on/off and program change
		 * @param {WamMidiData} midiData
		 */
		_onMidi(midiData) {
			const bytes = midiData.bytes;
			let type = bytes[0] & 0xf0;
			const channel = bytes[0] & 0x0f;
			const data1 = bytes[1];
			const data2 = bytes[2];

			// Convert note-on with velocity 0 to note-off
			if (type === 0x90 && data2 === 0) type = 0x80;

			// Handle note on/off
			if (type === 0x80) {
				this._synth.noteOff(channel, data1, data2);
			} else if (type === 0x90) {
				this._synth.noteOn(channel, data1, data2);
			} else if (type === 0xc0) {
				// MIDI program change
				const newProgram = data1;
				if (newProgram !== this._currentProgram) {
					this._currentProgram = newProgram;

					// Update debug parameter
					if (this._debugData) {
						this._debugData.currentProgram = newProgram;
					}
				}
				this._synth.programChange(newProgram);
			}
		}

		/**
		 * Handle messages from main thread
		 * @param {MessageEvent} event
		 */
		_onMessage(event) {
			if (event.data.type === 'getDebugData') {
				const debugData = this.getDebugData();
				this.port.postMessage({
					type: 'debugDataResponse',
					debugData,
				});
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
