#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from .env file
function loadEnv() {
	const envPath = path.join(__dirname, '..', '.env');
	if (!fs.existsSync(envPath)) {
		console.log('No .env file found, skipping copy operation');
		return {};
	}

	const envContent = fs.readFileSync(envPath, 'utf8');
	const env = {};

	envContent.split('\n').forEach((line) => {
		line = line.trim();
		if (line && !line.startsWith('#')) {
			const [key, ...valueParts] = line.split('=');
			if (key && valueParts.length > 0) {
				env[key.trim()] = valueParts.join('=').trim();
			}
		}
	});

	return env;
}

// Cross-platform copy function
function copyRecursive(src, dest) {
	if (!fs.existsSync(src)) {
		throw new Error(`Source directory does not exist: ${src}`);
	}

	// Create destination directory if it doesn't exist
	fs.mkdirSync(dest, { recursive: true });

	const items = fs.readdirSync(src);
	let copiedCount = 0;

	for (const item of items) {
		const srcPath = path.join(src, item);
		const destPath = path.join(dest, item);
		const stat = fs.statSync(srcPath);

		if (stat.isDirectory()) {
			copyRecursive(srcPath, destPath);
		} else {
			fs.copyFileSync(srcPath, destPath);
			console.log(`Copied: ${item}`);
			copiedCount++;
		}
	}

	return copiedCount;
}

function main() {
	try {
		const env = loadEnv();
		const destination = env.COPY_DIST_DESTINATION;

		if (!destination) {
			console.log(
				'COPY_DIST_DESTINATION not set in .env file, skipping copy operation'
			);
			return;
		}

		const distPath = path.join(__dirname, '..', 'dist');

		if (!fs.existsSync(distPath)) {
			console.error(
				'Error: dist directory does not exist. Run "npm run build" first.'
			);
			process.exit(1);
		}

		console.log(`Copying dist files to: ${destination}`);

		const copiedCount = copyRecursive(distPath, destination);

		console.log(
			`Successfully copied ${copiedCount} file(s) to ${destination}`
		);
	} catch (error) {
		console.error('Error during copy operation:', error.message);
		process.exit(1);
	}
}

main();
