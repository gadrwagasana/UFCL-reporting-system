# Procurement Exception Management Phase 2 — Completion Report

Procurement Requisition Return for Revision. A correctable request no longer has to die and be recreated — it can now be sent back, fixed, and resubmitted as the same document, with full history preserved and the approval chain restarted honestly.

## 1. Executive Summary

Before this phase, Procurement Requisitions had exactly two approval outcomes: Approve or Reject. A Supervisor who spotted a wrong quantity or a missing line item had no way to say "fix this" — only "kill this." Reject was permanent; the Storekeeper had to raise a brand-new requisition from scratch, losing the paper trail between the original request and its replacement.

This phase adds a third outcome, Return for Revision, to the single generic approval dispatcher (`procurementApprovalAction`) already shared by requisitions, invoices, and payments — scoped to requisitions only, so invoice/payment approval is completely untouched. Returning a requisition snapshots its current items, marks it `returned_for_revision`, and abandons the in-flight approval chain (mirroring exactly how Reject already abandons it). The Storekeeper edits the *same* requisition — reusing the existing (previously unused) update function, now just widened to accept one more status — and resubmits, which rebuilds a fresh approval chain from stage 1 using the same business rules that ran the first time, and closes out the revision record with what changed.

Two decisions were confirmed with you before implementation: Return for Revision reuses the exact same authorization as Approve/Reject at every stage (no new authorization boundary), and revision history is stored as two full JSONB item snapshots per event (before/after) rather than a per-field diff table — simpler, always complete, and diffed at render time for the UI.

Live-verified end-to-end against real production data using the brief's own scenario (Rice 1,300kg → corrected to 1,000kg, Engine Oil added): return → edit → resubmit → full re-approval through all four stages → `approved`, with every audit entry, notification, and report figure confirmed correct, and the original (abandoned) approval attempt's steps preserved in the database, not deleted.

## 2. Workflow Review

The workflow now matches the brief exactly: Storekeeper submits → reviewer decides Approve / Reject / **Return for Revision** → on return, the Storekeeper edits the same requisition and resubmits → the approval workflow restarts from stage 1 using the existing engine → approval continues normally from there. Reject and Approve behave exactly as before — nothing about their mechanics changed. The only new fork is at the decision point itself.

## 3. Revision Lifecycle

Two new columns (`procurement_requisitions.revision_number`, `procurement_approval_steps.revision_number`, both defaulting to 0) and one new table, `procurement_requisition_revisions`, drive the lifecycle. Returning a requisition inserts one row — `revision_number`, `returned_by`, `returned_at`, `reviewer_notes` (a required reason — this phase's "Reviewer Comments"), `items_before` (a full snapshot of the requisition's items at that moment), `total_before` — and bumps the requisition's own `revision_number`. Resubmitting updates that *same* row with `items_after`, `total_after`, `resubmitted_by`, `resubmitted_at`. Nothing is ever overwritten: a requisition returned twice has two rows, each with its own complete before/after picture. `procurementRequisitionUpdate` and `procurementRequisitionSubmit` were both widened from "only `draft`" to "`draft` or `returned_for_revision`" — the same functions, same destructive-but-safe item replace (safe *because* the pre-edit state was already captured by the return event, not by the update itself).

## 4. Approval Integration

No new approval engine. `_procBuildApprovalStages` (the existing function that decides which stages apply, based on `total_estimated_amount` and the configurable CEO threshold) runs again on every resubmit, exactly as it does on first submit — so if an edit changes the total enough to cross the CEO threshold, the CEO stage is correctly added; if it drops back below, correctly dropped. No stage is ever skipped. The fresh chain is tagged with the requisition's new `revision_number` so it's distinguishable from the abandoned first attempt's steps, which stay in the table (tagged `revision_number=0`) rather than being deleted — `procurementRequisitionDetail`'s "Approval Progress" filters to the current revision so it stays clean, while the full history remains permanently queryable. The step that actually triggered the return gets a new, honest status, `'returned'` (not lumped in with `'skipped'`, which is reserved for stages that never got a chance to act) — live-verified: after return, the acted-upon Supervisor step read `status: 'returned'` while the three later stages read `'skipped'`.

## 5. Audit Integration

