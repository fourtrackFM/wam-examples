#!/usr/bin/env node

/**
 * Simple HTTP Server for Synth101 WAV Renderer
 *
 * This server hosts the WAV renderer demo with proper CORS headers
 * to allow ES6 module imports.
 *
 * Usage:
 *   node server.js [--port=8080] [--dev]
 */

import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Parse command line arguments
const args = process.argv.slice(2);
let port = 8080;
let devMode = false;

args.forEach((arg) => {
	if (arg.startsWith('--port=')) {
		port = parseInt(arg.split('=')[1]);
	} else if (arg === '--dev') {
		devMode = true;
	}
});

// MIME types for different file extensions
const mimeTypes = {
	'.html': 'text/html',
	'.js': 'application/javascript',
	'.mjs': 'application/javascript',
	'.css': 'text/css',
	'.json': 'application/json',
	'.wav': 'audio/wav',
	'.mp3': 'audio/mpeg',
	'.png': 'image/png',
	'.jpg': 'image/jpeg',
	'.jpeg': 'image/jpeg',
	'.gif': 'image/gif',
	'.svg': 'image/svg+xml',
	'.ico': 'image/x-icon',
};

// Get content type from file extension
function getContentType(filePath) {
	const ext = path.extname(filePath).toLowerCase();
	return mimeTypes[ext] || 'application/octet-stream';
}

// Check if file exists and is readable
function fileExists(filePath) {
	try {
		fs.accessSync(filePath, fs.constants.R_OK);
		return true;
	} catch {
		return false;
	}
}

// Resolve file path, handling different possible locations
function resolveFilePath(requestPath) {
	// Start from current directory
	let filePath = path.join(__dirname, requestPath);

	// If file exists, return it
	if (fileExists(filePath)) {
		return filePath;
	}

	// Try going up one level (for accessing sdk, api packages)
	filePath = path.join(__dirname, '..', requestPath);
	if (fileExists(filePath)) {
		return filePath;
	}

	// Try going up two levels (for accessing packages root)
	filePath = path.join(__dirname, '..', '..', requestPath);
	if (fileExists(filePath)) {
		return filePath;
	}

	return null;
}

// Create HTTP server
const server = http.createServer((req, res) => {
	let requestPath = req.url;

	// Remove query string
	const queryIndex = requestPath.indexOf('?');
	if (queryIndex !== -1) {
		requestPath = requestPath.substring(0, queryIndex);
	}

	// Default to index.html for root
	if (requestPath === '/') {
		requestPath = '/offline-render.html';
	}

	// Remove leading slash
	if (requestPath.startsWith('/')) {
		requestPath = requestPath.substring(1);
	}

	console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);

	// Resolve the actual file path
	const filePath = resolveFilePath(requestPath);

	if (!filePath) {
		console.log(`  → 404 Not Found: ${requestPath}`);
		res.writeHead(404, { 'Content-Type': 'text/plain' });
		res.end('File not found');
		return;
	}

	// Read and serve the file
	fs.readFile(filePath, (err, content) => {
		if (err) {
			console.log(`  → 500 Error reading file: ${err.message}`);
			res.writeHead(500, { 'Content-Type': 'text/plain' });
			res.end('Internal server error');
			return;
		}

		const contentType = getContentType(filePath);
		console.log(`  → 200 OK (${contentType}): ${filePath}`);

		// Set headers with CORS support
		const headers = {
			'Content-Type': contentType,
			'Access-Control-Allow-Origin': '*',
			'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
			'Access-Control-Allow-Headers':
				'Origin, X-Requested-With, Content-Type, Accept',
		};

		// Cache headers for development
		if (devMode) {
			headers['Cache-Control'] = 'no-cache, no-store, must-revalidate';
			headers['Pragma'] = 'no-cache';
			headers['Expires'] = '0';
		}

		res.writeHead(200, headers);
		res.end(content);
	});
});

// Handle server errors
server.on('error', (err) => {
	if (err.code === 'EADDRINUSE') {
		console.error(
			`❌ Port ${port} is already in use. Try a different port with --port=8081`
		);
	} else {
		console.error('❌ Server error:', err.message);
	}
	process.exit(1);
});

// Start server
server.listen(port, () => {
	console.log('🎹 Synth101 WAV Renderer Server');
	console.log('================================');
	console.log(`🌐 Server running at: http://localhost:${port}`);
	console.log(`📁 Serving from: ${__dirname}`);
	if (devMode) {
		console.log('🔧 Development mode: Cache disabled');
	}
	console.log('');
	console.log('📂 Available files:');
	console.log(`   http://localhost:${port}/offline-render.html`);
	console.log(`   http://localhost:${port}/render-demo.html`);
	console.log('');
	console.log('💡 Press Ctrl+C to stop the server');
	console.log('');
});

// Graceful shutdown
process.on('SIGINT', () => {
	console.log('\n🛑 Shutting down server...');
	server.close(() => {
		console.log('✅ Server stopped');
		process.exit(0);
	});
});
