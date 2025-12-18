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
		hasWamExampleTemplateSynth: !!WamExampleTemplateSynth 
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

			/** @private Counter for throttling logs */
			this._processCallCount = 0;

			// Set up message handler immediately in constructor
			const originalOnMessage = this.port.onmessage;
			this.port.onmessage = (event) => {
				console.log('[Processor] Port message received:', event.data);
				if (event.data.type === 'loadSoundFont') {
					console.log(
						'[Processor] Received SoundFont data, sample length:',
						event.data.data.sampleData?.length
					);
					if (this._synth) {
						console.log('[Processor] Loading SoundFont into synth');
						this._synth.loadSoundFontData(event.data.data);
					} else {
						console.log(
							'[Processor] Synth not yet created, storing data for later'
						);
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
				...WamExampleTemplateSynth.generateWamParameterInfo(),
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
				this._synth.loadSoundFontData(this._pendingSoundFontData);
				this._pendingSoundFontData = null;
			}

			console.log('[Processor] _initialize complete');
		}

		/**
		 *
		 * @param {WamMidiData} midiData
		 */
		_onMidi(midiData) {
			/* eslint-disable no-lone-blocks */
			const bytes = midiData.bytes;
			let type = bytes[0] & 0xf0;
			const channel = bytes[0] & 0x0f;
			const data1 = bytes[1];
			const data2 = bytes[2];
			if (type === 0x90 && data2 === 0) type = 0x80;

			console.log('[Processor] MIDI received:', {
				type: type.toString(16),
				channel,
				data1,
				data2,
			});

			// handle midi as needed here
			switch (type) {
				case 0x80:
					{
						/* note off */
						console.log('[Processor] Note OFF:', data1);
						this._synth.noteOff(channel, data1, data2);
					}
					break;
				case 0x90:
					{
						/* note on */
						console.log(
							'[Processor] Note ON:',
							data1,
							'velocity:',
							data2
						);
						this._synth.noteOn(channel, data1, data2);
					}
					break;
				case 0xa0:
					{
						/* aftertouch */
					}
					break;
				case 0xb0:
					{
						/* continuous controller */
					}
					break;
				case 0xc0:
					{
						/* patch change */
					}
					break;
				case 0xd0:
					{
						/* channel pressure */
					}
					break;
				case 0xe0:
					{
						/* pitch bend */
					}
					break;
				case 0xf0:
					{
						/* system */
					}
					break;
				default:
					{
						/* invalid */
					}
					break;
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
			const input = inputs[0];
			const output = outputs[0];

			// Log every 1000th call to avoid flooding console
			this._processCallCount++;
			if (this._processCallCount % 1000 === 0) {
				console.log('[Processor] _process called (count:', this._processCallCount, ')');
			}

			if (!this._synth) {
				if (this._processCallCount === 1) {
					console.error('[Processor] _synth is null on first process call!');
				}
				return;
			}

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

			if (hasOutput && this._processCallCount % 100 === 0) {
				console.log(
					'[Processor] Output detected! output[0][0]:',
					output[0][0]
				);
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
