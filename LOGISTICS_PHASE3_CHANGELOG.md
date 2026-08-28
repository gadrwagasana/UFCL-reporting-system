# Logistics Department — Phase 3 Changelog

Operational Excellence, Executive Visibility & Enterprise Professionalization. See `LOGISTICS_PHASE3_COMPLETION_REPORT.md` for full detail.

## Backend

- `db/services/data.js`
  - **Extended** `logisticsDashboard(userId)` with 10 new read-only aggregation queries, behind the same `mustRole(user, 'logistics-dashboard')` gate:
    - `deliveriesToday` / `deliveriesThisWeek` — delivery-date counts.
    - `delayedDeliveries` / `delayedDeliveriesCount`, `delayedTransportJobs` / `delayedTransportJobsCount` — overdue records, exact counts via `count(*) over()` alongside a capped 15-row list.
    - `activeDriversCount` — distinct drivers on active vehicles.
    - `fleetActiveCount`, `fleetUtilizationPct`, `vehicleAvailability` — derived from existing fleet-status/vehicles-in-use figures.
    - `workshopAlerts` / `workshopAlertsCount` — `maintenance_records` due within 7 days.
    - `todaysDeliveries`, `todaysTransportJobs`, `activeDeliveries`, `vehiclesOnRoute`, `vehiclesWaiting`, `priorityDeliveries` — Operational Widget data sources.
  - **Fixed** (collaboration audit finding) — `_applyDeliveryOrderPOD` now fires a `pushNotification` to the sales order's owner when a POD includes a rejected quantity; `salesCloseShort` now fires one when a sales order is closed short. Both use the existing `forUserId`-with-role-fallback targeting pattern already established by the SRM contract-reminder job. Neither previously notified anyone.

## Desktop (`renderer/app.js`)

- New shared helper `_lgdWidget(title, icon, items, emptyMsg)` — the Operational Widgets list-card, used 8 times instead of hand-rolled per instance.
- `renderLogisticsDashboard`:
  - New **Executive KPIs** strip (13 tiles).
  - Existing Fleet Status card extended into **Fleet Intelligence** (utilization %, availability, maintenance-due, avg fuel cost/liter).
  - New **Operational Widgets** grid (Today's Schedule, Active Deliveries, Vehicles on Route/Waiting, Delayed Jobs, Priority Deliveries, Stock Warnings, Workshop Notifications).
  - CSV export extended with the Executive KPI block and delayed/alert detail lists.

## Mobile API

- `mobile-api/routes/logistics.js` — `/dashboard` route passes through the 18 new fields (same shape as desktop).

## Mobile

- `mobile/src/types/dashboard.ts` — `LogisticsDashboard` extended with `DelayedDeliveryRow`, `DelayedTransportJobRow`, `WorkshopAlertRow`, `TodaysDeliveryRow`, `TodaysTransportJobRow`, `ActiveDeliveryRow`, `VehicleOnRouteRow`, `VehicleWaitingRow`, `PriorityDeliveryRow`, and 9 new scalar fields.
- `mobile/src/screens/logistics/LogisticsDashboardScreen.tsx` — new `MiniKpi` (compact KPI tile) and `Widget` (operational widget list) components; Executive KPI grid + Operational Widgets sections added, mirroring desktop.

## Verification

- `node --check`: clean on `data.js`, `renderer/app.js`, `mobile-api/routes/logistics.js`.
- `npx tsc --noEmit` (mobile): clean.
- Live DB smoke test via throwaway `_qa_phase3_smoke` account (deactivated + test data removed after): sales order → delivery order → POD with rejection (notification verified) → close-short (notification verified) → dashboard re-fetch reflecting the new delivery. All 10 new queries validated against the live schema.

## Not committed

Per standing release discipline, none of the above has been committed or pushed.
