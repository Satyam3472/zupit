#!/usr/bin/env bash
# ==============================================================================
# Generate Production Secrets for Zupit
# Securely generates cryptographically random passwords and secrets on the VPS.
# Sets chmod 600. Secrets are never printed to stdout.
# ==============================================================================

set -euo pipefail

ENV_FILE="${1:-/opt/zupit/.env.production}"
TEMPLATE_FILE="${2:-/opt/zupit/.env.production.example}"

if [ ! -f "${TEMPLATE_FILE}" ]; then
  # Fallback to local directory template if running from repo root
  TEMPLATE_FILE="./.env.production.example"
fi

echo "[INFO] Generating secure production environment file at: ${ENV_FILE}..."

if [ -f "${ENV_FILE}" ]; then
  echo "⚠️ [WARNING] ${ENV_FILE} already exists. Backing up to ${ENV_FILE}.bak.$(date +%Y%m%d_%H%M%S)..."
  cp "${ENV_FILE}" "${ENV_FILE}.bak.$(date +%Y%m%d_%H%M%S)"
fi

# Generate cryptographically secure random values
DB_PASS=$(openssl rand -hex 24)
MINIO_PASS=$(openssl rand -hex 24)
JWT_SEC=$(openssl rand -hex 32)
DELIVERY_SEC=$(openssl rand -hex 32)
ADMIN_PASS=$(openssl rand -hex 16)

# Copy template and substitute generated values safely
cp "${TEMPLATE_FILE}" "${ENV_FILE}"

# Use sed to replace placeholder tokens
sed -i "s|POSTGRES_PASSWORD=generate_strong_postgres_password_here|POSTGRES_PASSWORD=${DB_PASS}|" "${ENV_FILE}"
sed -i "s|MINIO_ROOT_PASSWORD=generate_strong_minio_password_here|MINIO_ROOT_PASSWORD=${MINIO_PASS}|" "${ENV_FILE}"
sed -i "s|JWT_SECRET=generate_random_32_plus_char_secret_with_openssl_rand_hex_32|JWT_SECRET=${JWT_SEC}|" "${ENV_FILE}"
sed -i "s|DELIVERY_CODE_SECRET=generate_random_32_plus_char_secret_with_openssl_rand_hex_32|DELIVERY_CODE_SECRET=${DELIVERY_SEC}|" "${ENV_FILE}"
sed -i "s|ADMIN_PASSWORD=InitialAdminPassword2026!|ADMIN_PASSWORD=${ADMIN_PASS}|" "${ENV_FILE}"

# Lock file permissions strictly to root/owner
chmod 600 "${ENV_FILE}"

echo "✅ [SUCCESS] Production environment file generated and secured (chmod 600)."
echo "   File: ${ENV_FILE}"
echo "   (Secrets generated: POSTGRES_PASSWORD, MINIO_ROOT_PASSWORD, JWT_SECRET, DELIVERY_CODE_SECRET, ADMIN_PASSWORD)"
