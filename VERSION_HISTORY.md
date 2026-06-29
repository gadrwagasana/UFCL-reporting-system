# UFCL Mobile — Version History & Semantic Versioning Policy

## Current Release

| Version | Date | Status |
|---|---|---|
| **1.0.0** | 2026-06-29 | **CURRENT — Production** |

---

## Versioning Policy

UFCL Mobile follows [Semantic Versioning 2.0.0](https://semver.org/): `MAJOR.MINOR.PATCH`

### PATCH version — `v1.0.x`

Increment PATCH for **bug fixes and security patches only**.

Triggers:
- Crash fixes
- Data display errors
- API response handling bugs
- Security vulnerability patches
- Performance fixes with no behaviour change
- Documentation corrections

Examples: `v1.0.1`, `v1.0.2`

Rules:
- No new screens, no new API routes, no schema changes
- No change to navigation structure, permissions, or workflows
- Safe to deploy as a mandatory update immediately
- All devices should be on the latest PATCH version

### MINOR version — `v1.1.x`

Increment MINOR for **new features and non-breaking improvements**.

Triggers:
- New modules or screens
- New API routes
- New role navigators
- New optional configuration
- UI/UX improvements
- New documentation

Planned for v1.1.0:
- Remove `android:usesCleartextTraffic` (all URLs are HTTPS)
- Profile tab for Mechanic role
- `/api/meta/vehicles` dedicated endpoint
- CI release trigger: version tags only (not every commit)
- `.env.template` committed to repo
- Push notifications for approval status changes
- Stock Transfers module (Phase 2)
- Dispatch module (Phase 2)

Rules:
- Backward compatible with existing data
- Database schema changes must be additive (no column drops)
- Can be deployed as a non-mandatory update
- Should be tested with full UAT before deployment

### MAJOR version — `v2.0.0`

Increment MAJOR for **breaking changes**.

Triggers:
- Authentication mechanism change (e.g. switching from JWT to OAuth)
- Database schema breaking changes (column renames, type changes, table drops)
- API contract changes that break existing clients
- Navigation restructuring that invalidates deep links or offline queue items
- Minimum Android version bump that drops older devices

Rules:
- Requires a coordinated deployment (server + all clients simultaneously or with compatibility layer)
- Requires re-UAT of all affected modules
- Mandatory update — no "Later" option in update modal

---

## Deployment Policy by Version Type

| Version type | CI trigger | Update type | Rollout |
|---|---|---|---|
| PATCH | Push to `master` with mobile/** changes | Non-mandatory (may set mandatory=true for security patches) | Immediate |
| MINOR | Manual workflow dispatch with version override | Non-mandatory | After UAT sign-off |
| MAJOR | Manual workflow dispatch with version override | **Mandatory** | Coordinated with IT and operations |

---

## Version History

### v1.0.0 — 2026-06-29 — Initial Production Release

- **12 departments** onboarded with dedicated role navigators
- **15 production modules**: CEO approvals, material requests, casual labour, harvest, log transport, sawmill, poles, VAT, deliveries, POD, vehicle fuel, machine fuel, machine daily logs, my requests, profile
- **Offline-first** architecture with Zustand queue, UUID deduplication, serial sync, 3-retry policy
- **JWT authentication** with 8-hour expiry, hardware-backed SecureStore, silent session restore
- **Workshop isolation** enforced at API level via JWT `workshopId` claim
- **OTA auto-update** with resumable download and MD5 integrity check
- **Production infrastructure**: nginx TLS, PM2, UFW, daily PostgreSQL backups, monitoring dashboard
- **10 bug fixes** applied during pre-release audit (BUG-01 through BUG-04, C-01 through C-03, M-01, Min-01, P15-01)
- **Production readiness score**: 92/100

---

## Commit Reference — Mobile Project

| Commit | Date (approx) | Description |
|---|---|---|
| `51b9b49` | 2025 | Milestone M-1: Expo bare workflow foundation |
| `f56e94a` | 2025 | Mobile API Express skeleton |
| `80a240b` | 2025 | /api/health + endpoint fixes |
| `4b7c529` | 2025 | Production hardening: rate limiting, security headers |
| `c33272f` | 2025 | Sprint 1: CEO dashboard, approvals, profile |
| `d5adf2d` | 2025 | Sprint 2: Material requests, casual labour, My Requests |
| `76b26f5` | 2025 | Sprint 3: Harvest, log transport, sawmill |
| `398432b` | 2025 | Sprint 4: Poles, VAT workflows + backend VAT API |
| `fda2f28` | 2025 | Sprint 5: Deliveries, POD, fuel, machine logs |
| `1de5713` | 2025 | Hotfix: tsconfig module CommonJS (TS1323) |
| *(uncommitted)* | 2026-06-29 | Phase 12–15: infra, docs, audit fixes, v1.0.0 release |

> **Note:** Commits prior to `51b9b49` belong to the UFCL Desktop (Electron) application and are part of a separate release line (v1.3.x).

---

## Release Artefacts Location

| Artefact | Location |
|---|---|
| Source archive | `archive/v1.0.0/source/` (via `tools/release.sh`) |
| Database snapshot | `archive/v1.0.0/db/` (via `tools/release.sh`) |
| Signed APK | GitHub Release `v1.0.0` + company server `/opt/ufcl-api/updates/` |
| Release notes | `RELEASE_NOTES_v1.0.0.md` |
| Changelog | `CHANGELOG.md` (this project root) |

---

*This document is updated with each release. The authoritative version lives at the project root as `VERSION_HISTORY.md`.*
