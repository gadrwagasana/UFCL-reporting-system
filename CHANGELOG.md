# UFCL Mobile — Changelog

All notable changes to this project are documented in this file.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
Versioning follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.0.0] — 2026-06-29

**Initial production release.** Replaces all paper-based daily reporting and
Excel data capture across 12 operational departments at Uganda Forest
Corporation Limited.

### Added — Mobile Application

**Authentication**
- JWT-based login with 8-hour token expiry
- Session restore on app reopen (silent JWT revalidation via `/api/auth/me`)
- Offline session fallback using cached user profile (read-only, no writes)
- Secure token storage using Expo SecureStore (hardware-backed keystore)
- Role-aware navigation: each role maps to a dedicated bottom-tab navigator

**CEO / Admin module** (Sprint 1)
- Company-wide KPI overview dashboard
- Pending approvals queue with approve / reject actions
- Approval detail screen with full request context

**Supervisor module** (Sprint 2)
- Today's dashboard (submitted counts by type)
- Material request creation and history
- Casual labour request creation and history
- Workshop-scoped view (own workshop only)

**Material Requests** (Sprint 2)
- Create, view, filter by status (pending / approved / rejected)
- Approval workflow: Leader → Operations/Storekeeper → CEO
- Approved quantity visible to requester

**Casual Labour** (Sprint 2)
- Create labour requests with task, headcount, date range
- Status tracking through approval chain
- Review notes displayed to requester

**My Requests** (Sprint 2)
- Unified timeline combining material requests, casual labour, and edit/delete submissions
- Filter chips: All / Materials / Labour / Other
- Pull-to-refresh; review notes shown for rejected items

**Harvest module** (Sprint 3)
- Daily harvest entries with compartment, species, volume
- Today-highlighted list view
- Offline creation queue (submitted while offline, syncs on reconnect)
- Log transport entry (truck, destination, load details)

**Sawmill module** (Sprint 3)
- Daily production recording (logs processed, timber output)
- Timber volume calculations (logs received / ready / expected)
- Read-only supervisor view

**Poles module** (Sprint 4)
- Poles production recording
- Purchase order creation with VAT calculation
- Delivery recording with quantity confirmation
- QC (quality control) entry per batch

**VAT module** (Sprint 4)
- Inbound stock transfer intake
- Processed batch entry
- Supervisor read-only view

**Deliveries module** (Sprint 5)
- Delivery order list and status tracking
- Status update workflow (pending → in-transit → delivered)
- Delivery creation

**Proof of Delivery (POD)** (Sprint 5)
- POD capture against a delivery order
- POD list and detail views
- Signature/notes field

**Vehicle Fuel** (Sprint 5 — wired to Logistics navigator in Phase 15)
- Fuel fill-up recording per vehicle (date, litres, cost/L, odometer)
- Per-vehicle fuel history with vehicle picker
- Detail view with cost and odometer data

**Machine Fuel** (Sprint 5)
- Machine fuel issuance recording
- Fuel issue history list

**Machine Daily Logs** (Sprint 5)
- Daily machine activity logging (hours, operator, category)
- Machine log history

**Offline-first architecture**
- Zustand offline queue persisted to AsyncStorage
- UUID v4 IDs prevent duplicate submissions on retry
- Serial sync processing (MAX_RETRIES=3 per item)
- Failed items preserved with error for manual review
- Network monitor triggers sync + session revalidation on reconnect
- Offline banner visible across all authenticated screens

**OTA auto-update**
- Version check against `https://192.168.1.5/version.json` at app start and every 4 hours
- Resumable APK download with progress bar
- MD5 integrity verification before installation prompt
- Mandatory update flag forces immediate update (no dismiss)
- "Later" option snoozes non-mandatory updates

### Added — Backend API

- Express.js REST API on Node.js 22
- JWT authentication middleware (`middleware/auth.js`)
- Role-based access control middleware (`middleware/authorize.js`)
- Workshop isolation via `workshopId` in JWT payload
- Parameterised PostgreSQL queries throughout (no SQL injection surface)
- Audit log on every write operation (userId, role, action, entity, timestamp)
- Rate limiting: login 10/15min, API 300/min, update endpoints 30/hr
- Helmet.js security headers
- Health endpoints: `/api/health`, `/api/ready`, `/api/metrics`
- OTA update server: `/version.json`, `/downloads/UFCL-production.apk`, checksums
- Monitoring dashboard at `/dashboard.html` (METRICS_TOKEN-gated)
- Graceful shutdown on SIGTERM/SIGINT

**Routes delivered:**
`/api/auth`, `/api/harvest`, `/api/log-transport`, `/api/sawmill`,
`/api/poles`, `/api/vat`, `/api/deliveries`, `/api/fuel/vehicle`,
`/api/fuel/machine`, `/api/machine-logs`, `/api/material-requests`,
`/api/casual-labour`, `/api/ceo`, `/api/my-requests`, `/api/meta`

**Phase 2 stubs (HTTP 501 — planned for v1.1):**
`/api/stock-transfers`, `/api/dispatch`

### Added — Infrastructure

