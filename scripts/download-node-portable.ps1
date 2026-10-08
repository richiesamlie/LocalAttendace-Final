# Downloads official portable Node.js binary for Windows x64 (defaults to latest)
param(
    [string]$NodeVersion = "latest",
    [string]$DestinationDir = ""
)

$ErrorActionPreference = "Stop"

if ([string]::IsNullOrEmpty($DestinationDir)) {
    $DestinationDir = Join-Path $PSScriptRoot "..\node-portable"
}

if (-not (Test-Path $DestinationDir)) {
    New-Item -ItemType Directory -Path $DestinationDir -Force | Out-Null
}

$zipUrl = ""
$zipFileName = ""

if ($NodeVersion -eq "latest") {
    Write-Host "Resolving latest Node.js release from nodejs.org..." -ForegroundColor Cyan
    try {
        $distIndex = Invoke-RestMethod -Uri "https://nodejs.org/dist/index.json" -TimeoutSec 15
        if ($distIndex -and $distIndex.Count -gt 0) {
            $NodeVersion = $distIndex[0].version
        }
    } catch {
        Write-Warning "Could not query nodejs.org/dist/index.json ($($_.Exception.Message)). Falling back to SHASUMS256.txt..."
        try {
            $shaUrl = "https://nodejs.org/dist/latest/SHASUMS256.txt"
            $shaContent = (Invoke-WebRequest -Uri $shaUrl -UseBasicParsing -TimeoutSec 15).Content
            if ($shaContent -match "(node-v\d+\.\d+\.\d+-win-x64\.zip)") {
                if ($matches[1] -match "node-(v\d+\.\d+\.\d+)-") {
                    $NodeVersion = $matches[1]
                }
            }
        } catch {
            Write-Warning "Could not query SHASUMS256.txt ($($_.Exception.Message))."
        }
    }
}

# Fallback default if resolution failed
if ($NodeVersion -eq "latest") {
    $NodeVersion = "v22.14.0"
}

if (-not $NodeVersion.StartsWith("v")) {
    $NodeVersion = "v$NodeVersion"
}
$zipFileName = "node-$NodeVersion-win-x64.zip"
$zipUrl = "https://nodejs.org/dist/$NodeVersion/$zipFileName"

$versionMarker = Join-Path $DestinationDir "version.txt"
$targetExe = Join-Path $DestinationDir "node.exe"

if ((Test-Path $targetExe) -and (Test-Path $versionMarker)) {
    $cachedVer = Get-Content $versionMarker -Raw
    if ($cachedVer.Trim() -eq $NodeVersion.Trim()) {
        Write-Host "Portable Node.js ($NodeVersion) already downloaded: $targetExe" -ForegroundColor Green
        exit 0
    }
}

$tempZip = Join-Path $DestinationDir "node-temp.zip"
$downloadOk = $false

Write-Host "Downloading portable Node.js ($NodeVersion) from $zipUrl..." -ForegroundColor Cyan
try {
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    Invoke-WebRequest -Uri $zipUrl -OutFile $tempZip -UseBasicParsing -TimeoutSec 60
    if ((Test-Path $tempZip) -and (Get-Item $tempZip).Length -gt 1000000) {
        $downloadOk = $true
    }
} catch {
    Write-Warning "Download from $zipUrl failed: $($_.Exception.Message)"
}

if ($downloadOk) {
    Write-Host "Extracting node.exe..." -ForegroundColor Cyan
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $zip = [System.IO.Compression.ZipFile]::OpenRead($tempZip)
    try {
        $entry = $zip.Entries | Where-Object { $_.FullName -like "*/node.exe" }
        if ($entry) {
            if (Test-Path $targetExe) {
                Remove-Item $targetExe -Force
            }
            [System.IO.Compression.ZipFileExtensions]::ExtractToFile($entry, $targetExe, $true)
            $NodeVersion | Out-File -FilePath $versionMarker -Encoding utf8 -Force
            Write-Host "Successfully extracted node.exe ($NodeVersion) to $targetExe" -ForegroundColor Green
        } else {
            Write-Warning "Could not find node.exe inside $tempZip"
        }
    } finally {
        $zip.Dispose()
        Remove-Item $tempZip -Force -ErrorAction SilentlyContinue
    }
}

# If node.exe was not created by download, check if system has node.exe available to copy
if (-not (Test-Path $targetExe)) {
    $sysNode = (Get-Command "node" -ErrorAction SilentlyContinue)
    if ($sysNode -and (Test-Path $sysNode.Source)) {
        Write-Host "Using host Node.js as portable runtime fallback: $($sysNode.Source)" -ForegroundColor Yellow
        Copy-Item $sysNode.Source -Destination $targetExe -Force
        $hostVersion = (& $targetExe -v).Trim()
        $hostVersion | Out-File -FilePath $versionMarker -Encoding utf8 -Force
        Write-Host "Copied host node.exe ($hostVersion) to $targetExe" -ForegroundColor Green
    } else {
        Write-Error "Failed to obtain portable Node.js and no host node.exe found in PATH."
    }
}

Write-Host "Done! Portable Node.js is ready at $targetExe" -ForegroundColor Green
