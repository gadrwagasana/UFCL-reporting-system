# Timber Lifecycle Phase 3 — Finished Timber Distribution, Nyanza Value-Added Production & Showroom Completion

**Status: COMPLETE — live-verified end-to-end against the production database, QA data fully removed, baseline confirmed restored.**

---

## 1. Objective

Complete the downstream Timber Lifecycle from the exact point Phase 2 ended:

```
Finished Timber Inventory → Gatare Sale / Stock Transfer → Nyanza → Direct Sale / Value-Added Production
→ Value-Added QC → Accepted (Inventory) / Rejected (Resolution) → Stock Transfer → Showroom
→ Condition Check → Sale / Resolution
```

## 2. Architecture

```
Finished Timber Inventory (Gatare, wh 3)
   ├──────────────► Direct Sale (existing generic Sales module)
   │
   ▼
Stock Transfer (existing, warehouse-agnostic) ──► Nyanza (wh 4)
                                                      ├──► Direct Sale
                                                      ▼
                                          Value-Added Production (value_added_timber)
                                                      ▼
                                    Value-Added Quality Inspection  ◄── SAME quality_inspections/
                                                      │                 rejection_holds/resolutionCreate
                                          ┌───────────┴───────────┐     tables Phase 2 built — made
                                          ▼                       ▼     polymorphic, not duplicated
                                      ACCEPTED                REJECTED
                                          │                       │
                                          ▼                 Rework/Downgrade/Return/
                                  Finished Timber            Scrap/Disposal (all reused
                                  Inventory (Nyanza)          unchanged except Rework)
                                          │
                                          ▼
                          Stock Transfer ──► Showroom (wh 5)
                                                ├──► Condition Check ──► GOOD → Sale
                                                │                    └─► DAMAGED → showroom_damage_reports
                                                │                          → Resolution (same engine)
                                                ▼
                                          Direct Sale
```

## 3. Backend Capabilities Audited (Workstream 1)

A dedicated audit pass (via a research agent, cross-checked against source before any code was written) established, with file:line evidence:

| Area | Finding |
|---|---|
| Gatare Direct Sale | **Exists fully** — the Sales module is workshop-agnostic by design; "Gatare sale" is just `salesCreate` with `workshop_id=3`. Found a real bug: mobile-api's `SALES_ROLES` literal array excluded `sales-staff`/`showroom-staff` despite both holding the `'sales'` permission — desktop worked, mobile 403'd. |
| Stock Transfer | **Exists fully**, already warehouse-agnostic (Material Request → Stock Transfer unification phase). No new transport engine needed for Gatare→Nyanza or Nyanza→Showroom. |
| Nyanza Workshop | **Exists** as warehouse (id 4) + roles (`vat-leader`, `vat-supervisor`) + workshop isolation. Direct sale architecturally supported but never specifically exercised before this phase. |
| Value-Added Production | **Existed only as an input-recording log** (`value_added_timber`) — no stock posting, no Quality Inspection linkage (`quality_inspections.production_offcut_id` was `not null`, hard-wired to Sawmill), no Accepted/Rejected split. This was the single largest gap in the whole brief. |
| Showroom | **Existed only as a warehouse + role** (`showroom-staff`) + one read-only "Available at Showroom" figure. No inventory view, no sale-specific logic, no damage/condition-check entity of any kind. |
| Costing | **Exists fully**, one architecture (`products.standard_cost`/`default_price`, `sales_orders.unit_price` as negotiated), directly reusable for Value-Added SKUs. |
| Resolution Engine | **Exists**, `source_type` CHECK-constraint + validation-array pattern already precedented once (Phase 2 added `rejected_timber`) — extending it again is low-risk. |

## 4. Desktop UI Audit

Confirmed via direct inspection: `renderValueAddedTimber()` existed (intake form + list, no QC UI to build on); **no Showroom page existed at all** — not even a stub route.

## 5. Mobile UI Audit

