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

			/** @private Store soundfont data until synth is created */
			this._pendingSoundFontData = null;

			/** @private Track current program number */
			this._currentProgram = 0;

			// Set up message handler immediately in constructor
			const originalOnMessage = this.port.onmessage;
			this.port.onmessage = (event) => {
				if (event.data.type === 'loadSoundFont') {
					console.log(
						'[Processor] Received SoundFont data, sample length:',
						event.data.data.sampleData?.length
					);
					if (this._synth) {
						// @ts-ignore
						this._synth.loadSoundFontData(event.data.data);
					} else {
						this._pendingSoundFontData = event.data.data;
					}
				} else if (originalOnMessage) {
					originalOnMessage.call(this.port, event);
				}
			};

			console.log(
				'[Processor] Constructor complete, message handler set'
			);
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
					defaultValue: false,
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
			const synthConfig = {
				passInput: false,
			};
			this._synth = new WamExampleTemplateSynth(
				this._parameterInterpolators,
				this._samplesPerQuantum,
				globalThis.sampleRate,
				synthConfig
			);
			console.log('[Processor] Synth created');

			// Load pending SoundFont data if available
			if (this._pendingSoundFontData) {
				console.log('[Processor] Loading pending SoundFont data');
				// @ts-ignore
				this._synth.loadSoundFontData(this._pendingSoundFontData);
				this._pendingSoundFontData = null;
			}

			console.log('[Processor] _initialize complete');
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
				this._synth.programChange(data1);
			}
			// Ignore other MIDI messages (CC, pitch bend, etc.) for offline rendering performance
		}

		/**
		 * Implement custom DSP here.
		 * @param {number} startSample beginning of processing slice
		 * @param {number} endSample end of processing slice
		 * @param {Float32Array[][]} inputs
		 * @param {Float32Array[][]} outputs
		 */
		_process(startSample, endSample, inputs, outputs) {
			const input = inputs[0];
			const output = outputs[0];

			this._synth.process(startSample, endSample, input, output);

			// Check if we have any non-zero output
			let hasOutput = false;
			for (let c = 0; c < output.length; c++) {
				for (let i = startSample; i < endSample; i++) {
					if (output[c][i] !== 0) {
						hasOutput = true;
						break;
					}
				}
				if (hasOutput) break;
			}
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
