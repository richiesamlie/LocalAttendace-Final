#!/usr/bin/env pwsh
# Kill Server Script (Windows/PowerShell)
# Terminates the development server running on port 3000

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host " Stopping Teacher Assistant Server" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Find process using port 3000
Write-Host "[check] Looking for server process on port 3000..." -ForegroundColor Cyan

try {
    $connections = @(Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue)
    
    if ($connections.Count -gt 0) {
        # Get unique process IDs, excluding 0 (system Idle process)
        $processIds = @(
            $connections | 
            ForEach-Object { $_.OwningProcess } | 
            Where-Object { $_ -gt 0 } | 
            Select-Object -Unique
        )
        
        if ($processIds.Count -eq 0) {
            Write-Host "[info] No valid server process found on port 3000" -ForegroundColor Gray
        } else {
            foreach ($processId in $processIds) {
                $process = Get-Process -Id $processId -ErrorAction SilentlyContinue
                
                if ($process -and $process.ProcessName -ne "Idle") {
                    Write-Host "[ok] Found process: $($process.ProcessName) (PID: $processId)" -ForegroundColor Yellow
                    Write-Host "[warn] Terminating process..." -ForegroundColor Yellow
                    
                    try {
                        Stop-Process -Id $processId -Force
                        Start-Sleep -Milliseconds 500
                        
                        # Verify process is stopped
                        $stillRunning = Get-Process -Id $processId -ErrorAction SilentlyContinue
                        if (-not $stillRunning) {
                            Write-Host "[ok] Server stopped successfully" -ForegroundColor Green
                        } else {
                            Write-Host "[warn] Process may still be running" -ForegroundColor Yellow
                        }
                    } catch {
                        Write-Host "[error] Error stopping process: $($_.Exception.Message)" -ForegroundColor Red
                    }
                }
            }
        }
    } else {
        Write-Host "[info] No server running on port 3000" -ForegroundColor Gray
    }
} catch {
    Write-Host "[error] Error: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host ""
    Write-Host "[hint] Alternative: Use Ctrl+C in the server terminal" -ForegroundColor Gray
    exit 1
}

Write-Host ""
Write-Host "Done!" -ForegroundColor Green
Write-Host ""
