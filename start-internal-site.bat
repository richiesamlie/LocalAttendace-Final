@echo off
echo ===================================================
echo Starting Teacher Assistant as an Internal Site
echo ===================================================
echo.

:: Change directory to the location of this batch file
cd /d "%~dp0"

:: Ensure Bun is installed and dependencies are available
where bun >nul 2>&1
IF %errorlevel% NEQ 0 (
    echo.
    echo ERROR: Bun is not installed or not in PATH.
    echo Install Bun first: https://bun.sh/
    echo.
    pause
    exit /b 1
)

:: Ensure Node.js is installed (used to run the Express backend;
:: better-sqlite3 native bindings do not load in Bun on Windows)
where node >nul 2>&1
IF %errorlevel% NEQ 0 (
    echo.
    echo ERROR: Node.js is not installed or not in PATH.
    echo Node.js is required to execute the backend server on Windows due to Bun native C++ addon limitations (better-sqlite3).
    echo Install Node.js first: https://nodejs.org/
    echo.
    pause
    exit /b 1
)

echo Installing dependencies with Bun...
call bun install --frozen-lockfile

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
    echo Starting in Debug Mode via Node.js...
    echo.
    call npx tsx server.ts --network
) else (
    echo Building the application for production...
    call bun run build

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

    :: Set NODE_ENV to production and start the server via Node.js
    :: (better-sqlite3 native bindings do not load in Bun on Windows)
    set NODE_ENV=production
    call npx tsx server.ts --network
)
