@echo off
title Setup Windows Startup
echo ===================================================
echo Setting up Local Attendance to run on Windows Startup
echo ===================================================

:: Change directory to the location of this batch file
cd /d "%~dp0"

:: Set variables for the shortcut creation
set SCRIPT_DIR=%~dp0
set STARTUP_DIR=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup
set VBS_SCRIPT=CreateShortcut.vbs

:: Create a temporary VBScript to create the shortcut
echo Set oWS = WScript.CreateObject("WScript.Shell") > %VBS_SCRIPT%
echo sLinkFile = "%STARTUP_DIR%\LocalAttendance.lnk" >> %VBS_SCRIPT%
echo Set oLink = oWS.CreateShortcut(sLinkFile) >> %VBS_SCRIPT%
echo oLink.TargetPath = "%SCRIPT_DIR%start-app.bat" >> %VBS_SCRIPT%
echo oLink.WorkingDirectory = "%SCRIPT_DIR%" >> %VBS_SCRIPT%
echo oLink.Description = "Local Attendance App Server" >> %VBS_SCRIPT%
echo oLink.IconLocation = "%SystemRoot%\System32\SHELL32.dll,13" >> %VBS_SCRIPT%
echo oLink.Save >> %VBS_SCRIPT%

:: Run the VBScript to create the shortcut
cscript //nologo %VBS_SCRIPT%

:: Delete the temporary VBScript
del %VBS_SCRIPT%

echo.
echo Success! A shortcut has been added to your Windows Startup folder.
echo The app will now start automatically every time you log into Windows.
echo.
pause
