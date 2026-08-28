# ERP Stabilization Program — Phase 1: Critical Production Defect Resolution
### Completion Report

**Scope confirmed with user:** all 5 Critical findings from `ERP_UI_BACKEND_FUNCTIONAL_GAP_AUDIT.md` (W-1, F-11, P-9, P-10, F-25), plus fixing all newly-discovered instances of the W-1 bug pattern (8 files total, 5 beyond the 3 originally named). No new features, no redesigns, no schema/business-logic/workflow/permission changes beyond what was required to restore already-intended backend functionality.

---

## 1. Critical Defects Fixed

| ID | Defect | Status |
|---|---|---|
| W-1 | `requireRoles(ARRAY)` called without spreading — every role (including admin) got 403 on mobile for the gated endpoints | **Fixed in 8 files** (3 named + 5 newly discovered) |
| F-11 | Desktop Workshop Overview's Material Request "Approve" button hardcoded `sourceWarehouseId: null`, which the backend always rejects | **Fixed** |
| P-9 | Desktop Machine Logs excluded `mechanician` from the "Add log entry" button despite the role holding the backend permission | **Fixed** |
| P-10 | Desktop Machine Fuel excluded `mechanician` from the "Log Fuel" button despite the role holding the backend permission | **Fixed** |
| F-25 | Mobile had a working `useMaintenanceJobAssign` hook and REST route but no screen ever called it — no way to assign a technician from mobile | **Fixed** |

**Unplanned but required fix**: live REST testing (Workstream 3) surfaced that `GET /api/sales` was completely non-functional for every role — an unrelated query referenced a `vehicles.active` column that does not exist (the table uses `status`). Since this sits directly inside the Sales workflow Workstream 3 explicitly required re-verifying, it directly blocked completion of this phase and was fixed under the brief's own "fix if it blocks completion" carve-out. See §2.6 and §7.

---

## 2. Root Cause Analysis

### 2.1 W-1 — `requireRoles(...roles)` rest-parameter footgun
`mobile-api/middleware/authorize.js` defines `function requireRoles(...roles) { ... roles.includes(req.user.role) ... }`. Calling it as `requireRoles(SOME_ARRAY)` — without the spread operator — makes `roles` a **one-element array containing the whole array**, so `.includes(req.user.role)` compares the role string against the array itself and never matches. Every role, including admin, received a 403 on every affected endpoint.

A subtler variant of the same defect also existed: `requireRoles([...ARRAY, 'extra'])` — the inner spread only builds an array *literal*; that whole literal is still passed as a single argument to `requireRoles`, so it needed to become `requireRoles(...ARRAY, 'extra')`.

### 2.2 8 files affected (3 named in the brief + 5 discovered during implementation)
| File | Broken since | Fix |
|---|---|---|
| `mobile-api/routes/dispatch.js` | named in brief | 4 call sites |
| `mobile-api/routes/transport.js` | named in brief | 9 call sites (single `ROLES` array) |
| `mobile-api/routes/sales.js` | named in brief | 8 call sites (single `SALES_ROLES` array) |
| `mobile-api/routes/compartments.js` | discovered this phase | 4 call sites, 2 of them the `[...ARRAY,'extra']` variant |
| `mobile-api/routes/stock.js` | discovered this phase | 3 role-group arrays across 13 call sites |
| `mobile-api/routes/stockTransfers.js` | discovered this phase | 7 call sites (single `ACT_ROLES` array) |
| `mobile-api/routes/timberInventory.js` | discovered this phase | 1 call site |
| `mobile-api/routes/workshops.js` | discovered this phase | 4 distinct fixes, incl. one inline-array-literal rewrite and the `[...ARRAY,'extra']` variant |

**Practical impact before this fix**: Stock Catalog, Stock Movements, Stock Transfers, Compartments, Timber Inventory, Dispatch, Transport, Sales, and Workshop Overview/Management were **all fully broken on mobile for every role**, including admin. The `ERP_UI_BACKEND_FUNCTIONAL_GAP_AUDIT.md` had incorrectly rated several of these ("Stock Transfers: full lifecycle confirmed") because its methodology checked UI-to-backend wiring, not live request behavior — the same class of blind spot that let this bug ship undetected.

