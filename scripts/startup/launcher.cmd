@echo off
REM ============================================================================
REM  Local Attendance - startup launcher
REM
REM  Installed by setup-windows-startup.bat into:
REM     %LOCALAPPDATA%\LocalAttendance\
REM
REM  The Scheduled Task points at THIS file, which lives in a stable location
REM  and never moves. The app folder is read from app-path.txt next to this
REM  script, so relocating the app only requires re-running
REM  setup-windows-startup.bat - the task registration itself stays valid.
REM
REM  Every failure is written to startup.log. This launcher never fails
REM  silently: a missing or stale path is logged as FATAL with the fix.
REM ============================================================================

setlocal EnableExtensions
set "LAUNCHER_DIR=%~dp0"
set "CONFIG=%LAUNCHER_DIR%app-path.txt"
set "LOG=%LAUNCHER_DIR%startup.log"

>>"%LOG%" echo [%date% %time%] ------------------------------
>>"%LOG%" echo [%date% %time%] Launcher invoked.

if not exist "%CONFIG%" (
    >>"%LOG%" echo [%date% %time%] FATAL: app-path.txt is missing from "%LAUNCHER_DIR%".
    >>"%LOG%" echo [%date% %time%] FIX: re-run setup-windows-startup.bat from the app folder.
    exit /b 2
)

set "TARGET="
for /f "usebackq delims=" %%L in ("%CONFIG%") do if not defined TARGET set "TARGET=%%L"

if not defined TARGET (
    >>"%LOG%" echo [%date% %time%] FATAL: app-path.txt exists but is empty.
    >>"%LOG%" echo [%date% %time%] FIX: re-run setup-windows-startup.bat from the app folder.
    exit /b 2
)

if not exist "%TARGET%\start-app.bat" (
    >>"%LOG%" echo [%date% %time%] FATAL: start-app.bat not found at "%TARGET%".
    >>"%LOG%" echo [%date% %time%] The app folder was moved, renamed, or deleted.
    >>"%LOG%" echo [%date% %time%] FIX: re-run setup-windows-startup.bat from the new location.
    exit /b 3
)

>>"%LOG%" echo [%date% %time%] Starting app from "%TARGET%".

REM start-app.bat writes its own detailed output to server-stdout.log next to
REM itself. We capture stdout here too so a launch-time crash is still visible
REM in startup.log even if the app folder has become read-only.
call "%TARGET%\start-app.bat" --startup >>"%LOG%" 2>&1
set "RC=%errorlevel%"

>>"%LOG%" echo [%date% %time%] start-app.bat exited with code %RC%.

if not "%RC%"=="0" (
    >>"%LOG%" echo [%date% %time%] Non-zero exit. See server-stdout.log in "%TARGET%".
)

endlocal & exit /b %RC%
