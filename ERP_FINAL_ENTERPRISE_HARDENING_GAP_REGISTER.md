# ERP Final Enterprise Hardening & HR Completion Phase — Gap Register

Format: ID / Capability / Severity / Backend / Desktop / Mobile / Permission / Isolation /
Business impact / Recommended action / Requires approval.

---

## FH-01 — Attendance → Casual Labour Hours calculation

- **Capability**: Automatic conversion of Attendance check-in/check-out records into a
  payable "Casual Labour Amount" (Hours Worked → rate → amount).
- **Severity**: Blocked — not a code defect, a missing business decision.
- **Backend**: `attendance` table (`db/migrate.js:3143`) has **no rate-bearing columns at
  all** — no `hourly_rate`, `daily_rate`, `regular_hours`, `overtime_hours`, or any derived
  amount column. `casuals.salary_per_action` (`db/schema.sql:709`) is the only
  compensation-shaped field anywhere near this feature, but it is never read by any
  calculation — it is stored/edited via `casualsCreate`/`casualsUpdate`/`casualsList` only
  (confirmed by grep: every reference to `salary_per_action` in `data.js` is CRUD, none is
  arithmetic). Its own name — "per **action**," not "per hour" — actively suggests a
  piece-rate/task-rate model, which would directly contradict an hourly-attendance-based
  calculation if one were built without asking. `casual_labour_requests` (a separate,
  pre-existing table/workflow) is a staffing **request** ("we need N casuals for task X"),
  not a payment calculation, and has no rate fields either.
- **Desktop / Mobile**: N/A — nothing to build until the rule is approved.
- **Permission**: N/A.
- **Isolation**: N/A.
- **Business impact**: None yet — no calculation exists to be wrong. The risk is entirely in
  the *next* phase: if a calculation is built on a guessed rule, it produces real financial
  numbers a supervisor could act on (approve payment) without them being contractually
  correct.
- **Recommended action**: Do not implement. The following business rules must be confirmed
  before any calculation code is written (per the brief's explicit list, cross-checked
  against what the current schema can and cannot represent):

  | # | Rule needed | Currently defined? |
  |---|---|---|
  | 1 | Regular hours per day (e.g. 8h) | No |
  | 2 | Overtime threshold and multiplier | No |
  | 3 | Partial-day handling (pro-rate vs. fixed Half Day amount) | No — `status='Half Day'` exists but carries no fraction |
  | 4 | Unpaid breaks deducted from `check_out - check_in`? | No |
  | 5 | Late-arrival policy (grace period, deduction) | No |
  | 6 | Early-departure policy | No |
  | 7 | Weekend/holiday rate multiplier | No — `status='Off Day'` exists but no rate distinction |
  | 8 | Minimum payable hours per marked day | No |
  | 9 | Maximum payable hours per day | No |
  | 10 | Rounding rule (nearest 15 min? nearest hour?) | No |
  | 11 | Hourly vs. daily rate model | No — and `salary_per_action`'s naming actively suggests a **third** model (piece-rate) may be the real intent |
  | 12 | Rate varies by job_role/department/category? | `casuals.job_role`/`department` exist as text but drive no rate table |
  | 13 | Missing check-out handling (no time = no hours, or assume shift length?) | No |
  | 14 | Corrected attendance — does an edited record recalculate pay retroactively? | No (also see FH-03) |
  | 15 | Absent-worker handling (zero pay, confirmed) | Implicit only — status exists, no payment logic references it |
  | 16 | Duplicate-attendance handling | Already solved at the DB level (unique partial index), unrelated to pay |
  | 17 | Where the approved rate itself is stored (per-casual field, per-role table, global config) | Undecided — depends on answer to #11/#12 |
  | 18 | Who approves a calculated amount before it becomes payable | Undecided — depends on Priority 3/4 outcome |

  Once rules 1-18 are answered, the natural implementation path (not undertaken here) would
  add the approved rate-bearing columns to `attendance` and/or a new small rates table,
  reusing the exact same permission set (`ATTENDANCE_ROLES`) and Workshop Isolation pattern
  already proven by the Attendance build.
- **Requires approval**: Yes — a full compensation-rule decision from the business owner,
  not an engineering judgment call.

---

## FH-02 — Attendance-specific notifications

- **Capability**: Proactive notifications for attendance events (absence, lateness, missing
  check-out, corrections, unusual patterns, submission completion, period close).
- **Severity**: Not built — business-decision required, matching the brief's instruction not
  to auto-implement.
- **Backend**: `pushNotification` and the automation-rule engine (`_autoAct`,
  `automation_rules` table) already exist and are proven (this same phase extended them for
  Stock/Fuel/Harvest — see Changelog). Wiring an Attendance rule is mechanically identical
  to those, once triggers/thresholds are defined.
