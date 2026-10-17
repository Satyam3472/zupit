# Zupit VPS Production Deployment & Operations Guide

> **Host:** `82.29.165.59`  
> **Active Target Mode:** Mode A (`http://82.29.165.59:3100`)  
> **Deployment Directory:** `/opt/zupit`  
> **Coexisting Services:** `brickflow_app` (`http://82.29.165.59:3000`), Coolify Suite (`:8000`, `:8080`, `:80`, `:443`)

---

## 1. Mode A vs. Mode B Deployment

### Mode A (Active in this deployment)
- **URL:** `http://82.29.165.59:3100`
- **Why Mode A was chosen:** The user explicitly directed deployment to `http://82.29.165.59:3100` without requiring a custom domain name or DNS modifications.
- **Trade-offs & Security Implications:**
  - **No TLS Encryption:** Traffic between client browsers and Caddy on port 3100 is unencrypted HTTP.
  - **Testing Cookie Security:** `COOKIE_SECURE=false` is set in `/opt/zupit/.env.production` so auth cookies (`admin_token`, `rider_access_token`) function over plain HTTP across external IP networks.
  - **Pilot Fallback Active:** `ALLOW_MOCK_SMS=true` is enabled for demo/testing without incurring live SMS gateway charges. OTPs are securely logged to container stdout.
  - **Intended Scope:** Strict staging, QA testing, internal pilots, and live Playwright E2E verification.

### Switching to Mode B (Production TLS with Custom Domain)
When a domain (e.g., `zupit.in` or `app.zupit.in`) is pointed at `82.29.165.59`:

1. **Option 1: Via Existing Traefik / Coolify Proxy (Ports 80 & 443)**
   - Connect `zupit_edge` or `zupit_app` to the `coolify` Docker network:
     ```yaml
     networks:
       coolify:
         external: true
     ```
   - Add Traefik labels to `zupit_app` or route through Coolify UI for automatic Let's Encrypt TLS certificate provisioning on `https://app.zupit.in`.

2. **Option 2: Standalone Caddy on Dedicated Port (e.g. 8443 or domain-specific)**
   - Update `/opt/zupit/Caddyfile.vps`:
     ```caddyfile
     app.zupit.in {
         encode zstd gzip
         reverse_proxy app:3000
     }
     ```
   - In `/opt/zupit/.env.production`, set:
     ```bash
     COOKIE_SECURE=true
     APP_URL=https://app.zupit.in
     ```
   - Restart the stack:
     ```bash
     docker compose -f /opt/zupit/docker-compose.vps.yml up -d
     ```

---

## 2. Existing Application Baseline & Coexistence Guarantee

An existing application (`brickflow_app`) was live on `http://127.0.0.1:3000/` prior to Zupit deployment. To ensure zero disruption, strict preflight and post-deployment baselines were enforced.

### Baseline Specifications
- **Container Name:** `brickflow_app` (Image: `brickflow-app`)
- **Started At:** `2026-10-16T20:20:27.441417092Z`
- **Port:** `0.0.0.0:3000->3000/tcp` (bridged via `docker-proxy`)
- **HTTP Endpoint:** `http://127.0.0.1:3000/`
- **Expected Status Code:** `307 Temporary Redirect` (redirects to `/login`)
- **Response SHA-256 Hash:** `24dbc7c0f38339cc7ed6144118672f2a22031ba4ecd85e5587db0d3c827602f9`

### How to Verify Existing App Health
Run on the VPS:
```bash
# 1. Verify response hash matches baseline
curl -s http://127.0.0.1:3000/ | sha256sum

# 2. Verify container was never restarted
docker inspect -f '{{.State.StartedAt}}' brickflow_app
```

---

## 3. Server Resource Footprint

Measurements taken under live idle conditions with all 5 Zupit services running:

