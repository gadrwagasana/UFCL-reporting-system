# Payroll Enterprise Phase 3 — UI/CRUD/Permission Matrix

Verified column = confirmed via the live E2E test this phase (75/75 assertions — Completion
Report §16) or, where marked *(P2)*, via Phase 2's own 50/50 live test (unchanged this phase,
re-confirmed by the Phase 3 regression pass not touching that code path).

| Operation | Backend | Desktop | Mobile | Permission | Verified |
|---|---|---|---|---|---|
| Set Rate | `payrollRateSet` | Yes (Rates overlay) | No *(deliberate)* | `payroll` page (admin/ceo/operations/supervisor; supervisor limited to Casual Worker rates via UI, see PH2-02) | Yes *(P2)* |
| List/View Rates | `payrollRatesList`, `payrollRateHistory` | Yes | No *(deliberate)* | same | Yes *(P2)* |
| Create Payroll Period | `payrollPeriodCreate` | Yes | No *(deliberate)* | `payroll` page | Yes *(P2)* |
| Edit Payroll Period | `payrollPeriodUpdate` | Yes (draft/calculating only) | No *(deliberate)* | `payroll` page | Yes *(P2)*, date-format fix re-verified this phase |
| Delete Payroll Period | `payrollPeriodDelete` | Yes (draft/calculating only, governed) | No *(deliberate)* | `payroll` page + Engine A (`applyGovernance`) | Yes *(P2)* |
| Calculate Payroll | `payrollPeriodCalculate` | Yes | No *(deliberate)* | `payroll` page | Yes (this phase, re-verified) |
| Recalculate / Manual Override (line) | `payrollLineRecalculate`, `payrollLineUpdateSourceQty` | Yes | No *(deliberate)* | `payroll` page | Yes *(P2)* |
| List Periods (search/filter/sort) | `payrollPeriodList` | Yes | Yes | `payroll` page, Workshop Isolation | **Yes (this phase — new)** |
| View Period Detail | `payrollPeriodDetail` | Yes | Yes | `payroll` page, Workshop Isolation | Yes *(P2)*, matrix-confirmed this phase |
| List Lines (search/filter/sort) | `payrollLineList` | Yes | Yes (via detail screen) | `payroll` page, Workshop Isolation **(fixed this phase — see Gap Register/Changelog)** | **Yes (this phase — new + bugfix verified)** |
| View Line Detail | `payrollLineDetail` | Yes | Yes | `payroll` page, Workshop Isolation | Yes *(P2)* |
| Submit Payroll | `payrollPeriodSubmit` | Yes | No *(deliberate)* | `payroll` page | Yes *(P2)*, date-fix re-verified |
| Approve Payroll | `procurementApprovalAction('payroll_period','approved')` | Yes | Yes | `procurement_approval_steps.assigned_role` (operations/ceo/admin) | Yes *(P2 + this phase)* |
| Return Payroll (for correction) | `procurementApprovalAction('payroll_period','returned_for_revision')` | Yes | Yes | same | Yes *(P2)* |
| Reject Payroll | `procurementApprovalAction('payroll_period','rejected')` | Yes | Yes | same | Yes (this phase, isolated test) |
| Mark Exported | `payrollPeriodMarkExported` | Yes | No *(deliberate)* | `payroll` page | Yes *(P2)* |
| Close Payroll | `payrollPeriodClose` | Yes | No *(deliberate)* | `payroll` page | Yes *(P2 + this phase, incl. duplicate-close rejection)* |
| Create Adjustment | `payrollAdjustmentCreate` | Yes (incl. post-close) | No *(deliberate)* | `payroll` page | Yes *(P2 + this phase, post-close case)* |
| Approve/Reject Adjustment | `payrollAdjustmentApprove/Reject` | Yes | No *(view-only on mobile)* | `PAYROLL_APPROVE_ROLES` (operations/ceo/admin) | Yes *(P2)* |
| View Adjustments | `payrollAdjustmentList` | Yes | Yes (read-only) | `payroll` page, Workshop Isolation | Yes *(P2)* |
| Export Excel — Periods (History) | `payrollExportExcel('periods')` | Yes | Yes | `payroll` page | **Yes (this phase — new, file-inspected)** |
| Export Excel — Lines (Employee Payroll) | `payrollExportExcel('lines')` | Yes | Yes | `payroll` page, Workshop Isolation | **Yes (this phase — new, file-inspected, incl. filtered)** |
| Export Excel — Period Summary | `payrollExportExcel('summary')` | Yes | No (PH3-01) | `payroll` page | **Yes (this phase — new, file-inspected)** |
| Export Excel — Adjustments | `payrollExportExcel('adjustments')` | Yes | No (PH3-01) | `payroll` page | **Yes (this phase — new, file-inspected)** |
| Export Excel — Approval Status | `payrollExportExcel('approval')` | Yes | No (PH3-01) | `payroll` page | **Yes (this phase — new, file-inspected)** |
| Export Excel — Cost by Workshop | `payrollExportExcel('workshop')` | Yes | No (PH3-01) | `payroll` page, company-wide only | **Yes (this phase — new, file-inspected)** |
| CSV Export (all 6 pre-existing reports) | Report-specific functions + `downloadCsv()` | Yes | N/A (CSV was always desktop-only) | `payroll` page | Yes *(P2, unchanged)* |
| View Reports (Reconciliation, Casual Cost) | `attendancePayrollReconciliation`, `casualLabourCostSummary` | Yes | No (report-only, not in mobile scope) | `payroll` page | Yes *(P2)* |
| Search (Periods) | `payrollPeriodList({search})` | Yes | Yes | `payroll` page, Workshop Isolation preserved | **Yes (this phase — new)** |
| Search (Lines) | `payrollLineList({search})` | Yes (client-side over fetched set) | N/A (not built — narrow line-count doesn't need it) | `payroll` page | **Yes (this phase — new)** |
| Filter (Status, Person Type) | `payrollPeriodList({status})`, `payrollLineList({person_type})` | Yes | Yes (status only) | `payroll` page, Workshop Isolation preserved | **Yes (this phase — new)** |
| Sort (Periods) | `payrollPeriodList({sort_by,sort_dir})`, server-side | Yes | Yes | `payroll` page | **Yes (this phase — new)** |
| Sort (Lines) | client-side via `wireSortableTable` | Yes | No (not built — small dataset, view-only detail on mobile) | `payroll` page | **Yes (this phase — new)** |
| Notifications (submitted/approved/rejected/returned/closed) | `notifyPayrollEvent` | Yes | Yes | routing preserves Workshop Isolation via the underlying screen's own auth | Yes *(P2)* |
| Audit Trail | `logAudit` (every mutation above) | Visible via approval timeline + governance | Visible via approval timeline | `payroll` page | Yes *(P2 + this phase, 18-entry trail confirmed)* |

## Notes on "No (deliberate)" entries

Every mobile "No" above is an intentional scope decision carried unchanged from Phase 2,
re-confirmed still correct this phase per the brief's own guidance ("do not force complex
payroll administration onto mobile"): rate-setting, period creation/calculation, adjustment
creation, and 4 of 6 Excel report types (PH3-01) remain desktop-only. Every backend function
behind a "No (deliberate)" still has full desktop UI and REST/IPC exposure — nothing is
backend-only without a documented reason.
