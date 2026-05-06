#!/bin/bash
# Setup Environment Variables Script (Linux/macOS)
# Generates .env file with secure random values for JWT_SECRET and DEFAULT_ADMIN_PASSWORD

set -e

echo ""
echo "========================================"
echo " Teacher Assistant - Environment Setup"
echo "========================================"
echo ""

# Check if .env already exists
if [ -f ".env" ]; then
    echo "⚠️  Warning: .env file already exists!"
    echo ""
    read -p "Do you want to overwrite it? (yes/no): " response
    
    if [ "$response" != "yes" ] && [ "$response" != "y" ]; then
        echo ""
        echo "❌ Setup cancelled. Existing .env file preserved."
        echo ""
        exit 0
    fi
    
    # Backup existing .env
    timestamp=$(date +"%Y%m%d_%H%M%S")
    backup_file=".env.backup.$timestamp"
    cp ".env" "$backup_file"
    echo "✅ Backed up existing .env to $backup_file"
    echo ""
fi

# Generate secure random values
echo "🔐 Generating secure random values..."

# Check if openssl is available
if ! command -v openssl &> /dev/null; then
    echo "❌ Error: openssl command not found!"
    echo "   Please install openssl to generate secure random values."
    exit 1
fi

# Generate JWT_SECRET (64 character hex string)
JWT_SECRET=$(openssl rand -hex 32)

# Generate DEFAULT_ADMIN_PASSWORD (32 character base64)
DEFAULT_ADMIN_PASSWORD=$(openssl rand -base64 24 | tr -d "/+=" | cut -c1-16)

echo "✅ Generated JWT_SECRET (64 characters)"
echo "✅ Generated DEFAULT_ADMIN_PASSWORD (16 characters)"
echo ""

# Read .env.example and replace placeholders
echo "📝 Creating .env file from .env.example..."

if [ ! -f ".env.example" ]; then
    echo "❌ Error: .env.example file not found!"
    echo "   Please ensure you're running this script from the project root directory."
    exit 1
fi

# Read .env.example, replace placeholders, and write to .env
timestamp=$(date +"%Y-%m-%d %H:%M:%S")
sed -e "s/JWT_SECRET=change_this_to_a_secure_random_string/JWT_SECRET=$JWT_SECRET/" \
    -e "s/DEFAULT_ADMIN_PASSWORD=change_this_to_a_secure_password/DEFAULT_ADMIN_PASSWORD=$DEFAULT_ADMIN_PASSWORD/" \
    -e "s/# Teacher Assistant App/# Teacher Assistant App - Generated on $timestamp/" \
    ".env.example" > ".env"

echo "✅ Created .env file with secure credentials"
echo ""
echo "========================================"
echo " Setup Complete!"
echo "========================================"
echo ""
echo "📋 Your admin credentials:"
echo ""
echo "   Username: admin"
echo "   Password: $DEFAULT_ADMIN_PASSWORD"
echo ""
echo "⚠️  IMPORTANT: Save these credentials securely!"
echo "   The password is stored in the .env file"
echo ""
echo "Next steps:"
echo "  1. Review and customize .env file if needed"
echo "  2. Run: npm install"
echo "  3. Run: npm run dev"
echo ""
echo "💡 Tip: You can customize performance monitoring thresholds in .env"
echo "   See PERFORMANCE.md for details"
echo ""