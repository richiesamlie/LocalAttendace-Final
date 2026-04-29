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
Write-Host "🔍 Looking for server process on port 3000..." -ForegroundColor Cyan

try {
    $connection = Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue
    
    if ($connection) {
        $processId = $connection.OwningProcess
        $process = Get-Process -Id $processId -ErrorAction SilentlyContinue
        
        if ($process) {
            Write-Host "✓ Found process: $($process.ProcessName) (PID: $processId)" -ForegroundColor Yellow
            Write-Host "⚠️  Terminating process..." -ForegroundColor Yellow
            
            Stop-Process -Id $processId -Force
            Start-Sleep -Milliseconds 500
            
            # Verify process is stopped
            $stillRunning = Get-Process -Id $processId -ErrorAction SilentlyContinue
            if (-not $stillRunning) {
                Write-Host "✅ Server stopped successfully" -ForegroundColor Green
            } else {
                Write-Host "⚠️  Process may still be running" -ForegroundColor Yellow
            }
        } else {
            Write-Host "⚠️  Could not find process details" -ForegroundColor Yellow
        }
    } else {
        Write-Host "ℹ️  No server running on port 3000" -ForegroundColor Gray
    }
} catch {
    Write-Host "❌ Error: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host ""
    Write-Host "💡 Alternative: Use Ctrl+C in the server terminal" -ForegroundColor Gray
    exit 1
}

Write-Host ""
Write-Host "Done!" -ForegroundColor Green
Write-Host ""
