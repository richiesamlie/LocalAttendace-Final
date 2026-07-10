#!/bin/bash

# Teacher Assistant Startup Script (Linux/macOS)
# This script starts the server and opens the browser

# Change to script directory
cd "$(dirname "$0")"

# Ensure Bun is installed (used for package management and building the frontend)
if ! command -v bun >/dev/null 2>&1; then
    echo ""
    echo "ERROR: Bun is not installed or not in PATH."
    echo "Install Bun first (required for frontend tooling): https://bun.sh/"
    echo ""
    exit 1
fi

# Ensure Node.js is installed (required for executing the Express backend consistently)
if ! command -v node >/dev/null 2>&1; then
    echo ""
    echo "ERROR: Node.js is not installed or not in PATH."
    echo "Node.js is required to execute the backend server."
    echo "Install Node.js first: https://nodejs.org/"
    echo ""
    exit 1
fi

echo "Installing dependencies with Bun..."
bun install --frozen-lockfile
if [ $? -ne 0 ]; then
    echo ""
    echo "ERROR: Dependency installation failed!"
    echo ""
    echo "Try running: bun install"
    echo "If that fails, try: rm -rf node_modules && bun install"
    echo ""
    exit 1
fi

# Check if .env file exists - required before the server can start
if [ ! -f ".env" ]; then
    echo ""
    echo "ERROR: .env file not found!"
    echo ""
    echo "The app requires JWT_SECRET and DEFAULT_ADMIN_PASSWORD to be set."
    echo "Run the setup script to generate secure values automatically:"
    echo ""
    echo "  bash setup-env.sh"
    echo ""
    echo "Then re-run this script."
    exit 1
fi

# Check that DEFAULT_ADMIN_PASSWORD is present in .env
if ! grep -q "DEFAULT_ADMIN_PASSWORD" .env; then
    echo ""
    echo "ERROR: DEFAULT_ADMIN_PASSWORD is missing from .env!"
    echo "The server will not start without it."
    echo ""
    echo "Run: bash setup-env.sh   (to add it automatically)"
    exit 1
fi

# Function to open browser (cross-platform)
open_browser() {
    local URL="http://127.0.0.1:3000"
    sleep 5  # Wait for server to start

    if command -v xdg-open &> /dev/null; then
        xdg-open "$URL"  # Linux
    elif command -v open &> /dev/null; then
        open "$URL"      # macOS
    else
        echo "Server started. Please open $URL in your browser."
    fi
}

# Open browser in background
open_browser &

# Check for debug param
MODE="production"
for arg in "$@"; do
    if [ "$arg" == "--debug" ]; then
        MODE="debug"
    fi
done

# Start the app server
if [ "$MODE" == "debug" ]; then
    echo "Starting Teacher Assistant Server in Debug Mode via Node.js..."
    npx tsx server.ts
else
    echo "Building the application for production..."
    bun run build
    if [ $? -ne 0 ]; then
        echo ""
        echo "ERROR: Build failed!"
        echo ""
        echo "Try running: bun run build"
        echo "Check the error messages above for details."
        echo ""
        exit 1
    fi
    echo "Starting Teacher Assistant Server in Production Mode via Node.js..."
    export NODE_ENV=production
    # Local production mode runs on plain HTTP (http://127.0.0.1:3000).
    # Use non-secure cookies so auth persists across requests.
    export COOKIE_SECURE=false
    npx tsx server.ts
fi
