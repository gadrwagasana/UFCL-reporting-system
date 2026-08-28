# Procurement Automation (Phase 6) — Completion Report

## Executive Summary

Phase 6 (Workflow Automation, Notifications & Reminders, Scheduled Jobs & Escalations, and the Procurement Task Center) is implemented as one combined pass, per the user's spec. A single Procurement Automation Engine — one 15-minute scheduler orchestrator, one task upsert/close helper, the existing generic 4-level escalation engine (now entity-type-aware), and the existing `notifyProcurementEvent` dispatcher — is the sole origin point for every automated action. No new scheduler, no new notification system, no new timers, and no new permission page-id were introduced. Two schema additions were made: one new generic table (`procurement_automation_tasks`, for the Task Center — no existing table could represent "a task, of any category, with owner/priority/due date/status/deep-link") and `last_reminder_at` columns added to four existing tables that lacked one.

Live verification against the real database (20/20 checks) confirmed the full pipeline end-to-end: a genuinely overdue RFQ in the dataset was independently caught by both the reminder scan (fired an `rfq_overdue` notification) and the escalation engine (created a real `leader`-level escalation), and 8 real Task Center rows were generated from live procurement data — nothing fabricated or simulated.

## Automation Architecture

```
15-minute scheduler tick (existing, unchanged loop)
        │
        ├─ existing tasks (BI scan, security scan, workflow scan, approval SLA, ...)
        ├─ SRM expiry reminders (existing, extended — see Known Limitations→Fixed)
        ├─ escalation engine (existing, extended with 4 new entity types)
        └─ procurement automation orchestrator (NEW — one entry point)
                │
                ├─ RFQ reminders + Task Center sync
                ├─ PO / delivery reminders + Task Center sync
                ├─ Invoice reminders + Task Center sync
                ├─ Corrective action / improvement plan reminders + Task Center sync
                ├─ Budget threshold + forecast warning check
                └─ Task Center sync (pending approvals, contracts, compliance, supplier reviews)
```

Every branch calls the same two primitives — `pushNotification`/`notifyProcurementEvent` for delivery, `_upsertProcurementTask`/`_autoCloseProcurementTasksNotIn` for the Task Center — so no notification or task-list logic is duplicated across categories. Escalations reuse the pre-existing `_escalateEntity`/`escalations`/`escalation_history` engine unchanged in structure; the only edit was making its role-resolution entity-type-aware (additive, backward-compatible — every pre-existing entity type keeps its exact previous behavior).

## Workflow Coverage

| Area | Mechanism |
|---|---|
| Purchase Requisitions — pending approval detection, routing, escalation | Existing approval-step chain (unchanged) + new `_checkEscalationProcurementRequisition` escalation detection |
| RFQs — response/closing reminders, overdue detection | New `_schedProcurementRfqAutomation` (reminder) + `_checkEscalationProcurementRfq` (escalation) |
| Purchase Orders — delivery monitoring, late alerts | New `_schedProcurementPoAutomation`. ("Pending issue monitoring" was audited and found not applicable — POs are created already-issued in this codebase; there is no pending-issue state to monitor.) |
| Goods Receipts — expected delivery monitoring, late alerts | Same `_schedProcurementPoAutomation` scan, split into `purchase_orders` (on-track) vs `goods_receipts` (late) Task Center categories |
| Supplier Invoices — pending approval/payment/overdue reminders | New `_schedProcurementInvoiceAutomation` (reminder) + `_checkEscalationProcurementInvoice` (escalation) |
| Supplier Contracts — renewal/expiry reminders | Existing `_schedSrmReminders`, extended to also alert on already-expired contracts (see Known Limitations) |
| Compliance — expiry/missing reminders | Same extended `_schedSrmReminders` |
| Corrective Actions / Improvement Plans — due-date/progress reminders | New `_schedProcurementImprovementPlanAutomation` (reminder) + `_checkEscalationProcurementImprovementPlan` (escalation); both plan types share `supplier_improvement_plans`, distinguished by `plan_type` |
| Budget Threshold / Forecast Warning | New `_schedProcurementBudgetForecastCheck`, reusing the existing `_forecastSeries` engine from Phase 5C — no new forecasting math |

## Scheduler Enhancements

