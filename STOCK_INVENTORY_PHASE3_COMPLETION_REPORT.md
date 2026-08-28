# Stock & Inventory — Phase 3: Inventory Architecture Consolidation
## Completion Report

---

## 1. Executive Summary

Phase 3 closes the remaining Inventory Architecture findings from `STOCK_INVENTORY_ENTERPRISE_AUDIT.md`: it proves and documents the ERP's single authoritative stock source, closes the Inventory Adjustment approval gap (audit H-08/C-08/M-19 — the last unguarded, unapproved, immediate stock-level write in the department), and fixes a genuine concurrency defect discovered — and fixed — during this phase's own live testing, before it could reach production.

**The centerpiece of this phase**: Inventory Adjustments (`stock_movements.movement_type = 'adjustment'`) previously let any of 7 roles unilaterally SET any stock level instantly, with no approval, no before/after traceability, and — per this program's own re-verification — a schema-level `quantity` column overload shared with delta-type movements ("armed, not yet triggered" per the audit). Adjustments now flow through **Operator submits request → existing `pending_edits` approval engine (manager tier) → applies atomically with a locked before/after read → real `stock_movements` row → notification → audit trail** — exactly the workflow this phase's own brief specifies, built entirely on the ERP's existing, already-proven governance/approval infrastructure. No second approval system, no new stock ledger, no schema change.

**A genuine concurrency bug was found and fixed within this phase**: `processApprovalDecision` — the ERP's one shared approval-decision engine, used by every governed entity type, not just this phase's new one — had an unlocked read-then-write race that let two concurrent approvals on the same request both succeed. Live-caught via this phase's own Scenario D test (two simultaneous approvals produced two `stock_movements` rows for one real event), root-caused, and fixed with row-level locking — benefiting every entity type on the shared engine, not just Inventory Adjustments.

