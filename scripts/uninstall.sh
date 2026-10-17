#!/usr/bin/env bash
# ==============================================================================
# Zupit Clean Teardown Script (uninstall.sh)
# Shuts down Zupit containers. Volumes are ONLY removed if --volumes is passed
# along with explicit typed confirmation.
# Existing project containers, networks, and volumes are untouched.
# ==============================================================================

set -euo pipefail

COMPOSE_FILE="${1:-/opt/zupit/docker-compose.vps.yml}"
REMOVE_VOLUMES="${2:-}"

if [ ! -f "${COMPOSE_FILE}" ]; then
  COMPOSE_FILE="./docker-compose.vps.yml"
fi

echo "========================================================================"
echo "🛑 TEARING DOWN ZUPIT CONTAINERS"
echo "========================================================================"

if [ "${REMOVE_VOLUMES}" = "--volumes" ]; then
  echo "⚠️  WARNING: You requested volume deletion (--volumes)!"
  echo "This will PERMANENTLY delete all Zupit PostgreSQL databases and MinIO files."
  read -r -p "Type 'DELETE_ZUPIT_DATA' to confirm permanent volume destruction: " CONFIRM_VOLS
  if [ "${CONFIRM_VOLS}" = "DELETE_ZUPIT_DATA" ]; then
    echo "[INFO] Stopping containers and removing Zupit volumes..."
    docker compose -f "${COMPOSE_FILE}" down --volumes --remove-orphans
    echo "✅ [SUCCESS] Zupit containers and volumes deleted."
  else
    echo "🚫 Volume removal cancelled. Stopping containers without deleting data..."
    docker compose -f "${COMPOSE_FILE}" down --remove-orphans
    echo "✅ [SUCCESS] Zupit containers stopped (volumes preserved)."
  fi
else
  echo "[INFO] Stopping Zupit containers (all database and upload volumes preserved)..."
  docker compose -f "${COMPOSE_FILE}" down --remove-orphans
  echo "✅ [SUCCESS] Zupit containers stopped."
fi
