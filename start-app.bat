@echo off
setlocal EnableDelayedExpansion
echo ===================================================
echo   Local Attendance - Teacher Assistant App
echo ===================================================
echo.
echo   DO NOT CLOSE THIS WINDOW while using the app.
echo   Closing this window will stop the server.
echo.
echo ===================================================

:: Check for debug flag
set MODE=production
if /i "%~1"=="--debug" set MODE=debug

:: Change directory to the location of this batch file
cd /d "%~dp0"

:: Log file for debugging autostart issues
set "LOG_FILE=%~dp0server-stdout.log"
echo [%date% %time%] Starting Teacher Assistant >> "%LOG_FILE%"

:: Ensure Bun is installed (used for package management and building the frontend)
where bun >nul 2>&1
IF !errorlevel! NEQ 0 (
    echo.
    echo ERROR: Bun is not installed or not in PATH.
    echo Install Bun first, required for frontend tooling: https://bun.sh/
    echo.
    pause
    exit /b 1
)

:: Ensure Node.js is installed (required for executing the Express backend on Windows)
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

:: Wait until server responds, then open browser
start "" powershell -NoProfile -WindowStyle Hidden -Command "$deadline=(Get-Date).AddSeconds(120); while((Get-Date)-lt $deadline){ try { $r=Invoke-WebRequest -UseBasicParsing 'http://127.0.0.1:3000' -TimeoutSec 2; if($r.StatusCode -ge 200){ Start-Process 'http://127.0.0.1:3000'; break } } catch {}; Start-Sleep -Seconds 1 }"

:: Kill any existing process on port 3000 to avoid conflicts
echo [%date% %time%] Checking for existing server on port 3000... >> "%LOG_FILE%"
powershell -NoProfile -Command "try { $c = Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue; if ($c) { $c | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }; echo 'Killed existing process' } else { echo 'Port 3000 is free' } } catch { echo 'Port check skipped' }" >> "%LOG_FILE%" 2>&1
timeout /t 2 /nobreak >nul

:: Start the app server
if "!MODE!"=="debug" (
    echo [%date% %time%] Starting server... >> "%LOG_FILE%"
    call npx tsx server.ts >> "%LOG_FILE%" 2>&1
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
    echo [%date% %time%] Starting server in production mode... >> "%LOG_FILE%"
    set NODE_ENV=production
    :: Local production mode runs on plain HTTP at http://127.0.0.1:3000.
    :: Use non-secure cookies so auth persists across requests.
    set COOKIE_SECURE=false
    call npx tsx server.ts >> "%LOG_FILE%" 2>&1
)
endlocal
