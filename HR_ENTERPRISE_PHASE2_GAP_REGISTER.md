# HR Enterprise Phase 2 — Gap Register

## Built this phase (was a confirmed, total gap per Phase 1's audit)

| # | Capability | Status |
|---|---|---|
| 1 | Attendance entity (database, constraints, indexes) | Built |
| 2 | Attendance backend functions (roster, mark/upsert, list, update, delete, dashboard, report) | Built |
| 3 | Attendance REST API | Built |
| 4 | Attendance Electron IPC | Built |
| 5 | Attendance desktop UI (Daily Checklist + History & Reports, both tabs) | Built |
| 6 | Attendance mobile UI (Checklist, History, Edit/Void) | Built |
| 7 | Attendance permissions (page-based, reusing the Casuals role set) | Built |
| 8 | Attendance Workshop Isolation | Built, live-verified both directions |
| 9 | Attendance audit trail | Built (reuses existing `logAudit`) |
| 10 | Attendance reporting + CSV export (both platforms) | Built |
| 11 | Attendance dashboard KPIs | Built |

## Deliberately not built, with reasoning

| # | Item | Why |
|---|---|---|
| D1 | Attendance-driven notifications ("review required," "unusual absence," "approval") | The brief's own end-to-end flow places "Review/Approval" after "Casual Labour Request," not after Attendance — re-reading confirmed this refers to the pre-existing Casual Labour Request review notification (Phase 1), not a new Attendance approval gate. "Unusual absence" would require inventing an absence-pattern threshold with no existing precedent anywhere in this ERP. Plain corrections don't notify, matching `casualsUpdate`'s own precedent. |
| D2 | Attendance → Casual Labour Request hours/days-worked linkage | `casual_labour_requests` has no link to individual `casuals` rows and no hours/payment concept exists anywhere for casual labour (confirmed in Phase 1's audit, re-confirmed this phase). Building this link would mean inventing new financial/business logic the brief explicitly prohibits guessing at. Traceability exists (attendance history is viewable per worker; labour requests are separately viewable) without an invented calculation. |
| D3 | A dedicated Attendance approval/governance gate (`applyGovernance`) | No evidence in the brief or existing system that corrections need pre-approval rather than a direct authorized edit — Attendance follows `casualsUpdate`'s exact precedent (direct edit, fully audited, no approval queue). Revisit only if a future business decision requires it. |
| D4 | Payroll / leave management | Explicitly prohibited by the brief's Stop Rule. |

## New business decisions

**None required this phase.** Every design decision (role set reuse, status list, roster-scoping-by-workshop, upsert-based duplicate prevention, soft-delete convention, no-notification/no-governance-gate for Attendance itself) was resolvable by direct, evidence-based reuse of patterns Phase 1 (or the wider program) already established and, where relevant, already had explicit user approval for (the Casuals role-set widening). No `AskUserQuestion` escalation was needed.

**Still pending from Phase 1, unaffected by this phase:**
- Whether `app_users` should track richer employee identification/contact/employment-date fields, or whether a genuinely separate HR employee entity should be built.
- The `mobile-api/routes/casualLabour.js` review-route/backend role mismatch (admin allowed by the route, rejected by the function) — Low severity, still unreachable via any UI, still undecided.
