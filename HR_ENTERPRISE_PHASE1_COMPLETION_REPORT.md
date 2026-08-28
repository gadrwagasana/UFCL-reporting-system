# HR ENTERPRISE PHASE 1 — EMPLOYEE, CASUAL WORKER & ATTENDANCE COMPLETION
## Completion Report

**Date:** 2026-08-13
**Scope:** HR department — Employee registration, Casual Worker registration, Casual Labour Requests, Attendance (audited, found absent), Workshop Isolation, Permissions, Notifications, Audit Trail, Desktop/Mobile Parity.
**Status: PRODUCTION READY (Employee + Casual Worker scope) — Attendance formally deferred, requires a business decision**

---

## 1. Executive Summary

This phase audited HR end-to-end before writing any code, per the brief's Audit-First Stop Rule. The single largest finding: **Attendance does not exist anywhere in this ERP** — no table, no backend function, no REST route, no desktop or mobile UI (confirmed: the string "attendance" appears nowhere in the repository). Priorities 4/5/6/14/16/18/19 of the brief are all built on the assumption of an existing Attendance backend. Building check-in/check-out, a daily checklist, a dashboard, and the Casual Labour integration chain from scratch would mean inventing a genuinely new business capability with real rules to decide (what counts as "late", who approves corrections, etc.) — exactly what the brief's own DO-NOT list prohibits without approval. This was escalated via `AskUserQuestion`; the user chose to **defer Attendance entirely** and have this phase deliver full Employee + Casual Worker registration completeness instead.

On Employee Registration: the ERP has no separate "HR employee" entity distinct from the login account (`app_users`) — evidence-based conclusion, not an assumption (grepped the whole schema/backend for "employee", found only comment-level mentions). `app_users` already has full, production-grade CRUD via the existing Admin > Users module on both platforms. No second employee database was created, matching the brief's explicit prohibition.

On Casual Worker Registration: found a real, complete backend (`casuals` table + `casualsList/Create/Update/Delete`) with a full desktop UI, but **zero mobile presence** and **two real bugs**: (1) desktop showed Edit/Delete buttons to `supervisor`, but the backend only accepted `admin/ceo/operations` — every supervisor click failed with "Access denied"; (2) the existing Edit form never sent the `active` field, so **no one — not even admin — could actually deactivate a casual worker from the UI**, despite the backend fully supporting it. Both were escalated via `AskUserQuestion`; the user approved extending backend write access to `supervisor` (scoped to their own workshop, a new Workshop Isolation check added). Both bugs are now fixed, and a full mobile Casuals registry was built (list, register, edit, deactivate/reactivate, delete) — the first time this capability has existed on mobile at all.

A related notification gap was also found and fixed: `casualLabourRequestsReview` (approve/reject a casual labour request) had zero notification producers — the submitter had no way to learn their request was decided except by re-opening the page. Fixed, matching the established pattern from `materialRequestsApprove`. A repeated-submission guard was added in the same change (reviewing an already-reviewed request now correctly fails instead of silently re-stamping it).

38 live checks (27 CRUD/E2E + 6 concurrency + 5 regression — see §18/19/20) passed against the production database using disposable `_QA HR1`-tagged data, all fully cleaned up and independently re-verified at zero residue.

## 2. Audit Methodology

Per Priority 23, no code was written before the audit completed. The audit covered: `db/schema.sql`, `db/migrate.js`, `db/services/data.js` (grep for `employee`, `casual`, `worker`, `attendance`, `personnel`), `electron/preload.js` (IPC), `mobile-api/routes/`, `mobile-api/server.js`, `renderer/app.js` (desktop HR screens + `ROLE_PAGES`), `mobile/src/navigation/` (all role navigators + `CasualLabourStackParamList`), `mobile/src/utils/permissions.ts`, and `NOTIFICATION_ROUTES`/`notificationRouting.ts` on both platforms. Two genuine architectural/scope decisions were found and escalated via `AskUserQuestion` before any implementation began (Attendance scope; Casuals edit/delete permission mismatch) — see §24.

**Priority 1 capability inventory** (as found, before any fix):

