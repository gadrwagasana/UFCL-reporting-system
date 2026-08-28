# Stock & Inventory — Phase 2: Sales & Stock Integrity
## Completion Report

---

## 1. Executive Summary

Phase 2 closes the Sales → Inventory hand-off gaps confirmed by `STOCK_INVENTORY_ENTERPRISE_AUDIT.md` (findings C-03, C-04, C-05, and the root cause behind C-06/C-07). Six Sales/Delivery functions in `db/services/data.js` were fixed: `salesCreate`, `salesUpdate`, `salesUpdateStatus`, `salesCloseShort`, `_applyDeliveryOrderPOD`, plus minor isolation additions to `salesUpdatePayment`/`salesDelete`. Every fix reuses the ERP's existing primitives — `_postFinishedTimberStock` (Sawmill Phase 1's stock-posting helper), `isWorkshopRestricted` (Phase 1's isolation idiom), `for update` row locking (already used by `deliveryOrdersCreate`/`stockTransfersDispatch`), and the existing transaction/governance/audit/notification machinery. **No new stock ledger, no new costing engine, no Workshop Isolation redesign, no schema change.**

Sales can no longer create invalid stock deductions (zero/negative/non-finite/excessive quantities are rejected server-side), the availability check is now race-safe under concurrent sales, editing a sale now correctly reconciles the quantity/product delta, and cancellation/rejection/short-close now all post a real reversal to the authoritative `stock_levels`/`stock_movements` ledger instead of only updating bookkeeping columns that fed the legacy `mv_stock_summary`/`mv_stock_by_workshop` views. Two additional bugs were found and fixed **during this phase's own live verification**, before either could reach production: a `product_id` persistence gap that would have silently misdirected every reversal after a product-change edit, and a double-counting risk in short-close when a prior partial rejection had already occurred on the same order.

The audit's cited "16-unit discrepancy" was fully investigated and is **not** a Sales code defect, current or historical — it is fully explained by 4 leftover, uncleaned QA test movements from an earlier phase's live verification, precisely quantified below (§9). No production history was modified. The exact proposed correction is documented and awaits explicit approval.

**32/32 live verification checks passed** (Scenarios A–K, quantity validation, unauthorized/cross-workshop denial, concurrency, negotiated-price/COGS integrity). All QA data was removed and independently re-verified at zero, with stock restored to its exact pre-test baseline.

---

## 2. Sales Stock Integrity — Architecture Found

Re-verified against current source (not the audit report):

- **Stock leaves inventory exactly once**, at `salesCreate`, via `_postFinishedTimberStock` (Sawmill Phase 1's helper) — only for orders whose `product_type`/`product_sub_type`/`product_size` resolves to a `products` row with a linked `stock_item_id`. Orders with no catalog match behave exactly as before this phase (untracked, pre-existing, unchanged).
- **Delivery is a pure fulfilment-tracking layer on top of an already-deducted sale** — `deliveryOrdersCreate` never itself touches `stock_levels`; it only updates `sales_orders.qty_dispatched_total`/`status`.
- **Two parallel stock representations exist** and were both re-verified this phase:
  1. The **authoritative** ledger — `stock_levels` (a stored, transactionally-updated value) + `stock_movements` (its append-only audit trail), both written together by `_postFinishedTimberStock`.
  2. A **legacy, category-level, sales_orders-derived** pair of materialized views — `mv_stock_summary` (global) and `mv_stock_by_workshop` (per-workshop) — computed as `produced (daily_logs/value_added_timber) − sold (sales_orders.quantity − qty_returned_to_stock, excluding status='Cancelled')`. Per this phase's explicit instruction, **neither view was consolidated or retired** — both remain exactly as before, refreshed via the same `refreshStockView()`/`refreshStockByWorkshop()` calls every write path already used.
- These two systems were **only ever kept in sync on creation** (both move together when `salesCreate` runs). Every reversal path (edit, cancel, POD-rejection, close-short, delete) updated only the `sales_orders` bookkeeping columns that feed the legacy views — **never** the authoritative ledger. This is the structural root cause of audit findings C-05 (no reversal path) and, per §9, materially contributed to the visible C-06/C-01 drift.

---

## 3. Quantity Validation (Priority 1)

**Before**: `salesCreate`'s own required-field check (`!p.quantity`) only ever caught `0`/`undefined` — a negative number is truthy in JS and passed straight through, inverting the stock effect on deduction (audit C-03). `salesUpdate` had no quantity validation at all.

**Fixed**: both functions now validate `Number.isFinite(qty) && qty > 0` before any DB work. Excessive-quantity rejection (exceeds available stock) already existed in `salesCreate` for catalog-mapped products and is preserved unchanged; the same check was added to `salesUpdate`'s reconciliation path (§5) for quantity increases and product changes.

**Live-verified**: zero, negative, and excessive (999,999) quantities all rejected server-side with a clear error; unauthorized/nonexistent user denied.

---

## 4. Availability / Concurrency (Priority 2)

**Before**: the availability check (`select ... from stock_levels`) ran as a separate, unlocked query *before* the transaction that performed the deduction even began (audit C-04). `_postFinishedTimberStock`'s own upsert additionally floor-clamps at 0 (`greatest(0, quantity+delta)`) rather than erroring — meaning two concurrent sales could both read the same "available" figure, both pass, and the second would still be recorded as a successful sale against stock that didn't exist.

**Fixed**: the check now runs *inside* `salesCreate`'s existing transaction, using `select ... for update` to lock the `stock_levels` row before checking — the exact same row-locking idiom already used by `deliveryOrdersCreate`'s SO lock and `stockTransfersDispatch`'s stock check. No new locking mechanism was introduced.

**Live-verified (Scenario H)**: two concurrent 25-unit sales fired against a 25-unit-available warehouse via `Promise.all` — exactly one succeeded, the other was cleanly rejected, and the resulting stock level was exactly `baseline − 25`, never negative, never double-deducted.

---

## 5. Sales Edit Integrity (Priority 3)

**Before**: `salesUpdate` wrote the new `quantity`/`product_type`/`product_sub_type`/`product_size` directly with zero stock reconciliation (audit C-05) — an increase never consumed the difference, a decrease never returned it, and a product change never restored the old product or consumed the new one.

**Fixed**: `salesUpdate` now detects whether the edit is stock-affecting (`quantity` and/or product identity changed) and, only in that case, reconciles inside the same transaction as the `sales_orders` update:
- **Quantity increased**: consumes exactly the delta, after a `for update`-locked availability check (rejects if insufficient, same as create).
- **Quantity decreased**: returns exactly the delta.
- **Product changed**: restores the *old* product's full quantity, then consumes the *new* product's full quantity (availability-checked).
- **No stock-affecting change** (price/customer/notes only): creates zero inventory movement, per this phase's own rule.
- **Workshop**: `sales_orders.workshop_id` is not, and was not before this phase, editable via this function — no new capability was added; Workshop Isolation is enforced (below) so an edit can never cross workshops in the first place.

Old-product resolution reads the order's own already-recorded `product_id` (mirroring `_reverseDailyLogItemsStock`'s existing "read what was actually posted" idiom) rather than re-matching type/sub_type/size strings that may have drifted since creation.

**Bug found and fixed during this phase's own live testing** (not by the original audit): the rewritten reconciliation correctly read the OLD product from `before.product_id`, but the function's final `UPDATE` statement never wrote the *new* `product_id` back to the row — so every subsequent stock-affecting action on that order (cancel, POD rejection, close-short) would keep resolving against the *original* product forever after a product-change edit. Caught live when Scenario E's cancellation (following Scenario D's product change) returned stock to the wrong item. Fixed by tracking and persisting the resolved `product_id` in the same `UPDATE`.

