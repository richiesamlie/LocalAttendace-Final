#!/bin/bash
# Clean Database Script (Linux/macOS)
# Deletes the SQLite database and creates a fresh one on next server start

set -e

FORCE=false
BACKUP=false

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --force|-f)
            FORCE=true
            shift
            ;;
        --backup|-b)
            BACKUP=true
            shift
            ;;
        *)
            echo "Unknown option: $1"
            echo "Usage: $0 [--force|-f] [--backup|-b]"
            exit 1
            ;;
    esac
done

echo ""
echo "========================================"
echo " Clean Database"
echo "========================================"
echo ""

# Confirm if not forced
if [ "$FORCE" = false ]; then
    echo "⚠️  This will DELETE all database data!"
    echo ""
    read -p "Are you sure? (yes/no): " confirm
    if [ "$confirm" != "yes" ]; then
        echo ""
        echo "Cancelled."
        echo ""
        exit 0
    fi
    echo ""
fi

# Check if server is running and stop it
echo "🔍 Checking for running server..."

if command -v lsof &> /dev/null; then
    PID=$(lsof -ti:3000 2>/dev/null || true)
elif command -v ss &> /dev/null; then
    PID=$(ss -lptn "sport = :3000" 2>/dev/null | grep -oP 'pid=\K\d+' | head -1 || true)
elif command -v netstat &> /dev/null; then
    PID=$(netstat -nlp 2>/dev/null | grep :3000 | awk '{print $7}' | cut -d'/' -f1 | head -1 || true)
else
    PID=""
fi

if [ -n "$PID" ] && ps -p "$PID" > /dev/null 2>&1; then
    echo "⚠️  Server is running on port 3000"
    echo "   Stopping server to avoid database locks..."
    kill "$PID" 2>/dev/null || true
    sleep 1
    if ps -p "$PID" > /dev/null 2>&1; then
        kill -9 "$PID" 2>/dev/null || true
    fi
    echo "   ✓ Server stopped"
fi

# Backup if requested
if [ "$BACKUP" = true ] && [ -f "database.sqlite" ]; then
    timestamp=$(date +%Y-%m-%d_%H%M%S)
    backup_path="backups/db-clean-$timestamp.sqlite"
    
    mkdir -p backups
    cp database.sqlite "$backup_path"
    echo "💾 Backup created: $backup_path"
fi

# Delete database files
echo "🗑️  Deleting database files..."

deleted_count=0
for file in database.sqlite database.sqlite-wal database.sqlite-shm; do
    if [ -f "$file" ]; then
        if rm -f "$file" 2>/dev/null; then
            echo "   ✓ Deleted $file"
            ((deleted_count++))
        else
            echo "   ✗ Could not delete $file (may be locked)"
        fi
    fi
done

echo ""
if [ $deleted_count -eq 0 ]; then
    echo "ℹ️  No database files found"
else
    echo "✅ Database cleaned successfully!"
    echo ""
    echo "📝 Next steps:"
    echo "   1. Run: npm run dev"
    echo "   2. Login with: admin / teacher123"
fi

echo ""
