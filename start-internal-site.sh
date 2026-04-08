#!/bin/bash

echo "==================================================="
echo "Starting Teacher Assistant as an Internal Site"
echo "==================================================="
echo ""

# Change directory to the location of this script
cd "$(dirname "$0")"

# Check if node_modules exists, if not, install dependencies automatically
if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    npm install
fi

# Check for debug param
MODE="production"
for arg in "$@"; do
    if [ "$arg" == "--debug" ]; then
        MODE="debug"
    fi
done

if [ "$MODE" == "debug" ]; then
    echo "Starting Teacher Assistant in Debug Mode (Network)..."
    npx tsx server.ts --network
else
    echo "Building the application for production..."
    npm run build

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
    npx tsx server.ts --network
fi
