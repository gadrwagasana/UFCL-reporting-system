# Payroll Enterprise Phase 2 — Completion Report

**Companion files**: `PAYROLL_ENTERPRISE_PHASE2_CHANGELOG.md` (full file-by-file diff detail),
`PAYROLL_ENTERPRISE_PHASE2_GAP_REGISTER.md` (outstanding limitations and business decisions).

This phase builds on `PAYROLL_ENTERPRISE_PHASE1_DISCOVERY_REPORT.md`/`_BUSINESS_RULES.md`/
`_GAP_REGISTER.md` (the prior discovery-only phase). Every architectural recommendation made
there — reuse `procurement_approval_steps` (not `pending_edits`) for approval, no Finance/
ledger integration, per-person human-entered rates rather than an assumed model — is what was
actually built here.

---

## 1. Business Rules

Per the Stop Rule, no compensation, tax, or statutory rule was invented. What *was* decided,
as an architecture choice (not a financial guess), and is now built:

- **Compensation model**: every person (employee or casual) gets a human-entered
  `rate_type` (`hourly`/`daily`/`monthly`/`per_action`/`fixed`) + `rate_amount`, set by an
  authorized preparer via `payrollRateSet`. The system never computes or assumes a rate — it
  only multiplies a stored, human-supplied rate by a quantity (see §6). This directly answers
  Phase 1's open question ("does UFCL pay casuals hourly, daily, or per-action?") by not
  forcing a single answer: the business can use whichever model fits each person, decided
  person-by-person by whoever sets the rate, not hardcoded by the system.
- **Payroll period cadence**: not fixed to monthly/weekly — a period is simply a `start_date`/
  `end_date` range chosen by the preparer, the same free-range pattern
  `casual_labour_requests` already established. Sidesteps needing to guess UFCL's real cadence.
- **Tax/statutory deductions**: explicitly **not implemented**. `payroll_adjustments` supports
  only `bonus`/`deduction`/`correction`/`other`, each requiring a human-entered amount and
  reason — never a computed percentage. See the Gap Register for what remains undecided.
- **Approval chain**: a fixed 2-stage chain (`operations` → `ceo`), explicitly flagged in code
  comments as a minimal V1 default (no dedicated payroll/HR role hierarchy exists yet — see
  Phase 1 PR-06) rather than a permanent design.

## 2. Employee/Casual Compensation Model

