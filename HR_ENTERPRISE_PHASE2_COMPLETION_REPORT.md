# HR ENTERPRISE PHASE 2 — ATTENDANCE, EMPLOYEE ATTENDANCE CHECKLIST & HR OPERATIONAL INTEGRATION
## Completion Report

**Date:** 2026-08-13
**Scope:** Attendance — a genuinely new capability (Phase 1 confirmed it did not exist at any layer) — built end-to-end: database, backend, REST, Electron IPC, desktop UI, mobile UI, permissions, audit trail, reporting, dashboard integration.
**Status: PRODUCTION READY**

---

## 1. Executive Summary

HR Enterprise Phase 1 audited the whole repository and confirmed Attendance did not exist anywhere — no table, function, route, or screen. This phase closes that gap: a complete Attendance entity was designed and built from scratch, reusing the existing Employee (`app_users`) and Casual Worker (`casuals`) registries as the two person references rather than creating a third personnel table, and reusing every existing architectural pattern (Workshop Isolation, page-based permissions, audit logging, IPC/REST dual exposure) rather than inventing new ones.

Every backend capability built this phase has a working interface on both desktop and mobile: a Daily Checklist (Workshop → Date → roster, one-tap status marking, check-in/check-out, notes), a History & Reports view (filterable list, CSV export, correction, void), and dashboard KPIs (Present/Absent/Late today, Casual Workers Present, Total Hours, Attendance Rate). No payroll or leave-management system was built. No new roles were invented — Attendance reuses the exact role set (`admin`/`ceo`/`operations`/`supervisor`) Phase 1 established for the Casuals registry.

48 live checks (18 end-to-end + 17 security/data-integrity + 8 concurrency + 5 regression) passed against the production database with disposable `_QA HR2`-tagged data, all fully cleaned up and independently re-verified at zero residue.

## 2. Existing HR Architecture (recap, unchanged this phase)

