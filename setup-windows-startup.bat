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
set "TEMP_VBS=%STARTUP_VBS%.new"

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

:: Create a temporary VBScript in the Startup folder that launches start-app.bat
:: hidden at login. It calls the batch directly (no cmd /c quoting tricks),
:: passes --startup (no browser window, errors never pause), and checks the
:: app folder still exists before running, so a moved folder fails silently
:: instead of showing an error dialog at every login. Keep the active entry
:: intact until the replacement has been written and checked.
powershell -NoProfile -EncodedCommand JABzAGMAcgBpAHAAdABEAGkAcgAgAD0AIAAkAGUAbgB2ADoAUwBDAFIASQBQAFQAXwBEAEkAUgAKACQAbABpAG4AZQBzACAAPQAgAEAAKAAKACAAIAAnAFMAZQB0ACAAVwBzAGgAUwBoAGUAbABsACAAPQAgAEMAcgBlAGEAdABlAE8AYgBqAGUAYwB0ACgAIgBXAFMAYwByAGkAcAB0AC4AUwBoAGUAbABsACIAKQAnACwACgAgACAAJwBTAGUAdAAgAGYAcwBvACAAPQAgAEMAcgBlAGEAdABlAE8AYgBqAGUAYwB0ACgAIgBTAGMAcgBpAHAAdABpAG4AZwAuAEYAaQBsAGUAUwB5AHMAdABlAG0ATwBiAGoAZQBjAHQAIgApACcALAAKACAAIAAoACcASQBmACAAZgBzAG8ALgBGAG8AbABkAGUAcgBFAHgAaQBzAHQAcwAoACIAewAwAH0AIgApACAAVABoAGUAbgAnACAALQBmACAAJABzAGMAcgBpAHAAdABEAGkAcgApACwACgAgACAAKAAnACAAIABXAHMAaABTAGgAZQBsAGwALgBSAHUAbgAgACIAIgAiAHsAMAB9AHMAdABhAHIAdAAtAGEAcABwAC4AYgBhAHQAIgAiACAALQAtAHMAdABhAHIAdAB1AHAAIgAsACAAMAAsACAARgBhAGwAcwBlACcAIAAtAGYAIAAkAHMAYwByAGkAcAB0AEQAaQByACkALAAKACAAIAAnAEUAbgBkACAASQBmACcACgApAAoAWwBTAHkAcwB0AGUAbQAuAEkATwAuAEYAaQBsAGUAXQA6ADoAVwByAGkAdABlAEEAbABsAEwAaQBuAGUAcwAoACQAZQBuAHYAOgBUAEUATQBQAF8AVgBCAFMALAAgACQAbABpAG4AZQBzACkA >nul 2>&1

:: Check the complete generated content before replacing the active entry.
if not exist "%TEMP_VBS%" (
    echo.
    echo ERROR: Failed to create the temporary startup script.
    echo.
    pause
    exit /b 1
)
findstr /c:"Set WshShell = CreateObject" "%TEMP_VBS%" >nul || goto :invalid_vbs
findstr /c:"Set fso = CreateObject" "%TEMP_VBS%" >nul || goto :invalid_vbs
findstr /c:"If fso.FolderExists" "%TEMP_VBS%" >nul || goto :invalid_vbs
findstr /c:"WshShell.Run" "%TEMP_VBS%" >nul || goto :invalid_vbs
findstr /c:"--startup" "%TEMP_VBS%" >nul || goto :invalid_vbs
findstr /c:"End If" "%TEMP_VBS%" >nul || goto :invalid_vbs

move /y "%TEMP_VBS%" "%STARTUP_VBS%" >nul
if errorlevel 1 (
    echo.
    echo ERROR: Failed to install the startup script.
    echo The previous startup entry was left unchanged.
    echo.
    pause
    exit /b 1
)

:: Remove only the legacy-named entry after the new entry is installed.
if exist "%STARTUP_DIR%\LocalAttendanceStartup.vbs" del "%STARTUP_DIR%\LocalAttendanceStartup.vbs"

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
echo To remove the autostart later, delete the file shown above.
echo.
set /p "RUNNOW=Start the app now to verify it works? (Y/N): "
if /i "%RUNNOW%"=="Y" (
    echo.
    echo Starting the app hidden... check server-stdout.log afterwards.
    cscript //nologo "%STARTUP_VBS%"
)
echo.
pause
exit /b 0

:invalid_vbs
del "%TEMP_VBS%" >nul 2>&1
echo.
echo ERROR: The generated startup script is incomplete.
echo The previous startup entry was left unchanged.
echo.
pause
exit /b 1
