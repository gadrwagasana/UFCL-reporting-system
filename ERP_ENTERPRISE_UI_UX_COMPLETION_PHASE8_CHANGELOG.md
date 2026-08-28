# ERP Enterprise UI/UX Completion — Phase 8 — Changelog

Scope: mobile UI parity fixes + one backend notification-routing bug fix. No schema change, no permission-model change, no Workshop Isolation change, no desktop-only feature added.

## Fixed

### Alert.prompt → ReasonModal (Android compatibility)
`Alert.prompt` has no Android implementation in React Native; the following call sites previously failed silently (no dialog, no error) on Android. All converted to the existing cross-platform `ReasonModal` component.

- `mobile/src/screens/admin/ChangesScreen.tsx` — review (approve/reject) flow.
- `mobile/src/screens/automation/AutomationEscalationsScreen.tsx` — escalation resolve flow.
- `mobile/src/screens/products/ProductsListScreen.tsx` — product activate/deactivate flow.
- `mobile/src/screens/vehicles/VehicleDetailScreen.tsx` — vehicle/fuel-log/maintenance-record delete flows (3 sites, unified under one discriminated-union modal state).
- `mobile/src/screens/sawmill/SawmillDashboardScreen.tsx` — Quality Inspection (2-stage: numeric approved-qty via `ReasonModal`'s `extraContent` slot, then conditional rejection-reason) and Return to Inventory flows (3 sites).
- `mobile/src/screens/vat/VatProcessingScreen.tsx` — Value-Added Quality Inspection and Return to Inventory flows, same pattern (3 sites).

### Mobile Stock Transfers navigation gap (audit findings M-15/M-16)
`showroom-staff`, `vat-leader`, `vat-supervisor` hold the backend `stock-transfers` permission but had no navigator tab to reach it.

- `mobile/src/navigation/types.ts` — added `StockTransfers` to `SalesTabParamList`, `VatTabParamList`, `VatSupervisorTabParamList`.
- `mobile/src/navigation/SalesNavigator.tsx` — added conditional `StockTransfers` tab (shown to `showroom-staff` only, alongside the existing `Showroom` tab).
- `mobile/src/navigation/VatNavigator.tsx` — added `StockTransfers` tab.
- `mobile/src/navigation/VatSupervisorNavigator.tsx` — added `StockTransfers` tab.

### Supplier-compliance notification routing bug (both platforms)
`db/services/data.js` — the supplier-compliance reminder job emitted `relatedModule: 'srm'` for its two compliance notification types, which neither desktop's nor mobile's notification-routing registry recognizes (both key on `'procurement-suppliers'`, which already has a working `SupplierDetail`/`openSupplierManageOverlay` destination). Changed both call sites to `relatedModule: 'procurement-suppliers'`. Contract-expiry notifications (a separate pair of call sites, relatedId = contract id) were left unchanged — no per-contract detail screen exists on either platform, same limitation `governance` already has.

## Documentation-only (no behavior change)

- `mobile/src/utils/notificationRouting.ts` — documented `sales`/`deliveries` as intentionally-unroutable modules (no single-record-by-id fetch exists), matching the existing documentation standard already used for `material-requests`.
- `renderer/app.js` — same documentation addition to desktop's `NOTIFICATION_ROUTES` comment block.

## Found, not fixed (documented in the completion report, §4/§17)

- `procurementBenchmark` and `supplierDocumentsRegister` — real backend capability (IPC+REST wired) with no UI entry point on either platform. Not built this phase pending an explicit user decision on priority.
- `stockTransferApprove`, `procurementSupplierToggleBlacklist` — confirmed dead-by-design (superseded by newer equivalents already in use), not gaps. No action needed.

## Verification

- `node --check` clean on every touched `.js` file: `db/services/data.js`, `renderer/app.js`, `electron/main.js`, `electron/preload.js`, all `mobile-api/routes/*.js`, `mobile-api/server.js`, all `mobile-api/middleware/*.js`.
- `npx tsc --noEmit` clean across the full `mobile/` app after every edit in this phase.
- Live DB spot-checks confirmed real destination data exists for the fixed flows (see completion report §14) and that 3 pre-existing `'srm'`-tagged notifications are historical-only (harmless, not backfilled).
- No interactive device/simulator UAT was possible in this environment — disclosed as a limitation in the completion report, not glossed over.

## Not committed

Per this phase's Stop Rule, nothing in this changelog has been committed or pushed. All changes are local working-tree edits pending user review.
