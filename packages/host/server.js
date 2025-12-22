const express = require('express');
const https = require('https');
const fs = require('fs');
const path = require('path');

const app = express();

app.use((req, res, next) => {
	res.header('Cross-Origin-Embedder-Policy', 'require-corp');
	res.header('Cross-Origin-Opener-Policy', 'same-origin');
	next();
});

app.use('/', express.static('../'));

// Try to use existing SSL certificates or create self-signed ones
let server;
try {
	const certPath = path.join(__dirname, 'localhost.pem');
	const keyPath = path.join(__dirname, 'localhost-key.pem');

	if (fs.existsSync(certPath) && fs.existsSync(keyPath)) {
		const options = {
			key: fs.readFileSync(keyPath),
			cert: fs.readFileSync(certPath),
		};
		server = https.createServer(options, app);
		server.listen(1234);
		console.info('Host server started on https://localhost:1234/host/');
	} else {
		console.info(
			'No SSL certificates found. Generating self-signed certificate...'
		);
		console.info('Run: npx mkcert create-ca && npx mkcert create-cert');
		app.listen(1234);
		console.info(
			'Host server started on http://localhost:1234/host/ (HTTP fallback)'
		);
	}
} catch (err) {
	app.listen(1234);
	console.info(
		'Host server started on http://localhost:1234/host/ (HTTP fallback)'
	);
}
