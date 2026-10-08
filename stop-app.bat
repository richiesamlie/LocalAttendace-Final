@echo off
setlocal
title Stop Teacher Assistant
echo ===================================================
echo   Stopping Teacher Assistant...
echo ===================================================

powershell -NoProfile -ExecutionPolicy Bypass -Command "$stopped = $false; try { $c = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue | Where-Object { $_.OwningProcess -gt 0 }; if ($c) { $c | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue; $stopped = $true } } } catch {}; try { $appDir = (Get-Location).Path; Get-Process -Name 'TeacherAssistant', 'node' -ErrorAction SilentlyContinue | Where-Object { $_.Path -and $_.Path.StartsWith($appDir, [System.StringComparison]::OrdinalIgnoreCase) } | ForEach-Object { Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue; $stopped = $true }; } catch {}; if ($stopped) { Write-Host '  Teacher Assistant server stopped successfully.' -ForegroundColor Green; } else { Write-Host '  Teacher Assistant is not running.' -ForegroundColor Yellow; }"

if /i not "%~1"=="--quiet" if /i not "%~1"=="/q" (
    timeout /t 2 >nul
)
endlocal