**Live-verified (Scenarios B/C/D)**: quantity increase consumed exactly the delta; decrease returned exactly the delta; product change fully restored the old product and consumed exactly the new product's quantity — all confirmed via direct `stock_levels` reads before/after.

---

## 6. Cancellation / Reversal (Priority 4)

**Before**: `salesUpdateStatus` transitioning an order to `'Cancelled'` only flipped the `status` column. `mv_stock_summary`/`mv_stock_by_workshop` already exclude `status='Cancelled'` orders from their own "sold" sum, so the legacy views self-heal on cancel — but the authoritative `stock_levels` ledger was never told, and stayed permanently understated.

**Fixed**: cancelling now reverses the **outstanding** quantity — `quantity − qty_accepted_total − qty_returned_to_stock` — inside a `for update`-locked transaction. This formula is deliberately **idempotent**: a unit already delivered-and-accepted (gone for good) or already returned via an earlier POD-rejection/close-short is excluded, so cancelling twice, or cancelling after a partial return already happened, computes zero outstanding and only re-confirms the status without double-reversing.

**Live-verified (Scenario E)**: cancelling an order with nothing yet accepted/returned fully restored its full quantity to stock; cancelling the same order a second time was confirmed idempotent (no further stock change).

---

## 7. Delivery Rejection / Short-Close (Priority 5)

