#!/usr/bin/env bash
# ==============================================================================
# Build & Tag Zupit Production Docker Images
# Tags images with git short SHA and 'latest'
# ==============================================================================

set -euo pipefail

GIT_SHA=$(git rev-parse --short HEAD 2>/dev/null || echo "prod")

echo "========================================================================"
echo "🚀 Building Zupit production images (tag: ${GIT_SHA} & latest)..."
echo "========================================================================"

# 1. Build and tag runner image
echo "[1/3] Building zupit-app:runner..."
docker build --target runner \
  -t zupit-app:"${GIT_SHA}" \
  -t zupit-app:latest .

# 2. Build and tag migrator image
echo "[2/3] Building zupit-migrator:migrator..."
docker build --target migrator \
  -t zupit-migrator:"${GIT_SHA}" \
  -t zupit-migrator:latest .

# 3. Build and tag backup image
echo "[3/3] Building zupit-backup..."
docker build \
  -t zupit-backup:"${GIT_SHA}" \
  -t zupit-backup:latest ./docker/backup

echo "========================================================================"
echo "✅ Build & Tag Complete:"
echo "   • zupit-app:${GIT_SHA}"
echo "   • zupit-app:latest"
echo "   • zupit-migrator:${GIT_SHA}"
echo "   • zupit-migrator:latest"
echo "   • zupit-backup:${GIT_SHA}"
echo "   • zupit-backup:latest"
echo "========================================================================"
