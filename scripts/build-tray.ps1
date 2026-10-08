# Compiles the lightweight C# System Tray executable using the built-in Windows csc.exe compiler
$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$sourceFile = Join-Path $repoRoot "tray\TeacherAssistantTray.cs"
$outFile = Join-Path $repoRoot "tray\TeacherAssistant.exe"
$iconFile = Join-Path $repoRoot "public\icon.ico"

$cscPaths = @(
    "$env:windir\Microsoft.NET\Framework64\v4.0.30319\csc.exe",
    "$env:windir\Microsoft.NET\Framework\v4.0.30319\csc.exe"
)

$csc = $cscPaths | Where-Object { Test-Path $_ } | Select-Object -First 1

if (-not $csc) {
    Write-Error "csc.exe (.NET Framework compiler) was not found in $env:windir\Microsoft.NET\"
    exit 1
}

Write-Host "Compiling TeacherAssistant.exe using $csc..." -ForegroundColor Cyan

$cscArgs = @(
    "/nologo",
    "/target:winexe",
    "/optimize+",
    "/out:$outFile",
    "/win32icon:$iconFile",
    "/r:System.dll,System.Windows.Forms.dll,System.Drawing.dll",
    "$sourceFile"
)

& $csc $cscArgs

if ($LASTEXITCODE -eq 0 -and (Test-Path $outFile)) {
    $sizeKb = [math]::Round((Get-Item $outFile).Length / 1024, 1)
    Write-Host "✅ Compiled TeacherAssistant.exe successfully ($sizeKb KB): $outFile" -ForegroundColor Green
} else {
    Write-Error "Compilation of TeacherAssistant.exe failed."
    exit 1
}
