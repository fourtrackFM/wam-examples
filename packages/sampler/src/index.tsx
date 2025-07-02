/* eslint-disable class-methods-use-this */
/* eslint-disable max-len */
/* eslint-disable import/extensions */
/* eslint-disable max-classes-per-file */
/* eslint-disable no-underscore-dangle */

import { WebAudioModule } from '@webaudiomodules/sdk';
import {
	ParamMgrFactory,
	InternalParametersDescriptor,
	ParamMgrNode,
} from '@webaudiomodules/sdk-parammgr';
import SamplerNode, { InternalParams, Params } from './SamplerNode';
import { h, render } from 'preact';
import { SamplerView } from './SamplerView';

/**
 * @param {URL} relativeURL
 * @returns {string}
 */
const getBaseUrl = (relativeURL: URL) => {
	const baseURL = relativeURL.href.substring(
		0,
		relativeURL.href.lastIndexOf('/')
	);
	return baseURL;
};

export default class Sampler extends WebAudioModule<SamplerNode> {
	_baseURL = getBaseUrl(new URL('.', import.meta.url));
	_descriptorUrl = `${this._baseURL}/descriptor.json`;

	async _loadDescriptor() {
		const url = this._descriptorUrl;
		if (!url) throw new TypeError('Descriptor not found');
		const response = await fetch(url);
		const descriptor = await response.json();
		Object.assign(this.descriptor, descriptor);
		return this.descriptor;
	}

	async initialize(state: any) {
		await this._loadDescriptor();
		return super.initialize(state);
	}

	async createAudioNode(initialState: any) {
		// Register the audio worklet processor
		await SamplerNode.addModules(
			this.audioContext as AudioContext,
			'com.webaudiomodules.wam-examples.sampler'
		);

		// Create the sampler node
		const samplerNode = new SamplerNode(this.audioContext);

		// Configure the parameters
		const paramsConfig = {
			gain: {
				defaultValue: 1.0,
				minValue: 0,
				maxValue: 2.0,
			},
			playbackRate: {
				defaultValue: 1.0,
				minValue: 0.25,
				maxValue: 4.0,
			},
			loop: {
				defaultValue: 0,
				minValue: 0,
				maxValue: 1,
				stepped: true,
			},
			loopStart: {
				defaultValue: 0,
				minValue: 0,
				maxValue: 44100 * 10, // 10 seconds max
			},
			loopEnd: {
				defaultValue: 44100,
				minValue: 0,
				maxValue: 44100 * 10, // 10 seconds max
			},
		};

		const internalParamsConfig = {
			gain: {
				onChange: (v: number) => {
					samplerNode.parameters.gain = v;
					samplerNode.updateFromState();
				},
			},
			playbackRate: {
				onChange: (v: number) => {
					samplerNode.parameters.playbackRate = v;
					samplerNode.updateFromState();
				},
			},
			loop: {
				onChange: (v: number) => {
					samplerNode.parameters.loop = v > 0.5;
					samplerNode.updateFromState();
				},
			},
			loopStart: {
				onChange: (v: number) => {
					samplerNode.parameters.loopStart = v;
					samplerNode.updateFromState();
				},
			},
			loopEnd: {
				onChange: (v: number) => {
					samplerNode.parameters.loopEnd = v;
					samplerNode.updateFromState();
				},
			},
		};

		const optionsIn = { internalParamsConfig, paramsConfig };
		const paramMgrNode = await ParamMgrFactory.create<
			Params,
			InternalParams
		>(this, optionsIn);
		samplerNode.setup(paramMgrNode);

		if (initialState) samplerNode.setState(initialState);

		// Load a default sample - you can replace this with your own sample URL
		const sampleUrl = `${this._baseURL}/sample.mp3`;
		try {
			await samplerNode.loadSample(sampleUrl);
		} catch (error) {
			console.warn(`Could not load default sample: ${error.message}`);
		}

		return samplerNode;
	}

	async createGui() {
		const div = document.createElement('div');
		// hack because h() is getting stripped for non-use despite it being what the JSX compiles to
		h('div', {});

		var shadow = div.attachShadow({ mode: 'open' });
		render(<SamplerView plugin={this}></SamplerView>, shadow);

		return div;
	}

	destroyGui(el: Element) {
		console.log('destroyGui called!');
		render(null, el.shadowRoot);
	}
}
