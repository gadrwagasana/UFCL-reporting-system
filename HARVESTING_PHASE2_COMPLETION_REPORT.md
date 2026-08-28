# Harvesting Phase 2 — Operational Planning & Execution
### Completion Report

**Scope:** extends Harvesting with planning, execution monitoring, and production management, on top of the operational foundation `HARVESTING_PHASE1_COMPLETION_REPORT.md` shipped. No redesign of Inventory, Sawmill, Procurement, Logistics, Workshop Isolation, or approval chains; no duplicated functionality. One new table was added (`harvest_plans`) — required because "Planned date / compartment / volume / logs / species / priority / status" has no home in any existing table, but everything downstream of it reuses existing services (`applyGovernance`, `mustRole`, `isWorkshopRestricted`, `compartments`, `harvest_logs`) exactly as Phase 1 did.

---

## 1. Harvest Planning (Workstream 1)

New table `harvest_plans` (migration in `db/migrate.js`, `createHarvestPlanningTables()`): planned date, compartment, species, target volume (m³), target logs, priority, status, notes. Reuses the existing `harvest`/`daily-harvest` page permissions — no new permission was added.

- **Status** is a stored enum: `Planned → In Progress → Completed`, or `Cancelled`. **"Delayed" is deliberately not a stored status** — it's computed at read time (`status not in (Completed, Cancelled) AND planned_date < today`), the same computed-not-stored convention Phase 1 used for Transport Waiting/Raw Log Inventory, so a plan can never get stuck in a stale Delayed state after being caught up.
- **"Planning feeds Harvest Records"**: an additive, nullable `harvest_logs.plan_id` column links an execution record back to the plan it fulfils. Recording a harvest against a plan automatically advances it — `Planned → In Progress` on first execution, `→ Completed` once actual output reaches whichever target (volume or logs) was set. Unplanned/ad hoc harvesting (`plan_id` omitted) works exactly as it did before this phase.
- Full CRUD: `harvestPlanList/Create/Update/Delete` in `data.js`, governed by `applyGovernance` on edit/delete (identical pattern to `harvestUpdate`/`harvestDelete`).
- **Desktop**: new "Harvest Planning" card on the Harvesting Daily page — search, click-to-sort columns, status/priority badges, create/edit/delete overlays. The existing "Log Harvest" execution overlay gained an optional "Fulfills plan" dropdown (open plans only).
- **Mobile**: new `HarvestPlanListScreen`/`HarvestPlanFormScreen` (dual create/edit, mirrors the pattern `HarvestCreateScreen` already established in Phase 1), reached from a new header action on `HarvestListScreen`. `HarvestCreateScreen`'s execution form gained the same optional "Fulfills Plan" picker as desktop, create-mode only.

## 2. Daily Harvest Execution (Workstream 2)

Rather than a separate screen, execution status is surfaced directly on the Harvest Dashboard's new **Planning** section — Planned / In Progress / Completed / Delayed counts, computed live from `harvest_plans`. This gives Harvest Leaders the requested "planned vs. in-progress vs. completed vs. delayed" view without duplicating the Harvest Planning list itself.

## 3. Progress Monitoring (Workstream 3)

Extended `harvestDashboard()` with:
- **Planned vs Actual** (current month): volume (m³) and logs, plan targets vs. `harvest_logs` actuals.
- **Daily / Weekly / Monthly Productivity** (m³) — same period windows Phase 1's Today/Week/Month trees figures already use, expressed in volume.
- Completed/Active ("Remaining") Compartments were already on the Phase 1 dashboard — reused, not duplicated.

Shipped on both desktop (new dashboard sub-sections) and mobile (`HarvestDashboardScreen`'s new "Planning", "Planned vs Actual", "Productivity" sections).

## 4. Operational Dashboard (Workstream 4)

`harvestDashboard()` now returns, alongside Phase 1's figures: `planningSummary`, `todaysSchedule` (today's plans, most urgent first), `dailyProductivityM3`/`weeklyProductivityM3`/`monthlyProductivityM3`, `plannedVolumeM3`/`actualVolumeM3`/`plannedLogs`/`actualLogs`, and `pipeline`. All reuse the existing `KpiCard`(mobile)/`.mc` tile (desktop) components — no new dashboard-widget component was built.

