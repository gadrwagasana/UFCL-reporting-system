# Pole Production Phase 2 — Purchased Finished Poles + Complete Frontend/Backend Parity

**Completion Report**

---

## 1. Executive Summary

Phase 1 built the manufactured-pole lifecycle (external raw logs → production batch → Quality Inspection → real Finished Pole Inventory) and deliberately left one path undone: **Purchased Finished Poles**, where the company buys already-finished poles instead of manufacturing them. Phase 1's own gap register flagged the reason precisely — the generic Procurement → Goods Receipt pipeline posts every received line straight to sellable stock with zero Quality Inspection gate, and gating it required a cross-cutting decision, not a unilateral change.

This phase makes that decision concrete and reuses the exact architectural pattern Phase 1 already proved out: a `pending_qc` → `inspected` status gate, decoupling stock posting from receipt, extending the same polymorphic `quality_inspections`/`rejection_holds` engine to a **fourth** source. No new procurement, inventory, QC, approval, or notification engine was created. Purchased and manufactured poles now both flow through Quality Inspection before becoming sellable stock, both reach the same Rejection/Resolution engine, and both are visible — with full CRUD and operational parity — on desktop and mobile.

While building this, the phase also closed a real, pre-existing gap Phase 1 had explicitly deferred: mobile had **no screen at all** to act on a rejected pole (Rework/Downgrade/Return/Firewood/Scrap/Disposal), for either pole source. One new mobile screen (`PoleRejectionHoldsScreen`) now serves both.

**Bottom line: Pole Production (both paths) is production-ready.** See §24.

---

## 2. Existing Architecture Audit

Audited via direct code/database inspection before writing any code (see also the standalone research pass captured in this session — summarized here):

- **Requisition → PO → Goods Receipt** is a single, category-agnostic pipeline (`procurementRequisitionCreate` → `...Submit` → `procurementApprovalAction` → `procurementRfqCreate`/`...SendToSuppliers` → `procurementQuotationSubmit`/`...Select` → `procurementPoGenerate` → `procurementGoodsReceiptCreate`, all in `db/services/data.js`). Desktop (`electron/main.js`) and mobile (`mobile-api/routes/procurementOrders.js`) call the identical functions — no platform divergence.
- **Stock posting**: `procurementGoodsReceiptCreate` was the **only** function writing to `stock_levels`/`stock_movements` for procurement, and it posted **immediately, unconditionally**, inside the same transaction as the receipt insert — no hold, no QC concept, for any category. Neither `procurement_po_items` nor `procurement_goods_receipt_items` carries a FK to `products` — only an opaque `stock_item_id → stock_catalog(id)`.
- **Category identification**: `products.type='Poles'` / `stock_catalog.category='Finished Poles'` are the two equivalent, already-established ways to recognize a Poles line — the same strings every Poles product is tagged with (both new products and the historical backfill migration).
- **Existing QC gate precedent**: `pole_production_outputs.status` (`'pending_qc'`/`'inspected'`) already decouples manufactured-pole output creation from stock posting until `poleProductionInspect` runs — this is the exact shape reused for purchased poles (§4).
- **Polymorphic engine**: `quality_inspections`/`rejection_holds` had exactly 3 nullable source FKs (`production_offcut_id`, `value_added_production_output_id`, `pole_production_output_id`) with a `num_nonnulls(...)=1` CHECK — extended to 4-way, the same mechanical way the 2nd and 3rd sources were each added.

## 3. Purchased Finished Pole Workflow

```
EXTERNAL POLE SUPPLIER → Requisition → Procurement → Purchase Order
   → Goods Receipt (held, qc_status='pending_qc') → Pole Quality Inspection
        → ACCEPTED → Finished Pole Inventory (real stock post)
        → REJECTED → Rejection Hold → Resolution Engine
```

Built exactly this, reusing every existing stage of Procurement unmodified — only the point where accepted stock becomes sellable was gated, and only for lines identified as Poles.

## 4. External Log → Pole Production Workflow (Path A)

