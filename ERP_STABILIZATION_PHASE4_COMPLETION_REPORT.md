# ERP Stabilization Program — Phase 4: Permission Synchronization & Access Parity
### Completion Report

**Note on numbering:** this phase's own brief called itself "Phase 2," but this session had already completed and shipped a Phase 2 (the `req.user.id` fix) and Phase 3 (async error framework). Per explicit user direction, this work is recorded as **Phase 4** to preserve the existing program history.

**Scope:** synchronize Backend ↓ Desktop UI ↓ Mobile UI ↓ available actions ↓ actual execution permissions, using the backend as sole source of truth. No new roles, no approval-chain changes, no Workshop Isolation changes, no new features — only permission-consistency fixes.

---

## 1. Permission Audit Summary

This phase built on two already-verified sources rather than re-auditing from scratch: `ERP_UI_BACKEND_FUNCTIONAL_GAP_AUDIT.md` §6 (10 permission mismatches, P-1 through P-10; P-9/P-10 already fixed in Phase 1) and Phase 1's own dedicated mobile-api route-vs-`mustRole()`-vs-`db/migrate.js` audit (found 6 under-grants and 5 over-grants across 8 route files, all deferred as out-of-scope at the time). A fresh background audit re-verified the two largest remaining unknowns (P-1: Procurement mobile gating; P-8: desktop Roles editor gaps) against the current codebase before any fix was attempted.

Every finding acted on in this phase was independently re-verified against current code — not assumed from prior audit text — by reading the exact backend function each route/screen calls and cross-referencing `db/migrate.js`'s two role-permission sources (`seedRoles()`'s one-time seed and `updateRolePermissions()`'s additive `permissionsByRole` block) directly, file:line, before any edit.

## 2. Permission Drift Findings

| ID | Layer(s) affected | Finding | Verified via |
|---|---|---|---|
| P-2 | Mobile client | `logistics-officer` holds backend `stock-items`; mobile's `stock.catalog` permission never granted it | `permissions.ts:78`, `migrate.js:795` |
| P-3 | Mobile client + Desktop UI | `logistics-officer` holds backend `stock-transfers`; excluded from mobile's `transfer.view`/`transfer.act` **and** desktop's `canAct` on the Stock Transfers screen | `permissions.ts:78`, `app.js:9065`, `migrate.js:795`, `stockTransfers*` functions (uniform `mustRole('stock-transfers')`) |
| P-4 | Mobile client | `supervisor` can approve Material Requests on desktop (`app.js`'s `canApprove` in `renderWorkshopOverview`); mobile's `workshop.approve` excluded supervisor — the only mobile approval entry point | `permissions.ts:79`, `WorkshopOverviewScreen.tsx:337` |
| P-5 | Mobile client + Mobile nav | `operations` holds backend `dispatch`; mobile had no `dispatch.view`/`dispatch.approve` grant **and no Dispatch tab at all** in `OperationsNavigator.tsx` | `permissions.ts:76`, `OperationsNavigator.tsx`, `DispatchListScreen.tsx:170` (`hasPermission(role,'dispatch.approve')`) |
| P-6 | mobile-api route | `workshops.js`'s `OVERVIEW_ROLES` excluded `supervisor`/`storekeeper-assistant`, though both hold backend `workshop-overview` | `workshops.js:12` (was), `migrate.js:791,798` |
| P-7 | Mobile client + mobile-api route | `fuel.js`'s `/vehicle` routes and mobile's `fuel.vehicle` permission both undersold the real `vehicles`-permission holder set (`admin`,`ceo`,`logistics`,`logistics-officer`) | `fuel.js:51,65` (was `requireRoles('logistics','admin')`), `permissions.ts:70-71,78`, `fuelLogsList/Create` (`mustRole('vehicles')`) |
| P-8 | Desktop UI | Roles & Permissions editor had no checkbox for `machine-maintenance`/`maintenance-jobs`/`maintenance-oversight` — grantable only via one-time migration | `app.js:395-397` (was) |
| — | mobile-api route | `dispatch.js`'s `VIEW_ROLES` excluded `operations` (held `dispatch`, already in `REVIEW_ROLES`) — found in Phase 1, fixed here | `dispatch.js:9` (was) |
| — | mobile-api route | `transport.js`'s `ROLES` excluded `operations` and `sales` (both hold `transport`) — found in Phase 1, fixed here | `transport.js:13` (was) |
| — | mobile-api route | `workshops.js`'s `MANAGE_ROLES` included dead-path `operations` (doesn't hold `warehouses`) and excluded `storekeeper` (does) — found in Phase 1, fixed here | `workshops.js:7` (was) |
| — | mobile-api route | `compartments.js`'s `VIEW_ROLES` excluded `harvesting-leader` (holds `compartments` per `compartmentsList`'s own `mustRole` OR-clause) — found in Phase 1, fixed here | `compartments.js:7` (was) |
| — | mobile-api route | `timberInventory.js`'s `ALLOWED` included dead-path `logistics` and excluded `sawmill-leader`/`vat-leader`/`showroom-staff` — found in Phase 1, fixed here | `timberInventory.js:9` (was) |
| — | mobile-api route | `stock.js`'s `INVENTORY_ROLES` included dead-path `ceo`; `MOVEMENTS_ROLES` included 5 dead-path roles (`supervisor`,`harvesting-leader`,`sawmill-leader`,`poles-leader`,`vat-leader`) — found in Phase 1, fixed here | `stock.js:12-19` (was), cross-confirmed by `migrate.js`'s own `STOCK_MOVEMENTS_ROLES` (line 1781) |
| — | mobile-api route | `sales.js`'s `/:id/deliver` used `SALES_ROLES` (gates on `mustRole('sales')`) but calls `deliveryOrdersCreate` (`mustRole('deliveries')`) — `operations` holds the former, not the latter — found in Phase 1, fixed here | `sales.js:9` (was) |

