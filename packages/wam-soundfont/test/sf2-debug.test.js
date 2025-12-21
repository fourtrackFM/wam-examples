/**
 * Test for SF2 debug data - prints complete Hydra structure analysis
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SF2_CACHE_PATH = path.join(__dirname, 'GeneralUser-GS.sf2');

// Generator names for pretty printing
const GENERATOR_NAMES = {
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

/**
 * Parse complete SF2 structure (inline copy from synth code)
 */
function parseCompleteSF2Structure(arrayBuffer) {
	const dataView = new DataView(arrayBuffer);
	let offset = 0;

	const readString = (length) => {
		const chars = [];
		for (let i = 0; i < length; i++) {
			const char = dataView.getUint8(offset++);
			if (char === 0) break;
			chars.push(char);
		}
		offset += length - chars.length;
		return String.fromCharCode(...chars);
	};

	const readDWord = () => {
		if (offset + 4 > arrayBuffer.byteLength) {
			throw new Error(
				`readDWord: offset ${offset} + 4 exceeds buffer length ${arrayBuffer.byteLength}`
			);
		}
		const val = dataView.getUint32(offset, true);
		offset += 4;
		return val;
	};

	const readWord = () => {
		if (offset + 2 > arrayBuffer.byteLength) {
			throw new Error(
				`readWord: offset ${offset} + 2 exceeds buffer length ${arrayBuffer.byteLength}`
			);
		}
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
					// Check if we have enough bytes left in the chunk
					const bytesNeeded = 46;
					const bytesRemaining =
						subChunkStart + subChunkSize - offset;
					if (bytesRemaining < bytesNeeded) {
						// Skip incomplete terminal record
						break;
					}

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

function getNoteNameFromMidi(midiNote) {
	const noteNames = [
		'C',
		'C#',
		'D',
		'D#',
		'E',
		'F',
		'F#',
		'G',
		'G#',
		'A',
		'A#',
		'B',
	];
	const octave = Math.floor(midiNote / 12) - 1;
	const noteName = noteNames[midiNote % 12];
	return `${noteName}${octave}`;
}

/**
 * Main test runner
 */
function runDebugTest() {
	console.log('='.repeat(80));
	console.log('SF2 DEBUG DATA ANALYSIS');
	console.log('='.repeat(80));

	if (!fs.existsSync(SF2_CACHE_PATH)) {
		console.error('❌ SF2 file not found. Run sf2-parser.test.js first.');
		process.exit(1);
	}

	const arrayBuffer = fs.readFileSync(SF2_CACHE_PATH).buffer;
	console.log('\n✅ Loaded SF2 file:', SF2_CACHE_PATH);
	console.log('   Size:', arrayBuffer.byteLength, 'bytes');

	console.log('\nParsing complete Hydra structure...');
	const hydra = parseCompleteSF2Structure(arrayBuffer);

	// ====================
	// CHUNK STATISTICS
	// ====================
	console.log('\n' + '='.repeat(80));
	console.log('CHUNK SIZES');
	console.log('='.repeat(80));
	console.log('Preset Headers (phdr):', hydra.presetHeaders.length);
	console.log('Preset Bags (pbag):', hydra.presetBags.length);
	console.log('Preset Modulators (pmod):', hydra.presetMods.length);
	console.log('Preset Generators (pgen):', hydra.presetGens.length);
	console.log('Instruments (inst):', hydra.instruments.length);
	console.log('Instrument Bags (ibag):', hydra.instrumentBags.length);
	console.log('Instrument Modulators (imod):', hydra.instrumentMods.length);
	console.log('Instrument Generators (igen):', hydra.instrumentGens.length);
	console.log('Sample Headers (shdr):', hydra.sampleHeaders.length);

	// ====================
	// PRESET LIST
	// ====================
	console.log('\n' + '='.repeat(80));
	console.log('ALL PRESETS');
	console.log('='.repeat(80));
	for (let i = 0; i < hydra.presetHeaders.length - 1; i++) {
		const p = hydra.presetHeaders[i];
		console.log(
			`Program ${p.preset.toString().padStart(3)}, Bank ${p.bank}: ${
				p.name
			}`
		);
	}

	// ====================
	// INSTRUMENT LIST
	// ====================
	console.log('\n' + '='.repeat(80));
	console.log('ALL INSTRUMENTS (First 20)');
	console.log('='.repeat(80));
	const maxInst = Math.min(20, hydra.instruments.length - 1);
	for (let i = 0; i < maxInst; i++) {
		console.log(
			`[${i.toString().padStart(3)}] ${hydra.instruments[i].name}`
		);
	}
	if (hydra.instruments.length > 21) {
		console.log(`... and ${hydra.instruments.length - 21} more`);
	}

	// ====================
	// SAMPLE LIST
	// ====================
	console.log('\n' + '='.repeat(80));
	console.log('SAMPLE HEADERS (First 20)');
	console.log('='.repeat(80));
	const maxSamples = Math.min(20, hydra.sampleHeaders.length);
	for (let i = 0; i < maxSamples; i++) {
		const s = hydra.sampleHeaders[i];
		const lengthInSamples = s.end - s.start;
		const lengthInSeconds = lengthInSamples / s.sampleRate;
		const hasLoop = s.loopStart !== s.loopEnd;

		console.log(`[${i.toString().padStart(3)}] ${s.name}`);
		console.log(
			`      Rate: ${s.sampleRate}Hz, Length: ${lengthInSeconds.toFixed(
				2
			)}s`
		);
		console.log(
			`      Original Pitch: MIDI ${
				s.originalPitch
			} (${getNoteNameFromMidi(s.originalPitch)})`
		);
		console.log(
			`      Loop: ${hasLoop ? 'Yes' : 'No'}${
				hasLoop ? ` (${s.loopStart} - ${s.loopEnd})` : ''
			}`
		);
	}
	if (hydra.sampleHeaders.length > 20) {
		console.log(`... and ${hydra.sampleHeaders.length - 20} more`);
	}

	// ====================
	// GENERATOR ANALYSIS
	// ====================
	console.log('\n' + '='.repeat(80));
	console.log('GENERATOR USAGE ANALYSIS');
	console.log('='.repeat(80));

	const presetGenCounts = {};
	const instGenCounts = {};

	hydra.presetGens.forEach((g) => {
		presetGenCounts[g.oper] = (presetGenCounts[g.oper] || 0) + 1;
	});

	hydra.instrumentGens.forEach((g) => {
		instGenCounts[g.oper] = (instGenCounts[g.oper] || 0) + 1;
	});

	console.log('\nPreset Generator Usage:');
	Object.entries(presetGenCounts)
		.sort((a, b) => b[1] - a[1]) // Sort by count descending
		.forEach(([oper, count]) => {
			const name = GENERATOR_NAMES[oper] || `Unknown(${oper})`;
			console.log(`  ${name.padEnd(30)} : ${count}`);
		});

	console.log('\nInstrument Generator Usage:');
	Object.entries(instGenCounts)
		.sort((a, b) => b[1] - a[1])
		.forEach(([oper, count]) => {
			const name = GENERATOR_NAMES[oper] || `Unknown(${oper})`;
			console.log(`  ${name.padEnd(30)} : ${count}`);
		});

	// ====================
	// MODULATOR ANALYSIS
	// ====================
	console.log('\n' + '='.repeat(80));
	console.log('MODULATOR ANALYSIS');
	console.log('='.repeat(80));
	console.log('Preset Modulators:', hydra.presetMods.length);
	console.log('Instrument Modulators:', hydra.instrumentMods.length);

	if (hydra.presetMods.length > 0) {
		console.log('\nFirst 5 Preset Modulators:');
		for (let i = 0; i < Math.min(5, hydra.presetMods.length); i++) {
			const mod = hydra.presetMods[i];
			const destName =
				GENERATOR_NAMES[mod.destOper] || `Unknown(${mod.destOper})`;
			console.log(
				`  [${i}] srcOper:${mod.srcOper} -> ${destName}, amount:${mod.amount}`
			);
		}
	}

	if (hydra.instrumentMods.length > 0) {
		console.log('\nFirst 5 Instrument Modulators:');
		for (let i = 0; i < Math.min(5, hydra.instrumentMods.length); i++) {
			const mod = hydra.instrumentMods[i];
			const destName =
				GENERATOR_NAMES[mod.destOper] || `Unknown(${mod.destOper})`;
			console.log(
				`  [${i}] srcOper:${mod.srcOper} -> ${destName}, amount:${mod.amount}`
			);
		}
	}

	// ====================
	// PRESET DETAIL EXAMPLE
	// ====================
	console.log('\n' + '='.repeat(80));
	console.log('DETAILED PRESET ANALYSIS - Program 0 (Grand Piano)');
	console.log('='.repeat(80));

	const preset = hydra.presetHeaders[0];
	const nextBagIdx = hydra.presetHeaders[1].bagIndex;
	const presetBags = hydra.presetBags.slice(preset.bagIndex, nextBagIdx);

	console.log('\nPreset Info:');
	console.log('  Name:', preset.name);
	console.log('  Program:', preset.preset);
	console.log('  Bank:', preset.bank);
	console.log('  Number of zones:', presetBags.length);

	// Find instrument
	let instrumentId = null;
	for (const bag of presetBags) {
		const nextGenIdx =
			presetBags.indexOf(bag) + 1 < presetBags.length
				? presetBags[presetBags.indexOf(bag) + 1].genIndex
				: hydra.presetGens.length;
		const gens = hydra.presetGens.slice(bag.genIndex, nextGenIdx);

		const instGen = gens.find((g) => g.oper === 41);
		if (instGen) {
			instrumentId = instGen.amount;
			break;
		}
	}

	if (instrumentId !== null) {
		const instrument = hydra.instruments[instrumentId];
		console.log('\nInstrument:');
		console.log('  ID:', instrumentId);
		console.log('  Name:', instrument.name);

		const nextInstBagIdx =
			instrumentId + 1 < hydra.instruments.length
				? hydra.instruments[instrumentId + 1].bagIndex
				: hydra.instrumentBags.length;
		const instrumentBags = hydra.instrumentBags.slice(
			instrument.bagIndex,
			nextInstBagIdx
		);

		console.log('  Number of zones:', instrumentBags.length);
		console.log('\nSamples used:');

		instrumentBags.forEach((bag, bagIdx) => {
			const nextGenIdx =
				bagIdx + 1 < instrumentBags.length
					? instrumentBags[bagIdx + 1].genIndex
					: hydra.instrumentGens.length;
			const gens = hydra.instrumentGens.slice(bag.genIndex, nextGenIdx);

			const sampleGen = gens.find((g) => g.oper === 53);
			if (sampleGen) {
				const sample = hydra.sampleHeaders[sampleGen.amount];

				const keyRangeGen = gens.find((g) => g.oper === 43);
				let keyRange = { lo: 0, hi: 127 };
				if (keyRangeGen) {
					keyRange = {
						lo: keyRangeGen.amount & 0xff,
						hi: (keyRangeGen.amount >> 8) & 0xff,
					};
				}

				console.log(`  Zone ${bagIdx}:`);
				console.log(`    Sample: ${sample.name}`);
				console.log(
					`    Key Range: ${keyRange.lo}-${
						keyRange.hi
					} (${getNoteNameFromMidi(
						keyRange.lo
					)}-${getNoteNameFromMidi(keyRange.hi)})`
				);
			}
		});
	}

	console.log('\n' + '='.repeat(80));
	console.log('DEBUG TEST COMPLETE');
	console.log('='.repeat(80));
}

// Run the test
runDebugTest();
