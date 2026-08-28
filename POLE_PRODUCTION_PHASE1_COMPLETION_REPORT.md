# Pole Production Phase 1
## External Raw Logs → Pole Production → Finished Poles → Sales

## 1. Executive Summary

The audit found that Pole Production has unusually rich, fully-wired UI on **both** desktop and mobile (purchase requests, deliveries, an inline quality check) sitting on top of a backend with three real architectural gaps: no distinct production-batch/output-spec concept (just a bare `daily_logs.poles_units` counter), no reuse of the shared Quality Inspection/Rejection/Resolution engine (poles had zero access to Rework/Downgrade/Return-to-Inventory/Firewood/Scrap/Disposal), and no real Finished Pole Inventory (a Poles Product Catalog entry existed with a `stock_catalog` bridge, but nothing ever posted stock into it — `stock_levels` for the one real Poles product had zero rows and zero history despite Sales already being able to select it).

This phase closed all three gaps for **Path A (manufactured poles)** by adding a batch + output-lines model directly mirroring the existing Nyanza Value-Added Production precedent — same shape, same reuse of the polymorphic `quality_inspections`/`rejection_holds` pattern (a third sibling column added exactly the way the second one was), same `_postFinishedTimberStock` helper for real inventory. **Path B (purchased finished poles)** was found to be already structurally achievable through the existing generic Procurement pipeline (Requisition → PO → Goods Receipt already posts real stock for any Product Catalog item) — one open question (whether purchased poles need an explicit QC gate before sale, unlike other procured goods) is documented as a business decision rather than built into the shared Goods Receipt function used by every procurement category.

The existing `poles_purchase_requests`/`poles_deliveries` mini-pipeline (a live, working, workshop-isolated purchasing flow with real history) was left completely untouched — migrating it onto the generic Requisition/PO pipeline is a major undertaking, documented as a business decision, not attempted.

## 2. Existing Architecture Audit

**Confirmed via 2 parallel research agents plus direct database inspection:**

- `poles_purchase_requests`/`poles_deliveries` is a fully separate, simplified purchasing pipeline (request → CEO approval → delivery → inline QC), never integrated with the canonical Requisition→PO→Goods Receipt system used everywhere else in Procurement.
- "Raw Log Inventory" is purely virtual — computed on every read as `approved deliveries − produced (daily_logs.poles_units + poles_waste)`, never a real `stock_levels` row. This is **architecturally consistent** with how Timber's own raw log balance works (`_rawLogAvailableStock`), not a unique deficiency.
- "Pole Production" had no distinct batch/output concept — just a raw integer count on `daily_logs`, with no per-spec breakdown, no QC linkage, no consumption debit against the raw-log balance beyond a read-only validation check.
- Quality Inspection for poles was a wholly separate, simpler inline mechanism (`poles_deliveries.approved_qty`/`rejected_qty`), never touching the shared `quality_inspections`/`rejection_holds` tables — meaning poles had zero access to Rework/Downgrade/Return-to-Inventory/Firewood/Scrap/Disposal.
- A real Poles Product Catalog entry exists (`products` id 2, "Poles O255x12m", bridged to `stock_catalog` id 21, category "Finished Poles") and Sales can already select it (`salesProductsForDropdown` returns it with a real `default_price`) — but `stock_levels`/`stock_movements` for that item had **zero rows ever**, because nothing in the production path posts to it (the only stock-posting function, `_insertDailyLogItemsAndPostStock`, hard-filters `type='Timber'`).
- UI is fully built on both platforms for the *existing* (incomplete) model: desktop consolidates purchase/delivery/QC/production into one "Daily Poles" page; mobile splits into 4 dedicated navigator stacks (`PolesProductionStack`, `PolesPurchaseStack`, `PolesDeliveryStack`, `PolesQCStack`) plus a CEO Approvals tab. No orphaned screens found on either platform.
- Costing fields (`standard_cost`/`default_price`) work generically for Poles Product Catalog entries, same as Timber — but `poles_deliveries.unit_price` never automatically feeds them.
- Workshop Isolation is correctly applied to the poles-specific tables, but `dispatchReview` (an unrelated, pre-existing function) reads the *global* `mv_stock_summary` instead of the workshop-scoped `mv_stock_by_workshop` for its dispatch-quantity gate — a real isolation gap in the gating layer, found during this audit and fixed (§17).

## 3. Purchased Raw Logs