- nginx reverse proxy: port 443 HTTPS → Express 127.0.0.1:3001; HTTP → HTTPS redirect
- Self-signed TLS certificate (RSA-2048, 10-year validity, SAN = IP:192.168.1.5)
- UFW firewall: allow 22/80/443; deny 3001/5432
- PM2 process management: fork mode, 512 MB limit, 10 max restarts, startup hook
- PostgreSQL daily backup cron (02:00): 7d daily, 4w weekly, 12m monthly retention
- logrotate: daily app logs (30d), weekly PM2 logs (8w)
- GitHub Actions CI/CD: signed APK build, SHA-256/MD5 checksums, GitHub Release creation, SCP+SSH deployment to company server

### Added — Documentation

- `UFCL_USER_MANUAL.html` — role-based usage guide for all 12 departments
- `UFCL_ADMIN_MANUAL.html` — IT reference: architecture, user management, backups, monitoring, disaster recovery
- `UFCL_UAT_PHASE13.html` — UAT execution guide: all 9 departments, workshop isolation test, sign-off
- `LAUNCH_CHECKLIST.md` — 47-item production go-live checklist
- `DEPLOYMENT_GUIDE.html` — step-by-step deployment: server, APK, rollback, user install, OTA
- `PRODUCTION_ACCEPTANCE_REPORT.html` — final acceptance report with sign-off block
- `PRODUCTION_READINESS_REPORT.html` — technical audit report (score: 92/100)
- `RELEASE_NOTES_v1.0.0.md` — release notes for end-users and IT

### Fixed

| ID | Severity | Description |
|---|---|---|
| BUG-01 | Critical | `/api/auth/me` returned raw DB row instead of typed user object; `restoreSession()` stored full response as user — caused `role = undefined` and wrong navigator on restore |
| BUG-02 | High | Vehicle Fuel tab in Supervisor navigator caused 403 on every load; removed from Supervisor nav, types, and permissions |
| BUG-03 | Medium | `audit_log.role NOT NULL` constraint violated on "user not found" login attempts |
| BUG-04 | Low | `SERVER_MAINTENANCE.md` tar restore command had invalid path (`-C / opt/`) |
| C-01 | Critical | Production APK API URL defaulted to `http://192.168.1.5:3001`; Express bound to loopback in production — all API calls failed |
| C-02 | Critical | OTA update checker used `http://192.168.1.5:3001` — silently returned null on every check; devices never discovered updates |
| C-03 | Critical | `version.json` `apkUrl` on company server pointed to blocked port 3001 — APK download would have failed even if update was detected |
| M-01 | Major | Vehicle Fuel screens built in Sprint 5 but not wired to Logistics navigator — feature was unreachable for the logistics role |
| Min-01 | Minor | LoginScreen displayed version "v1.0" instead of "v1.0.0" |
| P15-01 | Minor | `strings.xml` had `app_name = "UFCL Dev"` — production APK would show "UFCL Dev" on the Android launcher |

### Security

- All external traffic encrypted via nginx/TLS — Express never directly reachable from LAN
- JWT tokens stored in hardware-backed SecureStore
- Dual-layer permission enforcement: route gate + authoritative `data.js` check
- Workshop isolation enforced on all approve endpoints via `supervisorWorkshopGuard()`
- No secret values committed to repository

---

## [Unreleased — pre-release development]

The following sprints and milestones were completed before the v1.0.0 release tag.

### Milestone M-1 — Foundation (commit `51b9b49`)
- Expo SDK 51 bare workflow project bootstrapped
- React Navigation, React Query, Zustand, Axios configured
- SecureStore + AsyncStorage dual-storage layer
- Offline queue skeleton

### Foundation — API skeleton (commit `f56e94a`)
- Mobile API Express skeleton in `mobile-api/`
- JWT auth, pool.js patched for non-Electron context
- Phase 1 route stubs registered

### Foundation — Health + endpoint fixes (commit `80a240b`)
- `/api/health` endpoint
- Endpoint mismatch corrections between client and server

### Production hardening (commit `4b7c529`)
- Rate limiting (login/API/updates)
- Helmet.js security headers
- Offline session restore
- HTTPS documentation

### Sprint 1 — CEO Dashboard (commit `c33272f`)
- CEO overview, approvals stack, profile screen, hooks

### Sprint 2 — Workshop Operations (commit `d5adf2d`)
- Material requests, casual labour, My Requests, navigator updates

### Sprint 3 — Forest Operations (commit `76b26f5`)
- Harvest, log transport, sawmill production workflows

### Sprint 4 — Poles & VAT (commit `398432b`)
- Poles production/purchase/delivery/QC, VAT inbound/processed, backend VAT API

### Sprint 5 — Logistics & Machines (commit `fda2f28`)
- Deliveries, POD, vehicle fuel, machine fuel, machine daily logs

### Hotfix — TypeScript build (commit `1de5713`)
- `tsconfig.json`: added `"module": "CommonJS"` to resolve dynamic import TS1323 error

---

*Older commits in this repository (before `51b9b49`) belong to the UFCL Desktop/Electron application and are not part of this changelog.*
