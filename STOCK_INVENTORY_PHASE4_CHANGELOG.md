# Stock & Inventory Phase 4 — Changelog

## Summary

Closed the remaining actionable Inventory backlog from `STOCK_INVENTORY_ENTERPRISE_AUDIT.md`: 9 findings fixed (H-01, H-09, H-10, H-11, H-12 ×3 sites, H-13, M-07, M-14, M-15, M-16), all reusing existing, already-proven patterns. Two findings that appeared to be simple bugs were re-investigated against current source and found to be deliberate prior-phase decisions or genuine business-clarification questions — reclassified and documented rather than "fixed" incorrectly (H-03, H-07). A new, small historical-data finding (3 leftover QA stock-catalog items from an earlier Mechanician phase) was discovered and documented, not silently corrected. No schema change, no Workshop Isolation redesign, nothing committed or pushed.

## Files changed (7 total)

### Backend
- **`db/services/data.js`**:
  - `stockItemsList` (H-09) — deactivated items with nonzero `stock_levels` quantity remain visible (both the workshop-restricted and company-wide query branches); zero-stock deactivated items remain correctly hidden.
  - `warehousesDelete` (H-10) — new `_warehouseUsageCount` helper (mirrors `_stockItemUsageCount`'s established pattern) blocks deletion of a warehouse with real stock/movement/transfer/material-request history, returning a controlled error instead of an uncaught crash or silent orphaning.
  - `materialRequestsApprove` (H-11) — approved quantity can no longer exceed the originally requested quantity (partial approval below the requested amount is unaffected).
  - `resolutionCreate` (M-07) — the Disposal supervisor-approval-tier gate now applies to all 4 source types (`harvest_waste`, `production_offcut`, `rejected_timber`, `showroom_damage`), not just `rejected_timber`.
- **`db/migrate.js`** (M-14) — `harvesting-leader`'s declarative permission list now includes `'material-requests'`, matching its sibling leader roles (`sawmill-leader`/`poles-leader`/`vat-leader`). Applied to the live `role_definitions` row directly as well (declarative-source + live-DB two-step, same pattern as every other permission-grant fix in this program).

### Mobile API
- **`mobile-api/routes/stock.js`** (H-01) — `INVENTORY_ROLES` now includes `'ceo'`, matching CEO's actual live `role_definitions` grant (the prior removal was based on a since-invalidated assumption).
- **`mobile-api/routes/stockTransfers.js`** (M-15) — `ACT_ROLES` now includes `showroom-staff`/`vat-leader`/`vat-supervisor`, all three confirmed to hold `stock-transfers` live but previously 403'd.

### Desktop
- **`renderer/app.js`**:
  - `renderStockTransfers`'s `canAct` list (M-16) — same 3 roles added, matching the mobile-api fix and closing the "hidden button, not real enforcement" gap the audit named.
  - `deleteStockItem`, `openStockItemEditOverlay` (Stock Catalog delete/edit), and the Stock Movements delete handler (H-12) — all 3 now use `handleGovernanceResult()` instead of a plain `showOverlayError`, so a governance-deferred action shows "pending approval" instead of a blank/undefined message.

### Mobile
- **`mobile/src/utils/permissions.ts`** (M-15/M-16) — `showroom-staff`, `vat-leader`, `vat-supervisor` now include `'transfer.view'`/`'transfer.act'` in their client-side permission map, matching the backend/mobile-api fix.
- **`mobile/src/screens/showroom/ShowroomScreen.tsx`** (H-13) — the two chained `Alert.prompt` calls (quantity, then reason) for damage reporting, which is iOS-only and silently dead-ends on Android, replaced with the existing cross-platform `ReasonModal` component (already used by 14 other screens), using its `extraContent` slot for the quantity field.

## Verification performed

- `node --check` on all 5 touched backend/desktop `.js` files — clean.
- `npx tsc --noEmit` on the mobile project — clean.
- 11/11 live production-database checks for this phase's own fixes (H-09, H-10, H-11, M-07, M-14, H-01), using throwaway QA data exclusively.
- 13-function regression smoke test (Sales, Deliveries, Stock Transfers, Timber Lifecycle, Resolution Engine, Stock Catalog, Timber Inventory, Governance, Warehouses, Material Requests) — all pass.
- `git status` confirms exactly these 7 files changed.

## Live QA data — full lifecycle

| Action | Detail |
|---|---|
| Created | Throwaway `stock_catalog` items, `warehouses` (2, both clearly QA-tagged), `material_requests`, `harvest_waste`, `resolution_records` — all tagged `QA-SIP4*` |
| Real data touched | None — H-10's "warehouse with real usage is blocked" case was deliberately tested against a **throwaway QA warehouse with seeded stock**, never against Gatare/Nyanza/Showroom, even though the fix was expected to correctly deny the real case too; independently re-confirmed the real Gatare warehouse (id 3) is unchanged after testing |
| Cleaned up | All QA rows hard-deleted in FK-safe order (one cleanup-ordering mistake in the test script itself — not the underlying code — was caught, corrected, and re-verified) |
| Independently re-verified | Fresh `COUNT` queries after cleanup: 0 leftover rows for every QA-tagged entity type |
| QA accounts | None created — all test actors were real, existing accounts across the required roles |
| Permission grant verified live | `harvesting-leader`'s `role_definitions.permissions` confirmed to include `'material-requests'` after the fix |

## Bugs found

1. `mobile-api/routes/stock.js`'s `INVENTORY_ROLES` excluded `ceo` despite CEO holding the `inventory` permission live — the prior fix's own justification (that migrate.js never granted it) is no longer true. **Fixed.**
2. `stockItemsList` hid deactivated stock-catalog items unconditionally, even when they still carried real, nonzero `stock_levels` quantity — 3 real items, 30 units, confirmed live. **Fixed.**
3. `warehousesDelete` had no usage guard at all — could throw an uncaught FK-violation crash, or silently orphan references. **Fixed.**
4. `materialRequestsApprove` had no ceiling on approver-supplied quantity — an approver could grant more than was ever requested. **Fixed.**
5. `resolutionCreate`'s Disposal approval-tier check only applied to the `rejected_timber` source type — the same write-off action for `harvest_waste`/`production_offcut`/`showroom_damage` required no elevated approval. **Fixed.**
6. `harvesting-leader` was the one production-department leader role without `material-requests`, unlike its 3 sibling leader roles. **Fixed.**
7. Mobile-api's Stock Transfers `ACT_ROLES` and desktop's matching `canAct` list both excluded `showroom-staff`/`vat-leader`/`vat-supervisor`, despite all 3 holding the `stock-transfers` permission live. **Fixed** in both places, plus the mobile client-side permission map (a third, previously-unaudited layer of the same drift).
8. 3 desktop Stock Catalog/Stock Movements delete/edit flows showed a blank error instead of a "pending approval" message when governance deferred the action. **Fixed.**
9. Mobile Showroom's damage-report quantity/reason capture used `Alert.prompt`, which has no Android implementation — a silent dead end for Android users. **Fixed** for Showroom specifically.
10. **Found via re-investigation, not "fixed" as a bug**: the raw-log availability formula (H-03) does not net out transported quantity — re-reading its own code comment revealed this is a deliberate design choice from an earlier phase, not an oversight. Left unchanged.
11. **Found via re-investigation, not "fixed" as a bug**: fuel logs are structurally disconnected from the stock ledger (H-07) — investigated and found that auto-wiring this would likely corrupt the Diesel Fuel warehouse stock figure, since the data model (per-fill cost capture) indicates external purchases, not warehouse draws. Documented as requiring a business decision, not implemented.
12. **New historical-data finding**: 3 stock-catalog items (`_QA_MECH_P2_ITEM`, `_QA_MECH_P3_ITEM`, `_QA_MECH_TEST_ITEM`) are leftover QA residue from an earlier Mechanician phase, never cleaned up — the exact 30 "stranded units" the audit's H-09 finding cited. Documented with an exact proposed correction, not applied without approval.

## Explicitly not done this phase (per Stop Rule and Bug Discipline)

- No Workshop Isolation redesign — every permission fix widens toward the existing `role_definitions` grant, never beyond it.
- No new approval system, stock ledger, or notification/audit architecture.
- No schema change.
- Sales, Stock Transfer core workflow, Timber Lifecycle, Harvesting, Sawmill, VAT, Showroom, Resolution Engine, and Standard Cost/pricing architecture were not touched or redesigned.
- H-03 was investigated and deliberately left unchanged (intentional design).
- H-07 (fuel half) was investigated and deliberately left unimplemented, pending a business decision.
- The 16-unit historical discrepancy and the newly-found 3 QA stock-catalog items remain unapplied, both awaiting explicit approval.
- The 3-role mobile navigation gap for Stock Transfers (M-15/M-16's remaining piece) is documented, not built — out of proportion to this specific fix.
- 7 other files sharing H-13's `Alert.prompt` pattern outside Inventory's scope were documented, not fixed.
- M-01, M-02b (confirmed correct, no action needed), M-04, M-05, M-08, M-09, M-10, M-11, M-12, M-13, M-18, and all Low findings remain open/deferred exactly as classified in §2 of the completion report.

## Next step

Per the phase's Stop Rule: this phase is complete and stops here, awaiting explicit review and approval — including the two outstanding historical-data corrections (16-unit discrepancy from Phase 2, and the 3 `_QA_MECH_*` items found this phase) and the fuel-consumption business-clarification question raised in §6 of the completion report. No further phase has been started automatically.
