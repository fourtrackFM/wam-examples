/**
 * SF2 parser to extract samples with proper root key and loop points
 * Based on SF2 specification
 */

/**
 * Parse SF2 file and extract instrument data for a program
 * @param {ArrayBuffer} arrayBuffer
 * @param {number} programNumber
 * @returns {Object} Parsed instrument data with samples
 */
export function parseSF2(arrayBuffer, programNumber = 0) {
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

	// Helper to read DWORD
	function readDWord() {
		const value = dataView.getUint32(offset, true);
		offset += 4;
		return value;
	}

	// Helper to read WORD
	function readWord() {
		const value = dataView.getUint16(offset, true);
		offset += 2;
		return value;
	}

	// Helper to read SHORT
	function readShort() {
		const value = dataView.getInt16(offset, true);
		offset += 2;
		return value;
	}

	// Helper to read BYTE
	function readByte() {
		return dataView.getUint8(offset++);
	}

	console.log(
		'[SF2Parser] Parsing SF2 file for program',
		programNumber,
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

	const chunks = {};
	let sampleDataStart = 0;
	let rawSampleData = null;

	// Parse chunks
	while (offset < arrayBuffer.byteLength - 8) {
		const chunkId = readString(4);
		const chunkSize = readDWord();
		const chunkStart = offset;

		if (chunkId === 'LIST') {
			const listType = readString(4);

			if (listType === 'sdta') {
				// Sample data
				chunks.sdta = { offset: chunkStart + 4, size: chunkSize - 4 };
			} else if (listType === 'pdta') {
				// Preset data
				chunks.pdta = { offset: chunkStart + 4, size: chunkSize - 4 };
			}
		}

		offset = chunkStart + chunkSize;
	}

	// Extract raw sample data
	if (chunks.sdta) {
		offset = chunks.sdta.offset;
		const endOffset = offset + chunks.sdta.size;
		while (offset < endOffset - 8) {
			const subChunkId = readString(4);
			const subChunkSize = readDWord();

			if (subChunkId === 'smpl') {
				sampleDataStart = offset;
				rawSampleData = new Int16Array(
					arrayBuffer,
					offset,
					subChunkSize / 2
				);
				console.log(
					'[SF2Parser] Found smpl chunk, samples:',
					rawSampleData.length
				);
				break;
			}
			offset += subChunkSize;
		}
	}

	// Parse sample headers (shdr)
	const sampleHeaders = [];
	if (chunks.pdta && rawSampleData) {
		offset = chunks.pdta.offset;
		const endOffset = offset + chunks.pdta.size;

		while (offset < endOffset - 8) {
			const subChunkId = readString(4);
			const subChunkSize = readDWord();

			if (subChunkId === 'shdr') {
				const numSamples = Math.floor(subChunkSize / 46); // Each sample header is 46 bytes
				console.log('[SF2Parser] Found', numSamples, 'sample headers');

				for (let i = 0; i < numSamples; i++) {
					const name = readString(20);
					const start = readDWord();
					const end = readDWord();
					const loopStart = readDWord();
					const loopEnd = readDWord();
					const sampleRate = readDWord();
					const originalPitch = readByte();
					const pitchCorrection = readByte(); // cents
					const sampleLink = readWord();
					const sampleType = readWord();

					if (sampleType !== 0x8000) {
						// Not EOS marker
						sampleHeaders.push({
							name,
							start,
							end,
							loopStart,
							loopEnd,
							sampleRate,
							originalPitch,
							pitchCorrection,
							sampleType,
						});
					}
				}
				break;
			}
			offset += subChunkSize;
		}
	}

	console.log('[SF2Parser] Parsed', sampleHeaders.length, 'valid samples');

	// For now, use the first valid sample
	// TODO: Parse presets and instruments to select the correct sample for the program
	let selectedSample = null;
	if (sampleHeaders.length > 0) {
		// Find first mono sample (type 1)
		selectedSample =
			sampleHeaders.find((s) => s.sampleType === 1) || sampleHeaders[0];
		console.log(
			'[SF2Parser] Selected sample:',
			selectedSample.name,
			'root key:',
			selectedSample.originalPitch
		);
	}

	return {
		sampleData: rawSampleData,
		sampleHeaders,
		selectedSample,
		sampleRate: selectedSample ? selectedSample.sampleRate : 44100,
		program: programNumber,
	};
}
