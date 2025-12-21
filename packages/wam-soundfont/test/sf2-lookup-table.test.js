/**
 * Test to generate lookup table for SF2 presets, instruments, and samples
 * Output can be copied directly into GUI code
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { parseCompleteSF2Structure } from '../src/WamSoundFontSynth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SF2_CACHE_PATH = path.join(__dirname, 'GeneralUser-GS.sf2');

/**
 * Main test runner - generates lookup table
 */
function generateLookupTable() {
	console.log('='.repeat(80));
	console.log('SF2 LOOKUP TABLE GENERATOR');
	console.log('='.repeat(80));

	if (!fs.existsSync(SF2_CACHE_PATH)) {
		console.error('❌ SF2 file not found. Run sf2-parser.test.js first.');
		process.exit(1);
	}

	const arrayBuffer = fs.readFileSync(SF2_CACHE_PATH).buffer;
	console.log('\n✅ Loaded SF2 file:', SF2_CACHE_PATH);
	console.log('   Size:', arrayBuffer.byteLength, 'bytes');

	console.log('\nParsing SF2 structure...');
	const hydra = parseCompleteSF2Structure(arrayBuffer);

	// Build lookup table matching processor format
	const lookup = {
		presets: {},
		instruments: {},
		samples: {},
		programs: {},
		currentProgram: null,
	};

	// Preset names from hydra
	if (hydra && hydra.presetHeaders) {
		hydra.presetHeaders.forEach((preset, index) => {
			if (preset.name) {
				lookup.presets[index] = {
					name: preset.name,
					preset: preset.preset,
					bank: preset.bank,
					bagIndex: preset.presetBagNdx,
				};
			}
		});
	}

	// Instrument names from hydra
	if (hydra && hydra.instruments) {
		hydra.instruments.forEach((instrument, index) => {
			if (instrument.name) {
				lookup.instruments[index] = {
					name: instrument.name,
					bagIndex: instrument.bagIndex,
				};
			}
		});
	}

	// Sample names from hydra
	if (hydra && hydra.sampleHeaders) {
		hydra.sampleHeaders.forEach((sample, index) => {
			if (sample.name) {
				lookup.samples[index] = {
					name: sample.name,
					sampleRate: sample.sampleRate,
					originalPitch: sample.originalPitch,
					pitchCorrection: sample.pitchCorrection,
					loopStart: sample.loopStart,
					loopEnd: sample.loopEnd,
					start: sample.start,
					end: sample.end,
				};
			}
		});
	}

	// Program names from presets (map preset number to name for each bank 0 preset)
	if (hydra && hydra.presetHeaders) {
		hydra.presetHeaders.forEach((preset) => {
			if (preset.bank === 0 && preset.preset < 128) {
				lookup.programs[preset.preset] = {
					name: preset.name,
					bank: preset.bank,
					presetIndex: hydra.presetHeaders.indexOf(preset),
				};
			}
		});
	}

	// Example current program (program 0)
	if (hydra && hydra.presetHeaders) {
		const preset = hydra.presetHeaders.find(
			(p) => p.preset === 0 && p.bank === 0
		);
		if (preset) {
			lookup.currentProgram = {
				number: 0,
				presetName: preset.name,
				bank: preset.bank,
				presetIndex: hydra.presetHeaders.indexOf(preset),
			};

			// Find instrument name
			if (hydra.presetBags && hydra.instruments && hydra.presetGens) {
				const bagStart = preset.presetBagNdx;
				const presetIndex = hydra.presetHeaders.indexOf(preset);
				const nextPreset = hydra.presetHeaders[presetIndex + 1];
				const bagEnd = nextPreset
					? nextPreset.presetBagNdx
					: hydra.presetBags.length;

				for (let bagIdx = bagStart; bagIdx < bagEnd; bagIdx++) {
					const bag = hydra.presetBags[bagIdx];
					if (!bag) continue;

					const genStart = bag.genIndex;
					const genEnd =
						bagIdx + 1 < hydra.presetBags.length
							? hydra.presetBags[bagIdx + 1].genIndex
							: hydra.presetGens.length;

					for (let genIdx = genStart; genIdx < genEnd; genIdx++) {
						const gen = hydra.presetGens[genIdx];
						if (gen && gen.oper === 41) {
							// instrument generator
							const instrument = hydra.instruments[gen.amount];
							if (instrument) {
								lookup.currentProgram.instrumentName =
									instrument.name;
								lookup.currentProgram.instrumentIndex =
									gen.amount;
							}
							break;
						}
					}
				}
			}
		}
	}

	// Output as JSON
	console.log('\n' + '='.repeat(80));
	console.log('COMPLETE LOOKUP TABLE (JSON)');
	console.log('='.repeat(80));
	console.log(JSON.stringify(lookup, null, 2));

	// Output summary
	console.log('\n' + '='.repeat(80));
	console.log('SUMMARY');
	console.log('='.repeat(80));
	console.log(`Total Presets: ${Object.keys(lookup.presets).length}`);
	console.log(`Total Instruments: ${Object.keys(lookup.instruments).length}`);
	console.log(`Total Samples: ${Object.keys(lookup.samples).length}`);
	console.log(`Total Programs: ${Object.keys(lookup.programs).length}`);

	// Show first 10 programs
	console.log('\n' + '='.repeat(80));
	console.log('FIRST 10 PROGRAMS');
	console.log('='.repeat(80));
	for (let i = 0; i < 10; i++) {
		if (lookup.programs[i]) {
			console.log(`Program ${i}: ${lookup.programs[i].name}`);
		}
	}

	// Current program info
	if (lookup.currentProgram) {
		console.log('\n' + '='.repeat(80));
		console.log('CURRENT PROGRAM (Program 0)');
		console.log('='.repeat(80));
		console.log(`  Preset Name: ${lookup.currentProgram.presetName}`);
		console.log(
			`  Instrument Name: ${
				lookup.currentProgram.instrumentName || 'N/A'
			}`
		);
		console.log(`  Bank: ${lookup.currentProgram.bank}`);
		console.log(`  Preset Index: ${lookup.currentProgram.presetIndex}`);
		if (lookup.currentProgram.instrumentIndex !== undefined) {
			console.log(
				`  Instrument Index: ${lookup.currentProgram.instrumentIndex}`
			);
		}
	}

	console.log('\n' + '='.repeat(80));
	console.log('✅ Lookup table generated successfully!');
	console.log('='.repeat(80));

	// Write to file for easy access
	const outputPath = path.join(__dirname, 'sf2-lookup-table.json');
	fs.writeFileSync(outputPath, JSON.stringify(lookup, null, 2));
	console.log(`\n📄 Lookup table saved to: ${outputPath}`);
}

// Run the test
generateLookupTable();