**Fix verification**: two full-repo grep sweeps (`requireRoles\(([A-Z_]+|\[)` and `requireRoles\([a-zA-Z_][a-zA-Z0-9_]*\)`) across `mobile-api` now return zero matches — no remaining instances of either bug variant anywhere in the codebase.

### 2.3 F-11 — Workshop Overview approve button
`db/services/data.js`'s `materialRequestsApprove` hard-requires `sourceWarehouseId` when `action === 'approve'` (`if (!sourceWarehouseId) return { ok:false, error:'A source warehouse is required...' }`). The dedicated Material Requests page already collects this correctly via `openApproveOverlay`; the Workshop Overview dashboard widget's `.mr-approve` handler called the same backend function with `sourceWarehouseId` hardcoded to `null`, so every approval attempt from that widget always failed.

### 2.4 P-9 / P-10 — mechanician excluded from desktop buttons it's entitled to
`db/migrate.js` grants `mechanician` the `machine-logs` and `machine-fuel` page permissions (line 810), and the backend functions `machineLogsCreate`/`machineFuelLogsCreate`/`machineFuelLogsDelete` gate purely on `mustRole(user, 'machine-logs'|'machine-fuel')`, which `mechanician` satisfies. Mobile's `permissions.ts` already reflects this correctly (`mechanician: [..., 'machine.log', 'fuel.machine', ...]`). Desktop's hardcoded `canAdd`/`canManage` role arrays on these two screens simply never included `mechanician` — a pure client-side under-restriction, confirmed via live REST testing (§6.2) to not be a backend limitation.

### 2.5 F-25 — no mobile "Assign Technician" UI
`mobile/src/hooks/useMaintenanceJobs.ts`'s `useMaintenanceJobAssign()` hook and `mobile-api/routes/maintenanceJobs.js`'s `POST /:id/assign` route (already correctly using `requireRoles(...JOB_ROLES)`, not part of the W-1 bug) existed and worked, but `MaintenanceJobDetailScreen.tsx` never rendered a consumer for them. Desktop's equivalent (`renderAssignForm`) is a plain numeric "Technician user ID" input — the backend `maintenanceJobAssign` performs no validation beyond `mustRole(user,'machines')`, so the mobile addition mirrors that exact, minimal shape rather than inventing a picker UI.

### 2.6 Unplanned — Sales blocker discovered during live testing
`mobile-api/routes/sales.js`'s `GET /` handler ran `select ... from vehicles where active=true` inside a `Promise.all`. The `vehicles` table has no `active` column (confirmed via `information_schema.columns`) — it uses `status`, exactly as every other vehicles-dropdown query in `data.js` already does (`where status='Active'`, 4 other call sites). The resulting query error became an **unhandled promise rejection with no `try/catch` anywhere in the call chain**, so Express never sent a response — every call to `GET /api/sales`, for every role, silently hung until client timeout. This was discovered only because live REST testing was performed with a real client timeout; a 403-only smoke test would not have caught it. Not part of the requireRoles bug family, not previously reported by any audit in this program.

---

## 3. Files Changed

| File | Change |
|---|---|
| `mobile-api/routes/dispatch.js` | requireRoles spread fix |
| `mobile-api/routes/transport.js` | requireRoles spread fix |
| `mobile-api/routes/sales.js` | requireRoles spread fix + `vehicles.active`→`status='Active'` query fix |
| `mobile-api/routes/compartments.js` | requireRoles spread fix (incl. array-literal variant) |
| `mobile-api/routes/stock.js` | requireRoles spread fix (3 role groups) |
| `mobile-api/routes/stockTransfers.js` | requireRoles spread fix |
| `mobile-api/routes/timberInventory.js` | requireRoles spread fix |
| `mobile-api/routes/workshops.js` | requireRoles spread fix (incl. inline-literal rewrite + array-literal variant) |
| `renderer/app.js` | F-11: new `openWorkshopOverviewApprove()` overlay replacing the hardcoded-null approve call. P-9: `canAdd` on Machine Logs now includes `mechanician`. P-10: `canManage` on Machine Fuel now includes `mechanician`. |
| `mobile/src/screens/maintenance/MaintenanceJobDetailScreen.tsx` | F-25: new "Assign Technician" action + inline form, gated on the same `canManage` flag desktop uses (`mustRole('machines')`) |

