/* eslint-disable no-underscore-dangle */
/* eslint-disable max-len */

/**
 * @param {string} [moduleId]
 */
const getWamSoundFontProcessor = (moduleId) => {
	const audioWorkletGlobalScope = globalThis;
	const { registerProcessor } = audioWorkletGlobalScope;

	const ModuleScope =
		audioWorkletGlobalScope.webAudioModules.getModuleScope(moduleId);
	const { WamProcessor, WamParameterInfo, WamSoundFontSynth } = ModuleScope;

	class WamSoundFontProcessor extends WamProcessor {
		/**
		 * @param {AudioWorkletNodeOptions} options
		 */
		constructor(options) {
			console.log(
				'[WamSoundFontProcessor] constructor called with options:',
				options
			);
			super(options);
			console.log('[WamSoundFontProcessor] super() completed');
			console.log(
				'[WamSoundFontProcessor] _initialize is:',
				typeof this._initialize
			);
		}

		_initialize() {
			try {
				console.log('[WamSoundFontProcessor] _initialize() called');
				console.log(
					'[WamSoundFontProcessor] ModuleScope available:',
					!!ModuleScope
				);
				console.log(
					'[WamSoundFontProcessor] ModuleScope keys:',
					ModuleScope ? Object.keys(ModuleScope) : 'N/A'
				);

				super._initialize();
				console.log(
					'[WamSoundFontProcessor] super._initialize() completed'
				);

				console.log(
					'[WamSoundFontProcessor] Creating WamSoundFontSynth...'
				);
				console.log(
					'[WamSoundFontProcessor] ModuleScope.WamSoundFontSynth:',
					typeof ModuleScope.WamSoundFontSynth
				);

				if (!ModuleScope.WamSoundFontSynth) {
					throw new Error(
						'WamSoundFontSynth not found in ModuleScope! Available: ' +
							Object.keys(ModuleScope).join(', ')
					);
				}

				/** @private @type {WamSoundFontSynth} */
				this._synth = new ModuleScope.WamSoundFontSynth(
					this._parameterInterpolators,
					this._samplesPerQuantum,
					globalThis.sampleRate
				);
				console.log(
					'[WamSoundFontProcessor] WamSoundFontSynth created:',
					this._synth
				);
			} catch (err) {
				console.error(
					'[WamSoundFontProcessor] _initialize() error:',
					err
				);
				throw err;
			}

			/** @private @type {ArrayBuffer} */
			this._sf2Buffer = options.processorOptions?.sf2Buffer || null;

			if (this._sf2Buffer) {
				this._synth.loadSoundFont(this._sf2Buffer).catch((err) => {
					console.error(
						'[WamSoundFontProcessor] Failed to load soundfont:',
						err
					);
				});
			}

			// Generate parameters from synth config
			const paramConfig = WamSoundFontSynth.getParameterConfig();
			this.params = {};
			for (const [id, config] of Object.entries(paramConfig)) {
				this.params[id] = new WamParameterInfo(id, config);
			}
		}

		/**
		 * Fetch plugin's params.
		 * @returns {WamParameterInfoMap}
		 */
		_generateWamParameterInfo() {
			const paramConfig = WamSoundFontSynth.getParameterConfig();
			const params = {};
			for (const [id, config] of Object.entries(paramConfig)) {
				params[id] = new WamParameterInfo(id, config);
			}
			return params;
		}

		/**
		 * Handle MIDI events
		 * @param {WamMidiData} midiData
		 */
		_onMidi(midiData) {
			if (this._synth) {
				this._synth._onMidi(midiData);
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
			if (this._synth) {
				this._synth._process(inputs, outputs, this._parameterValues);
			}
			return true;
		}

		/**
		 * Messages from main thread appear here.
		 * @param {MessageEvent} message
		 */
		async _onMessage(message) {
			console.log(
				'[WamSoundFontProcessor] _onMessage received:',
				message.data
			);

			// Let base class handle its messages first
			if (super._onMessage) {
				await super._onMessage(message);
			}

			const { data } = message;

			if (data?.type === 'loadSoundFont' && data.buffer) {
				try {
					await this._synth.loadSoundFont(data.buffer);
					this.params = this._synth.generateWamParameterInfo();
					this.port.postMessage({
						type: 'soundFontLoaded',
						success: true,
					});
				} catch (error) {
					console.error(
						'[WamSoundFontProcessor] Failed to load soundfont:',
						error
					);
					this.port.postMessage({
						type: 'soundFontLoaded',
						success: false,
						error: error.message,
					});
				}
			}
		}
	}

	try {
		registerProcessor(moduleId, WamSoundFontProcessor);
	} catch (error) {
		console.warn(error);
	}

	return WamSoundFontProcessor;
};

export default getWamSoundFontProcessor;
