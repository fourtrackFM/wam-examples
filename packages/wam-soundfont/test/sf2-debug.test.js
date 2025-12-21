/**
 * Test for SF2 debug data - prints complete Hydra structure analysis
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
	parseCompleteSF2Structure,
	interpretGeneratorValue,
	getGeneratorNames,
} from '../src/WamSoundFontSynth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SF2_CACHE_PATH = path.join(__dirname, 'GeneralUser-GS.sf2');

// Get generator names
const GENERATOR_NAMES = getGeneratorNames();

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
	// DETAILED PRESET ANALYSIS WITH GENERATORS
	// ====================
	console.log('\n' + '='.repeat(80));
	console.log(
		'DETAILED PRESET ANALYSIS - First 3 Presets with ALL Generators'
	);
	console.log('='.repeat(80));

	for (
		let presetIdx = 0;
		presetIdx < Math.min(3, hydra.presetHeaders.length - 1);
		presetIdx++
	) {
		const preset = hydra.presetHeaders[presetIdx];
		const nextBagIdx = hydra.presetHeaders[presetIdx + 1].bagIndex;
		const presetBags = hydra.presetBags.slice(preset.bagIndex, nextBagIdx);

		console.log(`\n${'='.repeat(80)}`);
		console.log(`PRESET ${presetIdx}: "${preset.name}"`);
		console.log(`Program: ${preset.preset}, Bank: ${preset.bank}`);
		console.log(`Number of zones: ${presetBags.length}`);
		console.log('='.repeat(80));

		// Print each zone with all its generators
		presetBags.forEach((bag, bagIdx) => {
			const nextGenIdx =
				bagIdx + 1 < presetBags.length
					? presetBags[bagIdx + 1].genIndex
					: hydra.presetGens.length;
			const gens = hydra.presetGens.slice(bag.genIndex, nextGenIdx);

			console.log(`\n  Zone ${bagIdx}:`);

			// Check if this is a global zone (no instrument generator)
			const hasInstrument = gens.some((g) => g.oper === 41);
			if (!hasInstrument && bagIdx === 0) {
				console.log('    [GLOBAL ZONE]');
			}

			// Print all generators
			gens.forEach((gen) => {
				const name =
					GENERATOR_NAMES[gen.oper] || `Unknown(${gen.oper})`;
				const interpreted = interpretGeneratorValue(
					gen.oper,
					gen.amount
				);
				let valueStr;

				// Special formatting for certain generators
				if (gen.oper === 43) {
					// keyRange
					valueStr = `${interpreted.raw} (${getNoteNameFromMidi(
						interpreted.lo
					)}-${getNoteNameFromMidi(interpreted.hi)}, ${
						interpreted.lo
					}-${interpreted.hi})`;
				} else if (gen.oper === 44) {
					// velRange
					valueStr = `${interpreted.raw} (${interpreted.lo}-${interpreted.hi})`;
				} else if (gen.oper === 41) {
					// instrument
					const instName =
						gen.amount < hydra.instruments.length
							? hydra.instruments[gen.amount].name
							: 'INVALID';
					valueStr = `${gen.amount} "${instName}"`;
				} else if (interpreted.unit) {
					// Show both raw and interpreted value with unit
					if (interpreted.unit === 'range') {
						valueStr = `${interpreted.raw}`;
					} else {
						const displayValue =
							typeof interpreted.value === 'number'
								? interpreted.value.toFixed(2)
								: interpreted.value;
						valueStr = `${interpreted.raw} (${displayValue} ${interpreted.unit})`;
					}
				} else {
					valueStr = `${interpreted.raw}`;
				}

				console.log(`    ${name.padEnd(30)} = ${valueStr}`);
			});
		});
	}

	// ====================
	// ORIGINAL PRESET DETAIL EXAMPLE (keeping for reference)
	// ====================
	console.log('\n' + '='.repeat(80));
	console.log("INSTRUMENT DETAIL - First Preset's First Instrument");
	console.log('='.repeat(80));

	const preset = hydra.presetHeaders[0];
	const nextBagIdx = hydra.presetHeaders[1].bagIndex;
	const presetBags = hydra.presetBags.slice(preset.bagIndex, nextBagIdx);
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
