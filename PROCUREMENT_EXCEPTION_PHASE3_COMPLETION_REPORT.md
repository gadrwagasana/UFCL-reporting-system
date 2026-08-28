# Procurement Exception Management Phase 3 — Completion Report

Purchase Order Close with Shortage. Purchase Orders can now be formally closed out when supplier fulfillment has genuinely ended, without ever touching a Goods Receipt record or inventing a second inventory-loss mechanism.

## 1. Executive Summary

Before this phase, a Purchase Order that never fully delivered had exactly one status to live in forever: `partially_received`. `procurementGoodsReceiptCreate` (`db/services/data.js`) only ever writes `'partially_received'` or `'received'` — nothing anywhere closes a PO out. This was already surfaced once earlier this session in a "Partial Goods Receipt" Q&A, which confirmed the exact same gap Stock Transfers had before Inventory Integrity Phase 1 — except, per this phase's own explicit instruction, the fix here is deliberately **not** an inventory movement. "The Close with Shortage process is a procurement governance decision, not an inventory movement" — Goods Receipt stays the sole source of truth for what physically arrived; inventory is never adjusted by this phase.

The fix adds Purchase Orders as a genuine fourth entity type to the same multi-stage approval engine (`procurement_approval_steps`, driven by `procurementApprovalAction`) that Requisitions, Invoices, and Payments already share — confirmed with you before implementation, since PO closure needed real threshold-gated approval, not the single-step auto-approve pattern Inventory Integrity Phase 1 used for a comparable-looking gap. Procurement Review is always required; Finance is additionally required only when the outstanding shortage's value exceeds the same `procurement_config.ceo_threshold` a Requisition's CEO stage already uses — the identical number, not a new one.

A key simplification fell out of checking what was already derivable: "Outstanding Quantity" and "Affected Items" don't need any new storage at all — they're fully computable, at any time, from `procurement_po_items` against `procurement_goods_receipt_items`, exactly the aggregate `procurementGoodsReceiptCreate` already runs internally. Only genuinely new information — the business reason, the supplier's explanation, who requested it, and when it closed — needed new columns. No new table was required (unlike Requisition Return for Revision, which needed one to preserve edited item snapshots — nothing here is ever edited).

Live-verified end-to-end against real production data with three scenarios: a below-threshold single-stage closure, an above-threshold two-stage closure, and a rejected-then-retried closure — confirming no step collision between attempts, Goods Receipt records completely untouched throughout, and every report/audit/notification correct.

## 2. Workflow Review

The workflow matches the brief exactly: Purchase Order → Goods Receipt(s) → Outstanding Quantity Exists → Procurement Review → Decision (Continue Waiting, or Close with Shortage) → Reason Recorded → Approval → Purchase Order Closed (`status='closed_with_shortage'`). "Continue Waiting" requires no code at all — it's simply not acting; the PO stays `partially_received` exactly as it does today, waiting for either another Goods Receipt or a Close with Shortage decision.

## 3. Purchase Order Lifecycle

Two new statuses on the existing free-text `procurement_purchase_orders.status` column — `shortage_pending_approval` (while the approval chain runs) and `closed_with_shortage` (once it fully completes) — zero migration friction, the same convention every other status value on this column already follows. New `procurementPoCloseWithShortage(userId, poId, reason, supplierExplanation)` validates the PO is `partially_received` with a real outstanding quantity, requires the business reason, and builds the approval chain. Rejecting a shortage-closure request reverts the PO to exactly where it was (`partially_received`) — a PO has no terminal "rejected" concept the way a Requisition does, so `procurementApprovalAction` was extended with a small per-entity-type status-lookup rather than hardcoding a fourth status vocabulary into the shared dispatcher. A `shortage_attempt_number` counter (reusing `procurement_approval_steps.revision_number`, the exact "which attempt" tag Requisition Return for Revision already introduced) means a rejected attempt and a later retry never collide on `stage_order` — live-verified directly (see §11).

## 4. Approval Integration

