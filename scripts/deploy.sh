#!/usr/bin/env bash
# ==============================================================================
# Zupit Production Deployment Script (deploy.sh)
# Loads or builds image, runs migrations, boots stack, verifies smoke tests and
# baseline, and automatically rolls back if any step fails.
# ==============================================================================

set -euo pipefail

COMPOSE_FILE="${1:-/opt/zupit/docker-compose.vps.yml}"
TARGET_SHA="${2:-$(git rev-parse --short HEAD 2>/dev/null || echo 'latest')}"
STATE_DIR="/opt/zupit"

if [ ! -f "${COMPOSE_FILE}" ]; then
  COMPOSE_FILE="./docker-compose.vps.yml"
fi

mkdir -p "${STATE_DIR}"
PREV_SHA="latest"
if [ -f "${STATE_DIR}/.current_sha" ]; then
  PREV_SHA=$(cat "${STATE_DIR}/.current_sha")
  echo "${PREV_SHA}" > "${STATE_DIR}/.previous_sha"
fi

echo "========================================================================"
echo "🚀 DEPLOYING ZUPIT TO VPS (Image Tag: ${TARGET_SHA})"
echo "   Previous Image Tag: ${PREV_SHA}"
echo "========================================================================"

export GIT_SHA="${TARGET_SHA}"

# Rollback trap
rollback_on_failure() {
  local exit_code=$?
  if [ $exit_code -ne 0 ]; then
    echo "❌ [DEPLOYMENT FAILED] Exit code ${exit_code}. Initiating automatic rollback to ${PREV_SHA}..."
    if [ -f "./scripts/rollback.sh" ]; then
      ./scripts/rollback.sh "${PREV_SHA}" "${COMPOSE_FILE}" || echo "⚠️ Rollback script encountered an issue."
    fi
  fi
  exit $exit_code
}
trap rollback_on_failure EXIT

# 1. Start database and wait for healthy
echo "[1/4] Ensuring PostgreSQL is healthy..."
docker compose -f "${COMPOSE_FILE}" up -d db
echo "Waiting for database to report healthy..."
until [ "$(docker inspect --format='{{.State.Health.Status}}' zupit_db 2>/dev/null || echo '')" = "healthy" ]; do
  sleep 2
done
echo "✅ Database is healthy."

# 2. Run migrations
echo "[2/4] Executing forward-compatible Drizzle database migrations..."
docker compose -f "${COMPOSE_FILE}" run --rm migrate

# 3. Bring up full stack
echo "[3/4] Launching Zupit production services..."
docker compose -f "${COMPOSE_FILE}" up -d minio minio-init edge app backup

# Allow edge and app 5 seconds to bind
sleep 5

# 4. Run automated smoke tests and verify existing app baseline
echo "[4/4] Running smoke tests and verifying existing app baseline..."
./scripts/smoke-test.sh

# If we reached here, deploy succeeded! Disarm trap.
trap - EXIT

echo "${TARGET_SHA}" > "${STATE_DIR}/.current_sha"
echo "========================================================================"
echo "🎉 ZUPIT DEPLOYMENT COMPLETED & VERIFIED SUCCESSFULLY."
echo "========================================================================"
