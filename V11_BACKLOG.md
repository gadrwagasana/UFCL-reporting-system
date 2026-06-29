# UFCL Mobile — v1.1.0 Backlog

This backlog collects everything to be considered for v1.1.0. Items are classified into three buckets:

- **Carry-over** — items from v1.0 that were deferred (non-blocking)
- **Pilot feedback** — issues and suggestions collected during the 2-week pilot
- **Planned features** — new capabilities planned for v1.1

**Rule:** Do not mix v1.0.x bug fixes with v1.1 features. Bugs that emerge from the pilot go into `v1.0.1`. New features and improvements go here.

---

## A. Carry-over from v1.0 Audit (V11-01 through V11-08)

| ID | Item | Priority | Notes |
|---|---|---|---|
| V11-01 | Remove `android:usesCleartextTraffic="true"` from AndroidManifest.xml | HIGH | All URLs are HTTPS; flag is vestigial. Requires new APK. |
| V11-02 | Add Profile tab for Mechanic role | MEDIUM | UX gap — mechanicians cannot view or edit their profile |
| V11-03 | Gate CI release trigger on version tags only | LOW | Currently triggers on every `master` push with mobile/** changes |
| V11-04 | Add `.env.template` to repository | LOW | IT convenience — documents all required env vars |
| V11-05 | Add `/api/meta/vehicles` dedicated endpoint | LOW | VehicleFuelScreen reuses delivery list for vehicle data |
| V11-06 | Pin `CasualLabourRequest.labour_items` TypeScript type | LOW | Currently `string\|string[]` union; verify backend always returns array |
| V11-07 | Unit tests for auth flows and data.js permissions | MEDIUM | Regression safety for future releases |
| V11-08 | logistics-officer sees Vehicle Fuel tab but receives 403 | LOW | UX gap — consider split navigator or tab visibility by role |

---

## B. Pilot Feedback (fill in during 2-week pilot)

| Date | Source role | Type | Description | Priority |
|---|---|---|---|---|
| | | Bug / UX / Feature | | |
| | | | | |
| | | | | |
| | | | | |
| | | | | |
| | | | | |
| | | | | |
| | | | | |
| | | | | |
| | | | | |

---

## C. Planned Features for v1.1

### Infrastructure improvements

- [ ] **Let's Encrypt TLS** — if a domain name is obtained, replace self-signed cert with auto-renewing certificate
- [ ] **Push notifications** — notify approvers when a new request arrives; notify requesters when status changes (requires FCM/APNs setup)
- [ ] **MDM or private app store distribution** — eliminate manual sideloading; consider Google Play private track or a company MDM

### New modules (Phase 2)

- [ ] **Stock Transfers module** — currently returns HTTP 501; implement full transfer workflow (request → approve → dispatch → receive)
- [ ] **Dispatch module** — currently returns HTTP 501; implement vehicle dispatch scheduling and tracking
- [ ] **Finance module** — cost reporting, budget vs actual, invoice tracking
- [ ] **Sales module** — customer orders, delivery tracking, revenue reporting
- [ ] **Storekeeper module** — stock in/out, inventory levels, reorder alerts

### Enhancements to existing modules

- [ ] **Better dashboards** — charts and graphs on CEO overview; per-department KPI screens
- [ ] **Reports and analytics** — weekly/monthly summary reports, PDF export
- [ ] **Certificate management** — in-app TLS certificate installation guide or automated cert trust
- [ ] **Approval history** — full audit trail viewable by requesters (not just "approved/rejected")
- [ ] **Bulk operations** — approve multiple requests in one action (CEO screen)

### Developer experience

- [ ] API versioning (`/api/v1/`) to allow breaking changes without breaking old clients
- [ ] Structured error codes alongside human-readable messages
- [ ] `console.error` → structured logger in all catch blocks
- [ ] Instrument React Query errors to server metrics

---

## D. v1.1 Planning Rules

1. **Branch from `develop`**, not from `master`
2. **One feature branch per item** (`feature/push-notifications`, `feature/stock-transfers`)
3. **No feature merges to `develop` unless tested end-to-end**
4. **When all v1.1 features are merged**, branch `release/v1.1.0` from `develop`
5. **Bug fixes on `release/v1.1.0` only** — no new features on release branch
6. **UAT on `release/v1.1.0`** before merging to `master`
7. **After release**: merge `master` back to `develop` to keep branches in sync
8. **Version bump**: update `mobile/package.json` version to `1.1.0` on release branch

---

## E. Version Decision Guide

| Change type | Branch | Resulting version |
|---|---|---|
| Crash fix, security patch | `hotfix/*` → `master` | v1.0.1, v1.0.2, ... |
| Bug from pilot (no new screens) | `hotfix/*` → `master` | v1.0.1 |
| New screen, new API route | `feature/*` → `develop` → `release/v1.1.0` → `master` | v1.1.0 |
| Breaking API change, schema drop | Major release branch | v2.0.0 |

---

*Last updated: 2026-06-29. Update this file after each pilot feedback session and after each planning meeting.*
