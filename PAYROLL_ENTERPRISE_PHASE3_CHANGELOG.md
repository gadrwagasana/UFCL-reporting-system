# Payroll Enterprise Phase 3 — Changelog

## Dependencies

- **New**: `exceljs` added to root `package.json` (Electron main process) **and**
  `mobile-api/package.json` (standalone Express server) — no `.xlsx`-capable library existed
  anywhere in this codebase beforehand (checked first). One new transitive advisory
  (`exceljs → uuid`, moderate, buffer-bounds-check issue) accepted rather than downgrading to
  an old `exceljs` release; not reachable by how this integration calls `exceljs` (no
  attacker-controlled buffer is ever passed to uuid generation here).

## Database — bug fixes (no schema change)

No migration this phase. Two real bugs fixed in existing query logic:

- **`payrollLineList`** — added the missing `isWorkshopRestricted` check (was reachable
  directly via IPC/REST without it, unlike every other Payroll function — see the Completion
  Report §2 for the full explanation).
- **Date-formatting bug** — `payrollPeriodList`, `payrollPeriodDetail`, `payrollLineDetail`,
  and `_payrollFetchAttendanceForPerson` all now use `to_char(col,'YYYY-MM-DD')` instead of
  returning the raw `date` column (which `pg` hands back as a JS `Date` object, confirmed live,
  matching the convention already used everywhere else in this codebase for exactly this
  reason). A new `_fmtLocalDate()` helper (local, not UTC, date getters — avoids an off-by-one
  day shift `.toISOString()` would introduce) was applied at the smaller number of call sites
  where a period object sourced from the internal `_payrollPeriodGet` helper (deliberately left
  returning a raw row, since it's used internally for date-range comparisons where a `Date`
  object is fine) gets embedded into a user-facing string: `payrollPeriodUpdate`'s audit
  before/after, `payrollPeriodDelete`'s governance `entityRef`, `payrollPeriodSubmit`/
  `payrollPeriodClose`'s notification payload, `notifyPayrollEvent`'s own normalization (covers
  the 4 event bodies reached via `procurementApprovalAction`'s shared `select *`), and
  `payrollExportExcel`'s 'summary' export title.

## Backend (`db/services/data.js`)

- **`payrollPeriodList(userId, filters)`** — added `search` (ILIKE on workshop name/notes),
  `sort_by`/`sort_dir` (fixed column allowlist: `PAYROLL_PERIOD_SORT_COLUMNS`).
- **`payrollLineList(userId, periodId, options)`** — new `options` param (previously
  2-arg only): `search` (person name), `person_type` filter, `sort_by`/`sort_dir` (allowlist:
  `PAYROLL_LINE_SORT_COLUMNS`). Plus the Workshop Isolation fix above.
- **New**: `_payrollBuildExcelBuffer({title, sheetName, columns, rows, filterSummary})` — the
  shared `.xlsx` workbook builder (title/date/filter header, styled header row, frozen pane,
  auto-filter, column widths/number formats).
- **New**: `payrollExportExcel(userId, reportType, params)` — dispatcher for the 6 export
  types (`periods`/`lines`/`summary`/`adjustments`/`approval`/`workshop`), each reusing the
  exact corresponding Phase 2 report/list function; no new calculation logic. `params.person_type`
  now also feeds the in-file "Filters: ..." line, matching search/status/sort.
- **New**: `_fmtLocalDate(d)` — timezone-safe date formatter (see above).
- `module.exports` — added `payrollExportExcel`.

## Desktop (`electron/`, `renderer/`)

- **`electron/main.js`** — `payroll:lineList` now passes through an `options` object;
  new `payroll:exportExcel` IPC channel (base64-encodes the generated buffer for the IPC
  round-trip, avoiding reliance on Electron's binary structured-clone support).
- **`electron/preload.js`** — matching bridge updates; new `payrollExportExcel` bridge
  function.
- **`renderer/app.js`**:
  - New `_payListState`/`_payLineListState` module-level UI state (search/status/sort,
    persists across navigating into a period and back).
  - `_payRenderPeriodsList` — added a dashboard-tiles row (`_payLoadPeriodsDashboard`, 6
    tiles, pure aggregation of already-fetched data), search/status-filter/sort controls, and
    an Excel export button (`_payExportExcel`, shared trigger reused everywhere Excel export
    is offered).
  - `_payRenderPeriodDetail` — approval timeline now renders via `procApprovalStepsHtml()`
    (the existing Procurement-shared renderer) instead of a hand-rolled table; added an Excel
    export button for the approval timeline; Lines table gained search/type-filter controls
    plus `wireSortableTable`-driven column-header sorting (client-side) and its own Excel
    export button.
  - `_payLoadReport` — 'summary' and 'adjustments' report panels gained an "Export Excel"
    button alongside the existing CSV one.
  - `_payLoadWorkshopSummary` — gained an "Export Excel" button alongside CSV.
  - New shared `_payExportExcel(reportType, params)` — calls the IPC bridge, decodes the
    base64 response into a `Blob`, downloads via the same `Blob→ObjectURL→anchor-click`
    mechanism `downloadCsv()` already uses.

## Mobile (`mobile/`)

- **`mobile/src/hooks/usePayroll.ts`**:
  - `usePayrollPeriods` — signature changed from `(workshopId?, status?)` to a single
    `PayrollPeriodFilters` object (`workshopId`/`status`/`search`/`sortBy`/`sortDir`); the one
    existing call site (`PayrollPeriodsListScreen`, called with zero args) is unaffected by the
    default-`{}` parameter.
  - New `usePayrollExportExcel()` — reuses the exact "write, then share" pattern
    `SageScreen.tsx`/`useSrm.ts` already established (`downloadFile()` + `expo-sharing`), not a
    new download mechanism.
- **`mobile/src/api/endpoints.ts`** — new `PAYROLL_EXPORT_EXCEL(reportType)` endpoint.
- **`mobile-api/routes/payroll.js`**:
  - `GET /periods/:id/lines` now passes `req.query` through as line-list options.
  - New `GET /export/:reportType` — binary `.xlsx` response (not the JSON envelope), the same
    exception class `supplierDocuments.js`'s file-serving route already established.
- **`mobile/src/screens/payroll/PayrollPeriodsListScreen.tsx`** — rewritten with a search
  input, status filter chips, sort chips (tap to cycle direction), and an Excel export action
  in the header (via `usePayrollExportExcel`).
- **`mobile/src/screens/payroll/PayrollPeriodDetailScreen.tsx`** — added an Excel export
  action in the header (exports that period's lines).

## Verification

- `node --check` clean: `db/services/data.js`, `renderer/app.js`, `electron/main.js`,
  `electron/preload.js`, `mobile-api/routes/payroll.js`.
- `npx tsc --noEmit` clean across `mobile/`.
- Live E2E: 75/75 assertions passed (full lifecycle, search/filter/sort, both bug fixes,
  Workshop Isolation, closed-period protection, duplicate-action rejection, unauthorized
  export). All 6 Excel export types generated as real files and inspected with `exceljs`
  (header position, header names, data-row values including a specific date-correctness
  check, row counts for both full and filtered exports, frozen-header/auto-filter presence,
  in-file filter-summary text). All QA data (period, lines, adjustments, rates, attendance, a
  disposable QA casual worker, a disposable QA supervisor account) removed and re-verified at
  zero residue; local temporary `.xlsx` files deleted. `audit_log` entries from the test
  persist permanently by design (12 entries, disclosed not deleted).
- Regression: 7/7 read-only checks passed (Attendance, Casuals, Casual Labour Requests,
  Procurement's own use of `procurement_approval_steps`, notification routing coexistence,
  a representative non-payroll Workshop-Isolation function).
