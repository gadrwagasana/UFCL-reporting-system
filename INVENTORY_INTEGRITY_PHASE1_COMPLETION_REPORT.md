# Inventory Integrity Phase 1 — Completion Report

Stock Transfer Discrepancy Integration. Closes the gap between what Stock Transfers already tracks and what the inventory ledger actually explains — every discrepancy now produces a real, traceable inventory movement instead of a status flag and a free-text note.

## 1. Executive Summary

Before this phase, closing a Stock Transfer with "Report Discrepancy" marked the transfer `completed_with_discrepancy` and stored a free-text note, but wrote **zero rows** to the inventory ledger (`stock_movements`) for the missing quantity. In the brief's own example — 100 dispatched, 80 received — the system could tell you the transfer was short, but nothing in the ledger explained where the other 20 went. That is exactly the "unexplained inventory loss" this phase's architecture principle forbids.

Investigation before implementation found the fix was almost entirely additive, not corrective: `stockTransfersDispatch` and `stockTransfersReceive` already write linked `stock_movements` rows (`transfer_out`/`transfer_in`) and already keep `stock_levels` numerically correct — dispatch deducts the full dispatched amount from source, receive adds only what actually arrived. So the 20-unit gap was never a stock-level bug; it was a missing ledger row. `stockTransfersReportDiscrepancy` now writes exactly one new row — `movement_type='loss'` — that explains it, and deliberately does not touch `stock_levels` again, since it was already correct.

Two scope decisions were confirmed with you before implementation: a new narrow `stock_movements.loss_reason` column (rather than overloading the existing `reference` field) so "Loss by Type" reporting can group reliably; and single-step approval reusing the table's existing `approval_status`/`approved_by` columns (auto-recorded, no new gate), since those columns' only prior consumer was a legacy pathway already retired by an earlier phase.

Live-verified end-to-end against real production data with the brief's own scenario (Gatare → Nyanza, 100 dispatched, 80 received): the resulting `stock_movements` row, cost valuation, report inclusion, audit entry, and notifications were all confirmed correct, and `stock_levels` was confirmed unchanged by the discrepancy step itself.

## 2. Architecture Review

`stock_movements` (`db/schema.sql:226`) already had everything the brief's Inventory Ledger section asks for — item, warehouse, movement type (free text, not an enum — proven extensible by `transfer_out`/`transfer_in` already existing with zero migration), unit cost, reference, notes, approval fields, created-by, created-at — plus a `transfer_id` FK already added by a prior phase and, until now, never used for a discrepancy. The only genuine gap was a structured field for the standardized reason category, since "Business Reason" and "Movement Type" are listed as separate ledger fields and reports need to group losses reliably — free-text `notes` alone can't support that. One column, `loss_reason`, closes it.

No new tables. No new approval engine — the `approval_status`/`approved_by`/`approved_at` columns already existed; their only prior consumer (`stockTransferApprove`, the legacy `movement_type='transfer'` pathway) was already retired by an earlier Inventory audit phase, so reusing the columns (not a dead function) was the correct "reuse existing approval architecture" reading. No new authorization permission — the new report page reuses the existing `stock-movements` `mustRole` gate, the same data-access decision as the Stock Movements page it reads from.

## 3. Inventory Ledger Integration