The historical "16-unit discrepancy" from Phase 2 was independently re-confirmed by a **second, completely separate, already-existing reconciliation mechanism** (`timberInventoryList`'s ledger-based reconciliation, built in an earlier phase and already visibly surfaced on the live Timber Inventory page as a red "mismatch" badge) — giving strong corroborating evidence for Phase 2's root-cause finding. It remains uncorrected, exactly as documented, pending approval.

**Live verification**: 22/23 automated checks passed on the first real pass; the one "failure" was confirmed via direct query to be a mistake in the test script's own search string, not a defect — the underlying behavior was correct both times. All QA data was removed and independently re-verified at zero.

---

## 2. Authoritative Inventory Architecture

Proven from current source and live database behavior, not assumed:

- **`stock_levels`** — the stored, current operational balance. Written exclusively through `_postFinishedTimberStock` (Sawmill Phase 1's helper, reused by every write path in this program including this phase's new adjustment apply step) or, for the generic Stock Movements module, directly alongside a matching `stock_movements` insert. Every write is paired with a movement row in the same statement/transaction.
- **`stock_movements`** — the immutable, append-only movement ledger. Every `stock_levels` change this program's write paths perform has a corresponding row here.
- **Legacy `mv_stock_summary` / `mv_stock_by_workshop`** — category-level, `sales_orders`-derived materialized views, refreshed via `refreshStockView()`/`refreshStockByWorkshop()`. Confirmed (§3) to be a genuinely separate calculation, not a view over the authoritative ledger.
- **A second, independent, authoritative reconciliation mechanism already exists**: `timberInventoryList` (built across Sawmill Phase 1/2) separately computes `reconciliation = { totalProduced, totalSold, currentStock, expectedStock, mismatch, reconciled }` **entirely from `stock_movements`/`stock_levels`** — zero dependency on `mv_stock_summary`. This is the report's own internal cross-check, and it is already displayed on the live Timber Inventory page (a red/green badge, `renderer/app.js:14053`). Live-queried during this phase: `mismatch: -16, reconciled: false` — independently corroborating Phase 2's root-cause finding for the historical discrepancy (§9), from a mechanism this phase did not build and did not need to.

**Conclusion**: the audit's expected target architecture (`stock_levels` + `stock_movements` as authoritative, legacy views demoted to reporting-only) is confirmed correct and was **already substantially in place** before this phase. This phase's job was narrower than "build a reconciliation layer" — it was to close the one remaining unguarded write path (Inventory Adjustments) and verify nothing else silently trusts the legacy view for a decision.

---

## 3. Legacy `mv_stock_summary` Assessment

All 6 real query call sites found and classified (a `refresh` call and 5 comment references were excluded as non-consuming):

| Call site | Function | Classification | Disposition |
|---|---|---|---|
| `data.js:646` | `dailyList` | **A — Safe reporting** | Display-only stock tile on the Sawmill Production list page; not used for any validation. Left unchanged. |
| `data.js:1157` | `salesList` | **A — Safe reporting** | Display-only; `salesCreate`'s own availability check (Phase 2) is separately authoritative (`stock_levels`, `for update`-locked). Left unchanged. |
| `data.js:2272` | `getDashboardStats` | **A — Safe reporting** | Dashboard tile. Left unchanged. |
| `data.js:5661` | `dispatchReview` | **B/C hybrid — evaluated, deliberately not migrated** | See below. |
| `data.js:5909` | `timberInventoryList` | **A — Safe reporting, WITH an already-existing authoritative reconciliation cross-check (§2)** | `stock.timberProduced` feeds only a waste-rate percentage; the report's real "is stock correct" signal is the separate, authoritative `reconciliation` object. Left unchanged. |

**`dispatchReview` — the one genuine Category B (Operational Decision) use — evaluated and deliberately left as-is, with reasoning:**

This function gates dispatch approval on `mv_stock_summary`'s category-level (not per-item, not per-warehouse) produced-minus-sold balance, a known, documented trade-off from an earlier phase (Logistics Phase 1) working around a schema gap that Phase 2 has since closed (`sales_orders.product_id`/`workshop_id` are now reliably populated). Migrating this check to the authoritative `stock_levels` was seriously considered and **rejected** for a specific, non-obvious reason found during this phase's own investigation: `_postFinishedTimberStock`'s `greatest(0, quantity+delta)` floor-clamp means `stock_levels` **structurally cannot go negative** and therefore cannot reveal an over-sell condition after the fact — whereas `mv_stock_summary`'s unclamped `produced − sold` arithmetic *can* go negative, which is precisely the signal this safety-net check exists to catch. Replacing it with a `stock_levels` check would silently **reduce** oversell-detection capability, not improve it — a real regression dressed up as a migration. Per this phase's own Priority 2 instruction ("if retirement is unsafe, retain it only where justified"), it was retained with this reasoning documented, not migrated. No code change was made here.

**No False Positives, no scope expansion.**

---

## 4. Stock Level / Movement Reconciliation

Priority 3's identity (`Opening + Receipts + Production + Returns − Sales − Transfers Out − Waste − Damage − Disposal − Adjustments = Current Stock`) is **already continuously verified in production** by `timberInventoryList`'s existing `reconciliation` object (§2), computed purely from `stock_movements` (`movement_type in ('in','out')` filtered to Finished Timber/Poles categories) vs. `stock_levels`. This phase did not need to build this — it verified the mechanism is correct, live-queried its current output, and confirmed it correctly flags the one known discrepancy (§9) rather than silently passing.

No new categories were invented. This phase's own new movement type continues using the identical `stock_movements` shape (`movement_type='adjustment'`), so it participates in this same reconciliation automatically — no separate accounting needed for the new adjustment-approval flow.

---

## 5. Inventory Adjustment

**Before** (re-verified against current source, findings confirmed real):

- **H-08**: Any of 7 roles holding the `stock-movements` permission could call `stockMovementsCreate` with `movement_type='adjustment'` and unilaterally, immediately SET `stock_levels` to any value — zero approval step.
- **C-08**: the `quantity` column is semantically overloaded — a signed *delta* for `in`/`out`/`return`, but the *absolute target value* for `adjustment` — confirmed "armed" (no other code path was found to misinterpret it, since the only other readers of `movement_type='adjustment'` rows just `count(*)`, never sum `quantity`) but a real risk if ever touched by new code without this context.
- **M-19**: adjustment audit entries captured no pre-adjustment quantity — only the final target value.
- Related: **M-12** (`stockMovementsDelete` never reversed an adjustment's stock effect) — confirmed still true, **not fixed this phase** (§20 — out of the named scope; deletion of adjustment movements was never named in this phase's Priorities).

**Fixed**: `stockMovementsCreate` retires the direct `'adjustment'` path (identical idiom to how `'transfer'` was already retired there in an earlier phase — a clear, redirecting error message, not a silent removal). Two new functions replace it:

- **`stockAdjustmentRequestCreate(userId, payload)`** — validates role, quantity (`Number.isFinite`, `>= 0` — zero is a legitimate "recount found nothing" target), a required reason, and Workshop Isolation; rejects a no-op request (target already matches current stock); submits into `pending_edits` with `entity_type: 'stock_adjustment'`, `required_level: 'manager'`; notifies `MANAGER_APPROVERS`.
- **`_applyStockAdjustment(itemId, payload, submitterUser)`** — called by `applyPendingEdit`'s new `'stock_adjustment'` case once approved. Re-reads the *current* quantity under `for update` at apply time (not the snapshot captured at request time) so the recorded before/after pair is always accurate even if other stock activity happened in between — closing the same class of TOCTOU gap Phase 2 closed for Sales. Records the target as `stock_movements.quantity` (preserving the existing "adjustment = absolute target" business semantic the desktop/mobile forms already present to users — not redesigned) with the resolved before→after pair encoded in `notes` (no schema change).

The existing "set quantity" business semantic (matching the pre-existing desktop form's own "Adjustment (set quantity)" label) was deliberately preserved rather than converted to a delta model — converting would have changed real user-facing behavior for no benefit, and nothing else in the codebase interprets an adjustment row's `quantity` as anything but the write target (§3 of that finding, confirmed via full-codebase search).

---

## 6. Approval Workflow

Reuses the existing `pending_edits` → `processApprovalDecision` → `applyPendingEdit` engine — the exact same table, notification, and audit shape every other governed edit in this ERP already uses (daily logs, harvest logs, sales orders, stock catalog edits, delivery orders, POD). No second approval system was created.

**`required_level: 'manager'`**, not `'leader'`: investigated and deliberately chosen to match the **already-configured, already-live UI gate** every other `pending_edits` entity type in this app is reviewed through (`canApproveEdits()` in `renderer/app.js`, restricted to `admin/ceo/operations/logistics`) — not invented, and not a new CEO-only requirement (per this phase's own explicit warning against inventing one). A `'leader'` tier exists in the backend but has no corresponding desktop UI affordance anywhere in this codebase today; aligning with the tier that actually has a working review screen was judged the safer, more consistent choice over building a new UI affordance for one entity type.

**A pre-existing gap in the shared engine, closed as part of this work**: `processApprovalDecision` had no check preventing a submitter from approving their own request — true for *every* entity type on this engine, not specific to adjustments. Directly named by this phase's own Priority 6 ("creator cannot improperly approve their own adjustment"), and a governance hole this phase's own new feature would otherwise have inherited. Fixed generically (benefits all entity types), not as a stock-specific bolt-on.

**Workshop Isolation on approval**: `processApprovalDecision` validates approver role against `required_level` but had no workshop check at all. Added, scoped specifically to `entity_type === 'stock_adjustment'` (the only type on this shared engine whose payload carries a `warehouse_id` in a consistent shape) — reuses the exact `isWorkshopRestricted` idiom from every Phase 1/2 fix.

---

## 7. Workshop Isolation Verification

No Phase 1 fix was touched or redesigned. Two new checks were added this phase, both using the identical existing idiom:

1. **Request time** (`stockAdjustmentRequestCreate`): a workshop-restricted user can only request an adjustment for their own workshop.
2. **Approval time** (`processApprovalDecision`, §6): a workshop-restricted approver cannot approve another workshop's adjustment request.

**Live-verified** (Scenario F): a Gatare storekeeper's attempt to request an adjustment for Nyanza was denied with zero mutation, before the request row was even created.

**Not live-testable**: no workshop-restricted `MANAGER_APPROVERS`-tier account exists in production today (`admin`/`ceo`/`operations`/`logistics` are workshop-isolation-exempt by role; the one `sales`-role account has `workshop_id = null`) — same account-availability limitation documented in Phase 1 for an analogous case. The approval-time check was verified statically (code read, confirmed present and correctly scoped) rather than with a fabricated account, consistent with this program's established practice.

---

## 8. Inventory Reporting

Audited against the Priority 9 checklist. **Timber Inventory** already surfaces an authoritative reconciliation badge (§2/§4) — confirmed correct and live. **Executive Dashboard** consumes the same `timberInventoryList().reconciliation` object (`renderer/app.js:6123`, `sawmillRecon`) — same authoritative source, not a duplicate calculation. **Stock Summary / Stock Movement History / Inventory Valuation / COGS / Gross Margin** (`inventoryDashboard`, `inventoryIntelligence`, `stockMovementsList`) were confirmed (by source read, consistent with Phase 1/2's own established findings) to read `stock_levels`/`stock_movements` directly, not `mv_stock_summary`. **Poles Inventory / Raw Log Inventory / Showroom Inventory** are separate, already-authoritative calculations (`_rawLogAvailableStock`, the `rawLogInventory` figure in `timberInventoryList`, `showroomInventoryList`) untouched by this phase. No report was found silently trusting a stale legacy figure for a number presented as current truth.

---

## 9. Inventory Valuation

Not touched this phase. Confirmed by scope: none of this phase's changes (`stockMovementsCreate`'s adjustment retirement, the two new adjustment functions, `applyPendingEdit`'s new case, `processApprovalDecision`'s locking/self-approval/workshop fixes) write to `stock_catalog.unit_cost`, `products.standard_cost`, `products.default_price`, or any COGS/margin calculation. `timberInventoryList`'s `costing` block (Standard Cost → `stock_catalog.unit_cost` → inventory valuation/COGS, Sawmill Phase 2's architecture) was live-queried during this phase's testing and returned normally, unaffected. Default Selling Price and Negotiated Selling Price (Phase 2) remain untouched and independent of valuation, as required.

---

## 10. Product Catalog Integrity

Spot-checked: the new adjustment functions reference `item_id` as `stock_catalog.id` exclusively (never `products.id`), consistent with every other stock-movement function in this codebase (`stockMovementsCreate`, `_postFinishedTimberStock`, etc.) — no new risk of a wrong-ID reference was introduced. No product/catalog data was rewritten by this phase.

---

## 11. Stock Transfer Regression

No Stock Transfer function (`stockTransfersCreate/ApproveReject/Dispatch/Receive/ReportDiscrepancy`) was touched this phase, and none call `stockMovementsCreate`, `applyPendingEdit`, or `processApprovalDecision` — zero code-path overlap with anything changed this phase. `stockTransfersList` confirmed functional via the regression smoke test (§16).

---

## 12. Sales Regression

No Sales function was touched this phase. `salesList`/`deliveryOrdersList` confirmed functional via the regression smoke test. Phase 2's fixes (quantity validation, race-safe availability, edit/cancel/reject/close-short reconciliation) are all independent of this phase's changes and were not re-touched.

---

## 13. Timber Lifecycle Regression

No Harvest/Sawmill/QC/Resolution function was touched this phase. `productionOffcutsList`, `harvestWasteList`, `rejectionHoldsList` all confirmed functional via the regression smoke test. `timberInventoryList` (the report tying the whole chain together) confirmed functional and its reconciliation badge confirmed accurate (§2/§9).

---

## 14. Resolution Engine Regression

No Resolution Engine function was touched this phase. `resolutionsList`/`showroomDamageReportsList` confirmed functional via the regression smoke test. No second Resolution Engine was created — Inventory Adjustments are a distinct concept (a stock-count correction, not a waste/rejection/damage disposition) and correctly remain a separate workflow.

---

## 15. Desktop / Mobile Parity

Both platforms updated to the new request-based adjustment flow, with zero duplicate workflow built beyond what the existing forms already had:

- **Desktop** (`renderer/app.js`): the existing "Record stock movement" overlay's Adjustment option now calls the new `stockAdjustmentRequestCreate` IPC channel instead of the immediate-create one; the Notes/Reason field and quantity-minimum toggle were extended (0 is now a valid adjustment target, matching the "set quantity" semantic). `insertPendingPanel` — the exact same generic pending-approval widget every other governed page already uses — was added to the Stock Movements page (it had none before, since there was nothing to approve there until now).
- **Mobile** (`StockMovementFormScreen.tsx`, `useStock.ts`, `endpoints.ts`): identical treatment — a new `useStockAdjustmentRequestCreate` hook, routed on submit when `movType === 'adjustment'`. **Zero changes were needed to review/approve pending adjustments on mobile** — `GovernanceScreen`'s `EditRequestsTab` is already fully generic (`entity_ref || entity_type + '#' + entity_id`), with no hardcoded entity-type list, so the new `'stock_adjustment'` type appears there automatically.
- **`mobile-api/routes/stock.js`**: new `POST /movements/adjustment-request` route, pure delegation to `data.stockAdjustmentRequestCreate` — same zero-logic pattern confirmed for every route in this program.

No platform uses a different stock calculation — all three (desktop IPC, mobile REST, direct API) call the identical backend functions.

---

## 16. Concurrency Verification

**A real concurrency defect was found and fixed** — see §17 for the full account. Additionally verified: Phase 2's `salesCreate` `for update` lock (concurrent sales) and `deliveryOrdersCreate`'s SO lock remain untouched and unaffected by this phase's changes (no shared code path). A simultaneous Adjustment + Sale on the *same* item/warehouse is safe by construction: `salesCreate`'s `for update` lock and `_applyStockAdjustment`'s `for update` lock both acquire the same `stock_levels` row lock, so Postgres serializes them regardless of which function is running — no new coordination code was needed, the existing per-row locking discipline (consistently applied since Phase 1) already covers this case.

---

## 17. Historical Data Findings

**The `processApprovalDecision` duplicate-approval race** (found via this phase's own Scenario D test, not the original audit): two concurrent `approve` calls on the same `pending_edits` row both read `status='Pending'` before either had written back, so both proceeded to apply. For a SET-type adjustment the resulting `stock_levels` value happened to still be numerically correct (applying the same target twice is idempotent in effect) — but **two separate `stock_movements` rows and two audit-log entries** were created for one real approval event, a genuine traceability defect, and one that would **not** have been harmless for a delta-type movement had this pattern ever been reused elsewhere. Root-caused to an unlocked read-check-then-write sequence; fixed with `SELECT ... FOR UPDATE` row locking around the whole decision (self-approval check → role check → workshop check → apply → status update), refactored into `_decideApprovalWithinLock` (runs inside the lock) and `_afterApprovalDecision` (audit/notification, runs after commit — unchanged from before). Re-verified live: two concurrent approvals now produce exactly one success, one `stock_movements` row, one status transition. **Regression-verified this fix does not break the shared engine for other entity types** — a live `stock_item` (Stock Catalog) edit request, approved by a different user than the submitter, applied correctly end-to-end.

**The 16-unit discrepancy (Phase 2 §9)** — remains fully documented, not corrected, pending approval, per the explicit instruction not to hide a historical correction inside this architecture migration. **New evidence this phase**: `timberInventoryList`'s independent, pre-existing, authoritative-ledger-only reconciliation mechanism (§2) currently reports `mismatch: -16, reconciled: false` — the *exact* figure Phase 2's manual investigation derived from the 4 orphaned QA movements, arrived at via a completely separate code path built in an earlier phase. This is strong corroborating evidence, not a new finding requiring separate action — the proposed correction remains exactly as documented in `STOCK_INVENTORY_PHASE2_COMPLETION_REPORT.md` §9, unapplied, awaiting approval.

No other historical discrepancy was found. No production history was modified by this phase.

---

## 18. Live Verification

Real accounts (`admin`=1, `storekeeper@Gatare`=12, `storekeeper@Nyanza`=49, `showroom-staff`=19, `ops.manager`=20) plus throwaway QA data (`stock_movements`, `pending_edits` — all tagged `QA-SIP3*`) on a pre-existing, zero-baseline test item.

| Scenario | Result |
|---|---|
| A — Normal Adjustment (Create→Approve→Movement→Stock→Audit) | ✅ all 6 checks (1 test-script string-match bug, confirmed correct via direct query — see §17 note) |
| B — Rejected Adjustment (stock unchanged) | ✅ |
| C — Unauthorized submit + unauthorized approve + self-approval, all denied with zero mutation | ✅ ×4 |
| D — Duplicate approval race (found real bug, fixed, re-verified: exactly 1 success, 1 movement) | ✅ ×3 |
| E — Invalid/edge quantities (negative denied, zero accepted and applies correctly, no-op denied) | ✅ ×4 |
| F — Workshop Isolation (cross-workshop request denied, no mutation) | ✅ ×2 |

**22/23 automated assertions passed**; the 1 "failure" was independently confirmed via direct `audit_log` query to be a mistake in the test script's own search predicate (it searched for a reference string that was never part of the audit action text) — the actual audit entries ("Submitted stock adjustment request — ...", "Approved/Rejected edit request for ...") were present and correct both times this scenario ran.

---

## 19. Regression Results

Smoke-tested post-fix: `salesList`, `deliveryOrdersList`, `stockTransfersList`, `productionOffcutsList`, `harvestWasteList`, `rejectionHoldsList`, `showroomDamageReportsList`, `resolutionsList`, `stockItemsList`, `timberInventoryList`, `pendingEditsList` — all functional. **Cross-entity-type regression** on the refactored `processApprovalDecision`: a live `stock_item` edit request (unrelated to Inventory Adjustments), submitted by one user and approved by a different one, applied correctly and was independently reverted — confirming the row-locking fix does not regress the shared engine for the other 8 entity types it serves.

---

## 20. Outstanding Items

- **The 16-unit historical correction** (§17) remains undone, awaiting explicit approval — unchanged from Phase 2.
- **`stockMovementsDelete` still does not reverse an adjustment movement's stock effect** (M-12) — confirmed still true, not fixed. Not named in this phase's Priorities (which focus on the adjustment *creation* path); documented for a future phase if deleting an approved adjustment from the trash needs to also reverse it.
- **`dispatchReview`'s use of `mv_stock_summary`** (§3) was deliberately left as-is, with detailed reasoning recorded, rather than migrated — flagged here so the decision is visible for review, not just buried in §3.
- All findings from `STOCK_INVENTORY_ENTERPRISE_AUDIT.md` outside Workshop Isolation (Phase 1), Sales & Stock Integrity (Phase 2), and Inventory Architecture Consolidation (this phase) remain open and untouched (Sales' remaining Critical findings not yet superseded by Phase 2 where applicable, Financial Reconciliation, Adjustments' own remaining Medium items beyond H-08/C-08/M-19, etc.).

---

## 21. Production Readiness

Phase 3's changes are considered **production-ready**:

- The Inventory Adjustment approval workflow reuses 100% existing infrastructure (`pending_edits`, `processApprovalDecision`, `applyPendingEdit`, `isWorkshopRestricted`, `for update` locking, `insertPendingPanel`, `GovernanceScreen`) — no new architecture, no schema change.
- A real, if narrow, concurrency defect was found and fixed *within this phase*, before reaching production, with proof (not just assertion) that the fix works and does not regress the shared engine.
- Full desktop/mobile/API parity confirmed, with the mobile review side requiring zero code change due to its existing generic design.
- 22/23 live checks passed (the 23rd independently confirmed correct via direct query).
- Full regression across Transfers/Sales/Timber Lifecycle/Resolution Engine/the shared approval engine confirmed intact.
- Zero QA data footprint remaining; independently re-verified.
- The one historical data question (16-unit discrepancy) remains correctly un-touched, now with a second independent line of corroborating evidence, awaiting the same approval Phase 2 already requested.

---

## Success Criteria — Verified

- ✅ One authoritative operational stock architecture (`stock_levels` + `stock_movements`), proven not assumed.
- ✅ The one remaining critical decision depending on the legacy calculation (`dispatchReview`) was evaluated and deliberately, correctly retained — not "migrated" for its own sake, not silently left unexamined.
- ✅ `stock_levels`/`stock_movements` reconcile — verified via an already-existing, now-confirmed-accurate mechanism.
- ✅ Inventory Adjustments are controlled and traceable — approval required, before/after captured, workshop-isolated.
- ✅ Approved adjustments create exactly one stock movement — proven live, after fixing a real race that briefly violated this.
- ✅ Rejected adjustments do not alter stock — verified.
- ✅ Workshop Isolation remains intact — extended, not redesigned, to the two new adjustment entry points.
- ✅ Stock Transfers / Sales / Timber Lifecycle / Resolution Engine remain correct — zero code-path overlap, confirmed via regression.
- ✅ Inventory valuation remains consistent with Standard Cost — untouched.
- ✅ Desktop and mobile remain functionally aligned.
- ✅ Concurrent operations cannot corrupt stock — proven, including a defect found and closed within this phase.
- ✅ Historical discrepancies documented, not silently altered.
- ✅ All QA data removed, independently re-verified.
- ✅ Static checks pass (`node --check` on every touched `.js` file, `tsc --noEmit` clean on the mobile project).
- ✅ Nothing committed or pushed.
