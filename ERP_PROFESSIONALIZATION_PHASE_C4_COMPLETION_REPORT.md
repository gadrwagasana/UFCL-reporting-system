# Phase C4 — Finance Operations Center — Completion Report

Companion files: `_GAP_REGISTER.md` (every finding, classified, including one newly-discovered
security finding), `_CHANGELOG.md` (exact file-by-file diff summary).

## 1. Current Backlog Audit

Read `ERP_MASTER_PROFESSIONALIZATION_GAP_REGISTER.md` plus the Phase C1/C2/C3 gap registers
(Priority 0). Of the original 24 P2 findings, 6 already resolved across C1-C3 (PR-01, PR-19,
PR-20-partial, PR-21, PR-22, PR-23). Remaining open: PR-02, PR-03–16 (14 export gaps), PR-17/18,
PR-20 (5 dashboards remaining), PR-24 (superseded/folded), plus 8 P3 items and PR-33 (still
correctly blocked on a business decision).

## 2. Priority Ranking

Three candidates from the PR-03–16 export-gap set were deep-audited against **current** code
(not stale line numbers) before ranking: **Finance Operations Center (PR-15)**, **Audit Log
(PR-16)**, **Stock Movements (PR-11)**. Full comparison table in the Gap Register. Finance
Operations Center ranked highest on the scoring framework: cleanest "backend richer than UI"
gap (sort fully implemented server-side and already sent by the client, simply never triggered
by any UI control), real cross-departmental business impact, already-correct Workshop Isolation,
zero backend risk, and full live-testability with no risk to production data.

## 3. Selected Item

**PR-15 — Finance Operations Center.**

## 4. Selection Rationale

See Gap Register "Why PR-15 was selected over the other 2 deep-audited candidates" for the full
reasoning. In summary: Audit Log's deep-audit surfaced a more significant issue than its
registered finding (a real Workshop Isolation gap, NF-01) — but the correct fix for that requires
a schema change spanning every audit-writing call site in the codebase, which is out of safe
scope for a single-item phase, so it was documented rather than partially/riskily fixed. Stock
Movements turned out to have a simpler backend than its UI implies (no sort/search capability at
all, unlike what its client-side-sortable headers suggest), meaning a proper fix means *building*
new backend capacity — a larger, riskier scope than Finance Operations Center's "wire up what
already exists."

## 5. Backend/UI Parity

| Capability | Backend | IPC | Desktop | Mobile | Permission | Audit | Export |
|---|---|---|---|---|---|---|---|
| Search/filter (search, date range, module toggle) | `financeOperationsSearch` | ✅ | ✅ (pre-existing) | N/A — intentionally desktop-only (pre-existing documented decision) | `_canAccessFinance` (admin/ceo/operations/finance/`finance-center` permission) | n/a (read-only) | — |
| **Sort** (tx_date/amount/party/status) | Already fully implemented | ✅ | ❌→✅ | N/A | same | n/a | — |
| **Export** | ❌→✅ new `financeOperationsExportExcel` | ❌→✅ | ❌→✅ | N/A | same (inherited) | n/a | ✅ Excel, respects all active filters |
| Transaction trace (drill-down) | `financeTransactionTrace` | ✅ (pre-existing) | ✅ (pre-existing) | N/A | same | n/a | — |

## 6. CRUD

Not applicable in the traditional sense — Operations Center is a read-only cross-module search/
reconciliation view over records that are created/edited/deleted through their own owning
modules (Sales Orders, Procurement, Payroll), each already covered elsewhere. No Create/Update/
Delete/Approve/Reject exists or was added here, correctly.

## 7. Search

Already complete (search box over reference/party) — confirmed working, unchanged.

## 8. Filters

Already complete (date range, source-module toggle chips) — confirmed working, unchanged.

## 9. Sorting

**Added.** Date/Party/Amount/Status column headers are now clickable, toggling
`sort_dir` on repeat clicks of the same column (matching the app's established sortable-header
convention) and re-querying the server — genuine server-side sort, not a client-side resort of
an already-fetched page. Module/Reference/Workshop intentionally left non-sortable — the
backend's own safe column allow-list doesn't support them, and no client-side workaround was
invented (would have silently only sorted the visible page, not the true result set).

## 10. Pagination

Not changed — the existing 500-row server cap was already reasonable for a reconciliation tool
and was not flagged as a problem in the original finding; out of this phase's selected scope.

## 11. Desktop

