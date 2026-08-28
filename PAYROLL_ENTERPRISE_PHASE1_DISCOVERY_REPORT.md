# Payroll Enterprise Phase 1 — Discovery, Business Rules & Architecture

**Companion files**: `PAYROLL_ENTERPRISE_PHASE1_BUSINESS_RULES.md` (the full decision
register), `PAYROLL_ENTERPRISE_PHASE1_GAP_REGISTER.md` (data/architecture gaps found),
`PAYROLL_ENTERPRISE_PHASE1_CHANGELOG.md` (confirms zero code changes this phase).

This is a **discovery and design phase**. No Payroll table, function, route, or screen was
created. No business rule was guessed. Every claim below is grounded in the current source
code (`db/schema.sql`, `db/migrate.js`, `db/services/data.js`, `renderer/app.js`), read
directly for this phase, not inferred from memory of prior phases.

---

## 1. Current HR Architecture

Employees and casual workers are managed through two separate, pre-existing tables — there is
no unified "HR" module and no dedicated `hr`/`hr-manager` role anywhere in the permission
system (`ROLE_PAGES`). The closest thing to HR administration today is
`ATTENDANCE_ROLES = ['admin','ceo','operations','supervisor']`, the same 4-role set that
manages both Attendance and the Casuals registry.

**`app_users`** (permanent staff — also the login/auth table): `id, username, name, role,
department (text, no FK/canonical list), user_permissions, user_responsibilities,
password_hash, active, workshop_id, created_at`. No employee number, hire date, termination
date, salary, bank/mobile-money detail, or national ID field of any kind.

**`casuals`**: `id, full_name, national_id, phone, gender, date_of_birth, address, department
(text), work_location, job_role, supervisor (text), start_date, end_date, emergency contact
fields, salary_per_action, active, created_by, created_at, workshop_id`. This is closer to a
real HR profile than `app_users` (has `national_id`, `start_date`/`end_date`), but
`salary_per_action` is a stored-only numeric field — grepping every reference to it in
`data.js` shows it is only ever inserted/selected/updated via `casualsCreate`/
`casualsUpdate`/`casualsList`, never read by any calculation. Its own name — "per **action**,"
not "per hour" — is itself evidence pointing away from an hourly model (see §3).

## 2. Attendance Integration

The `attendance` table (built in a prior HR phase) already provides, per person per day:
`status` (`Present`/`Absent`/`Late`/`Half Day`/`Leave`/`Off Day`), `check_in`, `check_out`,
`notes`, full before/after audit trail on every correction (`attendanceUpdate` logs a diff via
`logAudit`), and soft-void (`attendanceDelete`). `attendanceList`/`attendanceReport` already
compute a flat clock-difference `hours` per record
(`round(extract(epoch from (check_out-check_in))/3600.0, 2)`) and one aggregate `totalHours`
across the whole filtered result set.

**What Attendance can already provide to Payroll**: raw total hours per record, and (via a
`person_id` filter) all records for one person over a date range — the raw material for
"hours worked" exists.

**What Attendance cannot provide today** (confirmed by reading every line of
`attendanceList`/`attendanceReport` — nothing was assumed): no per-person-per-period subtotal
(the aggregate is flat across the whole result set, not grouped by person); no distinction
between regular and overtime hours; no break deduction; no rounding rule; no linkage from a
`Half Day` status to a specific payable fraction. All of this matches, and is now re-confirmed
against current code, what the prior "ERP Final Enterprise Hardening" phase already found and
documented (FH-01) — this phase re-verified it directly rather than trusting that finding at
face value, and it still holds.

Attendance itself is **not modified in this phase**, per the brief.

## 3. Casual Labour Integration

`casual_labour_requests` (`start_date, end_date, task, num_casuals, labour_items (jsonb),
description, comments, status, created_by, reviewed_by, workshop_id`) was read end-to-end
(backend function + the actual desktop form that populates it,
`renderer/app.js` ~line 19023). This fully resolves what the brief calls a "mandatory
business-rule investigation":

