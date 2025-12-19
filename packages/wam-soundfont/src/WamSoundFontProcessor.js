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
			return {
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
					console.log(
						'[Processor] Program changed via automation to:',
						newProgram
					);
				}
			}
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
					// Request the Node to load this program
					// this.port.postMessage({
					// 	type: 'requestProgramLoad',
					// 	program: newProgram,
					// });
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