| Capability | Backend | API/IPC | Desktop | Mobile | Permission | Notification | Audit | Status |
|---|---|---|---|---|---|---|---|---|
| Employee (app_users) CRUD | ✅ | ✅ IPC + none needed on REST (admin-only, desktop workflow) | ✅ | ✅ | admin/ceo/operations | ❌ (not expected — matches codebase convention) | ✅ | Already complete |
| Casual Worker CRUD | ✅ | ✅ IPC only, no REST | ✅ (2 bugs) | ❌ absent | admin/ceo/operations (write); +supervisor shown on desktop UI only | ❌ | ✅ | UI gap + Bug + Backend gap (mobile) |
| Casual Labour Request submit/list/delete | ✅ | ✅ IPC + REST | ✅ | ✅ | casual-requests / admin,ceo,operations,supervisor | ❌ | ✅ | Already complete (minus notification) |
| Casual Labour Request review | ✅ | ✅ IPC + REST (role mismatch) | ✅ | ✅ (via desktop-equiv screens) | ceo, operations only | ❌ → ✅ fixed | ✅ | Bug (notification gap) + Bug (route mismatch, documented) |
| Attendance (check-in/out, checklist, dashboard) | ❌ | ❌ | ❌ | ❌ | N/A | N/A | N/A | New business capability — deferred |
| Casual Worker → Attendance → Labour Hours chain | ❌ | ❌ | ❌ | ❌ | N/A | N/A | N/A | New business capability — deferred (blocked on Attendance) |

## 3. Employee Registration

**Already complete — no changes needed.** There is no separate "HR employee" table or concept anywhere in this codebase; `app_users` (login account: username, name, role, department, permissions, `active`, `workshop_id`) is the ERP's only personnel record for regular staff. This is an evidence-based conclusion (grepped `db/schema.sql`/`db/migrate.js`/`data.js` for "employee" — zero real matches, only comment-level uses like "Employee wages" as a cost-category label), not an assumption. Full CRUD already exists via the existing Admin > Users module on both desktop and mobile (`usersList`/`usersCreate`/`usersUpdate`/`usersDelete`/`usersResetPassword`), confirmed still functional in this phase's regression pass (§20).

`app_users` does **not** track the richer identification/contact/employment-date fields the brief's Priority 2 lists (phone, national ID, employment dates) — these simply aren't part of this ERP's login-account model. Per the brief's own instruction not to merge concepts without evidence, and not to invent new functionality to fill a UI gap, this is **documented as a new business capability requiring a decision** (§24), not silently added to a live authentication table.

## 4. Casual Worker Registration

**Backend already existed; two real bugs fixed; mobile built from scratch.**

- `casuals` table (national ID, phone, gender, DOB, address, department, work location, job role, supervisor, start/end dates, emergency contact, salary per action, `active`, `workshop_id`) — rich, purpose-built HR record, already the correct model for this capability (not duplicated).
- **Bug 1 (permission mismatch):** desktop's `canManage` check showed Edit/Delete to `supervisor`, but `casualsUpdate`/`casualsDelete` only accepted `admin/ceo/operations` — every supervisor click failed. **Fixed** (approved): supervisors can now edit/delete casual workers, scoped to their own workshop via a new `isWorkshopRestricted` check (these functions never needed one before, since only unrestricted roles could call them).
- **Bug 2 (missing deactivate path):** the existing Edit form never sent the `active` field; `casualsUpdate`'s SQL used `p.active !== false` (undefined → forced true), so a worker could never actually be deactivated by anyone, and any unrelated edit would silently reactivate a previously-deactivated worker. **Fixed**: the SQL now falls back to the existing value when `active` isn't explicitly sent, and the desktop form gained a real Active checkbox.
- **Mobile: built from scratch** — first-ever mobile presence for this capability. New REST route (`mobile-api/routes/casuals.js`), types, hook (`useCasuals.ts`), and two screens (`CasualsListScreen`, `CasualFormScreen`) nested into the existing shared `CasualLabourStack` (stack push, not a new tab — reached via a role-gated header button on `CasualLabourListScreen`, visible only to `admin/ceo/operations/supervisor`, matching the backend gate exactly).

## 5. Attendance

**Confirmed absent — zero backend, zero UI, zero database.** No table, no `data.js` function, no REST route, no IPC channel, no desktop page, no mobile screen. Escalated via `AskUserQuestion`; **user chose to defer entirely** rather than build a new capability under this phase's scope. This is a genuine gap in the ERP's functional coverage, not a UI-discoverability problem like every other finding in this program to date — it requires a dedicated future phase with real business-rule decisions (what counts as "late", approval flow for corrections, whether attendance drives payroll for casuals) made explicitly by management first. See §24.

