# Procurement Module — Phase 2B Changelog

Workflow completion only — reuses all existing backend business logic, the existing notification dispatcher, and the existing PostgreSQL schema. No new tables, no schema changes, no new approval rules, no new notification system. Full rationale and detail in `PROCUREMENT_PHASE2B_COMPLETION_REPORT.md`.

## Added
- **Procurement Settings screen** — desktop (`renderProcurementSettings()`, new nav entry under "Procurement") and mobile (`ProcurementSettingsScreen.tsx`, reachable via a gear icon on the Procurement dashboard). Both read/write the CEO approval threshold through the pre-existing `procurementConfigGet`/`procurementConfigUpdate` functions; both gated to `admin`/`ceo` via a new `procurement-settings` page permission (`db/migrate.js`).
- **`rfq_created` notification** — RFQ creation previously had no notification call site at all; added to `notifyProcurementEvent`'s `EVENTS` map plus the call site in `procurementRfqCreate`.
- **`invoice_approved`, `invoice_rejected`, `payment_rejected` notification entries** — `procurementApprovalAction` already generated these exact event keys for invoice/payment approvals; they silently no-op'd with no matching `EVENTS` map entry until now.
- **`stockItemsForDropdown(userId)` / `workshopsForDropdown(userId)`** (`db/services/data.js`) — new unrestricted reference-data lookups, following the existing `xxxForDropdown` convention. Backing both a new desktop IPC pair (`stock-items:for-dropdown`, `warehouses:for-dropdown`) and the existing mobile `/api/meta/stock-items` / `/api/meta/warehouses` routes (see Changed).
- **Stock-item picker on requisition line items** — desktop (`procItemRowHtml()` extended) and mobile (`RequisitionFormScreen.tsx`, via the shared `FormSelect` component). Sets the pre-existing `procurement_requisition_items.stock_item_id` column, which already flows through PO generation to the existing automatic-inventory-update path on goods receipt.
- **Workshop picker on requisition creation** — desktop and mobile, shown only to users with no fixed `workshop_id` on their own account. Sets the pre-existing `procurement_requisitions.workshop_id` column.
- Mobile hooks: `useProcurementConfig`, `useProcurementConfigActions`, `useWorkshops` (`useProcurementDashboard.ts` / `useProcurementRequisitions.ts`). Reused the existing `useStockItems` hook rather than duplicating it.

## Changed
- `procurementApprovalAction` (`db/services/data.js`) — the multi-stage approval branch now writes `status='in_approval'` to the requisition row (was already returning this value in its response, just never persisting it). Guarded to `entityType === 'requisition'` only.
- `procurementConfigGet` — now joins `app_users` to return `updated_by_name`, for the new Settings screen's "Last updated by" display. No change to its (intentionally unchanged, pre-existing) access level.
- `mobile-api/routes/meta.js` — `/stock-items` and `/warehouses` routes now call the new centralized `data.js` functions instead of inlining raw `pool` queries. Byte-identical behavior for existing callers (Material Requests); fixes pre-existing architecture drift where this business logic lived only in a route file.

## Fixed
- **`in_approval` status never persisted** — requisitions with more than one pending approval stage stayed on `status='submitted'` for their entire multi-stage lifetime; the dashboard "Pending Approvals" tile and any status-filtered view undercounted genuinely in-flight requisitions. Now correctly transitions.
- **Automatic inventory update on goods receipt was unreachable** — the update path already existed and already checked for `stock_item_id` + `workshop_id`, but no UI on either platform ever collected either value, so it silently never fired for any requisition created through the app. Now reachable via the new pickers.

## Explicitly not changed (out of scope for this phase)
- Supplier scoring, vendor portal, contracts, budget forecasting, AI recommendations — all confirmed out of scope per the Phase 2B brief; none touched.
- `procurementConfigGet`'s read-level access (any authenticated user can still read the threshold value) — flagged in Phase 1, left alone; only the Settings *screen* and the *write* path are access-gated.
- Pre-populating `stock_item_id` when editing an existing draft requisition — the creation flow was the stated Priority 4 target; the edit flow's line-item form was not touched.
- Any approval business rule (stage order, role assignments, CEO-threshold branching logic) — only the missing status *write* was added; the rules themselves are untouched.
