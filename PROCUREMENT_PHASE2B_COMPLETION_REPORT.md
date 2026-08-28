# Procurement Module — Phase 2B Completion Report

**Scope discipline maintained throughout:** no new procurement tables, no schema changes to any existing procurement table, no new approval-chain business rules, no new notification system, no new inventory-adjustment logic. Every change below either (a) writes a status value the backend was already computing and returning but never persisting, (b) adds missing entries to the existing `notifyProcurementEvent` EVENTS map using the existing dispatcher, (c) exposes existing, previously-unused `stock_item_id`/`workshop_id` columns and existing backend acceptance of them through new UI controls, or (d) is a pure UI/permission-gating addition (the Settings screen) that reads/writes through the pre-existing `procurementConfigGet`/`procurementConfigUpdate` functions, unchanged. This report follows `PROCUREMENT_PHASE1_REVIEW.md` as the source of truth for what was broken/missing, and continues the file-touch discipline of `PROCUREMENT_PHASE2A_UI_REPORT.md`.

---

## Priority 1 — Procurement Settings Screen

**Backend**: `procurementConfigGet` (`db/services/data.js`) was enriched with a `left join app_users` to return `updated_by_name` for the "Last updated by" display — the only change to this function; it remains intentionally ungated (any authenticated user can read the config), matching Phase 1's finding and left as-is since tightening it was out of scope for this phase. `procurementConfigUpdate` is untouched — it already enforces `admin`/`ceo` only and was the correct enforcement point.

**Access control**: added a new `procurement-settings` page permission via `db/migrate.js` (`grantProcurementPermissions()`), granted to `admin` and `ceo` only — deliberately kept separate from the `PROCUREMENT_PAGES` block so procurement-officer/procurement-manager (who run the module day to day) cannot reach it. Migration has been run; verified live in the database that only `admin`/`ceo` carry this permission.

**Desktop**: new `renderProcurementSettings()` in `renderer/app.js`, new nav entry (`procurement-settings`, under the existing "Procurement" section) and `showPage()` case, new `#page-procurement-settings` container in `renderer/index.html`. Built entirely from Phase 2A's shared components — `.page-head`, `.section-hdr`, `.card`, `.frow`/`.fg`, `.lerr`, `.skel-row`, `showToast()`. Threshold input has inline validation, a read-only banner + disabled Save/Cancel for non-admin/ceo users (defense-in-depth; the nav entry itself is already gated), and displays "Last updated by X" from the enriched `procurementConfigGet` response.

**Mobile**: new `ProcurementSettingsScreen.tsx`, wired into `ProcurementStack.tsx` and `navigation/types.ts`. New hooks `useProcurementConfig`/`useProcurementConfigActions` in `useProcurementDashboard.ts`. Entry point: a settings gear icon added to `ProcurementDashboardScreen`'s `AppHeader`, shown only when `role === 'admin' || role === 'ceo'`. Same `canEdit` gating and read-only banner as desktop.

---

## Priority 2 — Approval Workflow Fix

**Root cause** (confirmed via Phase 1 §5.3/§7.3 and re-verified this phase): `procurementApprovalAction`'s multi-stage branch always *returned* `{ status: 'in_approval' }` in its response payload but never wrote that value to the entity row — the `status` column stayed `'submitted'` for the entire life of a multi-stage requisition chain, so the "Pending Approvals" dashboard tile and any status-filtered view never showed genuinely in-flight requisitions correctly.

**Fix**: `db/services/data.js`, inside the `if (nextRows.length)` branch of `procurementApprovalAction`, added `update ${table} set status='in_approval' where id=$1`, guarded to only run when `entityType === 'requisition'` (the only entity type with a multi-stage chain in practice — invoices/payments are single-stage, so this branch is effectively never reached for them today; the guard prevents a future multi-stage invoice/payment chain from writing an undefined status value for those tables). No change to stage-advancement logic, role checks, or the approval chain's shape — only the missing persistence write was added.

**Verification**: backend smoke test walked a requisition through multiple approval stages and confirmed `status` now reads `in_approval` in the database between stages (previously stuck on `submitted`), and that the dashboard's pending-approvals count now reflects genuinely mid-chain requisitions.

---

## Priority 3 — Notification Coverage

Audited every event `procurementApprovalAction` and related functions actually fire (`${entityType}_stage_approved`, `${entityType}_approved`, `${entityType}_rejected` for `requisition`/`invoice`/`payment`, plus `po_issued`, `goods_received`, `invoice_matched`) against the `EVENTS` map inside `notifyProcurementEvent`. Found four event keys the backend was already generating that had no matching map entry — they silently no-op'd:

