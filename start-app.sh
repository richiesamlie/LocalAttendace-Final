#!/bin/bash

# Teacher Assistant Startup Script (Linux/macOS)
# This script starts the server and opens the browser

# Change to script directory
cd "$(dirname "$0")"

# Check if node_modules exists, install if not
if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    npm install
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

# Start the Node.js server
if [ "$MODE" == "debug" ]; then
    echo "Starting Teacher Assistant Server in Debug Mode..."
    npm run dev
else
    echo "Building the application for production..."
    npm run build
    echo "Starting Teacher Assistant Server in Production Mode..."
    export NODE_ENV=production
    npm run start
fi
