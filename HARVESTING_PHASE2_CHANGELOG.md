# Harvesting Phase 2 — Changelog

## Database (`db/migrate.js`)

- **Added** `createHarvestPlanningTables()` — new table `harvest_plans` (planned_date, compt_id, sub_name, species, target_volume_m3, target_logs, priority, status, workshop_id, notes, created_by/at, soft-delete columns) + 4 indexes. Reuses existing `harvest`/`daily-harvest` permissions — no new permission granted.
- **Added** `harvest_logs.plan_id` (nullable, FK to `harvest_plans`) + index — additive column, existing rows/behaviour unaffected.
- Called from `migrate()`, applied live.

## Backend (`db/services/data.js`)

- **Added** `harvestPlanList(userId, workshopId)` — plans with computed `actual_logs`/`actual_volume_m3` (from linked `harvest_logs`) and `is_delayed` (computed, not stored).
- **Added** `harvestPlanCreate(userId, payload)`.
- **Added** `harvestPlanUpdate(userId, planId, payload)` — governance-gated (`applyGovernance`), same pattern as `harvestUpdate`.
- **Added** `harvestPlanDelete(userId, planId, reason)` — governance-gated soft delete, same pattern as `harvestDelete`.
- **Modified** `harvestCreate` — accepts optional `plan_id`; on insert, advances the linked plan's status (`Planned → In Progress → Completed`) based on actual output vs. target.
- **Modified** `harvestDashboard` — added `dailyProductivityM3`/`weeklyProductivityM3`/`monthlyProductivityM3`, `plannedVolumeM3`/`actualVolumeM3`/`plannedLogs`/`actualLogs` (current month), `planningSummary` (planned/inProgress/completed/delayed counts), `todaysSchedule` (today's plans), `pipeline` (`logsHarvested`/`logsTransported`/`logsConsumedBySawmill`).
- **Exported** `harvestPlanList`, `harvestPlanCreate`, `harvestPlanUpdate`, `harvestPlanDelete`.

## Mobile API (`mobile-api/routes/harvest.js`)

- **Added** `GET /plans`, `POST /plans`, `PUT /plans/:id`, `DELETE /plans/:id` (the latter two governance-passthrough, same convention as the existing harvest-log routes).

## Desktop (`electron/main.js`, `electron/preload.js`, `renderer/app.js`)

- **`main.js`:** added `secureHandle` for `harvest:plan-list`/`plan-create`/`plan-update`/`plan-delete`.
- **`preload.js`:** added matching `harvestPlanList`/`harvestPlanCreate`/`harvestPlanUpdate`/`harvestPlanDelete` bindings.
- **`app.js`:**
  - Added `harvestPlanStatusBadge()`/`harvestPriorityBadge()` shared badge helpers.
  - `renderDailyHarvest`: new "Harvest Planning" card (search, sortable columns, create/edit/delete overlays) inserted above the existing Harvest Dashboard/Harvest Log sections.
  - Harvest Dashboard widget area restructured into labeled sub-sections: existing Today/Week/Month/Compartments tiles, new Planning (Planned/In Progress/Completed/Delayed), Planned vs Actual & Productivity, Pipeline (Harvested/Transported/Waiting/Raw Log Inventory/Consumed by Sawmill), and Today's Schedule table.
  - "Log Harvest" execution overlay gained an optional "Fulfills plan" dropdown (open plans only), wired into the `harvestCreate` payload as `plan_id`.

## Mobile (`mobile/src/...`)

- **`types/api.ts`:** added `HarvestPlan`, `HarvestPlanListResponse`; extended `HarvestDashboardResponse` with the new Phase 2 fields.
- **`api/endpoints.ts`:** added `HARVEST_PLAN_LIST`, `HARVEST_PLAN_CREATE`, `HARVEST_PLAN_UPDATE`, `HARVEST_PLAN_DELETE`.
- **`hooks/useHarvest.ts`:** added `useHarvestPlans()`, `useHarvestPlanCreate()`, `useHarvestPlanUpdate()`, `useHarvestPlanDelete()`; `useHarvestCreate` now also invalidates `harvest-plans` when a `plan_id` was submitted.
- **`navigation/types.ts`:** added `HarvestPlanList`/`HarvestPlanForm` to `HarvestStackParamList`.
- **`navigation/HarvestStack.tsx`:** registered `HarvestPlanListScreen`/`HarvestPlanFormScreen`.
- **`screens/harvest/HarvestPlanListScreen.tsx`:** new file — plan list with status/priority/delayed indicators, delete via `ReasonModal`.
- **`screens/harvest/HarvestPlanFormScreen.tsx`:** new file — dual create/edit plan form, mirrors `HarvestCreateScreen`'s pattern.
- **`screens/harvest/HarvestListScreen.tsx`:** added a "Harvest planning" header action.
- **`screens/harvest/HarvestCreateScreen.tsx`:** added an optional "Fulfills Plan" picker (create mode only), submits `plan_id`.
- **`screens/harvest/HarvestDashboardScreen.tsx`:** added Planning, Planned vs Actual, Productivity, Pipeline sections, and a Today's Schedule list.

## Not changed

- No changes to Inventory, Sawmill, Procurement, Logistics, Workshop Isolation, or approval-chain logic.
- No connection made between Harvesting and Pole Production.
- Harvesting-supervisor governance-bypass finding (carried over from Phase 1) — still documented only, not fixed.
