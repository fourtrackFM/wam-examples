/**
 * Synth101 WAV Renderer with scheduleEvents
 *
 * This module demonstrates how to use the Synth101 WAM with OfflineAudioContext
 * to render MIDI sequences to WAV files using the scheduleEvents API.
 */

// Create WAM MIDI events in the correct format
export function createWamMidiEvent(type, note, velocity = 127, time = 0) {
	return {
		type: 'wam-midi',
		time: time,
		data: {
			bytes: [type, note, velocity],
		},
	};
}

// Convert a musical sequence to scheduled WAM events
export function createSequenceEvents(sequence) {
	const events = [];

	sequence.forEach(([startTime, midiNote, velocity, duration]) => {
		// Note ON event
		events.push(createWamMidiEvent(0x90, midiNote, velocity, startTime));

		// Note OFF event
		events.push(
			createWamMidiEvent(0x80, midiNote, 0, startTime + duration)
		);
	});

	// Sort events by time to ensure proper scheduling
	events.sort((a, b) => a.time - b.time);

	return events;
}

// Main rendering function
export async function renderSynth101ToWAV(options = {}) {
	const {
		duration = 10,
		sampleRate = 44100,
		numberOfChannels = 2,
		sequence = [],
		synthSettings = {},
		hostGroupId = 'offline-renderer',
	} = options;

	try {
		console.log('🎹 Starting Synth101 WAV rendering...');

		// Create offline audio context
		const offlineContext = new OfflineAudioContext({
			numberOfChannels,
			length: sampleRate * duration,
			sampleRate,
		});

		console.log(
			`📊 Context: ${sampleRate}Hz, ${numberOfChannels}ch, ${duration}s`
		);

		// Import WAM modules dynamically
		const { WebAudioModule } = await import('./dist/index.js');
		const { addFunctionModule, initializeWamEnv, initializeWamGroup } =
			await import('../sdk/dist/index.js');
		const { VERSION: apiVersion } = await import('../api/dist/index.js');

		console.log('🔧 Initializing WAM environment...');

		// Initialize WAM environment in offline context
		await addFunctionModule(
			offlineContext.audioWorklet,
			initializeWamEnv,
			apiVersion
		);

		// Create WAM group
		const hostGroupKey = performance.now().toString();
		await addFunctionModule(
			offlineContext.audioWorklet,
			initializeWamGroup,
			hostGroupId,
			hostGroupKey
		);

		console.log('🎛️ Creating Synth101 instance...');

		// Create synth instance
		const synthInstance = await WebAudioModule.createInstance(
			hostGroupId,
			offlineContext,
			{}
		);

		// Configure synth parameters
		if (Object.keys(synthSettings).length > 0) {
			console.log('⚙️ Applying synth settings...');
			await synthInstance.audioNode.setParameterValues(synthSettings);
		}

		// Enable the synth (WAMs are bypassed by default)
		await synthInstance.audioNode.setParameterValues({ enabled: true });

		// Connect synth to output
		synthInstance.audioNode.connect(offlineContext.destination);

		console.log('🎵 Scheduling MIDI events...');

		// Convert sequence to WAM events
		const events = createSequenceEvents(sequence);
		console.log(`   📅 Scheduling ${events.length} MIDI events`);

		// Schedule all events at once using scheduleEvents
		if (events.length > 0) {
			synthInstance.audioNode.scheduleEvents(...events);

			// Log first few events for debugging
			events.slice(0, 3).forEach((event, i) => {
				const [type, note, velocity] = event.data.bytes;
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
				const noteName =
					noteNames[note % 12] + Math.floor(note / 12 - 1);
				const eventType = type === 0x90 ? 'ON ' : 'OFF';
				console.log(
					`   📝 Event ${i + 1}: ${event.time.toFixed(
						2
					)}s - ${eventType} ${noteName} (vel:${velocity})`
				);
			});
			if (events.length > 3) {
				console.log(`   📝 ... and ${events.length - 3} more events`);
			}
		}

		console.log('🔄 Starting offline rendering...');
		const renderStartTime = performance.now();

		// Render audio
		const renderedBuffer = await offlineContext.startRendering();

		const renderTime = (performance.now() - renderStartTime) / 1000;
		console.log(`✅ Rendering complete in ${renderTime.toFixed(2)}s`);

		return renderedBuffer;
	} catch (error) {
		console.error('❌ Rendering failed:', error);
		throw error;
	}
}

