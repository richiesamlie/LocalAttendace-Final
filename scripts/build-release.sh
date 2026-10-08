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
cp -r "${REPO_ROOT}/dist-server" "${RELEASE_DIR}/"

for file in .env.example README.md start-app.bat start-app.sh start-internal-site.bat start-internal-site.sh start-app-hidden.vbs stop-app.bat setup-env.ps1 setup-env.sh enable-autostart.bat disable-autostart.bat; do
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

# 5. Assemble minimal runtime native dependencies
echo ""
echo "[5/6] Assembling minimal runtime native dependencies..."
cat <<EOF > "${RELEASE_DIR}/package.json"
{
  "name": "teacher-assistant",
  "version": "${VERSION}",
  "private": true,
  "dependencies": {
    "better-sqlite3": "^12.11.1",
    "bcrypt": "^6.0.0"
  }
}
EOF
mkdir -p "${RELEASE_DIR}/node_modules"
for dep in better-sqlite3 bcrypt node-gyp-build bindings file-uri-to-path; do
    if [ -d "${REPO_ROOT}/node_modules/${dep}" ]; then
        cp -r "${REPO_ROOT}/node_modules/${dep}" "${RELEASE_DIR}/node_modules/"
    fi
done

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
