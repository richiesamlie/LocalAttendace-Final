@echo off
title Local Attendance Server
echo ===================================================
echo Starting Local Attendance Server...
echo Please DO NOT close this window while using the app.
echo ===================================================

:: Change directory to the location of this batch file
cd /d "%~dp0"

:: Check if node_modules exists, if not, install dependencies automatically
IF NOT EXIST "node_modules\" (
    echo ===================================================
    echo First time setup: Installing required dependencies...
    echo This will only happen once. Please wait...
    echo ===================================================
    call npm install
)

:: Open the web browser after a 5-second delay to give the server time to start
start "" cmd /c "timeout /t 5 /nobreak > NUL && start http://localhost:3000"

:: Start the Node.js server
npm run dev
