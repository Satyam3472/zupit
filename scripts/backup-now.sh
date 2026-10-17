#!/usr/bin/env bash
# ==============================================================================
# Zupit Manual Backup Trigger (backup-now.sh)
# Immediately triggers a pg_dump backup inside the backup container
# ==============================================================================

set -euo pipefail

COMPOSE_FILE="${1:-/opt/zupit/docker-compose.vps.yml}"
if [ ! -f "${COMPOSE_FILE}" ]; then
  COMPOSE_FILE="./docker-compose.vps.yml"
fi

echo "[INFO] Triggering immediate database backup..."
docker compose -f "${COMPOSE_FILE}" exec -T backup /scripts/backup.sh

echo "========================================================================"
echo "✅ Backup completed. Latest backups in volume:"
docker compose -f "${COMPOSE_FILE}" exec -T backup ls -lh /backups/daily | tail -n 5
echo "========================================================================"
