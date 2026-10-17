#!/usr/bin/env bash
# ==============================================================================
# Zupit Production Rollback Script (rollback.sh <sha>)
# Points Compose to previous image SHA and restarts services
# ==============================================================================

set -euo pipefail

TARGET_SHA="${1:-}"
COMPOSE_FILE="${2:-/opt/zupit/docker-compose.vps.yml}"

if [ -z "${TARGET_SHA}" ]; then
  if [ -f "/opt/zupit/.previous_sha" ]; then
    TARGET_SHA=$(cat "/opt/zupit/.previous_sha")
  else
    echo "❌ [ERROR] Target Git SHA required for rollback. Usage: $0 <sha>" >&2
    exit 1
  fi
fi

if [ ! -f "${COMPOSE_FILE}" ]; then
  COMPOSE_FILE="./docker-compose.vps.yml"
fi

echo "========================================================================"
echo "⏪ ROLLING BACK ZUPIT TO IMAGE TAG: ${TARGET_SHA}"
echo "========================================================================"

export GIT_SHA="${TARGET_SHA}"

if ! docker image inspect "zupit-app:${TARGET_SHA}" >/dev/null 2>&1; then
  echo "⚠️ [ROLLBACK INFO] Target image zupit-app:${TARGET_SHA} does not exist locally. No previous deployment to roll back to."
  exit 0
fi

echo "[INFO] Rolling back app container to zupit-app:${TARGET_SHA}..."
docker compose -f "${COMPOSE_FILE}" up -d --no-deps app

echo "[INFO] Waiting 5 seconds for health status check..."
sleep 5

echo "[INFO] Running verification smoke tests on rolled back version..."
if ./scripts/smoke-test.sh; then
  echo "✅ [SUCCESS] Rollback to ${TARGET_SHA} verified successfully."
  echo "${TARGET_SHA}" > /opt/zupit/.current_sha 2>/dev/null || true
  exit 0
else
  echo "❌ [ERROR] Smoke tests failed on rolled-back container!" >&2
  exit 2
fi
