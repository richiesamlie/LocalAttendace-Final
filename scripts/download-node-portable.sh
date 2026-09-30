#!/usr/bin/env bash
# Downloads official portable Node.js binary for Windows x64 (defaults to latest)
set -euo pipefail

NODE_VERSION="${1:-latest}"
DEST_DIR="${2:-$(dirname "$0")/../node-portable}"
TARGET_EXE="${DEST_DIR}/node.exe"
VERSION_MARKER="${DEST_DIR}/version.txt"

mkdir -p "$DEST_DIR"

if [ "$NODE_VERSION" = "latest" ]; then
    echo "Resolving latest Node.js release from nodejs.org..."
    ZIP_NAME=$(curl -fsSL https://nodejs.org/dist/latest/SHASUMS256.txt | grep -o 'node-v[0-9.]*-win-x64\.zip' | head -n 1)
    if [ -z "$ZIP_NAME" ]; then
        echo "Error: Could not resolve latest Windows x64 release"
        exit 1
    fi
    NODE_VERSION=$(echo "$ZIP_NAME" | sed -E 's/node-(v[0-9.]+)-win-x64\.zip/\1/')
    ZIP_URL="https://nodejs.org/dist/latest/${ZIP_NAME}"
else
    if [[ ! "$NODE_VERSION" =~ ^v ]]; then
        NODE_VERSION="v${NODE_VERSION}"
    fi
    ZIP_NAME="node-${NODE_VERSION}-win-x64.zip"
    ZIP_URL="https://nodejs.org/dist/${NODE_VERSION}/${ZIP_NAME}"
fi

if [ -f "$TARGET_EXE" ] && [ -f "$VERSION_MARKER" ]; then
    CACHED_VER=$(cat "$VERSION_MARKER")
    if [ "$CACHED_VER" = "$NODE_VERSION" ]; then
        echo "Portable Node.js (${NODE_VERSION}) already exists: ${TARGET_EXE}"
        exit 0
    fi
fi

TEMP_ZIP="${DEST_DIR}/node-temp.zip"

echo "Downloading latest portable Node.js ${NODE_VERSION} from ${ZIP_URL}..."
curl -fsSL "$ZIP_URL" -o "$TEMP_ZIP"

echo "Extracting node.exe..."
unzip -j -o -q "$TEMP_ZIP" "*/node.exe" -d "$DEST_DIR"
echo "$NODE_VERSION" > "$VERSION_MARKER"
rm -f "$TEMP_ZIP"

echo "Done: ${TARGET_EXE} (${NODE_VERSION})"
