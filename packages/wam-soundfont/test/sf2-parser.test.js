/**
 * Unit test for SF2 parser - tests all programs in the soundfont
 */

import { parseSF2 } from '../src/sf2-parser.js';
import fs from 'fs';
import https from 'https';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const SF2_URL = 'https://static.fourtrack.fm/GeneralUser-GS.sf2';
const SF2_CACHE_PATH = path.join(__dirname, 'GeneralUser-GS.sf2');
const PROGRAMS_TO_TEST = 128; // MIDI programs 0-127

/**
 * Download SF2 file if not already cached
 */
async function downloadSF2() {
	// Check if file exists
	if (fs.existsSync(SF2_CACHE_PATH)) {
		console.log('[Test] Using cached SF2 file:', SF2_CACHE_PATH);
		return fs.readFileSync(SF2_CACHE_PATH).buffer;
	}

	console.log('[Test] Downloading SF2 file from:', SF2_URL);
	return new Promise((resolve, reject) => {
		https
			.get(SF2_URL, (response) => {
				if (response.statusCode !== 200) {
					reject(
						new Error(`Failed to download: ${response.statusCode}`)
					);
					return;
				}

				const chunks = [];
				response.on('data', (chunk) => chunks.push(chunk));
				response.on('end', () => {
					const buffer = Buffer.concat(chunks);
					// Cache for future runs
					fs.writeFileSync(SF2_CACHE_PATH, buffer);
					console.log('[Test] Downloaded and cached SF2 file');
					resolve(buffer.buffer);
				});
			})
			.on('error', reject);
	});
}

/**
 * Test a single program
 */
function testProgram(arrayBuffer, programNumber) {
	try {
		console.log(`\n[Test] Testing program ${programNumber}...`);
		const result = parseSF2(arrayBuffer, programNumber, 0);

		// Validate the result
		if (!result) {
			console.error(`  ❌ Program ${programNumber}: No result returned`);
			return {
				program: programNumber,
				success: false,
				error: 'No result returned',
			};
		}

		if (!result.sampleData) {
			console.error(`  ❌ Program ${programNumber}: No sampleData`);
			return {
				program: programNumber,
				success: false,
				error: 'No sampleData in result',
			};
		}

		if (result.sampleData.length === 0) {
			console.error(`  ❌ Program ${programNumber}: Empty sampleData`);
			return {
				program: programNumber,
				success: false,
				error: 'Empty sampleData',
			};
		}

		console.log(`  ✅ Program ${programNumber}: ${result.presetName}`);
		console.log(`     Instrument: ${result.instrumentName}`);
		console.log(`     Sample length: ${result.sampleData.length}`);
		console.log(`     Sample rate: ${result.sampleRate}`);
		console.log(`     Root key: ${result.selectedSample.rootKey}`);
		console.log(
			`     Loop: ${result.selectedSample.loopStart} - ${result.selectedSample.loopEnd}`
		);

		return {
			program: programNumber,
			success: true,
			presetName: result.presetName,
			instrumentName: result.instrumentName,
			sampleLength: result.sampleData.length,
			sampleRate: result.sampleRate,
			rootKey: result.selectedSample.rootKey,
		};
	} catch (error) {
		console.error(`  ❌ Program ${programNumber}: ${error.message}`);
		return {
			program: programNumber,
			success: false,
			error: error.message,
			stack: error.stack,
		};
	}
}

/**
 * Main test runner
 */
async function runTests() {
	console.log('='.repeat(60));
	console.log('SF2 Parser Test Suite');
	console.log('='.repeat(60));

	try {
		// Download or load cached SF2 file
		const arrayBuffer = await downloadSF2();
		console.log('[Test] SF2 file size:', arrayBuffer.byteLength, 'bytes');

		// Test all programs
		const results = [];
		for (let program = 0; program < PROGRAMS_TO_TEST; program++) {
			const result = testProgram(arrayBuffer, program);
			results.push(result);
		}

		// Summary
		console.log('\n' + '='.repeat(60));
		console.log('Test Summary');
		console.log('='.repeat(60));

		const successful = results.filter((r) => r.success);
		const failed = results.filter((r) => !r.success);

		console.log(`\nTotal programs tested: ${results.length}`);
		console.log(`✅ Successful: ${successful.length}`);
		console.log(`❌ Failed: ${failed.length}`);

		if (failed.length > 0) {
			console.log('\nFailed programs:');
			failed.forEach((f) => {
				console.log(`  Program ${f.program}: ${f.error}`);
			});

			console.log('\n' + '='.repeat(60));
			console.log('Detailed error information:');
			console.log('='.repeat(60));
			failed.forEach((f) => {
				console.log(`\nProgram ${f.program}:`);
				console.log(`  Error: ${f.error}`);
				if (f.stack) {
					console.log(`  Stack trace:`);
					console.log(
						f.stack
							.split('\n')
							.map((l) => '    ' + l)
							.join('\n')
					);
				}
			});
		}

		// Write results to JSON file
		const outputPath = path.join(__dirname, 'test-results.json');
		fs.writeFileSync(
			outputPath,
			JSON.stringify(
				{
					timestamp: new Date().toISOString(),
					sf2Url: SF2_URL,
					totalTested: results.length,
					successful: successful.length,
					failed: failed.length,
					results: results,
				},
				null,
				2
			)
		);
		console.log(`\nResults written to: ${outputPath}`);

		// Exit with error code if any tests failed
		process.exit(failed.length > 0 ? 1 : 0);
	} catch (error) {
		console.error('\n❌ Test suite failed:', error.message);
		console.error(error.stack);
		process.exit(1);
	}
}

// Run tests
runTests();
