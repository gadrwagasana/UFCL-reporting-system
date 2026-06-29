#!/usr/bin/env bash
# UFCL Production Backup Script
# Handles daily, weekly (Monday), and monthly (1st) backups with automatic rotation.
#
# Usage:
#   ./tools/backup.sh
#   BACKUP_DIR=/mnt/nas ./tools/backup.sh
#
# Install in cron via:
#   ./tools/cron-setup.sh

set -euo pipefail

# ── Configuration ─────────────────────────────────────────────────────────────
BACKUP_BASE="${BACKUP_DIR:-/opt/ufcl-backups}"
APP_DIR="${APP_DIR:-/opt/ufcl-api}"

# Database (read from environment — same values as in .env)
DB_NAME="${PGDATABASE:-ufcl_production}"
DB_USER="${PGUSER:-postgres}"
DB_HOST="${PGHOST:-localhost}"
DB_PORT="${PGPORT:-5432}"

# Retention
DAILY_KEEP="${DAILY_KEEP:-7}"
WEEKLY_KEEP="${WEEKLY_KEEP:-4}"
MONTHLY_KEEP="${MONTHLY_KEEP:-12}"

# Slow-query threshold ms (logged to backup.log for awareness)
SLOW_MS=2000

# ── Derived ───────────────────────────────────────────────────────────────────
TODAY=$(date +%Y-%m-%d)
NOW=$(date +%Y-%m-%dT%H:%M:%S)
DAY_OF_WEEK=$(date +%u)    # 1=Mon … 7=Sun
DAY_OF_MONTH=$(date +%-d)  # 1..31 (no leading zero)
WEEK_TAG=$(date +%Y-W%V)
MONTH_TAG=$(date +%Y-%m)

DAILY_DIR="$BACKUP_BASE/daily"
WEEKLY_DIR="$BACKUP_BASE/weekly/$WEEK_TAG"
MONTHLY_DIR="$BACKUP_BASE/monthly/$MONTH_TAG"
LOG_FILE="$BACKUP_BASE/backup.log"

# ── Helpers ───────────────────────────────────────────────────────────────────
log() { printf '[%s] %s\n' "$(date +%Y-%m-%dT%H:%M:%S)" "$*" | tee -a "$LOG_FILE"; }

die() { log "FATAL: $*"; exit 1; }

hr() { du -sh "$1" 2>/dev/null | cut -f1 || echo "?"; }

# ── Initialise directories ────────────────────────────────────────────────────
mkdir -p "$DAILY_DIR" "$BACKUP_BASE/weekly" "$BACKUP_BASE/monthly"

log "====== UFCL Backup started — $NOW ======"

# ── 1. PostgreSQL dump ────────────────────────────────────────────────────────
DB_FILE="$DAILY_DIR/db-${TODAY}.sql.gz"
log "Database → $DB_FILE"

PGPASSWORD="$PGPASSWORD" pg_dump \
  --host="$DB_HOST" \
  --port="$DB_PORT" \
  --username="$DB_USER" \
  --dbname="$DB_NAME" \
  --no-owner \
  --no-acl \
  --format=plain \
  | gzip --best > "$DB_FILE" \
  || die "pg_dump failed — check DB credentials and connectivity"

log "Database backup complete: $(hr $DB_FILE)"

# ── 2. Application configuration ─────────────────────────────────────────────
CFG_FILE="$DAILY_DIR/config-${TODAY}.tar.gz"
log "Configuration → $CFG_FILE"

tar --create --gzip \
    --file="$CFG_FILE" \
    --ignore-failed-read \
    --transform='s|^/||' \
    "${APP_DIR}/.env" \
    "/etc/nginx/sites-available/" \
    "/etc/nginx/nginx.conf" \
    2>/dev/null \
  || log "WARN: some config files not found — partial config archive created"

log "Config backup: $(hr $CFG_FILE)"

