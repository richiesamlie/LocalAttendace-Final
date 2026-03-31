@echo off
title Setup Windows Startup
echo ===================================================
echo Setting up Teacher Assistant to run on Windows Startup
echo ===================================================

:: Change directory to the location of this batch file
cd /d "%~dp0"

set SCRIPT_DIR=%~dp0
set STARTUP_DIR=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup
set STARTUP_VBS="%STARTUP_DIR%\TeacherAssistantStartup.vbs"

:: Remove old startup scripts if they exist
if exist "%STARTUP_DIR%\LocalAttendanceStartup.vbs" del "%STARTUP_DIR%\LocalAttendanceStartup.vbs"
if exist "%STARTUP_DIR%\TeacherAssistantStartup.vbs" del "%STARTUP_DIR%\TeacherAssistantStartup.vbs"

:: Create a VBScript in the Startup folder to run the app silently
echo Set WshShell = CreateObject("WScript.Shell") > %STARTUP_VBS%
echo WshShell.Run chr(34) ^& "%SCRIPT_DIR%start-app.bat" ^& chr(34) ^& " hidden", 0, False >> %STARTUP_VBS%

echo.
echo Success! A silent startup script has been added to your Windows Startup folder.
echo The app will now start automatically and silently every time you log into Windows.
echo.
echo Default login: username=admin, password=teacher123
echo.
pause
