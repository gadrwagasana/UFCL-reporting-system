# UFCL Server Maintenance Guide

Routine procedures to keep the production server healthy.

---

## Daily (5 minutes — can be scripted)

```bash
# Health check
curl -s http://192.168.1.5:3001/api/health | jq '{ok, uptime, memory}'
curl -s http://192.168.1.5:3001/api/ready  | jq '{ok, db}'

# Check error log for new entries
TODAY=$(date +%Y-%m-%d)
grep '"level":"error"' /opt/ufcl-api/logs/app-${TODAY}.log 2>/dev/null | tail -5 | jq .

# Confirm last backup ran
tail -3 /opt/ufcl-backups/backup.log

# Quick disk check
df -h / /opt | awk 'NR==1 || /\/(opt)?$/'
```

---

## Weekly (15 minutes)

### 1. Review security logs

```bash
# Failed login attempts
TODAY=$(date +%Y-%m-%d)
grep 'login_failed\|login_denied' /opt/ufcl-api/logs/app-${TODAY}.log | wc -l

# Rate limit violations
grep '"rate_limit_hits"' /opt/ufcl-api/logs/app-${TODAY}.log | wc -l

# Invalid tokens (possible replay attacks)
grep '"auth_invalid_token"' /opt/ufcl-api/logs/app-${TODAY}.log | wc -l
```

Investigate if auth failures > 200 per day — may indicate brute-force attempts.

### 2. Check slow requests

```bash
# Find the slowest requests this week
for f in /opt/ufcl-api/logs/app-*.log; do
  grep 'slow_request' "$f"
done | jq --slurp 'sort_by(.ms) | reverse | .[:10] | .[] | {ts, path, ms}'
```

### 3. PostgreSQL maintenance

```bash
# Vacuum and analyze (removes dead tuples, updates query planner stats)
psql -U postgres -d ufcl_production -c "VACUUM ANALYZE;"

# Check for bloated tables
psql -U postgres -d ufcl_production -c "
  SELECT schemaname, tablename,
         n_dead_tup,
         n_live_tup,
         round(n_dead_tup::numeric / NULLIF(n_live_tup + n_dead_tup, 0) * 100, 1) AS dead_pct
  FROM pg_stat_user_tables
  WHERE n_dead_tup > 1000
  ORDER BY n_dead_tup DESC
  LIMIT 10;"
```

### 4. Verify backup integrity

```bash
# Verify most recent dump
LATEST=$(ls -t /opt/ufcl-backups/daily/db-*.sql.gz | head -1)
echo "Testing: $LATEST"
gzip --test "$LATEST" && echo "OK" || echo "CORRUPT — run backup manually"
```

---

## Monthly (30 minutes)

### 1. OS security updates

```bash
sudo apt update
sudo apt list --upgradable 2>/dev/null | head -20

# Apply security updates only
sudo apt-get upgrade --only-upgrade -y

# Apply all updates (schedule for low-usage time)
sudo apt upgrade -y
sudo reboot   # if kernel was updated
```

### 2. PostgreSQL vacuum full (low-usage time — can lock tables briefly)

```bash
pm2 stop mobile-api
psql -U postgres -d ufcl_production -c "VACUUM FULL ANALYZE;"
pm2 start mobile-api
```

### 3. Restore test (see BACKUP_AND_RESTORE.md)

Run the quarterly restore test quarterly — see BACKUP_AND_RESTORE.md.

### 4. Log archive

```bash
# Compress logs older than 7 days
find /opt/ufcl-api/logs/ -name 'app-*.log' -mtime +7 -exec gzip {} \;

# Move monthly archives to cold storage
MONTH=$(date -d "last month" +%Y-%m)
mkdir -p /opt/ufcl-backups/log-archive/
cp /opt/ufcl-api/logs/app-${MONTH}-*.log.gz /opt/ufcl-backups/log-archive/ 2>/dev/null || true
```

### 5. Review metrics trend

```bash
curl -s http://localhost:3001/api/metrics | jq '{
  uptime_days: (.uptime_seconds / 86400 | floor),
  requests_total,
  requests_5xx,
  auth_invalid_token,
  rate_limit_hits,
  avg_ms:         .response_ms.avg,
  p95_ms:         .response_ms.p95,
  heap_mb:        .memory.heap_used_mb,
  load_5m:        .system.load_5m,
  free_mem_mb:    .system.free_mem_mb,
  apk_version
}'
```

