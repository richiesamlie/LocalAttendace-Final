<#
.SYNOPSIS
    Installs the Local Attendance Windows autostart entry as a Scheduled Task.

.DESCRIPTION
    Registers an ONLOGON Scheduled Task that launches the app hidden.

    Why a Scheduled Task instead of a VBScript in the Startup folder:
      - Startup-folder scripts are the most commonly blocked autostart vector
        under AppLocker / Device Guard / WDAC policy.
      - A task gives us a real event log (Event Viewer > TaskScheduler) when
        a launch fails, instead of a VBScript that dies silently.
      - The task's action points at a launcher in %LOCALAPPDATA%, a stable
        location, so relocating the app folder does not invalidate the task.

    The app folder is recorded in app-path.txt beside the launcher. Re-running
    this script after moving the app updates that path in place.

.PARAMETER AppPath
    App folder to autostart. Defaults to this script's parent folder.

.PARAMETER TaskName
    Scheduled Task name. Defaults to LocalAttendance-Autostart.

.PARAMETER Uninstall
    Remove the task, the launcher, and any legacy Startup-folder VBScript.

.PARAMETER StartNow
    Run the task immediately to verify it works.

.EXAMPLE
    powershell -NoProfile -ExecutionPolicy Bypass -File scripts\startup\install-autostart.ps1

.EXAMPLE
    powershell -NoProfile -ExecutionPolicy Bypass -File scripts\startup\install-autostart.ps1 -Uninstall
#>

[CmdletBinding()]
param(
    [string] $AppPath,
    [string] $TaskName = 'LocalAttendance-Autostart',
    [switch] $Uninstall,
    [switch] $StartNow
)

$ErrorActionPreference = 'Stop'

$LauncherDir = Join-Path $env:LOCALAPPDATA 'LocalAttendance'
$LauncherCmd = Join-Path $LauncherDir 'launcher.cmd'
$ConfigFile = Join-Path $LauncherDir 'app-path.txt'
$LogFile = Join-Path $LauncherDir 'startup.log'
$SourceLauncher = Join-Path $PSScriptRoot 'launcher.cmd'

function Write-Step { param($Message) Write-Host "  $Message" }
function Write-Ok { param($Message) Write-Host "  [ok] $Message" -ForegroundColor Green }
function Write-Fail { param($Message) Write-Host "  [!!] $Message" -ForegroundColor Red }

# --- Uninstall ---------------------------------------------------------------
if ($Uninstall) {
    Write-Host "`nRemoving Local Attendance autostart`n"

    if (Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue) {
        Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
        Write-Ok "Removed scheduled task '$TaskName'."
    } else {
        Write-Step "No scheduled task named '$TaskName'."
    }

    if (Test-Path $LauncherDir) {
        Remove-Item $LauncherDir -Recurse -Force
        Write-Ok "Removed launcher directory: $LauncherDir"
    } else {
        Write-Step "No launcher directory at $LauncherDir."
    }

    # Clean up the legacy Startup-folder VBScript left by earlier versions.
    $startupDir = Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs\Startup'
    foreach ($legacy in @('TeacherAssistantStartup.vbs', 'LocalAttendanceStartup.vbs')) {
        $legacyPath = Join-Path $startupDir $legacy
        if (Test-Path $legacyPath) {
            Remove-Item $legacyPath -Force
            Write-Ok "Removed legacy startup entry: $legacyPath"
        }
    }

    Write-Host "`nAutostart removed.`n"
    exit 0
}

# --- Install -----------------------------------------------------------------
if (-not $AppPath) {
    # scripts/startup/ -> scripts/ -> repo root
    $AppPath = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
}
$AppPath = (Resolve-Path -LiteralPath $AppPath).Path
$startApp = Join-Path $AppPath 'start-app.bat'

Write-Host "`nLocal Attendance - autostart setup`n"

if (-not (Test-Path $startApp)) {
    Write-Fail "start-app.bat not found in: $AppPath"
    Write-Host "      Run this script from inside the app folder, or pass -AppPath.`n"
    exit 1
}
Write-Ok "App folder: $AppPath"

if (-not (Test-Path $SourceLauncher)) {
    Write-Fail "launcher.cmd template missing: $SourceLauncher"
    exit 1
}

# Write the launcher + path config into the stable per-user location.
New-Item -ItemType Directory -Path $LauncherDir -Force | Out-Null
Copy-Item -LiteralPath $SourceLauncher -Destination $LauncherCmd -Force
Write-Ok "Launcher installed: $LauncherCmd"

