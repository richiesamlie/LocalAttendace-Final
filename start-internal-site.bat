@echo off
setlocal EnableDelayedExpansion
echo ===================================================
echo Starting Teacher Assistant as an Internal Site
echo ===================================================
echo.

:: Change directory to the location of this batch file
cd /d "%~dp0"

:: Log file for debugging autostart issues
set "LOG_FILE=%~dp0server-stdout.log"
echo [%date% %time%] Starting Teacher Assistant (Internal Site) >> "%LOG_FILE%"

:: Ensure Bun is installed and dependencies are available
where bun >nul 2>&1
IF !errorlevel! NEQ 0 (
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
IF !errorlevel! NEQ 0 (
    echo.
    echo ERROR: Node.js is not installed or not in PATH.
    echo Node.js is required to execute the backend server on Windows due to Bun native C++ addon limitations for better-sqlite3.
    echo Install Node.js first: https://nodejs.org/
    echo.
    pause
    exit /b 1
)

IF EXIST "node_modules" (
    echo [%date% %time%] Dependencies already installed, skipping bun install >> "%LOG_FILE%"
) else (
    echo [%date% %time%] Installing dependencies with Bun... >> "%LOG_FILE%"
    call bun install --frozen-lockfile >> "%LOG_FILE%" 2>&1
    IF !errorlevel! NEQ 0 (
        echo [%date% %time%] ERROR: Dependency installation failed! >> "%LOG_FILE%"
        echo.
        echo ERROR: Dependency installation failed!
        echo.
        echo Try running: bun install
        echo If that fails, try: rm -rf node_modules && bun install
        echo.
        pause
        exit /b 1
    )
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
IF !errorlevel! NEQ 0 (
    echo.
    echo ERROR: DEFAULT_ADMIN_PASSWORD is missing from .env!
    echo The server will not start without it.
    echo.
    echo Run .\setup-env.ps1 to add it, then re-run this script.
    pause
    exit /b 1
)

:: Kill any existing process on port 3000 to avoid conflicts
echo [%date% %time%] Checking for existing server on port 3000... >> "%LOG_FILE%"
powershell -NoProfile -Command "try { $c = Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue; if ($c) { $c | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }; echo 'Killed existing process' } else { echo 'Port 3000 is free' } } catch { echo 'Port check skipped' }" >> "%LOG_FILE%" 2>&1
timeout /t 2 /nobreak >nul

:: Check for debug flag
set MODE=production
if /i "%~1"=="--debug" set MODE=debug

if "!MODE!"=="debug" (
    echo.
    echo Starting in Debug Mode via Node.js...
    echo.
    call npx tsx server.ts --network
) else (
    IF EXIST "dist\index.html" (
        echo [%date% %time%] Build already exists, skipping. Delete dist\ to force rebuild. >> "%LOG_FILE%"
    ) else (
        echo [%date% %time%] Building the application for production... >> "%LOG_FILE%"
        call bun run build >> "%LOG_FILE%" 2>&1
        IF !errorlevel! NEQ 0 (
            echo [%date% %time%] ERROR: Build failed! >> "%LOG_FILE%"
            echo.
            echo ERROR: Build failed!
            echo.
            echo Try running: bun run build
            echo Check the error messages above for details.
            echo.
            pause
            exit /b 1
        )
    )

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
    :: better-sqlite3 native bindings do not load in Bun on Windows.
    set NODE_ENV=production
    :: Internal-site mode commonly runs on plain HTTP. Allow non-secure
    :: cookies so auth persists across requests on trusted LAN deployments.
    set COOKIE_SECURE=false
    echo [%date% %time%] Starting server in production mode... >> "%LOG_FILE%"
    call npx tsx server.ts --network >> "%LOG_FILE%" 2>&1
)
endlocal
