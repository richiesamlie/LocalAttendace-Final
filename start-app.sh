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

# Check if .env file exists
if [ ! -f ".env" ]; then
    echo ""
    echo "WARNING: .env file not found!"
    echo "Creating .env with default settings..."
    echo "JWT_SECRET=localattendance_secret_key_change_in_production" > .env
    echo ""
    echo "IMPORTANT: Change the JWT_SECRET in .env for production use!"
    echo ""
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

# Start the Node.js server
echo "Starting Teacher Assistant Server..."
npm run dev
