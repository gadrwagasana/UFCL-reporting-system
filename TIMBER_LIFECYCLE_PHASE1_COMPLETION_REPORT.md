# Enterprise Timber Lifecycle Integration Program — Phase 1: Timber Lifecycle Foundation
## Completion Report

**Date:** 2026-08-07
**Scope:** Forest → Harvest Planning → Harvest Operation → Harvest Waste/Resolution → Transportable Logs → Log Transport → Raw Log Inventory → Sawmill Production → Production Offcuts/Resaw/Resolution → Quality Inspection. Explicitly stops short of Finished Timber Inventory, Nyanza, Showroom, and Sales — those belong to later phases. Not a redesign of Harvesting or Sawmill individually — this is the first cross-department pass connecting them into one continuous chain.

---

## 1. Executive Summary

Two genuinely new capabilities were built and connected into the existing pipeline: **Harvest Waste** as a first-class, auditable transaction (previously it did not exist anywhere — confirmed absent by direct schema audit before writing any code), and **Production Offcuts** with a Recoverable/Not-Recoverable decision tree feeding either a **Resaw → Quality Inspection** path or a shared **Resolution Engine** — the same engine both Harvest Waste and non-recoverable offcuts use, per the brief's explicit "build ONE reusable engine" instruction. Every transaction writes to the same `stock_catalog`/`stock_levels`/`stock_movements`/`audit_log`/notification architecture already established in Sawmill Phases 1–3 — no second inventory system, no second costing system, no duplicated business logic.

Two existing figures were integrated with the new data rather than left disconnected: `_rawLogAvailableStock` (the Sawmill production-intake gate) and `harvestDashboard`'s Raw Log Inventory figure both now net out recorded Harvest Waste, and `logTransportCreate` gained real validation (duplicate-receipt prevention, and a hard check that transport can never exceed harvested-minus-waste) — a genuine, confirmed gap the Workstream 3 audit found (transport previously had zero volume validation of any kind).

All 6 workstreams were live-verified end-to-end against production data with throwaway QA data, including every rejection path (over-limit waste, duplicate transport receipt, over-limit transport, double-resolution, over-limit recovery, over-limit inspection) — all correctly blocked. All QA data was then fully removed; every new table is confirmed empty and every existing table's figures are back at their exact pre-test baseline.

**Two scope decisions were made with your explicit input before implementation** (via AskUserQuestion): a real, generalized file-attachment subsystem was built (not deferred), and Quality Inspection mirrors the existing Poles Delivery QC shape (approved/rejected quantity split, no fabricated grade scale) rather than inventing a quality taxonomy that doesn't exist anywhere in this ERP.

---

## 2. Confirmed Architecture (no redesign)

```
Harvest Operation → Harvested Volume ─┬─ Harvest Waste → Resolution Engine
                                       └─ Transportable Logs → Log Transport → Raw Log Inventory
                                                                                     ↓
                                                                          Sawmill Production
                                                                                     ↓
                                                              Production Offcuts ─┬─ Recoverable → Resaw → Quality Inspection
                                                                                  └─ Not Recoverable → Resolution Engine (same engine)
```

Every arrow above is now backed by a real, validated, auditable transaction. `Harvested Volume = Transportable Logs + Harvest Waste` and `Intake = Finished Timber + Recovered Timber + True Waste` are both enforced identities, not just documentation — see §4 and §6.

---

## 3. Workstream 1 — Harvest Waste Management

New `harvest_waste` table (belongs to a harvest batch, records volume + auto-computed percentage + supervisor + reason + configurable category) and `harvest_waste_categories` (admin-extensible lookup, seeded with 6 defaults: Damaged in Felling, Rot/Decay, Undersized, Species Reject, Environmental Damage, Other). Every waste transaction writes `audit_log` and a notification. **Business rule enforced, not just stated**: a batch's cumulative recorded waste can never exceed its harvested volume — live-verified (a 280-log waste request against a 300-log batch with 30 already recorded was correctly rejected).

**Attachments** (per your explicit choice — built now, not deferred): a new generalized `attachments` table (polymorphic `entity_type`/`entity_id`) and a new `mobile-api/routes/attachments.js`, extending the exact multer + disk pattern the existing Supplier Documents feature already established (generalized, not copy-pasted — one route serves any future entity type, not just Harvest Waste). Desktop wiring reuses the existing `srm-documents:pick-file` dialog handler (already generic) and adds `attachments:list/upload/download/delete` IPC proxies following the identical HTTP-proxy pattern the SRM Document Center uses.

---

## 4. Workstream 2 — Harvest Resolution Engine

One function, `resolutionCreate`, shared by both `harvest_waste` and `production_offcut` sources (`source_type` distinguishes them) — not two separate engines. Destinations are exactly the brief's own enumeration: Firewood, Scrap Sale, Internal Use, Disposal, Other. Firewood/Scrap Sale/Internal Use carry recoverable value and post through the exact same `stock_catalog`/`stock_levels`/`stock_movements` bridge Sawmill Phase 1 built (reusing `_postFinishedTimberStock`, already fully generic despite its Sawmill-era name — no new posting logic was written). Disposal/Other post no stock movement, but the `resolution_records` row itself is the permanent audit trail — "no material may disappear" holds even when the final value is zero, because the ledger entry always exists and is queryable.

