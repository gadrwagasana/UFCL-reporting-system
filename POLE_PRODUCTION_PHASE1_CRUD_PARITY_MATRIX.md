# Pole Production Phase 1 — CRUD Parity Matrix

Legend: ✅ Complete · ⚠️ Partial (real, deferred) · ❌ Missing · N/A Intentionally out of this phase's scope (business decision pending)

## Purchased Raw Logs (existing, unchanged this phase)

| Capability | Backend | Desktop | Mobile | Notes |
|---|---|---|---|---|
| Purchase Request — Create | ✅ | ✅ | ✅ | Unchanged |
| Purchase Request — List/Read | ✅ | ✅ | ✅ | Unchanged |
| Purchase Request — Approve/Reject (CEO) | ✅ | ✅ | ✅ | Unchanged |
| Delivery — Create | ✅ | ✅ | ✅ | Unchanged |
| Delivery — Quality Check (inline approve/reject split) | ✅ | ✅ | ✅ | Unchanged |
| Raw Log balance (virtual, pooled) | ✅ | ✅ | ✅ | Extended (not redefined) to also account for new batch consumption |

## Pole Production — Manufactured Poles (Path A, this phase's build)

| Capability | Backend | Desktop | Mobile | Status |
|---|---|---|---|---|
| Production Batch — Create | ✅ `poleProductionBatchCreate` | ✅ | ✅ | Complete |
| Production Batch — List/Read | ✅ `poleProductionBatchesList` | ✅ | ✅ | Complete |
| Production Batch — Delete (pre-inspection only) | ✅ `poleProductionBatchDelete`, governed | ✅ | ❌ (route + hook exist, no UI button) | Desktop complete, mobile deferred |
| Production Batch — Update | Not built (matches the Nyanza precedent — batches aren't edited after creation, only their output lines progress through QC) | N/A | N/A | Intentional, matches established pattern |
| Multi-spec Output Lines | ✅ | ✅ | ✅ | Complete — real Product Catalog items, never hardcoded |
| Quality Inspection — Accept/Reject | ✅ `poleProductionInspect` | ✅ | ✅ | Complete |
| Real Finished Pole Inventory posting | ✅ (via existing `_postFinishedTimberStock`) | Reflected via existing Stock/Sales screens | Reflected via existing Stock/Sales screens | Complete |
| Rework | ✅ (`rejectionResolveRework`, 3rd branch) | ✅ (existing shared `_loadRejectionHolds` component) | ❌ | **Backend complete, mobile UI gap** — see below |
| Downgrade | ✅ (already generic, zero code changes) | ✅ (existing shared UI) | ❌ | **Backend complete, mobile UI gap** — see below |
| Return to Inventory | ✅ (already generic, zero code changes) | ✅ (existing shared UI) | ❌ | **Backend complete, mobile UI gap** — see below |
| Firewood / Scrap Sale / Disposal / Other | ✅ (already generic, zero code changes) | ✅ (existing shared UI) | ❌ | **Backend complete, mobile UI gap** — see below |
| Resolution History (browse past resolutions) | ✅ (`resolutionsList`, existing) | ✅ (new "Resolution History" button, reusing `openResolutionHistoryModal`) | ❌ (pre-existing gap, not specific to Poles — see prior phase's register) | Desktop complete |
| Production Reconciliation | ✅ `poleProductionReconciliation` | ✅ | ✅ | Complete |
| Sale (manufactured pole) | ✅ (already generic `salesCreate`) | ✅ (already existed) | ✅ (already existed) | Complete — was already working, just needed real stock to sell against |
| Stock Transfer (manufactured pole) | ✅ (already generic) | ✅ (already existed) | ✅ (already existed) | Complete, unchanged |

### Mobile Resolution UI Gap — Detail

Checked directly: the existing mobile Rework/Downgrade/Return-to-Inventory/Firewood/Scrap/Disposal UI is not a shared, generic component — it is embedded per-department inside `SawmillDashboardScreen.tsx` and `VatProcessingScreen.tsx` specifically (confirmed via a repo-wide search for the relevant hook call sites). Poles has no equivalent embedded resolution UI on mobile. This means:

- The **backend** is fully generic and confirmed live-working for poles-origin rejection holds with zero code changes (proving the reuse succeeded architecturally).
- **Desktop** has full UI access via the new Rejection Holds card (reusing `_loadRejectionHolds`, which was already generic enough to accept `'poles'` as a third source type).
- **Mobile** currently has no screen where a poles-origin rejection can be acted on. A mobile user who rejects poles at inspection would need to switch to desktop to resolve it.

This is flagged as a genuine, correctly-scoped follow-up (either embed the existing `useTimberLifecycle.ts` hooks into a new Poles-specific screen mirroring the Sawmill/VAT pattern, or generalize the pattern into a shared component any department could reuse), not a defect in this phase's own build, and not silently omitted from this documentation.

## Purchased Finished Poles (Path B — not built this phase)

| Capability | Backend | Desktop | Mobile | Status |
|---|---|---|---|---|
| Purchase via generic Requisition → PO → Goods Receipt | ✅ (already exists, confirmed working for any Product Catalog item) | ✅ (already exists) | ✅ (already exists) | Structurally achievable today, not exercised specifically for Poles in this phase |
| Explicit Quality Inspection gate before sale | Not built — would require changes to the shared Goods Receipt function used by every procurement category | N/A | N/A | **Requires business decision** — see completion report §25 |
| Provenance tracking (purchased vs. manufactured) | Not built | N/A | N/A | Would be designed alongside the QC-gate decision above |

## Cross-Cutting Fix

| Item | Backend | Status |
|---|---|---|
| `dispatchReview` workshop-isolation gap (global `mv_stock_summary` used instead of workshop-scoped `mv_stock_by_workshop`) | ✅ Fixed | Affects Timber and Poles dispatch gating equally; found during this phase's Workshop Isolation audit, unrelated to the new Pole Production build itself |

## Summary Tally

| Category | Count |
|---|---|
| ✅ Complete (backend + desktop + mobile) | 11 (batch CRUD read/create, output lines, inspection, inventory posting, reconciliation, sale, transfer, raw log purchase flow — unchanged items) |
| ⚠️ Backend complete, desktop complete, mobile gap | 4 (Rework, Downgrade, Return-to-Inventory, Firewood/Scrap/Disposal — all share the same one root cause: no shared mobile resolution UI) |
| ❌ Mobile-only gap (isolated) | 1 (batch delete) |
| N/A — requires business decision, not built | 2 (Purchased Finished Poles QC gate + provenance, unit_price→costing linkage) |
| Fixed (cross-cutting, found during audit) | 1 (`dispatchReview` isolation gap) |
