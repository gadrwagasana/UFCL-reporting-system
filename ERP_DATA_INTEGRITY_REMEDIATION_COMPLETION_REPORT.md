# ERP Data Integrity Remediation — Phase 7
## Completion Report

---

## 1. Executive Summary

Phase 7 resolved the 4 historical-data items carried forward from the Enterprise Completion program (Stock & Inventory Phase 2/4, ERP Phase 6). This was a data-correction-only phase — no application code was touched (confirmed: zero files modified, `node --check db/services/data.js` clean, `git status` shows only the same pre-existing uncommitted diff every prior phase in this session has carried).

**All 4 items were re-investigated from scratch against current live state before any correction was proposed**, per the phase's own explicit instruction not to assume prior findings still hold. Two investigations produced materially different, more precise conclusions than the original discovery:

- **DATA-01**: proven, by a full chronological replay of the movement ledger (with the same incremental floor-at-zero clamping the application itself applies on every posting), that `stock_levels` was **already mathematically correct** — the reconciliation failure was purely a ledger-cleanliness problem (4 fake movements needed removing), not a lost-stock problem. Applying the naive fix (reversing the movements' nominal quantities into `stock_levels`) would have **introduced a new, real error** — inflating stock to a number that never existed. This was caught before any correction was applied.
- **DATA-04**: the "14 units" previously assumed to be the legitimate baseline was itself proven to be QA test data — the correct value is **0**, not 14 and not 1000.

All 4 corrections/findings were presented to the user with full evidence and exact proposed values before any production data was touched; 3 required and received explicit approval, which was given for all 3 recommended options. The 4th (DATA-03) required no correction — it was already fully resolved.

**Two new, smaller discoveries were made during this investigation** (disclosed, not hidden, and not acted on beyond disclosure, since they are outside this phase's explicit 4-item scope): a ~61-account backlog of leftover QA test accounts from across nearly every phase in this program's history (all already deactivated, zero live risk), and one small leftover `stock_movements` row from this program's own Stock & Inventory Phase 1 testing that its cleanup script's regex missed. Both are documented in §12 for a future decision.

---

## 2. DATA-01: Finished Timber Correction

**Evidence gathered**: the exact 4 orphaned movements (ids 94, 97, 99, 102; reference `QA-PH3-A`/`QA-PH3-B`; total 16 units removed from stock_catalog item 20 across Gatare and Nyanza) were re-confirmed live. `sales_orders` was re-queried and confirmed to hold **zero** rows with these order numbers, in any state including soft-deleted — proving these were removed via a means outside the application's own delete/purge path. `audit_log` was cross-checked and confirms these correspond to real `salesCreate()` calls from a Timber Lifecycle Phase 3 QA test cycle (2026-08-07), with quantities matching exactly (5, 5, 3, 3).

**The critical additional step, not present in prior investigations**: before proposing any correction, the complete chronological movement history for item 20 at both affected warehouses was replayed by hand, applying the exact same incremental floor-at-zero clamp `_postFinishedTimberStock` applies on every single posting (not a one-time floor on the final sum). Result: **the current live `stock_levels` values (2 at Gatare, 0 at Nyanza) are exactly what they would be even if the 4 fake movements had never existed** — because both fake "out" postings hit a floor of zero that was already there; they never removed real stock, only recorded a false claim against stock that didn't exist to be removed.

**Correction applied**: the 4 movements were soft-deleted via the existing `stockMovementsDelete()` function (proper governance check, proper audit entry, proper `deleted_at`/`deleted_by`/`deletion_reason`), then hard-purged via the existing `trashPurge()` function (admin-only, own audit entry) — using the application's own established two-step Trash lifecycle rather than a new mechanism. Because `stockMovementsDelete()`'s generic reversal logic doesn't know about the floor-clamp history, it over-corrected `stock_levels` (to 12 and 6); a compensating direct correction, with its own explicit audit_log entry documenting the mathematical proof above, brought `stock_levels` back to the already-proven-correct values (2 and 0) — meaning **the net change to `stock_levels` across this entire correction is exactly zero**, only the ledger's fake entries were removed.

---

## 3. DATA-02: Mechanician QA Cleanup

**Evidence gathered**: all 3 items (`_QA_MECH_TEST_ITEM`/`_QA_MECH_P2_ITEM`/`_QA_MECH_P3_ITEM`, stock_catalog ids 15/16/17) re-confirmed `active=false`. Their complete stock_levels (2 rows each, 30 units total across all 3), stock_movements (3 rows each, 9 total — seed/dispatch/receive), material_requests (5 rows total), and stock_transfers (4 rows total, plus 3 linked dispatch records) were traced in full. Every single one of these records was created by, or references, a QA test account (`QA Mechanician P1/P2/P3`, `QA Storekeeper W2/P2/P3`, `QA Sawmill Leader`) — all already deactivated — with explicitly QA-labeled reasons ("QA test request", "QA Phase 2 e2e", etc.). No real product, procurement, or production table references any of the 3 items.

**Correction applied**: complete removal, in FK-safe order (material_requests → stock_movements → stock_transfer_dispatches → stock_transfers → stock_levels → stock_catalog), with a full before-state audit_log entry recorded first. Independently re-verified afterward: 0 leftover rows across all 5 affected tables.

---

## 4. DATA-03: QA Account Cleanup

**Evidence gathered**: all 16 `_stabtest_*` accounts (ids 110–125) re-queried live. **Finding: no correction was needed.** Every account already has `active=false` (the `name` field even literally states "(stabilization test - deactivated)" for all 16) **and** `deleted_at` already set (dated 2026-08-04, matching their creation dates) — they are already fully soft-deleted, not merely deactivated. A dependency sweep confirmed zero open/pending records anywhere owned by any of the 16 (`pending_edits`, `deletion_requests`, `material_requests`, `stock_transfers`, `maintenance_jobs`, `sales_orders` — all 0). Their `audit_log` history (logins, actions performed during the original testing) remains completely intact, as required.

**One minor observation, not requiring action**: `deleted_by` is `NULL` for all 16, suggesting the soft-deletion was performed via a direct operation rather than a call to the application's own `usersDelete()` function at some point before this phase (the prior "never cleaned up" memory record predates this and was simply not updated afterward). The outcome — inactive, soft-deleted, zero dependencies — is exactly what the application's own mechanism would have produced, so no further action was taken.

---

## 5. DATA-04: Diesel Fuel Correction

**Evidence gathered, per the brief's own heightened caution**: the complete movement history for item 1 (Diesel Fuel) across **all 4 warehouses** was pulled and replayed chronologically. Warehouses 3 (Gatare) and 4 (Nyanza) were confirmed to reconcile **exactly** against their own full movement history (no floor-clamping even needed — values never went negative) — proving those two warehouses' current `stock_levels` (0 and 310 respectively) are already fully correct and were not touched. Warehouse 2 (Headquarters)'s entire movement history consists of exactly 4 rows: `in` movements totaling 14 units, referencing Goods Receipts GR-00001 through GR-00004.

**The critical finding the brief's caution was designed to catch**: those 4 Goods Receipts were **not real**. `created_by` on the movements is user id 56, whose username is `_qa_proc_storekeeper` (already deactivated). The 4 underlying Purchase Orders (PO-00001–PO-00004) were created by user id 54 ("QA admin", also already deactivated). **Warehouse 2 has zero real, legitimate Diesel Fuel movement history of any kind** — the "14 units" is not a genuine baseline, it is an earlier, less-obviously-wrong layer of the same QA contamination as the "1000" placeholder that was later force-set on top of it. The correct value is therefore **0**, not 14.

**Correction applied, as explicitly approved by the user** (not the "reset to 14" alternative, which was offered and declined): the 4 fake movements were purged directly, and `stock_levels` for (item 1, warehouse 2) was set to 0, with a full audit_log entry documenting the before-value (1000), the evidence chain, and the reasoning for why 0 — not 14 — is correct.

---

## 6. Evidence Before Correction

Captured and recorded (in-report and in `audit_log`) for every correction: current value, expected/proven value, exact source records (movement IDs, order numbers, account IDs), reason for the discrepancy, and the exact proposed correction — all presented to the user before any write occurred, per §2 of the phase brief.

---

## 7. Corrections Applied

| Item | Correction | Stock_levels net change | Records removed |
|---|---|---|---|
| DATA-01 | Purge 4 fake movements (ids 94, 97, 99, 102) | **Zero** (compensating correction brought it back to the already-correct value) | 4 `stock_movements` |
| DATA-02 | Full removal of 3 confirmed-QA items and everything referencing them | N/A (entire item removed) | 3 `stock_catalog`, 6 `stock_levels`, 9 `stock_movements`, 5 `material_requests`, 4 `stock_transfers`, 3 `stock_transfer_dispatches` |
| DATA-03 | None — already resolved | None | None |
| DATA-04 | Purge 4 fake movements, set stock_levels to 0 | 1000 → 0 | 4 `stock_movements` |

---

## 8. Audit Trail

Every correction produced explicit `audit_log` entries **in addition to** the standard entries the reused application functions (`stockMovementsDelete`, `trashPurge`) already generate — a manual, detailed entry was written before each correction for DATA-01, DATA-02, and DATA-04, recording the module, before/after values, and the full evidentiary reasoning (not just "what changed" but "why this is correct"), per §2's explicit requirement. The immutable `audit_log_no_update`/`audit_log_no_delete` Postgres rules were not touched. No audit history was destroyed for DATA-03 (nothing was corrected there).

---

## 9. Inventory Reconciliation

**Before**: `timberInventoryList().reconciliation` = `{ totalProduced: 2, totalSold: 16, currentStock: 2, expectedStock: -14, mismatch: -16, reconciled: false }`.

**After DATA-01**: `{ totalProduced: 2, totalSold: 0, currentStock: 2, expectedStock: 2, mismatch: 0, reconciled: true }` — **the Timber Inventory reconciliation badge is now genuinely, mathematically green**, not fabricated to appear so (per the phase's own explicit warning against exactly that). `inventoryValueByLocation` confirmed sane (20,000 RWF at Gatare, matching 2 units × 10,000 standard cost, 0 elsewhere).

**Diesel Fuel**: confirmed final state across all 4 warehouses: Headquarters=0, Gatare=0, Nyanza=310, Showroom=0 — all four independently verified against their own complete, legitimate movement history.

**The separate, already-documented legacy `mv_stock_summary` gap is unchanged and unaffected by this phase**, as expected: that view's own formula (`daily_logs.timber_units` minus `sales_orders`-derived sold) never referenced the corrected `stock_movements` rows, and its remaining 15-unit gap (Phase 3's finding: `daily_log #1` predates per-item stock tracking) is a separate, pre-existing architecture-transition artifact, not something DATA-01 was meant to or could fix — noted here so it is not mistaken for an incomplete correction.

---

## 10. Regression Testing

22-function regression sweep across every department (Logistics, Fleet, Mechanician, Harvesting, Sawmill, VAT, Inventory, Sales, Showroom, Resolution/QC, Governance, Reporting, Users) — **22/22 pass**, run after all corrections were applied. Confirmed the 16 `_stabtest_*` accounts correctly do not appear in `usersList` (already excluded as soft-deleted, unaffected by this phase). `node --check db/services/data.js` — clean (no code was changed this phase, confirmed by `git status` showing zero new modifications beyond the same pre-existing uncommitted diff every prior phase in this session has carried forward).

---

## 11. Production Data Safety

Every correction followed the phase's own explicit discipline: baseline captured and printed before each write; one controlled correction performed at a time (DATA-01, then DATA-02, then DATA-04, never combined into one operation); result verified immediately after each; related records (reconciliation, other warehouses, other tables) checked for unintended side effects after each step; no correction proceeded without the evidence being gathered and, where destructive, explicitly approved first. No unexpected result occurred at any step — every correction produced exactly the predicted outcome, confirmed by direct query before moving to the next.

---

## 12. Remaining Historical Issues

**Two new items surfaced during this phase's investigation, neither acted on (outside this phase's explicit 4-item scope) — flagged for a future decision:**

- **~61 additional leftover QA test accounts** (ids 51–109, 126–128), spanning nearly every phase in this program's history (Fleet, Inventory, Mechanician, Material Request, Stock Catalog, and Poles/VAT-supervisor test cycles). All are already `active=false`. Not investigated for `deleted_at` status or dependency cleanliness the way the 16 `_stabtest_*` accounts were — that would be a materially larger investigation than this phase's named scope. Recommend a dedicated future pass mirroring exactly what DATA-03 just did for the smaller, already-named set.
- **One leftover `stock_movements` row (id 116)** at Showroom (warehouse 5), tagged "QA-SIP1 same-workshop positive test" — a residual row from this same program's own Stock & Inventory Phase 1 live testing, missed by that phase's own cleanup script because its reference field (`"Showroom Damage Report #2"`, auto-generated by the application) didn't match the cleanup regex (`reference LIKE 'QA-SIP1%'`), even though its `notes` field carried the QA tag. `stock_levels` for that item/warehouse is already correctly at 0 (force-corrected directly at the time), so this is a ledger-only leftover, not a live stock discrepancy — but it is a known, small, easily-fixable item for a future pass, disclosed here rather than silently left for someone else to rediscover.

Neither item was part of this phase's brief ("resolve exactly these four previously documented items"), and Bug Discipline / this phase's own explicit scope boundary ("do not silently expand the phase") governs — both are documented, not touched.

---

## 13. Final Production Data Status

**All 4 originally-scoped items are resolved**: 3 corrected with full evidence, approval, and audit trail (DATA-01, DATA-02, DATA-04); 1 confirmed already resolved with no action needed (DATA-03). The Timber Inventory reconciliation is now genuinely mathematically balanced. Diesel Fuel's stock figure across all 4 warehouses is now fully explained by real, legitimate movement history. No legitimate production history, product, or stock was removed anywhere — every deletion was independently confirmed, by tracing every referencing record back to an already-deactivated QA account, to have zero real business dependency before it was touched.

**Production data now has a clean, explainable baseline for all 4 previously-flagged items.** Two smaller, newly-discovered, out-of-scope items remain for a future decision (§12) — both low-risk (no live authentication or stock-correctness impact) and fully documented.