| Event key | Fired by | Fix |
|---|---|---|
| `rfq_created` | *(missing entirely — RFQ creation had no notification call site at all)* | Added both the `EVENTS` entry and the call site in `procurementRfqCreate`, notifying the original requester |
| `invoice_approved` | `procurementApprovalAction` (entityType `'invoice'`) | Added `EVENTS` entry, roles `procurement-officer`/`procurement-manager` |
| `invoice_rejected` | `procurementApprovalAction` (entityType `'invoice'`) | Added `EVENTS` entry, same roles, includes rejection notes |
| `payment_rejected` | `procurementApprovalAction` (entityType `'payment'`) | Added `EVENTS` entry, mirroring the existing `payment_approved` broadcast shape |

No new notification infrastructure was built — all four additions use the existing `notifyProcurementEvent(eventKey, entity, extra)` dispatcher and the existing `pushNotification` plumbing underneath it, following the same shape (`type`/`category`/`title`/`body`/`roles`/`forUserId`) as every other entry already in the map.

**Full coverage confirmed** — every event in the requirement list now has a working notification: Invoice Approved ✓, Invoice Rejected ✓, Payment Approved ✓ (pre-existing), Payment Rejected ✓, RFQ Created ✓, Purchase Order Issued ✓ (pre-existing), Goods Receipt ✓ (pre-existing), Requisition stage approvals ✓ (pre-existing).