**Live-verified**: a Disposal resolution (no stock item created) and a Firewood resolution (auto-created a `stock_catalog` item, posted 15 units to `stock_levels` at the specified warehouse) both worked correctly; attempting to resolve an already-resolved record was correctly rejected.

---

## 5. Workstream 3 — Raw Log Inventory Validation

`logTransportCreate` previously had **zero** volume validation — any quantity could be transported regardless of what was actually harvested. Now:
- **Duplicate receipts**: an optional `receipt_reference`, unique per workshop when supplied (nullable — doesn't break existing free-form transport entries).
- **Volume consistency**: transport quantity can never exceed `harvested − already-transported − recorded waste` for that workshop.
- **Negative balances**: already prevented — `_rawLogAvailableStock`'s existing `Math.max(..., 0)` clamp, confirmed still correct, now also nets out Harvest Waste (a real integration point — waste logs were never going to reach the sawmill, so they now correctly reduce what's shown as available).

**Dashboard reconciliation**: `harvestDashboard`'s existing Harvested → Transported → Raw Log Inventory → Consumed by Sawmill pipeline view (built in an earlier Harvesting phase) now also shows Harvest Waste and Harvest Efficiency % alongside it — one place to see the whole chain.

**Live-verified**: transporting 999 logs against ~510 available was correctly rejected with the exact expected number; a valid 50-log transport with a receipt reference succeeded; a duplicate receipt reference was correctly rejected.

---

## 6. Workstream 4 — Production Waste & Resaw

New `production_offcuts` table: every offcut goes through a **Recoverable?** decision (`productionOffcutDecide`) before anything else happens to it — deliberately a separate, explicit transaction from `dailyCreate`/`dailyUpdate` (mirroring how Harvest Waste is separate from `harvestCreate`), so Sawmill Phase 1's already-verified production-entry workflow was never touched or put at risk.

- **Recoverable path**: `productionOffcutRecordRecovery` (assign a Resaw machine — reuses the existing, already-admin-extensible Machine Categories mechanism, zero schema change needed to register "Resaw" as a category — and record recovered quantity/dimensions) → `qualityInspectionCreate` (mirrors the Poles Delivery QC shape: approved/rejected quantity split, free-text rejection reason, inspector, timestamp — no fabricated grade scale, per your explicit choice).
- **Not-recoverable path**: routes through the same `resolutionCreate` Workstream 2 already built.

**Business rule enforced at every step**: an offcut's recovered quantity can never exceed its own quantity; inspection's approved quantity can never exceed the recovered quantity — both live-verified as rejected when violated.

Quality Inspection is the deliberate stopping point of this phase's scope — approved quantity is **not** posted to Finished Timber Inventory (that's explicitly a later phase's job per the brief).

---

## 7. Workstream 5 — Production Reconciliation

`productionReconciliation`: `Intake Volume = Finished Timber + Recovered Timber + True Production Waste`, computed per production entry. Per-record validations at every step (offcut quantity ≤ recorded waste; recovered ≤ offcut quantity; resolution volume ≤ offcut quantity) make it structurally impossible to record more volume than exists — the reconciliation view surfaces the aggregate status (any batch with untracked waste or an offcut still short of a terminal state) rather than duplicating those checks. Same `reconciled`/`mismatch` shape already established by `timberInventoryList`'s own reconciliation identity and `machineFuelSummary`'s per-machine reconciliation — reused, not reinvented.

**Live-verified exactly**: an 8-unit-waste production entry, split into a 5-unit recoverable offcut (4 recovered, 3 approved after inspection) and a 3-unit non-recoverable offcut (resolved to Disposal), reconciled to `finishedTimber: 5, recoveredTimber: 3, trueWaste: 3, untrackedWaste: 0, reconciled: true` — matching hand-calculation exactly.

---

## 8. Workstream 6 — Dashboards