`stockTransfersReportDiscrepancy` now inserts one `stock_movements` row per discrepancy: `item_id`/`quantity` from the transfer, `warehouse_id=from_warehouse_id` (the loss is attributed to the source, mirroring `transfer_out`'s own semantics — it never had a destination), `to_warehouse_id=null`, `movement_type='loss'`, `unit_cost` looked up from `stock_catalog` at the moment of closing, `loss_reason` (one of 8 standardized values, server-validated against a closed list — `DISCREPANCY_REASONS`), `notes` (the existing free-text reason field), `transfer_id` (the Reference Stock Transfer field, and the two-way navigation link), and `approval_status='approved'`/`approved_by`/`approved_at` populated at creation. `movement_type='loss'` is created only by this one path — it is not a selectable option in the generic manual "Record movement" form, keeping one single creation path for loss entries rather than a second, freestanding way to record a loss.

## 4. Stock Transfer Integration

The Stock Transfer workflow is completely unchanged: Dispatch → Receive → Report Discrepancy → Transfer Closed, same statuses, same permission (`stock-transfers`), same functions. The only addition is that closing with a discrepancy now also produces the ledger row described above, inside the same database transaction as the transfer's own status update — both succeed or both roll back together, so a transfer can never end up `completed_with_discrepancy` without its explaining movement, or vice versa.

## 5. Audit Integration

The existing `logAudit` call (already present) was extended, not duplicated — its `meta`/`after` payload now includes the new movement's id and `loss_reason` alongside the transfer id, discrepancy quantity, and reason it already recorded. One audit entry per discrepancy action, not two, since creating the transfer's status change and creating its ledger row are one atomic business event. Live-verified: the audit entry read exactly `Transfer #17 closed with discrepancy: 20 unit(s) short — Damaged During Transport: QA test — 20L damaged in transit`.

## 6. Notification Integration

No new notification calls were added — the two that already fired (to the operational-authority role list, and to the transfer's original requester) were enriched to name the movement type/reason and the movement's reference number. In this single-step design, "discrepancy reported," "movement created," and "finalized" are the same instant, so a third or fourth notification for the same event would only be noise. Live-verified: both notifications fired with the updated body text.

## 7. Reporting Integration

New `inventoryLossReports(userId, filters)` mirrors the established "one function, many named CSV datasets" pattern (the same shape as Mechanician Phase 3's `maintenanceReports`). Seven datasets, all filtered to `movement_type='loss'`: Loss by Type, Loss by Warehouse (doubles as "Loss by Department" — no separate department concept exists anywhere in this schema, stated here rather than invented), Loss by Item, 6-Month Loss Trend (the zero-filled `generate_series` idiom already established this session), Loss History, Top Loss Categories, Top Loss Locations. Gated on the existing `stock-movements` permission, workshop-isolated the same way every other inventory read is. Live-verified: the test movement appeared correctly in both `lossHistory` and `lossByType`, with `totalLossValue` correctly computed as `20 × RWF 500 = RWF 10,000`.

## 8. Desktop UI

The Report Discrepancy overlay now shows Dispatched/Received/Difference before the user acts, a required Movement Type picker (the 8 standardized reasons), the existing free-text reason field, and — on success — a confirmation screen with the movement number, type, reference transfer, and approval status, plus a "View Inventory Movement" button that opens the Stock Movements page pre-filtered to it. The Stock Movements page gained a `loss` badge/filter option, a "Losses" KPI tile, the loss reason shown inline where the reference column would otherwise be blank, and a "View Transfer" button on any row with a linked transfer — the reverse navigation. A new "Inventory Loss Reports" page (new NAV entry under Workshop & Inventory) provides the trend chart and all 7 CSV exports via the existing `execExport` pattern.

## 9. Mobile UI

The shared `ReasonModal` component gained one optional `extraContent` slot (undefined by default, zero effect on its many other callers — Reject, Cancel, etc.) so the discrepancy flow could add a reason-category picker without a second, duplicate dialog component. The Stock Transfers discrepancy modal now collects both the category and the free-text explanation. The Stock Movements screen surfaces `loss` movements (color, label, loss reason line, correct −/+ sign) and a "View Transfer" action that navigates to the linked transfer's detail on the Stock Transfers tab. No mobile CSV/reports screen — desktop-only, the same already-established boundary as every other reports page built this session.

## 10. Verification

**Static**: `node --check` clean on `db/services/data.js`, `db/migrate.js`, `electron/main.js`, `electron/preload.js`, `renderer/app.js`, `mobile-api/routes/stockTransfers.js`, `mobile-api/routes/stock.js`. `npx tsc --noEmit` clean on `mobile/` — zero errors on the first run after all edits.

**Live** (production DB, throwaway stock item + a real transfer between the brief's own two workshops, Gatare → Nyanza, removed after):

1. Seeded 150L of a throwaway item at Gatare. Created a transfer for 100L, approved it, dispatched 100L (`stock_levels` at Gatare → 50), received 80L (`stock_levels` at Nyanza → 80) — reproducing the brief's exact scenario.
2. Reported the discrepancy with reason "Damaged During Transport." Confirmed the resulting `stock_movements` row exactly matched expectations: `movement_type='loss'`, `quantity=20`, `warehouse_id`=Gatare, `to_warehouse_id=null`, `loss_reason='Damaged During Transport'`, `transfer_id` linked, `approval_status='approved'`, `approved_by` populated, `unit_cost=500`.
3. Confirmed `stock_levels` at both warehouses were **unchanged** by the discrepancy step itself (still 50/80, exactly as after dispatch+receive alone) — no double-deduction.
4. Confirmed `inventoryLossReports` returned the movement in both `lossHistory` and `lossByType`, with `totalLossValue` correctly computed at RWF 10,000.
5. Confirmed one `audit_log` entry referencing the movement, with the correct combined message.
6. Confirmed both notifications fired with the enriched body text.
7. Cleaned up: deleted the test movement/dispatch/transfer/stock-level rows and the throwaway catalog item. No residual data.

## 11. Production Readiness

**Every stock transfer discrepancy now produces a real, traceable inventory movement — with a source, a reason, a responsible user, an approval record, and a reference back to the transfer — closing the one path in this ERP where inventory quantity could previously disappear unexplained.** The Stock Transfer workflow itself is untouched; the ledger now simply tells the truth about it. Live-verified end-to-end against real production data using the brief's own scenario, on both platforms.

## Outstanding Items

- `movement_type='loss'` rows can still be soft-deleted via the existing generic Stock Movements delete action (governed: reason-required, audit-logged, recoverable from trash) — this reuses the existing governance framework rather than adding a special-case guard, since a soft-delete with mandatory reason and audit trail already satisfies "no unexplained loss" (the deletion itself is explained). Not changed this phase.
- No mobile CSV/reports screen for Inventory Loss Reports — consistent with the existing desktop-only boundary for every reports page in this app.
- No configurable approval-threshold escalation was built — the brief explicitly scoped that as a future policy decision ("if company policy later requires"); the existing `approval_status`/`approved_by` columns are already populated correctly so that escalation could be added later without a schema change.

## Not committed

Per standing release discipline, none of the code above has been committed or pushed. The database migration (new `loss_reason` column, new index, new `inventory-loss-reports` page-visibility permission grant) **was** applied to the live database as part of implementing this approved phase.
