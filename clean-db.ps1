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

# First check port 3000
$connections = @(Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue)
$stoppedProcesses = @()

if ($connections.Count -gt 0) {
    # Get unique process IDs, excluding 0 (system Idle process)
    $processIds = $connections | 
        ForEach-Object { $_.OwningProcess } | 
        Where-Object { $_ -gt 0 } | 
        Select-Object -Unique
    
    foreach ($processId in $processIds) {
        $process = Get-Process -Id $processId -ErrorAction SilentlyContinue
        
        if ($process -and $process.ProcessName -ne "Idle") {
            Write-Host "⚠️  Server is running on port 3000 (PID: $processId)" -ForegroundColor Yellow
            
            try {
                Stop-Process -Id $processId -Force
                $stoppedProcesses += $processId
                Write-Host "   ✓ Stopped process on port 3000" -ForegroundColor Green
            } catch {
                Write-Host "   ⚠️  Could not stop process: $($_.Exception.Message)" -ForegroundColor Yellow
            }
        }
    }
}

# Also check for any node processes that might have database locked
$nodeProcesses = Get-Process node -ErrorAction SilentlyContinue | Where-Object {
    $cmdLine = (Get-WmiObject Win32_Process -Filter "ProcessId=$($_.Id)" -ErrorAction SilentlyContinue).CommandLine
    $cmdLine -and ($cmdLine -like "*server.ts*" -or $cmdLine -like "*tsx*" -or $cmdLine -like "*c:\repo*")
}

if ($nodeProcesses) {
    foreach ($proc in $nodeProcesses) {
        if ($proc.Id -notin $stoppedProcesses) {
            Write-Host "⚠️  Found node process that may have database locked (PID: $($proc.Id))" -ForegroundColor Yellow
            try {
                Stop-Process -Id $proc.Id -Force
                $stoppedProcesses += $proc.Id
                Write-Host "   ✓ Stopped node process" -ForegroundColor Green
            } catch {
                Write-Host "   ⚠️  Could not stop process: $($_.Exception.Message)" -ForegroundColor Yellow
            }
        }
    }
}

if ($stoppedProcesses.Count -gt 0) {
    Write-Host "   Waiting for processes to release file handles..." -ForegroundColor Cyan
    Start-Sleep -Milliseconds 2000
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
$lockedFiles = @()

foreach ($file in $dbFiles) {
    if (Test-Path $file) {
        $deleted = $false
        
        # Try up to 3 times with delays
        for ($retry = 0; $retry -lt 3; $retry++) {
            try {
                Remove-Item $file -Force
                Write-Host "   ✓ Deleted $file" -ForegroundColor Green
                $deletedCount++
                $deleted = $true
                break
            } catch {
                if ($retry -lt 2) {
                    Start-Sleep -Milliseconds 500
                }
            }
        }
        
        if (-not $deleted) {
            Write-Host "   ✗ Could not delete $file (locked by another process)" -ForegroundColor Red
            $lockedFiles += $file
        }
    }
}

Write-Host ""
if ($deletedCount -eq 0 -and $lockedFiles.Count -eq 0) {
    Write-Host "ℹ️  No database files found" -ForegroundColor Gray
} elseif ($lockedFiles.Count -gt 0) {
    Write-Host "⚠️  Some files could not be deleted" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "💡 Try these steps:" -ForegroundColor Cyan
    Write-Host "   1. Run: npm run kill" -ForegroundColor White
    Write-Host "   2. Wait a few seconds" -ForegroundColor White
    Write-Host "   3. Run this script again" -ForegroundColor White
} else {
    Write-Host "✅ Database cleaned successfully!" -ForegroundColor Green
    Write-Host ""
    Write-Host "📝 Next steps:" -ForegroundColor Cyan
    Write-Host "   1. Run: npm run dev" -ForegroundColor White
    Write-Host "   2. Login with: admin / teacher123" -ForegroundColor White
}

Write-Host ""
