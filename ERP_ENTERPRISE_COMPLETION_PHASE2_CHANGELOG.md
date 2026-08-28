# ERP Enterprise Completion Phase 2 — Changelog

## Summary

Implemented and live-verified the seven High-priority findings from `ERP_ENTERPRISE_PERMISSION_NOTIFICATION_AUDIT.md`. Two files changed. No schema change, no new permission system, no Workshop Isolation redesign, no business-logic/workflow change, no UI file touched (none required — see completion report §6). Nothing committed or pushed.

## Files changed

### `db/migrate.js`
- Added `'poles-supervisor'` and `'vat-supervisor'` entries to `permissionsByRole` (PERM-1), mirroring the existing narrower "supervisor tier" shape already used by `harvesting-supervisor`/`sawmill-supervisor`.
- Migration executed live (`npm run migrate`) to apply the grant to the production `role_definitions` table. The grant function is additive/idempotent (`Array.from(new Set([...existing, ...perms]))`) — confirmed via a fresh live query that both roles' pre-existing incidental permissions (`procurement-dashboard`, `procurement-requisitions`, and for vat-supervisor also `changes`/`stock-transfers`) were preserved, not overwritten.

### `db/services/data.js`
- **`materialRequestsApprove`** (PERM-3) — replaced the `mustRole(user,'stock-movements')`-based `hasFullAccess` check with an explicit `APPROVAL_TIER = ['admin','ceo','operations','logistics']` list matching desktop's existing `canApprove` gate. Both approve and reject branches share this one gate.
- **`procurementConfigGet`** (PERM-17) — added a `mustRole(user,'procurement-settings')` gate; was previously readable by any authenticated user.
- **`resolutionsList`** (PERM-18) — added a gate requiring the same permission set its write-side sibling `resolutionCreate` already requires; was previously readable by any authenticated user (the prior `if (!user)` check was dead code).
- **`maintenanceJobCreate`** (PERM-7) — gate widened from `mustRole(user,'machines')` only to `mustRole(user,'machines') || mustRole(user,'maintenance-jobs')`.
- **`maintenanceJobAssign`** (PERM-8) — same widening as above, same root cause.
- **`polesPurchaseList`** (WI-3a) — read-side workshop filter changed from `workshopId ? Number(workshopId) : (user.workshop_id || null)` to the standard `isWorkshopRestricted(user) ? user.workshop_id : (workshopId ? Number(workshopId) : null)`.
- **`polesPurchaseCreate`** (WI-3b) — write-side workshop stamp changed from `user.workshop_id || (p.workshop_id ? Number(p.workshop_id) : null)` to `isWorkshopRestricted(user) ? user.workshop_id : (p.workshop_id ? Number(p.workshop_id) : null)`.
- **`polesDeliveryCreate`** (WI-3b) — same change as `polesPurchaseCreate`, same root cause.

Every change is a comment-documented, minimal diff at the top-of-function authorization gate or the workshop-id resolution line — no other logic in any of these seven functions was touched.

## Verification performed

- `node --check db/migrate.js` — clean.
- `node --check db/services/data.js` — clean (re-run after every individual edit, and once more at the end).
- `node --check renderer/app.js`, `electron/main.js`, `electron/preload.js` — clean (baseline confirmation; none of these files were touched this phase).
- `cd mobile && npx tsc --noEmit` — clean (baseline confirmation; no mobile file was touched this phase).
- 18/18 live production-database tests across all seven findings (see completion report §9).
- 6/6 read-only regression checks across adjacent, untouched workflows (see completion report §10).

## Live QA data — full lifecycle

| Action | Detail |
|---|---|
| Created | 1 `material_requests` row + 1 auto-created `stock_transfers` row (WS3); 1 `maintenance_jobs` row (WS6); 3 `poles_purchase_requests` rows + 2 `poles_deliveries` rows (WS7/WS1); 2 throwaway `app_users` rows, roles `poles-supervisor`/`vat-supervisor` (WS1/WS2, no real accounts of these roles existed yet to test against) |
| Purpose | Convert all seven source-level findings into live-confirmed fixes against production data, using real existing accounts wherever one existed for the required role |
| Cleaned up | All transactional rows hard-deleted in FK-safe order (`material_requests.transfer_id` nulled before deleting the referenced `stock_transfers` row, breaking the circular FK) |
| QA accounts | The 2 throwaway accounts could not be hard-deleted — each generated an `audit_log` row during testing, and `audit_log` is protected by the immutable `audit_log_no_delete`/`audit_log_no_update` Postgres RULEs (same constraint already documented in this session's "Stray QA test accounts" memory). Soft-deleted instead via the codebase's own established `usersDelete()` function — `active=false`, `deleted_at` set — the same mechanism used for every other account removal in this app. |
| Independently re-verified | Fresh COUNT queries after cleanup: 0 leftover rows for every transactional entity type; both QA accounts confirmed `active=false`/`deleted_at` set |
| Real business data touched | None |

## Explicitly not done (per this phase's Stop Rule and Bug Discipline)

- No Medium/Low finding from the prior audit was addressed.
- Workshop Isolation was not redesigned, broadened, or weakened — the one confirmed exception (WI-3a/3b) was brought in line with the existing pattern, not given a new mechanism.
- No new permission, role, notification type, or schema change was introduced.
- No UI file (`renderer/app.js`, any `mobile/` file) was modified — traced and confirmed not required for any of the seven fixes (see completion report §6).
- The one new observation found during verification (a stale role-check comment in `mobile-api/routes/poles.js`, not a functional defect) was documented, not fixed, per Bug Discipline.
- Nothing was committed or pushed.

## Next step

Per the phase's Stop Rule: this phase is complete and stops here. The remaining Medium/Low findings from the prior audit, plus WI-4 (pending business-policy answer), remain candidates for a future, separately-scoped and separately-approved phase.
