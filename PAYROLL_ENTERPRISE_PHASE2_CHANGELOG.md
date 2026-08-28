# Payroll Enterprise Phase 2 — Changelog

## Database (`db/migrate.js`)

- **New**: `createPayrollTables()` — 4 new tables, all additive, no existing table modified:
  - `payroll_rates` — polymorphic (`user_id`/`casual_id`, `num_nonnulls=1`), append-only via
    partial unique indexes on `active=true`.
  - `payroll_periods` — `status` check constraint covering the full
    draft→calculating→pending_approval→approved→rejected→exported→closed vocabulary.
  - `payroll_lines` — polymorphic, one row per person per period (DB-enforced via partial
    unique indexes on `(period_id, user_id)` / `(period_id, casual_id)`), carries frozen
    `rate_type_snapshot`/`rate_amount_snapshot` plus `source_summary jsonb`.
  - `payroll_adjustments` — `category`/`status` check constraints.
- **New**: `grantPayrollPermission()` — grants the `'payroll'` page id to
  admin/ceo/operations/supervisor (same role tier as Attendance/Casuals), called at the end of
  `migrate()`. Live-run: confirmed all 4 tables exist and permission granted to 4 roles.

## Backend (`db/services/data.js`)

- **`ROLE_PAGES`** — added `'payroll'` to admin/ceo/operations/supervisor arrays (the
  documented fallback, alongside the DB grant above).
- **New Payroll module** (~700 lines, inserted after the Attendance section):
  `PAYROLL_ROLES`, `PAYROLL_APPROVE_ROLES`, `PAYROLL_RATE_TYPES`,
  `PAYROLL_ADJUSTMENT_CATEGORIES`, `_canAccessPayroll`, `_payrollResolvePerson`.
  - Rates: `payrollRateSet`, `payrollRatesList`, `payrollRateHistory`.
  - Periods: `payrollPeriodCreate/List/Detail/Update/Delete`, `_payrollPeriodGet`.
  - Calculation: `_payrollComputeSourceQty`, `_payrollFetchAttendanceForPerson`,
    `payrollPeriodCalculate`, `payrollLineList/Detail`, `payrollLineRecalculate`,
    `payrollLineUpdateSourceQty`.
  - Adjustments: `payrollAdjustmentCreate/List`, `_payrollAdjustmentDecide`,
    `payrollAdjustmentApprove/Reject`.
  - Lifecycle: `PAYROLL_STAGE_ROLE`, `_payrollBuildApprovalStages`, `payrollPeriodSubmit`,
    `payrollPeriodMarkExported`, `payrollPeriodClose`, `notifyPayrollEvent`.
  - Reporting: `payrollSummaryReport`, `attendancePayrollReconciliation`,
    `casualLabourCostSummary`, `payrollAdjustmentsReport`, `payrollWorkshopSummary`.
  - All 26 functions added to `module.exports`.
