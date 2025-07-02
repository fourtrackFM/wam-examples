# WAM Sampler Plugin

This plugin implements a simple audio sample player instrument as a WebAudio Module (WAM). It loads audio samples through a shared array buffer and allows them to be triggered via MIDI notes.

## Features

-   Loads audio samples via a shared array buffer
-   Responds to MIDI note on/off messages
-   Adjustable playback rate with pitch-shifting based on MIDI note
-   Loop support with adjustable loop points
-   Gain control

## Implementation

The sampler consists of three main components:

1. **SamplerProcessor.ts**: An AudioWorkletProcessor that plays audio samples and responds to MIDI messages
2. **SamplerNode.ts**: A WAM-compatible node that interfaces with the AudioWorkletProcessor
3. **index.tsx**: The main WebAudioModule implementation

## Usage

### Loading Samples

By default, the sampler attempts to load a sample from `sample.mp3` in the plugin's directory. You can load your own samples programmatically:

```javascript
// Obtain a reference to the plugin instance
const samplerInstance = await Sampler.createInstance(audioContext);

// Load a sample from a URL
await samplerInstance.audioNode.loadSample('path/to/your/sample.mp3');
```

### MIDI Playback

Once a sample is loaded, you can trigger it by sending MIDI note on/off messages to the plugin. The sampler will adjust the pitch based on the MIDI note number (with middle C/MIDI note 60 being the reference pitch).

### Parameters

The sampler has the following adjustable parameters:

-   **gain**: Overall output level (0-2)
-   **playbackRate**: Base playback speed multiplier (0.25-4)
-   **loop**: Enable/disable sample looping (0 or 1)
-   **loopStart**: Loop start point in samples (0-max sample length)
-   **loopEnd**: Loop end point in samples (0-max sample length)

## Development

To generate a test sample, open the `generateSample.js` file in a browser. This will create a simple sine wave sample that you can use for testing.

## Building

The sampler can be built using the standard WAM build process:

```bash
yarn build:sampler
```
