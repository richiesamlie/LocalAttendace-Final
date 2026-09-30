@echo off
setlocal
title Stop Teacher Assistant
echo ===================================================
echo   Stopping Teacher Assistant...
echo ===================================================
powershell -NoProfile -Command "try { $c = Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue; if ($c) { $c | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }; Write-Host 'Teacher Assistant server stopped successfully.' -ForegroundColor Green } else { Write-Host 'Teacher Assistant is not running.' -ForegroundColor Yellow } } catch { Write-Host ('Error stopping server: ' + $_.Exception.Message) -ForegroundColor Red }"
if /i not "%~1"=="--quiet" if /i not "%~1"=="/q" (
    timeout /t 2 >nul
)
endlocal