**`casual_labour_requests` is a pure staffing/headcount requisition, not a payment record.**
`labour_items` is a JSON array of `{role: "Woodmez"/"Manpower"/"Assistance", quantity: N}` —
literally "we need N people of role X for this task." It carries **zero cost, rate, or
amount field anywhere**, and it does not link to specific named `casuals.id` records — it is
an aggregate headcount plan, analogous to a purchase requisition but for labour, entirely
disconnected from who actually shows up or what they're paid.

**This means three separate pieces of the eventual "pay a casual worker" chain currently exist
in complete isolation, with no connecting thread between them**:
1. A staffing plan (`casual_labour_requests`) — how many people, what role, what dates.
2. Named individuals (`casuals`) — who they are, with a stored-but-unused `salary_per_action`.
3. Actual attendance (`attendance`, `casual_id` side) — who actually showed up, which days.

No code anywhere joins these three. Building casual-worker Payroll is therefore not "add a
rate column" — it requires the business to first decide whether payment is based on approved
request headcount, on attendance, on a supervisor's manual sign-off of completed work, or on
something else entirely (see the Business Rules register, "Casual payment model").

## 4. Employee Model

**Conclusion: no new employee profile entity is needed for permanent staff or casuals as
distinct *identities*** — `app_users` and `casuals` already serve that role and are actively
maintained elsewhere in the system (Users admin, Casuals registry). Creating a third,
parallel "Payroll Employee" identity table would duplicate data the brief explicitly warns
against duplicating.

What is genuinely missing, and would need new columns (on the existing tables, not a new
identity table) or a small satellite table once the pay-structure decision (Priority 4) is
made: a compensation basis (monthly salary / daily rate / hourly rate — undecided, see
Business Rules), payment method detail (bank/mobile-money — currently absent from both
tables), and for `app_users` specifically, a `national_id`-equivalent field it currently
lacks entirely (only `casuals` has one).

## 5. Payroll Data Model (design only — nothing created this phase)

Following the brief's instruction to design without migrating, and this codebase's existing
convention of **one small config table + entity tables keyed by a generic `entity_type` for
anything that plugs into the shared approval ledger** (see §9), the following entities are
proposed. All reference existing identity tables rather than duplicating employee data:

| Table (proposed) | Purpose | Key columns (illustrative, not final) |
|---|---|---|
| `payroll_config` | Single-row settings (mirrors `procurement_config`'s pattern exactly) | `id, ceo_threshold, default_period_type, updated_by, updated_at` |
| `payroll_periods` | One row per pay period | `id, period_type, start_date, end_date, cutoff_date, payment_date, status, workshop_id (nullable — see §10), created_by, created_at` |
| `payroll_runs` | One row per person per period (the actual calculation) | `id, period_id (FK), user_id (nullable), casual_id (nullable) — same `num_nonnulls=1` polymorphic pattern Attendance already uses, gross_pay, net_pay, status, workshop_id, created_at` |
| `payroll_earnings` | Child rows, many per run | `id, run_id (FK), category, source_ref (nullable — e.g. an attendance_id or casual_labour_request id, once linkage is decided), amount, created_at` |
| `payroll_deductions` | Child rows, many per run | `id, run_id (FK), category, amount, created_at` |
| *(approval)* | Reuses `procurement_approval_steps` — see §9, no new table | — |
| `payroll_payments` | One row per actual payment made | `id, run_id (FK), paid_at, paid_by, method, reference, created_at` |
| `payroll_adjustments` | Post-finalization corrections, never a physical edit | `id, run_id (FK), reason, amount_delta, created_by, created_at, approved_by` |

Every table follows this codebase's universal conventions: `created_by`/`created_at`, soft
status columns rather than physical deletes for anything past Draft, a `workshop_id` column
sized for the scoping decision in §10 (nullable, following `attendance.workshop_id`'s own
pattern), and audit via the existing `logAudit` call convention — no separate audit table.

## 6. Earnings

Candidate categories and what's actually knowable today: Basic Salary (monthly staff — no
rate stored anywhere yet), Daily Wages (no rate stored), Casual Labour (no rate calculation
path — see §3), Overtime (no threshold/multiplier defined), Allowances/Bonuses/Production
Incentives (no fields, no rules). **Every earnings category is BUSINESS DECISION REQUIRED** —
see the Business Rules register for the per-category source/calculation/approval/taxability
questions the brief requires.

