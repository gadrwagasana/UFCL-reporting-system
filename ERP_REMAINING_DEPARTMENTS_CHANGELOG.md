# ERP Remaining Departments Completion Program — Changelog

## Backend (`db/services/data.js`)

- `trashList()` — added `record_id: r.id` and `label: t.label` to each returned row. Both desktop (`renderer/app.js`) and mobile (`TrashScreen.tsx`) always expected these exact field names but the backend only ever returned `id`/`entity_label`, so every Trash Restore/Purge click sent an `undefined` record id and every row's Type badge rendered "undefined". Kept the original `id`/`entity_label` fields too — purely additive, no other caller relied on their absence.
- `stockItemsDelete(userId, itemId, reason)` — unchanged in signature (already accepted `reason`); the bug was entirely in the desktop wiring layers below.
- `deliveryOrdersDelete(userId, orderId, reason)` — same; unchanged, bug was in desktop wiring.

## Database (`db/migrate.js`)

- **New**: `restoreRolePagesDrift()` — idempotent, user-approved restoration of live `role_definitions` permissions that had drifted below what `ROLE_PAGES` (data.js) has long documented as these roles' intended baseline: `supervisor`/`harvesting-leader` → `stock-movements`, `sales` → `customers`. Called at the end of `migrate()`. Re-run live; verified via a direct `role_definitions` query.

## Desktop (`electron/`, `renderer/app.js`)

- `electron/preload.js` — `stockItemsDelete` and `deliveriesDelete` bridge functions now accept and forward a `reason` parameter (previously silently dropped).
- `electron/main.js` — the `stock-items:delete` and `deliveries:delete` IPC handlers now destructure and forward `reason` to the corresponding `data.js` function.
- `renderer/app.js`:
  - `deleteStockItem()` — now uses `confirmDeleteSoft` (reason-collecting modal) instead of `confirmDelete`, and forwards the collected reason.
  - `deleteDeliveryOrder()` — same fix, same pattern.

## Mobile (`mobile/`)

- `src/screens/admin/UserDetailScreen.tsx` — `ALL_ROLES` now includes `procurement-officer`, `procurement-manager`, `department-manager` (previously selectable on desktop only).
- `src/navigation/OperationsNavigator.tsx` — the `operations` role's "Pending" tab (`PendingReviews`) now renders the existing `GovernanceScreen` instead of a literal `ComingSoonScreen` placeholder — the last live, reachable placeholder screen found in a full mobile-tree sweep. `operations` already sees Governance via the `AppHeader` icon on every other screen; this reuses that exact screen (confirmed safe to mount as a tab — it already defensively handles both root-of-stack and pushed-onto-a-stack navigation contexts), not new content.

## Data corrections (live production database, both user-approved)

- **Permission drift**: `role_definitions.permissions` updated for 3 role/page pairs (see migration entry above). Verified live: `supervisor`/`harvesting-leader` now have `stock-movements`; `sales` now has `customers`.
- **QA residue cleanup**:
  - 17 of 74 stray test `app_users` accounts (matching `_stabtest_%`/`_qa%`, all already inactive) hard-deleted after confirming zero foreign-key references anywhere in the schema (checked across all 138 FK columns referencing `app_users`). The remaining 57 could not be deleted — Postgres's own referential integrity correctly blocks deletion of a user referenced by the immutable `audit_log` (and, for many, by real business tables: procurement suppliers/POs/requisitions, stock transfers, machines, maintenance records) — these 57 remain exactly as they were: inactive, harmless, permanently retained by design.
  - 5 explicitly QA-tagged `stock_movements` rows deleted (ids 116, 117, 242, 247, 248 — confirmed via their `notes`/`reference` fields, e.g. `_QA-FG-MOVEMENT`, `QA-SIP1 same-workshop positive test`). 7 ambiguous blank-reference rows left untouched (predate this program's audit-trail tagging conventions; cannot be confidently distinguished from legitimate entries).

## Verification artefacts

A temporary QA script (`_qa_erp3_trash.js`) was used to live-verify the Trash and delete-reason fixes against the production database and deleted after use; see the Completion Report §16 for results (9/9 checks passed).

---

# Resumption session — 3 interrupted audit clusters completed

## Backend (`db/services/data.js`)

- `procurementGoodsReceiptCreate(userId, poId, payload)` — added the missing `isWorkshopRestricted` check against `po.workshop_id`, matching every sibling function in the same section (`procurementGoodsReceiptList`/`Detail`/`PendingPoleQC`/`Inspect`, all of which already had it). Previously a workshop-restricted storekeeper could receive against, and credit stock into, a PO belonging to a different workshop. Live-verified: a Gatare storekeeper attempting to receive against a Headquarters PO is now denied, with confirmed zero side effects (the check runs before any database write).

## Desktop (`renderer/app.js`)

- `renderDailyPoles()` — added a second gate, `canManageProduction` (`['admin','ceo','operations','supervisor','poles-leader','poles-supervisor']`), used for the "Record Delivery", "New Production Batch", and "Add poles entry" buttons — all 3 backend functions behind them (`polesDeliveryCreate`, `poleProductionBatchCreate`/`POLE_PRODUCTION_ROLES`, `dailyCreate` via the `daily-poles` page permission) already authorized `poles-supervisor`, but the buttons were hidden from this role. The original `canManage` (correctly excluding `poles-supervisor`, matching `polesDeliveryQualityCheck`'s own narrower role list) is unchanged and still gates the Quality Check button only.
- Same function — `$('newPoleBatch').onclick` is now null-guarded (`const newPoleBatchBtn = $(...); if (newPoleBatchBtn) ...`), matching the pattern its two sibling buttons already used; previously unconditional, a latent crash risk for any role able to view the page without being in the button's render gate.
- `NOTIFICATION_ROUTES` — added `'governance'` (page-only, routes to the existing `secgov` page — this was a real, high-frequency gap: `autoRequestEdit`/`autoRequestDelete`'s routine approval-queued notification had no desktop route at all, unlike mobile which already special-cases it). Also added `'sales'`/`'deliveries'` (page-only), completing a scope a prior phase's own code comment had already described as intended but never actually implemented.

## Mobile (`mobile/`)

- `src/screens/shared/DashboardScreen.tsx` — fixed `navigation.navigate('ChangeRequestList')` → `navigation.navigate('Changes')` (the former matched no registered route anywhere in the app).
- `src/utils/actionRoutes.ts` — fixed 3 more broken route names in the same dispatch table, found via direct cross-reference against `navigation/types.ts` (not previously reported): `'SalesOrderList'` → `'SalesOrdersList'`, `'MaterialRequestList'` → `'MaterialRequestsList'`, `'StockTransferList'` → `'StockTransfersList'`, plus the same `ChangeRequestList` → `Changes` fix. All 4 were dashboard "pending action" tiles that silently failed to navigate.
- `src/hooks/useMachines.ts` — added `useMaintScheduleUpdate`/`useMaintScheduleDelete` hooks (correctly implemented, matching the existing REST layer exactly) as a head start for a future fix — **not yet wired into any screen**, since the one mobile screen that lists maintenance schedules is reachable only by a role (`mechanician`) the backend never authorizes to edit/delete them; the real gap (no mobile path for `admin`/`ceo`/`logistics`, who do have edit/delete rights) needs its own navigator-placement decision first. See the Gap Register.

## Verification

Live: Workshop Isolation fix (`procurementGoodsReceiptCreate`) confirmed denying cross-workshop access with zero database side effects. Static: `node --check` clean across the full backend/desktop/routes; `npx tsc --noEmit` clean across `mobile/`. No QA data was created this session (no cleanup required).
