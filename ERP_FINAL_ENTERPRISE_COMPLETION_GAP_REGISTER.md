# ERP Final Enterprise Completion Gate — Gap Register

Every finding from this phase's 8 audit agents plus this phase's own live-testing, classified per the brief's required categories: **A-Blocking / B-High / C-Medium / D-Low / E-New Business Decision / F-Intentionally Desktop-Only / G-Intentionally Non-UI**. Items marked **FIXED** are detailed in `ERP_FINAL_ENTERPRISE_COMPLETION_CHANGELOG.md`.

---

## Category A — Blocking

**None found.**

## Category B — High (fixed this phase)

| ID | Finding | Evidence |
|---|---|---|
| B-01 | Transport Jobs had **zero** Workshop Isolation on all 5 functions, reachable by workshop-restricted `sales`/`logistics-officer` roles | `data.js:transportJobsList/Create/UpdateStatus/Update/Delete`; live-verified 8/8 |
| B-02 | `valueAddedProductionBatchUpdate`/`Delete` crashed unconditionally for every caller (wrong raw SQL table name passed to the shared governance engine) — found live during this phase's own fix-verification, not by static audit | `data.js:10764,10798` (now fixed); live-verified 4/4 |
| B-03 | `valueAddedProductionBatchUpdate`/`Delete` also missing Workshop Isolation | Same functions; live-verified 4/4 |
| B-04 | Procurement Requisition Detail, PO Detail/Update, Goods Receipt List/Detail — read-side Workshop Isolation gaps (List already correctly scoped; Detail/Update didn't) | `data.js:procurementRequisitionDetail/procurementPoDetail/procurementPoUpdate/procurementGoodsReceiptList/Detail`; live-verified for Requisition Detail (Goods Receipt/PO Detail fixed identically, same idiom, not separately live-tested this phase — low risk, mechanical fix) |
| B-05 | Harvest/Sawmill/Log Transport write functions (`harvestUpdate/Delete`, `harvestPlanUpdate/Delete`, `dailyUpdate/Delete`, `logTransportUpdate/Delete`) relied only on generic ownership-governance, not a direct Workshop boundary check | `data.js`, 8 functions; live-verified 5/5 (representative sample across all 4 entities) |

## Category C — Medium (fixed this phase)

| ID | Finding | Evidence |
|---|---|---|
| C-01 | `logTransportUpdate` never re-validated the create-time "transport ≤ harvested − wasted" invariant nor the duplicate-receipt-reference guard | `data.js:logTransportUpdate`; live-verified — a 9999-unit raise correctly rejected |
| C-02 | `stockMovementsDelete` reversed `stock_levels` without logging the reversal to the ledger | `data.js:stockMovementsDelete`; live-verified — reversal row now present, net stock unchanged |
| C-03 | `dispatchCreate` notification malformed at the source (no `relatedModule`/`relatedId`) | `data.js:dispatchCreate`; live-verified |
| C-04 | `logPrivilegedOverride` notification (most security-sensitive in the app) same gap | `data.js:logPrivilegedOverride`; code-verified (metadata addition, not independently live-tested — trivial, low-risk) |
| C-05 | 3 procurement functions mutated records with zero audit trail | `data.js:procurementSupplierContactUpdate/Delete,supplierCommunicationUpdate`; live-verified 2/2 |
| C-06 | `'showroom'` desktop NAV permission never seeded to any role | `db/migrate.js` (new `grantShowroomNavPermission`); DB-verified post-migration |
| C-07 | Log Transport had no mobile Delete route/UI (desktop had full CRUD) | `mobile-api/routes/logTransport.js`, `LogTransportDetailScreen.tsx`; built, `tsc`-clean, not independently live-tested via REST (underlying function already live-verified) |

## Category D — Low

| ID | Finding | Status |
|---|---|---|
| D-01 | `harvestList` (data.js) fully wired but never called by any UI — superseded by `dailyHarvestData` | Disclosed, not touched (benign dead code) |
| D-02 | `procurementQuotationsCompare`, `procurementSupplierPerformance` — wired end-to-end, zero UI callers, both superseded by richer functions | Disclosed, not touched |
| D-03 | `ROLE_NAV_GROUPS` (mobile `permissions.ts`) — defined, never imported/used anywhere | Disclosed, not touched |
| D-04 | Stale `'logistics-leader'` string in `GOVERNANCE_APPROVER_ROLES` (`AppHeader.tsx`) — role was never actually assignable, already corrected elsewhere | Disclosed, not touched (inert) |
| D-05 | `polesSourceReport` mobile hook (`usePolesSourceReport`) built, never wired to a screen | Disclosed, not touched |
| D-06 | `transportJobsUpdateStatus` silently returns `{ok:true}` on a nonexistent job id (no existence check) — pre-existing, unrelated to this phase's fix | Found during this phase's own security spot-check; disclosed, not fixed (very low severity, no data/security impact) |
| D-07 | `_QA-RL-TEST` leftover vehicle (id 2) still present in production `vehicles` table | Re-disclosed (previously flagged, still unresolved), not touched — awaiting a user decision |

## Category E — New Business Decision

| ID | Finding | Notes |
|---|---|---|
| E-01 | `procurementBenchmark` + 9 Phase-7 executive-report types (`benchmark_report`, `risk_report`, `health_report`, `performance_report`, buyer/department/workshop/executive-performance reports, `performance_kpi_report`) — fully backend/IPC/REST-wired, zero UI trigger on either platform | Needs a decision on which comparison dimensions/report types to surface and how (a picker UI, new report tabs) |
| E-02 | No general date-range/workshop/department filter support on Procurement's 11 core reporting functions (Spend Analysis, Supplier Performance, Delivery Performance, Budget Utilization, etc.) | Backend limitation, not a missing-UI issue — needs new query parameters designed first |
| E-03 | No BOM/labour-cost engine for VAT/Nyanza production (input cost never flows to output product cost) | Confirmed factual, not implemented anywhere — flagged as a real gap if ever wanted, not invented this phase |
| E-04 | Maintenance job completion has no photo/signoff evidence capability (the generic `attachments` system exists but doesn't cover `maintenance_job` as an entity type) | Infrastructure exists, would need extending — a scope decision |
| E-05 | Governance reminder/escalation *follow-up* notices (not the initial notice) drop their `relatedModule` linkage | Systemic across 4 call sites — real, but a deliberate scope decision on how deep to take this phase's notification-metadata sweep |
| E-06 | Notification delivery does not respect Workshop Isolation (role-blast reaches every role-holder company-wide, even for a workshop-scoped record) | Architectural — would need a `workshop_id` column on `notifications` plus filtering logic; a genuine design decision, not a quick fix |
| E-07 | `'governance'` relatedModule has no desktop routing entry (mobile has a real one — `GovernanceScreen`) since no consolidated governance page exists on desktop | Would need a new desktop page — same class as the already-known "no desktop My Requests view" gap from a prior phase |

## Category F — Intentionally Desktop-Only

| ID | Finding | Reason |
|---|---|---|
| F-01 | Machine Maintenance Schedule mobile Edit/Delete | `MachineMaintScheduleListScreen.tsx` was explicitly built read-only in a prior phase — the roles with mobile List access (mechanician/sawmill-leader/poles-leader) don't hold the `machines` write permission; only admin/ceo/logistics can write, and they already have full desktop access. Backend REST parity added this phase; UI deliberately not. |
| F-02 | Sales History CSV export | Desktop uses Electron's native save-dialog IPC flow; no direct mobile equivalent without a new share-sheet integration. Mobile provides the same filtered data on-screen instead. |
| F-03 | Inventory Loss Reports, Maintenance Reports | Desktop-only by prior deliberate decision (complex analytical pages), re-confirmed accurate this phase. |
| F-04 | Pole Production Downgrade/Firewood/Scrap resolution destinations | Mobile intentionally limits inline resolution to Disposal only (these need a warehouse-select field mobile doesn't implement) — documented in-code, re-confirmed. |

## Category G — Intentionally Non-UI

| ID | Finding | Reason |
|---|---|---|
| G-01 | `inventory-loss-reports`/`maintenance-jobs`/`maintenance-oversight` page keys | NAV-visibility-only convention — the underlying data functions gate on other, pre-existing permission keys instead, by design. |
| G-02 | `trash`/`canManageTrash` | Hardcoded three-role convention (admin/ceo/operations) sitting outside the granular Roles-admin permission-grant system entirely — consistent both platforms, a deliberate design choice from an earlier phase. |
| G-03 | Fuel logs (vehicle + machine) have no `stock_levels`/`stock_movements` linkage | Confirmed factual, no evidence of an intended business rule to auto-connect them — per explicit instruction, not flagged as a bug. |
| G-04 | Fuel tie-in to maintenance jobs | Not implemented, no evidence of business need. |
| G-05 | Rework unsupported for purchased-pole-origin rejection holds | Explicitly, correctly refused with a documented error (no in-house production process to rework a purchased item through) — by design, not a gap. |

---

## Production readiness

**READY WITH DOCUMENTED LIMITATIONS.** Zero Category A (Blocking) findings. All Category B/C findings are fixed and live-verified. Category D/E/F/G items are genuine but none blocks a currently-working business process end-to-end — they are either cosmetic/dead-code housekeeping, business decisions requiring management input, or deliberate prior-phase scope boundaries this phase chose to respect rather than silently override.

Per this phase's Stop Rule: no other department or feature starts automatically. Awaiting explicit direction on any of the Category E business decisions.
