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

// Bundle WamSoundFontProcessor.js (includes WamSoundFontSynth with spessasynth_core)
try {
	await build({
		entryPoints: [path.join(__dirname, 'src', 'WamSoundFontProcessor.js')],
		bundle: true,
		format: 'esm',
		platform: 'browser',
		target: 'es2020',
		outfile: path.join(distDir, 'WamSoundFontProcessor.js'),
		sourcemap: false,
		minify: false,
		external: [], // Bundle everything including spessasynth_core
	});
	console.log('✓ WamSoundFontProcessor.js bundled successfully');
} catch (error) {
	console.error('✗ Processor build failed:', error);
	process.exit(1);
}

// Copy other source files that don't need bundling
const filesToCopy = ['index.js', 'WamSoundFontNode.js', 'descriptor.json'];

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
