# Logistics Department — Phase 2 Changelog

Enterprise UI/UX, end-to-end audit history, and dashboard redesign for the Logistics department. See `LOGISTICS_PHASE2_COMPLETION_REPORT.md` for full detail.

## Backend

- `db/services/data.js`
  - **Added** `logisticsRecordHistory(userId, module, recordId)` — generic per-record audit-history lookup, reused by every Logistics detail overlay (desktop) and the mobile `LogisticsHistoryCard`. Validates `module` against `deliveries`/`dispatch`/`transport`/`transport-jobs`/`logistics` and gates on the matching page permission.
  - **Fixed** ~17 `logAudit(...)` call sites across `logisticsCreate/Update/Delete`, `deliveryOrdersCreate/Update/Delete`, `dispatchCreate/Review/Delete`, `transportJobsCreate/Update/Delete/UpdateStatus`, `transportCompaniesCreate/Update/Delete`, and `_applyDeliveryOrderPOD` to populate structured `module`/`actionType`/`recordId` (previously only free-text `logAudit`, making per-record history impossible).
  - **Fixed** `logisticsCreate` to return the new item's `id` (was captured for the audit log but never returned to the caller — found via live smoke testing).
  - **Extended** `logisticsDashboard(userId)` with 7 new read-only aggregation queries: delivery/dispatch/transport-job status counts, fleet status counts + vehicles-in-use, this-month fuel totals, and pending-action counts (dispatch approvals + pending edit/delete requests). Same single `mustRole(user, 'logistics-dashboard')` gate as before.

## Electron

- `electron/main.js` — new `logistics:record-history` IPC handler.
- `electron/preload.js` — new `window.UFCL.logisticsRecordHistory(userId, module, recordId)`.

## Mobile API

- `mobile-api/routes/logistics.js` — new `GET /api/logistics/history/:module/:recordId`; `/dashboard` route extended to pass through the 7 new aggregation fields.

## Desktop (`renderer/app.js`)

- **New shared helpers**: `_statusTimelineHtml`, `_logisticsHistoryHtml`, `_loadLogisticsHistoryInto`.
- **Delivery Orders** (`renderDeliveries`): search/status filter/sortable columns, bulk status update, expandable rows (Route/Notes/POD), detail overlay with history.
- **Dispatch** (`renderDispatch`): search/status filter/sortable columns, bulk approve, detail overlay with history.
- **Transport Carriers** (`renderTransport`): search/status filter/sortable columns, bulk activate/deactivate, detail overlay with history.
- **Transport Jobs** (`renderTransportJobs`): search/status/carrier filter/sortable columns, bulk status update, detail overlay with history.
- **Spare Parts & Materials** (`renderLogistics`): search/status filter/sortable columns, detail overlay with history.
- **Logistics Dashboard** (`renderLogisticsDashboard`): Pending Actions banner; new Operational Overview KPI row (Delivery Status, Dispatch Summary, Transport Jobs, Fleet Status, Fuel Overview); "Export report" CSV button (`UFCL.execExport`).
- **Fixed** a bigserial-id `Set` type mismatch in the new bulk-selection state (Delivery Orders, Dispatch, Transport Carriers) — checkbox state could desync after "select all" since `pg` returns `bigserial` ids as strings.

## Desktop (`renderer/styles.css`)

- Added `.bulk-bar` (bulk-action toolbar), styled to match the existing `.filter-bar` family.

## Mobile

- `mobile/src/types/dashboard.ts` — `LogisticsDashboard` extended with the 7 new fields (`StatusCountRow`, `TransportJobStatusRow`, `FuelOverview`, `PendingActionsBlock`).
- `mobile/src/types/api.ts` — new `LogisticsHistoryRow`/`LogisticsHistoryResponse`; **fixed** `TransportJob.status` (`'In Progress'` → `'In Transit'`, matching the real backend/desktop value).
- `mobile/src/api/endpoints.ts` — new `LOGISTICS_HISTORY(module, recordId)` endpoint.
- `mobile/src/components/LogisticsHistoryCard.tsx` — new shared component; exported from `components/index.ts`.
- `mobile/src/screens/logistics/LogisticsDashboardScreen.tsx` — Pending Actions banner + 5 new KPI sections, mirroring desktop.
- `mobile/src/screens/deliveries/DeliveriesListScreen.tsx`, `dispatch/DispatchListScreen.tsx`, `transport/TransportJobsListScreen.tsx`, `transport/TransportCarriersListScreen.tsx` — added `ListSearchBar` + status-chip filtering (previously routed only to global search).
- `mobile/src/screens/deliveries/DeliveryDetailScreen.tsx` — added `LogisticsHistoryCard`.
- `mobile/src/screens/transport/TransportJobsListScreen.tsx`, `transport/TransportJobFormScreen.tsx` — fixed the same `'In Progress'`/`'In Transit'` status-literal mismatch.

## Verification

- `node --check`: clean on `data.js`, `main.js`, `preload.js`, `mobile-api/routes/logistics.js`, `app.js`, `migrate.js`.
- `npx tsc --noEmit` (mobile): clean.
- Live DB smoke test: full create→history→update→history→delete→history lifecycle verified via a throwaway `_qa_phase2_hist` account (deactivated after); all 7 new dashboard queries validated read-only against the live schema.

## Not committed

Per standing release discipline, none of the above has been committed or pushed.
