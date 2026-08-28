# Stock & Inventory Phase 3 — Changelog

## Summary

Closed the Inventory Architecture Consolidation findings from `STOCK_INVENTORY_ENTERPRISE_AUDIT.md` (H-08, C-08, M-19): Inventory Adjustments now require manager approval via the existing `pending_edits` governance engine instead of writing `stock_levels` immediately and unapproved. A genuine concurrency defect in the shared approval-decision engine (`processApprovalDecision`) was found and fixed during this phase's own live testing. Proved and documented the ERP's authoritative stock architecture (`stock_levels` + `stock_movements`), classified every `mv_stock_summary` use, and independently corroborated Phase 2's 16-unit historical-discrepancy finding via a second, pre-existing reconciliation mechanism. No schema change, no new approval system, no Workshop Isolation redesign, nothing committed or pushed.

## Files changed (8 total)

### Backend
- **`db/services/data.js`**:
  - `stockMovementsCreate` — retired the direct `movement_type='adjustment'` path (same idiom already used to retire `'transfer'` here), redirecting to the new request flow. Removed the now-fully-dead `isTransfer` branch (unreachable both before and after this change, since `'transfer'` was already rejected earlier in the function).
  - `stockAdjustmentRequestCreate` (new) — validates and submits an adjustment request into `pending_edits` (`entity_type: 'stock_adjustment'`, `required_level: 'manager'`).
  - `_applyStockAdjustment` (new) — applies an approved request: re-reads current quantity under `for update` at apply time, posts the target as `stock_levels`/`stock_movements`, encodes before→after in `notes`.
  - `applyPendingEdit` — new `case 'stock_adjustment'`, mirroring the existing `delivery_order_pod` case's "acting user is the original submitter" pattern.
  - `processApprovalDecision` — **refactored for correctness**: added a self-approval guard (generic, benefits every entity type on this shared engine) and a Workshop Isolation check (scoped to `stock_adjustment`); **fixed a real duplicate-approval race** by moving the status check + apply + status update inside a `SELECT ... FOR UPDATE`-locked transaction (split into `_decideApprovalWithinLock` for the locked portion and `_afterApprovalDecision` for the post-commit audit/notification side effects, which are unchanged).
  - Exported `stockAdjustmentRequestCreate`.

### Desktop
- **`electron/main.js`** — new IPC handler `stock-movements:adjustment-request`.
- **`electron/preload.js`** — new bridge function `stockAdjustmentRequestCreate`.
- **`renderer/app.js`** — Stock Movements page's Adjustment submit path now calls the new request-creation flow instead of the immediate-create one; quantity-minimum relaxed to 0 for adjustments (a legitimate "recount found nothing" target); added `insertPendingPanel` for `stock_adjustment` requests (the same generic widget every other governed page already uses — Stock Movements had none before, since there was nothing to approve there until now).

### Mobile API
- **`mobile-api/routes/stock.js`** — new route `POST /movements/adjustment-request`, pure delegation to `data.stockAdjustmentRequestCreate`.

### Mobile
- **`mobile/src/api/endpoints.ts`** — new `STOCK_ADJUSTMENT_REQUEST_CREATE` endpoint.
- **`mobile/src/hooks/useStock.ts`** — new `useStockAdjustmentRequestCreate` hook.
- **`mobile/src/screens/stock/StockMovementFormScreen.tsx`** — Adjustment submit path routed to the new hook; quantity validation relaxed to allow 0 for adjustments. Review/approval needed **zero mobile changes** — `GovernanceScreen`'s `EditRequestsTab` is already fully generic and picks up the new entity type automatically.

## Verification performed

- `node --check` on every touched `.js` file — clean.
- `npx tsc --noEmit` on the mobile project — clean.
- 22/23 live production-database checks (Scenarios A–F: normal approval lifecycle, rejection, unauthorized/self-approval denial, duplicate-approval concurrency race, invalid/edge quantities, Workshop Isolation) — the 1 non-pass was an incorrect test-script search string, independently confirmed via direct query to be a false negative (the real behavior was correct).
- Regression smoke test across 11 list/report functions spanning Sales, Deliveries, Stock Transfers, Timber Lifecycle, Resolution Engine, Stock Catalog, and Timber Inventory.
- Cross-entity-type regression: a live `stock_item` (Stock Catalog) edit request, submitted and approved by different users, applied correctly through the refactored `processApprovalDecision` — confirming the concurrency fix doesn't regress the 8 other entity types sharing this engine.
- `git diff --stat` confirms exactly these 8 files changed.

