# UFCL ERP — Sawmill Phase 3: Operational Excellence & Production Management
## Completion Report

**Date:** 2026-08-06
**Scope:** Complete Sawmill department operational capabilities — production workflow completeness, processing visibility, a manager dashboard, production reporting, and desktop/mobile parity. Sawmill only — no Sales workflow expansion, no Finance redesign, no changes to other departments beyond read-only visibility.

---

## 1. Executive Summary

This phase audited every corner of Sawmill Production (backend schema, desktop, mobile) before writing any code, per the brief's own audit-then-complete structure for each workstream. Two real, confirmed gaps were found and fixed: production history was **hard-capped at 50 rows with zero search or filtering**, and there was **no operational dashboard** answering "what is happening in the sawmill today." Both are now built, reusing existing tables, existing BI forecasting functions, and existing UI components — no new inventory system, no new costing system, no duplicate production records.

A genuinely new capability — the **Sawmill Manager Dashboard** — was built once on the backend and surfaced identically on desktop and mobile: today/week/month production, recovery rate, waste, raw/finished timber availability, a 28-day production trend, production-by-product and production-by-dimension breakdowns, and three operational alerts (low raw material, production delay, unusual variance), all computed from data that already existed.

**One capability was deliberately NOT built**: a Planned/Actual/Completed/Cancelled production status workflow. The schema audit confirmed no such concept exists anywhere in `daily_logs` — every entry already represents completed, actual production (soft-delete is the only "cancelled" equivalent). Building a planning subsystem from scratch would be a genuine redesign of how Sawmill production works, which the brief explicitly prohibits ("do NOT redesign production"). This is documented as a Phase 4 candidate, not built here.

Two real bugs were found and fixed during this phase's own live verification (see §9).

---

## 2. Workstream 1 — Sawmill Production Management

**Audited**: Create/Edit/Delete all already exist and work correctly (built in Sawmill Phase 1). Production history and details display correctly per-entry (recovery %, waste %, volume). **Confirmed gap**: `dailyList` was hardcoded to `limit 50` with **no date filter, no text search, and no pagination** — a manager could not see production history beyond the most recent ~50 entries, full stop.

**Fixed**: `dailyList(userId, workshopId, filters)` now accepts optional `date_from`, `date_to`, `search` (supervisor/operators/machine, accent-insensitive), `limit` (capped at 500), and `offset`, and returns `totalCount` so the UI can show "Showing X–Y of Z" — fully backward-compatible (every existing caller passing only `(userId, workshopId)` keeps working unchanged). Desktop's Daily Timber page gained a filter bar (From/To date, search) and Newer/Older pagination controls. Mobile's Sawmill Production list gained a search bar (`ListSearchBar`, the same shared component procurement screens already use) with an accurate "no matches" vs. "genuinely empty" empty state.

**Planned/Actual/Completed/Cancelled status**: audited via `information_schema` — confirmed no status column or planning table exists for Sawmill (unlike Harvesting, which has a dedicated `harvest_plans` table from an earlier Harvesting phase). Documented as a gap, not built — see §11.

---

## 3. Workstream 2 — Timber Processing Control

Input (logs received), Output (timber units produced), Recovery % (actual volume ÷ expected volume), and Waste % were already computed per-entry (Phase 1); this phase adds the **period rollups** the brief asked for: Today/Week/Month totals for units, logs, and waste, plus a month-to-date Recovery % and Waste % — all in the new `sawmillManagerDashboard` function, using only data that already exists (`daily_logs`, `daily_log_items`). No artificial calculation was introduced — Recovery % uses the exact same `_expectedVolumeM3` formula (logs ÷ 3.4 × 50%) established in the original Sawmill Timber Entry redesign.

---

## 4. Workstream 3 — Timber Quality Information (Audit Only, No Code)

Audited the schema directly (`information_schema.columns`, `schema.sql`) for grade, quality classification, treatment status, and drying status. Findings:

| Capability | Status |
|---|---|
| Dimensions (width/height/length/diameter) | **Exists** — `products.width_mm/height_mm/length_m/diameter_mm` |
| Species | **Exists, but only upstream** — `harvest_logs.species`/`compartments.species`; never carried forward into a Sawmill production entry or the Product Catalog |
| Treatment status | **Partially exists** — `products.sub_type` (Kiln-dried / CCA-treated / Untreated) covers the *category* of treatment, but not a quality grade within it |
| Timber grade / quality classification | **Does not exist anywhere in the schema** |
| Drying status (e.g. moisture %) | **Does not exist anywhere in the schema** |

