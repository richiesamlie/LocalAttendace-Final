#!/bin/bash
# Setup script for Teacher Assistant App - Easy Production Setup
# This script generates secure passwords and sets up the environment

echo "🔐 Setting up secure passwords for Teacher Assistant App..."

# Generate secure passwords if .env doesn't exist or is incomplete
if [ ! -f .env ] || ! grep -q "DEFAULT_ADMIN_PASSWORD" .env; then
    echo "✅ Generating secure admin password..."
    ADMIN_PW=$(openssl rand -base64 32)
    echo "DEFAULT_ADMIN_PASSWORD=$ADMIN_PW" >> .env
    echo "   Generated DEFAULT_ADMIN_PASSWORD"
fi

if [ ! -f .env ] || ! grep -q "JWT_SECRET" .env; then
    echo "✅ Generating secure JWT secret..."
    JWT_PW=$(openssl rand -hex 32)
    echo "JWT_SECRET=$JWT_PW" >> .env
    echo "   Generated JWT_SECRET"
fi

echo ""
echo "📋 Your .env file:"
cat .env
echo ""
echo "✅ Setup complete! You can now run: docker-compose up -d"
echo ""
echo "⚠️  Important: Keep your .env file secure - never commit it to git!"