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

:: Check if .env file exists - required before the server can start
IF NOT EXIST ".env" (
    echo.
    echo ERROR: .env file not found!
    echo.
    echo The app requires JWT_SECRET and DEFAULT_ADMIN_PASSWORD to be set.
    echo Run the setup script to generate secure values automatically:
    echo.
    echo   .\setup-env.ps1
    echo.
    echo Then re-run this script.
    pause
    exit /b 1
)

:: Check that DEFAULT_ADMIN_PASSWORD is present in .env
findstr /i "DEFAULT_ADMIN_PASSWORD" ".env" >nul 2>&1
IF %errorlevel% NEQ 0 (
    echo.
    echo ERROR: DEFAULT_ADMIN_PASSWORD is missing from .env!
    echo The server will not start without it.
    echo.
    echo Run .\setup-env.ps1 to add it, then re-run this script.
    pause
    exit /b 1
)

:: Check for debug flag
set MODE=production
if /i "%~1"=="--debug" set MODE=debug
if /i "%~2"=="--debug" set MODE=debug
if /i "%~3"=="--debug" set MODE=debug

if "%MODE%"=="debug" (
    echo.
    echo Starting in Debug Mode...
    echo.
    call npx tsx server.ts --network
) else (
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
)
