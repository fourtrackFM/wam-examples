/**
 * SF2 parser to extract samples with proper root key and loop points
 * Based on SoundFont 2.04 specification
 */

// Generator enumerators from SF2 spec section 8.1.2
const GeneratorType = {
	startAddrsOffset: 0,
	endAddrsOffset: 1,
	startloopAddrsOffset: 2,
	endloopAddrsOffset: 3,
	startAddrsCoarseOffset: 4,
	modLfoToPitch: 5,
	vibLfoToPitch: 6,
	modEnvToPitch: 7,
	initialFilterFc: 8,
	initialFilterQ: 9,
	modLfoToFilterFc: 10,
	modEnvToFilterFc: 11,
	endAddrsCoarseOffset: 12,
	modLfoToVolume: 13,
	chorusEffectsSend: 15,
	reverbEffectsSend: 16,
	pan: 17,
	delayModLFO: 21,
	freqModLFO: 22,
	delayVibLFO: 23,
	freqVibLFO: 24,
	delayModEnv: 25,
	attackModEnv: 26,
	holdModEnv: 27,
	decayModEnv: 28,
	sustainModEnv: 29,
	releaseModEnv: 30,
	keynumToModEnvHold: 31,
	keynumToModEnvDecay: 32,
	delayVolEnv: 33,
	attackVolEnv: 34,
	holdVolEnv: 35,
	decayVolEnv: 36,
	sustainVolEnv: 37,
	releaseVolEnv: 38,
	keynumToVolEnvHold: 39,
	keynumToVolEnvDecay: 40,
	instrument: 41,
	keyRange: 43,
	velRange: 44,
	startloopAddrsCoarseOffset: 45,
	keynum: 46,
	velocity: 47,
	initialAttenuation: 48,
	endloopAddrsCoarseOffset: 50,
	coarseTune: 51,
	fineTune: 52,
	sampleID: 53,
	sampleModes: 54,
	scaleTuning: 56,
	exclusiveClass: 57,
	overridingRootKey: 58,
};

/**
 * Parse SF2 file and extract instrument data for a program
 * @param {ArrayBuffer} arrayBuffer
 * @param {number} programNumber - MIDI program number (0-127)
 * @param {number} bankNumber - MIDI bank number (default 0)
 * @returns {Object} Parsed instrument data with samples
 */