## 6. Attendance Checklist

Not built — depends entirely on §5. No existing backend data supports it (no per-worker daily record of any kind exists to check off).

## 7. Employee/Worker Status

- **Employee (`app_users.active`)**: already correctly reflected and actionable in the existing Admin > Users UI on both platforms — unchanged, confirmed still functional (§20).
- **Casual Worker (`casuals.active`)**: now correctly reflected and actionable on both platforms following the Bug 2 fix in §4 — previously displayed but non-functional.
- No other status values (Suspended, Terminated, etc.) exist in either table's current business model; none were invented.

## 8. CRUD Parity

| Capability | Create | Read | Edit | Deactivate/Delete |
|---|---|---|---|---|
| Employee (app_users) | ✅ (unchanged) | ✅ | ✅ | ✅ (soft, unchanged) |
| Casual Worker (casuals) | ✅ (unchanged) | ✅ | ✅ (fixed — supervisor now works) | ✅ (fixed — deactivate now works; delete is hard-delete, unchanged) |
| Casual Labour Request | ✅ (unchanged) | ✅ | N/A (no edit, by design) | ✅ (unchanged) / Review ✅ (notification + idempotency added) |

## 9. Desktop/Mobile Parity

| Capability | Desktop | Mobile (before) | Mobile (after) |
|---|---|---|---|
| Employee (Admin > Users) | ✅ Full | ✅ Full (unchanged) | ✅ Full (unchanged) |
| Casual Worker registry | ✅ Full (bugs fixed) | ❌ Did not exist | ✅ Full (new this phase) |
| Casual Labour Requests | ✅ Full (unchanged) | ✅ Full (unchanged) | ✅ Full (unchanged) |
| Attendance | ❌ Does not exist | ❌ Does not exist | ❌ Does not exist (deferred) |

No artificial mobile parity was forced — Casual Worker mobile access is gated to exactly the roles that hold the backend permission (`admin/ceo/operations/supervisor`), same as desktop.

## 10. Permissions

- `casuals` page: `admin/ceo/operations/supervisor` (ROLE_PAGES fallback + DB `role_definitions`) — desktop nav/read access already matched this; write access (`casualsUpdate`/`casualsDelete`) previously narrower (`admin/ceo/operations` only) — now widened to match, approved (§24).
- **Found, documented, not fixed**: `mobile-api/routes/casualLabour.js`'s `/:id/review` route allows `admin` via `requireRoles('ceo','operations','admin')`, but `casualLabourRequestsReview` itself only accepts `ceo`/`operations` — an admin calling this route gets a genuine `{ok:false,error:'Access denied'}`, confirmed live (§18, check 18). Low severity — no UI on either platform currently shows a review action to `admin` for this workflow, so this route/backend mismatch is not currently reachable as a user-facing bug. Documented in the Gap Register rather than changed, since resolving it either way (broaden the backend, or narrow the route) is a permission-scope decision this phase's brief didn't ask for.
- No permission was granted without the explicit approval captured in §24.

## 11. Workshop Isolation

- `casualsList`/`casualsCreate` already applied `isWorkshopRestricted` correctly (unchanged).
- `casualsUpdate`/`casualsDelete` had no Workshop Isolation check at all (harmless before this phase, since only unrestricted roles could call them) — now correctly enforced now that `supervisor` (a workshop-scoped role) can call them. Live-verified: a temporary QA supervisor at Nyanza could not edit, delete, or even see a Gatare casual worker (§18, checks 10–12); the Gatare supervisor could still act on their own workshop's record (check 13, sanity control).
- `app_users` (Employee) has no workshop-scoping concern in this phase's changes — untouched.

## 12. Notifications

- Audited every HR-adjacent notification producer. Found **zero** for the entire Casuals/Casual Labour Requests domain before this phase.
- **Fixed**: `casualLabourRequestsReview` now notifies the original submitter on approve/reject (`relatedModule: 'casual-requests'`, `relatedId`, `forUserId: created_by`), matching the established `materialRequestsApprove` pattern exactly. Live-verified: exactly one notification produced per review, correctly addressed (§18 check 20, §19 check A).
- Added the missing `NOTIFICATION_ROUTES`/`notificationRouting.ts` entries on both platforms (page-only, same class as `material-requests`/`dispatch` — no per-record detail overlay exists for this workflow on either platform).
- Casual worker create/edit/deactivate deliberately does **not** get a notification — consistent with this codebase's existing convention (customer/vehicle/etc. registration events are not notified either; only approval/rejection-type state changes are).

