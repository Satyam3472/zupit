#!/usr/bin/env bash
# ==============================================================================
# Zupit Preflight Script (Read-Only)
# Runs diagnostic checks and records baseline of existing app on :3000
# Usage: ./scripts/preflight.sh [optional_domain]
# ==============================================================================

set -uo pipefail

TARGET_DOMAIN="${1:-}"
OUTPUT_FILE="${2:-deploy-baseline.txt}"

exec > >(tee "${OUTPUT_FILE}") 2>&1

echo "========================================================================"
echo "🔍 ZUPIT VPS PREFLIGHT DIAGNOSTIC REPORT"
echo "Host: 82.29.165.59 | Timestamp: $(date -u '+%Y-%m-%d %H:%M:%S UTC')"
echo "========================================================================"

echo ""
echo "--- 1. OPERATING SYSTEM & HARDWARE ---"
if [ -f /etc/os-release ]; then
  # shellcheck source=/dev/null
  . /etc/os-release
  echo "OS: ${PRETTY_NAME:-$NAME $VERSION}"
else
  uname -a
fi
echo "Kernel: $(uname -r)"
echo "CPU Cores: $(nproc 2>/dev/null || grep -c ^processor /proc/cpuinfo)"
if command -v lscpu >/dev/null 2>&1; then
  echo "CPU Model: $(lscpu | grep 'Model name' | sed 's/Model name:[ \t]*//' | head -n 1)"
fi

echo ""
echo "--- 2. MEMORY & SWAP (free -m) ---"
free -m
echo ""
echo "Swap Details:"
if command -v swapon >/dev/null 2>&1; then
  swapon --show || echo "No active swap partitions detected."
else
  cat /proc/swaps
fi

echo ""
echo "--- 3. DISK SPACE (df -h) ---"
df -h -x tmpfs -x devtmpfs -x squashfs

echo ""
echo "--- 4. DOCKER & DOCKER COMPOSE VERSIONS ---"
if command -v docker >/dev/null 2>&1; then
  echo "Docker binary: $(which docker)"
  docker --version
  if docker compose version >/dev/null 2>&1; then
    docker compose version
  elif command -v docker-compose >/dev/null 2>&1; then
    docker-compose --version
  else
    echo "⚠️ Docker Compose plugin is NOT installed."
  fi
else
  echo "❌ Docker is NOT installed."
fi

echo ""
echo "--- 5. RUNNING DOCKER CONTAINERS (if any) ---"
if command -v docker >/dev/null 2>&1 && docker ps >/dev/null 2>&1; then
  CONTAINER_COUNT=$(docker ps -q | wc -l)
  echo "Running Containers count: ${CONTAINER_COUNT}"
  if [ "${CONTAINER_COUNT}" -gt 0 ]; then
    docker ps --format "table {{.ID}}\t{{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}"
    echo ""
    echo "Container Networks & Volumes Summary:"
    for c in $(docker ps -q); do
      CNAME=$(docker inspect --format '{{.Name}}' "$c" | sed 's/^\///')
      CNETS=$(docker inspect --format '{{range $k, $v := .NetworkSettings.Networks}}{{$k}} {{end}}' "$c")
      CVOLS=$(docker inspect --format '{{range .Mounts}}{{.Source}}:{{.Destination}} {{end}}' "$c")
      echo "  • Container [${CNAME}]: Networks=[${CNETS}] | Mounts=[${CVOLS}]"
    done
  else
    echo "No containers currently running."
  fi
else
  echo "Docker daemon not running or current user cannot access docker socket."
fi

echo ""
echo "--- 6. ALL LISTENING PORTS & PROCESSES (ss -tlnp) ---"
if command -v ss >/dev/null 2>&1; then
  ss -tlnp
elif command -v netstat >/dev/null 2>&1; then
  netstat -tlnp
else
  echo "Neither ss nor netstat found."
fi

echo ""
echo "--- 7. PORTS 80 & 443 / REVERSE PROXIES (nginx, caddy, apache, traefik) ---"
echo "Processes bound to :80 or :443:"
ss -tlnp | grep -E ':(80|443)[ \t]' || echo "Ports 80 and 443 are currently FREE."

echo ""
echo "Reverse Proxy Services Status:"
for s in nginx caddy apache2 httpd traefik; do
  if systemctl is-active --quiet "$s" 2>/dev/null; then
    echo "  • $s: ACTIVE (systemd service is running)"
  elif command -v "$s" >/dev/null 2>&1; then
    echo "  • $s: Installed but inactive"
  fi
done

echo ""
echo "--- 8. FIREWALL (UFW) STATUS & RULES ---"
if command -v ufw >/dev/null 2>&1; then
  ufw status verbose || echo "Unable to query ufw (requires root)."
else
  echo "UFW is not installed."
fi

