# ERP Enterprise Completion Phase 3 — Changelog

## Summary

Fixed 9 live-reachable Workshop Isolation defects (Rejection/Resolution engine ×4, Stock Transfer approval chain ×4, Poles Procurement QC ×1) and 3 confirmed UI Functional Gaps (desktop Harvest Plan governance panel, mobile Notifications reachability, mobile Casual Labour Request review). No schema change, no new permission system, no Workshop Isolation redesign, no new business workflow, no design system change. Nothing committed or pushed.

## Files changed (10 total)

### `db/services/data.js` — 9 Workshop Isolation fixes
- **`rejectionHoldsList`** — added the missing `isWorkshopRestricted` read-side filter (was the only function in its cluster without one; siblings `harvestWasteList`/`productionOffcutsList` already had it).
- **`rejectionResolveRework`**, **`rejectionResolveDowngrade`**, **`rejectionResolveReturnToInventory`** — added a post-load workshop check before each write action, identical idiom to `maintenanceJobTransition`'s existing equivalent check.
- **`stockTransfersApproveReject`**, **`stockTransfersDispatch`**, **`stockTransfersReceive`**, **`stockTransfersReportDiscrepancy`** — added a post-load workshop check (`from_warehouse_id`/`to_warehouse_id`) matching the exact filter their own read-side sibling `stockTransfersList` already used.
- **`polesDeliveryQualityCheck`** — added the same `isWorkshopRestricted` check Phase 2 (WI-3a/3b) added to the rest of the Poles Procurement cluster; this one function wasn't in that audit's citation list.

### `renderer/app.js` — 1 UI fix
- **`renderDailyHarvest`** (Harvest Plans section) — added `insertPendingPanel(['harvest_plan'])`/`insertDeletionPanel(['harvest_plan'])` calls, the exact shared-component pattern already used by 14 other modules. The backend has always routed non-owner/out-of-window Harvest Plan edits/deletes through this governance engine; no screen ever rendered the review queue for it.

### Mobile — 3 UI fixes across 8 files

**Notifications reachability** (was CEO/admin-only):
- `mobile/src/navigation/types.ts` — added `Notifications: undefined` to `RootStackParamList`.
- `mobile/src/navigation/RootNavigator.tsx` — registered `NotificationsScreen` at root level, identical pattern to the existing `GlobalSearchScreen` registration.
- `mobile/src/screens/notifications/NotificationsScreen.tsx` — added `onBack`/`hideNotifications` so the screen works correctly both as a root-level push (new) and its existing CeoNavigator tab usage (unchanged).
- `mobile/src/components/AppHeader.tsx` — added a Notifications bell with live unread badge as a default action on every screen (opt-out via `hideNotifications`, mirroring the existing unconditional Search-icon pattern exactly).
- `mobile/src/hooks/useNotifications.ts` — added an `enabled` option so `AppHeader`'s app-wide badge query and `NotificationsScreen`'s own filtered query don't both fire redundantly on the one screen that hides the bell.