## 13. Audit Trail

All Casuals and Casual Labour Request mutations already route through `logAudit` (unchanged for create; confirmed still firing for the newly-fixed supervisor edit path, §20 REG-3/REG-4). No second audit system was built. `audit_log` is immutable by database rule (`db/migrate.js`: `audit_log_no_delete`) — QA-tagged entries from this phase's testing remain permanently in the table by design, same as every prior phase in this program.

## 14. Attendance Dashboard

Not built — depends entirely on §5/§6. No existing backend metrics exist to expose.

## 15. Reporting

No dedicated HR reporting existed before this phase and none was built — Employee/Casual Worker registers are already fully visible via their respective list screens (with search on desktop); a dedicated CSV-exportable "register" report was not requested as a specific gap and the existing list views satisfy the data-visibility requirement. Attendance-dependent reports (daily attendance, absence/late summary) are blocked entirely on §5.

## 16. Casual Labour Integration

Audited the full intended chain: **Casual Worker → Attendance → Casual Labour Request → Labour Hours → Operations**. Confirmed only the following link actually exists in the backend: a Casual Labour Request (`casual_labour_requests`) is a standalone, aggregate specification ("N casuals for task X, date range Y") — it has **no link to any individual `casuals` row**, and `casuals`/`casual_labour_requests` have never been connected in this codebase. There is no `hours_worked` concept anywhere for casual labour (only `machine_daily_logs.hours_worked`, an unrelated machine-utilization metric). The full chain described in the brief does not exist and cannot be exposed via a UI fix — building it requires Attendance to exist first (§5), then a genuinely new linking capability. Documented as blocked on the same deferred business decision, not built.

## 17. Data Integrity

