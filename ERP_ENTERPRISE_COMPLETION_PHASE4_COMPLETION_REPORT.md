# ERP Enterprise Completion Phase 4 — Mobile Governance Completion

**Completion Report — 2026-08-08**

## 1. Objective

Bring the existing Pending-Edit / Deletion-Request governance engine (deferred from Phase 3) to full mobile UI/API parity: `Backend Governance → API → Mobile UI → Permission → Approval → Audit → Notification → Final State`, without redesigning Workshop Isolation or any unrelated module.

## 2. Scope

Primarily mobile. Two governance workflows: Pending Edit Requests and Deletion Requests. Notification deep-linking was assessed per the brief's explicit instruction and deferred (§9, §11) since the existing architecture doesn't safely support it without a larger redesign. No desktop file was modified — zero changes were needed or justified (§10, §19).

## 3. Pre-Implementation Audit

Traced the full chain for both workflows against current source before writing any code:

```
pending_edits / deletion_requests tables (Postgres)
  ↓
db/services/data.js: applyGovernance() → autoRequestEdit()/autoRequestDelete()
                      pendingEditsCreate/List/Review, deletionRequestCreate/List/Approve/Reject
                      processApprovalDecision() (single unified Step-3 engine for both)
  ↓
electron/main.js: pending-edits:list/create/review, deletion-requests:list/create/approve/reject
                   (+ redundant approvals:process/dashboard — dead, unused by any UI)
  ↓
mobile-api/routes/*.js: SUBMISSION side already worked (11 routes: compartments, customers,
                         deliveries, dispatch, fuel, harvest, machines, sales, sawmill,
                         stock, vehicles — all via applyGovernance()'s pendingApproval passthrough)
                         REVIEW side: NO route existed (confirmed in Phase 3, re-confirmed here)
  ↓
mobile hooks/screens: submission-side UX already worked (toasts on pendingApproval, per Phase 3)
                       REVIEW side: no hook, no screen — only a ComingSoonScreen stub
  ↓
UI action: desktop only, via insertPendingPanel/insertDeletionPanel (14→15 modules, Phase 3)
  ↓
backend authorization: processApprovalDecision's own role check (LEADER_APPROVERS/MANAGER_APPROVERS)
  ↓
audit log: full before/after trail, immutable — unchanged, verified intact
  ↓
notification: forUserId to the original submitter — unchanged, verified intact
```

**Nothing was assumed missing because it was absent from one platform.** The single most important discovery of this audit: the *submission* side of this engine is mature and already used by mobile across 11 route files — the gap was specifically and only the *review/approval* side. This materially narrowed and de-risked the phase's actual scope.

## 4. Backend Capabilities Found