Added Export Excel button (matches the button styling/placement convention already used
elsewhere in Finance Center's Reports/Sage Export tabs) and sortable headers with a clear ▲/▼
indicator for the active sort. No loading-skeleton/error-state changes were needed — the
existing "Loading…"/error-message pattern in `_finOpsSearch()` was already present and adequate
for this page's shape (already correct, not touched).

## 12. Mobile

**Not applicable — confirmed intentional.** `mobile/src/hooks/useFinance.ts`'s own pre-existing
comment explicitly documents Operations Center as desktop-only ("large filterable tables / file
generation / a more deliberate action than a phone screen suits"). Verified this precedent
still holds and did not build a new mobile screen — matches the explicit instruction not to
create new capability where none was intended.

## 13. Permissions

Unchanged, re-verified live: `_canAccessFinance` (admin/ceo/operations/finance roles, or anyone
holding the `finance-center` permission) gates both search and the new export identically (the
export function delegates to search, inheriting the exact same gate — no duplicate/divergent
permission logic). Live-tested: a role with no finance access (`sawmill-leader`) is correctly
denied both.

## 14. Workshop Isolation

**Re-verified airtight, live.** Used a disposable QA account (role `finance`, `workshop_id=3`) —
a genuine, code-anticipated scenario since `isWorkshopRestricted` does not exempt the `finance`
role. Confirmed: the restricted user sees zero rows from any other workshop, correctly sees zero
company-wide-only rows (supplier invoices/payments — an existing, pre-this-phase design decision
to omit rather than leak those for restricted viewers), sees a subset of the unrestricted
admin's results, and — critically — **cannot override their own scope** even by explicitly
passing a different `workshop_id` in the filter payload. The new export function inherits this
exact scoping by delegation and was independently confirmed to match.

## 15. Governance

Not applicable — Operations Center has no approval workflow of its own (pure read/search/
export over records governed by their own owning modules).

## 16. Notifications

Not applicable — no notification fires for a search or export action; nothing to route.

## 17. Reporting

This *is* the reporting/reconciliation surface — the whole point of this phase's fix. Verified
the exported data matches the on-screen filtered results exactly (row-count and content), dates
are formatted correctly, and amounts are numeric (not text) in the generated `.xlsx`.

## 18. Data Integrity

Not independently re-derived this phase (no calculation logic was touched — `amount` is a
straight pass-through per source module, already correct from prior phases). Confirmed the
export's row count exactly matches the corresponding filtered search's row count in every test
case, proving no silent divergence between what's displayed and what's exported.

## 19. Concurrency

Not applicable — this is a pure read/export capability with no mutation, so none of the
duplicate-create/double-approval/race-condition concerns apply.

## 20. Live E2E Verification

Executed against production data via direct function calls. **21 of 21 checks passed**:

- Basic unrestricted search succeeds and returns the expected shape.
- Non-finance role denied both search and export.
- `sort_by=amount` ascending and descending — both independently verified to be genuinely
  sorted, not just accepted.
- A `date_from` far in the future correctly returns zero rows (date filtering works).
- `source_modules=['sales']` correctly returns only sales-sourced rows.
- Export succeeds; row count exactly matches the equivalently-filtered search; the returned
  buffer starts with the `PK` zip signature (a genuine `.xlsx`, not a stub).
- **Workshop Isolation**: a disposable QA `finance` account scoped to workshop 3 sees zero
  cross-workshop rows, zero company-wide-only rows, a subset of the unrestricted result, cannot
  override scope via an explicit `workshop_id` parameter, and its export independently confirms
  the same scoping.
- Regression: `financeDashboard` (a sibling Finance function, untouched) still works normally.

## 21. Regression Verification

`node --check` clean on every touched file. `npx tsc --noEmit` clean across the mobile project
(unaffected, no mobile files touched). No shared function (`financeOperationsSearch`,
`_payrollBuildExcelBuffer`, `_canAccessFinance`) was modified — only called. Sales Orders (C1),
CEO Overview (C2), and Automation Custom Rules (C3) were not touched by this phase.

## 22. QA Cleanup

One disposable QA account (`_qa_phaseC4_finance_gatare`) created and fully deleted; zero residue
confirmed by direct query. No production Finance data, sales order, purchase order, invoice, or
payroll record was created, modified, or deleted — this phase's entire test surface was
read-only search/export plus one throwaway account. Temporary test script deleted after the run.

## 23. Remaining Gaps

13 of the original 14 PR-03–16 export gaps remain open (Finance Operations Center, this phase's
selection, is now resolved). PR-02, PR-17/18, PR-20 (5 dashboards), and the P3 backlog remain
open, unchanged. **One newly discovered finding** (NF-01, Audit Log's lack of Workshop
Isolation) is now documented in the Gap Register for a future, properly-scoped phase.

## 24. Business Decisions

**None required for the selected item.** NF-01 (Audit Log Workshop Isolation) is not exactly a
"business decision" in the pricing/policy sense, but is flagged as requiring dedicated
engineering design (schema change + every `logAudit` call site) rather than a quick fix — see
Gap Register for the full reasoning. PR-33 remains the one item in the backlog genuinely blocked
on a business decision, unchanged by this phase.

## 25. Production Readiness

**Finance Operations Center is now professionally complete**: search/filter (already complete),
sort (now wired to already-correct backend capability), export (now built, matching the page's
own stated purpose), permissions and Workshop Isolation re-verified airtight. Per the Final Stop
Rule: **not starting Phase C5**, not selecting another department, no commit, no push.

**Files changed this phase**: `db/services/data.js`, `electron/main.js`, `electron/preload.js`,
`renderer/app.js`. No mobile files touched (correctly — Operations Center is desktop-only by
prior, confirmed-still-valid design).
