import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { build } from 'esbuild';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create dist directory
const distDir = path.join(__dirname, 'dist');
if (fs.existsSync(distDir)) {
	fs.rmSync(distDir, { recursive: true, force: true });
}
fs.mkdirSync(distDir, { recursive: true });

console.log('Building WamSoundFont plugin...');

// Bundle spessasynth_core to src/ directory
try {
	await build({
		entryPoints: ['spessasynth_core'],
		bundle: true,
		format: 'esm',
		platform: 'browser',
		target: 'es2020',
		outfile: path.join(__dirname, 'src', 'spessasynth_core.js'),
		sourcemap: false,
		minify: false,
	});
	console.log('✓ spessasynth_core.js bundled to src/');
} catch (error) {
	console.error('✗ spessasynth_core build failed:', error);
	process.exit(1);
}

// Bundle WamSoundFontSynth.js to be loaded by fetchModule
// This needs to create window.module.exports compatible output
try {
	const result = await build({
		entryPoints: [path.join(__dirname, 'src', 'WamSoundFontSynth.js')],
		bundle: true,
		format: 'esm',
		platform: 'browser',
		target: 'es2020',
		write: false,
		sourcemap: false,
		minify: false,
		external: [], // Bundle everything now that spessasynth_core is local
	});

	let code = result.outputFiles[0].text;
	fs.writeFileSync(path.join(distDir, 'WamSoundFontSynth.js'), code);
	console.log('✓ WamSoundFontSynth.js bundled successfully');
} catch (error) {
	console.error('✗ Synth build failed:', error);
	process.exit(1);
}

// Copy other source files that don't need bundling
const filesToCopy = [
	'index.js',
	'WamSoundFontNode.js',
	'WamSoundFontProcessor.js',
	'descriptor.json',
	'spessasynth_core.js', // Copy the bundled spessasynth_core
];

for (const file of filesToCopy) {
	const srcPath = path.join(__dirname, 'src', file);
	const destPath = path.join(distDir, file);
	if (fs.existsSync(srcPath)) {
		fs.copyFileSync(srcPath, destPath);
		console.log(`✓ Copied ${file}`);
	}
}

// Copy Gui directory
const guiSrcDir = path.join(__dirname, 'src', 'Gui');
const guiDestDir = path.join(distDir, 'Gui');
if (fs.existsSync(guiSrcDir)) {
	copyRecursive(guiSrcDir, guiDestDir);
	console.log('✓ Gui files copied');
}

// Copy lib files to dist
const libDir = path.join(__dirname, 'lib');
if (fs.existsSync(libDir)) {
	copyRecursive(libDir, distDir);
	console.log('✓ Lib files copied');
}

console.log('Build complete!');

function copyRecursive(src, dest) {
	const entries = fs.readdirSync(src, { withFileTypes: true });

	for (const entry of entries) {
		const srcPath = path.join(src, entry.name);
		const destPath = path.join(dest, entry.name);

		if (entry.isDirectory()) {
			fs.mkdirSync(destPath, { recursive: true });
			copyRecursive(srcPath, destPath);
		} else {
			fs.copyFileSync(srcPath, destPath);
		}
	}
}
