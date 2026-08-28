# Procurement Exception Management Phase 3 — Changelog

Purchase Order Close with Shortage. See `PROCUREMENT_EXCEPTION_PHASE3_COMPLETION_REPORT.md` for full detail, reasoning, and live-verification evidence.

## Database (migration applied to live DB via `npm run migrate`)

- `db/migrate.js` — new function `createProcurementPoShortageColumns()`, called at the end of `migrate()`. 6 new nullable columns on `procurement_purchase_orders`: `shortage_reason`, `shortage_supplier_explanation`, `shortage_requested_by` (FK `app_users`), `shortage_requested_at`, `shortage_closed_at`, `shortage_attempt_number` (int, default 0). No new table — "Outstanding Quantity"/"Affected Items" stay fully derived at read time from `procurement_po_items` vs `procurement_goods_receipt_items`. `shortage_attempt_number` reuses `procurement_approval_steps.revision_number` (added in Requisition Return for Revision Phase 2) as its "which attempt" tag — no new column needed on that table. `status='shortage_pending_approval'`/`'closed_with_shortage'` are new values on the existing free-text `status` column — no migration needed for those.

## Backend

- `db/services/data.js`
  - `procurementApprovalAction` — generalized to a 4th entity type, `'po'` (`ENTITY_TABLE.po`). New per-entity-type lookup maps (`ENTITY_REJECT_STATUS`, `ENTITY_MID_STATUS`, `ENTITY_FINAL_STATUS`) replace the previously-hardcoded `'rejected'`/`'approved'`/requisition-only mid-status guard — invoices/payments unchanged. Rejecting a PO's shortage request reverts it to `'partially_received'`. Final PO approval also sets `shortage_closed_at=now()`. The entity fetch was extended with a small conditional join so `entity.requester_id` is available for POs (via their linked requisition) the same way it's natively available for the other three entity types.
  - New `_procPoFulfillmentTotals(poId)` — shared helper computing ordered/received/outstandingQty/outstandingValue/fulfillmentPct live from `procurement_po_items` vs `procurement_goods_receipt_items`; used by both `procurementPoDetail` and `procurementPoCloseWithShortage`, not duplicated.
  - New `procurementPoCloseWithShortage(userId, poId, reason, supplierExplanation)` — validates status/outstanding qty, requires a reason, sets the 4 shortage fields + increments `shortage_attempt_number`, builds the approval chain (`procurement_review` always; `finance` added only if outstanding value exceeds `procurement_config.ceo_threshold`), inserts into `procurement_approval_steps` tagged with the new attempt number. Exported.
  - `procurementPoDetail` — extended to also return `fulfillment` (from `_procPoFulfillmentTotals`) and `steps` (this PO's current-attempt approval steps, filtered to `revision_number = po.shortage_attempt_number`, same filter pattern Phase 2 established for requisitions).
  - `procurementReportSupplierPerformance` — extended (not duplicated) with `orders_completed`, `orders_closed_with_shortage`, `delivered_qty_pct`, `avg_fulfillment_pct`, computed via two pre-aggregated CTEs joined at the end (avoids a join fan-out between two independent one-to-many relationships).
  - New `procurementPoShortageReports(userId)` — 7 named datasets, gated on the existing `procurement-reports` permission, mirrors `procurementRequisitionRevisionReports`'s exact shape. Exported.
  - `notifyProcurementEvent`'s `EVENTS` map — 4 new keys: `po_shortage_requested`, `po_stage_approved`, `po_approved`, `po_rejected` (the latter three produced automatically by the dispatcher's existing `${entityType}_...` pattern — no dispatcher change needed beyond the entries themselves).

## Electron

- `electron/main.js` — new `procurement-po:close-shortage` and `procurement-po:approve` IPC handlers; new `procurement-reports:po-shortages` handler.
- `electron/preload.js` — new `UFCL.procurementPoCloseWithShortage`, `UFCL.procurementPoApprove`, `UFCL.procurementPoShortageReports` methods.

## Mobile API

- `mobile-api/routes/procurementOrders.js` — new `POST /:id/close-shortage`, `POST /:id/approve` routes (declared alongside the existing `/:id` routes); new `GET /meta/reports/po-shortages` route, declared before the `/:id` routes per this file's own established `/meta`-prefix ordering convention.

## Desktop (`renderer/app.js`)

- `PROC_STATUS_META` — new `shortage_pending_approval`/`closed_with_shortage` entries.
- `openPoDetailOverlay` — Fulfillment card, waiting-vs-will-not-deliver status line, Shortage Information card, Shortage Approval Timeline (reuses `procApprovalStepsHtml`), Approval decision section (Approve/Reject, mirrors the Requisition overlay), "Close with Shortage" action/form. Now accepts an `onDone` callback, wired from `renderProcurementOrders`'s `.po-view` handler.
- PO list's status filter gained the two new statuses.
- `renderProcurementReports` — new "PO Shortages" tab (7 datasets); Suppliers tab table gained the 4 new performance columns.

## Mobile

- `mobile/src/types/api.ts` — `ProcurementPoStatus` gained the two new statuses; `ProcurementPurchaseOrder` gained the 6 shortage fields; new `ProcurementPoFulfillment` interface.
- `mobile/src/api/endpoints.ts` — 3 new endpoint constants (`PROCUREMENT_PO_CLOSE_SHORTAGE`, `PROCUREMENT_PO_APPROVE`, `PROCUREMENT_REPORT_PO_SHORTAGES`).
- `mobile/src/hooks/useProcurementOrders.ts` — `PoDetailResponse` extended with `fulfillment`/`steps`; new `closeWithShortage`/`decideShortage` actions; new `useProcurementPoShortageReports` hook.
- `mobile/src/hooks/useProcurementDashboard.ts` — `SupplierPerfReportResponse` extended with the 4 new performance fields (caught and fixed during `tsc --noEmit` verification).
- `mobile/src/components/StatusBadge.tsx` — color/icon mappings for the two new PO statuses.
- `mobile/src/screens/procurement/PurchaseOrderDetailScreen.tsx` — Fulfillment card, waiting-vs-will-not-deliver distinction, Shortage Information card, `ApprovalTimeline` reuse, Approval decision section, Close with Shortage form.
- `mobile/src/screens/procurement/ProcurementReportsScreen.tsx` — new "PO Shortages" tab; Suppliers tab row extended with the 4 new performance figures.

## Verification

- `node --check`: clean on every touched backend/desktop/REST file.
- `npx tsc --noEmit` (mobile): one type gap found and fixed (`SupplierPerfReportResponse` needed the 4 new fields), clean after.
- Live end-to-end test (production DB, throwaway POs against an existing throwaway supplier fixture, real Procurement Manager/Finance accounts, removed after): three scenarios — below-threshold single-stage closure, above-threshold two-stage closure, and a rejected-then-retried closure with no approval-step collision between attempts. Confirmed Goods Receipt records completely untouched throughout, correct report/supplier-performance figures, an 11-entry gap-free audit trail, and 5 correctly-targeted notification titles.

## Outstanding (not fixed this phase — see report)

- No file/attachment capability — explicitly qualified "(if already supported)" in the brief; no upload framework exists anywhere in this codebase.
- `mostCommonShortageReasons` groups exact reviewer-comment text — no taxonomy was specified.
- No inventory-side implication for closed-with-shortage POs — the brief explicitly says to reuse Inventory Integrity Phase 1's framework if this is ever required, not to build it now.

## Not committed

Per standing release discipline, none of the code above has been committed or pushed. The database migration (6 new columns, no new tables) was applied live, as noted in the completion report.
