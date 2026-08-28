# Stock & Inventory Enterprise Completion — Phase 1: Enterprise Audit

**STOCK_INVENTORY_ENTERPRISE_AUDIT.md — 2026-08-09**

**This is an audit-only deliverable. No source code, schema, permission, workflow, or production data was modified in the production of this report.** Method: five parallel read-only research passes (static source review of `db/services/data.js`, `db/migrate.js`, `db/schema.sql`, `renderer/app.js`, `electron/main.js`, `mobile-api/routes/*.js`, `mobile/src/screens/**`, `mobile/src/utils/notificationRouting.ts`), each independently cross-verified against live, `SELECT`-only queries against the production Postgres database, followed by my own synthesis, deduplication, and cross-referencing of all findings, plus the department-collaboration mapping, findings classification, and final reconciliation matrix. Every finding below traces to exact file:line evidence and/or a live query with its actual result — nothing is asserted without a citation.

---

## 1. Executive Summary

Stock & Inventory's core architecture — `stock_catalog → stock_levels → stock_movements` — is well-designed, and every write path that uses it correctly is internally consistent: 11 of 14 live `stock_levels` rows reconcile exactly against a full replay of their movement history, the full Stock Transfer lifecycle is transactional and workshop-isolated, and no orphaned foreign keys exist anywhere in the schema.

However, this audit found that **the answer to the central question — "can every unit of stock be traced from origin to disposition and reconciled?" — is currently no**, for reasons that are specific, evidenced, and fixable, not systemic architectural failure:

1. **A legacy, competing stock-calculation system (`mv_stock_summary`) still gates a real operational decision** (Logistics dispatch approval) instead of the authoritative ledger it was supposed to be superseded by, and is live-proven to be 87% wrong today.
2. **Sales is the one major write path that was never brought into the ledger's safety net**: no quantity validation, a race-condition-prone stock check, and — critically — **no code path anywhere reverses a sale's stock deduction** on edit, cancellation, delivery rejection, or short-close, despite comments in three different functions claiming it does. This is not theoretical: it is the live, quantified, root-caused reason the Timber Inventory dashboard's own self-check is failing in production right now.
3. **Workshop Isolation — while correctly and thoroughly applied across the Stock Transfer lifecycle and Material Requests (the two most mature areas) — has real, confirmed gaps** in the Resolution Engine, the Sawmill quality-inspection chain, warehouse damage reporting, and stock-movement deletion, several of which were **independently discovered by two different audit passes working from different angles**, which is strong corroborating evidence rather than a single reviewer's opinion.
4. **The Inventory Adjustment mechanism** — the one path that can unilaterally overwrite a warehouse's stock level — has no approval step, and stores its "new absolute value" in the same database column every other movement type uses for a "delta," a landmine for any future reconciliation query.
5. **All product costing remains unapproved QA placeholder data**, unchanged from an earlier phase's own disclosure of the same fact.

None of this reflects a need to redesign the inventory or costing architecture — per the audit's own governing rule, `stock_catalog → stock_levels → stock_movements` remains authoritative and should remain so, and `stock_catalog.unit_cost` remains the single costing source and should remain so. The findings below are about **closing specific, identified gaps in how consistently that architecture is enforced**, not replacing it.

**Scale of findings**: 11 Critical, 13 High, ~20 Medium, ~8 Low (full register in §32–33). Three of the Critical findings converge on a single live, quantified, root-caused reconciliation failure (§19), which is presented as this audit's single most important discovery.

---

## 2. Current Inventory Architecture

Confirmed via live `information_schema` queries and `db/schema.sql`/`db/migrate.js`:

```
stock_catalog (product/item master — id, category, name, sku, uom, unit_cost, min/max_stock, active, ...)
      ↓  (item_id, warehouse_id) UNIQUE
stock_levels (quantity per item per warehouse — ON DELETE CASCADE from both parents)
      ↓  replayable via
stock_movements (21-column ledger — item_id, warehouse_id, to_warehouse_id, movement_type,
                 quantity, reference, notes, approval_status, unit_cost, loss_reason,
                 transfer_id, soft-delete columns — FK RESTRICT, never cascades)
```

`stock_transfers` is a legitimate multi-stage **workflow** table layered on top of this chain (every transition posts a real `stock_movements` row) — not a competing ledger. `products` (the Sawmill/Timber size-based catalog) is a legitimate **bridge** into `stock_catalog` via `products.stock_item_id`, confirmed by both live linkage and migration comments describing it as intentional. `timber_inventory` as a literal table does not exist — the "Timber Inventory" screen is a report computed from the above tables (and, problematically, from a second system — see §3).

**No second inventory ledger and no second costing engine were found to have been built** — the one confirmed architectural violation of the audit's own governing rules is that a *legacy, pre-existing* second system (`mv_stock_summary`) was never retired, not that this audit or any recent phase built a new one.

## 3. Authoritative Stock Source

**Authoritative quantity**: `stock_levels.quantity`, confirmed by direct code read of every genuine stock-mutating function (`stockMovementsCreate`, `stockTransfersDispatch/Receive`, `_postFinishedTimberStock`, `procurementGoodsReceiptCreate`) — all read/write this table, wrapped in transactions in all but one case (§8).

**Authoritative cost**: `stock_catalog.unit_cost`, seeded from `products.standard_cost` at product creation and never touched again by any other code path — confirmed no drift-over-time risk exists (no `productsUpdate` function was found).

**Authoritative movement history**: `stock_movements`, append-mostly (soft-deletable via `stockMovementsDelete`, itself incomplete — §14).

**Competing/parallel calculation — CRITICAL, live-confirmed (Finding C-01)**: `mv_stock_summary`/`mv_stock_by_workshop` (materialized views, `db/migrate.js:337-481`, mirrored as the `STOCK_SQL` constant at `db/services/data.js:7-42`) compute "stock" independently as `produced (daily_logs + value_added_timber) − sold (sales_orders)`, with **zero reference to `stock_catalog`/`stock_levels`/`stock_movements`**. This is not presentation-only: `dispatchReview()` (`data.js:5388-5422`) validates whether a Logistics dispatch may proceed against this view, not against `stock_levels` — its own code comment acknowledges this was a deliberate compromise ("sales_orders/delivery_orders have no per-SKU stock_catalog link") that is now **stale**, since that link was added later by the Sawmill Phase 1 bridge.

**Live proof of drift**:
```sql
SELECT * FROM mv_stock_summary;          -- untreated_stock: 15
SELECT SUM(quantity) FROM stock_levels WHERE item_id IN (20,22);  -- 2
```
A **13-unit, 87% overstatement** in the exact system used to gate a real dispatch-approval decision today. This same symptom is independently visible on the Timber Inventory dashboard itself, which shows this "15" figure in its headline KPI card on the same screen where its own Finished Timber Flow table (fed from `stock_levels`) shows "2" (§19; corroborated independently by a second audit pass).

**Classification of every candidate calculation checked**:

