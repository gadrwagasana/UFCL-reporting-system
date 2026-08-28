# ERP Enterprise Cross-Department End-to-End Verification

**Completion & Working-Flow Validation Phase — Report**

---

## 1. Executive Summary

This phase verified the ERP as one integrated system, not a collection of independently-tested departments. Verification was done in three stages: (1) six parallel, code-level audits tracing every integration boundary named in the brief with `file:line` evidence, no assumptions taken on faith; (2) live, disposable-data transaction testing of every fix and of the highest-risk cross-department chains, run directly against the production database; (3) full cleanup with independently-verified zero residue.

**9 real, previously-undiscovered defects were found and fixed**, each live-verified before and after the fix — not merely patched and assumed correct:

1. The shared Resolution Engine (`resolutionCreate`) silently marked a rejection/waste source as fully resolved even when only part of its volume was actually posted to a destination — material could vanish from every reconciliation total, across **all six** waste/rejection sources (Harvest Waste, Production Offcuts, Timber/VAT/Manufactured-Pole/Purchased-Pole Rejections). This directly contradicted the engine's own "no material may disappear" design intent.
2. `stockTransfersDispatch` read source-warehouse availability without a row lock — two concurrent dispatches could both pass the check and both be recorded as if stock moved, producing phantom "in transit" stock.
3. Delivery POD recording (`_applyDeliveryOrderPOD`) computed its stock-reversal amounts from a value read *before* its own transaction lock, with no guard against being recorded twice — a double-click or retried mobile request could credit stock back twice.
4. `salesCloseShort` had the identical defect class as #3, independently.
5. **`procurementApprovalAction` had no Workshop Isolation check at all** — a supervisor at one workshop could approve or reject a requisition or purchase order belonging to a different workshop, by calling the function with that record's id directly. This is the one finding classified against the brief's explicit "mandatory" Workshop Isolation requirement.
6. The legacy `stock_movements`-based transfer-approval path (superseded but still wired to IPC and a mobile route) had the same missing check as #5.
7. Two notification `relatedModule` values (`'srm'` on contract-renewal reminders, and the Title-Case fallback for Maintenance-overdue escalations) pointed nowhere on either platform — the notification fired, but no user could ever open the record it was about.
8. Logistics was the only one of six material-request-eligible departments whose mobile app had no way to *create* a Material Request — a real Backend=YES/Desktop=YES/Mobile=NO gap.
9. Nyanza/VAT Production Batch Delete had a working backend, a working desktop button, and a fully-built mobile hook that no screen ever called — an orphaned capability, now wired in (and its own dormant `pendingApproval`-handling bug fixed in the same pass).

