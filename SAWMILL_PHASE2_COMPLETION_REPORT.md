# UFCL ERP — Sawmill Phase 2: Financial Integrity, Inventory Reconciliation & Enterprise Costing
## Completion Report

**Date:** 2026-08-06
**Scope:** Financial integrity of the production chain Phase 1 completed — Standard Cost / Default Selling Price / Negotiated Selling Price separation, inventory reconciliation, timber processing reconciliation, executive cost & profitability reporting, enterprise financial reporting, and desktop/mobile parity. No redesign of production — this phase strengthens valuation, reconciliation, and reporting only.

---

## 1. Executive Summary

Finished Timber now carries a real, auditable cost basis instead of the `unit_cost = 0` state Phase 1 left it in. The ERP's **one existing** costing field (`stock_catalog.unit_cost`, confirmed via a mandatory Workstream 7 architecture audit before any code was written) is now populated from a new **Standard Cost** field on every Product Catalog item, with a companion **Default Selling Price** field for Sales, and both are permanently separated from the **Negotiated Selling Price** already stored per sales order (`sales_orders.unit_price`) — confirmed by code inspection that nothing has ever written a sale price back into the Product Catalog, and that remains true.

Every Finished Timber transaction — production, transfer, sale — now carries a consistent, reconcilable cost. Gross Margin, COGS, Inventory Value, and Product Profitability are computed live from the same fields Inventory Valuation and Stock Transfer already use — no second costing engine was built. An enterprise reconciliation identity (Produced − Sold = Current Stock) runs automatically and is surfaced as a pass/fail indicator on both the Executive Dashboard and the Timber Inventory page.

All figures were live-verified end-to-end against production data with throwaway QA data across all 3 confirmed business paths, then fully cleaned up — inventory returned to its exact pre-test baseline.

**Important caveat, per your explicit instruction this phase:** the Standard Cost and Default Selling Price now on file for the 3 existing products are **placeholder QA test values**, not real Finance/Management-approved figures — see §9.

---

## 2. Workstream 7 — Costing Architecture Audit (performed first, per the brief's "Mandatory" instruction)

Before writing any valuation logic, a dedicated research pass answered 7 questions about how costing already works across the entire ERP. Findings:

- `stock_catalog.unit_cost` is a **purely manual** field — no weighted-average, FIFO, or automatic computation exists anywhere in the codebase.
- Every valuation figure app-wide (Inventory Dashboard, Logistics Dashboard, Material Request costing, Maintenance parts costing) computes `quantity × unit_cost` at query time — the same formula, everywhere.
- **No profitability/margin/COGS calculation existed anywhere** before this phase — confirmed by exhaustive grep. This was genuinely greenfield, not a second engine competing with an existing one.
- Procurement Goods Receipt never writes cost anywhere (a pre-existing, business-acknowledged gap, unrelated to Sawmill — out of scope here).
- Harvesting/Raw Logs carry **zero** cost data at the schema level — there is no per-log or per-m³ cost to inherit, which is why Standard Cost had to be a Finance-approved figure per finished product, not a derived one.
- The existing CSV export pattern (`downloadCsv()` + array-of-strings) and the Sage Reconciliation page's variance/traffic-light pattern were identified and reused rather than building new export/reconciliation mechanisms.

This audit is the basis for every design decision below — Standard Cost integrates into `stock_catalog.unit_cost`, the ERP's one existing valuation field, rather than adding a second one.

---

## 3. Enterprise Pricing Model — Standard Cost / Default Price / Negotiated Price

**Schema** (`db/migrate.js` → `createSawmillCostingFoundation()`):
- `products.standard_cost`, `products.default_price` — the two mandatory, independently-approved fields.
- `products.standard_cost_approved_by/_approved_at/_effective_date` and `products.default_price_approved_by/_approved_at/_effective_date` — two **independent** approval records (Finance approves Standard Cost, Management approves Default Selling Price — per your explicit instruction this phase, these are never merged into one).
- `stock_catalog.default_selling_price` — mirrors `default_price`, as explicitly instructed, alongside the existing `unit_cost` mirror.
- Check constraints reject a literal zero for either field (no company policy permits it).

**Backend** (`productsCreate`/`productsUpdate` in `db/services/data.js`): both mandatory fields plus their full approval metadata are now required on every create *and* every edit — an edit is treated as a re-approval, re-stamping `approved_at` with the current time. Standard Cost writes through to `stock_catalog.unit_cost` and Default Price to `stock_catalog.default_selling_price` in the same transaction, so they can never drift out of sync.

**Negotiated Selling Price**: verified by direct code inspection — `salesCreate` reads `products.id`/`stock_item_id` only, it has never written to `products`, and that remains true after this phase. The order's `unit_price` (the negotiated price) lives only on `sales_orders`. Live-verified: a sale at RWF 16,000 (above the RWF 15,000 default) and another at RWF 14,000 (below it) both left `products.default_price` unchanged at exactly 15,000.

