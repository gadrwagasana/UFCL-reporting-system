# Stock & Inventory Phase 1 — Changelog

## Summary

Closed all 5 confirmed Workshop Isolation findings from `STOCK_INVENTORY_ENTERPRISE_AUDIT.md` (C-10, C-11, H-04, H-05, M-17), covering 11 backend functions across Showroom Damage, the Resolution Engine, the Sawmill/VAT quality-inspection chain, Harvest Waste, and stock-movement deletion. Every fix reuses the existing `isWorkshopRestricted(user)` idiom already used throughout `db/services/data.js`. No schema change, no new isolation mechanism, no workflow/approval/notification/audit/valuation redesign. Nothing committed or pushed.

## Files changed (1 total)

### Modified

- **`db/services/data.js`** — 11 functions, each independently re-verified against current source before fixing:
  - `showroomDamageReportCreate` (C-11) — added workshop check on `p.warehouse_id` before the transaction.
  - `showroomDamageReportsList` (C-11) — added read-side workshop filter.
  - `resolutionCreate` (H-04) — added (a) source-record workshop validation across all 4 source types, (b) forced `p.warehouse_id = user.workshop_id` for restricted users, closing a destination-redirect gap specific to `harvest_waste`/`production_offcut` source types.
  - `resolutionsList` (H-04) — added read-side workshop filter.
  - `stockMovementsDelete` (C-10) — added workshop check against both `warehouse_id` and `to_warehouse_id`.
  - `productionOffcutCreate` (H-05) — added workshop check on the source `daily_log.workshop_id`.
  - `productionOffcutDecide` (H-05) — added workshop check on `production_offcut.workshop_id`.
  - `productionOffcutRecordRecovery` (H-05) — added workshop check on `production_offcut.workshop_id`.
  - `qualityInspectionCreate` (H-05) — added workshop check on `production_offcut.workshop_id`.
  - `vatQualityInspectionCreate` (H-05) — added workshop check on `value_added_timber.workshop_id`.
  - `harvestWasteCreate` (M-17) — added workshop check on the source `harvest_log.workshop_id`.

## Verification performed

- `node --check db/services/data.js` — clean, re-run after every edit and once more as a final pass.
- No `.ts`/`.tsx` file touched — `tsc --noEmit` not applicable this phase.
- 29/29 live production-database checks (positive + negative, all 11 functions, 3 workshops, real accounts).
- 14/14 Stock Transfer regression checks (Gatare→Nyanza→Showroom full lifecycle + cross-workshop denial).
- 5/6 Timber Lifecycle regression checks (1 non-pass was a pre-existing, unrelated business rule — see completion report §9).
- `git diff --stat db/services/data.js` confirms this is the only file changed this phase.

## Live QA data — full lifecycle

| Action | Detail |
|---|---|
| Created | Throwaway fixtures only: `daily_logs` (×3), `production_offcuts` (×3), `quality_inspections` (×3), `rejection_holds` (×4), `value_added_timber` (×1), `harvest_waste` (×2), `showroom_damage_reports` (×1), `resolution_records` (×2), `stock_movements`/`stock_transfers`/`stock_transfer_dispatches` for the transfer-lifecycle regression |
| Purpose | Live-confirm both the positive (same-workshop succeeds) and negative (cross-workshop denied before any mutation) case for every fixed function, plus full-lifecycle regression of Stock Transfers and the Timber Lifecycle chain |
| Real data touched | None — all fixtures referenced only real, read-only parent records (`daily_log #22`, `harvest_log #1`), both confirmed untouched after cleanup |
| Cleaned up | All rows hard-deleted in FK-safe order (`rejection_holds` → `resolution_records`/`quality_inspections` → `production_offcuts` → `daily_logs`/`value_added_timber`; stock-posting side effects reversed via direct `stock_levels` correction before deletion) |
| Independently re-verified | Fresh `COUNT`/`SELECT` queries after each cleanup pass: 0 leftover rows for every entity type; all `stock_levels` restored to exact pre-test baseline |
| QA accounts | None created — all test actors were real, existing accounts across every required role/workshop |

## Bugs found

1. `showroomDamageReportCreate`/`List` had no Workshop Isolation check — a restricted user could report damage against (and see damage reports for) another workshop's stock. **Fixed.**
2. `resolutionCreate` had no Workshop Isolation check across any of its 4 source types. **Fixed.**
3. A secondary, related gap within the same function: even with the source validated, a restricted caller could still redirect the recovered-value posting to a foreign warehouse for the `harvest_waste`/`production_offcut` source types. **Fixed in the same pass**, once found during re-verification (not named separately in the original audit).
4. `resolutionsList` had no Workshop Isolation check. **Fixed.**
5. `stockMovementsDelete` had no Workshop Isolation check (only an unrelated ownership/time-window governance check). **Fixed.**
6. The entire Sawmill/VAT offcut-resaw-QC chain (5 functions) had no Workshop Isolation check. **Fixed.**
7. `harvestWasteCreate` had no Workshop Isolation check on write, despite its sibling read function (`harvestWasteList`) already being correctly isolated. **Fixed.**

## Explicitly not done this phase (per Stop Rule and scope boundary)

- No Workshop Isolation redesign — every fix reuses the exact existing `isWorkshopRestricted` idiom.
- No new isolation mechanism, table, column, role, or permission concept.
- No Stock Transfer, Resolution Engine, Quality Inspection, or notification/approval/audit workflow redesign.
- No UI, IPC, or REST route file was modified — all 11 fixes are backend-only, in `data.js`.
- All non-Workshop-Isolation findings from the audit (C-01–C-09, H-01/H-03/H-07–H-13, all Medium/Low findings) remain open, undocumented-as-fixed, and untouched — reserved for Phase 2 or later.
- Phase 2 ("Sales & Stock Integrity") has not been started.

## Next step

Per the phase's Stop Rule: this phase is complete and stops here, awaiting explicit review and approval. Recommended next phase: Phase 2 ("Sales & Stock Integrity"), starting with the audit's Critical Sales findings (C-03 negative-quantity acceptance, C-04 TOCTOU-racy availability check, C-05 no stock-reversal path on sale edit/delete/reject) — the highest-severity cluster not yet addressed anywhere in this program.
