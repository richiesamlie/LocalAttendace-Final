#!/usr/bin/env pwsh
# Clean Database Script (Windows/PowerShell)
# Deletes the SQLite database and creates a fresh one on next server start

param(
    [switch]$Force,
    [switch]$Backup
)

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host " Clean Database" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Confirm if not forced
if (-not $Force) {
    Write-Host "⚠️  This will DELETE all database data!" -ForegroundColor Yellow
    Write-Host ""
    $confirm = Read-Host "Are you sure? (yes/no)"
    if ($confirm -ne "yes") {
        Write-Host ""
        Write-Host "Cancelled." -ForegroundColor Gray
        Write-Host ""
        exit 0
    }
    Write-Host ""
}

# Check if server is running
Write-Host "🔍 Checking for running server..." -ForegroundColor Cyan
$connection = Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue

if ($connection) {
    $processId = $connection.OwningProcess
    
    # Validate process ID (must be > 0 to avoid system processes)
    if ($processId -and $processId -gt 0) {
        $process = Get-Process -Id $processId -ErrorAction SilentlyContinue
        
        if ($process -and $process.ProcessName -ne "Idle") {
            Write-Host "⚠️  Server is running on port 3000 (PID: $processId)" -ForegroundColor Yellow
            Write-Host "   Stopping server to avoid database locks..." -ForegroundColor Yellow
            
            try {
                Stop-Process -Id $processId -Force
                Start-Sleep -Milliseconds 1000
                Write-Host "   ✓ Server stopped" -ForegroundColor Green
            } catch {
                Write-Host "   ⚠️  Could not stop process: $($_.Exception.Message)" -ForegroundColor Yellow
            }
        }
    }
}

# Backup if requested
if ($Backup) {
    if (Test-Path "database.sqlite") {
        $timestamp = Get-Date -Format "yyyy-MM-dd_HHmmss"
        $backupPath = "backups/db-clean-$timestamp.sqlite"
        
        if (-not (Test-Path "backups")) {
            New-Item -ItemType Directory -Path "backups" | Out-Null
        }
        
        Copy-Item "database.sqlite" $backupPath
        Write-Host "💾 Backup created: $backupPath" -ForegroundColor Cyan
    }
}

# Delete database files
Write-Host "🗑️  Deleting database files..." -ForegroundColor Cyan

$dbFiles = @(
    "database.sqlite",
    "database.sqlite-wal",
    "database.sqlite-shm"
)

$deletedCount = 0
foreach ($file in $dbFiles) {
    if (Test-Path $file) {
        try {
            Remove-Item $file -Force
            Write-Host "   ✓ Deleted $file" -ForegroundColor Green
            $deletedCount++
        } catch {
            Write-Host "   ✗ Could not delete $file (may be locked)" -ForegroundColor Red
        }
    }
}

Write-Host ""
if ($deletedCount -eq 0) {
    Write-Host "ℹ️  No database files found" -ForegroundColor Gray
} else {
    Write-Host "✅ Database cleaned successfully!" -ForegroundColor Green
    Write-Host ""
    Write-Host "📝 Next steps:" -ForegroundColor Cyan
    Write-Host "   1. Run: npm run dev" -ForegroundColor White
    Write-Host "   2. Login with: admin / teacher123" -ForegroundColor White
}

Write-Host ""
