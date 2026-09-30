# Builds the release folder and (if makensis is available) the Windows setup installer
param(
    [switch]$SkipReleaseBuild = $false
)

$ErrorActionPreference = "Stop"
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path

# 1. Build portable release first
if (-not $SkipReleaseBuild) {
    & (Join-Path $PSScriptRoot "build-release.ps1")
}

# 2. Locate makensis.exe
$makensis = $null
if (Get-Command "makensis" -ErrorAction SilentlyContinue) {
    $makensis = "makensis"
} else {
    $commonPaths = @(
        "${env:ProgramFiles(x86)}\NSIS\makensis.exe",
        "${env:ProgramFiles}\NSIS\makensis.exe",
        "$env:LOCALAPPDATA\Programs\NSIS\makensis.exe"
    )
    foreach ($p in $commonPaths) {
        if (Test-Path $p) {
            $makensis = $p
            break
        }
    }
}

if (-not $makensis) {
    Write-Host "`n⚠️  makensis.exe (NSIS) not found." -ForegroundColor Yellow
    Write-Host "   To build the setup installer (.exe), install NSIS:" -ForegroundColor Gray
    Write-Host "     choco install nsis -y" -ForegroundColor White
    Write-Host "   or download from: https://nsis.sourceforge.io/" -ForegroundColor Gray
    Write-Host "`n   The portable ZIP in release\ is ready to distribute!" -ForegroundColor Green
    exit 0
}

Write-Host "`nBuilding Windows installer (.exe) with NSIS..." -ForegroundColor Cyan
$nsiScript = Join-Path $repoRoot "installer\teacher-assistant.nsi"

Push-Location (Join-Path $repoRoot "installer")
try {
    & $makensis $nsiScript
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Setup installer created: release\TeacherAssistant-Setup.exe" -ForegroundColor Green
    } else {
        Write-Error "NSIS compilation failed with exit code $LASTEXITCODE"
    }
} finally {
    Pop-Location
}
