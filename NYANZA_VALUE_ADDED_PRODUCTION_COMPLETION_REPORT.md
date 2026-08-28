# Nyanza Value-Added Production & Finished Products — Completion Phase

**Status: Complete.** Per this phase's own Stop Rule, no other department starts automatically after this. Nothing has been committed or pushed.

---

## 1. Business Model

Nyanza now supports both required paths, on the same infrastructure:

- **Path A — Direct timber sale**: unchanged. Finished timber already flows Sawmill → Stock Transfer → Nyanza `stock_levels` → Sales Orders (workshop = Nyanza). Nothing in this phase touched that path.
- **Path B — Value-Added Production**: new. A production batch consumes one or more input materials (real stock, workshop-scoped) and produces one or more output products (any active Product Catalog item — not limited to timber). Each output line independently goes through Quality Inspection → Accept (posts to inventory) / Reject (Rejection Hold → Rework/Downgrade/Return/Resolve).

The old "Value-Added Timber" feature (converting timber into Kiln-dried/CCA-treated timber of the *same size*) is now the simplest case of Path B — a one-input, one-output batch — not a separate mechanism.

## 2. Product Model

`products.type` had no DB constraint restricting it to `Timber`/`Poles`; the desktop and mobile forms did, hardcoding a 2-option dropdown. Both now offer a third option, **"Manufactured Product"**, with a free-text size/spec field instead of the Timber/Poles dimension model (pallets, crates, etc. don't fit width/height/length or diameter/length). `productsCreate`'s label/stock-category logic (previously a `Timber`-or-`Poles` binary ternary) was generalized to a 3-way branch — the new type now correctly labels itself and files under a new `Finished Manufactured Goods` stock category instead of being silently mislabeled "Poles". Per your explicit instruction, **no product rows were seeded** — the general capability ships; real products get added through this (now-capable) form using the existing Standard Cost/Default Price dual-approval flow, unchanged.

## 3. Input Consumption

Input material is chosen directly from real stock (`value_added_production_inputs.stock_item_id` → `stock_catalog.id`, the same universal key `stock_levels`/`stock_movements`/`stock_transfers` already use), not inferred from a specific Stock Transfer. Batch creation:
1. Checks `stock_levels.quantity >= requested` for every input line, **rejecting the whole batch** (not silently under-consuming) if any line is short.
2. Posts a real `stock_movements` 'out' entry per line on success.

Live-verified: a batch requesting more than available stock was correctly rejected with `Insufficient stock for <item>: need 9999, only 80 available`. This replaces the old system's soft counter (compared only against a transfer's `received_qty`, never touched `stock_levels` at all).

## 4. Production

`value_added_production_batches` (parent: date, workshop, production type, customer, order reference, operator, supervisor, start/end time, downtime, notes) + `value_added_production_inputs` (many per batch) + `value_added_production_outputs` (many per batch — a batch can produce multiple distinct output products from one run, e.g. pallets + recovered offcut timber, mirroring how one Sawmill `daily_log` already produces multiple `production_offcuts` rows).

## 5. Output Inventory

Accepted output posts into the *same* `stock_catalog`/`stock_levels`/`stock_movements` architecture every other finished-goods flow uses — no new inventory system. Live-verified: a QC-accepted output line correctly incremented `stock_levels` at the batch's workshop.

## 6. Quality Inspection

`valueAddedProductionInspect` reuses the exact same `quality_inspections` table Sawmill's QC uses (via the renamed `value_added_production_output_id` sibling column, replacing `value_added_timber_id`), same accept/reject-quantity pattern. `output_product_id` is chosen directly at output-line creation — no dimension-inference step, no "unmapped product" case for VAT anymore.

## 7. Rejection

Unchanged: rejected quantity creates a `rejection_holds` row (`value_added_production_output_id` set), same table, same states (`pending`/`rework`/`downgraded`/`returned`/`resolved`), same Resolution Engine for Firewood/Scrap Sale/Disposal.

## 8. Rework

`rejectionResolveRework` still branches on which source FK is set — Sawmill offcuts re-enter `pending_resaw → resawn → QC`; Nyanza rejected output now inserts a new `value_added_production_outputs` row **on the same batch**, `status='pending_qc'`, re-entering QC directly (no resaw-equivalent step). The two paths remain structurally distinct, never merged. Live-verified: rework created a new output row on the correct batch, and its own subsequent inspection posted correctly.