Record this monthly for trend awareness.

### 6. Certificate renewal (if using HTTPS / Let's Encrypt)

```bash
# Let's Encrypt auto-renews via certbot timer — verify it's running
systemctl status certbot.timer

# Force renewal check
sudo certbot renew --dry-run

# Check certificate expiry dates
sudo certbot certificates
```

### 7. Review audit log

```sql
-- Top actions last 30 days
SELECT action_type, COUNT(*) AS count
FROM audit_log
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY action_type
ORDER BY count DESC;

-- Users with most activity
SELECT username, role, COUNT(*) AS actions
FROM audit_log
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY username, role
ORDER BY actions DESC
LIMIT 10;

-- Login failures last 30 days
SELECT DATE(created_at) AS day, COUNT(*) AS failures
FROM audit_log
WHERE action_type = 'login_failed'
  AND created_at >= NOW() - INTERVAL '30 days'
GROUP BY day
ORDER BY day;
```

---

## Quarterly

### 1. Restore test (mandatory)

Perform a full DB restore to a test database and verify counts. See BACKUP_AND_RESTORE.md.

### 2. Security review

```bash
# Review active user accounts
psql -U postgres -d ufcl_production -c "
  SELECT username, role, active, last_login,
         created_at::date AS created
  FROM app_users
  ORDER BY active DESC, role, username;"

# Deactivate accounts for leavers
psql -U postgres -d ufcl_production -c "
  UPDATE app_users SET active = false WHERE username = 'leaver_username';"
```

### 3. JWT_SECRET rotation (if required by policy)

```bash
# 1. Generate new secret (32+ bytes)
NEW_SECRET=$(openssl rand -hex 32)
echo "JWT_SECRET=$NEW_SECRET"

# 2. Update .env on server
sed -i "s/^JWT_SECRET=.*/JWT_SECRET=$NEW_SECRET/" /opt/ufcl-api/.env

# 3. Restart API (all existing JWTs immediately invalid — users must re-login)
pm2 restart mobile-api

# 4. Update desktop ERP .env too (electron app)
# Note: all logged-in mobile users will see "Token expired — please log in again"
```

### 4. Update Node.js

```bash
# Check current
node --version

# Install LTS via nvm
nvm install --lts
nvm use --lts
nvm alias default node

# Restart services
pm2 restart all
```

---

## Adding a New PM2 Deployment

If replacing the server or setting up a standby:

```bash
# 1. Install Node.js (via nvm)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
source ~/.bashrc
nvm install 22
nvm use 22

# 2. Clone or copy the app
git clone https://github.com/gadrwagasana/UFCL-reporting-system.git /opt/ufcl-api
# or: rsync -avz primary-server:/opt/ufcl-api/ /opt/ufcl-api/

# 3. Install dependencies
cd /opt/ufcl-api/mobile-api && npm install

# 4. Copy .env from backup
cp /path/to/backup/config.tar.gz /tmp/
tar -xzf /tmp/config.tar.gz -C /opt/ufcl-api/

# 5. Create updates directory
mkdir -p /opt/ufcl-api/mobile-api/updates

# 6. Start with PM2
cd /opt/ufcl-api/mobile-api
pm2 start server.js --name mobile-api
pm2 startup && pm2 save

# 7. Install cron jobs
cd /opt/ufcl-api && bash tools/cron-setup.sh

# 8. Health check
curl http://localhost:3001/api/ready
```

---

## Disk Space Management

```bash
# Check what's using space
du -sh /opt/ufcl-api/* | sort -hr | head -10
du -sh /opt/ufcl-backups/* | sort -hr | head -10

# Remove old APK files manually if disk is tight
ls -lh /opt/ufcl-api/updates/

# Purge old log files (keep last 14 days)
find /opt/ufcl-api/logs/ -name '*.log' -mtime +14 -delete

# Vacuum PostgreSQL to reclaim space
psql -U postgres -d ufcl_production -c "VACUUM FULL;"

# Alert thresholds
# WARNING: disk > 70% full
# CRITICAL: disk > 85% full — increase storage or archive old backups
df -h / | awk 'NR==2 {print "Disk:", $5, "used"}'
```
