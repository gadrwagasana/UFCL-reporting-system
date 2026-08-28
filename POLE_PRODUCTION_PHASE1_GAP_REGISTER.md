# Pole Production Phase 1 — Gap Register

| # | Finding | Category | Severity | Action |
|---|---|---|---|---|
| 1 | No distinct Pole Production batch/output concept — just `daily_logs.poles_units` counter, no per-spec breakdown | C (intended, UI/backend gap) | Critical | **Fixed** — `pole_production_batches`/`outputs` built |
| 2 | Poles QC never touched shared `quality_inspections`/`rejection_holds` engine — zero access to Rework/Downgrade/Return/Firewood/Scrap/Disposal | C | Critical | **Fixed** — third polymorphic source column added, `poleProductionInspect` built, `rejectionResolveRework` extended |
| 3 | No real Finished Pole Inventory — Sales could select "Poles" but `stock_levels` for the one real Poles product had zero rows ever | E (broken — UI/data promises inventory that never existed) | Critical | **Fixed** — `poleProductionInspect` posts via existing `_postFinishedTimberStock` |
| 4 | Downgrade/Return-to-Inventory resolution for poles-origin holds | C (would-be gap) | — | **Confirmed already generic — zero code changes needed**, verified live |
| 5 | Purchased Finished Poles (Path B) has no distinct capability today | G (new capability, but achievable via existing infrastructure) | Medium | **Not built** — confirmed structurally achievable via existing Requisition→PO→Goods Receipt; one open question (QC gate) — requires business decision |
| 6 | `poles_purchase_requests`/`poles_deliveries` is a fully separate purchasing pipeline, never integrated with generic Procurement | F (intentionally platform/architecture-specific, pre-existing) | — | **Not touched** — live, working system with real history; migrating it is a major undertaking, requires business decision |
| 7 | Raw Log Inventory is virtual/computed, never a real stock ledger row | F (confirmed consistent with existing pattern) | — | **Not a gap** — matches Timber's own `_rawLogAvailableStock` design exactly |
| 8 | `dispatchReview` dispatch-quantity gate read the global `mv_stock_summary` instead of the workshop-scoped `mv_stock_by_workshop` | Workshop Isolation gap (unrelated pre-existing bug, found during this audit) | Medium | **Fixed** |
| 9 | `poles_deliveries.unit_price` never feeds Product Catalog `standard_cost` | B (backend/process gap) | Low | **Not built** — no defined costing/BOM model exists to build this on; requires business decision |
| 10 | Volume-based Production Recovery % not computable | Data gap, not a code gap | Low | **Documented, not fabricated** — raw log purchase records capture piece count only, never per-log dimensions; recovery reported as a piece-count ratio instead, with the reasoning stated in the API response itself |
| 11 | Legacy `daily_logs.poles_units` entry path coexists with the new batch system | Transitional state, not a defect | — | **Kept as-is** — both draw from the same pooled raw-log balance; retiring the legacy path is a future business decision, not attempted |
| 12 | Mobile Poles tab bar already has 10 tabs | UX consideration, not a defect | — | **Resolved by design** — new screens nested into the existing Production stack via a stack push, not an 11th tab, matching the Sawmill precedent |

## Classification Summary

| Classification | Count | Items |
|---|---|---|
| Fixed this phase | 4 | #1, #2, #3, #8 |
| Confirmed already generic/working, zero changes | 1 | #4 |
| Confirmed intentional/consistent, not a gap | 2 | #6 (partially — pipeline itself), #7 |
| Requires business decision, documented not built | 4 | #5, #6 (migration question), #9, #11 |
| Data gap, honestly documented not fabricated | 1 | #10 |
| Non-issue, resolved by design choice | 1 | #12 |

## CRUD/Action Completeness — Manufactured Poles (Path A, this phase's build)

| Capability | Backend | Desktop | Mobile | Status |
|---|---|---|---|---|
| Create production batch | ✅ `poleProductionBatchCreate` | ✅ | ✅ | Complete |
| List/read production batches | ✅ `poleProductionBatchesList` | ✅ | ✅ | Complete |
| Delete production batch (pre-inspection only) | ✅ `poleProductionBatchDelete`, governed | ✅ | ⚠️ (route + hook exist, no explicit delete UI on mobile list screen) | Desktop complete, mobile delete deferred |
| Multi-spec output lines | ✅ | ✅ | ✅ | Complete |
| Quality Inspection (accept/reject) | ✅ `poleProductionInspect` | ✅ | ✅ | Complete |
| Rework | ✅ (`rejectionResolveRework` 3rd branch) | ✅ (existing shared `_loadRejectionHolds` UI, now wired into the Poles page) | ❌ | Desktop complete; **mobile gap found during documentation** — see note below |
| Downgrade / Return-to-Inventory / Firewood / Scrap / Disposal | ✅ (already generic, live-verified) | ✅ (existing shared UI) | ❌ | Backend fully generic (zero code changes, live-verified); **mobile gap found during documentation** — see note below |
| Reconciliation | ✅ `poleProductionReconciliation` | ✅ | ✅ | Complete |
| Real Finished Pole Inventory | ✅ (via `_postFinishedTimberStock`) | N/A (reflected via existing Stock/Sales screens) | N/A | Complete |
| Sale of manufactured pole | ✅ (already generic `salesCreate`) | ✅ (already existed) | ✅ (already existed) | Complete, was already working once real stock exists |
| Stock Transfer of finished pole | ✅ (already generic) | ✅ (already existed) | ✅ (already existed) | Complete, unchanged |

**Note on mobile Delete/Rework/Resolution UI — a real gap found while documenting, not fixed this phase**: this phase's `PoleBatchListScreen.tsx` does not include an inline batch-delete button (desktop has one). More significantly: checked directly (`grep` for rejection-hold action call sites across `mobile/src`) and confirmed the existing mobile Rework/Downgrade/Return-to-Inventory/Firewood/Scrap/Disposal UI is **not a shared, generic screen** — it's embedded per-department inside `SawmillDashboardScreen.tsx` and `VatProcessingScreen.tsx` specifically. Poles has no equivalent embedded resolution UI on mobile, so despite the backend being fully generic and live-verified working for poles-origin holds, **mobile users currently have no screen to act on a rejected pole** (desktop users do, via the new Rejection Holds card on the Daily Poles page). This is a genuine, correctly-scoped follow-up: either embed the existing `useTimberLifecycle.ts` resolution hooks into a Poles-specific screen (mirroring the Sawmill/VAT pattern exactly), or generalize the pattern into a shared component reachable by any department — both are reasonably-sized, well-understood next steps, not attempted in this already-large phase.