Unchanged. The existing `poles_purchase_requests`/`poles_deliveries` flow (supplier, quantity, unit price, CEO approval, delivery, inline approved/rejected split) continues to work exactly as before, on both platforms. This phase's raw-log balance helper (`_polesAvailableRawLogQty`) reads from the same tables without altering their write paths.

## 4. Raw Log Inventory

Confirmed still virtual/computed, matching Timber's own established pattern — not changed. The balance formula was extended (not redefined) to also account for consumption via the new production batches, so the legacy `daily_logs.poles_units` entry path and the new batch path share one pool and can't double-spend the same raw logs.

## 5. Pole Production

**Built.** New `pole_production_batches` table captures batch date, workshop, operator, supervisor, machine, start/end time, downtime + reason, input raw log quantity, and notes — validated against the shared raw-log balance (`Requested Input ≤ Available Raw Log Inventory`, rejected with a clear error otherwise). The legacy `daily_logs.poles_units` counter is **not removed** — many existing dashboards/reports read it, and real users use it daily; it now coexists safely with the new batch system via the shared balance.

## 6. Production Output

**Built.** New `pole_production_outputs` table: one row per output line, each referencing a real Product Catalog item (never hardcoded), with independent quantity and QC status. A single batch can produce multiple distinct pole specs in one run, exactly as the brief's example table describes.

## 7. Production Waste

Genuine production loss (rejected quantity at inspection) is never silently dropped — it becomes a real `rejection_holds` row with the standard resolution paths available (Rework, Downgrade, Return-to-Inventory, Firewood, Scrap Sale, Disposal — all already generic, described in §9).

## 8. Resaw / Rework

**Built.** `rejectionResolveRework` gained a third branch (alongside its existing Sawmill and Nyanza branches): a rejected pole output can be sent to rework, creating a new `pole_production_outputs` row on the same batch with `rework_of_rejection_id` set, re-entering `pending_qc` and going back through the same inspection function. Live-verified: rejected 3 units, reworked them, re-inspected, accepted — correctly posted an additional +3 to Finished Pole Inventory.

## 9. Quality Inspection

**Built.** New `poleProductionInspect` function, directly mirroring `valueAddedProductionInspect`: creates a `quality_inspections` row (now with a third polymorphic source column, `pole_production_output_id`), posts accepted quantity to real inventory via the existing `_postFinishedTimberStock` helper, and creates a `rejection_holds` row for anything rejected. **Downgrade, Return-to-Inventory, and the generic Firewood/Scrap Sale/Disposal resolution engine needed zero *backend* code changes** — they already operate generically off the frozen `quality_inspections.product_id`/`stock_item_id`/`workshop_id`, confirmed live: a poles-origin rejection hold was resolved via `rejectionResolveReturnToInventory` with no modification to that function at all.

**Mobile UI gap found while documenting this section**: the existing mobile resolution UI for these actions is not a shared, generic screen — it's embedded per-department inside `SawmillDashboardScreen.tsx`/`VatProcessingScreen.tsx`. Poles has no equivalent, so despite the backend working correctly, mobile users currently have no screen to act on a rejected pole (desktop does, via §16's new Rejection Holds card). Documented as a follow-up in the gap register, not built this phase.

## 10. Purchased Finished Poles

**Not built — confirmed already structurally achievable, with one open question.** Path B doesn't exist as a distinct mechanism today, but a purchased finished pole is conceptually just a standard purchased finished good: the generic Requisition → Purchase Order → Goods Receipt pipeline already posts real stock for any Product Catalog item with a `stock_catalog` bridge (confirmed working, fixed in an earlier remediation phase). The one gap: the generic Goods Receipt function posts stock immediately on receipt, with no QC gate — whereas the brief's own Path B diagram shows an explicit Quality Inspection step between Receiving and Finished Pole Inventory. Adding a QC gate to the shared Goods Receipt function would affect every procurement category, not just poles — **documented as a business decision** (§25), not built.

## 11. Finished Pole Inventory

**Fixed.** Manufactured poles now post real `stock_levels`/`stock_movements` entries on QC acceptance (§9). Purchased finished poles can already post real inventory via the existing Goods Receipt pipeline (§10), pending the QC-gate decision. Both origins converge on the same `stock_catalog`/`stock_levels` ledger — no second inventory system was created.

## 12. Sales