## 7. Deductions

A schema-wide grep for `payroll|payslip|salary|wage|deduction|allowance|overtime_rate|
tax_rate|compensation` across `db/schema.sql` and `db/migrate.js` returned **zero matches**
except `casuals.salary_per_action` (already covered in §1/§3 — stored, never calculated).
There is no tax table, no statutory-rate table, no loan/advance tracking anywhere. Per the
brief's explicit instruction, no statutory percentage or deduction rule is proposed here —
this is entirely BUSINESS DECISION REQUIRED.

## 8. Payroll Lifecycle

The brief's suggested lifecycle (DRAFT → CALCULATING → REVIEW → APPROVED → FINALIZED → PAID →
CLOSED) maps cleanly onto this codebase's existing `status`-column-plus-role-gated-transition
pattern, the same shape already proven by `procurement_requisitions`/
`procurement_purchase_orders`/`casual_labour_requests` (a dedicated status enum + explicit
functions like `casualLabourRequestsReview` that only advance status forward, never regress
it silently). This is a **different, more appropriate shape** than the ad-hoc `pending_edits`
governance engine — see §9 for why. The exact lifecycle stage names/count still need
confirmation against UFCL's actual process (per the brief) before being finalized; the
7-stage version above is a starting proposal, not a decision.

## 9. Approval — Which Existing Engine Actually Fits

This codebase has **two architecturally distinct "approval" mechanisms**, and the brief's
instruction to "reuse the existing governance engine" is genuinely ambiguous between them
until read carefully. This phase resolved the ambiguity by reading both end-to-end:

