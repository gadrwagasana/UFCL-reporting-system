# Phase C5 — Inventory Dashboard Drill-Down — Completion Report

Companion files: `_GAP_REGISTER.md` (every finding, classified, including the rigorous NF-01
re-assessment), `_CHANGELOG.md` (exact file-by-file diff summary).

## 1. Current Backlog Audit

Read `ERP_MASTER_PROFESSIONALIZATION_GAP_REGISTER.md` plus the C1–C4 gap registers fresh
(Priority 0). Of the original 24 P2 findings, 7 already resolved (PR-01, PR-15, PR-19,
PR-20-partial, PR-21, PR-22, PR-23). Remaining open: PR-02, PR-03–14/16 (13 export gaps),
PR-17/18, PR-20 (5 dashboards remaining), PR-24 (folded), 8 P3 items, PR-33 (business decision),
NF-01 (security finding, deferred).

## 2. NF-01 Rigorous Re-Assessment (special attention, per this phase's brief)

Investigated from scratch, not carried forward reflexively. Covered: `audit_log` schema (no
`workshop_id` column, confirmed again), `logAudit`'s definition, an enumeration of all ~239
`logAudit(...)` call sites (all in one file, `db/services/data.js`), live role→permission grants
for `'audit'` (held by several genuinely workshop-scoped roles), `isWorkshopRestricted`'s
treatment of those roles, `auditList`'s read path (zero workshop filtering, unchanged), the
generic per-record History tab mechanism (confirmed to be a separate, already-correct system —
not affected by NF-01), and mobile's Audit Log screen (identical gap, same root cause). Full
findings and reasoning in the Gap Register. **Verdict: still requires a dedicated engineering
phase** — the investigation found the fix more mechanically tractable than C4 believed (single
file, `workshop_id` already in scope at every sampled call site) but the volume (~239 sites) and
the need for a companion migration + full regression pass still make it too large and too
architecturally significant for a single-item phase. No fake/heuristic workshop filter was added.

## 3. Priority Ranking

Three candidates deep-audited against current code: **PR-20 (Inventory Dashboard drill-down)**,
**PR-02 (Customers)**, **PR-16 (Audit Log export)**. Full scoring table in the Gap Register.
PR-20 ranked highest: real daily-use business impact, zero backend risk (pure retrofit of an
already-proven pattern from Phase C2), and full live-verifiability with zero data mutation.

## 4. Selected Item

**PR-20 — Inventory Dashboard's instance of the systemic "dashboard KPI tiles aren't clickable"
finding.**

## 5. Selection Rationale

See Gap Register "Candidates audited this phase" for the full comparison. In summary: PR-02
requires *building* new backend search/filter capability (a larger scope) and current production
data volume (1 customer row) makes it lower urgency. PR-16 was re-confirmed to sit directly on
top of NF-01's still-open cross-workshop leak — shipping bulk export there now would make that
leak strictly worse (file-downloadable instead of screen-readable), so it correctly waits for
NF-01's own dedicated phase. PR-20/Inventory uniquely had a backend that was already 100% ready
(every value the tiles need is already computed by `inventoryDashboard()`) and an exact working
precedent to copy from Phase C2's CEO Overview fix.

## 6. Backend/UI Parity

| Capability | Backend | Desktop | Mobile | Permission | Workshop Isolation |
|---|---|---|---|---|---|
| KPI values themselves | `inventoryDashboard()` — pre-existing, unmodified | ✅ (pre-existing) | ✅ (pre-existing) | `inventory` permission (unmodified) | Pre-existing, unmodified |
| KPI tile → same-page filter (Total items/Value/Available/Low/Out of stock) | n/a (client-side only) | ❌→✅ | N/A — mobile has no local filter state on this screen (see §12) | inherited | n/a |
| KPI tile → cross-page navigation (In transit/Transfers pending/Material requests/Adjustments/Consumption) | n/a | ❌→✅ (`showPage`) | ❌→✅ (cross-tab `navigation.navigate`, gated per navigator) | inherited, re-verified (§13) | n/a |

## 7. CRUD

Not applicable — this is a pure navigation/filter-retrofit on a read-only dashboard. No
Create/Update/Delete/Approve/Reject exists or was added.

## 8. Search

Unchanged — the Inventory Dashboard's existing search box (`inv-search`) continues to work
exactly as before; not touched by this phase's edits.

## 9. Filters

**Extended, not replaced.** The existing `inv-status-filter` dropdown and `invState`/
`invFiltered()` logic are entirely unchanged; the new KPI tiles simply set the same state and
call the same re-render function the dropdown's own `onchange` handler already calls — verified
by reading both call sites side by side (`renderer/app.js`, `Changelog` §Desktop).

## 10. Sorting

Unchanged — `wireSortableTable($('inv-table'), invSort, invFiltered, renderInvRows)` untouched.

## 11. Pagination

Not applicable — the Inventory Dashboard's Stock Register table has no pagination (pre-existing,
out of this phase's scope).

## 12. Desktop

10 of 12 Executive KPI tiles are now clickable, each with a clear intent: 5 filter the on-page
table and scroll to it, 5 navigate to the relevant full-detail page. `Goods received` and
`Turnover` deliberately left non-interactive — no single-page filter or clean navigation target
exists for either (mirrors Phase C2's own precedent of not inventing a destination for
dimensionless tiles).

## 13. Mobile

