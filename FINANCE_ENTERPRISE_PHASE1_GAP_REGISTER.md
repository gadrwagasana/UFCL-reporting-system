# Finance Enterprise Phase 1 — Gap Register

Format per the brief: ID / Severity / Department-System / Capability / Backend / Desktop /
Mobile / Permission / CRUD / Reporting / Security / Workshop Isolation / Evidence / Business
decision required / Engineering decision / Recommended phase / Production impact.

Severities: CRITICAL / HIGH / MEDIUM / LOW / INFO.

---

## FIN-01 — No General Ledger / double-entry / Chart of Accounts / financial statements exist

- **Severity**: CRITICAL (as a capability gap — not a defect; the system was never built to
  have this).
- **Department/System**: Finance (cross-cutting).
- **Capability**: General Ledger, double-entry posting, Chart of Accounts, journal entries,
  Trial Balance, Balance Sheet, Income Statement, Cash Flow Statement.
- **Backend**: Absent. **Desktop**: Absent. **Mobile**: Absent. **Permission**: N/A.
  **CRUD**: N/A. **Reporting**: Absent. **Security**: N/A. **Workshop Isolation**: N/A.
- **Evidence**: `to_regclass()` against production confirms zero matching tables
  (`journal_entries`/`general_ledger`/`chart_of_accounts`/`gl_entries`/`trial_balance` all
  null); zero code references anywhere in `db/schema.sql`/`db/migrate.js`/`db/services/data.js`.
- **Business decision required**: Yes — whether UFCL wants a native GL (Option B) at all, or
  prefers operational reporting only (Option A), or external accounting software (Option C).
  See the Architecture Recommendation file.
- **Engineering decision**: None yet — contingent entirely on the business decision above.
- **Recommended phase**: Finance Phase 2, IF Option B is chosen — a substantial, dedicated
  multi-phase build, not a quick addition.
- **Production impact**: None currently (nothing depends on this not existing) — but every
  "financial statement" a stakeholder might expect from an ERP does not exist and cannot be
  produced today.

## FIN-02 — COGS/margin/profit figures are built on unapproved placeholder cost data

- **Severity**: HIGH.
- **Department/System**: Sales, Sawmill, Inventory (cross-cutting via `products.standard_cost`).
- **Capability**: Cost of Goods Sold, Gross Margin, Profitability reporting.
- **Backend**: Present, formula correct (`sawmillManagerDashboard`, `salesReport`,
  `executiveDashboard` all join `products.standard_cost`). **Desktop**: Present.
  **Mobile**: Not confirmed this phase. **Permission**: Standard role gating applies.
  **CRUD**: N/A (read-only reports). **Reporting**: Present but unreliable input.
  **Security**: N/A. **Workshop Isolation**: Applied where relevant.
- **Evidence**: Live query this phase confirmed `products`' approval-tracking columns still
  literally contain `'PENDING APPROVAL (placeholder — Sawmill Phase 2 QA, not yet
  Finance-approved)'` — a fact already disclosed in a prior phase's completion report/gap
  register and independently re-confirmed still true today, not fixed since.
- **Business decision required**: Yes — Finance/Management must actually review and approve
  real `standard_cost`/`default_price` values for the 3 active manufactured products (and any
  future ones) before these figures should be treated as real.
- **Engineering decision**: None — no code change needed; this is purely a data-approval gap.
- **Recommended phase**: Immediate (business action, not an engineering phase) — the
  capability to record the value already exists; only the approved value itself is missing.
- **Production impact**: Every margin/profit figure shown anywhere in Sales/Sawmill/Executive
  dashboards today should be treated as illustrative, not authoritative, until this is
  resolved. This is not a new finding — carried forward and re-confirmed, not newly
  discovered.

## FIN-03 — "Weekly Cost" budget-tracking system is disconnected from all real transactions
  and currently has zero data