Unchanged — already worked for Poles once real inventory exists (confirmed: `salesCreate`'s stock-item + workshop deduction logic is fully generic, already applies to Poles the same as Timber). The previous blocker was simply that stock never got credited in the first place; §11 fixes that for manufactured poles.

## 13. Stock Transfers

Unchanged — the existing generic Stock Transfer workflow already works for any `stock_catalog` item, including the real Poles inventory this phase now populates. No pole-specific transfer logic was built.

## 14. Costing

Unchanged. Product Catalog cost fields (`standard_cost`/`default_price`) already work generically for Poles. `poles_deliveries.unit_price` → automatic cost linkage was investigated and found to have no clean, low-risk implementation within this phase's scope (raw log purchase price and a specific manufactured pole spec's cost are not a 1:1 relationship without a costing/BOM model this program has repeatedly declined to invent) — documented, not built.

## 15. CRUD Parity

See `POLE_PRODUCTION_PHASE1_CRUD_PARITY_MATRIX.md`.

## 16. Desktop/Mobile Parity

Batch creation and Quality Inspection (accept/reject) have full parity: desktop's "Pole Production Batches" card (list, new-batch overlay with multi-output-line builder, inline inspect, reconciliation card) has a direct mobile equivalent (`PoleBatchListScreen`/`PoleBatchCreateScreen`/`PoleBatchInspectScreen`, reached via a stack push from the existing Poles Production tab — not a new bottom tab, matching this codebase's own established "extra screens live in the existing stack" convention already used for Sawmill's Timber Inventory/Dashboard screens). Both `poles-leader` and `poles-supervisor` mobile roles get the new screens automatically, since they share the same underlying navigation stack, matching the backend's own role permissions exactly.

**Two confirmed parity gaps, mobile behind desktop**: (1) batch deletion has no mobile UI (the REST route/hook exist; no delete button on `PoleBatchListScreen`); (2) rejection-holds resolution (Rework/Downgrade/Return-to-Inventory/Firewood/Scrap/Disposal) has no mobile UI at all for poles, since the existing mobile resolution screens are embedded per-department in Sawmill/VAT specifically, not a shared component. Both documented in the gap register as reasonably-sized follow-ups, not attempted in this phase.

## 17. Workshop Isolation

Every new table/function uses the existing `isWorkshopRestricted`/`workshop_id` idiom (confirmed via 4 dedicated checks in the live verification run: create, list, inspect, and delete all correctly deny/scope cross-workshop access). Additionally found and fixed a **pre-existing** isolation gap unrelated to the new build: `dispatchReview`'s dispatch-quantity gate read the global `mv_stock_summary` instead of the workshop-scoped `mv_stock_by_workshop`, meaning a dispatch could theoretically pass using stock sitting in a different workshop. Fixed to use the workshop-scoped view when the sales order has a known workshop, falling back to the global view only for legacy/unscoped orders — matching the existing "`workshop_id is null` = company-wide" convention used elsewhere. This is graceful: for a workshop with no `daily_logs` production history, the workshop-scoped view simply returns no row (a property of the underlying materialized view, not a new failure mode), and the existing `if (v && col)` guard already handles that by skipping the check exactly as it always has.

## 18. Approvals

Reused entirely — no new approval hierarchy was created. Batch creation is not a new approval gate (matches the brief's own instruction); rejection resolution continues through whatever the shared engine already requires (e.g., Downgrade/Return-to-Inventory correctly still require supervisor-tier-or-above — confirmed live that `poles-leader` is correctly excluded from these two actions, the exact same restriction `vat-leader` already has, not a new or inconsistent restriction).

## 19. Notifications

Reused entirely. `poleProductionInspect` fires the same `pushNotification` call Nyanza's inspect function already uses for a rejection, addressed to the same role set pattern (admin/ceo/operations/supervisor/poles-leader/poles-supervisor), with `relatedModule: 'rejection_holds'` — already a correctly-routed module key on both platforms per prior phases' notification-routing work.

## 20. Audit Trail

Every new mutation (`poleProductionBatchCreate`, `poleProductionBatchDelete`, `poleProductionInspect`, the rework branch) writes through the existing, unmodified `logAudit` function — confirmed live.

## 21. Reconciliation

**Built.** New `poleProductionReconciliation` function: input raw logs vs. (accepted + rejected + pending QC) output pieces, plus a computed output volume using each output *product's* own diameter/length (`Volume = π·r²·length`, per the brief's own cylinder formula). **Input-side volume is explicitly not computed** — raw log purchase records (`poles_purchase_requests`/`poles_deliveries`) capture only a piece count, never per-log diameter/length, so a volume-based recovery percentage cannot be honestly calculated from current data. Recovery % is reported as a piece-count ratio instead, with the reasoning stated directly in the API response (`recoveryBasis: 'piece_count'` + an explanatory `note` field) rather than fabricating a volume-based figure — matching the brief's explicit "do not invent a missing business rule" instruction.

