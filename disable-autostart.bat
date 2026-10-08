@echo off
setlocal
title Teacher Assistant - Disable Autostart
cd /d "%~dp0"

echo ========================================================
echo  Teacher Assistant - Disable Autostart
echo ========================================================
echo.

powershell -NoProfile -ExecutionPolicy Bypass -Command "$startup = [System.Environment]::GetFolderPath([System.Environment+SpecialFolder]::Startup); $shortcutPath = Join-Path $startup 'Teacher Assistant.lnk'; if (Test-Path $shortcutPath) { Remove-Item $shortcutPath -Force; Write-Host ' [OK] Autostart successfully DISABLED.' -ForegroundColor Green; } else { Write-Host ' [INFO] Autostart was not active (no shortcut found).' -ForegroundColor Yellow; }"

echo.
exit /b 0
