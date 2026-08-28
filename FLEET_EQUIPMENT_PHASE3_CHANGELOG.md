# Fleet & Equipment — Phase 3 Changelog

Operational Intelligence, Executive Analytics & Enterprise Reporting. See `FLEET_EQUIPMENT_PHASE3_COMPLETION_REPORT.md` for full detail, testing evidence, and outstanding items.

## Backend

- `db/services/data.js`
  - Added `fleetIntelligence(userId)` — new read-only aggregation across `maintenance_records`, `fuel_logs`, `machine_fuel_logs`, `vehicles`, `delivery_orders`, `machine_maintenance_schedules`/`machines`. Gated on the existing `'vehicles'` permission (no permission change). Returns 6-month zero-filled maintenance and fuel trends, maintenance completion/upcoming/overdue counts, fuel top-consumers and by-department breakdowns, vehicle-level intelligence (most/least utilized via odometer-delta estimate, maintenance frequency, recently inactive, attention-required), cross-department dispatch/workshop-maintenance visibility, and a combined operating-cost figure. Exported.

## Electron

- `electron/main.js` — added `secureHandle('fleet:intelligence', (userId) => data.fleetIntelligence(userId));`
- `electron/preload.js` — added `fleetIntelligence: (_userId) => ipcRenderer.invoke('fleet:intelligence'),`

## Mobile API

- `mobile-api/routes/vehicles.js` — added `GET /api/vehicles/intelligence` (role-gated the same as the dashboard route), registered before `/:id`.

## Desktop (`renderer/app.js`)

- New `_fleetIntelligenceHtml(iq)` — Operational Intelligence section (4 trend chart cards via `_svgBar`, a maintenance snapshot card, a total-operating-cost card, and 8 `_lgdWidget` top/attention lists), composed into `renderVehicles` right after the Phase 2 KPI/widget blocks.
- `renderVehicles` — now also fetches `fleetIntelligence` in the initial `Promise.all`.
- `vExport` CSV handler — extended with an "Operational Intelligence" section (trend series, top lists, attention/inactive/dispatch lists) ahead of the existing vehicle register rows.

## Mobile

- `mobile/src/types/api.ts` — added `FleetTrendMonth`, `FleetIntelligenceListItem`, `FleetIntelligenceResponse`.
- `mobile/src/api/endpoints.ts` — added `FLEET_INTELLIGENCE: '/api/vehicles/intelligence'`.
- `mobile/src/hooks/useVehicles.ts` — added `useFleetIntelligence()` (`queryKey: ['fleet-intelligence']`, `staleTime: 120_000`).
- `mobile/src/screens/vehicles/VehiclesListScreen.tsx` — added `MiniKpi`, `TrendChart` (inline `LineChart`, same pattern as `StockLevelsScreen`), and `OpsWidget` components; new Operational Intelligence section in the list header (2 trend charts, a 4-tile KPI grid, 3 condensed `OpsWidget`s).

## Verification

- `node --check`: clean on `db/services/data.js`, `electron/main.js`, `electron/preload.js`, `mobile-api/routes/vehicles.js`, `renderer/app.js`.
- `npx tsc --noEmit` (mobile): clean.
- Live backend test (throwaway `_qa_fleet_p3` admin account, deactivated immediately after): `fleetIntelligence` and `fleetDashboard` both confirmed working against real production data, including correct zero-filled trend behavior.

## Outstanding (not fixed this phase — see report §10)

- A leftover `_QA-RL-TEST` vehicle row (id 2) from a prior session's testing was surfaced by the new "Recently Inactive Vehicles" widget but not deleted — flagged for your decision, not acted on unilaterally.
- Interactive desktop click-through (Electron + CDP) still not performed, carried over from Phase 2.
- Phase 1's outstanding items (`mechanician` role/navigator mismatch, unrelated `getCeoOverview`/`monthly_approvals` crash) remain untouched.
- Genuine month-by-month vehicle downtime/fleet-availability trends were evaluated and deliberately not built — no historical status-snapshot table exists to derive them honestly.

## Not committed

Per standing release discipline, none of the above has been committed or pushed.
