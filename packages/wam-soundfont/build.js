const fs = require('fs');
const path = require('path');

// Create dist directory
const distDir = path.join(__dirname, 'dist');
if (fs.existsSync(distDir)) {
	fs.rmSync(distDir, { recursive: true, force: true });
}
fs.mkdirSync(distDir, { recursive: true });

// Copy src files to dist
const srcDir = path.join(__dirname, 'src');
copyRecursive(srcDir, distDir);

// Copy lib files to dist
const libDir = path.join(__dirname, 'lib');
if (fs.existsSync(libDir)) {
	copyRecursive(libDir, distDir);
}

console.log('Build complete: files copied to dist/ without minification');

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