- **Desktop / Mobile**: N/A.
- **Permission**: N/A.
- **Business impact**: None — no notification currently fires for any attendance event.
- **Recommended action**: Document only, per the brief. Candidate events and the specific
  decision each one needs:

  | Event | Trigger (needs approval) | Recipient | Threshold | Severity | Platform |
  |---|---|---|---|---|---|
  | Worker absent | Marked `Absent`, or no record by some cutoff time? | Supervisor / workshop lead? | Same-day, or after N consecutive days? | Amber/Red? | Both |
  | Late arrival | `check_in` after a defined shift-start + grace period | Supervisor | Grace period undefined | Amber | Both |
  | Missing check-out | `check_in` set, `check_out` still null by end of day/next check | Supervisor | End-of-day cutoff undefined | Amber | Both |
  | Attendance corrected | `attendanceUpdate` changes status/check_in/check_out after initial mark | Original marker? Supervisor? | Immediate, or only if status changes? | Info | Both |
  | Unusual pattern | e.g. repeated lateness, repeated Half Day | Supervisor/HR | Pattern definition undefined (N times in M days?) | Amber | Both |
  | Daily submission completed | All expected workers marked for the day | Supervisor | "Expected" roster source undefined | Info | Desktop only? |
  | Period closed | End-of-month/pay-period attendance finalized | HR/Finance | Depends entirely on FH-04 (Payroll) existing first | Info | Desktop only? |

  None of these have an approved trigger, threshold, or recipient rule today — building any
  of them now would mean guessing thresholds that directly affect who gets paged and how
  often, which the brief explicitly forbids.
- **Requires approval**: Yes, per event — this table itself is the approval request.

---

## FH-03 — Attendance Correction Approval model (Option A vs. Option B)

- **Capability**: Whether editing/voiding an existing attendance record should require a
  second-person approval (governance/`pending_edits`) or remain a direct, audited edit.
- **Severity**: Informational — investigated, no change recommended.
- **Backend evidence**: `attendanceUpdate` (`data.js:11492`) and `attendanceDelete`
  (`data.js:11522`) both perform the mutation **directly** — no `applyGovernance`/
  `pending_edits` call anywhere in either function, unlike sibling functions in the same
  file that do use governance (e.g. `casualLabourRequestsDelete` at `data.js:11221` calls
  `applyGovernance` explicitly). This is genuinely "Option A" (authorized-edit-only), not an
  oversight — both functions are gated by `_canAccessAttendance` (role check:
  `admin`/`ceo`/`operations`/`supervisor`) plus the standard Workshop Isolation check, and
  both write a full before/after diff to `logAudit` (status, check_in, check_out captured on
  both sides), so every correction is permanently traceable even without a second approver.
- **Desktop / Mobile**: `AttendanceEditScreen.tsx` (mobile) and the corresponding desktop
  edit flow both call these same direct-mutation functions — consistent on both platforms.
- **Permission**: `ATTENDANCE_ROLES` — the same 4 roles this codebase already trusts with
  direct, non-governed edits in several other modules (e.g. these roles are not subject to
  governance gating in a number of other write paths audited across prior phases).
- **Isolation**: Standard `isWorkshopRestricted` check present in both functions — unaffected
  by this question either way.
- **Business impact**: None currently — no incident or signal was found suggesting
  unauthorized or disputed attendance edits are occurring.
- **Recommended action**: **Keep the current model (Option A).** There is no business signal
  requiring a second-approver governance workflow for attendance corrections, and the 4
  roles authorized to edit are already the same trusted tier this codebase treats as
  governance-exempt elsewhere. Per the brief's explicit instruction ("do not change the
  current model unless the business explicitly requires an approval workflow"), no code
  change was made. If a future business need for Option B does arise (e.g. attendance
  corrections start driving payroll approvals — see FH-01/FH-04), it should reuse the
  existing `pending_edits` governance engine exactly as `casualLabourRequestsDelete` already
  does, not a new engine.
- **Requires approval**: No — this is a "no change" conclusion, not a pending decision.

---

## FH-04 — Payroll

- **Capability**: Any of: employee/casual compensation records, salary or hourly/casual
  rates, allowances, deductions, overtime pay, pay periods, payroll calculation runs,
  payroll approval, payslips, payroll reports/history, payment status tracking, tax or
  statutory deductions.
- **Severity**: Confirmed absent — classified as a **NEW ENTERPRISE CAPABILITY**, not a gap
  in an existing one.