Per the brief's explicit instruction, **no fake quality data was created**. This is a genuine gap for a future phase (see §11) — implementing it would require new columns/schema, which is out of this phase's "reuse existing" mandate.

---

## 5. Workstream 4 — Sawmill Manager Dashboard

New backend function `sawmillManagerDashboard(userId, workshopId)`, one query set, reused identically by desktop and mobile:

- **Production**: Today / Week / Month units + logs + waste; 28-day daily trend chart; 12-week Timber+Poles trend **reused verbatim from `_biPredictWorkshopProduction`** (the existing BI forecasting function) — not recomputed.
- **Inventory Flow**: Raw Timber Available (reuses `_rawLogAvailableStock`, the same Phase 1 formula); Finished Timber Available (reuses the `stock_levels`/`stock_catalog` bridge from Phase 1/2).
- **Efficiency**: Recovery Rate, Waste %, both month-to-date.
- **Operational Alerts** — three types, each reusing an existing statistical pattern rather than inventing new anomaly math:
  - *Low Raw Material*: days-of-stock-remaining at the current weekly consumption rate, the same shape `_biPredictStockRunout` already uses for catalogued stock.
  - *Production Delays*: flags when no entries have been recorded in 3+ days.
  - *Unusual Production Variance*: Z-score of this week's daily average vs. the trailing period, using the same `_biZscore` helper `_biDetectFuelAnomalies` already uses.

**Desktop**: new "Sawmill Dashboard" page (`renderSawmillDashboard`), new sidebar entry, reusing the exact KPI-card/table/badge/chart markup (`_svgBar`) the Executive Dashboard already established — no new CSS, no new chart library. **Mobile**: new `SawmillDashboardScreen`, reached via a header link from Sawmill Production (same "stack push, not a new tab" pattern Phase 1 established for Timber Inventory), built from the shared `KpiCard`/`AlertBanner` components from the Enterprise UI/UX Standardization phase — no new components invented.

---

## 6. Workstream 5 — Production Reports

Rather than building 6 separate report engines, every report the brief asks for is a slice of the **same** `sawmillManagerDashboard` payload, exported as CSV via the existing `downloadCsv()` pattern (the same one every other export in this app uses):

- Production Summary → the Today/Week/Month/Recovery/Waste section.
- Production by Product → `byProduct`.
- Production by Dimension → `byDimension`.
- Production by Period → the 28-day daily trend.
- Production Efficiency Report → Recovery %/Waste % (part of Summary).
- Finished Timber Production Report → `byProduct` (units are Finished Timber pieces).

One "Export CSV" button on the new Sawmill Dashboard page produces one file containing all sections — no new report infrastructure, no new export mechanism.

---

## 7. Workstream 6 — Desktop & Mobile Parity Audit

| Area | Desktop | Mobile | Result |
|---|---|---|---|
| CRUD (Create/Edit/Delete/View) | ✓ (Phase 1) | ✓ (Phase 1) | Parity confirmed, unchanged this phase |
| Search/Filter (production list) | ✓ new this phase (date range + search + pagination) | ✓ new this phase (search) | Mobile omits a date-range picker (see §11 — deliberate, documented) |
| Dashboard | ✓ new this phase | ✓ new this phase | Same backend payload, same figures |
| Reports/Export | ✓ new this phase (CSV) | Not built | Documented gap, see §11 |
| Permissions | `sawmill-dashboard` page granted to exactly the roles that already hold `daily-timber` (admin, ceo, operations, sawmill-leader, sawmill-supervisor, supervisor) — read live from `role_definitions`, not a hardcoded guess | Dashboard link gated on the existing `timber.inventory` mobile permission (sawmill-leader, sawmill-supervisor, supervisor, logistics) | Backend/UI verified matching for both platforms |

**CEO/Operations mobile access**: those roles use `CeoNavigator`/`OperationsNavigator` (separate from the Sawmill workshop-tier navigators touched this phase) and already have an equivalent view via the Phase 2 Executive Dashboard's "Sawmill Cost & Profitability" panel plus desktop's new Sawmill Dashboard. Adding the new mobile screen to their navigators too was scoped out as unrequested surface-area growth — flagged in §11 as a quick follow-up if wanted.

