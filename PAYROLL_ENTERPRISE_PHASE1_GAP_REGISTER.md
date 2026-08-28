# Payroll Enterprise Phase 1 — Gap Register

Format matches this program's established convention: ID / Gap / Severity / Evidence /
Impact / Recommended action / Requires approval. These are **architecture/data gaps** found
while auditing the current system for Payroll reuse — distinct from the business-rule
decisions in `PAYROLL_ENTERPRISE_PHASE1_BUSINESS_RULES.md`. Nothing here was fixed; this
phase is discovery only.

---

## PR-01 — No compensation, bank/mobile-money, or tax-ID field on `app_users`

- **Severity**: Blocking (for permanent-staff Payroll specifically).
- **Evidence**: `app_users` schema (`db/schema.sql:3-15`) has no salary, payment-method, or
  national-ID-equivalent column. `casuals` has `national_id` but no payment-method field
  either.
- **Impact**: Even once a salary model is approved, there is nowhere to store the rate itself
  for permanent staff, nor a payment destination (bank account/mobile money number) for
  anyone.
- **Recommended action**: Add the approved fields once Priority 4 (Pay Structure) is
  resolved — likely as new nullable columns on `app_users`/`casuals` (matching
  `casuals.salary_per_action`'s existing precedent) rather than a new identity table, per
  Discovery Report §4.
- **Requires approval**: Yes — contingent on the pay-structure decision.

## PR-02 — `finance` role has no visibility into Attendance or Casuals pages today

- **Severity**: Medium (only matters if Finance is chosen as a Payroll approver).
- **Evidence**: `ROLE_PAGES.finance` (`db/services/data.js:125-126`) =
  `['dashboard','weekly-cost','monthly','sage','audit','export','notifications','changes',
  'procurement-dashboard','procurement-requisitions','procurement-invoices',
  'procurement-reports']` — no `attendance`, no `casuals`, no `casual-requests`.
- **Impact**: If the Business Rules register concludes "Finance approves payroll," Finance
  users would need new page permissions before they could even see the source data behind a
  payroll run, let alone approve it.
- **Recommended action**: Extend `ROLE_PAGES.finance` (and the live `role_definitions` table,
  following the exact `restoreRolePagesDrift()` precedent from a prior phase) once the
  approver decision is made — trivial, additive, no architecture change.
- **Requires approval**: Yes — contingent on the "who approves" decision (Priority 9).

## PR-03 — Zero linkage between `casual_labour_requests`, `casuals`, and `attendance`

- **Severity**: High (blocks the entire casual-worker payment chain).
- **Evidence**: Confirmed by direct code read (Discovery Report §3) — `labour_items` is an
  aggregate `{role, quantity}` array with no `casual_id` reference anywhere; `attendance`'s
  `casual_id` column links to a named individual but never back to which request (if any)
  brought them on; `casuals.salary_per_action` is stored-only.
- **Impact**: There is currently no way to answer "which specific casual worked how many
  hours/days against which approved request, at what rate" — the three pieces of information
  needed for a casual payroll line exist in three unconnected places.
- **Recommended action**: Do not build a linkage until the Casual Payment Model decision
  (Business Rules register) determines what the linkage should even be based on (attendance?
  approved request? manual supervisor sign-off?) — building the wrong linkage would be worse
  than building none yet.
- **Requires approval**: Yes.

## PR-04 — `department` is free-text on both `app_users` and `casuals`, no canonical list

- **Severity**: Low (reporting-quality issue, not a blocker).
- **Evidence**: Both columns are plain `text` with no FK, no check constraint, no
  enumeration table anywhere in the schema.
- **Impact**: A "Payroll Cost by Department" report (Priority 15) would group on whatever
  strings happen to have been typed into this field historically — likely inconsistent
  capitalization/spelling across records, since nothing enforces consistency today.
- **Recommended action**: Out of scope for Payroll to fix — this is a pre-existing HR
  data-quality condition. If department-based reporting is important, canonicalizing this
  field is its own small, separate cleanup, not a Payroll dependency.
- **Requires approval**: No — informational only, disclosed not to be silently absorbed into
  a Payroll report that would look more authoritative than the underlying data actually is.

## PR-05 — `attendanceReport` has no per-person grouping

- **Severity**: Medium (needed before Attendance can feed Payroll, even after rate rules are
  approved).
- **Evidence**: `attendanceReport`/`attendanceList` (`data.js:11449-11599`, read in full this
  phase) produce a flat row list plus one aggregate summary across the *entire* filtered
  result set — there is no `GROUP BY person_id` anywhere in either function.
- **Impact**: Payroll calculation needs "total hours/days for person X in period Y," which
  this function cannot currently answer without the caller doing its own client-side
  aggregation over up to 500 raw rows (the function's own `LIMIT 500`, which would also
  silently truncate a large workshop's full-period data).
- **Recommended action**: A future implementation phase should add a dedicated
  per-person-grouped query (either a new function or a `groupBy` option on the existing one)
  — this is mechanical, not a business-rule question, but is correctly deferred until the
  rate model that would consume its output is approved.
- **Requires approval**: No — purely technical, but sequenced after the business rules.

## PR-06 — No `hr` role exists in the permission system

- **Severity**: Low-Medium (affects Priority 9's role design, not a code defect).
- **Evidence**: `ROLE_PAGES` (`db/services/data.js`) has no `hr`/`hr-manager`/`payroll` key.
  `ATTENDANCE_ROLES = ['admin','ceo','operations','supervisor']` is the closest existing
  analog for "who manages people-data."
- **Impact**: The brief's "who prepares payroll" question has no obvious existing role to
  default to — unlike, say, Procurement (which already has `procurement-officer`/
  `procurement-manager`).
- **Recommended action**: Decide as part of Priority 9 whether Payroll preparation reuses
  `ATTENDANCE_ROLES` as-is or introduces a new dedicated role — both are small, standard
  changes once decided (a new role is just a new `ROLE_PAGES` key + `role_definitions` row,
  the same mechanical pattern used for every existing role).
- **Requires approval**: Yes.

## PR-07 — `procurement_approval_steps` is the right engine for Payroll approval, but is
  named/scoped around Procurement

- **Severity**: Informational (naming consideration, not a functional blocker).
- **Evidence**: Table name, `ENTITY_TABLE` map inside `procurementApprovalAction`, and the
  `procurement_` prefix throughout (Discovery Report §9) — despite the engine's own comment
  explicitly declaring it generic ("reused by requisitions, invoices, and payments instead of
  three copies of the same stage-advancement logic").
- **Impact**: None functionally — extending `ENTITY_TABLE` with `payroll_period:
  'payroll_periods'` works exactly like adding `po` did, regardless of the table's name. The
  only cost is a small, permanent readability tax: a developer reading
  `procurement_approval_steps` six months from now, seeing a `payroll_period` row in it,
  needs the comment to explain why.
- **Recommended action**: Reuse as-is (do not rename a heavily-referenced production table
  for cosmetic reasons — out of proportion to the benefit); add a short comment at the point
  of the `ENTITY_TABLE` extension explaining that the table is intentionally cross-module
  despite its name. No rename, no new table.
- **Requires approval**: No — this is an implementation note for whoever builds Phase 2, not
  a decision the business needs to make.

## PR-08 — No Finance/accounting module exists anywhere in this codebase

- **Severity**: High for anyone assuming Option B/C (Finance Integration) is a small task —
  informational otherwise, since Option A is the recommended default.
- **Evidence**: Zero schema matches for `finance|accounting|ledger|chart_of_accounts|
  gl_entries|journal`; "Sage Reconciliation" (`renderSage()`) is a CSV export of existing
  operational cost data, not a live accounting integration (Discovery Report §11, read in
  full this phase).
- **Impact**: Choosing Option B or C for Finance Integration would implicitly commission a
  full accounting/ledger system as a prerequisite — a project larger than Payroll itself, and
  explicitly out of this phase's and this brief's scope ("do not create a parallel ledger").
- **Recommended action**: Confirm Option A as the phase-1 decision (recommended); treat
  Option B/C as a distinct, separately-scoped future initiative if the business ever wants
  real accounting infrastructure, not a Payroll sub-task.
- **Requires approval**: Yes — this is Priority 11's core decision, restated here because it
  is also, structurally, a gap in what the codebase has to integrate with.
