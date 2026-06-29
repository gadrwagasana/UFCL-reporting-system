#!/usr/bin/env bash
# UFCL Cron Setup — install all scheduled tasks
# Run once as root or the service account on the production server.
#
# Usage:
#   sudo bash tools/cron-setup.sh
#   sudo bash tools/cron-setup.sh --dry-run

set -euo pipefail

DRY_RUN=false
[ "${1:-}" = "--dry-run" ] && DRY_RUN=true

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKUP_SCRIPT="$SCRIPT_DIR/backup.sh"
ENV_FILE="/opt/ufcl-api/.env"

# Ensure backup script is executable
chmod +x "$BACKUP_SCRIPT"

# Load DB password from .env so cron job can authenticate
PGPASSWORD=""
if [ -f "$ENV_FILE" ]; then
  PGPASSWORD=$(grep '^PGPASSWORD=' "$ENV_FILE" | cut -d= -f2- | tr -d '"' || true)
fi

# ── Cron entries ──────────────────────────────────────────────────────────────
# Backup: daily at 02:00, runs as current user, logs to backup.log
BACKUP_CRON="0 2 * * * PGPASSWORD='${PGPASSWORD}' $BACKUP_SCRIPT >> /opt/ufcl-backups/cron.log 2>&1"

# Log cleanup: remove log files older than 30 days, weekly on Sunday at 03:00
LOG_CRON="0 3 * * 0 find /opt/ufcl-api/logs -name 'app-*.log' -mtime +30 -delete 2>/dev/null"

# ── Install ───────────────────────────────────────────────────────────────────
install_cron() {
  local entry="$1"
  local tag="$2"

  if crontab -l 2>/dev/null | grep -qF "$tag"; then
    echo "[cron] already installed: $tag"
    return
  fi

  if $DRY_RUN; then
    echo "[dry-run] would add: $entry"
    return
  fi

  (crontab -l 2>/dev/null; echo "$entry") | crontab -
  echo "[cron] installed: $entry"
}

install_cron "$BACKUP_CRON"   "backup.sh"
install_cron "$LOG_CRON"      "app-*.log"

echo ""
echo "Active crontab:"
crontab -l
echo ""
echo "Done. Backup runs daily at 02:00 AM."
echo "Logs: /opt/ufcl-api/logs/"
echo "Backups: /opt/ufcl-backups/"
