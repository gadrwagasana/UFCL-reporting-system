# ERP UI/UX Remediation Phase 2
## Backend → Frontend CRUD Parity & Functional Completion

## 1. Executive Summary

This phase audited CRUD/action parity across Fleet, Mechanician, Procurement, Nyanza/Sawmill/Showroom, Logistics/Stock/Harvesting, and (directly) Sales/Customers/Products/Users — roughly 62 entities — and fixed 6 genuine, verified gaps where a backend capability existed with no reachable UI trigger. The single most important fix completes a loop this program itself opened: Remediation Phase 1 added a `log_transport` edit-approval panel on the assumption editing was already possible; this phase found it wasn't reachable on *either* platform at all (no edit UI on desktop, no PUT route on mobile) and built both, plus fixed a real backend bug (`compt_id` missing from the list query) discovered while wiring the fix.

Four parallel research agents plus direct checks confirmed most of the ERP already has strong CRUD parity — the large majority of entities audited are Category A (complete). The gaps that remain are concentrated in secondary actions (delete on a record type that already supports create/edit) and a handful of admin/back-office screens that are plausibly, sometimes explicitly, intended to stay desktop-only.

## 2. Backend Capabilities Found

Cumulative across this phase's research (4 parallel agents + direct checks): ~62 entities/modules inventoried against their backend CRUD + action functions in `db/services/data.js`, cross-referencing IPC (`electron/main.js`/`preload.js`) and REST (`mobile-api/routes/*.js`) wiring for both platforms.

## 3. Which Already Had UI

The strong majority: Sales, Customers, Products, Users, Vehicles, Machines, Machine Categories, Maintenance Jobs (full 10-state lifecycle, both platforms), Suppliers, Requisitions, RFQs/Quotations, Purchase Orders, Goods Receipts, Invoices/Payments, Procurement Settings, Stock Items/Levels/Movements/Transfers, Material Requests, Warehouses, Delivery Orders, Transport Jobs/Companies, Compartments, Harvest Plans/Logs, Harvest Waste, Sawmill/Nyanza production and QC, Rejection Resolution (Rework/Return-to-Inventory), Showroom Damage + Sales. See `ERP_ENTERPRISE_UI_UX_CRUD_PARITY_MATRIX.md` for the full row-by-row matrix.

## 4. Which Were Missing (and what was done about each)

