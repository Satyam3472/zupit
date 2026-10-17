# 🚀 Zupit Production Deployment Guide (Ubuntu 24.04 VPS)

This guide walks you through deploying **Zupit** on a single **Ubuntu 24.04 LTS VPS** (2 vCPU, 4 GB RAM minimum) using **Docker Compose** (`docker-compose.prod.yml`), **Caddy** (automated SSL/TLS for app and MinIO), **PostgreSQL 16**, **MinIO**, and automated nightly **backups**.

---

## 1. Architecture & Resource Allocation

### Host Hardware Spec
- **Target OS**: Ubuntu 24.04 LTS (x86_64)
- **CPU / RAM**: 2 vCPU, 4 GB RAM
- **Region**: Mumbai / India (`ap-south-1` AWS, `BLR1` DigitalOcean, `in-maa` Linode) for low-latency delivery across Bihar / Jamui users.

### Container Resource Limits (within 4 GB RAM)
| Container | Role | Memory Limit | Ports / Network | Notes |
| :--- | :--- | :--- | :--- | :--- |
| **`zupit-caddy`** | Reverse Proxy & Auto HTTPS | ~128 MB | 80/tcp, 443/tcp, 443/udp | `edge` network only. Terminates TLS for `DOMAIN` & `files.DOMAIN`. |
| **`zupit-app`** | Node 22 Alpine (Express + Vite) | 1024 MB (1g) | `internal` & `edge` | Non-root `node`, read-only root FS, tmpfs on `/tmp` and `.next/cache`. |
| **`zupit-db`** | PostgreSQL 16 Alpine | ~1.5 GB | `internal` only | Tuned for 4GB RAM (`shared_buffers 512MB`, `effective_cache_size 1.5GB`). |
| **`zupit-minio`** | S3-Compatible File Store | ~256 MB | `internal` & `edge` | Internal only. Presigned URLs routed through `files.DOMAIN:9000`. |
| **`zupit-backup`**| Automated Daily Backup | ~128 MB | `internal` only | Nightly pg_dump at 02:30 IST in custom format (-Fc), gzip, rclone sync. |
| **`zupit-worker`**| pg-boss Task Worker | 512 MB | `internal` only | Profile `worker` (disabled until Phase 7). |
| **Host Reserve** | Ubuntu 24.04 kernel, systemd & Docker | ~1000 MB | 22 (SSH) | 2GB swap space provides safety margin. |

---

## 2. Server Preparation (Ubuntu 24.04)

### Step 2.1: Update & Install Base Tools
Connect to your VPS via SSH:
```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl git ufw htop ca-certificates gnupg
```

### Step 2.2: Configure 2GB Swap (Memory Safety Buffer)
A 2GB swap file prevents out-of-memory crashes during traffic surges:
```bash
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

### Step 2.3: Firewall (UFW)
Open SSH, HTTP, and HTTPS:
```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp comment 'SSH'
sudo ufw allow 80/tcp comment 'HTTP'
sudo ufw allow 443/tcp comment 'HTTPS'
sudo ufw allow 443/udp comment 'HTTP3 QUIC'
sudo ufw enable
```

---

## 3. Install Docker Engine & Docker Compose

Run the official Docker setup for Ubuntu 24.04:
```bash
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Enable Docker on boot
sudo systemctl enable --now docker
```

---

## 4. Deploying Zupit

### Step 4.1: Clone Repository
```bash
sudo mkdir -p /opt/zupit
sudo chown -R $USER:$USER /opt/zupit
git clone <YOUR_GIT_REPO_URL> /opt/zupit
cd /opt/zupit
```

### Step 4.2: Configure Production Environment (`.env.production`)
Copy the production template:
```bash
cp .env.production.example .env.production
```

Generate cryptographically secure secrets:
```bash
# Generate JWT_SECRET
openssl rand -hex 32

# Generate DELIVERY_CODE_SECRET
openssl rand -hex 32

# Generate Database Password
openssl rand -hex 24

# Generate MinIO Root Password
openssl rand -hex 24
```

Edit `.env.production` (`nano .env.production`):
```ini
NODE_ENV=production
PORT=3000
DOMAIN_NAME=yourdomain.in

POSTGRES_USER=zupit_admin
POSTGRES_PASSWORD=<INSERT_GENERATED_DB_PASSWORD>
POSTGRES_DB=zupit_prod

MINIO_ROOT_USER=zupit_minio_admin
MINIO_ROOT_PASSWORD=<INSERT_GENERATED_MINIO_PASSWORD>

JWT_SECRET=<INSERT_GENERATED_JWT_SECRET>
DELIVERY_CODE_SECRET=<INSERT_GENERATED_DELIVERY_SECRET>

