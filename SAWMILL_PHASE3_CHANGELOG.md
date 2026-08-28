# Sawmill Phase 3 — Changelog

## Database

**`db/migrate.js`**
- Added `grantSawmillDashboardPermission()`: grants the new `sawmill-dashboard` page to every role that already holds `daily-timber` (read live from `role_definitions`, not hardcoded) — admin, ceo, operations, sawmill-leader, sawmill-supervisor, supervisor.

## Backend (`db/services/data.js`)

- `dailyList(userId, workshopId, filters)` — extended with optional `date_from`, `date_to`, `search` (accent-insensitive, matches supervisor/operators/machine), `limit` (max 500), `offset`; returns `totalCount`/`limit`/`offset`. Fully backward-compatible — every existing 2-argument call site keeps its prior "latest 200" behavior.
- New `sawmillManagerDashboard(userId, workshopId)` — Today/Week/Month production, Recovery %, Waste %, Raw/Finished Timber Available, 28-day production trend, 12-week trend (reuses `_biPredictWorkshopProduction`), production-by-product, production-by-dimension, and 3 operational alerts (low raw material, production delay, unusual variance — reusing the `_biZscore` helper and the `_biPredictStockRunout` "days remaining" pattern). Exported for IPC/mobile-api use.

## Desktop (`renderer/app.js`, `renderer/index.html`)

- `dailyList`/`renderPageDailyTimber`/`renderDailyTimber` — added a persistent filter-state object, a filter bar (date range + search) on the standalone Daily Timber page, and Newer/Older pagination controls with a "Showing X–Y of Z" indicator.
- New `renderSawmillDashboard()` — the Sawmill Dashboard page: alerts, KPI cards, 28-day chart, 12-week trend chart, production-by-product/dimension tables, CSV export.
- New nav entry `sawmill-dashboard` (Operations section) + new `page-sawmill-dashboard` container + new `showPage` case + new permission checkbox in the role editor.

## Electron IPC (`electron/main.js`, `electron/preload.js`)

- `daily:list` handler/preload extended to pass through the new `filters` argument.
- New `sawmill:dashboard` handler/preload (`UFCL.sawmillDashboard`).

## Mobile API (`mobile-api/routes/sawmill.js`)

- `GET /api/sawmill` — now accepts `date_from`, `date_to`, `search`, `limit`, `offset` query params, passed through to `dailyList`.
- New `GET /api/sawmill/dashboard` route.

## Mobile

- `mobile/src/api/endpoints.ts` — `SAWMILL_DASHBOARD`.
- `mobile/src/types/api.ts` — `DailyListResponse` gains pagination fields; new `SawmillDashboardResponse` and related types.
- `mobile/src/hooks/useSawmill.ts` — `useSawmillList` accepts optional filters (backward-compatible); new `useSawmillDashboard`.
- `mobile/src/navigation/types.ts` / `SawmillStack.tsx` — new `SawmillDashboard` stack screen.
- New `mobile/src/screens/sawmill/SawmillDashboardScreen.tsx` — built from the existing shared `KpiCard`/`AlertBanner` components, no new UI primitives.
- `mobile/src/screens/sawmill/SawmillProductionListScreen.tsx` — added `ListSearchBar` (existing shared component) and a header link to the new dashboard; empty state now distinguishes "no matches for search" from "genuinely empty."

## Bug fixes (found during this phase's own live verification)

- `sawmillManagerDashboard`'s `byDimension` result returned `width_mm`/`thickness_mm` as numeric-typed strings (`"100.00"`) instead of numbers, which would have rendered as `100.00×200.00×4m` instead of `100×200×4m` on both platforms. Fixed by wrapping in `Number(...)`.

## Verification

- `node --check` clean on all touched backend/desktop/electron files; `tsc --noEmit` clean on mobile.
- Live end-to-end verification: search/filter/pagination on `dailyList`, dashboard figures (units, logs, recovery %, byProduct, byDimension), alert lifecycle (fires when stale, clears when fresh data exists, correctly reappears after cleanup), and audit logging — all confirmed against production data with throwaway QA data, then fully removed. `stock_levels` confirmed back at exact pre-test baseline.

## Not changed

No Sales workflow expansion. No Finance redesign. No new inventory or costing system. No Planned/Actual/Completed/Cancelled production status workflow (schema-audit-confirmed absent; documented as a future-phase candidate, not built here — building it now would be a production-workflow redesign the brief explicitly prohibits). No fabricated timber quality/grade/drying data (schema-audit-confirmed absent; documented only, per the brief's explicit instruction).