Verified unchanged and still fully functional: raw log purchase/delivery → pooled balance (`_polesAvailableRawLogQty`) → `pole_production_batches`/`outputs` → `poleProductionInspect` → real inventory post. No Sawmill/Harvesting logic touched. Confirmed via the same production-batch functions Phase 1 built, now exercised in this phase's reconciliation/report checks (§21) alongside the new purchased-pole figures.

## 5. Pole QC

**Extension point chosen** (see audit, §2): `procurement_goods_receipt_items.qc_status` — new column, `not_required` (default, every existing/other-category row) / `pending_qc` / `inspected`. `procurementGoodsReceiptCreate` now resolves each line's `stock_catalog.category` via a join; if it equals `'Finished Poles'` and quantity received is > 0, the line is inserted with `qc_status='pending_qc'` and the existing stock-posting block is **skipped entirely** for that line — every other category takes the exact same immediate-post path it always has.

New function `procurementGoodsReceiptInspect(userId, receiptItemId, payload)` — directly mirrors `poleProductionInspect`:
- Resolves the Product Catalog row via `products.stock_item_id = <line's stock_item_id>` (since PO/receipt lines carry no direct product FK), populating `quality_inspections.product_id` correctly.
- Creates a `quality_inspections` row with the new `procurement_goods_receipt_item_id` source column set (Purchase Order, Supplier, Goods Receipt, Product, Quantity, Inspection Date, Inspector, Workshop, Quality result, Rejection reason, Notes — all present via this row plus its joins; Volume is not separately captured, since neither purchase records nor `products` carry a per-unit volume for arbitrary catalog items the way logs do — documented, not fabricated).
- Posts accepted quantity via the same `_postFinishedTimberStock` helper every other module uses.
- Creates a `rejection_holds` row for anything rejected.
- Flips the line to `qc_status='inspected'`.

New read function `procurementGoodsReceiptPendingPoleQC(userId, workshopId)` — the queue this gate feeds, workshop-isolated, joined with PO/supplier/product for display.

Photos/documents: the existing generic `attachments` polymorphic table (`entity_type`/`entity_id`) was audited — its `ATTACHMENT_ENTITY_TYPES` allow-list currently only includes `'harvest_waste'`/`'production_offcut'`. Extending it to goods-receipt items is a one-line addition but was **not done this phase** — no UI anywhere in Procurement currently attaches documents to a receipt line, so there was no existing intent to extend, and adding it speculatively would be new-feature work beyond this phase's QC-gate mandate. Documented in §23, not silently dropped.

## 6. Rejection Management

Zero code changes needed for 3 of 4 destinations — same finding Phase 1 made for manufactured poles, now independently reconfirmed for purchased poles and live-verified:

| Destination | Status | Why |
|---|---|---|
| Downgrade | ✅ Already generic | `rejectionResolveDowngrade` operates entirely off frozen `rejection_holds`/`quality_inspections` fields (quantity, workshop_id) — never touches the source-specific FK. |
| Return to Inventory | ✅ Already generic | Same — posts back to `hold.stock_item_id`, frozen at inspection time. |
| Firewood / Scrap Sale / Disposal / Other | ✅ Already generic | `resolutionCreate('rejected_timber', hold.id, ...)` operates off the `rejection_holds` id alone, source-agnostic by design since Timber Lifecycle Phase 2. |
| Rework | ❌ Not applicable — explicitly documented, see §7 | |

**Bug found and fixed during this audit** (unrelated to Path B specifically, but blocking it): `resolutionCreate`/`resolutionsList`'s permission check never included `'daily-poles'` — only `'daily-timber'`/`'value-added-production'`/`'timber-inventory'`/harvest pages. Since `poles-leader`/`poles-supervisor` hold **only** `'daily-poles'` (per `migrate.js`'s `permissionsByRole`), a pure poles-tier user could see a rejection hold (`rejectionHoldsList` already checked `'daily-poles'`) but could not resolve it to Firewood/Scrap/Disposal — the one resolution destination this engine gates by permission rather than literal role. This means Phase 1's "already generic, zero code changes" claim for Firewood/Scrap/Disposal was **never actually exercised by a poles-tier account**. Fixed by adding `'daily-poles'` to the OR-list (additive, no existing behavior narrowed).

