/**
 * Simple SF2 parser to extract samples for a given program
 * Based on SF2 specification
 */

/**
 * Parse SF2 file and extract samples for a program
 * @param {ArrayBuffer} arrayBuffer
 * @param {number} programNumber
 * @returns {Object} Parsed instrument data
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

	console.log('[SF2Parser] Parsing SF2 file, size:', arrayBuffer.byteLength);

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

	// Parse chunks
	while (offset < arrayBuffer.byteLength - 8) {
		const chunkId = readString(4);
		const chunkSize = readDWord();
		const chunkStart = offset;

		console.log('[SF2Parser] Found chunk:', chunkId, 'size:', chunkSize);

		if (chunkId === 'LIST') {
			const listType = readString(4);
			console.log('[SF2Parser] LIST type:', listType);

			if (listType === 'sdta') {
				// Sample data
				chunks.sdta = { offset: chunkStart, size: chunkSize };
			} else if (listType === 'pdta') {
				// Preset data
				chunks.pdta = { offset: chunkStart, size: chunkSize };
			}
		}

		offset = chunkStart + chunkSize;
	}

	// Extract sample data
	let sampleData = null;
	if (chunks.sdta) {
		offset = chunks.sdta.offset + 4; // Skip LIST type
		while (offset < chunks.sdta.offset + chunks.sdta.size) {
			const subChunkId = readString(4);
			const subChunkSize = readDWord();

			if (subChunkId === 'smpl') {
				console.log(
					'[SF2Parser] Found smpl chunk, size:',
					subChunkSize
				);
				sampleData = new Int16Array(
					arrayBuffer,
					offset,
					subChunkSize / 2
				);
				break;
			}
			offset += subChunkSize;
		}
	}

	// For now, return a simple structure with the raw sample data
	// A full implementation would parse presets, instruments, and sample headers
	return {
		sampleData,
		sampleRate: 44100, // Default, should be read from sample headers
		program: programNumber,
	};
}
