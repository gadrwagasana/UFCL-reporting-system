# Phase C2 — CEO Overview Operational Excellence — Completion Report

Companion files: `_GAP_REGISTER.md` (every finding, classified), `_CHANGELOG.md` (exact
file-by-file diff summary).

## 1. Executive Summary

CEO Overview (`getCeoOverview`, desktop nav id `ceo`, mobile `CeoOverview` tab) audited
field-by-field against both platforms' rendering code. Found and fixed: 2 backend-computed
fields desktop never rendered (mobile already did), a real data-correctness bug (3 of the
backend's queries never filtered soft-deleted rows — confirmed live that cancelled sales orders
were being counted into the CEO's monthly revenue figure), a real permission-gate inconsistency
(hardcoded role array instead of the permission system, confirmed via a live test that a custom
role explicitly granted the page was wrongly denied), zero clickable KPIs on either platform
despite every other comparable dashboard in the app having them, and a dead/incorrectly-typed
mobile hook. Also confirmed several things were **already correct** or **not applicable**
(notification routing, search/filter/sort, empty states) rather than assuming gaps existed.
12/12 live E2E checks passed against production data. Zero new pages, zero duplicated business
logic, zero invented KPIs.

## 2. Backend/UI Parity Matrix

| Backend field | Meaning | Desktop (before → after) | Mobile (before → after) | Drill-down | Permission |
|---|---|---|---|---|---|
| `month` | Human month label | ✅ → ✅ | ✅ → ✅ | — (label only) | gate-wide |
| `monthKey` | Machine month key | ❌ → ❌ (no legitimate use — see Gap Register G-02) | ❌ → ❌ (same) | — | gate-wide |
| `production.timber_units` | Timber units this month | ✅ → ✅ | ✅ → ✅ | none → **Daily Timber** (desktop only, see §17) | gate-wide |
| `production.poles_units` | Poles units this month | ✅ → ✅ | ✅ → ✅ | none → **Daily Poles** (desktop only) | gate-wide |
| `production.entries` | # production log entries | ✅ → ✅ | ❌ → ✅ **(fixed)** | tile-level only | gate-wide |
| `production.downtime_hours` | Downtime hours this month | ✅ → ✅ | ✅ → ✅ | none → **Machine Registry** (desktop, new) | gate-wide |
| `production.downtime_status` | Pre-computed threshold flag | ❌ recomputed inline → ✅ **(fixed, now reused)** | ✅ → ✅ | — | gate-wide |
| `harvest.trees` | Trees felled this month | ✅ → ✅ | ✅ → ✅ | none → **Daily Harvest**/**Compartments** (new, both platforms) | gate-wide |
| `harvest.logs` | Logs cross-cut this month | ✅ → ✅ | ✅ → ✅ | tile-level only | gate-wide |
| `sales.total_orders` | Order count this month | ✅ → ✅ | ✅ → ✅ | none → **Sales Orders** (new, both platforms) | gate-wide |
| `sales.revenue` | Revenue this month | ✅ → ✅ | ✅ → ✅ | none → **Sales Orders** (new, both platforms) | gate-wide |
| `machines.*` | Machine status counts | ✅ → ✅ | ✅ → ✅ | none → **Machine Registry** (new, both platforms) | gate-wide |
| `vehicles` | Active vehicle count | ✅ → ✅ | ✅ → ✅ | none → **Vehicle Fleet** (new, both platforms) | gate-wide |
| `casuals` | Active casual count | ✅ → ✅ | ✅ → ✅ | none → **Casual Workers**/**CasualLabour** (new, both platforms) | gate-wide |
| `pendingLabour` | Pending labour requests | ✅ → ✅ | ✅ (badge) → ✅ | none → **Labour Requests** (new, both platforms) | gate-wide |
| `pendingChanges` | Pending change requests | ✅ → ✅ | ✅ (banner) → ✅ | already had one (mobile); **added** (desktop) | gate-wide |
| `pendingPolesRequests` | Pending poles purchase requests | ❌ → ✅ **(fixed)** | ✅ (banner) → ✅ | already had one (mobile); **added** (desktop) | gate-wide |
| `pendingMonthlyApproval` | Monthly sign-off pending | ❌ → ✅ **(fixed)** | ✅ (banner) → ✅ | already had one (mobile); **added** (desktop) | gate-wide |

"Gate-wide" permission = `getCeoOverview`'s single all-or-nothing gate (now `mustRole(user,'ceo')`)
protects the whole payload; there is no per-field permission narrowing inside the function, by
design (only 2-3 trusted roles can call it at all).

## 3. KPI Inventory

15 substantive KPIs across Production (4), Harvest (2), Commercial (2), Operations (3), Pending
Approvals (4). All 15 already existed in the backend before this phase — none invented. 2 were
newly surfaced (desktop), 1 was newly surfaced (mobile's `entries`), 1 duplicate-logic instance
was removed (`downtime_status`).

## 4. Desktop UX

Every tile converted to `kpiTileHtml()` (clickable, `cls`+`data`) instead of a static local
closure — matches the pattern already established and proven on the Mechanician Dashboard.
Loading state upgraded from plain text to a skeleton card grid. Error state upgraded to
`renderDenied()` (matching every comparable page) plus a proper try/catch + retry banner for
thrown/network errors, which previously left the page stuck on "Loading…" forever with no
recovery path. New "Pending Approvals" section groups all 4 approval-count tiles together
(previously scattered/incomplete), directly serving Priority 4's "actionable exceptions"
requirement.

## 5. Mobile UX

Already ahead of desktop on 3 of the 4 pending-approval fields (existing alert banners). This
phase added: `onPress` navigation on 5 KPI cards that had none, the missing `entries` field, and
fixed a dead/incorrectly-typed hook (`useCeoOverview.ts`) that nothing imported and whose own
type didn't match the real backend contract. `OfflineBanner`, `LoadingState`, `ErrorState` (with
retry) were already present and correct — confirmed, not re-built. 2 tiles (Timber/Poles Units)
deliberately left non-interactive since no reachable production-log screen exists in
`CeoNavigator` for this role on mobile — documented as a gap (G-15), not papered over with a
misrouted or invented navigation target.

## 6. Search/Filter/Sort

Not applicable — confirmed there are no lists/tables anywhere on this page on either platform,
only scalar aggregate counters. Adding search/filter controls to a pure KPI-card page would be
exactly the "meaningless search controls" Priority 7 explicitly warns against.

## 7. Drill-down

9 of 11 desktop tiles and 5 of 13 mobile cards gained real navigation this phase (the gap
between the two counts is mobile's harvest-operations/planning-accuracy sub-cards, which were
already non-interactive on both platforms and out of scope — those come from `useHarvestDashboard`/
`useHarvestExecutiveExtras`, separate backend functions this phase's Priority-1 scope doesn't
cover). Every target is an existing page/screen — zero new pages or duplicate department views
were created, per Priority 5's explicit instruction.

## 8. Excel Export

Deliberately not added. This page is a single current-month snapshot of ~15 scalar numbers with
no tabular or filterable data — nothing here would meaningfully benefit from export, and adding
one "because it's technically possible" is exactly what Priority 10 warns against. Executive
Dashboard/Sawmill Dashboard, which do have real tabular trend data, already have export and were
not touched.

## 9. Notifications

Audited and verified, not assumed: grepped every `pushNotification` call in the backend for
`relatedModule` values of `change_requests`, `monthly_approvals`, `poles_purchase_requests`,
`ceo`, and `executive` — **zero matches** for any of them, on either platform. No notification
anywhere in the codebase could ever need to route to this page or its underlying approval
queues, so the apparent "missing NOTIFICATION_ROUTES entries" desktop's own audit flagged is not
actually a defect — confirmed and documented (Gap Register G-13), not fixed with unused routes.

## 10. Security

Found and fixed a real permission-gate inconsistency: `getCeoOverview` used a hardcoded
`['admin','ceo']` role-array check instead of the codebase's own `mustRole()` permission-key
system, meaning a custom role explicitly granted the `ceo` page (via the existing, already-built
per-user permission checkbox) would pass every UI-level check and then be silently denied by the
backend anyway. Fixed to `mustRole(user,'ceo')`, confirmed safe (both `admin` and `ceo` already
hold this page live per `db/migrate.js`) and confirmed live: created a disposable custom-role QA
account, granted it `ceo` via the same mechanism the admin UI uses, verified the call now
succeeds (proving the old logic would have wrongly denied it), then fully deleted the QA
account. Negative test also run: a real unrelated role (`sawmill-leader`) is correctly denied.

## 11. Workshop Isolation

Confirmed by design, not a gap: `getCeoOverview` never applies workshop scoping because both
roles that can reach it (`admin`, `ceo`) are workshop-exempt everywhere else in the app
(`isWorkshopRestricted()` explicitly excludes them). No workshop filter was added to the UI for
the same reason it wasn't added to the backend — see §6/Gap Register G-12.

## 12. Performance

Fixed a real, evidenced issue: 3 of the backend's 10 queries used `to_char(col,'YYYY-MM')=$1`
date filters, which prevent any plain index on `log_date`/`harvest_date`/`created_at` from being
used (full table scan every page load). Converted to sargable range predicates, matching the
style `executiveDashboard`'s equivalent queries already use — same logical filter, no behavior
change, verified via the live comparison test in §13. All 10 queries already ran concurrently
via a single `Promise.all` (no N+1 pattern) — confirmed, not changed.

## 13. Live Verification

Executed against production data via direct function calls (same methodology as every prior
phase). **12 of 12 checks passed**:

- `getCeoOverview` succeeds for `admin`, returns every expected field group.
- `monthKey` format and `downtime_status` enum value both valid.
- **`sales.total_orders`/`sales.revenue`/`production.timber_units`/`production.entries`/
  `harvest.trees`** each independently recomputed via a hand-written equivalent query
  (`deleted_at is null` + the same date range) and confirmed to **match exactly** — proving the
  correctness fix produces the right numbers, not just different ones.
- Confirmed **4 real soft-deleted sales orders** exist for the current month — proving the
  `deleted_at` fix is materially impactful on real data, not a no-op.
- A role with no `ceo` permission (`sawmill-leader`) is correctly denied.
- A disposable custom-role QA account, explicitly granted `ceo` via the per-user permission
  override, now succeeds — the direct proof of the permission-gate bug fix — then fully deleted
  (zero residue confirmed).

## 14. Regression Verification

`node --check` clean on every touched backend/desktop file. `npx tsc --noEmit` clean across the
entire mobile project. `getCeoOverview`'s return shape is byte-for-byte unchanged, so neither the
desktop IPC caller nor the mobile REST route's field-by-field destructuring needed any change —
confirmed both still work via the live test. No shared primitive (`mustRole`, `getResolvedPages`,
`kpiTileHtml`, `renderDenied`) was modified, only called — zero risk to any other page that uses
them. Sales Orders (Phase C1) was not touched by this phase.

## 15. Outstanding Items

3 documented, not fixed: G-15 (2 mobile tiles with no reachable drill-down target — no screen
exists to route to, not a bug to fix by inventing one), G-19 (`monthlyApprove`'s own separate
hardcoded-role gate — a business-rule decision about approval authority, already flagged
elsewhere in this repo with a "do not implement" note), and the `executiveDashboard`/"Executive
Analytics" page (confirmed a separate function/page, out of this phase's Priority-1-defined
scope).

## 16. Production Readiness

**CEO Overview is now professionally complete** against every criterion this phase's Priority
list defines: every backend-computed field is now surfaced on both platforms (or its absence is
explicitly documented with a reason), every KPI with a legitimate destination is clickable,
loading/error/retry states are consistent with the rest of the app, a real data-correctness bug
and a real permission-gate bug were found and fixed (both verified live), and nothing was
invented — no new KPIs, no new pages, no fake filters, no unused notification routes. Per the
Stop Rule: **not proceeding to Phase C3.**
