// This file will generate a simple sine wave sample using the Web Audio API
// You would run this in a browser to generate and download a sample.mp3 file
// Replace this with a real audio sample file for your project.

function generateSampleWave() {
	const audioContext = new AudioContext();
	const duration = 2; // 2 seconds
	const sampleRate = audioContext.sampleRate;
	const buffer = audioContext.createBuffer(
		2,
		sampleRate * duration,
		sampleRate
	);

	// Generate a simple sine wave at 440Hz (A4)
	for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
		const channelData = buffer.getChannelData(channel);
		for (let i = 0; i < channelData.length; i++) {
			// Sine wave at 440Hz
			channelData[i] = Math.sin((2 * Math.PI * 440 * i) / sampleRate);

			// Apply a simple envelope to avoid clicks at start/end
			const fadeTime = 0.1; // 100ms fade in/out
			const fadeSamples = fadeTime * sampleRate;
			if (i < fadeSamples) {
				// Fade in
				channelData[i] *= i / fadeSamples;
			} else if (i > channelData.length - fadeSamples) {
				// Fade out
				channelData[i] *= (channelData.length - i) / fadeSamples;
			}
		}
	}

	// Convert to an audio file and trigger download
	const audioData = bufferToWave(buffer, buffer.length);
	const blob = new Blob([audioData], { type: 'audio/wav' });
	const url = URL.createObjectURL(blob);

	const a = document.createElement('a');
	a.download = 'sample.wav';
	a.href = url;
	a.click();
	URL.revokeObjectURL(url);
}

// Convert AudioBuffer to WAV format
function bufferToWave(buffer, len) {
	const numOfChan = buffer.numberOfChannels;
	const length = len * numOfChan * 2 + 44;
	const data = new Uint8Array(length);
	const view = new DataView(data.buffer);

	// RIFF chunk descriptor
	writeUTFBytes(view, 0, 'RIFF');
	view.setUint32(4, length - 8, true);
	writeUTFBytes(view, 8, 'WAVE');

	// FMT sub-chunk
	writeUTFBytes(view, 12, 'fmt ');
	view.setUint32(16, 16, true); // size of the fmt chunk
	view.setUint16(20, 1, true); // audio format (1 is PCM)
	view.setUint16(22, numOfChan, true); // number of channels
	view.setUint32(24, buffer.sampleRate, true); // sample rate
	view.setUint32(28, buffer.sampleRate * 2 * numOfChan, true); // byte rate
	view.setUint16(32, numOfChan * 2, true); // block align
	view.setUint16(34, 16, true); // bits per sample

	// Data sub-chunk
	writeUTFBytes(view, 36, 'data');
	view.setUint32(40, len * numOfChan * 2, true);

	// Write the PCM samples
	const offset = 44;
	let pos = 0;
	for (let i = 0; i < len; i++) {
		for (let ch = 0; ch < numOfChan; ch++) {
			const sample = Math.max(
				-1,
				Math.min(1, buffer.getChannelData(ch)[i])
			);
			const int16 = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
			view.setInt16(offset + pos, int16, true);
			pos += 2;
		}
	}

	return data;
}

function writeUTFBytes(view, offset, string) {
	for (let i = 0; i < string.length; i++) {
		view.setUint8(offset + i, string.charCodeAt(i));
	}
}

// Call this function to generate and download the sample
generateSampleWave();