**P-1 (Procurement mobile has no client-side permission gating on 15 of 22 screens)** was re-verified in full detail this phase but, per explicit user decision, is **documented only** — see §9. It is not a security issue: server-side `mustRole()` enforcement in `db/services/data.js` is confirmed complete and robust for every procurement write action.

## 3. Desktop Fixes

| File | Change |
|---|---|
| `renderer/app.js` (`renderStockTransfers`) | P-3: `canAct` now includes `logistics-officer`. `canApprove` intentionally left unchanged — no finding questioned desktop's existing approve-vs-act split, and changing it would touch an approval chain, explicitly out of scope. |
| `renderer/app.js` (`renderPermissionCheckboxes`) | P-8: added `machine-maintenance`, `maintenance-jobs`, `maintenance-oversight` checkboxes to the Fleet & Machines group. |

Desktop's Dispatch approve (`renderDispatch`'s `canApprove`) was checked and already correctly includes `operations` — no fix needed; confirms P-5 was mobile-only.

## 4. Mobile Fixes

| File | Change |
|---|---|
| `mobile/src/utils/permissions.ts` | P-2/P-3/P-7: `logistics-officer` gains `stock.catalog`, `transfer.view`, `transfer.act`, `fuel.vehicle`. P-4: `supervisor` gains `workshop.approve`. P-5: `operations` gains `dispatch.view`, `dispatch.approve`. P-7: `admin`/`ceo` gain `fuel.vehicle` (both hold backend `vehicles`, previously only `logistics` had this key). |
| `mobile/src/navigation/types.ts` | Added `Dispatch: undefined` to `OperationsTabParamList`. |
| `mobile/src/navigation/OperationsNavigator.tsx` | P-5: added a Dispatch tab (reusing the existing `DispatchStack`, no new screen built) so `operations` can reach the screen its new permission now unlocks. |

Every added permission key was confirmed to be **actually consumed** by a real screen's `hasPermission()` call before being granted (not a dead grant) — e.g. `WorkshopOverviewScreen.tsx:337`, `DispatchListScreen.tsx:170`, `StockCatalogScreen.tsx`, `StockTransfersListScreen.tsx`.

## 5. Backend Verification

