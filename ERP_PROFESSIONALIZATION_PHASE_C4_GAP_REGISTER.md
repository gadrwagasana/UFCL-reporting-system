# Phase C4 — Finance Operations Center — Gap Register

## Reconciliation of the remaining backlog (Priority 0)

All remaining open items from `ERP_MASTER_PROFESSIONALIZATION_GAP_REGISTER.md` (after PR-01,
PR-19, PR-21, PR-22/23 resolved by C1-C3) reviewed and re-classified against current code:

| ID | Current classification | Note |
|---|---|---|
| PR-02 (Customers) | IMPLEMENTATION-READY | Re-checked live: production holds 1 customer row — real gap, low current urgency |
| PR-03–16 (14 export gaps) | IMPLEMENTATION-READY (individually) | 3 candidates (Finance Operations Center, Audit Log, Stock Movements) deep-audited this phase — see Selection Rationale |
| PR-17/18 (VAT/Poles batch lists) | IMPLEMENTATION-READY | Re-checked live: both tables hold 0 rows in production — real gap, zero current-data urgency |
| PR-20 (dashboard clickability, partial) | IMPLEMENTATION-READY | 5 dashboards remain (Executive/Procurement/Inventory/Logistics/Maintenance Officer); large multi-page scope, not selected this phase |
| PR-24 | SUPERSEDED / FOLDED | Already folded into PR-17/18, no independent action needed |
| PR-25–32 (P3 backlog) | IMPLEMENTATION-READY, lower priority | P3 severity, deferred per standard prioritization |
| PR-33 (Procurement pending-approvals count) | BUSINESS DECISION REQUIRED | Unchanged — still requires a decision about what status value a shared function persists; correctly not selected |

## Newly discovered finding (this phase's re-verification)

### NF-01 — Audit Log has zero Workshop Isolation, and the permission grant makes this a real, live gap
- **Type**: SECURITY FINDING (newly discovered — not in any prior gap register).
- **Area**: Admin / Audit.
- **Finding**: `auditList` (`db/services/data.js:2188`) never applies `isWorkshopRestricted`/
  `workshop_id` filtering of any kind — it is company-wide for every viewer who can reach the
  page. Cross-checked against `db/migrate.js`'s live role grants: the `'audit'` page permission
  is held not just by `admin`/`ceo` but by a wide set of operational roles including
  `storekeeper`, `sales`, `logistics`, `finance`, and the large block of workshop-scoped
  leader/supervisor roles (lines 795-864). Since many of those roles are genuinely
  workshop-scoped (`isWorkshopRestricted` does not exempt them), a workshop-restricted
  storekeeper or supervisor can currently view audit rows describing changes made at every
  *other* workshop too — not just their own.
- **Why this was investigated but NOT fixed this phase**: `audit_log` has no `workshop_id`
  column at all (confirmed against both `db/schema.sql` and every `ALTER TABLE audit_log`
  statement in `db/migrate.js`). A correct fix requires knowing which workshop the *affected
  record* (not the acting user) belongs to — which, for a generic cross-module audit log, means
  either (a) adding a `workshop_id` column and populating it at every one of the many dozens of
  `logAudit(...)` call sites across the entire codebase, or (b) a per-module join at read time.
  Both are structural changes with a blast radius far beyond a single page — exactly the kind of
  "new capability requiring careful design" the Stop Rule says to document, not attempt as a
  quick fix. A heuristic half-measure (e.g., scoping by the *acting* user's workshop_id) would be
  actively wrong (would hide legitimate admin/ceo actions taken on behalf of the viewer's own
  workshop, and would not stop the underlying company-wide read) and was deliberately not built.
- **Disposition**: **DOCUMENTED, NOT FIXED — requires a dedicated, properly-scoped future phase.**
  Recommended approach for that future phase: add `workshop_id` to `audit_log` via the
  established `SOFT_DELETE_TABLES`-style migration pattern, populate it going forward by having
  `logAudit`'s callers pass it through (most already have `user`/entity context available), and
  backfill nothing historical (out of scope, matches this app's own "never silently correct
  historical data" convention). This is a real, well-evidenced, non-trivial finding — surfacing
  it is this phase's own contribution to the backlog, even though fixing it was correctly out of
  scope for a single-item phase.

## Selected item and disposition

### PR-15 — Finance Operations Center: sort_by/sort_dir fully backend-implemented and already sent by the frontend, but no UI ever changes them; no export despite being self-described as a reconciliation/export tool
- **Type**: UX GAP (the cleanest "backend richer than UI" pattern re-verified this phase).
- **Area**: Finance.
- **Finding** (re-verified against current code, not stale line numbers): `_finOpsState`
  (`renderer/app.js:20730`) already carries `sort_by: 'tx_date', sort_dir: 'desc'` and
  `_finOpsSearch()` (`app.js:20882`) already sends both to the backend on every request — but no
  UI control anywhere ever mutates them. The backend (`financeOperationsSearch`,
  `data.js:13342`) fully implements sort with a safe column allow-list
  (`['tx_date','amount','party','status']`). No export existed on this tab at all, despite the
  page's own stated purpose as a reconciliation tool (other Finance Center tabs — Reports, Sage
  Export — do have export).
- **Disposition**: **RESOLVED — Phase C4.** Table headers for Date/Party/Amount/Status made
  clickable (client click → mutate `_finOpsState.sort_by`/`sort_dir` → re-`_finOpsSearch()` — a
  pure frontend change, zero backend modification needed since the capability already existed).
  Added `financeOperationsExportExcel` (new backend function, thin wrapper around the existing
  `financeOperationsSearch` + the established `_payrollBuildExcelBuffer` helper — no new
  business logic, no new authorization logic, inherits `financeOperationsSearch`'s exact
  Workshop Isolation and permission gate by delegation) plus an Export Excel button on desktop.
  21/21 live checks passed, including proof that sort is genuinely applied server-side, that
  export row counts match the filtered list exactly, and that Workshop Isolation cannot be
  bypassed even via an explicit `workshop_id` override attempt.

## Why PR-15 was selected over the other 2 deep-audited candidates

- **Candidate: Audit Log (PR-16)** — re-verified to have a genuine, more significant issue (NF-01,
  above) than its originally-registered "missing export" finding, but the *correct* fix for that
  more significant issue was determined to be out of safe single-phase scope (schema change +
  every `logAudit` call site). Implementing only the export/pagination piece while leaving the
  freshly-discovered Workshop Isolation gap undisclosed would have been a worse outcome than
  selecting a different item and disclosing the finding plainly — which this phase does (NF-01).
- **Candidate: Stock Movements (PR-11)** — re-verified to have a *simpler* backend than its UI
  implies (client-side sort/filter over an already-capped 100 rows, no server-side capability at
  all) — the opposite of the "backend richer than UI" pattern this phase's scoring explicitly
  prioritizes. A proper fix would mean *building* new backend capability (server-side search/
  sort/pagination, mirroring Sales Orders' Phase C1 treatment), a larger and riskier scope than
  Finance Operations Center's "wire up what already exists."
- **PR-15 uniquely satisfied every scoring dimension**: real cross-departmental business impact
  (aggregates Sales/Procurement/Payroll data for Finance), the textbook "backend richer than UI"
  gap (zero backend risk — the sort capability was already built and even being sent by the
  client), already-correct and now re-verified Workshop Isolation, and full live-testability
  without any risk to production data (read-only search + export, one disposable QA account for
  the workshop-scoping test).
