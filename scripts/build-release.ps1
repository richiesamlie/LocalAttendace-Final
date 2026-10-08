# Builds a portable Windows release bundle
param(
    [switch]$SkipBuild = $false,
    [switch]$SkipZip = $false
)

$ErrorActionPreference = "Stop"
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path

# Read version from package.json
$pkgJson = Get-Content (Join-Path $repoRoot "package.json") -Raw | ConvertFrom-Json
$version = $pkgJson.version
$releaseName = "TeacherAssistant-v$version"
$releaseDir = Join-Path $repoRoot "release\$releaseName"
$zipPath = Join-Path $repoRoot "release\$releaseName-Windows-Portable.zip"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host " Building $releaseName" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

# 1. Build frontend
if (-not $SkipBuild) {
    Write-Host "`n[1/6] Building frontend (Vite)..." -ForegroundColor Cyan
    Push-Location $repoRoot
    try {
        npm run build
    } finally {
        Pop-Location
    }
}

# 2. Download portable Node.js if needed
Write-Host "`n[2/6] Ensuring portable Node.js..." -ForegroundColor Cyan
& (Join-Path $PSScriptRoot "download-node-portable.ps1")
$portableNodeExe = Join-Path $repoRoot "node-portable\node.exe"

# 3. Clean and create release directory
Write-Host "`n[3/6] Preparing release directory..." -ForegroundColor Cyan
Get-Process -Name "node" -ErrorAction SilentlyContinue | Where-Object { $_.Path -like "$releaseDir*" } | ForEach-Object {
    Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue
}
Start-Sleep -Milliseconds 300
if (Test-Path $releaseDir) {
    Remove-Item $releaseDir -Recurse -Force
}
New-Item -ItemType Directory -Path $releaseDir -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $releaseDir "node") -Force | Out-Null

# 4. Copy required runtime files
Write-Host "`n[4/6] Copying application files..." -ForegroundColor Cyan

# Built frontend and pre-bundled backend server
Copy-Item (Join-Path $repoRoot "dist") -Destination (Join-Path $releaseDir "dist") -Recurse
Copy-Item (Join-Path $repoRoot "dist-server") -Destination (Join-Path $releaseDir "dist-server") -Recurse

# Root files
$rootFiles = @(
    ".env.example", "README.md",
    "start-app.bat", "start-app.sh", "start-internal-site.bat", "start-internal-site.sh",
    "start-app-hidden.vbs", "stop-app.bat", "setup-env.ps1", "setup-env.sh"
)
foreach ($file in $rootFiles) {
    $filePath = Join-Path $repoRoot $file
    if (Test-Path $filePath) {
        Copy-Item $filePath -Destination (Join-Path $releaseDir $file)
    }
}

if (Test-Path (Join-Path $repoRoot "QUICKSTART.txt")) {
    Copy-Item (Join-Path $repoRoot "QUICKSTART.txt") -Destination (Join-Path $releaseDir "QUICKSTART.txt")
}

# Public assets (icons)
if (Test-Path (Join-Path $repoRoot "public")) {
    Copy-Item (Join-Path $repoRoot "public") -Destination (Join-Path $releaseDir "public") -Recurse
}

# Startup helper scripts
if (Test-Path (Join-Path $repoRoot "scripts\startup")) {
    New-Item -ItemType Directory -Path (Join-Path $releaseDir "scripts\startup") -Force | Out-Null
    Copy-Item (Join-Path $repoRoot "scripts\startup\*") -Destination (Join-Path $releaseDir "scripts\startup") -Recurse
}

# Copy portable Node.js
Copy-Item $portableNodeExe -Destination (Join-Path $releaseDir "node\node.exe")

# 5. Assemble minimal runtime native dependencies (better-sqlite3, bcrypt, node-gyp-build, bindings)
Write-Host "`n[5/6] Assembling minimal runtime native dependencies..." -ForegroundColor Cyan
$runtimePkg = @{
    name = "teacher-assistant"
    version = $version
    private = $true
    dependencies = @{
        "better-sqlite3" = $pkgJson.dependencies."better-sqlite3"
        "bcrypt" = $pkgJson.dependencies."bcrypt"
    }
} | ConvertTo-Json
Set-Content -Path (Join-Path $releaseDir "package.json") -Value $runtimePkg -Encoding utf8

$releaseNodeModules = Join-Path $releaseDir "node_modules"
New-Item -ItemType Directory -Path $releaseNodeModules -Force | Out-Null

$nativeDeps = @("better-sqlite3", "bcrypt", "node-gyp-build", "bindings", "file-uri-to-path")
foreach ($dep in $nativeDeps) {
    $srcDep = Join-Path $repoRoot "node_modules\$dep"
    if (Test-Path $srcDep) {
        Copy-Item $srcDep -Destination $releaseNodeModules -Recurse -Force
    }
}

# 6. Create Zip archive
if (-not $SkipZip) {
    Write-Host "`n[6/6] Creating portable ZIP archive: $zipPath..." -ForegroundColor Cyan
    if (Test-Path $zipPath) {
        Remove-Item $zipPath -Force
    }
    if (Get-Command "tar.exe" -ErrorAction SilentlyContinue) {
        tar.exe -a -cf "$zipPath" -C "$releaseDir" .
    } else {
        Compress-Archive -Path "$releaseDir\*" -DestinationPath $zipPath -Force
    }
    Write-Host "Archive created successfully ($([math]::Round((Get-Item $zipPath).Length / 1MB, 2)) MB)" -ForegroundColor Green
}

Write-Host "`n========================================" -ForegroundColor Green
Write-Host " Release build complete!" -ForegroundColor Green
Write-Host " Directory: $releaseDir" -ForegroundColor White
if (-not $SkipZip) {
    Write-Host " Archive  : $zipPath" -ForegroundColor White
}
Write-Host "========================================" -ForegroundColor Green
