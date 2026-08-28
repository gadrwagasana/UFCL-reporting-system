# Phase C5 — Inventory Dashboard Drill-Down — Changelog

Scope: PR-20's Inventory Dashboard instance from the master gap register — the Executive KPI
tiles on the Inventory Dashboard were rendered as plain, non-interactive elements despite the
shared `kpiTileHtml()` helper already supporting click targets (proven working on CEO Overview,
Phase C2). Only this item was implemented. NF-01 was rigorously re-investigated per this phase's
special-attention instruction and confirmed to still require a dedicated engineering phase — not
fixed, not silently dropped, findings substantially upgraded and documented in the Gap Register.

## Desktop — `renderer/app.js`

- `renderInventory()`'s 12-tile "Executive KPIs" block — 10 of 12 `kpiTileHtml()` calls now pass
  `cls: 'inv-kpi-link'` plus a `data: {...}` target:
  - `Total items`, `Inventory value`, `Available stock` → `data: { filter: '' }` (reset local
    status filter, scroll to table).
  - `Low stock` → `data: { filter: 'Reorder' }`; `Out of stock` → `data: { filter: 'Out of
    stock' }` — values match `procFilterBarHtml`'s own existing status dropdown options exactly.
  - `In transit`, `Transfers pending` → `data: { page: 'stock-transfers' }`.
  - `Material requests` → `data: { page: 'material-requests' }`.
  - `Adjustments`, `Consumption` → `data: { page: 'stock-movements' }`.
  - `Goods received`, `Turnover` — deliberately left unchanged/non-interactive (no clean target).
- New wiring block added after the existing `$('inv-clear').onclick` handler:
  ```js
  $('page-inventory').querySelectorAll('.inv-kpi-link').forEach(el => {
    el.onclick = () => {
      if (el.dataset.page) { showPage(el.dataset.page); return; }
      invState.status = el.dataset.filter;
      $('inv-status-filter').value = el.dataset.filter;
      renderInvRows(invFiltered());
      $('inv-table').scrollIntoView({ behavior: 'smooth', block: 'start' });
    };
  });
  ```
  Reuses the page's own pre-existing `invState`/`invFiltered`/`renderInvRows` — no new state, no
  new filtering logic, identical to what `$('inv-status-filter').onchange` already does.
- No change to `inventoryDashboard()`, `inventoryList()`, or any other backend function — every
  value shown was already computed and sent; this phase only wired existing data to existing
  click targets.

## Mobile — `mobile/src/screens/stock/StockLevelsScreen.tsx`

- Added `useNavigation` import.
- New `goToTab(navigation, tab)` helper — same untyped `as never` cross-tab navigation cast
  already established by `MechanicianDashboardScreen.tsx`'s `goToJobs`/`goToJobDetail` (this app
  has no typed composite-navigator plumbing for cross-tab jumps yet; one more narrowly-cast call
  site was judged preferable to introducing that typing for a single deep link).
- Because `StockLevelsScreen` is reused verbatim across 4 different tab navigators (CEO,
  Logistics, Operations, Storekeeper) whose sibling tabs differ — **CEO and Logistics have no
  Material Requests tab at all** — each target is only wired live if the parent Tab.Navigator
  actually has that route (checked via `navigation.getParent()?.getState()?.routeNames`), so the
  tile is a plain non-interactive card rather than a silent dead tap for those roles:
  - `In transit`, `Transfers pending` → `StockTransfers` tab, gated on `hasStockTransfers`.
  - `Material requests` → `MaterialReview` (Operations/Storekeeper's tab name) or `MaterialRequest`
    (fallback), gated on `hasMaterialRequests`.
  - `Consumption (mo)` → `StockMovements` tab, gated on `hasStockMovements`.
  - `Available stock`, `Goods received` — left non-interactive; this screen has no local status
    filter state (unlike desktop) and the full stock list is already rendered immediately below
    in the same screen, so there is no separate drill-down target to wire.

## What was deliberately NOT changed

- **NF-01 (Audit Log Workshop Isolation)** — re-investigated in depth this phase per the brief's
  explicit instruction (schema, every `logAudit` call site, permissions, consumers, mobile — see
  Gap Register). Confirmed real, confirmed more tractable than C4's quick-check suggested (all
  ~239 call sites live in one file, `workshop_id` already in scope at each), but still correctly
  classified as requiring a dedicated engineering phase rather than a partial fix this phase.
  No heuristic/fake workshop filter was added.
- **PR-16 (Audit Log export)** — deep-audited as a candidate, deliberately not selected: adding
  bulk export to a page sitting on a confirmed cross-workshop data leak would make that leak
  strictly worse (file-downloadable instead of screen-readable only).
- **PR-02 (Customers)** — deep-audited as a candidate, deliberately not selected: requires
  *building* new backend search/filter capability (larger scope than a UI retrofit) and current
  production data volume (1 row) makes it lower urgency than the Inventory Dashboard's daily-use
  audience.
- The remaining 5 PR-20 dashboard instances (Executive, Procurement, Logistics, Maintenance
  Officer — Inventory is now done) are unchanged; still open.
- No change to `invState`/`invFiltered`/`renderInvRows`/`wireSortableTable`/search/status-filter/
  CSV export — all pre-existing Inventory Dashboard capability, confirmed still working unchanged.
- No mobile navigation typing plumbing introduced beyond the single narrowly-cast helper — matches
  the existing Mechanician Dashboard precedent rather than inventing a new pattern.

## Verification

- `node --check` clean on `renderer/app.js`.
- `npx tsc --noEmit` clean across the mobile project (exit code 0).
- Permission-parity check (the mobile-navigation-equivalent of a live E2E test, since this phase
  touches no backend function): confirmed every role that holds the `'inventory'` permission in
  `db/migrate.js` (`admin`, `ceo`, `operations`, `logistics`, `storekeeper`, `logistics-officer`)
  also holds `'stock-transfers'`, `'stock-movements'`, and `'material-requests'` — so no Inventory
  Dashboard viewer can land on a permission-denied page via any of the new drill-down tiles.
- Confirmed via grep that `page-inventory`, `stock-transfers`, `stock-movements`, and
  `material-requests` are all valid `showPage()` targets already wired to their own render
  functions (pre-existing, unmodified).
- No new backend function, IPC channel, or REST route — zero data-mutation surface — so no
  disposable QA account was needed or created; nothing to clean up.
- No commit made, no push — consistent with this session's established practice.
