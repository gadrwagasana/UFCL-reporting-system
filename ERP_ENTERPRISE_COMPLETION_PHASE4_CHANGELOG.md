# ERP Enterprise Completion Phase 4 — Changelog

## Summary

Built mobile UI/API parity for the existing Pending-Edit / Deletion-Request governance engine — the review/approval side only; the submission side was already working across 11 mobile-api routes before this phase. No schema change, no Workshop Isolation redesign, no new business workflow, no desktop file touched. Nothing committed or pushed.

## Files changed (9 total, all mobile)

### New files
- **`mobile-api/routes/governance.js`** — 5 routes (`GET/POST pending-edits`, `GET/POST×2 deletion-requests`), pure delegation to `data.js`'s existing `pendingEditsList/Review`, `deletionRequestsList/Approve/Reject` — no route-level role gate (matches the `poles.js`/`rejectionHolds.js`/`notifications.js` convention; `data.js`'s `LEADER_APPROVERS`/`MANAGER_APPROVERS` remain the single source of truth).
- **`mobile/src/hooks/useGovernance.ts`** — `usePendingEdits()`, `usePendingEditsReview()`, `useDeletionRequests()`, `useDeletionRequestReview()`, mirroring `useCasualLabour.ts`'s shape.
- **`mobile/src/screens/governance/GovernanceScreen.tsx`** — two-tab screen ("Edit Requests" / "Deletion Requests"), structurally identical to `ceo/ApprovalsScreen.tsx`'s existing tabbed-hub pattern, reusing `ApprovalCard`/`LoadingState`/`ErrorState`/`EmptyState`/`OfflineBanner` unchanged.

### Modified files
- **`mobile-api/server.js`** — registered `/api/governance` → `governance.js`.
- **`mobile/src/api/endpoints.ts`** — 5 new endpoint entries (`GOVERNANCE_PENDING_EDITS_LIST/REVIEW`, `GOVERNANCE_DELETION_REQUESTS_LIST/APPROVE/REJECT`).
- **`mobile/src/types/api.ts`** — `PendingEditRequest`, `DeletionRequestItem`, and their list-response types, mirroring `data.js`'s actual row shapes exactly.
- **`mobile/src/navigation/types.ts`** — added `Governance: undefined` to `RootStackParamList`.
- **`mobile/src/navigation/RootNavigator.tsx`** — registered `GovernanceScreen` at root level, identical pattern to the existing `GlobalSearch`/`Notifications` registrations (Phases 2–3).
- **`mobile/src/components/AppHeader.tsx`** — added a role-conditional "Pending Approvals" icon (`hideGovernance` opt-out prop, matching `hideSearch`/`hideNotifications`'s convention), shown only to the 11 roles in `LEADER_APPROVERS ∪ MANAGER_APPROVERS` (a client-side visibility hint mirroring `data.js` exactly — the backend remains the sole authority). Chosen over adding a tab to ~10 separate per-role navigators.

## Verification performed

- `node --check mobile-api/routes/governance.js`, `mobile-api/server.js` — clean.
- `require()`-time smoke test — all 5 routes registered with the correct method/path.
- `cd mobile && npx tsc --noEmit` — clean, full project, run after every change.
- 29/29 live production-database checks across Scenarios A–G (see completion report §16).
- `git status` confirms exactly these 9 files changed; zero changes to `db/services/data.js`, `renderer/app.js`, `electron/main.js`, `electron/preload.js`.

## Live QA data — full lifecycle

| Action | Detail |
|---|---|
| Created | 6 throwaway `compartments` rows, 4 `pending_edits` rows, 2 `deletion_requests` rows — covering Scenarios A (edit approve), B (edit reject), C (delete approve), D (delete reject), E (unauthorized), F (cross-workshop leader-tier approval) |
| Purpose | Convert every supported lifecycle transition into a live-confirmed working path against production data, using real existing accounts for every required role (no throwaway accounts were needed this phase) |
| Cleaned up | All rows hard-deleted in FK-safe order (governance rows before the compartments they reference); the non-immutable `notifications` rows this activity generated were also cleaned |
| Independently re-verified | Fresh COUNT queries after cleanup: 0 leftover rows for every entity type |
| Not deleted (by design) | `audit_log` entries this legitimate QA activity generated — immutable per the `audit_log_no_delete` RULE, same discipline as Phases 2–3 |
| Real business data touched | None |

## Bugs discovered

1. **Desktop's governance-panel role gate is narrower than the backend's actual role model** (`canApproveEdits`/`canManageTrash` exclude all 6 `LEADER_APPROVERS`-only roles and `sales`). Documented, not fixed — doesn't block this phase's mobile workflow, isn't a security issue (under-exposure, not over-exposure), and "any desktop change must be justified by an actual verified defect" per this phase's own Bug Discipline. Mobile was instead built to expose the full backend-authorized role model directly, closing the gap for mobile users without touching desktop.
2. **`deletionRequestsList` has a narrower 2-tier access model than `pendingEditsList`'s 3-tier model** (no "see your own submissions" tier for deletion requests). Pre-existing, not introduced this phase — documented as a business-policy question, deferred.
3. **`pending_edits.action_type='delete'` is a dead code path** — `applyPendingEdit` handles it, but no current caller ever produces it. Documented only, zero functional impact.

None of the three required a fix under this phase's Bug Discipline (none block the approved workflow, create a security/authorization vulnerability, break Workshop Isolation, cause data corruption, or cause the implemented workflow to fail).

## Explicitly not done (per this phase's Stop Rule and Bug Discipline)

- Notification deep-linking — assessed per Workstream 9's explicit decision tree and deferred to Phase 5: the governance engine's own notifications carry no `relatedModule`/`relatedId` at all, and even where other producers do, no cross-navigator routing mechanism exists to safely build on. Not invented this phase.
- Cancel/Reopen actions for either request type — confirmed genuinely unsupported by the backend (not a gap to fill; there is nothing to expose).
- Desktop's narrower governance-panel gate (bug #1 above) — not reconciled with the backend's full role model.
- `deletionRequestsList`'s 2-tier vs. 3-tier inconsistency (bug #2 above) — not changed.
- Workshop Isolation was not redesigned, weakened, or given a new mechanism anywhere — this engine's confirmed-intentional company-wide-by-role design (§7 of the completion report) was left exactly as-is.
- Nothing was committed or pushed.

## Next step

Per the phase's Stop Rule: this phase is complete and stops here. Recommended next phase: Notification Deep-Linking (a routing-table design, scoped separately). A smaller candidate: reconciling desktop's governance-panel role gate with the backend's full model. Neither started automatically — both await explicit approval.
