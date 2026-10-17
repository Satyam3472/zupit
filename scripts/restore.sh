#!/usr/bin/env bash
# ==============================================================================
# Zupit Safe Database Restore Script
# Usage: ./scripts/restore.sh <path_to_backup.dump.gz>
# 1. Restores into a scratch database first and prints table row counts
# 2. Prompts for explicit typed confirmation before touching live database
# ==============================================================================

set -euo pipefail

BACKUP_FILE="${1:-}"
COMPOSE_FILE="${2:-/opt/zupit/docker-compose.vps.yml}"

if [ -z "${BACKUP_FILE}" ] || [ ! -f "${BACKUP_FILE}" ]; then
  echo "❌ [ERROR] Usage: $0 <path_to_backup.dump.gz>" >&2
  exit 1
fi
if [ ! -f "${COMPOSE_FILE}" ]; then
  COMPOSE_FILE="./docker-compose.vps.yml"
fi

DB_USER="zupit_admin"
PROD_DB="zupit_prod"
SCRATCH_DB="zupit_scratch"

echo "========================================================================"
echo "📦 SAFE DATABASE RESTORE VERIFICATION"
echo "Target File: ${BACKUP_FILE}"
echo "========================================================================"

# --- Phase 1: Restore into scratch database ---
echo "[1/3] Creating temporary scratch database (${SCRATCH_DB})..."
docker compose -f "${COMPOSE_FILE}" exec -T db psql -U "${DB_USER}" -c "DROP DATABASE IF EXISTS ${SCRATCH_DB};"
docker compose -f "${COMPOSE_FILE}" exec -T db psql -U "${DB_USER}" -c "CREATE DATABASE ${SCRATCH_DB};"

echo "[2/3] Restoring backup into ${SCRATCH_DB} for schema and data validation..."
gunzip -c "${BACKUP_FILE}" | docker compose -f "${COMPOSE_FILE}" exec -T db pg_restore -U "${DB_USER}" -d "${SCRATCH_DB}" --no-owner || true

echo ""
echo "📊 Row counts verified in backup file (${SCRATCH_DB}):"
docker compose -f "${COMPOSE_FILE}" exec -T db psql -U "${DB_USER}" -d "${SCRATCH_DB}" -tAc "
SELECT
  '  • ' || relname || ': ' || n_live_tup || ' rows'
FROM pg_stat_user_tables
ORDER BY relname;
"

echo "========================================================================"
echo "⚠️  CRITICAL CONFIRMATION REQUIRED"
echo "You are about to OVERWRITE the active production database (${PROD_DB})!"
echo "This will replace all live orders, customer sessions, and settings."
echo "========================================================================"
read -r -p "Type 'RESTORE_LIVE_DATABASE' to proceed with production overwrite: " CONFIRM_INPUT

if [ "${CONFIRM_INPUT}" != "RESTORE_LIVE_DATABASE" ]; then
  echo "🚫 [CANCELLED] Restore aborted by user. Live database was not touched."
  echo "Cleaning up scratch database..."
  docker compose -f "${COMPOSE_FILE}" exec -T db psql -U "${DB_USER}" -c "DROP DATABASE IF EXISTS ${SCRATCH_DB};"
  exit 0
fi

# --- Phase 2: Live restore ---
echo ""
echo "[3/3] Restoring into live database (${PROD_DB})..."
gunzip -c "${BACKUP_FILE}" | docker compose -f "${COMPOSE_FILE}" exec -T db pg_restore -U "${DB_USER}" -d "${PROD_DB}" --clean --if-exists --no-owner

echo "[CLEANUP] Removing scratch database..."
docker compose -f "${COMPOSE_FILE}" exec -T db psql -U "${DB_USER}" -c "DROP DATABASE IF EXISTS ${SCRATCH_DB};"

echo "========================================================================"
echo "✅ [SUCCESS] Database restored successfully into ${PROD_DB}."
echo "========================================================================"
