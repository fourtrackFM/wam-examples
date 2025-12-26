# WAM SoundFont

A Web Audio Module (WAM) that provides SoundFont playback capabilities using SharedArrayBuffer and AudioWorklet processing.
It is based off [spessasynth_core](https://github.com/spessasus/spessasynth_core). It does not expose everything in spessasynth_core, but this should not be too hard to modify.

## Features

-   SoundFont 2 (.sf2) and SoundFont 3 (.sf3) file support
-   Up to 16 voices of polyphony
-   Program change support for instrument switching
-   WAM-MIDI event handling for note triggering
-   Sustain and release envelope processing with proper loop point handling

## Usage

The WAM SoundFont plugin requires soundfont data to be provided as an ArrayBuffer in the initial state during plugin initialization. There are two main ways to prepare this data:

### Method 1: Loading from URL

Load a soundfont file from a URL and convert it to ArrayBuffer:

```javascript
// Load soundfont from URL
async function loadSoundfontFromUrl(url) {
	const response = await fetch(url);
	if (!response.ok) {
		throw new Error(`Failed to fetch soundfont: ${response.statusText}`);
	}
	return await response.arrayBuffer();
}

// Initialize the plugin
async function initializeSoundfontPlugin() {
	// Default soundfont URL (you can use any .sf2 or .sf3 file)
	const soundfontUrl = 'https://myurl.com/GeneralUser-GS-3.sf3';

	// Load the soundfont data
	const arrayBuffer = await loadSoundfontFromUrl(soundfontUrl);

	// Create WAM instance with soundfont data
	const { default: WAM } = await import('./dist/index.js');
	const wamInstance = await WAM.createInstance(hostGroupId, audioContext, {
		baseUrl: './dist/',
	});

	// Initialize with soundfont data
	await wamInstance.initialize({
		arrayBuffer: arrayBuffer,
	});

	return wamInstance;
}
```

### Method 2: Loading from File Input

Allow users to load their own soundfont files:

```javascript
// Load soundfont from file input
function loadSoundfontFromFile(file) {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = (event) => resolve(event.target.result);
		reader.onerror = () => reject(new Error('Failed to read file'));
		reader.readAsArrayBuffer(file);
	});
}

// HTML file input
// <input type="file" id="soundfontInput" accept=".sf2,.sf3" />

// Initialize with user-selected file
async function initializeWithUserFile() {
	const fileInput = document.getElementById('soundfontInput');
	const file = fileInput.files[0];

	if (!file) {
		throw new Error('Please select a soundfont file');
	}

	// Load the file as ArrayBuffer
	const arrayBuffer = await loadSoundfontFromFile(file);

	// Create and initialize WAM instance
	const { default: WAM } = await import('./dist/index.js');
	const wamInstance = await WAM.createInstance(hostGroupId, audioContext, {
		baseUrl: './dist/',
	});

	await wamInstance.initialize({
		arrayBuffer: arrayBuffer,
	});

	return wamInstance;
}
```

### Complete Example

Here's a complete working example that demonstrates both methods:

```html
<!DOCTYPE html>
<html>
	<head>
		<title>WAM SoundFont Example</title>
	</head>
	<body>
		<h1>WAM SoundFont Demo</h1>

		<div>
			<h3>Method 1: Load from URL</h3>
			<button id="loadFromUrl">Load Default SoundFont</button>
		</div>

		<div>
			<h3>Method 2: Load from File</h3>
			<input type="file" id="fileInput" accept=".sf2,.sf3" />
			<button id="loadFromFile">Load Selected File</button>
		</div>

		<div id="status"></div>

		<script type="module">
			let audioContext;
			let hostGroupId;
			let wamInstance;

			const status = document.getElementById('status');

			function updateStatus(message) {
				status.textContent = message;
				console.log(message);
			}

			async function initializeAudio() {
				if (!audioContext) {
					audioContext = new AudioContext();
					const { default: initializeWamHost } = await import(
						'../host/index.js'
					);
					[hostGroupId] = await initializeWamHost(audioContext);
					updateStatus('Audio context initialized');
				}
			}

			async function loadSoundfontFromUrl(url) {
				updateStatus('Fetching soundfont from URL...');
				const response = await fetch(url);
				if (!response.ok) {
					throw new Error(
						`Failed to fetch soundfont: ${response.statusText}`
					);
				}
				const arrayBuffer = await response.arrayBuffer();
				updateStatus(
					`SoundFont loaded from URL (${arrayBuffer.byteLength} bytes)`
				);
				return arrayBuffer;
			}

			async function loadSoundfontFromFile(file) {
				updateStatus('Reading soundfont file...');
				return new Promise((resolve, reject) => {
					const reader = new FileReader();
					reader.onload = (event) => {
						const arrayBuffer = event.target.result;
						updateStatus(
							`SoundFont loaded from file (${arrayBuffer.byteLength} bytes)`
						);
						resolve(arrayBuffer);
					};
					reader.onerror = () =>
						reject(new Error('Failed to read file'));
					reader.readAsArrayBuffer(file);
				});
			}

			async function createWamInstance(arrayBuffer) {
				updateStatus('Creating WAM instance...');

				const { default: WAM } = await import('./dist/index.js');
				const instance = await WAM.createInstance(
					hostGroupId,
					audioContext,
					{
						baseUrl: './dist/',
					}
				);

				updateStatus('Initializing WAM with soundfont data...');
				await instance.initialize({
					arrayBuffer: arrayBuffer,
				});

				// Connect to audio output
				await instance.audioNode.connect(audioContext.destination);

				updateStatus('WAM SoundFont ready!');
				return instance;
			}

			// Method 1: Load from URL
			document
				.getElementById('loadFromUrl')
				.addEventListener('click', async () => {
					try {
						await initializeAudio();
						const soundfontUrl =
							'https://static.fourtrack.fm/GeneralUser-GS-3.sf3';
						const arrayBuffer = await loadSoundfontFromUrl(
							soundfontUrl
						);
						wamInstance = await createWamInstance(arrayBuffer);
					} catch (error) {
						updateStatus(`Error: ${error.message}`);
						console.error(error);
					}
				});

			// Method 2: Load from file
			document
				.getElementById('loadFromFile')
				.addEventListener('click', async () => {
					try {
						const fileInput = document.getElementById('fileInput');
						const file = fileInput.files[0];

						if (!file) {
							updateStatus('Please select a soundfont file');
							return;
						}

						await initializeAudio();
						const arrayBuffer = await loadSoundfontFromFile(file);
						wamInstance = await createWamInstance(arrayBuffer);
					} catch (error) {
						updateStatus(`Error: ${error.message}`);
						console.error(error);
					}
				});
		</script>
	</body>
</html>
```

## Important Notes

1. **ArrayBuffer Requirement**: The plugin **must** receive the soundfont data as an `ArrayBuffer` in the initial state during the `initialize()` call. Without this data, the plugin will fail to create the audio node.

2. **File Formats**: Supports both SoundFont 2 (.sf2) and SoundFont 3 (.sf3) files.

3. **Default SoundFont**: The recommended default soundfont is available at: `https://static.fourtrack.fm/GeneralUser-GS-3.sf3`

4. **File Size**: SoundFont files can be quite large (several MB to hundreds of MB), so consider showing loading progress for better user experience.

5. **CORS**: When loading from URLs, ensure the server supports CORS or serve the files from the same domain.

## API Reference

### Plugin State

The plugin expects an initial state object with the following structure:

```javascript
{
	arrayBuffer: ArrayBuffer; // Required: SoundFont file data
}
```

### MIDI Support

The plugin supports WAM-MIDI events for note triggering:

-   Note On/Off events
-   Program Change (instrument switching)
-   Up to 16 voices of polyphony

### Parameters

The plugin exposes various parameters for controlling playback. Use `getParameterInfo()` to discover available parameters.

## Development

To build the plugin:

```bash
npm run build
```

To test the plugin:

```bash
# Open test.html in your browser
# or run a local server in the package directory
```

## License

This project follows the same license as the wam-examples repository.