`mobile/src/screens/vat/*` existed (Inbound, Intake, Processing, Detail — all intake-only, same ceiling as desktop); `mobile/src/screens/showroom/` **did not exist**.

## 6. Permissions

- Confirmed via AskUserQuestion before implementation: `vat-leader`, `vat-supervisor`, `showroom-staff` did not hold `'stock-transfers'`, meaning Nyanza/Showroom staff could not receive transfers arriving at their own workshop. **User approved granting it** — done via an additive, idempotent `grantStockTransfersToNyanzaShowroom()` migration function (same pattern as the existing `grantSawmillDashboardPermission`), live-confirmed: 3 roles updated.
- No new roles invented anywhere in this phase.
- Value-Added QC: `admin, ceo, operations, supervisor, vat-leader, vat-supervisor`.
- Downgrade / Disposal / Return to Inventory: unchanged `admin, ceo, operations, supervisor` tier — **vat-leader confirmed still denied** these live, even after the stock-transfers grant (the two permissions are independent).
- Fixed the mobile-api `SALES_ROLES`/`DELIVER_ROLES` literal-array bug (§3) so `sales-staff`/`showroom-staff` actually get the mobile access their permissions already entitle them to.

## 7. Gatare Sales

Live-verified (Scenario A): `salesCreate` as a real `sales-staff` user, auto-scoped to their own workshop, negotiated price (15,000) stored distinct from the catalog default (12,000) — confirmed the codebase's existing "never force default price" rule holds. Stock deducted exactly, Product Catalog id resolved for traceability.

## 8. Nyanza Transfer

Live-verified (Scenario B): create → approve → dispatch (real vehicle) → receive, full lifecycle, exact quantity movement both directions (Gatare −20, Nyanza +20), transfer status correctly reached `completed`.

## 9. Nyanza Sales

Live-verified (Scenario B): direct sale at Nyanza using the exact same `salesCreate` function with `workshop_id=4` — confirms the audit's "architecturally supported, never specifically exercised" finding was correct, and it now has direct live evidence behind it.

## 10. Value-Added Production

`value_added_timber` intake validates against the transfer's remaining `received_qty` budget (existing Sprint-4 design, confirmed via audit — a virtual 1:1 input:output link, no separate loss/waste field). **Bug found and fixed**: `valueAddedTimberCreate` never returned the created row's `id` (every other `*Create` function in the codebase does) — caught live when the QA script's own inspection step had nothing to act on.

## 11. Value-Added QC

New `vatQualityInspectionCreate` — deliberately a **separate entry function** from Sawmill's `qualityInspectionCreate` (so Phase 2's verified path is untouched) but writes into the **exact same** `quality_inspections`/`rejection_holds` tables, made polymorphic via a second nullable FK (`value_added_timber_id`) plus a `num_nonnulls(...) = 1` check constraint. Live-verified (Scenario C): resolves the correct Product Catalog match from `(sub_type, size)`, posts Accepted quantity to Finished Timber Inventory at Nyanza, freezes `product_id` for downstream traceability.

## 12. Rework

Only function needing source-specific branching (Downgrade/Return/Firewood/Scrap/Disposal all already worked unchanged since they operate through `quality_inspection_id`'s frozen product data). `rejectionResolveRework` now branches: Sawmill-origin holds still create a new `production_offcuts` row exactly as before (regression-verified live); VAT-origin holds create a new `value_added_timber` row re-entering `pending_qc` directly (no resaw-equivalent step). Live-verified (Scenario D): reject → rework → re-inspect → fully accepted, correct incremental stock posting at each step.

**Bug found and fixed**: the exact same rework-double-counting flaw already found and fixed in Sawmill's `productionOffcutCreate`/`productionReconciliation` earlier this session existed here too — `valueAddedTimberCreate`'s and `vatInboundList`'s `intake_used` calculations summed rework-descendant `value_added_timber` rows against the original transfer's budget, which could eventually cause a false "exceeds available inbound timber" rejection. Fixed with the same `rework_of_rejection_id is null` exclusion pattern.

## 13. Rejection Resolution

`'rejected_timber'` as a `resolutionCreate` source type deliberately **not** duplicated into a new `value_added_rejected` type — since `rejection_holds` is now genuinely polymorphic, the existing label already covers both origins correctly (both are still timber). Live-verified (Scenario E): Disposal write-off, zero stock posting, financial value auto-defaulted from the VAT product's `standard_cost` (reusing Phase 2's fix).

