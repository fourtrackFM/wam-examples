/** @template Node @typedef {import('../../api').WebAudioModule<Node>} WebAudioModule */
/** @typedef {import('../../api').WamAutomationEvent} WamAutomationEvent */
/** @typedef {import('../../api').WamParameterDataMap} WamParameterDataMap */
/** @typedef {import('../../api').WamEventType} WamEventType */
/** @typedef {import('./Gui/index').WamExampleTemplateHTMLElement} WamExampleTemplateHTMLElement */

import WamNode from '../../sdk/src/WamNode.js';
import addFunctionModule from '../../sdk/src/addFunctionModule.js';
import getWamSoundFontProcessor from './WamSoundFontProcessor.worklet.js';

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

export default class WamSoundFontNode extends WamNode {
	/**
	 * Register scripts required for the processor. Must be called before constructor.
	 * @param {BaseAudioContext} audioContext
	 * @param {string} moduleId
	 * @param {string} baseUrl
	 */
	static async addModules(audioContext, moduleId, baseUrl) {
		console.log('[WamSoundFontNode] addModules() called');
		console.log('[WamSoundFontNode] baseUrl:', baseUrl);
		console.log('[WamSoundFontNode] moduleId:', moduleId);
		const { audioWorklet } = audioContext;
		try {
			console.log('[WamSoundFontNode] Calling super.addModules()...');
			await super.addModules(audioContext, moduleId);
			console.log('[WamSoundFontNode] super.addModules() completed');
		} catch (err) {
			console.error('[WamSoundFontNode] super.addModules() failed:', err);
			throw err;
		}

		try {
			console.log('[WamSoundFontNode] Loading spessasynth processor...');
			await audioContext.audioWorklet.addModule(
				`${baseUrl}/spessasynth_core.js`
			);
			console.log('[WamSoundFontNode] spessasynth processor loaded');
		} catch (err) {
			console.error(
				'[WamSoundFontNode] Failed to load spessasynth processor:',
				err
			);
			throw err;
		}

		try {
			console.log('[WamSoundFontNode] Loading WamSoundFontProcessor...');
			await addFunctionModule(
				audioContext.audioWorklet,
				getWamSoundFontProcessor,
				moduleId
			);
			console.log('[WamSoundFontNode] WamSoundFontProcessor loaded');
		} catch (err) {
			console.error(
				'[WamSoundFontNode] Failed to load WamSoundFontProcessor:',
				err
			);
			throw err;
		}
		console.log('[WamSoundFontNode] addModules() completed successfully');
	}

	/**
	 * @param {WebAudioModule<WamSoundFontNode>} module
	 * @param {AudioWorkletNodeOptions} options
	 */
	constructor(module, options) {
		console.log(
			'[WamSoundFontNode] constructor called with options:',
			options
		);
		options.numberOfInputs = 1;
		options.numberOfOutputs = 1;
		options.outputChannelCount = [2];
		options.processorOptions = { useSab: true };
		console.log(
			'[WamSoundFontNode] Calling super() with processed options:',
			options
		);
		super(module, options);
		console.log('[WamSoundFontNode] super() completed');

		/** @type {Set<WamEventType>} */
		this._supportedEventTypes = new Set(['wam-automation', 'wam-midi']);

		/** @private @type {WamExampleTemplateHTMLElement} */
		this._gui = null;
		console.log('[WamSoundFontNode] constructor completed');
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

	async _initialize() {
		console.log('[WamSoundFontNode] _initialize() called');
		try {
			const result = await super._initialize();
			console.log(
				'[WamSoundFontNode] super._initialize() completed, result:',
				result
			);
			return result;
		} catch (err) {
			console.error('[WamSoundFontNode] _initialize() error:', err);
			throw err;
		}
	}

	destroy() {
		if (this._gui) this._gui.destroy();
		super.destroy();
	}
}