- **`procurementApprovalAction`** — extended additively for `entityType === 'payroll_period'`
  (the first entity type to reuse this engine from outside Procurement):
  - `ENTITY_TABLE.payroll_period = 'payroll_periods'`.
  - `validDecisions` now includes `returned_for_revision` for payroll too.
  - `ENTITY_MID_STATUS.payroll_period = 'pending_approval'`,
    `ENTITY_FINAL_STATUS.payroll_period = 'approved'`.
  - Workshop-restriction check extended to include `payroll_period` (a workshop-restricted
    `operations` approver can no longer approve/reject another workshop's payroll by id).
  - A new, payroll-specific `returned_for_revision` branch (reopens to Draft — deliberately
    lighter than requisitions' item-snapshot revision history) inserted *before* the existing
    requisition-only branch, gated on `isPayroll` so it never intercepts requisition behavior.
  - Every `module: 'procurement'` / `notifyProcurementEvent(...)` call site now branches on
    `isPayroll` to use `module: 'payroll'` / `notifyPayrollEvent(...)` instead.
  - **Zero behavioral change to existing Procurement entity types** — every new branch is
    gated on `entityType === 'payroll_period'`, an entity type that never previously existed;
    confirmed by code inspection (every conditional falls through to its original expression
    when `isPayroll` is false) and by the live QA run not touching any Procurement data.

## Desktop (`electron/`, `renderer/`)

- **`electron/main.js`** — 26 new `secureHandle('payroll:*', ...)` IPC channels. The existing
  generic `procurement-requisitions:approve` channel (already entity-type-agnostic) is reused
  as-is for payroll approval — no new IPC channel needed for that action.
- **`electron/preload.js`** — 26 matching bridge functions. `procurementApprovalAction` (the
  existing generic bridge) is called directly with `'payroll_period'` as the entity type.
- **`renderer/app.js`**:
  - New nav entry `{ id: 'payroll', ... }` (Human Resources section) + routing case +
    `page-payroll` div (`renderer/index.html`).
  - `NOTIFICATION_ROUTES['payroll']` — page-only entry (no per-record open function).
  - New `renderPayroll()` module (~600 lines): periods list, rates overlay, period detail
    (overview/approval timeline/lines/actions), line detail overlay (source breakdown/
    adjustments/manual override), 6 reports with CSV export, company-wide Workshop Summary.
  - Bug fixed during development: `payrollPeriodDetail` initially returned the raw
    `payroll_periods` row (no joined names) while the UI expected `created_by_name`/
    `closed_by_name`/`workshop_name` — fixed by adding a named-lookup query to
    `payrollPeriodDetail` itself (`db/services/data.js`), not worked around client-side.

## Mobile (`mobile/`)

- **`mobile/src/utils/permissions.ts`** — new `'payroll.manage'` permission key, granted to
  admin/ceo/operations/supervisor (mirrors `attendance.manage` exactly).
- **`mobile/src/types/api.ts`** — `PayrollPeriod`, `PayrollLine`, `PayrollAdjustment`,
  `PayrollApprovalStep`, and their list/detail response types.
- **`mobile/src/api/endpoints.ts`** — 5 new `PAYROLL_*` endpoint constants.
- **`mobile/src/hooks/usePayroll.ts`** (new file) — `usePayrollPeriods`,
  `usePayrollPeriodDetail`, `usePayrollLineDetail`, `usePayrollLineAdjustments`,
  `usePayrollPeriodApprove`.
- **`mobile/src/navigation/types.ts`** — `CasualLabourStackParamList` extended with
  `PayrollPeriodsList`/`PayrollPeriodDetail`/`PayrollLineDetail` (nested into the existing
  shared HR stack, not a new tab — matching the precedent Attendance itself already set).
- **`mobile/src/navigation/CasualLabourStack.tsx`** — 3 new `Stack.Screen` entries.
- **`mobile/src/screens/labour/CasualLabourListScreen.tsx`** — new role-gated header button
  (`payroll.manage`) opening `PayrollPeriodsList`, alongside the existing Casuals/Attendance
  buttons.
- **New screens**: `PayrollPeriodsListScreen.tsx`, `PayrollPeriodDetailScreen.tsx` (approval
  timeline + Approve/Reject/Return, gated by matching the pending stage's role),
  `PayrollLineDetailScreen.tsx` (read-only calculation + adjustment inspection). Deliberately
  no rate-setting, period-creation, calculation-trigger, or adjustment-creation UI on mobile.
- **`mobile/src/utils/notificationRouting.ts`** — `'payroll'` page-only entry (parity with
  desktop).
- Fixed during development: both new detail screens initially used a custom local `RouteProp`
  type with `useRoute<RouteProp>()`, which collides with react-navigation's own generic
  `RouteProp` constraint (`tsc` error). Switched to this codebase's established
  `XStackScreenProps<'ScreenName'>` + destructured `{navigation, route}` props pattern (the
  same one `VatDetailScreen.tsx` already uses) — `npx tsc --noEmit` clean afterward.

## REST (`mobile-api/`)

- **New file `mobile-api/routes/payroll.js`** — 24 routes (rates, periods, lifecycle,
  approval, lines, adjustments, 5 reports), pure delegation to `data.js`, following this
  codebase's established route-file convention exactly. The approval route hardcodes
  `entityType='payroll_period'` server-side (matching `procurementRequisitions.js`'s own
  `/approve` route convention) rather than trusting a client-supplied entity type.
- **`mobile-api/server.js`** — registered at `/api/payroll`.

## Verification

- `node --check` clean: `db/services/data.js`, `db/migrate.js`, `renderer/app.js`,
  `electron/main.js`, `electron/preload.js`, `mobile-api/server.js`,
  `mobile-api/routes/payroll.js`.
- `npx tsc --noEmit` clean across `mobile/`.
- Migration run live against production: all 4 tables created, permission granted to 4 roles
  — independently re-verified via a direct read-only query.
- Live QA verification: 50/50 assertions passed (see Completion Report §13). All QA data
  (periods, lines, adjustments, rates, attendance, a disposable QA casual worker, a disposable
  QA supervisor account) fully removed and re-verified at zero residue. `audit_log` entries
  from the test remain permanently by design (immutable DB rule) — 61 entries, disclosed not
  deleted.
