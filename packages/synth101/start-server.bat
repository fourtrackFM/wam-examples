@echo off
echo 🎹 Starting Synth101 WAV Renderer Server...
echo.

REM Check if Node.js is available
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ❌ Node.js is not installed or not in PATH
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

REM Check if we're in the right directory
if not exist "server.js" (
    echo ❌ server.js not found in current directory
    echo Please run this from the synth101 package directory
    pause
    exit /b 1
)

REM Start the server
echo Starting HTTP server for WAV renderer...
echo.
node server.js --dev

pause