export function parseSF2(arrayBuffer, programNumber = 0, bankNumber = 0) {
	const dataView = new DataView(arrayBuffer);
	let offset = 0;

	// Helper to read string
	function readString(length) {
		const chars = [];
		for (let i = 0; i < length; i++) {
			const char = dataView.getUint8(offset++);
			if (char !== 0) chars.push(String.fromCharCode(char));
		}
		return chars.join('');
	}

	// Helper to read DWORD (unsigned 32-bit)
	function readDWord() {
		const value = dataView.getUint32(offset, true);
		offset += 4;
		return value;
	}

	// Helper to read WORD (unsigned 16-bit)
	function readWord() {
		const value = dataView.getUint16(offset, true);
		offset += 2;
		return value;
	}

	// Helper to read SHORT (signed 16-bit)
	function readShort() {
		const value = dataView.getInt16(offset, true);
		offset += 2;
		return value;
	}

	// Helper to read BYTE
	function readByte() {
		return dataView.getUint8(offset++);
	}

	// Helper to read CHAR (signed byte)
	function readChar() {
		return dataView.getInt8(offset++);
	}

	console.log(
		'[SF2Parser] Parsing SF2 file, program:',
		programNumber,
		'bank:',
		bankNumber,
		'size:',
		arrayBuffer.byteLength
	);

	// Read RIFF header
	const riff = readString(4);
	if (riff !== 'RIFF') {
		throw new Error('Not a valid RIFF file');
	}

	const fileSize = readDWord();
	const sfbk = readString(4);
	if (sfbk !== 'sfbk') {
		throw new Error('Not a valid SoundFont file');
	}

	console.log('[SF2Parser] Valid SoundFont file detected');

	// Parse main chunks
	let sdtaOffset = 0;
	let pdtaOffset = 0;
	let infoOffset = 0;

	while (offset < arrayBuffer.byteLength - 8) {
		const chunkId = readString(4);
		const chunkSize = readDWord();
		const chunkStart = offset;

		if (chunkId === 'LIST') {
			const listType = readString(4);

			if (listType === 'INFO') {
				infoOffset = chunkStart;
			} else if (listType === 'sdta') {
				sdtaOffset = chunkStart;
			} else if (listType === 'pdta') {
				pdtaOffset = chunkStart;
			}
		}

		offset = chunkStart + chunkSize;
	}

	// Parse sample data (sdta-list)
	let rawSampleData = null;
	if (sdtaOffset) {
		offset = sdtaOffset + 4; // Skip LIST type
		const endOffset = offset + dataView.getUint32(sdtaOffset - 4, true) - 4;

		while (offset < endOffset - 8) {
			const subChunkId = readString(4);
			const subChunkSize = readDWord();

			if (subChunkId === 'smpl') {
				rawSampleData = new Int16Array(
					arrayBuffer,
					offset,
					subChunkSize / 2
				);
				console.log(
					'[SF2Parser] Found sample data:',
					rawSampleData.length,
					'samples'
				);
				break;
			}
			offset += subChunkSize;
		}
	}

	if (!rawSampleData) {
		throw new Error('No sample data found in SF2 file');
	}

	// Parse hydra (pdta-list) structures
	const hydra = {
		presetHeaders: [],
		presetBags: [],
		presetGens: [],
		presetMods: [],
		instruments: [],
		instrumentBags: [],
		instrumentGens: [],
		instrumentMods: [],
		sampleHeaders: [],
	};

	if (pdtaOffset) {
		offset = pdtaOffset + 4; // Skip LIST type
		const pdtaSize = dataView.getUint32(pdtaOffset - 4, true);
		const endOffset = offset + pdtaSize - 4;

		while (offset < endOffset - 8) {
			const subChunkId = readString(4);
			const subChunkSize = readDWord();
			const subChunkStart = offset;

			if (subChunkId === 'phdr') {
				// Preset headers (38 bytes each)
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
				// Preset bags (4 bytes each)
				const count = Math.floor(subChunkSize / 4);
				for (let i = 0; i < count; i++) {
					hydra.presetBags.push({
						genIndex: readWord(),
						modIndex: readWord(),
					});
				}
			} else if (subChunkId === 'pmod') {
				// Preset modulators (10 bytes each)
				const count = Math.floor(subChunkSize / 10);
				for (let i = 0; i < count; i++) {
					hydra.presetMods.push({
						srcOper: readWord(),
						destOper: readWord(),
						amount: readShort(),
						amtSrcOper: readWord(),
						transOper: readWord(),
					});
				}
			} else if (subChunkId === 'pgen') {
				// Preset generators (4 bytes each)
				const count = Math.floor(subChunkSize / 4);
				for (let i = 0; i < count; i++) {
					const oper = readWord();
					const amount = readWord();
					hydra.presetGens.push({ oper, amount });
				}
			} else if (subChunkId === 'inst') {
				// Instruments (22 bytes each)
				const count = Math.floor(subChunkSize / 22);
				for (let i = 0; i < count; i++) {
					hydra.instruments.push({
						name: readString(20),
						bagIndex: readWord(),
					});
				}
			} else if (subChunkId === 'ibag') {
				// Instrument bags (4 bytes each)
				const count = Math.floor(subChunkSize / 4);
				for (let i = 0; i < count; i++) {
					hydra.instrumentBags.push({
						genIndex: readWord(),
						modIndex: readWord(),
					});
				}
			} else if (subChunkId === 'imod') {
				// Instrument modulators (10 bytes each)
				const count = Math.floor(subChunkSize / 10);
				for (let i = 0; i < count; i++) {
					hydra.instrumentMods.push({
						srcOper: readWord(),
						destOper: readWord(),
						amount: readShort(),
						amtSrcOper: readWord(),
						transOper: readWord(),
					});
				}
			} else if (subChunkId === 'igen') {
				// Instrument generators (4 bytes each)
				const count = Math.floor(subChunkSize / 4);
				for (let i = 0; i < count; i++) {
					const oper = readWord();
					const amount = readWord();
					hydra.instrumentGens.push({ oper, amount });
				}
			} else if (subChunkId === 'shdr') {
				// Sample headers (46 bytes each)
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

					// Ignore terminal record (type 0x8000)
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

	console.log('[SF2Parser] Parsed hydra:', {
		presets: hydra.presetHeaders.length - 1,
		instruments: hydra.instruments.length - 1,
		samples: hydra.sampleHeaders.length,
	});

	// Find the requested preset
	let preset = null;
	for (let i = 0; i < hydra.presetHeaders.length - 1; i++) {
		const p = hydra.presetHeaders[i];
		if (p.preset === programNumber && p.bank === bankNumber) {
			preset = p;
			console.log('[SF2Parser] Found preset:', p.name);
			break;
		}
	}

	if (!preset) {
		// Fallback to first preset if requested one not found
		preset = hydra.presetHeaders[0];
		console.warn(
			'[SF2Parser] Requested preset not found, using:',
			preset.name
		);
	}

	// Get preset zones
	const nextBagIndex =
		hydra.presetHeaders[hydra.presetHeaders.indexOf(preset) + 1].bagIndex;
	const presetBags = hydra.presetBags.slice(preset.bagIndex, nextBagIndex);

	// Find instrument from first preset zone (skip global zone if exists)
	let instrumentId = null;
	for (const bag of presetBags) {
		const nextGenIndex =
			presetBags.indexOf(bag) + 1 < presetBags.length
				? presetBags[presetBags.indexOf(bag) + 1].genIndex
				: hydra.presetGens.length;
		const gens = hydra.presetGens.slice(bag.genIndex, nextGenIndex);

		// Look for instrument generator
		const instGen = gens.find((g) => g.oper === GeneratorType.instrument);
		if (instGen) {
			instrumentId = instGen.amount;
			break;
		}
	}

	if (instrumentId === null || instrumentId >= hydra.instruments.length) {
		throw new Error('No valid instrument found in preset');
	}

	const instrument = hydra.instruments[instrumentId];
	console.log('[SF2Parser] Using instrument:', instrument.name);

	// Get instrument zones
	const nextInstBagIndex =
		instrumentId + 1 < hydra.instruments.length
			? hydra.instruments[instrumentId + 1].bagIndex
			: hydra.instrumentBags.length;
	const instrumentBags = hydra.instrumentBags.slice(
		instrument.bagIndex,
		nextInstBagIndex
	);

	// Parse first instrument zone to get sample
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

		// Look for sample ID
		const sampleGen = gens.find((g) => g.oper === GeneratorType.sampleID);
		if (sampleGen) {
			sampleId = sampleGen.amount;

			// Get optional generators
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
			if (rootKeyGen) {
				overrideRootKey = rootKeyGen.amount;
			}

			break;
		}
	}

	if (sampleId === null || sampleId >= hydra.sampleHeaders.length) {
		throw new Error('No valid sample found in instrument');
	}

	const sample = hydra.sampleHeaders[sampleId];
	console.log('[SF2Parser] Using sample:', sample.name, {
		rootKey: overrideRootKey || sample.originalPitch,
		loopStart: sample.loopStart,
		loopEnd: sample.loopEnd,
	});

	// Extract the actual sample data
	const sampleData = rawSampleData.slice(sample.start, sample.end);

	return {
		sampleData,
		sampleHeaders: hydra.sampleHeaders,
		selectedSample: {
			...sample,
			rootKey: overrideRootKey || sample.originalPitch,
			keyRange,
			velRange,
		},
		sampleRate: sample.sampleRate,
		program: programNumber,
		bank: bankNumber,
		presetName: preset.name,
		instrumentName: instrument.name,
	};
}

/**
 * Parse all programs from an SF2 file
 * @param {ArrayBuffer} arrayBuffer - SF2 file data
 * @param {number} bankNumber - MIDI bank number (default 0)
 * @returns {Array} Array of program data objects
 */
export function parseAllSF2Programs(arrayBuffer, bankNumber = 0) {
	console.log(
		'[SF2Parser] Parsing all programs from SF2 file, size:',
		arrayBuffer.byteLength
	);

	const allPrograms = [];
	const totalPrograms = 128;

	for (let program = 0; program < totalPrograms; program++) {
		try {
			const programData = parseSF2(arrayBuffer, program, bankNumber);
			if (programData && programData.sampleData) {
				allPrograms.push(programData);
			}
		} catch (error) {
			console.warn(
				'[SF2Parser] Failed to parse program',
				program,
				':',
				error.message
			);
		}
	}

	console.log(
		'[SF2Parser] Successfully parsed',
		allPrograms.length,
		'programs'
	);
	return allPrograms;
}

/**
 * Create a module getter for AudioWorklet - wraps the parser code to be transferred
 * @param {string} [moduleId]
 * @returns {Object}
 */
const getSF2Parser = (moduleId) => {
	// This function will be serialized and sent to AudioWorklet
	// We need to inline the parseSF2 and parseAllSF2Programs code here

	/** @type {AudioWorkletGlobalScope} */
	// @ts-ignore
	const audioWorkletGlobalScope = globalThis;
	const ModuleScope =
		audioWorkletGlobalScope.webAudioModules.getModuleScope(moduleId);

	// Copy the full parseSF2 function from the module scope into the worklet
	// Since we can't reference external code, we'll attach it later via import
	// For now, make the functions available globally in the worklet
	ModuleScope.parseSF2 = parseSF2;
	ModuleScope.parseAllSF2Programs = parseAllSF2Programs;

	return {};
};

export default getSF2Parser;
