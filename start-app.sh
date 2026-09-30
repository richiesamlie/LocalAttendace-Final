#!/bin/bash

# Teacher Assistant Startup Script (Linux/macOS)
# This script starts the server and opens the browser

# Change to script directory
cd "$(dirname "$0")"

# Ensure Node.js is installed (required for executing the Express backend consistently)
if ! command -v node >/dev/null 2>&1; then
    echo ""
    echo "ERROR: Node.js is not installed or not in PATH."
    echo "Node.js is required to execute the backend server."
    echo "Install Node.js first: https://nodejs.org/"
    echo ""
    exit 1
fi

if [ ! -d "node_modules" ]; then
    echo "Installing dependencies with npm..."
    npm install --omit=dev --no-audit --no-fund
    if [ $? -ne 0 ]; then
        echo ""
        echo "ERROR: Dependency installation failed!"
        echo "Try running: npm install"
        echo ""
        exit 1
    fi
fi

# Auto-generate .env file if missing
if [ ! -f ".env" ]; then
    echo "First-time setup: generating .env configuration..."
    node -e "const fs=require('fs'); const crypto=require('crypto'); let ex=''; try{ex=fs.readFileSync('.env.example','utf8');}catch(e){}; const jwt=crypto.randomBytes(32).toString('hex'); const pass='admin123'; let out = ex ? ex.replace('JWT_SECRET=change_this_to_a_secure_random_string','JWT_SECRET='+jwt).replace('DEFAULT_ADMIN_PASSWORD=change_this_to_a_secure_password','DEFAULT_ADMIN_PASSWORD='+pass) : 'JWT_SECRET='+jwt+'\nDEFAULT_ADMIN_PASSWORD='+pass+'\n'; fs.writeFileSync('.env', out, 'utf8'); console.log('[setup] Generated .env file automatically.'); console.log('[setup] Initial admin login: admin / admin123');"
fi

# Function to open browser (cross-platform)
open_browser() {
    local URL="http://127.0.0.1:3000"

    if command -v xdg-open &> /dev/null; then
        xdg-open "$URL"  # Linux
    elif command -v open &> /dev/null; then
        open "$URL"      # macOS
    else
        echo "Server started. Please open $URL in your browser."
    fi
}

# Wait until server responds, then open browser in background
wait_and_open_browser() {
    local URL="http://127.0.0.1:3000"
    local retries=120

    while [ "$retries" -gt 0 ]; do
        if command -v curl >/dev/null 2>&1; then
            if curl -fsS "$URL" >/dev/null 2>&1; then
                open_browser
                return
            fi
        elif command -v wget >/dev/null 2>&1; then
            if wget -q --spider "$URL" >/dev/null 2>&1; then
                open_browser
                return
            fi
        else
            sleep 5
            open_browser
            return
        fi

        retries=$((retries - 1))
        sleep 1
    done
}

wait_and_open_browser &

# Check for debug / network params
MODE="production"
EXTRA_ARGS=()
for arg in "$@"; do
    if [ "$arg" == "--debug" ]; then
        MODE="debug"
    elif [ "$arg" == "--network" ]; then
        EXTRA_ARGS+=("--network")
    fi
done

# Start the app server
if [ "$MODE" == "debug" ]; then
    echo "Starting Teacher Assistant Server in Debug Mode via Node.js..."
    npx tsx server.ts "${EXTRA_ARGS[@]}"
else
    if [ -f "dist/index.html" ]; then
        echo "Build already exists, skipping build. (Delete dist/ to rebuild)"
    else
        echo "Building the application for production..."
        npm run build
        if [ $? -ne 0 ]; then
            echo ""
            echo "ERROR: Build failed!"
            echo "Try running: npm run build"
            echo ""
            exit 1
        fi
    fi
    echo "Starting Teacher Assistant Server in Production Mode via Node.js..."
    export NODE_ENV=production
    # Local production mode runs on plain HTTP (http://127.0.0.1:3000).
    # Use non-secure cookies so auth persists across requests.
    export COOKIE_SECURE=false
    npx tsx server.ts "${EXTRA_ARGS[@]}"
fi
