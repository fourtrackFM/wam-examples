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
							'https://myurl.com/GeneralUser-GS-3.sf3';
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

3. **Default SoundFont**: You can find soundfonts anywhere. The [Polyphone editor](https://www.polyphone.io/) site has a lot of info and an excellent editor and viewer for soundfonts. The most generously licensed soundfont I could find, through spessasynth, is available at https://www.schristiancollins.com/generaluser, license available here: https://github.com/mrbumpy409/GeneralUser-GS/blob/main/documentation/LICENSE.txt.

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

#### scheduleEvents Examples

Once your WAM instance is initialized, you can send MIDI events using the `scheduleEvents` method:

##### Program Change (Instrument Selection)

```javascript
// Change to a different instrument (program)
// Program numbers are 0-127 (corresponding to General MIDI instruments)
const programChangeEvent = {
	type: 'wam-midi',
	data: {
		bytes: [0xc0, 64], // Program Change on channel 0 to program 64 (Lead 1 - Square)
	},
};

// Schedule the program change immediately
wamInstance.audioNode.scheduleEvents(
	audioContext.currentTime, // when to execute (now)
	[programChangeEvent]
);

// Or schedule for a future time
wamInstance.audioNode.scheduleEvents(
	audioContext.currentTime + 1.0, // 1 second from now
	[programChangeEvent]
);
```

##### Note On/Off Events

```javascript
// Play a single note (Middle C)
const noteOnEvent = {
	type: 'wam-midi',
	data: {
		bytes: [0x90, 60, 100], // Note On: channel 0, note 60 (C4), velocity 100
	},
};

const noteOffEvent = {
	type: 'wam-midi',
	data: {
		bytes: [0x80, 60, 0], // Note Off: channel 0, note 60 (C4), velocity 0
	},
};

// Play note immediately
wamInstance.audioNode.scheduleEvents(audioContext.currentTime, [noteOnEvent]);

// Stop note after 1 second
wamInstance.audioNode.scheduleEvents(audioContext.currentTime + 1.0, [
	noteOffEvent,
]);
```

##### Playing Chords

```javascript
// Play a C major chord (C-E-G)
const chordOn = [
	{ type: 'wam-midi', data: { bytes: [0x90, 60, 80] } }, // C4
	{ type: 'wam-midi', data: { bytes: [0x90, 64, 80] } }, // E4
	{ type: 'wam-midi', data: { bytes: [0x90, 67, 80] } }, // G4
];

const chordOff = [
	{ type: 'wam-midi', data: { bytes: [0x80, 60, 0] } }, // C4 off
	{ type: 'wam-midi', data: { bytes: [0x80, 64, 0] } }, // E4 off
	{ type: 'wam-midi', data: { bytes: [0x80, 67, 0] } }, // G4 off
];

// Play chord
wamInstance.audioNode.scheduleEvents(audioContext.currentTime, chordOn);

// Release chord after 2 seconds
wamInstance.audioNode.scheduleEvents(audioContext.currentTime + 2.0, chordOff);
```

##### Interactive Piano Example

```javascript
// Example: Create interactive piano keys
function createPianoKey(noteNumber, noteName) {
	const button = document.createElement('button');
	button.textContent = noteName;
	button.style.margin = '2px';
	button.style.padding = '10px';

	// Note on when button is pressed
	button.addEventListener('mousedown', () => {
		const noteOn = {
			type: 'wam-midi',
			data: { bytes: [0x90, noteNumber, 100] },
		};
		wamInstance.audioNode.scheduleEvents(audioContext.currentTime, [
			noteOn,
		]);
	});

	// Note off when button is released
	button.addEventListener('mouseup', () => {
		const noteOff = {
			type: 'wam-midi',
			data: { bytes: [0x80, noteNumber, 0] },
		};
		wamInstance.audioNode.scheduleEvents(audioContext.currentTime, [
			noteOff,
		]);
	});

	document.body.appendChild(button);
}

// Create an octave of piano keys
const notes = [
	{ num: 60, name: 'C' },
	{ num: 61, name: 'C#' },
	{ num: 62, name: 'D' },
	{ num: 63, name: 'D#' },
	{ num: 64, name: 'E' },
	{ num: 65, name: 'F' },
	{ num: 66, name: 'F#' },
	{ num: 67, name: 'G' },
	{ num: 68, name: 'G#' },
	{ num: 69, name: 'A' },
	{ num: 70, name: 'A#' },
	{ num: 71, name: 'B' },
];

notes.forEach((note) => createPianoKey(note.num, note.name));
```

#### MIDI Message Format

WAM-MIDI events use standard MIDI message bytes:

-   **Note On**: `[0x90 | channel, note, velocity]`
-   **Note Off**: `[0x80 | channel, note, velocity]`
-   **Program Change**: `[0xC0 | channel, program]`

Where:

-   `channel`: MIDI channel (0-15)
-   `note`: MIDI note number (0-127, where 60 = Middle C)
-   `velocity`: Note velocity (0-127, where 0 = off, 127 = maximum)
-   `program`: Instrument program (0-127, General MIDI standard)

### Parameters

The plugin exposes various parameters for controlling playback. Use `getParameterInfo()` to discover available parameters.

## Development

### Building

To build the plugin:

```bash
npm run build
```

This will:

1. Clean the dist directory
2. Compile TypeScript and bundle with Rollup
3. Copy built files to the configured destination (if set)

### Copy Configuration

The build process can automatically copy the built files to a destination directory. To configure this:

1. Copy `.env.example` to `.env`:

    ```bash
    cp .env.example .env
    ```

2. Edit `.env` and set `COPY_DIST_DESTINATION` to your desired path:

    ```bash
    # Windows example
    COPY_DIST_DESTINATION=C:\\path\\to\\your\\project\\public\\wam\\wam-soundfont\\

    # Unix/Linux/macOS example
    COPY_DIST_DESTINATION=/Users/username/projects/my-app/public/wam/wam-soundfont/

    # Relative path example
    COPY_DIST_DESTINATION=../../../my-app/public/wam/wam-soundfont/
    ```

3. Leave `COPY_DIST_DESTINATION` empty or comment it out to skip copying.

The copy script is cross-platform and will create the destination directory if it doesn't exist.

### Testing

To test the plugin:

```bash
# Open test.html in your browser
# or run a local server in the package directory
```

## License

This project follows the same license as the wam-examples repository.
