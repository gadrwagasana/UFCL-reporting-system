# Changelog — Procurement Automation (Phase 6)

## Added

### Database (`db/migrate.js`)
- `procurement_automation_tasks` table (Task Center).
- `last_reminder_at` column on `procurement_rfqs`, `procurement_purchase_orders`, `procurement_invoices`, `supplier_improvement_plans`.
- 6 new `automation_rules` rows: `procurement_requisition_escalation`, `procurement_rfq_reminder`, `procurement_po_reminder`, `procurement_invoice_reminder`, `procurement_improvement_plan_reminder`, `procurement_budget_forecast_alert`.

### Backend (`db/services/data.js`)
- `ENTITY_ESCALATION_ROLES` — per-entity-type role overrides for the existing escalation engine (procurement entities now escalate Assigned Officer → Procurement Manager → Operations Manager → CEO instead of the generic role set).
- 4 new escalation-detection functions: `_checkEscalationProcurementRequisition`, `_checkEscalationProcurementRfq`, `_checkEscalationProcurementInvoice`, `_checkEscalationProcurementImprovementPlan` — registered in `runEscalationEngine`.
- Corresponding auto-resolve blocks added to `_autoResolveEscalations`.
- 13 new `notifyProcurementEvent` events: `approval_required`, `rfq_closing_soon`, `rfq_overdue`, `goods_receipt_late`, `invoice_awaiting_approval`, `invoice_overdue`, `payment_overdue`, `supplier_blacklisted`, `supplier_restored`, `corrective_action_due`, `improvement_plan_due`, `budget_threshold_reached`, `procurement_forecast_warning`.
- `_upsertProcurementTask` / `_autoCloseProcurementTasksNotIn` — Task Center core helpers.
- 4 new reminder scans: `_schedProcurementRfqAutomation`, `_schedProcurementPoAutomation`, `_schedProcurementInvoiceAutomation`, `_schedProcurementImprovementPlanAutomation`.
- `_schedProcurementBudgetForecastCheck` — budget-threshold and forecast-warning alerts (reuses `_forecastSeries` from Phase 5C).
- `_schedProcurementTaskSync` — Task Center sync for pending approvals, contracts, compliance, supplier reviews.
- `_schedProcurementAutomation` — orchestrator, registered as one new tuple in `_schedulerTick`.
- `procurementAutomationDashboard(userId)`, `procurementTasksList(userId, filters)`, `procurementTaskComplete(userId, taskId)`.

### API / IPC
- `mobile-api/routes/procurementRequisitions.js`: `GET /meta/automation/dashboard`, `GET /meta/automation/tasks`, `PATCH /meta/automation/tasks/:taskId/complete`, `GET /meta/automation/escalations`, `POST /meta/automation/escalations/:escalationId/resolve`.
- `electron/main.js` / `preload.js`: `procurement-automation-dashboard:get`, `procurement-tasks:list`, `procurement-tasks:complete` (escalation actions reuse the existing generic `escalation:*` IPC channels).

### Desktop (`renderer/app.js`)
- New "Automation & Tasks" tab on the Procurement Reports page: 8 KPI cards, active-escalations table with resolve action, filterable/searchable Task Center with complete action.

### Mobile
- New types: `ProcurementAutomationTask`, `ProcurementEscalation`, `ProcurementAutomationSummary`, `ProcurementAutomationDashboard`, `ProcurementTaskCategory`.
- New hooks: `useProcurementAutomationDashboard`, `useProcurementTasks`, `useProcurementTaskActions`, `useProcurementEscalations`, `useProcurementEscalationActions`.
- New "Automation & Tasks" tab on `ProcurementReportsScreen.tsx` mirroring the desktop tab.

## Fixed
- `_schedSrmReminders` (Phase 4) never reminded about contracts/compliance that had already lapsed (its query required `end_date/expiry_date >= current_date`), silently going quiet forever once something actually expired. Extended to also fire distinct "Contract Expired"/"Compliance Overdue" notifications for already-past-due rows, gated by the same `last_reminder_at` cadence.
- `procurementSupplierSetStatus` (blacklist/restore) previously wrote an audit log entry but never notified anyone — added `supplier_blacklisted`/`supplier_restored` notifications.
- Invoice and payment approval steps were created silently with no "approval required" notification — added via the new generic `approval_required` event.

## Verification
- `node --check` passed on all touched backend/desktop files.
- `npx tsc --noEmit` passed cleanly on mobile.
- Live database smoke test: 20/20 checks passed, including a real scheduler tick that generated live Task Center rows and a live escalation from actual overdue data.

## Notes
- One new table (`procurement_automation_tasks`); no other new tables.
- No new permission page-id — every new function/route/tab gates on the existing `procurement-reports` permission.
- No new scheduler, timer, or notification system — confirmed via grep (only the two pre-existing background loops exist system-wide).
- Not committed — per standing release discipline, changes are left staged for user review and explicit commit approval.