No new approval engine. `procurementApprovalAction` — the one dispatcher Requisitions/Invoices/Payments already share — was generalized, not forked, to also drive Purchase Orders: three small per-entity-type lookups (`ENTITY_REJECT_STATUS`, `ENTITY_MID_STATUS`, `ENTITY_FINAL_STATUS`) replace what used to be a single hardcoded `'rejected'`/`'approved'`/requisition-only guard, so invoices and payments keep behaving byte-for-byte as before. Procurement Review is always the first stage; Finance is added only when the outstanding value exceeds `procurement_config.ceo_threshold` — live-verified both ways: a 1,500-value shortage built a single-stage chain, a 7,500,000-value shortage on an otherwise-identical order correctly built a two-stage chain ending at Finance.

## 5. Audit Integration

Reuses the existing `logAudit`/`audit_log` mechanism exclusively — one new `actionType:'shortage_requested'` entry at initiation, plus the dispatcher's existing approve/reject entries (now also firing for `entityType:'po'`). Live-verified: the full 3-scenario test produced a clean, gap-free audit trail — `shortage_requested`/`approve`/`reject` entries appearing exactly once per transition across all three test POs, with no duplicate or missing entries.

## 6. Notification Integration

Four new event keys added to the existing centralized `notifyProcurementEvent` dispatcher's `EVENTS` map — `po_shortage_requested`, and `po_stage_approved`/`po_approved`/`po_rejected`, which the dispatcher's already-generic `${entityType}_...` key pattern produces automatically for `entityType:'po'` with zero dispatcher changes. No new notification mechanism. The final `po_approved` notification broadcasts to Procurement/Finance/Management roles (the brief's explicit "Management (where applicable)") and also targets the original requester directly — the entity fetch inside `procurementApprovalAction` was extended with a small join to `procurement_requisitions` so a PO (which doesn't natively carry a requester) can still reach the Storekeeper who originally needed the goods. Live-verified: 5 distinct notification titles fired correctly across the 3-scenario test, including the rejection notification reaching the original requester.

## 7. Reporting Integration

