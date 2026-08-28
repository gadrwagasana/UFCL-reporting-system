# Stock & Inventory — Phase 1: Workshop Isolation Completion & Cross-Workshop Access Hardening
## Completion Report

---

## 1. Executive Summary

Phase 1 closes every confirmed Workshop Isolation gap identified in `STOCK_INVENTORY_ENTERPRISE_AUDIT.md` (findings **C-10, C-11, H-04, H-05, M-17** — 5 findings covering 11 backend functions). Every fix reuses the ERP's single existing isolation primitive, `isWorkshopRestricted(user)` (`db/services/data.js:199-202`), applied with the same write-side idiom already used in ~40 other call sites across the codebase. **No new isolation mechanism was introduced. No existing workflow, approval, notification, audit, valuation, or lifecycle was redesigned.**

All 11 fixes were independently re-verified against current source (not the audit report) before being applied, live-tested with real production accounts across all three workshops (Gatare, Nyanza, Showroom), and regression-tested against Stock Transfers and the Timber Lifecycle chain. **29 live isolation checks + 14 Stock Transfer regression checks + 6 Timber Lifecycle regression checks — 48/49 passed** (the one non-pass was an unrelated pre-existing business rule, not a regression — see §9). All QA data was removed and independently re-verified as zero-leftover. Static verification (`node --check`) is clean.

**Workshop Isolation remains exactly what it was before this phase: a single, server-side, role-and-workshop-based authorization check, now applied completely instead of partially.**

---

## 2. Original Audit Findings (from `STOCK_INVENTORY_ENTERPRISE_AUDIT.md`)

| ID | Finding | Severity | Functions affected |
|---|---|---|---|
| C-10 | `stockMovementsDelete` — no Workshop Isolation check at all | Critical | 1 |
| C-11 | `showroomDamageReportCreate`/`List` — no Workshop Isolation check (independently found by 2 audit passes) | Critical | 2 |
| H-04 | `resolutionCreate`/`resolutionsList` — no Workshop Isolation across the entire Resolution Engine (independently found by 2 audit passes) | High | 2 |
| H-05 | Entire Sawmill offcut/resaw/QC chain — no Workshop Isolation | High | 5 |
| M-17 | `harvestWasteCreate` — no Workshop Isolation on write (sibling read function was already correctly isolated) | Medium | 1 |

