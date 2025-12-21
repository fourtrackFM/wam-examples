/**
 * Example: How to access SF2 debug data from browser console
 *
 * This file demonstrates how to access all the SoundFont chunk data
 * (presets, instruments, modulators, generators, samples) through
 * the WAM plugin's getParameterValues() method.
 */

// ====================
// BASIC USAGE
// ====================

// Assuming you have a wamNode instance:
async function getDebugData(wamNode) {
	const params = await wamNode.getParameterValues();
	const debugData = JSON.parse(params.sf2_debug_info.value);
	return debugData;
}

// ====================
// PRESET INFORMATION
// ====================

async function listAllPresets(wamNode) {
	const debug = await getDebugData(wamNode);
	const presets = debug.hydra.presetHeaders;

	console.log('=== All Presets ===');
	for (let i = 0; i < presets.length - 1; i++) {
		// Skip terminal
		const p = presets[i];
		console.log(
			`Program ${p.preset.toString().padStart(3)}, Bank ${p.bank}: ${
				p.name
			}`
		);
	}

	return presets;
}

async function getPresetDetails(wamNode, programNumber = 0) {
	const debug = await getDebugData(wamNode);
	const preset = debug.hydra.presetHeaders.find(
		(p) => p.preset === programNumber
	);

	if (!preset) {
		console.error(`Preset ${programNumber} not found`);
		return null;
	}

	console.log('=== Preset Details ===');
	console.log('Name:', preset.name);
	console.log('Program:', preset.preset);
	console.log('Bank:', preset.bank);
	console.log('Bag Index:', preset.bagIndex);

	return preset;
}

// ====================
// INSTRUMENT INFORMATION
// ====================

async function listAllInstruments(wamNode) {
	const debug = await getDebugData(wamNode);
	const instruments = debug.hydra.instruments;

	console.log('=== All Instruments ===');
	for (let i = 0; i < instruments.length - 1; i++) {
		// Skip terminal
		const inst = instruments[i];
		console.log(`[${i}] ${inst.name}`);
	}

	return instruments;
}

async function getInstrumentForPreset(wamNode, programNumber = 0) {
	const debug = await getDebugData(wamNode);

	// Find preset
	const presetIdx = debug.hydra.presetHeaders.findIndex(
		(p) => p.preset === programNumber
	);
	if (presetIdx === -1) return null;

	const preset = debug.hydra.presetHeaders[presetIdx];
	const nextBagIdx = debug.hydra.presetHeaders[presetIdx + 1].bagIndex;

	// Get preset zones (bags)
	const presetBags = debug.hydra.presetBags.slice(
		preset.bagIndex,
		nextBagIdx
	);

	// Find instrument generator (oper = 41)
	let instrumentId = null;
	for (const bag of presetBags) {
		const nextGenIdx =
			presetBags.indexOf(bag) + 1 < presetBags.length
				? presetBags[presetBags.indexOf(bag) + 1].genIndex
				: debug.hydra.presetGens.length;
		const gens = debug.hydra.presetGens.slice(bag.genIndex, nextGenIdx);

		const instGen = gens.find((g) => g.oper === 41);
		if (instGen) {
			instrumentId = instGen.amount;
			break;
		}
	}

	if (instrumentId === null) return null;

	const instrument = debug.hydra.instruments[instrumentId];
	console.log('=== Instrument for Preset', programNumber, '===');
	console.log('ID:', instrumentId);
	console.log('Name:', instrument.name);
	console.log('Bag Index:', instrument.bagIndex);

	return { id: instrumentId, ...instrument };
}

// ====================
// SAMPLE INFORMATION
// ====================

async function listAllSamples(wamNode) {
	const debug = await getDebugData(wamNode);
	const samples = debug.hydra.sampleHeaders;

	console.log('=== All Samples ===');
	samples.forEach((sample, idx) => {
		const lengthInSamples = sample.end - sample.start;
		const lengthInSeconds = lengthInSamples / sample.sampleRate;
		const hasLoop = sample.loopStart !== sample.loopEnd;

		console.log(`[${idx}] ${sample.name}`);
		console.log(
			`  Rate: ${sample.sampleRate}Hz, Length: ${lengthInSeconds.toFixed(
				2
			)}s`
		);
		console.log(
			`  Original Pitch: MIDI ${
				sample.originalPitch
			} (${getNoteNameFromMidi(sample.originalPitch)})`
		);
		console.log(
			`  Loop: ${hasLoop ? 'Yes' : 'No'}${
				hasLoop ? ` (${sample.loopStart} - ${sample.loopEnd})` : ''
			}`
		);
	});

	return samples;
}

