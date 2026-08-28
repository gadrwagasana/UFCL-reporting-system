# UFCL ERP — Inventory Department Enterprise Audit

**End-to-End Operations, Cross-Department Collaboration & Enterprise Readiness**

This is an audit only. No code was written, no database was modified, and no business process is redesigned here. Every finding below is cited against the actual implementation (`db/services/data.js`, `renderer/app.js`, `mobile-api/routes/*.js`, `mobile/src/screens/*`) and, where relevant, verified against live (read-only) queries against the production database. This document is the foundation for Inventory Phase 1, Phase 2, and Phase 3, following exactly the lifecycle already completed by Procurement, Logistics, and Workshop.

---

## 1. Executive Summary

Inventory is the least architecturally unified department audited so far. Procurement, Logistics, and Workshop each had one clear backend system with UI/UX gaps to close. Inventory has **two structurally separate stock-tracking systems that never sync with each other**, plus a **second, fully independent stock-transfer workflow** layered on top of one of them. Concretely:

- **Two parallel item catalogs.** `stock_catalog` + `stock_levels` (per-warehouse quantities) is the real, actively-used system — every Material Request, Stock Movement, Stock Transfer, and Procurement Goods Receipt reads and writes it. A second, older table, `logistics_items` (flat, single quantity field, no formal per-warehouse breakdown), powers **both** the Inventory Department's own flagship "Stock Levels" page and the Logistics Department's "Spare Parts & Materials" page — and is never touched by Material Requests, Stock Movements, Goods Receipts, or anything else in the real operational chain. **The Inventory Department's main dashboard-equivalent page shows numbers that the rest of the department's own workflow never updates.** (§2, §4, Critical-01)
- **Two parallel stock-transfer workflows.** `stock_movements` with `movement_type='transfer'` is a simple create→approve/reject flow, surfaced on the Workshop Dashboard's "Pending Transfers" widget and approved via `stockTransferApprove`. The dedicated `stock_transfers` table is a full request→approve→**dispatch (with vehicle/driver assignment)**→receive lifecycle, exposed on the separate "Stock Transfers" NAV page. Both write to the same `stock_levels` table through different code paths, so a single warehouse's stock movement history is split across two disconnected systems with no cross-reference. (§2, Critical-02)
- **Zero enterprise UI toolkit anywhere in core Inventory.** Warehouses, Stock Catalog, Stock Movements, Stock Transfers, and Stock Levels are all still 100% on the pre-upgrade `table.dt` pattern — no search, no filter, no sort, no bulk actions, no detail overlay, no audit history. This is the same starting state Procurement, Logistics, and Workshop were each in before their own Phase 2. (§7, §8)
- **Zero per-record audit history for any core Inventory entity.** The shared `logisticsRecordHistory` lookup (built for Logistics, reused by Workshop) has no `stock_catalog`/`warehouses`/`stock_movements`/`stock_transfers`/`logistics_items` entries in its module map, and none of those entities' mutations carry the structured `logAudit` opts the lookup depends on. (§13, §15)
- **Three hardcoded role arrays gate the entire Stock Transfer approval lifecycle** (`stockTransfersApproveReject`, `stockTransfersDispatch`, `stockTransfersReceive`), on both Electron and the mobile API route layer. Verified live against `role_definitions`: `storekeeper`, `supervisor`, and `logistics-officer` all hold the `stock-transfers` page permission today but are silently blocked from approving, dispatching, or receiving transfers they can see and create. (§13, Critical-03)
- **No cycle counts, no physical stock count, no inventory valuation report, no dedicated Inventory Dashboard, no Inventory Alerts page, no Inventory Reports page.** None of these exist as standalone modules anywhere in the codebase — confirmed by exhaustive search, not just NAV inspection. (§14, §15)
- **Sales Orders have zero connection to `stock_catalog`.** There is no inventory validation, reservation, or deduction anywhere in the Sales Order create/dispatch/status-update path — Sales draws from a separate `products` finished-goods catalog. (§5, §6)
- **Vehicle Fleet maintenance parts have zero connection to `stock_catalog`.** `maintenance_records.cost` is a free-text number; no parts are drawn from or reconciled against Inventory stock the way Workshop's Machine Material Requests already are. (§6)
- On the positive side: workshop isolation is correctly enforced on every `stock_catalog`-based list function; the CEO Executive Dashboard already has a correctly-wired, real-data "Stock Summary" widget; Procurement's Goods Receipt correctly posts into `stock_levels`/`stock_movements` (not the disconnected `logistics_items` table); and the dedicated Stock Transfer dispatch flow is genuinely well-engineered (row-locking, insufficient-stock validation, per-dispatch history) — it simply isn't the *only* transfer path in the app.

Inventory should become the department that makes all of the above legible and unified — not by inventing new processes, but by finishing what already exists and reconciling the two systems that were clearly built at different times for overlapping purposes.

---

## 2. Inventory Architecture Review

Confirmed via direct grep of `db/services/data.js` for every function touching `stock_catalog`, `stock_levels`, `stock_movements`, `stock_transfers`, `material_requests`, and `logistics_items`.

