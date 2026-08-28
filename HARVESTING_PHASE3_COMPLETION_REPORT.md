# Harvesting Phase 3 — Field Operations, Performance & Executive Visibility
### Completion Report

**Scope:** completes operational control over Harvesting by adding real-time field visibility, performance monitoring, production analysis, and executive reporting, on top of the planning layer Phase 2 shipped. No redesign of Harvest Planning, Inventory, Logistics, Sawmill, Procurement, approval chains, or Workshop Isolation. One new table was added (`harvest_delays`) — required because delay category/duration/compartment/impact has no existing home; it is a deliberately append-only log (no edit/delete, no governance) since the brief explicitly forbids introducing a new approval workflow.

---

## 1. Active Harvest Operations (Workstream 1)

New backend function `harvestCompartmentStatus()` classifies every compartment into one of four mutually-exclusive operational buckets, computed live (nothing stored):
- **Completed** — `compartments.status = 'Completed'`.
- **Delayed** — has an associated Harvest Plan that is itself delayed (Phase 2's `is_delayed` logic, reused via `exists()`).
- **In Progress** — has at least one harvest record but isn't Completed or Delayed.
- **Waiting to Start** — Active, no harvest recorded yet, no delayed plan.

Shipped on desktop (new "Active Harvest Operations" card on the Harvesting Daily page — 4 count tiles + sortable compartment table with bucket badges) and mobile (new `HarvestOperationsScreen`, reached via a Quick Link from the Harvest Dashboard).

## 2. Production Performance (Workstream 2)

New backend function `harvestPerformance()`: volume by compartment (top 20), and daily/weekly/monthly volume trends — each a dense, zero-filled series (`generate_series`) so a bar chart never shows a misleading gap for a day with no harvest. Also returns Planned-vs-Actual volume for the current month, **Achievement %** (`actual/planned × 100`, `null` — not `0` or `100` — when no plan target exists, so the UI can distinguish "no data" from "0% achieved"), and **Variance (m³)**.

- **Desktop**: reuses the existing `_svgBar()` chart helper (the same one Executive Dashboard already uses for Harvest Production/Fuel/Sales trends) — no new charting code was written.
- **Mobile**: reuses the existing `SparklineChart` component for the daily trend.
- "Volume by species" was **not** duplicated — `dailyHarvestData`'s existing species summary already covers it (Phase 1); this phase only added what was genuinely missing (volume by compartment, time-series trends, achievement/variance).

## 3. Operational Delay Analysis (Workstream 3)

New table `harvest_delays` + `harvestDelayList()`/`harvestDelayCreate()`. Categories fixed server-side: Weather, Equipment Breakdown, Transport Unavailable, Labour Shortage, Safety Stop, Other. Records duration (hours), affected compartment (optional), and a free-text production-impact note. **Deliberately append-only** — no update or delete route, no `applyGovernance` call — matching the brief's explicit "do not introduce a new approval workflow" instruction and mirroring the existing `maintenance_production_impact` table's shape (which has the same no-edit precedent).

Shipped on desktop (new "Operational Delays" card: log form + sortable list) and mobile (`HarvestDelaysScreen` list + `HarvestDelayFormScreen` create form, reached via the same Dashboard Quick Link).

## 4. Executive Dashboard (Workstream 4)

Extended the **existing** executive-analytics screens rather than building new ones:
- **Desktop `renderExecutiveDashboard()`**: added a new panel row (Harvest Performance / Cross-Department Pipeline / Production Trend) using the page's own existing `.ex-panel`/`.ex-stat`/`_pbar()`/`_svgBar()` primitives, loaded via an additional async call so the existing, more complex `execDashboard()` backend query was never touched.
- **Mobile `CeoOverviewScreen.tsx`**: added a "Harvest Operations" KPI section (Compartment Completion %, Delayed Operations, Operational Efficiency %, Waiting for Sawmill) directly below the existing Harvest section, sourced from `useHarvestDashboard()` (already permission-safe for `ceo`, which holds `daily-harvest`) rather than modifying the CEO overview's own backend endpoint.

"Raw Log Inventory Trend" (named in the brief) is **not** a true historical trend this phase — Raw Log Inventory is a computed-not-stored live figure (Phase 1), and a real point-in-time trend would need a new daily-snapshot table. Substituted with the Production Trend (daily volume, m³) instead, and flagged below as a genuine gap for a future phase rather than silently faked.

`mobile/src/screens/reports/ExecutiveScreen.tsx` (a second, separate mobile "executive" report screen) was **not** touched — `CeoOverviewScreen` + desktop's Executive Dashboard were judged sufficient coverage for "CEO and Management dashboards," and touching a second reporting pipeline risked scope creep beyond what was asked.

## 5. Cross-Department Operational Monitoring (Workstream 5)

No new backend function — reused Phase 1/2's `pipeline` object (`logsHarvested`/`logsTransported`/`logsConsumedBySawmill`) and `transportWaiting`/`rawLogInventory`, now explicitly labeled "Waiting for Transport" / "Waiting for Sawmill (Raw Log Inventory)" / "Completed Flow" in the new Executive Dashboard panel and mobile CEO section. Purely presentation — no change to Logistics/Inventory/Sawmill's own code, confirmed by construction (nothing outside `data.js`'s Harvesting functions was touched).

## 6. UI/UX Completion (Workstream 6)

Every new table (Active Operations, Delays) uses the same sortable-column pattern (`wireSortableTable`) and badge conventions (`ba`/`bb`/`bg`/`br` classes, `emptyRowHtml()`) established in Phases 1-2, applied from the start rather than as a separate catch-up pass. New status colors (bucket badges, delay category badges) follow the same palette used everywhere else in Harvesting. Search boxes were **not** added to the two new small tables (Active Operations tops out at a handful of compartments; Delays is a low-volume log) — judged unnecessary weight for the current data volume; flagged below if that changes.

---

## Verification

**Static:**
- `node --check` passed on all touched backend/desktop files: `db/migrate.js`, `db/services/data.js`, `mobile-api/routes/harvest.js`, `electron/main.js`, `electron/preload.js`, `renderer/app.js`.
- `npx tsc --noEmit` passed cleanly across the whole mobile app.

**Live (production DB, throwaway QA data, fully cleaned up afterward):**
- Migration applied cleanly (`harvest_delays` created) — confirmed via `[migrate] harvest delays table ready`.
- `harvestCompartmentStatus()` — confirmed both real compartments classify as `inProgress` (both have historical harvest records); bucket-priority logic (Completed > Delayed > In Progress > Waiting to Start) verified by construction against the same `is_delayed` subquery already proven correct in Phase 2.
- `harvestPerformance()` — confirmed `volumeByCompartment` (2 rows), `dailyTrend` (14 points), `weeklyTrend` (8 points), `monthlyTrend` (6 points) all populate; `achievementPct`/`varianceM3` correctly `null`/`0` with no plan targets.
- End-to-end integration: created a throwaway plan with a 5 m³ target, confirmed `achievementPct`/`varianceM3` were `0`/`-5` before execution; recorded a harvest against it; confirmed `harvestPerformance()` and `harvestDashboard()` (Phase 1/2) independently agreed on the resulting `plannedVolumeM3`/`actualVolumeM3` (5 / 1.47) and `achievementPct` (29%) — two separately-written queries reconciling exactly.
- `harvestDelayCreate`/`harvestDelayList` — created and listed a throwaway delay record with a category, compartment, duration, and impact note; confirmed all fields round-tripped correctly.
- Regression check: `harvestList`, `dailyHarvestData`, `timberInventoryList` (Phase 1) all still returned `ok: true` with consistent figures throughout — no regression in the existing Harvest → Inventory hand-off.
- Purged all QA test data (1 harvest_logs row, 1 harvest_plans row) — confirmed zero rows remain matching the QA marker across `harvest_logs`, `harvest_plans`, and `harvest_delays`.

---

## Newly Discovered Issues

1. **"Raw Log Inventory Trend"** (named in the Workstream 4 brief) cannot be a true historical trend without a new daily-snapshot table — Raw Log Inventory is computed live, not stored. Substituted with a Production Trend chart this phase; flagged as a real, not-yet-built capability if a genuine historical inventory trend is wanted.
2. Both issues carried over from Phase 1/2 remain open and untouched: (a) 16 leftover `_stabtest_*` QA accounts in production `app_users`, (b) the harvesting-supervisor governance bypass on harvest record edit/delete.

---

## Recommendation for Harvesting Phase 4

Per the brief's own framing, Phase 4 is "final UI/UX and operational completion." Candidates, none started:
- Resolve the three Newly Discovered Issues above (the two carried-over items plus the Raw Log Inventory Trend snapshot table, if wanted).
- A full UI/UX consistency pass across every Harvesting screen (desktop + mobile) — this phase kept new screens consistent with existing conventions but did not re-audit Phase 1/2's screens for further polish.
- Search on the Active Operations/Delays tables if their row counts grow enough to need it.
- `ExecutiveScreen.tsx` (mobile reports) was not extended this phase — worth a look if that's a genuinely separate audience from `CeoOverviewScreen`.

**Per the brief's explicit stop rule: this phase stops here. Phase 4 is not started and will not begin without your review and approval of the above.**