### Zupit Services Memory Footprint
| Service Container | Role | Memory Limit | Idle Memory Usage | % of Host |
| :--- | :--- | :--- | :--- | :--- |
| `zupit_app` | Node.js 22 Next.js App | 768 MiB | ~115 MiB | 1.4% |
| `zupit_db` | PostgreSQL 16 Alpine | 768 MiB | ~47 MiB | 0.6% |
| `zupit_minio` | MinIO S3 Object Storage | 384 MiB | ~72 MiB | 0.9% |
| `zupit_edge` | Caddy 2.8 Reverse Proxy | 256 MiB | ~15 MiB | 0.2% |
| `zupit_backup` | Automated Nightly Backup Cron | 256 MiB | ~0.5 MiB | 0.01% |
| **Total Zupit Stack** | — | **2.4 GiB Max** | **~250 MiB** | **~3.1%** |

### Host Memory & Swap Status
```
               total        used        free      shared  buff/cache   available
Mem:            7940        1536         610         292        6393        6404
Swap:           2047           0        2047
```
- **Available Host RAM:** **6,404 MB** (80.6% free/available).
- **Swap:** 2,048 MB swapfile active (`/swapfile`), 0 MB used.
- **Host Reboot Status:** Skipped per explicit user directive; zero downtime incurred on `brickflow_app`.

---

## 4. Architecture & Isolation Topology

```mermaid
graph TD
    subgraph Internet & Clients
        Client[Web Browser / Mobile Client]
    end

    subgraph Host Network (82.29.165.59)
        Port3000[Host Port :3000]
        Port3100[Host Port :3100]
        Port80_443[Host Ports :80, :443, :8000, :8080]
        BrickApp[brickflow_app Container]
        Coolify[Coolify & Traefik Containers]
    end

    subgraph Zupit Docker Network (zupit_network - Isolated Bridge)
        Caddy[zupit_edge: Caddy 2.8]
        App[zupit_app: Node.js 22 Standalone]
        DB[(zupit_db: PostgreSQL 16)]
        MinIO[(zupit_minio: MinIO S3)]
        Backup[zupit_backup: Cron Worker]
    end

    subgraph Named Docker Volumes
        V_DB[(zupit_db_data)]
        V_MinIO[(zupit_minio_data)]
        V_Backups[(zupit_backups)]
        V_CaddyData[(zupit_caddy_data)]
    end

    Client -->|http://82.29.165.59:3000| Port3000 --> BrickApp
    Client -->|http://82.29.165.59:3100| Port3100 --> Caddy
    Client -->|Coolify Dashboard| Port80_443 --> Coolify

    Caddy -->|Reverse Proxy :3000| App
    App -->|pg:5432| DB
    App -->|s3:9000| MinIO
    Backup -.->|pg_dump & mc mirror| DB
    Backup -.->|Nightly Tarball| MinIO

    DB --- V_DB
    MinIO --- V_MinIO
    Backup --- V_Backups
    Caddy --- V_CaddyData
```

### Complete Isolation Guarantees
1. **Ports:** Only port `3100` is exposed to the host by Zupit. `zupit_app` listens on internal port `3000` only within the private Docker bridge network `zupit_network`. It never binds to host `0.0.0.0:3000`.
2. **Project Prefix:** All containers use `zupit_` prefix; project name is set to `zupit`.
3. **Volumes:** All persistent storage uses named volumes (`zupit_db_data`, `zupit_minio_data`, `zupit_backups`, `zupit_caddy_data`).

---

## 5. Operator Runbook

All commands are executed on the VPS from `/opt/zupit`:

```bash
cd /opt/zupit
```

### 1. View Service Status & Logs
```bash
# Check status of all Zupit containers
docker compose -f docker-compose.vps.yml ps

# View live application logs
docker compose -f docker-compose.vps.yml logs -f app

# View database logs
docker compose -f docker-compose.vps.yml logs -f db

# View edge proxy logs
docker compose -f docker-compose.vps.yml logs -f edge
```

### 2. Restart Zupit Services (Safe & Isolated)
Restarting Zupit will not affect `brickflow_app` or Coolify:
```bash
# Restart only Zupit
docker compose -f /opt/zupit/docker-compose.vps.yml restart
```

