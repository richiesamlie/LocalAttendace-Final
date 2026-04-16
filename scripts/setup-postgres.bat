@echo off
REM PostgreSQL Setup Script for Teacher Assistant App (Windows)

echo === PostgreSQL Setup for Teacher Assistant ===
echo.

REM Check if PostgreSQL is installed
where psql >nul 2>nul
if %errorlevel% neq 0 (
    echo Error: PostgreSQL is not installed.
    echo Please install PostgreSQL first: https://www.postgresql.org/download/windows/
    exit /b 1
)

REM Database configuration
set DB_NAME=%DB_NAME%=teacher_assistant
set DB_USER=%DB_USER%=postgres
set DB_HOST=%DB_HOST%=localhost
set DB_PORT=%DB_PORT%=5432

echo Configuration:
echo   Database: %DB_NAME%
echo   User: %DB_USER%
echo   Host: %DB_HOST%:%DB_PORT%
echo.

REM Create database
echo Creating database '%DB_NAME%'...
psql -U "%DB_USER%" -h "%DB_HOST%" -p "%DB_PORT%" -c "DROP DATABASE IF EXISTS %DB_NAME%;" 2>nul
psql -U "%DB_USER%" -h "%DB_HOST%" -p "%DB_PORT%" -c "CREATE DATABASE %DB_NAME%;"
if %errorlevel% neq 0 (
    echo Error: Could not create database. Check your PostgreSQL credentials.
    exit /b 1
)
echo Database created successfully.
echo.

REM Run schema
echo Running database schema...
psql -U "%DB_USER%" -h "%DB_HOST%" -p "%DB_PORT%" -d "%DB_NAME%" -f src\repositories\schema.sql
echo Schema applied successfully.
echo.

REM Check if SQLite database exists for migration
if exist "database.sqlite" (
    set /p migrate="Found SQLite database. Migrate data to PostgreSQL? (y/n): "
    if /i "%migrate%"=="y" (
        echo Migrating data from SQLite to PostgreSQL...
        npx tsx src\repositories\migrate.ts
        echo Migration complete.
        echo.
    )
)

REM Create .env file if it doesn't exist
if not exist ".env" (
    echo Creating .env file...
    (
        echo # Database - PostgreSQL connection string
        echo DATABASE_URL=postgresql://%DB_USER%@%DB_HOST%:%DB_PORT%/%DB_NAME%
        echo.
        echo # REQUIRED - generate with: openssl rand -hex 32
        echo JWT_SECRET=change_this_to_a_secure_random_string
        echo.
        echo # REQUIRED - app will not start without this
        echo DEFAULT_ADMIN_PASSWORD=change_this_to_a_secure_password
    ) > .env
    echo .env file created.
    echo IMPORTANT: Edit .env and set secure values for JWT_SECRET and DEFAULT_ADMIN_PASSWORD!
    echo Or run .\setup-env.ps1 to generate them automatically.
    echo.
)

echo === Setup Complete! ===
echo.
echo To start the app with PostgreSQL:
echo   npm run dev
echo.
echo Or manually:
echo   set DATABASE_URL=postgresql://%DB_USER%@%DB_HOST%:%DB_PORT%/%DB_NAME%
echo   npm run dev