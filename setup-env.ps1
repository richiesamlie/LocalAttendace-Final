# setup-env.ps1
# Setup script for Teacher Assistant App - Windows PowerShell
# Generates secure passwords and sets up the .env file
# Usage: .\setup-env.ps1

$envFile = Join-Path $PSScriptRoot ".env"

Write-Host "Setting up secure environment for Teacher Assistant App..." -ForegroundColor Cyan
Write-Host ""

function Generate-RandomBase64 {
    param([int]$bytes = 32)
    $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    $buf = New-Object byte[] $bytes
    $rng.GetBytes($buf)
    return [Convert]::ToBase64String($buf)
}

function Generate-RandomHex {
    param([int]$bytes = 32)
    $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    $buf = New-Object byte[] $bytes
    $rng.GetBytes($buf)
    return ($buf | ForEach-Object { $_.ToString("x2") }) -join ""
}

# Read existing .env content (if any)
$existingContent = ""
if (Test-Path $envFile) {
    $existingContent = Get-Content $envFile -Raw
}

# Append DEFAULT_ADMIN_PASSWORD if missing
if ($existingContent -notmatch "DEFAULT_ADMIN_PASSWORD") {
    $adminPw = Generate-RandomBase64 -bytes 32
    Add-Content $envFile "DEFAULT_ADMIN_PASSWORD=$adminPw"
    Write-Host "  [OK] Generated DEFAULT_ADMIN_PASSWORD" -ForegroundColor Green
} else {
    Write-Host "  [SKIP] DEFAULT_ADMIN_PASSWORD already set" -ForegroundColor Yellow
}

# Append JWT_SECRET if missing
if ($existingContent -notmatch "JWT_SECRET") {
    $jwtSecret = Generate-RandomHex -bytes 32
    Add-Content $envFile "JWT_SECRET=$jwtSecret"
    Write-Host "  [OK] Generated JWT_SECRET" -ForegroundColor Green
} else {
    Write-Host "  [SKIP] JWT_SECRET already set" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Your .env file:" -ForegroundColor Cyan
Write-Host "  $envFile" -ForegroundColor Gray
Get-Content $envFile | ForEach-Object { Write-Host "  $_" -ForegroundColor Gray }

Write-Host ""
Write-Host "Setup complete! You can now run: docker-compose up -d" -ForegroundColor Green
Write-Host ""
Write-Host "IMPORTANT: Keep your .env file secure - never commit it to git!" -ForegroundColor Red
