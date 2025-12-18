# Synth101 WAV Renderer - HTTP Server Setup

## CORS Issue Solution

The CORS (Cross-Origin Resource Sharing) error you encountered happens because:

1. **File Protocol Limitation**: When opening HTML files directly (`file://` protocol), browsers block ES6 module imports for security reasons
2. **Module Import Restrictions**: WAM modules use ES6 imports which require HTTP/HTTPS protocols to work properly

## 🚀 Quick Start

### Option 1: Windows (Batch File)

```cmd
double-click start-server.bat
```

### Option 2: Command Line

```bash
# Navigate to synth101 directory
cd packages/synth101

# Start the server
node server.js
```

### Option 3: Development Mode

```bash
node server.js --dev
```

## 🌐 Access the Renderer

Once the server is running, open your browser to:

-   **Main Demo**: http://localhost:8080/server-render.html
-   **Original**: http://localhost:8080/offline-render.html
-   **Advanced**: http://localhost:8080/render-demo.html

## 🔧 Server Features

### ✅ CORS Headers

-   Automatically adds `Access-Control-Allow-Origin: *`
-   Supports all necessary CORS headers for WAM modules

### ✅ Module Resolution

-   Serves files from current directory
-   Automatically resolves SDK and API package imports
-   Supports both `.js` and `.mjs` file extensions

### ✅ Development Mode

```bash
node server.js --dev
```

-   Disables caching for easier development
-   Shows detailed request logging

### ✅ Custom Port

```bash
node server.js --port=8081
```

## 📁 File Structure

The server can serve files from these locations:

```
synth101/                     # Current package
├── server-render.html        # Enhanced UI version
├── offline-render.html       # Original version
├── render-demo.html          # Advanced demo
├── dist/index.js            # Built synth101 WAM
└── server.js                # HTTP server

../sdk/dist/index.js         # WAM SDK
../api/dist/index.js         # WAM API
```

## 🛠️ Troubleshooting

### Port Already in Use

```bash
node server.js --port=8081
```

### Module Not Found

-   Ensure synth101 is built: `npm run build`
-   Check that SDK and API packages exist
-   Server logs will show 404 errors for missing files

### Still Getting CORS Errors

-   Make sure you're accessing via `http://localhost:8080`
-   Don't open files directly (`file://` won't work)
-   Check browser console for specific error details

## 💻 Server Requirements

-   **Node.js**: Version 14 or higher
-   **No additional packages**: Uses only Node.js built-in modules
-   **Cross-platform**: Works on Windows, macOS, and Linux

## 🎵 Usage Examples

### Basic Rendering

1. Start server: `node server.js`
2. Open: http://localhost:8080/server-render.html
3. Click "C Major Scale" to load example
4. Click "Render to WAV"
5. Download automatically starts

### Custom Sequences

1. Edit the MIDI sequence in the text area
2. Format: `[startTime, midiNote, velocity, duration]`
3. Choose synth preset (Lead/Pad/Bass)
4. Render and download

### Multiple Instances

```bash
# Terminal 1
node server.js --port=8080

# Terminal 2
node server.js --port=8081
```

## 🔍 Debug Information

The server-render.html includes debug output to help troubleshoot:

-   Module loading status
-   WAM initialization steps
-   Event scheduling details
-   Render timing information

Enable debug view to see detailed logs during the rendering process.

---

**This HTTP server solution eliminates CORS issues and enables proper WAM module loading for offline WAV rendering! 🎹🎵**
