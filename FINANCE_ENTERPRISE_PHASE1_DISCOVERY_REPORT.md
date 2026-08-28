# Finance Enterprise Phase 1 — Discovery, Audit & Architecture

**Companion files**: `FINANCE_ENTERPRISE_PHASE1_GAP_REGISTER.md`,
`FINANCE_ENTERPRISE_PHASE1_ARCHITECTURE_RECOMMENDATION.md`.

This is a discovery/audit phase only. **No code was written, no migration run, no table
created, and no data was modified.** Every claim below is grounded in direct source-code
citation and/or a read-only production-database query executed this phase; anything not
independently verified is explicitly marked unverified.

---

## Executive Summary

**UFCL's ERP has no accounting system.** There is no General Ledger, no Chart of Accounts, no
double-entry bookkeeping, no Trial Balance, no Balance Sheet, no Income Statement, no Cash Flow
Statement, no Accounts Receivable, no Accounts Payable, no bank/cash reconciliation, and no
fixed-asset/depreciation tracking — confirmed definitively via `to_regclass()` against the live
production database: `journal_entries`, `general_ledger`, `chart_of_accounts`, `gl_entries`,
`trial_balance`, and `bank_accounts` all return `null` (no such table exists anywhere in the
schema).

What DOES exist is a set of genuinely useful **operational cost/revenue figures scattered
across departments** — Procurement spend tracking, Sales revenue-at-order-creation, Sawmill
COGS/margin, Inventory valuation, Fleet fuel/maintenance cost — all built on real, mostly
correct SQL formulas. But two systemic problems undermine treating any of this as "Finance":

1. **Several load-bearing cost inputs are placeholder data, not Finance-approved figures.**
   `products.standard_cost`/`default_price` (which every COGS/margin calculation in
   Sales and Sawmill depends on) literally contain the string `'PENDING APPROVAL (placeholder
   — Sawmill Phase 2 QA, not yet Finance-approved)'` in their approval-tracking columns —
   confirmed still true via a live query this phase. Every margin/profit figure downstream of
   this is formulaically correct but factually unreliable until Finance actually approves real
   values.
2. **A dedicated "Weekly Cost" budget-tracking system exists, looks fully functional (budget
   vs. actual, variance %, red/amber/green status), and is completely disconnected from every
   real transaction in the ERP** — it is 100% manually typed in via `expenseSubmit`, has zero
   automatic population from Procurement payments, Payroll costs, or any other module, and —
   confirmed live this phase — **currently has zero rows in production**. It has apparently
   never been used.

The "Sage Reconciliation" page, the only thing in the entire codebase resembling an external
accounting integration, is confirmed (again, this phase) to be nothing more than a CSV export
of this same, currently-empty `weekly_expenses` data — there is no API connection to Sage, no
automatic sync, and nothing to actually export today.

**Recommendation** (detailed in the companion Architecture Recommendation file): Option A
(Operational Finance — reports, cost/revenue tracking, receivables/payables *summaries*,
Excel/CSV) is the only evidence-supported starting point. Option B (build a native
double-entry accounting engine) is a multi-month undertaking with zero existing foundation to
build on. Option C (external accounting integration) has no real integration to extend —
"Sage integration" as currently understood is a manual CSV workflow, not a technical
integration point.

---

## 1. Full Financial Capability Audit (Section 3 keyword sweep)

A repository-wide search for every term in the brief's keyword list (finance, accounting,
revenue, payment, receivable, payable, expense, cost, COGS, margin, profit, cash, bank,
journal, ledger, debit, credit, account, chart of accounts, trial balance, balance sheet,
income statement, cash flow, tax, VAT, payroll, invoice, depreciation, asset, reconciliation,
Sage, export, etc.) across `db/schema.sql`, `db/migrate.js`, `db/services/data.js`,
`renderer/app.js`, and `mobile-api/routes/*.js` found:

