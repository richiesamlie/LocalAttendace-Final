#!/usr/bin/env bash
# Builds a portable release bundle (Linux/CI compatible)
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VERSION=$(node -p "require('${REPO_ROOT}/package.json').version")
RELEASE_NAME="TeacherAssistant-v${VERSION}"
RELEASE_DIR="${REPO_ROOT}/release/${RELEASE_NAME}"
ZIP_PATH="${REPO_ROOT}/release/${RELEASE_NAME}-Windows-Portable.zip"

echo "========================================"
echo " Building ${RELEASE_NAME}"
echo "========================================"

# 1. Build frontend
echo ""
echo "[1/6] Building frontend (Vite)..."
(cd "${REPO_ROOT}" && npm run build)

# 2. Ensure portable Node.js for Windows
echo ""
echo "[2/6] Ensuring portable Node.js..."
bash "${REPO_ROOT}/scripts/download-node-portable.sh"
PORTABLE_NODE="${REPO_ROOT}/node-portable/node.exe"

# 3. Clean and prepare release directory
echo ""
echo "[3/6] Preparing release directory..."
rm -rf "${RELEASE_DIR}"
mkdir -p "${RELEASE_DIR}/node"
mkdir -p "${RELEASE_DIR}/src"

# 4. Copy required files
echo ""
echo "[4/6] Copying application files..."
cp -r "${REPO_ROOT}/dist" "${RELEASE_DIR}/"

for dir in db lib middleware routes services types; do
    if [ -d "${REPO_ROOT}/src/${dir}" ]; then
        cp -r "${REPO_ROOT}/src/${dir}" "${RELEASE_DIR}/src/"
    fi
done

for file in server.ts routes.ts services.ts db.ts tsconfig.json package.json package-lock.json .env.example README.md start-app.bat start-app.sh setup-env.ps1 setup-env.sh; do
    if [ -f "${REPO_ROOT}/${file}" ]; then
        cp "${REPO_ROOT}/${file}" "${RELEASE_DIR}/"
    fi
done

if [ -f "${REPO_ROOT}/QUICKSTART.txt" ]; then
    cp "${REPO_ROOT}/QUICKSTART.txt" "${RELEASE_DIR}/"
fi

if [ -d "${REPO_ROOT}/public" ]; then
    cp -r "${REPO_ROOT}/public" "${RELEASE_DIR}/"
fi

if [ -d "${REPO_ROOT}/scripts/startup" ]; then
    mkdir -p "${RELEASE_DIR}/scripts/startup"
    cp -r "${REPO_ROOT}/scripts/startup/"* "${RELEASE_DIR}/scripts/startup/"
fi

cp "${PORTABLE_NODE}" "${RELEASE_DIR}/node/node.exe"

# 5. Install production dependencies inside release folder
echo ""
echo "[5/6] Installing production dependencies in release directory..."
(cd "${RELEASE_DIR}" && npm ci --omit=dev --ignore-scripts --no-audit --no-fund)

# 6. Create Zip archive
echo ""
echo "[6/6] Creating portable ZIP archive: ${ZIP_PATH}..."
rm -f "${ZIP_PATH}"
(cd "${REPO_ROOT}/release" && zip -r -q "${RELEASE_NAME}-Windows-Portable.zip" "${RELEASE_NAME}")

echo ""
echo "========================================"
echo " Release build complete!"
echo " Directory: ${RELEASE_DIR}"
echo " Archive  : ${ZIP_PATH}"
echo "========================================"
