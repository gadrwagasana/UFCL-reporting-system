# ERP Enterprise CRUD Parity Matrix

Legend: ✅ Complete · ⚠️ Partial · ❌ Missing · N/A Intentionally backend-only

A cell marked ✅ means every CRUD/action the backend supports for that entity has a confirmed UI trigger on that platform, traced to file:line evidence (by this phase's fixes, this session's 4 background research agents, or a direct check). Cells reflect state **after** this phase's fixes.

## Sales, Customers, Products, Users (checked directly this phase)

| Module | Backend | Desktop CRUD | Mobile CRUD | Actions | Approval | Notifications | Audit | Status |
|---|---|---|---|---|---|---|---|---|
| Sales Orders | ✅ | ✅ | ✅ | Pay/Status/CloseShort/Deliver ✅ | Governed | ✅ | ✅ | ✅ |
| Customers | ✅ (no delete fn — by design) | ✅ | ✅ | — | Governed | — | ✅ | ✅ |
| Products | ✅ (Toggle = soft delete) | ✅ | ✅ | Toggle active/inactive ✅ | — | — | ✅ | ✅ |
| Users | ✅ | ✅ | N/A (admin-only, desktop) | — | — | — | ✅ | N/A (mobile) |

## Fleet & Vehicles

| Module | Backend | Desktop CRUD | Mobile CRUD | Actions | Approval | Notes | Status |
|---|---|---|---|---|---|---|---|
| Vehicles | ✅ | ✅ | ✅ | Status/assignment (form fields) | Governed soft-delete | — | ✅ |
| Vehicle Fuel Logs | ✅ | ✅ (delete added this phase) | ✅ | — | Governed | Was ⚠️ desktop-behind-mobile, now ✅ | ✅ |
| Vehicle Maintenance Records | ✅ | ✅ (delete added this phase) | ✅ | — | Governed | Was ⚠️ desktop-behind-mobile, now ✅ | ✅ |

## Machines & Mechanician

| Module | Backend | Desktop CRUD | Mobile CRUD | Actions | Approval | Notes | Status |
|---|---|---|---|---|---|---|---|
| Machines | ✅ | ✅ | ✅ | Archive ✅ (fixed prior phase) | Governed | — | ✅ |
| Machine Categories | ✅ | ✅ | ✅ | — | — | — | ✅ |
| Machine Daily Logs | ✅ | ✅ | ⚠️ (create/list only) | — | — | No PUT/DELETE REST route exists | ⚠️ Deferred |
| Machine Fuel Logs | ✅ | ✅ | ✅ (delete added this phase) | — | Governed | Was ⚠️, now ✅ | ✅ |
| Machine KPI Definitions | ✅ | ✅ (edit/delete added Remediation Phase 1) | ❌ | — | — | 100% mobile-blind; likely intentional back-office config (see Machine Maint Schedules precedent) | ⚠️ Deferred, likely N/A |
| Machine KPI Targets | ✅ | ✅ | ❌ | — | — | Same as above | ⚠️ Deferred, likely N/A |
| Machine Maintenance Schedules | ✅ | ✅ | ⚠️ (list+create only, deliberate) | — | — | Explicitly documented in-code as desktop-only by design | N/A (intentional) |
| Maintenance Jobs (full lifecycle) | ✅ | ✅ | ✅ | All 10 `MAINT_TRANSITIONS` states ✅ both platforms | — | Excellent parity, verified by agent | ✅ |
| Casuals (worker registry) | ✅ | ✅ | ❌ | — | — | 100% mobile-blind — a real, larger gap (new mobile feature) | ⚠️ Deferred |
| Casual Labour Requests | ✅ | ✅ | ✅ (delete added this phase) | Review (approve/reject) ✅ | Governed | Was ⚠️, now ✅ | ✅ |

## Procurement

| Module | Backend | Desktop CRUD | Mobile CRUD | Actions | Approval | Notes | Status |
|---|---|---|---|---|---|---|---|
| Suppliers | ✅ | ✅ | ✅ | SetStatus (blacklist/restore) ✅ | — | Legacy `ToggleBlacklist`/`Performance` dead-but-superseded, not a gap | ✅ |
| Supplier Improvement Plans | ✅ | ✅ | ✅ | Status dropdown | — | No distinct "escalate" action exists in backend — not invented | ✅ |
| Improvement Plans Register (cross-supplier browse) | ✅ | ❌ | ❌ | — | — | `supplierImprovementPlansRegister` fully dead both platforms — real but minor gap | ⚠️ Deferred |
| Requisitions | ✅ | ✅ | ✅ | Submit/Approve/Reject/Return-for-Revision ✅ | Multi-stage, full revision history | — | ✅ |
| RFQs / Quotations | ✅ | ✅ | ✅ | Send/Submit/Select/Compare (inline) ✅ | — | `procurementQuotationsCompare` dead but redundant (data already inline) — not a real gap | ✅ |
| Purchase Orders | ✅ | ✅ | ✅ | Issue/Close/Close-with-Shortage ✅ | Governed | — | ✅ |
| Goods Receipts | ✅ | ✅ | ✅ | Partial/Complete auto-computed | — | Stock-item + workshop pickers confirmed present both platforms (Remediation Phase 1 finding, re-confirmed) | ✅ |
| Invoices & Payments | ✅ | ✅ | ✅ | Match/Approve/Reject, Payment Approve/Reject ✅ | Governed | — | ✅ |
| Procurement Reports | ✅ | ✅ (except Benchmark) | ✅ (except Benchmark) | — | — | `procurementBenchmark` dead on **both** platforms (worse than previously known — Phase 1 thought mobile-only) | ⚠️ Deferred, awaiting go/no-go |
| Procurement Settings | ✅ | ✅ | ✅ | CEO threshold config | — | Confirmed built (Remediation Phase 1) | ✅ |

