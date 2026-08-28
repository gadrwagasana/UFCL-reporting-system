# Phase C1 — Sales Orders Operational Excellence — Changelog

Scope: PR-01 only (Sales Orders), per the phase brief's explicit Stop Rule. No other P2/P3
item, department, or unrelated UX improvement was started.

## Backend — `db/services/data.js`

- **`salesList(userId, opts)`** — signature changed from `(userId, workshopId)` to
  `(userId, opts)`. Now accepts `search`, `status`, `paymentStatus`, `customerId`, `dateFrom`,
  `dateTo`, `sortBy`, `sortDir`, `page`, `pageSize` (all optional) in addition to `workshopId`.
  Returns `total`/`page`/`pageSize` alongside `rows`/`stock`. Calling with no `opts` reproduces
  the exact previous default view (created_at desc, page 1 of 50) plus an honest total count it
  never had. All 3 existing call sites (desktop's admin CSV export button, `electron/main.js`,
  `mobile-api/routes/sales.js`) updated in the same change.
- **`salesGet(userId, orderId)`** — new. Single-order detail: header, customer contact,
  workshop name, COGS/margin (via `products.standard_cost`, same formula `salesReport` already
  used), linked deliveries, total value, and an honest note that `stock_movements` has no FK to
  `sales_orders` (same disclosure `financeTransactionTrace` already makes, now available to an
  ordinary `sales`-permission user instead of Finance-only).
- **`salesOrdersExportExcel(userId, opts)`** — new. Reuses `_payrollBuildExcelBuffer` (a
  generic helper despite its name) and the same filter contract as `salesList`, so the export
  always matches what's on screen.
- **`salesCreate`/`salesDelete`/`salesCloseShort`** — their `logAudit` calls now pass structured
  `{ module: 'sales', actionType, recordId, ... }` opts, matching the convention
  `salesUpdate`/`salesUpdateStatus`/`salesUpdatePayment` already followed. Required for the new
  audit-history read path below to actually return anything for these 3 action types.
- **`logisticsRecordHistory`'s `MODULE_PERMISSION_CHECK`** — added `sales: () => mustRole(user, 'sales')`.
  No other entry changed.
- **`module.exports`** — added `salesGet`, `salesOrdersExportExcel`.

No change to `salesCreate`'s/`salesUpdate`'s/`salesUpdateStatus`'s/`salesCloseShort`'s
transactional stock logic, governance calls, or workshop-isolation checks — all byte-for-byte
unchanged.

## IPC — `electron/main.js` / `electron/preload.js`

- `sales:list` handler now forwards the full options object instead of destructuring
  `{ workshopId }`.
- Added `sales:get` → `data.salesGet`.
- Added `sales:exportExcel` → `data.salesOrdersExportExcel`, base64-encoding the returned
  buffer for the IPC round-trip (identical pattern to the existing `payroll:exportExcel`
  handler).
- `preload.js`: `salesList` now forwards an options object; added `salesGet`, `salesExportExcel`.

## REST — `mobile-api/routes/sales.js`

- `GET /api/sales` now parses `search`, `status`, `payment_status`, `customer_id`, `date_from`,
  `date_to`, `sort_by`, `sort_dir`, `page`, `page_size` query params and forwards them to
  `data.salesList`; response now includes `total`/`page`/`pageSize`.
