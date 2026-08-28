# Inventory Department — Phase 1 Completion Report

**Architecture Consolidation, Critical Issues & Security**

Implemented exclusively against the verified findings in `INVENTORY_ENTERPRISE_AUDIT.md`. Nothing here redesigns Inventory's business processes — the objective was to make every screen, report, and workflow reference the one implementation the rest of the ERP already trusts, then close the security and correctness gaps that consolidation exposed.

---

## 1. Executive Summary

- **Both audit-flagged duplicate systems are consolidated.** `logistics_items` (Critical-01) — the disconnected item catalog that powered the Inventory Department's own "Stock Levels" page and the Logistics Department's "Spare Parts & Materials" page — has been retired. Both pages now read and write `stock_catalog`/`stock_levels`, the same table Material Requests, Stock Movements, Stock Transfers, and Procurement Goods Receipt already use. `stock_movements` (`movement_type='transfer'`) (Critical-02) — the simpler, parallel transfer path the Workshop Dashboard's "Pending Transfers" widget used — has been retired in favor of the dedicated `stock_transfers` request→approve→dispatch→receive lifecycle. Verified live: an item created via any of the three affected pages now shows the identical stock figure everywhere (§7).
- **All 3 previously-verified hardcoded role arrays are fixed**, plus a 4th (`stockTransferApprove`) and 2 REST-route-layer arrays found during this phase's own "review Desktop/Mobile/REST API/IPC" pass. Live-verified against `role_definitions`: no role loses access; `storekeeper`, `supervisor`, and `logistics-officer` gain the approve/dispatch/receive actions they already had the page permission for but were silently blocked from (§4).
- **A live smoke test caught a real, previously-unreachable-in-testing crash**: `stock_catalog.id` is referenced by 9 tables (material requests, stock transfers, procurement lines, production, fuel logs, workshop consumption) beyond the two the existing hard-delete handled. Deleting any item with real usage history threw an unhandled foreign-key violation. Fixed with a guard that blocks the delete with a clear message instead — the same "block if referenced" pattern already used by `stockCategoriesDelete` (§6).
- Audit-history foundation laid for all 4 core Inventory entities (`stock_catalog`, `warehouses`, `stock_movements`, `stock_transfers`) — structured `logAudit` opts added to every mutation, `MODULE_PERMISSION_CHECK` extended — so Phase 2's detail-overlay/History-tab UI work has a working backend to build on (§8).
- The stock-transfer lifecycle, which fired zero notifications end-to-end (verified in the audit), now notifies the requester on approve/reject/completion, mirroring the pattern already proven for Material Requests (§8).
- No business logic, approval hierarchy, workshop isolation model, or company workflow was redesigned. No new tables were introduced.

---

## 2. Architecture Consolidation

### 2.1 Stock Catalog Consolidation (Critical-01)

**Authoritative implementation confirmed**: `stock_catalog`/`stock_levels`, per the audit's own finding — used by Procurement Goods Receipt, Material Requests, Stock Movements, Stock Transfers, and Workshop's cost/low-stock figures. `logistics_items` was never touched by any of those.

