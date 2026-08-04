#!/bin/bash
# PostgreSQL Setup Script for Teacher Assistant App

set -e

echo "=== PostgreSQL Setup for Teacher Assistant ==="
echo ""

# Check if PostgreSQL is installed
if ! command -v psql >/dev/null 2>&1; then
  echo "Error: PostgreSQL is not installed."
  echo "Please install PostgreSQL first:"
  echo "  macOS: brew install postgresql && brew services start postgresql"
  echo "  Ubuntu: sudo apt-get install postgresql postgresql-contrib"
  echo "  Windows: Download from https://www.postgresql.org/download/windows/"
  exit 1
fi

# Database configuration (allow override via environment variables)
DB_NAME="${DB_NAME:-teacher_assistant}"
DB_USER="${DB_USER:-postgres}"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"

echo "Configuration:"
echo "  Database: $DB_NAME"
echo "  User: $DB_USER"
echo "  Host: $DB_HOST:$DB_PORT"
echo ""

# Check schema file exists
# Note: The app uses src/db/schema.ts which auto-creates tables on startup.
# The PostgreSQL schema is applied automatically when the server starts
# with DATABASE_URL set. No manual SQL file import is needed.
if [ ! -f "src/db/schema.ts" ]; then
  echo "Error: src/db/schema.ts not found."
  echo "The schema is applied automatically on server startup."
  exit 1
fi

# Create database
echo "Creating database '$DB_NAME'..."
psql -U "$DB_USER" -h "$DB_HOST" -p "$DB_PORT" -c "DROP DATABASE IF EXISTS $DB_NAME;" 2>/dev/null || true
psql -U "$DB_USER" -h "$DB_HOST" -p "$DB_PORT" -c "CREATE DATABASE $DB_NAME;" || {
  echo "Error: Could not create database. Check your PostgreSQL credentials/permissions."
  exit 1
}
echo "Database created successfully."
echo ""

# Schema is applied automatically by the server on startup via src/db/schema.ts
echo "Schema will be applied automatically when the server starts."
echo ""

# Check if SQLite database exists for migration
if [ -f "database.sqlite" ]; then
  echo "Found existing SQLite database."
  echo "Note: Automatic migration is not available."
  echo "To start fresh, delete database.sqlite and restart the server."
  echo ""
fi

# Create .env file if it doesn't exist
if [ ! -f ".env" ]; then
  echo "Creating .env file..."
  cat > .env <<EOF
# Database (PostgreSQL)
# Set your PostgreSQL password in DATABASE_URL
DATABASE_URL=postgresql://${DB_USER}:CHANGE_ME@${DB_HOST}:${DB_PORT}/${DB_NAME}

# Security (required)
JWT_SECRET=change_this_to_a_secure_random_string
DEFAULT_ADMIN_PASSWORD=change_this_to_a_secure_password
EOF

  echo ""
  echo "IMPORTANT: Edit .env and set a real PostgreSQL password in DATABASE_URL," 
  echo "or run: bash setup-env.sh to generate secure app secrets."
  echo ""
fi

echo "Setup complete!"
echo ""
echo "Next steps:"
echo "  1. Update DATABASE_URL password in .env"
echo "  2. Run: bun run dev"
