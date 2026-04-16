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

:: Open the web browser after a 5-second delay to give the server time to start
start "" cmd /c "timeout /t 5 /nobreak > NUL && start http://127.0.0.1:3000"

:: Start the Node.js server
if "%MODE%"=="debug" (
    echo Starting Teacher Assistant Server in Debug Mode...
    call npm run dev
) else (
    echo Building the application for production...
    call npm run build
    echo Starting Teacher Assistant Server in Production Mode...
    set NODE_ENV=production
    call npm run start
)
endlocal