async function getSamplesForPreset(wamNode, programNumber = 0) {
	const debug = await getDebugData(wamNode);
	const instrument = await getInstrumentForPreset(wamNode, programNumber);

	if (!instrument) {
		console.error('No instrument found for preset', programNumber);
		return [];
	}

	const nextInstBagIdx =
		instrument.id + 1 < debug.hydra.instruments.length
			? debug.hydra.instruments[instrument.id + 1].bagIndex
			: debug.hydra.instrumentBags.length;

	const instrumentBags = debug.hydra.instrumentBags.slice(
		instrument.bagIndex,
		nextInstBagIdx
	);

	const samples = [];
	console.log('=== Samples for Preset', programNumber, '===');

	instrumentBags.forEach((bag, bagIdx) => {
		const nextGenIdx =
			bagIdx + 1 < instrumentBags.length
				? instrumentBags[bagIdx + 1].genIndex
				: debug.hydra.instrumentGens.length;
		const gens = debug.hydra.instrumentGens.slice(bag.genIndex, nextGenIdx);

		// Find sample ID (oper = 53)
		const sampleGen = gens.find((g) => g.oper === 53);
		if (sampleGen) {
			const sample = debug.hydra.sampleHeaders[sampleGen.amount];

			// Find key range (oper = 43)
			const keyRangeGen = gens.find((g) => g.oper === 43);
			let keyRange = { lo: 0, hi: 127 };
			if (keyRangeGen) {
				keyRange = {
					lo: keyRangeGen.amount & 0xff,
					hi: (keyRangeGen.amount >> 8) & 0xff,
				};
			}

			// Find velocity range (oper = 44)
			const velRangeGen = gens.find((g) => g.oper === 44);
			let velRange = { lo: 0, hi: 127 };
			if (velRangeGen) {
				velRange = {
					lo: velRangeGen.amount & 0xff,
					hi: (velRangeGen.amount >> 8) & 0xff,
				};
			}

			console.log(`Zone ${bagIdx}:`);
			console.log(`  Sample: ${sample.name}`);
			console.log(
				`  Key Range: ${keyRange.lo}-${
					keyRange.hi
				} (${getNoteNameFromMidi(keyRange.lo)}-${getNoteNameFromMidi(
					keyRange.hi
				)})`
			);
			console.log(`  Velocity Range: ${velRange.lo}-${velRange.hi}`);

			samples.push({ sample, keyRange, velRange });
		}
	});

	return samples;
}

// ====================
// GENERATOR INFORMATION
// ====================

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

async function analyzeGenerators(wamNode) {
	const debug = await getDebugData(wamNode);

	console.log('=== Generator Analysis ===');
	console.log('Preset Generators:', debug.hydra.presetGens.length);
	console.log('Instrument Generators:', debug.hydra.instrumentGens.length);

	// Count usage of each generator type
	const presetGenCounts = {};
	const instGenCounts = {};

	debug.hydra.presetGens.forEach((g) => {
		presetGenCounts[g.oper] = (presetGenCounts[g.oper] || 0) + 1;
	});

	debug.hydra.instrumentGens.forEach((g) => {
		instGenCounts[g.oper] = (instGenCounts[g.oper] || 0) + 1;
	});

	console.log('\\nPreset Generator Usage:');
	Object.entries(presetGenCounts).forEach(([oper, count]) => {
		const name = GENERATOR_NAMES[oper] || `Unknown(${oper})`;
		console.log(`  ${name}: ${count}`);
	});

	console.log('\\nInstrument Generator Usage:');
	Object.entries(instGenCounts).forEach(([oper, count]) => {
		const name = GENERATOR_NAMES[oper] || `Unknown(${oper})`;
		console.log(`  ${name}: ${count}`);
	});
}

