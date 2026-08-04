@echo off
setlocal EnableDelayedExpansion
REM PostgreSQL Setup Script for Teacher Assistant App (Windows)

echo === PostgreSQL Setup for Teacher Assistant ===
echo.

REM Check if PostgreSQL is installed
where psql >nul 2>nul
if !errorlevel! neq 0 (
    echo Error: PostgreSQL is not installed.
    echo Please install PostgreSQL first: https://www.postgresql.org/download/windows/
    exit /b 1
)

REM Database configuration (allow override via environment variables)
if not defined DB_NAME set "DB_NAME=teacher_assistant"
if not defined DB_USER set "DB_USER=postgres"
if not defined DB_HOST set "DB_HOST=localhost"
if not defined DB_PORT set "DB_PORT=5432"

echo Configuration:
echo   Database: !DB_NAME!
echo   User: !DB_USER!
echo   Host: !DB_HOST!:!DB_PORT!
echo.

REM Check schema file exists
REM Note: The app uses src/db/schema.ts which auto-creates tables on startup.
REM The PostgreSQL schema is applied automatically when the server starts
REM with DATABASE_URL set. No manual SQL file import is needed.
if not exist "src\db\schema.ts" (
    echo Error: src\db\schema.ts not found.
    echo The schema is applied automatically on server startup.
    exit /b 1
)

REM Create database
echo Creating database '!DB_NAME!'...
psql -U "!DB_USER!" -h "!DB_HOST!" -p "!DB_PORT!" -c "DROP DATABASE IF EXISTS !DB_NAME!;" 2>nul
psql -U "!DB_USER!" -h "!DB_HOST!" -p "!DB_PORT!" -c "CREATE DATABASE !DB_NAME!;"
if !errorlevel! neq 0 (
    echo Error: Could not create database. Check your PostgreSQL credentials/permissions.
    exit /b 1
)
echo Database created successfully.
echo.

REM Schema is applied automatically by the server on startup via src/db/schema.ts
echo Schema will be applied automatically when the server starts.
echo.

REM Optional migration from SQLite
REM Note: SQLite-to-PostgreSQL migration is not yet implemented.
REM To migrate data, export from SQLite and import manually, or
REM start fresh with PostgreSQL (schema is auto-applied on startup).
if exist "database.sqlite" (
    echo Found existing SQLite database.
    echo Note: Automatic migration is not available.
    echo To start fresh, delete database.sqlite and restart the server.
    echo.
)

REM Create .env file if it doesn't exist
if not exist ".env" (
    echo Creating .env file...
    (
        echo # Database ^(PostgreSQL^)
        echo # Set your PostgreSQL password in DATABASE_URL
        echo DATABASE_URL=postgresql://!DB_USER!:CHANGE_ME@!DB_HOST!:!DB_PORT!/!DB_NAME!
        echo.
        echo # Security ^(required^)
        echo JWT_SECRET=change_this_to_a_secure_random_string
        echo DEFAULT_ADMIN_PASSWORD=change_this_to_a_secure_password
    ) > .env

    echo.
    echo IMPORTANT: Edit .env and set a real PostgreSQL password in DATABASE_URL,
    echo or run .\setup-env.ps1 to generate secure app secrets.
    echo.
)

echo Setup complete!
echo.
echo Next steps:
echo   1. Update DATABASE_URL password in .env
if exist ".env" (
    echo   2. Run: bun run dev
) else (
    echo   2. Create .env then run: bun run dev
)
