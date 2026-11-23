# Compiles the lightweight C# System Tray executable using the built-in Windows csc.exe compiler
param(
    [string]$Version = ""
)

$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$traySource = Join-Path $repoRoot "tray\TeacherAssistantTray.cs"
$updaterSource = Join-Path $repoRoot "tray\UpdateManager.cs"
$controlSource = Join-Path $repoRoot "tray\LocalControlServer.cs"
$outFile = Join-Path $repoRoot "tray\TeacherAssistant.exe"
$iconFile = Join-Path $repoRoot "public\icon.ico"
$pubKeyFile = Join-Path $repoRoot "installer\update-public-key.xml"

if ([string]::IsNullOrWhiteSpace($Version)) {
    if (-not [string]::IsNullOrWhiteSpace($env:VERSION)) {
        $Version = $env:VERSION
    } else {
        $pkgJson = Get-Content (Join-Path $repoRoot "package.json") -Raw | ConvertFrom-Json
        $Version = $pkgJson.version
    }
}
$cleanVersion = ($Version.Trim() -replace '^[vV]', '')
if ([string]::IsNullOrWhiteSpace($cleanVersion)) {
    $cleanVersion = "1.0.0"
}

$coreVersion = ($cleanVersion -split '[-+]')[0]
$verParts = @()
foreach ($seg in ($coreVersion -split '\.')) {
    $num = 0
    if ([int]::TryParse($seg, [ref]$num) -and $num -ge 0 -and $num -le 65535) {
        $verParts += $num
    }
}
while ($verParts.Count -lt 3) {
    $verParts += 0
}
$assemblyVersion = "$($verParts[0]).$($verParts[1]).$($verParts[2]).0"

$pubKeyXml = ""
if (Test-Path $pubKeyFile) {
    $pubKeyXml = (Get-Content $pubKeyFile -Raw).Trim()
}

$escapedVersion = $cleanVersion.Replace('\', '\\').Replace('"', '\"')
$escapedPubKey = $pubKeyXml.Replace('"', '""')

$metaSource = Join-Path ([System.IO.Path]::GetTempPath()) "TeacherAssistantBuildMeta_$PID.cs"
$metaCode = @"
using System.Reflection;

[assembly: AssemblyTitle("Teacher Assistant")]
[assembly: AssemblyProduct("Teacher Assistant")]
[assembly: AssemblyVersion("$assemblyVersion")]
[assembly: AssemblyFileVersion("$assemblyVersion")]

namespace TeacherAssistant
{
    internal static class BuildMeta
    {
        public const string Version = "$escapedVersion";
        public const string UpdatePublicKeyXml = @"$escapedPubKey";
    }
}
"@
Set-Content -Path $metaSource -Value $metaCode -Encoding UTF8

$cscPaths = @(
    "$env:windir\Microsoft.NET\Framework64\v4.0.30319\csc.exe",
    "$env:windir\Microsoft.NET\Framework\v4.0.30319\csc.exe"
)

$csc = $cscPaths | Where-Object { Test-Path $_ } | Select-Object -First 1

if (-not $csc) {
    if (Test-Path $metaSource) { Remove-Item $metaSource -Force -ErrorAction SilentlyContinue }
    Write-Error "csc.exe (.NET Framework compiler) was not found in $env:windir\Microsoft.NET\"
    exit 1
}

Write-Host "Compiling TeacherAssistant.exe (v$cleanVersion) using $csc..." -ForegroundColor Cyan

$cscArgs = @(
    "/nologo",
    "/target:winexe",
    "/optimize+",
    "/out:$outFile",
    "/win32icon:$iconFile",
    "/r:System.dll,System.Windows.Forms.dll,System.Drawing.dll,System.Web.Extensions.dll,System.IO.Compression.dll,System.IO.Compression.FileSystem.dll",
    "$traySource",
    "$updaterSource",
    "$controlSource",
    "$metaSource"
)

try {
    & $csc $cscArgs

    if ($LASTEXITCODE -eq 0 -and (Test-Path $outFile)) {
        $sizeKb = [math]::Round((Get-Item $outFile).Length / 1024, 1)
        Write-Host "✅ Compiled TeacherAssistant.exe successfully ($sizeKb KB): $outFile" -ForegroundColor Green
    } else {
        Write-Error "Compilation of TeacherAssistant.exe failed."
        exit 1
    }
} finally {
    if (Test-Path $metaSource) {
        Remove-Item $metaSource -Force -ErrorAction SilentlyContinue
    }
}
