#!/usr/bin/env node

/**
 * Synth101 WAV Renderer - Node.js Version
 *
 * This script demonstrates how to render MIDI sequences to WAV files
 * using the Synth101 WAM with OfflineAudioContext and scheduleEvents.
 *
 * Usage: node render-synth101.js [options]
 *
 * Options:
 *   --duration <seconds>    Render duration (default: 10)
 *   --samplerate <rate>     Sample rate (default: 44100)
 *   --bpm <beats>          BPM for sequence timing (default: 120)
 *   --output <filename>     Output filename (default: synth101_render.wav)
 *   --sequence <file>       JSON file with MIDI sequence (optional)
 */

import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Default MIDI sequence
const defaultSequence = [
	[0.0, 60, 127, 0.5], // C4 at start
	[0.5, 64, 100, 0.5], // E4
	[1.0, 67, 100, 0.5], // G4
	[1.5, 72, 100, 1.0], // C5
	[3.0, 60, 127, 0.25], // C4 quick
	[3.25, 62, 120, 0.25], // D4 quick
	[3.5, 64, 110, 0.25], // E4 quick
	[3.75, 65, 100, 0.25], // F4 quick
	[4.0, 67, 127, 2.0], // G4 long
	[6.0, 69, 100, 0.5], // A4
	[6.5, 71, 100, 0.5], // B4
	[7.0, 72, 120, 1.0], // C5
	[8.0, 76, 100, 0.5], // E5
	[8.5, 79, 100, 0.5], // G5
	[9.0, 84, 127, 1.0], // C6
];

// Parse command line arguments
function parseArgs() {
	const args = process.argv.slice(2);
	const options = {
		duration: 10,
		sampleRate: 44100,
		bpm: 120,
		output: 'synth101_render.wav',
		sequence: null,
	};

	for (let i = 0; i < args.length; i++) {
		switch (args[i]) {
			case '--duration':
				options.duration = parseFloat(args[++i]);
				break;
			case '--samplerate':
				options.sampleRate = parseInt(args[++i]);
				break;
			case '--bpm':
				options.bpm = parseInt(args[++i]);
				break;
			case '--output':
				options.output = args[++i];
				break;
			case '--sequence':
				options.sequence = args[++i];
				break;
			case '--help':
				console.log(`
Synth101 WAV Renderer

Usage: node render-synth101.js [options]

Options:
  --duration <seconds>    Render duration (default: ${options.duration})
  --samplerate <rate>     Sample rate (default: ${options.sampleRate})
  --bpm <beats>          BPM for sequence timing (default: ${options.bpm})
  --output <filename>     Output filename (default: ${options.output})
  --sequence <file>       JSON file with MIDI sequence (optional)
  --help                 Show this help

Sequence Format:
  JSON array of [time, note, velocity, duration] arrays
  Example: [[0.0, 60, 127, 0.5], [1.0, 64, 100, 1.0]]
                `);
				process.exit(0);
			default:
				console.error(`Unknown option: ${args[i]}`);
				process.exit(1);
		}
	}

	return options;
}

// Create WAM MIDI event
function createMIDIEvent(type, note, velocity = 127, time = 0) {
	return {
		type: 'wam-midi',
		time: time,
		data: {
			bytes: [type, note, velocity],
		},
	};
}

// Convert MIDI sequence to WAM events
function sequenceToWamEvents(sequence, bpm) {
	const events = [];

	sequence.forEach(([time, note, velocity, duration]) => {
		// Note on event
		events.push(createMIDIEvent(0x90, note, velocity, time));

		// Note off event
		events.push(createMIDIEvent(0x80, note, 0, time + duration));
	});

	// Sort events by time
	events.sort((a, b) => a.time - b.time);

	return events;
}

// Convert AudioBuffer to WAV buffer
function audioBufferToWav(buffer) {
	const length = buffer.length;
	const numberOfChannels = buffer.numberOfChannels;
	const sampleRate = buffer.sampleRate;

	// WAV header
	const arrayBuffer = new ArrayBuffer(44 + length * numberOfChannels * 2);
	const view = new DataView(arrayBuffer);

	// WAV header helpers
	const writeString = (offset, string) => {
		for (let i = 0; i < string.length; i++) {
			view.setUint8(offset + i, string.charCodeAt(i));
		}
	};

	writeString(0, 'RIFF');
	view.setUint32(4, 36 + length * numberOfChannels * 2, true);
	writeString(8, 'WAVE');
	writeString(12, 'fmt ');
	view.setUint32(16, 16, true);
	view.setUint16(20, 1, true);
	view.setUint16(22, numberOfChannels, true);
	view.setUint32(24, sampleRate, true);
	view.setUint32(28, sampleRate * numberOfChannels * 2, true);
	view.setUint16(32, numberOfChannels * 2, true);
	view.setUint16(34, 16, true);
	writeString(36, 'data');
	view.setUint32(40, length * numberOfChannels * 2, true);

	// Convert float samples to 16-bit PCM
	let offset = 44;
	for (let i = 0; i < length; i++) {
		for (let ch = 0; ch < numberOfChannels; ch++) {
			const sample = Math.max(
				-1,
				Math.min(1, buffer.getChannelData(ch)[i])
			);
			view.setInt16(offset, sample * 0x7fff, true);
			offset += 2;
		}
	}

	return new Uint8Array(arrayBuffer);
}

