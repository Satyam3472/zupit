#!/usr/bin/env bash
# ==============================================================================
# Zupit Automated Backup Script (PostgreSQL 16 custom format + gzip + rclone)
# ==============================================================================

set -euo pipefail

echo "========================================================================"
echo "[$(date -u '+%Y-%m-%dT%H:%M:%SZ')] Starting automated Zupit backup run..."
echo "========================================================================"

POSTGRES_HOST="${POSTGRES_HOST:-db}"
POSTGRES_PORT="${POSTGRES_PORT:-5432}"
POSTGRES_USER="${POSTGRES_USER:-postgres}"
POSTGRES_DB="${POSTGRES_DB:-zupit}"
BACKUP_ROOT="/backups"
DAILY_DIR="${BACKUP_ROOT}/daily"
WEEKLY_DIR="${BACKUP_ROOT}/weekly"

if [ -z "${POSTGRES_PASSWORD:-}" ]; then
  echo "❌ [ERROR] POSTGRES_PASSWORD environment variable is not set." >&2
  exit 1
fi

export PGPASSWORD="${POSTGRES_PASSWORD}"

mkdir -p "${DAILY_DIR}" "${WEEKLY_DIR}"

TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
DAY_OF_WEEK=$(date +"%u") # 1 = Monday ... 7 = Sunday
DAILY_FILE="${DAILY_DIR}/zupit_${POSTGRES_DB}_${TIMESTAMP}.dump.gz"
WEEKLY_FILE="${WEEKLY_DIR}/zupit_${POSTGRES_DB}_week_${TIMESTAMP}.dump.gz"

# 1. Run pg_dump with custom format (-Fc) piped through gzip
echo "[INFO] Running pg_dump against ${POSTGRES_HOST}:${POSTGRES_PORT}/${POSTGRES_DB}..."
if pg_dump -h "${POSTGRES_HOST}" -p "${POSTGRES_PORT}" -U "${POSTGRES_USER}" -Fc "${POSTGRES_DB}" | gzip -9 > "${DAILY_FILE}"; then
  FILE_SIZE=$(du -h "${DAILY_FILE}" | cut -f1)
  echo "✅ [SUCCESS] Daily backup created: ${DAILY_FILE} (${FILE_SIZE})"
else
  echo "❌ [ERROR] pg_dump failed!" >&2
  rm -f "${DAILY_FILE}"
  exit 2
fi

# 2. On Sundays, duplicate to weekly backup
if [ "${DAY_OF_WEEK}" -eq 7 ]; then
  cp "${DAILY_FILE}" "${WEEKLY_FILE}"
  echo "✅ [SUCCESS] Weekly backup copy preserved: ${WEEKLY_FILE}"
fi

# 3. Retention policy: Keep 14 daily copies
echo "[INFO] Enforcing daily retention (keeping 14 days)..."
find "${DAILY_DIR}" -type f -name "zupit_*.dump.gz" -mtime +14 -exec rm -v {} \; || true

# 4. Retention policy: Keep latest 8 weekly copies
echo "[INFO] Enforcing weekly retention (keeping latest 8 copies)..."
WEEKLY_FILES=$(find "${WEEKLY_DIR}" -type f -name "zupit_*.dump.gz" | sort)
WEEKLY_COUNT=$(echo "${WEEKLY_FILES}" | grep -c . || true)
if [ "${WEEKLY_COUNT}" -gt 8 ]; then
  EXCESS=$((WEEKLY_COUNT - 8))
  echo "${WEEKLY_FILES}" | head -n "${EXCESS}" | xargs -r rm -v
fi

# 5. Optional remote sync via rclone
if [ -n "${BACKUP_REMOTE_BUCKET:-}" ]; then
  echo "[INFO] Remote S3 sync configured. Starting rclone sync to '${BACKUP_REMOTE_BUCKET}'..."

  export RCLONE_CONFIG_REMOTE_TYPE="${BACKUP_REMOTE_TYPE:-s3}"
  export RCLONE_CONFIG_REMOTE_PROVIDER="${BACKUP_REMOTE_PROVIDER:-AWS}"
  export RCLONE_CONFIG_REMOTE_ACCESS_KEY_ID="${BACKUP_REMOTE_ACCESS_KEY:-}"
  export RCLONE_CONFIG_REMOTE_SECRET_ACCESS_KEY="${BACKUP_REMOTE_SECRET_KEY:-}"
  export RCLONE_CONFIG_REMOTE_ENDPOINT="${BACKUP_REMOTE_ENDPOINT:-}"
  export RCLONE_CONFIG_REMOTE_REGION="${BACKUP_REMOTE_REGION:-ap-south-1}"

  if rclone sync "${BACKUP_ROOT}" "remote:${BACKUP_REMOTE_BUCKET}" --fast-list --transfers 4; then
    echo "✅ [SUCCESS] Remote rclone sync completed successfully to remote:${BACKUP_REMOTE_BUCKET}"
  else
    echo "❌ [ERROR] rclone sync to remote storage failed!" >&2
    exit 3
  fi
else
  echo "[INFO] No BACKUP_REMOTE_BUCKET specified. Remote sync skipped."
fi

echo "========================================================================"
echo "[$(date -u '+%Y-%m-%dT%H:%M:%SZ')] Backup process completed successfully."
echo "========================================================================"
exit 0
