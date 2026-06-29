# UFCL Backup and Restore

---

## What Is Backed Up

| Item | Daily | Weekly | Monthly | Notes |
|---|---|---|---|---|
| PostgreSQL database | ✅ | ✅ | ✅ | Full dump, gzip compressed |
| Server configuration (.env, nginx) | ✅ | ✅ | ✅ | Tar archive |
| Current APK + version.json + checksums | ✅ | ✅ | ✅ | From updates/ folder |

### Not backed up (available from GitHub)
- Application source code → `git clone` from GitHub
- Release APK history → GitHub Releases archive
- Mobile keystore → must be stored separately (see [DISASTER_RECOVERY.md](DISASTER_RECOVERY.md))

---

## Backup Schedule and Retention

| Type | When | Retention | Location |
|---|---|---|---|
| Daily | 02:00 AM every day | Last 7 days | `/opt/ufcl-backups/daily/` |
| Weekly | Monday 02:00 AM | Last 4 weeks | `/opt/ufcl-backups/weekly/YYYY-WNN/` |
| Monthly | 1st of month 02:00 AM | Last 12 months | `/opt/ufcl-backups/monthly/YYYY-MM/` |

### Backup file naming

```
/opt/ufcl-backups/
├── daily/
│   ├── db-2026-06-29.sql.gz          ← PostgreSQL dump
│   ├── config-2026-06-29.tar.gz      ← .env + nginx config
│   └── updates-2026-06-29.tar.gz     ← APK + version.json
├── weekly/
│   └── 2026-W26/
│       ├── db-2026-06-29.sql.gz
│       └── config-2026-06-29.tar.gz
├── monthly/
│   └── 2026-06/
│       ├── db-2026-06-01.sql.gz
│       └── config-2026-06-01.tar.gz
├── backup.log                         ← detailed backup run log
└── cron.log                           ← cron stdout/stderr
```

---

## One-Time Setup

Run once on the production server to install cron jobs:

```bash
cd /opt/ufcl-api
sudo bash tools/cron-setup.sh

# Verify cron was installed
crontab -l | grep backup
```

### Required environment variables

The backup script reads database credentials from the environment. Ensure these are set in crontab or `.env`:

```bash
PGHOST=localhost
PGPORT=5432
PGDATABASE=ufcl_production
PGUSER=postgres
PGPASSWORD=your-db-password
```

---

## Manual Backup (Run Anytime)

```bash
cd /opt/ufcl-api
PGPASSWORD="your-password" bash tools/backup.sh

# Custom backup destination
BACKUP_DIR=/mnt/external-drive PGPASSWORD="..." bash tools/backup.sh
```

---

## Verifying Backups

```bash
# Check last run was successful
tail -20 /opt/ufcl-backups/backup.log

# List all daily backups
ls -lh /opt/ufcl-backups/daily/

# Verify a dump file is not corrupt
gzip --test /opt/ufcl-backups/daily/db-2026-06-29.sql.gz && echo "OK"

# Preview database dump contents (first 50 lines)
zcat /opt/ufcl-backups/daily/db-2026-06-29.sql.gz | head -50

# Count tables in the dump
zcat /opt/ufcl-backups/daily/db-2026-06-29.sql.gz | grep "^CREATE TABLE" | wc -l

# Verify config archive
tar --list --file=/opt/ufcl-backups/daily/config-2026-06-29.tar.gz
```

---

## Restore Procedures

### A. Restore the database

> ⚠️ This will **OVERWRITE** all current data. Confirm the correct backup file before running.

```bash
# Step 1 — Choose the backup file to restore
BACKUP_FILE="/opt/ufcl-backups/daily/db-2026-06-29.sql.gz"
# or weekly: "/opt/ufcl-backups/weekly/2026-W26/db-2026-06-24.sql.gz"

# Step 2 — Stop the API so no writes occur during restore
pm2 stop mobile-api

# Step 3 — Drop and recreate the database (DESTRUCTIVE)
psql -U postgres -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'ufcl_production';"
psql -U postgres -c "DROP DATABASE IF EXISTS ufcl_production;"
psql -U postgres -c "CREATE DATABASE ufcl_production OWNER postgres;"

# Step 4 — Restore
zcat "$BACKUP_FILE" | psql -U postgres -d ufcl_production

# Step 5 — Verify row counts
psql -U postgres -d ufcl_production -c "\dt"
psql -U postgres -d ufcl_production -c "SELECT relname, n_live_tup FROM pg_stat_user_tables ORDER BY n_live_tup DESC LIMIT 10;"

# Step 6 — Restart API
pm2 start mobile-api
curl http://localhost:3001/api/ready
```

### B. Restore server configuration

```bash
BACKUP_FILE="/opt/ufcl-backups/daily/config-2026-06-29.tar.gz"

# Extract to root (restores to original paths)
sudo tar --extract --gzip --file="$BACKUP_FILE" --directory=/

# Reload nginx after restoring config
sudo nginx -t && sudo systemctl reload nginx

# Restart API after restoring .env
pm2 restart mobile-api
```

### C. Restore the current APK

```bash
BACKUP_FILE="/opt/ufcl-backups/daily/updates-2026-06-29.tar.gz"

pm2 stop mobile-api
tar --extract --gzip --file="$BACKUP_FILE" --directory=/opt/ufcl-api/
pm2 start mobile-api

# Verify
curl http://localhost:3001/version.json | jq .
```

---

## Testing Restores (Quarterly)

Restore testing prevents discovering backup failures during an actual disaster.

```bash
# 1. Create a test database
psql -U postgres -c "CREATE DATABASE ufcl_restore_test;"

# 2. Restore the latest backup into it
zcat /opt/ufcl-backups/daily/$(ls -t /opt/ufcl-backups/daily/db-*.sql.gz | head -1 | xargs basename) \
  | psql -U postgres -d ufcl_restore_test

# 3. Verify core tables exist and have data
psql -U postgres -d ufcl_restore_test -c "
SELECT 'app_users'::text AS tbl, COUNT(*) FROM app_users
UNION ALL
SELECT 'audit_log', COUNT(*) FROM audit_log
UNION ALL
SELECT 'harvest_logs', COUNT(*) FROM harvest_logs
UNION ALL
SELECT 'machines', COUNT(*) FROM machines;
"

# 4. Clean up test database
psql -U postgres -c "DROP DATABASE ufcl_restore_test;"

echo "Restore test complete"
```

---

## Off-Site Backup (Recommended)

For disaster recovery, copy backups to a second location:

```bash
# Option A: rsync to a NAS or secondary server
rsync -avz --delete /opt/ufcl-backups/ backup-server:/backups/ufcl/

# Option B: rclone to cloud storage (Backblaze B2, S3, etc.)
rclone sync /opt/ufcl-backups/ b2:ufcl-backups/

# Add to crontab (runs at 04:00 AM, after backup completes at 02:00 AM)
# 0 4 * * * rsync -az /opt/ufcl-backups/ backup-server:/backups/ufcl/
```
