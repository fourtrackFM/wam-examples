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

	async initialize(state) {
		await this._loadDescriptor();
		return super.initialize(state);
	}

	async createAudioNode(initialState) {
		// Load bundled synth and processor
		await WamSoundFontNode.addModules(
			this.audioContext,
			this.moduleId,
			this._baseUrl
		);

		// Create the audio node
		const wamSoundFontNode = new WamSoundFontNode(this, {});
		await wamSoundFontNode._initialize();

		// Load SoundFont file after initialization
		console.log('[Plugin] Loading SoundFont...');
		const soundfontUrl = 'https://static.fourtrack.fm/GeneralUser-GS.sf2';

		try {
			const response = await fetch(soundfontUrl);
			const arrayBuffer = await response.arrayBuffer();
			console.log(
				'[Plugin] SoundFont loaded, size:',
				arrayBuffer.byteLength
			);

			// Send soundfont to processor
			// todo: how to hook this up properly?
			// await wamExampleTemplateNode.loadSoundFont(arrayBuffer);
		} catch (error) {
			console.error('[Plugin] Failed to load SoundFont:', error);
		}

		// Set initial state if applicable
		if (initialState) wamExampleTemplateNode.setState(initialState);

		return wamExampleTemplateNode;
	}

	createGui() {
		return createElement(this);
	}
}
