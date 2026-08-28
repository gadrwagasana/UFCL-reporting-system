# Timber Lifecycle Phase 2 — Sawmill Quality, Rejection & Finished Timber Inventory Integration

**Status: COMPLETE — live-verified against the production database, QA data fully removed, baseline confirmed restored.**

---

## 1. Objective

Complete the Sawmill segment of the Enterprise Timber Lifecycle that Phase 1 explicitly stopped short of:

```
Recovered Timber → QUALITY INSPECTION → Accepted → Finished Timber Inventory
                                       → Rejected → Rejection Resolution
                                                       (Rework / Downgrade / Scrap / Disposal / Return)
```

Guarantee, end to end: **no finished timber enters usable Finished Timber Inventory without passing Quality Inspection, and no rejected timber can disappear without an explicit resolution and inventory movement.**

Explicitly out of scope: redesigning Harvesting, Sawmill Phase 1's normal production path, Sales, Logistics, Procurement, Fleet, Workshops, or beginning Finished Timber Inventory → Nyanza → Showroom integration (Phase 3).

## 2. Architecture

```
Production Offcut ──(Recoverable)──► Resaw ──► Recovered Timber ──► QUALITY INSPECTION
                                                                          │
                                                        ┌─────────────────┴─────────────────┐
                                                        ▼                                   ▼
                                                    ACCEPTED                            REJECTED
                                                        │                                   │
                                                        ▼                                   ▼
                                          Finished Timber Inventory                 rejection_holds (new)
                                          (stock_catalog / stock_levels /                    │
                                           stock_movements — same bridge          ┌───────────┼──────────┬─────────┬─────────┐
                                           Sawmill Phase 1 already uses)          ▼           ▼          ▼         ▼         ▼
                                                                               Rework   Downgrade   Return    Scrap/    Disposal
                                                                                  │      (new prod.  to Inv.  Firewood  (write-off,
                                                                                  │       target)    (orig.   (existing  no stock
                                                                                  ▼                  product) Resolution move)
                                                                          new production_offcuts                Engine)
                                                                          row → re-enters Resaw →
                                                                          Quality Inspection AGAIN
```

Quality Inspection applies **only** to the Resaw/Recovered-Timber path Phase 1 introduced. Normal (non-offcut) Sawmill production keeps its original Phase 1 direct-to-inventory design — confirmed by direct code audit (Workstream 1), not assumed.

## 3. Existing Functionality Audited (Workstream 1)

Read `qualityInspectionCreate` and `_insertDailyLogItemsAndPostStock` from the live source before writing any code. Findings:

- Phase 1's `quality_inspections` table existed (approved/rejected split, rejection reason, inspector, notes) but had **no inventory linkage at all** — Accepted quantity was recorded and nothing else; there was no rejection-side entity distinct from a generic Production Offcut.
- Normal production (`dailyCreate` → `_insertDailyLogItemsAndPostStock`) posts directly to Finished Timber Inventory and never touches Quality Inspection — a real architectural fact, not a gap, and the boundary this phase had to respect.
- No `rejection_holds` table, no Rework/Downgrade/Return/Disposal-with-approval logic existed prior to this phase.

This became the scope anchor: Phase 2 closes the gap Phase 1 deliberately left open, without touching the already-verified normal-production path.

## 4. New Functionality

- **Inventory-linked Quality Inspection** — `qualityInspectionCreate` now resolves the recovered piece's Product Catalog match from its own recorded dimensions (same `_resolveProductForSize` lookup normal production uses), posts Accepted quantity to Finished Timber Inventory, and creates a `rejection_holds` row for any Rejected quantity instead of letting it silently vanish.
- **`rejection_holds`** (new table) — one row per rejected quantity from an inspection, `status ∈ {pending, rework, downgraded, returned, resolved}`, frozen `product_id`/`stock_item_id`/`workshop_id` for traceability.
- **Rework** — `rejectionResolveRework` creates a *new* `production_offcuts` row (`rework_of_rejection_id` linking it back), re-entering the exact same `pending_resaw → resawn → Quality Inspection` pipeline. The original hold is marked `rework`, never deleted or overwritten.
- **Downgrade** — `rejectionResolveDowngrade` posts the rejected quantity into a different, existing, active Product Catalog item a human selects. Original product history is untouched (nothing was ever posted for the rejected units in the first place — only Accepted quantity ever posts).
- **Return to Inventory** — `rejectionResolveReturnToInventory`: an explicit exception path for "the rejection itself was wrong," posting under the *original* product. Requires supervisor+ and a mandatory reason.
- **Firewood / Scrap Sale / Disposal** — reused Phase 1's existing Resolution Engine (`resolutionCreate`) by adding a third `source_type: 'rejected_timber'`, rather than building a second engine. Disposal requires supervisor+ approval (backend-enforced).
- **`qualityReport`** — Quality/Resolution/Financial reporting (Workstream 13), reading only real `quality_inspections`/`rejection_holds`/`resolution_records`/`products.standard_cost` rows.
- **Reconciliation extended** — `productionReconciliation` gained a second identity (`Produced = Accepted + Rejected`) and now also requires `unresolvedRejections === 0` to call a batch reconciled.