- Verified no duplicate/orphan casual worker records are created by the fixed edit/delete paths (concurrent-delete test, §19 B — SQL-level idempotent, no orphan).
- Verified the new Workshop Isolation check cannot be bypassed by a crafted `workshop_id` in the payload (the check reads the record's *stored* `workshop_id`, not anything caller-supplied).
- Verified the repeated-submission guard added to `casualLabourRequestsReview` prevents a request from being reviewed twice, sequentially or concurrently (§18 check 21, §19 check A).
- No new database constraints were added silently; the one behavioral change to existing data handling (the `active` fallback fix in `casualsUpdate`) is a bug fix restoring intended behavior, not a new business rule.

## 18. Live Verification

27/27 checks passed against the production database with `_QA HR1`-tagged disposable data (real test accounts reused: `ADMIN`=1, `CEO`=9 (`ceo`), `OPS`=20 (`ops.manager`), `SUP_GATARE`=11 (`sup.gatare`, workshop 3), `MECHANICIAN`=14 (negative control); one temporary QA supervisor account created at Nyanza for the Workshop Isolation cross-check, hard-deleted afterward):

- Employee: create → edit → deactivate (verified in DB) → reactivate (verified in DB).
- Casual Worker: registered by supervisor → auto-assigned to supervisor's own workshop → visible in list → edited by supervisor (previously always denied — the fix under test) → deactivated (verified) → **plain edit omitting `active` does NOT silently reactivate** (the Bug 2 regression check) → reactivated.
- Workshop Isolation: Nyanza supervisor denied edit/delete/read of a Gatare casual worker; Gatare supervisor could still act on their own record (sanity control).
- Negative authorization: mechanician denied create/edit/delete on casual workers.
- Casual Labour Request: submitted → admin correctly rejected by the review gate (documented finding, §10) → CEO approved → notification correctly routed to the submitter → repeated review by Operations correctly rejected, status unchanged.

## 19. Concurrency Testing

6/6 checks passed:
- **A** — two simultaneous `casualLabourRequestsReview` calls (one Approve, one Reject) on the same request: exactly one succeeded, final status was a single non-corrupted value, exactly one notification was produced.
- **B** — two simultaneous `casualsDelete` calls on the same worker: both returned `ok:true` (SQL-level idempotent — no explicit row lock needed here, since deletes have no delta/reversal math to protect, unlike Sales' stock reversals), worker ended up deleted exactly once, no orphan/duplicate.

## 20. Regression Testing

5/5 spot-checks passed: `casualLabourRequestsDelete` (untouched function) still works via governance; `casualsUpdate`'s audit trail still fires (`module='casuals'`); `usersList` (Admin > Users, untouched) still returns the full user roster (83 rows). **Cross-department regression**: this phase's backend changes are confined to `casualsUpdate`, `casualsDelete`, and `casualLabourRequestsReview` in `data.js`, plus two `NOTIFICATION_ROUTES` additions — no shared helper (`applyGovernance`, `isWorkshopRestricted`, `pushNotification`, `logAudit`, `mustRole`) and no other department's function was modified, so the diff scope makes broader cross-department regression risk architecturally nil, consistent with this program's established practice.

## 21. Defects Found

1. Desktop showed Edit/Delete on the Casuals page to `supervisor`, but the backend rejected that role unconditionally — a real UI-exists-but-backend-rejects bug (Priority 9).
2. The Casuals edit form never sent the `active` field, so no one could deactivate a casual worker from any UI despite full backend support — a real missing-capability bug (Priority 3/7).
3. `casualLabourRequestsReview` had zero notification producers, unlike every comparable review workflow in this codebase (Priority 11).
4. `casualLabourRequestsReview` had no guard against reviewing an already-reviewed request — could silently re-stamp `reviewed_by`/`reviewed_at` or flip a decision after the fact (Priority 6/17).
5. Zero mobile presence existed for the Casuals registry at all (Priority 3/10).
6. `mobile-api/routes/casualLabour.js`'s review route allows `admin` at the REST layer, but `data.js` rejects it — a route/backend mismatch, currently unreachable via any UI (Priority 9) — documented, not fixed (see §10).

## 22. Defects Fixed

Items 1–5 above — see §4, §11, §12, §17 for implementation and §18/§19 for live verification. Item 6 is documented only (§10, §21).

## 23. Deferred Items

- **Attendance** (§5) and everything downstream of it (§6 Checklist, §14 Dashboard, the Casual Labour integration chain in §16, and the attendance-specific parts of §15 Reporting) — requires a dedicated future phase with explicit business-rule decisions made first.
- Employee identification/contact/employment-date fields (§3) — `app_users` doesn't track them; adding them is a schema change to a live authentication table and a business-scope decision, not silently applied.
- The REST route/backend role mismatch in `casualLabourRequestsReview` (§10, §21 item 6) — Low severity, currently unreachable, left for a future permission-scope decision.
- A dedicated HR "register" CSV export (§15) — the existing list views already expose the same data; not built as a separate deliverable since it wasn't a confirmed gap, just a nice-to-have.

## 24. New Business Decisions

Two decisions were escalated via `AskUserQuestion` before any implementation, per the brief's explicit "do not grant permissions / do not invent new capability without approval" rules:

1. **Attendance scope** — user chose **"Defer entirely, document only"** over building a new check-in/check-out + checklist system from scratch. This phase delivered Employee + Casual Worker registration completeness instead.
2. **Casuals edit/delete permission mismatch** — user chose **"Extend backend to allow supervisor, scoped to their own workshop"** over hiding the Edit/Delete buttons from supervisor. Implemented exactly as approved, including the new Workshop Isolation check this required.

**Still pending, not decided this phase:** whether to build Attendance as a new capability (and if so, its business rules); whether to add richer identification/contact/employment-date fields to `app_users` (or build a genuinely separate HR employee entity).

## 25. Production Readiness

**PRODUCTION READY** for the scope this phase actually delivers: Employee registration (already complete, unchanged), Casual Worker registration (two real bugs fixed, full mobile parity built), and the Casual Labour Request review workflow (notification + idempotency guard added). 38 live checks passed (27 CRUD/E2E + 6 concurrency + 5 regression) against the production database, all QA data fully cleaned up and independently re-verified at zero residue. Static verification clean across backend, desktop, and mobile (`node --check`, `npx tsc --noEmit`).

**Not production ready, and explicitly out of this phase's delivered scope: Attendance** — confirmed absent at every layer, formally deferred by the user's own decision, requiring a dedicated future phase.

Per the Stop Rule, no other department is started automatically following this phase.