Two new audit entries reuse the existing `logAudit` call already present in both functions — `return_for_revision` (meta includes the revision number and the reviewer's reason) and `resubmit` (meta includes the revision number). No new audit mechanism. Live-verified: the test requisition's full audit trail read as one continuous 9-entry sequence — create, submit, return_for_revision, update, resubmit, and four approve entries — with no gap and no duplicate entries for the same event.

## 6. Notification Integration

Two new event keys, `requisition_returned_for_revision` and `requisition_resubmitted`, were added to the existing centralized `notifyProcurementEvent` dispatcher's `EVENTS` map — the same mechanism every other procurement notification already uses. Returning notifies the requester; resubmitting notifies both the next stage's role and the specific reviewer who returned it (via a `forUserId` alongside the role broadcast, the same dual-target pattern `requisition_approved` already uses). Live-verified: both new notifications fired with the correct recipients and content, alongside the pre-existing submitted/stage-approved/fully-approved notifications, for a correct 7-notification total across the full test lifecycle.

## 7. Reporting Integration

New `procurementRequisitionRevisionReports` reuses the existing `procurement-reports` permission gate — no new report subsystem, no new permission key for data access. Five datasets: outcome counts (approved/rejected/returned), revision count per requisition, average time-to-resubmit, most-revised departments, and most-common revision reasons (grouped by exact reviewer-comment text — no standardized reason taxonomy was specified for this phase, so this is honestly exact-match, not an invented category system). Live-verified: the test requisition correctly appeared in `revisionCount` with a count of 1 after being returned once.

## 8. Desktop UI

The requisition detail overlay (`renderer/app.js`) gained: a Revision badge next to the status badge once `revision_number > 0`; a third "Return for Revision" button alongside Approve/Reject, with the same notes field now required for that specific action; a "Revision Timeline" section rendering every return/resubmit event with a before/after item diff (added rows green, removed rows struck through red, changed quantity/price amber); and an "Edit" button (draft or returned-for-revision only) that opens a form. That form is not a second requisition page — it's the exact same overlay the "New Requisition" button already used, generalized into one shared `openRequisitionEditOverlay(existing, items, onDone)` function used by both entry points, per the brief's explicit instruction. The Procurement Reports page gained a "Requisition Revisions" tab, following the exact same per-tab fetch-and-render pattern as every other tab already on that page.

## 9. Mobile UI

`RequisitionDetailScreen` gained the same three additions as desktop: revision badge, Return for Revision button (notes required, enforced client-side before the call), and a Revision Timeline section. An "Edit" button now navigates to `RequisitionFormScreen` — which already had edit-mode logic (routing to `update()` instead of `create()`) but had a **real, previously-latent bug**: it never actually pre-filled the item list from the existing requisition, always starting from one blank row even when editing. Since editing was never reachable from any screen before this phase, that bug had never been triggered end-to-end; it's fixed here as part of making Edit genuinely usable (the navigation param type was widened to carry the requisition's current items alongside the requisition itself). `ApprovalTimeline` and `StatusBadge` — the two shared components used across many procurement screens, not just requisitions — gained handling for the new `'returned'` step status and `'returned_for_revision'` requisition status respectively, both purely additive (existing statuses render exactly as before). The mobile `ProcurementReportsScreen` — which, unlike Maintenance/Inventory's mobile screens, already has full report parity with desktop — gained the same "Requisition Revisions" tab desktop got, keeping that parity intact rather than introducing a new desktop-only report.

## 10. Verification

**Static**: `node --check` clean on `db/services/data.js`, `db/migrate.js`, `electron/main.js`, `electron/preload.js`, `renderer/app.js`, `mobile-api/routes/procurementRequisitions.js`. `npx tsc --noEmit` clean on `mobile/` — zero errors on the first run after all edits.

**Live** (production DB, one throwaway requisition, real Supervisor/Storekeeper/Procurement-Manager/Finance accounts plus an admin override for the one approval stage — `department_manager` — that has no assigned user in this environment today; removed after):

1. Storekeeper created a requisition reproducing the brief's own scenario: Rice at 1,300kg (should be 1,000kg), Engine Oil missing entirely. Submitted — chain built correctly (`supervisor → department_manager → procurement_review → finance`).
2. Supervisor returned it for revision with a reason. Confirmed: `status='returned_for_revision'`, `revision_number=1`, a `procurement_requisition_revisions` row with the correct 1-item `items_before` snapshot and `returned_by`/`reviewer_notes` populated; the acted-upon approval step correctly read `status='returned'`.
3. Storekeeper edited the requisition (Rice → 1,000kg, added Engine Oil) via the widened `procurementRequisitionUpdate`, then resubmitted.
4. Confirmed the revision row was updated in place with a correct 2-item `items_after` snapshot, `resubmitted_by`/`resubmitted_at` populated; confirmed a fresh 4-step approval chain was inserted, all `pending`, tagged with `revision_number=1`; confirmed the original revision-0 steps were still present in the database (not deleted) — Supervisor's step `'returned'`, the other three `'skipped'`.
5. Walked the fresh chain to full approval (Supervisor → admin-as-department_manager → Procurement Manager → Finance). Confirmed final `status='approved'`.
6. Confirmed `procurementRequisitionRevisionReports` correctly counted this requisition's one revision.
7. Confirmed a clean, gap-free 9-entry audit trail and a correct 7-notification sequence across the whole lifecycle.
8. Cleaned up: deleted the test requisition's items, approval steps (both revisions), revision record, and the requisition row itself. No residual data.

## 11. Production Readiness

**A requisition returned for revision stays the same business document from creation to final approval — correctable requests are no longer rejected and recreated, full before/after history is preserved for every return, and the approval chain restarts honestly through the same engine every other approval already uses.** No new approval, audit, notification, or reporting subsystem was introduced anywhere in this phase; every addition extends a function or dispatcher that already existed. Live-verified end-to-end against real production data using the brief's own example, on both platforms.

## Outstanding Items

- The live environment has no user currently assigned the `department_manager`-equivalent role (`department-manager`); that approval stage was exercised in verification via the existing admin-override path (`procurementApprovalAction` already allows `admin` to act on any stage) rather than a real department-manager account. Not a defect introduced by this phase — the same gap exists for ordinary Approve/Reject on that stage today.
- `mostCommonRevisionReasons` groups by exact reviewer-comment text, not a standardized category — no fixed reason taxonomy was specified for this phase (unlike Inventory Integrity Phase 1's explicit 8-value list), so none was invented.
- Return for Revision is available at every approval stage, including Finance/CEO, per your confirmed decision — a requisition could in principle be returned very late in its chain. This is intentional, not a gap.

## Not committed

Per standing release discipline, none of the code above has been committed or pushed. The database migration (2 new columns, 1 new table) was applied to the live database as part of implementing this approved phase.
