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

:: Check for debug flag (--debug) and startup flag (--startup, used by the
:: Windows Startup entry so no browser window opens and errors never pause)
set MODE=production
if /i "%~1"=="--debug" set MODE=debug

:: Log file for debugging autostart issues
set "LOG_FILE=%~dp0server-stdout.log"

:: Change directory to the location of this batch file.
:: pushd (instead of cd) also maps a temporary drive letter when the app is
:: started from a network/UNC path, and reports failure clearly if the app
:: folder or its drive is not available (e.g. USB drive not connected).
pushd "%~dp0" >nul 2>&1
IF !errorlevel! NEQ 0 (
    echo [%date% %time%] ERROR: cannot access app folder: %~dp0 >> "%LOG_FILE%"
    echo.
    echo ERROR: Cannot access the app folder:
    echo   %~dp0
    echo The drive or network location is not available.
    echo If this is a USB drive, reconnect it and try again.
    echo.
    if /i not "%~1"=="--startup" pause
    exit /b 1
)

echo [%date% %time%] ========================================== >> "%LOG_FILE%"
echo [%date% %time%] Starting Teacher Assistant (args: %*) >> "%LOG_FILE%"
echo [%date% %time%] Script dir : %~dp0 >> "%LOG_FILE%"
echo [%date% %time%] Working dir: !CD! >> "%LOG_FILE%"

:: Determine Node.js binary: prefer bundled portable Node.js if present
set "NODE_EXE=node"
if exist "%~dp0node\node.exe" (
    set "NODE_EXE=%~dp0node\node.exe"
    echo [%date% %time%] Using bundled Node.js: !NODE_EXE! >> "%LOG_FILE%"
) else (
    where node >nul 2>&1
    IF !errorlevel! NEQ 0 (
        echo [%date% %time%] ERROR: Node.js is not installed or not in PATH >> "%LOG_FILE%"
        echo.
        echo ERROR: Node.js is not installed or not in PATH.
        echo Please install Node.js (LTS recommended): https://nodejs.org/
        echo.
        if /i not "%~1"=="--startup" pause
        exit /b 1
    )
    echo [%date% %time%] Using system Node.js >> "%LOG_FILE%"
)

:: Set data directory if installed in Program Files to ensure write access
if not defined DB_FILE (
    echo "%~dp0" | findstr /i "Program Files" >nul 2>&1
    if !errorlevel! EQU 0 (
        if not defined TEACHER_ASSISTANT_DATA (
            set "TEACHER_ASSISTANT_DATA=%LOCALAPPDATA%\TeacherAssistant\data"
        )
        if not exist "!TEACHER_ASSISTANT_DATA!" mkdir "!TEACHER_ASSISTANT_DATA!"
        set "DB_FILE=!TEACHER_ASSISTANT_DATA!\database.sqlite"
    )
)

IF EXIST "node_modules" (
    echo [%date% %time%] Dependencies already installed >> "%LOG_FILE%"
) else (
    echo [%date% %time%] Installing dependencies with npm... >> "%LOG_FILE%"
    echo First-time setup: installing dependencies (this takes a moment)...
    call npm install --omit=dev --no-audit --no-fund >> "%LOG_FILE%" 2>&1
    IF !errorlevel! NEQ 0 (
        echo [%date% %time%] ERROR: Dependency installation failed! >> "%LOG_FILE%"
        echo.
        echo ERROR: Dependency installation failed!
        echo Try running: npm install
        echo.
        if /i not "%~1"=="--startup" pause
        exit /b 1
    )
)

:: Auto-generate .env on first run if missing
IF NOT EXIST ".env" (
    echo [%date% %time%] First-time setup: generating .env file... >> "%LOG_FILE%"
    echo Generating default configuration (.env)...
    call "!NODE_EXE!" -e "const fs=require('fs'); const crypto=require('crypto'); let ex=''; try{ex=fs.readFileSync('.env.example','utf8');}catch(e){}; const jwt=crypto.randomBytes(32).toString('hex'); const pass='admin123'; let out = ex ? ex.replace('JWT_SECRET=change_this_to_a_secure_random_string','JWT_SECRET='+jwt).replace('DEFAULT_ADMIN_PASSWORD=change_this_to_a_secure_password','DEFAULT_ADMIN_PASSWORD='+pass) : 'JWT_SECRET='+jwt+'\nDEFAULT_ADMIN_PASSWORD='+pass+'\n'; fs.writeFileSync('.env', out, 'utf8'); console.log('[setup] Generated .env file automatically.'); console.log('[setup] Initial admin login: admin / admin123');" >> "%LOG_FILE%" 2>&1
)

:: When launched from Windows startup, skip opening a browser window
if /i "%~1"=="--startup" goto :skip_browser

:: Wait until server responds, then open browser
start "" powershell -NoProfile -WindowStyle Hidden -Command "$deadline=(Get-Date).AddSeconds(120); while((Get-Date)-lt $deadline){ try { $r=Invoke-WebRequest -UseBasicParsing 'http://127.0.0.1:3000' -TimeoutSec 2 -ErrorAction SilentlyContinue; if($r.StatusCode -ge 200){ Start-Process 'http://127.0.0.1:3000' -ErrorAction SilentlyContinue; break } } catch {}; Start-Sleep -Seconds 1 }"

:skip_browser

:: Kill any existing process on port 3000 to avoid conflicts
echo [%date% %time%] Checking for existing server on port 3000... >> "%LOG_FILE%"
powershell -NoProfile -Command "try { $c = Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue; if ($c) { $c | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }; echo 'Killed existing process' } else { echo 'Port 3000 is free' } } catch { echo 'Port check skipped' }" >> "%LOG_FILE%" 2>&1
ping -n 3 127.0.0.1 >nul

:: Start the app server
if "!MODE!"=="debug" (
    echo [%date% %time%] Starting server... >> "%LOG_FILE%"
    call "!NODE_EXE!" "%~dp0node_modules\tsx\dist\cli.mjs" server.ts >> "%LOG_FILE%" 2>&1
) else (
    IF EXIST "dist\index.html" (
        echo [%date% %time%] Build already exists, skipping. Delete dist\ to force rebuild. >> "%LOG_FILE%"
    ) else (
        echo [%date% %time%] Building the application for production... >> "%LOG_FILE%"
        call npm run build >> "%LOG_FILE%" 2>&1
        IF !errorlevel! NEQ 0 (
            echo [%date% %time%] ERROR: Build failed! >> "%LOG_FILE%"
            echo.
            echo ERROR: Build failed!
            echo Try running: npm run build
            echo.
            if /i not "%~1"=="--startup" pause
            exit /b 1
        )
    )
    echo [%date% %time%] Starting server in production mode... >> "%LOG_FILE%"
    set NODE_ENV=production
    :: Local production mode runs on plain HTTP at http://127.0.0.1:3000.
    :: Use non-secure cookies so auth persists across requests.
    set COOKIE_SECURE=false
    call "!NODE_EXE!" "%~dp0node_modules\tsx\dist\cli.mjs" server.ts >> "%LOG_FILE%" 2>&1
)
echo [%date% %time%] Server exited (code !errorlevel!) >> "%LOG_FILE%"
popd
endlocal
