# Payroll Enterprise Phase 3 — Gap Register

Two real bugs found and fixed this phase are documented in full in the Completion Report §2
and the Changelog (Workshop Isolation gap in `payrollLineList`; the date-formatting bug) — not
repeated here since they are resolved, not outstanding. This register covers what remains open.

---

## PH3-01 — Mobile Excel export covers 2 of 6 report types

- **Severity**: Low (scope/time, not a technical blocker).
- **Evidence**: `usePayrollExportExcel()` and the underlying REST route support all 6 report
  types identically to desktop; mobile UI only wires buttons for `periods` (Periods list
  screen) and `lines` (Period Detail screen, exports that period's lines).
  `summary`/`adjustments`/`approval`/`workshop` have no mobile entry point yet.
- **Impact**: A mobile user cannot export the Payroll Period Summary, Adjustments,
  Approval Status, or Cost-by-Workshop reports directly — they'd need desktop, or could
  approximate via the Lines export (which contains most of the same underlying data).
- **Recommended action**: Add the same header-action pattern already used for `periods`/`lines`
  to the relevant screens once/if a Payroll Summary or Reports screen is built on mobile —
  mechanical, since the hook and REST route already support it.
- **Requires approval**: No — pure UI completion, no business decision involved.

## PH3-02 — Mobile filter/sort UI is a new composite pattern, not a copied precedent

- **Severity**: Informational.
- **Evidence**: No prior mobile screen in this codebase had local search+filter-chips+sort-chips
  together; `SalesOrdersListScreen`/`CasualLabourListScreen` etc. only use `AppHeader`'s
  `searchModule` (a *global* cross-module search launcher, not a local list filter). The
  Payroll Periods list's search/chip row is therefore a new UI composite, built from existing
  theme tokens (`Colors`/`Spacing`/`Typography`/`Radius`) but without a structural precedent to
  copy verbatim.
- **Impact**: None functionally (fully live-verified via the underlying hook/REST params, and
  `tsc --noEmit` clean) — flagged only so a future UX-consistency pass knows this pattern
  exists and could be back-ported to other list screens, or reconciled if a different
  local-filter convention gets established first.
- **Recommended action**: None required now; revisit if/when a second mobile screen needs the
  same local search+filter+sort combination, to decide whether to extract a shared component.
- **Requires approval**: No.

## PH3-03 — `audit_log` `before`/`after` JSONB snapshots may still contain
  ISO-datetime-shaped dates from raw `Date` object serialization

- **Severity**: Low (forensic data only, not a live UI display).
- **Evidence**: `payrollPeriodDelete`'s `logAudit` call stores `before: period` where `period`
  comes from `_payrollPeriodGet` (raw row, deliberately left unformatted — see the Changelog).
  When this object is JSON-serialized into `audit_log.before_values`, a `Date` field
  auto-converts via `.toJSON()`/`.toISOString()`, so the stored snapshot's `start_date`/
  `end_date` will read as a full ISO datetime rather than a clean calendar date.
- **Impact**: Cosmetic only, and only visible to someone inspecting raw audit JSON directly
  (not through any UI built this phase or Phase 2, both of which display formatted dates). This
  exact pattern (`before: <raw row>`, dates-and-all) is the established convention across many
  other entities in this codebase already — not a payroll-specific defect, and consistent with
  how audit snapshots are treated everywhere else (a forensic capture of the DB row, not a
  polished display value).
- **Recommended action**: None — matches existing codebase-wide convention. Only worth revisiting
  if a future phase builds a UI that reads `before_values`/`after_values` directly for display
  (none currently does).
- **Requires approval**: No.

---

## Carried forward from Phase 1/2 (unchanged, still open)

Tax/PAYE, social security/RSSB, pension, loans/advances, overtime rules, allowance/bonus
formulas, real Finance/accounting ledger integration, and the specific 2-stage approval
hierarchy (currently a flagged V1 placeholder) all remain exactly as Phase 1/2 left them — see
those phases' own Gap Registers. Nothing in this phase touched any of them.
