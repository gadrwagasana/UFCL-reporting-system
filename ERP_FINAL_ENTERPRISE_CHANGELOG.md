# ERP Final Enterprise Cross-Department Completion Gate — Changelog

7 confirmed defects fixed (see `ERP_FINAL_ENTERPRISE_GAP_REGISTER.md` for full evidence/
disposition per item — G-01 through G-07). All fixes reuse existing architecture/permissions/
governance/notification mechanisms; nothing new was invented.

## Backend (`db/services/data.js`)

- **`maintenanceJobAssign`** (G-01) — added the same `isWorkshopRestricted` guard every sibling
  maintenance-job function already has, immediately after `_maintJobLoad`.
- **`timberInventoryList`** (G-02) — substantial, careful rewrite for correctness: added
  `restricted`/`wId` computation; swapped `mv_stock_summary` for the already-existing
  `mv_stock_by_workshop` when restricted; added `workshop_id`/`warehouse_id` filters to the
  `logs7`, `harvestRows`, `rawLogRows`, `wasteRate`, `costingRow`, `processingRow`, and
  `profitRows` queries; the two multi-location comparison tables (`flowRows`,
  `valueByLocationRows`) keep querying company-wide but are filtered/zeroed in JS post-query so
  their pivot shape survives.
- **`_schedSecurityScan`/`_schedWorkflowScan`** (G-03) — 3 `pushNotification` calls changed
  `relatedModule` from `'Security'`/`'Governance'`/`'System'` to the existing `'governance'`
  key.
- **`expandPages()`** (G-04) — added a `'maintenance-oversight'` → `['maintenance-officer-dashboard',
  'maintenance-reports']` expansion, mirroring the existing `'daily'` token-expansion pattern
  exactly.
- **`ROLE_PAGES`** (G-05, G-06) — added `maintenance-jobs`/`maintenance-oversight`/
  `sawmill-dashboard`/`inventory-loss-reports`/`transport-jobs` to the specific roles the live
  DB (`db/migrate.js`) actually grants each to — no over-granting, verified role-by-role.

## Mobile (`mobile/`)

- **`mobile/src/hooks/useVat.ts`** (G-07) — new `useVatUpdate` hook + `UpdateVapBatchPayload`
  type, mirroring `useVatDelete`'s existing pendingApproval-handling pattern.
- **`mobile/src/screens/vat/VatDetailScreen.tsx`** (G-07) — new "Edit Details" button + a
  metadata-only edit modal (order reference / operator / supervisor / notes), reusing the
  screen's existing style conventions; input/output lines remain uneditable, matching the
  backend's own boundary.

## Static Verification

`node --check` clean on every touched backend file (`db/services/data.js`, `electron/main.js`,
`electron/preload.js`, `renderer/app.js`, `mobile-api/server.js`). `npx tsc --noEmit` clean
across the entire `mobile/` project after the VAT screen change (0 errors).

## Live E2E Verification (real accounts, snapshot-then-restore, all cleaned up)

- **G-01**: a real mechanician account (workshop 3) temporarily scoped to workshop 4 attempted
  to assign real maintenance job #6 (workshop 3) — correctly denied, job state (assigned_to,
  status) unchanged before/after the attempt. Account restored to workshop 3, confirmed.
- **G-02**: company-wide call (real admin account) still returns figures for all 3 warehouses,
  unchanged. A real restricted `sawmill-leader` account (workshop 3, unmodified — already
  workshop-scoped in production) now correctly receives exactly 1 warehouse row (its own)
  instead of 3, and the finished-timber-flow table's other-location columns correctly read 0.
- **G-04**: `getBootstrap()` for a real admin account now resolves both
  `maintenance-officer-dashboard` and `maintenance-reports` into its page list, confirmed
  directly against the live function output.
- **G-03**: confirmed the `'governance'` key exists and resolves correctly in both
  `renderer/app.js`'s `NOTIFICATION_ROUTES` and `mobile/src/utils/notificationRouting.ts`.
- No test data was created for G-01/G-02 (both tests used real, pre-existing accounts/records
  with values snapshotted before and restored after); G-05/G-06 were verified by direct
  role-by-role comparison against the audit's own DB-grant findings rather than a live mutation
  test (no mutation risk exists in a static fallback-table addition).
