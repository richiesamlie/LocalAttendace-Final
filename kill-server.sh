#!/bin/bash
# Kill Server Script (Linux/macOS)
# Terminates the development server running on port 3000

set -e

echo ""
echo "========================================"
echo " Stopping Teacher Assistant Server"
echo "========================================"
echo ""

# Find process using port 3000
echo "🔍 Looking for server process on port 3000..."

# Try different methods to find the process
if command -v lsof &> /dev/null; then
    # Use lsof if available (most Unix systems)
    PID=$(lsof -ti:3000 2>/dev/null || true)
elif command -v ss &> /dev/null; then
    # Use ss if available (modern Linux)
    PID=$(ss -lptn "sport = :3000" 2>/dev/null | grep -oP 'pid=\K\d+' | head -1 || true)
elif command -v netstat &> /dev/null; then
    # Fallback to netstat
    PID=$(netstat -nlp 2>/dev/null | grep :3000 | awk '{print $7}' | cut -d'/' -f1 | head -1 || true)
else
    echo "❌ Error: Unable to find process (lsof, ss, or netstat required)"
    echo ""
    echo "💡 Alternative: Use Ctrl+C in the server terminal"
    exit 1
fi

if [ -z "$PID" ]; then
    echo "ℹ️  No server running on port 3000"
elif ! ps -p "$PID" > /dev/null 2>&1; then
    echo "ℹ️  No server running on port 3000"
else
    PROCESS_NAME=$(ps -p "$PID" -o comm= 2>/dev/null || echo "unknown")
    echo "✓ Found process: $PROCESS_NAME (PID: $PID)"
    echo "⚠️  Terminating process..."
    
    # Try graceful kill first
    kill "$PID" 2>/dev/null || true
    sleep 1
    
    # Force kill if still running
    if ps -p "$PID" > /dev/null 2>&1; then
        echo "⚠️  Forcing termination..."
        kill -9 "$PID" 2>/dev/null || true
        sleep 0.5
    fi
    
    # Verify process is stopped
    if ps -p "$PID" > /dev/null 2>&1; then
        echo "❌ Failed to stop server (PID: $PID may still be running)"
        exit 1
    else
        echo "✅ Server stopped successfully"
    fi
fi

echo ""
echo "Done!"
echo ""
