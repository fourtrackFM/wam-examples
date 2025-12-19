/* eslint-disable object-curly-newline */
/* eslint-disable prefer-destructuring */
/* eslint-disable class-methods-use-this */
/* eslint-disable no-underscore-dangle */
/* eslint-disable max-len */
/* eslint-disable no-undef */
/* eslint-disable no-plusplus */
/* eslint-disable no-bitwise */
/* eslint-disable max-classes-per-file */

/** @typedef {import('../../api').AudioWorkletGlobalScope} AudioWorkletGlobalScope */
/** @typedef {import('../../api').WamParameterInfoMap} WamParameterInfoMap */
/** @typedef {import('../../sdk').WamParameterInterpolatorMap} WamParameterInterpolatorMap */
/** @typedef {import('./types').WamExampleTemplateModuleScope} WamExampleTemplateModuleScope */
/** @typedef {import('./types').WamExampleTemplateSynth} IWamExampleTemplateSynth */
/** @typedef {typeof import('./types').WamExampleTemplateSynth} WamExampleTemplateSynthConstructor */

/**
 * @param {string} [moduleId]
 * @returns {WamExampleTemplateSynthConstructor}
 */
const getWamExampleTemplateSynth = (moduleId) => {
	/** @type {AudioWorkletGlobalScope} */
	// @ts-ignore
	const audioWorkletGlobalScope = globalThis;

	/** @type {WamExampleTemplateModuleScope} */
	const ModuleScope =
		audioWorkletGlobalScope.webAudioModules.getModuleScope(moduleId);
	const { WamParameterInfo } = ModuleScope;

	/**
	 * Convert MIDI note number to frequency in Hz
	 * @param {number} note - MIDI note number
	 * @returns {number} frequency in Hz
	 */
	function noteToHz(note) {
		return Math.pow(2.0, (note - 69) / 12.0) * 440.0;
	}

	// Inline SF2 parser code so it's available in the worklet
	// Generator enumerators from SF2 spec section 8.1.2
	const GeneratorType = {
		startAddrsOffset: 0,
		endAddrsOffset: 1,
		startloopAddrsOffset: 2,
		endloopAddrsOffset: 3,
		startAddrsCoarseOffset: 4,
		instrument: 41,
		keyRange: 43,
		velRange: 44,
		sampleID: 53,
		overridingRootKey: 58,
	};

	/**
	 * Parse SF2 file and extract instrument data for a program
	 * @param {ArrayBuffer} arrayBuffer
	 * @param {number} programNumber - MIDI program number (0-127)
	 * @param {number} bankNumber - MIDI bank number (default 0)
	 * @returns {Object} Parsed instrument data with samples
	 */
	function parseSF2(arrayBuffer, programNumber = 0, bankNumber = 0) {
		const dataView = new DataView(arrayBuffer);
		let offset = 0;

		function readString(length) {
			const chars = [];
			for (let i = 0; i < length; i++) {
				const char = dataView.getUint8(offset++);
				if (char !== 0) chars.push(String.fromCharCode(char));
			}
			return chars.join('');
		}

		function readDWord() {
			const value = dataView.getUint32(offset, true);
			offset += 4;
			return value;
		}

		function readWord() {
			const value = dataView.getUint16(offset, true);
			offset += 2;
			return value;
		}

		function readShort() {
			const value = dataView.getInt16(offset, true);
			offset += 2;
			return value;
		}

		function readByte() {
			return dataView.getUint8(offset++);
		}

		function readChar() {
			return dataView.getInt8(offset++);
		}

		// Read RIFF header
		const riff = readString(4);
		if (riff !== 'RIFF') throw new Error('Not a valid RIFF file');
		const fileSize = readDWord();
		const sfbk = readString(4);
		if (sfbk !== 'sfbk') throw new Error('Not a valid SoundFont file');

		// Parse main chunks
		let sdtaOffset = 0;
		let pdtaOffset = 0;

		while (offset < arrayBuffer.byteLength - 8) {
			const chunkId = readString(4);
			const chunkSize = readDWord();
			const chunkStart = offset;

			if (chunkId === 'LIST') {
				const listType = readString(4);
				if (listType === 'sdta') sdtaOffset = chunkStart;
				else if (listType === 'pdta') pdtaOffset = chunkStart;
			}

			offset = chunkStart + chunkSize;
		}

		// Parse sample data
		let rawSampleData = null;
		if (sdtaOffset) {
			offset = sdtaOffset + 4;
			const endOffset =
				offset + dataView.getUint32(sdtaOffset - 4, true) - 4;

			while (offset < endOffset - 8) {
				const subChunkId = readString(4);
				const subChunkSize = readDWord();

				if (subChunkId === 'smpl') {
					rawSampleData = new Int16Array(
						arrayBuffer,
						offset,
						subChunkSize / 2
					);
					break;
				}
				offset += subChunkSize;
			}
		}

		if (!rawSampleData) throw new Error('No sample data found');

		// Parse hydra structures
		const hydra = {
			presetHeaders: [],
			presetBags: [],
			presetGens: [],
			instruments: [],
			instrumentBags: [],
			instrumentGens: [],
			sampleHeaders: [],
		};

		if (pdtaOffset) {
			offset = pdtaOffset + 4;
			const pdtaSize = dataView.getUint32(pdtaOffset - 4, true);
			const endOffset = offset + pdtaSize - 4;

			while (offset < endOffset - 8) {
				const subChunkId = readString(4);
				const subChunkSize = readDWord();
				const subChunkStart = offset;

				if (subChunkId === 'phdr') {
					const count = Math.floor(subChunkSize / 38);
					for (let i = 0; i < count; i++) {
						hydra.presetHeaders.push({
							name: readString(20),
							preset: readWord(),
							bank: readWord(),
							bagIndex: readWord(),
							library: readDWord(),
							genre: readDWord(),
							morphology: readDWord(),
						});
					}
				} else if (subChunkId === 'pbag') {
					const count = Math.floor(subChunkSize / 4);
					for (let i = 0; i < count; i++) {
						hydra.presetBags.push({
							genIndex: readWord(),
							modIndex: readWord(),
						});
					}
				} else if (subChunkId === 'pgen') {
					const count = Math.floor(subChunkSize / 4);
					for (let i = 0; i < count; i++) {
						hydra.presetGens.push({
							oper: readWord(),
							amount: readWord(),
						});
					}
				} else if (subChunkId === 'inst') {
					const count = Math.floor(subChunkSize / 22);
					for (let i = 0; i < count; i++) {
						hydra.instruments.push({
							name: readString(20),
							bagIndex: readWord(),
						});
					}
				} else if (subChunkId === 'ibag') {
					const count = Math.floor(subChunkSize / 4);
					for (let i = 0; i < count; i++) {
						hydra.instrumentBags.push({
							genIndex: readWord(),
							modIndex: readWord(),
						});
					}
				} else if (subChunkId === 'igen') {
					const count = Math.floor(subChunkSize / 4);
					for (let i = 0; i < count; i++) {
						hydra.instrumentGens.push({
							oper: readWord(),
							amount: readWord(),
						});
					}
				} else if (subChunkId === 'shdr') {
					const count = Math.floor(subChunkSize / 46);
					for (let i = 0; i < count; i++) {
						const name = readString(20);
						const start = readDWord();
						const end = readDWord();
						const loopStart = readDWord();
						const loopEnd = readDWord();
						const sampleRate = readDWord();
						const originalPitch = readByte();
						const pitchCorrection = readChar();
						const sampleLink = readWord();
						const sampleType = readWord();

						if (sampleType !== 0x8000) {
							hydra.sampleHeaders.push({
								name,
								start,
								end,
								loopStart,
								loopEnd,
								sampleRate,
								originalPitch,
								pitchCorrection,
								sampleLink,
								sampleType,
							});
						}
					}
				}

				offset = subChunkStart + subChunkSize;
			}
		}

		// Find preset
		let preset = null;
		for (let i = 0; i < hydra.presetHeaders.length - 1; i++) {
			const p = hydra.presetHeaders[i];
			if (p.preset === programNumber && p.bank === bankNumber) {
				preset = p;
				break;
			}
		}

		if (!preset) preset = hydra.presetHeaders[0];

		// Get preset zones and find instrument
		const nextBagIndex =
			hydra.presetHeaders[hydra.presetHeaders.indexOf(preset) + 1]
				.bagIndex;
		const presetBags = hydra.presetBags.slice(
			preset.bagIndex,
			nextBagIndex
		);

		let instrumentId = null;
		for (const bag of presetBags) {
			const nextGenIndex =
				presetBags.indexOf(bag) + 1 < presetBags.length
					? presetBags[presetBags.indexOf(bag) + 1].genIndex
					: hydra.presetGens.length;
			const gens = hydra.presetGens.slice(bag.genIndex, nextGenIndex);

			const instGen = gens.find(
				(g) => g.oper === GeneratorType.instrument
			);
			if (instGen) {
				instrumentId = instGen.amount;
				break;
			}
		}

		if (instrumentId === null || instrumentId >= hydra.instruments.length) {
			throw new Error('No valid instrument found');
		}

		const instrument = hydra.instruments[instrumentId];

		// Get instrument zones and find sample
		const nextInstBagIndex =
			instrumentId + 1 < hydra.instruments.length
				? hydra.instruments[instrumentId + 1].bagIndex
				: hydra.instrumentBags.length;
		const instrumentBags = hydra.instrumentBags.slice(
			instrument.bagIndex,
			nextInstBagIndex
		);

		let sampleId = null;
		let keyRange = { lo: 0, hi: 127 };
		let velRange = { lo: 0, hi: 127 };
		let overrideRootKey = null;

		for (const bag of instrumentBags) {
			const nextGenIndex =
				instrumentBags.indexOf(bag) + 1 < instrumentBags.length
					? instrumentBags[instrumentBags.indexOf(bag) + 1].genIndex
					: hydra.instrumentGens.length;
			const gens = hydra.instrumentGens.slice(bag.genIndex, nextGenIndex);

			const sampleGen = gens.find(
				(g) => g.oper === GeneratorType.sampleID
			);
			if (sampleGen) {
				sampleId = sampleGen.amount;

				const keyRangeGen = gens.find(
					(g) => g.oper === GeneratorType.keyRange
				);
				if (keyRangeGen) {
					keyRange = {
						lo: keyRangeGen.amount & 0xff,
						hi: (keyRangeGen.amount >> 8) & 0xff,
					};
				}

				const velRangeGen = gens.find(
					(g) => g.oper === GeneratorType.velRange
				);
				if (velRangeGen) {
					velRange = {
						lo: velRangeGen.amount & 0xff,
						hi: (velRangeGen.amount >> 8) & 0xff,
					};
				}

				const rootKeyGen = gens.find(
					(g) => g.oper === GeneratorType.overridingRootKey
				);
				if (rootKeyGen) overrideRootKey = rootKeyGen.amount;

				break;
			}
		}

		if (sampleId === null || sampleId >= hydra.sampleHeaders.length) {
			throw new Error('No valid sample found');
		}

		const sample = hydra.sampleHeaders[sampleId];
		const sampleData = rawSampleData.slice(sample.start, sample.end);

		return {
			sampleData,
			selectedSample: {
				...sample,
				rootKey: overrideRootKey || sample.originalPitch,
				keyRange,
				velRange,
			},
			sampleRate: sample.sampleRate,
			program: programNumber,
			presetName: preset.name,
		};
	}

	/**
	 * Parse all programs from SF2 file
	 * @param {ArrayBuffer} arrayBuffer
	 * @param {number} bankNumber
	 * @returns {Array}
	 */
	function parseAllSF2Programs(arrayBuffer, bankNumber = 0) {
		console.log('[Synth] Parsing all programs from SF2...');
		const allPrograms = [];

		for (let program = 0; program < 128; program++) {
			try {
				const programData = parseSF2(arrayBuffer, program, bankNumber);
				if (programData && programData.sampleData) {
					allPrograms.push(programData);
				}
			} catch (error) {
				console.warn('[Synth] Failed to parse program', program);
			}
		}

		console.log('[Synth] Parsed', allPrograms.length, 'programs');
		return allPrograms;
	}

	/**
	 * Synth part for mono channel rendering with sample playback
	 * @class
	 */
	class WamExampleTemplateSynthPart {
		/**
		 * @param {number} samplesPerQuantum
		 * @param {number} sampleRate
		 */
		constructor(samplesPerQuantum, sampleRate) {
			this._sampleRate = sampleRate;
			this._gain = 0.0;
			this._active = false;
			this._sampleData = null;
			this._samplePosition = 0;
			this._playbackRate = 1.0;
			this._rootKey = 60;
			this._loopStart = 0;
			this._loopEnd = 0;
		}

		reset() {
			this._active = false;
			this._gain = 0.0;
			this._samplePosition = 0;
		}

		/**
		 * Set sample data for playback
		 * @param {Int16Array} sampleData
		 * @param {Object} metadata - Sample metadata with rootKey and loop points
		 */
		setSampleData(sampleData, metadata) {
			this._sampleData = sampleData;
			this._rootKey = metadata.rootKey || 60;
			this._loopStart = metadata.loopStart || 0;
			this._loopEnd =
				metadata.loopEnd || (sampleData ? sampleData.length : 0);
		}

		/**
		 * Start playing a note
		 * @param {number} gain - velocity-based gain
		 * @param {number} frequency - frequency in Hz
		 */
		start(gain, frequency) {
			this._active = true;
			this._gain = gain * 0.3;
			this._samplePosition = 0;

			// Calculate playback rate based on root key
			const rootFreq = 440.0 * Math.pow(2.0, (this._rootKey - 69) / 12.0);
			this._playbackRate = frequency / rootFreq;
		}

		/**
		 * Stop playing
		 * @param {boolean} force
		 */
		stop(force) {
			this._active = false;
			this._gain = 0.0;
		}

		/**
		 * Process audio output
		 * @param {number} startSample
		 * @param {number} endSample
		 * @param {Float32Array} signal
		 * @returns {boolean} whether still active
		 */
		process(startSample, endSample, signal) {
			if (
				!this._active ||
				!this._sampleData ||
				this._sampleData.length === 0
			) {
				return false;
			}

			for (let n = startSample; n < endSample; n++) {
				const sampleIndex = Math.floor(this._samplePosition);

				// Handle looping
				if (sampleIndex >= this._loopEnd) {
					if (
						this._loopEnd > this._loopStart &&
						this._loopStart >= 0
					) {
						const loopLength = this._loopEnd - this._loopStart;
						this._samplePosition =
							this._loopStart +
							((sampleIndex - this._loopEnd) % loopLength);
					} else {
						this._active = false;
						return false;
					}
				}

				const finalIndex = Math.floor(this._samplePosition);
				if (finalIndex >= 0 && finalIndex < this._sampleData.length) {
					// Convert Int16 to float32 (-1 to 1)
					const sampleValue = this._sampleData[finalIndex] / 32768.0;
					signal[n] += this._gain * sampleValue;
					this._samplePosition += this._playbackRate;
				} else {
					this._active = false;
					return false;
				}
			}

			return this._active;
		}
	}

	/**
	 * Stereo voice with left and right parts
	 * @class
	 */
	class WamExampleTemplateSynthVoice {
		/**
		 * @param {number} samplesPerQuantum
		 * @param {number} sampleRate
		 * @param {number} voiceIdx
		 */
		constructor(samplesPerQuantum, sampleRate, voiceIdx) {
			this._numChannels = 2;
			this._sampleRate = sampleRate;
			this._channel = -1;
			this._note = -1;
			this._velocity = -1;
			this._timestamp = -1;
			this._active = false;
			this._deactivating = 0;

			this._leftPart = new WamExampleTemplateSynthPart(
				samplesPerQuantum,
				sampleRate
			);
			this._rightPart = new WamExampleTemplateSynthPart(
				samplesPerQuantum,
				sampleRate
			);
		}

		get channel() {
			return this._channel;
		}
		get note() {
			return this._note;
		}
		get velocity() {
			return this._velocity;
		}
		get timestamp() {
			return this._timestamp;
		}
		get active() {
			return this._active;
		}

		/**
		 * Check if voice matches channel and note
		 * @param {number} channel
		 * @param {number} note
		 * @returns {boolean}
		 */
		matches(channel, note) {
			return this._channel === channel && this._note === note;
		}

		reset() {
			this._channel = -1;
			this._note = -1;
			this._velocity = -1;
			this._timestamp = -1;
			this._active = false;
			this._deactivating = 0;
			this._leftPart.reset();
			this._rightPart.reset();
		}

		/**
		 * Trigger note on
		 * @param {number} channel
		 * @param {number} note
		 * @param {number} velocity
		 */
		noteOn(channel, note, velocity) {
			this._channel = channel;
			this._note = note;
			this._velocity = velocity;
			this._timestamp = globalThis.currentTime;
			this._active = true;
			this._deactivating = 0;

			const gain = velocity / 127;
			const frequency = noteToHz(note);

			this._leftPart.start(gain, frequency);
			this._rightPart.start(gain, frequency);
		}

		/**
		 * Trigger note off
		 * @param {number} channel
		 * @param {number} note
		 * @param {number} velocity
		 */
		noteOff(channel, note, velocity) {
			this._deactivating += 1;
			const force = this._deactivating > 2;
			this._leftPart.stop(force);
			this._rightPart.stop(force);
		}

		/**
		 * Process audio for this voice
		 * @param {number} startSample
		 * @param {number} endSample
		 * @param {Float32Array[]} inputs
		 * @param {Float32Array[]} outputs
		 * @returns {boolean}
		 */
		process(startSample, endSample, inputs, outputs) {
			if (!this._active) {
				return false;
			}

			const leftActive = this._leftPart.process(
				startSample,
				endSample,
				outputs[0]
			);
			const rightActive = this._rightPart.process(
				startSample,
				endSample,
				outputs[1]
			);

			this._active = leftActive || rightActive;
			return this._active;
		}
	}

	/**
	 * Main polyphonic SoundFont synthesizer
	 * @class
	 * @implements {IWamExampleTemplateSynth}
	 */
	class WamExampleTemplateSynth {
		/**
		 * @param {WamParameterInterpolatorMap} parameterInterpolators
		 * @param {number} samplesPerQuantum
		 * @param {number} sampleRate
		 * @param {Object} config
		 */
		constructor(
			parameterInterpolators,
			samplesPerQuantum,
			sampleRate,
			config
		) {
			config = config || {};
			this._numChannels = 2;
			this._numVoices = config.numVoices || 16;
			this._passInput = config.passInput || false;
			this._voiceStates = new Uint8Array(this._numVoices);
			this._voiceStates.fill(0);

			// Allocate voices
			this._voices = [];
			for (let i = 0; i < this._numVoices; i++) {
				this._voices.push(
					new WamExampleTemplateSynthVoice(
						samplesPerQuantum,
						sampleRate,
						i
					)
				);
			}

			// Program management
			this._programMap = new Map();
			this._currentProgram = 0;
			this._sampleData = null;

			// Parse all 128 MIDI programs at construction if sf2Buffer is provided in config
			const sf2Buffer = config.sf2Buffer;
			if (sf2Buffer) {
				console.log('[Synth] Parsing all SF2 programs...');
				const allPrograms = parseAllSF2Programs(sf2Buffer);
				console.log('[Synth] Parsed', allPrograms.length, 'programs');

				// Load all programs into the map
				for (const programData of allPrograms) {
					if (programData && programData.sampleData) {
						this._programMap.set(programData.program, {
							sampleData: programData.sampleData,
							metadata: {
								selectedSample: programData.selectedSample,
								sampleRate: programData.sampleRate,
								presetName: programData.presetName,
							},
						});
					}
				}

				// Set initial program (0) if available
				const program0 = this._programMap.get(0);
				if (program0) {
					this._sampleData = program0.sampleData;
					const metadata = program0.metadata;
					for (let i = 0; i < this._numVoices; i++) {
						const voice = this._voices[i];
						voice._leftPart.setSampleData(
							this._sampleData,
							metadata.selectedSample,
							metadata.sampleRate
						);
						voice._rightPart.setSampleData(
							this._sampleData,
							metadata.selectedSample,
							metadata.sampleRate
						);
					}
					console.log(
						'[Synth] Initial program 0 loaded:',
						metadata.presetName
					);
				}
			}
		}

		/**
		 * Handle MIDI program change
		 * @param {number} program
		 */
		programChange(program) {
			if (program === this._currentProgram) {
				console.log('[Synth] Program', program, 'already active');
				return;
			}

			const programData = this._programMap.get(program);
			if (!programData) {
				console.warn('[Synth] Program', program, 'not loaded yet');
				return;
			}

			this._currentProgram = program;
			this._sampleData = programData.sampleData;

			// Update all voices with new sample data
			const metadata = programData.metadata;
			for (let i = 0; i < this._numVoices; i++) {
				this._voices[i]._leftPart.setSampleData(
					this._sampleData,
					metadata
				);
				this._voices[i]._rightPart.setSampleData(
					this._sampleData,
					metadata
				);
			}

			console.log(
				'[Synth] Switched to program',
				program,
				'sample length:',
				this._sampleData ? this._sampleData.length : 0
			);
		}

		/**
		 * Load SoundFont data for a program
		 * @param {Object} data
		 */
		loadSoundFontData(data) {
			console.log('[Synth] Loading SoundFont data', data);

			// Extract metadata
			const metadata = {};
			if (data.selectedSample) {
				metadata.rootKey =
					data.selectedSample.rootKey ||
					data.selectedSample.originalPitch ||
					60;
				metadata.loopStart = data.selectedSample.loopStart || 0;
				metadata.loopEnd =
					data.selectedSample.loopEnd || data.sampleData.length;
				console.log('[Synth] Sample metadata:', metadata);
			}

			// Store program data
			const program = data.program || 0;
			this._programMap.set(program, {
				sampleData: data.sampleData,
				metadata: metadata,
			});

			// If this is the current program, activate it
			if (program === this._currentProgram) {
				this._sampleData = data.sampleData;
				for (let i = 0; i < this._numVoices; i++) {
					this._voices[i]._leftPart.setSampleData(
						this._sampleData,
						metadata
					);
					this._voices[i]._rightPart.setSampleData(
						this._sampleData,
						metadata
					);
				}
			}

			console.log(
				'[Synth] Program',
				program,
				'loaded, sample length:',
				data.sampleData ? data.sampleData.length : 0,
				'total programs:',
				this._programMap.size
			);
		}

		/**
		 * Reset all voices
		 */
		reset() {
			this._voiceStates.fill(0);
			for (let i = 0; i < this._numVoices; i++) {
				this._voices[i].reset();
			}
		}

		/**
		 * Start a note
		 * @param {number} channel
		 * @param {number} note
		 * @param {number} velocity
		 */
		noteOn(channel, note, velocity) {
			// Stop any existing voices on this note
			this.noteOff(channel, note, velocity);

			// Find an idle voice or steal the oldest one
			let oldestTimestamp = globalThis.currentTime;
			let oldestIdx = 0;
			let allocatedIdx = -1;

			for (let i = 0; i < this._numVoices; i++) {
				if (this._voiceStates[i] === 0) {
					allocatedIdx = i;
					break;
				}
				if (this._voices[i].timestamp <= oldestTimestamp) {
					oldestTimestamp = this._voices[i].timestamp;
					oldestIdx = i;
				}
			}

			if (allocatedIdx === -1) {
				// No idle voices, steal the oldest
				this.noteEnd(oldestIdx);
				allocatedIdx = oldestIdx;
			}

			this._voiceStates[allocatedIdx] = 1;
			this._voices[allocatedIdx].noteOn(channel, note, velocity);
		}

		/**
		 * Stop a note
		 * @param {number} channel
		 * @param {number} note
		 * @param {number} velocity
		 */
		noteOff(channel, note, velocity) {
			for (let i = 0; i < this._numVoices; i++) {
				if (
					this._voiceStates[i] === 1 &&
					this._voices[i].matches(channel, note)
				) {
					this._voices[i].noteOff(channel, note, velocity);
				}
			}
		}

		/**
		 * End a voice
		 * @param {number} voiceIdx
		 */
		noteEnd(voiceIdx) {
			this._voiceStates[voiceIdx] = 0;
			this._voices[voiceIdx].reset();
		}

		/**
		 * Process audio
		 * @param {number} startSample
		 * @param {number} endSample
		 * @param {Float32Array[]} inputs
		 * @param {Float32Array[]} outputs
		 */
		process(startSample, endSample, inputs, outputs) {
			// Clear output buffers
			for (let c = 0; c < this._numChannels; c++) {
				for (let n = startSample; n < endSample; n++) {
					outputs[c][n] = 0;
				}
			}

			// Render all active voices
			for (let i = 0; i < this._numVoices; i++) {
				if (this._voiceStates[i] === 1) {
					const stillActive = this._voices[i].process(
						startSample,
						endSample,
						inputs,
						outputs
					);
					if (!stillActive) {
						this.noteEnd(i);
					}
				}
			}
		}

		static generateWamParameterInfo() {
			return {};
		}
	}

	if (audioWorkletGlobalScope.AudioWorkletProcessor) {
		if (!ModuleScope.WamExampleTemplateSynth) {
			ModuleScope.WamExampleTemplateSynth = WamExampleTemplateSynth;
		}
	}

	return WamExampleTemplateSynth;
};

export default getWamExampleTemplateSynth;
