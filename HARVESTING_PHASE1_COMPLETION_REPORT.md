# Harvesting Phase 1 — Operational Completion (Backend + Desktop + Mobile)
### Completion Report

**Scope:** implementation phase building directly on the verified findings in `HARVESTING_ENTERPRISE_AUDIT.md`. No redesign of the confirmed operational flow (Compartment → Harvest Record → Log Transport → Raw Log Inventory (Gatare) → Sawmill Production → Finished Timber Inventory → Stock Transfer → Nyanza Workshop → Value-Added Timber Production), no changes to Workshop Isolation, no changes to approval chains, no database schema changes, and no connection made between Harvesting and Pole Production (which remains sourced exclusively via Supplier → Procurement → PO → Goods Receipt → Pole Log Inventory).

---

## 1. Complete Mobile CRUD (Workstream 1)

`harvestUpdate`/`harvestDelete` already existed in `db/services/data.js` (desktop-only, via IPC) but had no REST route and no mobile UI — mobile users could log a harvest entry but never correct or remove one.

- **Backend:** no changes — `harvestUpdate`/`harvestDelete` already use the standard `applyGovernance` pattern (matches `machinesUpdate`/`maintenanceUpdate`).
- **`mobile-api/routes/harvest.js`:** added `PUT /:id` and `DELETE /:id`, both with the standard governance-passthrough (`{ ok: true, pendingApproval: true, level, message }` when a supervisor's edit/delete needs approval, exactly as every other governed mobile route in this app).
- **Mobile:** `HarvestCreateScreen.tsx` converted to dual create/edit mode (`route.params?.entry`, pre-fills and calls `useHarvestUpdate` when present, matching the pattern established in Stabilization Phase 5). `HarvestDetailScreen.tsx` gained an Edit header action and a Delete button (`ReasonModal`-gated soft delete), both gated on `harvest.write` and offline-aware.
- `useHarvest.ts`: added `useHarvestUpdate()` / `useHarvestDelete()`.

## 2. Harvest Dashboard (Workstream 2)

New operational dashboard, desktop and mobile, backed by a single new backend function.

- **`db/services/data.js`: `harvestDashboard(userId, workshopId)`** — gated on `harvest`/`daily-harvest`/`timber-inventory`, workshop-scoped via `isWorkshopRestricted` (same as `dailyHarvestData`). Returns: `todayHarvest`, `weeklyHarvest`, `monthlyHarvest`, `logsProduced`, `volumeProducedM3`, `activeCompartments`, `completedCompartments`, `transportWaiting`, `rawLogInventory`.
- **"Active Harvest Teams" deliberately excluded** — `harvest_logs` has no team/crew/assignment concept anywhere in the schema (confirmed in the audit and again during this phase); inventing one would be a new feature, not exposing existing functionality, and the brief explicitly forbids adding new business features.
- **Desktop:** new "Harvest Dashboard" widget strip inserted into the existing Harvesting Daily page (`renderDailyHarvest` in `renderer/app.js`), loaded asynchronously via a new `harvest:dashboard` IPC handler so it doesn't block the rest of the page.
- **Mobile:** new `HarvestDashboardScreen.tsx`, reached via a new header action on `HarvestListScreen` (unconditional — read-only, available to anyone who can see the list), using the shared `KpiCard` tile component per the Enterprise Design System. `useHarvestDashboard()` hook, `GET /api/harvest/dashboard` route (30s cache hint).

## 3. Desktop/Mobile Functional Parity (Workstream 3)

Two parity gaps found and fixed inline while building Workstream 1:

- **Completed compartments were selectable on mobile** (desktop already disabled them). `HarvestCreateScreen.tsx`'s compartment dropdown now filters `.filter(c => c.status !== 'Completed' || String(c.id) === comptId)` — disabled going forward, but the currently-selected compartment stays selectable when editing an existing entry tied to one.
- **Species did not auto-fill from the selected compartment on mobile** (desktop did). Fixed in the same `onChange` handler that already auto-filled `sub_name`.

## 4. Harvest → Inventory Validation (Workstream 4)

Confirmed via live, read-only queries against production that "Finished Timber Inventory" already works correctly today: `mv_stock_summary` computes it as `daily_logs.timber_units` (produced) minus `sales_orders` (sold) — a working, pre-existing pattern entirely separate from the generic `stock_catalog` consumables system (confirmed `stock_catalog` has zero log/timber/raw-material items). Inventory remains the source of truth for finished goods; nothing here was bypassed or duplicated.

The genuine gap was **upstream** of that: nothing represented raw logs between Harvest and Sawmill intake. Fixed with zero schema changes, using a column that already existed but was unused for this purpose:

- **`timberInventoryList`** (`db/services/data.js`) gained a parallel query: `rawLogsHarvested` (`sum(harvest_logs.logs_handrolled)`) minus `rawLogsReceivedBySawmill` (`sum(daily_logs.logs_received)`) = `rawLogInventory`.
- Distinguished from the existing **"Transport Waiting"** figure (`logs_handrolled − qty_transported`, a different, earlier pipeline stage) — both are now shown as separate KPIs on the new Harvest Dashboard rather than being conflated.
- Live-verified: `harvestDashboard()`'s `rawLogInventory` (655) and `timberInventoryList()`'s independently-computed `rawLogInventory` (655) agree exactly.

## 5. UI/UX Completion (Workstream 5)

- **Search + sort added to the Harvest Log table** (`renderDailyHarvest`, desktop) — reused the existing `filter-search` markup and `wireSortableTable()` helper every other consolidated list page in the app already uses, rather than a one-off implementation.
- **Empty state** switched to the shared `emptyRowHtml()` helper (was a hand-typed `<tr>`), distinguishing "no records at all" from "no records match this search."
- **Removed dead code:** `renderHarvest()` (`renderer/app.js`), the orphaned "Harvest Tracking" page — confirmed to have no nav entry and no `page-harvest` container anywhere in the HTML, i.e. genuinely unreachable, not just unlinked. Its stale cross-reference in Timber Inventory's empty state ("Add them in the Harvest Tracking page") was corrected to point at the real page ("Harvesting Daily").

## 6. Permission Verification (Workstream 6)

- **Fixed:** Global Search's `timber` module gate excluded `daily-harvest`-only roles (e.g. `harvesting-leader`, `harvesting-supervisor`) — it checked only `mustRole(u, 'harvest')`. Changed to `(await mustRole(u,'harvest')) || (await mustRole(u,'daily-harvest'))`. Live-verified: `harv.leader` (harvesting-leader), `keza` (harvesting-supervisor), and `ceo` all now see the `timber` module in Global Search results.
- **Found, not fixed (documented, needs business confirmation):** a harvesting-supervisor's edit/delete on a harvest record appears to bypass the pending-approval governance path in at least one code path found during the audit. The brief explicitly forbids changing approval chains in this phase — left as-is and flagged here for a deliberate decision before any fix is attempted.

---

## Verification

**Static:**
- `node --check` passed on all touched backend/desktop files: `db/services/data.js`, `mobile-api/routes/harvest.js`, `electron/main.js`, `electron/preload.js`, `renderer/app.js`.
- `npx tsc --noEmit` passed cleanly across the whole mobile app (exit code 0).

**Live (production DB, read-only checks + one throwaway QA record, fully cleaned up afterward):**
- `harvestDashboard(1)` and `timberInventoryList(1)` called directly — both returned real figures, and their independently-computed `rawLogInventory` values matched exactly (655 = 685 − 30).
- End-to-end mobile CRUD verified against the live backend functions the new routes call: created a throwaway harvest log (`QA-TEST Harvest Phase1 verification`, compartment "Block A"), edited it via `harvestUpdate`, soft-deleted it via `harvestDelete` (confirmed it disappeared from the active list), then hard-purged the trashed row directly (`delete from harvest_logs where id = 5 and notes like 'QA-TEST Harvest Phase1%'`) so no test data remains.
- `globalSearch()` called for `harv.leader`, `keza`, and `ceo` — all three now return the `timber` module, confirming the permission fix live.
- IPC (`harvest:dashboard` in `electron/main.js` + `preload.js`) and the mobile-api route table (`GET /dashboard` correctly registered as a static route with no conflict against `/:id`) read back and confirmed correctly wired.

---

## Newly Discovered Issues (not part of this phase's fix scope)

1. **Leftover QA test accounts from prior Stabilization phases were never cleaned up** — found 16 `_stabtest_*` accounts (ids 110–125, spanning Phases 1 through 5) still live in production `app_users`. Not touched this phase (out of scope, and deleting another phase's test data unilaterally without confirming it's safe to remove felt like the wrong call). Recommend a deliberate cleanup pass, confirmed with you first.
2. **Harvesting-supervisor governance bypass** (Workstream 6, above) — needs a business decision before any fix, since the brief forbids touching approval chains this phase.

---

## Recommendation for Harvesting Phase 2

Candidates, none started:
- Resolve the two Newly Discovered Issues above.
- Decide whether `harvest_logs`/compartments should gain a real team/crew concept (would make "Active Harvest Teams" a real, implementable metric rather than a deliberately-omitted one).
- Extend the Workstream 5 UI/UX patterns (search/sort, `emptyRowHtml`) to Log Transport and Compartments pages, which don't have them either.
- Broader Raw Log Inventory reporting (trend over time, per-compartment breakdown) now that the underlying figure exists.

**Per the brief's explicit stop rule: this phase stops here. Phase 2 is not started and will not begin without your review and approval of the above.**
