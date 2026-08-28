# HR Enterprise Phase 2 — Changelog

## Database (`db/migrate.js`)

- **New**: `createAttendanceTables()` — creates the `attendance` table (person reference: `user_id` XOR `casual_id`, `num_nonnulls(...)=1` constraint; status check constraint limited to the 6 brief-specified values; check-out-after-check-in constraint; soft-delete columns) plus two partial unique indexes (`(user_id, attendance_date)`, `(casual_id, attendance_date)`, both `where deleted_at is null`) that enforce one-record-per-person-per-day at the database level, plus supporting indexes on `(workshop_id, attendance_date)` and `(attendance_date)`.
- **New**: `grantAttendancePermission()` — grants the new `'attendance'` page permission to `admin`/`ceo`/`operations`/`supervisor` (the exact role set Phase 1 established for `'casuals'`), idempotent (checks `role_definitions.permissions` before granting).
- Both called at the end of `migrate()`. Migration re-run live; verified via `pg_constraint`/`information_schema.columns`.

## Backend (`db/services/data.js`)

- `ROLE_PAGES` — added `'attendance'` to `admin`, `ceo`, `operations`, `supervisor` (matching `'casuals'` placement exactly).
- **New functions**: `attendanceRoster`, `attendanceMark`, `attendanceList`, `attendanceUpdate`, `attendanceDelete`, `attendanceDashboard`, `attendanceReport`, plus the shared `_canAccessAttendance`/`ATTENDANCE_ROLES`/`ATTENDANCE_STATUSES` helpers. See the Completion Report §3–§4/§14 for behavior detail. All exported via `module.exports`.

## Desktop (`electron/`, `renderer/`)

- `electron/main.js` — 7 new `secureHandle` IPC registrations: `attendance:roster`, `attendance:mark`, `attendance:list`, `attendance:update`, `attendance:delete`, `attendance:dashboard`, `attendance:report`.
- `electron/preload.js` — matching `UFCL.attendanceX` bridge functions.
- `renderer/index.html` — added `<div class="page" id="page-attendance">`.
- `renderer/app.js`:
  - `NAV` — added `{ id: 'attendance', ... sec: 'Human Resources' }`.
  - Role-permission checklist editor — added `chk('attendance')` alongside the existing Labour group entries.
  - Routing switch — added `case 'attendance': return renderAttendance();`.
  - **New**: `renderAttendance()` and its helpers (`_attLoadKpis`, `_attRenderChecklist`/`_attLoadChecklist`, `_attRenderHistory`/`_attLoadHistory`, `_attExportCsv`) — a two-tab page (Daily Checklist / History & Reports) reusing existing UI primitives throughout (`.smo-tabs`, `.mc` KPI tiles, `.dt` tables, `openOverlay`, `confirmDelete`, `downloadCsv`, `showToast`).

## REST (`mobile-api/`)

- **New**: `mobile-api/routes/attendance.js` — `GET /api/attendance/roster`, `POST /api/attendance/mark`, `GET /api/attendance`, `GET /api/attendance/dashboard`, `GET /api/attendance/report`, `PUT /api/attendance/:id`, `DELETE /api/attendance/:id`, all gated to `admin`/`ceo`/`operations`/`supervisor`.
- `mobile-api/server.js` — registered `app.use('/api/attendance', require('./routes/attendance'))`.

## Mobile (`mobile/`)

- `src/api/endpoints.ts` — added `ATTENDANCE_ROSTER`/`ATTENDANCE_MARK`/`ATTENDANCE_LIST`/`ATTENDANCE_DASHBOARD`/`ATTENDANCE_REPORT`/`ATTENDANCE_UPDATE`/`ATTENDANCE_DELETE`.
- `src/types/api.ts` — added `AttendancePersonType`, `AttendanceStatus`, `AttendanceRosterRow`, `AttendanceRosterResponse`, `AttendanceRecord`, `AttendanceListResponse`, `AttendanceDashboardResponse`, `AttendanceReportResponse`.
- **New**: `src/hooks/useAttendance.ts` — `useAttendanceRoster`, `useAttendanceMark`, `useAttendanceList`, `useAttendanceDashboard`, `useAttendanceReportFetch`, `useAttendanceUpdate`, `useAttendanceDelete`.
- **New**: `src/screens/attendance/AttendanceChecklistScreen.tsx` — KPI strip, workshop/date pickers, one-tap status pills per roster row, check-in/check-out time pickers, notes, inline save.
- **New**: `src/screens/attendance/AttendanceHistoryScreen.tsx` — filterable list (date range, workshop, status, type), CSV export via `Share.share` (same pattern as `ProcurementReportsScreen`).
- **New**: `src/screens/attendance/AttendanceEditScreen.tsx` — correction form (status/check-in/check-out/notes) + void action with a `ReasonModal`.
- `src/navigation/types.ts` — `CasualLabourStackParamList` gained `AttendanceChecklist`/`AttendanceHistory`/`AttendanceEdit` (stack push into the existing shared stack, not a new tab).
- `src/navigation/CasualLabourStack.tsx` — registered the three new screens.
- `src/screens/labour/CasualLabourListScreen.tsx` — added a role-gated ("Attendance") header action, visible only when `can('attendance.manage')`.
- `src/utils/permissions.ts` — added a new `'attendance.manage'` permission key, granted to `admin`/`ceo`/`operations`/`supervisor` (distinct from `'casual.manage'` despite the identical current role set — the two gate separate backend permissions).

## Verification artefacts

Temporary QA scripts (`_qa_hr2_*.js`) were used for live verification against the production database and deleted after use; see the Completion Report §16 for results.