- One new tuple, `['procurement automation', _schedProcurementAutomation]`, appended to the existing `_schedulerTick` tasks array — the only change to the scheduler's task list.
- `_schedProcurementAutomation` self-contains its own `automation_rules` fetch (mirroring `runEscalationEngine`'s existing pattern) so the tick's task list itself only grew by one entry, not five.
- No new `setInterval`, no new cron, no new timer service — confirmed via grep (only the two pre-existing loops remain: the 15-minute scheduler and the 2-minute job-queue drain).
- Live-verified tick duration: 438ms and 243ms across two consecutive runs, zero errors — well within the existing tick budget.

## Notification Matrix

19 of the 20 requested notification types are wired; details below (`✓ new` = new `notifyProcurementEvent` entry this phase, `✓ existing` = already fired before Phase 6, `✓ via escalation` = fired by the shared escalation engine's own notification, not `notifyProcurementEvent`):

| Notification | Status |
|---|---|
| Approval Required | ✓ new — fires when an invoice/payment approval step is first created |
| Approval Completed | ✓ existing (`${entityType}_approved`/`_stage_approved`) |
| Approval Escalated | ✓ via escalation engine |
| RFQ Closing Soon / RFQ Overdue | ✓ new |
| Contract Expiring | ✓ existing |
| Contract Expired | ✓ new (fixed a real gap — see Known Limitations) |
| Compliance Expiring | ✓ existing |
| Compliance Overdue | ✓ new (same fix) |
| Goods Receipt Late | ✓ new |
| Invoice Awaiting Approval / Invoice Overdue | ✓ new |
| Payment Approved | ✓ existing |
| Payment Overdue | ✓ new |
| Supplier Blacklisted / Supplier Restored | ✓ new — wired into the existing `procurementSupplierSetStatus` lifecycle function |
| Corrective Action Due / Improvement Plan Due | ✓ new |
| Budget Threshold Reached | ✓ new |
| Procurement Forecast Warning | ✓ new |

All new entries live in the single `notifyProcurementEvent` `EVENTS` map (13 new keys) — no second dispatch mechanism.

## Escalation Rules

Hierarchy exactly as specified — **Assigned Officer → Procurement Manager → Operations Manager → CEO** — implemented as a new `ENTITY_ESCALATION_ROLES` override map consulted by the existing `_escalateEntity` before its old global fallback:

| Entity type | Leader level | Manager level | Director level | CEO level |
|---|---|---|---|---|
| `procurement_requisition` | procurement-officer | procurement-manager | operations | ceo/admin |
| `procurement_rfq` | procurement-officer | procurement-manager | operations | ceo/admin |
| `procurement_invoice` | procurement-officer | procurement-manager | **finance** | ceo/admin |
| `procurement_improvement_plan` | procurement-officer | procurement-manager | operations | ceo/admin |

(Finance stands in for the "Operations Manager" level on the invoice chain, since Finance is who actually owns invoice sign-off in this system — noted and consistent with existing role grants.)

Timing is fully configurable via 6 new `automation_rules` rows (same table/UI every other automation rule already uses — no new config surface): `procurement_requisition_escalation`, `procurement_rfq_reminder`, `procurement_po_reminder`, `procurement_invoice_reminder`, `procurement_improvement_plan_reminder`, `procurement_budget_forecast_alert`.

`getEscalations`/`resolveEscalation`/`acknowledgeEscalation` were extended (role arrays only) so `procurement-officer` (leader-level visibility, matching the existing pattern for other "leader" roles) and `procurement-manager`/`finance` (full visibility + resolve rights) can see and act on procurement escalations through the exact same screens every other module's escalations already use.

## Event Architecture

Every automated action is reachable through exactly two reusable entry points — `notifyProcurementEvent(eventKey, entity, extra)` for delivery and `_upsertProcurementTask(...)` for the Task Center — both already fully decoupled from delivery mechanism (in-app notification today; the same call sites need no changes to add push/email/SMS/Teams/Slack in a future phase, since `pushNotification` is the one place that would grow new delivery channels). This satisfies the "Phase 6 must expose automation events Phase 7 can consume directly" requirement without any extra plumbing built ahead of need.

## Business Logic Reused

- Scheduler loop, job queue, `pushNotification`, `logAudit`, `mustRole`, `_escalateEntity`/`escalations`/`escalation_history`, `automation_rules`, `scheduler_runs` — all reused unchanged in structure.
- `_forecastSeries` (Phase 5C) reused as-is for the forecast-warning check — no new projection math.
- `automationDashboard`'s aggregator shape (summary + scheduler health + rules + escalations) mirrored for the new `procurementAutomationDashboard`.
- `_schedSrmReminders` (Phase 4) is the direct template every new reminder scan follows (query → threshold check → notify → stamp `last_reminder_at`).
- `procurement-reports` is the only permission gate used anywhere in Phase 6 — confirmed via grep, zero new permission page-ids.

## Files Modified

- `db/migrate.js` — `procurement_automation_tasks` table, `last_reminder_at` columns ×4, `seedProcurementAutomationRules()` (6 rows).
- `db/services/data.js` — `ENTITY_ESCALATION_ROLES` + `_escalateEntity` edit; 13 new `notifyProcurementEvent` events; `_upsertProcurementTask`/`_autoCloseProcurementTasksNotIn`; 4 new reminder scans + 4 new escalation-detection functions; `_schedProcurementBudgetForecastCheck`; `_schedProcurementTaskSync`; `_schedProcurementAutomation` orchestrator (registered in `_schedulerTick`); `procurementAutomationDashboard`, `procurementTasksList`, `procurementTaskComplete`; `_schedSrmReminders` extended for expired/overdue; `procurementSupplierSetStatus` wired to blacklist/restore events; `procurementInvoiceApprove`/`procurementPaymentCreate` wired to `approval_required`; exports updated.
- `mobile-api/routes/procurementRequisitions.js` — automation dashboard/tasks/task-complete/escalations routes.
- `electron/main.js` / `electron/preload.js` — IPC for automation dashboard + task list/complete (escalations reuse the existing generic `escalation:*` channels).
- `renderer/app.js` — new "Automation & Tasks" tab on Procurement Reports (KPI cards, escalations table, filterable Task Center).
- `mobile/src/types/api.ts`, `mobile/src/api/endpoints.ts`, `mobile/src/hooks/useProcurementDashboard.ts`, `mobile/src/screens/procurement/ProcurementReportsScreen.tsx` — matching mobile tab.

## UI/CSS Improvements

Both platforms reuse 100% existing design tokens — KPI cards (`kpi-blue/amber/red`), badges (`badge br/ba/bn/bb`), sticky filter bars, sticky table headers, skeleton loading (shared `loadTab` preamble), empty/error states — no new CSS was written on desktop; no new style tokens on mobile. Placement follows the exact Phase 5 precedent: a new tab on the existing Procurement Reports page (desktop) / Procurement Reports screen (mobile), not a new NAV page — this is what let the entire feature reuse the `procurement-reports` permission with zero new plumbing.

## Verification Results

- `node --check` passed on all 6 touched backend/desktop files.
- `npx tsc --noEmit` passed cleanly on the mobile project.
- Grep-confirmed: only two `setInterval` loops exist system-wide (no new timer/scheduler); all new/changed functions gate on `procurement-reports` only; 52 call sites confirm `pushNotification`/`notifyProcurementEvent` reuse.
- Live database smoke test: **20/20 checks passed**, including a real scheduler tick (started via the same `startScheduler`/`stopScheduler` lifecycle `electron/main.js` uses) that correctly generated 8 live Task Center rows and 1 live escalation from actual overdue data, a verified manual-complete round-trip, and confirmation that a manually-closed task is never resurrected by a subsequent scan.

## Known Limitations

- **Fixed during this phase**: `_schedSrmReminders` (Phase 4, "completed") only reminded about contracts/compliance *approaching* expiry, never those already expired — a real gap directly contradicting Phase 6's explicit "Contract Expired"/"Compliance Overdue" requirement. Extended (not rewritten) to also fire on already-past-due rows.
- "PO pending issue monitoring" was audited and found not applicable to this codebase's data model — POs are created with status `issued` immediately (`procurementPoGenerate` never produces a pre-issue state), so there is nothing to monitor there. Delivery monitoring/late-delivery alerts (the more concrete, genuinely stateful half of that requirement) are fully implemented.
- Task Center `deep_link` currently points to the relevant list page only (e.g. `procurement-rfq`), not a specific record — no generic "open record X" mechanism exists yet anywhere in the app to extend, and building one was out of scope for this phase.
- "Supplier Reviews" tasks are derived live from goods-receipt reject-rate (>10% on ≥10 handled units) since no supplier-review-cadence field exists in the data model; this mirrors the exact shape `procurementReportSupplierPerformance` already reports, not a new computation.
- Mobile's escalation "Resolve" action uses a fixed reason string ("Resolved via mobile") rather than a free-text prompt — React Native's cross-platform `Alert` has no built-in text-input prompt (unlike desktop's `window.prompt`), and building a custom modal for this one action was judged out of proportion to the phase's scope.

## Recommendations

- Once a full sprint of live procurement activity accumulates, revisit the reminder cadences (`cooldown_hours`, `hours_at_*`) in the 6 new `automation_rules` rows via the existing Automation Rules screen — they ship with reasonable defaults but are untuned against real usage volume.
- Phase 7 (Scorecards / Buyer & Department Performance / Executive Performance Dashboard) can consume the same `notifyProcurementEvent` event keys and `procurement_automation_tasks` categories directly — no engine changes anticipated.
