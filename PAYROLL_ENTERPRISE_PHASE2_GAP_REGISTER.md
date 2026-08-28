# Payroll Enterprise Phase 2 — Gap Register

Format: ID / Gap / Severity / Evidence / Impact / Recommended action / Requires approval.
Everything here was found during build or live verification and deliberately left as a
disclosed limitation rather than silently worked around or scope-crept into a fix.

---

## PH2-01 — Approval chain is a fixed 2-stage placeholder, not a real hierarchy

- **Severity**: Medium (functions correctly, but the specific roles are a stand-in).
- **Evidence**: `_payrollBuildApprovalStages()` (`data.js`) always returns exactly
  `[operations, ceo]` — no threshold logic, no HR/Payroll-specific role. Explicitly commented
  in code as "V1 minimal starting default... explicitly flagged as a starting point to revisit
  once a real approval hierarchy is decided."
- **Impact**: None today (mechanically correct, live-verified), but doesn't yet reflect
  whatever real preparer/reviewer/approver hierarchy the business actually wants (Phase 1
  Business Rules register, still open: "Payroll reviewer"/"Payroll approver"/"Payroll
  finalizer").
- **Recommended action**: Once Phase 1's approval-hierarchy decision is made, update
  `_payrollBuildApprovalStages()` (and, if a dedicated `hr`/`payroll` role is created, extend
  `PAYROLL_STAGE_ROLE`) — a small, contained change, not an architecture change.
- **Requires approval**: Yes.

## PH2-02 — Desktop Rates screen's Employee picker inherits a narrower permission than Payroll itself

- **Severity**: Low (disclosed, gracefully degraded — not a broken UI).
- **Evidence**: `usersList` (`data.js`) is gated to `['ceo','operations','admin']`; Payroll's
  own permission (`'payroll'` page) is broader, including `supervisor`. The Rates overlay
  detects this and hides the "Employee" option for a supervisor, showing only "Casual Worker"
  (which `casualsList` already permits for supervisor) plus an inline explanation.
- **Impact**: A supervisor preparing workshop payroll can set Casual Worker rates but not
  Employee rates from this screen — they would need an admin/ceo/operations user to do that
  part, or the business could decide to broaden `usersList`'s access (a separate, broader
  admin-users capability, out of proportion to fix as a Payroll side-effect).
- **Recommended action**: Leave as-is unless the business wants supervisors to set Employee
  rates too, in which case broaden `usersList`'s gate deliberately (its own decision, not a
  Payroll one) rather than building a parallel, narrower "list employees for Payroll" query.
- **Requires approval**: No — correctly disclosed and gracefully handled already; only needed
  if the business wants the broader access.

## PH2-03 — Approval-timeline history shows duplicate stage rows after a return-and-resubmit cycle

- **Severity**: Low (cosmetic — confirmed functionally correct in live testing).
- **Evidence**: `payrollPeriodSubmit` always inserts a fresh batch of
  `procurement_approval_steps` rows (stage_order 1, 2, ...) rather than reusing/renumbering
  prior ones. After a Return for Correction + Resubmit cycle, the period's approval-steps list
  contains both the old batch (status `returned`/`skipped`) and the new batch (status
  `pending`) with the *same* `stage_order`/`stage_key` values. The live QA test confirmed the
  *correct* pending stage is always found (the `WHERE status='pending'` filter disambiguates
  unambiguously), but a human reading the full Approval Timeline (desktop's period-detail card,
  mobile's `PayrollPeriodDetailScreen`) sees two "operations" rows and could find that
  confusing without realizing they represent two different submission attempts.
- **Impact**: Cosmetic only — no functional or security effect (confirmed via 4 dedicated live
  assertions around the return→resubmit→approve sequence, all passing).
- **Recommended action**: A future polish pass could group the approval-steps display by
  submission attempt (e.g. a `submission_number` column, mirroring
  `procurement_requisition_revisions.revision_number`'s existing precedent) — not done this
  phase, to avoid scope creep into a purely cosmetic concern.
- **Requires approval**: No — functional correctness is not in question; purely a future
  UX-polish candidate.

## PH2-04 — Daily/monthly payable-day weighting is a disclosed default, not a business rule

- **Severity**: Medium (correct behavior, but the default itself needs business confirmation).
- **Evidence**: `_payrollComputeSourceQty`'s daily/monthly branch: `Present`/`Late` = 1 day,
  `Half Day` = 0.5, `Absent`/`Leave`/`Off Day` = 0. Labeled in the resulting
  `source_summary.note` as "default rule — review before approval," and fully editable
  (`payrollLineUpdateSourceQty`) before submission.
- **Impact**: None today — every daily/monthly line's quantity is visibly labeled as a default
  and reviewable before any approval happens. But if left unconfirmed indefinitely, whoever
  prepares payroll must remember to check it every time rather than trusting the number.
- **Recommended action**: Confirm or correct this specific weighting as part of resolving
  Phase 1's "Absence deductions"/"Partial-day handling" business rules — a small, additive
  change to `_payrollComputeSourceQty` once confirmed.
- **Requires approval**: Yes — this is literally a business-rule confirmation.

## PH2-05 — Employee self-service payslip/payroll-summary access was not built

- **Severity**: Medium (a named brief requirement, not built — disclosed, not silently
  dropped).
- **Evidence**: The `'payroll'` page permission (and mobile's `payroll.manage`) is granted only
  to admin/ceo/operations/supervisor — there is no general "employee" role or "see your own
  records regardless of role" permission concept anywhere in this codebase's permission model.
- **Impact**: The brief's Priority 14 mobile wish-list item ("Employee payroll summary,
  Payslip") is not reachable by an arbitrary staff member today — only the 4 manager/approver
  roles can see Payroll at all, and even they see it as *managers*, not as *themselves*.
- **Recommended action**: This needs an actual permission-model decision (a new cross-cutting
  "see your own X" concept, applicable regardless of role) before it can be built — not a
  Payroll-specific engineering choice, and not something to invent unilaterally. Flagged for a
  future phase once the business confirms whether/how self-service access should work.
- **Requires approval**: Yes.

## PH2-06 — Period date-range overlap guard is application-level, not a DB constraint

- **Severity**: Low.
- **Evidence**: `payrollPeriodCreate`'s overlap check is a `SELECT` query run before the
  `INSERT`, not a database-level exclusion constraint (which would require the `btree_gist`
  extension, not confirmed enabled on this database).
- **Impact**: A genuine race condition (two simultaneous period-creation requests for the same
  overlapping range) could theoretically both pass the check before either commits. Considered
  low-risk given payroll periods are created deliberately and infrequently by a small number of
  trusted roles, not a high-concurrency write path.
- **Recommended action**: If this is ever observed in practice, add a DB-level exclusion
  constraint (`EXCLUDE USING gist`) once `btree_gist` is confirmed available — not done
  preemptively for a theoretical, low-probability race on an infrequent write path.
- **Requires approval**: No — informational.

## Carried forward from Phase 1 (still open, unchanged this phase)

Tax/PAYE, social security/RSSB, pension, loans/advances, overtime rules, allowance/bonus
formulas, and any real Finance/accounting ledger integration remain entirely unimplemented, by
design — see `PAYROLL_ENTERPRISE_PHASE1_BUSINESS_RULES.md` for the full decision register.
None of these were guessed or approximated anywhere in this phase's implementation.