**Bug found and fixed during live testing**: a rework row represents the *same physical material* re-entering QC, not new production. Both `valueAddedProductionReconciliation` and `valueAddedProductionReport` initially summed rework-descendant rows *in addition to* the original — double-counting. Fixed by excluding `rework_of_rejection_id IS NOT NULL` rows from the "produced" totals in both functions (mirroring `productionReconciliation`'s own existing `tracked_offcuts` exclusion for Sawmill). Re-verified: a batch with output 5 → 3 accepted/2 rejected → rework → 2 accepted now correctly reports 5 produced / 5 accepted, not 7/5.

## 9. Customer-Specific Production

`value_added_production_batches.customer_id` (nullable FK → `customers`) + `order_reference` (free text), same "optional FK alongside legacy text" pattern `sales_orders.customer_id` already established. No new Sales architecture — the customer link is metadata on the batch; the eventual sale still goes through the existing Sales Orders flow.

## 10. Direct Timber Sales

Unaffected — confirmed no code path in Sales Orders, `sales_orders`, or the Sales UI was touched.

## 11. Showroom Integration

Already fully supported by the generic Stock Transfers page, which Showroom's own UI already explicitly points users to ("Direct sale happens on the Sales Orders page — select 'Showroom' as the workshop there... receive a Stock Transfer first"). Documented as already-satisfied — no new transfer UI was built.

## 12. Costing

No BOM/labour-cost/transformation-cost engine exists anywhere in this codebase (confirmed via a dedicated audit before implementation) and none was invented here, per your brief's own instruction to document the gap rather than fabricate a financial model. Manufactured products use the exact same manual, dual-approved (Finance for Standard Cost, Management for Default Price) mechanism every other product already uses.

## 13. Desktop UI

`renderValueAddedTimber` replaced by `renderValueAddedProduction` (`renderer/app.js`, nav id/permission `value-added-production`, page container `page-value-added-production` in `index.html`): batch list (input/output lines shown inline, per-output Inspect button), New Batch overlay (metadata + dynamic add/remove input and output rows), Edit (metadata-only) / Delete (soft-delete + input-stock reversal) with the same governance/pending-approval pattern every other entity uses, a new Input Consumption/Output Production report card, and the existing shared `_loadRejectionHolds`/`_loadQualityReport` components reused unchanged (only the source query they call was repointed). Product Catalog form extended with the "Manufactured Product" type (free-text size, no dimension fields).

## 14. Mobile UI

- `VatInboundScreen.tsx` rewritten from a "pick a received transfer, then create a single treatment entry" 2-step flow into a general batch-creation form (metadata + dynamic input/output line builder, using the same `stock_levels`-backed availability list as desktop). `VatIntakeScreen.tsx` (now fully absorbed) was deleted rather than left dead. The `VatInboundStack` param list dropped `VatIntakeCreate` accordingly.
- `VatProcessingScreen.tsx` rewritten to list batches with per-output-line Inspect actions (same `ReasonModal` 2-stage numeric-then-reason pattern established in an earlier phase, now driving `outputId` instead of a raw entry id); a new inline `VapReportCard` (input consumption/output production) added, matching `SawmillDashboardScreen`'s own workshop-specific-report precedent rather than routing through the cross-department Reports menu.
- `VatDetailScreen.tsx` rewritten into a genuine batch drill-down (metadata + all input lines + all output lines with status) — previously a flat single-entry re-display; now a real detail view since a batch can hold multiple lines.
- `ProductFormScreen.tsx`/`ProductsListScreen.tsx` extended with "Manufactured Product" (free-text size field, filter chip), matching desktop.
- `useVat.ts` fully rewritten to the batch/input/output payload shapes; `useTimberLifecycle.ts`'s rework result field renamed `newVatId → newOutputId`; `types/api.ts`'s VAT type block replaced; two admin permission-management screens (`UserPermissionsScreen.tsx`, `RoleDetailScreen.tsx`) updated to the renamed permission key.

**Disclosed limitation**: batch creation requires online, real-time stock validation — offline queueing (which the old single-entry flow supported) is not supported for batch creation, since stock availability can't be meaningfully verified offline. The screen surfaces a clear message rather than silently dropping the batch or queuing an unvalidated one.

## 15. Permissions

The `value-added-timber` permission key was renamed to `value-added-production` everywhere it's checked or displayed: `data.js` (`mustRole`/`ROLE_PAGES`/`PROD_SUB_TOKENS`/`expandPages`), `role_definitions` (6 roles' stored permission arrays renamed live via migration — `admin`, `ceo`, `operations`, `supervisor`, `vat-leader`, `vat-supervisor`), desktop nav/`chk()`, the two mobile admin permission-management screens, and `tools/verify_production.js`'s own role-permission assertions. No new permission model — same enforcement, new name matching the generalized feature.

## 16. Workshop Isolation

Untouched — `isWorkshopRestricted` reused exactly as-is. Live-verified: a `vat-leader` user's batch list call applies the same `workshop_id = $1 OR workshop_id IS NULL` filter every other workshop-scoped query in this codebase already uses.