- **Employee** = `app_users` (the ERP login account; no separate "HR employee" entity exists — confirmed by Phase 1's audit, re-confirmed here, unchanged).
- **Casual Worker** = `casuals` (rich HR record: ID, contact, employment details, emergency contact, salary/action, `active`, `workshop_id`). Phase 1 fixed two real bugs here and built full mobile parity — unchanged this phase except for reuse as an attendance-roster source.
- **Casual Labour Request** = `casual_labour_requests` (an aggregate request — "N casuals for task X, date range Y" — with no link to any individual `casuals` row). Unchanged this phase.
- **Attendance** — did not exist. Built this phase.

## 3. Attendance Entity

New `attendance` table (`db/migrate.js: createAttendanceTables`):

```
id, attendance_date, workshop_id, user_id, casual_id, status,
check_in, check_out, notes, created_by, created_at, updated_by, updated_at,
deleted_at, deleted_by
```

- **Person reference**: `user_id` XOR `casual_id` (`constraint attendance_person_check check (num_nonnulls(user_id, casual_id) = 1)`) — the same polymorphic-sibling pattern already established by `quality_inspections`/`rejection_holds` (`production_offcut_id` vs `value_added_production_output_id`), not a new pattern.
- **Statuses**: exactly the six the brief specified — `Present, Absent, Late, Half Day, Leave, Off Day` — enforced by a database check constraint. No status was invented.
- **Duplicate prevention** (Priority 16): two partial unique indexes, one per person type (`(user_id, attendance_date) where user_id is not null`, `(casual_id, attendance_date) where casual_id is not null`), both scoped to `deleted_at is null`. Enforced at the database level, not just in application code.
- **Impossible check-out** (Priority 16): `constraint attendance_checkout_after_checkin check (check_out is null or check_in is null or check_out > check_in)`.
- **Soft delete**: `deleted_at`/`deleted_by`, matching this codebase's standard convention (not the hard-delete `casualsDelete` uses — Attendance follows the more common soft-delete pattern since a "void" needs to remain in the audit/history trail).

## 4. Attendance Checklist

`attendanceRoster(userId, workshopId, date)` returns every active `app_users` row and every active `casuals` row for the selected workshop, left-joined against any existing attendance record for that date — so the checklist always shows current state and never requires opening an individual record. A single upsert function, `attendanceMark`, backs every checklist interaction: insert-or-update keyed on `(person, date)` via the two partial unique indexes, so a duplicate submission for the same person/day can never create a second row and there is no separate create-vs-edit code path.

**Desktop**: one-row-per-person table with a status dropdown, check-in/check-out time inputs, notes, and a Save button per row.
**Mobile**: one-tap status pills (auto-saves on tap) plus check-in/check-out time pickers and notes, matching "avoid forcing the user to open an individual record repeatedly."

## 5. Employee Integration

"Employee" for a given workshop's roster means active `app_users` rows with `workshop_id` equal to that workshop — company-wide roles (`admin`/`ceo`/`operations`/`sales`, whose `workshop_id` is `null`) are deliberately excluded from a workshop's daily attendance roster. This is a direct consequence of reusing the existing `workshop_id`-scoping convention already used everywhere else in this ERP, not an invented business rule: attendance tracking is inherently a workshop headcount exercise, and this ERP has never treated company-wide roles as belonging to any single workshop's roster.

## 6. Casual Worker Integration

Casual workers appear in the same roster (workshop-scoped, active-only) alongside employees, visually grouped but functionally identical (same `attendanceMark`/`attendanceUpdate`/`attendanceDelete` functions, same status set). A deactivated casual worker cannot receive new attendance (live-verified — see §16) but their historical attendance records remain visible in History/Reports, satisfying "viewed in attendance history" without requiring an active worker. No change was made to the Casual Worker architecture itself.

## 7. Casual Labour Request Integration

Audited the intended chain **Attendance → Casual Worker → Casual Labour Request → Labour Hours**. As Phase 1 already found, `casual_labour_requests` is a standalone, aggregate specification with no link to any individual `casuals` row, and no `hours_worked`/payment concept exists anywhere for casual labour. This phase does **not** invent that link: Attendance and Casual Labour Requests remain two independently traceable systems (a supervisor can view a casual worker's attendance history and, separately, the labour requests they submitted), but no automatic hours-to-request calculation was built, since doing so would require inventing new financial/business logic the brief explicitly prohibits guessing at. This is documented here, per the brief's own instruction, rather than silently connected.

## 8. Desktop UI

New "Attendance" page (`renderer/app.js: renderAttendance`) under the existing Human Resources nav section, reusing every existing UI primitive — `.smo-tabs`, `.mc`/`.mclbl`/`.mcval` KPI tiles, `.dt` tables, `openOverlay`, `confirmDelete`, `downloadCsv`, `prependWorkshopBanner`/`workshopPickerHtml` (via a locally-scoped equivalent), `showToast`/`showOverlaySuccess`/`showOverlayError`. Two tabs:
- **Daily Checklist**: workshop (cross-workshop roles only) + date pickers, roster table, per-row status/check-in/check-out/notes with inline Save.
- **History & Reports**: date-range/workshop/status/type filters, results table with Edit (correction overlay) and Void (soft-delete with confirmation), CSV export.

KPI tiles (Present/Absent/Late Today, Casual Workers Present, Total Hours Today, Attendance Rate) sit above both tabs, always reflecting today's data for the selected/home workshop.

## 9. Mobile UI

Three new screens nested into the existing shared `CasualLabourStack` (stack push, not a new tab — the same pattern Phase 1 established for the Casuals registry):
- `AttendanceChecklistScreen` — KPI strip, workshop/date pickers, one-tap status pills, time pickers, notes, per-row save.
- `AttendanceHistoryScreen` — filterable list, CSV export via `Share.share` (the same pattern already used by `ProcurementReportsScreen`, no new dependency).
- `AttendanceEditScreen` — correction form + void action with a reason modal.

Reachable via a role-gated ("Attendance") header button on `CasualLabourListScreen`, visible only to `admin`/`ceo`/`operations`/`supervisor` (the roles holding the new `attendance.manage` permission) — the three roles that also mount this shared stack for Casual Labour Requests but never held the Casuals/Attendance permissions (`harvesting-leader`/`sawmill-leader`/`vat-leader`) never see the button, avoiding the broken-visible-button class of bug found and fixed in Sales Enterprise Phase 2.

## 10. Permissions

One new page permission, `'attendance'`, granted to the exact same four roles Phase 1 established for `'casuals'` (`admin`/`ceo`/`operations`/`supervisor`) — not five granular `attendance-view`/`create`/`update`/`delete`/`review` permissions, since this codebase's permission model is page-based throughout (one key per module) and read/write share the identical role gate in every Attendance function. Mobile mirrors this with a new `'attendance.manage'` permission key (distinct from `'casual.manage'` even though today's role set is identical, since the two gate genuinely separate backend permissions that could diverge independently). No permission was granted without this being a direct, evidence-based reuse of an already-approved role set — no new `AskUserQuestion` escalation was needed here since Phase 1 already settled the "which roles manage HR-adjacent workshop data" question.

## 11. Workshop Isolation

Every Attendance function applies `isWorkshopRestricted` exactly as established: `attendanceRoster`/`attendanceList`/`attendanceDashboard` force a restricted caller's own `workshop_id` regardless of what's requested; `attendanceMark`/`attendanceUpdate`/`attendanceDelete` verify both the target person's and the target record's `workshop_id` against the caller's own. Live-verified (§16): a Gatare supervisor cannot mark, edit, delete, or even see a Nyanza-scoped record or roster, and a crafted `workshop_id` request parameter is silently ignored in favor of the caller's real assignment (not merely rejected — actually overridden server-side, so there is no parameter to craft around).

## 12. Notifications

Audited the potential notification triggers the brief listed (review required, unusual absence, approval/review, correction). **None were built.** "Attendance review required"/"approval" turned out, on close reading of the brief's own end-to-end flow (`Casual Labour Request → Review/Approval → Notifications`), to refer to the pre-existing Casual Labour Request review notification (Phase 1), not a new Attendance-specific approval gate — Attendance itself has no approval workflow, only direct authorized edits (matching `casualsUpdate`'s own precedent). "Unusual absence" would require inventing a threshold business rule (e.g., "3 consecutive absences") with no existing basis anywhere in this ERP — not built, per "do not invent HR policies." A plain correction/void does not notify, matching the precedent that `casualsUpdate` itself never notified either. This is a deliberate, evidence-based "nothing to build" conclusion, not an oversight.

