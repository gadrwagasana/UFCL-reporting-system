# HR Enterprise Phase 1 — Gap Register

## Fixed this phase

| # | Finding | Severity | Fix |
|---|---|---|---|
| 1 | Desktop Casuals page showed Edit/Delete to `supervisor`, but the backend rejected that role unconditionally — every click failed with "Access denied" | Medium (UI-exists-but-backend-rejects) | `casualsUpdate`/`casualsDelete` widened to accept `supervisor` (user-approved, narrow scope) + new Workshop Isolation check |
| 2 | The Casuals edit form never sent the `active` field — no one, including admin, could deactivate a casual worker from any UI despite full backend support | Medium (missing capability) | `casualsUpdate`'s `active` handling fixed to fall back to the existing value instead of force-`true`; desktop form gained a real Active checkbox |
| 3 | `casualLabourRequestsReview` had zero notification producers — the submitter learned of an approval/rejection only by re-opening the page | Medium | Added `pushNotification` to the submitter, matching `materialRequestsApprove`'s pattern; added `NOTIFICATION_ROUTES` entries on both platforms |
| 4 | `casualLabourRequestsReview` had no guard against reviewing an already-reviewed request | Medium (data integrity) | Added a `status='Pending'` guard, live-verified under concurrency (two simultaneous reviews → exactly one succeeds) |
| 5 | Zero mobile presence existed for the Casuals (casual worker) registry | Medium (Priority 3, explicitly mandatory) | Built full mobile parity: REST route, types, hook, List/Form screens, role-gated entry point in the shared `CasualLabourStack` |

## Deferred / documented, not fixed

| # | Finding | Severity | Why deferred |
|---|---|---|---|
| D1 | **Attendance does not exist anywhere in this ERP** — no table, backend, route, or UI | N/A — new business capability | Explicitly out of scope per the brief's own DO-NOT list ("do not invent... functionality if it does not already exist"); escalated via `AskUserQuestion`, user chose to defer entirely. Blocks Priorities 4/5/6/14/16/18(attendance parts)/19 of the original brief — see Completion Report §5/§16 |
| D2 | No dedicated "HR employee" entity exists distinct from `app_users`; no phone/national-ID/employment-date fields tracked for regular staff | N/A — business decision | `app_users` is a login/permissions account by design; adding richer fields is a schema change to a live authentication table, not something to apply silently. Documented in Completion Report §3 |
| D3 | `mobile-api/routes/casualLabour.js`'s `/:id/review` route allows `admin` via `requireRoles`, but `casualLabourRequestsReview` itself only accepts `ceo`/`operations` — a route/backend mismatch | Low | Currently unreachable — no UI on either platform shows a review action to `admin` for this workflow. Resolving it (either direction) is a permission-scope decision outside this phase's brief; confirmed live via test check 18 in the Completion Report |
| D4 | No dedicated HR "register" CSV export exists (Employee register, Casual Worker register) | Low | The existing list views on both platforms already expose the same data; not a confirmed gap, just a possible future nice-to-have |

## New business decisions

- **Decided this phase**: Attendance scope — defer entirely, document only (Completion Report §24, decision 1).
- **Decided this phase**: Casuals edit/delete permission — extend to `supervisor`, workshop-scoped (Completion Report §24, decision 2).
- **Still pending**: whether/how to build Attendance as a new capability (business rules for "late", correction approval flow, whether it drives any payroll-adjacent calculation); whether to extend `app_users` with richer HR fields or build a genuinely separate HR employee entity (D2).
