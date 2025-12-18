# Synth101 WAV Renderer with scheduleEvents

This project demonstrates how to render MIDI sequences to WAV files using the Synth101 WebAudioModule (WAM) with `OfflineAudioContext` and the `scheduleEvents` API.

## 🎯 Overview

The WAV renderer allows you to:

-   Load the Synth101 synthesizer in an offline audio context
-   Schedule MIDI events using the WAM `scheduleEvents` method
-   Render high-quality audio offline (faster than real-time)
-   Export the result as downloadable WAV files
-   Use different synthesizer presets and musical sequences

## 🚀 Quick Start

### Option 1: Interactive Browser Demo

1. Open `render-demo.html` in a modern web browser
2. Select a musical sequence (Scale, Chords, Arpeggio, or Demo)
3. Choose a synthesizer preset (Lead, Pad, or Bass)
4. Click "Render WAV" to generate and download the audio file

### Option 2: Programmatic Usage

```javascript
import {
	renderSynth101ToWAV,
	exampleSequences,
	exampleSynthSettings,
} from './wav-renderer.js';

// Render a sequence with specific settings
const audioBuffer = await renderSynth101ToWAV({
	duration: 10, // seconds
	sampleRate: 44100, // Hz
	sequence: exampleSequences.demo,
	synthSettings: exampleSynthSettings.lead,
});

// Download the result
downloadWav(audioBuffer, 'my_synth_track.wav');
```

## 📁 Files

-   **`render-demo.html`** - Interactive browser-based demo with UI
-   **`wav-renderer.js`** - Core rendering module with all functionality
-   **`render-synth101.js`** - Command-line Node.js script (structural example)
-   **`offline-render.html`** - Basic HTML example without fancy UI

## 🎵 How scheduleEvents Works

The `scheduleEvents` method is the key to this system. Here's how it works:

### 1. Create WAM MIDI Events

```javascript
function createWamMidiEvent(type, note, velocity = 127, time = 0) {
	return {
		type: 'wam-midi',
		time: time, // When to trigger (seconds)
		data: {
			bytes: [type, note, velocity], // MIDI message
		},
	};
}
```

### 2. Schedule Note Events

```javascript
// Note ON at 1.0 seconds
const noteOn = createWamMidiEvent(0x90, 60, 127, 1.0); // C4

// Note OFF at 2.0 seconds
const noteOff = createWamMidiEvent(0x80, 60, 0, 2.0);

// Schedule both events
synthInstance.audioNode.scheduleEvents(noteOn, noteOff);
```

### 3. Offline Rendering Process

```javascript
// Create offline context
const offlineContext = new OfflineAudioContext({
	numberOfChannels: 2,
	length: sampleRate * duration,
	sampleRate: sampleRate,
});

// Initialize WAM in offline context
const wam = await initializeWAM(offlineContext);

// Connect audio graph
wam.audioNode.connect(offlineContext.destination);

// Schedule all events at once
wam.audioNode.scheduleEvents(...allMidiEvents);

// Render audio
const audioBuffer = await offlineContext.startRendering();
```

## 🎼 Musical Sequences Format

Sequences are arrays of note events in this format:

```javascript
[startTime, midiNote, velocity, duration];
```

Example:

```javascript
const sequence = [
	[0.0, 60, 127, 0.5], // C4 at 0s, velocity 127, duration 0.5s
	[0.5, 64, 100, 0.5], // E4 at 0.5s, velocity 100, duration 0.5s
	[1.0, 67, 100, 1.0], // G4 at 1s, velocity 100, duration 1s
];
```

### Available Sequences

-   **`scale`** - C major scale
-   **`chords`** - Chord progression (C-F-G-C)
-   **`arpeggio`** - Arpeggiated patterns
-   **`demo`** - Complex melody demonstrating various features

## 🎛️ Synthesizer Presets

The Synth101 supports various parameters that can be set via the `synthSettings` object:

### Available Presets

-   **`lead`** - Bright square wave lead sound
-   **`pad`** - Soft sine wave pad with slow attack
-   **`bass`** - Punchy sawtooth bass in lower octave

### Custom Settings

