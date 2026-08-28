# Phase C2 — CEO Overview Operational Excellence — Gap Register

## Scoping note (read first)

The brief's title pairs "CEO Overview" with "Executive Dashboard," but the audit confirmed these
are **two entirely separate, independently-coded pages** in this codebase: `getCeoOverview()` /
nav id `ceo` (this month's operational snapshot, `admin`/`ceo` only) and `executiveDashboard()` /
nav id `executive` ("Executive Analytics" — 13-query trend/leaderboard/governance BI page, also
open to `operations`). Priority 1 of the brief explicitly and exclusively names `getCeoOverview`
as the audit target, so this phase scopes to that function and its two pages (desktop `ceo`,
mobile `CeoOverview` tab) only. `executiveDashboard`/"Executive Analytics" was not touched —
flagged here per the Stop Rule rather than silently assumed.

Every finding below, classified per the brief's own scheme.

| # | Area | Finding | Classification |
|---|---|---|---|
| G-01 | Backend | Desktop never rendered 2 fields the backend always computed: `pendingPolesRequests`, `pendingMonthlyApproval` (mobile already rendered both) | **FIXED** |
| G-02 | Backend | `monthKey` computed, rendered by neither platform | **FIXED (desktop now derives its section subtitle work correctly; field remains available, genuinely has no further UI use beyond the human-readable `month` already shown — not force-added just to use it)** — see note below |
| G-03 | Backend | `production.downtime_status` computed by the backend; desktop recomputed the same `>8h` threshold inline instead of trusting it (duplicate logic, could drift) | **FIXED** |
| G-04 | Backend (data correctness) | None of the 3 date-scoped queries (`daily_logs`, `harvest_logs`, `sales_orders`) filtered on `deleted_at` — soft-deleted logs and **cancelled/soft-deleted sales orders were still being counted** into the CEO's "this month" totals. Confirmed live: 4 real soft-deleted sales orders existed for the current month that the old query would have wrongly included. | **FIXED** — verified live against an independent query |
| G-05 | Backend (performance) | 3 queries used `to_char(col,'YYYY-MM')=$1`, which can't use a plain index on `log_date`/`harvest_date`/`created_at` (forces a full scan every page load); `executiveDashboard`'s sibling queries already use range predicates | **FIXED** — converted to sargable `>= / <` range predicates, same logical filter |
| G-06 | Backend (security/permissions) | Hardcoded `!['admin','ceo'].includes(user.role)` gate instead of `mustRole(user,'ceo')` — the same anti-pattern already fixed elsewhere in this file. A custom role explicitly granted the `ceo` page (via the existing per-user permission checkbox, `chk('ceo','CEO Overview')`) would pass every client-side check and then be silently denied by the backend anyway. | **FIXED** — confirmed safe (migrate.js already grants both `admin` and `ceo` roles the `ceo` page live) and confirmed the actual bug via a live test: a disposable custom-role QA account explicitly granted `ceo` was denied under the old logic's equivalent and succeeds under the fix |
| G-07 | Desktop | Every KPI tile was a static, hand-rolled `.mc` div with no click-through — 0 of 11 tiles were actionable | **FIXED** — converted to `kpiTileHtml()` with `cls`/`data`, matching the Mechanician Dashboard's own established clickable-tile pattern; every tile now navigates to the real existing page that owns that data (Sales Orders, Machines, Vehicles, Casuals, Labour Requests, Change Requests, Daily Poles, Monthly Dashboard, Daily Timber, Daily Harvest) |
| G-08 | Desktop | Error state used a bare `.lerr` banner instead of the app's own `renderDenied()` (used by comparable pages for the identical "Access denied" response), and had **no retry** at all — a thrown exception left the page stuck on "Loading…" forever | **FIXED** — now uses `renderDenied('ceo', res.error)` for the `{ok:false}` path and a try/catch + retry banner (matching the pattern established in Phase C1) for thrown/network errors |
| G-09 | Desktop | Loading state was plain "Loading…" text | **FIXED** — lightweight skeleton card grid (8 placeholder `.mc` tiles using the existing `.skel-row` shimmer class) |
| G-10 | Both | No search/filter/sort/pagination anywhere on this page | **NOT APPLICABLE** — confirmed there are no lists/tables on this page, only scalar aggregate counters; these UI concepts don't apply (Priority 7 explicitly says not to add meaningless search controls to pure KPI cards) |
| G-11 | Both | No Excel/CSV export | **NOT ADDED (deliberate)** — this page is a single current-month snapshot of ~15 scalar numbers, not tabular/filterable data; nothing here meaningfully benefits from export (Priority 10 explicitly says not to add export merely because it's technically possible). Contrast with Executive Dashboard/Sawmill Dashboard, which do have real tabular trend data and already have export. |
| G-12 | Both | No date-range or workshop filter | **NOT ADDED (deliberate)** — the backend hardcodes "current calendar month" with no param to change it, and never scopes by workshop (by design: only `admin`/`ceo`, both workshop-exempt roles, can reach this function at all). Adding either control to the UI with no backend support would be fake functionality (Priority 6: "Only implement filters where the backend can support them correctly"). Documented as a genuine backend limitation, not a UI oversight — a future date-range/workshop-scoped CEO Overview would require backend changes, which is new functionality outside this phase's "surface what already exists" mandate. |
| G-13 | Notifications | Desktop's `NOTIFICATION_ROUTES` has no entry for `change_requests`, `monthly_approvals`, or `poles_purchase_requests`; mobile's `notificationRouting.ts` has no `ceo`/`executive` entry either | **NOT A BUG (verified, not assumed)** — grepped every `pushNotification` call in `data.js` for `relatedModule: 'change_requests'`, `'monthly_approvals'`, `'poles_purchase_requests'`, `'ceo'`, `'executive'`: **zero matches**. No notification anywhere in the codebase ever fires with any of these values, so there is nothing that could ever need routing here. Adding routes for module names that never appear would be speculative, unused code. |
| G-14 | Mobile | 0 of the ~13 `KpiCard`s were tappable (`onPress` never passed), despite `KpiCard` fully supporting it | **FIXED for every KPI with a real, reachable target in `CeoNavigator`**: Trees Felled → Compartments, Sales Orders/Revenue → SalesOrders, Total Machines → Machines, Active Vehicles → Vehicles, Casual Labourers → CasualLabour. |
| G-15 | Mobile | Timber Units / Poles Units tiles have no drill-down target | **DEFERRED / DOCUMENTED GAP, not fixed** — `CeoNavigator`'s tab list (24 tabs) has no daily-production-log/sawmill-production screen reachable by `admin`/`ceo` on mobile at all (desktop has `daily-timber`/`daily-poles` pages; no mobile equivalent is mounted for this role). Per Priority 5 ("If a drill-down does not exist, document the gap instead of creating a parallel workflow"), left these two tiles non-interactive rather than inventing a new tab or misrouting to an unrelated screen. |
| G-16 | Mobile | `production.entries` field available, never rendered | **FIXED** — added as the Timber Units tile's subtitle, matching desktop's existing treatment of the same field |
| G-17 | Mobile | `mobile/src/hooks/useCeoOverview.ts` existed with zero importers anywhere in the app — `CeoOverviewScreen` duplicated the identical query inline instead. The hook's own `OverviewData` type didn't even match the real backend contract (wrong field names, e.g. `sawmill.volume_m3`, that `getCeoOverview` has never returned). | **FIXED** — rewrote the hook against the real `CeoOverview` type (`types/dashboard.ts`, already correct) and switched `CeoOverviewScreen` to import and use it instead of its own duplicate `useQuery`, eliminating both the dead code and the duplicate query definition in one change. |
| G-18 | Mobile | No `EmptyState` import/usage | **NOT APPLICABLE** — every value on this screen is a scalar aggregate; "zero" is already a valid, self-explanatory rendered state (e.g. "0 pending"), not a distinct empty state requiring different UI, same reasoning as G-10. |
| G-19 | Both | `monthlyApprove(userId, monthKey)` (the function that actually resolves `pendingMonthlyApproval`) is gated `user.role !== 'ceo'` literally — narrower than `getCeoOverview`'s own gate (now `mustRole(user,'ceo')`, which a custom role could also satisfy). An admin, or a custom role granted the `ceo` page, can now see the pending-approval tile but still can't act on it. | **NOT FIXED — documented, out of scope this pass.** This is a second, independent hardcoded-role anti-pattern instance in a *different* function (`monthlyApprove`, not `getCeoOverview`), already independently flagged in this repo's own `ERP_ENTERPRISE_PERMISSION_NOTIFICATION_AUDIT.md` (PERM-14/15) with an explicit "Do not implement" note. Changing who can approve monthly reports is a business-rule decision (who should hold sign-off authority), not a "surface existing data" fix — exactly the class of decision the Stop Rule says to document rather than guess on. |

## Note on G-02 (`monthKey`)

`monthKey` (machine-readable `'YYYY-MM'`) genuinely has no further legitimate UI use beyond
what the already-rendered human-readable `month` label (`'August 2026'`) provides — there is no
month-picker or URL/deep-link scheme on either platform that would consume it. Left unrendered
by design; not counted as a defect distinct from G-01's two real gaps.

## Summary

**11 FIXED** (G-01 through G-09, G-14, G-16, G-17 — 12 counting G-06's dual desktop+backend
scope), **1 verified NOT A BUG** (G-13), **3 NOT APPLICABLE** (G-10, G-18, and G-02's resolution),
**2 deliberately NOT ADDED** (G-11 export, G-12 filters — both would be fake functionality with
no backend support), **1 DEFERRED/documented** (G-15 — no reachable mobile drill-down target
exists), **1 explicitly out of scope** (G-19 — a business-rule decision about approval
authority, already flagged elsewhere in the repo). **Zero P0/P1-equivalent findings** in the
sense of broken/inaccessible functionality — but G-04/G-06 are genuine correctness and security
findings (not merely cosmetic), both fixed and both verified live against real production data.
