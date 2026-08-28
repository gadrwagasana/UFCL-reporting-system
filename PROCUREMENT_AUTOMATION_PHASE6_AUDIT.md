# Procurement Automation (Phase 6) — Infrastructure Audit

## Purpose

Before building the Procurement Automation Engine (6A Workflow Automation, 6B Notifications & Reminders, 6C Scheduled Jobs & Escalations, 6D Task Center), this audit inventories every piece of existing infrastructure the engine must reuse, per the mandate: no new scheduler, no new notification system, no duplicated business logic.

## 1. Scheduler — reuse, do not replace

There is one 15-minute `setInterval` loop (`startScheduler`/`stopScheduler`, `data.js:9665-9676`) driven by a fixed array of `[label, fn]` tasks in `_schedulerTick` (`data.js:9625-9634`), plus a separate 2-minute DB-backed job queue (`workflow_jobs`, drained via `JOB_DISPATCH`, `data.js:5502-5509`) for one-off retryable work. Both are started/stopped exactly once, from `electron/main.js:904-922` (start) and `:223-241` (before-quit).

**A direct precedent for procurement reminders already exists and already runs**: `_schedSrmReminders` (`data.js:9559-9597`) scans `procurement_supplier_contracts` and `supplier_compliance` for `[90,60,30,7]`-day expiry thresholds every tick, gated by a `last_reminder_at` column so it doesn't re-notify within ~20 hours. **There is no real daily/weekly/monthly cron anywhere in the system** — "daily" is simulated entirely by the 15-minute tick plus an interval check on `last_reminder_at`. The automation engine will follow this exact same pattern for every new reminder category (RFQ, PO, invoice, corrective action, improvement plan) rather than introducing real cron scheduling.

**Registration mechanism**: add one more `[label, fn]` tuple to the `_schedulerTick` tasks array for periodic scans, and/or one more `JOB_DISPATCH` entry for queued one-off work (e.g. a task-close job). No other lifecycle hook exists or is needed.

## 2. Notifications — reuse `notifyProcurementEvent`

`pushNotification` (`data.js:476-509`) writes to the generic `notifications` table (severity `type`: red/amber/green/blue; coarse `category`: approval/workflow/srm/automation/escalation/system). Procurement already centralizes its own event→notification mapping in `notifyProcurementEvent(eventKey, entity, extra)` (`data.js:10940-11028`), currently covering 12 event keys (`requisition_submitted` … `payment_rejected`). **This is the exact extension point** for the 19 new event types the Phase 6 prompt lists (Approval Escalated, RFQ Closing Soon, Contract Expiring, Compliance Overdue, etc.) — no new notification mechanism is needed, only new entries in this one `EVENTS` map, all under `category: 'procurement'` for consistency with the existing convention (the separate `escalation`-module code elsewhere uses inconsistent `'Escalation'`/`'UPDATE'` casing — this audit does not propagate that inconsistency into new procurement code).

## 3. Audit logging — reuse `logAudit`

Confirmed convention for procurement: `module: 'procurement'`, lowercase `action_type` (`create`, `submit`, `approve`, `reject`, `cancel`, `issue_po`, `receive_goods`, `match_invoice`, etc., no fixed enum/CHECK constraint). New automation action types will follow the same lowercase convention: `auto_remind`, `auto_escalate`, `task_create`, `task_close`.

## 4. Escalation engine — reuse `_escalateEntity` / `escalations` / `escalation_history`, extend role resolution

`_escalateEntity` (`data.js:9723-9819`) is already fully generic over `entity_type`, backed by two existing tables (`escalations`, `escalation_history`) and driven entirely by `automation_rules.threshold` (no hardcoded timings). **The one hardcoded piece is `ESCALATION_LEVEL_ROLES`** (`data.js:9704-9709`), a flat global map (`leader`/`manager`/`director`/`ceo` → fixed role-name arrays) applied to every entity type uniformly.

The Phase 6 spec's hierarchy — **Assigned Officer → Procurement Manager → Operations Manager → CEO** — maps directly onto real, already-existing roles (`procurement-officer`, `procurement-manager`, `operations`, `ceo`/`admin` — confirmed present in `db/migrate.js:1514-1602`), but does **not** match the current global role set at each level. This requires a small, backward-compatible change: resolve target roles per `entity_type` (falling back to the existing global map for every entity type that isn't procurement's), rather than duplicating `_escalateEntity` for procurement. This is the one shared-infrastructure edit in this phase — everything else is purely additive.

## 5. Contracts & compliance reminders — already automated; corrective actions & improvement plans are not

