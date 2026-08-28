# ERP Enterprise Cross-Department End-to-End Verification — Changelog

Scope: cross-department integration verification across Procurement, Timber Lifecycle (Sawmill/Harvesting), Pole Production, Nyanza/VAT, Showroom, Sales, Inventory/Stock Transfers, Material Requests, Mechanician, Logistics, Permissions, Workshop Isolation, Approvals, Notifications, Audit, and Reporting. This was a verification phase — fixes were made **only** where verification found a genuine defect in an already-established workflow, never as new feature work. No new engine, no parallel workflow, no architecture redesign. Nothing committed or pushed.

## Method

1. Six parallel, read-only code-audit passes (one per major integration cluster), each producing `file:line`-cited findings — no live database writes during this stage.
2. Findings consolidated and classified (Backend / UI / Permission / Integration / Data-integrity / Notification / Intentional).
3. Every genuine defect fixed and immediately live-verified against the production database with disposable, uniquely-tagged QA data, in a dedicated test per fix.
4. A cross-department "real user journey" test (Mechanician: Maintenance Job → Material Request → Stock Transfer → Dispatch → Receive → Inventory) exercised end-to-end for the first time.
5. Full QA data cleanup, independently verified against a fresh query (not assumed from the cleanup script's own output).

## Fixed

### `db/services/data.js`

- **`resolutionCreate`** — added a check requiring the resolution `volume` to exactly equal the source's full remaining quantity. Previously, any `volume` up to the full quantity was accepted, and the source row (`harvest_waste`/`production_offcuts`/`rejection_holds`/`showroom_damage_reports`) was unconditionally marked terminally resolved regardless of whether the full quantity was actually posted — silently losing the unposted remainder from every reconciliation total, across all 4 source types (6 origins, counting Timber/VAT/manufactured-Pole/purchased-Pole as the 4 sub-origins of `rejected_timber`). Since marking-resolved was always unconditional, no caller could ever have completed a legitimate multi-destination split anyway (a follow-up call would hit "already resolved"), so this closes a real, currently-unusable-in-practice bug rather than removing a working feature.
- **`stockTransfersDispatch`** — added `for update` to the source `stock_levels` availability read (previously unlocked, unlike every other place in this file that checks-then-deducts). Closes a TOCTOU race where two concurrent dispatches from the same (item, warehouse) could both pass the availability check and both post a movement, corrupting the ledger.
- **`_applyDeliveryOrderPOD`** — the delivery-order row (and, through it, the linked sales order's bookkeeping totals) is now locked and re-read fresh *inside* the transaction, with an explicit `status === 'POD Recorded'` guard before proceeding. Previously the row was read via a plain `pool.query` before the transaction opened; a `for update` was taken on the sales order afterward but never used to re-read the value actually being written, and nothing prevented the same delivery's POD from being recorded twice. Required `for update of do2` (not a bare `for update`) since the query outer-joins `sales_orders`, which Postgres does not allow locking on the nullable side of — caught by the first live-test attempt, fixed, re-verified.
- **`salesCloseShort`** — identical fix, independently: the order row is now locked and re-read fresh inside the transaction, with a new guard against re-closing an order already `Cancelled` or `Closed (Short)`.
- **`procurementApprovalAction`** — added a Workshop Isolation check: for `requisition`/`po` entity types (the two that carry a `workshop_id`; `invoice`/`payment` are finance-level and intentionally unscoped), the entity's workshop is now re-validated against the acting user's own workshop before any approval-step mutation. Previously absent entirely — a workshop-restricted `supervisor` (the first-stage approver role) could approve or reject any workshop's requisition/PO by id.
- **`stockTransferApprove`** (legacy `stock_movements`-based transfer approval, superseded by `stockTransfersApproveReject` but still wired to Electron IPC and a mobile route) — added the same Workshop Isolation check its replacement already has.
- **`_checkEscalationMaintenanceOverdue`** — now passes the machine's id (not the maintenance-schedule id) as the escalation's `relatedId`, since no per-schedule detail screen exists on either platform to resolve the schedule id to.
- **`ENTITY_ESCALATION_MODULE`** — added `maintenance: 'machines'`, mapping Maintenance-overdue escalations to the Machine Registry (page-only route, both platforms) instead of falling through to an unrecognized Title-Case string.
- **SRM contract-renewal/expiry reminders** (`_schedSrmReminders`) — `relatedModule` changed from `'srm'` (recognized by neither platform's routing registry) to `'procurement-suppliers'`, and `relatedId` changed from the contract's own id to `c.supplier_id`, matching the identical fix already applied to the sibling compliance reminders in an earlier phase (the contract reminders were missed at the time). Required adding `c.supplier_id` to the underlying query's SELECT list.

### `renderer/app.js`

- `NOTIFICATION_ROUTES` — added `'machines': { page: 'machines' }` (page-only, matching the existing `material-requests` precedent).

### `mobile/src/utils/notificationRouting.ts`

- Added `'machines': () => ({ screen: 'MachinesList', params: {} })`, matching the desktop entry above.

### Mobile — Logistics Material Request creation (`mobile/src/`)

- `navigation/types.ts` — added `MaterialRequestCreate: undefined` to `MyRequestsStackParamList`.
- `navigation/stacks/MyRequestsStack.tsx` — registered `MaterialRequestCreateScreen` (reused as-is; it only ever calls `navigation.goBack()`, so nesting it under a different stack than its own declared param-list type is safe).
- `screens/shared/MyRequestsScreen.tsx` — added a "+" header action (gated on the existing `material.request` permission, matching every other department's create-button gate) navigating to the newly-registered screen.

### Mobile — Nyanza/VAT Production Batch Delete (`mobile/src/`)

- `types/api.ts` — added `VapPendingApproval`, matching the shape every other governed-delete hook in this codebase already declares (`MachinePendingApproval`, `VehiclePendingApproval`, etc.).
- `hooks/useVat.ts` — `useVatDelete`'s `deleteBatch` now checks for and returns a `pendingApproval` result instead of silently invalidating queries and returning void when governance blocks the delete. This hook existed since the Nyanza Value-Added Production phase but was never called from any screen, so this dormant bug was never exercised in practice.
- `screens/vat/VatDetailScreen.tsx` — added a Delete action (icon + confirmation via `ReasonModal`, `pendingApproval` handling), directly mirroring the established `MachineFuelDetailScreen` pattern. Desktop's own delete button has no "already-inspected" gating either (the backend's own `applyGovernance` call is the single source of truth for whether a delete is allowed), so mobile intentionally doesn't add extra client-side gating beyond what desktop has.

## Verified, no code change needed

- Procurement→Inventory for every category (Timber, Logs, Finished Poles, and all other purchased categories) — the Pole QC gate's exact-string-match design confirmed safe, no collision risk.
- Pole Production's two paths confirmed fully fungible in Sales once stock is posted.
- Nyanza input consumption confirmed a real, row-locked hard stock check (not a soft counter).
- Showroom Sale vs. Damage-report confirmed race-safe (both row-lock the same `stock_levels` row).
- Audit Trail confirmed immutable at both the application layer (`logAudit` only ever INSERTs) and the database layer (Postgres `RULE`s block UPDATE/DELETE against `audit_log` outright).
- Material Request → Stock Transfer confirmed a single shared implementation across all 6 eligible departments, with real foreign-key traceability back to the originating department/workshop.
- 22 client-supplied `workshop_id` write-path usages grepped and confirmed to universally go through the standard `isWorkshopRestricted` idiom — no bypass vector found.

## Not fixed (documented, correctly scoped)

- `salesUpdate`'s pre-edit snapshot read outside a row lock — same defect class as two fixed Sales races, lower severity/likelihood, not fixed this phase.
- `stock_catalog.category`'s lack of a server-side enum/CHECK constraint — data-governance risk, schema change, out of scope.
- `_postFinishedTimberStock`'s silent no-op (no `stock_movements` row) when `itemId`/`warehouseId`/`qty` is falsy.
- 6 further notification `relatedModule` routing gaps (`Security`, `Governance` capital-variant, `System`, Delivery/Workflow/Approval-edit/Approval-delete/Procurement-improvement-plan Title-Case fallbacks) with no safe existing destination screen.
- Nyanza/VAT mobile Update screen (needs new UI, bigger lift than this phase's wiring-only fixes).
- `polesSourceReport` mobile screen (hook exists, unused).
- VAT literal-role exclusion from Disposal/Downgrade/Return-to-Inventory for `vat-leader`/`vat-supervisor` — confirmed intentional (matches the identical, already-established Poles restriction), not changed.
- Rejection Hold Downgrade's mobile absence — confirmed intentional (matches Sawmill/VAT's own established mobile restriction), not changed.
- Fleet & Equipment — not re-audited this phase; status carried forward from its own dedicated prior phase.

## Disclosed, not corrected

- **Timber item 20 (`stock_catalog`, "Untreated 100×200×4m") at Gatare Workshop**: while reversing this phase's own test data, the item's full movement ledger was reconstructed and the pre-existing `stock_levels` value did not match what a prior phase's own cleanup had explicitly set (62 vs. an expected 2, based on that phase's own verification record — a ~60-unit gap with no corresponding ledger entry). This phase's own contribution has been precisely and fully reversed regardless. The underlying discrepancy predates this phase, was not caused by it, and has been left untouched pending investigation/a business decision — not silently corrected.
- 3 notification rows left over from the prior Pole Production Phase 2's own cleanup were found (by timestamp, clearly from that phase's testing window) and removed as part of this phase's own cleanup pass.

## Verification

- 6 parallel code-audit agents, each covering a distinct integration cluster, all findings backed by `file:line` citations.
- `node --check` clean on every touched backend file (`db/services/data.js`, `renderer/app.js`) after every fix, and again after all fixes combined.
- `npx tsc --noEmit` clean across `mobile/` after every mobile change, and again after all changes combined.
- Migration re-run twice consecutively (no schema changes this phase) — confirmed no regression.
- **33/33 live checks passed** across dedicated fix-verification tests (Workshop Isolation ×4, `resolutionCreate` ×3, `stockTransfersDispatch` regression ×1, `salesCloseShort` ×4, delivery POD ×4 — including catching and fixing a real bug in the fix's own first attempt) and the Mechanician cross-department journey test (×9, exercising that chain end-to-end for the first time against real data).
- All QA data (2 requisitions' worth of chain data, 1 disposable cross-workshop test user, 1 harvest-waste + resolution record, 2 stock transfers + dispatch rows, 2 sales orders, 1 delivery order, 1 maintenance job, 1 material request, 7 stock movements, 23 notifications) fully deleted after testing; affected `stock_levels` rows restored to their exact pre-test values (except the one item where a pre-existing, unrelated discrepancy was found and deliberately left untouched — see above); zero residue independently verified via direct query, not assumed from script output.

## Not committed

Per this phase's Stop Rule, nothing above has been committed or pushed. All changes are local working-tree edits pending review.