```javascript
const customSettings = {
	waveform: 1, // 0=sine, 1=square, 2=sawtooth, 3=triangle
	filterFreq: 0.7, // 0-1 (filter cutoff)
	filterRes: 0.3, // 0-1 (resonance)
	envAttack: 0.1, // seconds
	envDecay: 0.3, // seconds
	envSustain: 0.7, // 0-1 level
	envRelease: 0.5, // seconds
	oscRange: 0, // 0=32', 1=16', 2=8', 3=4'
	mixerSaw: 1.0, // 0-1 level
	mixerPulse: 0.5, // 0-1 level
	// ... see Synth101 documentation for all parameters
};
```

## ⚡ Performance Notes

-   **Offline Rendering**: Renders faster than real-time (usually 2-10x speed)
-   **Memory Usage**: Large sample rates and long durations use more memory
-   **Browser Compatibility**: Requires modern browsers with OfflineAudioContext support

## 🔧 Technical Details

### WAM Environment Initialization

```javascript
// Initialize WAM environment
await addFunctionModule(
	audioContext.audioWorklet,
	initializeWamEnv,
	apiVersion
);

// Create WAM group for isolation
await addFunctionModule(
	audioContext.audioWorklet,
	initializeWamGroup,
	groupId,
	groupKey
);

// Create synth instance
const synthInstance = await WebAudioModule.createInstance(
	groupId,
	audioContext,
	{}
);

// Enable the synth (bypassed by default)
await synthInstance.audioNode.setParameterValues({ enabled: true });
```

### Event Scheduling

The `scheduleEvents` method accepts multiple events and schedules them based on their `time` property relative to `AudioContext.currentTime`. In an offline context, this allows precise timing control.

### WAV Export

The renderer converts the resulting `AudioBuffer` to a standard WAV file format:

-   16-bit PCM encoding
-   Proper WAV headers
-   Support for mono/stereo output
-   Browser download integration

## 🛠️ Development

### Requirements

-   Modern browser with Web Audio API support
-   The Synth101 WAM module (built and available)
-   WAM SDK modules

### Building Synth101

```bash
# In the synth101 package directory
npm install
npm run build
```

### Testing

1. Start a local HTTP server in the synth101 directory
2. Open `render-demo.html` in your browser
3. Try rendering different sequences and presets

## 📝 Examples

### Simple Scale Rendering

```javascript
import { renderSynth101ToWAV, downloadWav } from './wav-renderer.js';

const scaleSequence = [
	[0.0, 60, 127, 0.5], // C4
	[0.5, 62, 120, 0.5], // D4
	[1.0, 64, 110, 0.5], // E4
	[1.5, 65, 100, 0.5], // F4
	[2.0, 67, 90, 0.5], // G4
	[2.5, 69, 80, 0.5], // A4
	[3.0, 71, 70, 0.5], // B4
	[3.5, 72, 127, 1.0], // C5
];

const audioBuffer = await renderSynth101ToWAV({
	duration: 5,
	sampleRate: 44100,
	sequence: scaleSequence,
	synthSettings: { waveform: 0 }, // sine wave
});

downloadWav(audioBuffer, 'c_major_scale.wav');
```

### Chord Progression

```javascript
const chordProgression = [
	// C major chord
	[0.0, 60, 127, 2.0],
	[0.0, 64, 100, 2.0],
	[0.0, 67, 100, 2.0],
	// F major chord
	[2.0, 65, 127, 2.0],
	[2.0, 69, 100, 2.0],
	[2.0, 72, 100, 2.0],
	// G major chord
	[4.0, 67, 127, 2.0],
	[4.0, 71, 100, 2.0],
	[4.0, 74, 100, 2.0],
	// C major chord (final)
	[6.0, 60, 127, 2.0],
	[6.0, 64, 100, 2.0],
	[6.0, 67, 100, 2.0],
];

await renderSynth101ToWAV({
	duration: 8,
	sequence: chordProgression,
	synthSettings: {
		waveform: 1, // square wave
		envAttack: 0.5, // slower attack for pads
		envRelease: 1.0, // longer release
	},
});
```

## 🤝 Contributing

Feel free to extend this system with:

-   More complex MIDI sequences
-   Additional synthesizer presets
-   Real-time parameter automation
-   Integration with other WAM modules
-   MIDI file import/export

## 📄 License

This code is provided as an example for the WAM community. See the main project license for details.

---

**Happy rendering! 🎵🎹**
