# ERP Enterprise Final Completion Matrix

Legend: **PASS** (verified this phase, working) · **PARTIAL** (real, correctly-scoped gap remains — see notes) · **INTENTIONAL** (deliberate design, not a gap) · **N/A** (not applicable to this department) · **CARRIED FORWARD** (not re-audited this phase; status inherited from that department's own dedicated prior phase)

A row is never marked PASS merely because a backend function exists — see the underlying verification report for the evidence behind every cell.

| Department | Backend | Desktop | Mobile | Permissions | Isolation | Approval | Notifications | Audit | Inventory | E2E |
|---|---|---|---|---|---|---|---|---|---|---|
| **Procurement** | PASS | PASS | PASS | PASS | PASS *(fixed: `procurementApprovalAction`)* | PASS | PARTIAL *(2 gaps fixed; 6 lower-priority system-alert gaps remain, §18)* | PASS | PASS | PASS |
| **Harvesting** | PASS | PASS | PASS | PASS | PASS | N/A *(no multi-stage approval chain — waste resolution only)* | PASS | PASS | PASS | PASS |
| **Sawmill** | PASS | PASS | PASS | PASS | PASS | PASS *(governance)* | PASS | PASS | PASS *(fixed: reconciliation silent-loss bug)* | PASS |
| **Poles (Production, both paths)** | PASS | PASS | PARTIAL *(Downgrade/Firewood/Scrap intentionally desktop-only, matches Sawmill/VAT precedent; `polesSourceReport` stranded on mobile — deferred)* | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| **Nyanza / VAT** | PASS | PASS | PARTIAL *(Delete fixed this phase; Update still desktop-only — deferred, needs new edit screen)* | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| **Showroom** | PASS | PASS | PASS | PASS | PASS | N/A *(damage write-down + Resolution Engine, no multi-stage approval)* | PASS | PASS | PASS *(no double-deduction race found between Sale and Damage — both correctly row-locked)* | PASS |
| **Inventory / Stock Transfers** | PASS | PASS | PASS | PASS | PASS *(fixed: legacy `stockTransferApprove`)* | PASS | PASS | PASS | PASS *(fixed: `stockTransfersDispatch` race)* | PASS |
| **Sales** | PASS | PASS | PASS | PASS | PASS | N/A | PASS | PASS | PASS *(fixed: POD double-record + Close-Short double-apply races; a lower-severity `salesUpdate` concurrent-edit race found and documented, not fixed — §18)* | PASS |
| **Logistics** | PASS | PASS | PASS *(fixed: Material Request creation — was view-only)* | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| **Mechanician** | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS *(Maintenance Job → Material Request → Transfer → Inventory chain live-exercised end-to-end for the first time this session — no prior production data had ever completed it)* |
| **Fleet & Equipment** | CARRIED FORWARD | CARRIED FORWARD | CARRIED FORWARD | CARRIED FORWARD | CARRIED FORWARD | CARRIED FORWARD | CARRIED FORWARD | CARRIED FORWARD | CARRIED FORWARD | CARRIED FORWARD *(not a focus of this phase's audits beyond incidental use of a vehicle id in the Stock Transfer dispatch test; status inherited from Fleet & Equipment Phase 1-3, already assessed Production Ready)* |

## Notes on PARTIAL / deferred cells

- **Poles mobile** — Downgrade and Firewood/Scrap Sale resolution require a product picker / warehouse field respectively that mobile intentionally punts to desktop, an established cross-department pattern (Sawmill and VAT mobile screens have the identical restriction) — not a new or Poles-specific gap. `polesSourceReport`'s mobile hook exists but no screen calls it yet.
- **Nyanza/VAT mobile** — Delete was a real, unintentional gap (hook existed, never wired to any screen) and is fixed this phase. Update remains desktop-only; wiring it requires a new mobile edit screen, a larger lift than this phase's fix budget covered — correctly scoped as a deferred item, not silently dropped.
- **Procurement notifications** — 2 real routing gaps were found and fixed (Maintenance escalation, SRM contract reminders). 6 more (`Security`, `Governance` capital-variant, `System`, and 3 further Title-Case escalation fallbacks) were found but have no safe existing destination screen to route to without building new UI — documented, not fixed, per this phase's "verification, not redesign" mandate.
- **Sales inventory** — Two genuine concurrency defects (Delivery POD, Sales Close Short) were found and fixed, each independently live-verified. A third, lower-severity race in `salesUpdate` (concurrent edits to the same order can compute a stock delta from a stale pre-lock read) was found during audit and documented but not fixed this phase — same defect class, lower likelihood (requires two users editing the identical order simultaneously) and lower blast radius than the two that were fixed.

## Summary

- **9 real defects fixed this phase**, spanning Data Integrity (4), Workshop Isolation (2), UI/CRUD parity (2), and Notification routing (1 — covering 2 call sites).
- **1 pre-existing data discrepancy disclosed, not resolved**: `stock_levels` for Timber item (stock_catalog id 20) at Gatare Workshop reads 62 units where this session's own prior cleanup arithmetic expected 2 — flagged for investigation/business decision, not silently corrected (§21 of the completion report).
- **0 departments failed outright.** Every PARTIAL cell above is a correctly-scoped, already-documented follow-up with a clear reason it wasn't completed in this pass — never a silent gap.
- **Fleet & Equipment** was not independently re-verified this phase; its Production Ready status is carried forward from its own dedicated prior phase, not re-confirmed here.

See `ERP_ENTERPRISE_END_TO_END_VERIFICATION_REPORT.md` for the full evidence trail behind every cell in this matrix.