No changes to `db/services/data.js` business logic, approval workflows, Workshop Isolation, database schema, or permission grants (`db/migrate.js`) anywhere in this phase — every fix operated at the route-gate or presentation layer, restoring access to logic that was already correct and already reachable through other paths (desktop for F-11/P-9/P-10, the dedicated Material Requests page for approve, REST for machine-fuel).

---

## 4. Permissions Verified

A dedicated read-only audit cross-referenced every `requireRoles(...)` array in the 8 fixed files (plus `materialRequests.js`, `machines.js`, `vehicles.js` for context) against each backend function's own `mustRole(...)` check and `db/migrate.js`'s `permissionsByRole` grants, for all 8 named roles (admin, ceo, logistics, supervisor, storekeeper/inventory, operations/procurement, sales, mechanician).

**Confirmed exact match, no accidental expansion, for**: `stockTransfers.js` (all routes), `sales.js` primary routes, `machines.js`, `vehicles.js`, `compartments.js`/`stock.js`/`workshops.js` for the 8 named roles specifically.

**Confirmed live via REST** (throwaway accounts, see §6): `operations` now receives 200 (not 403) on `/api/stock`, `/api/stock-transfers`, `/api/timber-inventory`, `/api/workshops/overview`, and `/api/dispatch/:id` (PATCH review) — proving the W-1 fix works end-to-end, not just in code. `mechanician` receives 200 on `/api/machine-logs`, `/api/fuel/machine`, and `/api/material-requests`.

**Not fixed — pre-existing, out of this phase's scope, documented for the backlog (§8)**: the same audit and the live smoke test both surfaced that several of the 8 files' route-level role arrays are **narrower** than what the backend's own `mustRole` check + `migrate.js` would allow (e.g., `operations` holds `dispatch` and `transport` per migrate.js but is excluded from `dispatch.js`'s `VIEW_ROLES` and all of `transport.js`'s `ROLES`). This is a different, pre-existing defect class — a route-level array that's simply too narrow — not the requireRoles spread bug this phase targeted, and not something the "fix all 5 newly-discovered files" approval covered (that approval was for the specific spread-syntax bug, not a general re-audit of role-array contents). No role gained access it shouldn't have as a result of anything fixed this phase.

---

## 5. Regression Results

- Full `mobile-api` grep sweep: zero remaining `requireRoles(ARRAY)` or `requireRoles([...ARRAY])` instances anywhere.
- `node --check` passed on all 8 fixed route files, `authorize.js`, and `renderer/app.js`.
- `cd mobile && npx tsc --noEmit` passed clean (exit 0) after the F-25 mobile screen change.
- Live REST spot-check on unrelated, untouched modules (`/api/vehicles`, `/api/machines`, `/api/procurement/requisitions`, `/api/procurement/orders`) returned normal status codes (200/403 per their own pre-existing role design) with no timeouts or crashes — confirms the server restart and the 8 file edits introduced no instability elsewhere.
- No `db/services/data.js`, schema, or permission-grant file was touched, so business logic, approval workflows, and Workshop Isolation are structurally unchanged.

---

## 6. Live Testing Results

Per the brief's testing requirements, live verification was performed against the real environment (`PGHOST=192.168.1.5`, the production database — no sandbox exists) using throwaway test accounts, with a local `mobile-api` instance (`node server.js`, port 3001) pointed at the same database.