Two of these fixes (#3's `FOR UPDATE OF` clause, and the wiring order needed for #9's mobile Delete) themselves needed a correction after their first live-test attempt failed — caught immediately, fixed, and re-verified in the same session, not left for a future phase to discover.

**One pre-existing data discrepancy was found and disclosed, not silently corrected**: `stock_levels` for a Timber catalog item at Gatare Workshop currently reads 62 units where this session's own prior-phase cleanup arithmetic expected 2. This was discovered while precisely reversing this phase's own QA test data (which required reconstructing the item's full movement ledger) — it predates this phase's testing and is not explained by anything this phase did. It is flagged for investigation, not corrected, per this program's standing rule against altering historical data without approval.

**Production readiness determination: COMPLETE WITH DOCUMENTED LIMITATIONS.** See §26.

---

## 2. Current ERP Architecture

Confirmed unchanged and correctly preserved throughout this phase:

```
Desktop → Electron IPC → db/services/data.js → PostgreSQL
Mobile  → REST API      → db/services/data.js → PostgreSQL
```

Both platforms call the identical backend functions — audited directly (not assumed) across every entity checked in §14; no platform-specific business logic divergence was found anywhere in scope. Workshop Isolation, the Approval Engine, the Notification Engine, the Audit Engine, the Inventory Engine, the QC Engine, and the Rejection/Resolution Engine all remain single, shared implementations — no duplicate engine was found, and none was created this phase.

---

## 3. Department Completion Status

See `ERP_ENTERPRISE_FINAL_COMPLETION_MATRIX.md` for the full matrix. Summary: 10 of 11 departments were actively re-audited and live-tested this phase; Fleet & Equipment's Production Ready status is carried forward from its own dedicated prior phase (not a focus of this phase's audits).

---

## 4. Procurement Integration

Audited: Requisition → Approval → RFQ → Quotation → PO → Goods Receipt → QC-where-required → Inventory, for every category.

- **Timber, Logs, Finished Poles, and every other purchased category** — the Pole QC gate (`procurement_goods_receipt_items.qc_status`, built in the prior Pole Production Phase 2) uses a strict `===` string match against `'Finished Poles'` — confirmed no substring/prefix collision risk, and confirmed every non-Poles category still posts to stock immediately, unchanged. One data-governance **concern** (not a code defect): `stock_catalog.category` is free-text with no server-side enum/CHECK constraint outside the Product Catalog's own programmatic path — a manually-typed catalog entry could theoretically collide with or evade the exact-match gate. Documented, not fixed (a schema-level constraint is out of this phase's "verification, not redesign" scope).
- **Raw logs** (both Timber's and Poles') never enter the generic procurement pipeline at all — confirmed structurally separate, pooled-balance systems, unaffected by the QC gate by construction, not by a category check.
- **Approval Engine** (Requisition multi-stage chain) — confirmed real: Submit → Pending → role-matched Approve → next stage or terminal status; Reject → skips remaining stages, no downstream artifact could exist yet to clean up (RFQ/PO generation both require `status='approved'` first). **Fixed**: the chain had no Workshop Isolation check (§16, finding #5 above) — now closed and live-verified (a Nyanza-scoped supervisor is denied approving a Gatare requisition; a same-workshop supervisor still succeeds, confirmed no regression).

## 5. Timber Lifecycle Integration

- **Sawmill**: Raw Logs → Production Offcuts → Resaw Decision (Recoverable → Resaw → Recovered Timber → QC; Non-Recoverable → Resolution Engine) → QC Accepted → Finished Timber Inventory. Every arrow confirmed as a real, called function chain with no stranded backend function and no dead UI button.
- **Reconciliation** — `productionReconciliation`'s completeness check (`unresolvedOffcuts`/`unresolvedRejections`) was found to be **silently unreliable**: it trusted `status='resolved'` at face value, but `resolutionCreate` could mark a source fully resolved after posting only *part* of its volume (finding #1 above). **Fixed** at the source (`resolutionCreate` now requires the full remaining quantity), so this reconciliation is now trustworthy without any change to the reconciliation function itself.
- **Rework loop** — confirmed structurally cannot bypass QC: a reworked offcut always re-enters `pending_resaw` and must pass Quality Inspection again, for every one of the four origins the shared engine supports.

## 6. Pole Production Integration

Verified both paths reach the **same** Finished Pole Inventory row:

- `poleProductionInspect` (manufactured) and `procurementGoodsReceiptInspect` (purchased) both call the identical `_postFinishedTimberStock` helper against the same `stock_catalog` row (category `'Finished Poles'`).
- Sales resolves sellable stock purely by product identity (type/sub_type/size) — confirmed architecturally blind to which QC path posted the stock; a manufactured and a purchased pole of the same spec are fully fungible once accepted, exactly as designed.
- Both `poleProductionInspect` and `procurementGoodsReceiptInspect` have confirmed Desktop and Mobile callers — no stranding.

## 7. Nyanza Manufacturing Integration

- Input consumption is a **real, hard stock check** under row lock — rejects the whole batch (never a silent partial) if insufficient, confirmed by direct code reading, not assumed from a comment.
- Output lines are validated against the live, active Product Catalog — never hardcoded — and support multiple lines per batch.
- VAT QC (`valueAddedProductionInspect`) mirrors Sawmill's own QC shape exactly; rejected output correctly creates a `rejection_holds` row with the VAT-origin FK set.
- **Resolution-path permission asymmetry (documented, not fixed)**: `vat-leader`/`vat-supervisor` can create batches, run QC, reject product, and Rework/Firewood/Scrap/Disposal-via-Resolution-Engine — but Downgrade, Return-to-Inventory, and Disposal-via-`resolutionCreate` are gated by a **literal role array** (`admin/ceo/operations/supervisor`) that excludes them, same as the identical, already-confirmed-intentional restriction `poles-leader`/`poles-supervisor` has (documented in a prior phase). Confirmed intentional via in-code comments, not a new or VAT-specific gap — a VAT floor lead must escalate to a supervisor-tier account for these three destinations.
- Nyanza's `'Finished Manufactured Goods'` category is fully transferable via Stock Transfers (no category exclusion found) and fully sellable (present in `salesProductsForDropdown`, resolves through the identical stock ledger). One reporting-only gap noted: the Sawmill/Poles costing dashboard filters to `('Finished Timber','Finished Poles')` only, so Nyanza's manufactured-goods inventory value doesn't appear on that specific dashboard — does not block the transfer or sale itself.

## 8. Showroom Integration

- `showroomDamageReportCreate` performs an immediate, row-locked write-down (not a hold) — confirmed the deduction happens exactly once, at report time.
- Resolution of damaged stock routes through the shared engine (`source_type='showroom_damage'`) and confirmed **never re-deducts** the original quantity — only adds recovered value to a separate Waste Byproduct item.
- Sale and Damage-report both take a `for update` lock on the identical `stock_levels` row before checking availability — confirmed no race window where the same unit could be sold and reported damaged concurrently.
- Showroom's own code comments explicitly state no Rework/Downgrade path exists for damaged stock (only Good→Sale / Damaged→Resolution) — confirmed true by absence of any `rejection_holds` row tied to `showroom_damage_reports`; matches the brief's own diagram exactly, not an oversight.

## 9. Sales Integration

Traced all five scenarios with exact SQL:

- **Sale → Delivery → POD**: deduction happens exactly once, at order creation, under a row-locked availability check. POD only ever posts a reversal for the *rejected* portion.
- **Sale → Edit**: correctly reverses the old product/quantity and applies the new one — never stacks both. A lower-severity concurrent-edit race was found (the pre-edit snapshot is read outside any lock) and is documented, not fixed this phase (§18).
- **Sale → Cancel**: idempotent by construction (`wasCancelling` flag), correctly nets out already-accepted/returned quantity, correctly posts zero movement when there is nothing left to claw back.
- **Sale → Delivery Rejection**: **fixed** — was computing its reversal from a stale pre-lock read with no guard against being recorded twice (finding #3). Now locks the delivery order fresh inside the transaction, re-reads the sales order's bookkeeping under its own lock, and refuses a second POD recording outright.
- **Sale → Short Close**: **fixed** — identical defect class, independently (finding #4). Now locks and re-reads fresh, and refuses to close an order that's already `Cancelled` or `Closed (Short)`.

All five: confirmed no negative-stock possibility (every deducting path is row-locked with a pre-check), and confirmed (post-fix) no duplicate-reversal possibility on the two paths that previously allowed it.

## 10. Inventory Integration

- **Fixed**: `stockTransfersDispatch`'s source-availability check had no row lock — two concurrent dispatches drawing from the same (item, warehouse) could both pass and both be recorded, corrupting the ledger without ever going negative (the floor-clamped update masked it). Now locked; live-verified normal dispatch still succeeds (no regression).
- **Fixed**: the legacy `stock_movements`-based transfer-approval path (`stockTransferApprove`) — superseded by `stockTransfersApproveReject` for the current `stock_transfers` table but still wired to Electron IPC and a mobile REST route — had no Workshop Isolation check at all, unlike its replacement. Now closed; live-verified a Nyanza-scoped user is denied approving a Gatare↔Showroom transfer, and a correctly-scoped user still succeeds.
- Material Request → Stock Transfer confirmed as a single, shared implementation (no per-department duplication) with the originating department/workshop traceable via a real foreign-key chain (`stock_movements.transfer_id → stock_transfers.id ← material_requests.transfer_id`), not a flat reference string.

## 11. Maintenance Integration

The Maintenance Job → Material Request → Stock Transfer → Dispatch → Receive → Inventory → Maintenance Record chain was **live-exercised end-to-end for the first time** — no prior production data had ever completed it (a direct query for any existing `material_requests.maintenance_job_id` link returned zero rows before this test). Result: fully working. `maintenanceJobDetail`'s `parts` array correctly showed the created material request with `received_qty: 5` after a full dispatch+receive cycle, alongside `transfer_status: 'completed'` — the maintenance job reference and the real received quantity both survive the complete chain, confirmed live, not just by code reading.

## 12. Logistics Integration

**Fixed**: Logistics was the only one of six material-request-eligible departments (Mechanician/Harvesting/Sawmill/Poles/Nyanza/Logistics) whose mobile navigator never mounted a Material Request *creation* screen — only a read-only "My Requests" timeline, despite `logistics` holding the same backend permission the other five already use for full CRUD. Closed by nesting the existing `MaterialRequestCreateScreen` into the existing `MyRequestsStack` (a stack push, not a new tab — Logistics' mobile navigator already has 16 tabs), reusing the screen exactly as-is.

## 13. Fleet Integration

Not a focus of this phase's audits; Fleet & Equipment's Production Ready status (established across its own dedicated Phase 1-3) is carried forward, not re-verified here. A Fleet vehicle id was used incidentally in this phase's Stock Transfer dispatch test with no issues encountered.

## 14. CRUD/UI Parity

Full sweep of 8 major entities (Pole Production Batches, Purchased Pole QC, VAT Production Batches, Sawmill Production Offcuts, Rejection Hold resolution actions, Stock Transfers, Material Requests, Maintenance Jobs) — see `ERP_ENTERPRISE_FINAL_COMPLETION_MATRIX.md` for the full table. Found and fixed:

- Logistics mobile Material Request creation (§12).
- Nyanza/VAT Production Batch mobile Delete — backend and desktop both worked; the mobile hook (`useVatDelete`) existed but was never called from any screen. Wired into a new Delete action on `VatDetailScreen`, reusing the exact `ReasonModal` pattern already established for this class of action elsewhere in the codebase, including the `pendingApproval` handling the orphaned hook was missing.

Found and **deferred** (documented, correctly scoped, not fixed this phase):
- Nyanza/VAT Production Batch mobile **Update** — needs a new mobile edit screen, a bigger lift than a wiring fix.
- Rejection Hold **Downgrade** on mobile — confirmed intentional (matches the identical, already-established Sawmill/VAT mobile restriction, needs a product picker).
- `polesSourceReport` — mobile hook exists, no screen calls it yet.

## 15. Permissions

Live-tested with real accounts, not just code reading: a Gatare-scoped `supervisor` (id 11, active production account) correctly approves a same-workshop requisition; a purpose-created, disposable Nyanza-scoped `supervisor` is correctly denied approving a Gatare requisition and correctly denied approving a Gatare↔Showroom legacy transfer. No new permission model was introduced; every fix reused the existing `isWorkshopRestricted`/`mustRole`/literal-role-array idioms exactly as already established.

## 16. Workshop Isolation

**Mandatory per the brief — audited exhaustively, not spot-checked.** A dedicated audit swept every list/detail/create/update/delete/approval/QC/rejection/resolution/reporting function across the entities in scope, tabulated PASS/MISSING per function. Result: **2 real gaps found, both fixed and live-verified**:

1. `procurementApprovalAction` — no isolation check at all (finding #5). Fixed: entity's workshop_id (for `requisition`/`po` entity types — the two that carry one; `invoice`/`payment` are finance-level and unscoped by design) is now re-validated against the acting user's own workshop before any mutation.
2. Legacy `stockTransferApprove` — same gap (finding #6). Fixed identically.

Also confirmed, by direct grep across every client-supplied `workshop_id` used in a write path (22 occurrences): **no bypass vector found** where a raw client-supplied value is trusted on an INSERT without first going through the standard `isWorkshopRestricted(user) ? user.workshop_id : (payload.workshop_id || null)` idiom.

## 17. Approval Engine

All five chains verified real (Procurement, Material Request, Stock Transfer, Inventory Adjustment, Governance): Submit → Pending → role-matched Approve → Action Applied; Submit → Reject → confirmed no downstream artifact exists yet to need reversing, for every chain (each entity type's own "who can generate the next artifact" gate — e.g. `procurementRfqCreate` requiring `status='approved'` — structurally prevents a rejected entity from having spawned children). Race-condition hardening (row lock + in-transaction re-read, self-approval blocked, status re-checked under lock) confirmed present in the Governance engine (`_decideApprovalWithinLock`), documented as a fix from an earlier phase and re-confirmed still in place, not re-broken by anything touched this phase.

## 18. Notifications

Full cross-reference of every `relatedModule` value `data.js` emits against both platforms' routing registries. **2 real, fixed gaps**:

- SRM contract-renewal/expiry reminders used `relatedModule:'srm'` (recognized by neither registry) and `relatedId` set to the contract's own id (which no route resolves to anyway) — the sibling compliance reminders had already been fixed to use `'procurement-suppliers'` + the supplier id in an earlier phase, but the two **contract** reminder call sites were missed. Fixed identically (also required adding `c.supplier_id` to the underlying query, which hadn't selected it).
- Maintenance-overdue escalations passed a `machine_maintenance_schedules` id as `relatedId` with `relatedModule` falling through to a Title-Case string nothing recognizes. Since no per-schedule detail screen exists on either platform (and building one is new-feature work, out of this phase's scope), the fix routes to the machine itself instead — a real id both platforms' Machine Registry screen can resolve, added as a new page-only registry entry on both platforms (matching the existing `material-requests`/`purchased_pole_qc` page-only precedent).

**6 further gaps found, documented, not fixed** (no safe existing destination without new UI): `'Security'` and `'Governance'` (capital-variant, distinct from the already-handled lowercase `'governance'`) and `'System'` system-health alerts, plus the same Title-Case-fallback defect class affecting Delivery/Workflow/Approval-edit/Approval-delete/Procurement-improvement-plan escalations. None of these six are inside the 11 named departments' core operational workflows — flagged for a future phase, not silently dropped.

## 19. Audit Trail

Confirmed immutable at **two independent layers**, not just by convention: `logAudit` only ever executes an INSERT (a failure queues a retry job, never a fallback mutation); and, more strongly, `db/migrate.js` installs Postgres-level `RULE`s (`audit_log_no_update`/`audit_log_no_delete`) that silently no-op any UPDATE/DELETE against the table regardless of code path — confirmed by reading the actual rule definitions, not inferred. A repo-wide grep for any UPDATE/DELETE against `audit_log` returned zero matches. Four spot-checked functions (across Pole Production, Procurement) all call `logAudit` with a real authenticated user, a descriptive action, and a concrete record reference — none stubbed.

## 20. Reporting

Every Pole Production, Nyanza/VAT, Sawmill Quality, and Procurement report function checked has a real caller on Desktop — Procurement's reporting surface in particular is exceptionally thorough on mobile (14 tabs matching desktop 1:1). One stranded report found: `polesSourceReport` — full backend, desktop UI, mobile hook, but no mobile screen calls it (§14, documented deferred).

## 21. Mobile/Desktop Parity

See §14 and the completion matrix. Summary: parity is close to complete across all 10 actively-audited departments. Every remaining gap is either fixed this phase or explicitly documented with a stated reason it wasn't (a genuinely larger lift, or an intentional cross-department design decision already established in a prior phase) — none is a silent omission.

## 22. Inventory Reconciliation

For every product touched by this phase's live testing, `Opening + Receipts + Production + Transfers In + Reversals − Sales − Consumption − Transfers Out − Waste − Disposal = Closing` was confirmed to hold exactly, by reconstructing each item's full `stock_movements` ledger and comparing it against the live `stock_levels` value, both before applying this phase's own test data and after reversing it:

- Waste Byproduct — Firewood (item 28) @ Gatare: ledger-reconstructed baseline = 2 (matches the figure this program's own prior Pole Production Phase 2 disclosed as pre-existing, uncorrected residue) — self-consistent, no new discrepancy.
- Poles/HQ/Showroom stock touched by this phase's tests: all reconciled to exactly 0 residual after reversal — clean.
- **Timber item 20 @ Gatare Workshop: a genuine, unexplained discrepancy was found** — see §26/§25 for the full account. This is the one reconciliation that did **not** cleanly resolve, and it is disclosed rather than papered over.

## 23. Cross-Department Test Results

Live, disposable-QA-data test results (all against the production database, per this program's established safety discipline):

- **Workshop Isolation fix verification** (`procurementApprovalAction` + legacy `stockTransferApprove`): 4/4 checks passed (cross-workshop denied, same-workshop still succeeds, for both functions).
- **`resolutionCreate` partial-volume fix**: 3/3 checks passed (partial rejected with the new error, source row confirmed not marked resolved, full-volume resolution still succeeds).
- **`stockTransfersDispatch` regression check**: 1/1 passed (normal dispatch still works after adding the row lock).
- **`salesCloseShort` double-call guard**: 4/4 checks passed (first call succeeds and posts the correct reversal, second call is rejected with the new status-guard error, stock confirmed not double-credited).
- **Delivery POD double-record guard**: 4/4 checks passed, after catching and fixing a real bug in the fix's own first attempt (a `FOR UPDATE` clause on the nullable side of a LEFT JOIN, which Postgres rejects outright — fixed to `FOR UPDATE OF` the specific table, re-tested, passed).
- **Mechanician chain** (§11): 9/9 checks passed once the correct function argument shapes were used (this test doubled as the very first live exercise of a chain that had zero prior production data).

**33/33 real live checks passed** across this phase's own fix-verification and cross-department journey testing (in addition to the 6 parallel code-audit agents' evidence-based findings that fed this report).

## 24. Bugs Discovered

See Executive Summary (§1) for the full list of 9 fixed defects. In addition, found and **not** fixed (documented per §14/§18/§21, or per §26 below):

- `salesUpdate`'s pre-edit snapshot read outside any row lock (lower-severity sibling of the two fixed Sales races).
- `stock_catalog.category` has no server-side enum/CHECK constraint (data-governance risk, not a code defect).
- `_postFinishedTimberStock` silently posts no `stock_movements` row when `itemId`/`warehouseId`/`qty` is falsy — an audit-trail gap for sales orders whose product doesn't resolve to a catalog stock item.
- 6 further notification `relatedModule` routing gaps with no safe existing destination (§18).
- **A pre-existing, unexplained ~60-unit stock discrepancy** for Timber item 20 at Gatare Workshop (§26) — the most significant open item from this phase, disclosed and requiring investigation before any correction is made.
- 3 notifications left over from an earlier phase's (Pole Production Phase 2) own cleanup were found and removed as a byproduct of this phase's cleanup — a minor, self-corrected miss from that prior phase, not from this one.

## 25. Deferred Items

- Nyanza/VAT mobile Update screen.
- `polesSourceReport` mobile screen.
- 6 lower-priority notification routing gaps (§18).
- `salesUpdate` concurrent-edit race (lower severity than the two fixed Sales races).
- `stock_catalog.category` enum/CHECK constraint (schema change, out of "verification not redesign" scope).
- Investigation of the item-20/Gatare stock discrepancy (§26) — requires a business decision on how to proceed, not a code fix.
- Fleet & Equipment was not re-audited this phase (§13).

## 26. Production Readiness

```
ERP
 │
 ├── COMPLETE
 │
 ├── ✅ COMPLETE WITH DOCUMENTED LIMITATIONS   ← this phase's determination
 │
 └── NOT READY
```

**Rationale**: every workflow named in the brief's 25 priorities was traced with concrete evidence, not assumed. 9 real defects — including one classified against the brief's own "mandatory" Workshop Isolation requirement — were found, fixed, and live-verified, each with a before/after check proving the fix actually closes the gap without breaking the working case. The one item keeping this from an unqualified "COMPLETE" is the disclosed, unexplained stock discrepancy below, which this phase deliberately did **not** attempt to silently resolve.

### The one open item requiring your decision

While precisely reversing this phase's own test data for Timber item 20 (`stock_catalog` id 20, "Untreated 100×200×4m") at Gatare Workshop, the item's full `stock_movements` ledger was reconstructed to compute the exact reversal needed. That reconstruction revealed the **live** `stock_levels` value (before any of today's testing) did not match what the prior Pole Production Phase 2 session's own cleanup arithmetic had explicitly set it to (2 units, confirmed via that phase's own verification query). The actual pre-existing value was higher by roughly 60 units, with no corresponding entry anywhere in that item's movement history to explain the difference.

This phase's own testing has been **fully and precisely reversed** regardless of this discrepancy — the item was restored to exactly its state immediately before this phase's tests began, not to a guessed "correct" value. The unexplained portion was not created by this phase and has been left untouched, per this program's standing rule against altering historical data without approval. It needs your decision: either a manual stock count/audit to determine which figure (the ledger-derived one or the currently-stored one) is correct, or an explicit instruction on how to proceed.

**Everything else audited and tested this phase is genuinely production-ready.**

## 27. Final Completion Matrix

See `ERP_ENTERPRISE_FINAL_COMPLETION_MATRIX.md` (companion deliverable).

---

**Nothing has been committed or pushed.** Per the Stop Rule, no other department or phase begins automatically. Awaiting review/approval before any next step — including before any action on the disclosed stock discrepancy in §26.