"Production Trend" and "Harvest Performance" (named in the brief) are represented by the Planned-vs-Actual + Productivity figures above rather than a separate trend chart — no charting component exists anywhere else in Harvesting to reuse, and building one would be new infrastructure, not exposing existing functionality.

## 5. Cross-Department Visibility (Workstream 5)

New `pipeline` object on the dashboard: `logsHarvested` (hand-rolled) → `logsTransported` (picked up by Log Transport) → `transportWaiting`/`rawLogInventory` (Phase 1 figures, unchanged) → `logsConsumedBySawmill` (was already computed internally for the Raw Log Inventory formula but never exposed — now surfaced directly). A user can now see the full Harvest → Transport → Inventory → Sawmill funnel in one place on both platforms, without visiting three different pages. Purely additive visibility — no change to Logistics, Inventory, or Sawmill's own code.

## 6. Desktop/Mobile Completion (Workstream 6)

The Harvest Planning table/list was built with the full toolkit from day one on both platforms — search, sort (desktop `wireSortableTable`/`emptyRowHtml`), status badges (`StatusBadge` on mobile, `ba`/`bb`/`bg`/`br` badge classes on desktop, both reused unmodified), priority tags — so there was no separate "catch-up" pass needed the way Phase 1 required one. Reviewed both platforms side by side for terminology/action parity (New Plan/Edit/Delete, status labels, priority labels) — consistent.

---

## Verification

**Static:**
- `node --check` passed on all touched backend/desktop files: `db/migrate.js`, `db/services/data.js`, `mobile-api/routes/harvest.js`, `electron/main.js`, `electron/preload.js`, `renderer/app.js`.
- `npx tsc --noEmit` passed cleanly across the whole mobile app.

**Live (production DB, throwaway QA data, fully cleaned up afterward):**
- Migration applied cleanly (`harvest_plans` created, `harvest_logs.plan_id` added) — confirmed via `[migrate] harvest planning tables ready`.
- Created two throwaway plans: one due today with a small target, one with a past `planned_date` still in `Planned` status. Confirmed `is_delayed` computed correctly (`false`/`true` respectively) and `planningSummary`/`todaysSchedule` reflected them.
- Recorded a harvest execution against the today plan below target → confirmed status auto-advanced `Planned → In Progress`. Recorded a second execution reaching target → confirmed `In Progress → Completed`, and that `harvestDashboard()`'s `planningSummary`, `plannedVolumeM3`/`actualVolumeM3`/`plannedLogs`/`actualLogs`, productivity figures, and `pipeline` all updated consistently with the new data.
- Edited a plan via `harvestPlanUpdate` (direct-write path, non-supervisor) and deleted it via `harvestPlanDelete` (soft delete) — confirmed it disappeared from the active list.
- Purged all QA test data (2 harvest_logs rows, 2 harvest_plans rows) — confirmed zero rows remain matching the QA marker.
- No regression checked: `harvestList`/`dailyHarvestData`/`timberInventoryList`/Phase 1's Raw Log Inventory figures were exercised as part of the above and returned consistent numbers throughout — Inventory hand-off (Phase 1's Workstream 4 finding) remains untouched and correct.

---

## Newly Discovered Issues

None new this phase. The two items flagged at the end of Phase 1 remain open and unaddressed here (out of this phase's scope):
1. 16 leftover `_stabtest_*` QA accounts from prior Stabilization phases, still in production `app_users`.
2. Harvesting-supervisor governance bypass on harvest record edit/delete — still not fixed, brief again did not authorize touching approval chains.

---

## Recommendation for Harvesting Phase 3

Candidates, none started:
- Resolve the two carried-over Newly Discovered Issues above.
- A real time-series "Production Trend" widget (would need a small new read-only endpoint — e.g. last 7/30 days of volume — no schema change) if a chart is genuinely wanted beyond the current Planned-vs-Actual/Productivity figures.
- Bulk plan creation (e.g. a week's worth of plans in one action) if planning volume grows enough to make one-at-a-time creation a bottleneck.
- Extend the "Fulfills plan" link to Log Transport (currently only Harvest Records link back to a plan) if transport-level plan tracking becomes a real need.

**Per the brief's explicit stop rule: this phase stops here. Phase 3 is not started and will not begin without your review and approval of the above.**
