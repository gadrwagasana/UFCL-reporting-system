#!/usr/bin/env bash
# UFCL — UFW firewall configuration for the production API server
# ─────────────────────────────────────────────────────────────────────────────
# Usage: sudo bash tools/firewall-setup.sh [--dry-run]
#
# Resulting policy:
#   ALLOW  22/tcp   — SSH administration
#   ALLOW  80/tcp   — HTTP (nginx redirects to HTTPS)
#   ALLOW  443/tcp  — HTTPS (nginx reverse proxy → Express :3001)
#   DENY   3001/tcp — Express direct (localhost only via nginx)
#   DENY   5432/tcp — PostgreSQL direct (localhost only)
#   DENY   all else — default deny incoming
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

DRY_RUN=false
[ "${1:-}" = "--dry-run" ] && DRY_RUN=true

run() {
  if $DRY_RUN; then
    echo "[dry-run] $*"
  else
    "$@"
  fi
}

echo "[firewall] Configuring UFW for UFCL production server..."
echo ""

# Reset to a known-clean state
run ufw --force reset

# Default stance: deny all incoming, allow all outgoing
run ufw default deny incoming
run ufw default allow outgoing

# SSH — always first so we don't lock ourselves out
run ufw allow 22/tcp comment 'SSH administration'

# Nginx: HTTP + HTTPS
run ufw allow 80/tcp  comment 'HTTP → HTTPS redirect (nginx)'
run ufw allow 443/tcp comment 'HTTPS API + dashboard (nginx)'

# Block Express and PostgreSQL from all external IPs.
# These are only reachable via localhost; nginx and the app itself connect internally.
run ufw deny 3001/tcp comment 'Express — blocked; use nginx on 443'
run ufw deny 5432/tcp comment 'PostgreSQL — blocked; localhost only'

# Enable
run ufw --force enable

echo ""
echo "[firewall] Active rules:"
ufw status verbose

echo ""
echo "[firewall] Done."
echo "  External traffic reaches Express only through nginx on port 443."
echo "  Direct access to :3001 and :5432 is blocked from all external IPs."