SMS_PROVIDER=msg91
ALLOW_MOCK_SMS=false
MSG91_AUTH_KEY=<YOUR_MSG91_AUTH_KEY>
MSG91_OTP_TEMPLATE_ID=<YOUR_MSG91_TEMPLATE_ID>
MSG91_SENDER_ID=ZUPITM

SEED_ON_INIT=true
ADMIN_NAME="Jamui Hub Owner"
ADMIN_EMAIL=owner@zupit.in
ADMIN_PHONE=6207856200
ADMIN_PASSWORD=<STRONG_INITIAL_ADMIN_PASSWORD>
```

> [!IMPORTANT]
> **Production Guard**: Zupit refuses to boot if `NODE_ENV=production` and `JWT_SECRET` or `DELIVERY_CODE_SECRET` is shorter than 32 characters or equals an example value.
> **SMS Guard**: If `SMS_PROVIDER=mock`, the app refuses to boot in production unless `ALLOW_MOCK_SMS=true` is explicitly set.

### Step 4.3: Build & Tag Images
Run the build script to tag with git short SHA and `latest`:
```bash
./scripts/build-prod.sh
```

### Step 4.4: Start the Production Stack
```bash
docker compose -f docker-compose.prod.yml up -d
```

Execution sequence:
1. `db` starts and runs healthcheck (`pg_isready`).
2. `migrate` runs `drizzle-kit migrate` against `db` and completes successfully.
3. `minio` starts and initializes bucket `zupit-private` via `minio-init` (anonymous access disabled, 1-day lifecycle rule).
4. `app` boots on port 3000 with read-only root filesystem, tmpfs on `/tmp` and `.next/cache`, and memory limit 1g.
5. `caddy` binds ports 80/443, issues Let's Encrypt certificates automatically for `yourdomain.in` and `files.yourdomain.in`, and proxies traffic.
6. `backup` scheduler begins monitoring `db` for nightly backup at 02:30 IST.

Check container statuses:
```bash
docker compose -f docker-compose.prod.yml ps
```

---

## 5. Verifying Deployment & Health Checks

### 5.1 Main App Health Check
```bash
curl -I https://yourdomain.in/api/v1/health
```
Expected output:
```http
HTTP/2 200 
content-type: application/json; charset=utf-8
```
Response body:
```json
{
  "status": "healthy",
  "database": "connected",
  "timestamp": "2026-10-17T09:00:00.000Z"
}
```

If the database is down, it immediately returns:
```http
HTTP/2 503 Service Unavailable
```

### 5.2 MinIO Storage Gateway Verification
Verify presigned file URL endpoint is reachable via Caddy:
```bash
curl -I https://files.yourdomain.in/minio/health/live
```
Expected: `HTTP/2 200`
(MinIO web console on port 9001 is completely internal and unreachable from the internet).

---

## 6. Pilot Mode (Mock SMS Fallback)

If SMS gateway approval is in progress during a pilot:
1. In `.env.production`:
   ```ini
   SMS_PROVIDER=mock
   ALLOW_MOCK_SMS=true
   ```
2. Restart the app:
   ```bash
   docker compose -f docker-compose.prod.yml restart app
   ```
3. A loud warning is logged on start, and customer/rider OTPs will be printed in container logs:
   ```bash
   docker compose -f docker-compose.prod.yml logs -f app | grep -A 5 "MOCK SMS PROVIDER"
   ```

---

## 7. Automated Nightly Database Backups

The `backup` container automatically executes nightly at **02:30 IST** using `pg_dump -Fc` piped through `gzip -9`:
- **Daily retention**: 14 daily backup files in `zupit_backup_data` volume.
- **Weekly retention**: 8 weekly backup copies preserved on Sundays.
- **Remote sync**: Optional sync to AWS S3, Cloudflare R2, or Wasabi via `rclone` if `BACKUP_REMOTE_BUCKET` is configured.

Manual test trigger:
```bash
docker compose -f docker-compose.prod.yml exec backup /scripts/backup.sh
```

Inspect backup archive:
```bash
docker compose -f docker-compose.prod.yml exec backup ls -lh /backups/daily
```

Restore database from a backup:
```bash
docker compose -f docker-compose.prod.yml exec -T db pg_restore -U zupit_admin -d zupit_prod --clean < /path/to/backup.dump
```

---

## 8. Updating Zupit

```bash
cd /opt/zupit
git pull origin main
./scripts/build-prod.sh
docker compose -f docker-compose.prod.yml up -d
```
Migrations run automatically before the updated app accepts traffic.
