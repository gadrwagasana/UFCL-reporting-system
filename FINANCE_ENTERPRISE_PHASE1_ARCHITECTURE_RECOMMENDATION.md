# Finance Enterprise Phase 1 — Architecture Recommendation

This document evaluates the three integration options the brief specifies (Section 11) and
makes an evidence-based recommendation, grounded entirely in the findings of the companion
Discovery Report and Gap Register. No code was written to produce this recommendation.

---

## Option A — Operational Finance Only

**Reports + cost tracking + revenue tracking + receivables/payables summaries + Excel/CSV. No
General Ledger.**

### What this would mean concretely

- Extend, don't replace, the existing scattered reporting (Sales revenue, Sawmill COGS/margin,
  Procurement spend, Fleet cost, Inventory valuation) with the pieces confirmed missing in the
  Gap Register: an AR summary (customer balance, derived from orders minus payment status), an
  AP summary (supplier balance, derived from invoices minus payments), and — once FIN-02/FIN-03
  are resolved as business decisions — genuinely trustworthy cost inputs.
- Every new report would be **read-only, derived at query time from existing operational
  tables** — exactly the pattern already proven repeatedly this session (Payroll's 6 reports,
  all built this way; Sawmill's reconciliation reports; Procurement's spend analytics).
- Excel export (the `_payrollBuildExcelBuffer`/`exceljs` infrastructure built for Payroll
  Phase 3) is directly reusable — it was built generic on purpose.
- No new approval engine, no new data-integrity risk beyond what already exists.

### Why this is recommended

It is the **only option with an existing foundation to build on**. Every piece of it —
permissions, Workshop Isolation, the reporting/export framework, even the approval engine that
would gate an AR/AP write action if one were ever added — already exists and has been proven
correct across many departments this session. It directly closes the two highest-value,
best-evidenced gaps (FIN-05 AR/AP summaries) without requiring the business to first commit to
a multi-month accounting-system build.

## Option B — Native Accounting Engine

**Chart of Accounts + Double Entry + Journals + General Ledger + Trial Balance + Financial
Statements + Period Closing.**

### What this would actually require

Everything in FIN-01 does not exist: no Chart of Accounts, no journal table, no posting
mechanism, no period-locking concept, no financial-statement generation. Building this
properly means:

- Designing a real Chart of Accounts (account types, hierarchy, currency) — a domain-modeling
  exercise this ERP has never done before.
- A journal-entry engine enforcing debits = credits, with immutability/reversal rules distinct
  from (and stricter than) `audit_log`'s existing "never delete/update" guarantee — journals
  need controlled REVERSAL entries, not just an audit trail of who changed what.
- Deciding how EVERY existing operational event (a sale, a goods receipt, a payroll close, a
  stock movement) maps to a journal posting — a substantial design exercise per module, not a
  mechanical translation.
- Period locking, Trial Balance derivation, and financial-statement generation logic — none of
  which has any precedent anywhere in this codebase.

### Why this is not recommended as a starting point

This is not "add a table" — it's building a second, parallel system-of-record for money that
every other module would need to correctly and consistently feed. The Payroll program (three
full phases, this session) is the closest precedent for "build a new enterprise capability
from scratch" in this codebase, and Payroll is a fraction of this scope — Option B would
plausibly take longer than Payroll Phases 1-3 combined, and unlike Payroll, there is no
existing "closest analog" pattern (Payroll had Attendance/Casuals/`procurement_approval_steps`
to build on; a GL has nothing comparable here). **Not ruled out as a future decision** — but
the evidence does not support it as the next step.

## Option C — External Accounting Integration

**ERP operational data → controlled export/API → external accounting system (e.g. Sage).**

### What actually exists today to integrate with

Nothing. "Sage Reconciliation" (confirmed this phase, live) is a CSV export button reusing
`weeklyCostReport`'s query — no API client, no Sage SDK, no credentials, no scheduled sync, and
its underlying data table currently has zero rows. There is no existing integration surface to
extend; Option C would mean building a genuinely new export/API pathway from nothing, and
critically, **deciding what data it should even carry is blocked on the same Option A/B
question** — you cannot design a "controlled accounting export" without first knowing whether
the source of truth is operational summaries (Option A) or a real ledger (Option B).

### Why this is not recommended as a starting point

Not because external integration is a bad idea in general, but because it is **premature** —
there is nothing substantive to integrate yet, and the business hasn't indicated Sage (or any
specific platform) is the actual target beyond an unused CSV button. If/when Option A produces
trustworthy operational reports, a *much* smaller, well-scoped "export these reports in
Sage's expected import format" enhancement becomes realistic — reusing the exact CSV/Excel
infrastructure already built, not a new integration architecture.

---

## Recommendation

**Adopt Option A now. Do not commit to Option B or C without a separate, explicit business
decision — the evidence in the Discovery Report does not support either as the next step.**

