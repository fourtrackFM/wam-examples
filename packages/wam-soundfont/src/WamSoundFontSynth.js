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
/** @typedef {import('./types').WamExampleTemplateSynth} WamExampleTemplateSynthConstructor */

// ============================================================================
// STANDALONE SF2 PARSING FUNCTIONS (can be used outside worklet context)
// ============================================================================

/**
 * Parse SF2 file and extract complete hydra structure for debugging
 * @param {ArrayBuffer} arrayBuffer
 * @returns {Object} Complete hydra structure with all chunks
 */
export function parseCompleteSF2Structure(arrayBuffer) {
	const dataView = new DataView(arrayBuffer);
	let offset = 0;

	const readString = (length) => {
		const chars = [];
		for (let i = 0; i < length; i++) {
			const char = dataView.getUint8(offset + i);
			if (char === 0) break;
			chars.push(char);
		}
		offset += length; // Always advance by full length
		return String.fromCharCode(...chars);
	};

	const readDWord = () => {
		const val = dataView.getUint32(offset, true);
		offset += 4;
		return val;
	};

	const readWord = () => {
		const val = dataView.getUint16(offset, true);
		offset += 2;
		return val;
	};

	const readByte = () => dataView.getUint8(offset++);
	const readChar = () => dataView.getInt8(offset++);

	// Skip RIFF header
	offset = 12;

	let pdtaOffset = null;

	// Find pdta chunk
	while (offset < arrayBuffer.byteLength - 8) {
		const chunkId = readString(4);
		const chunkSize = readDWord();
		const chunkStart = offset;

		if (chunkId === 'LIST') {
			const listType = readString(4);
			if (listType === 'pdta') pdtaOffset = chunkStart;
		}

		offset = chunkStart + chunkSize;
	}

	const hydra = {
		presetHeaders: [],
		presetBags: [],
		presetMods: [],
		presetGens: [],
		instruments: [],
		instrumentBags: [],
		instrumentMods: [],
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
			} else if (subChunkId === 'pmod') {
				const count = Math.floor(subChunkSize / 10);
				for (let i = 0; i < count; i++) {
					const srcOper = readWord();
					const destOper = readWord();
					const amount = dataView.getInt16(offset, true);
					offset += 2;
					const amtSrcOper = readWord();
					const transOper = readWord();
					hydra.presetMods.push({
						srcOper,
						destOper,
						amount,
						amtSrcOper,
						transOper,
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
			} else if (subChunkId === 'imod') {
				const count = Math.floor(subChunkSize / 10);
				for (let i = 0; i < count; i++) {
					const srcOper = readWord();
					const destOper = readWord();
					const amount = dataView.getInt16(offset, true);
					offset += 2;
					const amtSrcOper = readWord();
					const transOper = readWord();
					hydra.instrumentMods.push({
						srcOper,
						destOper,
						amount,
						amtSrcOper,
						transOper,
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

	return hydra;
}

/**
 * Parse preset data with all generators for a specific preset
 * @param {ArrayBuffer} arrayBuffer
 * @param {number} presetIndex - Index of preset in preset headers array
 * @returns {Object} Preset data with zones and generators
 */
export function parsePresetWithGenerators(arrayBuffer, presetIndex) {
	const hydra = parseCompleteSF2Structure(arrayBuffer);

	if (presetIndex >= hydra.presetHeaders.length - 1) {
		throw new Error(`Invalid preset index ${presetIndex}`);
	}

	const preset = hydra.presetHeaders[presetIndex];
	const nextBagIdx = hydra.presetHeaders[presetIndex + 1].bagIndex;
	const presetBags = hydra.presetBags.slice(preset.bagIndex, nextBagIdx);

	const zones = presetBags.map((bag, bagIdx) => {
		const nextGenIdx =
			bagIdx + 1 < presetBags.length
				? presetBags[bagIdx + 1].genIndex
				: hydra.presetGens.length;
		const gens = hydra.presetGens.slice(bag.genIndex, nextGenIdx);

		const nextModIdx =
			bagIdx + 1 < presetBags.length
				? presetBags[bagIdx + 1].modIndex
				: hydra.presetMods.length;
		const mods = hydra.presetMods.slice(bag.modIndex, nextModIdx);

		// Convert generators array to object for easy access
		const generators = {};
		gens.forEach((gen) => {
			generators[gen.oper] = gen.amount;
		});

		return {
			zoneIndex: bagIdx,
			generators,
			modulators: mods,
			isGlobal: bagIdx === 0 && !gens.some((g) => g.oper === 41),
		};
	});

	return {
		name: preset.name,
		program: preset.preset,
		bank: preset.bank,
		zones,
		hydra, // Include full hydra for instrument/sample lookups
	};
}

/**
 * Get all generator names mapping
 * @returns {Object} Generator operator to name mapping
 */
export function getGeneratorNames() {
	return {
		0: 'startAddrsOffset',
		1: 'endAddrsOffset',
		2: 'startloopAddrsOffset',
		3: 'endloopAddrsOffset',
		4: 'startAddrsCoarseOffset',
		5: 'modLfoToPitch',
		6: 'vibLfoToPitch',
		7: 'modEnvToPitch',
		8: 'initialFilterFc',
		9: 'initialFilterQ',
		10: 'modLfoToFilterFc',
		11: 'modEnvToFilterFc',
		12: 'endAddrsCoarseOffset',
		13: 'modLfoToVolume',
		15: 'chorusEffectsSend',
		16: 'reverbEffectsSend',
		17: 'pan',
		21: 'delayModLFO',
		22: 'freqModLFO',
		23: 'delayVibLFO',
		24: 'freqVibLFO',
		25: 'delayModEnv',
		26: 'attackModEnv',
		27: 'holdModEnv',
		28: 'decayModEnv',
		29: 'sustainModEnv',
		30: 'releaseModEnv',
		33: 'delayVolEnv',
		34: 'attackVolEnv',
		35: 'holdVolEnv',
		36: 'decayVolEnv',
		37: 'sustainVolEnv',
		38: 'releaseVolEnv',
		41: 'instrument',
		43: 'keyRange',
		44: 'velRange',
		46: 'keynum',
		47: 'velocity',
		48: 'initialAttenuation',
		51: 'coarseTune',
		52: 'fineTune',
		53: 'sampleID',
		54: 'sampleModes',
		56: 'scaleTuning',
		57: 'exclusiveClass',
		58: 'overridingRootKey',
	};
}

/**
 * Convert timecent value to milliseconds
 * @param {number} timecents - Timecent value (signed 16-bit)
 * @returns {number} Time in milliseconds
 */
export function timecentsToMilliseconds(timecents) {
	// Timecents: 1200 log2(t) where t is in seconds
	// So t = 2^(timecents/1200) seconds
	return Math.pow(2, timecents / 1200) * 1000;
}

/**
 * Convert centibel value to decibels
 * @param {number} centibels - Centibel value
 * @returns {number} Value in decibels
 */
export function centibelsToDecibels(centibels) {
	return centibels / 10;
}

/**
 * Convert absolute cent value to Hz
 * @param {number} cents - Absolute cent value
 * @returns {number} Frequency in Hz
 */
export function absoluteCentsToHz(cents) {
	// Absolute cents: 1200 log2(f/8.176) where f is in Hz
	// So f = 8.176 * 2^(cents/1200)
	return 8.176 * Math.pow(2, cents / 1200);
}

/**
 * Interpret generator value based on its type
 * @param {number} operator - Generator operator
 * @param {number} amount - Raw generator amount (as 16-bit signed or unsigned)
 * @returns {Object} Interpreted value with unit
 */
export function interpretGeneratorValue(operator, amount) {
	// Convert unsigned 16-bit to signed 16-bit where needed
	const signed = amount > 32767 ? amount - 65536 : amount;

	switch (operator) {
		// Time values in timecents (absolute)
		case 21: // delayModLFO
		case 23: // delayVibLFO
		case 25: // delayModEnv
		case 26: // attackModEnv
		case 27: // holdModEnv
		case 28: // decayModEnv
		case 30: // releaseModEnv
		case 33: // delayVolEnv
		case 34: // attackVolEnv
		case 35: // holdVolEnv
		case 36: // decayVolEnv
		case 38: // releaseVolEnv
			return {
				raw: signed,
				value: timecentsToMilliseconds(signed),
				unit: 'msec',
			};

		// Sustain levels in centibels
		case 29: // sustainModEnv
		case 37: // sustainVolEnv
			return {
				raw: amount,
				value: centibelsToDecibels(amount),
				unit: 'dB',
			};

		// Attenuation in centibels
		case 48: // initialAttenuation
			return {
				raw: amount,
				value: centibelsToDecibels(amount),
				unit: 'cB',
			};

		// Filter cutoff in absolute cents
		case 8: // initialFilterFc
			return {
				raw: signed,
				value: absoluteCentsToHz(signed),
				unit: 'Hz',
			};

		// Frequency in absolute cents
		case 22: // freqModLFO
		case 24: // freqVibLFO
			return {
				raw: signed,
				value: absoluteCentsToHz(signed) / 8.176, // Convert to Hz
				unit: 'Hz',
			};

		// Percent values (0-1000 = 0-100%)
		case 15: // chorusEffectsSend
		case 16: // reverbEffectsSend
			return {
				raw: amount,
				value: amount / 10,
				unit: '%',
			};

		// Pan (-500 to 500 = left to right)
		case 17: // pan
			return {
				raw: signed,
				value: signed / 10,
				unit: '‰', // permille
			};

		// Pitch in cents
		case 5: // modLfoToPitch
		case 6: // vibLfoToPitch
		case 7: // modEnvToPitch
		case 51: // coarseTune (semitones)
		case 52: // fineTune (cents)
			return {
				raw: signed,
				value: signed,
				unit: 'cents',
			};

		// Range values (lo byte, hi byte)
		case 43: // keyRange
		case 44: // velRange
			return {
				raw: amount,
				lo: amount & 0xff,
				hi: (amount >> 8) & 0xff,
				unit: 'range',
			};

		// Direct values
		default:
			return {
				raw: amount,
				value: amount,
				unit: '',
			};
	}
}

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

		// Convert absolute loop points to relative positions within the sliced data
		const relativeLoopStart = sample.loopStart - sample.start;
		const relativeLoopEnd = sample.loopEnd - sample.start;

		return {
			sampleData,
			selectedSample: {
				...sample,
				rootKey: overrideRootKey || sample.originalPitch,
				keyRange,
				velRange,
				// Use relative loop points
				loopStart: relativeLoopStart,
				loopEnd: relativeLoopEnd,
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
	 * Parse complete SF2 structure for debugging (worklet-compatible version)
	 * @param {ArrayBuffer} arrayBuffer
	 * @returns {Object} Complete hydra structure
	 */
	function parseCompleteSF2Structure(arrayBuffer) {
		const dataView = new DataView(arrayBuffer);
		let offset = 0;

		const readString = (length) => {
			const chars = [];
			for (let i = 0; i < length; i++) {
				const char = dataView.getUint8(offset + i);
				if (char === 0) break;
				chars.push(char);
			}
			offset += length;
			return String.fromCharCode(...chars);
		};

		const readDWord = () => {
			const val = dataView.getUint32(offset, true);
			offset += 4;
			return val;
		};

		const readWord = () => {
			const val = dataView.getUint16(offset, true);
			offset += 2;
			return val;
		};

		const readByte = () => {
			const val = dataView.getUint8(offset);
			offset += 1;
			return val;
		};

		const readChar = () => {
			const val = dataView.getInt8(offset);
			offset += 1;
			return val;
		};

		const hydra = {
			presetHeaders: [],
			presetBags: [],
			presetMods: [],
			presetGens: [],
			instruments: [],
			instrumentBags: [],
			instrumentMods: [],
			instrumentGens: [],
			sampleHeaders: [],
		};

		// Skip RIFF header
		offset = 12;

		// Parse chunks
		while (offset < arrayBuffer.byteLength - 8) {
			const chunkId = readString(4);
			const chunkSize = readDWord();
			const chunkStart = offset;

			if (chunkId === 'LIST') {
				const listType = readString(4);

				if (listType === 'pdta') {
					while (offset < chunkStart + chunkSize) {
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
						} else if (subChunkId === 'pmod') {
							const count = Math.floor(subChunkSize / 10);
							for (let i = 0; i < count; i++) {
								hydra.presetMods.push({
									modSrcOper: readWord(),
									modDestOper: readWord(),
									modAmount: readWord(),
									modAmtSrcOper: readWord(),
									modTransOper: readWord(),
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
						} else if (subChunkId === 'imod') {
							const count = Math.floor(subChunkSize / 10);
							for (let i = 0; i < count; i++) {
								hydra.instrumentMods.push({
									modSrcOper: readWord(),
									modDestOper: readWord(),
									modAmount: readWord(),
									modAmtSrcOper: readWord(),
									modTransOper: readWord(),
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
				} else {
					offset = chunkStart + chunkSize;
				}
			} else {
				offset = chunkStart + chunkSize;
			}
		}

		return hydra;
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
			this._sampleDataSampleRate = 44100; // SF2 sample's native sample rate
		}

		reset() {
			this._active = false;
			this._gain = 0.0;
			this._samplePosition = 0;
		}

		/**
		 * Set sample data for playback
		 * @param {Int16Array} sampleData
		 * @param {Object} metadata - Sample metadata with rootKey, loop points, and sampleRate
		 */
		setSampleData(sampleData, metadata) {
			this._sampleData = sampleData;
			this._rootKey = metadata.rootKey || 60;
			this._loopStart = metadata.loopStart || 0;
			this._loopEnd =
				metadata.loopEnd || (sampleData ? sampleData.length : 0);
			this._sampleDataSampleRate = metadata.sampleRate || 44100;
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
			// Account for both pitch difference AND sample rate difference
			const sampleRateRatio =
				this._sampleDataSampleRate / this._sampleRate;
			this._playbackRate = (frequency / rootFreq) * sampleRateRatio;
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
				let sampleIndex = Math.floor(this._samplePosition);

				// Handle looping: when we reach loopEnd, jump back to loopStart
				if (
					sampleIndex >= this._loopEnd &&
					this._loopEnd > this._loopStart &&
					this._loopStart >= 0
				) {
					// Jump back to loop start and continue from there
					const loopLength = this._loopEnd - this._loopStart;
					const overshoot = this._samplePosition - this._loopEnd;
					this._samplePosition =
						this._loopStart + (overshoot % loopLength);
					sampleIndex = Math.floor(this._samplePosition);
				}

				// Check bounds and play sample
				if (sampleIndex >= 0 && sampleIndex < this._sampleData.length) {
					// Convert Int16 to float32 (-1 to 1)
					const sampleValue = this._sampleData[sampleIndex] / 32768.0;
					signal[n] += this._gain * sampleValue;
					this._samplePosition += this._playbackRate;
				} else {
					// If no valid loop, stop when we reach the end
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

			console.log('[Voice] noteOn:', {
				note,
				velocity,
				gain,
				frequency,
				leftHasSample: !!this._leftPart._sampleData,
				rightHasSample: !!this._rightPart._sampleData,
			});

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

			// Debug data storage
			this._hydraStructure = null;
			this._allProgramsMetadata = [];

			// Parse all 128 MIDI programs at construction if sf2Buffer is provided in config
			const sf2Buffer = config.sf2Buffer;
			if (sf2Buffer) {
				console.log('[Synth] Parsing all SF2 programs...');
				const allPrograms = parseAllSF2Programs(sf2Buffer);
				console.log('[Synth] Parsed', allPrograms.length, 'programs');

				// Parse complete structure for debug info
				this._hydraStructure = parseCompleteSF2Structure(sf2Buffer);
				console.log('[Synth] Parsed complete hydra structure');

				// Load all programs into the map and store metadata
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

						// Store metadata for debug access
						this._allProgramsMetadata.push({
							program: programData.program,
							presetName: programData.presetName,
							sampleRate: programData.sampleRate,
							sampleLength: programData.sampleData
								? programData.sampleData.length
								: 0,
							loopStart:
								programData.selectedSample?.loopStart || 0,
							loopEnd: programData.selectedSample?.loopEnd || 0,
							originalPitch:
								programData.selectedSample?.originalPitch || 60,
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
							metadata.selectedSample
						);
						voice._rightPart.setSampleData(
							this._sampleData,
							metadata.selectedSample
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
					metadata.selectedSample
				);
				this._voices[i]._rightPart.setSampleData(
					this._sampleData,
					metadata.selectedSample
				);
			}

			console.log(
				'[Synth] Switched to program',
				program,
				'sample length:',
				this._sampleData ? this._sampleData.length : 0,
				'loop:',
				metadata.selectedSample?.loopStart || 0,
				'-',
				metadata.selectedSample?.loopEnd || 0
			);
		}

		/**
		 * Get complete debug data for all SF2 chunks
		 * @returns {Object}
		 */
		getDebugData() {
			return {
				hydra: this._hydraStructure,
				programs: this._allProgramsMetadata,
				currentProgram: this._currentProgram,
			};
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
						data.selectedSample || metadata
					);
					this._voices[i]._rightPart.setSampleData(
						this._sampleData,
						data.selectedSample || metadata
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
			console.log('[Synth] noteOn called:', { channel, note, velocity });
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

			console.log('[Synth] Allocating voice:', allocatedIdx);
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