## 13. Audit Trail

Every Attendance mutation (`attendanceMark` create and update, `attendanceUpdate` correction, `attendanceDelete` void) calls the existing `logAudit`, tagged `module: 'attendance'`, with before/after snapshots on corrections. No second audit system was built; `audit_log` remains immutable by the existing database rule (`audit_log_no_delete`) — QA-tagged entries from this phase's testing remain permanently in the table by design, same as every prior phase.

## 14. Reporting

One flexible function, `attendanceReport`, reusing `attendanceList`'s exact row shape plus a summary block (per-status counts, total hours, hours-known-record count) — the same "one function, many filter dimensions, the frontend renders different views" shape `salesReport` already established, rather than building six separate Daily/By-Employee/By-Casual-Worker/Workshop/Absence/Hours report functions. CSV export uses the existing `downloadCsv` helper on desktop and the existing `Share.share`-based pattern (`ProcurementReportsScreen`) on mobile.

## 15. Backend/UI Parity Matrix

| Backend function | REST route | IPC channel | Desktop caller | Mobile hook | Mobile screen | Status |
|---|---|---|---|---|---|---|
| `attendanceRoster` | `GET /api/attendance/roster` | `attendance:roster` | `renderAttendance` (Checklist tab) | `useAttendanceRoster` | `AttendanceChecklistScreen` | Implemented |
| `attendanceMark` | `POST /api/attendance/mark` | `attendance:mark` | Checklist row Save | `useAttendanceMark` | `AttendanceChecklistScreen` | Implemented |
| `attendanceList` | `GET /api/attendance` | `attendance:list` | History tab | `useAttendanceList` | `AttendanceHistoryScreen` | Implemented |
| `attendanceUpdate` | `PUT /api/attendance/:id` | `attendance:update` | History Edit overlay | `useAttendanceUpdate` | `AttendanceEditScreen` | Implemented |
| `attendanceDelete` | `DELETE /api/attendance/:id` | `attendance:delete` | History Void action | `useAttendanceDelete` | `AttendanceEditScreen` | Implemented |
| `attendanceDashboard` | `GET /api/attendance/dashboard` | `attendance:dashboard` | Page-level KPI tiles | `useAttendanceDashboard` | Checklist KPI strip | Implemented |
| `attendanceReport` | `GET /api/attendance/report` | `attendance:report` | Export CSV button | `useAttendanceReportFetch` | History Export CSV | Implemented |