## 5. UI/UX Changes

**Desktop** (`renderer/app.js`, Sawmill Dashboard):
- "Inspect" action on Awaiting-Inspection offcuts (existing card, extended).
- New **Rejection Holds** card — status badges, and for `pending` rows: Rework / Downgrade (product-picker overlay) / Return (mandatory-reason overlay) / Resolve (Firewood/Scrap/Disposal via the existing `openResolutionModal`, extended for `rejected_timber`).
- New **Quality Report** card — KPI tiles, resolution breakdown, financial impact; wired into the CSV export.
- Production Reconciliation table extended with Accepted/Rejected columns.
- Production Offcuts table now shows "Rework of Rejection #N" on rework-descendant rows (closed a real traceability-visibility gap — see §14).

**Mobile** (`SawmillDashboardScreen.tsx`):
- "Inspect" action via `Alert.prompt` (approved qty is a single number — simple enough for mobile, unlike multi-field Record Recovery which stays desktop-only).
- New **Rejection Holds** card — Rework and Return run natively (Alert/Alert.prompt); Downgrade points to desktop (needs a product picker, matching the Record Recovery precedent); Firewood/Scrap/Disposal reuse the existing resolve flow.
- New **Quality Report** card.
- Same rework-lineage badge as desktop.

Both platforms read from the same backend functions — no parallel workflow was built.

## 6. Backend Changes

New: `rejectionHoldsList`, `rejectionResolveRework`, `rejectionResolveDowngrade`, `rejectionResolveReturnToInventory`, `qualityReport`. Extended: `qualityInspectionCreate`, `resolutionCreate`, `productionReconciliation`. New routes: `mobile-api/routes/rejectionHolds.js` (`GET /`, `POST /:id/rework`, `/:id/downgrade`, `/:id/return`, `GET /quality-report`). New Electron IPC + preload bridge for all five. New tables/columns: `rejection_holds`, `quality_inspections.{product_id,stock_item_id,workshop_id}`, `production_offcuts.rework_of_rejection_id`, `resolution_records.source_type` extended to allow `'rejected_timber'`.

## 7. Permission Changes

No new roles invented — reused the exact existing role set:
- Quality Inspection: `admin, ceo, operations, supervisor, sawmill-leader` (matches the existing Poles Delivery QC precedent).
- Downgrade / Disposal / Return to Inventory: `admin, ceo, operations, supervisor` — the higher-stakes, backend-enforced tier (confirmed live: a `sawmill-leader` user was denied all three, correctly, with the exact intended error message).
- Rework: same `canAccessDaily` gate as everything else on this workflow (no approval needed — sending material back for another pass is reversible and low-risk by nature).

`sawmill-leader`'s live `role_definitions` row was checked directly in the database (not assumed) to confirm it already carries `daily-timber` access, so the negative-permission tests below exercise the intended role-tier check rather than an unrelated page-access failure.

## 8. Inventory Movement Changes

**No new movement types were introduced.** `stock_movements.movement_type` remains exactly `'in'`/`'out'` — the same two values the entire rest of the app already uses. Every Phase 2 posting (`_postFinishedTimberStock`) differentiates itself purely through its `reference` string (e.g. `"Quality Inspection #8 — Offcut #9 — Daily Log #19"`, `"Downgrade — Rejection Hold #4"`, `"Return to Inventory — Rejection Hold #7"`) — this was a deliberate Workstream 8 requirement, verified by reading `_postFinishedTimberStock` before adding anything.

## 9. Rework Architecture

One rule made this structurally (not just procedurally) safe: **rejectionResolveRework always inserts a brand-new `production_offcuts` row and never updates an existing one.** That new row re-enters `pending_resaw → resawn → Quality Inspection` — there is no other path into `'inspected'`/stock-posted status, so the quality gate cannot be bypassed by construction, not by convention.