// ====================
// MODULATOR INFORMATION
// ====================

async function analyzeModulators(wamNode) {
	const debug = await getDebugData(wamNode);

	console.log('=== Modulator Analysis ===');
	console.log('Preset Modulators:', debug.hydra.presetMods.length);
	console.log('Instrument Modulators:', debug.hydra.instrumentMods.length);

	if (debug.hydra.presetMods.length > 0) {
		console.log('\\nFirst Preset Modulator:');
		const mod = debug.hydra.presetMods[0];
		console.log('  Source Operator:', mod.srcOper);
		console.log(
			'  Dest Operator:',
			mod.destOper,
			`(${GENERATOR_NAMES[mod.destOper] || 'Unknown'})`
		);
		console.log('  Amount:', mod.amount);
		console.log('  Amount Source:', mod.amtSrcOper);
		console.log('  Transform:', mod.transOper);
	}

	if (debug.hydra.instrumentMods.length > 0) {
		console.log('\\nFirst Instrument Modulator:');
		const mod = debug.hydra.instrumentMods[0];
		console.log('  Source Operator:', mod.srcOper);
		console.log(
			'  Dest Operator:',
			mod.destOper,
			`(${GENERATOR_NAMES[mod.destOper] || 'Unknown'})`
		);
		console.log('  Amount:', mod.amount);
		console.log('  Amount Source:', mod.amtSrcOper);
		console.log('  Transform:', mod.transOper);
	}
}

// ====================
// COMPLETE ANALYSIS
// ====================

async function analyzeEverything(wamNode) {
	console.log('\\n========================================');
	console.log('  COMPLETE SF2 STRUCTURE ANALYSIS');
	console.log('========================================\\n');

	const debug = await getDebugData(wamNode);

	console.log('CHUNK SIZES:');
	console.log('  Preset Headers:', debug.hydra.presetHeaders.length);
	console.log('  Preset Bags:', debug.hydra.presetBags.length);
	console.log('  Preset Modulators:', debug.hydra.presetMods.length);
	console.log('  Preset Generators:', debug.hydra.presetGens.length);
	console.log('  Instruments:', debug.hydra.instruments.length);
	console.log('  Instrument Bags:', debug.hydra.instrumentBags.length);
	console.log('  Instrument Modulators:', debug.hydra.instrumentMods.length);
	console.log('  Instrument Generators:', debug.hydra.instrumentGens.length);
	console.log('  Sample Headers:', debug.hydra.sampleHeaders.length);

	console.log('\\nPARSED PROGRAMS:');
	console.log('  Total Programs Loaded:', debug.programs.length);
	console.log('  Current Program:', debug.currentProgram);

	console.log('\\n');
	await listAllPresets(wamNode);

	console.log('\\n');
	await analyzeGenerators(wamNode);

	console.log('\\n');
	await analyzeModulators(wamNode);

	console.log('\\n========================================\\n');

	return debug;
}

// ====================
// HELPER FUNCTIONS
// ====================

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

// ====================
// EXPORT ALL FUNCTIONS
// ====================

// In browser console, you can use:
// window.sf2Debug = { ... all functions ... }

if (typeof window !== 'undefined') {
	window.sf2Debug = {
		getDebugData,
		listAllPresets,
		getPresetDetails,
		listAllInstruments,
		getInstrumentForPreset,
		listAllSamples,
		getSamplesForPreset,
		analyzeGenerators,
		analyzeModulators,
		analyzeEverything,
		getNoteNameFromMidi,
		GENERATOR_NAMES,
	};

	console.log('SF2 Debug utilities loaded! Available functions:');
	console.log('  sf2Debug.analyzeEverything(wamNode) - Complete analysis');
	console.log('  sf2Debug.listAllPresets(wamNode)');
	console.log('  sf2Debug.listAllInstruments(wamNode)');
	console.log('  sf2Debug.listAllSamples(wamNode)');
	console.log('  sf2Debug.getSamplesForPreset(wamNode, programNum)');
	console.log('  sf2Debug.analyzeGenerators(wamNode)');
	console.log('  sf2Debug.analyzeModulators(wamNode)');
}