**Casual Labour Request review** (backend + mobile-api route already existed; only the mobile action was missing):
- `mobile/src/hooks/useCasualLabour.ts` — added `useCasualLabourReview()`, mirroring `useCasualLabourCreate()`'s shape.
- `mobile/src/screens/labour/CasualLabourDetailScreen.tsx` — added Approve/Reject buttons, gated to `['ceo','operations']` — deliberately matching `casualLabourRequestsReview`'s actual backend gate (`data.js:9287`) exactly, not the mobile-api route's wider `requireRoles('ceo','operations','admin')` gate one layer up (the route being wider than the function it calls doesn't grant `admin` anything real — see completion report §10 for how this was caught during live-verification prep, before shipping).
- `mobile/src/navigation/OperationsNavigator.tsx` — replaced the `LabourReview` tab's `ComingSoonScreen` placeholder with the real `CasualLabourStack` (already used by 4 other navigators) — required for the new review buttons to be reachable at all.
- `mobile/src/navigation/CeoNavigator.tsx` — added a new `CasualLabour` tab (CeoNavigator had no path to this screen at all, not even a stub) — same reason.
- `mobile/src/navigation/types.ts` — added `CasualLabour: undefined` to `CeoTabParamList`.

## Verification performed

- `node --check db/services/data.js` — clean, re-run after every individual edit and once more at the end.
- `node --check renderer/app.js` — clean.
- `node --check electron/main.js`, `electron/preload.js` — clean (baseline confirmation; untouched this phase).
- `cd mobile && npx tsc --noEmit` — clean, run after every mobile change and once more at the end.
- 18 live production-database tests (16 direct pass, 2 that surfaced a test-design error corrected and re-run to 3/3 pass — see completion report §16 for the full breakdown and explanation).
- 8/8 read-only regression checks across adjacent, untouched-by-this-fix workflows.
- Phase 2 baseline regression: all 8 Phase 2 code-comment markers confirmed intact; every Phase 2-touched function re-exercised with no behavior change.

## Live QA data — full lifecycle

| Action | Detail |
|---|---|
| Created | 1 `production_offcuts` + 1 `quality_inspections` + 1 `rejection_holds` fixture (×2 runs, Gatare workshop 3); 1 `stock_transfers` fixture (HQ→Gatare); 1 `poles_deliveries` fixture (Gatare); 1 `casual_labour_requests` fixture; 1 throwaway `app_users` row (`supervisor` role, Nyanza workshop 4 — no real supervisor account exists outside Gatare, needed to test the Downgrade/Return-to-Inventory role tier at a foreign workshop) |
| Purpose | Convert all 9 Workshop Isolation findings and the Casual Labour Request capability into live-confirmed fixes against production data, using real existing accounts wherever one existed for the required role |
| Cleaned up | All transactional rows hard-deleted in FK-safe order (`rejection_holds` → `quality_inspections` → `production_offcuts`, respecting the dual FK) |
| QA account | Could not be hard-deleted — generated an `audit_log` row during testing (from the functions' own `logAudit` calls), and `audit_log` is protected by the immutable `audit_log_no_delete`/`audit_log_no_update` Postgres RULEs (same constraint documented in Phase 2 and this session's "Stray QA test accounts" memory). Soft-deleted via the codebase's own established `usersDelete()` function — `active=false`, `deleted_at` set. |
| Independently re-verified | Fresh COUNT queries after cleanup: 0 leftover rows for every transactional entity type across both test runs; QA account confirmed `active=false`/`deleted_at` set |
| Real business data touched | None |

## Explicitly not done (per this phase's Stop Rule and Bug Discipline)

- `resolutionCreate`/`resolutionsList`'s missing Workshop Isolation was found, documented, and deferred — not fixed (see completion report §14 for full reasoning: more architecturally involved than the 9 fixes above, and not required to complete this phase's reachability/parity objective).
- Notification click/tap deep-linking (confirmed absent on both platforms, pre-existing, systemic) was found, documented, and deferred — not fixed (a genuinely new capability, not an existing one to expose, and not safely buildable without interactive device testing in this environment).
- The full Step-3 Pending-Edit/Deletion-Request governance engine on mobile (beyond the one `harvest_plan` entity type fixed on desktop) was found, documented, and deferred — not built (a substantial standalone feature; the codebase's own `ComingSoonScreen` placeholder is evidence this was already planned as separate future work).
- Three minor desktop UX inconsistencies (`renderWorkshopOverview`'s `prompt()`-based reject, Casual Labour's missing confirmation dialog, the legacy `renderChanges` page) and one mobile/desktop parity gap (Poles Purchase reject reason optional on mobile, required on desktop) were found, documented, and deferred as Low priority — none block any capability.
- One dead-code observation (`approvalsProcess`/`approvalsDashboard` IPC channels, never called from any UI) was documented, not removed.
- Workshop Isolation was not redesigned, broadened, or weakened anywhere — every fix reuses the exact existing `isWorkshopRestricted()` idiom.
- No new permission, role, notification type, or schema change was introduced.
- No unrelated bug was silently fixed; the one cross-layer route/function mismatch found during Casual Labour verification (mobile-api route allows `admin`, the function doesn't) was corrected only in the new mobile client code being built this phase (to avoid shipping a button that silently fails), not in the pre-existing route file, which was out of scope.
- Nothing was committed or pushed.

## Next step

Per the phase's Stop Rule: this phase is complete and stops here. The recommended next phase is a dedicated Mobile Governance Engine build (Pending-Edit/Deletion-Request approval on mobile), with Notification Deep-Linking as a second candidate — neither started automatically, both await explicit approval.