## 14. Value-Added Inventory

No second inventory system — Accepted VAT output posts through the exact same `_postFinishedTimberStock`/`stock_catalog`/`stock_levels`/`stock_movements` bridge every other department uses. One catalog-design flag from the audit was validated live: VAT products must stay `type: 'Timber'` (not a new type) or `productsCreate`'s binary category check would mis-file them as `'Finished Poles'` — the QA product was deliberately created this way and it worked correctly.

## 15. Showroom Transfer

Live-verified (Scenario F): Nyanza→Showroom transfer of VAT-produced stock using the same generic Stock Transfer engine, zero new code — exact quantity movement both directions.

## 16. Showroom Quality/Damage Check

Genuinely new (confirmed absent by audit): `showroom_damage_reports` — deliberately a **lighter-weight** entity than `rejection_holds`, since showroom stock is already live/posted inventory (unlike a pre-admission rejection hold), so a damage report deducts an `'out'` movement **immediately** at report time, then routes the already-removed material through the same Resolution Engine (`source_type: 'showroom_damage'`, a genuinely new value this time since there's no equivalent existing label). Live-verified (Scenario G): stock deducted at report time, resolution via Disposal correctly does **not** double-deduct (write-off of already-removed stock).

## 17. Showroom Sales

Live-verified (Scenario H): a real `showroom-staff` user, auto-scoped to their own workshop, stock deducted correctly — same generic Sales module, zero new sale-specific code.

## 18. Inventory Reconciliation

Live-verified at every stage (Scenarios A–H): source stock − transferred/consumed/sold quantity = remaining stock, exactly, at Gatare, Nyanza, and Showroom independently. Scenario I traced the same Product Catalog id across VAT QC → Nyanza sale → Showroom sale, confirming no broken lineage. Final Showroom balance (3 transferred − 1 damaged − 1 sold = 1) matched exactly.

## 19. Costing / COGS / Margin

Reused Phase 2's costing foundation unchanged. Negotiated price never forced to equal the catalog default at any stage (verified live at Gatare — 15,000 vs. 12,000 default). No approved cost-allocation method exists for value-added production specifically beyond the product's own `standard_cost` (confirmed via audit) — **documented as a gap, not invented** (Workstream 15's explicit instruction).

## 20. Notifications

Reused the existing `pushNotification` infrastructure unchanged — VAT rejection and Showroom damage reports both notify the same `admin/ceo/operations/supervisor` tier Sawmill rejections already notify, no new notification system.

## 21. Audit Trail

Every new mutating function (`vatQualityInspectionCreate`, `rejectionResolveRework`'s VAT branch, `showroomDamageReportCreate`) calls `logAudit` with the same `module`/`actionType`/`recordId` shape already established — nothing here is a silent write.

## 22. End-to-End Verification

All scenarios run against the production database with clearly-marked throwaway QA data (`reason: 'QA-PHASE3-TEST'`, `order_number: 'QA-PH3-*'`, `reference: 'QA-PHASE3-TEST*'`), using real `sales-staff`, `showroom-staff`, and `vat-leader` users (not just admin) for authentic permission-path testing. **58 assertions, all passing** on the final run, covering Scenarios A through I plus 3 permission-parity checks, plus a separate 9-assertion Phase 2 Sawmill regression pass (all passing) to confirm the shared functions modified for polymorphism didn't break Sawmill's existing behavior.

Cleanup was genuinely non-trivial: a circular FK between `value_added_timber`/`rejection_holds` (mirroring Phase 2's offcut/hold circularity) had to be broken by nulling `value_added_timber.rework_of_rejection_id` before deletion; `value_added_timber.source_transfer_id → stock_transfers` meant VAT rows had to be deleted before their source transfer; and — a genuinely new discovery this phase — **creating any new low/zero-stock catalog item can trigger the existing Automation Engine's "Stock Shortage Alert" rule to auto-draft a `material_requests` row within seconds**, which had to be cleaned up too (caught live when a first cleanup attempt hit an unexpected FK violation, investigated rather than assumed, confirmed via direct query before deleting anything). Final independent verification: all Phase 3 tables at 0 rows, `stock_levels` for the test product exactly at pre-test baseline (0/0/0) at all three warehouses, no automation-engine residue.

## 23. Bugs Found (all fixed this phase, in-scope per Workstream 20's Bug Discipline)

1. **`SALES_ROLES`/`DELIVER_ROLES` mobile-api literal-array gap** — `sales-staff`/`showroom-staff` held the `'sales'`/`'deliveries'` permissions but were 403'd on mobile sales/delivery routes specifically. Fixed.
2. **`valueAddedTimberCreate` never returned the created row's `id`** — every other `*Create` function does; caught live because the new Inspect flow (this phase's own addition) had nothing to act on immediately after create.
3. **VAT intake-budget double-counting** — the exact same rework-double-counting class of bug already found and fixed in Sawmill's `productionOffcutCreate`/`productionReconciliation` earlier this session existed independently in `valueAddedTimberCreate`'s and `vatInboundList`'s `intake_used` calculations. Fixed with the identical exclusion pattern.
4. **`qualityReport`'s two SQL subqueries inner-joined `production_offcuts`**, which would have silently excluded every VAT-origin inspection from company-wide Quality/Financial reporting. Fixed by filtering on `quality_inspections.workshop_id` directly (already frozen on the row since Phase 2) instead of joining through the Sawmill-specific table.
5. **`rejectionHoldsList`'s inner join on `production_offcuts`** would have hidden every VAT-origin rejection hold from the list entirely. Fixed with a LEFT JOIN + polymorphic `source` discriminator, regression-verified to still correctly surface Sawmill-origin holds unchanged.

## 24. Deferred Items (documented, not built — explicitly out of this phase's scope)

- Full desktop/mobile search/filter/saved-views on the new Rejection Holds/Showroom pages — not requested by this brief, belongs to the separate Enterprise UI/UX Standardization program if wanted.
- Mobile Downgrade and Firewood/Scrap/Internal-Use resolution for VAT/Showroom stay desktop-only (need a product picker / warehouse picker respectively) — same established "simple actions native, multi-field forms desktop" split as every prior phase.
- No approved cost-allocation method exists for value-added production's own transformation cost (kiln-drying/CCA-treatment labor+material cost) beyond the finished product's own `standard_cost` — documented, not invented, per Workstream 15's explicit instruction.
- `firewoodValue`'s live path for VAT/Showroom-origin resolutions wasn't independently exercised in this phase's scenarios (same code path already verified for Sawmill in Phase 2).

## 25. Production Readiness

**Ready**, with the deferred items in §24 as explicit, non-blocking follow-ups. Every new capability is live-verified against real inventory postings and fully reversed; the Automation Engine interaction discovered during testing is now a documented, understood behavior (not a defect) for anyone creating new catalog items in production.

## 26. Recommended Next Step

Per the brief's own Stop Rule: **do not begin another Timber Lifecycle phase** without separate review and approval. The natural next continuation, if approved, would address the parts of the Final Principle diagram this phase deliberately left generic-but-unexercised in some directions (e.g., a dedicated Showroom-specific sales UI beyond the existing generic Sales Orders tab, or a formal value-added transformation cost-allocation method) — but that decision belongs to the user, not this phase.