- **Zero** occurrences of `journal_entries`, `general_ledger`, `chart_of_accounts`,
  `gl_entries`, `trial_balance`, `balance_sheet`, `income_statement`, `cash_flow`,
  `double-entry`, or accounting-sense `debit`/`credit` anywhere. Every occurrence of the word
  "ledger" in the codebase refers either to `stock_movements` (a QUANTITY ledger) or
  `procurement_approval_steps` ("generic multi-stage approval ledger" — a workflow-status
  table, explicitly NOT an accounting ledger, confirmed by direct inspection: no signed-amount
  column, no debit/credit pairing).
- Every occurrence of "reconciliation" (dozens) refers to OPERATIONAL/QUANTITY reconciliation
  (production input vs. output volume, fuel issued vs. consumed, attendance hours vs. payroll
  quantity) — never a financial/bank reconciliation. This is an important semantic trap: the
  word is used extensively and could easily be mistaken for financial reconciliation capability
  from a keyword search alone.
- "VAT" in this codebase means the **Nyanza Value-Added-Timber production department**
  (a manufacturing workshop), not Value-Added Tax. There is no tax-VAT calculation, remittance,
  or liability tracking anywhere.
- `tax_amount`/`tax_rate` exist only as flat, manually-entered fields on
  `procurement_purchase_orders`/`procurement_invoices`, used purely for PO/invoice total
  display — not a tax liability ledger, not linked to any real VAT rate table.
- `bank_account`/`bank_name` exist only on `procurement_suppliers` — supplier payment-routing
  contact info (like a phone number), not a company bank/cash account concept.
- `depreciation`/`fixed asset` (financial sense): zero matches. "Asset Management" appears
  only in a Mechanician-module comment referring to physical machine/equipment tracking, not
  financial fixed-asset accounting.
- `receivable`/`payable`: zero matches anywhere in `data.js` in a financial-balance sense.

## 2. Value Flow Tracing (Section 4)

| Chain | Financial consequence recorded? | Evidence |
|---|---|---|
| Sales → Customer → Order → Delivery → Payment | Revenue booked at **order creation** (`salesCreate`, immediate `quantity × unit_price`), regardless of delivery or payment status. Payment is a two-value flag (`Paid`/`Unpaid`) on the order row — no amount-paid, no partial payment, no payment method/date. | Sales/Customer agent audit, confirmed live: `sales_orders` has no `total_amount`/`amount_paid` column. |
| Procurement → Supplier → Requisition → RFQ → PO → Goods Receipt → Payment | `procurement_invoices`/`procurement_payments` exist (7 and 3 rows respectively, live) but do not aggregate into any supplier balance; the first approved payment marks an invoice fully `'paid'` regardless of amount — **partial payments are not actually modeled**, only recorded as isolated rows. Goods receipt is purely operational (quantity in, stock updated) — no monetary posting. | Procurement agent audit, confirmed live via row counts. |
| Inventory → Receipt → Movement → Consumption → COGS | `stock_movements.unit_cost` is a point-in-time snapshot (not FIFO/weighted-average) — live check: 11 of 13 movement rows have `unit_cost = null`. COGS is computed **at report-read time** (joining `products.standard_cost`), never at the transaction itself. | Inventory/Production agent audit + live query. |
| Production → Raw Material → Labour → Finished Product → Cost | **Zero cost dimension anywhere.** Sawmill/VAT/Poles/Harvest production tables track only quantities/volumes/hours — no labour cost, no machine cost, no raw-material cost per batch. `casuals.salary_per_action` (a Payroll rate) is never joined to any production record. | Inventory/Production agent audit. |
| Payroll → Period → Compensation → Payable/Expense | Payroll (built in the prior program phase) computes gross/net pay correctly but **posts nothing to any accounting record** — it is an operational HR calculator, not integrated with any expense/payable concept. Closing a payroll period is a workflow-status transition, not a financial-period close. | Direct knowledge from building Payroll Phases 1-3 this session; re-confirmed no `journal`/`ledger`/`gl_entries` reference exists in the Payroll module. |
| Maintenance → Labour/Parts/Fuel → Cost | Mixed: `fuel_logs` (vehicles) and `maintenance_records` have real cost columns and a real summing formula (`fleetDashboard`), but `fuel_logs` currently has **0 populated rows** and `maintenance_records` has **1** (RWF 150). `machine_fuel_logs` (chainsaws/machines) has **no cost column at all**. | Inventory/Production agent audit, live-corroborated. |
| VAT (Nyanza production) → Processing → Reporting | Reporting is quantity/reconciliation-based (input vs. output volume) — no cost dimension, no relation to tax. | Inventory/Production agent audit. |