// Main rendering function
async function renderSynth101(options) {
	try {
		console.log('🎹 Synth101 WAV Renderer');
		console.log('========================');
		console.log(`Duration: ${options.duration}s`);
		console.log(`Sample Rate: ${options.sampleRate} Hz`);
		console.log(`BPM: ${options.bpm}`);
		console.log(`Output: ${options.output}`);
		console.log('');

		// Load sequence
		let sequence = defaultSequence;
		if (options.sequence) {
			console.log(`Loading sequence from: ${options.sequence}`);
			const sequenceData = fs.readFileSync(options.sequence, 'utf8');
			sequence = JSON.parse(sequenceData);
		} else {
			console.log('Using default sequence');
		}

		console.log(`Sequence contains ${sequence.length} note events`);
		console.log('');

		// Note: In a real Node.js environment, you would need to set up
		// the Web Audio API polyfill and import the actual WAM modules.
		// For demonstration purposes, this shows the structure.

		console.log(
			'⚠️  Note: This script requires a Web Audio API environment.'
		);
		console.log('For actual rendering, run the HTML version in a browser');
		console.log(
			'or use a Node.js Web Audio API polyfill like web-audio-api.'
		);
		console.log('');

		// Pseudo-code for the rendering process:
		console.log('Rendering process would be:');
		console.log('1. Create OfflineAudioContext');
		console.log('2. Initialize WAM environment');
		console.log('3. Load Synth101 WAM');
		console.log(
			'4. Schedule MIDI events using wam.audioNode.scheduleEvents()'
		);
		console.log('5. Start rendering with offlineContext.startRendering()');
		console.log('6. Convert AudioBuffer to WAV');
		console.log('7. Save to file');
		console.log('');

		// Convert sequence to events for demonstration
		const events = sequenceToWamEvents(sequence, options.bpm);
		console.log(`Generated ${events.length} WAM events:`);
		events.slice(0, 5).forEach((event, i) => {
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
			const note = event.data.bytes[1];
			const noteName = noteNames[note % 12] + Math.floor(note / 12 - 1);
			const eventType = event.data.bytes[0] === 0x90 ? 'ON ' : 'OFF';
			console.log(
				`  ${i + 1}. ${event.time.toFixed(
					2
				)}s: ${eventType} ${noteName} (${note}) vel=${
					event.data.bytes[2]
				}`
			);
		});
		if (events.length > 5) {
			console.log(`  ... and ${events.length - 5} more events`);
		}

		console.log('');
		console.log('✅ Sequence processed successfully!');
		console.log(
			'💡 To actually render, use the HTML version in a browser.'
		);
	} catch (error) {
		console.error('❌ Error:', error.message);
		process.exit(1);
	}
}

// Example sequence files generator
function generateExampleSequences() {
	const sequences = {
		'simple-scale.json': [
			[0.0, 60, 127, 0.5], // C4
			[0.5, 62, 120, 0.5], // D4
			[1.0, 64, 110, 0.5], // E4
			[1.5, 65, 100, 0.5], // F4
			[2.0, 67, 90, 0.5], // G4
			[2.5, 69, 80, 0.5], // A4
			[3.0, 71, 70, 0.5], // B4
			[3.5, 72, 127, 1.0], // C5
		],
		'chord-progression.json': [
			// C major chord
			[0.0, 60, 127, 2.0], // C4
			[0.0, 64, 100, 2.0], // E4
			[0.0, 67, 100, 2.0], // G4
			// F major chord
			[2.0, 65, 127, 2.0], // F4
			[2.0, 69, 100, 2.0], // A4
			[2.0, 72, 100, 2.0], // C5
			// G major chord
			[4.0, 67, 127, 2.0], // G4
			[4.0, 71, 100, 2.0], // B4
			[4.0, 74, 100, 2.0], // D5
			// C major chord (final)
			[6.0, 60, 127, 2.0], // C4
			[6.0, 64, 100, 2.0], // E4
			[6.0, 67, 100, 2.0], // G4
			[6.0, 72, 100, 2.0], // C5
		],
		'arpeggio.json': [
			[0.0, 60, 127, 0.25],
			[0.25, 64, 120, 0.25],
			[0.5, 67, 110, 0.25],
			[0.75, 72, 100, 0.25],
			[1.0, 65, 127, 0.25],
			[1.25, 69, 120, 0.25],
			[1.5, 72, 110, 0.25],
			[1.75, 77, 100, 0.25],
			[2.0, 67, 127, 0.25],
			[2.25, 71, 120, 0.25],
			[2.5, 74, 110, 0.25],
			[2.75, 79, 100, 0.25],
			[3.0, 60, 127, 0.25],
			[3.25, 64, 120, 0.25],
			[3.5, 67, 110, 0.25],
			[3.75, 72, 100, 1.25],
		],
	};

	console.log('📝 Generating example sequence files...');

	Object.entries(sequences).forEach(([filename, sequence]) => {
		fs.writeFileSync(filename, JSON.stringify(sequence, null, 2));
		console.log(`   Created: ${filename}`);
	});

	console.log('');
	console.log('Example usage:');
	console.log(
		`   node render-synth101.js --sequence simple-scale.json --duration 5`
	);
	console.log(
		`   node render-synth101.js --sequence chord-progression.json --duration 8`
	);
	console.log(
		`   node render-synth101.js --sequence arpeggio.json --duration 5`
	);
}

// Main execution
if (process.argv.includes('--generate-examples')) {
	generateExampleSequences();
} else {
	const options = parseArgs();
	renderSynth101(options);
}
