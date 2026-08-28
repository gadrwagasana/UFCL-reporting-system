# ERP Final Enterprise Hardening & HR Completion Phase — Changelog

This phase was primarily an audit/documentation phase (Priorities 1-4: Attendance→Casual
Labour Hours, Attendance notifications, Attendance correction approval, Payroll). Per the
brief's explicit "STOP and document, do not invent" instruction, none of those four produced
code changes — see the Completion Report §§6-9 and the Gap Register for what was found.
Real code changes were made only for Priority 5 (Notification Completion) and Priority 6
(Reporting Completion), both closing previously-disclosed Yellow-status gaps.

## Priority 6 — Reporting Completion (`renderer/app.js`)

Added CSV export to every report previously flagged as lacking one, reusing the existing
`downloadCsv()` helper throughout — no new export mechanism introduced.

- **Poles** (`renderDailyPoles`): added `poleReconExport`/`poleSourceExport` buttons; new
  `_lastPoleReconciliation`/`_lastPoleSourceReport` closure variables capture each report's
  last-loaded result for the export handlers to read.
- **Sawmill** (`_loadProductionReconciliation`): added `_lastProductionReconciliation`;
  extended the existing combined `sd-export` button (Sawmill Dashboard) with a new
  Reconciliation section.
- **Harvest Waste** card: added `hwExport` button; `_lastHarvestWaste` captures the
  last-loaded rows.
- **VAT/Nyanza** (`renderValueAddedProduction`): added `vapExport` button to the Quality
  report card — this page reuses Sawmill's `qualityReport`/`_loadQualityReport()` but
  previously had no export at all. New `_lastVapReconciliation`/`_lastVapReport` locals feed
  a combined Quality + Reconciliation + Input/Output CSV.
- **Rejection Holds** (shared `_loadRejectionHolds`, used by Sawmill/VAT/Poles): added an
  `rh-export` button alongside the existing `rh-history` button.
- **Resolution History modal** (`openResolutionHistoryModal`): added a `resHistExport`
  button to the modal's button row.

`node --check renderer/app.js` clean after each batch.

## Priority 5 — Notification Completion

### `db/services/data.js`

**`ENTITY_ESCALATION_MODULE`** — 4 of 10 escalation entity types had no mapping and fell
through to a title-cased fallback string that matched no routing key on either platform:

- `delivery: 'deliveries'` — relatedId is a real `delivery_orders.id`.
- `security: 'audit'` — relatedId is the literal `'_global'` (system-wide alert, not a
  per-record id); routes to Audit Log, where the underlying `login_failed` events live.
- `approval_edit: 'governance'`, `approval_del: 'governance'` — relatedId is a real
  `pending_edits.id` / `deletion_requests.id`, both reviewed on the Security & Governance
  page. (`workflow` and `procurement_improvement_plan` were confirmed to have no real
  destination and remain intentionally unmapped — see the Gap Register.)

