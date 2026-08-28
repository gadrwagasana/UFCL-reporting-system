# Payroll Enterprise Phase 3 — Completion Report

**Companion files**: `PAYROLL_ENTERPRISE_PHASE3_CHANGELOG.md` (full file-by-file diff),
`PAYROLL_ENTERPRISE_PHASE3_GAP_REGISTER.md` (outstanding items),
`PAYROLL_ENTERPRISE_PHASE3_UI_CRUD_MATRIX.md` (the requested operation-by-operation matrix).

This phase builds on Phase 1 (discovery) and Phase 2 (implementation, 50/50 live-verified). Its
job was to audit the existing Payroll capability for genuine UI/backend gaps and add
professional search/filter/sort/Excel export/dashboard UX — not to redesign the business logic,
approval engine, or Workshop Isolation, all of which remain exactly as Phase 2 built them.

## 1. Executive Summary

The audit found 15/16 backend capabilities already had working, correctly-gated UI on desktop
(mobile deliberately narrower, by design — see §11). It found **two real, previously-undetected
bugs** — one a genuine Workshop Isolation gap, one a data-correctness bug affecting every date
shown anywhere in Payroll — both fixed and live-verified. It then added search, filter,
server-side sort, and real `.xlsx` Excel export (6 report types, filter-aware) to both
platforms, reusing the existing reporting framework, approval engine, and UI component
patterns throughout. 75/75 new live E2E assertions passed against production, including
actually opening and inspecting the generated Excel files cell-by-cell — not just confirming an
export button exists.

## 2. UI/Backend Parity Audit (Priority 1)