### 2.1 System A — `stock_catalog` / `stock_levels` (the real, operational system)
- `stock_catalog` — item master (category, name, sku, uom, unit_cost, min/max stock).
- `stock_levels` — per-`(item_id, warehouse_id)` quantity, the only place actual on-hand quantity lives.
- Fed by: `stockItemsCreate/Update` (`data.js:2071`, `2095`), `stockMovementsCreate` (`data.js:2214`), `stockTransfersDispatch/Receive` (`data.js:2546`, `2658`), `stockTransferApprove` (`data.js:2266`), `procurementGoodsReceiptCreate` (`data.js:13280`, conditionally — see §4.1).
- Consumed by: Stock Catalog page, Stock Movements page, Stock Transfers page, Material Requests, Workshop Dashboard's low-stock/pending-transfer widgets, CEO Executive Dashboard's Stock Summary widget.
- Workshop isolation is applied consistently here via `isWorkshopRestricted(user)` + `(m.workshop_id=$1 or ...)`/warehouse-id filtering — the same pattern already proven in Workshop/Logistics.

### 2.2 System B — `logistics_items` (parallel, disconnected)
- Single table: category, name, sku, uom, unit_cost, **one** `stock`/`min_stock` field (not per-warehouse), optional `workshop_id`.
- Fed by: `logisticsCreate` (`data.js:1186`, gated `mustRole('logistics')`) and its own edit/delete path (governance type `logistics_item`, `data.js:3918`, `3973`, `4017`, `4293-4325`).
- Read by: **two different NAV pages under two different departments** —
  - `logisticsList` (`data.js:1173`) → Logistics NAV "Spare Parts & Materials" (`renderer/app.js` id `logistics`).
  - `inventoryList` (`data.js:1933`) → Inventory NAV "Stock Levels" (`renderer/app.js` id `inventory`, `renderInventory` at `app.js:6805`), and mobile's `StockLevelsScreen.tsx` via `useStockInventory`/`/api/stock/inventory`.
- **Nothing in the real operational chain (Material Requests, Stock Movements, Goods Receipt) ever reads or writes `logistics_items`.** A user editing "Stock Levels" is editing a completely separate ledger from the one Workshop material requests actually deduct against.

### 2.3 System C — `stock_transfers` (a second transfer workflow layered on System A)
- Dedicated table with its own lifecycle (`pending → approved → in_transit → received/rejected`), plus a child table `stock_transfer_dispatches` recording each partial dispatch (vehicle, driver, quantity).
- Full function set: `stockTransfersList/Create/ApproveReject/Dispatch/DispatchHistory/Receive` (`data.js:2455-2711`).
- Coexists with the simpler `stock_movements` `movement_type='transfer'` path (System A, approved via `stockTransferApprove`, `data.js:2266`) which the Workshop Dashboard's "Pending Transfers" widget actually surfaces (built in Workshop Phase 1-3). **Both paths post to `stock_levels`; neither is aware of the other.**

### 2.4 Electron → IPC → data.js → PostgreSQL / REST → data.js — unaffected
The core architecture itself (`electron/main.js` → `secureHandle` → `data.js` → `pool.query`; `mobile-api/routes/*.js` → `data.js`) is followed correctly by every Inventory function checked. No IPC/REST layer business logic duplication was found — routes are thin passthroughs, consistent with every other department's audit finding.

---

## 3. Module-by-Module Review

| Module (per audit brief) | Exists as a distinct page/module? | Backend | Notes |
|---|---|---|---|
| Inventory Dashboard | **No** — no standalone dashboard | — | Closest equivalent is Workshop Overview (Workshop-owned) and the CEO Executive Dashboard's Stock Summary widget; Inventory itself has no executive view |
| Workshop Overview (Inventory section) | Yes, but owned/built by Workshop Phase 1-3 | `workshopOverview` | Already enterprise-grade; Inventory's own low-stock/material-request data is what populates it |
| Workshops | Yes ("Workshops" NAV) | `warehousesList/Create/Update/Delete` | Old UI (§7) |
| Stock Catalog | Yes | `stockItemsList/Create/Update/Delete` | Old UI, no per-record history |
| Stock Categories | Yes (embedded overlay in Stock Catalog) | `stockCategoriesList/Create/Delete` | Functional, minimal |
| Stock Levels | Yes, but reads the disconnected `logistics_items` table (§2.2) | `inventoryList` | Read-only register; not reflective of real stock movement |
| Stock Summary | **No dedicated page** — partially covered by CEO dashboard's Stock Summary widget only | (embedded in `executiveDashboard`) | Not accessible to non-CEO/admin/operations roles |
| Stock Movements | Yes | `stockMovementsList/Create/Delete` | Old UI, 100-row hard cap, no history |
| Stock Transfers | Yes | `stockTransfersList/Create/ApproveReject/Dispatch/Receive` | Functionally strong (row-locking, dispatch history); old UI; hardcoded role gates (§13) |
| Material Requests | Yes — shared with Workshop, already upgraded in Workshop Phase 2 | `materialRequestsList/Create/Approve` | Enterprise-grade already; department-agnostic (any `warehouses` row can be a target) |
| Goods Receipts | Lives under Procurement, not Inventory | `procurementGoodsReceiptCreate/List/Detail` | Correctly posts to `stock_levels`/`stock_movements`; conditional gap (§4.1) |
| Stock Adjustments | **No dedicated module** — `movement_type='adjustment'` is one of five values inside Stock Movements | `stockMovementsCreate` (`data.js:2222`, `2244`) | No adjustment reason taxonomy, no approval step, unlike Transfers |
| Cycle Counts | **Does not exist** | — | Zero matches for `cycle_count`/`cycleCount` anywhere in `data.js` |
| Physical Stock Count | **Does not exist** | — | Zero matches for `physical_count`/`physicalCount` anywhere in `data.js` |
| Inventory Valuation | **Does not exist as a report** | — | Stock value is computed ad hoc inline in `renderInventory` (client-side `stock × unit_cost` sum) and in `workshopOverview`'s per-workshop stock-value card; no standalone valuation report (by category, by age, by warehouse) exists |
| Inventory Reports | **Does not exist** | — | No `inventoryReport*` function anywhere; Reports & Finance NAV section has no Inventory entry |
| Inventory Alerts | **No dedicated page** — low-stock is only ever an embedded widget (Stock Levels page, Workshop Dashboard, CEO dashboard) | — | No standalone alerts list, no alert history, no acknowledgement/dismissal |

