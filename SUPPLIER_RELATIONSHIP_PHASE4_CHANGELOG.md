# Changelog — Supplier Relationship Management (SRM), Phase 4

## Added

### Data model
- `supplier_documents`, `supplier_compliance`, `supplier_communications`, `supplier_improvement_plans` tables.
- `procurement_supplier_contracts` columns: `category`, `contract_value`, `owner_user_id`, `renewal_notice_days`, `notes`, `renewed_from_id`, `last_reminder_at`; new `idx_proc_contracts_status` index.

### Backend
- Contract governance: `procurementSupplierContractApprove`, `procurementSupplierContractRenew`, `procurementContractsRegister` (fleet-wide).
- Compliance: `supplierComplianceList`, `supplierComplianceUpsert`, `supplierComplianceRegister`.
- Documents (metadata only — files on `mobile-api`'s disk): `supplierDocumentRegister`, `supplierDocumentsList`, `supplierDocumentGet`, `supplierDocumentDeactivate`, `supplierDocumentsRegister`.
- Communications: `supplierCommunicationsList`, `supplierCommunicationCreate`, `supplierCommunicationUpdate`, `supplierCommunicationsRegister`.
- Improvement plans: `supplierImprovementPlansList`, `supplierImprovementPlanCreate`, `supplierImprovementPlanUpdate`, `supplierImprovementPlansRegister`.
- `srmExecutiveDashboard` (8 KPIs + contract timeline + compliance trend + communication activity + improvement progress + documents-near-expiry).
- `srmReport` — single dispatcher for 7 report types: `contract_register`, `expiring_contracts`, `compliance_status`, `document_register`, `communication_log`, `improvement_plans`, `executive_summary`.
- `_schedSrmReminders` scheduler task — contract/compliance expiry reminders at 90/60/30/7 days, registered in the existing `_schedulerTick()`.

### API
- `mobile-api/routes/srm.js` — contracts/compliance/communications/improvement-plans/dashboard/reports endpoints under `/api/srm`.
- `mobile-api/routes/supplierDocuments.js` — multer-based upload/list/download/delete under `/api/srm/documents`.

### Electron
- `srm-contracts:*`, `srm-compliance:*`, `srm-communications:*`, `srm-improvement-plans:*`, `srm-dashboard:get`, `srm-reports:get`, `srm-documents:*` IPC channels + `window.UFCL.srm*` preload exposures.
- Document upload/download now proxies to `mobile-api` over HTTP (new for Electron — every other feature talks to Postgres directly).

### Desktop UI
- Supplier profile overlay restructured into 7 tabs: Overview, Contracts, Compliance, Documents, Communications, Improvements, Intelligence.
- New "Supplier Relationship Management" KPI section on the Procurement Dashboard.
- New Contract Register and Compliance Center overlays (cross-supplier, reached from the Procurement Dashboard).
- New "SRM" tab in Procurement Reports (7 report types, CSV export via `execExport()`).
- `.ow-wide`, `.smo-tabs`, `.smo-tab` CSS classes.

### Mobile
- `SupplierDetailScreen` restructured into the same 7 tabs as desktop.
- New screens: `SrmDashboardScreen`, `ContractRegisterScreen`, `ComplianceCenterScreen`.
- New "SRM" tab in `ProcurementReportsScreen` (CSV export via `Share.share()`).
- New `useSrm.ts` hook file covering every SRM query/mutation.
- New `upload()`/`downloadFile()` helpers in `api/client.ts`.

## Changed
- `procurementSupplierContractCreate` — now always creates in `draft` status regardless of payload; accepts the new additive fields.
- `procurementSupplierContractUpdate` — accepts the new additive fields; blocks direct transition to `active` status (must go through `procurementSupplierContractApprove`).
- `openOverlay()` (desktop) — new optional 5th `extraClass` parameter, backward compatible.

## Fixed
- Desktop SRM screens rendered `DATE` columns as a verbose `Date.toString()` and silently broke date-picker pre-fill in edit forms, because `pg` returns `DATE` columns as JS `Date` objects. Added `_fmtDate()` and applied it at every date-interpolation site in the SRM code (`openSupplierManageOverlay`, `openContractRegisterOverlay`, `openComplianceCenterOverlay`, the SRM report table/CSV export). Found via live interactive testing.

## Dependencies
- Root (`package.json`): `jsonwebtoken@^9.0.3` — added.
- `mobile-api/package.json`: `multer@^2.2.0` — added.
- `mobile/package.json`: `expo-document-picker@~12.0.2` — added.

## Verification
- Migration run against the live database: clean, all 4 tables + 7 columns confirmed present.
- Backend functional smoke test (35 checks, via throwaway QA accounts): all passed, including the Procurement Officer vs. Procurement Manager governance permission split (contract approval, compliance waiver).
- Live scheduler tick, including `_schedSrmReminders`: completed with 0 errors.
- Interactive Electron UI walkthrough (isolated instance, CDP-driven): all 7 supplier-profile tabs, the Contract Register/Compliance Center overlays, the SRM Dashboard section, and all 7 SRM reports verified live with real data.

## Known issues
- Document upload/download not exercised end-to-end through the running Electron UI — root-caused to a local dev-environment topology mismatch (this machine's `mobile-api` test instance vs. the shared LAN host `PGHOST` resolves to), not a code defect. See Completion Report §6 for the three independent proofs used instead and the exact re-test needed once this phase's `mobile-api` code is deployed to that host.
- Mobile (React Native) UI not walked through interactively this pass — verified by type-check and code review only.