`procurement_supplier_contracts` and `supplier_compliance` both already have a working scheduled reminder (`_schedSrmReminders`) and a `last_reminder_at` column. **`supplier_improvement_plans`** (which also holds corrective actions, via `plan_type='corrective_action'` — there is no separate corrective-actions table) has `due_date` and `completion_percent` but **no reminder logic and no `last_reminder_at` column today**. This is genuine net-new work, built as a second scan function following the exact same shape as `_schedSrmReminders`.

## 6. RFQs, Purchase Orders, Supplier Invoices — no reminder state today

`procurement_rfqs`, `procurement_purchase_orders`, and `procurement_invoices` have due-date-shaped fields (RFQ `due_date`, PO `expected_delivery_date`, invoice due/payment fields) but **no `last_reminder_at` column and no scheduled scan** touches any of them yet. Each needs the same minimal `last_reminder_at timestamptz` column added and one new scan function.

## 7. Task Center — no existing generic task table

A repo-wide search for `task_center`/`my_tasks`/`todo`/equivalents found **nothing** — there is no generic cross-module task table or screen anywhere in the codebase today. The two closest architectural precedents are `MyRequestsScreen.tsx` (per-user merge of heterogeneous request kinds into one sorted timeline) and `automationDashboard`/`AutomationHomeScreen.tsx` (cross-module ops-health dashboard: counters + scheduler health + activity chart + rules + log). The Task Center's per-user list view should follow the first pattern; its dashboard should follow the second. Building it requires **one new generic table** (no existing table can represent "a task, of any category, with an owner, priority, due date, status, and a deep link back to its source record" — this is the same justification pattern used for `procurement_approval_steps` in Phase 1).

## 8. Automation Dashboard precedent

`automationDashboard(userId)` (`data.js:10256-10367`) is the exact aggregator shape to mirror for the new Procurement Automation Dashboard: one gated function, parallel queries, returning `{summary counters, scheduler health, activity-by-day, rules/log/escalations}`. The new dashboard will follow this shape scoped to procurement entity types, reusing the same `automation_rules`/`escalations`/`scheduler_runs` tables — no new tables needed for the dashboard itself.

---

## Proposed Design (pending approval before implementation)

1. **Schema additions** (all via `db/migrate.js`, `create table if not exists` / `add column if not exists`, matching every prior phase's convention):
   - New generic table `procurement_automation_tasks` for the Task Center (category, title, priority, due_date, status, owner_role, source_module, source_entity_type, source_entity_id, deep_link, created_at, closed_at, closed_by, auto_closed boolean).
   - `last_reminder_at timestamptz` added to `procurement_rfqs`, `procurement_purchase_orders`, `procurement_invoices`, `supplier_improvement_plans` (contracts/compliance already have it).
   - No changes to `procurement_config` — escalation/reminder timing continues to live in `automation_rules.threshold`, matching every other module (not duplicated into a procurement-specific config table).

2. **New `automation_rules` rows** (reusing the existing table, not `procurement_config`) for each new procurement automation category, each independently tunable/disableable through the existing Automation Rules UI with zero new UI work: `procurement_requisition_escalation`, `procurement_rfq_reminder`, `procurement_po_reminder`, `procurement_invoice_reminder`, `procurement_contract_reminder` (already exists as part of SRM), `procurement_compliance_reminder` (already exists), `procurement_improvement_plan_reminder`.

3. **`_escalateEntity` role-resolution edit**: introduce a small `entity_type → level → roles` override map consulted before falling back to the existing global `ESCALATION_LEVEL_ROLES`, so procurement entity types resolve to `procurement-officer → procurement-manager → operations → ceo/admin`. Fully backward-compatible for every existing entity type (maintenance/delivery/workflow/security/approvals) since none of them will have an override entry.

4. **New scheduler tasks** (tuples appended to `_schedulerTick`'s array): `_schedRfqReminders`, `_schedPoReminders`, `_schedInvoiceReminders`, `_schedImprovementPlanReminders`, `_schedProcurementEscalations` (calls `_escalateEntity` for overdue requisition approvals / RFQs / invoices / corrective actions / improvement plans), `_schedProcurementTaskSync` (creates/auto-closes `procurement_automation_tasks` rows from current entity state).

5. **`notifyProcurementEvent` extension**: add the 19 new event keys from the spec to the existing `EVENTS` map, all `category: 'procurement'`.

6. **Task Center auto-close semantics**: a task auto-closes when its source entity leaves the state that created it (e.g., an RFQ reminder task closes once the RFQ's status is no longer open/pending); users can also manually dismiss a task early (recorded as `closed_by = userId, auto_closed = false`, versus the scheduler's `auto_closed = true`).

7. **Automation Dashboard**: new `procurementAutomationDashboard(userId)` mirroring `automationDashboard`'s shape, scoped to procurement `entity_type`s, gated by the existing `procurement-reports` permission (no new permission).