This is not a permanent choice — Option A is fully compatible with a later Option B if the
business eventually wants a real GL (Option A's reports would simply become read-only "front
end" views over the future GL's data, not wasted work). It is the option that:

1. Closes the two highest-confidence, best-evidenced gaps (FIN-05's AR/AP summaries) with the
   least engineering risk.
2. Requires zero new approval-engine, Workshop-Isolation, or audit-architecture decisions —
   every mechanism it needs already exists and is proven.
3. Does not require the business to resolve deep accounting-domain questions (Chart of
   Accounts design, posting rules) before any value is delivered.
4. Directly surfaces (rather than hides) the data-quality gaps already found (FIN-02/FIN-03) —
   an Option-A report built honestly on top of placeholder cost data would need to say so,
   which is itself a forcing function toward getting those approved.

## Approval Architecture Fit (Section 8, engineering conclusion)

If Option A produces any entity that needs a business-process sign-off (e.g. an AR/AP
adjustment, a manual cost-correction entry), the evidence points to reusing
`procurement_approval_steps`/`procurementApprovalAction` (Engine B in this codebase's existing
two-engine vocabulary) — exactly as Payroll did this session, the first-ever reuse outside
Procurement. `pending_edits`/`applyGovernance` (Engine A) remains correctly reserved for
ad-hoc edit/delete of ordinary records. **This is stated as an engineering fact, not a
decision** — WHICH specific Finance actions require approval at all remains an explicit
business-policy question (Gap Register, "business decision required" column), not decided
here.

## Data Model (Section 9, what's reusable)

No table is proposed for creation in this phase. If Option A is approved, the natural
next-phase design (not built here) would be:

- **AR summary**: a read-only report function joining `sales_orders`/`customers`, deriving
  "owed" as `sum(total where payment_status != 'Paid')` per customer — no new table, matching
  exactly how Payroll's own reports were built on Attendance without a new schema.
- **AP summary**: similarly, joining `procurement_invoices`/`procurement_payments`/
  `procurement_suppliers`, deriving "owed" as `invoice_amount − sum(approved payments)` per
  supplier — this WOULD need FIN-06 (duplicate-payment gap) addressed first, or the summary
  itself would inherit that inaccuracy.
- Everything else (Excel export, Workshop Isolation, permissions, audit) reuses existing
  infrastructure verbatim.

## Critical Controls (Section 12, carried from the Discovery Report)

The one genuinely dangerous current behavior found is FIN-06 (duplicate-payment gap) — not
fixed this phase per the Stop Rule, but flagged as independently fixable without waiting for
any Finance architecture decision, since it's a Procurement data-integrity issue, not a
Finance-scope question.

---

## Final Answers (Section 16 closing questions)

1. **What Finance already has**: scattered, mostly-correct operational cost/revenue reporting
   across Sales, Procurement, Inventory, Sawmill, and Fleet; a manual weekly-expense
   budget tracker; a CSV export mislabeled as "Sage integration"; a narrowly-scoped `finance`
   role that can review Procurement invoices/payments and see 3 cost-report pages.
2. **What Finance does not have**: General Ledger, Chart of Accounts, journals, double-entry,
   Trial Balance, Balance Sheet, Income Statement, Cash Flow Statement, Accounts Receivable,
   Accounts Payable, bank/cash reconciliation, financial-period closing, fixed-asset/
   depreciation accounting, any real external accounting integration.
3. **What is broken**: nothing is "broken" in the sense of a regression — but FIN-03's Weekly
   Cost system is functionally dead (zero production data despite full UI), and FIN-06 is a
   real, live data-integrity gap in Procurement payments.
4. **What is backend-only**: nothing significant found — every backend capability audited had
   corresponding desktop UI at minimum.
5. **What is UI-only** (UI exists implying more than the backend delivers): the Weekly
   Cost/Monthly/Sage pages, which look like functioning budget/reconciliation tools but are
   backed by an empty, disconnected table.
6. **What requires business decisions**: the core Option A/B/C choice (FIN-01); approving real
   `standard_cost`/`default_price` values (FIN-02); the future of the Weekly Cost system
   (FIN-03); whether Sage integration is genuinely wanted (FIN-04); AR/AP summary scope
   (FIN-05); which Finance actions need approval at all (Section 8).
7. **Recommended Finance architecture**: Option A (Operational Finance), explicitly not
   foreclosing a future Option B.
8. **Recommended implementation phases** (if approved): Phase 2 — AR/AP summary reports
   (FIN-05) + Excel export reuse; Phase 3 (or bundled) — resolve FIN-02 (cost approval,
   business action, not engineering) and FIN-03/FIN-04's future (business decision on Weekly
   Cost's redesign or retirement); FIN-06 can be fixed independently at any point.
9. **Production risks**: FIN-06 (duplicate-payment gap) is the one item with genuine
   real-world risk if Procurement payment volume grows; everything else is a capability gap,
   not an active risk.
10. **Exact next step**: present this Discovery Report, Gap Register, and this Architecture
    Recommendation for business review. Per the Stop Rule, do not begin Finance Phase 2 (or
    any implementation) until Option A is explicitly approved and FIN-02/FIN-03/FIN-05's
    scope questions are answered.
