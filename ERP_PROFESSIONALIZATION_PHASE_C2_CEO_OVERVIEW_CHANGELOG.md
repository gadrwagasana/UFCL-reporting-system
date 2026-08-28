# Phase C2 — CEO Overview Operational Excellence — Changelog

Scope: `getCeoOverview` / the "CEO Overview" page only (desktop nav id `ceo`, mobile `CeoOverview`
tab). "Executive Dashboard" (`executiveDashboard()` / nav id `executive`) is a separate,
independently-coded page confirmed NOT in scope — see the Gap Register's scoping note.

## Backend — `db/services/data.js`, `getCeoOverview(userId)`

- **Permission gate**: changed from a hardcoded `!['admin','ceo'].includes(user.role)` check to
  `!(await mustRole(user, 'ceo'))`, matching the same fix already applied elsewhere in this file
  for the identical anti-pattern. Confirmed safe: `db/migrate.js` already grants both `admin`
  and `ceo` roles the `ceo` page live (lines 138, 743), so this is strictly a widening to match
  the existing permission system (a custom role explicitly granted `ceo` via the per-user
  checkbox now actually works, as the UI already implied it should), not a behavior change for
  either existing role. Verified live with both a positive and negative case.
- **Data correctness**: added `and deleted_at is null` to the `daily_logs`, `harvest_logs`, and
  `sales_orders` queries. None of the 3 had it before — soft-deleted daily logs, harvest logs,
  and **cancelled/soft-deleted sales orders** were being counted into the CEO's monthly totals.
  Confirmed live: 4 real soft-deleted sales orders existed for the current month that the old
  query would have wrongly included in `sales.revenue`/`sales.total_orders`.
- **Performance**: converted the same 3 queries' `to_char(col,'YYYY-MM')=$1` date filters (which
  can't use a plain index) to sargable `col >= $1::date and col < ($1::date + interval '1
  month')` range predicates — same logical filter, matching the style `executiveDashboard`'s
  sibling queries already use.
- Return shape (every field name/structure) is **byte-for-byte unchanged** — both the desktop
  IPC caller and the mobile REST route's field-by-field destructuring continue to work
  unmodified.

## Desktop — `renderer/app.js`, `renderCeoOverview()`

- Replaced the local hand-rolled `kpi()` closure with the shared `kpiTileHtml()` helper on every
  tile, each with `cls:'ceo-kpi-link'` + `data-page`, wired to `showPage(el.dataset.page)` —
  every KPI is now clickable through to the real existing page that owns that data (no new
  pages, no duplicate screens): Timber Produced → Daily Timber, Poles Produced → Daily Poles,
  Trees Felled → Daily Harvest, Machine Downtime/Machines → Machine Registry, Vehicle Fleet →
  Vehicle Fleet, Active Casuals → Casual Workers, Sales Orders/Revenue → Sales Orders, Labour
  Requests → Labour Requests, Change Requests → Change Requests, Poles Purchase Requests →
  Daily Poles, Monthly Sign-off → Monthly Dashboard.
- Added the 2 tiles the backend always computed but this page never rendered: **Poles Purchase
  Requests** and **Monthly Sign-off**, both under a new "Pending Approvals" section that groups
  all 4 pending-action counters together (previously scattered across unrelated sections).
- `Machine Downtime` tile now reads the backend's own pre-computed `production.downtime_status`
  instead of recomputing the identical `>8h` threshold inline.
- Error handling: wrapped the fetch in try/catch with a retry banner (network/thrown-exception
  path, matching the Sales Orders pattern from Phase C1) and switched the `{ok:false}` path from
  a bare `.lerr` banner to `renderDenied('ceo', res.error)`, matching every comparable page.
- Loading state: lightweight skeleton card grid instead of plain "Loading…" text.

## Mobile

- **`mobile/src/hooks/useCeoOverview.ts`** — rewritten. Previously unused anywhere in the app,
  with a local type that didn't match the real backend contract. Now correctly typed against
  `CeoOverview` (`types/dashboard.ts`, already accurate) and is the hook `CeoOverviewScreen`
  actually imports.
- **`mobile/src/screens/ceo/CeoOverviewScreen.tsx`**:
  - Switched from an inline, duplicate `useQuery` to the fixed `useCeoOverview()` hook.
  - Added `onPress` navigation to every `KpiCard` with a real, reachable target in
    `CeoNavigator`'s tab list: Trees Felled → Compartments, Orders/Revenue → SalesOrders, Total
    Machines → Machines, Active Vehicles → Vehicles, Casual Labourers → CasualLabour.
  - Timber Units / Poles Units tiles deliberately left non-interactive — no production-log
    screen is mounted in `CeoNavigator` for this role on mobile at all (documented in the Gap
    Register as G-15, not invented as a new tab).
  - Added the previously-unrendered `production.entries` field as the Timber Units tile's
    subtitle.
  - The 3 existing pending-approval alert banners (poles requests, monthly approval, change
    requests → all navigate to `CeoApprovals`) were already correct and are unchanged.

## What was deliberately NOT changed

- `executiveDashboard()` / the "Executive Dashboard"/"Executive Analytics" page — confirmed a
  separate function/page, out of this phase's scope (see Gap Register scoping note).
- `monthlyApprove()`'s own separate hardcoded `user.role !== 'ceo'` gate — a different function
  than the one this phase's Priority 1 named; changing who can approve monthly reports is a
  business-rule decision, documented (Gap Register G-19), not guessed at.
- No Excel/CSV export added (page has no tabular/filterable data to export).
- No date-range or workshop filter added (backend has no param for either; adding a UI control
  with no backend support would be fake functionality).
- No new `NOTIFICATION_ROUTES` entries added on either platform — verified live that no
  notification anywhere in the codebase ever fires with a `relatedModule` this page would need
  to route (see Gap Register G-13).
- No changes to `mustRole`, `getResolvedPages`, `expandPages`, or any other shared permission
  primitive — only `getCeoOverview`'s own call site was touched.

## Verification

- `node --check` clean on `db/services/data.js`, `electron/main.js`, `electron/preload.js`,
  `renderer/app.js`.
- `npx tsc --noEmit` clean across the entire `mobile/` project (exit code 0).
- Live E2E test against production data: **12/12 checks passed** — see the Completion Report for
  the full scenario list, including a direct comparison of `getCeoOverview`'s sales/production/
  harvest totals against independent hand-written equivalent queries (confirming the
  `deleted_at`/date-range fix produces correct numbers), a negative permission test, and a live
  proof of the permission-gate bug fix using a disposable custom-role QA account (created,
  tested, then fully deleted — zero residue confirmed).
- No commit made, no push. Consistent with this session's established practice of deferring
  commits until explicitly requested.