- **Harvest** (`harvestDashboard`): Harvest Waste (today/week/month/total) and Harvest Efficiency % (Transportable ÷ Harvested — the direct complement of the brief's own identity).
- **Production** (`sawmillManagerDashboard`): Resaw Recovery % (recovered ÷ resawn input) and Net Yield % (finished + approved-recovered ÷ intake), plus a new alert type for offcuts still awaiting a Recoverable/Not-Recoverable decision.
- **Inventory**: Raw Log Inventory (already existed, now nets out waste — see §5); "Transport Pending" and "Production Pending" are directly visible via the existing pipeline widget's Waiting-for-Transport figure and the new offcuts pending-decision/pending-resaw/pending-inspection counts.
- **Executive**: deliberately **not** built as one blended "Enterprise Yield/Waste/Recovery" figure this phase — Harvest Waste (logs) and Production Waste (pieces) are incompatible units, and averaging two percentages from different bases would be a fabricated calculation, contrary to this program's own "use only available ERP data" principle. The honest, available figures (Harvest Efficiency %, Sawmill Recovery %, Resaw Recovery %, Net Yield %) are each visible on their own department dashboard today; a true unit-normalized (m³-based) enterprise rollup is flagged as a Phase 2 candidate in §11 rather than built as a shaky approximation now.

---

## 9. Live Verification Results (Workstream verification section)

Full chain verified against production data with throwaway QA data, then completely removed.

| Check | Result |
|---|---|
| Harvest → Harvest Waste (30/300 = 10%) | Exact |
| Waste over-limit rejection (280 vs 270 remaining) | Correctly rejected |
| Raw Log availability nets out waste (955→925) | Exact |
| Transport over-limit rejection (999 vs ~510 available) | Correctly rejected |
| Transport with receipt_reference | Succeeded |
| Duplicate receipt_reference | Correctly rejected |
| Resolution — Disposal (no stock posted) | Correct, `resolution_id` linked back to source |
| Resolution — already-resolved rejection | Correctly rejected |
| Resolution — Firewood (stock item auto-created, 15 units posted) | Exact |
| Production entry with timber_waste=8 | Correct |
| Offcut over-limit rejection (20 vs 8 recorded waste) | Correctly rejected |
| Offcut A: Recoverable → Resaw (4/5 recovered) → Inspection over-limit rejected → Inspection (3 approved/1 rejected) | Exact at every step |
| Offcut B: Not Recoverable → Resolution (Disposal) | Correct, status → `resolved` |
| Reconciliation: finished=5, recovered=3, trueWaste=3, untracked=0, reconciled=true | Exact hand-calculation match |
| `harvestDashboard` Harvest Waste + Efficiency % | Correct, includes this run |
| `sawmillManagerDashboard` Resaw Recovery % / Net Yield % | Computed correctly |
| Audit logs | 14 rows fired across all actions |
| QA cleanup | Every new table confirmed empty; `stock_levels`/`stock_catalog` back at exact pre-test baseline |

---

## 10. UI/UX

Desktop: Harvest Waste list + form on the existing Daily Harvest page; Production Offcuts/Resaw/Quality Inspection + Reconciliation on the Sawmill Dashboard (built in Sawmill Phase 3); one shared Resolution Engine modal reused by both. All markup reuses existing `.card`/`.mc`/`.dt`/badge classes — no new design system, no new CSS.

Mobile: new Harvest Waste screen (list + inline create form) off the Harvest list; Production Offcuts/Reconciliation cards added to the existing Sawmill Dashboard screen, using the shared `KpiCard`/`AlertBanner`/`EmptyState` components from the Enterprise UI/UX Standardization phase. **Scope note**: mobile keeps the multi-field actions (Record Recovery, Quality Inspection, and stock-recoverable resolutions needing a warehouse) pointed at desktop rather than building full picker-heavy forms for them on mobile this phase — the simpler, more common actions (Recoverable/Not-Recoverable decision, Disposal/Other resolution) work natively on mobile. This mirrors the same "simple actions here, complex multi-field forms on desktop" split already established for other mobile screens in this app.

---

## 11. Remaining Gaps / Deferred Recommendations

1. **Unit-normalized Enterprise Yield/Waste/Recovery** — a true company-wide figure needs everything expressed in a common unit (m³), which the current Harvest Waste (logs) vs. Production Waste (pieces) figures don't share. Recommend as a Phase 2 item once there's a clear, business-approved conversion basis (not just reusing the existing logs÷3.4 approximation for a purpose it wasn't designed for).
2. **Mobile multi-field forms** (Record Recovery, Quality Inspection, stock-recoverable resolutions) — deferred to desktop this phase, per §10.
3. **Attachments on Production Offcuts** — the generalized subsystem supports it (just add `'production_offcut'` to the entity-type whitelist and wire the UI), but wasn't wired into the offcuts UI this phase since the brief's explicit "support attachments" requirement was scoped to Harvest Waste specifically.
4. This phase's own explicit scope boundary — Finished Timber Inventory, Nyanza, Showroom, Sales — remains untouched, as instructed.

## 12. Recommendation for Phase 2

Per the brief's own diagram, the natural next segment is **Quality Inspection → Finished Timber Inventory**: connecting an approved, inspected batch of Recovered Timber into the same Finished Timber Inventory bridge Sawmill Phase 1/2 already built (reusing `_resolveProductForSize`/`_postFinishedTimberStock` again, not rebuilding), plus extending the reconciliation identity forward into that inventory. This is the most natural continuation and reuses more of what already exists than any alternative direction.

---

## STOP RULE

Per the brief, Phase 1 is complete and this report + `TIMBER_LIFECYCLE_PHASE1_CHANGELOG.md` are the deliverables. **Phase 2 has not been started** and will not begin until this report has been reviewed and explicitly approved.
