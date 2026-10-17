#!/usr/bin/env bash
# ==============================================================================
# Zupit Production Smoke Test Suite
# Verifies Zupit health, upload pipeline, port isolation, and baseline integrity
# ==============================================================================

set -euo pipefail

BASE_URL="${1:-http://127.0.0.1:3100}"
PUBLIC_IP="${2:-82.29.165.59}"
BASELINE_FILE="${3:-/opt/zupit/deploy-baseline.txt}"

if [ ! -f "${BASELINE_FILE}" ]; then
  BASELINE_FILE="./deploy-baseline.txt"
fi

echo "========================================================================"
echo "🧪 RUNNING ZUPIT PRODUCTION SMOKE TESTS"
echo "Target URL: ${BASE_URL} | Public IP: ${PUBLIC_IP}"
echo "========================================================================"

FAILED=0

# 1. Main site returns 200
echo -n "[TEST 1/6] Main customer application returns HTTP 200... "
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 5 "${BASE_URL}/" || echo "000")
if [ "${HTTP_CODE}" -eq 200 ]; then
  echo "✅ OK (HTTP 200)"
else
  echo "❌ FAILED (got HTTP ${HTTP_CODE})"
  FAILED=$((FAILED + 1))
fi

# 2. GET /api/v1/health is healthy and reports database connected
echo -n "[TEST 2/6] /api/v1/health reports database connected... "
HEALTH_BODY=$(curl -s --connect-timeout 5 "${BASE_URL}/api/v1/health" || echo "{}")
if echo "${HEALTH_BODY}" | grep -q '"status":"healthy"' && echo "${HEALTH_BODY}" | grep -q '"database":"connected"'; then
  echo "✅ OK"
else
  echo "❌ FAILED: ${HEALTH_BODY}"
  FAILED=$((FAILED + 1))
fi

# 3. /admin/login loads
echo -n "[TEST 3/6] Admin portal (/admin/login) loads successfully... "
ADMIN_CODE=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 5 "${BASE_URL}/admin/login" || echo "000")
if [ "${ADMIN_CODE}" -eq 200 ]; then
  echo "✅ OK (HTTP 200)"
else
  echo "❌ FAILED (got HTTP ${ADMIN_CODE})"
  FAILED=$((FAILED + 1))
fi

# 4. Presigned prescription upload & download round-trip
echo -n "[TEST 4/6] Prescription presigned upload and signed URL download round-trip... "
TEST_IMG_PAYLOAD="ZUPIT_SMOKE_TEST_PRESCRIPTION_BINARY_$(date +%s)"
PRESIGN_RES=$(curl -s -X POST "${BASE_URL}/api/v1/uploads/presign" \
  -H "Content-Type: application/json" \
  -d '{"fileName":"smoke_test.jpg","mimeType":"image/jpeg","fileSize":1024}' || echo "{}")

FILE_KEY=$(echo "${PRESIGN_RES}" | grep -o '"file_key":"[^"]*"' | cut -d'"' -f4 || true)
UPLOAD_URL=$(echo "${PRESIGN_RES}" | grep -o '"uploadUrl":"[^"]*"' | cut -d'"' -f4 || true)
SIGNED_URL=$(echo "${PRESIGN_RES}" | grep -o '"signedUrl":"[^"]*"' | cut -d'"' -f4 || true)

if [ -n "${FILE_KEY}" ] && [ -n "${UPLOAD_URL}" ]; then
  # Upload binary data
  UPLOAD_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X PUT "${BASE_URL}${UPLOAD_URL}" \
    -H "Content-Type: image/jpeg" \
    --data-binary "${TEST_IMG_PAYLOAD}" || echo "000")

  if [ "${UPLOAD_CODE}" -ge 200 ] && [ "${UPLOAD_CODE}" -lt 300 ]; then
    # Fetch uploaded file back using signed URL
    DOWNLOADED=$(curl -s "${BASE_URL}${SIGNED_URL}" || echo "")
    if [ "${DOWNLOADED}" = "${TEST_IMG_PAYLOAD}" ]; then
      echo "✅ OK (round-trip verified)"
    else
      echo "❌ FAILED: downloaded content mismatch"
      FAILED=$((FAILED + 1))
    fi
  else
    echo "❌ FAILED: upload endpoint returned HTTP ${UPLOAD_CODE}"
    FAILED=$((FAILED + 1))
  fi
else
  echo "❌ FAILED: unable to generate presigned URL (${PRESIGN_RES})"
  FAILED=$((FAILED + 1))
fi

# 5. Security isolation: MinIO console (9001) & Postgres (5432) unreachable publicly
echo -n "[TEST 5/6] Security isolation: internal services unreachable from public IP... "
SEC_OK=1
# Test MinIO console 9001
if curl -s --connect-timeout 2 "http://${PUBLIC_IP}:9001" >/dev/null 2>&1; then
  echo "❌ MinIO console (9001) is publicly reachable!"
  SEC_OK=0
fi
# Test Postgres 5432
if nc -z -w 2 "${PUBLIC_IP}" 5432 2>/dev/null; then
  echo "❌ Postgres (5432) is publicly reachable!"
  SEC_OK=0
fi

if [ "${SEC_OK}" -eq 1 ]; then
  echo "✅ OK (5432 and 9001 are strictly internal)"
else
  FAILED=$((FAILED + 1))
fi

# 6. Existing app baseline verification on :3000
echo -n "[TEST 6/6] Existing app on :3000 matches preflight baseline... "
BASELINE_SHA=$(grep "Response Body SHA256 Hash:" "${BASELINE_FILE}" 2>/dev/null | awk '{print $NF}' || true)
CURRENT_BODY=$(mktemp)
CURRENT_HEADERS=$(mktemp)

if curl -sS -D "${CURRENT_HEADERS}" -o "${CURRENT_BODY}" --connect-timeout 5 http://127.0.0.1:3000/ 2>/dev/null; then
  CURRENT_SHA=$(sha256sum "${CURRENT_BODY}" | awk '{print $1}')
  CURRENT_STATUS=$(grep -E '^HTTP/' "${CURRENT_HEADERS}" | tail -n 1 | tr -d '\r')

  if [ -n "${BASELINE_SHA}" ] && [ "${CURRENT_SHA}" = "${BASELINE_SHA}" ]; then
    echo "✅ OK (${CURRENT_STATUS}, SHA match: ${CURRENT_SHA:0:12}...)"
  elif [ -z "${BASELINE_SHA}" ]; then
    echo "⚠️ Baseline file not found; current app is responsive (${CURRENT_STATUS})"
  else
    echo "❌ FAILED: Baseline SHA mismatch!"
    echo "   Expected: ${BASELINE_SHA}"
    echo "   Actual:   ${CURRENT_SHA}"
    FAILED=$((FAILED + 1))
  fi
else
  echo "❌ FAILED: existing app on :3000 is not responding!"
  FAILED=$((FAILED + 1))
fi
rm -f "${CURRENT_BODY}" "${CURRENT_HEADERS}"

echo "========================================================================"
if [ "${FAILED}" -eq 0 ]; then
  echo "🎉 ALL SMOKE TESTS PASSED."
  exit 0
else
  echo "❌ ${FAILED} SMOKE TEST(S) FAILED."
  exit 1
fi
