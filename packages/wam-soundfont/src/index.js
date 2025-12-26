/* eslint-disable no-underscore-dangle */

// SDK
import WebAudioModule from '../../sdk/src/WebAudioModule.js';
// DSP
import WamSoundFontNode from './WamSoundFontNode.js';
// GUI
import { createElement } from './Gui/index.js';

/**
 * @param {URL} relativeUrl
 * @returns {string}
 */
const getBaseUrl = (relativeUrl) => {
	const baseUrl = relativeUrl.href.substring(
		0,
		relativeUrl.href.lastIndexOf('/')
	);
	return baseUrl;
};

/**
 * @extends {WebAudioModule<WamExampleTemplateNode>}
 */
export default class WamExampleTemplatePlugin extends WebAudioModule {
	_baseUrl = getBaseUrl(new URL('.', import.meta.url));

	_descriptorUrl = `${this._baseUrl}/descriptor.json`;

	_soundfontArrayBuffer = null;

	async initialize(state) {
		console.log('[Plugin] initialize() called with state:', state);
		console.log('[Plugin] baseUrl:', this._baseUrl);
		console.log('[Plugin] moduleId:', this.moduleId);

		// Store the soundfont arrayBuffer for later use
		if (state && state.arrayBuffer) {
			this._soundfontArrayBuffer = state.arrayBuffer;
			console.log(
				'[Plugin] Stored soundfont arrayBuffer, size:',
				state.arrayBuffer.byteLength
			);
		}

		try {
			await this._loadDescriptor();
			console.log('[Plugin] descriptor loaded');
		} catch (err) {
			console.error('[Plugin] Failed to load descriptor:', err);
			throw err;
		}
		try {
			const result = await super.initialize(state);
			console.log('[Plugin] super.initialize() completed');
			return result;
		} catch (err) {
			console.error('[Plugin] super.initialize() failed:', err);
			throw err;
		}
	}

	async createAudioNode(initialState) {
		console.log(
			'[Plugin] createAudioNode() called with initialState:',
			initialState
		);

		// Load SoundFont file first
		console.log('[Plugin] Loading SoundFont...');

		// Use the arrayBuffer stored during initialization
		const arrayBuffer =
			this._soundfontArrayBuffer ||
			(initialState && initialState.arrayBuffer);
		if (arrayBuffer) {
			console.log(
				'[Plugin] Using SoundFont from stored buffer, size:',
				arrayBuffer.byteLength
			);
		} else {
			console.error(
				'[Plugin] No SoundFont arrayBuffer found, we will not be able to create the audio node.'
			);
			throw new Error('SoundFont arrayBuffer is required but not found');
		}

		try {
			// Load bundled synth and processor
			console.log('[Plugin] Calling WamSoundFontNode.addModules()...');
			await WamSoundFontNode.addModules(
				this.audioContext,
				this.moduleId,
				this._baseUrl
			);
			console.log('[Plugin] addModules() completed');

			// Create the audio node with soundfont in processorOptions
			console.log('[Plugin] Creating WamSoundFontNode...');
			const wamSoundFontNode = new WamSoundFontNode(this, {
				processorOptions: {
					sf2Buffer: arrayBuffer,
				},
			});

			console.log(
				'[Plugin] WamSoundFontNode created, calling _initialize()...'
			);
			await wamSoundFontNode._initialize();
			console.log('[Plugin] WamSoundFontNode._initialize() completed');

			// Set initial state if applicable
			if (initialState) wamSoundFontNode.setState(initialState);

			return wamSoundFontNode;
		} catch (err) {
			console.error('[Plugin] Failed to create audio node:', err);
			throw err;
		}
	}

	createGui() {
		return createElement(this);
	}
}
