# Enterprise Timber Lifecycle Integration Program — Phase 1 — Changelog

## Database (`db/migrate.js` → `createTimberLifecyclePhase1()`)

New tables: `harvest_waste_categories` (seeded with 6 defaults), `harvest_waste`, `resolution_records` (shared by both `harvest_waste` and `production_offcut` sources), `attachments` (polymorphic `entity_type`/`entity_id`, generalizes the existing Supplier Documents pattern), `production_offcuts`, `quality_inspections`. New column: `log_transport.receipt_reference` (nullable, unique per workshop when supplied). New permission grant: none required (all new pages gate on existing `harvest`/`daily-harvest`/`daily-timber`/`timber-inventory` permissions).

## Backend (`db/services/data.js`)

- `_rawLogAvailableStock` — now also subtracts recorded Harvest Waste (integration point, not a redesign).
- `logTransportCreate` — added duplicate-receipt-reference validation and a hard check that transport quantity can't exceed harvested-minus-transported-minus-waste.
- New: `harvestWasteCategoriesList`, `harvestWasteCategoryCreate`, `harvestWasteCreate`, `harvestWasteList` (Workstream 1).
- New: `resolutionCreate` (the one reusable Resolution Engine), `resolutionsList`, `_resolveWasteByproductStockItem` (Workstream 2).
- New: `attachmentRegister`, `attachmentsList`, `attachmentGet`, `attachmentDelete` (generalized attachments).
- New: `productionOffcutCreate`, `productionOffcutsList`, `productionOffcutDecide`, `productionOffcutRecordRecovery`, `qualityInspectionCreate` (Workstream 4).
- New: `productionReconciliation` (Workstream 5).
- `harvestDashboard` — extended with `harvestWaste` (today/week/month/total) and `harvestEfficiencyPct`; `rawLogInventory` now nets out waste (Workstream 6).
- `sawmillManagerDashboard` — extended with `resawRecoveryPctMonth`, `netYieldPctMonth`, `offcuts` (pending counts), and a new `offcuts_pending_decision` alert (Workstream 6).

## Mobile API

- New routes: `mobile-api/routes/harvestWaste.js`, `mobile-api/routes/resolutions.js`, `mobile-api/routes/productionOffcuts.js`, `mobile-api/routes/attachments.js` (multer + disk, mirrors `supplierDocuments.js`'s pattern, generalized).
- `mobile-api/server.js` — registers all 4 new route mounts.

## Electron (`electron/main.js`, `electron/preload.js`)

- New IPC handlers for all Harvest Waste / Resolution / Production Offcut / Reconciliation functions.
- New `attachments:list/upload/download/delete` handlers, proxied over HTTP to mobile-api exactly like the existing `srm-documents:*` handlers (reuses `_srmApiBase`/`_srmServiceToken`/`_unwrapSrmEnvelope` and the existing `srm-documents:pick-file` dialog handler as-is).

## Desktop (`renderer/app.js`, `renderer/index.html`)

- New shared `openResolutionModal()` — the one Resolution Engine UI, reused by both Harvest Waste and Production Offcuts.
- New shared `renderAttachmentsPanel()` — generalized attachments widget.
- `renderDailyHarvest` — new "Harvest Waste & Efficiency" dashboard section and a new "Harvest Waste" card (list + Record Waste form).
- `renderSawmillDashboard` — new "Production Offcuts & Resaw" card (Recoverable decision, Record Recovery, Quality Inspection actions) and a new "Production Reconciliation" card; KPI row extended with Resaw Recovery %/Net Yield %.

## Mobile

- `mobile/src/types/api.ts` — new types for Harvest Waste, Resolutions, Production Offcuts, Reconciliation, Attachments.
- `mobile/src/api/endpoints.ts` — new endpoint constants for all 4 new route groups.
- New `mobile/src/hooks/useTimberLifecycle.ts` — all new hooks.
- New `mobile/src/screens/harvest/HarvestWasteScreen.tsx` — list + inline create form + simple (Disposal/Other) resolution actions.
- `mobile/src/navigation/HarvestStack.tsx` / `types.ts` — new `HarvestWaste` stack screen; `HarvestListScreen` gains a header link to it.
- `mobile/src/screens/sawmill/SawmillDashboardScreen.tsx` — new Production Offcuts card (Recoverable decision + simple resolutions; Record Recovery/Inspection point to desktop) and Reconciliation card.

## Verification

- `node --check` clean on all touched backend/desktop/electron/mobile-api files; `tsc --noEmit` clean on mobile.
- Live end-to-end verification of the full chain (Harvest → Harvest Waste → Resolution → Log Transport validation → Sawmill Production → Production Offcuts → Resaw → Quality Inspection → Reconciliation → Dashboards) against production data with throwaway QA data — every success path and every rejection path (over-limit waste, duplicate transport receipt, over-limit transport, double-resolution, over-limit recovery, over-limit inspection) confirmed correct. All QA data removed afterward; every new table confirmed empty, `stock_levels`/`stock_catalog` confirmed back at exact pre-test baseline.

## Not changed

No redesign of Harvesting or Sawmill individually. No second inventory system, no second costing system, no duplicated business logic — every posting reuses `stock_catalog`/`stock_levels`/`stock_movements`/`audit_log`/the notification engine/the approval engine/the existing permission system exactly as they already work. Finished Timber Inventory, Nyanza, Showroom, and Sales are untouched, per this phase's explicit scope boundary.