- **Severity**: HIGH.
- **Department/System**: Finance (Weekly Cost / Monthly / Sage Reconciliation pages).
- **Capability**: Budget vs. actual expense tracking.
- **Backend**: `expenseSubmit`/`weeklyCostReport` fully functional. **Desktop**: Yes.
  **Mobile**: Yes (`WeeklyCostScreen`). **Permission**: `weekly-cost` page, correctly gated.
  **CRUD**: Create/Read work; no evidence of Update/Delete for a submitted expense entry
  (not deeply audited this phase — flagged for Phase 2 if Option A is pursued).
  **Reporting**: Functional, correctly computes variance/status. **Security**: Standard.
  **Workshop Isolation**: Not applicable — this system has no workshop dimension at all.
- **Evidence**: Live query this phase: `weekly_expenses` has **zero rows** in production. The
  only INSERT path is the manual `expenseSubmit` function — nothing in Procurement, Payroll,
  Sales, or any other module ever writes to this table automatically.
- **Business decision required**: Yes — does UFCL actually want to use manual weekly expense
  entry as its cost-tracking method, or should "cost" instead be derived automatically from
  real transactions (Procurement payments, Payroll costs, fuel/maintenance costs)? The current
  system requires someone to remember to type in every expense by hand, and evidently no one
  has been doing so.
- **Engineering decision**: If the business wants automatic population, this requires
  connecting `weekly_expenses` (or a redesigned equivalent) to real transaction events —
  a genuine Finance Phase 2 engineering task, not a quick fix.
- **Recommended phase**: Finance Phase 2 (Option A track) — reconcile this system's actual
  purpose with the business's real expense-tracking needs before investing further in its UI.
- **Production impact**: The "Weekly Cost"/"Monthly" dashboards currently display all-zero or
  near-empty figures in production — anyone looking at them today sees an apparently-broken
  or unused report, not a data-entry backlog.

## FIN-04 — "Sage Reconciliation" is a CSV export, not an integration, and currently has
  nothing to export

- **Severity**: MEDIUM.
- **Department/System**: Finance.
- **Capability**: External accounting software integration (Sage).
- **Backend**: `renderSage()` reuses `weeklyCostReport`'s data (confirmed in a prior phase,
  re-confirmed this phase). **Desktop**: Yes (CSV export button). **Mobile**: Yes
  (`SageScreen`). **Permission**: `sage` page. **CRUD**: N/A. **Reporting**: CSV only, no
  Excel. **Security**: N/A. **Workshop Isolation**: N/A (same scope as Weekly Cost).
- **Evidence**: No API client, no Sage SDK/credential config, no scheduled sync job found
  anywhere in the codebase. The page's own function directly reuses `weeklyCostReport`'s
  query. Since FIN-03 confirms `weekly_expenses` has zero rows, this export currently produces
  an empty file.
- **Business decision required**: Yes — is a real Sage integration (API-based sync) actually
  wanted, or is a manual CSV-import workflow into Sage sufficient going forward? This directly
  determines whether Option C (external integration) is worth pursuing at all.
- **Engineering decision**: None yet.
- **Recommended phase**: Bundled with FIN-03's resolution (same underlying data problem).
- **Production impact**: Low — no evidence this export is actively relied upon (given the
  empty source data).

## FIN-05 — No Accounts Receivable (customer balance) or Accounts Payable (supplier balance)
  capability anywhere

- **Severity**: HIGH.
- **Department/System**: Sales/Customers (AR side), Procurement/Suppliers (AP side).
- **Capability**: Running customer/supplier balance, "amount owed."
- **Backend**: Absent — confirmed via live schema check (`customers` has no balance column)
  and code audit (no aggregation function exists on either side). **Desktop/Mobile**: Absent.
  **Permission**: N/A. **CRUD**: N/A. **Reporting**: Absent. **Security**: N/A.
  **Workshop Isolation**: N/A.
- **Evidence**: Procurement agent audit (this phase) confirmed `procurement_invoices`/
  `procurement_payments` are never aggregated into a supplier balance anywhere; Sales agent
  audit (this phase) confirmed `customers` carries no balance/receivable field and
  `customersOrders` sums order value ignoring `payment_status` entirely.
- **Business decision required**: Whether AR/AP summaries (Option A — simple, derived,
  reporting-only) are sufficient, or whether a real payable/receivable ledger (Option B
  territory) is wanted.
- **Engineering decision**: An Option-A-style AR/AP *summary report* (derived at read time
  from existing invoice/payment/order data, no new ledger) is straightforward to build once
  approved — directly analogous to how Payroll's own reports were built on top of existing
  Attendance data without a new engine.
