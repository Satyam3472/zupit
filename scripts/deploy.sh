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
ENV_FILE="${STATE_DIR}/.env.production"
if [ ! -f "${ENV_FILE}" ]; then
  ENV_FILE="./.env.production"
fi

# Ensure .env symlinks to .env.production for seamless Compose interpolation
if [ -f "${ENV_FILE}" ] && [ ! -f "${STATE_DIR}/.env" ]; then
  ln -sf "${ENV_FILE}" "${STATE_DIR}/.env" 2>/dev/null || true
fi

COMPOSE_CMD="docker compose --env-file ${ENV_FILE} -f ${COMPOSE_FILE}"
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

MEM_WATCH_PID=""
# Rollback trap
rollback_on_failure() {
  local exit_code=$?
  if [ -n "${MEM_WATCH_PID}" ]; then
    kill "${MEM_WATCH_PID}" 2>/dev/null || true
  fi
  if [ $exit_code -ne 0 ]; then
    echo "❌ [DEPLOYMENT FAILED] Exit code ${exit_code}. Initiating automatic rollback to ${PREV_SHA}..."
    if [ -f "./scripts/rollback.sh" ]; then
      ./scripts/rollback.sh "${PREV_SHA}" "${COMPOSE_FILE}" || echo "⚠️ Rollback script encountered an issue."
    fi
  fi
  exit $exit_code
}
trap rollback_on_failure EXIT

# 0. Check or build Docker images with low priority & memory protection
if ! docker image inspect "zupit-app:${TARGET_SHA}" >/dev/null 2>&1 || ! docker image inspect "zupit-minio:RELEASE.2025-09-07" >/dev/null 2>&1 || ! docker image inspect "zupit-mc:RELEASE.2025-08-13" >/dev/null 2>&1; then
  echo "[0/4] Stack images not fully present. Initiating safe build on VPS..."
  AVAIL_MEM_MB=$(free -m | awk '/^Mem:/{print $7}')
  AVAIL_SWAP_MB=$(free -m | awk '/^Swap:/{print $4}')
  TOTAL_AVAIL_MB=$((AVAIL_MEM_MB + AVAIL_SWAP_MB))
  if [ "${TOTAL_AVAIL_MB}" -lt 2500 ]; then
    echo "❌ [ERROR] Available RAM + Swap (${TOTAL_AVAIL_MB} MB) is below 2.5 GB threshold." >&2
    exit 1
  fi
  echo "Memory safety check passed (${TOTAL_AVAIL_MB} MB available). Building with low priority..."

  # Memory guard loop
  (
    while true; do
      CUR_AVAIL=$(free -m | awk '/^Mem:/{print $7}')
      if [ -n "${CUR_AVAIL}" ] && [ "${CUR_AVAIL}" -lt 300 ]; then
        echo "🚨 [OUT OF MEMORY RISK] Available RAM dropped below 300MB (${CUR_AVAIL}MB)! Aborting build to protect existing app..." >&2
        pkill -f "docker compose.*build" 2>/dev/null || true
        exit 1
      fi
      sleep 2
    done
  ) &
  MEM_WATCH_PID=$!

  IONICE_PREFIX=""
  if command -v ionice >/dev/null 2>&1; then
    IONICE_PREFIX="ionice -c 3"
  fi
  nice -n 19 ${IONICE_PREFIX} ${COMPOSE_CMD} build
  kill "${MEM_WATCH_PID}" 2>/dev/null || true
  wait "${MEM_WATCH_PID}" 2>/dev/null || true
  MEM_WATCH_PID=""
fi

# 1. Start database and wait for healthy
echo "[1/4] Ensuring PostgreSQL is healthy..."
${COMPOSE_CMD} up -d db
echo "Waiting for database to report healthy..."
until [ "$(docker inspect --format='{{.State.Health.Status}}' zupit_db 2>/dev/null || echo '')" = "healthy" ]; do
  sleep 2
done
echo "✅ Database is healthy."

# 2. Run migrations
echo "[2/4] Executing forward-compatible Drizzle database migrations..."
${COMPOSE_CMD} run --rm migrate

# 3. Bring up full stack
echo "[3/4] Launching Zupit production services..."
${COMPOSE_CMD} up -d minio minio-init edge app backup

# Wait for app container to report healthy
echo "Waiting for Zupit application to report healthy..."
for i in $(seq 1 30); do
  STATUS=$(docker inspect --format='{{.State.Health.Status}}' zupit_app 2>/dev/null || echo '')
  if [ "${STATUS}" = "healthy" ]; then
    echo "✅ Zupit application is healthy."
    break
  fi
  sleep 2
done

# 4. Run automated smoke tests and verify existing app baseline
echo "[4/4] Running smoke tests and verifying existing app baseline..."
./scripts/smoke-test.sh

# If we reached here, deploy succeeded! Disarm trap.
trap - EXIT

echo "${TARGET_SHA}" > "${STATE_DIR}/.current_sha"
echo "========================================================================"
echo "🎉 ZUPIT DEPLOYMENT COMPLETED & VERIFIED SUCCESSFULLY."
echo "========================================================================"
