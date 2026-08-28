# Stock & Inventory Phase 2 — Changelog

## Summary

Closed the Sales & Stock Integrity findings from `STOCK_INVENTORY_ENTERPRISE_AUDIT.md` (C-03, C-04, C-05, and the root cause behind C-06/C-07): quantity validation, race-safe availability checking, full stock reconciliation on edit/cancel/reject/short-close, and Workshop Isolation on every Sales write path. Two additional bugs were found and fixed during this phase's own review/testing (not named in the original audit): a `product_id` persistence gap on edit, and a double-counting risk in short-close after a prior partial rejection. The audit's "16-unit discrepancy" was fully investigated and root-caused to a prior phase's leftover QA test data, not a Sales code defect — documented, not silently corrected. No schema change, no new stock ledger, no Workshop Isolation redesign, nothing committed or pushed.

## Files changed (1 total)

### Modified

- **`db/services/data.js`**:
  - `salesCreate` — quantity validation (reject zero/negative/non-finite); availability check moved inside the transaction with `for update` locking, closing a TOCTOU race.
  - `salesUpdate` — added Workshop Isolation check; added quantity validation; full rewrite of the stock-reconciliation logic (quantity delta consume/return, product-change restore-old/consume-new, availability-checked, `for update`-locked); now persists the resolved `product_id` on every stock-affecting edit (bug found live-testing this phase's own fix — previously never written, breaking every later reversal on an edited order).
  - `salesUpdateStatus` — added Workshop Isolation check; cancelling to `'Cancelled'` now reverses the idempotent "outstanding" quantity (`quantity − qty_accepted_total − qty_returned_to_stock`) to `stock_levels`/`stock_movements`, inside a `for update`-locked transaction.
  - `salesCloseShort` — added Workshop Isolation check; now posts the outstanding quantity back to the authoritative ledger using the same idempotent formula as cancellation (not the pre-existing `qty_remaining` column, which double-counts against a prior POD-rejection — bug found during design review, fixed before any live test ran); wrapped in a `for update`-locked transaction.
  - `_applyDeliveryOrderPOD` — added Workshop Isolation check; converted to a `for update`-locked transaction; rejected quantity now posts back to the authoritative ledger (previously bookkeeping-only).
  - `salesUpdatePayment`, `salesDelete` — added Workshop Isolation checks (no stock effect; `salesDelete` deliberately does not reverse stock — see completion report §16 for why).

## Verification performed

- `node --check db/services/data.js` — clean, re-run after every edit and once more as a final pass.
- No `.ts`/`.tsx` file touched — `tsc --noEmit` not applicable this phase.
- 32/32 live production-database checks (Scenarios A–K, quantity validation, unauthorized/cross-workshop denial, concurrency, negotiated-price/COGS integrity).
- Regression smoke test: `salesList`, `deliveryOrdersList`, `stockTransfersList`, `productionOffcutsList`, `harvestWasteList`, `rejectionHoldsList`, `showroomDamageReportsList`, `resolutionsList` all confirmed functional post-fix.
- `git diff --stat db/services/data.js` confirms this is the only file changed this phase.

## Live QA data — full lifecycle

| Action | Detail |
|---|---|
| Created | Throwaway `sales_orders`/`delivery_orders` (all tagged `QA-SIP2*`) exercising create/edit/cancel/reject/close-short/concurrency/cross-workshop scenarios; 3 legitimate `stock_movements` seed entries to fund the test scenarios |
| Real data touched | None — all testing used seeded QA stock on top of real baseline quantities, fully reversed afterward |
| Cleaned up | All `sales_orders`/`delivery_orders`/`stock_movements` hard-deleted; `stock_levels` for every touched (item, warehouse) pair restored to its exact pre-test baseline via direct correction after confirming the arithmetic against the full movement history |
| Independently re-verified | Fresh `COUNT` queries after cleanup: 0 leftover rows for every entity type; `stock_levels` re-confirmed at exact original values (item 20 @ Gatare=2, @ Nyanza=0; item 22 @ Gatare=0) |
| QA accounts | None created — all test actors were real, existing accounts (`sales-staff@Gatare`, `showroom-staff@Showroom`, `admin`) |
| Note | A mid-test connectivity drop to the production DB interrupted one cleanup pass; the partial state was independently re-derived from the test's own logged before/after values and confirmed via direct query before the corrected script was re-run and re-verified — no residual QA data or stock corruption remains |

## Bugs found

1. `salesCreate` accepted negative/non-finite quantities, inverting the stock effect. **Fixed.**
2. `salesCreate`'s availability check ran outside any lock, a TOCTOU race allowing two concurrent sales to both pass and both deduct. **Fixed.**
3. `salesUpdate` had zero quantity validation and zero stock reconciliation on quantity/product changes. **Fixed.**
4. `salesUpdateStatus`'s cancellation path never reversed stock. **Fixed.**
5. `_applyDeliveryOrderPOD`'s rejection path never reversed stock (bookkeeping-only). **Fixed.**
6. `salesCloseShort`'s short-close path never reversed stock (bookkeeping-only). **Fixed.**
7. **Found during this phase's own live testing**: `salesUpdate` never persisted the newly-resolved `product_id` after a product-change edit, silently misdirecting every later reversal (cancel/reject/close-short) on that order to the wrong stock item. **Fixed** — caught by Scenario D→E's live sequencing, not by static review.
8. **Found during this phase's own design review, before any live test ran**: `salesCloseShort`'s pre-existing formula double-counts the returned quantity if a POD-rejection already ran on the same order first (a latent bug in the pre-existing bookkeeping columns, present before this phase, now load-bearing). **Fixed** — proactively caught via reasoning about the interaction between two Priority 5 fixes.
9. No Sales write path (`salesUpdate`, `salesUpdateStatus`, `salesCloseShort`, `_applyDeliveryOrderPOD`, `salesUpdatePayment`, `salesDelete`) had a Workshop Isolation check. **Fixed**, all six.
10. The audit's cited "16-unit discrepancy" — investigated and root-caused to 4 leftover, uncleaned QA stock movements from an earlier phase's live verification (Timber Lifecycle Phase 3), not any Sales code defect. **Documented, not corrected** — exact proposed correction recorded in the completion report (§9), awaiting approval.

## Explicitly not done this phase (per Stop Rule and Bug Discipline)

- No Workshop Isolation redesign — every isolation check reuses Phase 1's exact `isWorkshopRestricted` idiom.
- No new stock ledger, costing engine, or duplicate calculation system.
- No schema change.
- No UI, IPC, or REST route file was modified — all fixes are backend-only, in `data.js`.
- No production history was modified — the §9 historical discrepancy is fully documented with an exact proposed correction, not silently applied.
- `mv_stock_summary`/`mv_stock_by_workshop` were not consolidated or retired, per this phase's explicit instruction.
- `salesDelete` intentionally left without a stock reversal — see completion report §16.
- `deliveryOrdersCreate`'s missing guard against dispatching against a closed/cancelled order — documented, not fixed (doesn't touch `stock_levels`, not required for this phase's named reversal paths).
- All non-Sales findings from the audit remain open and untouched.
- Inventory Architecture Consolidation has not been started.

## Next step

Per the phase's Stop Rule: this phase is complete and stops here, awaiting explicit review and approval — including approval of the proposed §9 historical stock correction before it is applied. Recommended next steps once approved: apply the §9 correction, close the `deliveryOrdersCreate` guard gap, then begin Inventory Architecture Consolidation.
