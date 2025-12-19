/* eslint-disable no-underscore-dangle */

// SDK
import WebAudioModule from '../../sdk/src/WebAudioModule.js';
// DSP
import WamExampleTemplateNode from './WamSoundFontNode.js';
import { parseSF2 } from './sf2-parser.js';
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
		// Load SoundFont file
		console.log('[Plugin] Loading SoundFont...');
		const soundfontUrl = 'https://static.fourtrack.fm/GeneralUser-GS.sf2';
		const response = await fetch(soundfontUrl);
		const arrayBuffer = await response.arrayBuffer();
		console.log('[Plugin] SoundFont loaded, size:', arrayBuffer.byteLength);

		// DSP is implemented in WamExampleTemplateProcessor.
		await WamExampleTemplateNode.addModules(
			this.audioContext,
			this.moduleId
		);

		// Pass SF2 buffer through processor options - synth will parse all programs
		const wamExampleTemplateNode = new WamExampleTemplateNode(this, {
			processorOptions: {
				sf2Buffer: arrayBuffer,
			},
		});
		await wamExampleTemplateNode._initialize();

		// Set initial state if applicable
		if (initialState) wamExampleTemplateNode.setState(initialState);

		return wamExampleTemplateNode;
	}

	createGui() {
		return createElement(this);
	}
}
