# ERP Enterprise Completion Phase 2 — Permission, Authorization & Workflow Remediation

**Completion Report — 2026-08-08**

## 1. Executive Summary

This phase implemented and live-verified the seven High-priority findings carried forward from `ERP_ENTERPRISE_PERMISSION_NOTIFICATION_AUDIT.md` (PERM-1, PERM-3, PERM-7/8, PERM-17, PERM-18, WI-3a/3b). All seven were re-verified against current source before any change was made (per the phase's Source-of-Truth rule); all seven were confirmed still present, and all seven are now fixed and live-verified against the production database with real and throwaway-QA accounts.

Every fix reused an already-established pattern found elsewhere in the same file (the `mustRole`/page-permission model, the `isWorkshopRestricted` idiom used ~40/~12 times respectively, or an already-correct sibling UI gate) — no new permission system, no new isolation mechanism, and no Workshop Isolation redesign was introduced, per the phase's Critical Architectural Rule. Two files were touched: `db/migrate.js` (2 new permission-grant entries) and `db/services/data.js` (7 function-level authorization/isolation fixes). Both are syntactically clean (`node --check` passing) and the mobile TypeScript baseline (`tsc --noEmit`) remains clean and untouched.

18/18 live production-database tests passed. All QA data was cleaned up and independently re-verified as removed, with one documented exception (below) that follows this codebase's own established convention.

## 2. Findings Re-Verification

Every finding was re-opened in current source before touching anything, per the phase's explicit instruction not to blindly trust the audit report.

| Finding | Audit's claim | Re-verification result |
|---|---|---|
| PERM-1 | `poles-supervisor`/`vat-supervisor` seeded with zero live permissions | **Confirmed still present.** Live query of `role_definitions.permissions` before this phase's migration ran showed both roles held only incidental `procurement-*` pages granted by an unrelated blanket grant — no dashboard/production/inventory access at all. |
| PERM-3 | `stock-movements` permission incidentally over-grants Material Request approval | **Confirmed, and broader than reported.** The audit named `storekeeper-assistant`/`logistics-officer`; re-reading `mustRole(user,'stock-movements')` and the live role grants showed plain `storekeeper` also holds `stock-movements` and was therefore also over-granted. Scope was widened to match current source, per the phase's re-verification rule. |
| PERM-7/8 | `maintenanceJobCreate`/`maintenanceJobAssign` gated on `'machines'` only | **Confirmed still present.** Both functions still checked only `mustRole(user,'machines')`, while the mobile-api route layer and `maintenanceJobsList`/`Detail` already correctly used `'maintenance-jobs'` — a dead-end 403 for mechanician/supervisor/sawmill-leader/poles-leader. |
| PERM-17 | `procurementConfigGet` had no permission gate at all | **Confirmed still present.** Function read the config for any authenticated user of any role. |
| PERM-18 | `resolutionsList` had no permission gate at all | **Confirmed still present.** The existing `if (!user)` check was dead code (unreachable — `getUser()` already throws on invalid users). |
| WI-3a | `polesPurchaseList` honored a client-supplied `workshopId` over the caller's own restriction | **Confirmed still present and live-reproduced** (see §9) before the fix. |
| WI-3b | `polesPurchaseCreate`/`polesDeliveryCreate` used `user.workshop_id || (p.workshop_id...)` instead of the standard restricted-ternary idiom | **Confirmed still present** in both functions. |

No finding had already been silently fixed or become stale — all seven required the implementation work described below.

## 3. Workstream Results

| WS | Finding(s) | Status |
|---|---|---|
| WS1/WS2 | PERM-1 | Fixed — 2 new `permissionsByRole` entries added, migration run, live-confirmed |
| WS3 | PERM-3 | Fixed — narrowed `materialRequestsApprove`'s gate to match desktop's own existing intent |
| WS4 | PERM-17 | Fixed — gated `procurementConfigGet` on `'procurement-settings'` |
| WS5 | PERM-18 | Fixed — gated `resolutionsList` on the same permission set its write-side sibling already requires |
| WS6 | PERM-7/8 | Fixed — `maintenanceJobCreate`/`Assign` now accept `'maintenance-jobs'` OR `'machines'` |
| WS7 | WI-3a/3b | Fixed — `polesPurchaseList`/`Create`/`polesDeliveryCreate` now use the standard `isWorkshopRestricted` idiom |
| WS8 | — | Verified — no UI-layer change required for any of WS1–WS7 (see §6) |
| WS9 | — | Verified — notification coverage on all touched workflows is unchanged and correct (see §8) |
| WS10 | — | Live-verified, 18/18 pass; regression pass across 6 adjacent workflows, 6/6 pass (see §9–10) |

## 4. Permission Changes

- **`db/migrate.js`** — added `'poles-supervisor'` and `'vat-supervisor'` to `permissionsByRole`, mirroring the existing narrower "supervisor tier" shape already used by `harvesting-supervisor`/`sawmill-supervisor` (dashboard/bi/relevant-production-entry/relevant-inventory-view/notifications/audit/export — deliberately excluding material-requests/casual-requests/machine-* pages, matching every other supervisor-tier role in the same object). Migration was run (`npm run migrate`) — the grant function is idempotent/additive, so this only adds pages, it does not remove or alter any existing role's permissions.
- **`db/services/data.js`** — `procurementConfigGet` now requires `'procurement-settings'` (previously ungated). `resolutionsList` now requires the same permission set `resolutionCreate` already requires (previously ungated). `maintenanceJobCreate`/`maintenanceJobAssign` now accept `'maintenance-jobs'` OR `'machines'` (previously `'machines'` only).

## 5. Authorization Changes

- **`materialRequestsApprove`** — replaced the `hasFullAccess = mustRole(user,'stock-movements')` check with an explicit `APPROVAL_TIER = ['admin','ceo','operations','logistics']` list, matching desktop's existing `canApprove` gate (`renderer/app.js:9498`) exactly. `supervisor` retains approval rights via the existing `material-requests`-permission branch, unchanged. Both the approve and reject branches share this one top-level gate, so both are fixed together.
- **`polesPurchaseList`** — read-side workshop filter changed from "prefer client-supplied `workshopId`" to the standard `isWorkshopRestricted(user) ? user.workshop_id : (workshopId ? Number(workshopId) : null)`.
- **`polesPurchaseCreate`** / **`polesDeliveryCreate`** — write-side workshop stamp changed from `user.workshop_id || (p.workshop_id ? Number(p.workshop_id) : null)` to `isWorkshopRestricted(user) ? user.workshop_id : (p.workshop_id ? Number(p.workshop_id) : null)`.

No approval chain, workflow state machine, or business-logic branch was altered — every change is confined to the top-of-function authorization gate or the workshop-id resolution line.

## 6. UI Synchronization (Workstream 8)

Traced every fix against both desktop (`renderer/app.js`) and mobile (`mobile/`) call sites. Conclusion: **no UI-layer change was required for any of the seven findings.**

- **WS1/WS2**: Desktop's sidebar (`buildSidebar(allowedPages)`) is built dynamically from the resolved permissions list — no per-role hardcoded menu items exist, so the new pages appear automatically once granted. Mobile already ships dedicated `PolesSupervisorNavigator`/`VatSupervisorNavigator` components with screens matching exactly the pages granted (Production, Delivery / VAT, Timber Inventory) — the mobile UI was already built and waiting for the backend permission to exist.
- **WS3**: Desktop's `canApprove` list and mobile's `permissions.ts` (`'workshop.approve'`) were already both correctly scoped to admin/ceo/operations/logistics/supervisor — the vulnerability was backend-only (an incidental extra check that happened to pass for over-privileged roles calling the underlying function directly/via REST, bypassing the UI). No client code needed to change.
- **WS4**: Desktop's settings screen and mobile's `ProcurementSettingsScreen` gear icon (`canManageSettings = role==='admin'||role==='ceo'`) already exactly match the new backend gate.
- **WS5**: `resolutionsList` has zero callers in either `renderer/app.js` or any mobile screen/hook today (confirmed via `electron/preload.js`'s dormant IPC binding and `useTimberLifecycle.ts`'s unused `useResolutionsList` hook) — there is no UI to synchronize.
- **WS6**: Desktop's Maintenance Jobs page and Create-Job button are already gated on `'maintenance-jobs'` (not `'machines'`), and mobile-api's own `JOB_ROLES` route middleware already matches exactly who holds `'maintenance-jobs'` in `role_definitions` (verified by direct comparison against `db/migrate.js`'s `grantMaintenanceJobsPermissions`). Both UIs already correctly showed the feature to the intended roles; only the backend function's gate was stale.
- **WS7**: `mobile-api/routes/poles.js` has no route-level role gate of its own — it delegates entirely to `data.js`, and restricted roles are never shown a workshop picker in either UI. The fix is fully effective through REST, desktop IPC, and any direct service-layer call with a single change.

## 7. Workshop Isolation Verification

Per the phase's Critical Architectural Rule, no change was made to `isWorkshopRestricted()` itself, to any other workshop-scoped query, or to the isolation architecture generally. The only three functions touched (`polesPurchaseList`, `polesPurchaseCreate`, `polesDeliveryCreate`) were changed to use the **exact same idiom already used ~40 (read) and ~12 (write) times elsewhere in `data.js`** — this was the one confirmed exception to an otherwise-consistent pattern, and it now matches that pattern exactly rather than introducing a new one.

Live-verified (§9):
- A restricted role (poles-leader, Nyanza/workshop 4) can no longer see another workshop's poles purchase data via a crafted `workshopId` argument — isolation now holds under both the normal UI path and a direct crafted call.
- The same restricted role can no longer stamp a newly created purchase request or delivery to a foreign workshop by passing `workshop_id` in the payload — it is now always forced to their own workshop.
- An unrestricted role (admin) can still legitimately target an explicit workshop on create — confirming the fix narrows only the vulnerable path and does not regress legitimate cross-workshop admin/CEO/operations/logistics operations.
- All other ~40+/~12+ existing workshop-scoped call sites in `data.js` were not touched and remain exactly as they were.

## 8. Notification Verification (Workstream 9)

For every workflow whose authorization gate changed, the notification code beneath that gate was inspected and confirmed unmodified:

- **`materialRequestsCreate`/`Approve`** — the three existing `pushNotification` calls (submission alert to admin/ceo/operations/logistics/supervisor/storekeeper; approval alert to the requester; rejection alert to the requester) are all still present, unchanged, below the edited gate.
- **`maintenanceJobCreate`/`Assign`** — the existing "job assigned to you" notification to the assigned technician is unchanged.
- **`procurementConfigGet`, `resolutionsList`** — pure reads, no notification logic exists or applies.
- **`polesPurchaseCreate`/`polesDeliveryCreate`** — confirmed **no notification exists for these two workflows at all**, before or after this phase. This is a pre-existing gap unrelated to any of the seven findings and is documented here (not fixed — out of this phase's Bug Discipline scope) rather than silently added.

No notification behavior was changed anywhere in this phase, per the rule "if notification coverage is already correct, document it, do not change it."

## 9. Live Test Results (Production Database)

All tests below ran against the live production database using real, existing accounts wherever one existed for the role, and two throwaway accounts only where no real account of that role existed yet (`poles-supervisor`, `vat-supervisor` — both later soft-deleted, see §Cleanup). 18/18 passed.

| # | WS | Role / Account | Action | Expected | Actual | Result |
|---|---|---|---|---|---|---|
| 1 | WS3 | storekeeper (id 12) | approve a pending Material Request | Access denied | Access denied | PASS |
| 2 | WS3 | storekeeper-assistant (id 13) | approve same request | Access denied | Access denied | PASS |
| 3 | WS3 | logistics-officer (id 24) | approve same request | Access denied | Access denied | PASS |
| 4 | WS3 | supervisor (id 45, real approver) | approve same request | success, stock transfer created | success | PASS |
| 5 | WS4 | storekeeper (id 12) | read procurement config | Access denied | Access denied | PASS |
| 6 | WS4 | admin (id 1) | read procurement config | success | success | PASS |
| 7 | WS5 | logistics-officer (id 24) | read resolutions list | Access denied | Access denied | PASS |
| 8 | WS5 | sawmill-leader (id 10, holds `timber-inventory`) | read resolutions list | success | success | PASS |
| 9 | WS6 | mechanician (id 14) | create maintenance job (machine #1) | success | success (job #7) | PASS |
| 10 | WS6 | mechanician (id 14) | assign that job to technician (id 48) | success | success | PASS |
| 11 | WS7a | admin (id 1) | create poles purchase request, explicit workshop_id=Gatare(3) | honored, workshop_id=3 | workshop_id=3 | PASS |
| 12 | WS7a | poles-leader, Nyanza (id 16) | list poles purchases, normal UI path (no workshopId arg) | does not see Gatare fixture | did not see it | PASS |
| 13 | WS7a | poles-leader, Nyanza (id 16) | list poles purchases, **crafted** workshopId=Gatare(3) | does not see Gatare fixture (isolation enforced server-side) | did not see it | PASS |
| 14 | WS7b | poles-leader, Nyanza (id 16) | create purchase request, payload workshop_id=Gatare(3) (foreign) | forced to own workshop (4/Nyanza) | workshop_id=4 | PASS |
| 15 | WS7b | poles-leader, Nyanza (id 16) | create delivery, payload workshop_id=Gatare(3) (foreign) | forced to own workshop (4/Nyanza) | workshop_id=4 | PASS |
| 16 | WS7-reg | admin (id 1) | create purchase request, explicit workshop_id=Nyanza(4) | honored (legitimate cross-workshop admin op) | workshop_id=4 | PASS |
| 17 | WS1 | throwaway `poles-supervisor` (Gatare) | create a poles delivery (their documented job) | success | success | PASS |
| 18 | WS2 | throwaway `vat-supervisor` (Gatare) | read VAT production list (their documented job) | success | success | PASS |

**Cleanup**: every created `material_requests`/`stock_transfers`/`maintenance_jobs`/`poles_purchase_requests`/`poles_deliveries` row was deleted (FK-safe order: `material_requests.transfer_id` nulled before deleting the transfer, since the two tables have a circular reference). Independently re-queried after deletion — 0 rows remaining for every entity type, confirmed by a fresh count query, not by trusting the delete call's return value.

**QA accounts**: the two throwaway accounts (`qa_phase2_poles_sup` id 126, `qa_phase2_vat_sup` id 127) could not be hard-deleted — both had generated `audit_log` rows during testing (from `logAudit()` calls inside the functions under test), and `audit_log` is protected by the immutable `audit_log_no_delete`/`audit_log_no_update` Postgres RULEs discovered and confirmed genuine in the prior audit phase. This is the same constraint already documented in this session's "Stray QA test accounts" memory. Per the codebase's own established convention (`usersDelete()`, used by every other account-removal path in this app), both accounts were **soft-deleted** via that real function: `active=false`, `deleted_at` set, `deleted_by=admin`. They cannot log in, do not appear in any active-user list, and hold no residual permissions or data — this is the correct and complete cleanup state for this codebase, not a leftover artifact.

## 10. Regression Results

Read-only regression pass across six adjacent workflows not directly touched by this phase's fixes, to confirm no collateral breakage:

| Workflow | Test | Result |
|---|---|---|
| Material Requests (list) | supervisor lists their own workshop's requests | PASS |
| Poles Procurement (list, normal path) | poles-leader lists their own workshop's data | PASS |
| Maintenance Jobs (list) | mechanician lists jobs | PASS |
| VAT Production (list) | vat-leader lists VAT records | PASS |
| Timber Inventory (list) | sawmill-leader lists inventory | PASS |
| Procurement Requisitions (list) | admin lists requisitions | PASS |

(One initial run of the VAT check used `sawmill-leader`, which correctly returned Access Denied — sawmill-leader has never held the `value-added-timber` permission; this is expected, pre-existing, correct behavior, not a regression. Re-run against `vat-leader`, the actually-intended role, passed.)

## 11. New Findings

One documentation-only observation, not classified as a defect (no behavior is affected): `mobile-api/routes/poles.js`'s code comments describing `polesDeliveryCreate`'s role check (`// Role check: ['admin','ceo','operations','supervisor','poles-leader']`) are stale — the actual list in `data.js` has included `'poles-supervisor'` since before this phase. The route itself has no independent gate (it delegates fully to `data.js`), so this is a comment-accuracy issue only, pre-existing before this phase, and out of scope per Bug Discipline (not one of the seven verified findings). Recommend a trivial comment fix in a future housekeeping pass.

No other new bugs, permission gaps, or inconsistencies were discovered while implementing or verifying this phase's seven findings.

## 12. Deferred Items

Everything outside the seven confirmed High-priority findings from `ERP_ENTERPRISE_PERMISSION_NOTIFICATION_AUDIT.md` remains deferred, unchanged, per that report's own Priority Matrix and this phase's explicit scope boundary: the remaining Medium/Low permission findings, NOTIF-01 through NOTIF-27 (including NOTIF-18), AUDIT-01 through AUDIT-04, and WI-4 (the business-policy question still pending an answer). None of these were touched or assessed further in this phase.

## 13. Production Readiness Assessment

All seven High-priority findings from the prior audit are now fixed, live-verified against production data with real accounts, and confirmed to require no UI synchronization work beyond what already existed. Both touched backend files pass static verification (`node --check`), the mobile TypeScript baseline is unaffected and clean (`tsc --noEmit`), and a regression pass across six adjacent, untouched workflows found no collateral damage. Workshop Isolation was extended to one prior exception using only the codebase's own existing idiom — the architecture itself was not redesigned, broadened, or weakened anywhere.

This phase's scope is complete. Per the prior audit's own Production Readiness note, remaining Medium/Low findings should be addressed in a future, separately-scoped and separately-approved phase before final UAT sign-off.

---

**Per the Stop Rule: this phase is complete. No further phase has been started automatically. Awaiting review and approval before any next step.**
