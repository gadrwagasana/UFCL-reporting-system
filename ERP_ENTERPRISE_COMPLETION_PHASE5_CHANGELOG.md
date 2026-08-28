# ERP Enterprise Completion Phase 5 — Changelog

## Summary

Implemented notification deep-linking on desktop and mobile for 12+ modules (Stock Transfers, Maintenance Jobs, Procurement's 5 sub-modules, Governance) via a centralized, authorization-free routing registry on each platform. Fixed 2 pre-existing data gaps that were blocking routing entirely (Procurement's hardcoded generic `relatedModule`, the governance engine's missing `relatedModule` across all 5 of its notification producers) and 1 Workshop Isolation gap that Phase 5's own feature made newly reachable. No schema change, no new notification lifecycle action, no Workshop Isolation redesign. Nothing committed or pushed.

## Files changed (4 total)

### New
- **`mobile/src/utils/notificationRouting.ts`** — `NOTIFICATION_ROUTES` lookup table + `resolveNotificationRoute()`, mirroring Global Search's own pre-existing `DIRECT_NAV_MODULE` pattern exactly (a bare `navigation.navigate(screen, params)` for confirmed id-based self-fetching detail screens; governance is a root-level list-screen special case; everything unmapped resolves to "no destination," never a wrong one).

### Modified
- **`db/services/data.js`**:
  - `notifyProcurementEvent` — added a `module` property to each of its 28 event definitions (reusing existing desktop page-id strings: `procurement-requisitions`/`-orders`/`-invoices`/`-rfq`/`-suppliers`), replacing the single hardcoded `relatedModule:'procurement'` with `e.module || 'procurement'`.
  - `autoRequestEdit`, `autoRequestDelete`, `processApprovalDecision`, `pendingEditsCreate`, `deletionRequestCreate` — all 5 governance notification producers (both the automatic-deferral path and the manual/direct submission path) now set `relatedModule:'governance', relatedId:<request id>`.
  - `stockTransfersDispatchHistory` — added the missing `isWorkshopRestricted()` check (same idiom as its Phase 3-fixed sibling write-side actions); this function is what the new `StockTransferDetail` deep link calls, and had no workshop check at all before this fix.
- **`renderer/app.js`** — new `NOTIFICATION_ROUTES` object + `navigateToNotification()` resolver (reusing 7 already-existing, globally-callable `open*DetailOverlay(id)` functions and `showPage()`); `_loadNotifItems()`'s row template and click wiring updated so rows with a `related_module` are clickable (mark-read + navigate), rows without one are unchanged.
- **`mobile/src/screens/notifications/NotificationsScreen.tsx`** — `NotifCard` shows a chevron only when a route resolves; `onPress` now marks read and navigates via the new resolver, or shows an informational alert for notifications that have a `related_module` but no mapped destination.

## Verification performed

- `node --check db/services/data.js`, `renderer/app.js` — clean, re-run after every edit.
- `cd mobile && npx tsc --noEmit` — clean, full project.
- 19/19 live production-database checks across Scenarios A–G (see completion report §15).
- `git status` confirms exactly these 4 files changed.

## Live QA data — full lifecycle

| Action | Detail |
|---|---|
| Created | 1 `material_requests` + 1 auto-created `stock_transfers` (Scenario A); 1 `maintenance_jobs` (Scenario B); 2 additional throwaway `stock_transfers` (Scenarios D, F); 1 `compartments` + 1 `pending_edits` (Scenario E) |
| Purpose | Convert every fix into a live-confirmed working deep-link chain — notification created with correct data → routing registry resolves the correct destination → the destination's existing authorized function returns the correct record (or correctly denies an unauthorized/wrong-workshop caller, or gracefully reports "not found" for a deleted record) |
| Cleaned up | All rows hard-deleted in FK-safe order; non-immutable `notifications` rows this activity generated were also cleaned |
| Independently re-verified | Fresh COUNT queries after cleanup: 0 leftover rows for every entity type |
| QA accounts | None created — all test actors were real, existing accounts across every required role |
| Real business data touched | None |

## Bugs found

1. Procurement notifications carried a single hardcoded `relatedModule:'procurement'` for all 28 event types — blocked routing for the entire 17-function module. **Fixed.**
2. The governance engine's notifications (all 5 producers) carried no `relatedModule`/`relatedId` at all. **Fixed.**
3. The manual governance submission path (`pendingEditsCreate`/`deletionRequestCreate`) was still missing the fix after the first pass — caught by the live test itself (Scenario E), not by static audit. **Fixed** in the same pass once found.
4. `stockTransfersDispatchHistory` had no Workshop Isolation check — previously known and deferred as low-severity in Phase 3 (nothing linked to it directly at the time); Phase 5's own deep link changes that, making it a live blocker per this phase's Bug Discipline. **Fixed.**
5. `material-requests` cannot be deep-linked on either platform without further work (desktop's overlay function is closure-scoped; mobile's detail screen needs a full object with no cheap fetch-by-id path). **Documented, deferred** — not a security or correctness issue, just an unmapped module.

## Explicitly not done (per this phase's Stop Rule and Bug Discipline)

- No new notification lifecycle action was added (no dismiss/delete/unread) — confirmed the backend doesn't support any of these, so none were invented.
- No schema change — `related_module`/`related_id` already existed and were sufficient once populated correctly.
- `material-requests`, `sales`, `deliveries`, `srm`, and the 4 inline-action-list modules (`rejection_holds`, `resolution_records`, `harvest_waste`, `showroom_damage_reports` on mobile) remain undeep-linkable — documented, not guessed at, per Workstream 5's explicit "do not invent destinations where no corresponding UI page exists."
- `payment_approved`/`payment_rejected` events remain unmapped (their `entity.id` is a payment row, not usable against the Invoice Detail screen without a further data.js change to also pass the parent invoice id).
- Workshop Isolation was not redesigned anywhere — the one fix (`stockTransfersDispatchHistory`) reuses the exact existing idiom.
- Nothing was committed or pushed.

## Next step

Per the phase's Stop Rule: this phase is complete and stops here. Recommended next phase: close the `material-requests` deep-link gap (highest-volume unmapped workflow) and add single-record fetch support for `sales`/`deliveries`. Not started automatically — awaits explicit approval.