### 3. Deploy a New Version
```bash
cd /opt/zupit

# 1. Pull latest code or sync deployment files
git pull origin main

# 2. Rebuild application image
docker compose -f docker-compose.vps.yml build app

# 3. Apply database migrations
docker compose -f docker-compose.vps.yml run --rm migrate

# 4. Recreate containers with zero downtime
docker compose -f docker-compose.vps.yml up -d
```

### 4. Rollback to Previous Version
```bash
cd /opt/zupit

# 1. Check out previous commit or tag
git checkout <PREVIOUS_COMMIT_SHA>

# 2. Rebuild and restart
docker compose -f docker-compose.vps.yml build app
docker compose -f docker-compose.vps.yml up -d app
```

### 5. Trigger a Manual Backup
Backups create a timestamped archive containing:
- Compressed PostgreSQL database dump (`.sql.gz`)
- Checksum verification file (`.sha256`)
- MinIO prescription storage archive

```bash
docker compose -f /opt/zupit/docker-compose.vps.yml exec -T backup /usr/local/bin/backup-now.sh
```
Backups are saved to `/var/backups/zupit` inside the `zupit_backups` volume, with automatic 7-day retention pruning.

### 6. Restore from Backup (With Typed Confirmation Safety)
To prevent accidental data loss in production, the restore script requires typed confirmation:

```bash
# 1. List available backup archives
docker compose -f /opt/zupit/docker-compose.vps.yml exec -T backup ls -lh /var/backups/zupit

# 2. Execute restore (replace with specific backup filename)
docker compose -f /opt/zupit/docker-compose.vps.yml exec -it backup /usr/local/bin/restore.sh /var/backups/zupit/zupit_backup_<TIMESTAMP>.tar.gz
```
The script will prompt:
```
Type 'YES_RESTORE_ZUPIT_PROD' to confirm database overwrite:
```
Typing any other string immediately aborts the operation without modifying data.

### 7. Rotate Production Secrets
1. Generate new 32-character random keys:
   ```bash
   openssl rand -hex 32
   ```
2. Update `/opt/zupit/.env.production` with the new values for `JWT_SECRET`, `DELIVERY_CODE_SECRET`, or `ADMIN_PASSWORD_HASH`.
3. Re-read environment variables by restarting the application container:
   ```bash
   docker compose -f /opt/zupit/docker-compose.vps.yml up -d app
   ```

### 8. Complete Stack Teardown & Uninstall (Clean Removal)
To remove Zupit and all associated containers, networks, and volumes without touching anything else on the server:

```bash
# 1. Stop and remove containers, networks, and volumes
docker compose -f /opt/zupit/docker-compose.vps.yml down -v

# 2. Delete Zupit deploy directory
rm -rf /opt/zupit
```

---

## 6. Verification Checklist Summary

| Verification Item | Command / URL | Result |
| :--- | :--- | :--- |
| **Health Check** | `http://82.29.165.59:3100/api/v1/health` | `{"status":"healthy","database":"connected"}` |
| **Prescription Upload** | Customer Rx upload to MinIO S3 | Verified in Playwright E2E (`ZP-10001`) |
| **Rider OTP Authentication** | `POST /api/v1/rider/auth/verify-otp` | Verified in Playwright E2E |
| **Bill Submission & Settlement**| `POST /api/v1/rider/orders/:id/bills` | Verified in Playwright E2E (₹320 bill) |
| **Customer Delivery Code** | Dynamic 4-digit code exchange | Verified in Playwright E2E |
| **Admin Order & Rx Review** | `http://82.29.165.59:3100/admin` | Verified in Playwright E2E (Delivered status + Rx image) |
| **Existing App Coexistence** | `http://127.0.0.1:3000/` SHA256 | `24dbc7c0f38339cc7ed6144118672f2a22031ba4ecd85e5587db0d3c827602f9` (Uptime preserved) |