---

## 4. End-to-End Workflow Analysis

Traced against the audit's own reference chain: Procurement → Goods Receipt → Inventory Update → Stock Available → Material Request → Approval → Stock Issue → Workshop → Machine Repair → Stock Movement → Finance → Management Reporting.

| Step | Status | Evidence |
|---|---|---|
| Procurement → Goods Receipt | ✅ Working | `procurementGoodsReceiptCreate` (`data.js:13280`) |
| Goods Receipt → Inventory Update | ⚠️ **Conditional — verified gap** | See §4.1 |
| Stock Available (`stock_levels`) | ✅ Working | Confirmed by `stockItemsList` reading live `stock_levels` |
| Material Request | ✅ Working, enterprise-grade already | Built out fully in Workshop Phase 1-3 |
| Approval | ✅ Working, notified | `materialRequestsApprove` (`data.js:2784`), notification added in Workshop Phase 1 |
| Stock Issue | ⚠️ **Not automatic** — see §4.2 | |
| Workshop → Machine Repair | ✅ Working | Workshop's own audit/phases |
| Stock Movement (record of the issue) | ⚠️ **Not automatic** — see §4.2 | |
| Finance (cost visibility) | ✅ Working | `financeVisibility` (Workshop Phase 1), `stock_value` fields |
| Management Reporting | ⚠️ Partial | Only via CEO Executive Dashboard's Stock Summary widget (§14) |

### 4.1 Goods Receipt → Inventory Update: `po.workshop_id` gap (previously documented, still open)
`procurementGoodsReceiptCreate` (`data.js:13318`) only writes to `stock_levels`/`stock_movements` `if (poItem && poItem.stock_item_id && qtyReceived > 0 && po.workshop_id)`. If a Purchase Order has no `workshop_id` (e.g. a company-wide/HQ purchase not tied to one location), the goods receipt is recorded and the PO is marked `received`/`partially_received`, but **inventory is never incremented for that line** — silently. This is the same "unreachable inventory auto-update" defect already logged in the Procurement Module Audit; it is re-confirmed here because it directly determines whether Inventory's own stock figures can be trusted after a Procurement receipt.

### 4.2 Material Request approval does not auto-create a Stock Movement
`materialRequestsApprove` (`data.js:2784` onward) updates `material_requests.status`/`approved_qty` and (per Workshop Phase 1/2) notifies and audit-logs, but does **not** insert a corresponding `stock_movements` row or decrement `stock_levels`. Confirmed by re-reading the full function body: it accepts a `sourceWarehouseId` parameter and reduces stock there, so **the deduction does happen** — but no `stock_movements` audit row is created alongside it, meaning the Stock Movements page (and any movement-based report) will never show the material-request-driven deduction as a line item. This breaks "status consistency" between two views of the same physical event: the item's `stock_levels` figure drops, but its movement ledger has no record of why.

---

## 5. Cross-Department Collaboration Analysis

### Procurement
Requisition → PO → Goods Receipt → Inventory Update → Supplier Returns.
- Quantities: correctly propagated for PO lines linked to a `stock_item_id` and a `workshop_id` (§4.1 gap aside).
- Synchronization: real-time (`stock_levels` updated inside the same DB transaction as the receipt).
- Audit history: `logAudit` with structured opts is present (`module:'procurement'`).
- Supplier Returns: **no reverse flow found** — no function decrements `stock_levels` for a returned-to-supplier item. Out of scope to invent (audit only), flagged as a genuine gap.

### Workshop
Material Request → Approval → Stock Issue → Repair → Inventory Update → Machine History.
- Fully verified in the Workshop audit/phases already completed. The one gap that's Inventory's to own is §4.2 (no `stock_movements` row on approval).

### Logistics
Delivery → Dispatch → Inventory Validation → Inventory Deduction → Delivery Completion.
- **No connection found.** `deliveryOrdersList`/dispatch functions (`data.js:3307` onward) operate on `delivery_orders`/`dispatch_requests`/`sales_orders`, none of which reference `stock_catalog` or `stock_levels`. Delivery quantities validate against the *sales order's own quantity fields*, not against Inventory stock. This mirrors the Sales finding below — Logistics deliveries fulfil Sales Orders, and Sales Orders themselves have no Inventory linkage, so there is nothing for Logistics to validate against even if it wanted to.
- The *unrelated* "Spare Parts & Materials" page under the Logistics NAV section does touch inventory-shaped data, but only the disconnected `logistics_items` table (§2.2) — this is not the Delivery/Dispatch flow the audit brief is asking about.

### Fleet
Fuel → Parts → Maintenance Materials → Availability.
- Fuel: tracked separately (`machine_fuel_logs`, `fuel_logs`) — not `stock_catalog`, but this is a reasonable, longstanding architectural choice (fuel is consumable-and-metered, not warehouse-stocked) and not flagged as a defect.
- Parts / Maintenance Materials: **no connection to `stock_catalog` found.** `maintenanceCreate` (`data.js:3289`) stores a single free-text `cost` field with no line items and no reference to any stock item. Vehicle maintenance parts are not drawn from, or reconciled against, Inventory — unlike Machines, whose Material Requests already integrate with `stock_catalog` end-to-end (Workshop Phase 1-3). This is a genuine, verified asymmetry between how Machines and Vehicles consume workshop materials.