Live-verified two-cycle cascade (Scenario E): reject → rework → reject again produced two **distinct** `rejection_holds` rows (`id 13` and `id 14`) with two independently-readable rejection reasons ("QA: knot defect" vs "QA: still defective after rework"). Neither hold was overwritten or merged.

## 10. Rejection Resolution Architecture

| Path | Posts to | Approval | Notes |
|---|---|---|---|
| Rework | (none — re-enters pipeline) | none | new offcut, `rework_of_rejection_id` traces lineage |
| Downgrade | target product (different, existing, active) | supervisor+ | original product stock never touched |
| Return to Inventory | original product | supervisor+ | mandatory reason |
| Firewood / Scrap Sale | shared "Waste Byproduct — X" catalog item | none | reuses Phase 1's Resolution Engine, needs a warehouse |
| Disposal | none (write-off) | supervisor+ | no stock movement at all |

## 11. Reconciliation Results

Two real bugs were found and fixed via this section's own live testing (see §14) — both were the same root cause: **rework-descendant `production_offcuts` rows were being double-counted** wherever code summed offcut `quantity` without excluding `rework_of_rejection_id`. After the fix, live-verified on real data:

- `trackedOffcuts (24) == recordedWaste (24)` — exact match, no inflation from the two rework cycles.
- Mid-flight (one hold deliberately left `pending`): `unresolvedRejections = 3`, `reconciled = false` — proves the flag is genuinely computed, not hardcoded.
- After resolving that hold: `unresolvedRejections = 0`, `reconciled = true`.
- Second identity: `acceptedQty (12) + ...` matched hand-calculation exactly; `rejectedQty (17)` — a cumulative lifetime figure across every QC cycle including reworked units re-produced as later cycles' input — also matched hand-calculation exactly.
- `qualityReport`'s `totalProduced === totalAccepted + totalRejected` held exactly (29 = 12 + 17).

## 12. Desktop/Mobile Parity

| Capability | Desktop | Mobile |
|---|---|---|
| Quality Inspection (Accept/Reject) | ✅ | ✅ (Alert.prompt) |
| Rejection Holds list + status | ✅ | ✅ |
| Rework | ✅ | ✅ |
| Downgrade | ✅ | Desktop-only (needs product picker) |
| Return to Inventory | ✅ | ✅ |
| Firewood / Scrap / Internal Use | ✅ | Desktop-only (needs warehouse picker) |
| Disposal | ✅ | ✅ |
| Quality Report | ✅ | ✅ |
| Reconciliation (accepted/rejected columns) | ✅ | data available via same hook, not yet tiled on the mobile Reconciliation card |

Where mobile points to desktop, it's the same "simple actions natively, multi-field forms on desktop" split Phase 1 already established for Record Recovery — not a gap, a consistent pattern.

## 13. Live Verification Scenarios

All run against the production database with clearly-marked throwaway QA data (`remarks: 'QA-PHASE2-TEST'`), using a real admin user and a real `sawmill-leader` user (id 10) for negative permission tests. **61 assertions, all passing** on the final run:

| Scenario | Result |
|---|---|
| A — Normal Production → QC Accept → Inventory | ✅ exact quantity/reference/movement match |
| Duplicate submission (idempotency) on same offcut | ✅ second inspection attempt rejected, stock unchanged |
| D — QC Reject → Rework → QC Accept | ✅ split posting, rework offcut correctly linked and typed |
| E — QC Reject → Rework → QC Reject again | ✅ two distinct, independently-readable rejection histories |
| F — QC Reject → Downgrade | ✅ denied for sawmill-leader, succeeded for admin, target-only posting, full traceability recorded |
| G — QC Reject → Scrap Sale | ✅ posted to shared byproduct stock |
| H — QC Reject → Disposal | ✅ denied for sawmill-leader, succeeded for admin, confirmed zero stock movement (write-off) |
| Return to Inventory | ✅ denied for sawmill-leader, denied without reason, succeeded with reason, posted to original product |
| Duplicate resolution attempts | ✅ both rejected, no duplicate stock |
| J — Full reconciliation (both identities) | ✅ mid-flight unresolved state proven genuine, final fully-reconciled state confirmed |

