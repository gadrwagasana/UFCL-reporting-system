# ERP Data Integrity Remediation Phase 7 — Changelog

## Summary

Resolved the 4 historical-data items carried forward from the Enterprise Completion program. **No application code was changed** — this was a data-correction-only phase. 3 of the 4 items required and received explicit user approval before any production data was modified; the 4th (the 16 `_stabtest_*` accounts) was found to already be fully resolved. Two smaller, previously-undocumented QA-residue items were discovered during investigation and disclosed, not acted on (outside this phase's explicit scope). Nothing committed or pushed.

## Files changed

**None.** Zero application code was modified. All changes in this phase are production database corrections, applied via a combination of existing application functions (`stockMovementsDelete`, `trashPurge`) and direct, individually-verified SQL statements for the parts those functions couldn't correctly handle (explained in full in the completion report §2).

## Corrections applied

1. **DATA-01 (Finished Timber -16 mismatch)**: purged 4 confirmed-orphaned `stock_movements` rows (ids 94, 97, 99, 102 — a Timber Lifecycle Phase 3 QA test cycle whose `sales_orders` were removed outside the application's own delete path). Net change to `stock_levels`: **zero** — proven by full ledger replay (with the application's own floor-at-zero clamping logic) that the fake movements never actually removed real stock. Result: Timber Inventory reconciliation is now `mismatch: 0, reconciled: true`.
2. **DATA-02 (Mechanician QA residue)**: fully removed 3 confirmed-QA-only stock-catalog items (`_QA_MECH_TEST_ITEM`/`P2_ITEM`/`P3_ITEM`) and everything referencing them — 6 `stock_levels`, 9 `stock_movements`, 5 `material_requests`, 4 `stock_transfers`, 3 `stock_transfer_dispatches` rows. Every record traced to an already-deactivated QA test account with a QA-labeled reason; zero legitimate dependency found.
3. **DATA-03 (`_stabtest_*` accounts)**: no correction applied — investigation found all 16 accounts already `active=false` **and** already soft-deleted (`deleted_at` set), with zero open/pending records anywhere. Already fully resolved before this phase began.
4. **DATA-04 (Diesel Fuel @ Headquarters)**: reset `stock_levels` from 1000 to **0** (not 14 — see below) and purged the 4 fake `stock_movements` rows behind the "14 units" figure.

## Key findings during evidence-gathering (changed the corrections applied)

- **DATA-01**: a full chronological replay of the movement ledger, applying the exact same incremental floor-at-zero clamp the application itself applies on every posting, proved `stock_levels` was **already mathematically correct** before any correction — the 4 fake movements never removed real stock (they hit a floor of zero that was already there from prior real activity). The generic `stockMovementsDelete()` reversal logic doesn't know this history and would have over-corrected `stock_levels` upward to a number that never existed; a compensating correction (with its own audit entry) was applied immediately after to bring it back to the already-proven-correct value.
- **DATA-04**: the "14 units" previously assumed to be a legitimate receiving baseline was proven to be QA test data itself — the 4 Goods Receipts backing it were created by a QA test account (`_qa_proc_storekeeper`, already deactivated) during Procurement-phase testing, with underlying Purchase Orders created by another QA account. Warehouse 2 (Headquarters) has zero real Diesel Fuel history of any kind. This was presented to the user as an explicit choice (reset to 0 vs. reset to 14) — 0 was chosen, matching the evidence.

## Evidence and approval

All 4 items were presented to the user with full evidence (exact record IDs, account ownership, movement history, mathematical proof for DATA-01) and an exact proposed correction before any write occurred. 3 of the 4 recommended corrections were explicitly approved by the user via a direct multi-question confirmation; DATA-03 required no approval since no correction was needed.

## Verification performed

- Before/after values captured and printed for every correction.
- `timberInventoryList().reconciliation` re-queried after DATA-01: `mismatch: 0, reconciled: true` (was `-16, false`).
- All 4 Diesel Fuel warehouse values re-queried after DATA-04 and confirmed each is now fully explained by real, legitimate movement history.
- 22-function regression sweep across every department — all pass.
- `node --check db/services/data.js` — clean (no code changed).
- `git status` confirms zero new file modifications this phase.
- Independent leftover-count re-verification after DATA-02: 0 across all 5 affected tables.
- `usersList` re-confirmed to correctly exclude the 16 `_stabtest_*` accounts (already soft-deleted, unaffected by this phase).

## New findings disclosed, not acted on (outside this phase's 4-item scope)

- **~61 additional leftover QA accounts** (ids 51–109, 126–128) from nearly every phase in this program's history — all already deactivated, not individually dependency-checked the way the 16 named accounts were. Recommended for a dedicated future pass.
- **One leftover `stock_movements` row (id 116)** at Showroom, from this program's own earlier Stock & Inventory Phase 1 testing — its cleanup script's regex missed it because it matched on the wrong field. `stock_levels` there is already correct (0); this is a ledger-only leftover. Low-risk, disclosed for a future small fix.

## Explicitly not done this phase

- No application code, workflow, permission, approval engine, notification engine, or Workshop Isolation change — this was a data-correction-only phase, confirmed by zero file modifications.
- The two newly-discovered items in §12/above were not corrected — outside this phase's explicit "exactly these four items" scope.
- `mv_stock_summary`/`mv_stock_by_workshop`'s own separate, already-documented 15-unit gap (Phase 3's architecture-transition finding) was not touched — it's unrelated to the QA contamination this phase fixed, and consolidating the two production-tracking mechanisms remains explicitly out of scope per that earlier phase's own finding.

## Next step

Per the phase's Stop Rule: this phase is complete and stops here. All 4 originally-flagged historical-data items are resolved. No further engineering or data-correction phase is automatically started. If a future phase is wanted, the two newly-disclosed items (§12 of the completion report) are the natural next candidates — both small, low-risk, and already fully diagnosed.
