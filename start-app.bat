@echo off
setlocal

:: Check for debug flag
set MODE=production
if /i "%~1"=="--debug" set MODE=debug
if /i "%~2"=="--debug" set MODE=debug
if /i "%~3"=="--debug" set MODE=debug

if "%~1"=="hidden" goto :run
if "%~2"=="hidden" goto :run
if "%~3"=="hidden" goto :run

:: Create a VBScript to run this batch file silently
set "vbs=%temp%\hide_cmd_%RANDOM%.vbs"
echo Set WshShell = CreateObject("WScript.Shell") > "%vbs%"
echo WshShell.Run chr(34) ^& "%~f0" ^& chr(34) ^& " %* hidden", 0, False >> "%vbs%"
cscript //nologo "%vbs%"
del "%vbs%"
exit /b

:run
:: Change directory to the location of this batch file
cd /d "%~dp0"

:: Ensure Bun is installed (used for package management and building the frontend)
where bun >nul 2>&1
IF %errorlevel% NEQ 0 (
    echo.
    echo ERROR: Bun is not installed or not in PATH.
    echo Install Bun first (required for frontend tooling): https://bun.sh/
    echo.
    pause
    exit /b 1
)

:: Ensure Node.js is installed (required for executing the Express backend on Windows)
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
IF %errorlevel% NEQ 0 (
    echo.
    echo ERROR: Dependency installation failed!
    echo.
    echo Try running: bun install
    echo If that fails, try: rm -rf node_modules && bun install
    echo.
    pause
    exit /b 1
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

:: Open the web browser after a 5-second delay to give the server time to start
start "" cmd /c "timeout /t 5 /nobreak > NUL && start http://127.0.0.1:3000"

:: Start the app server
if "%MODE%"=="debug" (
    echo Starting Teacher Assistant Server in Debug Mode via Node.js...
    call npx tsx server.ts
) else (
    echo Building the application for production...
    call bun run build
    IF %errorlevel% NEQ 0 (
        echo.
        echo ERROR: Build failed!
        echo.
        echo Try running: bun run build
        echo Check the error messages above for details.
        echo.
        pause
        exit /b 1
    )
    echo Starting Teacher Assistant Server in Production Mode via Node.js...
    set NODE_ENV=production
    :: Local production mode runs on plain HTTP (http://127.0.0.1:3000).
    :: Use non-secure cookies so auth persists across requests.
    set COOKIE_SECURE=false
    call npx tsx server.ts
)
endlocal