**Engine A — `pending_edits`/`deletion_requests` via `applyGovernance`/
`timeGatedAuthorization`.** This is a time-and-ownership-based *safety net* for ad-hoc
edits/deletes of ordinary records by non-privileged or non-owning users (e.g., "you're
editing someone else's record, or your own record more than 24h old — a leader/manager must
sign off"). It is reactive, generic across every table in the system, and was built for
individual record mutations, not a forward multi-party business process.

**Engine B — `procurement_approval_steps` via `procurementApprovalAction`/
`_procBuildApprovalStages`.** This is a **generic, already-multi-tenant, purpose-built
multi-stage business-workflow ledger**: `entity_type, entity_id, stage_key, stage_order,
status, assigned_role, approved_by, approved_at, notes`. Its own code comment states it is
"reused by requisitions, invoices, and payments instead of three copies of the same
stage-advancement logic," and it already supports a dynamic, threshold-based extra stage
(`_procBuildApprovalStages` adds a CEO stage only when `totalAmount` exceeds a configurable
`procurement_config.ceo_threshold`) — precisely the shape a payroll-total threshold would
need. `procurementApprovalAction`'s `ENTITY_TABLE` map currently lists
`requisition/invoice/payment/po`; adding `payroll_period: 'payroll_periods'` would be a small,
additive change of the exact same shape as when `po` was added alongside the original three.

**Conclusion: Engine B is the correct fit for Payroll's prepare→review→approve→finalize
workflow.** Engine A remains correctly untouched — it should keep handling ad-hoc edits to
ordinary Payroll records (e.g., someone correcting a draft earnings line after the fact),
exactly as it already does for every other table, while Engine B handles the deliberate
multi-party sign-off of an entire payroll run. This would be the **first reuse of Engine B
outside Procurement** since it was built — worth flagging as a first-of-its-kind extension,
not a routine one, even though the code was explicitly written to be generic.

Who prepares/reviews/approves is still entirely undecided (no `hr` role exists in
`ROLE_PAGES` today — `admin`/`ceo`/`operations`/`supervisor` is the closest analog, being the
existing Attendance/Casuals management tier). See the Business Rules register.

## 10. Workshop Isolation

**Not redesigned.** The existing mechanism (`isWorkshopRestricted(user)`: true only when
`user.workshop_id` is set AND role is not `admin`/`ceo`/`operations`/`logistics`) already
naturally supports both scopes Payroll needs, via a mechanism already proven in production:
**scope is controlled by whether a user account has a `workshop_id` assigned at all, not by a
role hardcode.** This is exactly how `finance` already reviews Procurement invoices
company-wide today (Procurement invoices are explicitly "finance-level, unscoped by design"
per an existing code comment) — a Finance/HR user with no `workshop_id` set automatically
gets unrestricted visibility under the existing idiom, with zero new logic required.

**Recommended default scoping** (to be confirmed as a business decision, not assumed):
workshop-scoped — individual attendance/casual-labour cost, per-workshop payroll cost
reporting; company-wide — the payroll period itself, the approval chain, consolidated payroll
reporting, and payslips. This mirrors the brief's own example split exactly.

## 11. Finance Integration

**No Finance/accounting module exists in this codebase.** A full schema search for
`finance|accounting|ledger|chart_of_accounts|gl_entries|journal` returned zero matches.
`finance` exists **only as a user role name**, used in Procurement's invoice/PO approval
chains (`PROCUREMENT_STAGE_ROLE.finance`, `ENTITY_ESCALATION_ROLES.procurement_invoice`) —
there is no chart of accounts, no journal, no ledger table anywhere.

The one thing that looks like Finance integration — the "Sage Reconciliation" desktop page
(`renderSage()`) — was read in full. It is **not a real accounting system integration**: it
CSV-exports the existing `weeklyCost` operational expense-category summary (budget vs.
actual) for someone to manually import into Sage accounting software externally. It proves,
however, exactly the pattern a Payroll→external-accounting handoff would use if ever needed:
reuse the same `downloadCsv()` helper to export payroll totals by category, formatted for
manual import — not a live API integration.

**This makes the decision largely made for us by the current architecture, not a genuine
three-way choice**: Option B (post accounting entries into an existing Finance module) and
Option C (integrate through an existing posting mechanism) are not available today — there is
nothing to post into. Building either would mean building a real accounting/ledger system
first, which is explicitly out of scope ("do not create a parallel ledger") and a much larger
undertaking than Payroll itself. **Option A (Payroll remains operational — produces reports
and a Sage-style CSV export only) is recommended as the only architecturally honest choice
until/unless the business separately decides to build real accounting infrastructure.**

## 12. Security

Payroll would reuse, without modification: `mustRole`/role-array checks (permission),
`isWorkshopRestricted` (scope), `logAudit` (immutable trail — the same `audit_log` table
already proven un-deletable/un-editable at the DB level), and Engine A/B as designed above
(preventing unauthorized mutation and duplicate action). Concurrency protection for "no
duplicate payroll run" would follow the exact pattern already proven live for Attendance's
own duplicate-prevention: a DB-level partial unique index (e.g.
`unique(period_id, user_id) where deleted_at is null`) plus `ON CONFLICT`, not
application-level locking — this was verified correct under real concurrent load in HR Phase
2 and should be the template again here. No new security primitive is needed; only new
tables/columns to apply the existing ones to.

## 13. Reporting

The existing reporting framework (functions returning `{ok, rows, summary}`,
`downloadCsv()` for export — used extensively and consistently, most recently extended for 6
reports in the ERP Final Enterprise Hardening phase) is directly reusable for every report the
brief lists: Payroll Summary, Employee Payslip, Casual Labour Summary, Earnings/Deductions
Summary, Payroll Cost by Workshop, Payroll Cost by Department, Payroll Period History, Payroll
Audit Report. One caveat found during this audit: "Payroll Cost by Department" would inherit
an existing data-quality limitation — `department` is a free-text field on both `app_users`
and `casuals` (no canonical list, no FK), so department-based aggregation would group on
whatever strings happen to have been typed, not a controlled vocabulary. Not a Payroll defect
— a pre-existing condition of the data it would report on.

## 14. Notifications

The existing `pushNotification`/automation-rule engine and both platforms'
`NOTIFICATION_ROUTES` registries (just extended and fully cross-verified in the ERP Final
Enterprise Hardening phase) are directly reusable. No notification event is implemented in
this phase — the 7 candidate events the brief lists (submitted, requires review, approved,
rejected, finalized, payment completed, correction) are catalogued as a decision table in the
Business Rules register, matching the same "document, don't invent" treatment Attendance
notifications received in the prior phase.

## 15. Desktop/Mobile Design (design only, nothing built)

**Desktop** (once approved): a Payroll Dashboard, Payroll Periods list, a Payroll Run
detail/calculation screen, per-employee Payroll detail, Earnings/Deductions editors, an
Approval screen (reusing the Engine B pattern's existing "pending stage" UI shape already
proven for Procurement), Reports, and a Payslip view/print — all following this codebase's
established `openOverlay`/list-page/permission-gate conventions.

**Mobile**: per the brief's explicit instruction not to blindly duplicate every desktop
admin screen, the recommended mobile surface is narrow: Payroll review/approval (for
roles that need to approve on the go, mirroring how Governance/Procurement approval already
work on mobile today), an employee's own payroll summary/payslip (self-service, read-only),
and notifications. Payroll Run *creation/calculation* and Deduction/Earnings *editing* are
desktop-only by design, consistent with how this codebase already treats other
administratively-heavy, rarely-mobile-urgent workflows (e.g., KPI Definitions, Casuals
Registry admin were previously classified desktop-only for the same reason).

## 16. Business Decisions

See `PAYROLL_ENTERPRISE_PHASE1_BUSINESS_RULES.md` for the full register — every TBD from the
brief's Priority 18 table, plus the additional decisions this discovery surfaced (casual
payment model source-of-truth, department canonicalization, national ID capture for
permanent staff, Engine B extension approval).