---

## 8. Workstream 7 — Live Verification Results

Full verification against production data with throwaway QA data, then completely removed.

| Check | Result |
|---|---|
| `dailyList` search by supervisor name | Found the entry correctly |
| `dailyList` date-range filter | Included today's entry correctly |
| `dailyList` non-matching search term | Correctly excluded the entry |
| `dailyList` pagination metadata | `totalCount`/`limit`/`offset` all present and correct |
| Dashboard today/week/month units & logs | Exact match (8 units, 20 logs) |
| Dashboard Recovery % | Computed correctly (21.8%) |
| Dashboard Raw Timber Available | Valid, cumulative all-time figure (by design, matching Phase 1's `_rawLogAvailableStock`) |
| Dashboard `byProduct` / `byDimension` | Correctly included the QA entry |
| Dashboard production-delay alert | Correctly cleared once a fresh entry existed, correctly reappeared after QA cleanup (dynamic, not cached) |
| Audit logs | 2 rows fired (harvest + production) |
| QA cleanup | All QA rows removed; `stock_levels` confirmed back at exact pre-test baseline (0/0/0 across all 3 warehouses) |

---

## 9. Bugs Found and Fixed During This Phase

1. **`byDimension` numeric-string bug**: `daily_log_items.width_mm`/`thickness_mm` are `numeric` columns, and Postgres returns `numeric` as a string via `node-pg` — the dashboard was returning `"100.00"` instead of `100`, which would have rendered as `100.00×200.00×4m` on both desktop and mobile instead of `100×200×4m`, and would have broken any downstream numeric comparison. Caught by the live verification's own assertions (not by manual QA), fixed by wrapping in `Number(...)` at the source.
2. My own QA script initially asserted `rawTimberAvailable` should reflect only that run's harvest — incorrect assumption on my part (the figure is deliberately cumulative all-time, matching Phase 1's established `_rawLogAvailableStock` design). Caught immediately, test assertion corrected, no code change needed.

---

## 10. Production Readiness Status

**Ready for production use.** All new capabilities are additive, verified live end-to-end, and reuse the ERP's existing inventory/costing/permission/audit/notification infrastructure with zero duplication. No schema redesign, no new inventory system, no new costing system, no bypass of existing workflows.

## 11. Remaining Gaps / Deferred Recommendations

1. **Planned/Actual/Completed/Cancelled production workflow** — does not exist; building it would be a genuine schema/workflow redesign, explicitly out of this phase's scope. Recommend as a dedicated future phase if the business wants production planning (mirroring Harvesting's `harvest_plans`), not a quick add-on.
2. **Timber grade / quality classification / drying status** — confirmed absent from the schema (Workstream 3). No fake data was created. Recommend scoping this as its own phase if quality tracking becomes a business requirement — it touches Product Catalog, Sawmill Production entry, and potentially Sales.
3. **Species not carried into Sawmill Production** — `harvest_logs.species` exists but isn't linked forward to a production entry or Finished Timber item. A future phase could add this as a lightweight lookup/label without a schema redesign.
4. **Mobile date-range filter** — mobile ships text search only, not a date-range picker (avoids introducing a new native-picker dependency this app doesn't otherwise use). Desktop has full date-range + search + pagination.
5. **Mobile CSV/report export** — not built this phase (desktop has it). A straightforward follow-up if mobile export becomes a priority.
6. **CEO/Operations mobile dashboard access** — not wired into `CeoNavigator`/`OperationsNavigator` this phase (those roles already have an equivalent view via Phase 2's Executive Dashboard panel and desktop). Quick follow-up if direct mobile access is wanted for those roles specifically.

## 12. Recommendation for Next Phase

Given the above, a natural **Sawmill Phase 4** would pick one focused thread rather than another broad sweep — most likely either (a) Timber Quality/Grading (a real schema addition, needs its own scoping), or (b) closing the small mobile parity gaps in §11 (items 4–6, all quick). Recommend waiting for the business to indicate which matters more before scoping either.

---

## STOP RULE

Per the brief, Phase 3 is complete and this report + `SAWMILL_PHASE3_CHANGELOG.md` are the deliverables. **Phase 4 has not been started** and will not begin until this report has been reviewed and explicitly approved.
