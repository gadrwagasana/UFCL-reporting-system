# Harvesting Phase 4 — Changelog

No database schema changes this phase.

## Backend (`db/services/data.js`)

- **Added** `harvestDecisionSupport(userId, workshopId)` — top/bottom compartments by volume, most delayed compartments, highest/lowest production days (last 60 days), species performance ranking. All computed live, no new table.
- **Added** `harvestExecutiveExtras(userId, workshopId)` — Planning Accuracy (total/completed/cancelled/open plan counts, completion rate %, on-schedule rate % for open plans) and Delay Analysis (by-category breakdown, total hours, most common category).
- **Exported** both new functions.

## Mobile API (`mobile-api/routes/harvest.js`)

- **Added** `GET /decision-support`, `GET /executive-extras`.

## Desktop (`electron/main.js`, `electron/preload.js`, `renderer/app.js`, `renderer/styles.css`)

- **`main.js`/`preload.js`:** added `secureHandle`/bindings for `harvest:decision-support`, `harvest:executive-extras`.
- **`app.js` — `renderDailyHarvest`:**
  - Added a **Quick Actions** bar (Log Harvest / New Plan / Log Delay / Export Executive Report) delegating to existing button handlers.
  - Added search boxes to the Active Harvest Operations and Operational Delays tables.
  - Added a new **Decision Support** card (6 ranked-list panels, reusing `.ex-panel`/`.ex-tbl` markup).
  - Added a new **Harvest Executive Report** card (Harvest & Production Summary, Planning Accuracy, Delay Analysis) with an **Export CSV** button.
  - Added `exportHarvestReportCSV()`, reusing the existing `exec:export` IPC handler (no new IPC surface).
- **`app.js` — `renderExecutiveDashboard`:** replaced the Harvest cross-department panel's plain stat-row pipeline with a visual funnel/stepper (`.hv-pipeline-flow`).
- **`styles.css`:** added `.hv-pipeline-flow`/`.hv-pipeline-stage`/`.hv-pipeline-stage-amber`/`.hv-pipeline-stage-green`/`.hv-pipeline-val`/`.hv-pipeline-lbl`/`.hv-pipeline-arrow`.

## Mobile (`mobile/src/...`)

- **`types/api.ts`:** added `HarvestRankedCompartment`, `HarvestDecisionSupportResponse`, `HarvestExecutiveExtrasResponse`.
- **`api/endpoints.ts`:** added `HARVEST_DECISION_SUPPORT`, `HARVEST_EXECUTIVE_EXTRAS`.
- **`hooks/useHarvest.ts`:** added `useHarvestDecisionSupport()`, `useHarvestExecutiveExtras()`.
- **`screens/harvest/HarvestOperationsScreen.tsx`:** added a "Decision Support" section (6 `RankList` cards, one new shared component reused six times).
- **`screens/ceo/CeoOverviewScreen.tsx`:** added Planning Completion Rate and Total Delay Time KPI cards.
- **`screens/harvest/HarvestDashboardScreen.tsx`:** replaced the flat Pipeline KPI tiles with a visual funnel/stepper (same figures, new presentation).
- **`screens/harvest/HarvestPlanListScreen.tsx`:** added client-side search via the existing shared `ListSearchBar` component; empty state now distinguishes "no plans" from "no search results."
- **`screens/harvest/HarvestDelaysScreen.tsx`:** same search + empty-state treatment as above.

## Not changed

- No changes to Harvest Planning's, Harvest Execution's, or Delay Tracking's underlying business logic — this phase touched only reporting/analytics and presentation.
- No changes to Inventory, Logistics, Sawmill, Workshop Isolation, or approval-chain logic.
- No mobile CSV/file export was added — no precedent exists anywhere else in the app.
- Enter-to-submit on overlay forms — identified as an app-wide gap, not fixed (out of a single-module phase's scope).