**Verification note**: `notifyProcurementEvent` is fire-and-forget (never `await`ed by any caller, matching the codebase's existing `logAudit` convention) — a smoke test that checked notification counts immediately after the triggering call initially reported false failures due to this async timing; re-checking after a short delay confirmed all four new notifications fire correctly. No notification-dispatch code was changed as a result.

---

## Priority 4 — Inventory Linkage UI

**Root cause**: the backend has always supported linking a requisition line item to a stock-catalog item (`procurement_requisition_items.stock_item_id`) and a requisition to a workshop (`procurement_requisitions.workshop_id`) — both columns already flow untouched through PO generation (`procurementPoGenerate` copies `stock_item_id` into `procurement_po_items`) into goods receipt, where `procurementGoodsReceiptCreate` triggers the automatic inventory update **only when both `poItem.stock_item_id` and `po.workshop_id` are present**. Neither field was ever collected by either platform's requisition-creation UI, so the automatic inventory update path was effectively dead code for every requisition ever created through the app.

**Backend (minimal, additive only)**: two new lookup functions in `data.js`, following the codebase's existing `xxxForDropdown` convention (unrestricted, auth-only, no page-permission gate — matching `compartmentsForDropdown`/`machinesForDropdown`):
- `stockItemsForDropdown(userId)` — `select id, name, category, uom from stock_catalog where active=true`
- `workshopsForDropdown(userId)` — `select id, name, location, workshop_type from warehouses where active=true`

These centralize queries that were already being run, inlined, inside `mobile-api/routes/meta.js`'s `/stock-items` and `/warehouses` routes (used by Material Requests) — that file was refactored to call the new `data.js` functions instead of querying `pool` directly, which is a net-zero behavior change for mobile and fixes the pre-existing architecture drift where mobile's business logic lived in a route file instead of `data.js`. Matching Electron IPC handlers (`warehouses:for-dropdown`, `stock-items:for-dropdown`) and `window.UFCL` exposures were added so desktop has the identical, single source of truth.

**Desktop UI** (`renderer/app.js`):
- `procItemRowHtml()` extended with an optional 4th `stockItems` parameter that renders a "Link to stock item" select per line item when the dropdown data is available.
- The "New Purchase Requisition" overlay now fetches both dropdowns via `UFCL.stockItemsForDropdown`/`UFCL.workshopsForDropdown` before opening, conditionally shows a Workshop select (see gating note below), and includes `workshop_id`/`stock_item_id` in the `procurementRequisitionCreate` payload.

**Mobile UI** (`RequisitionFormScreen.tsx`):
- Reused the existing `useStockItems` hook (`useMaterialRequests.ts`, already hitting the now-centralized `stockItemsForDropdown`) rather than duplicating it.
- Added a new `useWorkshops` hook (`useProcurementRequisitions.ts`) for the workshop lookup.
- Reused the existing shared `FormSelect` component (already used elsewhere for warehouse selection, e.g. `StockMovementFormScreen`) for both the per-line stock-item picker and the workshop picker — no new picker component was built.

**Workshop-picker gating (both platforms)**: shown only when the current user has no fixed `workshop_id` on their own account. A user already assigned to a workshop is workshop-restricted server-side — `procurementRequisitionCreate` always forces `workshop_id = user.workshop_id` for such users and ignores anything submitted — so showing the picker to them would be misleading. This uses `STORAGE.user.workshop_id` (desktop) / `useAuth().workshopId` (mobile) as the gating signal rather than exactly replicating the backend's `isWorkshopRestricted` role-exemption list client-side. **Known imprecision**: an admin/ceo/operations/logistics user who happens to have a `workshop_id` set on their own account will not see the picker, even though the backend would actually honor a submitted value for them (those roles are exempt from the restriction). Low-risk, narrow edge case — noted here rather than engineered around, since replicating the full exemption list client-side would be the kind of duplicated business logic this phase's rules explicitly prohibit.

**Stock-item picker**: optional on every line item on both platforms; a line with no link behaves exactly as before (free-text only, no automatic inventory update on receipt — unchanged, pre-existing behavior for anything not linked).

---

## Mobile / Electron Parity

| Capability | Desktop | Mobile |
|---|---|---|
| View Procurement Settings | ✓ (nav entry, admin/ceo gated) | ✓ (dashboard gear icon, admin/ceo gated) |
| Edit CEO approval threshold | ✓ | ✓ |
| Requisition reaches `in_approval` status | ✓ (shared backend fix) | ✓ (shared backend fix) |
| RFQ / invoice / payment notifications | ✓ (shared backend fix) | ✓ (shared backend fix) |
| Link requisition line to stock item | ✓ (new picker) | ✓ (new picker) |
| Select workshop on requisition | ✓ (new picker, same gating) | ✓ (new picker, same gating) |

All Priority 2 and 3 fixes live in `db/services/data.js` and are consumed identically by both the Electron IPC layer and the mobile REST API — no platform-specific logic was written for either fix.

---

## Permissions

No existing access was broadened. `admin`/`ceo` are the only roles that can reach or modify Procurement Settings (both platforms). The two new dropdown lookups (`stockItemsForDropdown`/`workshopsForDropdown`) are intentionally unrestricted, matching the established pattern for lightweight reference-data lookups used by create forms elsewhere in the app (e.g. `compartmentsForDropdown`) — they do not expose the `stock-items`/`warehouses` management pages themselves, only enough data (id/name/category/uom for items; id/name/location/type for workshops) to populate a picker. Finance/Approver role boundaries for processing and approval actions are untouched.

---

## Remaining Known Issues

1. **Workshop-picker gating imprecision** (see Priority 4 above) — admin/ceo/operations/logistics users with a personal `workshop_id` set won't see the workshop picker, though the backend would honor their choice.
2. **`procurementConfigGet` remains ungated for reads** — any authenticated user can read the CEO threshold value (not just admin/ceo). This was flagged in Phase 1 as a pre-existing gap and intentionally left alone in this phase, since Priority 1's brief was to build the missing UI for an already-admin/ceo-gated *write* operation, not to newly restrict an unrelated read. Access to the Settings *screen* itself is fully gated on both platforms.
3. **Editing an existing requisition** (`RequisitionFormScreen` mobile / desktop equivalent) does not pre-populate `stock_item_id` on its line items from a previously-saved requisition — this was a pre-existing gap in the edit flow (draft-only, not touched in prior phases either) and out of scope for this phase, which targeted the *creation* flow per the stated Priority 4 requirements.

---

## Verification Performed

- `node --check` on every changed backend/desktop file: `db/services/data.js`, `db/migrate.js`, `mobile-api/routes/meta.js`, `electron/main.js`, `electron/preload.js`, `renderer/app.js` — all pass.
- `cd mobile && npx tsc --noEmit` — zero errors.
- `db/migrate.js` executed against the live database; confirmed `procurement-settings` permission present for `admin`/`ceo` only, absent for `procurement-officer`/`procurement-manager`.
- Backend smoke test (throwaway `_qa_*` account, since deactivated) confirmed: `in_approval` status now persists mid-chain; `rfq_created`/`invoice_approved`/`invoice_rejected`/`payment_rejected` notifications all fire (with a short delay accounted for, given the fire-and-forget dispatch pattern); `stockItemsForDropdown`/`workshopsForDropdown` return expected rows; a requisition created with a linked `stock_item_id` and `workshop_id` correctly flows through to a PO and triggers the existing automatic inventory-update path on goods receipt.
