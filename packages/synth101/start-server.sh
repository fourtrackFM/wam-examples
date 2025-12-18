#!/bin/bash

echo "🎹 Starting Synth101 WAV Renderer Server..."
echo

# Check if Node.js is available
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed or not in PATH"
    echo "Please install Node.js from https://nodejs.org/"
    exit 1
fi

# Check if we're in the right directory
if [ ! -f "server.js" ]; then
    echo "❌ server.js not found in current directory"
    echo "Please run this from the synth101 package directory"
    exit 1
fi

# Start the server
echo "Starting HTTP server for WAV renderer..."
echo
node server.js --dev