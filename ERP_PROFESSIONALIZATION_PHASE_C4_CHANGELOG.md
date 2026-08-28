# Phase C4 — Finance Operations Center — Changelog

Scope: PR-15 from the master gap register — the Finance Operations Center's already-implemented
server-side sort was never wired to any UI control, and the tab had no export despite being
self-described as a reconciliation/export tool. Only this item was implemented. One additional
finding (Audit Log's lack of Workshop Isolation, NF-01) was investigated, confirmed real, and
explicitly documented as out of safe single-phase scope — not fixed, not silently dropped.

## Backend — `db/services/data.js`

- **`financeOperationsExportExcel(userId, filters)`** — new function. Thin wrapper: calls the
  existing `financeOperationsSearch` (inheriting its exact permission gate, Workshop Isolation,
  and 500-row cap unmodified) and formats the result via the existing generic
  `_payrollBuildExcelBuffer` helper. No new authorization logic, no new business logic.
- **`module.exports`** — added `financeOperationsExportExcel`.
- `financeOperationsSearch` itself — **unmodified**. Its `sort_by`/`sort_dir` handling was
  already fully correct; this phase only added a UI control to actually use it.

## IPC — `electron/main.js` / `electron/preload.js`

- Added `secureHandle('finance:operationsExportExcel', ...)`, base64-encoding the returned
  buffer for the IPC round-trip — identical pattern to `sales:exportExcel` (Phase C1) and
  `payroll:exportExcel`.
- Added `financeOperationsExportExcel` to the preload bridge.

## Desktop — `renderer/app.js`

- `_finRenderOperations()` — added an "Export Excel" button next to the existing Search button.
- `_finOpsSearch()` — table headers for Date/Party/Amount/Status are now clickable
  (`data-sort-col` + a click handler that toggles `_finOpsState.sort_by`/`sort_dir` and
  re-searches — the exact same toggle-on-same-column-else-reset-to-asc convention used
  elsewhere in this app, e.g. `wireSortableTable`). An arrow indicator (▲/▼) shows the active
  sort column and direction. Module/Reference/Workshop columns intentionally left
  non-sortable — the backend's own column allow-list (`['tx_date','amount','party','status']`)
  doesn't support sorting by them, and inventing client-side-only sort over a server-paginated
  500-row result would silently sort only the current page, not the true result set.
- Added `_finOpsExportExcel()` — the same base64→Blob→download helper pattern established in
  Phase C1/C2 (`_salesExportExcel`), calling the new IPC channel with the exact same filter
  state (`search`/`date_from`/`date_to`/`source_modules`/`sort_by`/`sort_dir`/`workshop_id`)
  currently driving the on-screen results — the export always matches what's visible.

## What was deliberately NOT changed

- No mobile changes — Finance Operations Center is intentionally desktop-only, already
  documented in `mobile/src/hooks/useFinance.ts`'s own comments (predates this phase): "large
  filterable tables / file generation / a more deliberate action than a phone screen suits."
  Confirmed this precedent still holds; did not invent a new mobile screen.
- No change to `financeOperationsSearch`'s own logic, permission gate, or Workshop Isolation —
  all were already correct; only re-verified live (see Completion Report §13).
- Did not attempt to fix Audit Log's Workshop Isolation gap (NF-01, found during this phase's
  candidate research) — determined to require a schema change plus updates across every
  `logAudit` call site in the codebase, out of safe scope for a single-item phase. Documented in
  the Gap Register instead of guessed at.
- No change to Module/Reference/Workshop column sortability (not backend-supported; not invented
  client-side).

## Verification

- `node --check` clean on `db/services/data.js`, `electron/main.js`, `electron/preload.js`,
  `renderer/app.js`.
- `npx tsc --noEmit` clean across the mobile project (unaffected — no mobile files touched).
- Live E2E test against production data: **21/21 checks passed** — see the Completion Report for
  the full scenario list, including proof that `sort_by=amount` asc/desc genuinely reorders
  results server-side, that export row counts exactly match the filtered on-screen result, that
  a non-finance role is denied both search and export, and — using one disposable QA account
  (role `finance`, workshop 3, deleted immediately after) — that Workshop Isolation is airtight
  even against an explicit attempt to override the scope via the `workshop_id` filter param.
- No commit made, no push — consistent with this session's established practice.