echo ""
echo "--- 9. EXISTING APP ON :3000 INVESTIGATION ---"
PORT_3000_INFO=$(ss -tlnp '( sport = :3000 )' 2>/dev/null || ss -tlnp | grep ':3000[ \t]')
echo "Listening Socket on 3000:"
echo "${PORT_3000_INFO:-No socket listening on port 3000}"

PID_3000=$(echo "${PORT_3000_INFO}" | grep -o 'pid=[0-9]*' | cut -d= -f2 | head -n 1)

if [ -n "${PID_3000:-}" ]; then
  echo ""
  echo "Process Details (PID: ${PID_3000}):"
  ps -p "${PID_3000}" -o pid,ppid,user,%cpu,%mem,rss,vsz,etime,lstart,cmd || true

  echo ""
  echo "Process Manager / Supervision Type:"
  # Check if child of docker-containerd / docker-proxy
  P_CMD=$(ps -p "${PID_3000}" -o cmd=)
  if echo "${P_CMD}" | grep -q "docker-proxy"; then
    echo "  • Type: DOCKER CONTAINER (bridged by docker-proxy)"
    if command -v docker >/dev/null 2>&1; then
      CONTAINER_ID=$(docker ps --filter "publish=3000" --format "{{.Names}} ({{.Image}})")
      echo "    Docker Container: ${CONTAINER_ID:-unknown}"
    fi
  elif command -v pm2 >/dev/null 2>&1 && pm2 list 2>/dev/null | grep -q "${PID_3000}"; then
    echo "  • Type: PM2 Process"
    pm2 list 2>/dev/null | grep "${PID_3000}" || true
  elif systemctl status "${PID_3000}" >/dev/null 2>&1; then
    echo "  • Type: SYSTEMD SERVICE"
    systemctl status "${PID_3000}" 2>/dev/null | head -n 8 || true
  else
    echo "  • Type: Standalone Node/Process (Parent PID: $(ps -p "${PID_3000}" -o ppid= | tr -d ' '))"
  fi

  # Memory details
  echo ""
  echo "Memory usage for PID ${PID_3000}:"
  ps -p "${PID_3000}" -o pid,rss,cmd --sort=-rss | awk 'NR>1 {print "  • RSS Memory:", int($2/1024), "MB (Process: "$3")"}'
else
  echo "Could not detect PID holding port 3000 directly from ss."
fi

echo ""
echo "--- 10. BASELINE MEASUREMENT OF EXISTING APP (http://127.0.0.1:3000/) ---"
TMP_BODY=$(mktemp)
TMP_HEADERS=$(mktemp)

if curl -sS -D "${TMP_HEADERS}" -o "${TMP_BODY}" --connect-timeout 5 http://127.0.0.1:3000/ 2>/dev/null; then
  HTTP_STATUS=$(grep -E '^HTTP/' "${TMP_HEADERS}" | tail -n 1 | tr -d '\r')
  BODY_SHA256=$(sha256sum "${TMP_BODY}" | awk '{print $1}')
  BODY_BYTES=$(wc -c < "${TMP_BODY}" | tr -d ' ')
  SERVER_HDR=$(grep -i '^server:' "${TMP_HEADERS}" | tr -d '\r' || echo "Server header: none")

  echo "HTTP Status Code: ${HTTP_STATUS}"
  echo "Response Body SHA256 Hash: ${BODY_SHA256}"
  echo "Response Body Size: ${BODY_BYTES} bytes"
  echo "Response Server Header: ${SERVER_HDR}"
  echo "Sample Body (first 3 lines):"
  head -n 3 "${TMP_BODY}" | sed 's/^/  | /'
else
  echo "❌ FAILED to connect to http://127.0.0.1:3000/"
fi
rm -f "${TMP_BODY}" "${TMP_HEADERS}"

echo ""
echo "--- 11. DOMAIN RESOLUTION CHECK ---"
if [ -n "${TARGET_DOMAIN}" ]; then
  echo "Testing domain: ${TARGET_DOMAIN}"
  RESOLVED_IPS=$(getent hosts "${TARGET_DOMAIN}" 2>/dev/null | awk '{print $1}' || true)
  if [ -z "${RESOLVED_IPS}" ] && command -v dig >/dev/null 2>&1; then
    RESOLVED_IPS=$(dig +short "${TARGET_DOMAIN}")
  fi
  echo "Resolved IP(s): ${RESOLVED_IPS:-None (failed to resolve)}"
  if echo "${RESOLVED_IPS}" | grep -q "82.29.165.59"; then
    echo "✅ Domain ${TARGET_DOMAIN} points directly to this VPS IP (82.29.165.59)."
  else
    echo "⚠️ Domain ${TARGET_DOMAIN} does NOT resolve to 82.29.165.59."
  fi
else
  echo "No domain provided to preflight check (defaulting to Mode A check)."
fi

echo ""
echo "========================================================================"
echo "✅ PREFLIGHT COMPLETE. Baseline saved to ${OUTPUT_FILE}."
echo "========================================================================"