# No trailing backslash: launcher.cmd appends \start-app.bat itself.
Set-Content -LiteralPath $ConfigFile -Value $AppPath -Encoding ASCII -NoNewline
Write-Ok "App path recorded: $ConfigFile -> $AppPath"

# --- Register the task -------------------------------------------------------
$user = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name

$action = New-ScheduledTaskAction -Execute 'cmd.exe' `
    -Argument "/c `"`"$LauncherCmd`"`"" -WorkingDirectory $LauncherDir

# 30s delay: at logon the network stack and mapped drives are often not ready,
# and start-app.bat kills whatever holds port 3000.
$trigger = New-ScheduledTaskTrigger -AtLogOn -User $user
$trigger.Delay = 'PT30S'

# Interactive logon only: the app is a per-user desktop app and needs no
# password to be stored, which keeps this installable without admin rights.
$principal = New-ScheduledTaskPrincipal -UserId $user `
    -LogonType Interactive -RunLevel Limited

$settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -StartWhenAvailable `
    -DontStopOnIdleEnd `
    -ExecutionTimeLimit ([TimeSpan]::Zero) `
    -MultipleInstances IgnoreNew

Register-ScheduledTask -TaskName $TaskName `
    -Action $action -Trigger $trigger -Principal $principal -Settings $settings `
    -Description 'Starts the Local Attendance teacher assistant app at logon.' `
    -Force | Out-Null

Write-Ok "Scheduled task '$TaskName' registered (runs at logon, +30s)."

# --- Remove the superseded Startup-folder entry ------------------------------
$startupDir = Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs\Startup'
foreach ($legacy in @('TeacherAssistantStartup.vbs', 'LocalAttendanceStartup.vbs')) {
    $legacyPath = Join-Path $startupDir $legacy
    if (Test-Path $legacyPath) {
        Remove-Item $legacyPath -Force
        Write-Ok "Removed superseded startup entry: $legacyPath"
    }
}

# --- Verify ------------------------------------------------------------------
Write-Host "`nVerification`n"
$task = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
if (-not $task) {
    Write-Fail "Task '$TaskName' is not registered after install."
    exit 1
}
Write-Ok "Task state: $($task.State)"

if ($StartNow) {
    Write-Step "Starting task now..."
    Start-ScheduledTask -TaskName $TaskName
    Start-Sleep -Seconds 20
    $info = Get-ScheduledTaskInfo -TaskName $TaskName
    Write-Step "Last run: $($info.LastRunTime)  result: 0x$('{0:X}' -f $info.LastTaskResult)"

    # 0x41301 == SCHED_S_TASK_RUNNING. The app is a blocking server, so a task
    # that is still Running after the grace period is the SUCCESS case, not a
    # failure. Only an exited task with a non-zero code is a real problem.
    $SCHED_S_TASK_RUNNING = 0x41301
    if ((Get-ScheduledTask -TaskName $TaskName).State -eq 'Ready' -and
        $info.LastTaskResult -ne 0 -and
        $info.LastTaskResult -ne $SCHED_S_TASK_RUNNING) {
        Write-Fail "Task exited with 0x$('{0:X}' -f $info.LastTaskResult). Check $LogFile"
        Write-Host "         and Event Viewer > Task Scheduler > Library.`n"
        exit 1
    }

    # Poll rather than sleep a fixed amount: first boot can need time for the
    # port-3000 cleanup and the SQLite WAL checkpoint.
    $deadline = (Get-Date).AddSeconds(90)
    $ok = $false
    while ((Get-Date) -lt $deadline) {
        try {
            $response = Invoke-WebRequest -Uri 'http://127.0.0.1:3000' -UseBasicParsing -TimeoutSec 5
            Write-Ok "App responding on http://127.0.0.1:3000 (HTTP $($response.StatusCode))"
            $ok = $true
            break
        } catch {
            Start-Sleep -Seconds 3
        }
    }
    if (-not $ok) {
        Write-Fail "App did not respond on http://127.0.0.1:3000 within 90s."
        Write-Host "         Check $LogFile for the launch-time error.`n"
        exit 1
    }
}

Write-Host ""
Write-Host "  Autostart installed. The app now starts when you log in.`n"
Write-Host "  Startup log: $LogFile`n"
Write-Host "  Remove it with: powershell -NoProfile -ExecutionPolicy Bypass -File scripts\startup\install-autostart.ps1 -Uninstall`n"
exit 0