## 3. Current Finance Reality — the 23-Question Checklist (Section 5)

| # | Question | Answer | Evidence |
|---|---|---|---|
| 1 | Real General Ledger? | **No** | `to_regclass('general_ledger')` → null (live) |
| 2 | Double-entry accounting? | **No** | No debit/credit pairing found anywhere in schema or code |
| 3 | Chart of Accounts? | **No** | `to_regclass('chart_of_accounts')` → null (live) |
| 4 | Journal entries? | **No** | `to_regclass('journal_entries')` → null (live) |
| 5 | Post debits/credits? | **No** | No mechanism exists |
| 6 | Trial Balance? | **No** | `to_regclass('trial_balance')` → null (live) |
| 7 | Balance Sheet? | **No** | No function/table found |
| 8 | Income Statement? | **No** (closest: ad-hoc revenue−COGS figures in Sales/Sawmill reports, not a formal P&L) | Sales/Inventory agent audits |
| 9 | Cash Flow Statement? | **No** | No function/table found |
| 10 | Accounts Receivable? | **No** | `customers` table has no balance/receivable column (live schema check) |
| 11 | Accounts Payable? | **No** | No supplier balance/payable aggregation anywhere (Procurement agent audit) |
| 12 | Payment ledger? | **Partial** — `procurement_payments` exists (3 rows) but no balance/reconciliation logic; Sales has no payment table, only a status flag | Both agent audits |
| 13 | Bank/cash reconciliation? | **No** | `bank_account` is supplier contact data, not a company account |
| 14 | Financial-period closing? | **No** (Payroll period closing is an operational workflow status, not a GL/financial-period close) | Direct knowledge + code inspection |
| 15 | Journal reversal? | **No** (no journals exist to reverse; `stock_movements` has an operational reversal pattern for quantity only) | Code inspection |
| 16 | Tax accounting? | **No** | `tax_amount` is a flat display field on POs/invoices only |
| 17 | Payroll accounting? | **No** | Payroll computes pay, posts nothing to any ledger |
| 18 | Inventory valuation? | **Partial** — real `qty × unit_cost` formula exists (`inventoryDashboard`), but cost-field coverage is incomplete for some categories | Inventory agent audit, live-corroborated |
| 19 | COGS accounting? | **Partial** — real formulas exist, but the `standard_cost` input is explicitly unapproved placeholder data | Inventory agent audit, live-corroborated ("PENDING APPROVAL" string) |
| 20 | Fixed-asset accounting? | **No** | Zero matches; "Asset Management" = physical machine registry, not financial |
| 21 | Depreciation? | **No** | Zero matches anywhere |
| 22 | Financial audit/reconciliation? | **No** for finance specifically (extensive OPERATIONAL/quantity reconciliation exists across Production/Fuel/Attendance-Payroll, but never a bank/GL reconciliation, since no bank/GL concept exists to reconcile) | Repo-wide "reconciliation" sweep |
| 23 | Does Sage integration actually exist? | **No — CSV export only**, and the underlying data table (`weekly_expenses`) currently has **zero rows** in production | `renderer/app.js`'s `renderSage()` (confirmed in a prior phase this session) + live row count this phase |

## 4. Finance UI/UX Parity Audit (Section 6)

Classified per the brief's A–I scheme. Full detail in the Gap Register; summary:

| Capability | Backend | Desktop | Mobile | Class |
|---|---|---|---|---|
| Weekly Cost (budget vs. actual expense entry) | `expenseSubmit`, `weeklyCostReport` | Yes | Yes (`WeeklyCostScreen`) | **A** — complete, but built on a currently-empty, disconnected data source (see Gap Register FIN-01) |
| Monthly Report | `monthlyReport`-family functions | Yes | Yes (`MonthlyScreen`) | A (same caveat) |
| Sage Reconciliation | reuses `weeklyCostReport` data | Yes | Yes (`SageScreen`) | A — but is a CSV export, not an integration (see §5) |
| Procurement Spend/Budget Analytics | `procurementSpendBudgetAnalytics` and siblings | Yes | Yes (via `ProcurementStack`) | A |
| Procurement Invoices/Payments | `procurement_invoices`/`procurement_payments` CRUD + approval | Yes | Yes | A for CRUD; **no AP balance report exists at all** (class **I** — new capability) |
| Sales revenue/COGS/margin report | `salesReport` | Yes | Not confirmed on mobile Sales screens | Desktop: A; Mobile: needs confirmation — flagged, not verified this phase |
| Customer statement / AR balance | — | **Does not exist** | **Does not exist** | **I** — new capability, not merely a UI gap |
| Inventory valuation (Total Value tile) | `inventoryDashboard` | Yes | Not confirmed | A on desktop; data-quality caveat (§3, Q18-19) |
| Fleet fuel/maintenance cost totals | `fleetDashboard` | Yes | Not confirmed | A on desktop; near-empty underlying data |
| Executive/CEO financial overview | `executiveDashboard`/`getCeoOverview` | Yes | Partial (Executive screen exists) | A structurally; figures inherit every data-quality caveat above |

## 5. Finance Roles (Section 7)

`ROLE_PAGES.finance` = `['dashboard', 'weekly-cost', 'monthly', 'sage', 'audit', 'export',
'notifications', 'changes', 'procurement-dashboard', 'procurement-requisitions',
'procurement-invoices', 'procurement-reports']` (`db/services/data.js:125`) — confirmed
current, unchanged by any prior phase this session.

**A genuine, notable finding**: despite `role_definitions`' own description text calling
`finance` a "Finance Manager... manage financial reports, approvals, and reconciliations"
(`db/migrate.js:604`), the role's *actual* page access is narrow — Procurement (dashboard,
requisitions, invoices, reports) plus the 3 cost-report pages above. It has **no access to
Sales, Customers, Inventory/Stock, Payroll, Attendance, or Casuals** — meaning today's
"Finance" role cannot see company revenue, customer balances, stock valuation, or payroll cost
at all. The role's description overstates its actual scope; this is a documentation/reality
mismatch, not a security bug (no evidence of unauthorized access — the opposite: the role is
under-scoped relative to its own description).

Mobile parity: `FinanceNavigator.tsx` mounts Overview/Reports/Procurement/MyRequests only —
**consistent** with the narrow desktop scope (no drift between platforms for this role,
confirmed by direct comparison).

`admin`/`ceo`/`operations` all have broader access (including `weekly-cost`, `monthly`, and
various dashboards) but are not Finance-specific roles — they're the general company-wide
privileged tier this codebase already establishes elsewhere. No other role
(`department-manager`, `supervisor`, etc.) has any Finance-report page access beyond
Procurement's own requisition-visibility grants.

## 6. Approval Architecture Evaluation (Section 8)

This codebase has exactly two approval-adjacent engines (established fact from this session's
own Payroll work, re-confirmed relevant here):

- **`pending_edits`/`deletion_requests` via `applyGovernance`** — a time-and-ownership-based
  *safety net* for ad-hoc edits/deletes of ordinary records by non-privileged/non-owning
  users. Reactive, generic, ownership-based.
- **`procurement_approval_steps` via `procurementApprovalAction`** — a genuinely generic,
  already-proven multi-stage *business-process* approval ledger (currently used by
  Procurement's requisitions/invoices/payments/POs, and — as of this session — Payroll
  periods, the first reuse outside Procurement).

