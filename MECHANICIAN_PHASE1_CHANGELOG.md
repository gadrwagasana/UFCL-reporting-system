# Mechanician — Phase 1 Changelog

Operational Recovery, Permission Alignment & Workflow Restoration. See `MECHANICIAN_PHASE1_COMPLETION_REPORT.md` for full detail, reasoning, and testing evidence.

## Backend

- `db/services/data.js`
  - `materialRequestsList` / `materialRequestsCreate` — gate changed from `mustRole(user,'stock-movements')` to `mustRole(user,'material-requests') || mustRole(user,'stock-movements')`. Restores the workflow for `mechanician`, `supervisor`, `sawmill-leader`, `poles-leader`, `vat-leader` — the exact roles seeded with `material-requests` but not `stock-movements`. No existing role loses access (every current `stock-movements` holder already holds `material-requests` too).
  - `materialRequestsApprove` — now also accepts `supervisor` (checked via `user.role === 'supervisor' && mustRole(user,'material-requests')`), gated to the requesting workshop only via a new same-workshop check moved into this function (previously only enforced in the mobile REST layer). `mechanician`/`sawmill-leader`/`poles-leader`/`vat-leader` remain unable to approve — unchanged, deliberately.
  - New `mechanicianDashboard(userId)` — My Requests KPIs (total/pending/approved/rejected, with completed+partial folded into "approved"), Recent Requests widget, Machines Requiring Attention, Upcoming Maintenance. Workshop-scoped, gated on `material-requests`. Exported.

## Electron

- `electron/main.js`, `electron/preload.js` — `mechanician:dashboard` IPC channel + `mechanicianDashboard` preload method.

## Mobile API

- `mobile-api/routes/materialRequests.js` — doc comments corrected to match the new gates; Gap C comment updated to note `data.js` now enforces the same workshop check the route already had (defense-in-depth, route guard kept as-is).
- `mobile-api/routes/dashboard.js` — new `GET /api/dashboard/mechanician` route.

## Desktop (`renderer/app.js`)

- New `renderMechanicianDashboard()` — KPI cards + 3 widgets (Recent Requests, Machines Requiring Attention, Upcoming Maintenance), reusing the existing `_lgdWidget`/`.cards`/`.mc` components.
- `renderDashboard()` — now branches to `renderMechanicianDashboard()` for `role==='mechanician'` instead of the generic, ungated company dashboard.
- No changes were needed to `renderMaterialRequests()` — already enterprise-grade; the permission fix alone makes it reachable for mechanician.

## Mobile

- `mobile/src/screens/shared/MyRequestsScreen.tsx` — combined error flag split into `allFailed` (full-screen error, AND semantics — unchanged) and a new `someFailed` (non-blocking inline banner, OR semantics) so partial denials no longer masquerade as an empty inbox.
- `mobile/src/navigation/types.ts` — `MechanicianTabParamList` reduced from 3 dead-end tabs (`MachineLogList`, `MachineFuelList`, `MyRequests`) to 2 working ones (`MechanicianDashboard`, `MaterialRequest`).
- `mobile/src/navigation/MechanicianNavigator.tsx` — rewired to `MechanicianDashboardScreen` + the existing `MaterialRequestsStack` (same one `supervisor` uses).
- New `mobile/src/screens/mechanician/MechanicianDashboardScreen.tsx` — mirrors the desktop dashboard's content using the established `MiniKpi`/`OpsWidget` component pattern.
- `mobile/src/hooks/useMaterialRequests.ts` — new `useMechanicianDashboard()` hook.
- `mobile/src/types/api.ts` — new `MechanicianDashboardResponse`/`MechanicianDashboardWidgetItem` types.
- `mobile/src/api/endpoints.ts` — new `DASHBOARD_MECHANICIAN` endpoint constant.
- `mobile/src/utils/permissions.ts` — `mechanician`'s client-side permission flags changed from `['machine.log','fuel.machine','admin.changes']` (both dead — no matching backend grant) to `['material.request','admin.changes']` (now genuinely functional).

## Verification

- `node --check`: clean on `db/services/data.js`, `electron/main.js`, `electron/preload.js`, `mobile-api/routes/materialRequests.js`, `mobile-api/routes/dashboard.js`, `renderer/app.js`.
- `npx tsc --noEmit` (mobile): clean.
- Live end-to-end test (5 throwaway QA accounts + 1 throwaway stock item, all deactivated after): full lifecycle (create → approve → dispatch → receive → complete → notify → dashboard) confirmed working for mechanician; cross-workshop approval correctly denied; mechanician approval attempt correctly denied; fix confirmed to generalize to `sawmill-leader`; pre-existing `storekeeper` access confirmed unaffected.

## Outstanding (not fixed this phase — see report §9)

- Mobile Notifications has no screen for any non-CEO role — pre-existing, systemic, not mechanician-specific.
- Whether to grant mechanician `machine-logs`/`machine-fuel`/`machines` (machine-side responsibilities) is an open business decision, not resolved by this phase.
- A genuine Mechanician Officer/Assistant tier split remains a future decision.
- The unrelated `getCeoOverview`/`monthly_approvals` crash (Fleet & Equipment audit finding) remains untouched.

## Not committed

Per standing release discipline, none of the above has been committed or pushed.