| Function | Before | After |
|---|---|---|
| `inventoryList` (Stock Levels page) | Read `logistics_items` | Reads `stock_catalog`/`stock_levels`. **Return shape unchanged** — zero changes needed to `renderer/app.js`, mobile's `StockLevelsScreen.tsx`, or the `/api/stock/inventory` route |
| `logisticsList` (Spare Parts & Materials page) | Read `logistics_items` | Reads `stock_catalog`/`stock_levels` (company-wide sum, unrestricted — preserving this page's existing behavior exactly) |
| `logisticsCreate` | Inserted into `logistics_items` with an inline `stock` quantity | Inserts into `stock_catalog`. **"Current stock" field removed from the form** — items start at 0 and are stocked via a Stock Movement/Goods Receipt afterward, the same rule Stock Catalog's own "Add item" form already enforces. This closes the one real behavioral inconsistency between the two forms rather than trying to preserve it |
| `logisticsUpdate` | Updated `logistics_items` directly, including `stock` | Updates `stock_catalog`. **"Stock" field removed from the edit form** (display-only now) — matching Stock Catalog's own item form, which never let quantity be edited directly either |
| `logisticsDelete` | Soft-deleted (`logistics_items` had `deleted_at`) | Hard-deletes, mirroring `stockItemsDelete`'s own established behavior exactly (`stock_catalog` has no soft-delete columns) — reusing the authoritative implementation's own delete semantics rather than inventing a new one |
| Governance entity type | `'logistics_item'` (0 in-flight `pending_edits`/`deletion_requests` at migration time, verified live) | `'stock_item'` — now shared with Stock Catalog's own governed edits |

The CEO Executive Dashboard's low-stock counter (`getDashboardStats`) and the Stock Levels page's own low-stock count were both also reading `logistics_items`; both now count against `stock_catalog`/`stock_levels`.

3 stale `_QA Phase2 History Test Item` rows (leftover test debris from an earlier session, not real business data — confirmed via direct query before deleting) were removed from `logistics_items` as part of this work. The table itself was left in place (schema-preserving; not dropped) but is no longer read or written by any code path.

### 2.2 Stock Transfer Consolidation (Critical-02)

**Authoritative implementation confirmed**: `stock_transfers` — the "complete enterprise lifecycle" (request→approve→dispatch-with-vehicle-assignment→receive, with row-locking and insufficient-stock validation already built in), per the audit's own framing and the Phase 1 brief's explicit instruction to identify "the workflow [that] represents the complete enterprise lifecycle."

- `workshopOverview`'s `pendingTransfers` query — previously `stock_movements where movement_type='transfer' and approval_status='pending'` — now queries `stock_transfers where status='pending'`, workshop-scoped the same way. Field shape unchanged, so the Workshop Dashboard widget's markup needed no changes.
- Desktop (`renderer/app.js`) and mobile (`WorkshopOverviewScreen.tsx`) `.tr-approve`/`.tr-reject` actions now call `stockTransfersApproveReject` (via `UFCL.stockTransfersApprove` / `useStockTransferApprove`) instead of the retired `stockTransferApprove` shortcut.
- **`'transfer'` retired as a creatable Stock Movements type**, on both platforms: removed from the desktop "Record movement" dropdown and its "To warehouse" field, removed from the mobile `StockMovementFormScreen.tsx` type picker and its destination-warehouse field, and removed from `stockMovementsCreate`'s `validTypes` at the backend (defense in depth — a direct API/IPC call bypassing the UI is blocked too, with a message pointing to the Stock Transfers page).
- The now-dead inline transfer approve/reject UI was removed from both the desktop Stock Movements table (`.sm-tappr`/`.sm-trej`) and the mobile `StockMovementsScreen.tsx` (approval row, `RejectModal`, and their now-unused styles) — historical transfer-type rows still display in both, just without an action, since no new ones can arrive `pending`.
- **What "approve" means changed, deliberately**: the retired shortcut moved stock the instant it was approved. The authoritative `stock_transfers` lifecycle requires an explicit Dispatch (with vehicle assignment) and Receive step after approval before stock actually moves. This is the authoritative implementation's own design, not a shortcut this phase introduced — documented here because it is a genuine, visible workflow change for anyone approving transfers from the Workshop Dashboard.

---

## 3. Source of Truth Verification

Live-verified (throwaway `_qa_inv_p1_*` accounts, all deactivated after): created one item via `stockItemsCreate`, added stock via a plain Stock Movement, then read it back through all four affected surfaces:

| Surface | Stock shown |
|---|---|
| Stock Catalog (`stockItemsList`) | 3 |
| Stock Levels / Inventory (`inventoryList`) | 3 |
| Spare Parts & Materials (`logisticsList`) | 3 |
| Workshop Dashboard low-stock widget (`workshopOverview`) | 3 |

All four matched. This was not true before this phase — Stock Levels and Spare Parts & Materials were reading a completely disconnected number.

---

## 4. Security Improvements

Every hardcoded role array found across the transfer lifecycle — in `data.js` and at the REST route layer — replaced with `mustRole(user, 'stock-transfers')` or the equivalent role list widened to match it:

| Location | Before | Fix |
|---|---|---|
| `data.js: stockTransferApprove` | `['admin','ceo','operations','logistics','supervisor']` | `mustRole(user,'stock-transfers')` |
| `data.js: stockTransfersApproveReject` | `['admin','ceo','operations','logistics']` | `mustRole(user,'stock-transfers')` |
| `data.js: stockTransfersDispatch` | `['admin','ceo','operations','logistics','supervisor','storekeeper']` | `mustRole(user,'stock-transfers')` |
| `data.js: stockTransfersReceive` | same as Dispatch | `mustRole(user,'stock-transfers')` |
| `mobile-api/routes/stockTransfers.js: APPROVE_ROLES` | Narrower than `ACT_ROLES` | Approve route now uses `ACT_ROLES` (the full grant list) |
| `mobile-api/routes/workshops.js: /transfers/:movementId/approve` | `MANAGE_ROLES` (4 roles) | Widened to the full `stock-transfers` grant list |
| `mobile-api/routes/stock.js: INVENTORY_ROLES` | Missing `'admin'` (found during this phase's own review, not in the original audit) | Added — admin was 403'd on the mobile Stock Levels tab |

**Verified live against `role_definitions`** before and after: `stock-transfers` is granted to `admin, ceo, logistics, logistics-officer, operations, storekeeper, supervisor`. No role in any of the old arrays loses access. `logistics-officer` gains approve/dispatch/receive; `storekeeper` and `supervisor` gain approve. No `db/migrate.js` change was needed — this was a pure widening to match already-granted permissions, unlike the Workshop `workshop-overview` precedent which required a compensating grant.

**Crash fix (found via live testing, not the original audit)**: `stockItemsDelete`/`logisticsDelete` unconditionally hard-deleted `stock_catalog` rows after only clearing `stock_levels`/`stock_movements`. `stock_catalog.id` is also referenced by `material_requests`, `stock_transfers`, `procurement_requisition_items`, `procurement_po_items`, `production_bom`, `production_consumption`, `production_material_returns`, `wk_consumption`, and `machine_fuel_logs` — deleting an item with any real usage history threw an unhandled foreign-key-violation exception. Both functions now check usage first and return a clear `{ok:false}` error ("Cannot delete — this item has N linked record(s)... Deactivate it instead") — the same block-if-referenced pattern `stockCategoriesDelete` already used, applied here for the first time to items themselves.

---

## 5. Cross-Department Improvements

Verified, not redesigned — confirming the consolidation didn't regress anything the audit found working:
- **Procurement**: Goods Receipt still posts to `stock_levels`/`stock_movements` correctly; unaffected by this phase (the `po.workshop_id` conditional gap remains open, as documented in the audit, and is Procurement's own fix to make).
- **Workshop**: Material Request approval still deducts `stock_levels` correctly; unaffected.
- **Logistics**: `logisticsDashboard` (the actual Logistics Dashboard, distinct from the "Spare Parts & Materials" list page fixed here) was already correctly wired to `stock_catalog` — confirmed, not touched.
- **Finance/Management**: The CEO Executive Dashboard's Stock Summary widget already queried `stock_catalog`/`stock_transfers` correctly for `pending_transfers`; its low-stock count is the one figure that needed the Critical-01 fix (§2.1), now corrected.

Sales Orders' and Vehicle Fleet maintenance's lack of connection to `stock_catalog` (documented in the audit) are unchanged — those are larger, cross-department process questions correctly out of scope for an architecture-consolidation phase.

---

## 6. Inventory Consistency Verification

Beyond the source-of-truth check in §3: confirmed the delete-guard fix (§4) applies identically whether the item was created via Stock Catalog or Spare Parts & Materials (both now call the same `_stockItemUsageCount` check), and confirmed a `stock-transfers`-holding storekeeper can now complete the full request→approve chain that was previously blocked partway through by the hardcoded arrays.

---

## 7. Mobile/Desktop Verification

| Item | Desktop | Mobile |
|---|---|---|
| Stock Levels reads `stock_catalog` | ✅ | ✅ (same backend function, zero screen changes needed) |
| Spare Parts & Materials reads `stock_catalog` | ✅ (form updated) | N/A — this page has no mobile equivalent (confirmed during the audit; desktop-only) |
| Pending Transfers widget reads `stock_transfers` | ✅ | ✅ (`WorkshopOverviewScreen.tsx`) |
| Transfer approve action | ✅ `stockTransfersApprove` | ✅ `useStockTransferApprove` |
| 'transfer' removed from Stock Movements creation | ✅ | ✅ (`StockMovementFormScreen.tsx`) |
| Inline transfer approve UI removed from Stock Movements | ✅ | ✅ (`StockMovementsScreen.tsx`) |
| Hardcoded role arrays fixed | ✅ (`data.js`) | ✅ (`stockTransfers.js`, `workshops.js`, `stock.js` routes) |

`npx tsc --noEmit` clean after every mobile screen change.

---

## 8. Priority 5 — Foundation for Phase 2

Per the brief's own instruction ("prepare the foundation... Phase 2 will modernize the interface"), no UI toolkit/detail-overlay work was done — only the backend wiring Phase 2 will build on:
- `MODULE_PERMISSION_CHECK` (the shared per-record history lookup, first built for Logistics) extended with `stock_catalog`, `warehouses`, `stock_movements`, and `stock_transfers` entries.
- Structured `logAudit` opts (`module`/`actionType`/`recordId`) added to every core Inventory mutation that lacked them: `warehousesCreate`/`Update`, `stockItemsCreate`/`Update`/`Delete`, `stockMovementsCreate`/`Delete`, `stockTransfersCreate`/`ApproveReject`/`Dispatch`/`Receive`. `warehousesDelete` already had them.
- `stockTransfersCreate`, `stockTransfersApproveReject` (both branches), and `stockTransfersReceive` (on completion) now call `pushNotification` — the entire lifecycle fired zero notifications before this phase (verified in the audit). Pattern mirrors `materialRequestsCreate`/`Approve`'s existing notifications exactly (role-tier broadcast on create, `forUserId` targeted on approve/reject/complete).
- Live-verified: `logisticsRecordHistory(userId, 'stock_transfers', transferId)` correctly returns the create + approve audit trail for a test transfer.

---

## 9. Files Modified

**Backend**
- `db/services/data.js` — `inventoryList`, `logisticsList/Create/Update/Delete`, `applyPendingEdit` (+`ENTITY_TABLE_MAP`), `stockItemsCreate/Update/Delete` (+new `_stockItemUsageCount` guard), `workshopOverview`'s `pendingTransfers` query, `stockMovementsCreate`'s `validTypes`, `stockTransferApprove`, `stockTransfersApproveReject`, `stockTransfersDispatch`, `stockTransfersReceive`, `stockTransfersCreate`, `getDashboardStats`'s low-stock query, `MODULE_PERMISSION_CHECK`.

**Desktop**
- `renderer/app.js` — `renderLogistics` (Add/Edit forms, entity_type rename, governance panel entity types), `renderStockItems` (added pending/deletion panels), `renderStockMovements` (removed transfer creation + inline approve UI), `renderWorkshopOverview` (transfer approve/reject now calls `stockTransfersApprove`).

**Mobile**
- `mobile/src/screens/workshops/WorkshopOverviewScreen.tsx` — transfer approve switched to `useStockTransferApprove`.
- `mobile/src/screens/stock/StockMovementFormScreen.tsx` — removed 'Transfer' type and destination-warehouse field.
- `mobile/src/screens/stock/StockMovementsScreen.tsx` — removed inline transfer approve/reject UI, `RejectModal`, and related unused styles.

**Mobile API**
- `mobile-api/routes/stock.js` — `INVENTORY_ROLES` fixed (was missing `admin`).
- `mobile-api/routes/stockTransfers.js` — approve route now uses `ACT_ROLES`.
- `mobile-api/routes/workshops.js` — legacy transfer-approve route role list widened.

**Database**
- 3 stale test rows removed from `logistics_items` (no schema change; table left in place, unused).

---

## 10. Verification Results

- `node --check`: clean on `data.js`, `migrate.js`, `renderer/app.js`, `electron/main.js`, `electron/preload.js`, and all touched `mobile-api/routes/*.js`.
- `npx tsc --noEmit` (mobile): clean, re-run after every screen change.
- **Live database smoke test**, multiple throwaway `_qa_inv_p1_*` accounts (admin + storekeeper, all deactivated after, zero left `active`):
  - Confirmed `logisticsCreate` creates a real `stock_catalog` row, immediately visible via `stockItemsList`, `inventoryList`, and `logisticsList` alike.
  - Confirmed `logisticsUpdate`/`logisticsDelete` operate correctly on `stock_catalog`, including governance.
  - Confirmed the full `stock_transfers` lifecycle (create → approve) works **as a storekeeper** — previously blocked by the hardcoded arrays this phase fixed.
  - Confirmed `workshopOverview`'s `pendingTransfers` correctly reflects `stock_transfers` status.
  - Confirmed `stockMovementsCreate` now rejects `movement_type: 'transfer'` with a clear message.
  - Confirmed notifications fire on transfer create and approve.
  - **Caught the delete-crash bug live** (§4): reproduced the unhandled FK violation, fixed it, then re-verified both the clean-delete and blocked-delete paths succeed gracefully.
  - Confirmed single source of truth: one item, one stock figure, across all four affected surfaces (§3).

---

## 11. Remaining Phase 2 Recommendations

Per the audit's own Phase 2 roadmap, unchanged by this phase's work:
1. Enterprise table toolkit (search/filter/sort/bulk/detail overlay + History tab) on Warehouses, Stock Catalog, Stock Movements, Stock Transfers, and now-consolidated Stock Levels — the backend prerequisite (§8) is now in place for all four.
2. Bulk-approve on Stock Transfers, mirroring Material Requests.
3. Formalize Stock Adjustments with a reason code and optional approval step (still the least-guarded direct-write path in the department — unchanged by this phase, since it wasn't part of the two duplicate-system findings).
4. Basic Inventory Dashboard (Executive KPIs + Operational Widgets), composed from data already queried.

---

## 12. Commit Discipline

Per standing release discipline, nothing in this phase has been committed or pushed. Awaiting explicit user review/approval before any commit.