New `procurementPoShortageReports` mirrors the exact multi-dataset pattern `procurementRequisitionRevisionReports` already established (Phase 2), reusing the existing `procurement-reports` permission — no new report subsystem. Seven datasets: Closed with Shortage Orders, Outstanding Quantity by Supplier, Supplier Shortage History, Most Common Shortage Reasons (exact-text grouping — no taxonomy was specified, same honesty caveat as Phase 2's revision-reasons dataset), Top Suppliers by Shortage Value, and — rather than recomputing the same numbers a second time — Supplier Fulfillment Rate / Average Supplier Completion Rate are read directly from `procurementReportSupplierPerformance`'s own rows (§8). Live-verified: all three test POs correctly appeared in `closedWithShortageOrders` after cleanup-eligible confirmation.

## 8. Supplier Performance Integration

`procurementReportSupplierPerformance` (existing function, not duplicated) gained four new columns computed via two pre-aggregated CTEs joined at the end — `orders_completed`, `orders_closed_with_shortage`, `delivered_qty_pct` (aggregate received/ordered across every PO), `avg_fulfillment_pct` (average of each PO's own fulfillment ratio, so one large fully-delivered order can't mask many small partial ones). The two-CTE structure specifically avoids a join fan-out that a naive single-query version would hit (goods-receipt-item rows and per-PO-fulfillment rows are two independent one-to-many relationships off the same supplier). Live-verified: the test supplier's row correctly showed `orders_completed:1`, `orders_closed_with_shortage:3`, `delivered_qty_pct:85.0`, `avg_fulfillment_pct:88.8` after the 3-scenario test.

## 9. Desktop UI

`openPoDetailOverlay` (`renderer/app.js`) gained: a Fulfillment card (Ordered / Received / Outstanding / Fulfillment %); an explicit "Waiting for Delivery" vs "Supplier Will Not Deliver" line driven by status, not a new visual language; a Shortage Information card once a reason exists; the existing `procApprovalStepsHtml` reused verbatim for the Shortage Approval Timeline; an Approval decision section (Approve/Reject) matching the Requisition overlay's `canAct` pattern exactly; and a "Close with Shortage" action (reason required, supplier explanation optional) shown only when the PO is `partially_received` with a genuine outstanding quantity. `PROC_STATUS_META` and the PO list's status filter both gained the two new statuses. The Procurement Reports page gained a new "PO Shortages" tab (same per-tab pattern as every other tab) and the Suppliers tab's table gained the four new performance columns.

## 10. Mobile UI

`PurchaseOrderDetailScreen.tsx` gained the identical set of additions as desktop: Fulfillment card, waiting-vs-will-not-deliver distinction, Shortage Information card, the existing `ApprovalTimeline` component reused for the approval timeline, an Approval decision section mirroring `RequisitionDetailScreen`'s established `canAct`/decide pattern, and a Close with Shortage form. `StatusBadge` gained color/icon mappings for both new statuses (used automatically everywhere the component already renders a PO status, including the list screen). `ProcurementReportsScreen.tsx` gained a matching "PO Shortages" tab and the four new supplier-performance columns — keeping mobile's existing full parity with desktop's procurement reports, the same discipline established in Phase 2.

## 11. Verification

**Static**: `node --check` clean on `db/services/data.js`, `db/migrate.js`, `electron/main.js`, `electron/preload.js`, `renderer/app.js`, `mobile-api/routes/procurementOrders.js`. `npx tsc --noEmit` clean on `mobile/` — one type-definition gap found and fixed during verification (`SupplierPerfReportResponse` didn't yet list the 4 new fields the extended report now returns), zero errors after.

**Live** (production DB, throwaway supplier POs against the real `_QA Supplier Ltd` fixture already present from earlier session testing, real Procurement Manager and Finance accounts, all test data removed after):

1. **Below-threshold**: PO for 1,000kg Rice, Goods Receipt for 850kg → confirmed computed outstanding=150, value=1,500 → Close with Shortage → confirmed single-stage chain (`procurement_review` only, correctly below the 5,000,000 threshold) → approved → confirmed `status='closed_with_shortage'`, `shortage_closed_at` populated, and the Goods Receipt row completely unchanged throughout.
2. **Above-threshold**: an otherwise-identical PO with a high unit price so the same 150-unit shortage is worth 7,500,000 → confirmed a two-stage chain (`procurement_review` then `finance`) → walked both stages → confirmed final closure.
3. **Rejection + retry**: requested closure, rejected at Procurement Review → confirmed the PO correctly reverted to `partially_received` (not a generic "rejected" status) → requested closure a second time → confirmed `shortage_attempt_number` incremented to 2, a fresh single pending step with **no collision** against the first (rejected) attempt's step, which remained in the table tagged to attempt 1 rather than being deleted → approved the second attempt to full closure.
4. Confirmed `procurementPoShortageReports` and the extended `procurementReportSupplierPerformance` both reflected all three test POs correctly.
5. Confirmed an 11-entry, gap-free audit trail and 5 distinct, correctly-targeted notification titles across the full 3-scenario run.
6. Cleaned up: all three throwaway POs, their items, goods receipts, approval steps, and their seed requisitions were deleted. No residual data.

## 12. Production Readiness

**A Purchase Order that will never fully deliver can now be formally closed — with a real, threshold-appropriate approval chain, a preserved reason, and zero impact on Goods Receipt or inventory records — instead of sitting at `partially_received` forever.** Every addition reuses an existing mechanism: the same approval engine, the same audit framework, the same notification dispatcher, the same reporting pattern, the same UI components. No parallel procurement or inventory architecture was introduced anywhere in this phase. Live-verified end-to-end against real production data across three distinct scenarios, on both platforms.

## Outstanding Items

- No file/attachment capability — "Supporting Documents" was explicitly qualified "(if already supported)" in the brief, and no upload framework exists anywhere in this codebase (confirmed repeatedly this session), so it was left out rather than invented.
- `mostCommonShortageReasons` groups by exact reviewer-comment text, not a standardized category — no taxonomy was specified for this phase, matching Requisition Return for Revision's identical honesty caveat.
- If company policy ever requires an inventory implication for a closed-with-shortage PO, the brief explicitly directs reusing the existing Inventory Loss framework (Inventory Integrity Phase 1) rather than building a second one — not built here, since it wasn't asked for.

## Not committed

Per standing release discipline, none of the code above has been committed or pushed. The database migration (6 new columns on `procurement_purchase_orders`, no new tables) was applied to the live database as part of implementing this approved phase.
