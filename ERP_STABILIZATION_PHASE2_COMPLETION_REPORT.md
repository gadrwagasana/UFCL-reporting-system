# ERP Stabilization Program — Phase 2: `req.user.id` Mobile-API Defect Resolution
### Completion Report

**Scope:** the single #1-priority item flagged at the end of [Phase 1](ERP_STABILIZATION_PHASE1_COMPLETION_REPORT.md) — `req.user.id` (always `undefined`) used instead of `req.user.userId` in `admin.js`, `automation.js`, `compartments.js`, `epm.js`, `reports.js`, causing every route in those 5 files to fail and hang for every role. No new features, no schema changes, no business-logic changes.

---

## 1. Root Cause

`mobile-api/middleware/auth.js` decodes the JWT and attaches it verbatim: `req.user = { userId, role, workshopId, iat, exp }` — there is no `.id` field (confirmed by the function's own docstring). Five route files referenced `req.user.id` everywhere instead of `req.user.userId`. Since `getUser(undefined)` throws `"User not found"`, and none of these routes wrap their `await` in a `try/catch`, the throw became an unhandled promise rejection — Express never sent a response, so every request to any route in these 5 files hung until client timeout, for every role, always.

## 2. Fix

Mechanical, unambiguous find-and-replace of `req.user.id` → `req.user.userId` in all 5 files. Confirmed beforehand that none of the 5 files had any correct `req.user.userId` usage already present (i.e., not a partial bug — every single usage in each file was broken), so a plain replace-all was safe and complete.

| File | Occurrences fixed |
|---|---|
| `mobile-api/routes/admin.js` | 15 |
| `mobile-api/routes/automation.js` | 8 |
| `mobile-api/routes/compartments.js` | 6 |
| `mobile-api/routes/epm.js` | 3 |
| `mobile-api/routes/reports.js` | 9 |

Full-repo sweep after the fix (`grep -rn "req\.user\.id\b" mobile-api/`) returns zero remaining matches.

## 3. Live Testing

Local `mobile-api` instance against the real environment (`PGHOST=192.168.1.5` — no sandbox exists), one throwaway `admin`-role account (`_stabtest_admin2`, broadest single-account coverage since admin holds effectively every permission these 5 files check), soft-deleted/deactivated afterward (hard-delete is blocked by the same immutable-`audit_log` design documented in Phase 1).

| Endpoint | Before | After |
|---|---|---|
| `GET /api/admin/secgov`, `/audit`, `/users`, `/roles`, `/trash`, `/changes` | hang | **200** (all 6) |
| `GET /api/automation/dashboard`, `/rules`, `/escalations` | hang | **200** (all 3) |
| `GET /api/epm/dashboard`, `/departments`, `/trends` | hang | **200** (all 3) |
| `GET /api/compartments` | hang | **200** |
| `POST /api/compartments` (empty body) | hang | **400** (reached business-rule validation, not a hang) |
| `GET /api/reports/weekly-cost`, `/executive` | hang | **200** |
| `GET /api/reports/bi` | hang | **500** — see §4, a distinct pre-existing bug this fix exposed, not introduced by it |

## 4. New Finding — Documented, Not Fixed

`GET /api/reports/bi` no longer hangs, but now surfaces a **different, pre-existing bug** that this fix exposed (it was previously unreachable because `req.user.id` blocked the entire file): `db/services/data.js`'s `_biPredictStockRunout()` (line 8287) runs a SQL query with `NULLIF(COALESCE(c.avg_daily_out, 0), 1e-9)` intended to avoid dividing by zero when a stock item has no recorded consumption. `NULLIF(x, 1e-9)` only returns `NULL` when `x` is exactly `1e-9` — when `avg_daily_out` is genuinely `0` (the actual case this needs to guard against), the expression evaluates to `0`, not `1e-9`, so `total_qty / 0` throws Postgres error `22012 division_by_zero`. The apparent intent (floor the divisor at a small epsilon) was never achieved; it likely should be `GREATEST(COALESCE(c.avg_daily_out, 0), 1e-9)` or an explicit `CASE`.

**Not fixed this phase**: it lives in `db/services/data.js` (business logic, explicitly out of scope for a route-layer stabilization fix), it's unrelated to the `req.user.id` bug, and — critically — it does not block this phase's objective, since the `req.user.id` fix itself is already fully verified working on `reports.js`'s other routes. Flagged as the next item for a future phase; low urgency relative to Phase 1's findings since the BI Stock Runout Prediction widget was already completely unreachable via mobile before today (this fix didn't make it "more broken," it just changed the failure mode from a silent hang to a clean 500).

## 5. Regression / Static Verification

- `node --check` clean on all 5 files.
- No other file touched — `db/services/data.js`, schema, permissions, and every other route file are untouched.
- Live spot-check confirmed `POST /api/compartments` now reaches real business-rule validation (400 for an invalid payload) rather than hanging — the same signal used in Phase 1 to confirm a route-gate fix reaches the service layer correctly.

## 6. Outstanding for Future Phases

1. `db/services/data.js`'s `_biPredictStockRunout()` division-by-zero (§4).
2. Same root-cause pattern as Phase 1's finding: no `try/catch` around `await` in these route handlers, and no global unhandled-rejection-to-500 middleware in `mobile-api`. Both this bug and the Phase 1 Sales bug manifested as an indefinite hang instead of a clean error response for exactly this reason. Still recommended as a standing item: a request-scoped async-error wrapper would make the next silent defect fail loudly instead of hanging.
3. Everything else already carried over from Phase 1 §8 (pre-existing route-array permission drift) remains open and unaffected by this phase.