| Mechanism | Classification |
|---|---|
| `stock_levels`/`stock_catalog` direct reads (Stock Catalog, Stock Levels page, Inventory Dashboard, Executive Dashboard's Stock Summary) | **Authoritative** |
| `stock_movements` ledger sums (reconciliation blocks, loss reports) | **Authoritative/derived, correct** |
| `stock_transfers` | **Derived workflow — legitimate** |
| `products.stock_item_id` bridge | **Derived/bridge — legitimate** |
| `mv_stock_summary`/`mv_stock_by_workshop`/`STOCK_SQL` | **Legacy, competing — used for a real gating decision (`dispatchReview`) and multiple dashboards (Sales page, general Dashboard, Logistics Dashboard)** |
| `_biPredictStockRunout` | **Authoritative, correct** |
| Timber Inventory's "Raw Log Inventory" figure | **A genuinely different tracked quantity (raw logs pre-stock_catalog), correctly scoped, not a competing calculation** |

## 4. Stock Catalog Audit

**CRUD** (`stockItemsList/Create/Update/Delete`, `stockCategoriesList/Create/Delete`, plus the older `logisticsList/Create/Update/Delete` alias onto the same table): confirmed full desktop/mobile/backend/API parity, no gap. Create validates `category`/`name`/`uom` required; no uniqueness check on `sku`, no `min_stock ≤ max_stock` bound check (Low).

**Governed delete reason gap (Medium, Finding M-01)**: Desktop's Stock Catalog delete flow never captures/forwards a deletion `reason` through IPC (`renderer/app.js:10234-10242`, `electron/preload.js:184`, `electron/main.js:463`), unlike Stock Movements delete and the mobile-api route, which both do. Weakens the audit trail for desktop-initiated catalog deletions specifically.

**Archive/Delete architecture — two mechanisms, one has a serious live-confirmed gap**:
- *Deactivation* (`active=false`) — **High, live-confirmed (Finding H-09)**: `stockItemsUpdate` never touches `stock_levels` on deactivation. Every read path filters `active=true`, so deactivated items' stock becomes completely invisible to every UI and report while the quantity itself is never zeroed. **Live**: 3 items, 30 units total, currently stranded this way.
- *Hard delete* (`stockItemsDelete`) — **Medium (Finding M-02)**: the only path in the codebase that permanently destroys `stock_movements` ledger rows (every other delete elsewhere is a governed soft-delete). Its usage guard (`_stockItemUsageCount`) omits 4 live RESTRICT-constrained FK tables (`products`, `resolution_records`, `quality_inspections`, `showroom_damage_reports`) — not reachable today only because the 3 live finished-goods items already have nonzero counts in the *checked* tables too, but a brand-new finished-timber item (auto-created at 0 stock) would crash ungracefully on an unhandled FK-violation instead of showing "cannot delete."

**Historical movements cannot become orphaned by archiving** — confirmed: `stock_movements.item_id` is FK RESTRICT (not CASCADE) against `stock_catalog`, and live orphan-detection confirms 0 movements reference a nonexistent catalog id.

## 5. Stock Level Audit

`stock_levels` is a **stored**, not calculated, value — updated transactionally alongside `stock_movements` in every properly-built write path. Confirmed transactional (single DB transaction, row-locked): `stockTransferApprove`, `stockTransfersDispatch/Receive/ReportDiscrepancy`, `_postFinishedTimberStock`, `procurementGoodsReceiptCreate`, `showroomDamageReportCreate`.

**Not transactional (Medium, Finding M-03)**: `stockMovementsCreate` (`data.js:3169-3234`) — the primary manual entry point — issues the `stock_movements` insert and the `stock_levels` upsert as two separate, unwrapped `pool.query()` calls. A mid-request failure between them leaves a permanently recorded movement with no corresponding balance change.

**Live reconciliation — 11/14 clean, 2 items show unexplained drift (Critical, Finding C-02)**: A full replay of every live `stock_movements` row against every live `stock_levels` row was performed. 11 of 14 rows match exactly. Two do not:

| Item | Warehouse | `stock_levels.quantity` | Reconstructed from ledger | Gap |
|---|---|---|---|---|
| Diesel Fuel (id 1) | Headquarters (2) | 1000 | 14 | **986** |
| Untreated 100x200x4m (id 20) | Gatare (3) | 2 | -8 | **10** |
| Untreated 100x200x4m (id 20) | Nyanza (4) | 0 | -6 | **6** |

Exhaustive elimination ruled out every application code path (no `'adjustment'` rows exist live; no soft-deleted/pending-deletion movements; no matching `audit_log` entries around the relevant timestamps; `stockItemsDelete`/`warehousesDelete` hard-deletes ruled out by row existence). **Conclusion: `stock_levels.quantity` was written directly against the database on at least these two rows, bypassing every application code path and the entire audit-logging system.** There is no database-level constraint, trigger, or generated-column relationship tying `stock_levels` to `stock_movements` — the "ledger drives balance" guarantee is a pure application-code convention with zero defense-in-depth. Whether this specific instance is QA/test-data contamination (plausible, given the environment) or not, the architecture itself is now proven capable of silent, unrecoverable, unaudited drift.

## 6. Stock Movement Audit

Live movement-type matrix (`SELECT movement_type, count(*) FROM stock_movements GROUP BY movement_type`):

| Type | Live count | Source→Dest | Qty semantics | Cost captured | Audit | Approval |
|---|---|---|---|---|---|---|
| `in` | 9 | none→warehouse | delta + | optional (usually null — see §12) | yes | none |
| `transfer_out` | 7 | warehouse→(transit) | delta −, floored 0 | not set | yes | transfer-level |
| `transfer_in` | 6 | (transit)→warehouse | delta + | not set | yes | transfer-level |
| `out` | 5 | warehouse→none | delta −, floored 0 | optional | yes | none |
| `transfer` (retired) | 1 | legacy, no new creation | delta both legs | optional | yes | yes (`approval_status`) |
| `adjustment` | 0 live | sets warehouse balance | **absolute SET, not delta** | n/a | yes, reason mandatory | **none** |
| `return` | 0 live | warehouse (+) | delta + | optional | yes | none |
| `loss` | 0 live | memo-only, no re-touch of `stock_levels` | shortfall qty | inherited | yes, enumerated reason mandatory | auto (closes transfer) |

No fabricated types — this is the exact, complete, live-and-in-code type set. The `adjustment` type's absolute-SET-not-delta semantics, combined with sharing the exact same `quantity` column every delta type uses, is flagged as **Critical (Finding C-08)** in §16 — it is a landmine, not yet triggered live (0 rows exist), but fully armed.

## 7. Procurement → Inventory

**Chain confirmed correct and fully transactional**: `procurementGoodsReceiptCreate` (`data.js:18593-18672`) pairs a `stock_levels` upsert with a `stock_movements` insert in one transaction for every PO line with a linked `stock_item_id`. **Live proof**: all 4 live goods receipts reconcile exactly against their PO lines (5/5, 5/5, 2/2, 2/2).

**Findings**:
- **Medium (Finding M-04)**: No over-receipt guard — `quantity_received` is never validated against the PO line's outstanding quantity. A user could record receipt of 500 units against a 5-unit line; it would post correctly-ledgered but factually wrong stock.
- **Medium (Finding M-05)**: `unit_cost` is never captured on the goods-receipt `stock_movements` row despite the PO line having exactly that value available in the same transaction (live: all 4 rows have `unit_cost=NULL`). `stock_catalog.unit_cost` is also never updated by a goods receipt.
- Rejected-at-receipt quantity correctly never touches stock (design confirmed intentional — it's a supplier-scoring data point, not something that entered the business).
- Partial receipt / shortage closure (`procurementPoCloseWithShortage`) is a real, fully-audited, correctly multi-stage approval workflow — confirmed correct.

## 8. Harvest → Raw Log Inventory

`Harvested = Transported + Waste` is enforced **prospectively** (a new `log_transport` entry is blocked if it would exceed harvested-minus-already-transported-minus-wasted), not as a closed point-in-time identity — confirmed correct design, live: 685 harvested, 445 transported, 0 waste, 240 correctly reported as "waiting for transport" (not a discrepancy).

**High, live-confirmed (Finding H-03)**: The critical question — "does Transported-but-not-yet-Received automatically become available for Sawmill production?" — resolves to **the Sawmill intake gate and the Log Transport gate are two independent formulas drawing from the same harvested pool, neither aware of the other.** `_rawLogAvailableStock()` (the function gating Sawmill's `logs_received` field) computes `harvested − received − wasted`, **never subtracting `qty_transported` at all**. Live: this formula currently reports 654 logs "available" for sawmill intake, while only 445 have ever actually been recorded as physically transported. A sawmill operator could log receipt of logs that were never transported, up to the harvested-minus-waste ceiling, with no cross-check against the transport ledger. No FK or reference links a `daily_logs.logs_received` entry back to a specific `log_transport` batch — confirmed via code read this is a deliberate "draws from whatever is in the yard" design, but the implementation extends further than intended (no linkage at all, not just "not same-day").

## 9. Sawmill → Finished Timber

**Chain structure confirmed well-designed**: `productionOffcutCreate → Decide → RecordRecovery (Resaw) → qualityInspectionCreate/vatQualityInspectionCreate`, with a hard quantity ceiling enforced server-side at every step (offcut ≤ recorded waste; recovered ≤ offcut; approved ≤ recovered; rejected = recovered − approved) — structurally impossible to fabricate volume at any single step. The code **self-audits**: `productionReconciliation` directly implements *Intake = Finished + Recovered + True Waste* as a live per-batch query.

**Live data caveat, stated per the audit's own instruction not to fabricate**: `production_offcuts`, `quality_inspections`, `rejection_holds`, and `resolution_records` all currently have **0 live rows** — this chain is verified thoroughly by code inspection but has never been exercised end-to-end with real transactions in this database, so no live "does the math add up" reconciliation is possible for it. Direct (non-offcut) sawmill production, by contrast, has live data and reconciles cleanly (daily_log #22 produced 2 units, matched exactly by stock_movement #113).

**High (Finding H-05)**: None of `productionOffcutCreate/Decide/RecordRecovery`, `qualityInspectionCreate`, or `vatQualityInspectionCreate` call `isWorkshopRestricted()` anywhere — confirmed by exhaustive grep. Each trusts the workshop stamped on the referenced record rather than checking it against the caller's own workshop. A `sawmill-leader` at Gatare could call `qualityInspectionCreate`/`productionOffcutRecordRecovery` against a Nyanza offcut, posting approved stock into Nyanza's warehouse on Gatare's authority. Live-exploitable: all the roles that qualify (sawmill-leader/-supervisor, vat-leader/-supervisor, supervisor) are genuinely workshop-restricted in `role_definitions` today.

**Medium (Finding M-06)**: A second live reconciliation-identity failure was found specifically on Finished Timber (item 20): `ledger_total_in=2, ledger_total_out=16, current_stock=2`, expected `2−16=−14 ≠ 2`. Root cause traced in §19 (converges with §16/§17's findings) — most likely QA/test-data artifact, but demonstrates the reconciliation check has no automated alerting; it only runs as an ad hoc query inside the Timber Inventory screen.

## 10. Quality / Rejection / Resolution → Inventory

**Confirmed correct, no double-counting possible by construction**: only the **Approved** quantity from Quality Inspection is ever posted to `stock_levels`; **Rejected** quantity is only ever written to `rejection_holds`, never posted as sellable stock in the first place — a rejected item cannot simultaneously be available good stock because it was never let in as good stock to begin with.

**All 6 Resolution Engine outcomes verified against code, all correct**:

| Destination | Stock effect |
|---|---|
| Rework | No stock post — re-enters Resaw→QC pipeline as a new row; cannot bypass QC |
| Downgrade | Posts full qty **in** to a different, human-selected, already-catalogued product |
| Return to Inventory | Posts full qty **in** to the original product; requires supervisor+ role and mandatory reason |
| Firewood / Scrap Sale / Internal Use | Posts qty **in** to an auto-vivified "Waste Byproduct" catalog item |
| Disposal | **Correctly posts nothing to stock** — explicit exclusion, only an audit record written |
| Other | Same as Disposal |

**Findings**:
- **High, live-exploitable, independently corroborated by two audit passes (Finding H-04)**: `resolutionCreate` — the single function handling all 4 source types (harvest_waste, production_offcut, rejected_timber, showroom_damage) — has **no `isWorkshopRestricted` check at all**, unlike its three sibling `rejectionResolve*` functions, which were already fixed for exactly this gap in an earlier phase. It also lets the caller freely supply/override `warehouse_id` with no cross-check. Live-exploitable by every workshop-restricted production role (supervisor, sawmill-leader/-supervisor, vat-leader/-supervisor, showroom-staff).
- **Medium (Finding M-07)**: Disposal's supervisor-tier approval requirement only applies when `source_type === 'rejected_timber'` — disposal of harvest_waste, production_offcut, or showroom_damage material carries no elevated approval at all.

## 11. Warehouse Damage

**Confirmed correct design**: `showroomDamageReportCreate` immediately deducts an `'out'` stock movement **at report time** (not at resolution time), inside a transaction with a `FOR UPDATE` lock checking sufficient stock — correctly preventing damaged stock from remaining sellable/double-countable between report and resolution. Resolution only routes the already-removed material to its final destination via the same shared Resolution Engine used by every other source type — confirmed only one write-off mechanism exists company-wide, not a parallel Showroom-specific one.

**Critical, live-exploitable, independently confirmed by two audit passes (Finding C-11)**: `showroomDamageReportCreate`/`showroomDamageReportsList` have **no `isWorkshopRestricted` check at all**, despite operating on `warehouse_id`-scoped records. Both `supervisor` (Gatare) and `showroom-staff` (Showroom) — genuinely workshop-restricted, live roles — pass this function's gate. A Gatare supervisor can file or view a damage report (with immediate stock deduction) against Showroom's or Nyanza's stock, and vice versa. This is the single most severe live-exploitable Workshop Isolation gap found in the entire audit, because it directly and immediately removes stock from a warehouse the caller doesn't belong to.

**Medium (Finding M-07, restated)**: same Disposal approval-tier gap as §10 applies to showroom-damage-sourced disposal.

Covers Gatare (3), Nyanza (4), Showroom (5), and Headquarters (2) — all 4 live warehouses confirmed.

## 12. Gatare / Nyanza / Showroom

Full flow verified in source, live warehouse IDs confirmed (3=Gatare, 4=Nyanza, 5=Showroom):

1. **Gatare → direct sale AND transfer to Nyanza** — both paths confirmed, same generic mechanisms (`salesCreate`/`stockTransfersCreate`), modeled explicitly in `timberInventoryList` as parallel `gatare_qty` columns.
2. **Nyanza → direct sale AND Value-Added Production** — `vatInboundList` reads received Nyanza transfers as VAT's intake pool; `valueAddedTimberCreate` validates against a real "budget" ceiling (received minus already-used). Nyanza `stock_levels` for the same catalog items is independently sellable.
3. **VAT output → Value-Added Inventory → Showroom** — confirmed by source (`vatQualityInspectionCreate` resolves the VAT entry to a `products` row and posts approved qty via the same generic bridge), but **Medium (Finding M-08)**: the live `products` catalog has zero rows with `sub_type IN ('Kiln-dried','CCA-treated')` — any VAT quality inspection approved today would resolve to no product match and **never post to stock**, silently blocking the pipeline. This is a catalog-completeness gap, not a code defect.
4. **Showroom damage/condition-check → resolution** — confirmed correct design (§11), zero live transactions to empirically verify against.

**Stated per the audit's own instruction**: the flow is fully implemented in source with correct branch points and no structural contradiction to the intended design; it cannot be *empirically* confirmed end-to-end because `value_added_timber`, `quality_inspections`, and `showroom_damage_reports` all currently have zero live rows.

## 13. Sales → Inventory

This is the section with the audit's most severe findings, all live-relevant despite `sales_orders` currently having 0 rows (the evidence is in the *ledger*, not the orders table — see §19).

- **Critical (Finding C-03)**: `salesCreate`'s required-field check uses a JS falsy test on `quantity` — a **negative** quantity passes it. No other guard exists. Traced through `_postFinishedTimberStock`: a negative-quantity "sale" recorded as `'out'` actually **increases** `stock_levels` while poisoning every ledger sum that assumes `'out'` rows are positive.
- **Critical (Finding C-04)**: The availability check runs as a plain, unlocked query *before* the transaction begins; the actual deduction happens later with no row lock in between (contrast: `stockTransfersDispatch` does the equivalent check *inside* the locked transaction). Two concurrent sales for the last unit can both pass and both "succeed" — the second is recorded as a full successful deduction for stock that didn't exist, silently floored to 0 rather than rejected.
- **Critical (Finding C-05)**: Three independent code paths (`salesUpdate`, `salesDelete`/purge, `_applyDeliveryOrderPOD`/`salesCloseShort`) all handle a scenario that should return stock — and **none of them do**. `salesUpdate` changes quantity/product via a plain UPDATE with zero stock-movement reversal. `salesDelete` soft-deletes the order only. `_applyDeliveryOrderPOD`/`salesCloseShort` contain the literal comment *"rejected = back to stock"* / *"Return the undelivered remaining quantity back to stock"* — but only increment a counter column; neither calls the stock-posting function. **Contrast directly with `stockMovementsDelete`, which explicitly reverses `stock_levels` for its own movement types** — Sales has no equivalent anywhere.
- This is not theoretical: §19 traces exactly this failure mode live, quantified, in the production ledger today.
- **Medium (Finding M-09)**: `sales_orders.order_number` has no unique constraint (contrast: `delivery_orders.order_number` does) and no application-level duplicate check.
- **Medium (Finding M-10)**: COGS is always computed from **current** `products.standard_cost`, never a cost-frozen-at-time-of-sale — a disclosed, intentional limitation of the flat-cost model, not a hidden defect, but means historical COGS silently changes if Standard Cost is later revised.
- **Confirmed correct**: Negotiated/Default Selling Price and Standard Cost are correctly, consistently kept separate everywhere — no code path was found confusing the two.

## 14. Internal Consumption

Every consumption path that **does** touch `stock_catalog`/`stock_levels` produces a proper `stock_movements` row — no silent direct write was found anywhere in the codebase (exhaustive grep of all 12 `stock_levels` write call sites, each paired with a movement insert or a legitimate zero-balance seed).

**High (Finding H-07)**: Fuel (`fuel_logs`, `machine_fuel_logs`) and maintenance spare-parts consumption are **structurally disconnected from the stock ledger entirely** — neither table has a `stock_item_id` column, and neither creation function touches `stock_movements`/`stock_levels`. **Live evidence this is a real, already-manifesting gap**: a manually-entered generic `'out'` movement (`reference: 'Fuel issued 2026-06-21'`) exists in the ledger, proving someone had to manually compensate for the missing automatic linkage. Two independent fuel-tracking subsystems exist (warehouse Diesel stock vs. per-machine fuel logs) with zero code-level linkage between them — consistency depends entirely on manual discipline.

**Medium (Finding M-11)**: Generic manual `'out'` movements (used, per the above, as the *de facto* consumption-recording mechanism) require no reason — only `'adjustment'` does.

## 15. Adjustments

**Mechanism**: `stockMovementsCreate` with `movement_type='adjustment'` is the sole formal adjustment path.

- **Who can create**: any role holding `stock-movements` (admin, ceo, operations, logistics, storekeeper, storekeeper-assistant, logistics-officer — live-confirmed).
- **Who approves**: **nobody** — **High (Finding H-08)**. Contrast directly with the sibling `'transfer'` movement type in the same function, which explicitly defers to a second-approver `approval_status='pending'` gate; `'adjustment'` writes to `stock_levels` immediately and unconditionally once a reason string is present.
- **Reason required**: yes, enforced, the only real control.
- **Before/after preserved**: no — the movement row stores only the new absolute value, not the prior quantity (reconstructable only by replaying surrounding ledger history, not from the record itself).
- **Immutability**: not immutable (`stockMovementsDelete` can soft-delete any movement, gated by the standard governance/ownership-window rules) — **and critically, deleting an adjustment does not reverse `stock_levels` at all**, because `stockMovementsDelete`'s reversal logic has no branch for `'adjustment'` (Medium, Finding M-12). Arguably correct given there's no well-defined "undo" for an absolute-set operation without knowing the prior value, but it means an adjustment, once made, cannot be cleanly reversed even by an admin.
- **Workshop isolation**: correctly applied on create.
- **Critical (Finding C-08, direct answer to the audit's core question)**: the mechanism **overwrites** `stock_levels.quantity` to an absolute value while storing that same absolute number in `stock_movements.quantity` — the identical column every delta-based movement type (`in`/`out`/`transfer_in`/`transfer_out`) uses to mean "amount added or removed." Any reconciliation query (including this audit's own, and the app's own `ledger_total_in`/`ledger_total_out` identity) that treats `stock_movements.quantity` uniformly across types will silently miscompute the instant a single adjustment exists. **Zero adjustment rows exist live today — this is a live, armed, not-yet-triggered landmine, not a currently-manifesting error.**
- **Direct answer to "could this become an unrestricted stock-edit backdoor?"**: **Partially yes.** Any of 7 roles can, in one unapproved call, set any warehouse's stock for any item to any arbitrary non-negative number, with only a free-text reason required and no second signature. It is not silent (audited, reasoned, visible in trash) but is the one high-impact stock action in the entire codebase with no approval step, in a system where transfers, material requests, and even sales cancellation (nominally) require one.

## 16. Costing & Valuation

Live `stock_catalog` (10 items, 7 active): **no null, zero, or negative `unit_cost` found on any active item.** The 3 items with low/placeholder-looking costs are inactive QA test artifacts.

**Critical, unchanged from an earlier phase's own disclosure (Finding C-09)**: all 3 live `products` rows (the only real catalog products) have their `standard_cost_approved_by`/`default_price_approved_by` fields populated with the literal string `"PENDING APPROVAL (placeholder — ... QA, not yet Finance/Management-approved)"` — not a real approver name. The enforcement mechanism (mandatory, dated approval fields) works correctly; **the values satisfying it are still placeholders, exactly as flagged before.** Every financial figure in this report, and in the app's own dashboards, is built on these unapproved numbers.

`unit_cost`/`standard_cost` correctly kept in lockstep at creation, no drift-over-time path found (no `productsUpdate` exists).

Valuation after **Transfer**: correct by construction (same item, same cost, no revaluation needed). After **Rework**: correct — nothing was ever posted for rejected material, so nothing to revalue. After **Downgrade** — **Medium (Finding M-13)**: the downgraded quantity inherits the *target* product's own existing cost; the value destroyed by the downgrade (original cost − target cost) is never captured as a recorded loss anywhere. After **Disposal**: confirmed correct — intentionally zero stock impact, but the write-off value is still captured in `resolution_records` for reporting.

## 17. Timber Volume Reconciliation

Attempted using only real live data, per the audit's explicit instruction not to fabricate figures:

- **Harvested − Waste = Transportable**: trivially reconciles (685 − 0 = 685) only because zero waste has ever been recorded — **not a confirmed-clean result, a reporting limitation** (the identity has never actually been tested against a nonzero waste value).
- **Transported − Received = Transit/Outstanding**: 685 harvested − 31 received = 654 "in transit/inventory" — a **reporting limitation** (sparse data: only 2 daily_logs rows exist against 4 harvest batches), not evidence of loss. (Note: this 654 figure is the same one flagged as a validation gap in §8 — the number itself isn't wrong, but nothing currently stops it from becoming wrong.)
- **Sawmill Intake = Finished + Recovered + Waste**: not mechanically computable from live data — the app's own relative identity (`productionReconciliation`) filters to `timber_waste > 0`, and both live `daily_logs` rows have `timber_waste=0`, so the function currently has zero rows to reconcile. **Reporting limitation.**
- **Finished Timber − Sales − Transfers − Consumption − Damage − Disposal = Remaining, vs. live `stock_levels`**: **Critical, live, confirmed (this is Finding C-06 — see §19 for the full root-cause trace)**: `ledger_total_in=2, ledger_total_out=16, expected=−14, actual current stock=2, mismatch=−16`. **Not reconciled**, live, today.

## 18. Financial Reconciliation

`Opening + Inbound + Production − COGS − Loss/Disposal ± Adjustments = Closing`, attempted with only real figures:

- Closing Value (Finished Timber/Poles, live): 2 units × 10,000 = **20,000 RWF**.
- Inbound Value: 1 live `'in'` movement, 2 units × 10,000 = **20,000 RWF**.
- COGS **as the app's own dashboard currently computes it** (joined through `sales_orders`, which has 0 rows): **0 RWF**.
- COGS **as the ledger actually records it** (16 units of `'out'`/"Sale" movements × 10,000 standard cost): **160,000 RWF** — **Finding C-07**, entirely invisible to the app's own reporting because the `sales_orders` rows that would feed it no longer exist.
- Loss/Disposal Value, Adjustments: both **not evaluable** (zero live rows) — stated plainly, not assumed zero.

**Classification per the audit's required taxonomy**: **missing movement** (the reversal that should exist on sale cancellation/edit/rejection is never created — a real, general code gap, confirmed in §13) **compounded by a data-integrity break** (the `sales_orders` rows were removed outside the normal application delete/purge path — no matching audit_log entries exist for a legitimate delete or purge of them). The *formula* is sound; it fails because the inputs it depends on were allowed to become inconsistent by a confirmed code gap.

## 19. Live Reconciliation — Cross-Agent Convergent Finding (Synthesis)

This section did not exist as a single item in any one research pass — it is the product of cross-referencing three independent findings that converged on the same underlying event from three different angles, which is the strongest form of evidence this audit produced.

**What three independent, differently-scoped investigations each found, independently:**

1. **Core-architecture pass**, running pure orphan/duplicate detection with no hypothesis about sales at all, found **two literal duplicate `stock_movements` row-pairs** for item 20 (ids 94/99, both `qty=5, ref='QA-PH3-A'`, ~20 minutes apart; ids 97/102, both `qty=3, ref='QA-PH3-B'`, ~20 minutes apart) — 16 units total, all tagged `notes: 'Sale — Untreated 100x200x4m'`.
2. **Permissions/reports pass**, running the Timber Inventory dashboard's own built-in self-reconciliation query independently, found it **currently failing in production**: `ledger_total_in=2, ledger_total_out=16, current=2, expected=−14, mismatch=−16` — and separately found the dashboard's own headline KPI card (15, from `mv_stock_summary`) contradicts its own Finished Timber Flow table (2, from `stock_levels`) on the same screen.
3. **Distribution-chain pass**, working forward from Sales code-review (finding no-reversal-on-cancel as a general code defect first, before looking at live data), independently queried `sales_orders` and `stock_movements` and found the identical 16-unit `'out'` figure, then **root-caused it**: the `sales_orders` rows that originally justified these 5 `'out'` movements (all with matching `audit_log` "Created order QA-PH3-A/B..." entries) **no longer exist in the database**, and — critically — traced that no code path in the entire Sales module would have reversed the stock deduction even if they'd been deleted through the normal application flow.

**Synthesis**: The 16-unit gap is not three separate problems — it is **one event** (a QA test cycle that created ~8 real units of sale-driven stock deduction, which then got duplicated to 16 via a double-post, whose owning `sales_orders` rows were subsequently removed directly at the database level rather than through the app's own delete/purge path) **exposed by a real, general code defect** (Sales has no reversal-on-cancel/edit/reject anywhere) that means this exact failure mode — a sale being undone in any way — would produce an identical, permanent, silent ledger break **in production, with real data**, not just in this QA-contaminated instance. The `mv_stock_summary` legacy-system drift (§3) is a **separate, second** contributing factor to why the Timber Inventory dashboard looks wrong, not the same root cause — both are live, both are real, and this audit recommends they be tracked and fixed as two distinct findings (C-01 and C-06/C-07) even though they present on the same screen.

**Direct answer to this audit's Success Criteria question, for this specific product/location**: no, the quantity currently **cannot** be reconciled from source to disposition — not because inventory is missing, but because the ledger records more sold than was ever produced, and the system that should explain why (the orders that drove those sales) no longer exists to be checked.

## 20. Permission Matrix

Full live `role_definitions.permissions` matrix for every Stock/Inventory page across all confirmed roles — see the Permissions/Parity audit's Workstream 18 table (preserved verbatim as the authoritative source; reproduced in condensed form):

| Role | stock-items | inventory | stock-movements | stock-transfers | material-requests |
|---|---|---|---|---|---|
| admin / ceo | ✅ | ✅ | ✅ | ✅ | ✅ |
| operations | ✅ | ✅ | ✅ | ✅ | ✅ |
| logistics / logistics-officer | ✅ | ✅ | ✅ | ✅ | ✅ |
| storekeeper | ✅ | ✅ | ✅ | ✅ | ✅ |
| storekeeper-assistant | ⛔ | ⛔ | ✅ | ⛔ | ✅ |
| supervisor | ⛔ | ⛔ | ⛔ | ✅ | ✅ |
| sawmill-leader | ⛔ | ⛔ | ⛔ | ⛔ | ✅ |
| sawmill-supervisor | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ |
| vat-leader | ⛔ | ⛔ | ⛔ | ✅ | ✅ |
| vat-supervisor | ⛔ | ⛔ | ⛔ | ✅ | ⛔ |
| poles-leader | ⛔ | ⛔ | ⛔ | ⛔ | ✅ |
| poles-supervisor | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ |
| harvesting-leader / -supervisor | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ |
| showroom-staff | ⛔ | ⛔ | ⛔ | ✅ | ⛔ |
| mechanician | ⛔ | ⛔ | ⛔ | ⛔ | ✅ |

**Findings**:
- **Medium (Finding M-14)**: only the "-leader" variant of each workshop production role holds `material-requests`; the matching "-supervisor" variant does not; Harvesting has **neither** tier able to submit one, unlike every peer workshop.
- **Medium (Finding M-15), live-confirmed**: `mobile-api/routes/stockTransfers.js`'s hardcoded `ACT_ROLES` excludes `showroom-staff`/`vat-leader`/`vat-supervisor` even though live `role_definitions` confirms all three hold `stock-transfers` and the backend's sole gate is that exact permission — these 3 roles are blocked from the mobile Stock Transfers feature entirely.
- **Medium, exactly the risk this workstream warns about (Finding M-16)**: Desktop hardcodes the identical narrower `canAct`/`canApprove` role sets as mobile's `ACT_ROLES` — but the **backend does not independently enforce this narrower tier**; it only checks the broader `stock-transfers` permission. A `showroom-staff`/`vat-leader`/`vat-supervisor` user could call the write functions directly, bypassing hidden buttons on both platforms, and the backend would accept it. **A hidden button is not backend enforcement, confirmed as a real gap here, not merely a hypothetical risk.**
- **High, live-confirmed (Finding H-01)**: `mobile-api/routes/stock.js`'s `INVENTORY_ROLES` excludes `ceo`, with an in-code comment claiming CEO never holds `inventory` — live query proves this false (`ceo` does hold it). CEO is 403'd on mobile Stock Levels/Inventory Dashboard/Intelligence despite full desktop access and full backend authorization.
- **Low (Finding L-01)**: mixed `mustRole`/hardcoded-array permission gating on showroom-damage and disposal/downgrade paths — a drift risk, not a current defect.

## 21. Workshop Isolation

`isWorkshopRestricted(user) = user.workshop_id != null && !['admin','ceo','operations','logistics'].includes(user.role)` — confirmed unchanged, matches the approved architecture. **Not redesigned or touched by this audit in any way**, per the governing rule.

**Live-confirmed this genuinely matters**: `storekeeper` (workshops 3&4), `storekeeper-assistant` (3), `supervisor` (3), `showroom-staff` (5), and every workshop production role are real, live, workshop-restricted users today — not a theoretical edge case.

**Confirmed correctly isolated** (re-verified against current source, not assumed from history): the **entire** Stock Transfer lifecycle (read + all 6 write actions — list, create, approve/reject, dispatch, receive, report-discrepancy, dispatch-history), Material Requests (list/create/approve, including the supervisor own-workshop check), `stockItemsList`/`inventoryList`/`inventoryDashboard`/`stockMovementsList`, `harvestWasteList`, `rejectionHoldsList` and its 3 sibling resolve-actions (`rejectionResolveRework/Downgrade/ReturnToInventory`). `showroomInventoryList`'s hardcoded scope to warehouse 5 and `stockItemsForDropdown`'s unrestricted lookup are both confirmed intentional, documented design — not gaps.

**Gaps found (all re-verified against current source, several independently corroborated by two separate audit passes)**:

| Finding | Function | Severity | Corroboration |
|---|---|---|---|
| C-10 | `stockMovementsDelete` — no isolation check at all | **Critical** | Single-source, live-exploitable |
| C-11 | `showroomDamageReportCreate`/`List` — no isolation check | **Critical** | **Independently found by 2 audit passes** |
| H-04 | `resolutionCreate`/`resolutionsList` — no isolation across entire Resolution Engine | **High** | **Independently found by 2 audit passes** |
| H-05 | Entire Sawmill offcut/resaw/QC chain — no isolation | **High** | Single-source, structurally certain |
| M-02b | `stockItemsDelete` — no isolation on a company-wide catalog delete | **Medium** | Single-source (flagged for review, not asserted wrong — catalog isn't inherently workshop-owned) |
| M-17 | `harvestWasteCreate` — no isolation on write (sibling read function is correctly isolated) | **Medium** | Single-source; low live risk today (only one active harvesting workshop) but structurally real |
| L-02 | `pushNotification` broadcasts stock-transfer/material-request events with no workshop filter | **Low** | Informational disclosure only — the underlying records remain correctly isolated |

**Intentionally company-wide workflows confirmed to remain so, correctly**: CEO/Admin/Operations/Logistics's blanket exemption from workshop restriction is working exactly as designed everywhere it was checked — this audit found no case of it being incorrectly narrowed.

## 22. Desktop / Mobile Parity

| Capability | Backend | Mobile-API | Desktop | Mobile |
|---|---|---|---|---|
| Stock Catalog CRUD | ✅ | ✅ matches | ✅ | ✅ — **full parity, no gap** |
| Stock Categories | ✅ | ✅ | ✅ | ✅ |
| Stock Levels/Inventory Dashboard | ✅ (incl. CEO) | ⚠ **excludes CEO (H-01)** | ✅ incl. CEO | ⚠ **CEO 403 on mobile only** |
| Stock Movements | ✅ | ✅ matches | ✅ | ✅ |
| Stock Transfers full lifecycle | ✅ (broader) | ⚠ excludes showroom-staff/vat-leader/-supervisor (M-15) | Same narrower UI convention (M-16) | Same narrower convention |
| Material Requests | ✅ | ✅ (defense-in-depth guard matches backend) | ✅ | ✅ |
| Showroom damage + resolution | ✅ | ✅ | Inline on parent pages | Inline — **same convention both platforms, intentional parity** |
| Rejection Holds (rework/downgrade/return) | ✅ | ✅ | Inline | Inline |

**Additional findings**:
- **Medium (Finding M-08, restated)**: mobile's Resolution Engine explicitly blocks warehouse-requiring destinations (Firewood/Scrap/Internal Use) with "please use desktop" — a self-documented, deliberate capability gap, not hidden.
- **Positive, worth explicitly preserving**: because Electron/IPC and the mobile REST layer call the *exact same* `data.js` functions for every capability above, calculated figures (available stock, remaining-to-dispatch, discrepancy qty) are computed identically by construction on both platforms — there is no divergent-calculation risk between platforms anywhere in this module.

## 23. Notifications

Per the audit's instruction, verified against the existing Enterprise Completion Phase 5 notification-routing architecture (`NOTIFICATION_ROUTES` in `renderer/app.js` and `mobile/src/utils/notificationRouting.ts`) — **no second routing system was built or recommended.**

| Producer | relatedModule | Desktop route | Mobile route |
|---|---|---|---|
| Stock Transfer create/approve/dispatch/receive/discrepancy | `stock_transfers` | ✅ full record deep-link | ✅ full record deep-link |
| Material Request create/approve (+ linked transfer) | `material-requests` | Page-only (closure-scoped, documented limitation) | **Not mapped** |
| Harvest Waste recorded | `harvest_waste` | Page-only | **Not mapped** |
| Resolution Engine (waste resolved) | `resolution_records` | Page-only (imprecise — Sawmill/VAT shared, documented) | **Not mapped** |
| Rejection Downgrade/Return | `rejection_holds` | Page-only | **Not mapped** |
| Showroom Damage reported | `showroom_damage_reports` | Page-only | **Not mapped** |

**Medium (Finding M-18)**: 5 of 6 Stock/Inventory notification families are dead-end on mobile (no navigation at all) vs. at-least-page-level on desktop — a real, but honestly self-documented (both registries' own code comments explain the omission), capability gap.

**Low (Finding L-03)**: `showroomDamageReportCreate`/`resolutionCreate` notify only `admin/ceo/operations/supervisor` — never the roles who actually hold the module's own permission and are the natural stakeholders (`showroom-staff`, the affected workshop's own leader) — inconsistent with `harvestWasteCreate`, which does correctly include `harvesting-leader`.

## 24. Reports & Dashboards

Every Stock/Inventory report/dashboard was traced to its computation source:

| Report | Source |
|---|---|
| Stock Catalog / Stock Levels page, Inventory Dashboard, Executive Dashboard Stock Summary | **Direct `stock_levels`, real-time — all three guaranteed to agree with each other** |
| Timber Inventory headline "Total Stock" KPI | **`mv_stock_summary`** — see C-01 |
| Timber Inventory "Finished Timber Flow"/Inventory Value | Direct `stock_levels` |
| Timber Inventory reconciliation block | `stock_movements` ledger vs `stock_levels` — see C-06 |
| Sales page, general Dashboard, Logistics Dashboard, Dispatch approval | **`mv_stock_summary`** |
| Timber Inventory "Raw Log Inventory" | A genuinely different quantity (pre-catalog raw logs) — correctly scoped |

**This table is itself the direct evidence for Finding C-01**: two structurally different, un-reconciled inventory models are both live in production today, feeding different screens, with no automated check flagging when they diverge — which, per §3, they currently do, by 87%.

## 25. CRUD/Lifecycle Completeness

| Entity | Create | Read | Update | Delete | Archive | Approve | Transfer | Receive | Consume | Adjust |
|---|---|---|---|---|---|---|---|---|---|---|
| stock_catalog | ✅ | ✅ | ✅ | ⚠ M-02 | ⚠ H-09 (stranding) | n/a | n/a | n/a | n/a | n/a |
| stock_levels | (seeded) | ✅ | (via movements) | n/a | n/a | n/a | ✅ | ✅ | ✅ | ⚠ C-08/H-08 |
| stock_movements | ✅ | ✅ | n/a | ⚠ M-12 (incomplete reversal) | n/a | (transfer-type only) | n/a | n/a | n/a | n/a |
| warehouses | ✅ | ✅ | ✅ | ⚠ H-10 (crashes) | n/a | n/a | n/a | n/a | n/a | n/a |
| stock_transfers | ✅ | ✅ | n/a | n/a | n/a | ✅ | ✅ | ✅ | n/a | n/a |
| material_requests | ✅ | ✅ | n/a | n/a | n/a | ✅ (⚠ H-11) | n/a | n/a | n/a | n/a |
| showroom_damage_reports | ✅ | ✅ | n/a | n/a | n/a | (resolution only) | n/a | n/a | n/a | n/a |

No dead/orphaned backend functions were found in this module (every function located has at least one live caller). No dead UI was found beyond the desktop reason-capture gap (§4).

## 26. Department Collaboration (Synthesis)

Mapping what enters/leaves inventory, who authorizes it, which movement/notification/report reflects it, per department:

| Department | Enters inventory | Leaves inventory | Authorizes | Movement | Notification | Report |
|---|---|---|---|---|---|---|
| **Procurement** | Goods Receipt (`in`) | — | storekeeper/procurement-officer/-manager/admin/ceo | `in`, `unit_cost` **not captured** (M-05) | none dedicated | Inventory Dashboard |
| **Inventory/Logistics** | Transfers in, Adjustments | Transfers out, Adjustments, manual `out` | storekeeper(-assistant), logistics(-officer), admin/ceo/operations | `transfer_in/out`, `adjustment` (⚠ no approval, H-08) | ✅ deep-linkable | Stock Dashboard (authoritative) |
| **Harvesting** | — (raw logs, pre-catalog) | Transported logs (to Sawmill, uncoupled — H-03) | supervisor, harvesting-leader (no `material-requests` — M-14) | n/a (raw-log tables, not `stock_movements`) | none | Raw Log Inventory (separate model) |
| **Sawmill** | Production `in`, QC-approved `in` | Rejection (held, not stock), Waste (routed to Resolution Engine) | sawmill-leader/-supervisor (⚠ no workshop isolation, H-05) | `in` | Rejection notif (page-only mobile) | Timber Inventory (⚠ split-source, C-01/C-06) |
| **VAT** | QC-approved `in` (⚠ blocked today, M-08) | Rejection (held) | vat-leader/-supervisor | `in` | Rejection notif | Timber Inventory |
| **Workshops (Mechanician/Maintenance)** | — | Fuel, spare parts (⚠ **disconnected from ledger**, H-07) | mechanician | manual, uncoupled | none | Fuel logs (separate system) |
| **Sales/Showroom** | Rejected-delivery/close-short quantity (⚠ **never actually returns**, C-05) | Sale `out` (⚠ **unvalidated/unlocked/unreversed**, C-03/C-04/C-05) | sales, sales-staff, showroom-staff, admin/ceo/operations/supervisor | `out` | none dedicated | COGS/valuation (⚠ built on unapproved costs, C-09; broken by C-05/C-07) |
| **Showroom (damage)** | — | Damage `out` (at report time, correct design) | timber-inventory/sales page holders, admin/ceo/operations/supervisor (⚠ no workshop isolation, C-11) | `out` | ✅ page-only desktop, ⛔ mobile (M-18) | — |
| **Finance** | (would consume Standard Cost approvals) | — | (no real approver yet, C-09) | n/a | n/a | Every valuation/COGS figure in this report |

**Work-completion assessment (the brief's stated goal)**: Procurement→Inventory and Inventory→Transfers→Receiving are genuinely complete, correctly authorized, and correctly reflected end-to-end. Harvest→Sawmill has a real hand-off validation gap (H-03). Sawmill/VAT→Finished Inventory is structurally complete but workshop-isolation-incomplete (H-05) and untested live. **Sales is the one department-to-department hand-off that is not actually complete** — it can remove stock but cannot correctly put it back under any circumstance, which is the single largest gap in "true single source of truth for physical inventory" found by this audit.

## 27. Data Integrity & Orphan Detection

Full live sweep (all queries `SELECT`-only against the complete, small live table set):

| Check | Result |
|---|---|
| Movements referencing deleted/nonexistent stock_catalog id | **0 — clean** |
| Movements referencing deleted/nonexistent warehouse id | **0 — clean** |
| stock_levels referencing nonexistent parent (item or warehouse) | **0 — clean** (guaranteed by CASCADE) |
| Negative stock_levels.quantity | **0 — clean** |
| stock_movements with null/non-positive quantity | **0 — clean** |
| stock_movements with negative unit_cost | **0 — clean** |
| Movements referencing an *inactive* catalog item | **9 rows** — see H-09 (stranded stock, not a broken FK) |
| stock_levels for inactive items with nonzero quantity | **3 rows, 30 units** — see H-09 |
| Duplicate movements (same item/warehouse/type/qty/reference, close in time) | **1 confirmed pair (2 sub-pairs, 4 rows, 16 units)** — see C-06/§19 |
| stock_levels with nonzero quantity but zero movement history at all | **0** — but 2 rows have *some* history that doesn't *sum to* the balance (C-02) — a materially different, more concerning finding than simple absence |

**Stated explicitly, per the audit's instruction to report confirmed-correct results as well**: referential integrity at the database level is completely clean — every anomaly found in this audit is an **application-logic or process gap**, not a broken foreign key.

## 28. UI/UX Audit

Full findings preserved from the dedicated UI/UX audit pass:

- **High (Finding H-12)**: Blank/undefined error shown instead of "pending approval" on Stock Catalog edit/delete and Stock Movements delete — the app already has a dedicated fix for this exact failure mode (`handleGovernanceResult`, used correctly at 17 other call sites) but it wasn't applied to these three.
- **High (Finding H-13)**: Mobile Showroom's "Report Damage" flow uses `Alert.prompt`, which is **iOS-only** — silently dead-ends on Android with no error shown. Android users cannot report showroom damage at all.
- **Medium**: no client-side ceiling on Material Request approved-quantity on either platform (UI-side counterpart of H-11); mobile lacks a "(set quantity)" clarifier for the Adjustment movement type that desktop has, despite the underlying operation being a destructive overwrite.
- **Low**: mobile shows a misleading "+" sign on Adjustment rows; desktop Showroom lacks the search/filter toolbar every sibling screen has; Stock Transfer Approve has no confirmation step (Reject does).
- **Confirmed correct**: Stock Catalog, Stock Movements delete, the full Stock Transfers lifecycle, and Material Requests all have proper loading/error/empty states, search/filter, and confirmation dialogs with required reasons on both platforms, with no drift found in the one shared constant checked (`DISCREPANCY_REASONS`).

## 29. Security Audit

- **High (Finding H-11)**: `materialRequestsApprove` has no upper bound on approver-supplied quantity — an approver can approve for an arbitrary amount greater than requested with no warning or second check. (Fully attributed/audited — not a silent bypass, but an unenforced business rule with real inventory impact.)
- **Extensive server-side re-validation confirmed correct everywhere else checked**: `stockMovementsCreate`, `stockTransfersDispatch/Receive/ApproveReject/ReportDiscrepancy`, `showroomDamageReportCreate`, and `resolutionCreate`'s per-source-type quantity checks all independently re-verify quantity/warehouse ownership server-side rather than trusting client input — the backend never trusts a client-supplied `warehouse_id` over the record's own stored value, and never lets a client exceed a stored/locked ceiling. Delete paths independently re-check referential usage before allowing deletion. Mobile-api routes were confirmed to delegate cleanly to the same backend authorization with no drifting duplicate logic.
- **Design-risk note (not a new finding, cross-referenced to C-08/H-08)**: the Adjustment mechanism is explicitly the "least-guarded direct stock-level write in the department" per the code's own comments — a known, accepted, audited risk, not an unauthenticated bypass.

## 30. Audit Trail

- Live-reconfirmed: `audit_log_no_update`/`audit_log_no_delete` Postgres RULEs are present and unchanged.
- **No Stock/Inventory write function was found missing a `logAudit` call** — full function-by-function coverage table confirmed in the source UI/UX-security audit pass, including correctly-linked audit entries on both sides of multi-step actions (e.g. a transfer completing also logs the linked Material Request's completion).
- **Medium (Finding M-19)**: Adjustment audit entries capture the new quantity and mandatory reason but not the pre-adjustment quantity — reconstructing an adjustment's actual impact requires replaying surrounding ledger history rather than reading it off the entry itself. The one movement type where "before" matters most is the one where it's least captured.
- `applyGovernance` itself logs an `approval_request` entry even when an action is *deferred*, not just when it succeeds — confirmed, blocked/pending actions are not audit-trail gaps.

## 31. Live Reconciliation

See §19 for the full synthesis. Summary of every live reconciliation actually run (all read-only, real production data):

| Identity | Result |
|---|---|
| `stock_levels` vs replayed `stock_movements`, all 14 live rows | 11/14 exact match; 2 items show unexplained drift (C-02) |
| Goods Receipt vs PO lines, all 4 live receipts | **All 4 reconcile exactly** |
| Harvested vs Transported vs Waste | Reconciles as designed, but only prospectively-enforced (H-03) |
| Sawmill Intake = Finished + Recovered + Waste | Not computable — 0 qualifying live rows |
| Finished Timber ledger identity (`in − out = current`) | **Fails live**: −14 expected vs +2 actual, 16-unit mismatch (C-06) |
| `mv_stock_summary` vs `stock_levels`, same product | **13-unit / 87% drift** (C-01) |
| Financial identity (Opening+Inbound+Production−COGS−Loss±Adj=Closing) | App's own COGS (0) makes it falsely appear to balance; ledger-true COGS (160,000) reveals it does not (C-07) |

## 32. Findings — Full Register

**Critical (11)**

| ID | Finding | Module | Section |
|---|---|---|---|
| C-01 | Legacy `mv_stock_summary` still gates real dispatch decisions; live 13-unit/87% drift | Inventory Architecture / Reports | §3, §24 |
| C-02 | `stock_levels` has no DB-level tie to `stock_movements`; 2 live unexplained baseline drifts (986, 10, 6 units) | Stock Levels | §5 |
| C-03 | `salesCreate` accepts negative quantities, inverting stock effect | Sales | §13 |
| C-04 | Sales availability check is unlocked/TOCTOU-racy, silently floor-clamps shortfall | Sales | §13 |
| C-05 | No code path anywhere reverses a sale's stock deduction (edit/delete/reject/close-short) | Sales | §13 |
| C-06 | Live 16-unit Finished Timber ledger mismatch, root-caused | Sales/Reconciliation | §17, §19 |
| C-07 | 160,000 RWF of ledger-recorded sales invisible to COGS reporting | Financial Reconciliation | §18 |
| C-08 | Adjustment movement type SETs absolute value sharing the delta-types' own column — armed, not yet triggered | Adjustments | §15 |
| C-09 | All product costs remain unapproved QA placeholders (unchanged from a prior phase's own disclosure) | Costing | §16 |
| C-10 | `stockMovementsDelete` — no Workshop Isolation check | Stock Movements | §21 |
| C-11 | `showroomDamageReportCreate`/List — no Workshop Isolation check (2× corroborated) | Warehouse Damage | §11, §21 |

**High (13)**

| ID | Finding | Module | Section |
|---|---|---|---|
| H-01 | CEO denied mobile Inventory Dashboard access despite holding the permission | Permissions/Parity | §20, §22 |
| H-03 | Raw-log availability formula never nets out actually-transported logs | Harvesting | §8 |
| H-04 | `resolutionCreate` — no Workshop Isolation across entire Resolution Engine (2× corroborated) | Resolution Engine | §10, §21 |
| H-05 | Entire Sawmill offcut/resaw/QC chain — no Workshop Isolation | Sawmill | §9, §21 |
| H-07 | Fuel/spare-parts consumption structurally disconnected from stock ledger; live compensating-entry evidence | Consumption | §14 |
| H-08 | No approval step for Inventory Adjustments; 7 roles can unilaterally set any stock level | Adjustments | §15 |
| H-09 | Deactivating a stock item strands its stock invisibly (30 units live) | Stock Catalog | §4 |
| H-10 | `warehousesDelete` has no usage guard — crashes ungracefully | Stock Catalog / Warehouses | §4 |
| H-11 | No upper bound on approver-supplied quantity in `materialRequestsApprove` | Security | §29 |
| H-12 | Blank/undefined error instead of "pending approval" on catalog/movement governance | UI/UX | §28 |
| H-13 | `Alert.prompt` breaks mobile Showroom damage reporting on Android | UI/UX | §28 |
| (H-02) | *(merged into C-06 — same root event, dashboard-self-check angle)* | | §17 |
| (H-06) | *(merged into C-11 — identical finding, independently discovered)* | | §11 |

**Medium (~19)**: M-01 (desktop delete reason not captured) · M-02 (stockItemsDelete incomplete usage guard/hard-delete) · M-04 (no over-receipt guard) · M-05 (unit_cost not captured at goods receipt) · M-06 (Finished Timber ledger self-check failing — see C-06) · M-07 (Disposal approval gate inconsistent across source types) · M-08 (VAT product-catalog gap blocks posting) · M-09 (no duplicate sales order-number protection) · M-10 (COGS not point-in-time) · M-11 (manual `'out'` movements need no reason) · M-12 (adjustment deletion doesn't reverse stock) · M-13 (Downgrade doesn't capture write-down value) · M-14 (Harvesting has no Material Request capability) · M-15 (mobile Stock Transfers role-array excludes 3 permission-holding roles) · M-16 (desktop/mobile "canAct" restriction is UI-only, not backend-enforced) · M-17 (`harvestWasteCreate` no Workshop Isolation on write) · M-18 (5/6 notification types dead-end on mobile) · M-19 (Adjustment audit entries omit pre-adjustment quantity) · M-03 (stockMovementsCreate not transactional).

**Low (~8)**: L-01 (mixed permission-gating pattern, drift risk) · L-02 (over-broad notification broadcast, informational only) · L-03 (inconsistent notification recipients in Resolution Engine) · plus 5 UI/UX Low items (misleading +sign, missing Showroom search, no Transfer-approve confirmation, legacy stale role-check comment class, mixed terminology).

## 33. Priority Matrix

Per the audit's own classification rubric, re-applied consistently across all 32 findings:

- **Critical** = unexplained stock loss, incorrect quantity, unauthorized stock access, valuation corruption, cross-workshop leakage, duplicate financial movement, or "cannot reconcile" — **C-01 through C-11 all independently meet this bar**, most with live, not hypothetical, evidence.
- **High** = major workflow unavailable, department cannot complete a required operation, serious parity failure, or approval bypass — **H-01 through H-13**.
- **Medium** = incomplete workflow, reporting mismatch, or missing operational capability — the ~19 Medium items above.
- **Low** = UX inconsistency, non-blocking parity issue, or documentation gap — the ~8 Low items above.

**The 3 single highest-leverage fixes**, if only three could be done: (1) close C-03/C-04/C-05 together as one Sales-integrity fix (they share one root cause — Sales was never brought into the same validation/locking/reversal discipline every other stock-mutating function has); (2) retire or properly gate `mv_stock_summary`'s use in `dispatchReview` (C-01); (3) add the missing `isWorkshopRestricted` checks to `resolutionCreate`, `showroomDamageReportCreate`, `stockMovementsDelete`, and the Sawmill QC chain (C-10, C-11, H-04, H-05) — all four are the same one-line idiom already proven correct and safe elsewhere in this exact codebase.

## 34. Recommended Implementation Roadmap

Not scoped or estimated in engineering-hours (out of this audit's remit), but sequenced by dependency and risk:

**Phase 2 (recommended next) — Workshop Isolation completion**: C-10, C-11, H-04, H-05, M-17. All five are the identical, already-proven `isWorkshopRestricted()` idiom applied to functions that are missing it — lowest risk, highest confidence, fastest to implement and verify of any finding in this report, and closes the audit's most severe live-exploitable gaps.

**Phase 3 — Sales integrity**: C-03, C-04, C-05, M-09, M-10. This is the largest, most consequential body of work (the one department hand-off confirmed structurally incomplete) and should be scoped, live-tested, and verified as its own dedicated phase given its size and the live financial data at stake.

**Phase 4 — Inventory Architecture consolidation**: C-01 (retire or correctly re-source `dispatchReview`'s stock check), C-08 (fix the Adjustment column-semantics landmine before it triggers), H-08 (add an approval step to Adjustments), C-02's underlying question (should a DB-level constraint/trigger be added to prevent direct `stock_levels` writes going forward — a genuine architecture decision requiring explicit approval, not assumed by this audit).

**Phase 5 — Remaining High/Medium**: H-01 (CEO mobile access), H-07 (fuel/parts ledger integration — likely needs a real design decision, not just a bug fix), H-09/H-10 (Stock Catalog/Warehouse lifecycle hardening), H-11/H-12/H-13, and the Medium backlog.

**Not recommended for any near-term phase**: C-09 (product cost approval) is a **business/Finance process gap, not an engineering one** — the enforcement mechanism is already correct; what's missing is an actual Finance sign-off, which no code change can produce.

## 35. Remaining Enterprise Gaps

- Fuel and spare-parts consumption's disconnection from the stock ledger (H-07) is flagged as needing a genuine design decision (should these consume from `stock_catalog`, or is a separate subsystem intentional?) rather than a straightforward bug fix.
- The VAT product-catalog gap (M-08) blocking Kiln-dried/CCA-treated posting is a catalog-completeness/business decision, not a code defect.
- Whether `stock_levels` should gain a database-level constraint/trigger tying it to `stock_movements` (closing C-02's root architectural gap permanently, not just its one live symptom) is a real architecture question this audit surfaces but does not answer, per its own no-implementation mandate.
- Several Timber Lifecycle chain sections (Sawmill offcut/QC, Resolution Engine, Showroom damage) have zero live transactional history — their code-level correctness is verified, but this audit could not empirically confirm end-to-end reconciliation for them the way it could for Goods Receipt and Stock Transfers, simply because they haven't been used yet in this environment.

## 36. Conclusion

Stock & Inventory's foundational architecture is sound, and this audit found no need to build a second inventory ledger or a second costing engine — the existing `stock_catalog → stock_levels → stock_movements` chain and `stock_catalog.unit_cost` costing model remain correctly authoritative wherever they were actually and exclusively used. Workshop Isolation, where applied, is correctly and rigorously enforced, particularly across the mature Stock Transfer and Material Request workflows.

What this audit found is narrower and more actionable than a systemic failure: **one legacy system that should have been retired but wasn't (C-01), one department (Sales) that was never brought into the same integrity discipline every other stock-mutating function already has (C-03/C-04/C-05), one mechanism whose column semantics don't match its own neighbors (C-08), and a consistent, well-corroborated pattern of one missing permission check repeated across five otherwise-correctly-built functions (C-10, C-11, H-04, H-05, M-17).** Three independent audit passes converged on the same live, quantified reconciliation failure from three different angles — which is exactly the kind of evidence this audit's Success Criteria demanded, and exactly what "document it as a finding rather than assume the system is correct" was meant to produce.

**Direct answer to the audit's own Success Criteria question**: for most of the inventory this system manages, yes — origin, current location, and disposition can be traced and reconciled today, with a real, working, transactional, correctly-audited ledger underneath. For the specific paths this report identifies — Sales' missing reversal path chief among them — the honest answer, backed by live production evidence, is currently no. This report exists so that answer can become yes, deliberately and by design, rather than by assumption.

---

**Per the Stop Rule: this is an audit-only phase. Nothing was fixed. Nothing was committed or pushed. Phase 2 has not been started automatically — awaiting explicit review and approval of the findings and recommended roadmap above before any implementation begins.**