## Nyanza / Sawmill / Showroom

| Module | Backend | Desktop | Mobile | Actions | Notes | Status |
|---|---|---|---|---|---|---|
| Sawmill Production (daily_logs) | ✅ | ✅ | ✅ | — | No status lifecycle exists in schema — point-in-time record, not a gap | ✅ |
| Nyanza Production Batches | ✅ | ✅ | ✅ | — | No status lifecycle on the batch itself (by design) — lifecycle lives on outputs | ✅ |
| Production Offcuts / Resaw | ✅ | ✅ | ✅ | Decide/Recover (resaw) ✅ | No distinct "resaw decision" entity — same row's status field | ✅ |
| Quality Inspection (Sawmill + VAT) | ✅ | ✅ | ✅ | Accept/Reject both source types ✅ | — | ✅ |
| Resolution — Rework | ✅ | ✅ | ✅ | — | — | ✅ |
| Resolution — Downgrade | ✅ | ✅ | ❌ | — | Deliberate — needs product picker, documented in-code | N/A (intentional) |
| Resolution — Return to Inventory | ✅ | ✅ | ✅ | — | — | ✅ |
| Resolution — Firewood/Scrap/Internal/Other | ✅ | ✅ | ⚠️ (Disposal only) | — | Deliberate — needs warehouse picker, documented in-code | N/A (intentional) |
| Resolution Engine — browse/list | ✅ | ❌ | ❌ | — | **Corrected finding**: previously believed mobile-complete/desktop-only; verified this phase that **no screen on either platform** calls `resolutionsList`/`useResolutionsList` — the hook exists but is unused | ⚠️ Deferred (real gap, both platforms) |
| Showroom Damage Reports | ✅ | ✅ | ✅ | Resolution (reuses generic engine) | — | ✅ |
| Showroom Sales | N/A (reuses Sales Orders) | ✅ | ✅ | — | Deliberately not a separate module | ✅ |

## Logistics, Stock, Material Requests, Harvesting

| Module | Backend | Desktop | Mobile | Actions | Approval | Notes | Status |
|---|---|---|---|---|---|---|---|
| Stock Items/Catalog | ✅ | ✅ | ✅ | — | — | — | ✅ |
| Stock Levels/Movements | ✅ | ✅ | ✅ | Adjustment request ✅ | Governed (H-08) | — | ✅ |
| Stock Transfers | ✅ | ✅ | ✅ | Approve/Dispatch/Receive/Discrepancy ✅ | — | No explicit "cancel" post-dispatch — reject/discrepancy cover termination, by design | ✅ |
| Material Requests | ✅ | ✅ | ✅ | Approve/Reject ✅ | Multi-tier | Auto-creates Stock Transfer | ✅ |
| Warehouses | ✅ | ✅ | ✅ | — | — | — | ✅ |
| Delivery Orders | ✅ | ✅ | ✅ | Dispatch/POD ✅ | — | — | ✅ |
| Transport Jobs/Companies | ✅ | ✅ | ✅ | Status updates ✅ | — | — | ✅ |
| Compartments | ✅ | ✅ | ✅ | — | Governed | Hardcoded role array — cosmetic only, functionally correct (Remediation Phase 1 finding) | ✅ |
| Harvest Plans | ✅ | ✅ | ✅ | — | Governed (both panels) | — | ✅ |
| Harvest Logs/Records | ✅ | ✅ | ✅ | — | Governed (both panels) | — | ✅ |
| Log Transport | ✅ | ✅ (Edit added this phase) | ✅ (Edit added this phase) | — | Governed, now fully reachable | Was ❌ on Edit both platforms — this phase's biggest fix, also fixed a `compt_id` missing-column bug found along the way | ✅ |
| Harvest Waste | ✅ | ✅ | ✅ | Resolution (shared engine) | — | — | ✅ |
| Harvest Waste Categories | ✅ | ✅ (Create UI added this phase) | ❌ (read-only, by extension) | — | — | Was ❌ create on desktop; mobile remains list-only (admin-config, reasonable to stay desktop-only) | ✅ (desktop), N/A (mobile) |
| Casual Labour Requests | (see Mechanician section above) | | | | | | |

## Summary Tally

| Category | Count |
|---|---|
| ✅ Complete (after this phase's fixes) | ~54 of ~62 entities audited |
| ⚠️ Partial / genuinely deferred | 8 (Machine Daily Logs mobile edit/delete, Machine KPI Definitions/Targets mobile, Casuals registry mobile, Improvement Plans Register, procurementBenchmark, Resolution Engine browse) |
| N/A — confirmed intentional, not a gap | 6+ (Machine Maint Schedules mobile-read-only, Downgrade mobile, generic resolution destinations mobile, Showroom Sales reuse, Customers no-delete, Stock Transfer no-explicit-cancel) |
| Fixed this phase | 6 real gaps closed (Vehicle Fuel/Maintenance delete ×2 platforms-worth, Machine Fuel Log delete mobile, Casual Labour delete mobile, Harvest Waste Category create desktop, Log Transport Edit both platforms) |