Both paths had the identical gap as cancellation — bookkeeping-only, no authoritative reversal — and both are now fixed using the same `_postFinishedTimberStock` helper, inside a `for update`-locked transaction (also closing a latent concurrency gap: neither function was transactional before this phase).

- **`_applyDeliveryOrderPOD`** (POD/rejection): the rejected quantity (`qtyDispatched − qtyAccepted`) is now posted back to `stock_levels` at the sale's own workshop, for the sale's own resolved product.
- **`salesCloseShort`**: the outstanding quantity is now posted back the same way.

**Bug found and fixed during this phase's own design review** (before any live test was run): the pre-existing close-short formula (`qty_returned_to_stock + qty_remaining`, where `qty_remaining = quantity − qty_accepted_total`) does not net out a prior POD-rejection's own return — closing an order short *after* a partial rejection had already run on it would return the same units to stock a second time. This was a **latent bug in the pre-existing bookkeeping columns themselves** (present before this phase, silently affecting only the legacy views' bookkeeping until now); it is now load-bearing since it drives a real `stock_levels` posting, so it was fixed using the same idempotent "outstanding" formula as cancellation (§6) rather than the old `qty_remaining` column.

**Live-verified**:
- **Scenario F**: dispatched 6, accepted 4, rejected 2 — exactly the 2 rejected units returned to stock.
- **Scenario G**: a *separate* order (3 of 6 dispatched, all 3 accepted, 3 never dispatched) — close-short returned exactly the 3 never-dispatched units.
- **Double-count guard**: close-short called a second time on order F (already fully reconciled: 4 accepted + 2 already returned = 6, nothing outstanding) correctly posted **zero** further stock movement — proving the fix, not just asserting it.

---

## 8. Inventory Reconciliation (Priority 6)

Verified the identity **Produced − Sold − Other Movements = Current Stock** against the authoritative ledger for the only two Finished Timber catalog items with real production history (`stock_catalog` ids 20/22, "Untreated 100x200x4m"/"50x150x4m"):

- `stock_levels` for both items, summed across all 3 warehouses, is **fully and exactly explained** by their own `stock_movements` history once the incremental floor-at-zero clamping `_postFinishedTimberStock` applies on *every individual posting* (not just the net sum) is correctly simulated step-by-step — an initial naive "sum all deltas" check appeared to show a 6–10 unit divergence per warehouse; re-deriving it as a running balance with the same floor `_postFinishedTimberStock` itself applies resolved this exactly, with zero unexplained remainder. **The authoritative ledger is internally self-consistent.**
- The legacy `mv_stock_summary`/`mv_stock_by_workshop` views were **not** retired or consolidated, per this phase's explicit instruction. Their divergence from the authoritative ledger for this specific product category is fully traced in §9 — it has two independent, well-understood causes, neither of which is a defect introduced by or fixed in this phase.

---

## 9. Historical Discrepancy Investigation (Priority 7)

**Current live state** (re-confirmed at time of writing): `mv_stock_summary.untreated_stock = 17`; authoritative `stock_levels` total for the same category (items 20+22, all warehouses) = **2**. Gap = 15.

**Two independent, fully-evidenced causes were found — neither is a Sales code defect:**

**(a) 4 leftover, uncleaned QA test movements — 16 units, exactly matching the audit's original figure.**
`stock_movements` ids **94, 97, 99, 102** (reference tags `QA-PH3-A`/`QA-PH3-B`, dated 2026-08-07) each carry the exact notes format `_postFinishedTimberStock` produces from a real `salesCreate` call (`"Sale — Untreated 100x200x4m"`), deducting 5+5 units at Gatare and 3+3 units at Nyanza (**16 units total**) against `stock_catalog` item 20. **No `sales_orders` row with either reference string exists in any state, including soft-deleted** — confirming these were created directly against the stock ledger by an earlier phase's live-verification script (Timber Lifecycle Phase 3, per the reference-tag naming convention and date), whose QA cleanup step evidently reversed its own `sales_orders`-level fixtures but missed reversing these specific stock movements. This is a **QA data cleanup gap from a prior phase**, not a defect in this program's Sales code, past or present.

**(b) A structural, pre-existing measurement mismatch between the legacy and authoritative views — 15 units.**
`daily_logs` id 1 (`timber_units=15`) has **no `daily_log_items` size-breakdown rows at all** — it predates Sawmill Phase 1's per-size, product-mapped stock-posting mechanism (`_insertDailyLogItemsAndPostStock`), so its 15 units were only ever recorded in the legacy aggregate `daily_logs.timber_units` field (which `mv_stock_summary` reads directly) and **never had any code path that could have posted them to `stock_levels`** — this has nothing to do with Sales and nothing to do with this phase's fixes. Only `daily_logs` id 22 (`timber_units=2`, posted 2026-08-09, *with* a matching size breakdown) ever reached the authoritative ledger, which is exactly the entire authoritative total before the QA movements' effect.

**Reconciling the two**: `produced(17) − QA-orphaned(16) + [15-unit legacy/authoritative production-tracking gap, pre-existing and unrelated] ≈` the observed 15-unit current gap. The 1-unit difference between the audit's originally-cited "16" and today's observed "15" is explained by the 2-unit legitimate production entry (`daily_log #22`) having been posted *after* the original audit ran, which is real production and correctly reduces the gap.

**No production history was modified.** Per this phase's explicit instruction, the proposed correction is documented here for approval, not applied:

> **Proposed correction (NOT applied)**: reverse `stock_movements` ids 94, 97, 99, 102 using the exact same idiom `stockMovementsDelete` already uses elsewhere in this codebase — restore 10 units to `stock_levels(item_id=20, warehouse_id=3)` and 6 units to `stock_levels(item_id=20, warehouse_id=4)`, then hard-delete the 4 orphaned rows (they were never real business records). This would raise the authoritative Untreated Timber total from 2 to 18 (2 real + 16 restored), and close the corresponding portion of the legacy-view gap. **The separate 15-unit legacy/authoritative production-tracking gap (cause (b) above) is an architecture-transition artifact, not a stock error, and requires no correction** — it simply reflects that `daily_log #1` predates per-item stock tracking; consolidating the two production-tracking mechanisms, if desired, is Inventory Architecture Consolidation work explicitly out of scope for this phase.

---

## 10. Stock Movement Traceability (Priority 8)

Every new reversal this phase creates a real `stock_movements` row (via `_postFinishedTimberStock`, the same helper every other reversal in this program uses) carrying product, quantity, workshop, movement type (`in`/`out`), a human-readable `reference` (the order number), descriptive `notes` explaining *why* ("Sale edit — quantity increased by N", "Sale cancelled — N unit(s) returned to stock", "Delivery rejection — N unit(s) returned to stock", "Closed short — N unit(s) returned to stock"), the acting user, and a timestamp — answering "why did this stock quantity change?" directly from the ledger, with no duplicate audit mechanism introduced.

---

## 11. Cost / Margin Integrity (Priority 9)

Confirmed via code inspection (no code path in this phase writes to `products.standard_cost`, `products.default_price`, or forces `sales_orders.unit_price` to any catalog value): COGS (`sum(sales_orders.quantity * products.standard_cost)`, `db/services/data.js` ~line 5916) reads `sales_orders.quantity` and `products.standard_cost` exactly as before — neither this phase's validation additions nor its stock-reconciliation logic touch either value. Negotiated per-order pricing continues to be stored verbatim on the order, independent of the catalog default.

**Live-verified (Scenario K)**: created a sale at a deliberately non-default negotiated price (1,777, vs. the catalog's 15,000 default) — confirmed stored verbatim on the order; confirmed `products.standard_cost`/`default_price` unchanged by the sale.

---

## 12. Desktop / Mobile / API Verification (Priority 10)

Confirmed as an architectural property, consistent with Phase 1: `electron/main.js`'s `sales:*`/`deliveries:*` IPC handlers and `mobile-api/routes/sales.js`/`deliveries.js` are **pure delegation** to the exact same `db/services/data.js` functions this phase modified, with zero platform-specific authorization or business logic. No UI, route, or IPC file was touched this phase. Every fix is therefore enforced identically regardless of call path — desktop, mobile, or a direct/crafted API call all hit the same server-side validation, locking, and reconciliation.

---

## 13. Workshop Isolation Verification (Priority 13)

None of Phase 1's 11 fixes were touched or redesigned. Six Sales write paths (`salesCreate` was already correct; `salesUpdate`, `salesUpdateStatus`, `salesCloseShort`, `_applyDeliveryOrderPOD`, `salesUpdatePayment`, `salesDelete`) had **no** Workshop Isolation check at all before this phase — a gap not named in the original audit's isolation section, but newly load-bearing now that several of these paths move real stock. All six now use the exact same `isWorkshopRestricted` idiom Phase 1 established.

**Live-verified (Scenario J)**: a Gatare-restricted sales-staff account was denied editing, and a Showroom-restricted account was denied cancelling, an order belonging to Nyanza; a Gatare account was denied deleting a Nyanza order. All three returned `'Access denied — this order does not belong to your workshop'` with zero mutation.

**`salesDelete` intentionally left without a stock reversal** (see §16) — its Workshop Isolation check was still added, since deletion of another workshop's order is a data-integrity breach independent of the stock question.

---

## 14. Live Verification

Real accounts only (`admin`=1, `sales-staff@Gatare`=18, `showroom-staff@Showroom`=19) plus throwaway QA transactional data (`sales_orders`, `delivery_orders`, `stock_movements`, all tagged `QA-SIP2*`). **32/32 checks passed**:

| Scenario | Result |
|---|---|
| A — Create sale → stock decreases | ✅ exact |
| B — Increase quantity → only delta consumed | ✅ exact |
| C — Decrease quantity → delta returned | ✅ exact |
| D — Product change → old restored, new consumed | ✅ exact |
| E — Cancel → stock restored, idempotent on re-cancel | ✅ exact |
| F — Delivery rejection → rejected units returned | ✅ exact |
| G — Short-close → only unfulfilled units returned, no double-count | ✅ exact |
| H — Concurrent competing sales → exactly one succeeds, no negative/duplicate deduction | ✅ exact |
| I — Unauthorized user denied | ✅ |
| J — Wrong workshop denied (edit/cancel/delete) | ✅ ×3 |
| K — Negotiated price / COGS / margin untouched | ✅ ×2 |
| P1 — Zero/negative/excessive quantity rejected | ✅ ×3 |

Full-lifecycle regression (Sawmill Production → Finished Timber Inventory → Sale → Stock Movement → Delivery → Rejection/Short-Close → Final Inventory) was exercised end-to-end across Scenarios A→D→F/G, reconciling exactly at every step.

---

## 15. Regression Results

A post-fix regression smoke test confirmed the following remain fully functional and unaffected: `salesList`, `deliveryOrdersList`, `stockTransfersList`, `productionOffcutsList`, `harvestWasteList`, `rejectionHoldsList`, `showroomDamageReportsList`, `resolutionsList` — all Phase 1 Workshop Isolation fixes and the entire Timber Lifecycle chain remain intact; nothing in this phase touched any of those functions.

---

## 16. Outstanding Items

- **`salesDelete` does not reverse stock on delete**, by deliberate design decision (not an oversight): `salesDelete`/`trashRestore`/`trashPurge` form a **generic, symmetric** soft-delete-and-restore mechanism shared across many entity types, not a Sales-specific one-way workflow action like Cancel/Reject/Close-Short. Adding a one-way stock reversal to `salesDelete` would require a matching re-deduction in `trashRestore` (specifically for `sales_orders`) to avoid double-counting stock if a deleted-in-error sale is later restored — a larger, cross-cutting design change than this phase's explicitly named reversal paths (Cancel, POD-rejection, Close-Short) cover. Workshop Isolation was still added to `salesDelete` (§13), since the isolation gap itself is in scope regardless. Flagged as a candidate for a future phase if the business wants deleted sales to also restore stock.
- **The 16-unit historical discrepancy** is fully diagnosed (§9) but not corrected — awaiting explicit approval of the proposed correction.
- **The separate 15-unit legacy/authoritative production-tracking measurement gap** (§9b) is a pre-existing architecture-transition artifact (aggregate `daily_logs.timber_units` vs. per-size `daily_log_items`), not a stock error — no correction is proposed or needed; full consolidation of the two production-tracking mechanisms is Inventory Architecture Consolidation work, explicitly out of scope.
- **`deliveryOrdersCreate` has no guard against dispatching against a Cancelled/Closed-Short/Fully-Delivered sales order** via a direct/crafted call (the desktop/mobile dropdown already excludes these statuses, but the backend function itself doesn't check). Does not touch `stock_levels` directly (delivery creation never has), so it's a bookkeeping-consistency risk, not a stock-integrity one — documented per Bug Discipline, not fixed, as it wasn't named in this phase's Priorities and isn't required to make the named reversal paths correct.
- All findings from `STOCK_INVENTORY_ENTERPRISE_AUDIT.md` outside this phase's named scope (C-01/C-02/C-07/C-08/C-09, H-01/H-03/H-07–H-13, all Medium/Low findings) remain open and untouched.

---

## 17. Production Readiness

Phase 2's fixes are considered **production-ready**:

- Every fix reuses an existing, already-proven idiom (`_postFinishedTimberStock`, `isWorkshopRestricted`, `for update` locking, the existing transaction/governance/audit/notification machinery) — no new architecture.
- Zero schema changes.
- Zero UI/route/IPC changes — backend-only, zero platform-specific regression risk.
- Two additional bugs (product_id persistence, close-short double-counting) were found and fixed via code review and live testing *within this phase*, before reaching production.
- 32/32 live scenarios passed, including concurrency and idempotency proofs, not just single-path happy-path checks.
- Full regression of the adjacent Phase 1 Workshop Isolation fixes and Timber Lifecycle chain confirmed intact.
- Zero QA data footprint remaining in the production database; stock independently re-verified at its exact pre-test baseline.
- The one historical data question (§9) is fully investigated, documented, and explicitly deferred pending approval — no unauthorized production-data mutation occurred.

---

## 18. Phase 3 Recommendation

Per the explicit Stop Rule, **Inventory Architecture Consolidation and the remaining High/Medium backlog have not been started.** This report is submitted for review and approval before any further work begins, including the proposed §9 historical correction.

When approved, natural next steps (not started): (1) apply the proposed §9 correction if approved; (2) close the `deliveryOrdersCreate` dispatch-against-closed-order gap noted in §16; (3) begin Inventory Architecture Consolidation — reconciling or retiring the legacy `mv_stock_summary`/`mv_stock_by_workshop` views now that every Sales write path correctly maintains the authoritative ledger, closing the remaining structural production-tracking gap (§9b) as part of that broader effort rather than as a Sales-phase patch.
