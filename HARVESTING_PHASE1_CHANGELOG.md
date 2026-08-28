# Harvesting Phase 1 — Changelog

## Backend (`db/services/data.js`)

- **Added** `harvestDashboard(userId, workshopId)` — today/week/month harvest totals, active/completed compartment counts, logs produced, volume produced (m³), transport waiting, raw log inventory. Gated on `harvest`/`daily-harvest`/`timber-inventory`; workshop-scoped via `isWorkshopRestricted`. Exported.
- **Modified** `timberInventoryList` — added `rawLogsHarvested`, `rawLogsReceivedBySawmill`, `rawLogInventory` to the returned object (new parallel query, `harvest_logs.logs_handrolled` minus `daily_logs.logs_received`). No schema change.
- **Modified** Global Search `timber` module's `canAccess` — now `(await mustRole(u,'harvest')) || (await mustRole(u,'daily-harvest'))` (was `harvest`-only, excluding harvesting-leader/supervisor roles).

## Mobile API (`mobile-api/routes/harvest.js`)

- **Added** `PUT /:id` — edit a harvest log entry (governance-passthrough).
- **Added** `DELETE /:id` — soft-delete a harvest log entry, optional `reason` (governance-passthrough).
- **Added** `GET /dashboard` — static route (registered ahead of no conflicting `/:id` GET handler), 30s cache hint, calls `harvestDashboard`.

## Desktop (`electron/main.js`, `electron/preload.js`, `renderer/app.js`)

- **`main.js`:** added `secureHandle('harvest:dashboard', ...)`.
- **`preload.js`:** added `harvestDashboard` binding.
- **`app.js` — `renderDailyHarvest`:**
  - Added an async-loaded "Harvest Dashboard" widget strip (6 tiles: Today's Harvest, This Week, This Month, Completed Compartments, Transport Waiting, Raw Log Inventory).
  - Harvest Log table: added search input (`hv-log-search`) and click-to-sort column headers (`wireSortableTable`), replacing the static row list with `renderHvLogRows()`; row edit/delete button wiring extracted into `wireHvLogRowButtons()` so it re-attaches after every search/sort re-render.
  - Harvest Log table empty state switched to the shared `emptyRowHtml()` helper.
- **`app.js` — removed** `renderHarvest()` (dead "Harvest Tracking" page, no nav entry, no container element — confirmed unreachable).
- **`app.js` — `renderTimberInventory`:** corrected the harvest-summary empty-state copy's stale cross-reference from "the Harvest Tracking page" (removed) to "the Harvesting Daily page" (the real one).

## Mobile (`mobile/src/...`)

- **`hooks/useHarvest.ts`:** added `useHarvestDashboard()`, `useHarvestUpdate()`, `useHarvestDelete()`.
- **`api/endpoints.ts`:** added `HARVEST_UPDATE`, `HARVEST_DELETE`, `HARVEST_DASHBOARD`.
- **`types/api.ts`:** added `HarvestDashboardResponse`.
- **`navigation/types.ts`:** `HarvestStackParamList.HarvestCreate` now accepts an optional `{ entry?: HarvestEntry }`; added `HarvestDashboard: undefined`.
- **`navigation/HarvestStack.tsx`:** registered `HarvestDashboardScreen`.
- **`screens/harvest/HarvestCreateScreen.tsx`:** dual create/edit mode; fixed compartment dropdown to disable completed compartments (except the one currently selected when editing); fixed species auto-fill on compartment selection.
- **`screens/harvest/HarvestDetailScreen.tsx`:** added Edit header action and a `ReasonModal`-gated Delete button, both `harvest.write`-gated and offline-aware.
- **`screens/harvest/HarvestDashboardScreen.tsx`:** new file — KPI tiles grouped into Production / Compartments / Logs & Volume / Pipeline sections.
- **`screens/harvest/HarvestListScreen.tsx`:** added a "Harvest dashboard" header action (unconditional, read-only).

## Not changed

- No database schema changes.
- No changes to Workshop Isolation, approval chains, or any existing business logic.
- No connection made between Harvesting and Pole Production.
- Harvesting-supervisor governance-bypass finding (Workstream 6) — documented only, not fixed (needs a business decision; brief forbids touching approval chains this phase).