No new employee identity table (per the brief's explicit "do not duplicate employee/user
records"). `payroll_rates` references `app_users`/`casuals` polymorphically
(`num_nonnulls(user_id, casual_id)=1`, the same pattern `attendance` already uses) and is
**append-only**: setting a new rate deactivates the previous one via a partial unique index
rather than overwriting it, so a full rate history exists automatically without a separate
effective-dated schema. `payroll_lines.rate_type_snapshot`/`rate_amount_snapshot` freeze the
rate actually used at calculation time, so a later rate change never silently alters an
already-calculated (let alone already-approved) line.

## 3. Attendance Integration

Attendance is the sole source of worked-time data — **nothing is duplicated into Payroll**.
`payrollPeriodCalculate` reads `attendance` directly (via `_payrollFetchAttendanceForPerson`)
for the period's date range and derives a payable quantity:

- **Hourly rate**: pure mechanical sum of recorded `check_out - check_in` per record — the
  exact same computation `attendanceList`'s own `hours` column already does. No judgment call.
- **Daily/monthly rate**: an explicit, disclosed default (`Present`/`Late` = 1 day,
  `Half Day` = 0.5, `Absent`/`Leave`/`Off Day` = 0), labeled in the line's `source_summary.note`
  as a default requiring review, and fully overridable by the preparer
  (`payrollLineUpdateSourceQty`, reason required) before submission — never silently finalized.
- **Per-action/fixed rate**: no attendance-derivable quantity exists (confirmed in Phase 1);
  `source_qty` starts at 0 and must be entered manually.

`payroll_lines.source_summary` records exactly which attendance records (id/date/status/hours)
contributed to a line's quantity — the concrete mechanism behind "every amount traceable"
(Priority 10), live-verified: `payrollLineDetail` on a QA line correctly listed all 3
contributing attendance records.

## 4. Casual Labour Integration

`casual_labour_requests` (the aggregate headcount requisition — see Phase 1 §3) is **not**
wired into payroll calculation — Phase 1 established it carries no per-person linkage or rate,
and the brief explicitly forbids "creating payment automatically merely because a labour
request exists." A casual worker enters payroll the same way an employee does: an authorized
preparer sets their `payroll_rates` row, and their own `attendance` (`casual_id` side) feeds
the calculation exactly like an employee's `user_id`-side attendance does — same functions,
same code path, differing only in which identity column is populated. Live-verified with a
disposable QA casual worker: hourly-rate calculation, source-quantity override, and the
Casual Labour Cost report all worked correctly.

## 5. Payroll Period

Implemented lifecycle (`payroll_periods.status`): `draft` → `calculating` → `pending_approval`
→ `approved` → `exported` → `closed`, plus a `rejected` terminal state. `workshop_id` is
nullable (company-wide) or set (workshop-scoped), reusing the exact same `isWorkshopRestricted`
mechanism as the rest of the codebase (see §12). An application-level (not DB-constraint-level)
overlap guard in `payrollPeriodCreate` rejects a new period whose date range overlaps an
existing non-rejected period in the same scope — disclosed as app-level only in the Gap
Register, not a hard DB exclusion constraint. Draft/Calculating periods can be edited or
deleted (deletion reuses `applyGovernance`, the existing ad-hoc edit/delete safety net — Engine
A); once submitted, only the multi-stage approval engine (Engine B) can move the period
forward, matching Phase 1's architectural conclusion precisely.

## 6. Calculation Engine

`payrollPeriodCalculate` is idempotent per person (`ON CONFLICT` upsert on a
`(period_id, person)` partial unique index — the same concurrency-safe pattern already proven
for `attendance`'s own duplicate-prevention). Every line is fully reproducible from stored
data: `quantity × rate_amount_snapshot = gross_amount`, `gross_amount + adjustments_total =
net_amount`. Live-verified formula correctness:

- Employee (daily rate 5000, 1 Present + 1 Late + 1 Half Day = 2.5 payable days) →
  gross = **12,500**.
- Casual (hourly rate 1000, 3 days × 4 recorded hours = 12 hours) → gross = **12,000**.

No amount is ever stored without a derivation path back to either attendance records or a
manually-entered, reasoned override.

## 7. Approval Workflow

Reuses `procurement_approval_steps`/`procurementApprovalAction` — **the first entity type to
use this engine from outside Procurement**, exactly as Phase 1 recommended. The extension is
purely additive: every new branch is gated on `entityType === 'payroll_period'`, so all
existing Procurement entity types (`requisition`/`invoice`/`payment`/`po`) are provably
unaffected (confirmed by code inspection — no existing conditional's behavior changes when
`isPayroll` is false). `pending_edits`/`applyGovernance` (Engine A) was deliberately **not**
used for this — it remains reserved for ad-hoc edit/delete of ordinary Draft-period records, a
different concern from the period's own deliberate multi-party business-process approval.

Supported decisions: `approved`, `rejected` (terminal), `returned_for_revision` (reopens to
Draft for correction — deliberately lighter than requisitions' full item-snapshot revision
history, since payroll's own `payroll_adjustments` already gives line-level correction
traceability). Live-verified end-to-end: submit → return for correction → recalculate/override
→ resubmit (fresh approval stages created correctly) → operations approves stage 1 → ceo
approves stage 2 → fully approved. A separate isolated test confirmed plain rejection is
correctly terminal (a rejected period cannot be resubmitted).

## 8. Adjustments

`payroll_adjustments` supports exactly `bonus`/`deduction`/`correction`/`other` — never
tax/pension/insurance/statutory (Priority 8's explicit exclusion). Every adjustment requires an
amount and a reason, and carries its own `pending`/`approved`/`rejected` status, decided by a
small role-gated approve/reject (`payrollAdjustmentApprove`/`Reject`, same shape as
`casualLabourRequestsReview` — not a second multi-stage engine). Approving an adjustment
updates `payroll_lines.adjustments_total`/`net_amount`; the original `gross_amount` snapshot is
never touched. Adjustments remain possible **after a period is Closed** — this is the "explicit
controlled correction mechanism" Priority 5 requires — live-verified: a correction adjustment
was successfully created against a QA line after its period was fully closed.

## 9. Desktop UI

New `Payroll` nav entry (Human Resources section). Single page with a page-level drill-down
(not nested overlays — this codebase's overlay system is single-level):
Periods list → period detail (overview, approval timeline, action buttons gated by status/role,
lines table) → line detail overlay (source breakdown, adjustments, manual quantity override).
Rates are managed via a dedicated overlay (person picker degrades gracefully — see §12).
Reports render inline in the period detail page with CSV export via the existing
`downloadCsv()` helper; Workshop Summary (company-wide, not period-scoped) lives on the main
Periods page. No backend capability is unreachable from this UI.

## 10. Mobile UI

Deliberately narrow, per the brief's explicit instruction not to force complex payroll
administration onto mobile. Nested into the existing `CasualLabourStack` (matching the
established "reuse the shared HR stack via a role-gated header button" pattern Attendance
itself already uses, rather than adding a new bottom tab) via a `payroll.manage` permission
key (admin/ceo/operations/supervisor — matching the backend's `PAYROLL_ROLES` exactly):

- `PayrollPeriodsListScreen` — browse periods.
- `PayrollPeriodDetailScreen` — overview, approval timeline, lines, and Approve/Reject/Return
  actions (shown only when the signed-in role matches the pending stage — server-enforced
  regardless).
- `PayrollLineDetailScreen` — read-only calculation breakdown and adjustment history
  ("Calculation Inspection," Priority 10 on mobile).

Rate setting, period creation/calculation, and adjustment creation remain desktop-only —
consistent with how this codebase already treats other administratively-heavy capabilities
(e.g. KPI Definitions, Casuals Registry admin). Employee self-service payslip access was
**not** built — see the Gap Register for why (no permission model currently supports it).
`npx tsc --noEmit` clean.

## 11. Reporting

6 reports, all reusing the existing `{ok, rows/summary}` + CSV-export convention (no new
export mechanism, no accounting-journal export — explicitly out of scope):
Payroll Summary, Attendance↔Payroll Reconciliation, Casual Labour Cost Summary, Payroll
Adjustments, Payroll Cost by Workshop (company-wide), and per-line drill-down (the "Worker
Payroll Detail" requirement, served by the existing Line Detail view rather than a duplicate
report). All 6 were exercised live against QA data with correct results (see §13).

## 12. Security

- **Role authorization**: `_canAccessPayroll` (`mustRole('payroll')` OR
  `PAYROLL_ROLES.includes(role)`) gates every function; approval-stage actions are separately
  gated by `procurement_approval_steps.assigned_role`.
- **Workshop Isolation**: reuses the exact existing `isWorkshopRestricted` mechanism — scope is
  controlled by whether a user account has `workshop_id` set, not a role hardcode (Phase 1
  §10's finding, confirmed still true). Live-verified: a workshop-4 user (even one holding
  full payroll permission) was denied both detail access and list visibility for a workshop-3
  period.
- **Closed-period protection**: recalculation, period edit, and period delete are all blocked
  once a period leaves Draft/Calculating — live-verified against a closed period.
- **Concurrency**: DB-level partial unique indexes prevent duplicate lines/rates, the same
  proven pattern as Attendance.
- **Audit trail**: every mutation (rate set, period create/calculate/submit/return/approve/
  export/close, line recalculate/manual-override, adjustment request/approve/reject) calls
  `logAudit` — live-verified: a single test period's lifecycle produced 18 distinct,
  human-readable audit entries, permanently retained (immutable by DB rule, the same
  established `audit_log_no_delete` guarantee this program has relied on since early phases).
- **One real permission gap found and disclosed, not silently worked around**: the desktop
  Rates screen's Employee picker depends on `usersList`, which is gated more narrowly
  (ceo/operations/admin) than Payroll's own broader `payroll` permission (which also includes
  supervisor). Handled as a graceful, disclosed UI narrowing (supervisor can set Casual Worker
  rates but not Employee rates via this screen) rather than a broken dropdown or a silent
  permission expansion — see the Gap Register.

## 13. Verification

**Static**: `node --check` clean on `db/services/data.js`, `db/migrate.js`, `renderer/app.js`,
`electron/main.js`, `electron/preload.js`, `mobile-api/server.js`,
`mobile-api/routes/payroll.js`. `npx tsc --noEmit` clean across `mobile/`.

**Live** (disposable QA data, full cleanup, production database): a 50-assertion script
exercised the complete lifecycle — create period → set rates (daily + hourly) → record
attendance → calculate (verified exact gross-amount formulas) → review → submit → return for
correction → recalculate + manual override → resubmit (verified fresh approval stages) →
2-stage approve (operations → ceo) → add + approve adjustment (verified net-amount update) →
all 6 reports → mark exported → close → attempted unauthorized recalculate/edit/delete on the
closed period (all correctly blocked) → post-close adjustment (correctly allowed) → Workshop
Isolation (both a no-permission role and a same-permission-different-workshop role correctly
denied) → audit trail (18 entries confirmed) → an isolated second period testing plain
rejection as a terminal state. **50/50 passed.**

Cleanup: all QA rows (periods, lines, adjustments, rates, attendance, the disposable QA casual
worker and QA supervisor account) were fully removed and independently re-verified at zero
residue. `audit_log` entries generated by the test remain permanently, by design (the DB's own
immutable-audit-trail rule) — disclosed, not deleted, matching this program's established
precedent for every prior phase's live verification.

## 14. Outstanding Business Decisions

Unchanged from Phase 1 and still correctly not implemented: tax/PAYE, social security/RSSB,
pension, statutory deductions, loans/advances, overtime rules, allowances/bonuses formulas,
Finance/accounting integration beyond a Sage-style CSV export. Also newly identified this
phase: the specific 2-stage approval chain is a flagged placeholder pending a real HR/Payroll
role hierarchy decision. Full detail in the Gap Register.

## 15. Production Readiness

The operational payroll capability (period lifecycle, transparent calculation, governed
approval, controlled corrections, reporting, security, Workshop Isolation) is production-ready
and fully live-verified. It should **not** be used for real compensation decisions until the
Business Rules register's remaining open items (rate models actually used, overtime,
allowances, statutory handling, real approval hierarchy) are resolved by the business — the
system will not guess these, by design; every rate and adjustment requires a human to supply
and justify it.

---

## PAYROLL READINESS

| Area | Status |
|---|---|
| Employee model | 🟢 (reuses existing identity tables, no duplication) |
| Attendance integration | 🟢 (live-verified, zero duplication) |
| Casual Labour integration | 🟢 (live-verified via disposable QA casual) |
| Earnings | 🟡 (infrastructure complete; actual rate models/amounts are a business decision, by design) |
| Deductions | 🟡 (adjustments infrastructure complete; statutory rules explicitly not implemented) |
| Payroll lifecycle | 🟢 (full Draft→Closed lifecycle live-verified, incl. return-for-correction and rejection) |
| Approval | 🟢 (reuses Procurement's engine, live-verified 2-stage chain; role hierarchy is a flagged V1 default) |
| Finance integration | 🟡 (Option A only — operational + CSV export; no accounting system exists to integrate further, by design) |
| Reporting | 🟢 (6 reports, all live-verified with correct data) |
| Notifications | 🟢 (4 workflow events wired, both platforms) |
| Desktop | 🟢 (full capability reachable) |
| Mobile | 🟢 (review/approve/inspect — deliberately narrow scope, by design) |

Per the Stop Rule: no other department was started, Workshop Isolation was not redesigned, no
tax/statutory/compensation rule was invented, and nothing was committed or pushed.