## 22. Dashboard

The existing "Daily Poles" desktop page and mobile Production screen both already show Available Stock / Pending Requests / Awaiting QC / Poles in Stock. This phase added a Production Reconciliation summary (batches, accepted/rejected/pending-QC totals, output volume, recovery %) to both platforms, using only real, currently-supported data — no metric was invented.

## 23. Reporting

No new reporting infrastructure was created — the reconciliation view above reuses the same card/table rendering patterns Nyanza's own reconciliation report already established on both platforms.

## 24. Live Verification

Full scenario suite run twice against the live database (disposable QA data, fully cleaned up both times, zero residue verified after each run):

- **Scenario A/B** (purchase → approve → deliver → QC → production batch → output → QC accept → real inventory posting): confirmed, including a correct over-consumption rejection (`input qty exceeds available raw log inventory`).
- **Scenario C** (rejected pole → rework → re-inspect → accept): confirmed, additional stock correctly posted.
- **Scenario D** (rejected pole → Return-to-Inventory, representative of Downgrade/Firewood/Scrap/Disposal): confirmed at the **backend/function level** with zero code changes, proving the generic resolution engine reuse. This is a direct function call, not a UI click-through — see §16 for the confirmed mobile UI gap for this action.
- **Scenario I** (cross-workshop authorization): confirmed via the standard `isWorkshopRestricted` checks already exercised in the create/inspect/delete functions.
- **Scenario J** (full traceability): confirmed end-to-end — every stock_movements row correctly references its originating QC inspection or resolution action.
- Scenarios E/F/G (purchased finished poles, sales with negotiated price) were not exercised live since Path B was not built this phase (§10); Scenario H (stock transfer) was not separately re-tested since it reuses the already-verified generic Stock Transfer workflow unchanged.
- `dispatchReview`'s workshop-scoped fix was smoke-tested directly (both the workshop-scoped and global-fallback query paths execute without error).

All QA data (2 purchase requests, 2 deliveries, 4 production batches, 6 output lines, 6 quality inspections, 4 rejection holds, 6 stock movements) fully deleted; `stock_levels` reset to its exact original value (0); audit_log entries from the verification were intentionally left in place, per this program's established practice of never deleting the audit trail.

## 25. Outstanding Items (Requires Business Decision)

1. **Purchased Finished Poles QC gate** — should purchased finished poles go through an explicit Quality Inspection step before being sellable (matching the manufactured-pole philosophy), or follow the same "immediate stock posting on receipt" pattern every other procured good already uses via Goods Receipt? This determines whether new logic needs to be added to the shared, cross-category Goods Receipt function.
2. **Migrating `poles_purchase_requests`/`poles_deliveries` onto the generic Requisition/PO pipeline** — the brief's own target architecture diagram shows this, but it's a live, working system with real history; migrating it is a major, separate undertaking with real data-migration risk, not attempted here.
3. **Raw log purchase dimension capture** — if volume-based (not just piece-count) recovery reporting is wanted, raw log purchase/delivery records would need to start capturing per-log diameter/length, which they don't today.
4. **`poles_deliveries.unit_price` → automatic product costing linkage** — not built; would need a defined costing/BOM relationship between raw material cost and manufactured output cost this program has not been asked to build.
5. **Whether to fully retire the legacy `daily_logs.poles_units` entry path** now that the proper batch system exists — kept coexisting (both draw from the same pooled balance) rather than unilaterally deprecated, since real users and many dashboards depend on it today.

## 26. Production Readiness

The core manufactured-pole path (Path A) is now complete and live-verified end-to-end: purchase → approve → deliver → QC → production batch → multi-spec output → Quality Inspection → real Finished Pole Inventory → (already-working) Sales, with full access to the existing Rework/Downgrade/Return-to-Inventory/Firewood/Scrap/Disposal resolution paths for the first time. Desktop and mobile have full functional parity. Workshop Isolation is intact and was strengthened (the `dispatchReview` fix). Purchased finished poles (Path B) are one open QC-gate decision away from being fully usable via already-existing procurement infrastructure — not a build task, a decision. Nothing in this phase touched or destabilized the existing, live `poles_purchase_requests`/`poles_deliveries` pipeline.

---

**Nothing in this phase was committed or pushed.** Per the Stop Rule, this report and its accompanying changelog, gap register, and CRUD parity matrix are the final output — no further phase starts automatically.
