# Procurement Exception Management Phase 2 — Changelog

Procurement Requisition Return for Revision. See `PROCUREMENT_REVISION_PHASE2_COMPLETION_REPORT.md` for full detail, reasoning, and live-verification evidence.

## Database (migration applied to live DB via `npm run migrate`)

- `db/migrate.js`
  - New column: `procurement_requisitions.revision_number int not null default 0`.
  - New column: `procurement_approval_steps.revision_number int not null default 0` — tags which approval "attempt" a step belongs to.
  - New table: `procurement_requisition_revisions` — one row per Return-for-Revision event (`requisition_id`, `revision_number`, `returned_by`, `returned_at`, `reviewer_notes`, `items_before` jsonb, `total_before`, `resubmitted_by`, `resubmitted_at`, `items_after` jsonb, `total_after`), plus an index on `requisition_id`.
  - `status='returned_for_revision'` is a new value on the existing free-text `procurement_requisitions.status` column — no migration needed for that. No new permission key — Return for Revision reuses the exact authorization Approve/Reject already have.

## Backend

- `db/services/data.js`
  - `procurementApprovalAction(userId, entityType, entityId, decision, notes)` — accepts `decision='returned_for_revision'` for `entityType==='requisition'` only (invoices/payments unchanged, still `approved`/`rejected` only). Requires `notes`. Snapshots current items into a new `procurement_requisition_revisions` row, sets `status='returned_for_revision'`, bumps `revision_number`, marks the acted-upon step `'returned'` (a new, distinct step status — not reused from `'skipped'`) and all remaining pending steps `'skipped'`. New `logAudit`/`notifyProcurementEvent` calls reuse the existing mechanisms.
  - `procurementRequisitionUpdate` — status gate widened from `draft`-only to `draft` or `returned_for_revision`. No other logic change.
  - `procurementRequisitionSubmit` — status gate widened the same way. On resubmit from `returned_for_revision`: builds a fresh approval chain via the existing `_procBuildApprovalStages` (recalculated from the current `total_estimated_amount`, so a changed total can add/drop the CEO stage), tagged with the requisition's current `revision_number`; updates the open revision row with `items_after`/`total_after`/`resubmitted_by`/`resubmitted_at`; fires `requisition_resubmitted` instead of `requisition_submitted`.
  - `procurementRequisitionDetail` — response extended with a `revisions` array (all revision rows for the requisition, newest first); `steps` now filtered to the requisition's current `revision_number` so "Approval Progress" reflects only the live attempt.
  - New `procurementRequisitionRevisionReports(userId)` — 5 datasets (`outcomeCounts`, `revisionCount`, `avgRevisionTimeHours`, `mostRevisedDepartments`, `mostCommonRevisionReasons`), gated on the existing `procurement-reports` permission. Exported.
  - `notifyProcurementEvent`'s `EVENTS` map — 2 new keys: `requisition_returned_for_revision`, `requisition_resubmitted`.

## Electron

- `electron/main.js` — new `procurement-reports:revisions` IPC handler. (`procurement-requisitions:approve` already forwarded `decision` generically — no change needed for the new decision value.)
- `electron/preload.js` — new `UFCL.procurementRequisitionRevisionReports` method.

## Mobile API

- `mobile-api/routes/procurementRequisitions.js` — new `GET /meta/reports/revisions` route. (The `/:id/approve` route already forwarded `decision` generically — no change needed there.)

## Desktop (`renderer/app.js`)

- `procApprovalStepsHtml` — new `'returned'` badge case.
- `PROC_STATUS_META` — new `returned_for_revision` entry; requisition list status filter gained the new option.
- New shared `openRequisitionEditOverlay(existing, existingItems, onDone)` — extracted from the former inline "New Requisition" overlay body, now used by both `pr-add` (existing=null) and the new "Edit" entry point (existing set), per "do not create a second requisition page."
- `openRequisitionDetailOverlay` — Revision badge, "Return for Revision" button (notes required), "Edit" button (draft/returned-for-revision), new "Revision Timeline" section (new `_procRevisionTimelineHtml`/`_procRevisionItemDiffHtml` helpers rendering before/after item diffs), submit button label changes to "Resubmit for Approval" when applicable.
- `renderProcurementReports` — new "Requisition Revisions" tab, same per-tab pattern as every other tab.

## Mobile

- `mobile/src/types/api.ts` — `ProcurementApprovalStatus` gained `'returned'`; `ProcurementRequisitionStatus` gained `'returned_for_revision'`; `ProcurementRequisition` gained `revision_number`; new `ProcurementRequisitionRevision` interface.
- `mobile/src/navigation/types.ts` — `RequisitionForm` route param widened to also carry `items?: ProcurementRequisitionItem[]`.
- `mobile/src/hooks/useProcurementRequisitions.ts` — `RequisitionDetailResponse` gained `revisions`; `decide()` widened to accept `'returned_for_revision'`; new `useProcurementRequisitionRevisionReports` hook.
- `mobile/src/api/endpoints.ts` — new `PROCUREMENT_REPORT_REVISIONS` endpoint constant.
- `mobile/src/components/ApprovalTimeline.tsx` — new `'returned'` step-status case (icon, color, sub-label).
- `mobile/src/components/StatusBadge.tsx` — new `returned_for_revision`/`returned` color and icon mappings.
- `mobile/src/components/ReasonModal.tsx` — n/a this phase (Inventory Integrity Phase 1's `extraContent` slot not reused here — Procurement's decision UI doesn't need it).
- `mobile/src/screens/procurement/RequisitionDetailScreen.tsx` — revision badge, "Return for Revision" decision button (notes required), "Edit" button, new "Revision Timeline" section, submit label change.
- `mobile/src/screens/procurement/RequisitionFormScreen.tsx` — **bug fix**: item list now actually pre-fills from `params.items` when editing (previously always started blank in edit mode, since editing was never reachable from any screen before this phase); new returned-for-revision notice banner.
- `mobile/src/screens/procurement/ProcurementReportsScreen.tsx` — new "Requisition Revisions" tab, keeping mobile's existing full parity with desktop's procurement reports.

## Verification

- `node --check`: clean on every touched backend/desktop/REST file.
- `npx tsc --noEmit` (mobile): clean, zero errors.
- Live end-to-end test (production DB, one throwaway requisition, real accounts across all 4 approval stages, cleaned up after): reproduced the brief's own scenario (Rice 1,300kg → 1,000kg, Engine Oil added) through return → edit → resubmit → full re-approval → `approved`. Confirmed correct revision-row snapshots (before and after), a fresh 4-step approval chain tagged with the new revision number, the original attempt's steps preserved (not deleted) with the returned step correctly distinguished from the skipped ones, correct report figures, a clean 9-entry audit trail, and a correct 7-notification sequence.

## Outstanding (not fixed this phase — see report)

- No real `department_manager`-role user exists in this environment today; that stage was exercised via the existing admin-override path during verification, not a phase-specific gap.
- No standardized revision-reason taxonomy — `mostCommonRevisionReasons` groups exact reviewer-comment text, since none was specified for this phase.

## Not committed

Per standing release discipline, none of the code above has been committed or pushed. The database migration (2 new columns, 1 new table) was applied live, as noted in the completion report.