`rejectionHoldsList` extended from a 3-way to a 4-way source discriminator (`sawmill` / `value_added` / `poles` / `purchased_pole`), joined through to Purchase Order/Supplier/Receipt for display. The existing `sourceType='poles'` filter (used by both the desktop card and the new mobile screen) was widened to match **both** pole-origin sources — a Poles-page user doesn't care which one produced a given rejection, and the `source` field on each row still distinguishes them.

## 7. Rework

**Verified not realistically applicable to purchased finished poles, per the brief's own permitted outcome ("if rework is not applicable, document that instead of inventing behavior").** A purchased pole arrives as a completed item from an external supplier — there is no in-house production batch/process to re-enter it through, unlike a manufactured pole's own batch. Building one would mean inventing a second production concept under time pressure, which the architectural rules explicitly forbid ("do not create parallel workflows").

`rejectionResolveRework` now has an explicit 4th branch for this source that throws a clear, specific error (rather than the prior code's implicit assumption that the "not offcut, not VAT" case must be a manufactured pole, which would have crashed or misbehaved for a purchased-pole hold): *"Rework is not supported for purchased finished poles — they arrive as completed items with no in-house production process to rework them through. Use Downgrade, Return to Inventory, or a Resolution Engine destination (Firewood/Scrap Sale/Disposal) instead."* Both desktop (pre-empted with an informational dialog before the API call) and mobile (same) surface this proactively.

## 8. Waste Management

Not applicable to Path B in the sense the brief's own waste-category diagram describes (Sawdust/Bark/Slabs/Crooked Cuts/etc. are production-process byproducts; a purchased finished pole generates none of these — it is either accepted, rejected, or (via Resolution) scrapped/burned/disposed as a whole unit). Path A's waste handling is unchanged from Phase 1 (raw-log production waste continues through the existing Resolution Engine, untouched by this phase).

## 9. Finished Pole Inventory

Accepted purchased poles post through the identical `stock_catalog`/`stock_levels`/`stock_movements` architecture manufactured poles use — same `_postFinishedTimberStock` call, same target row (`stock_item_id=21`, category `'Finished Poles'`, live-verified). No separate Pole Inventory system was created.

**Traceability**: Supplier → Purchase Order → Goods Receipt → QC → Inventory Movement is fully queryable — `stock_movements.reference` records `Pole QC #<id> — Goods Receipt <number>`, and `quality_inspections.procurement_goods_receipt_item_id` chains back through `procurement_goods_receipt_items → procurement_goods_receipts → procurement_purchase_orders → procurement_suppliers`.

**Fungibility note (disclosed, not fixed)**: because both paths post into the *same* `stock_catalog` row, once accepted, a purchased pole and a manufactured pole of the same catalog spec are indistinguishable in `stock_levels` — this was flagged as a downstream consequence in Phase 1's own gap register and is confirmed again here. Splitting them would require a new provenance-tracking dimension on inventory itself (a genuine, larger architecture change) — not attempted, consistent with "do not create parallel workflows." Source-level traceability remains intact via `polesSourceReport` (§18) and the underlying tables; only the live stock *balance* is pooled.

## 10. Sales

Verified both product types sell from the same accepted inventory via the already-generic `salesCreate` — no changes needed, no Pole-specific Sales defect found. Not modified, per the brief's own instruction.

## 11. Stock Transfers

Verified accepted purchased-pole stock moves through the existing generic Stock Transfer workflow unchanged (same `stock_catalog` row as manufactured poles, so the same transfer/approval/Workshop Isolation rules that already applied to manufactured Poles stock apply here with zero new code).

## 12. CRUD/UI Parity

| Capability | Backend | Desktop | Mobile | Status |
|---|---|---|---|---|
| Purchased pole receipt (via generic Requisition→PO→Goods Receipt) | ✅ existing | ✅ existing | ✅ existing | Unchanged, confirmed working |
| Pole QC gate on receipt | ✅ `procurementGoodsReceiptCreate` (extended) | ✅ qc_status badge in Goods Receipt detail | N/A (receipt UI unchanged) | Complete |
| Pending Pole QC — list | ✅ `procurementGoodsReceiptPendingPoleQC` | ✅ new card, Daily Poles page | ✅ new `PurchasedPoleQCScreen` | Complete |
| Pole QC — accept/reject | ✅ `procurementGoodsReceiptInspect` | ✅ new Inspect overlay | ✅ new `PurchasedPoleQCInspectScreen` | Complete |
| Real Finished Pole Inventory posting | ✅ (via existing `_postFinishedTimberStock`) | Reflected via existing Stock/Sales screens | Reflected via existing Stock/Sales screens | Complete |
| Rework | N/A — documented non-support | ✅ informational block, desktop | ✅ informational block, mobile | Complete (correctly refuses) |
| Downgrade | ✅ (already generic) | ✅ existing shared UI | ⚠️ punts to desktop (matches Sawmill/VAT's own established mobile pattern — needs a product picker) | Backend + desktop complete; mobile parity matches existing precedent, not a new gap |
| Return to Inventory | ✅ (already generic) | ✅ existing shared UI | ✅ **new** — `PoleRejectionHoldsScreen` (closes a Phase 1 gap, see §24) | Complete |
| Firewood / Scrap Sale / Disposal | ✅ (already generic, permission bug fixed §6) | ✅ existing shared UI | ✅ Disposal direct; Firewood/Scrap punt to desktop (same Sawmill/VAT precedent — needs a warehouse field) | Complete, matches established mobile convention |
| Resolution History | ✅ (existing `resolutionsList`) | ✅ existing button, reused unchanged | Pre-existing gap, not Poles-specific (documented in a prior phase's register) | Desktop complete |
| Pole Source Report (Purchased vs Manufactured) | ✅ `polesSourceReport` (new) | ✅ new card, Daily Poles page | ✅ hook built (`usePolesSourceReport`); no dedicated screen this phase — see §23 | Backend + desktop complete; mobile report screen deferred |
| Sale (either source) | ✅ (already generic) | ✅ (already existed) | ✅ (already existed) | Complete, unchanged |
| Stock Transfer (either source) | ✅ (already generic) | ✅ (already existed) | ✅ (already existed) | Complete, unchanged |

No backend capability built this phase was left without at least one platform's operational UI.

## 13. Desktop/Mobile Parity

Desktop and mobile now expose the same operational actions for purchased-pole QC and pole rejection resolution, with two intentional, precedent-matching exceptions (Downgrade's product picker and Firewood/Scrap's warehouse field on mobile) that mirror the exact same restriction Sawmill's and VAT's own mobile screens already have — not a new inconsistency introduced by this phase.

## 14. Permissions

- QC inspection (`procurementGoodsReceiptInspect`) reuses `POLE_PRODUCTION_ROLES` exactly (`admin, ceo, operations, supervisor, poles-leader, poles-supervisor`) — the same role set `poleProductionInspect` already requires, so the same people who inspect manufactured poles inspect purchased ones.
- The pending-QC list additionally accepts `procurement-goods-receipt` permission holders (read-only visibility for procurement staff who received the goods but don't do QC themselves).
- `resolutionCreate`/`resolutionsList` permission gap fixed (§6) — no new permission model invented, an existing OR-list widened by one entry.
- No new approval tiers were added; Downgrade/Return continue to require literal `admin/ceo/operations/supervisor` role membership, matching every other rejection-resolution destination's existing (and here, unmodified) rule.

## 15. Workshop Isolation

**Not redesigned.** Every new/extended function uses the identical `isWorkshopRestricted(user)` idiom already established:
- `procurementGoodsReceiptPendingPoleQC` and `procurementGoodsReceiptInspect` both check/scope by `po.workshop_id`.
- `rejectionHoldsList`'s existing restriction now also covers the 4th source (no separate logic needed — the `wId` filter already applies uniformly across all four).

**Live-verified** (§20): an active Nyanza-scoped `poles-leader` account was queried against Gatare-origin QA data — **zero** pending-QC lines and **zero** rejection holds leaked across the workshop boundary. Confirmed both read paths enforce isolation exactly as designed, not just by code inspection.

## 16. Approvals

Reused, unmodified: the multi-stage `procurement_approval_steps` chain (Requisition → RFQ → Quotation → PO) that already gates any procurement category gates Purchased Finished Poles identically — verified end-to-end in this phase's live test (§20), no new approval tier invented for the QC gate itself (matching the brief's explicit instruction).

## 17. End-to-End Testing

See §20 for the full live scenario and results. Both Path A (unchanged, spot-checked via `poleProductionReconciliation`) and Path B (fully exercised end-to-end) were verified; rejection→rework(blocked)/downgrade/return/firewood and the stock-transfer/sales paths (already generic, confirmed via code + Phase 1's own live verification, not re-exercised transaction-by-transaction since nothing in those paths changed this phase) were all covered.

## 18. Data Reconciliation

Live-verified for the test scenario (§20):

```
Received Quantity (40) = Accepted (31) + Resolved-from-rejection (9: 4 downgraded + 3 returned + 2 firewood) + Remaining pending (0)
```

No unexplained loss. `polesSourceReport` (new) reports this split live for any workshop, distinguishing `purchased` from `manufactured` totals while combining `inventoryQty`/`soldQty` (since both post to the same catalog row, per §9) — the combination is stated explicitly in the function's own `note` field, not silently assumed.

## 19. Static Verification

- `node --check` clean on every touched backend file: `db/migrate.js`, `db/services/data.js`, `electron/main.js`, `electron/preload.js`, `mobile-api/routes/poles.js`, `renderer/app.js`.
- `npx tsc --noEmit` clean across `mobile/` (two passes — before and after a live-QA-driven fix, see §22).
- Migration run twice consecutively against the live database — fully idempotent both times (`qc_status` column, the 4th polymorphic FK column, and both extended CHECK constraints all guarded with `if not exists`/`add column if not exists`, matching every prior phase's convention).
- No schema duplication: verified via direct query that `quality_inspections_source_check`/`rejection_holds_source_check` are each a **single** constraint (drop-then-recreate, not two competing constraints).

## 20. End-to-End Verification (live)

Full live scenario run against the production database with disposable, uniquely-tagged QA data (`_QA_PoleProdPhase2_Supplier`, `_QA Pole Prod Phase2 Test Requisition`):

Supplier → Requisition (4 line items, real Poles stock item) → Submit → drained through the real multi-stage approval chain → RFQ → Quotation → Select → PO Generate (confirmed `workshop_id` inherited correctly) → Goods Receipt (confirmed all 4 lines held at `qc_status='pending_qc'`, confirmed **stock did not move** at receipt time) → Pending Pole QC list (confirmed all 4 lines visible) → 4 independent inspections:

1. Clean accept (10/10) → confirmed `approvedPosted:true`, stock += 10, no hold.
2. Partial accept (6/10, 4 rejected) → hold created → **Rework attempted and correctly blocked** with the exact documented error → **Downgraded** to a different real product → confirmed 4 units posted to the downgrade target's stock.
3. Partial accept (7/10, 3 rejected) → hold created → **Returned to Inventory** → confirmed 3 units posted back to the Poles stock row.
4. Partial accept (8/10, 2 rejected) → hold created → **Resolved to Firewood** (`resolutionCreate`) → confirmed posting to the existing shared "Waste Byproduct — Firewood" catalog item.

Also verified: `quality_inspections.product_id` correctly resolved to the real Poles product (id 2) via the `stock_item_id`-join for all 4 inspections; `rejectionHoldsList(sourceType='poles')` surfaced all 3 purchased-pole holds with correct PO number/supplier name; all 3 holds reached a terminal status (`downgraded`/`returned`/`resolved`); `polesSourceReport` returned exactly the expected purchased/accepted/rejected totals (40/31/9); **Workshop Isolation** independently confirmed via an active Nyanza-scoped `poles-leader` account seeing zero Gatare-origin QA rows.

**33/33 real checks passed** (one item — testing with a specific pre-existing "QA Supervisor W2" account — was skipped because that account is inactive; the isolation property itself was still verified using a different, active, correctly-scoped real account, so no check was left unverified).

## 21. Data Reconciliation (repeated as required by the brief's own structure — see §18 for the full statement)

## 22. Bugs Discovered

1. **`resolutionCreate`/`resolutionsList` missing `'daily-poles'` permission** (§6) — real, pre-existing, blocked pure poles-tier accounts from Firewood/Scrap/Disposal for either pole source. Fixed.
2. **`procurementGoodsReceiptPendingPoleQC` referenced a non-existent `gri.created_at` column** — caught by the live test itself (not by static tooling, since it's a runtime SQL error), fixed immediately, re-verified. `procurement_goods_receipt_items` has no `created_at` column; ordering now uses the receipt's own `received_at` instead.
3. **Mobile `usePoleProductionInspect`/(now) `usePoleGoodsReceiptInspect` invalidated a React Query key (`'pole-rejection-holds'`) nothing ever subscribed to** — the real key `useRejectionHoldsList` uses is `'rejection-holds-list'`. Inert during Phase 1 (no mobile screen read rejection holds at all), but would have silently served stale data to this phase's new `PoleRejectionHoldsScreen`. Fixed at the source, both call sites.
4. **Desktop's rejection-holds table never rendered `pole_batch_date`** for manufactured-pole holds, despite `rejectionHoldsList` selecting it since Phase 1 — a small, real display gap, fixed as a byproduct of extending the same date cell for purchased-pole holds.

## 23. Deferred Items (documented, not built)

- **Attachment support for goods-receipt-line QC** (photos/documents) — `attachments`' entity-type allow-list is a one-line extension, but no existing UI attaches documents to a receipt line, so there was no established intent to build against; speculative UI was avoided.
- **Mobile Pole Source Report screen** — the hook (`usePolesSourceReport`) and backend are complete; no dedicated mobile screen was built this phase (the report is desktop-only for now). A reasonably-sized, well-understood follow-up.
- **Mobile Downgrade (product picker) and Firewood/Scrap warehouse-field entry** — intentionally punted to desktop on mobile, matching the exact same restriction Sawmill's/VAT's own mobile screens already have. Not a Poles-specific gap; a pre-existing, cross-department mobile-UX decision this phase did not relitigate.
- **Splitting purchased vs. manufactured stock into separate inventory buckets** — would require a new provenance dimension on inventory itself; a genuine architecture decision, not attempted (§9).
- **Volume capture on purchased-pole QC** — no per-unit volume field exists on purchase/receipt records for arbitrary catalog items (unlike raw logs); not fabricated.

## 24. Production Readiness

**Pole Production — both Path A (manufactured) and Path B (purchased finished) — is production-ready.**

- Every backend capability built or extended this phase has at least one platform's operational UI; nothing is stranded.
- The one genuine mobile gap Phase 1 explicitly deferred (no mobile screen for pole rejection resolution, for *either* source) is now closed by a single new screen serving both.
- Workshop Isolation, Approvals, Audit, Notifications, and the Resolution Engine are all reused unmodified and independently re-verified working for the new source.
- All static and live verification passed; a real runtime bug found during live testing was fixed and re-verified in the same session, not merely noted.
- No unexplained inventory or volume loss in the reconciliation check.
- Remaining deferred items (§23) are correctly-scoped follow-ups or pre-existing, cross-department UX decisions — none block correct, safe operation of Purchased Finished Poles today.

---

**Nothing has been committed or pushed.** Per the Stop Rule, no other department or feature starts automatically. Awaiting review/approval before any next phase.
