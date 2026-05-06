#!/usr/bin/env pwsh
# Setup Environment Variables Script (Windows/PowerShell)
# Generates .env file with secure random values for JWT_SECRET and DEFAULT_ADMIN_PASSWORD

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host " Teacher Assistant - Environment Setup" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if .env already exists
if (Test-Path ".env") {
    Write-Host "⚠️  Warning: .env file already exists!" -ForegroundColor Yellow
    Write-Host ""
    $response = Read-Host "Do you want to overwrite it? (yes/no)"
    
    if ($response -ne "yes" -and $response -ne "y") {
        Write-Host ""
        Write-Host "❌ Setup cancelled. Existing .env file preserved." -ForegroundColor Red
        Write-Host ""
        exit 0
    }
    
    # Backup existing .env
    $timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
    $backupFile = ".env.backup.$timestamp"
    Copy-Item ".env" $backupFile
    Write-Host "✅ Backed up existing .env to $backupFile" -ForegroundColor Green
    Write-Host ""
}

# Generate secure random values
Write-Host "🔐 Generating secure random values..." -ForegroundColor Cyan

# Generate JWT_SECRET (64 character hex string)
$jwtBytes = New-Object byte[] 32
[System.Security.Cryptography.RandomNumberGenerator]::Fill($jwtBytes)
$JWT_SECRET = [System.BitConverter]::ToString($jwtBytes).Replace("-", "").ToLower()

# Generate DEFAULT_ADMIN_PASSWORD (16 character alphanumeric + special)
$passwordChars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*"
$DEFAULT_ADMIN_PASSWORD = -join ((1..16) | ForEach-Object { $passwordChars[(Get-Random -Maximum $passwordChars.Length)] })

Write-Host "✅ Generated JWT_SECRET (64 characters)" -ForegroundColor Green
Write-Host "✅ Generated DEFAULT_ADMIN_PASSWORD (16 characters)" -ForegroundColor Green
Write-Host ""

# Read .env.example and replace placeholders
Write-Host "📝 Creating .env file from .env.example..." -ForegroundColor Cyan

if (-not (Test-Path ".env.example")) {
    Write-Host "❌ Error: .env.example file not found!" -ForegroundColor Red
    Write-Host "   Please ensure you're running this script from the project root directory." -ForegroundColor Red
    exit 1
}

$envContent = Get-Content ".env.example" -Raw

# Replace placeholders with generated values
$envContent = $envContent -replace "JWT_SECRET=change_this_to_a_secure_random_string", "JWT_SECRET=$JWT_SECRET"
$envContent = $envContent -replace "DEFAULT_ADMIN_PASSWORD=change_this_to_a_secure_password", "DEFAULT_ADMIN_PASSWORD=$DEFAULT_ADMIN_PASSWORD"

# Add generation timestamp
$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
$envContent = $envContent -replace "# Teacher Assistant App", "# Teacher Assistant App - Generated on $timestamp"

# Write to .env file
$envContent | Out-File -FilePath ".env" -Encoding UTF8 -NoNewline

Write-Host "✅ Created .env file with secure credentials" -ForegroundColor Green
Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host " Setup Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "📋 Your admin credentials:" -ForegroundColor Yellow
Write-Host ""
Write-Host "   Username: admin" -ForegroundColor White
Write-Host "   Password: $DEFAULT_ADMIN_PASSWORD" -ForegroundColor White
Write-Host ""
Write-Host "⚠️  IMPORTANT: Save these credentials securely!" -ForegroundColor Yellow
Write-Host "   The password is stored in the .env file" -ForegroundColor Yellow
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "  1. Review and customize .env file if needed" -ForegroundColor White
Write-Host "  2. Run: npm install" -ForegroundColor White
Write-Host "  3. Run: npm run dev" -ForegroundColor White
Write-Host ""
Write-Host "💡 Tip: You can customize performance monitoring thresholds in .env" -ForegroundColor Gray
Write-Host "   See PERFORMANCE.md for details" -ForegroundColor Gray
Write-Host ""