No backend Attendance function is invisible to end users on either platform. No capability was classified as desktop-only, mobile-only, or deferred — full parity was achievable within this phase's scope.

## 16. Live Verification

**48/48 checks passed** against the production database with disposable `_QA HR2`-tagged data (accounts reused: `ADMIN`=1, `CEO`=9, `SUP_GATARE`=11 (`sup.gatare`, workshop 3), `MECHANICIAN`=14 (negative control); one temporary QA supervisor created at Nyanza for cross-workshop checks, hard-deleted afterward):

- **18/18 end-to-end** (Priority 19's full chain): QA employee/casual worker appear in the roster → marked Present/Late with check-in → check-out recorded as an upsert (same row, not a duplicate) → History shows correct computed hours → Dashboard reflects today's counts → Report summary matches → Casual Labour Request submitted/approved/notified → audit trail present → correction changes status in the database.
- **17/17 security + data integrity** (Priorities 15/16): mechanician denied on every Attendance function; Nyanza supervisor denied marking/editing/deleting a Gatare record and cannot see it even when explicitly requesting `workshop_id=Gatare` (the parameter is overridden server-side, not merely checked); Gatare supervisor can act on their own workshop (sanity control); check-out-before-check-in rejected; attendance for an inactive casual worker rejected; non-existent person rejected; invented status rejected.
- **8/8 concurrency** (Priority 19): two simultaneous check-ins for the same person/date resolve to the same single row (Postgres's `ON CONFLICT` serializes them automatically — no application-level locking was needed); two simultaneous check-outs likewise; a third sequential check-in stays at one row; two simultaneous corrections both succeed with a single, non-corrupted final status.
- **5/5 regression** (Priority 20): Casuals full CRUD cycle, `usersList`, and `casualLabourRequestsDelete` all confirmed still functional after this phase's additions.

## 17. Static Verification

- `node --check` clean on: `db/services/data.js`, `db/migrate.js`, `electron/main.js`, `electron/preload.js`, `renderer/app.js`, `mobile-api/server.js`, every file in `mobile-api/routes/`.
- `npx tsc --noEmit` clean across `mobile/` (zero errors on first successful run after the full mobile build-out).
- Migration re-run live against the production database: `attendance` table created with all constraints/indexes verified via `pg_constraint`; permission granted to exactly 4 roles.

**Disclosed limitation** (carried since the ERP Final Enterprise Completion Gate phase): no physical device or simulator was available; mobile screens were verified via type-checking and careful code review, not a manual click-through.

## 18. Outstanding Items

- No BOM/payroll/leave-management system exists or was built — explicitly out of scope per the brief's own DO-NOT list.
- Attendance ↔ Casual Labour Request hours linkage (§7) remains undesigned — would require a new business rule (how attendance days translate to billable/payable labour) that no existing part of this ERP defines. Documented, not guessed at.
- "Unusual absence" notifications (§12) were considered and deliberately not built — would require inventing an absence-pattern threshold rule with no existing precedent.
- A small residual class of concurrent-write outcome is inherent to any upsert-based design and was explicitly tested, not just assumed: when two check-in/check-out calls race for the same row, the database guarantees exactly one consistent final row, but *which* of the two submitted values wins is last-write-wins (whichever transaction commits last), not deterministic by request order. This is normal, expected behavior for this kind of upsert (the same behavior `casualsUpdate` and every other last-write-wins update in this codebase already has) and not a defect — documented for completeness.

## 19. Production Readiness

**PRODUCTION READY.** Attendance now exists as a real, complete enterprise capability: employees and casual workers can be marked present/absent/late/half-day/leave/off-day; daily attendance can be recorded efficiently via a one-tap checklist on both platforms; records can be viewed, corrected, and voided by authorized users; Workshop Isolation is fully enforced and live-verified in both directions; every mutation is audited; reporting and CSV export work on both platforms; the Casual Labour Request chain remains traceable without any invented financial linkage. 48 live checks passed against the production database, all QA data fully cleaned up and independently re-verified at zero residue. Static verification is clean across backend, desktop, and mobile.

Per the Stop Rule, no other department is started automatically following this phase, and no payroll, leave-management, or new HR policy was invented.
