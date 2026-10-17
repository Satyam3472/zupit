#!/usr/bin/env bash
# ==============================================================================
# Backup Container Entrypoint - Schedules nightly backup at 02:30 IST
# ==============================================================================

set -euo pipefail

POSTGRES_HOST="${POSTGRES_HOST:-db}"
POSTGRES_PORT="${POSTGRES_PORT:-5432}"
POSTGRES_USER="${POSTGRES_USER:-postgres}"

echo "[INFO] Waiting for PostgreSQL database at ${POSTGRES_HOST}:${POSTGRES_PORT} to be ready..."
until pg_isready -h "${POSTGRES_HOST}" -p "${POSTGRES_PORT}" -U "${POSTGRES_USER}"; do
  echo "[INFO] PostgreSQL not ready yet. Retrying in 3 seconds..."
  sleep 3
done
echo "✅ [INFO] PostgreSQL connection verified."

# Ensure log file exists
touch /var/log/backup.log

# Register cron job: runs at 02:30 IST every day
# Since container timezone is Asia/Kolkata, "30 2 * * *" corresponds to 02:30 IST
echo "30 2 * * * /scripts/backup.sh >> /var/log/backup.log 2>&1" > /etc/crontabs/root

echo "🚀 [INFO] Backup service started. Schedule: 02:30 IST daily (crond running in foreground)."
echo "[INFO] Tailing /var/log/backup.log..."

# Start cron daemon in foreground and stream logs
exec crond -f -l 2
