@echo off
if "%~1"=="hidden" goto :run

:: Create a VBScript to run this batch file silently
set "vbs=%temp%\hide_cmd_%RANDOM%.vbs"
echo Set WshShell = CreateObject("WScript.Shell") > "%vbs%"
echo WshShell.Run chr(34) ^& "%~f0" ^& chr(34) ^& " hidden", 0, False >> "%vbs%"
cscript //nologo "%vbs%"
del "%vbs%"
exit /b

:run
:: Change directory to the location of this batch file
cd /d "%~dp0"

:: Check if node_modules exists, if not, install dependencies automatically
IF NOT EXIST "node_modules\" (
    call npm install
)

:: Open the web browser after a 5-second delay to give the server time to start
start "" cmd /c "timeout /t 5 /nobreak > NUL && start http://localhost:3000"

:: Start the Node.js server
npm run dev