Every Payroll backend function (26 total) was checked against desktop UI, mobile UI, REST,
IPC, permissions, and actual end-user reachability. Full detail in the UI/CRUD Matrix. Summary:
25/26 already had complete UI coverage from Phase 2. The one gap — Excel export not existing at
all — is this phase's primary deliverable, now closed. No backend function is UI-unreachable
without documentation (rate-setting/period-creation/calculation/adjustment-creation remain
desktop-only by explicit design, disclosed in Phase 2's own changelog and re-confirmed here).

**Two real defects found and fixed during this audit** (not from the brief — found by tracing
every function's actual behavior, not just checking a button exists):

- **Workshop Isolation gap in `payrollLineList`**: reachable directly via IPC
  (`payroll:lineList`) and REST (`/periods/:id/lines`), this function never verified the
  period's workshop ownership itself — only `payrollPeriodDetail` (which calls it internally)
  did. A workshop-restricted user calling it directly with a foreign period's id would have
  received that period's payroll lines. Fixed by adding the same `isWorkshopRestricted` check
  every other Payroll function already has, live-verified with two negative-access tests
  (a no-permission role and a same-permission-different-workshop role, both correctly denied).
- **Date-formatting bug affecting every displayed period/attendance date across the entire
  module**: `pg` returns PostgreSQL `date` columns as JS `Date` objects (confirmed live — no
  custom type parser is registered anywhere in this codebase), but `payrollPeriodList`,
  `payrollPeriodDetail`, `payrollLineDetail`, and the attendance-fetch helper all returned
  these raw, unlike every other date-carrying query elsewhere in this codebase (which
  consistently uses `to_char(...)` for exactly this reason — e.g. `casual_labour_requests`'
  own `start_fmt`). Left raw, a period's dates would have rendered as a garbled, timezone-shifted
  string on desktop (`Date.toString()`) and a full ISO datetime on mobile/Excel, in every
  period list, detail view, notification, and export — since the JS environment interprets a
  `date` column as a local-midnight `Date`, converting it naively (e.g. via `.toISOString()`)
  would have shifted the calendar date backward by a day in any positive-UTC-offset timezone.
  Fixed at the SQL layer with `to_char(col,'YYYY-MM-DD')` for every user-facing SELECT, plus a
  small `_fmtLocalDate()` helper (using local, not UTC, date getters — critical to avoid the
  same off-by-one-day bug) for the handful of places a period object sourced from the internal
  `_payrollPeriodGet` helper gets embedded into notification bodies/audit text. Live-verified:
  an Excel cell's date value now round-trips correctly (`2020-09-01` in, `2020-09-01` out).

## 3. Search (Priority 2)

`payrollPeriodList` gained a `search` param (case-insensitive `ILIKE` partial match against
workshop name and notes — the only free-text fields a period actually carries; no invented
field). `payrollLineList` gained a `search` param (person name). Both server-side, both
workshop-isolation-preserving (search is applied as an additional `AND`/`WHERE` condition on
top of the existing scope filter, never bypassing it). Desktop: debounced search inputs on both
the Periods list and the Lines table. Mobile: a search field on the Periods list. Live-verified:
a search term correctly includes matching records and excludes non-matching ones.

## 4. Filtering (Priority 3)

Periods: status filter (the only meaningful period-level categorical field). Lines: person-type
filter (Employee/Casual — the only categorical field lines carry beyond status, which is
already visible via the badge). No invented fields — both filters use columns that already
exist. Desktop: dropdowns (periods) and a select (lines). Mobile: horizontal filter chips
(a new, lightweight pattern for this codebase — no prior local-list-filter-chip precedent
existed to copy verbatim, so this reuses the existing theme tokens/spacing/typography but is a
new composite; disclosed, not silently invented). Live-verified: status filter returns only
matching rows.

## 5. Sorting (Priority 4)

Periods: server-side sort (`sort_by`/`sort_dir`, fixed column allowlist — never raw user input
in `ORDER BY`, matching this codebase's existing convention) across period start/end, status,
workshop, total net, line count, created date. Desktop exposes this via a sort-by dropdown +
direction toggle; mobile via tappable sort chips that cycle direction on repeat tap. Lines:
client-side sort via `wireSortableTable` (the exact same shared helper other list pages in this
codebase already use for a small, bounded-per-period dataset) on clickable column headers —
server-side sort was judged unnecessary here since a period's line count is inherently small
(one row per person in scope), matching the brief's own "prefer server-side sorting where
datasets are large" guidance by choosing the lighter mechanism where the dataset genuinely
isn't large. Live-verified: both period and line sort queries execute correctly.

## 6. Excel Export (Priority 5)

**No `.xlsx`-capable library existed anywhere in this codebase** (checked before adding one, per
the brief's instruction) — `exceljs` was added as a new dependency (root `package.json` *and*
`mobile-api/package.json`, since `data.js` runs inside both the Electron main process and the
standalone mobile-api Express server, which have independent `node_modules` trees). One
transient advisory (`exceljs`'s `uuid` dependency, moderate severity, buffer-bounds-check
issue only reachable if a buffer is explicitly passed to uuid generation — not something this
integration does) was evaluated and accepted rather than downgrading to an old `exceljs`
release; disclosed in the Changelog.

6 export types, all reusing the exact Phase 2 report/list functions (`payrollPeriodList`,
`payrollLineList`, `payrollSummaryReport`, `payrollAdjustmentsReport`, `payrollPeriodDetail`'s
`approvalSteps`, `payrollWorkshopSummary`) — no second calculation engine, purely formatting via
one shared `_payrollBuildExcelBuffer()` helper. Every generated file has: a bold title row, a
"Generated: <timestamp>" line, an "Filters: ..." line when a search/status/type/sort was
applied, a styled header row, frozen header row (`views: [{state:'frozen'}]`), auto-filter,
sensible column widths, and correct number formats (`#,##0.00` for money/quantity columns).
Desktop: base64-encoded over IPC, decoded to a `Blob`, downloaded via the exact same
`Blob→ObjectURL→anchor-click` mechanism `downloadCsv()` already uses (no new download code
path). Mobile: a genuinely new binary REST route (`GET /api/payroll/export/:reportType`,
raw `.xlsx` response — the same "exception to the JSON envelope" class
`supplierDocuments.js`'s file route already established), downloaded via the existing
`downloadFile()` + `expo-sharing` "write, then share" pattern `SageScreen.tsx`/`useSrm.ts`
already use.

## 7. Filtered Excel Export (Priority 6)

Every export call receives the exact same `search`/`status`/`person_type`/`sort_by`/`sort_dir`
params the on-screen list was fetched with — never a silently-broader unfiltered dump. The
generated file's own "Filters: ..." line documents this inside the spreadsheet itself, so a
recipient of the file (who never saw the screen) can still tell what it represents.
Live-verified: filtering a lines export to `person_type=casual` produced a file with exactly 1
data row (not the full 2), and that file's own filter-summary line correctly says "Casual."

## 8. Dashboard UX (Priority 7)

6 tiles on the main Payroll page, all direct aggregations of the already-fetched period list
(status-bucket counts, sum of total net, sum of line counts) — no invented financial metric, no
figure that isn't already independently visible in the table below it.

## 9. Payroll Detail Experience (Priority 8)

Unchanged in structure from Phase 2 (already covered Employee identity/rate, Payroll
period/calculated/adjustments/final amount/status, Governance submitted-by/stages/decisions/
reasons/dates, Audit history via the approval timeline) — this phase's improvement was
**component reuse**: the hand-rolled approval-timeline table was replaced with
`procApprovalStepsHtml()`, the exact same shared renderer Procurement's own approval UI already
uses (current-stage highlighting, consistent status badges), rather than maintaining a second,
slightly different implementation.

## 10. Adjustment UX (Priority 9)

Unchanged from Phase 2 — already showed type/amount/reason/creator/approval-status and required
a reason to create one. Verified still correct this phase (live-tested again as part of the
E2E run). No gap found.

## 11. Approval UX (Priority 10)

Unchanged from Phase 2 — reuses `procurement_approval_steps` exclusively, current
stage/pending-approver/decision/return-reason/history all displayed. This phase's only change
was the `procApprovalStepsHtml()` reuse noted in §9, which improves the *visual* presentation
(consistent badges, "Current" highlighting) without touching the underlying engine or workflow.

## 12. Notifications (Priority 11)

Verified end-to-end, not rebuilt: all 4 workflow events (submitted/approved/rejected-or-
returned/closed) fire correctly (confirmed via the Phase 2 live test's audit-trail check, still
valid), route correctly on both platforms (`'payroll'` key added to both `NOTIFICATION_ROUTES`
registries in Phase 2), and — because routing is deliberately page-only (no per-record open
function; a notification opens the Payroll Periods list, not a direct link into a specific
record) — a deleted or closed period can **never** cause a broken/crashing notification link
by construction: there is no per-id fetch in the routing path to 404 on. This is a structural
guarantee, not something that needed a new "graceful failure" code path.

## 13. Mobile/Desktop Parity (Priority 12)

| Capability | Desktop | Mobile | Note |
|---|---|---|---|
| View periods (search/filter/sort) | Yes | Yes | Full parity |
| View period detail + approval timeline | Yes | Yes | Full parity |
| View line detail + adjustments | Yes | Yes | Read-only on mobile |
| Approve/Reject/Return | Yes | Yes | Full parity — same shared engine |
| Excel export (periods, lines) | Yes | Yes | Mobile via share sheet instead of direct download |
| Excel export (summary/adjustments/approval/workshop) | Yes | No | See Gap Register PH3-01 |
| Rate setting | Yes | No | Deliberate, unchanged from Phase 2 |
| Period create/calculate | Yes | No | Deliberate, unchanged from Phase 2 |
| Adjustment creation | Yes | No | Deliberate, unchanged from Phase 2 |

## 14. Responsive/Professional UX (Priority 13)

No new design system introduced. Every new control (search inputs, filter dropdowns/chips,
sort toggles, dashboard tiles, Excel buttons) reuses this codebase's existing CSS classes
(`.fg`, `.bs1`/`.bp1`/`.appbtn`, `.mc`/`.mclbl`/`.mcval`, `.dt` tables) on desktop and existing
theme tokens (`Colors`/`Spacing`/`Typography`/`Radius`/`Shadow`) plus existing components
(`AppHeader`, `LoadingState`, `ErrorState`, `EmptyState`, `StatusBadge`, `ReasonModal`) on
mobile.

## 15. Performance (Priority 14)

Period search/filter/sort are server-side (no full-table client load). Line search/sort are
client-side but operate on an already-fetched, inherently-small per-period dataset (no
additional round-trips introduced). No N+1 query pattern was introduced — every export reuses
a single existing report-function call. Workshop Isolation was not weakened anywhere for
performance (the newly-added search/filter conditions are `AND`-combined with the existing
scope filter, never a replacement for it — confirmed by code inspection and the isolation
tests in §16).

## 16. Live E2E Verification (Priority 16)

Disposable QA data (a QA casual worker, QA attendance records, QA rates, one full period
lifecycle, a disposable QA supervisor account for the isolation test), full production
database. **75/75 assertions passed**, covering: create→attendance→calculate→adjustment→
submit→2-stage approve→reports→all 6 Excel exports (generated *and* opened *and* inspected)→
close→historical view; search/filter/sort correctness; the Workshop Isolation fix specifically
(both a no-permission role and a same-permission-different-workshop role denied, calling
`payrollLineList` *directly*, not just through the already-protected detail screen);
closed-period protection; duplicate-action rejection (double-close, double-approve both
correctly rejected); unauthorized export attempts. All QA data removed afterward;
independently re-verified at zero residue across periods/lines/adjustments/rates/attendance/
the QA casual/the QA supervisor account/approval steps. `audit_log` entries from the test
remain permanently, by design (the database's own immutable-audit rule) — disclosed, not
deleted, matching this program's established precedent.

## 17. Excel File Verification (Priority 18)

Every export in the live test was **actually written to disk and re-opened with `exceljs`**,
not just confirmed to return `ok:true`. Verified per file: it opens without error; the header
row is at the correct position and reads the expected column names; a known data row matches
the expected value (including, after the date-bug fix, a literal `2020-09-01` string — not a
Date-shifted value); the frozen-header and auto-filter properties are present; row counts match
expectations exactly (no duplicates, none missing) for both the full and the filtered exports;
the applied-filter line is present in the file itself when a filter was active. Temporary local
`.xlsx` files were deleted after inspection.

## 18. Regression Verification (Priority 19)

7/7 read-only checks passed: `attendanceList`, `attendanceDashboard`, `casualsList`,
`casualLabourRequestsList` all still function; `procurement_approval_steps` remains correctly
queryable for a non-payroll entity type (`requisition`) with its own stage rows intact — direct
confirmation that Phase 2's additive-only extension of `procurementApprovalAction` still holds
zero behavioral change for Procurement; the `notifications` table holds entries across
`payroll`/`attendance`/`governance` `related_module` values with no key collision; a
representative non-payroll Workshop-Isolation-scoped function (`stockItemsList`) still works
correctly. No unrelated module was modified this phase.

## Outstanding Items

See the Gap Register for the full list (PH3-01 through PH3-03) — none are blocking. The
largest is PH3-01 (mobile Excel export limited to 2 of 6 report types, by scope/time rather
than technical limitation).

## Production Readiness

Search, filter, sort, and Excel export are production-ready and live-verified on both
platforms. The two bugs found this phase (Workshop Isolation gap in `payrollLineList`, the
date-formatting bug) are fixed and re-verified; no other regression was found. As with Phase 2,
the underlying compensation model remains intentionally rate-driven and human-entered — this
phase changed nothing about that, invented no financial/statutory rule, and did not touch the
approval engine's design.

**Recommended next steps**: (1) if desired, extend mobile Excel export to the remaining 4
report types (PH3-01 — a mechanical extension of the existing pattern, not a new feature); (2)
proceed with the still-open Phase 1 business-rule decisions (rate models actually used,
overtime, statutory handling, real approval hierarchy) — unrelated to this phase's UI work and
still the actual blocker on using Payroll for real compensation.

Per the Stop Rule: no other department was started, no business/financial rule was invented,
Workshop Isolation was not redesigned (only closed a gap in one function using the existing
pattern), and nothing was committed or pushed.
