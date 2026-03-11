@echo off
echo ===================================================
echo Starting Teacher Assistant as an Internal Site
echo ===================================================
echo.

:: Change directory to the location of this batch file
cd /d "%~dp0"

:: Check if node_modules exists, if not, install dependencies automatically
IF NOT EXIST "node_modules\" (
    echo Installing dependencies...
    call npm install
)

echo Building the application for production...
call npm run build

echo.
echo ===================================================
echo Server is starting...
echo You can access the site from other computers on your network using your IP address.
echo.
echo To find your IP address, look for "IPv4 Address" below:
ipconfig | findstr /i "ipv4"
echo.
echo Example: If your IP is 192.168.1.5, open http://192.168.1.5:3000 on another device.
echo ===================================================
echo.

:: Set NODE_ENV to production and start the server
set NODE_ENV=production
call npx tsx server.ts --network
