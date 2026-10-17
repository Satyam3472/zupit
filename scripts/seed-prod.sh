#!/usr/bin/env bash
# ==============================================================================
# Zupit Production Seeding Script
# Seeds initial settings, owner admin from env, and serviceable pincode.
# Refuses to run if an admin already exists.
# Clears ADMIN_PASSWORD from .env.production once complete.
# ==============================================================================

set -euo pipefail

ENV_FILE="${1:-/opt/zupit/.env.production}"
COMPOSE_FILE="${2:-/opt/zupit/docker-compose.vps.yml}"

if [ ! -f "${ENV_FILE}" ]; then
  ENV_FILE="./.env.production"
fi
if [ ! -f "${COMPOSE_FILE}" ]; then
  COMPOSE_FILE="./docker-compose.vps.yml"
fi

echo "[INFO] Checking if an admin already exists in the database..."

EXISTING_ADMINS=$(docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" exec -T db psql -U zupit_admin -d zupit_prod -tAc "SELECT count(*) FROM admins;" 2>/dev/null || echo "0")
EXISTING_ADMINS=$(echo "${EXISTING_ADMINS}" | tr -d '[:space:]')

if [ "${EXISTING_ADMINS}" -gt 0 ]; then
  echo "⚠️ [REFUSED] An admin already exists in the database (${EXISTING_ADMINS} admin(s) found)."
  echo "   Refusing to run seed-prod.sh to prevent overwriting existing administrative credentials."
  exit 1
fi

echo "[INFO] No existing admin found. Running initial database seed..."
docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" run --rm migrate pnpm db:seed

echo "✅ [SUCCESS] Database successfully seeded with settings, owner admin, and serviceable areas."

# Clear ADMIN_PASSWORD from .env.production
if [ -f "${ENV_FILE}" ] && grep -q '^ADMIN_PASSWORD=' "${ENV_FILE}"; then
  echo "[INFO] Clearing plain-text ADMIN_PASSWORD from ${ENV_FILE}..."
  sed -i "s/^ADMIN_PASSWORD=.*/ADMIN_PASSWORD=/" "${ENV_FILE}"
  echo "🔒 [SUCCESS] ADMIN_PASSWORD cleared from ${ENV_FILE}."
fi
