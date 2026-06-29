# UFCL Mobile v1.0.0 — Release Notes

**Release date:** 2026-06-29
**Platform:** Android 10+
**API:** UFCL Mobile API v1.0.0 (Express.js + PostgreSQL)

---

## Overview

UFCL Mobile v1.0.0 is the first production release of the Uganda Forest Corporation Limited mobile reporting system. It replaces all paper-based daily reports and Excel-based data capture across 12 operational departments.

---

## What's included

### Departments supported

| Department | Functions |
|---|---|
| CEO / Admin | Company-wide KPI overview, approval workflows |
| Harvesting Leader | Daily harvest entries, log transport, material requests, casual labour |
| Harvesting Supervisor | Harvest and log transport view (workshop-isolated) |
| Sawmill Leader | Daily production recording, timber volume tracking |
| Sawmill Supervisor | Production report view (read-only) |
| Poles Leader | Production, purchase orders (with VAT), deliveries, QC |
| Poles Supervisor | Poles production and delivery view |
| VAT Supervisor | Stock transfer intake and batch processing |
| Logistics | Delivery orders, status tracking, Proof of Delivery |
| Mechanician | Machine fuel logs, machine daily logs |
| Supervisor | Material requests, casual labour (own workshop) |
| Operations, Storekeeper, Finance, Sales | Approval, review, and monitoring views |

### Core features

- **Offline-first** — all create/submit workflows queue locally when no network; auto-sync on reconnect
- **Role-based access control** — backend-enforced; each role sees only its permitted screens and data
- **Workshop isolation** — supervisor-level roles are scoped to their assigned workshop via JWT; cross-workshop data access is blocked at the API level
- **Approval chain** — material requests and casual labour go through a configurable approval workflow (Leader → Operations/Storekeeper → CEO); no approval can be bypassed except by admin
- **Audit logging** — every login attempt (successful or failed), approval action, and data change is recorded in `audit_log` with timestamp, role, and user
- **Session restore** — closing and reopening the app revalidates the JWT silently; no re-login required within token lifetime
- **Monitoring dashboard** — live server metrics (active sessions, request rate, error counts, heap usage, DB latency) served at `/dashboard.html`

---

## Bug fixes applied in this release (from re-audit)

| ID | Severity | Description | Fix |
|---|---|---|---|
| BUG-01 | Critical | `/api/auth/me` returned snake_case raw DB row instead of camelCase user; `restoreSession()` stored full response object as user — caused role = undefined and wrong navigation on session restore | `/me` returns `{ ok, user: { camelCase fields } }`; `meApi()` typed correctly; `restoreSession()` and `revalidateSession()` extract `data.user` |
| BUG-02 | High | Vehicle Fuel tab rendered in Supervisor navigator but backend returned 403; caused a dead screen | Removed `VehicleFuel` tab from Supervisor navigator, types.ts, and supervisor permissions |
| BUG-03 | Narrow | `audit_log.role NOT NULL` constraint violated on "user not found" login attempts | Pass `'unknown'` string instead of `null` |
| BUG-04 | Docs | `SERVER_MAINTENANCE.md` tar restore command had a space in path (`-C / opt/`) | Fixed to `-C /opt/ufcl-api/` |

---

## Infrastructure delivered

- Nginx reverse proxy with TLS (HTTPS on port 443) — all HTTP redirected to HTTPS
- Self-signed certificate for LAN IP 192.168.1.5 (10-year validity)
- UFW firewall — only ports 22, 80, 443 open; Express (3001) and PostgreSQL (5432) blocked externally
- PM2 process management with auto-restart and systemd integration
- Log rotation — daily app logs (30 days), weekly PM2 logs (8 weeks), monthly backup log (12 months)
- PostgreSQL daily backup via cron, stored in `/opt/ufcl-backups/`

---

## Security notes

- JWT secret must be at least 32 characters, generated with `openssl rand -hex 32`
- `METRICS_TOKEN` is separate from JWT secret — dashboard access token only
- `.env` file must not be committed to git (already in `.gitignore`)
- TLS certificate is self-signed; install it on each Android device manually
- No user can be granted manager write-access without explicit CEO/admin authorisation

---

## Known limitations in v1.0.0

- Auto-update over-the-air is supported by the APK download endpoint but requires manual admin APK deployment
- Let's Encrypt TLS is not configured (LAN-only deployment; public domain required for ACME)
- Offline queue is stored in AsyncStorage; if device is cleared before syncing, queued items are lost
- Push notifications for approval status changes are not implemented (target: v1.1.0)

---

## Versioning going forward

| Tag | Type | Example |
|---|---|---|
| `v1.0.x` | Bug fixes, security patches | `v1.0.1` |
| `v1.1.x` | New features, improvements | `v1.1.0` |
| `v2.0.0` | Breaking changes, major new modules | `v2.0.0` |

---

## Archive contents

```
archive/v1.0.0/
  source/  ufcl-mobile-v1.0.0-source.tar.gz
  db/      ufcl-production-v1.0.0-<timestamp>.sql.gz
  apk/     UFCL-mobile-v1.0.0.apk
  docs/    UFCL_USER_MANUAL.html
           UFCL_ADMIN_MANUAL.html
           UFCL_UAT_PHASE13.html
           LAUNCH_CHECKLIST.md
           SERVER_MAINTENANCE.md
           RELEASE_NOTES_v1.0.0.md
  MANIFEST.txt
```