# ── 3. Update repository (APK + version.json + checksums) ─────────────────────
UPDATES_SRC="$APP_DIR/updates"
UPD_FILE="$DAILY_DIR/updates-${TODAY}.tar.gz"
if [ -d "$UPDATES_SRC" ] && [ "$(ls -A $UPDATES_SRC 2>/dev/null)" ]; then
  log "Updates → $UPD_FILE"
  tar --create --gzip --file="$UPD_FILE" -C "$APP_DIR" updates/
  log "Updates backup: $(hr $UPD_FILE)"
else
  log "Updates folder empty or absent — skipped"
fi

# ── 4. Weekly backup (Monday = day 1) ─────────────────────────────────────────
if [ "$DAY_OF_WEEK" = "1" ]; then
  log "Weekly backup → $WEEKLY_DIR"
  mkdir -p "$WEEKLY_DIR"
  cp -f "$DB_FILE" "$WEEKLY_DIR/" && log "  db copied"
  [ -f "$CFG_FILE" ] && cp -f "$CFG_FILE" "$WEEKLY_DIR/" && log "  config copied"
  [ -f "$UPD_FILE" ] && cp -f "$UPD_FILE" "$WEEKLY_DIR/" && log "  updates copied"
fi

# ── 5. Monthly backup (1st of month) ──────────────────────────────────────────
if [ "$DAY_OF_MONTH" = "1" ]; then
  log "Monthly backup → $MONTHLY_DIR"
  mkdir -p "$MONTHLY_DIR"
  cp -f "$DB_FILE" "$MONTHLY_DIR/" && log "  db copied"
  [ -f "$CFG_FILE" ] && cp -f "$CFG_FILE" "$MONTHLY_DIR/" && log "  config copied"
  [ -f "$UPD_FILE" ] && cp -f "$UPD_FILE" "$MONTHLY_DIR/" && log "  updates copied"
fi

# ── 6. Verify most recent DB dump can be read ─────────────────────────────────
log "Verifying DB dump integrity..."
if gzip --test "$DB_FILE" 2>/dev/null; then
  log "  Integrity OK"
else
  log "  WARN: gzip integrity check failed on $DB_FILE — backup may be corrupt"
fi

# ── 7. Rotation ───────────────────────────────────────────────────────────────
log "Rotating daily backups (keep last $DAILY_KEEP)"
for prefix in db config updates; do
  ls -t "$DAILY_DIR/${prefix}-"*.gz 2>/dev/null \
    | tail -n +$((DAILY_KEEP + 1)) \
    | xargs rm -f 2>/dev/null \
    || true
done

log "Rotating weekly backups (keep last $WEEKLY_KEEP)"
ls -dt "$BACKUP_BASE/weekly/"*/ 2>/dev/null \
  | tail -n +$((WEEKLY_KEEP + 1)) \
  | xargs rm -rf 2>/dev/null \
  || true

log "Rotating monthly backups (keep last $MONTHLY_KEEP)"
ls -dt "$BACKUP_BASE/monthly/"*/ 2>/dev/null \
  | tail -n +$((MONTHLY_KEEP + 1)) \
  | xargs rm -rf 2>/dev/null \
  || true

# ── 8. Summary ────────────────────────────────────────────────────────────────
DAILY_COUNT=$(ls "$DAILY_DIR/db-"*.gz 2>/dev/null | wc -l || echo 0)
WEEKLY_COUNT=$(ls -d "$BACKUP_BASE/weekly/"*/ 2>/dev/null | wc -l || echo 0)
MONTHLY_COUNT=$(ls -d "$BACKUP_BASE/monthly/"*/ 2>/dev/null | wc -l || echo 0)

log "====== Backup complete ======"
log "  Daily  : $DAILY_COUNT files (keep $DAILY_KEEP)"
log "  Weekly : $WEEKLY_COUNT weeks (keep $WEEKLY_KEEP)"
log "  Monthly: $MONTHLY_COUNT months (keep $MONTHLY_KEEP)"
log "  Total disk used: $(du -sh $BACKUP_BASE 2>/dev/null | cut -f1)"