## Live QA data — full lifecycle

| Action | Detail |
|---|---|
| Created | Throwaway `pending_edits` (`entity_type='stock_adjustment'`) and `stock_movements` rows, all tagged `QA-SIP3*`, against a pre-existing zero-baseline stock item; one throwaway `stock_item` edit request (tagged `QA-SIP3-REGRESSION`) for the cross-entity-type regression check |
| Real data touched | None |
| Cleaned up | All QA-tagged `pending_edits`/`stock_movements` hard-deleted; the regression `stock_item` edit reverted and its request row deleted; `stock_levels` reset to exact pre-test baseline (0) |
| Independently re-verified | Fresh `COUNT` queries after cleanup: 0 leftover rows for every entity type |
| QA accounts | None created — all test actors were real, existing accounts |
| Immutable audit trail | Audit-log entries from this testing (submissions/approvals/rejections) remain permanently, per this ERP's established audit-log-immutability convention — not cleanup candidates |

## Bugs found

1. Inventory Adjustments had no approval step at all (audit H-08) — any of 7 roles could unilaterally set any stock level immediately. **Fixed.**
2. The `stock_movements.quantity` column was semantically overloaded between delta-type and adjustment-type movements (audit C-08, "armed, not yet triggered") — confirmed no other code path currently misinterprets it; the existing "absolute target" semantic was preserved deliberately (not redesigned) since it matches the desktop/mobile UI's own established "set quantity" framing.
3. Adjustment audit entries never captured the pre-adjustment quantity (audit M-19). **Fixed** — before/after now encoded in the movement's `notes`.
4. **Found during this phase's own live testing (Scenario D)**: `processApprovalDecision` had an unlocked read-check-then-write race — two concurrent approvals on the same request both succeeded, producing two `stock_movements` rows and two audit entries for one real event. **Fixed** with row-level locking; the fix benefits every entity type on the shared approval engine, not just Inventory Adjustments, and was regression-verified not to break the other 8 entity types.
5. `processApprovalDecision` had no self-approval guard for any entity type (a pre-existing, generic governance gap, not stock-specific) — directly named by this phase's own Priority 6. **Fixed** generically.
6. `processApprovalDecision` had no Workshop Isolation check on approval — a workshop-restricted approver could approve another workshop's request. **Fixed**, scoped to `stock_adjustment` (the only entity type with a consistent `warehouse_id` shape in its payload).

## Explicitly not done this phase (per Stop Rule and Bug Discipline)

- No Workshop Isolation redesign — reuses the exact Phase 1 `isWorkshopRestricted` idiom.
- No new approval system — reuses `pending_edits`/`processApprovalDecision`/`applyPendingEdit` entirely.
- No schema change.
- `mv_stock_summary`/`mv_stock_by_workshop` were not consolidated or retired — classified, and in the one genuine Operational-Decision use (`dispatchReview`), deliberately retained with documented reasoning (the legacy view's unclamped arithmetic can detect oversell in a way the authoritative floor-clamped ledger structurally cannot).
- `stockMovementsDelete`'s pre-existing gap for reversing an adjustment movement (M-12) — confirmed still present, not fixed (not named in this phase's scope).
- The 16-unit historical correction remains unapplied, awaiting approval — this phase only added further corroborating evidence via an independent, pre-existing reconciliation mechanism.
- No Sales, Stock Transfer, Timber Lifecycle, or Resolution Engine code was touched or redesigned.

## Next step

Per the phase's Stop Rule: this phase is complete and stops here, awaiting explicit review and approval — including the still-pending approval of Phase 2's proposed 16-unit historical correction. The remaining High/Medium audit backlog has not been started.