3 of 6 KPI tiles on `StockLevelsScreen.tsx` now navigate cross-tab (In transit/Transfers pending
→ Stock Transfers, Material requests → Material Requests, Consumption → Stock Movements), each
gated live on the parent Tab.Navigator actually having that route — this screen is reused across
4 different navigators (CEO, Logistics, Operations, Storekeeper) and **CEO/Logistics have no
Material Requests tab at all**, confirmed by reading all 4 navigator files; wiring the tile
unconditionally would have produced a silent dead tap for those two roles. `Available stock` and
`Goods received` left non-interactive — this screen (unlike desktop) has no local filter state,
and the full stock list is already the same screen, immediately below the KPI grid, so there is
no separate destination to wire.

## 14. Permissions

Unchanged. Re-verified live (by reading `db/migrate.js`'s current `permissionsByRole` map, not
assumed from memory) that every role holding `'inventory'` — `admin`, `ceo`, `operations`,
`logistics`, `storekeeper`, `logistics-officer` — also holds `'stock-transfers'`,
`'stock-movements'`, and `'material-requests'`. This means no Inventory Dashboard viewer can ever
land on a permission-denied page by clicking one of the new drill-down tiles, on either platform.

## 15. Workshop Isolation

Not applicable to this phase's own change — no query logic was touched, only client-side
navigation/filtering over data the existing (unmodified) Workshop-Isolation-respecting backend
already returned. Re-confirmed `inventoryDashboard()`/`inventoryList()` were not modified.

## 16. Governance

Not applicable — no approval workflow exists or was touched on this dashboard.

## 17. Notifications

Not applicable — no notification fires from a KPI tile click; nothing to route.

## 18. Reporting

Not applicable — this phase is drill-down navigation, not a reporting surface.

## 19. Data Integrity

Not applicable — no calculation logic was touched; all KPI values are the same pre-existing,
unmodified `inventoryDashboard()` output.

## 20. Concurrency

Not applicable — pure read/navigate, no mutation, so none of the duplicate-create/race-condition
concerns apply.

## 21. Live E2E / Regression Verification

This phase touches no backend function, IPC channel, or REST route — there is no server-side
behavior to exercise via disposable QA data, unlike C1–C4. Verification performed instead:
- **Static correctness**: `node --check` clean on `renderer/app.js`; `npx tsc --noEmit` clean
  (exit 0) across the mobile project after the `StockLevelsScreen.tsx` edit.
- **Attribute round-trip bug caught pre-ship**: an initial edit used camelCase `data` keys
  (`filterStatus`/`gotoPage`), which would have silently failed to wire (`kpiTileHtml` does raw
  `data-${k}` interpolation with no case conversion, and HTML lowercases attribute names on
  parse). Caught by cross-checking the helper's own doc-comment example and Phase C2's working
  precedent, both single lowercase words; fixed to `filter`/`page` before any click-handler code
  was written.
- **Permission-parity check** (§14) — confirmed live against the current `db/migrate.js` role map,
  not assumed.
- **Nav-target existence check** — confirmed via grep that `stock-transfers`, `stock-movements`,
  `material-requests` are registered `showPage()` targets with their own existing render
  functions (unmodified).
- **Mobile navigator sibling-tab check** — read all 4 navigators (CEO, Logistics, Operations,
  Storekeeper) that render `StockInventoryStack`/`StockLevelsScreen` and confirmed which sibling
  tabs each does/doesn't have, driving the conditional `hasStockTransfers`/`hasStockMovements`/
  `hasMaterialRequests` gating rather than assuming uniform tab sets.
- **Regression**: no existing function (`invState`, `invFiltered`, `renderInvRows`,
  `wireSortableTable`, `inventoryDashboard`, `inventoryList`, `inventoryIntelligence`) was
  modified — only called, in the same way their existing callers already do.

## 22. QA Cleanup

**Not applicable — no QA data was created.** This phase's entire change surface is client-side
navigation/filtering over already-existing, already-fetched dashboard data; no database row of
any kind was created, modified, or deleted, so there is nothing to clean up and zero residue by
construction.

## 23. Remaining Gaps

4 of the original 5 remaining PR-20 dashboard instances (Executive, Procurement, Logistics,
Maintenance Officer) are still open — Inventory is now the second of six fixed (after CEO
Overview in C2). PR-02, PR-03–14/16, PR-17/18, and the P3 backlog remain open, unchanged. NF-01
remains open with a substantially strengthened investigation (see §2 and the Gap Register) but is
correctly still not fixed.

## 24. Business Decisions

**None required for the selected item.** NF-01 continues to be an engineering-design task, not a
business/pricing decision — see Gap Register for the full, upgraded reasoning. PR-33 remains the
one item genuinely blocked on a business decision, unchanged by this phase.

## 25. Production Readiness

**Inventory Dashboard is now professionally complete for drill-down navigation**, matching CEO
Overview's standard set in Phase C2. Zero backend risk, zero data-mutation surface, full
permission-parity and mobile-navigator-safety verification performed. Per the Final Stop Rule:
**not starting Phase C6**, no commit, no push.

**Files changed this phase**: `renderer/app.js`, `mobile/src/screens/stock/StockLevelsScreen.tsx`.
No backend (`db/services/data.js`), IPC (`electron/main.js`/`preload.js`), or REST
(`mobile-api/routes/*`) file touched — correctly, since nothing new needed to be computed, only
wired.
