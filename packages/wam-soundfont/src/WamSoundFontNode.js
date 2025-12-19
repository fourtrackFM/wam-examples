/** @template Node @typedef {import('../../api').WebAudioModule<Node>} WebAudioModule */
/** @typedef {import('../../api').WamAutomationEvent} WamAutomationEvent */
/** @typedef {import('../../api').WamParameterDataMap} WamParameterDataMap */
/** @typedef {import('../../api').WamEventType} WamEventType */
/** @typedef {import('./Gui/index').WamExampleTemplateHTMLElement} WamExampleTemplateHTMLElement */

import addFunctionModule from '../../sdk/src/addFunctionModule.js';
import WamNode from '../../sdk/src/WamNode.js';

import getWamExampleTemplateSynth from './WamSoundFontSynth.js';
import getWamExampleTemplateProcessor from './WamSoundFontProcessor.js';
import { parseSF2 } from './sf2-parser.js';

/* eslint-disable no-empty-function */
/* eslint-disable no-unused-vars */
/* eslint-disable class-methods-use-this */
/* eslint-disable no-underscore-dangle */
/* eslint-disable lines-between-class-members */

/**
 * Object containing parameter state
 *
 * @typedef {Object} StateMap
 * @property {WamParameterDataMap} parameterValues
 */

export default class WamExampleTemplateNode extends WamNode {
	/**
	 * Register scripts required for the processor. Must be called before constructor.
	 * @param {BaseAudioContext} audioContext
	 * @param {string} moduleId
	 */
	static async addModules(audioContext, moduleId) {
		const { audioWorklet } = audioContext;
		await super.addModules(audioContext, moduleId);
		await addFunctionModule(
			audioWorklet,
			getWamExampleTemplateSynth,
			moduleId
		);
		await addFunctionModule(
			audioWorklet,
			getWamExampleTemplateProcessor,
			moduleId
		);
	}

	/**
	 * @param {WebAudioModule<WamExampleTemplateNode>} module
	 * @param {AudioWorkletNodeOptions} options
	 */
	constructor(module, options) {
		options.numberOfInputs = 1;
		options.numberOfOutputs = 1;
		options.outputChannelCount = [2];
		options.processorOptions = { useSab: true };
		super(module, options);

		/** @type {Set<WamEventType>} */
		this._supportedEventTypes = new Set(['wam-automation', 'wam-midi']);

		/** @private @type {WamExampleTemplateHTMLElement} */
		this._gui = null;

		/** @private @type {boolean} */
		this._soundfontLoaded = false;

		/** @private @type {string} */
		this._soundfontUrl = 'https://static.fourtrack.fm/GeneralUser-GS.sf2';
		/** @private @type {ArrayBuffer} */
		this._sf2Buffer = null;

		/** @private @type {Set<number>} */
		this._loadedPrograms = new Set();

		/** @private @type {number} */
		this._currentProgram = 0;
	}

	/**
	 * Initialize and load soundfont
	 */
	async _initialize() {
		// Call parent initialization first (sends initialize/processor message)
		await super._initialize();

		// Load soundfont with multiple programs
		this._soundfontUrl = 'https://static.fourtrack.fm/GeneralUser-GS.sf2';
		this._currentProgram = 0;
		await this._loadSoundFont(this._soundfontUrl);
	}

	/**
	 * Load SoundFont file and send samples for all programs to processor
	 * @param {string} url - URL to SF2 file
	 */
	async _loadSoundFont(url) {
		try {
			console.log('[Node] Loading SoundFont from', url);
			const response = await fetch(url);
			const arrayBuffer = await response.arrayBuffer();
			console.log(
				'[Node] SoundFont loaded, size:',
				arrayBuffer.byteLength
			);

			// Store a copy of the buffer for on-demand loading
			// We need to keep our own copy because we'll transfer the original
			this._sf2Buffer = arrayBuffer.slice(0);

			// Send the full SF2 buffer to the processor for on-demand loading
			const bufferMessage = {
				type: 'setSF2Buffer',
				data: arrayBuffer,
			};
			this.port.postMessage(bufferMessage, [arrayBuffer]);

			// Load first program (0) to start
			await this._loadProgram(0);

			this._soundfontLoaded = true;
			console.log('[Node] SoundFont initialized');
		} catch (error) {
			console.error('[Node] Error loading SoundFont:', error);
		}
	}

	/**
	 * Load a specific program from the SF2 file
	 * @param {number} program - MIDI program number (0-127)
	 */
	async _loadProgram(program) {
		if (this._loadedPrograms.has(program)) {
			console.log('[Node] Program', program, 'already loaded');
			return;
		}

		if (!this._sf2Buffer) {
			console.error('[Node] SF2 buffer not loaded yet');
			return;
		}

		try {
			// Parse the SF2 file for this program
			const sf2Data = parseSF2(this._sf2Buffer, program);
			if (!sf2Data || !sf2Data.sampleData) {
				console.warn('[Node] No data for program', program);
				return;
			}

			console.log(
				'[Node] Program',
				program,
				'parsed:',
				sf2Data.presetName,
				'sample length:',
				sf2Data.sampleData?.length
			);

			// Send parsed data to processor using transferable objects for zero-copy
			const message = {
				type: 'loadSoundFont',
				data: {
					sampleData: sf2Data.sampleData,
					selectedSample: sf2Data.selectedSample,
					sampleRate: sf2Data.sampleRate,
					program: sf2Data.program,
				},
			};
			// Transfer the ArrayBuffer to avoid copying
			this.port.postMessage(message, [sf2Data.sampleData.buffer]);

			this._loadedPrograms.add(program);
		} catch (error) {
			console.error('[Node] Error loading program', program, ':', error);
		}
	}

	/**
	 * Set / unset GUI element
	 *
	 * @param {WamExampleTemplateHTMLElement | null} element
	 */
	set gui(element) {
		this._gui = element;
	}

	/**
	 * Set parameter values for the specified parameter ids.
	 * GUI must be notified to stay synchronized.
	 * @param {WamParameterDataMap} parameterValues
	 */
	async setParameterValues(parameterValues) {
		await super.setParameterValues(parameterValues);
		this._syncGui({ parameterValues });
	}

	/**
	 * State object contains parameter settings. GUI must be
	 * notified to stay synchronized.
	 * @param {StateMap} state
	 */
	async setState(state) {
		await super.setState(state);
		this._syncGui(state);
	}

	/**
	 * Notify GUI that plugin state has changed by emitting
	 * 'wam-automation' events corresponding to each parameter.
	 * @param {StateMap} state
	 */
	_syncGui(state) {
		const type = 'wam-automation';
		Object.keys(state.parameterValues).forEach((parameterId) => {
			const data = state.parameterValues[parameterId];
			/** @type {WamAutomationEvent} */
			const event = { type, data };
			this._onEvent(event);
		});
	}

	destroy() {
		if (this._gui) this._gui.destroy();
		super.destroy();
	}
}