**Sales prefill**: both desktop (`renderSales`) and mobile (`SalesOrderFormScreen.tsx`) now prefill the unit price input from the selected product's Default Selling Price the moment a size is chosen, while leaving it fully editable — this is the "negotiation" the brief describes, and it was live-verified to leave the catalog untouched.

---

## 4. Workstream 1 — Finished Timber Unit Cost

Achieved via §3's architecture — Standard Cost is now the sole source for `stock_catalog.unit_cost`, and Finished Timber inventory carries a real value from the moment a product is created (previously always `0`). Live-verified: 30 units produced this run correctly added RWF 300,000 to Inventory Value and Production Cost (30 × RWF 10,000 standard cost).

---

## 5. Workstream 2 — Enterprise Inventory Reconciliation

A new reconciliation identity is computed automatically in `timberInventoryList` (no manual calculation, no duplicate inventory quantities): **Total ever produced − Total ever sold = Current total stock**, read directly from the `stock_movements` ledger (`in`/`out` movement types), company-wide across all 3 warehouses (transfers net to zero in aggregate since they only move stock between locations). Surfaced as a green "Inventory reconciled" / red "Mismatch: N units" badge on both the Executive Dashboard and Timber Inventory page.

Live-verified: after 30 units produced and 10 sold across all 3 paths, the identity held exactly (`30 − 10 = 20`, matching the actual current stock) — `reconciled: true`.

---

## 6. Workstream 3 — Timber Processing Reconciliation

Per the brief's own instruction ("if these categories intentionally represent different business stages, clearly explain the difference rather than presenting misleading totals"): the Kiln-dried/CCA-treated/Untreated breakdown was confirmed (Phase 1 audit finding, still true) to only be populated by VAT-processed batches — plain production entries and multi-size batches count toward Total Produced but were never broken down by treatment stage. No breakdown was fabricated. Instead, both totals are shown side by side with an explicit note, and a "breakdown categorized: X/Y" indicator rather than a misleadingly-reconciled-looking pair of numbers. Live-verified this correctly shows as un-reconciled (15 of 45 categorized) against real production history — proving the indicator surfaces the true, expected state rather than hiding it.

---

## 7. Workstream 4/5 — Executive Cost & Profitability / Enterprise Financial Reporting

New figures, computed once in `timberInventoryList` and reused by both the Timber Inventory page and the Executive Dashboard's new "Sawmill Cost & Profitability" panel (no second reporting engine):

- Inventory Value, Production Cost (month + all-time), Sales Value, COGS, Gross Profit, Gross Margin %, Raw Logs Consumed, Finished Timber Produced, Inventory Value by Location.
- **Gross Margin is computed exactly as specified: Negotiated Selling Price − Standard Cost**, summed per line. Live-verified: 3 sales at negotiated prices RWF 16,000/15,000/14,000 against a RWF 10,000 standard cost produced a gross profit of exactly RWF 52,000 and a margin of 34.2%, matching the hand-calculated expectation to the cent.
- Product Profitability table (per product, this month) — units sold, sales value, COGS, gross profit, margin %.
- Sales that couldn't resolve to a catalog product are reported separately (`unresolvedSalesValueMonth`) rather than silently folded into COGS/Gross Profit — never a misleading total.
- CSV export added to the Timber Inventory page, reusing the existing `downloadCsv()` pattern.

---

## 8. Workstream 6 — Desktop/Mobile Enterprise Parity

- Product Catalog: both platforms now require and collect Standard Cost, Default Selling Price, and both approval records on create *and* edit. Desktop previously had no Edit Product UI at all (backend `productsUpdate` existed but was never wired to a screen) — now built, alongside mobile's pre-existing Edit screen.
- Sales: both platforms prefill from Default Selling Price with full override capability.
- Timber Inventory: both platforms show the same Cost/Valuation/Reconciliation/Profitability data — verified via a shared backend response (`timberInventoryList`), not duplicated calculations.
- Stock Transfer: verified (§3, code inspection) that dispatch/receive never recalculate or touch cost — Standard Cost is preserved through a transfer exactly as required. Live-verified: `stock_catalog.unit_cost` remained RWF 10,000 immediately after a live transfer.

---

## 9. Placeholder Cost/Price Data — Explicit Disclosure

Per your explicit instruction this phase ("Use placeholder QA values, mark unapproved"), the 3 existing Product Catalog items were populated with the following **test values**, not real business figures:

| Product ID | Product | Standard Cost (RWF) | Default Selling Price (RWF) | Approval status |
|---|---|---:|---:|---|
| 1 | Timber — Untreated — 100×200×4m | 10,000 | 15,000 | **PENDING APPROVAL** (placeholder) |
| 2 | Pole — Ø255×12m | 12,000 | 18,000 | **PENDING APPROVAL** (placeholder) |
| 3 | Timber — Untreated — 50×150×4m | 6,000 | 9,000 | **PENDING APPROVAL** (placeholder) |