- Added `GET /api/sales/:id` → `data.salesGet` (registered after the literal `/dashboard` and
  `/report` paths, so Express doesn't match those as `:id` first).
- No export route added on mobile — export remains a desktop-only action, matching the
  established app-wide pattern (see Gap Register G-21/pattern).

## Desktop — `renderer/app.js`

- `renderSales()` rewritten: server-side search/status/payment/date filters
  (`procFilterBarHtml`), sortable column headers (server round-trip per click, not client-side
  resort), Prev/Next pagination reading the new `total`/`page`/`pageSize`, an Export Excel
  button, and `skeletonTableRows` loading state. The table body is now re-rendered by a
  `loadAndRenderTable()`/`renderTableBody()`/`wireRowActions()` split so filter/sort/page
  changes and every row action (edit/delete/deliver/pay/status/close-short/transport) refresh
  just the data, not the whole page (dropdowns, filter state) — filters now survive after an
  action instead of resetting.
- Added `openSalesOrderDetailOverlay(orderId)` — new tabbed overlay (Overview / Deliveries /
  History), reachable by clicking an order number. Uses `salesGet` and
  `logisticsRecordHistory('sales', id)`.
- Added `_salesExportExcel(opts)` helper (mirrors `_payExportExcel`'s base64→Blob→download
  mechanism; no second implementation).
- Fixed the status-change dropdown's `STATUSES` array — now the 5 values `salesUpdateStatus`
  actually accepts, matching mobile's `MANUAL_STATUSES`. If a row's current status is one of the
  4 system-set values previously offered as manually-selectable, it now shows as a disabled
  "(system-set — cannot be changed here)" option instead of a silently-invalid choice.
- `NOTIFICATION_ROUTES['sales']` upgraded from `{ page: 'sales' }` to
  `{ page: 'sales', open: (id) => openSalesOrderDetailOverlay(Number(id)) }`.

## Mobile

- **`mobile/src/hooks/useSalesOrders.ts`** — `useSalesOrdersList` now accepts a
  `SalesOrdersFilters` object (search/status/paymentStatus/dateFrom/dateTo/sortBy/sortDir/page/
  pageSize), same pattern as `usePayrollPeriods`. Added `useSalesOrderDetail(id)`.
- **`mobile/src/api/endpoints.ts`** — added `SALES_DETAIL(id)`.
- **`mobile/src/types/api.ts`** — `SalesOrder` gained optional `customer_registered_name`/
  `workshop_name`; `SalesListResponse` gained optional `total`/`page`/`pageSize`; added
  `SalesOrderDetailResponse`.
- **`mobile/src/components/LogisticsHistoryCard.tsx`** — `module` prop union extended with
  `'sales'`.
- **`mobile/src/screens/salesOrders/SalesOrdersListScreen.tsx`** — added `OfflineBanner`,
  `ListSearchBar`, status filter chips, page-based pagination (`onEndReached` +
  `ListFooterComponent`), tap-card-to-view-detail, and permission gating on Delete/status-change
  (`canDelete = canEdit`, matching Edit/Close-Short's existing gate).
- **`mobile/src/screens/salesOrders/SalesOrderDetailScreen.tsx`** — new screen (header,
  overview, notes, deliveries, `LogisticsHistoryCard`).
- **`mobile/src/navigation/types.ts`** / **`SalesOrdersStack.tsx`** — added the
  `SalesOrderDetail` route.
- **`mobile/src/utils/notificationRouting.ts`** — `sales` entry upgraded from page-only to
  `(id) => ({ screen: 'SalesOrderDetail', params: { orderId: id } })`.

## What was deliberately NOT changed

- Pricing/COGS/margin **calculation** logic — untouched; only newly **displayed** using the
  existing formula.
- `salesCreate`/`salesUpdate`/`salesUpdateStatus`/`salesCloseShort`/`deliveryOrdersCreate`/
  `_applyDeliveryOrderPOD`'s transactional stock/locking logic — untouched.
- Governance (`applyGovernance`) call sites and behavior — untouched.
- Create/Edit/Deliver forms on both platforms — untouched (see Gap Register G-18/G-20).
- No new department, no new approval engine, no new inventory/delivery workflow, no duplicate
  Excel implementation, no direct stock manipulation from the UI.

## Verification

- `node --check` clean on `db/services/data.js`, `electron/main.js`, `electron/preload.js`,
  `renderer/app.js`, `mobile-api/routes/sales.js`.
- `npx tsc --noEmit` clean across the entire `mobile/` project (exit code 0).
- Live E2E test against production data (disposable, fully cleaned up): 47/47 checks passed —
  see the Completion Report for the full scenario list. Zero residue confirmed (QA sales orders,
  stock_movements, delivery_orders, customer all cleaned/verified after the run).
- No commit made. No push. This repository has not been committed to throughout this session's
  program, per established practice — commits happen only when explicitly requested.