No `db/services/data.js` business logic, no schema, and no `db/migrate.js` grant was changed anywhere in this phase — the backend's existing `mustRole()` checks and `role_definitions.permissions` grants were treated as ground truth throughout, per the phase's Core Principle. Every mobile-api route-array fix (§2) was verified against the *specific function* the route calls, not assumed from the route's own filename/comment — this caught cases where a route's comment claim was itself stale (e.g. `fuel.js`'s comment said "logistics, admin ONLY" for vehicle fuel, which was never accurate against `migrate.js`).

Two functions were found to use a **different, narrower gate than their neighbors in the same file** and were deliberately left unfixed to avoid inventing new route-level access with no service-layer backing:
- `compartmentsCreate`/`Update`/`Delete` use a plain hardcoded role array (no `mustRole` fallback), unlike `compartmentsList`'s `mustRole('compartments') || [...]` OR-clause — so `harvesting-leader` was added to `VIEW_ROLES` only, not `CREATE_ROLES`/`MANAGE_ROLES`, since adding it there would create a route entry the service layer would still refuse.

## 6. Role Matrix Before / After (Fixed Items Only)

| Role | Capability | Before | After |
|---|---|---|---|
| logistics-officer | Mobile Stock Catalog | Hidden | Visible |
| logistics-officer | Mobile + Desktop Stock Transfers act | Hidden/blocked | Visible/enabled |
| logistics-officer | Mobile + REST Vehicle Fuel Logs | 403 | 200 |
| supervisor | Mobile Material Request approve (Workshop Overview) | Hidden | Visible |
| operations | Mobile Dispatch (tab, view, approve) | Absent entirely | Full tab + actions |
| operations | REST `/api/dispatch` (list/create/delete) | 403 | 200 |
| operations | REST `/api/transport/*` | 403 | 200 |
| sales | REST `/api/transport/*` | 403 | 200 (not live-tested this phase — no `sales` throwaway account created; verified via code + migrate.js only) |
| supervisor | REST `/api/workshops/overview` | 403 | 200 |
| storekeeper-assistant | REST `/api/workshops/overview` | 403 (not live-tested — role added based on the same verified `workshop-overview` grant as supervisor) |
| storekeeper | REST `/api/workshops` create/update/delete | 403 | 200 |
| harvesting-leader | REST `/api/compartments` (view) | 403 (not live-tested — no throwaway account created; verified via code) | 200 |
| sawmill-leader / vat-leader / showroom-staff | REST `/api/timber-inventory` | 403 (not live-tested — verified via code) | 200 |
| ceo | REST `/api/stock/inventory` | 200 (dead — always refused server-side) | 403 (route now honest) |
| logistics | REST `/api/timber-inventory` | 200 (dead) | 403 (route now honest) |
| supervisor / harvesting-leader / sawmill-leader / poles-leader / vat-leader | REST `/api/stock/movements` | 200 (dead) | 403 (route now honest) |
| operations | REST `/api/workshops` (create/update/delete) | 200 (dead) | 403 (route now honest) |
| operations | REST `/api/sales/:id/deliver` | 200 (dead) | 403 (route now honest) |
| admin / ceo | Mobile Vehicle Fuel Logs | Hidden | Visible |

## 7. Security Verification

**No privilege escalation was introduced.** Every "Before: 200 (dead)" row above is a role that already had zero real access — the service layer's `mustRole()` check refused them regardless of the route gate; only the *route's own honesty* changed, from "let it through, get refused deeper" to "refused immediately." Every "Before: Hidden/403 → After: Visible/200" row is a role that the backend's `mustRole()`/`role_definitions.permissions` already, independently, granted — confirmed via `db/migrate.js` before any change — meaning the fix only let the UI/route catch up to what the service layer already allowed. No mobile permission key or desktop role array was added for a role that doesn't hold the matching backend grant.

## 8. Regression Results

- `node --check` clean on all 9 touched backend/desktop files.
- `cd mobile && npx tsc --noEmit` clean (exit 0) after all mobile permission/navigation changes.
- Live REST verification (8 throwaway accounts — admin, ceo, logistics, logistics-officer, supervisor, mechanician, storekeeper, operations — against the real environment, cleaned up afterward): all 15 targeted checks matched their predicted before/after status exactly (under-grants now 200, confirmed dead over-grants now 403, sanity checks on unaffected roles unchanged).
- Regression spot-check on every Phase 1–3 fix (`/api/sales`, `/api/reports/bi`, `/api/compartments`, `/api/automation/dashboard`, `/api/epm/dashboard`, `/api/reports/weekly-cost`) confirmed all still behave exactly as those phases left them — no new 403/404/500/hang introduced anywhere.

## 9. Remaining Permission Issues

1. **P-1 (largest remaining item)** — mobile's Procurement module (22 screens) has essentially no client-side permission gating: zero `hasPermission()` calls anywhere in it, and the `Permission` type/`ROLE_PERMISSIONS` map has no procurement-specific keys at all (`procurement-officer`/`procurement-manager`/`department-manager` hold only `['admin.changes']`). 15 of 22 screens have zero role/permission check of any kind on their write actions; the other 7 use ad hoc inline role-string comparisons instead of `hasPermission`. **Confirmed not a security issue** — server-side `mustRole()` enforcement in `data.js` (backed by a completely separate, DB-driven `role_definitions.permissions` system) is thorough and correctly gates every write. The user explicitly chose to document this rather than fix it in Phase 4, given its size (effectively its own phase — a new permission taxonomy plus wiring ~15 screens). A minimal fix would: add procurement `Permission` keys to `permissions.ts` mirroring `db/migrate.js`'s `grantProcurementPermissions`/`PROCUREMENT_PAGES`; gate each screen's write buttons with `hasPermission()`; and consider per-role filtering of the shared `ProcurementStack` mounted identically inside `CeoNavigator`/`FinanceNavigator`/`SupervisorNavigator`/`ProcurementNavigator` (currently every role that can reach any of these navigators sees the exact same 22 screens regardless of their actual grant).
2. `compartmentsCreate`/`Update`/`Delete`'s hardcoded role array vs. `compartmentsList`'s `mustRole` OR-clause inconsistency (§5) — a backend-internal inconsistency, not touched this phase per the Core Principle (backend is source of truth, not something this phase modifies).
3. `sales`/`storekeeper-assistant`/`harvesting-leader`/`sawmill-leader`/`vat-leader`/`showroom-staff` role additions in §6 were verified via code + `db/migrate.js` cross-reference but **not live-tested** — no throwaway account was created for these 6 roles this phase (8 accounts were used, covering the roles with the most fixes). Recommended as a quick follow-up spot-check, not a re-open.
4. Carried forward, unaffected by this phase: `_biPredictStockRunout()`'s division-by-zero (Phase 2/3), the pre-existing route-array drift already fixed here, and all remaining non-Critical findings from `ERP_UI_BACKEND_FUNCTIONAL_GAP_AUDIT.md` not related to permissions.

## 10. Next Phase Recommendation

**Recommended next stabilization phase: Procurement Mobile Permission Gating (P-1).** It's the single largest remaining consistency gap in the program, is well-understood (full ground-truth already gathered this phase), and — unlike most items fixed here — requires new code (a permission taxonomy + ~15 screen edits) rather than array corrections, so it deserves to be scoped and confirmed with the user as its own phase rather than folded into a "drift cleanup" phase like this one.

---

## Success Criteria

- [x] Backend, Desktop, and Mobile permissions match for every finding acted on (P-2 through P-8 plus 6 mobile-api route-array items from Phase 1's audit).
- [x] No role has hidden capabilities relative to what the backend already grants it (every fix was additive-to-match, never additive-beyond).
- [x] No UI exposes an unauthorized action — over-grants removed were all confirmed dead paths, not real capability.
- [x] No duplicate permission logic remains where avoidable (route-level arrays now match their service-layer `mustRole()` gate; stale role lists trimmed).
- [x] Existing workflows remain unchanged — no approval chain, business rule, or Workshop Isolation logic was touched.
