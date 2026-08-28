# Enterprise UI/UX Standardization Program — Phase 2 — Changelog

Operational Workspace Modernization. See `ERP_ENTERPRISE_UIUX_PHASE2_COMPLETION_REPORT.md` for full detail/reasoning and `ERP_DESIGN_SYSTEM_GUIDE.md` for the underlying component reference.

## Database

No migration — this phase touched no schema.

## Desktop (`renderer/app.js`)

- **`openStockItemDetailOverlay`** (Stock Catalog) — converted from a flat single-scroll overlay to `.smo-tabs` (Overview/History). Category-missing and low-stock banners converted from ad-hoc inline-styled `<div>`s to `alertHtml('info', ...)`/`alertHtml('critical', ...)`. New `siExport` button + handler (CSV export of the currently filtered rows via the existing `downloadCsv()` helper).
- **`openStockTransferDetailOverlay`** (Stock Transfers) — converted from a flat overlay to `.smo-tabs` (Overview/Dispatch Events/History). The `completed_with_discrepancy` banner converted to `alertHtml('critical', ...)`.
- **`renderProcurementRequisitions`** — new KPI strip (Total/Awaiting Approval/Returned for Revision/Approved/Rejected/PO Issued), computed client-side from the already-fetched `allRows` via `kpiTileHtml()`.
- **`renderProcurementOrders`** — new KPI strip (Total/Open/Shortage Pending Approval/Closed with Shortage/Completed). The workshop-filter banner converted from a `.lerr`-with-style-override hack to `alertHtml('info', ...)`; the two JS selectors that targeted `.lerr` directly (`e.target.closest`, `document.querySelector`) updated to `.ent-alert` to match.
- **`renderProcurementGoodsReceipt`** — new KPI strip (Total/Awaiting Receipt/Partial/Complete/Rejected).
- **`renderProcurementDashboard`** — 3 `.lerr` degraded-data banners (Supplier Intelligence, SRM, Analytics) converted to `alertHtml('critical', ...)`. New Quick Actions button row (`#qa-view-suppliers`/`#qa-view-contracts`/`#qa-view-compliance`) consolidating the 3 previously-scattered "→" text links (View Suppliers, Contract Register, Compliance Center) into one row right under the KPI strip; the SRM section's inline links removed, click handlers moved to the new buttons.

## Mobile

- `mobile/src/screens/stockTransfers/StockTransfersListScreen.tsx` — row actions (Approve/Reject/Dispatch/Receive/Short-Damaged) now use `Button` (`size="sm"`, `color` overrides matching each action's prior bespoke color). Dead `actionBtn`/`actionText`/`approveBtn`/`rejectBtn`/`dispatchBtn`/`receiveBtn` styles removed.
- `mobile/src/screens/procurement/RequisitionDetailScreen.tsx` — decision row (Reject/Approve), Return for Revision, Create RFQ, Edit, Submit/Resubmit, and Cancel actions now use `Button`. Dead `decisionBtn`/`rejectBtn*`/`approveBtn*`/`returnBtn*`/`submitBtn*`/`editBtn*`/`cancelBtn*` styles removed; unused `TouchableOpacity`/`Ionicons` imports removed.
- `mobile/src/screens/procurement/PurchaseOrderDetailScreen.tsx` — shortage decision row, Close with Shortage (both the toggle and the `danger`-variant "Request Closure" confirm), Record Goods Receipt, and Create/Raise Invoice actions now use `Button`. Dead `decisionBtn`/`rejectBtn*`/`approveBtn*`/`cancelBtn*`/`receiveBtn*` styles removed; unused `TouchableOpacity` import removed.
- `mobile/src/screens/stock/StockLevelsScreen.tsx` — Executive KPIs (6 tiles) and Operational Intelligence health tiles (4 tiles) now use `KpiCard variant="tile"`. Local `MiniKpi` component and its `miniKpi`/`miniKpiLabel` styles deleted (`miniKpiValue` kept — still used independently by the pre-existing `TrendChart`).
- `mobile/src/screens/stock/StockCatalogScreen.tsx` — low-stock warning now uses `AlertBanner`. Dead `alertBanner`/`alertText` styles removed. (The screen's separate navy "Metrics" stats strip was deliberately left as-is — see completion report §10.)

## Verification

- `node --check`: clean on `renderer/app.js`, `electron/main.js`, `electron/preload.js`.
- `npx tsc --noEmit` (mobile): clean, checked incrementally after each screen.
- No schema, REST/IPC, business-logic, workflow, approval, permission, or Workshop-Isolation change anywhere in this phase.

## Corrections made during implementation (see completion report §10 for full reasoning)

- `RequisitionsListScreen` did not need pull-to-refresh added — it already has it via `FlatList`'s native `refreshing`/`onRefresh` props; the audit's "missing" finding was a research miss (grepped only for the `RefreshControl` component). No change made.
- `StockCatalogScreen`'s navy "Metrics" strip was not converted to `KpiCard` — it's the same pattern as `StockLevelsScreen`'s deliberately-untouched `MetricsBanner`, not a card-tile grid. Converting it would have been an inconsistent, unrequested visual redesign.

## Deliberately not done this phase (see completion report §11 for the full list)

- Procurement Dashboard's `.kpi-card` → `kpiTileHtml`/`.mc` conversion (desktop).
- "Recent Activity"/"Supporting Widgets" sections on any screen.
- Full Enterprise-Table parity (Export/Bulk/Pagination) beyond Stock Catalog's new Export button.
- `FilterBottomSheet` adoption on Stock Catalog/Material Requests (mobile).
- `GoodsReceiptListScreen` (mobile) — untouched.
- A dedicated new mobile "Inventory Dashboard" screen — `StockLevelsScreen` remains the answer.

## Not committed

Per standing release discipline, none of the code above has been committed or pushed.