Both the `standard_cost_approved_by` and `default_price_approved_by` fields for all 3 products are literally set to the text `"PENDING APPROVAL (placeholder — Sawmill Phase 2 QA, not yet Finance/Management-approved)"` — this is visible on both the desktop Product Catalog table and the Edit Product overlay, so nobody can mistake these for real approved data. **All Inventory Value, COGS, Gross Margin, and Product Profitability figures currently shown anywhere in the ERP are built on these placeholder numbers and are not yet financially meaningful.**

**To finalize**: open Product Catalog → Edit on each of the 3 products, enter the real Finance-approved Standard Cost and Management-approved Default Selling Price with the approver's actual name and effective date. No further code changes are needed — the form, validation, and propagation to `stock_catalog` are all already live.

---

## 10. Live Verification Results (Workstream 8)

Full 3-path verification run against production data with throwaway QA data, then completely removed.

| Check | Result |
|---|---|
| Path A — 4u sold at Gatare, negotiated RWF 16,000 (above default) | Correct; catalog default_price unaffected |
| Path B — 6u transferred Gatare→Nyanza, 4u sold at Nyanza, default price | Standard Cost preserved through transfer (RWF 10,000 unchanged); Nyanza inventory value correctly RWF 60,000 |
| Path C — 6u→Nyanza, 3u→Showroom, 2u sold, negotiated RWF 14,000 (below default) | Showroom inventory value correctly RWF 30,000; catalog unaffected |
| Inventory quantities | Correct at every stage (30 → 26 → 20 → 14/... final: 20 remaining) |
| Inventory valuation | RWF 300,000 → RWF 200,000, matching 20 units × RWF 10,000 exactly |
| Unit Cost | Preserved through every transfer, confirmed unchanged in `stock_catalog` |
| Default Selling Price | Correctly prefilled sales forms; confirmed never modified by any sale |
| Negotiated Selling Price | Correctly stored only on `sales_orders`, 3 different prices used across 3 sales, catalog untouched each time |
| COGS | RWF 100,000 (10 units × RWF 10,000 standard cost) — exact |
| Gross Margin | RWF 52,000 / 34.2% — matches hand calculation to the cent |
| Product Profitability | Correct per-product rollup (units sold, sales value, COGS, profit, margin) |
| Audit logs | 24 rows fired across harvest/production/sales/transfers |
| Notifications | 9 rows fired (transfer request/approve/complete) |
| Enterprise reconciliation | `30 produced − 10 sold = 20 stock` — exact, `reconciled: true` |
| Desktop/Mobile parity | Same backend response consumed by both; both platforms enforce identical mandatory-field validation |
| QA cleanup | All QA rows removed; `stock_levels` confirmed back at exact pre-test baseline (0/0/0 across the 3 warehouses) |

---

## 11. Bug Found and Fixed During This Phase

`productsUpdate`'s new `stock_catalog` sync query referenced a non-existent `stock_catalog.updated_at` column (that table has no `updated_at` column — confirmed via `information_schema`). This was caught immediately during live verification (before any real data was affected) and fixed by removing the erroneous column reference. A related mistake in my own backfill script (omitting dimension fields from a `productsUpdate` payload, which nulled `width_mm`/`height_mm`/`length_m` on all 3 products) was also caught immediately via the resulting `unmappedSizes` failure and corrected before verification proceeded.

---

## 12. Remaining Verified Gaps / Newly Discovered Issues

- **Placeholder cost/price data (§9)** — the single most important open item. Nothing in the ERP can distinguish "approved" from "placeholder" data programmatically yet (the approver-name text is the only signal) — a future phase could add a formal `approval_status` enum if that distinction needs to drive UI behavior (e.g., blocking Sales/reporting on unapproved products).
- Procurement Goods Receipt still never writes cost anywhere (pre-existing gap, confirmed still open, unrelated to Sawmill).
- Harvesting/Raw Logs still carry no cost data — Standard Cost for Finished Timber has no automated raw-material cost basis and must continue to be a directly Finance-approved figure per product.
- Kiln-dried/CCA-treated/Untreated breakdown still only populates for VAT entries (Phase 1 finding, unrelated to this phase's costing scope, still open).

## 13. Recommendations for Sawmill Phase 3

1. Replace the 3 products' placeholder cost/price with real Finance/Management-approved figures via the new Edit Product form (no code change needed).
2. Consider a formal `approval_status` field (`pending`/`approved`) if the business wants unapproved products to be blocked from Sales or excluded from Executive Reporting, rather than merely labeled.
3. Consider whether Procurement's cost gap (PO unit_price never reaching `stock_catalog.unit_cost`) should be addressed for non-Sawmill departments, now that the propagation pattern exists as a working reference.
4. Extend Product Profitability reporting with a trend view (month-over-month) if Finance wants more than the current snapshot.

---

## STOP RULE

Per the brief, Phase 2 is complete and this report + `SAWMILL_PHASE2_CHANGELOG.md` are the deliverables. **Phase 3 has not been started** and will not begin until this report has been reviewed and explicitly approved.