- `applyGovernance(user, table, recordId, actionType, opts)` — the single entry point every entity update/delete function calls. Returns `null` (proceed) or `{ ok:false, pendingApproval:true, level, message }` (deferred to the queue).
- `timeGatedAuthorization()` — the underlying decision function: privileged roles (admin/ceo/operations) always proceed (logging a "privileged override" alert to ceo/admin if they touch a record they don't own); everyone else can act directly only within 5 minutes of creating their own record; after that, or if they don't own it at all, the action is deferred to `pending_edits`/`deletion_requests` at `leader` level (if under 24h old / not owned by a privileged user) or `manager` level (after 24h).
- `pendingEditsCreate`/`deletionRequestCreate` — the direct, manual submission functions (used by `applyGovernance`'s `autoRequestEdit`/`autoRequestDelete` internally, and directly by `mobile-api/routes/compartments.js`'s supervisor-edit/delete branch — the one pre-existing manual mobile integration point found).
- `pendingEditsList`/`deletionRequestsList` — role-tier-filtered reads: `MANAGER_APPROVERS` (`admin`,`ceo`,`operations`,`logistics`,`sales`) see everything; `LEADER_APPROVERS` (`supervisor`,`harvesting-leader`,`sawmill-leader`,`logistics-leader`,`poles-leader`,`vat-leader`,+ the manager set) see only `leader`-level requests. `pendingEditsList` additionally lets anyone else see their own submissions; `deletionRequestsList` does not (pre-existing 2-tier vs 3-tier inconsistency — see §15).
- `processApprovalDecision(userId, requestType, requestId, decision, notes)` — the single unified approve/reject handler for both request types. Validates `allowedRoles.includes(user.role)` against the request's own `required_level`, applies the change (`applyPendingEdit()` for edits; a soft-delete `UPDATE ... SET deleted_at=NOW()...` for deletions, gated by a `SOFT_DELETE_ALLOWED` table whitelist), updates status, cancels any pending SLA escalation jobs, writes a full before/after audit entry, and notifies the original submitter.
- Escalation: `escalatePendingRequests()` — periodic SLA reminders (6h leader / 12h manager) and escalations (24h either tier) via `workflow_jobs`. Not touched this phase; confirmed unrelated to the mobile-reachability gap.

## 5. Mobile Gaps Found

Exactly one gap, confirmed via source (not assumption): **the review/approval side of this engine had no mobile-api route, no mobile hook, and no mobile screen** — desktop's own `insertPendingPanel`/`insertDeletionPanel` were the only UI anywhere that could view or act on a pending edit/deletion request. The submission side (§4) was already complete. `OperationsNavigator` had a literal `PendingReviews` → `ComingSoonScreen` placeholder tab — direct evidence this was already planned, not an oversight the team was unaware of.

## 6. Permission Matrix

| Action | Who (backend, `data.js`) | Enforced where |
|---|---|---|
| Create edit request (implicit, via any entity update) | Any authenticated user whose edit isn't immediately allowed by `timeGatedAuthorization` | `applyGovernance` → `autoRequestEdit` |
| Create edit request (manual) | Any authenticated user (`pendingEditsCreate` has no role gate of its own — matches its one real caller, `compartments.js`'s supervisor-only branch, which gates at the route/business level instead) | `pendingEditsCreate` |
| Create deletion request | Any authenticated user, reason required | `deletionRequestCreate` |
| View pending edits (all) | `MANAGER_APPROVERS`: admin, ceo, operations, logistics, sales | `pendingEditsList` |
| View pending edits (leader-level only) | `LEADER_APPROVERS`: supervisor, harvesting-leader, sawmill-leader, logistics-leader, poles-leader, vat-leader (+ manager set) | `pendingEditsList` |
| View own edit submissions | Everyone else | `pendingEditsList` |
| View deletion requests (all/leader-level) | Same two tiers as edits | `deletionRequestsList` |
| View own deletion submissions | **Not supported** — pre-existing gap, documented not fixed (§15) | — |
| Approve/Reject (either type) | `allowedRoles.includes(user.role)` where `allowedRoles` = the request's own `required_level`'s tier | `processApprovalDecision` |
| Cancel/Reopen | **Not supported by the backend at all** — confirmed by reading every function in this engine; no cancel/reopen path exists for either `pending_edits` or `deletion_requests` once submitted. Not built (Bug Discipline: "do not invent new workflow states"). |

Mobile now exposes exactly this matrix — no more, no less. The new `mobile-api/routes/governance.js` adds zero role gating of its own (matching the established `poles.js`/`rejectionHolds.js`/`notifications.js` convention), delegating authorization entirely to the functions above — one source of truth, no drift risk.

## 7. Workshop Isolation Verification

**Critical finding, verified from source, not assumed**: neither `pending_edits` nor `deletion_requests` has a `workshop_id` column at all (confirmed via `information_schema.columns`). `pendingEditsList`'s own code comment states the design explicitly: *"Managers see all requests; leader-level approvers see only leader-level requests; everyone else sees only their own submissions"* — a role-tier model with no workshop dimension, by design. This mirrors the same architecture already confirmed correct for Procurement's stage-based approval in Phase 3 (`PROCUREMENT_STAGE_ROLE`): a small set of cross-department "leader"/"manager" ranks exist specifically to provide company-wide second-line oversight, not per-workshop review.

This was verified **live** (Scenario F, §16): a `poles-leader` at Nyanza (workshop 4) can see and approve a `leader`-level edit request submitted by a `supervisor` at Gatare (workshop 3) — confirmed as **intentional, correct behavior**, not a Workshop Isolation defect. The underlying *records* this engine governs remain fully workshop-isolated through their own existing, unmodified list/read functions (e.g., `compartmentsList`) — this governance layer only ever touches a record after a workshop-scoped user has already legitimately identified it through their own normal, isolated view; the review step itself is the one deliberately cross-workshop link in the chain, exactly as designed.

**No change was made to `isWorkshopRestricted()` or any isolation helper.** Mobile's new screen reuses the backend's existing role-tier filtering exactly as-is — no second isolation mechanism, no workshop scoping invented, nothing weakened.

## 8. UI Implementation

New screen `mobile/src/screens/governance/GovernanceScreen.tsx` — two tabs ("Edit Requests" / "Deletion Requests"), structurally identical to the existing `ceo/ApprovalsScreen.tsx` tabbed-hub pattern. Each tab is a `FlatList` of `ApprovalCard` (the existing shared component — Approve fires immediately, Reject opens the card's built-in optional-reason sheet), with `LoadingState`/`ErrorState`/`EmptyState`/`OfflineBanner` all reused unchanged. No mandatory field was invented: `processApprovalDecision`'s `notes` parameter is optional for both approve and reject on both request types, confirmed by reading every call site — `ApprovalCard`'s existing optional-reason behavior matches this exactly, nothing was made artificially required.

**Reachability**: registered at the root navigation level (`RootNavigator.tsx`), identical to the `GlobalSearch`/`Notifications` pattern from Phases 2–3, reachable via a new role-conditional icon in the shared `AppHeader` component. Unlike the Notifications bell (shown to everyone), this icon is shown only to the 11 roles the backend actually authorizes for either tier (`LEADER_APPROVERS ∪ MANAGER_APPROVERS`) — a client-side *visibility hint only*; the backend remains the sole authority (§6). This was deliberately chosen over adding a tab to ~10 separate per-role navigator files: one shared-component change instead of ten, with identical reachability and zero drift risk between navigators.

## 9. API Implementation

New file `mobile-api/routes/governance.js`, registered at `/api/governance` in `server.js`:

| Method | Path | Backend function |
|---|---|---|
| GET | `/api/governance/pending-edits` | `pendingEditsList` |
| POST | `/api/governance/pending-edits/:id/review` | `pendingEditsReview` |
| GET | `/api/governance/deletion-requests` | `deletionRequestsList` |
| POST | `/api/governance/deletion-requests/:id/approve` | `deletionRequestApprove` |
| POST | `/api/governance/deletion-requests/:id/reject` | `deletionRequestReject` |

No route-level `requireRoles` middleware was added — matching the established `poles.js`/`rejectionHolds.js`/`notifications.js` pattern of pure delegation, since `LEADER_APPROVERS`/`MANAGER_APPROVERS` are already the single source of truth inside `data.js`; duplicating that list at the route layer would only risk the exact kind of drift Phase 2/3 found and fixed elsewhere (WS6's `mustRole('machines')` vs. mobile-api route drift). Route registration was smoke-tested (`require()`d directly, confirmed all 5 method/path pairs mount correctly) in addition to `node --check`.

## 10. Workflow Verification

All 6 lifecycle transitions the backend actually supports were exercised live end-to-end (§16, Scenarios A–D): edit-submit→approve→applied, edit-submit→reject→unchanged, delete-submit→approve→soft-deleted, delete-submit→reject→preserved. Cancel/Reopen were confirmed **not supported by the backend for either request type** (§6) and were correctly not built on mobile — this is "only implement actions the backend actually supports," not an omission.

## 11. Notification Verification

Every notification producer in this engine (`autoRequestEdit`, `autoRequestDelete`, `pendingEditsCreate`, `deletionRequestCreate`, `processApprovalDecision`) was traced and confirmed unchanged — this phase touched zero lines of `data.js`. Recipient correctness (role tier on creation, `forUserId` targeting the original submitter on decision) was live-confirmed in Scenario A (§16).

**Deep-linking (Workstream 9) — assessed, deferred**:
```
Notification Deep-Linking
Status: Deferred
Reason: Existing notification payload/routing architecture insufficient
Recommended Phase: 5
```
Specifically: `autoRequestEdit`/`autoRequestDelete`/`processApprovalDecision`'s own `pushNotification` calls set only `type`/`title`/`body`/`roles`/`forUserId` — **no `relatedModule`/`relatedId` at all** (confirmed by reading every call site in this engine). Even for the many *other* notification producers across the app that do set `relatedModule`/`relatedId` (catalogued in Phase 3), there is no existing mapping from a module string to a destination screen, and the correct nested-navigation path to any given detail screen varies by which of the ~15 role-specific navigators the current viewer is in — a genuinely new cross-navigator routing capability, not an existing one to expose. Building it safely would require a routing-table design of its own; per the brief's explicit instruction, it was not invented here.

## 12. Audit-Trail Verification

`audit_log_no_update`/`audit_log_no_delete` Postgres RULEs — unchanged, not touched. Every one of the 4 workflow scenarios (§16) confirmed a full before/after audit entry via `processApprovalDecision`'s existing `logAudit(...)` call, which records requester (`submitted_by`/`requested_by`), approver (`user.name`/`user.role`), timestamp, the record, previous/new state (`old_snapshot`/`payload` or `record_snapshot`), and the reviewer's notes — all pre-existing, all confirmed intact, none of it modified. Zero `data.js` lines were changed this phase (§19).

## 13. Regression Testing

Live regression pass, 5 spot-checks (Scenario G, §16): 5/5 pass (one initial attempt used the wrong test actor — `poles-leader` was correctly denied `rejectionHoldsList` access it never held in the first place, matching Phase 3's own confirmed role model exactly; re-verified with the correct actor, `vat-leader`, which passed). All 8 Phase 2 markers and all 12 Phase 3 fixes remain intact — expected, since this phase made zero changes to `db/services/data.js`, `renderer/app.js`, `electron/main.js`, or `electron/preload.js` (confirmed via `git status`, §19).

## 14. QA Data Cleanup

6 throwaway `compartments`, 4 `pending_edits`, and 2 `deletion_requests` rows were created across Scenarios A–F and hard-deleted in FK-safe order (governance rows before the compartments they reference). The `notifications` rows this activity generated (non-immutable table) were also cleaned. Independently re-verified via fresh `COUNT` queries after cleanup: **0 leftover rows for every entity type**. No QA account was needed this phase (all test actors were real, existing accounts across the required roles — admin, operations, supervisor, poles-leader, mechanician). `audit_log` entries generated by this legitimate QA activity were **not** deleted, per the immutable-audit-log rule already established in Phases 2–3 — they remain as a permanent, correct record that this testing occurred. Production stock and business data were never touched (this engine doesn't move stock).

## 15. Bugs Discovered

| # | Bug | Severity | Fixed / Deferred |
|---|---|---|---|
| 1 | Desktop's `canApproveEdits()`/`canManageTrash()` gates (`['admin','ceo','operations','logistics']` / `['admin','ceo','operations']`) are narrower than the backend's actual role model. The 6 `LEADER_APPROVERS`-only roles (supervisor, harvesting-leader, sawmill-leader, logistics-leader, poles-leader, vat-leader) have **zero desktop UI path** to review leader-level requests, despite the backend fully authorizing them — and `sales` (a `MANAGER_APPROVERS` role) is also excluded from `canApproveEdits()`. | Medium (under-exposure, not a security hole — restricts a legitimate capability rather than leaking one) | **Deferred.** Not caused by this phase, doesn't block the mobile workflow, isn't a security/isolation/corruption issue — the Bug Discipline criteria for "fix immediately" aren't met. Mobile was deliberately built to expose the *full* backend-authorized role model rather than copy desktop's narrower gate (§8), which is a legitimate, in-scope way to close the gap for mobile users without touching desktop at all. |
| 2 | `deletionRequestsList` has only a 2-tier access model (manager sees all / leader sees leader-level) vs. `pendingEditsList`'s 3-tier model (+ "everyone else sees their own"). A non-leader-tier submitter cannot see the status of their own deletion request through either list function. | Low | **Deferred** — pre-existing, not introduced or changed this phase; a business-policy question (should non-approver submitters see their own deletion request status?) rather than a defect. |
| 3 | `pending_edits.action_type` can theoretically be `'delete'` (handled in `applyPendingEdit`), but no current caller ever creates such a row — `autoRequestEdit` always hardcodes `'edit'`, and the one manual caller (`compartments.js`) correctly routes deletes through `deletionRequestCreate` instead. | None (dead code path, no functional impact) | **Documented only.** |

## 16. Live Verification Results

All scenarios ran against the production database using real, existing accounts for every required role (admin id 1, operations id 20, supervisor "derrick" id 45/workshop 3, poles-leader id 16/workshop 4, mechanician id 14). 29/29 valid checks passed (one additional check surfaced a test-actor error on my part, not a defect — corrected and re-verified, see Scenario G).

| Scenario | Test | Expected | Actual | Result |
|---|---|---|---|---|
| A | Submit edit request (supervisor) | success | success | PASS |
| A | Request visible via `pendingEditsList` to a manager-tier approver (operations) | true | true | PASS |
| A | Manager approves | success | success | PASS |
| A | Record updated after approval | new value applied | applied | PASS |
| A | Audit entry with before/after | present | present | PASS |
| A | Submitter notified | notification present | "Request approved — ..." | PASS |
| B | Submit + reject edit request | success | success | PASS |
| B | Record unchanged after rejection | original value | unchanged | PASS |
| B | Audit entry for rejection | present | present | PASS |
| C | Submit deletion request | success, `pending_deletion=true` | success, flag set | PASS |
| C | Visible via `deletionRequestsList` | true | true | PASS |
| C | Manager approves | success | success | PASS |
| C | Record soft-deleted | `deleted_at` set | set | PASS |
| D | Submit + reject deletion request | success | success | PASS |
| D | Record preserved | `deleted_at` NULL | NULL | PASS |
| D | `pending_deletion` cleared | false | false | PASS |
| E | Unauthorized user (mechanician) attempts approve | Access denied | "Your role (mechanician) cannot approve manager-level requests" | PASS |
| E | Record unchanged after denied attempt | unchanged | unchanged | PASS |
| E | Request status unchanged | Pending | Pending | PASS |
| E | No unauthorized audit mutation | count unchanged | unchanged | PASS |
| F | poles-leader@Nyanza sees a Gatare-submitted leader-level request | true (intentional cross-workshop governance tier) | true | PASS |
| F | poles-leader@Nyanza approves it | success (intentional, not a WI defect — §7) | success | PASS |
| G | Phase 2 marker: poles-supervisor/vat-supervisor permissions intact | true | true | PASS |
| G | Phase 2 marker: `materialRequestsApprove` still narrowed | true | true | PASS |
| G | Phase 3 marker: `rejectionHoldsList` isolation intact (vat-leader) | true | true | PASS (re-verified with correct actor) |
| G | Phase 3 marker: `stockTransfersList` functional | true | true | PASS |
| G | Phase 3 marker: `casualLabourRequestsReview` gate unchanged | true | true | PASS |

## 17. QA Data Cleanup — Independent Verification

Fresh `COUNT` queries after cleanup: `compartments` (QA-P4-% prefix) = 0, `pending_edits` (QA-P4-% entity_ref) = 0, `deletion_requests` (QA-P4-% entity_ref) = 0. No orphaned rows in any related table (notifications cleaned; audit_log intentionally preserved, immutable).

## 18. Files Changed

9 files, all mobile-side (6 modified, 3 new). Zero desktop/backend files touched.

- **New**: `mobile-api/routes/governance.js`, `mobile/src/hooks/useGovernance.ts`, `mobile/src/screens/governance/GovernanceScreen.tsx`
- **Modified**: `mobile-api/server.js` (route registration), `mobile/src/api/endpoints.ts` (5 new endpoint entries), `mobile/src/types/api.ts` (governance types), `mobile/src/navigation/types.ts` (`Governance` root route), `mobile/src/navigation/RootNavigator.tsx` (root registration), `mobile/src/components/AppHeader.tsx` (role-conditional icon)

## 19. Production Verification

- `node --check mobile-api/routes/governance.js`, `mobile-api/server.js` — clean.
- `require()`-time smoke test of `governance.js` — all 5 routes registered with correct HTTP method/path.
- `cd mobile && npx tsc --noEmit` — clean, full project.
- `git status` confirms exactly the 9 files in §18 were touched; `db/services/data.js`, `renderer/app.js`, `electron/main.js`, `electron/preload.js` all show zero changes from this phase.
- 29/29 live database verification checks pass (§16).
- All QA data cleaned and independently re-verified at 0 (§17).

## 20. Remaining Enterprise Gaps

- Notification deep-linking (§11) — deferred to Phase 5, reason documented.
- Desktop's narrower governance-panel role gate (§15, bug #1) — deferred, not blocking, mobile now exceeds desktop's own reachability for this one engine.
- `deletionRequestsList`'s 2-tier vs. 3-tier access model (§15, bug #2) — deferred, business-policy question.
- Cancel/Reopen for either request type — confirmed genuinely absent from the backend, not a gap in this phase's work (nothing to expose).

## 21. Recommendation for Phase 5

**Notification Deep-Linking** is the clear next candidate: design a per-module routing table (module string → destination screen → required nested-navigation params, per role-navigator) and add `relatedModule`/`relatedId` to the governance engine's own notification calls, which currently lack them entirely. A secondary, smaller candidate: reconcile desktop's `canApproveEdits()`/`canManageTrash()` gates with the backend's actual role model (bug #1, §15), now that mobile already correctly exposes the full model — desktop reaching parity would be a small, well-scoped follow-up. Neither should begin automatically — both require separate approval per the Stop Rule.

---

**Final Success Criteria — verified honestly, not assumed:**

- Pending Edit governance works on mobile — ✅ verified live (Scenarios A/B).
- Deletion Request governance works on mobile — ✅ verified live (Scenarios C/D).
- Permissions correctly enforced — ✅ verified live (Scenario E), matches backend exactly (§6).
- Workshop Isolation remains intact — ✅ verified; confirmed this engine is intentionally company-wide-by-role, not workshop-scoped, and nothing about the isolation architecture was touched (§7).
- Unauthorized users rejected server-side — ✅ verified live (Scenario E), no route-level UI-only gate.
- Audit trails remain correct — ✅ verified, zero `data.js` changes (§12).
- Notifications remain correct — ✅ verified, zero `data.js` changes (§11).
- Desktop governance has no regression — ✅ zero desktop files touched; same underlying functions exercised live.
- Phase 2/3 fixes remain intact — ✅ verified (§13, §16 Scenario G).
- All QA data cleaned — ✅ verified independently (§14, §17).
- Static checks pass — ✅ (§19).
- Live verification passes — ✅ 29/29 (§16).
- Completion report and changelog written — ✅ this document + changelog.

Per the Stop Rule: this phase is complete. No further phase has been started automatically. Nothing was committed or pushed. Awaiting review and approval before any next step.