## 17. Implementation Roadmap (sequenced, contingent on approvals — not started)

1. Business Rules register resolved (all TBDs answered) — blocks everything below.
2. Schema: `payroll_config`, `payroll_periods`, `payroll_runs`,
   `payroll_earnings`/`payroll_deductions`, `payroll_payments`, `payroll_adjustments`; extend
   `procurement_approval_steps`'s `ENTITY_TABLE` with `payroll_period`.
3. Backend: period/run CRUD, earnings/deductions calculation (per approved formulas only),
   `_payrollBuildApprovalStages` (mirroring `_procBuildApprovalStages`), notification wiring.
4. Desktop UI, per §15.
5. Mobile UI (narrow scope), per §15.
6. Live verification with disposable data, exactly as every prior phase in this program.
7. A dedicated Finance-integration phase only if the business later decides real accounting
   infrastructure should be built — explicitly not bundled into Payroll itself.

## 18. Production Readiness

Not applicable yet — see the Payroll Readiness table at the end of this report. Nothing in
this phase is production-facing; all findings are discovery/design only.

---

## Static Verification

No source file was modified this phase (see the Changelog) — `node --check`/`npx tsc --noEmit`
were run as a sanity confirmation only, not because anything changed:

- `node --check db/services/data.js`, `renderer/app.js`, `db/migrate.js` — clean.
- `npx tsc --noEmit` across `mobile/` — clean.
- HR/Attendance/Casuals/Permissions/Governance/Notifications/Reporting are unaffected by
  definition, since no line touching any of them was written this phase.

---

## PAYROLL READINESS

| Area | Status |
|---|---|
| Employee model | 🟡 |
| Attendance integration | 🟡 |
| Casual Labour integration | 🟡 |
| Earnings | 🟡 |
| Deductions | 🟡 |
| Payroll lifecycle | 🟡 |
| Approval | 🟡 |
| Finance integration | 🟡 |
| Reporting | 🟡 |
| Notifications | 🟡 |
| Desktop | 🟡 |
| Mobile | 🟡 |

All areas are Yellow by design — this phase is discovery only. Every area now has a concrete,
evidence-based design proposal and an explicit list of the business decisions blocking it
(see the Business Rules register). Nothing was implemented. Nothing was committed or pushed.
Stopping here for business-rule approval, per the Stop Rule.