// Convert AudioBuffer to WAV ArrayBuffer
export function audioBufferToWav(buffer) {
	const length = buffer.length;
	const numberOfChannels = buffer.numberOfChannels;
	const sampleRate = buffer.sampleRate;
	const bytesPerSample = 2; // 16-bit
	const blockAlign = numberOfChannels * bytesPerSample;
	const byteRate = sampleRate * blockAlign;
	const dataSize = length * blockAlign;

	const arrayBuffer = new ArrayBuffer(44 + dataSize);
	const view = new DataView(arrayBuffer);

	// Write WAV header
	const writeString = (offset, string) => {
		for (let i = 0; i < string.length; i++) {
			view.setUint8(offset + i, string.charCodeAt(i));
		}
	};

	writeString(0, 'RIFF'); // ChunkID
	view.setUint32(4, 36 + dataSize, true); // ChunkSize
	writeString(8, 'WAVE'); // Format
	writeString(12, 'fmt '); // Subchunk1ID
	view.setUint32(16, 16, true); // Subchunk1Size (PCM)
	view.setUint16(20, 1, true); // AudioFormat (PCM)
	view.setUint16(22, numberOfChannels, true); // NumChannels
	view.setUint32(24, sampleRate, true); // SampleRate
	view.setUint32(28, byteRate, true); // ByteRate
	view.setUint16(32, blockAlign, true); // BlockAlign
	view.setUint16(34, 16, true); // BitsPerSample
	writeString(36, 'data'); // Subchunk2ID
	view.setUint32(40, dataSize, true); // Subchunk2Size

	// Write audio data
	let offset = 44;
	for (let i = 0; i < length; i++) {
		for (let ch = 0; ch < numberOfChannels; ch++) {
			// Get sample and clamp to [-1, 1]
			let sample = buffer.getChannelData(ch)[i];
			sample = Math.max(-1, Math.min(1, sample));

			// Convert to 16-bit signed integer
			const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
			view.setInt16(offset, intSample, true);
			offset += 2;
		}
	}

	return arrayBuffer;
}

// Save WAV to file (Browser)
export function downloadWav(audioBuffer, filename = 'synth101_render.wav') {
	const wavBuffer = audioBufferToWav(audioBuffer);
	const blob = new Blob([wavBuffer], { type: 'audio/wav' });
	const url = URL.createObjectURL(blob);

	const a = document.createElement('a');
	a.href = url;
	a.download = filename;
	a.style.display = 'none';
	document.body.appendChild(a);
	a.click();
	document.body.removeChild(a);

	URL.revokeObjectURL(url);
}

// Example sequences
export const exampleSequences = {
	// Simple C major scale
	scale: [
		[0.0, 60, 127, 0.5], // C4
		[0.5, 62, 120, 0.5], // D4
		[1.0, 64, 110, 0.5], // E4
		[1.5, 65, 100, 0.5], // F4
		[2.0, 67, 90, 0.5], // G4
		[2.5, 69, 80, 0.5], // A4
		[3.0, 71, 70, 0.5], // B4
		[3.5, 72, 127, 1.0], // C5
	],

	// Chord progression
	chords: [
		// C major
		[0.0, 60, 127, 2.0],
		[0.0, 64, 100, 2.0],
		[0.0, 67, 100, 2.0],
		// F major
		[2.0, 65, 127, 2.0],
		[2.0, 69, 100, 2.0],
		[2.0, 72, 100, 2.0],
		// G major
		[4.0, 67, 127, 2.0],
		[4.0, 71, 100, 2.0],
		[4.0, 74, 100, 2.0],
		// C major
		[6.0, 60, 127, 2.0],
		[6.0, 64, 100, 2.0],
		[6.0, 67, 100, 2.0],
		[6.0, 72, 100, 2.0],
	],

	// Arpeggiated melody
	arpeggio: [
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
		[3.0, 60, 127, 1.0],
	],

	// Demo melody from the original
	demo: [
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
	],
};

// Example synth settings for different sounds
export const exampleSynthSettings = {
	// Lead sound
	lead: {
		waveform: 1, // Square wave
		filterFreq: 0.7, // Bright filter
		filterRes: 0.3, // Some resonance
		envAttack: 0.1,
		envDecay: 0.3,
		envSustain: 0.7,
		envRelease: 0.5,
	},

	// Pad sound
	pad: {
		waveform: 0, // Sine wave
		filterFreq: 0.4, // Darker filter
		filterRes: 0.1, // Low resonance
		envAttack: 1.0, // Slow attack
		envDecay: 0.5,
		envSustain: 0.8,
		envRelease: 2.0, // Long release
	},

	// Bass sound
	bass: {
		waveform: 2, // Sawtooth
		oscRange: 2, // Lower octave
		filterFreq: 0.3, // Low-pass
		filterRes: 0.4, // Punchy
		envAttack: 0.0,
		envDecay: 0.4,
		envSustain: 0.3,
		envRelease: 0.2,
	},
};

// Complete example usage function
export async function renderExample(
	sequenceName = 'demo',
	synthPreset = 'lead',
	duration = 10
) {
	const sequence = exampleSequences[sequenceName] || exampleSequences.demo;
	const synthSettings = exampleSynthSettings[synthPreset] || {};

	console.log(
		`🎼 Rendering "${sequenceName}" sequence with "${synthPreset}" preset`
	);

	const audioBuffer = await renderSynth101ToWAV({
		duration,
		sampleRate: 44100,
		sequence,
		synthSettings,
	});

	const filename = `synth101_${sequenceName}_${synthPreset}.wav`;
	downloadWav(audioBuffer, filename);

	return audioBuffer;
}