All five were reachable only via a direct/crafted API or IPC call — in every case the normal desktop/mobile UI never exposes a way to supply a foreign `workshop_id`/`warehouse_id` (e.g. desktop's Showroom damage form hardcodes `warehouse_id: 5`, `renderer/app.js:16175`). The backend itself, however, trusted the client-supplied value with no validation.

---

## 3. Findings Re-Verification

Every finding was independently re-confirmed against the **current** function body (not the audit's line citations) before any fix was applied, per the phase brief's explicit instruction. For each, the re-verification determined:

| Function | Current workshop filtering (before fix) | Callable directly | Foreign workshop_id acceptable | Mutates other workshop's data |
|---|---|---|---|---|
| `showroomDamageReportCreate` | None | Yes | Yes | Yes — damage report + stock deduction |
| `showroomDamageReportsList` | None | Yes | N/A (read) | Leaks other workshops' damage data |
| `resolutionCreate` | None (any source type) | Yes | Yes | Yes — resolution record + stock posting + source-record mutation |
| `resolutionsList` | None | Yes | N/A (read) | Leaks other workshops' resolution data |
| `stockMovementsDelete` | None (only ownership/time-window governance, an orthogonal concern) | Yes | Yes | Yes — reverses another workshop's stock_levels |
| `productionOffcutCreate` | None | Yes | Yes | Yes — offcut created against foreign daily_log |
| `productionOffcutDecide` | None | Yes | Yes | Yes |
| `productionOffcutRecordRecovery` | None | Yes | Yes | Yes |
| `qualityInspectionCreate` | None | Yes | Yes | Yes — posts stock + creates rejection hold |
| `vatQualityInspectionCreate` | None | Yes | Yes | Yes — posts stock + creates rejection hold |
| `harvestWasteCreate` | None (sibling `harvestWasteList` already correct) | Yes | Yes | Yes |

Re-verified as **already correct, unmodified this phase**: `rejectionResolveRework`, `rejectionResolveDowngrade`, `rejectionResolveReturnToInventory`, `rejectionHoldsList`, `productionOffcutsList`, `harvestWasteList` — all confirmed to still carry their `isWorkshopRestricted` checks from an earlier phase.

---

## 4. Workshop Isolation Architecture (unchanged, reused)

- **Canonical check**: `isWorkshopRestricted(user)` — `user.workshop_id != null && !['admin','ceo','operations','logistics'].includes(user.role)`.
- **Write-side idiom** (applied 9 times this phase): validate the *target record's* workshop against `user.workshop_id`; deny before any mutation.
- **Read-side idiom** (applied 2 times this phase): `const wId = restricted ? user.workshop_id : null;` then `and ($N::bigint is null or table.workshop_col = $N [or table.workshop_col is null])` — matching the pre-existing convention in `rejectionHoldsList`.
- No new tables, columns, roles, or permission concepts were introduced.

---

## 5. Showroom Damage Fix (Workstream 1 / C-11)

**`showroomDamageReportCreate`** — added a check on `p.warehouse_id` before the transaction begins: a workshop-restricted user whose `warehouse_id` does not match the target warehouse is denied with `'Access denied — this warehouse is not your workshop'`.

**`showroomDamageReportsList`** — added the read-side filter so a restricted user only sees damage reports for their own warehouse (or company-wide unscoped rows).

**Live-verified**: Gatare supervisor denied against Showroom stock; Showroom staff succeeds against Showroom stock; Gatare's list does not surface the Showroom report; Showroom's list does.

---

## 6. Resolution Engine Fix (Workstream 2 / H-04)

**`resolutionCreate`** — two checks added, covering all 4 source types (`harvest_waste`, `production_offcut`, `rejected_timber`, `showroom_damage`):

1. **Source validation**: the source record's own workshop (`harvest_log.workshop_id`, `production_offcut.workshop_id`, `rejection_hold.workshop_id`, or `showroom_damage_report.warehouse_id`) must match the caller's workshop.
2. **Destination-redirect closure**: a secondary gap found during re-verification — even after validating the source, a restricted caller could still redirect the *posting destination* (`p.warehouse_id`) to a foreign warehouse for `harvest_waste`/`production_offcut` source types specifically (`rejected_timber`/`showroom_damage` already auto-defaulted this from the source row). Closed by unconditionally forcing `p.warehouse_id = user.workshop_id` for restricted users.

**`resolutionsList`** — added the same read-side filter convention.

**Live-verified**: cross-workshop `harvest_waste` and `rejected_timber` resolutions denied before any mutation (confirmed via a fresh DB read that the source record's `resolution_id` remained null after the denied attempt); same-workshop resolutions succeed; the destination-forcing fix confirmed live — a Gatare user explicitly supplying Nyanza's `warehouse_id` still had the resolution posted to Gatare (`resolution_records.warehouse_id = 3`, not the supplied `4`); Nyanza's resolution list does not surface Gatare's resolution.

**Rework/Downgrade/Return-to-Inventory** are handled by separate sibling functions, already correctly isolated in an earlier phase — re-verified intact, not modified.

---

## 7. Stock/Inventory Isolation Sweep (Workstream 3)

Full sweep of functions accepting product/stock/warehouse/workshop/movement/transfer/resolution IDs. Classification:

| Function | Classification | Action |
|---|---|---|
| `stockMovementsDelete` | Confirmed Isolation Gap (C-10) | Fixed — checks both `warehouse_id` and `to_warehouse_id` (covers the retired-but-deletable `'transfer'` type) |
| `productionOffcutCreate` | Confirmed Isolation Gap (H-05) | Fixed |
| `productionOffcutDecide` | Confirmed Isolation Gap (H-05) | Fixed |
| `productionOffcutRecordRecovery` | Confirmed Isolation Gap (H-05) | Fixed |
| `qualityInspectionCreate` | Confirmed Isolation Gap (H-05) | Fixed |
| `vatQualityInspectionCreate` | Confirmed Isolation Gap (H-05) | Fixed |
| `harvestWasteCreate` | Confirmed Isolation Gap (M-17) | Fixed |
| `productionOffcutsList` | Safe — already isolated | No change |
| `harvestWasteList` | Safe — already isolated | No change |
| `rejectionHoldsList` | Safe — already isolated | No change |
| `rejectionResolveRework/Downgrade/ReturnToInventory` | Safe — already isolated (earlier phase) | No change |
| `stockTransfers*` (all 6 functions) | Safe — already isolated (Phase 3 of a prior program) | No change, regression-tested (§8) |

No False Positives were found — every finding named in the audit was confirmed real. No scope expansion beyond the audit's own findings.

---

## 8. Stock Transfer Regression (Workstream 4)

None of this phase's fixes touch any `stockTransfers*` function. A full live regression was still run to confirm no incidental breakage: **14/14 checks passed.**

- Gatare(3) → Nyanza(4): request → destination-workshop approve → source-workshop dispatch (real vehicle) → destination-workshop receive. Stock correctly moved (Gatare 0, Nyanza +4).
- Nyanza(4) → Showroom(5): same full lifecycle. Stock correctly moved (Nyanza back to baseline, Showroom +4).
- Negative case: an unrelated (Gatare) storekeeper could not approve a Nyanza→Showroom transfer — `'Access denied — this transfer does not involve your workshop'` (pre-existing isolation from a prior phase, confirmed intact).
- All QA stock movements/transfers/dispatches hard-deleted; `stock_levels` independently re-verified restored to exact pre-test baseline (0 / 310 / 0 for the test item at Gatare/Nyanza/Showroom).

---

## 9. Timber Lifecycle Regression (Workstream 5)

**6 checks, 5 passed, 1 non-pass (unrelated to this phase — see below).**

- Rebuilt the full Harvest → Production → QC chain live (fresh `daily_log` → `productionOffcutCreate` → `Decide` → `RecordRecovery` → `qualityInspectionCreate` with a full rejection) — produced a real `rejection_holds` row end-to-end, confirming the newly-added isolation checks don't break the legitimate same-workshop flow.
- `resolutionCreate(source_type: 'rejected_timber')`: cross-workshop denied, same-workshop succeeded (Scrap Sale destination, stock correctly posted and reversed in cleanup).
- `rejectionResolveReturnToInventory`: attempted on a **fully-rejected** (0-approved-qty) hold — correctly blocked by a pre-existing, unrelated business rule (*"the original inspection did not resolve to a catalogued product... cannot return to inventory"*), not a Workshop Isolation regression. This function's own `isWorkshopRestricted` check (`data.js:8865`) was independently re-read and confirmed present and unmodified; no cross-workshop supervisor account exists in production today to exercise a live negative case for this specific function (only Gatare has supervisor-role accounts), so this one check relies on static confirmation plus the same idiom's 9× live-verified behavior elsewhere in this phase, rather than a fabricated account.
- Timber Inventory report and `rejectionHoldsList` both load correctly after the chain activity.
- All QA fixtures (`daily_logs`, `production_offcuts`, `quality_inspections`, `rejection_holds`, `resolution_records`) and their stock-posting side effects hard-deleted/reversed; independently re-verified at zero.

---

## 10. Desktop / Mobile / API Verification (Workstream 6)

Confirmed as an architectural property rather than checked per-function: every relevant IPC handler (`electron/main.js`) and mobile-api route file (`mobile-api/routes/{showroomDamage,resolutions,productionOffcuts,harvestWaste,stock,vat}.js`) is a **pure delegation layer** to the corresponding `db/services/data.js` function, with zero authorization or business logic of its own. This was true before this phase and remains true — nothing in this phase added, removed, or duplicated any route/IPC-level logic.

Consequence: because the fix lives exclusively in `data.js`, it is enforced identically regardless of call path —

- **Desktop** → IPC → `data.js`: cannot bypass (same function, same check).
- **Mobile** → REST → `data.js`: cannot bypass (route files confirmed to call the identical function with no extra/different logic).
- **Direct/crafted API call** → `data.js`: cannot bypass (this was the exact vulnerability class being closed — the backend is now the enforcement point regardless of what called it).

No UI file was modified this phase.

---

## 11. Live Security Verification (Workstream 7)

Used only real, existing production accounts (no new QA accounts were needed — all required roles/workshops already had real accounts): `admin`(1), `operations`(20), `sawmill-leader@Gatare`(10), `storekeeper@Gatare`(12), `supervisor@Gatare`(11, 45), `poles-leader@Nyanza`(16), `storekeeper@Nyanza`(49), `vat-leader@Nyanza`(17), `showroom-staff@Showroom`(19).

**29/29 checks passed** across all 11 fixed functions:

| Area | Positive (own workshop) | Negative (cross-workshop) |
|---|---|---|
| `showroomDamageReportCreate`/`List` | ✅ succeeds, visible in own list | ✅ denied, not visible in other workshop's list |
| `resolutionCreate` (harvest_waste) | ✅ succeeds, destination forced to caller's workshop even when a foreign one is supplied | ✅ denied before mutation (source record's `resolution_id` confirmed still null) |
| `resolutionsList` | ✅ own resolution visible | ✅ not visible cross-workshop |
| `stockMovementsDelete` | ✅ succeeds, stock reversed | ✅ denied — `'Access denied — this movement does not involve your workshop'` |
| `productionOffcutCreate/Decide/RecordRecovery` | ✅ all 3 succeed same-workshop | ✅ all 3 denied cross-workshop |
| `qualityInspectionCreate` | ✅ succeeds | ✅ denied |
| `vatQualityInspectionCreate` | ✅ succeeds | ✅ denied |
| `harvestWasteCreate` | ✅ succeeds | ✅ denied |

Every negative case confirmed: rejection returned at the function boundary (no HTTP/IPC distinction — same function serves both), no unauthorized data returned, no inventory/stock/resolution/damage mutation, source record unaffected, audit trail unaffected by the denial (no successful-operation entry was logged for any denied attempt).

---

## 12. Static Verification

- `node --check db/services/data.js` — **clean**, re-run after every individual edit and once more as a final consolidated pass.
- No `.ts`/`.tsx` file was touched this phase (all fixes are backend-only in `data.js`), so `tsc --noEmit` was not required as anything beyond a baseline — no mobile file changed.
- `git status`/`git diff --stat` confirms `db/services/data.js` is the only file this phase modified (the file's large pre-existing diff reflects several prior, still-uncommitted phases from earlier in this program — not this phase's change, which is scoped to the 11 documented fix sites, each individually marked with an `ERP Stock & Inventory Phase 1` comment).

---

## 13. QA Data Cleanup

All QA fixtures were either (a) real, pre-existing, read-only parent records referenced but never mutated (`daily_log #22`, `harvest_log #1`), or (b) throwaway rows explicitly created and then hard-deleted in FK-safe order. No soft-deletion/`_QA-`-style leftover accounts were created — all testing used real existing accounts.

Independently re-verified via fresh `COUNT`/`SELECT` queries after cleanup, for both the WS7 live-security pass and the WS4/WS5 regression passes:

- `quality_inspections`, `rejection_holds`, `production_offcuts`, `daily_logs` (QA fixture rows only — real row `#22` confirmed untouched), `value_added_timber`, `resolution_records`, `harvest_waste`, `showroom_damage_reports`, `stock_movements`, `stock_transfers`, `stock_transfer_dispatches` — **zero leftover rows** for every entity type, confirmed in three separate cleanup passes.
- `stock_levels` for every touched `(item, warehouse)` pair independently re-verified restored to its exact pre-test baseline (Gatare/Nyanza/Showroom item-1: 0 / 310 / 0; the Scrap Sale byproduct item at Gatare: 0).

---

## 14. Remaining Findings (not addressed this phase, per Stop Rule)

All findings from `STOCK_INVENTORY_ENTERPRISE_AUDIT.md` **outside** the 5 Workshop Isolation findings (C-10, C-11, H-04, H-05, M-17) remain open and untouched, per this phase's explicit scope boundary — including but not limited to: C-01 through C-09 (legacy report drift, Sales quantity/TOCTOU/reversal gaps, financial reconciliation, cost placeholders), H-01/H-03/H-07 through H-13, and the full Medium/Low registers. These belong to Phase 2 ("Sales & Stock Integrity") or later, not this phase.

Two findings surfaced incidentally during this phase's regression testing, neither a new discovery nor in scope to fix here:

- `rejectionResolveReturnToInventory`'s existing business rule (no catalogued product for a fully-rejected item) — pre-existing, correct, unrelated to isolation.
- The file-wide `git diff` size reflects several other prior, uncommitted phases sharing this same file — not a Phase 1 concern, flagged here only for transparency ahead of any future commit decision.

---

## 15. Production Readiness

Phase 1's 11 fixes are considered **production-ready**:

- Every fix reuses an existing, already-proven idiom (no new architecture).
- Zero schema changes.
- Zero UI/route/IPC changes (backend-only, so zero risk of desktop/mobile regression from this phase).
- 100% of the audit's named Workshop Isolation findings closed.
- Full live positive + negative verification across all 3 workshops.
- Full regression verification of the two adjacent systems most likely to be affected (Stock Transfers, Timber Lifecycle) — both intact.
- Zero QA data footprint remaining in the production database.

---

## 16. Phase 2 Recommendation

Per the explicit Stop Rule, **Phase 2 ("Sales & Stock Integrity") has not been started** and remains untouched. This report is submitted for review and approval before any further work begins.

When approved, Phase 2's natural starting point (per the audit's own Critical findings C-03 through C-06) is the Sales module's stock-integrity gaps: negative-quantity acceptance, the unlocked/TOCTOU-racy availability check, and the complete absence of any stock-reversal path on sale edit/delete/reject — the highest-severity cluster of findings not yet addressed anywhere in this program.
