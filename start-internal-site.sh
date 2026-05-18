#!/bin/bash

echo "==================================================="
echo "Starting Teacher Assistant as an Internal Site"
echo "==================================================="
echo ""

# Change directory to the location of this script
cd "$(dirname "$0")"

# Ensure Bun is installed and install dependencies
if ! command -v bun >/dev/null 2>&1; then
    echo ""
    echo "ERROR: Bun is not installed or not in PATH."
    echo "Install Bun first: https://bun.sh/"
    echo ""
    exit 1
fi

echo "Installing dependencies with Bun..."
bun install --frozen-lockfile

# Check for debug param
MODE="production"
for arg in "$@"; do
    if [ "$arg" == "--debug" ]; then
        MODE="debug"
    fi
done

if [ "$MODE" == "debug" ]; then
    echo "Starting Teacher Assistant in Debug Mode (Network)..."
    bun run dev:network
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

    # Set NODE_ENV to production and start the server
    export NODE_ENV=production
    bun run start:network
fi
