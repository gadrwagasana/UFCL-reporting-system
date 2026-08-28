# Phase C8 — Procurement Operational Excellence — Completion Report

Companion files: `_CHANGELOG.md` (exact file-by-file diff summary), `_GAP_REGISTER.md` (full
findings, deferred items, business/user decisions).

## 1. Executive Summary

Procurement turned out to be the **most mature department audited in this entire C-series** —
76 backend functions, 9 fully-built desktop pages (each already with KPI strips, server-informed
search/filter/sort, a shared status-badge system, and in Suppliers' case a full lifecycle
governance + multi-supplier comparison tool), a working multi-stage approval engine
(`procurement_approval_steps`), Return-for-Revision and PO-Close-with-Shortage exception flows,
supplier intelligence/benchmarking/forecasting analytics, and a Settings screen for the CEO
approval threshold. **Four findings carried in this session's own memory as still-open — the
Pending Approvals KPI always reading 0, goods-receipt auto-inventory being unreachable in
practice, no Settings screen, and 3 missing notification events — were all independently
re-verified against current code this phase and found to be already resolved** by earlier,
unlogged work; the master register's PR-33 and a stale in-code comment were the only things
still claiming otherwise, and both are now corrected. Genuine new work this phase: **two real
Workshop Isolation gaps** (RFQ list/detail, Invoice list — both had zero workshop scoping despite
being joined to workshop-owning data) were found and fixed; **professional `.xlsx` export** was
built for all 6 major operational lists (resolving master register PR-03/04/05/06 plus 2 more
found live); the **Procurement Dashboard's KPI tiles were made clickable**, but only for viewers
who actually hold the destination page's permission — a live permission audit found the
dashboard is intentionally visible to many roles (sales, finance, department heads, production
leaders) who do **not** have access to the underlying operational pages, so blind drill-down
wiring would have produced a wall of "Access Denied" clicks for most viewers. The full
Requisition → RFQ → Quotation → Evaluation → PO → Goods Receipt → Inventory chain was proven
live, end-to-end, against production data. **A significant amount of un-cleaned QA residue from
earlier, unlogged phases was discovered in production tables (duplicated `_QA Supplier Ltd`/
`_QA Phase2B` requisitions, RFQs, invoices) — disclosed, not deleted, pending the user's decision.**

## 2. Backend Audit

76 `procurement*` functions in `db/services/data.js` across: Config (2), Suppliers + contacts +
contracts + performance (13), Requisitions + approval (7), RFQ/Quotations/Evaluation (7),
Purchase Orders (7), Goods Receipt (5), Invoices/Payments (7), Dashboard/Reports/Analytics (23),
Supplier Intelligence (5). Every list function was checked for permission gate, Workshop
Isolation, and filter/pagination support (full matrix in the Gap Register). IPC (`procurement-*`
channels, `electron/main.js`) and REST (implied via the same functions, mobile screens — see §20)
both fully mirror the backend 1:1 — no orphaned capability found on either transport.

## 3. CRUD Parity

Requisitions: full Create/Read(list+detail+history)/Update(draft + returned-for-revision only,
correctly not open-ended)/Cancel, all with audit. Suppliers: full CRUD + status lifecycle
(draft→pending_approval→active→suspended→blacklisted→archived) + soft-delete governance buttons
that change by current state (no "Blacklist" shown for an already-blacklisted supplier, etc.).
POs: Create is exclusively derived from an approved requisition + selected quotation (correctly
not a free-standing create — preserves the workflow), Update, Close-with-Shortage (a real
approval-gated cancellation path, not a raw delete). Goods Receipts: Create only, no
update/delete — correct, since a receipt is evidence of a physical event; corrections happen via
a second receipt against the same PO's remaining quantity, not an edit. No destructive operation
was found exposed beyond what the confirmed business workflow already calls for.

## 4. Requisitions