**Finance already partially uses Engine B today** — `procurement_invoices`/
`procurement_payments` approval both go through `procurementApprovalAction` with `finance` as
a stage role. If/when Finance gains its own entities (e.g. a journal entry, an expense
approval, a period close), the evidence strongly suggests **Engine B is the correct fit**,
exactly as it was for Payroll — a deliberate business-process sign-off, not an ad-hoc edit
safety net. **This is an engineering fact, not a business decision**: which specific Finance
actions actually *require* approval (journals, payments, expenses, refunds, payroll, period
closing, reversals) is a business-policy question, explicitly not decided here, per the brief.

## 7. Finance Data Model — What's Reusable (Section 9)

Reusable without modification: `customers`, `procurement_suppliers`, `procurement_invoices`,
`procurement_payments`, `sales_orders`, `payroll_periods`/`payroll_lines`, `stock_catalog`
(cost fields), `stock_movements` (cost snapshot field), `audit_log`. **Completely absent**:
any ledger/journal/account table, any receivable/payable balance table, any bank/cash account
table, any tax-liability table, any fixed-asset/depreciation table. No table is created this
phase.

## 8. Finance Reporting Audit (Section 10)

See §4 table above for existing reports. Explicitly **absent**: Customer Balance report,
Supplier Balance (AP) report, formal Profit & Loss, Balance Sheet, Trial Balance, Cash Flow
Statement, formal Financial Reconciliation report. Every EXISTING report was checked for
Workshop filtering, permissions, date filtering — all follow this codebase's established
conventions correctly (`isWorkshopRestricted`, `mustRole`) where applicable; CSV export exists
for most (Weekly Cost, Sage, Procurement reports); **Excel export exists only for Payroll**
(built in the immediately prior phase) — no Finance-adjacent report has `.xlsx` export today.

## 9. Critical Control Requirements (Section 12)

- **Immutable audit trail**: exists and is proven (`audit_log`'s DB-level no-update/no-delete
  rule, established and load-bearing across many prior phases this session) — would extend
  correctly to any new Finance entity.
- **Duplicate-payment prevention**: **weak** — `procurementPaymentCreate` has no check
  preventing two payment rows against the same invoice; `procurementPaymentApprove` marks the
  invoice `'paid'` on the FIRST approved payment regardless of amount, meaning a second
  payment could still be created and approved with no system-level block. This is a real,
  live-confirmed gap (not fixed this phase — discovery only).
- **Duplicate-journal prevention**: not applicable (no journals exist).
- **Concurrent posting / approval concurrency**: Engine B (`procurement_approval_steps`) has
  proven, tested concurrency safety (partial unique indexes, `ON CONFLICT` patterns
  established across Attendance/Payroll) — would extend safely to Finance entities built the
  same way.
- **Financial-period locking**: does not exist (no financial period concept exists to lock).
- **Workshop Isolation**: proven, reusable pattern; the open question is which Finance data
  should be workshop-scoped vs. company-wide (a business decision, not decided here — mirrors
  the same question Payroll Phase 1 raised and resolved for its own domain).
- **Dangerous current behavior identified**: the duplicate-payment gap above. Documented, not
  fixed, per the Stop Rule.

## 10. Live Read-Only Verification (Section 13)

All verification this phase was read-only `SELECT`/`to_regclass()` queries against production.
No row was inserted, updated, or deleted. No QA account was created. No permission was
modified. Specific findings verified live and cited throughout: absence of all 6 core
accounting tables; `procurement_invoices` (7 rows, 1 paid) / `procurement_payments` (3 rows)
counts; `weekly_expenses` (0 rows); `products.standard_cost`'s placeholder-approval string;
`stock_movements.unit_cost` null-coverage (11/13); `customers` table's column list (no balance
field). Anything not listed as live-verified in this report should be treated as
code-inspection-only evidence (still reliable, but not independently cross-checked against
current production data this phase).

---

*(Executive Summary appears at the top of this document per the brief's request.)*
