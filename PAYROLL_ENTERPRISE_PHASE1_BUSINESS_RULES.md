# Payroll Enterprise Phase 1 — Business Rule Decision Register

Nothing in this file is a decision — it is the complete list of decisions that must be made,
by the business, before any Payroll calculation code is written. Every row states what was
found in the current system (if anything) and exactly what question needs an answer. No row
was pre-filled with a guessed answer, per the brief's explicit instruction.

## Core Decision Table (Priority 18)

| Decision | Current system evidence | Required answer |
|---|---|---|
| Employee salary model | No salary field anywhere on `app_users`. | Monthly fixed? Daily-rate-times-days? Something else? |
| Casual payment model | `casual_labour_requests` = headcount request only, zero rate. `casuals.salary_per_action` stored but never used, name suggests piece-rate. | Hourly (from Attendance)? Daily? Piece-rate/task-rate (matching the field's own name)? Per approved request? |
| Hourly rate | No hourly rate field exists for either employee type. | If any model uses hourly pay: where is the rate set, per person or per role/category? |
| Daily rate | No daily rate field exists. | Same as above, for daily-rate models. |
| Piece-rate model | `salary_per_action` implies this may be the real intended model for casuals. | What is an "action"? How is it counted/reported? By whom? |
| Overtime | Attendance has no overtime concept at all (flat clock-difference only). | Threshold (e.g. >8h/day)? Multiplier (1.5x/2x)? Who authorizes overtime? |
| Allowances | No field, no rule anywhere. | Which allowances exist (transport, housing, etc.)? Fixed or role-based? Taxable? |
| Bonuses | No field, no rule anywhere. | Discretionary or formula-based? Approval required? |
| Tax | No tax table anywhere. **Must not be guessed** — this is Rwanda PAYE and must come from an authoritative source (Rwanda Revenue Authority schedule), not invented. | Is tax withheld by this system, or handled entirely externally (Option A implication — see Finance Integration)? |
| Social contributions | No RSSB/social-security field or table anywhere. | Same question as Tax — withheld here, or external? |
| Pension | No field. | Same as above. |
| Loans/advances | No table anywhere. | Does UFCL give salary advances/loans today (even informally)? If so, how are they currently tracked, and should Payroll deduct repayments? |
| Absence deductions | Attendance has `Absent`/`Half Day`/`Leave` statuses but zero payment linkage. | Does an unapproved absence reduce pay? By how much? Does approved Leave still pay? |
| Payroll period | No period concept exists (Attendance is per-day only). | Monthly? Weekly? Something else — and does it vary by employee type (monthly staff vs. casuals)? |
| Cutoff | Not defined. | How many days before period-end does attendance data lock for calculation? |
| Payment date | Not defined. | Fixed day of month? Varies? |
| Payroll preparer | No `hr` role exists. Closest analog: `ATTENDANCE_ROLES` (`admin`/`ceo`/`operations`/`supervisor`). | Who actually prepares a payroll run — one of these roles, or a new dedicated role? |
| Payroll reviewer | Not defined. | Separate from preparer, per the brief's workflow? Who? |
| Payroll approver | `finance` role exists today (Procurement invoice sign-off) but has no visibility into Attendance/Casuals pages currently (`ROLE_PAGES.finance` excludes them). | Does Finance approve payroll? If so, its page permissions need extending (see Gap Register). |
| Payroll finalizer | Not defined. | Same person as approver, or a separate finalization step (per the brief's suggested lifecycle)? |
| Finance integration | No Finance/accounting module exists at all (see Discovery Report §11). Only a Sage-CSV-export precedent (`renderSage`) exists, not a live integration. | Confirmed default recommendation: Option A (operational only, CSV export). Confirm, or commission a separate accounting-infrastructure project first if B/C is truly wanted. |
| Workshop scope | `isWorkshopRestricted` already supports both scopes via whether a user account has `workshop_id` set (see Discovery Report §10) — no new logic needed either way. | Which specific Payroll entities are workshop-scoped vs. company-wide? (Recommended split stated in Discovery Report §10 — needs confirmation, not assumed.) |
| Payslips | No payslip concept exists anywhere. | Required from day one, or can Payroll ship reports-only initially? Desktop-only, or mobile self-service too (recommended in Discovery Report §15)? |
| Payroll notifications | See the event table below. | Per-event: build now, later, or never? |

## Earnings — Per-Category Detail (Priority 5)

For each candidate earnings category, the brief requires Source / Calculation method /
Approval requirement / Taxability / Payroll inclusion rule. None of these are answerable from
current code — every cell below is **BUSINESS DECISION REQUIRED**:

| Category | Source | Calculation | Approval | Taxable? | Included by default? |
|---|---|---|---|---|---|
| Basic salary | TBD | TBD | TBD | TBD | TBD |
| Daily wages | TBD | TBD | TBD | TBD | TBD |
| Casual labour | TBD (see Casual payment model above) | TBD | TBD | TBD | TBD |
| Overtime | TBD | TBD | TBD | TBD | TBD |
| Allowances | TBD | TBD | TBD | TBD | TBD |
| Bonuses | TBD | TBD | TBD | TBD | TBD |
| Production incentives | TBD — no linkage exists today between any production module (Sawmill/Poles/VAT output) and a payable incentive | TBD | TBD | TBD | TBD |
| Other earnings | TBD | TBD | TBD | TBD | TBD |

## Deductions — Per-Category Detail (Priority 6)

Per the brief: **do not implement statutory calculations until the exact applicable rules are
approved; the system must not guess tax rates or statutory percentages.** No deduction
category below has an existing rate or rule anywhere in the codebase:

| Category | Applicable? | Rate/rule source | Notes |
|---|---|---|---|
| Tax (PAYE) | TBD | Must come from Rwanda Revenue Authority's official schedule, never invented | Confirm whether this system withholds tax or only reports gross figures to an external payroll processor |
| Social security (RSSB) | TBD | Must come from RSSB's official schedule | Same external-vs-internal question as Tax |
| Pension | TBD | TBD | May overlap with RSSB depending on Rwanda's current scheme |
| Health insurance | TBD | TBD | |
| Loans | TBD | N/A — depends on whether UFCL tracks loans today (see Core Decision Table) | |
| Salary advances | TBD | N/A | Same as Loans |
| Absence deductions | TBD | Depends on the Payroll period + rate-model decisions above | |
| Other deductions | TBD | TBD | |

## Attendance-Specific Notification Events (Priority 16, carried forward from `[[project_erp_final_enterprise_hardening]]`'s FH-02, extended for Payroll)

| Event | Trigger | Recipient | Threshold | Severity | Platform | Deep-link |
|---|---|---|---|---|---|---|
| Payroll submitted | Preparer moves a run to Review | Reviewer role (TBD) | Immediate | Info | Both | Payroll Run detail (screen TBD) |
| Payroll requires review | Same as above, from the reviewer's perspective | Reviewer | Immediate | Amber | Both | Same |
| Payroll approved | Approver signs off | Preparer + Finalizer (TBD) | Immediate | Info | Both | Same |
| Payroll rejected | Approver rejects | Preparer | Immediate | Amber | Both | Same |
| Payroll finalized | Status → Finalized | Preparer, HR/Finance | Immediate | Info | Both | Same |
| Payroll payment completed | Payment recorded | Employee (self), HR | Immediate | Info | Mobile (employee self-service) + Desktop | Payslip (screen TBD) |
| Payroll correction | An adjustment is recorded post-finalization | Affected employee, HR/Finance | Immediate | Amber | Both | Same |

None of these are implemented. All require the lifecycle/role decisions above to be resolved
first — the trigger/recipient columns here are placeholders describing what *would* fire once
the underlying entities and roles exist, not commitments.