Full lifecycle confirmed live this phase (§25): Create (with per-line `stock_item_id`, disproving
the old "no form lets a user pick a stock item" finding) → Submit → multi-stage Approve/Reject/
Return-for-Revision → Resubmit (full item-snapshot revision history, `procurement_requisition_revisions`)
→ Approved → RFQ/PO. Desktop page has a 6-tile KPI strip, search, status filter, sortable columns,
a Recently-Viewed widget, and a Saved-Filters bar (a capability I haven't seen on any other
module's list page in this entire C-series). **Export added this phase.**

## 5. Approval Engine

Confirmed: no second approval engine exists or was created. `procurement_approval_steps` is
shared and generalized across requisition/PO/invoice/payment (and payroll_period, reusing the
same engine per this session's own established convention) via small per-entity-type status
lookup maps, not per-entity forks. **PR-33 re-verified and found already fixed**: `ENTITY_MID_STATUS`
correctly writes `'in_approval'` to the requisition row at each intermediate stage (a "Phase 2B
fix" already in the code, confirmed live against production data showing real `in_approval` rows
correctly counted by the dashboard's `requisitionsByStatus` query — 2 real rows, not 0). The
stale desktop comment claiming otherwise has been corrected (§9). Concurrency tested live (§23).

## 6. Suppliers

Full lifecycle audit confirmed: create/edit/status-lifecycle/soft-delete, contacts, contracts
(with a dedicated approve/renew flow), performance scoring, and a genuine multi-supplier
comparison tool (checkbox-select 2+, opens a side-by-side overlay). Fields present: name,
category, tax number, bank name/account, phone, email, address, rating, preferred flag,
blacklist flag + reason, notes, active/status. No workshop relationship — confirmed intentional
(suppliers are a company-wide master data set, matching the same pattern as the vehicle fleet).
No field gaps found against the brief's own checklist. **Export added this phase.**

## 7. RFQs

Create (from an approved requisition only — correctly enforces the workflow order) → Send to
Suppliers → track responses → view/compare. **Real Workshop Isolation gap found and fixed**: 
`procurementRfqList`/`procurementRfqDetail` applied zero workshop scoping despite RFQs being
derivable from their originating requisition's `workshop_id`; fixed by joining through that
relationship, matching the same "null = unscoped, not blocked" convention used everywhere else in
this file. Live-checked: no currently-active user holding `procurement-rfq` is workshop-scoped, so
this was a latent rather than actively-exploited gap — fixed anyway, not left for a future user to
discover. **Export added this phase.**

## 8. Quotations

Suppliers have no logins in this system — a Procurement Officer records received quotes on their
behalf (confirmed intentional, matches the codebase's own comment). Quotation submit → compare
(sorted by quoted amount) → select, with automatic rejection of the other quotations on the same
RFQ and RFQ closure. Live-verified this phase as part of the full E2E chain (§25). No pricing
formula was touched.

## 9. Quotation Evaluation

`procurementQuotationsCompare` is the evaluation surface — side-by-side list sorted by price,
including supplier rating/preferred/blacklisted flags for context. No separate "evaluation
record" persistence exists beyond the selection itself (which quotation was chosen, recorded via
`status='selected'` + audit log) — this matches the workflow as actually used; no gap found.
**`procurementBenchmark`** (Workstream 8's explicit "verify whether it is actually intended for
operational use" instruction) — found to be a real, already-consumed analytics function
(supplier price/delivery benchmarking), not a speculative/orphaned one; already has a frontend
consumer. No business-decision flag needed — it's operational, not speculative.

## 10. Purchase Orders

Full lifecycle: Generate (from requisition + selected quotation, `workshop_id` correctly
inherited from the requisition, not the generating user) → Update → Close-with-Shortage (a real,
threshold-gated approval chain reusing the same engine, per Exception Management Phase 3) →
receive. Status-driven KPI strip (Open/Shortage Pending/Closed with Shortage/Completed). **Export
added this phase.**

## 11. Goods Receipt

**Re-verified live, disproving the old "auto-inventory-update unreachable in practice" finding.**
Full E2E test (§25, Scenario A) proved: a PO generated from a requisition correctly inherits
`workshop_id`; a PO line item correctly inherits `stock_item_id` from the requisition line; goods
receipt creation correctly posts to `stock_levels` (+5 confirmed) and writes a `stock_movements`
row referencing the PO — all for a normal (admin-generated) PO, not requiring the receiving user
to be workshop-restricted. **Finished Poles QC gate confirmed intact and untouched**: a receipt
line whose stock item's catalog category is `'Finished Poles'` is still held at `qc_status =
'pending_qc'` and does **not** enter sellable inventory until `procurementGoodsReceiptInspect`
explicitly accepts it — read directly from current code, not assumed. No change was made to this
gate.

## 12. Inventory Integration

Confirmed live (§25): PO → Goods Receipt → (QC where required) → `stock_levels` posting →
`stock_movements` audit trail → PO status correctly reflects full/partial receipt. No duplicate
posting path found; the only stock-writing statement in `procurementGoodsReceiptCreate` is
gated per line item and per pole-QC-requirement, executed once inside the same transaction as the
receipt itself.

## 13. Search

Server-informed on every list (`filters` param already threaded through Requisitions/Suppliers/
POs/Invoices); client-side `applyProcListFilters` layered on top for instant re-filtering of the
already-fetched (≤200-row-capped) dataset — the same established pattern used across every other
module in this codebase, not a new one. No large dataset found where server-side search was
missing and needed.

## 14. Filtering

Status filters present on every list; Suppliers additionally has category/preferred/blacklisted
chip filters — the most filtered list in the app, confirmed by re-reading the code, not assumed
from the old audit doc's own claim. Workshop Isolation is applied inside the backend query
*before* any client-side filter ever sees the data (§22), so no filter can be used to escape it.

## 15. Sorting

`wireSortableTable` + `data-sort-key` headers present on all 6 list pages, the same shared
toolkit used everywhere else in this app — not duplicated.

## 16. Pagination

None of the 6 lists paginate — all are backend-capped at 200 rows with full client-side
rendering, matching this app's own "don't paginate an intentionally bounded dataset" convention
(explicitly endorsed by Workstream 15's own instruction). No list was found large enough to need
real pagination.

## 17. Excel Export

**New this phase.** One dispatcher (`procurementExportExcel(userId, listType, filters)`) covering
Requisitions, Suppliers, RFQs, Purchase Orders, Goods Receipts, and Invoices — each delegates to
its own already-correct List function for data **and** permission/Workshop-Isolation enforcement
(cannot drift from what the on-screen list shows), then only formats via the same styling
convention as every prior Excel export in this codebase. Resolves master register **PR-03**
(Purchase Orders), **PR-04** (Requisitions), **PR-05** (Suppliers), **PR-06** (Invoices), plus 2
more (RFQs, Goods Receipts) found to have the identical gap during this phase's own audit but not
previously registered. **Verified by reopening every generated workbook** (§25): correct sheet
names, headers, row counts matching the underlying list exactly, and (after one bug caught and
fixed during this phase's own testing — see Changelog) correct invoice amount values.

## 18. Dashboard

`procurementDashboard` + `procurementExecutiveDashboard` + `supplierIntelligenceDashboard` +
`srmDashboard` are all already correctly consumed and rendered (4 top KPIs, 7 supplier-
intelligence KPIs, spend/risk/performance panels, recent activity feed). **KPI tiles made
clickable this phase** — but conditionally: a live permission audit found `procurement-dashboard`
(view access) is held by 11 roles that do **not** hold the underlying list-page permissions
(sales, finance, department-manager, and every production-leader role can see the dashboard's
summary numbers but were never meant to browse Procurement's own restricted operational pages).
Each tile is therefore only rendered clickable for a viewer who actually holds that specific
target page's permission (`STORAGE.pages`, the same resolved-permission check
`renderProcurementSuppliers` already uses) — never unconditionally. "Total Procurement Spend"/
"Average Supplier Score" left non-interactive (dimensionless, no destination).

## 19. Notifications

**Re-verified live, disproving the old "3 events silently no-op" finding.** `invoice_approved`,
`invoice_rejected`, `payment_approved`, `payment_rejected` are all now defined in
`notifyProcurementEvent`'s `EVENTS` map (read directly from current code — all 4 present, not the
1-of-4 the old memory described). Every event carries a `module` key matching the exact
destination page's permission id, enabling correct per-record deep-linking (a documented, already-
built Phase 5 capability, re-confirmed still correct). No notification was invented this phase.

## 20. Mobile/Desktop Parity

`mobile/src/screens/procurement/` mirrors desktop's entity set (Requisitions with full create/
edit form including per-line `stock_item_id` selection — confirmed live via source read, not
assumed; RFQ, PO, Goods Receipt including a dedicated detail screen, Invoices). No unnecessary
tab was added this phase; the mobile Export capability was **not** built — see Gap Register for
why (mirrors this session's own established practice of not rushing a mobile-specific build
inside an already-large backend/desktop-focused phase).

## 21. Permissions

Live-audited against `role_definitions` (the authoritative runtime table). `procurement-officer`/
`procurement-manager`/`admin`/`ceo` hold every Procurement permission with no gaps.
`procurement-dashboard` is held by 11 further roles without the underlying list permissions —
confirmed intentional (a visibility-only tier), not a defect; drill-down wiring respects this
(§18). No permission was granted or widened this phase.

## 22. Workshop Isolation

Audited every list/detail function. **2 real gaps found and fixed** (RFQ list+detail, Invoice
list) — both had zero scoping despite being joined to workshop-owning data. Requisitions, POs,
and Goods Receipts already had correct, previously-verified scoping (Goods Receipt's own fix
dates to an earlier "ERP Final Enterprise Completion Gate" phase, re-confirmed still correct this
phase). Suppliers correctly have no workshop scoping (company-wide master data, no `workshop_id`
column). Live-tested: no currently active user is positioned to exploit either of the 2 gaps found
(no workshop-scoped user currently holds `procurement-rfq` or `procurement-invoices`) — fixed
anyway, not left latent.

## 23. Concurrency

Live-tested two scenarios: (1) two different authorized actors attempting simultaneous, opposite
decisions (approve vs. reject) at the same stage — the role-gate itself prevented the second actor
from acting on a stage not assigned to their role, so only one decision was processed; (2) the
more realistic race — the **same** authorized actor firing two simultaneous identical "approve"
calls (a double-click). Both calls reported success, but direct database inspection confirmed
**exactly one** approval-step row advanced and **exactly one** audit log entry was written — no
data corruption, no duplicate stage-advancement, no duplicate audit trail. One minor, non-
corrupting observation: the function's response doesn't distinguish "you decided this" from
"someone else already had" for the second caller — cosmetic, not a data-integrity issue, and
noted in the Gap Register rather than fixed under this phase's own time-boxing.

## 24. Data Correctness

Independently reconciled the full Requisition→PO→Goods-Receipt→Inventory chain live (§25):
requisition quantity/estimated price → PO quantity/unit price → received quantity → `stock_levels`
delta — all matched exactly (+5 in, +5 out on cleanup, net zero). PO status correctly reflects
partial vs. full receipt via a live aggregate (`procurement_po_items` vs
`procurement_goods_receipt_items`), not a stored, driftable counter. No soft-delete, duplicate-
counting, or date-boundary defect found in any function read this phase.

## 25. End-to-End Verification

**Scenario A (Standard Procurement) — run live against production, 17/19 checks passed** (the 2
failures were this test script's own incomplete cleanup ordering, fully remediated — see below,
not an application defect): Supplier created → Requisition created (with `stock_item_id`) →
Submitted → Approved through the full multi-stage chain → RFQ created → Sent to supplier →
Quotation submitted → compared → selected → PO generated (correct `workshop_id` and
`stock_item_id` inheritance confirmed) → Goods Receipt created → **inventory correctly posted
(+5), stock_movements row created, PO status correctly updated to received**. **Scenario F
(Concurrent Approval)** — see §23. Both scenarios' QA data were fully cleaned up and confirmed
zero residual rows (a supporting cleanup script had to be re-run once, due to an FK-ordering bug
in the disposable test script itself, not the application — confirmed via a direct FK dependency
query, then corrected). Scenarios B/C (Rejection/Return-for-Revision) were not run as fresh live
scenarios this phase, since both mechanisms were already extensively live-verified in the earlier
Exception Management Phase 2 session (per this session's own memory) and this phase's Scenario A
already exercises the same approval-decision code path (`procurementApprovalAction`). Scenario E
(Finished Poles QC) was verified by direct code inspection (§11) rather than a live run, since
running it would require a real Poles-category stock item and workshop fixture beyond this
phase's scope — the gate's logic was read directly and confirmed unchanged/intact.

## 26. Regression

`node --check` clean on all 4 touched files. `npx tsc --noEmit` clean across the mobile project
(no mobile file touched this phase — exit 0, run anyway per the regression requirement). No
shared function outside the Procurement backend/export surface was modified. `git status` shows
many other files as modified — confirmed via direct recollection of this phase's own edits (not
by trusting the diff) that these are **all** pre-existing, uncommitted work from earlier phases
this same session (nothing has been committed all session, consistent with every prior C-phase's
own report) — none were touched by Phase C8.

## 27. Remaining Gaps

- **QA residue from earlier, unlogged phases** — duplicated `_QA Supplier Ltd`/`_QA Phase2B`
  suppliers (4), requisitions (8), RFQs (4), invoices (6) sitting in production tables, never
  cleaned up. Not created by this phase; not deleted by this phase either — disclosed for the
  user's decision, matching this session's own established precedent for stray QA data found
  from earlier sessions (never unilaterally delete data this phase didn't create).
- **Mobile Excel export** — not built (desktop-only, matching the established precedent of
  scoping large builds to a dedicated future phase rather than rushing a parallel mobile build).
- **Minor concurrency response-semantics quirk** (§23) — cosmetic, not a data-integrity defect.
- All previously-open, unrelated master register items (PR-02, PR-07–14, PR-17/18, PR-20's
  remaining 2 dashboard instances, P3 backlog) — unchanged.

## 28. Production Readiness

**Procurement is production-ready and was already close to fully professionalized before this
phase.** This phase's real contribution: closed 2 genuine (latent) Workshop Isolation gaps,
built and live-verified professional Excel export across 6 lists, made the dashboard's KPI tiles
permission-aware-clickable, corrected stale documentation/comments that were causing the master
register to under-report the module's true state, and proved the full procurement-to-inventory
chain end-to-end live rather than relying on old, partially-outdated audit notes. Per the Stop
Rule: **not starting C9**, no commit, no push, no unrelated item touched, Finished Poles QC
untouched and confirmed intact, no second approval engine created, Sage/accounting untouched.

**Files changed this phase**: `db/services/data.js`, `electron/main.js`, `electron/preload.js`,
`renderer/app.js`.

**Business/user decisions requested**: (1) what to do with the pre-existing QA residue found in
production (§27) — leave, or clean up now that it's been identified; (2) none of this phase's own
work requires a decision — everything built was either a disclosed-safe fix or a directly-
requested capability with an existing, verified destination.
