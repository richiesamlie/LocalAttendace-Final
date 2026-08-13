@echo off
title Setup Windows Startup
echo ===================================================
echo Setting up Local Attendance to run on Windows Startup
echo ===================================================

:: Change directory to the location of this batch file
cd /d "%~dp0"

set "SCRIPT_DIR=%~dp0"
set "STARTUP_DIR=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
set "STARTUP_VBS=%STARTUP_DIR%\TeacherAssistantStartup.vbs"

:: Remove old startup scripts if they exist
if exist "%STARTUP_DIR%\LocalAttendanceStartup.vbs" del "%STARTUP_DIR%\LocalAttendanceStartup.vbs"
if exist "%STARTUP_DIR%\TeacherAssistantStartup.vbs" del "%STARTUP_DIR%\TeacherAssistantStartup.vbs"

:: Sanity checks before writing anything
if not exist "%STARTUP_DIR%" (
    echo.
    echo ERROR: Windows Startup folder not found:
    echo   %STARTUP_DIR%
    echo.
    pause
    exit /b 1
)
if not exist "%SCRIPT_DIR%start-app.bat" (
    echo.
    echo ERROR: start-app.bat not found next to this script:
    echo   %SCRIPT_DIR%
    echo.
    pause
    exit /b 1
)

:: Create a VBScript in the Startup folder that launches start-app.bat
:: hidden at login. It calls the batch directly (no cmd /c quoting tricks),
:: passes --startup (no browser window, errors never pause), and checks the
:: app folder still exists before running, so a moved folder fails silently
:: instead of showing an error dialog at every login.
echo Set WshShell = CreateObject("WScript.Shell") > %STARTUP_VBS%
echo Set fso = CreateObject("Scripting.FileSystemObject") >> %STARTUP_VBS%
echo If fso.FolderExists("%SCRIPT_DIR%") Then >> %STARTUP_VBS%
echo   WshShell.Run """%SCRIPT_DIR%start-app.bat"" --startup", 0, False >> %STARTUP_VBS%
echo End If >> %STARTUP_VBS%

if not exist "%STARTUP_VBS%" (
    echo.
    echo ERROR: Failed to create the startup script.
    echo.
    pause
    exit /b 1
)

echo.
echo Success! Startup entry created:
echo   %STARTUP_VBS%
echo.
echo The app will now start automatically (hidden) every time you log in.
echo Startup diagnostics are written to: %SCRIPT_DIR%server-stdout.log
echo.
echo Default login: username=admin
echo Password: see DEFAULT_ADMIN_PASSWORD in your .env file
echo (Run .\setup-env.ps1 first if you have not set up .env yet)
echo.
echo To remove the autostart later, re-run this script (it deletes the old
echo entry) or delete the file shown above.
echo.
set /p "RUNNOW=Start the app now to verify it works? (Y/N): "
if /i "%RUNNOW%"=="Y" (
    echo.
    echo Starting the app hidden... check server-stdout.log afterwards.
    cscript //nologo "%STARTUP_VBS%"
)
echo.
pause