### Sales
Sales Order → Inventory Validation → Reservation → Dispatch → Delivery → Inventory Update.
- **No connection found anywhere in the chain.** `salesList/Create/Update/UpdateStatus/UpdatePayment/CloseShort` (`data.js:877` onward) operate exclusively on `sales_orders` and a separate `products` catalog. No function in this group queries or updates `stock_catalog`/`stock_levels`. There is no reservation concept, no stock validation at order time, and no deduction at dispatch/delivery time.

### Harvesting / Sawmill / Poles / VAT
Consumables, Tools, Equipment, Material Requests / Raw Materials, Finished Products, Production Consumption, Transfers / Treatment Materials / Production Materials.
- The backend mechanism for this already exists and is department-agnostic: `materialRequestsCreate`/`List` are gated only on the `stock-movements` permission and accept any `warehouses.id` as the target location (`data.js:2711-2782`) — they are not hardcoded to "Workshop."
- **However, live production data shows only 4 `warehouses` rows exist today: `Timber`, `Poles`, `HQ`, `Showroom`.** There is no `Sawmill`- or `VAT`-typed warehouse, and `Harvesting` has none either. Of the material requests recorded so far, only 1 is tied to a real workshop_type (`Timber`); 2 have a null workshop_id (unassigned/company-wide). **The capability to route Harvesting/Sawmill/VAT consumable requests through Inventory exists in the backend but is unusable in practice today because no warehouse location has been registered for those departments** — this is a data/operational gap, not a code gap, and is worth flagging precisely because it means Phase 1/2 work here should NOT need new code, only a Workshops/Warehouses data-entry exercise (creating the missing warehouse rows) to unlock a workflow that already works everywhere else.

### Finance
Inventory Value, Stock Value, Cost Visibility, Inventory Reports, Inventory Costs.
- Stock value at cost: computed correctly in `stockItemsList`/`renderInventory`/`workshopOverview`'s per-workshop card (`stock × unit_cost` and `quantity × unit_cost` respectively).
- `financeVisibility` gating (built in Workshop Phase 1) already protects workshop-restricted users from seeing company-wide maintenance cost figures — the same discipline is available for Inventory to reuse (§16).
- No dedicated Inventory cost *report* exists (§14).

### Management
Executive KPIs, Inventory Reports, Operational Dashboards, Alerts, Exception Reporting.
- Executive KPIs: only via the CEO Executive Dashboard's Stock Summary widget (`data.js` — the "Stock Summary" query inside `executiveDashboard`, §14), gated to `['ceo','admin','operations']` only — not available to Inventory-specific roles like `storekeeper`.
- No Inventory-specific exception reporting (e.g. "items never moved in 90 days," "transfers stuck in-transit >7 days") exists.

---

## 6. Collaboration Matrix

