@echo off
setlocal
title Teacher Assistant - Enable Autostart
cd /d "%~dp0"

echo ========================================================
echo  Teacher Assistant - Enable Autostart on Windows Login
echo ========================================================
echo.

powershell -NoProfile -ExecutionPolicy Bypass -Command "$ws = New-Object -ComObject WScript.Shell; $startup = [System.Environment]::GetFolderPath([System.Environment+SpecialFolder]::Startup); $shortcutPath = Join-Path $startup 'Teacher Assistant.lnk'; $exePath = Join-Path (Get-Location).Path 'TeacherAssistant.exe'; $batPath = Join-Path (Get-Location).Path 'start-app.bat'; $iconPath = Join-Path (Get-Location).Path 'public\icon.ico'; $s = $ws.CreateShortcut($shortcutPath); if (Test-Path $exePath) { $s.TargetPath = $exePath; $s.Arguments = '--startup'; $s.WindowStyle = 1; } else { $s.TargetPath = $batPath; $s.WindowStyle = 7; }; $s.WorkingDirectory = (Get-Location).Path; if (Test-Path $iconPath) { $s.IconLocation = $iconPath + ',0' }; $s.Description = 'Launch Teacher Assistant on login'; $s.Save(); Write-Host ' [OK] Autostart successfully ENABLED!' -ForegroundColor Green; Write-Host ' Shortcut created at: ' $shortcutPath -ForegroundColor Gray;"

echo.
echo You can disable this anytime with disable-autostart.bat
echo or via Windows Settings -^> Apps -^> Startup.
echo.
exit /b 0
