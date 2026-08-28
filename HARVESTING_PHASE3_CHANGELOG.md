# Harvesting Phase 3 — Changelog

## Database (`db/migrate.js`)

- **Added** `createHarvestDelaysTable()` — new table `harvest_delays` (compt_id, plan_id, category, duration_hours, production_impact, workshop_id, logged_by, created_at) + 3 indexes. Append-only — no soft-delete columns, matching `maintenance_production_impact`'s precedent (no edit/delete UI this phase, per the brief's "no new approval workflow" rule).
- Called from `migrate()`, applied live.

## Backend (`db/services/data.js`)

- **Added** `harvestCompartmentStatus(userId)` — classifies every compartment into `waitingToStart`/`inProgress`/`completed`/`delayed`, computed live from `compartments`/`harvest_logs`/`harvest_plans` (no new stored state).
- **Added** `harvestPerformance(userId, workshopId)` — volume by compartment, daily/weekly/monthly volume trends (zero-filled via `generate_series`), planned-vs-actual volume, `achievementPct` (nullable), `varianceM3`.
- **Added** `harvestDelayList(userId, workshopId)` / `harvestDelayCreate(userId, payload)` — append-only delay log, category validated against a fixed server-side list.
- **Exported** `harvestCompartmentStatus`, `harvestPerformance`, `harvestDelayList`, `harvestDelayCreate`.

## Mobile API (`mobile-api/routes/harvest.js`)

- **Added** `GET /operations`, `GET /performance`, `GET /delays`, `POST /delays`.

## Desktop (`electron/main.js`, `electron/preload.js`, `renderer/app.js`)

- **`main.js`/`preload.js`:** added `secureHandle`/bindings for `harvest:operations`, `harvest:performance`, `harvest:delay-list`, `harvest:delay-create`.
- **`app.js`:**
  - Added `harvestBucketBadge()` and `harvestDelayCategoryBadge()` shared badge helpers.
  - `renderDailyHarvest`: added 3 new cards — "Active Harvest Operations" (count tiles + sortable compartment table), "Production Performance" (achievement/variance tiles + daily/weekly/monthly `_svgBar` trend charts + volume-by-compartment table), "Operational Delays" (log-delay overlay form + sortable list).
  - `renderExecutiveDashboard`: added a new panel row (Harvest Performance / Cross-Department Pipeline / Production Trend) loaded via an additional async call, reusing the page's existing `.ex-panel`/`_pbar()`/`_svgBar()` primitives without touching the existing `execDashboard()` backend query.

## Mobile (`mobile/src/...`)

- **`types/api.ts`:** added `HarvestOperationCompartment`, `HarvestOperationsResponse`, `HarvestTrendPoint`, `HarvestPerformanceResponse`, `HarvestDelay`, `HarvestDelayListResponse`.
- **`api/endpoints.ts`:** added `HARVEST_OPERATIONS`, `HARVEST_PERFORMANCE`, `HARVEST_DELAY_LIST`, `HARVEST_DELAY_CREATE`.
- **`hooks/useHarvest.ts`:** added `useHarvestOperations()`, `useHarvestPerformance()`, `useHarvestDelays()`, `useHarvestDelayCreate()`.
- **`navigation/types.ts` / `HarvestStack.tsx`:** added `HarvestOperations`, `HarvestDelays`, `HarvestDelayForm` routes.
- **`screens/harvest/HarvestOperationsScreen.tsx`:** new file — combines Workstreams 1 & 2 (compartment status buckets + production performance) in one screen.
- **`screens/harvest/HarvestDelaysScreen.tsx`:** new file — delay list.
- **`screens/harvest/HarvestDelayFormScreen.tsx`:** new file — delay creation form.
- **`screens/harvest/HarvestDashboardScreen.tsx`:** added a "Quick Links" section (Active Harvest Operations, Operational Delays) rather than adding 2 more icons to `HarvestListScreen`'s already-dense header (5 icons: back, search, dashboard, planning, +).
- **`screens/ceo/CeoOverviewScreen.tsx`:** added a "Harvest Operations" KPI section (Compartment Completion %, Delayed Operations, Operational Efficiency %, Waiting for Sawmill), sourced from the existing `useHarvestDashboard()` hook rather than modifying the CEO overview's own backend endpoint.

## Not changed

- No changes to Harvest Planning, Inventory, Logistics, Sawmill, Procurement, Workshop Isolation, or approval-chain logic.
- `mobile/src/screens/reports/ExecutiveScreen.tsx` — not touched this phase.
- Harvesting-supervisor governance-bypass finding (carried over from Phase 1) — still documented only, not fixed.
- 16 leftover `_stabtest_*` QA accounts (carried over from Phase 1) — still not cleaned up.
