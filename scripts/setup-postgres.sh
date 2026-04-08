#!/bin/bash
# PostgreSQL Setup Script for Teacher Assistant App

set -e

echo "=== PostgreSQL Setup for Teacher Assistant ==="
echo ""

# Check if PostgreSQL is installed
if ! command -v psql &> /dev/null; then
    echo "Error: PostgreSQL is not installed."
    echo "Please install PostgreSQL first:"
    echo "  macOS: brew install postgresql && brew services start postgresql"
    echo "  Ubuntu: sudo apt-get install postgresql postgresql-contrib"
    echo "  Windows: Download from https://www.postgresql.org/download/windows/"
    exit 1
fi

# Database configuration
DB_NAME="${DB_NAME:-teacher_assistant}"
DB_USER="${DB_USER:-postgres}"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"

echo "Configuration:"
echo "  Database: $DB_NAME"
echo "  User: $DB_USER"
echo "  Host: $DB_HOST:$DB_PORT"
echo ""

# Create database
echo "Creating database '$DB_NAME'..."
psql -U "$DB_USER" -h "$DB_HOST" -p "$DB_PORT" -c "DROP DATABASE IF EXISTS $DB_NAME;" 2>/dev/null || true
psql -U "$DB_USER" -h "$DB_HOST" -p "$DB_PORT" -c "CREATE DATABASE $DB_NAME;" || {
    echo "Error: Could not create database. Check your PostgreSQL credentials."
    exit 1
}
echo "Database created successfully."
echo ""

# Run schema
echo "Running database schema..."
psql -U "$DB_USER" -h "$DB_HOST" -p "$DB_PORT" -d "$DB_NAME" -f src/repositories/schema.sql
echo "Schema applied successfully."
echo ""

# Check if SQLite database exists for migration
if [ -f "database.sqlite" ]; then
    echo "Found SQLite database. Do you want to migrate data? (y/n)"
    read -r response
    if [[ "$response" =~ ^[Yy]$ ]]; then
        echo "Migrating data from SQLite to PostgreSQL..."
        npx tsx src/repositories/migrate.ts
        echo "Migration complete."
        echo ""
    fi
fi

# Create .env file if it doesn't exist
if [ ! -f ".env" ]; then
    echo "Creating .env file..."
    cat > .env << EOF
# Database
DATABASE_URL=postgresql://${DB_USER}@${DB_HOST}:${DB_PORT}/${DB_NAME}

# Optional: JWT Secret (a default is used if not set)
# JWT_SECRET=your_secret_key_here
EOF
    echo ".env file created."
    echo ""
fi

echo "=== Setup Complete! ==="
echo ""
echo "To start the app with PostgreSQL:"
echo "  npm run dev"
echo ""
echo "Or manually:"
echo "  DATABASE_URL=postgresql://${DB_USER}@${DB_HOST}:${DB_PORT}/${DB_NAME} npm run dev"