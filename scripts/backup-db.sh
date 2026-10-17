#!/usr/bin/env bash
# ==============================================================================
# Zupit Database Backup Script
# Run daily via cron: 0 3 * * * /opt/zupit/scripts/backup-db.sh >> /var/log/zupit-backup.log 2>&1
# ==============================================================================

set -euo pipefail

BACKUP_DIR="/var/backups/zupit"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="${BACKUP_DIR}/zupit_backup_${TIMESTAMP}.sql.gz"
RETENTION_DAYS=14

mkdir -p "${BACKUP_DIR}"

echo "[$(date -u)] Starting database backup..."

# Extract credentials from active container
DB_CONTAINER="zupit-db"
DB_USER=$(docker inspect --format '{{range .Config.Env}}{{println .}}{{end}}' "${DB_CONTAINER}" | grep POSTGRES_USER | cut -d= -f2)
DB_NAME=$(docker inspect --format '{{range .Config.Env}}{{println .}}{{end}}' "${DB_CONTAINER}" | grep POSTGRES_DB | cut -d= -f2)

docker exec -t "${DB_CONTAINER}" pg_dump -U "${DB_USER}" "${DB_NAME}" | gzip -9 > "${BACKUP_FILE}"

FILE_SIZE=$(du -h "${BACKUP_FILE}" | cut -f1)
echo "[$(date -u)] Backup completed successfully: ${BACKUP_FILE} (${FILE_SIZE})"

# Prune backups older than retention window
echo "[$(date -u)] Pruning backups older than ${RETENTION_DAYS} days..."
find "${BACKUP_DIR}" -type f -name "zupit_backup_*.sql.gz" -mtime +"${RETENTION_DAYS}" -delete
echo "[$(date -u)] Backup run finished."
