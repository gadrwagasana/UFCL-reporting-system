# Workshop Department — Phase 3 Changelog

Executive Visibility, Operational Intelligence & Production Readiness. See `WORKSHOP_PHASE3_COMPLETION_REPORT.md` for full detail.

## Backend (`db/services/data.js`)

- **Extended** `workshopOverview` with 4 new fields, inserted before the function's `return`, reusing its existing `wsWhere`/`wsParams`/`restricted`/`monthStart` scoping variables:
  - `workshopUtilizationPct` — fleet-wide hours-worked-vs-downtime ratio for the current month, workshop-scoped.
  - `maintenanceThisMonthCount` — count of maintenance schedules completed (`last_performed`) this month, workshop-scoped.
  - `costTrendMonths` — 6-month `maintenance_records.cost` trend, gated to full-access roles only (same discipline as `financeVisibility`).
  - `maintenanceTrendMonths` — 6-month completed-maintenance count trend, workshop-scoped.
  - Both trend queries use `generate_series` + `left join` so every one of the 6 months is always present (zero-filled), and bucket dates in SQL (`date_trunc`/`to_char`) rather than JS `Date` arithmetic, per the timezone lesson from Phase 2.

## Desktop (`renderer/app.js`)

- `renderWorkshopOverview`: added 3 Executive KPI tiles (Machines available, Maintenance this month, Workshop utilization) and a new Trends section (Maintenance Trend + finance-gated Cost Trend) rendered via the existing `_svgBar`/`_svgLine` helpers; CSV export extended with the same new fields.
- `renderMachineKpi`: added a Machine Intelligence card (Highest Downtime ranking + Attention Needed callout), computed entirely from the page's already-fetched data — no new query.

## Mobile

- `mobile/src/types/api.ts` — new `WorkshopCostTrendMonth`/`WorkshopMaintenanceTrendMonth` interfaces; `WorkshopOverviewResponse` extended with the 4 new fields.
- `mobile/src/screens/workshops/WorkshopOverviewScreen.tsx` — 3 new `MiniKpi` tiles; new `TrendChart` component (`react-native-gifted-charts`' `LineChart`, already a dependency, same pattern as `EpmTrendsScreen`) rendering both trend series.

## Mobile API

- No changes required — `mobile-api/routes/workshops.js`'s `/overview` route remains a raw passthrough.

## Verification

- `node --check`: clean on `data.js`, `renderer/app.js`.
- `npx tsc --noEmit` (mobile): clean.
- Live DB smoke test via three throwaway `_qa_p3_*` accounts (admin, workshop-restricted, and a data-backed pass — all deactivated/deleted, all test rows removed after): confirmed correct zero-fill behavior with no data, correct finance/workshop gating on a restricted account, and correct math with real data (8h worked / 2h downtime → exactly 80% utilization; a schedule completed today counted correctly in both the KPI and the trend bucket).

## Production readiness

Per the Phase 3 assessment, the Workshop Department is considered **Production Ready**.

## Not committed

Per standing release discipline, none of the above (nor any prior Workshop phase) has been committed or pushed.