Cleanup: FK-safe deletion (the circular FK between `production_offcuts.rework_of_rejection_id` and `rejection_holds.{production_offcut_id,rework_offcut_id}` was identified and broken correctly by nulling back-references before deleting). Independently re-verified afterward: `quality_inspections`, `rejection_holds`, `production_offcuts`, `resolution_records` all `0` rows; `stock_levels` for both test products exactly at pre-test baseline (`0`/`0`); the auto-created "Waste Byproduct" catalog item removed since nothing else referenced it.

## 14. Bugs Discovered (and fixed, per Workstream 16's Bug Discipline — all in-scope for this phase)

1. **Reconciliation double-counting (display-level)** — `productionReconciliation`'s `tracked_offcuts`/`unresolved_offcuts` summed `production_offcuts.quantity` across *all* rows for a daily log, including rework-descendants, which don't draw new budget from `timber_waste`. Could mask genuinely untracked waste behind the `Math.max(..., 0)` floor. **Fixed**: excluded via `filter (where rework_of_rejection_id is null)`.
2. **Same bug, live-blocking instance** — `productionOffcutCreate`'s own waste-budget check had the identical flaw, and by the fourth offcut in the test run it had inflated the "already tracked" figure enough to wrongly reject a legitimate offcut request (crashing the test downstream). **Fixed** with the same exclusion.
3. **Missing rework-lineage visibility** — `production_offcuts.rework_of_rejection_id` was written on every rework but never selected or shown in either UI, so a user browsing Production Offcuts couldn't tell a row was a rework-cycle continuation. **Fixed**: added to the query and rendered as a badge on both desktop and mobile.
4. **Disposal/scrap valuation structurally always zero** — `resolution_records.unit_cost` was only ever populated from an optional manual desktop field that Disposal's UI didn't even show, so `qualityReport.financial.{disposalValue,scrapValue,firewoodValue}` could never be non-zero for any source type. Since the rejected material's `standard_cost` is already known and frozen on the inspection row for `rejected_timber` specifically, **fixed** with a backend default in `resolutionCreate` — explicit manual entries still override, and the default deliberately does *not* overwrite the shared "Waste Byproduct" catalog item's price (that item is pooled across `harvest_waste`/`production_offcut`/`rejected_timber` sources with potentially different true values).

All four were caught by this phase's own audit-first (Workstream 1) and live-testing (Workstream 15/17) discipline, not assumed away.

## 15. Deferred Issues (documented, not fixed — out of this phase's scope)

- Mobile Reconciliation card doesn't yet tile the new Accepted/Rejected columns (data is already flowing through the same hook; a small follow-up, not a defect).
- Desktop/mobile don't expose a dedicated "Quality Inspection history" list independent of the Production Offcuts table's inline per-offcut status — judged adequate for this phase (every inspection's outcome is visible inline) rather than building a new screen.
- Full desktop UX polish items from the brief (search/filter, saved views, arrow-key nav on the Rejection Holds table) were not built — this phase is a different, narrower brief than the Enterprise UI/UX Standardization program; those items belong there if wanted.
- `firewoodValue` remains untested live (no Scenario used Firewood as a destination) — the same code path as the now-fixed `scrapValue`, so it's expected to work identically, but wasn't independently exercised.

## 16. Security/Integrity Notes

- Every approval-tier check is backend-enforced (verified live: a `sawmill-leader` user was denied Downgrade, Disposal, and Return to Inventory with the correct error each time) — not a UI-only gate.
- No duplicate-posting path exists: both offcut-level (`status` state machine) and hold-level (`status !== 'pending'` guard) structurally block re-submission; live-verified twice (duplicate inspection, duplicate resolution) with zero stock drift.
- A pre-implementation runtime-integrity audit was also run this session after an unrelated suspicious dependency-output message surfaced (`dotenv`'s own promotional "tip" text, not application code) — fully investigated and documented separately in `TIMBER_LIFECYCLE_RUNTIME_INTEGRITY_AUDIT.md`; concluded safe to continue, no code or packages were changed as a result.

## 17. Production Readiness

**Ready**, with the deferred items in §15 as explicit, non-blocking follow-ups. All new functionality is live-verified against real inventory postings and reversed cleanly; no schema, permission, or workflow change reached outside the Sawmill/Inventory boundary this phase was scoped to.

## 18. Recommended Next Step

Per the brief's own Stop Rule: **do not begin Phase 3** (Finished Timber Inventory → Stock Transfer → Nyanza → Value-Added Production → Showroom) without separate review and approval. Recommended before that review: close the two deferred UI items in §15 (mobile reconciliation columns, firewood live-check) as a very small follow-up, since they're cheap and already scoped by this phase's own work.