**8 automation-engine `_autoAct({module: 'CapitalizedString', ...})` call sites** — each
`module` value flows unmodified into the notification's `relatedModule` field
(`_autoAct`'s `relatedModule: mod ?? null`), and none of the 8 capitalized literals matched
any routing key on either platform. Each was re-mapped based on its `relatedId` semantics,
not a blind lowercase:

| Rule | Was | Now | Why |
|---|---|---|---|
| `stock_low` | `'Stock'` | `'stock'` | relatedId is a real `stock_catalog` item id; new page-only route added |
| `maintenance_due` | `'Machines'` | `'machines'` | exact-match lowercase key already existed |
| `delivery_overdue` | `'Logistics'` | `'deliveries'` | relatedId is a real `delivery_orders.id`; `'logistics'` was never a routing key |
| `workflow_failure` | `'System'` | `'governance'` | notification body already says "Security & Governance"; reused existing key rather than a new one to the same page |
| `security_alert` | `'Security'` | `'audit'` | notification body already says "Audit Log"; reused existing key |
| `approval_escalate` | `'Approvals'` | `'governance'` | same destination as the routine approval-queued notification |
| `fuel_anomaly` | `'Fuel'` | `'fuel'` | fleet-wide alert (relatedId already null); new page-only route to Vehicle Fleet, the closest reviewable destination (vehicle fuel logs only render inside a per-vehicle detail tab, not a standalone page) |
| `harvest_behind` | `'Harvest'` | `'harvest'` | relatedId is a real `compartments.id`; new page-only route (no per-compartment detail screen exists on either platform) |

### `renderer/app.js` — `NOTIFICATION_ROUTES`

Added 3 new page-only entries: `'stock': {page:'stock-items'}`, `'fuel': {page:'vehicles'}`,
`'harvest': {page:'compartments'}`.

### `mobile/src/utils/notificationRouting.ts` — `NOTIFICATION_ROUTES`

Added the same 3 entries for parity: `'stock' → StockCatalogList`, `'fuel' → VehiclesList`,
`'harvest' → CompartmentsList`.

## Verification

- `node --check` clean on `db/services/data.js`, `renderer/app.js`, `electron/main.js`,
  `electron/preload.js`, `db/migrate.js`, `mobile-api/server.js`.
- `npx tsc --noEmit` clean across `mobile/`.
- A static cross-check script confirmed every `module`/`relatedModule` string the backend
  can now emit (10 distinct values across `_autoAct` and `ENTITY_ESCALATION_MODULE`, plus
  the pre-existing procurement ones) resolves to a real key in both platforms'
  `NOTIFICATION_ROUTES` (or is the special-cased root `'governance'` route) — zero
  mismatches. This was used instead of firing the live automation engine, which would have
  pushed real alert notifications to real admin/ceo accounts rather than disposable QA data.
- A read-only live check against the production database confirmed all 6 report functions
  backing the new export buttons (`poleProductionReconciliation`, `polesSourceReport`,
  `productionReconciliation`, `valueAddedProductionReconciliation`,
  `valueAddedProductionReport`, `harvestWasteList`) execute cleanly (`ok: true`, zero
  side effects — all are pure `SELECT`-based reads).

No database schema changes, no data corrections, and no QA data were required for this
phase's Priority 5/6 changes.

## CRUD Parity Final Check — 1 real gap found and fixed

A light confirmatory spot-check (one representative entity per department, not a full
re-audit — see Completion Report §12) found 15 of 16 clean and one real, undocumented
regression: **Pole Production Batch delete** had full backend (`poleProductionBatchDelete`,
governance-gated via `applyGovernance`), IPC, REST (`mobile-api/routes/poles.js`), and
desktop UI (`app.js`'s `.pole-batch-del` button) support, and even a correctly-implemented
mobile hook (`usePoleProductionBatchDelete`) — but the hook was never called from any mobile
screen. This is the exact same shape of bug the "ERP Enterprise Cross-Department
Verification" phase already found and fixed once for VAT's `useVatDelete` — Poles simply
hadn't received the same fix.

- **`mobile/src/types/api.ts`** — added `PolePendingApproval` (same shape as the existing
  `VapPendingApproval`/`MachinePendingApproval`/etc., one per module by this codebase's
  established convention).
- **`mobile/src/hooks/usePoles.ts`** — `usePoleProductionBatchDelete`'s `deleteBatch` was
  discarding the API response and unconditionally invalidating queries, even when the delete
  was actually blocked and queued for approval (`applyGovernance`'s `pendingApproval`
  response) rather than executed — a governance-restricted user would have seen the batch
  optimistically vanish as if deleted. Fixed to match `useVatDelete`'s exact pattern: return
  the `pendingApproval` result to the caller, only invalidate on a real delete.
- **`mobile/src/screens/poles/PoleBatchListScreen.tsx`** — wired the (now-fixed) hook in:
  added a "Delete Batch" button to each `BatchCard` (gated by `can('poles.write')`, the same
  permission already gating this screen's own Create action), an offline guard matching
  `VatDetailScreen`'s precedent (delete requires connectivity), and a `ReasonModal` collecting
  the required deletion reason — reusing the exact same governed-delete UI pattern already
  established for VAT/Machine Fuel/Vehicles rather than inventing a new one. Also surfaces the
  `pending_deletion` flag the backend already returns (previously received but never
  displayed on mobile) as a small badge on the card, matching desktop's own "Pending
  Deletion" badge.

`npx tsc --noEmit` clean after each edit.