- **Backend evidence**: A full schema sweep (`db/schema.sql` + `db/migrate.js`) for
  `payroll`, `payslip`, `salary`, `wage`, `deduction`, `allowance`, `overtime_rate`,
  `tax_rate`, `compensation` found **zero matches** except the single
  `casuals.salary_per_action` field (see FH-01 — stored only, never calculated against).
  `app_users` has no compensation field of any kind. No payroll-related function exists in
  `data.js`, no IPC channel, no REST route, no desktop page, no mobile screen.
- **Desktop / Mobile**: N/A — nothing exists on either platform.
- **Permission**: N/A.
- **Business impact**: None directly (nothing regressed — this was already absent before
  this phase and before HR Phase 1/2). Its absence does, however, mean FH-01's "Calculated
  Labour Amount" step has no downstream system to hand off to even once its own rules are
  approved — Payroll and Attendance→Casual-Labour-Hours are two separate approval gates that
  both need to clear before either becomes a real payment pathway.
- **Recommended action**: Do not implement. If/when the business decides to build Payroll,
  the following must be defined and approved first (per the brief's Payroll Business Rule
  Gate and Data Safety sections):

  **Rule gate:**
  - Employee types covered (permanent staff via `app_users`? casuals via `casuals`? both,
    with different rules?)
  - Earnings components (base salary/rate, overtime, allowances — which ones, how computed)
  - Deduction components (which, mandatory vs. optional, calculation basis)
  - Attendance linkage (does Payroll consume Attendance directly, or only the FH-01
    "Calculated Labour Amount" once that itself is approved?)
  - Pay period definition (weekly/bi-weekly/monthly; when a period locks)
  - Approval chain (who reviews/approves a payroll run before it's final; single or
    multi-level, and does it reuse `pending_edits`/the escalation engine or need something
    new — the brief is explicit that a second approval engine must never be invented)
  - Payslip content and distribution (desktop-only, or mobile too)
  - Statutory/tax handling (Rwanda-specific — PAYE, RSSB, or none of this system's concern
    if payroll is processed externally and this system would only need to export figures)

  **Data safety:**
  - Immutability requirement for a finalized/paid period (must a paid payroll run become
    read-only, matching `audit_log`'s existing no-update/no-delete precedent?)
  - Full audit trail requirement (who calculated, who approved, when, before/after — matching
    the pattern already proven by `attendanceUpdate`'s before/after `logAudit` capture)
  - Traceability from a payslip line back to its source attendance/rate records

  No financial calculation should be implemented against any guessed version of the above.
- **Requires approval**: Yes — this is new-capability scoping, not a bug fix; needs a
  dedicated design/business-rules phase of its own before any implementation phase begins.

---

## FH-05 — CRUD parity final check

- **Method**: light confirmatory spot-check (one representative, business-critical entity per
  department — 16 total), not a new full audit, since ERP Remediation Phase 2 already
  completed a full ~62-entity CRUD parity audit and closed everything found. This check
  verifies no regression since.
- **Result**: 15/16 clean. 1 real gap found and fixed:
  **Pole Production Batch delete** — full Backend/IPC/REST/Desktop support existed, plus a
  correctly-implemented mobile hook (`usePoleProductionBatchDelete`), but no mobile screen
  ever called it (Backend=YES / Desktop=YES / Mobile=NO). No explanatory scope-decision
  comment was found near the code, and the identical bug pattern had already been found and
  fixed once before for VAT (`useVatDelete`, "ERP Enterprise Cross-Department Verification"
  phase) — confirming this was a genuine oversight, not a documented decision. Fixed: see
  Changelog "CRUD Parity Final Check" section. `npx tsc --noEmit` clean.
- **Severity**: Medium (real capability gap, but governed/low-frequency — production batch
  deletion is rare and only permitted pre-inspection).
- **Requires approval**: No — mechanical parity fix reusing an existing, already-approved
  pattern (identical to the VAT precedent), not a new capability or business decision.

---

## Carried forward from prior phases (still open, unchanged this phase)

These were disclosed in the ERP Remaining Departments Completion Program's gap register and
were out of this phase's scope (not Priorities 1-6):

- Automation Rule management has zero UI on either platform.
- Vehicle compliance documents remain desktop-only.
- `delivery_orders` genuinely soft-deletes but was never added to `TRASH_TABLES` (no restore
  path for a deleted delivery order) — low-risk, no-approval-needed follow-up, still not done
  opportunistically as it remains outside approved scope.
- 4 backend functions with no `secureHandle` on desktop at all
  (`attachmentGet`/`Register`/`Delete`, `workshopsListWithMetrics`).
- 57 permanently-retained stray QA `app_users` accounts (protected by the immutable
  `audit_log` FK — not fixable, by design; see [[project_stray_qa_test_accounts]]).