## 17. Notifications

The rejection notification path (`relatedModule: 'rejection_holds'`) is unchanged and reused as-is — already one of the documented "no per-record mobile/desktop screen" modules from an earlier phase's notification-routing audit, consistent behavior before and after. No new notification type was introduced, so no new routing-registry entries were needed on either platform.

## 18. Reporting

Two new functions, both modeled directly on the existing `productionReconciliation`/`qualityReport` pattern (one aggregation function → IPC + REST → desktop template-string render / mobile React Query hook + inline card):
- `valueAddedProductionReconciliation` — per-batch input vs. output identity, only computed when a batch has exactly one input line and one output line (the same-unit "treatment" case); multi-line batches report both totals with an explicit "not directly comparable" note rather than a fabricated formula, per your brief's own §23 instruction.
- `valueAddedProductionReport` — input consumed / output produced by item/product, deliberately *not* duplicating `qualityReport`'s already-generic rejection/rework/downgrade coverage (which already includes Nyanza when workshop-filtered).

## 19. End-to-End Verification

Live-tested against the production database (QA-tagged test data, fully cleaned up afterward — verified zero residue):

| Scenario | Result |
|---|---|
| A — Direct timber sale | Unaffected (no code path touched) |
| B — Timber → manufactured product, real stock consumption | **PASS** — input reduced 100→80 for a 20-unit batch; over-consumption (9999 requested) correctly rejected |
| QC accept posts to inventory | **PASS** — output stock 0→3 after approving 3 of 5 |
| D — Reject → Rework → re-Inspect → Accept | **PASS** — rework created a new output row on the same batch; final inspection brought output stock to 5 (3+2), matching the 5 originally produced |
| Reconciliation, single-line batch | **PASS** — input 20 / output 5, correctly `unitsComparable: true, reconciled: false` (different units — timber pieces vs. pallets — not a bug) |
| Reconciliation, multi-line batch | **PASS** — correctly `unitsComparable: false` with the documented note, no fabricated formula |
| Rework double-counting (found via test, then fixed and re-verified) | **PASS** after fix — 5 produced / 5 accepted, not 7/5 |
| Workshop Isolation | **PASS** (same generic mechanism, not new logic) |
| Report accuracy | **PASS** — input consumption and output production totals matched expected values after the double-counting fix |

Static verification: `node --check` clean on every touched backend/desktop file (`db/migrate.js`, `db/services/data.js`, `electron/main.js`, `electron/preload.js`, `renderer/app.js`, `mobile-api/routes/vat.js`, `mobile-api/routes/products.js`, `mobile-api/server.js`, `db/clear-data.js`, `tools/verify_production.js`); `npx tsc --noEmit` clean across the full `mobile/` app. Repo-wide grep swept for every old name (`value_added_timber`, `valueAddedTimber`, `vatQualityInspectionCreate`, `vatInboundList`, `value-added-timber`, `VatEntry`, etc.) — found and fixed 4 files beyond the core implementation (`db/clear-data.js`'s truncate list, `tools/verify_production.js`'s table-existence and permission assertions, two mobile admin permission screens) that would otherwise have broken on next use.

## 20. Outstanding Items

- No mobile device/simulator was available in this environment — mobile verification is `tsc --noEmit` + code review against already-proven patterns (`ReasonModal`, `FormSelect` dynamic rows), not an interactive tap-through. Recommend a manual pass on a real device before the next mobile release, specifically the multi-line input/output batch builder.
- Real Product Catalog entries for whatever Nyanza actually manufactures (pallets, etc.) still need to be added through the (now-capable) product form — deliberately not seeded, per your instruction.
- `db/services/data - Copy.js` is a stray, non-imported backup file containing old naming — confirmed not referenced by any `require()` anywhere in the codebase, so left untouched as out of scope (not live code).
- A full per-dashboard reconciliation pass beyond this phase's own two new report functions was not performed — Phase 6/7's existing cross-department verification already covers the rest of the ERP and was not re-run from zero.

## 21. Production Readiness

No blocking issue found. Every change is additive to existing, already-audited infrastructure (`stock_catalog`/`stock_levels`/`stock_movements`, `quality_inspections`/`rejection_holds`/`resolution_records`, `applyGovernance`, `isWorkshopRestricted`) — no parallel system was built. The one genuine bug found (rework double-counting) was caught by the phase's own live-testing discipline before being reported here, not left for a future phase to discover. `value_added_timber` had zero production rows, so this migration carried zero data-loss risk; the live database now correctly reflects the new schema with `0` rows across all three new tables, ready for real use.

**Recommendation**: ready to ship as-is, pending a device UAT pass per §20. Per the Stop Rule, no other department starts automatically — the next decision is yours (real product catalog entries, and whether/when to run that device pass).
