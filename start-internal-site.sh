#!/bin/bash

echo "==================================================="
echo "Starting Teacher Assistant as an Internal Site"
echo "==================================================="
echo ""

# Change directory to the location of this script
cd "$(dirname "$0")"

# Ensure Bun is installed (used for frontend build / Vite)
if ! command -v bun >/dev/null 2>&1; then
    echo ""
    echo "ERROR: Bun is not installed or not in PATH."
    echo "Install Bun first: https://bun.sh/"
    echo ""
    exit 1
fi

# Ensure Node.js is installed (used to run the Express backend;
# better-sqlite3 native bindings do not load in Bun on Windows)
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

# Check for debug param
MODE="production"
for arg in "$@"; do
    if [ "$arg" == "--debug" ]; then
        MODE="debug"
    fi
done

if [ "$MODE" == "debug" ]; then
    echo "Starting Teacher Assistant in Debug Mode (Network) via Node.js..."
    npx tsx server.ts --network
else
    echo "Building the application for production..."
    bun run build

    echo ""
    echo "==================================================="
    echo "Server is starting..."
    echo "You can access the site from other computers on your network using your IP address."
    echo ""
    echo "To find your IP address, look for 'inet' below:"
    if command -v ip > /dev/null; then
        ip -4 addr show | grep -v "127.0.0.1" | grep inet
    elif command -v ifconfig > /dev/null; then
        ifconfig | grep -E "inet " | grep -v "127.0.0.1"
    fi
    echo ""
    echo "Example: If your IP is 192.168.1.5, open http://192.168.1.5:3000 on another device."
    echo "==================================================="
    echo ""

    # Set NODE_ENV to production and start the server via Node.js
    # (better-sqlite3 native bindings do not load in Bun on Windows)
    export NODE_ENV=production
    # Internal-site mode commonly runs on plain HTTP. Allow non-secure
    # cookies so auth persists across requests on trusted LAN deployments.
    export COOKIE_SECURE=false
    npx tsx server.ts --network
fi
