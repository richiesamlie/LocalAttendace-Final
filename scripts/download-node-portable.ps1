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
    $shaUrl = "https://nodejs.org/dist/latest/SHASUMS256.txt"
    $shaContent = (Invoke-WebRequest -Uri $shaUrl -UseBasicParsing).Content
    if ($shaContent -match "(node-v\d+\.\d+\.\d+-win-x64\.zip)") {
        $zipFileName = $matches[1]
        $zipUrl = "https://nodejs.org/dist/latest/$zipFileName"
        if ($zipFileName -match "node-(v\d+\.\d+\.\d+)-") {
            $NodeVersion = $matches[1]
        }
    } else {
        Write-Error "Could not resolve latest Windows x64 release from $shaUrl"
    }
} else {
    if (-not $NodeVersion.StartsWith("v")) {
        $NodeVersion = "v$NodeVersion"
    }
    $zipFileName = "node-$NodeVersion-win-x64.zip"
    $zipUrl = "https://nodejs.org/dist/$NodeVersion/$zipFileName"
}

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

Write-Host "Downloading latest portable Node.js ($NodeVersion) from $zipUrl..." -ForegroundColor Cyan

[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
Invoke-WebRequest -Uri $zipUrl -OutFile $tempZip -UseBasicParsing

Write-Host "Extracting node.exe..." -ForegroundColor Cyan

Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip = [System.IO.Compression.ZipFile]::OpenRead($tempZip)
$entry = $zip.Entries | Where-Object { $_.FullName -like "*/node.exe" }

if ($entry) {
    if (Test-Path $targetExe) {
        Remove-Item $targetExe -Force
    }
    [System.IO.Compression.ZipFileExtensions]::ExtractToFile($entry, $targetExe, $true)
    $NodeVersion | Out-File -FilePath $versionMarker -Encoding utf8 -Force
    Write-Host "Successfully extracted node.exe ($NodeVersion) to $targetExe" -ForegroundColor Green
} else {
    Write-Error "Could not find node.exe inside $tempZip"
}

$zip.Dispose()
Remove-Item $tempZip -Force

Write-Host "Done! Portable Node.js ($NodeVersion) is ready." -ForegroundColor Green