| # | Gap | Fixed? |
|---|---|---|
| 1 | Log Transport Edit — unreachable on both platforms | **Fixed** (§6) |
| 2 | Vehicle Fuel Log delete — missing on desktop (mobile had it) | **Fixed** |
| 3 | Vehicle Maintenance Record delete — missing on desktop (mobile had it) | **Fixed** |
| 4 | Machine Fuel Log delete — missing on mobile (no REST route) | **Fixed** |
| 5 | Casual Labour Request delete — missing on mobile (no REST route) | **Fixed** |
| 6 | Harvest Waste Category create — missing on both platforms | **Fixed on desktop** (admin-config, matches Machine Categories/Stock Categories precedent of desktop-only) |
| 7 | Machine Daily Logs — mobile can create/list but not edit/delete (no REST routes exist) | Deferred — §11 |
| 8 | Machine KPI Definitions/Targets — 100% mobile-blind | Deferred, likely intentional — §11 |
| 9 | Casuals worker registry (distinct from Casual Labour Requests) — 100% mobile-blind | Deferred — §11 |
| 10 | `procurementBenchmark` — dead on **both** platforms (corrects Phase 1's belief it was mobile-only) | Deferred, already awaiting a go/no-go decision — §11 |
| 11 | `supplierImprovementPlansRegister` (cross-supplier browse) — fully dead both platforms | Deferred — §11 |
| 12 | Resolution Engine browse/list — **corrected finding**: dead on both platforms, not desktop-only as Phase 1 believed (the mobile hook exists but no screen calls it) | Deferred — §11 |
| 13 | Downgrade resolution — no mobile UI | Confirmed intentional (needs a product picker, documented in-code) — not a gap |
| 14 | Generic resolution destinations (Firewood/Scrap/Internal/Other) — mobile restricted to Disposal | Confirmed intentional (needs a warehouse picker, documented in-code) — not a gap |
| 15 | Machine Maintenance Schedules edit/delete — mobile read-only | Confirmed intentional (explicit in-code comment) — not a gap |

## 5. Intentionally Backend-Only (Category E, confirmed this phase)

- Sales Orders have no "cancel" beyond CloseShort/Delete — by design, matches the module's own status model.
- Stock Transfers have no explicit post-dispatch "cancel" — reject (pre-dispatch) and discrepancy-reporting (post-dispatch) cover termination; not a gap.
- `procurementSupplierToggleBlacklist`/`procurementSupplierPerformance` — legacy, superseded by `SetStatus`/`supplierIntelligenceProfile`, both UIs already use the newer function.
- `procurementQuotationsCompare` — dead but redundant; both UIs already render comparison data inline from the RFQ detail payload.
- Machine Maintenance Schedules mobile edit/delete, Downgrade mobile, generic resolution-destination mobile restriction — all three explicitly documented in-code as deliberate platform scope decisions (need a picker UI that wasn't built for mobile), not oversights.

## 6. Fixes Implemented

### Log Transport Edit (the largest fix this phase)

**Root cause**: `logTransportUpdate` (`db/services/data.js:14988`) was fully implemented and governed (`applyGovernance`) but had zero UI callers anywhere — no edit button on desktop's Log Transport page, and mobile's REST layer (`mobile-api/routes/logTransport.js`) only ever exposed `GET`/`POST`, never `PUT`. This meant the edit-approval panel Remediation Phase 1 added to desktop (`insertPendingPanel(['log_transport'])`) had no possible source of pending edits — it was live but permanently empty.

**Fixed**:
- Desktop: added an Edit button per row in the Log Transport table, opening an overlay pre-filled with the entry's current values, calling `UFCL.logTransportUpdate` and handling the response with the standard `handleGovernanceResult` pattern (same idiom as every other governed edit in this file).
- Mobile: added `PUT /api/log-transport/:id` (`mobile-api/routes/logTransport.js`), a new `useLogTransportUpdate` hook, and converted `LogTransportCreateScreen.tsx` into a dual-purpose create/edit screen (an optional `entry` route param puts it into edit mode) — mirroring the exact create-vs-edit-one-form pattern desktop's own `openRequisitionEditOverlay` already uses. `LogTransportDetailScreen.tsx` got a new Edit header action.
- **Bug found and fixed along the way**: `logTransportList` (`db/services/data.js:8865`) never selected `lt.compt_id`, only the joined `compt_name` — meaning the compartment dropdown in my own new desktop edit overlay couldn't have pre-selected the right compartment. Added `lt.compt_id` to the SELECT list (purely additive, no shape change) and verified live that both desktop and mobile edit forms now correctly pre-fill.
- Verified live end-to-end: called `logTransportUpdate` directly against a real record, confirmed `ok:true`, and restored the record's original value afterward — zero residue left.

### Vehicle Fuel Log / Maintenance Record delete (desktop)

Both `fuelLogsDelete` and `maintenanceDelete` were fully governed and already used on the *mobile* side of `VehicleDetailScreen.tsx`, but desktop's equivalent overlay (`openVehicleDetailOverlay`'s Fuel/Maintenance tabs) only ever showed Create (fuel) or Create+Edit (maintenance) — an unusual case of mobile being ahead of desktop. Added delete buttons to both tabs, reusing the exact `confirmDeleteSoft` + `handleGovernanceResultToast` pattern the same overlay's own vehicle-delete button already uses.

### Machine Fuel Log delete (mobile)

`machineFuelLogsDelete` was used on desktop with no REST route at all. Added `DELETE /api/fuel/machine/:id` (mirroring the existing governed-passthrough convention the sibling `PUT` route already established), a `useMachineFuelDelete` hook, and a delete action + `ReasonModal` on `MachineFuelDetailScreen.tsx`, matching `VehicleDetailScreen.tsx`'s established delete-flow idiom.

### Casual Labour Request delete (mobile)

`casualLabourRequestsDelete` was used on desktop with no REST route. Added `DELETE /api/casual-labour/:id` (same governed-passthrough convention), a `useCasualLabourDelete` hook, and a Delete action + `ReasonModal` on `CasualLabourDetailScreen.tsx`.

### Harvest Waste Category create (desktop)

`harvestWasteCategoryCreate` (admin/ceo/operations only) had IPC wiring with no caller — waste categories could be selected but never added. Added a "Categories" management overlay beside the existing "Record Waste" button, mirroring Stock Items' own `openCatManager` list+add pattern exactly (no delete function exists for waste categories in the backend, so none was offered — consistent with the actual backend surface).

## 7. Permission/UI Fixes

None required this phase — every fix reused an already-correct, already-governed backend function. No permission was added, widened, or changed.

## 8. Desktop/Mobile Parity

Before this phase: 2 cases of mobile ahead of desktop (Vehicle Fuel/Maintenance delete), 4 cases of desktop ahead of mobile (Machine Fuel Log delete, Casual Labour delete, Harvest Waste Category create, Log Transport Edit), plus 3 cases where *neither* platform had a capability (procurementBenchmark on desktop too, Resolution Engine browse on both, Improvement Plans Register on both). After this phase: the 6 fixed items are now full parity; the 3 both-platforms-missing items and 2 mobile-only-missing large items remain open, documented in §11.

## 9. Workshop Isolation Verification

No fix in this phase touches `isWorkshopRestricted`, any `workshop_id` filter, or workshop-scoped query logic, except the purely additive `compt_id` column addition to `logTransportList`'s SELECT (which adds a field, changes no filtering). Regression-verified live: a workshop-restricted `storekeeper` remains correctly denied `getCeoOverview`; `businessIntelligenceDashboard`, `machineKpiDefinitionsList`, `harvestWasteCategoriesList`, and `logTransportList` (now including `compt_id`) all still function correctly after this phase's combined changes.

## 10. Regression Testing

- `node --check` clean on `db/services/data.js`, `renderer/app.js`, `electron/main.js`, `electron/preload.js`, `mobile-api/routes/fuel.js`, `mobile-api/routes/casualLabour.js`, `mobile-api/routes/logTransport.js`.
- `npx tsc --noEmit` clean across the full `mobile/` app after every screen/hook/type change.
- Live regression: Workshop Isolation intact; all of Phase 1's own fixes (F-01 CEO dashboard, F-29 BI dashboard) re-verified still working after this phase's changes.
- Live functional verification of `logTransportUpdate` against a real record — confirmed working, then restored to original state (no test residue).
- No throwaway QA records were created for any other fix in this phase (all were direct code additions verified via `node --check`/`tsc` plus, where a live call was low-risk and reversible, a direct function call) — consistent with this session's own live-DB-testing-safety discipline of not touching production data casually.

## 11. Deferred Findings

| Finding | Reasoning |
|---|---|
| Machine Daily Logs — mobile edit/delete | Needs 2 new REST routes + edit UI on `MachineLogDetailScreen.tsx` (currently read-only) — a moderate-sized addition, deferred to keep this phase bounded. |
| Machine KPI Definitions/Targets — mobile | 100% mobile-blind, but this mirrors Machine Maintenance Schedules' own explicit, documented desktop-only design decision (back-office setup/config, not day-to-day field work) — plausibly intentional, not asserted as a gap without a product decision. |
| Casuals worker registry — mobile | 100% mobile-blind; this is a genuinely new mobile feature (roster CRUD), not a small gap-fill — deferred as out of this phase's "close what's broken" scope. |
| `procurementBenchmark` — dead both platforms | Corrects Remediation Phase 1's belief this was mobile-only; it's also dead on desktop. Already explicitly awaiting a go/no-go decision from an earlier phase — kept deferred, not built without that decision. |
| `supplierImprovementPlansRegister` — dead both platforms | A cross-supplier browse/oversight screen, similar in nature and size to Phase 1's own deferred `getApprovalDashboard` (F-02) — real capability, moderate build, deferred for a future phase. |
| Resolution Engine browse/list — dead both platforms | **Corrected finding** (was believed mobile-complete/desktop-only in the original register). A genuinely useful screen (browse past waste/rejection/damage resolutions) needing a new list view on both platforms — deferred, same reasoning as the two items above. |

## 12. Production Readiness

The ERP's CRUD/action surface is materially more complete after this phase — every fix closed a real, verified reachability gap using the existing backend, existing governance, and existing UI idioms, with zero new business logic, zero new tables, and zero permission changes. The deferred items are either plausibly-intentional (back-office config screens), already awaiting a prior business decision, or reasonably sized for a dedicated future phase rather than this one. Nothing found in this phase blocks core operational use of any department — Workshop Isolation, approvals, notifications, and audit trails all remain intact and were regression-verified.

## 13. Remaining UI/UX Backlog

Carried forward: the 6 deferred items in §11, plus everything still open from Remediation Phase 1's own §13 (F-02, F-03, F-05, F-12, F-19, F-21, F-22, F-24, the desktop CEO Overview 2-field display gap) and the program's older backlog (Enter-to-submit app-wide, mobile CSV export, `_QA-RL-TEST` leftover vehicle, leftover QA accounts). None of these were touched this phase.

---

**Nothing in this phase was committed or pushed.** Per the Stop Rule, this report and its accompanying changelog and CRUD Parity Matrix are the final output — no further phase starts automatically.