| Department | Data flow into Inventory | Data flow out of Inventory | Verified working? | Key gap |
|---|---|---|---|---|
| Procurement | PO line items → Goods Receipt | Stock availability for future POs | ⚠️ Conditional | `po.workshop_id` required (§4.1) |
| Workshop | Material Requests, Machine repairs | Approved stock issued | ✅ (Inventory's own gap is §4.2) | No `stock_movements` row on MR approval |
| Logistics | — | — | ❌ Not connected | Deliveries validate against Sales Orders, not stock |
| Fleet (Machines) | Material Requests | Approved stock issued | ✅ | none (Workshop-owned, already solid) |
| Fleet (Vehicles) | — | — | ❌ Not connected | `maintenance_records.cost` has no stock linkage |
| Sales | — | — | ❌ Not connected | No validation/reservation/deduction anywhere |
| Harvesting | Material Requests (mechanism exists) | — | ❌ Unusable in practice | No Harvesting warehouse row exists |
| Sawmill | Material Requests (mechanism exists) | Raw material consumption | ❌ Unusable in practice | No Sawmill warehouse row exists |
| Poles | Material Requests (mechanism exists) | Treatment material consumption | ⚠️ Warehouse row exists, workflow unverified | Not exercised in production data |
| VAT | Material Requests (mechanism exists) | Production material consumption | ❌ Unusable in practice | No VAT warehouse row exists |
| Finance | Unit costs | Stock value, maintenance cost | ✅ | No dedicated cost report |
| Management | — | Stock Summary widget only | ⚠️ Partial | CEO/admin/operations only, no Inventory-role visibility |

---

## 7. UI / UX Review

Every core Inventory page was checked for the enterprise toolkit markers already established across Procurement/Logistics/Workshop (`procFilterBarHtml`, `wireSortableTable`, `.bulk-bar`, `table.tbl`, detail overlays):

| Page | Table class | Search | Filter | Sort | Bulk | Detail overlay | History tab |
|---|---|---|---|---|---|---|---|
| Warehouses (`renderWarehouses`, `app.js:7527`) | `table.dt` | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Stock Catalog (`renderStockItems`, `app.js:7706`) | `table.dt` | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Stock Levels (`renderInventory`, `app.js:6805`) | `table.dt` | ❌ | ❌ | ❌ | N/A (read-only) | ❌ | ❌ |
| Stock Movements (`renderStockMovements`, `app.js:7972`) | `table.dt` | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Stock Transfers (`renderStockTransfers`, `app.js:8133`) | `table.dt` | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Material Requests | `table.tbl` | ✅ | ✅ | ✅ | ✅ (approve) | ✅ | ✅ | (upgraded in Workshop Phase 2 — shared page) |

Verified via direct grep across the full render-function byte range for each page (`<table`, `procFilterBarHtml`, `wireSortableTable`, `bulk-bar`, `type="search"`) — zero matches outside Material Requests. This is the most uniformly "pre-upgrade" a department has looked across the four audits performed so far; every single core Inventory page needs the exact same treatment already proven four times over.

Positive notes: existing overlays (`openOverlay('Add stock item', ...)`, `openOverlay('New Transfer Request', ...)`, `openOverlay('Record Dispatch', ...)`) are functionally complete forms with validation — the gap is purely the *list/table* layer, not the create/edit forms themselves, which lowers the effort required in Phase 2 relative to a from-scratch rebuild.

---

## 8. CSS Improvement Recommendations

No new visual language is needed — every class required already exists and is proven in Procurement/Logistics/Workshop:
- Replace `table.dt` → `table.tbl` on all 5 pages listed in §7, wiring `wireSortableTable` per the established `th[data-sort-key]` convention.
- Add `procFilterBarHtml`/`applyProcListFilters` search+filter bars — Stock Catalog by category/status, Stock Movements by type/date, Stock Transfers by status, Warehouses by active/type.
- Add `.bulk-bar` to Stock Transfers (bulk-approve pending transfers, mirroring Material Requests' own bulk-approve built in Workshop Phase 2) and to Stock Catalog (bulk category reassignment or bulk active/inactive toggle).
- Add detail overlays with a History tab (`_loadLogisticsHistoryInto`) to Stock Catalog, Stock Movements, Stock Transfers, and Warehouses — this requires the backend prerequisite in §13/§15 first (structured `logAudit` opts + `MODULE_PERMISSION_CHECK` entries), exactly mirroring how Workshop Phase 2 sequenced its own equivalent work.
- Stock Levels (`renderInventory`) needs the biggest structural CSS decision, not just a class swap — see §15 Missing Features for the recommended resolution of the dual-catalog problem before investing in this page's presentation layer.

---

## 9. Mobile vs Electron Review

| Capability | Electron | Mobile | Notes |
|---|---|---|---|
| Stock Catalog | ✅ `renderStockItems` | ✅ `StockCatalogScreen.tsx` | Parity |
| Stock Categories | ✅ (embedded overlay) | ✅ `StockCategoriesScreen.tsx` | Parity |
| Stock Levels | ✅ `renderInventory` (reads `logistics_items`) | ✅ `StockLevelsScreen.tsx` (reads the same, via `useStockInventory`) | **Consistent** — the dual-catalog defect (§2.2) is identical on both platforms, not a parity gap |
| Stock Movements | ✅ | ✅ `StockMovementsScreen.tsx` + dedicated `StockMovementFormScreen.tsx` | Mobile actually has a cleaner Create-form separation here |
| Stock Transfers | ✅ | ✅ `StockTransfersListScreen.tsx` + `StockTransferDetailScreen.tsx` + **dedicated** `StockTransferDispatchScreen.tsx` | Mobile has a purpose-built dispatch screen; desktop's dispatch is an inline overlay — functionally equivalent, mobile's is arguably better decomposed |
| Warehouses | ✅ | ✅ `WorkshopsListScreen.tsx`/`WorkshopFormScreen.tsx` | Parity (naming: mobile calls the folder `workshops`, matching the desktop NAV label) |
| Material Requests | ✅ | ✅ | Already verified at parity in Workshop Phase 2 |
| Route-level permission gates | `mustRole` (data.js) | Hardcoded `CATALOG_ROLES`/`INVENTORY_ROLES`/`MOVEMENTS_ROLES` arrays in `mobile-api/routes/stock.js:12-16`, and `ACT_ROLES`/`APPROVE_ROLES` in `mobile-api/routes/stockTransfers.js:13-14` | Same-class defect as §13, present on **both** platforms for Stock Transfers approval |

No missing mobile screens were found for Inventory — mobile parity is genuinely strong here, better than the desktop/mobile gap seen in earlier department audits. The defects that exist (dual catalog, hardcoded transfer-approval roles, no UI toolkit) are backend/shared-logic and desktop-UI issues respectively, not mobile-specific gaps.

---

## 10. Reporting Review

- **Stock Reports**: none dedicated. Ad hoc totals only, computed client-side in `renderInventory` and inline in `workshopOverview`.
- **Movement Reports**: none. `stockMovementsList` returns a flat, 100-row-capped list with no aggregation, no date-range grouping, no export.
- **Transfer Reports**: none, beyond the per-transfer `stockTransfersDispatchHistory` drill-down (which is a detail view, not a report).
- **Valuation Reports**: none — see §3.
- **Material Request Reports**: none dedicated (Material Requests page itself is a live list, not a report; Workshop's CSV export covers Workshop-context material requests only, not an Inventory-wide report).
- **Executive Reports**: only the CEO Executive Dashboard's Stock Summary widget (`movements_30d`, `low_stock_items`, `pending_transfers`, `pending_material_req`) — four numbers, no trend, no export, and restricted to `['ceo','admin','operations']`.

This is the department's most clear-cut, low-risk Phase 3 opportunity: every other department (Procurement, Logistics, Workshop) now has a CSV export + trend-chart pattern (`execExport`, `_svgBar`/`_svgLine`) that Inventory can reuse verbatim once the underlying list pages exist in enterprise form.

---

## 11. Inventory Intelligence Review

| Capability requested | Exists today? | Notes |
|---|---|---|
| Stock trends | ❌ | No historical stock-level tracking beyond the current `stock_levels` snapshot |
| Movement trends | ❌ | `stock_movements` has `created_at` — a trend is *derivable* (data exists), just not surfaced anywhere |
| Consumption trends | ❌ | Same — derivable from `movement_type='out'` rows, not surfaced |
| Low-stock intelligence | ⚠️ Partial | Binary `stock <= min_stock` flag exists in 3 places (Stock Levels, Workshop Dashboard, CEO dashboard) but there's no reorder-quantity suggestion, no lead-time awareness, no trend of how long an item has been low |
| Reorder visibility | ❌ | No reorder-point-vs-lead-time logic; `min_stock` alone drives the flag |
| Aging inventory | ❌ | No "last movement date" or "days since last movement" tracked/surfaced anywhere |
| Transfer analytics | ❌ | No aggregate view of transfer volume, average dispatch time, or in-transit duration, despite `stock_transfers`/`stock_transfer_dispatches` having all the timestamp data needed |
| Inventory utilization | ❌ | No warehouse-capacity-vs-stock-value utilization metric (warehouses do have a `capacity` field, currently unused for this purpose) |

Every one of these is derivable from data that already exists (`stock_movements.created_at`, `stock_transfers`/`stock_transfer_dispatches` timestamps, `warehouses.capacity`) — consistent with the audit brief's instruction to recommend improvements only where they reuse existing data. None of it requires a new table.

---

## 12. Performance Review

- `stockMovementsList`, `stockTransfersList`, and `materialRequestsList` all hard-cap results at `limit 100` (`data.js:2196`, `2477-2478`, `2732`/`2746`) with no pagination, no "load more," and no way to reach older records through the UI. For a department expected to be the operational center of the whole ERP, this will surface as data silently disappearing once transaction volume grows past 100 rows in a given view.
- `inventoryList`/`stockItemsList` are unbounded (no `limit`) — fine at current data volume (confirmed low row counts in production `warehouses`), but worth flagging before Phase 2 UI work adds client-side sort/filter on top of an unbounded fetch.
- No N+1 patterns found; all list queries are single round-trips with appropriate joins.
- No indexes were inspected (out of scope for a code-only audit), but query shapes (`item_id`/`warehouse_id` joins, `deleted_at is null` filters) match the same patterns already performing acceptably in Workshop/Logistics at comparable or larger data volumes.

---

## 13. Security Review

**Permissions**
- Core catalog/movement functions correctly use `mustRole(user, 'stock-items'|'stock-movements'|'stock-transfers'|'warehouses')`.
- **Three hardcoded role arrays block the entire Stock Transfer approval lifecycle:**
  - `stockTransfersApproveReject` (`data.js:2523`): `['admin','ceo','operations','logistics']`
  - `stockTransfersDispatch` (`data.js:2548`): `['admin','ceo','operations','logistics','supervisor','storekeeper']`
  - `stockTransfersReceive` (`data.js:2660`): same array as Dispatch
  - `stockTransferApprove` (`data.js:2268`, the *other* transfer system, §2.3): `['admin','ceo','operations','logistics','supervisor']`
  - **Live-verified against `role_definitions`**: `logistics-officer`, `storekeeper`, and `supervisor` all hold the `stock-transfers` page permission (can view and create transfers) but are excluded from the approve array; `logistics-officer` is additionally excluded from the dispatch/receive array. These roles can request a transfer but cannot move it forward — the same class of defect independently found and fixed in Workshop Phase 1 (`materialRequestsApprove`) and Logistics Phase 1.
  - The same restrictive `APPROVE_ROLES`/`ACT_ROLES` arrays are duplicated at the mobile API route layer (`mobile-api/routes/stockTransfers.js:13-14`) — this needs the identical fix on both platforms.

**Workshop isolation**
- Correctly enforced on every `stock_catalog`-based list function (`stockItemsList`, `stockMovementsList`, `stockTransfersList`, `materialRequestsList`).
- `stockMovementsCreate` (`data.js:2225`) only enforces the restricted-user check `if (isWorkshopRestricted(user) && p.warehouse_id && ...)` — if a restricted user submits a movement **without** a `warehouse_id`, the isolation check is skipped. In practice this doesn't move real stock (the `stock_levels` write itself also requires `p.warehouse_id`), so the blast radius is an audit-log-only row with no `warehouse_id`, not a cross-workshop stock change — a low-severity inconsistency, not an exploitable isolation break.
- `logistics_items` (§2.2) has its own, separate `workshop_id`-based restriction inside `inventoryList` — correctly applied, but scoped to a table the real workflow doesn't use.

**Audit logging**
- `stockItemsCreate/Update`, `warehousesCreate/Update`, `stockCategoriesCreate/Delete`, `stockMovementsCreate`, and all four Stock Transfer lifecycle functions call `logAudit` with a message string, but **none pass the structured `{module, actionType, recordId}` opts** that `logisticsRecordHistory` requires. Confirmed by re-reading the full `MODULE_PERMISSION_CHECK` map (`data.js:1149-1159`): it lists `deliveries`, `dispatch`, `transport`, `transport-jobs`, `logistics`, `machines`, `machine-logs`, `machine_maintenance_schedules`, `material-requests` — no `stock_catalog`, `warehouses`, `stock_movements`, `stock_transfers`, or `logistics_items` entry exists. Every mutation to core Inventory data is logged in the flat audit feed but is **not retrievable as per-record history** anywhere in the UI.

**Stock integrity**
- `stockTransfersDispatch` correctly uses `for update skip locked` + an explicit insufficient-stock check before allowing dispatch — this is genuinely solid concurrency-safe engineering, better than some of the simpler `stock_movements` paths.
- The plain `stock_movements` `movement_type='adjustment'` path (`data.js:2244`) **overwrites** `stock_levels.quantity` directly (`set quantity=$3`) rather than applying a delta, with no approval step and no reason-code taxonomy beyond the free-text `notes` field — any user with `stock-movements` permission can silently set any item's stock to any number at any warehouse. This is worth flagging as the least-guarded write path in the whole department (contrast with Stock Transfers' approval + dispatch + receive chain for the exact same underlying `stock_levels` table).

**No changes to the isolation model are recommended** — every finding above is a permission-key or audit-completeness gap, not a structural isolation redesign.

---

## 14. Missing Features

Recommended only where they complete an existing workflow, eliminate manual work, or remove duplicate entry — each with business justification.

| Feature | Business justification | Departments affected | Priority | Est. effort |
|---|---|---|---|---|
| Reconcile `logistics_items` into `stock_catalog`/`stock_levels` (or clearly re-scope one of the two "Stock Levels"/"Spare Parts & Materials" pages to point at the real system) | Two people looking at "Inventory" today can see two different numbers for what should be the same physical stock; this undermines trust in every other Inventory figure | Inventory, Logistics | Critical | Medium — data migration + 2 page rewires, no schema redesign needed since `stock_catalog` already supports everything `logistics_items` does |
| Fix the 4 hardcoded role arrays gating Stock Transfer approve/dispatch/receive (desktop + mobile route layer) | Roles that already hold the page permission are silently blocked from the exact action the page exists for | Inventory, Logistics, Workshop | Critical | Small — same `mustRole('stock-transfers')` conversion pattern already applied 3x in prior departments |
| Add structured `logAudit` opts + `MODULE_PERMISSION_CHECK` entries for `stock_catalog`/`warehouses`/`stock_movements`/`stock_transfers` | Every other department now has real per-record history; Inventory — arguably the most audit-sensitive department (it controls physical stock) — has none | Inventory | High | Small — mechanical, same pattern applied 3x already |
| Enterprise table toolkit (search/filter/sort/bulk/detail overlay) on Warehouses, Stock Catalog, Stock Movements, Stock Transfers | Closes the last department-wide UI/UX gap in the ERP; the forms underneath are already complete, only the list layer needs work | Inventory | High | Medium — 4 pages, same toolkit reused verbatim |
| Auto-create a `stock_movements` row when a Material Request is approved (§4.2) | Closes a real status-consistency gap: `stock_levels` already changes, but there is no ledger line explaining why | Inventory, Workshop | High | Small |
| Fix Goods Receipt's `po.workshop_id` requirement (§4.1) | Already logged in the Procurement audit; re-flagged here because it's Inventory's own stock accuracy that suffers | Inventory, Procurement | High | Small (already scoped in Procurement's own audit) |
| Inventory Dashboard (Executive KPIs + Operational Widgets, mirroring Workshop's own Phase 2/3 pattern) | Inventory has no home page of its own today; every other department now has one | Inventory, Management | Medium | Medium — mostly composition of data the other pages already query |
| Stock Movement/Transfer/Valuation reports + CSV export | Closes the reporting gap identified in §10, reusing the `execExport` pattern already proven 3x | Inventory, Finance, Management | Medium | Medium |
| Reorder/aging/transfer-analytics intelligence (§11) | All derivable from existing timestamp data, no new table required | Inventory, Procurement | Medium | Medium |
| Formalize Stock Adjustments as its own reviewable action (reason-code + optional approval), reusing the existing approval infrastructure already proven for Transfers/Material Requests | Closes the least-guarded direct-write path in the department (§13) | Inventory | Medium | Small-Medium |
| Register warehouse rows for Harvesting/Sawmill/VAT (data entry, not code) | Unlocks a Material Request capability that already works everywhere else in the app | Harvesting, Sawmill, VAT, Inventory | Low (operational, not engineering) | Trivial |
| Vehicle maintenance parts linkage to `stock_catalog` (line items instead of a single free-text cost) | Brings Vehicle Fleet material consumption up to the same standard Machines already have via Workshop | Fleet, Inventory | Low | Medium-Large (touches `maintenance_records` shape) |

---

## 15. Critical Issues

1. **Dual, disconnected item catalogs** (`stock_catalog` vs `logistics_items`) — the Inventory Department's own primary page shows figures the rest of the department's workflow never updates. (§2.2, §4)
2. **Dual, disconnected stock-transfer workflows** (`stock_movements` transfer-type vs `stock_transfers` table) — the same physical action (moving stock between warehouses) can happen through two code paths with no cross-reference between them. (§2.3)
3. **Four hardcoded role arrays gate the entire Stock Transfer approval/dispatch/receive lifecycle**, on both Electron and mobile, with a live-verified access gap for `storekeeper`, `supervisor`, and `logistics-officer`. (§13)

---

## 16. High Priority Improvements

1. Zero per-record audit history anywhere in core Inventory (§13, §15 of the Missing Features table).
2. `procurementGoodsReceiptCreate`'s `po.workshop_id` conditional silently skips inventory update. (§4.1)
3. Material Request approval doesn't create a matching `stock_movements` audit row. (§4.2)
4. Zero enterprise UI toolkit on Warehouses, Stock Catalog, Stock Movements, Stock Transfers. (§7)
5. `stock_movements` adjustment type is the least-guarded direct stock-level write in the department — no approval, no reason taxonomy, overwrites rather than deltas. (§13)

---

## 17. Medium Priority Improvements

1. No Inventory Dashboard/executive home page. (§3, §14)
2. No Stock/Movement/Transfer/Valuation reports or CSV export. (§10, §14)
3. No reorder/aging/transfer-analytics intelligence, despite the underlying data existing. (§11, §14)
4. Stock Adjustments has no standalone reviewable identity — it's one value inside a five-value dropdown. (§3, §14)
5. Sales Orders and Vehicle Fleet maintenance have zero connection to `stock_catalog` — real gaps, but larger-scope changes than a Phase 1/2 department audit should attempt to resolve unilaterally (cross-department process decisions).

---

## 18. Low Priority Improvements

1. `stockMovementsList`/`stockTransfersList`/`materialRequestsList`'s hard `limit 100` with no pagination. (§12)
2. Harvesting/Sawmill/VAT warehouse rows don't exist — an operational/data gap, not a code gap. (§5, §14)
3. `stockMovementsCreate`'s isolation check is skipped when `warehouse_id` is omitted (low blast radius, since no stock actually moves in that case). (§13)

---

## 19. Recommended Phase 1 Roadmap — Critical Issues & Security

Mirroring exactly how Workshop/Logistics/Procurement Phase 1s were scoped (security + foundational correctness only, no UI redesign):
1. Convert the 4 hardcoded role arrays (`stockTransfersApproveReject`, `stockTransfersDispatch`, `stockTransfersReceive`, `stockTransferApprove`) to `mustRole(user, 'stock-transfers')`, plus the mirrored fix in `mobile-api/routes/stockTransfers.js`'s `ACT_ROLES`/`APPROVE_ROLES`. Verify against `role_definitions` (as done in this audit) whether any role's access narrows, and patch `db/migrate.js` grants if so, following the established precedent.
2. Add structured `logAudit` opts (`module`/`actionType`/`recordId`) to every core Inventory mutation function, and extend `MODULE_PERMISSION_CHECK` with `stock_catalog`, `warehouses`, `stock_movements`, `stock_transfers` entries — unlocking per-record history as a Phase 2 prerequisite.
3. Fix Material Request approval to insert a matching `stock_movements` row (§4.2) so the movement ledger stays consistent with `stock_levels`.
4. Decide and implement the `logistics_items` reconciliation (§2.2, §15 Critical-01) — this is the single highest-leverage fix in the whole audit and should be scoped/sequenced first within Phase 1, since every later phase's Inventory UI/reporting work is more valuable once it points at the real data.
5. Tighten `stockMovementsCreate`'s isolation check to apply regardless of whether `warehouse_id` is present.

## 20. Recommended Phase 2 Roadmap — Functional Completion & Professional UI/UX

Mirroring Workshop/Logistics/Procurement Phase 2 scope exactly:
1. Enterprise table toolkit (search/filter/sort/bulk/detail overlay + History tab) on Warehouses, Stock Catalog, Stock Movements, Stock Transfers, and — once §19.4 is resolved — Stock Levels.
2. Bulk-approve on Stock Transfers, mirroring Material Requests' existing bulk-approve pattern.
3. Formalize Stock Adjustments with a reason-code field and (reusing the existing approval infrastructure) an optional approval step for large adjustments.
4. Fix the `po.workshop_id` goods-receipt gap (§4.1), coordinated with Procurement since the function lives in that department's territory.
5. Basic Inventory Dashboard: Executive KPIs (Total SKUs, Low Stock Items, Pending Transfers, Pending Material Requests, Total Stock Value) + Operational Widgets, composed from data the other pages already query — no new business logic.

## 21. Recommended Phase 3 Roadmap — Executive Visibility, Operational Intelligence & Production Readiness

Mirroring Workshop/Logistics/Procurement Phase 3 scope exactly:
1. Stock/Movement/Transfer/Valuation reports + CSV export, reusing `execExport`.
2. Reorder intelligence, aging-inventory intelligence, transfer analytics (dispatch-to-receive duration, in-transit aging) — all derivable from existing timestamps, rendered via the existing `_svgBar`/`_svgLine` helpers.
3. Cross-department collaboration final verification, same discipline as Workshop Phase 3 §4 of this audit's sibling report.
4. Mobile parity confirmation for whatever new Dashboard/report screens Phase 2/3 add on desktop.
5. Performance review of the `limit 100` list caps once real usage data justifies pagination.

---

## 22. Production Readiness Assessment

Inventory is **not yet production-ready as a coherent department**, though most of its individual pages function correctly in isolation. The defining issue is architectural fragmentation rather than any single broken feature:

| Area | Status |
|---|---|
| Security (permissions) | ❌ 4 hardcoded role arrays, live-verified access gaps |
| Workshop isolation | ✅ Correct everywhere except one low-severity edge case |
| Data integrity / architecture | ❌ Two disconnected item catalogs, two disconnected transfer workflows |
| Functional completeness (core CRUD) | ✅ Forms and validation are solid; list/read layer is the gap |
| Audit history | ❌ None for any core entity |
| UI/UX/CSS | ❌ Uniformly pre-upgrade across 5 of 6 pages |
| Mobile/Desktop parity | ✅ Genuinely strong — the best of the four departments audited so far |
| Reporting | ❌ Effectively none beyond a 4-number CEO widget |
| Inventory Intelligence | ❌ None, though fully derivable from existing data |
| Cross-department collaboration | ⚠️ Solid with Workshop/Procurement, absent with Sales/Logistics/Fleet-vehicles, latent-but-unregistered with Harvesting/Sawmill/VAT |

**Recommendation**: Sequence Phase 1 around the two dual-system findings first (§19.1/§19.4) rather than treating them as equal-weight items in a long list — every subsequent phase's value compounds once Inventory's data model has one source of truth instead of two. Once Phase 1-3 are complete following the same roadmap already executed for Procurement, Logistics, and Workshop, Inventory should be assessed as Production Ready under the same standard.
