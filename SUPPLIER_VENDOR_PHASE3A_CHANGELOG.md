# Supplier & Vendor Management — Phase 3A Changelog

Mobile/desktop parity + UI modernization only, scoped to the 5 items in the Phase 3A brief. Reuses 100% of existing `db/services/data.js` functions — no new tables, APIs, IPC channels, or migrations. Full rationale and detail in `SUPPLIER_VENDOR_PHASE3A_COMPLETION_REPORT.md`.

## Added
- **Mobile supplier delete** — `SupplierDetailScreen.tsx`: confirm dialog + "Delete supplier" button, wired to the previously-unused `remove()` hook.
- **Mobile contact management** — Add/Edit/Delete UI on `SupplierDetailScreen.tsx` via a new `ContactFormModal`, wired to the previously-unused `addContact()` hook plus two new hook methods, `updateContact`/`removeContact`.
- **Mobile contract management** — Add/Edit UI (no delete, matches backend) via a new `ContractFormModal`, wired to the previously-unused `addContract()` hook plus a new hook method, `updateContract`. Uses the existing shared `DatePickerField` for Start/End dates.
- **Desktop contact edit/delete** — `openSupplierManageOverlay()`: edit-pencil and delete-trash actions per contact row (previously Add-only).
- **Desktop contract edit** — `openSupplierManageOverlay()`: edit-pencil action per contract row, exposing Status/Terms fields the Add-form never collected (previously Add-only, and Add never collected Status/Terms even though the backend accepts them).
- **Mobile Preferred toggle** — `SupplierFormScreen.tsx`: a `Switch` control for `preferred`, matching the existing toggle pattern from `WorkshopFormScreen.tsx`. Desktop already had this.
- **Blacklist reason on mobile** — `SupplierDetailScreen.tsx`: new `BlacklistReasonModal`, required and validated, matching desktop's existing mandatory-reason flow exactly.
- **Supplier list filters (both platforms)** — Preferred-only and Blacklisted-only quick-filter toggles (new on both platforms); Status filter and Sort added to mobile (desktop already had both).
- Three new hook methods in `mobile/src/hooks/useProcurementSuppliers.ts`: `updateContact`, `removeContact`, `updateContract`.

## Changed
- `procFilterBarHtml()` (`renderer/app.js`) — extended with an optional `extraHtml` parameter (default `''`), used only by the Suppliers page's new filter chips. All 6 other existing callers are unaffected — confirmed unchanged behavior via inspection.
- Mobile blacklist flow (`SupplierDetailScreen.tsx`) — unblacklisting still one-tap-confirm; blacklisting now requires and sends a reason (was previously sent as `undefined` in both directions).

## Fixed
- **`.row-actions` CSS selector only matched `.tbl` tables, not `.dt` tables** (`renderer/styles.css`) — a pre-existing bug that silently affected several other procurement overlay tables (Requisitions, RFQ, Purchase Orders, Goods Receipt, Invoices), not just Suppliers. Broadened the selector; zero risk to existing `.tbl` styling.
- Mobile blacklist action previously never sent a reason even when blacklisting, despite the backend accepting and storing one and desktop always sending it — a real behavioral gap, now closed.

## Explicitly not changed (out of scope for this phase)
- No backend function was added, modified, or duplicated. `procurementSupplierDelete`, `...ContactCreate/Update/Delete`, `...ContractCreate/Update`, `...ToggleBlacklist`, `...Create/Update` are all reused exactly as they were.
- No new database table, column, migration, API route, or IPC channel.
- Contract deletion — remains unsupported on both platforms; no backend function exists for it and none was added.
- Document/attachment upload, supplier scoring, blacklist enforcement across the wider procurement workflow (quotations/POs), a "Deactivate supplier" control, and the `procurement-officer`/blacklist permission inconsistency — all correctly deferred to later phases per the Phase 3A brief's explicit out-of-scope list.
- Desktop's shared "Access denied" error panel and shared empty-state-for-both-cases pattern — both systemic, pre-existing characteristics of every procurement list page, not just Suppliers; left untouched to avoid an inconsistent one-off fix.