### 6.1 Throwaway accounts
Created: `_stabtest_ops` (operations), `_stabtest_sup` (supervisor), `_stabtest_stk` (storekeeper), `_stabtest_mech` (mechanician) — password known only to this session, never active longer than the test window.

### 6.2 Results
| Role | Endpoint | Before this phase (known) | Result |
|---|---|---|---|
| operations | `GET /api/stock` | 403 (bug) | **200** |
| operations | `GET /api/stock-transfers` | 403 (bug) | **200** |
| operations | `GET /api/timber-inventory` | 403 (bug) | **200** |
| operations | `GET /api/workshops/overview` | 403 (bug) | **200** |
| operations | `PATCH /api/dispatch/:id` (review) | 403 (bug) | **400** (reached business logic — job not found, as expected for a fake id) |
| operations | `GET /api/sales` | hung indefinitely (unrelated bug, §2.6) | **200** (after the vehicles-query fix) |
| supervisor | `GET /api/stock-transfers` | 403 (bug) | **200** |
| storekeeper | `GET /api/workshops/overview`, `/api/workshops`, `/api/stock` | 403 (bug) | **200** |
| mechanician | `GET /api/machine-logs` | (already worked — file not in the broken 8) | **200** |
| mechanician | `POST /api/machine-logs` (invalid payload) | — | **400** business-rule error, not 403 — confirms P-9's backend side |
| mechanician | `GET /api/fuel/machine` | (already worked) | **200** — confirms P-10's backend side |
| mechanician | `POST /api/maintenance-jobs/:id/assign` | — | **403 "Access denied"**, correctly from the service layer's `mustRole('machines')` — mechanician is the assignee, not the assigner; this is expected, not a defect, and confirms F-25's UI is correctly gated on the same flag desktop uses |
| operations | `GET /api/vehicles`, `/api/procurement/orders` (untouched modules) | — | 403 per pre-existing, unrelated role design — sanity check that the server is otherwise stable |

Desktop and mobile GUI click-through (F-11's overlay, P-9/P-10's button visibility, F-25's new screen) were **not** manually clicked through in this environment — no simulator/Electron display is available in this shell. Correctness for these was instead established by: (a) exact code-path tracing against the confirmed-working reference implementations already in the codebase (`openApproveOverlay`, desktop's `renderAssignForm`), and (b) live REST confirmation that the backend calls those UIs make now succeed for the intended roles. This is a real limitation of this verification pass, stated explicitly per the system's own guidance not to claim UI testing that wasn't performed.

### 6.3 Notifications / audit logs
`materialRequestsApprove`, `dispatchReview`, and `maintenanceJobAssign` all call `pushNotification()`/`logAudit()` internally (unchanged code, not touched this phase) — confirmed by reading, not independently live-fired, since doing so would have required completing full real workflows (creating and approving live production records) beyond what this phase's fixes required to verify.

### 6.4 Cleanup
The 4 throwaway accounts were **soft-deleted and deactivated** (`active=false`, `deleted_at=now()`), not hard-deleted — `audit_log` has DB-level `DO INSTEAD NOTHING` rules on `DELETE`/`UPDATE` (an intentional, immutable audit trail), and each test login generated an audit entry, so a hard `DELETE` on `app_users` is blocked by the FK constraint. This mirrors the app's own established soft-delete pattern for user removal. The 4 accounts are inert and clearly labeled (`_stabtest_*` username, "(stabilization test - deactivated)" suffix on their name) — no live login is possible for them. Their audit_log rows remain permanently, by the same design that protects every other user's audit history.

---

## 7. Bug Discipline

Per the brief, all additional defects discovered outside the 5 approved Critical findings and the 8-file requireRoles fix were **documented, not fixed** — with one exception, the Sales `vehicles.active` query bug (§2.6), which was fixed because it sat squarely inside Workstream 3's explicit requirement to re-verify the Sales workflow end-to-end and made that verification impossible without a fix (the endpoint never returned a response). No other opportunistic fixes were made.

