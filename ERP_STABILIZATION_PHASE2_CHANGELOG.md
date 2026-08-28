# ERP Stabilization Program — Phase 2 — Changelog

## Fixed

- **[Critical] Five mobile-api route files completely non-functional for every role** — `req.user.id` (always `undefined`; the JWT payload's field is `req.user.userId`) caused every route to throw inside `getUser()` and hang indefinitely (no response ever sent). Fixed by correcting the field name everywhere it appeared in:
  - `mobile-api/routes/admin.js` (Security & Governance, Audit Trail, Users, Roles, Trash, Changes)
  - `mobile-api/routes/automation.js` (Automation dashboard, rules, escalations)
  - `mobile-api/routes/compartments.js` (Compartments CRUD)
  - `mobile-api/routes/epm.js` (Executive Performance Management dashboard, scorecards, trends)
  - `mobile-api/routes/reports.js` (Weekly Cost, Weekly Performance, KPI, Executive Dashboard, Business Intelligence, Monthly)

## Verified

- Live REST testing (throwaway account, cleaned up afterward) confirmed all 5 files now respond correctly instead of hanging — 16 of 17 tested endpoints returned 200/400 as expected.

## Documented, not fixed (out of this phase's scope)

- `GET /api/reports/bi` now fails with a clean 500 instead of hanging — a pre-existing, unrelated division-by-zero bug in `db/services/data.js`'s `_biPredictStockRunout()` (a `NULLIF(x, 1e-9)` guard that doesn't actually catch `x = 0`), previously unreachable via mobile because of the bug fixed here. Not fixed — lives in business logic, out of scope for a route-layer fix, doesn't block this phase's objective.
- No `try/catch`/global error-handling gap in `mobile-api` route handlers — the shared root cause behind this bug, Phase 1's Sales bug, and now the BI bug above. Still recommended for a future phase.