- **Recommended phase**: A natural, well-scoped Finance Phase 2 candidate if Option A is
  chosen — likely the single highest-value, lowest-risk addition available.
- **Production impact**: Neither Sales nor Procurement staff can currently answer "how much
  does this customer/supplier owe us/are we owed" from the system — it must be done manually
  outside the ERP today.

## FIN-06 — Duplicate-payment prevention gap in Procurement

- **Severity**: MEDIUM.
- **Department/System**: Procurement (Invoices/Payments).
- **Capability**: Prevent recording more than one payment against the same invoice beyond its
  total.
- **Backend**: `procurementPaymentCreate` has no check preventing a second payment row against
  an already-paid invoice; `procurementPaymentApprove` marks the invoice `'paid'` on the FIRST
  approved payment regardless of the amount actually paid, meaning partial payments aren't
  reconciled and a duplicate/erroneous second payment isn't blocked by any system-level rule.
- **Desktop/Mobile**: Whatever UI exists inherits this backend gap (not separately audited for
  a client-side guard this phase).
- **Evidence**: Procurement agent audit, `data.js:22709-22741`, live-corroborated by
  `procurement_payments` (3 rows) vs. `procurement_invoices` (7 rows, 1 marked paid) — too
  little data to observe the gap in practice, but the code path is unambiguous.
- **Business decision required**: No — this is a data-integrity gap, not a policy question.
- **Engineering decision**: A future fix would sum existing approved payments against the
  invoice total before allowing a new one, and/or only flip to `'paid'` when the cumulative
  approved amount meets the invoice total — straightforward once prioritized.
- **Recommended phase**: Could be fixed as a standalone Procurement hardening item independent
  of the broader Finance program — does not require any Finance architecture decision first.
- **Production impact**: Low today (little payment volume observed), but a real risk if
  Procurement payment volume grows without this being addressed.

## FIN-07 — Fuel/maintenance/production cost data is real-formula but severely under-populated

- **Severity**: LOW (data-entry/adoption gap, not a code defect).
- **Department/System**: Fleet, Mechanician, Production (Sawmill/VAT/Poles/Harvest).
- **Capability**: Fuel cost, maintenance cost, production labour/machine cost tracking.
- **Backend**: Cost columns and summing formulas exist and are correct where data exists
  (`fleetDashboard`). **Reporting**: Functions correctly, output is just near-empty.
- **Evidence**: Live query corroboration this phase: `fuel_logs` (vehicle) 0 populated cost
  rows; `maintenance_records` 1 row (RWF 150). `machine_fuel_logs` (chainsaws/machines) has no
  cost column at all — a genuine capability gap, not just an adoption gap.
- **Business decision required**: Whether machine/chainsaw fuel cost tracking is wanted at all
  (would need a new column); whether production labour/machine cost per batch is wanted
  (would need new schema — a materially larger addition, not a quick column add).
- **Engineering decision**: Adding a cost column to `machine_fuel_logs` is small and
  low-risk once approved. Production-batch costing (linking `casuals.salary_per_action`,
  machine hours, and raw-material cost to a specific production batch) is a substantially
  larger design exercise.
- **Recommended phase**: Disclosed for a future phase's business-priority decision; not
  urgent given current near-zero data volume.
- **Production impact**: None currently observable (too little data to have caused a visible
  problem yet).

---

## Summary Table

| ID | Severity | Requires business decision | Requires new engineering | Blocking Finance Phase 2? |
|---|---|---|---|---|
| FIN-01 | CRITICAL | Yes | Yes (if Option B) | Yes — this is the core Option A/B/C decision |
| FIN-02 | HIGH | Yes (data approval only) | No | No — can be resolved independently |
| FIN-03 | HIGH | Yes | Depends on decision | No, but should inform Phase 2 scope |
| FIN-04 | MEDIUM | Yes | No | No — bundled with FIN-03 |
| FIN-05 | HIGH | Yes | Yes (moderate) | No — strong Phase 2 candidate either way |
| FIN-06 | MEDIUM | No | Yes (small) | No — independent of Finance architecture |
| FIN-07 | LOW | Yes | Yes (varies) | No |