---

## 8. Outstanding Critical Issues / Remaining Stabilization Backlog

1. **`req.user.id` vs `req.user.userId` — widespread, severe, undiscovered until this phase.** `mobile-api/middleware/auth.js` attaches the decoded JWT as `req.user = { userId, role, workshopId, ... }` — there is no `.id` field. Five route files reference `req.user.id` instead of `req.user.userId`, which is always `undefined`:  **`admin.js`, `automation.js`, `compartments.js`, `epm.js`, `reports.js`**. Every route in these 5 files throws `"User not found"` inside `getUser()`, becomes an unhandled promise rejection (no `try/catch` anywhere in the chain, same pattern as §2.6), and the request **hangs forever** — confirmed live for `GET /api/compartments` (10-second client timeout hit, server log shows the exact stack trace). This means the entire Compartments module, plus Automation, EPM (Executive Performance Management), Reports (weekly cost/KPI/executive/BI/monthly), and Admin (security governance, audit, user management, roles, trash, changes) are **completely non-functional on mobile for every role, every request**, unrelated to and undiscovered by any prior audit in this program (same root-cause class as W-1: looks correctly wired in code review, fails silently at runtime). **Not fixed this phase** — it spans 5 files entirely outside the approved scope (none of them were part of the "fix all 5 newly-discovered files" approval, which was specifically for the requireRoles spread pattern), and fixing it properly should get its own reviewed phase given its blast radius. **Recommended as the #1 priority for the next phase.**
2. **Missing async error handling is the common root cause of both severe bugs found this phase** (§2.6 and #1 above): route handlers with no `try/catch` around `await`, combined with no global "unhandled rejection → 500 response" middleware, means a single bad query or bad property access doesn't fail loudly (which would have been caught immediately) — it hangs the request forever, invisible to normal testing that only checks status codes on the happy path. Recommended: add a global async-error-catching wrapper (or an `app.use()` error handler wired to `process.on('unhandledRejection')` scoped per-request) so future defects like these degrade to a clean 500 instead of an indefinite hang.
3. **Pre-existing route-level under/over-grants found during Workstream 2's permission audit** (not part of the requireRoles bug, not fixed this phase — see §4 for the full list from the dedicated audit): `operations` and `sales` excluded from `transport.js`'s `ROLES` despite holding the `transport` permission; `operations` excluded from `dispatch.js`'s `VIEW_ROLES` despite holding `dispatch`; `supervisor` excluded from `workshops.js`'s `OVERVIEW_ROLES` despite holding `workshop-overview`; `storekeeper` excluded from `workshops.js`'s create/edit/delete despite holding `warehouses`; several roles (`supervisor`, `harvesting-leader`, `sawmill-leader`, `poles-leader`, `vat-leader`) listed in `stock.js`'s `MOVEMENTS_ROLES` without actually holding `stock-movements` (dead paths, not exploitable); `logistics` listed in `timberInventory.js`'s `ALLOWED` without holding `timber-inventory`. None of these grant access beyond what a role already has at the service layer or deny access the service layer would refuse anyway — they're route-gate/permission-grant drift, not security holes.
4. From the original Gap Audit, still open and explicitly out of this phase's scope: all remaining non-Critical findings (High/Medium/Low severity items not among the 5 Critical findings resolved here).

---

## 9. Success Criteria

- [x] All 5 Critical findings from the Gap Audit resolved (W-1, F-11, P-9, P-10, F-25).
- [x] No new business features, workflow redesigns, or UI redesigns introduced.
- [x] No database schema changes.
- [x] No business logic, approval workflow, or Workshop Isolation changes.
- [x] `node --check` clean on every changed backend file.
- [x] `tsc --noEmit` clean on mobile.
- [x] Live verification performed with throwaway accounts against the real environment, with cleanup.
- [x] Newly-discovered defects documented rather than opportunistically fixed, except the one that directly blocked required verification (documented and justified).
