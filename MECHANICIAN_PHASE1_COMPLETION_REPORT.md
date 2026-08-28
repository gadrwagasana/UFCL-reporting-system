# Mechanician — Phase 1 Completion Report

Operational Recovery, Permission Alignment & Workflow Restoration. Implements exactly the findings in `MECHANICIAN_ROLE_PERMISSION_AUDIT.md` — no department redesign, no new tables, no schema changes, no new approval flows. The Logistics Department structure, Workshop Isolation, and every existing architecture layer (Electron→IPC→data.js→PostgreSQL, mobile REST, governance/audit/notification frameworks) are all unchanged.

## 1. Executive Summary

The mechanician role can now do the one thing it was seeded to do: request materials, and track that request through approval, transfer, dispatch, receipt, and completion — entirely inside the ERP, on both desktop and mobile. The root cause (a permission-key mismatch between the role's granted `material-requests` permission and the `stock-movements` key the backend actually checked) is fixed at the source, in the one shared function both platforms call, so the correction applies identically everywhere rather than needing separate desktop/mobile patches. The same fix restores the identical, independently-broken capability for `supervisor`, `sawmill-leader`, `poles-leader`, and `vat-leader` — confirmed via the audit as the same bug, not four separate ones.

A second, real bug was also fixed along the way: `supervisor`'s ability to approve material requests within their own workshop was clearly *intended* (desktop's approve-button role list already included `supervisor`; a dormant `supervisorWorkshopGuard` already existed in the mobile REST layer) but was silently broken by the same root-cause gate. It's now genuinely wired up, with the workshop-ownership check moved into the shared backend function so desktop gets the same protection mobile always had. No other role gained approval rights — that distinction was preserved deliberately, per the audit's explicit warning not to broaden permissions beyond intent.

Mechanician's mobile navigator no longer has two structurally dead tabs (Machine Logs, Machine Fuel) whose "+Add" buttons always failed on submit — they're replaced with the same mature Material Requests screen `supervisor` already uses, plus a new tailored dashboard (desktop and mobile) showing the role's own requests, their status, and workshop maintenance signals, built entirely from existing tables. The `MyRequestsScreen` bug that hid failed data behind a fake "empty inbox" is fixed for every role that screen serves, not just mechanician.

Everything was live-verified end-to-end against real production data via throwaway QA accounts, walking the full chain (create → approve → dispatch → receive → completion → notifications → dashboard), and all test data has been removed.

## 2. Permission Corrections

**Root cause** (`MECHANICIAN_ROLE_PERMISSION_AUDIT.md` Critical Issue 1): `materialRequestsList`/`Create`/`Approve` (`db/services/data.js`) checked `mustRole(user, 'stock-movements')` — a key `mechanician`, `supervisor`, `sawmill-leader`, `poles-leader`, and `vat-leader` never held, despite all five being seeded with `'material-requests'` specifically so they could use this workflow.

- **`materialRequestsList`** and **`materialRequestsCreate`** — gate changed to `mustRole(user,'material-requests') || mustRole(user,'stock-movements')`. Every role that already worked (admin, ceo, operations, logistics, storekeeper, logistics-officer, storekeeper-assistant) holds both keys already, confirmed by reading every `material-requests`/`stock-movements` grant in `db/migrate.js` — none of them lose anything. The five broken roles now pass on `material-requests` alone.
- **`materialRequestsApprove`** — deliberately **not** given the same blanket OR-gate, to avoid handing approval authority to roles that were never meant to have it. Instead: `stock-movements` holders keep full approval rights unchanged, and `supervisor` specifically gains workshop-scoped approval (`user.role === 'supervisor' && mustRole(user,'material-requests')`, plus a same-workshop check against the request), restoring what desktop's own `canApprove` role list and mobile's dormant `supervisorWorkshopGuard` already assumed was working. `mechanician`, `sawmill-leader`, `poles-leader`, and `vat-leader` remain unable to approve — verified live (see §8).
- Stale doc comments in `mobile-api/routes/materialRequests.js` describing the old (incorrect) gates were corrected to match.

## 3. Workflow Verification

Full chain live-tested end-to-end (see §8 for the exact run): **Mechanician creates a request → Supervisor (same workshop) approves it, which auto-creates an already-approved Stock Transfer → Storekeeper dispatches it with a vehicle → Supervisor receives it → the transfer completes and `stock_levels` moves correctly at both warehouses → the material request's own status advances to `completed` → the mechanician receives personal notifications at approval and at completion → History/audit entries are recorded at every step → the new mechanician dashboard reflects the finished request.** No step in this chain required a new workflow, a new approval stage, or a schema change — every piece already existed; it was simply unreachable for the five affected roles until §2's fix.

One workshop-isolation edge case was live-verified as a negative test: a supervisor at a *different* workshop than the request correctly receives `Access denied — request belongs to a different workshop` when attempting to approve it.

## 4. Mobile Fixes

`mobile/src/screens/shared/MyRequestsScreen.tsx` — the combined error flag was `editError && matError && labourError` (AND), so it only ever fired when literally every data source failed; since `/api/my-requests` has no permission gate and never errors, the flag stayed `false` even when Material and/or Labour requests were being silently denied, showing what looked like a legitimate empty inbox.

Fixed with two distinct states rather than a blind AND→OR flip (which would have overcorrected — showing a full-screen error for roles that correctly and permanently lack access to just one of the three categories, e.g. a role with no casual-labour permission):
- **`allFailed`** (still AND) — full-screen `ErrorState` only when *nothing* could load.
- **`someFailed`** (new, OR) — a non-blocking inline banner naming which category failed ("Couldn't load material requests or labour requests right now.") with its own retry, while still showing whatever data *did* load successfully underneath.

This benefits every role that uses `MyRequestsScreen`, not just mechanician.

## 5. UI/UX Improvements

- **Desktop**: no new UI work was needed for Material Requests itself — `renderMaterialRequests()` was already a fully modernized enterprise screen (KPI cards, Recent Activity widget, search/filter/sort, bulk approve for roles that can approve, tabbed detail overlay with linked-transfer and audit-history tabs) from an earlier redesign. Fixing the permission gate (§2) is what makes mechanician able to reach it — the enterprise UI was already there, waiting.
- **Mobile**: mechanician's navigator now points at the exact same `MaterialRequestsStack` (List/Detail/Create) that `supervisor` uses — reused verbatim, not rebuilt, per the "reuse existing enterprise components" instruction.
- **Dead navigation removed**: `MachineLogList`/`MachineFuelList` tabs (mobile) — both their List *and* Create calls were always denied (this role has never held `machine-logs`/`machines`/`machine-fuel`, and this phase does not grant them — that remains a separate business decision, see §9). The client-side permission flags that made their "+Add" buttons appear (`machine.log`, `fuel.machine` in `mobile/src/utils/permissions.ts`) were replaced with `material.request`, which now genuinely works.
- **`MyRequests` tab removed** from mechanician's navigator specifically — its content (material requests mixed with casual-labour and edit-request noise this role doesn't generate) is superseded by the new dashboard's focused "My Material Requests" section plus the full `MaterialRequestsStack`. The screen itself is unchanged and still serves every other role that uses it.

## 6. Dashboard Improvements

New `mechanicianDashboard(userId)` (`db/services/data.js`), gated on `'material-requests'`, composed entirely from existing tables (`material_requests`, `stock_transfers`, `machines`, `machine_maintenance_schedules`) — no new tables, no new business logic:

- **KPIs**: My Total / Pending / Approved / Rejected requests (workshop-scoped to the caller's own submissions via `requested_by=user.id`). "Approved" deliberately buckets `approved`, `completed`, and `partial` statuses together so the four tiles reconcile to the total — verified live after an initial version under-counted a completed request (see §8).
- **Widgets**: Recent Requests (with linked transfer status), Machines Requiring Attention (workshop-scoped, read-only — mirrors `fleetDashboard`'s own machine-attention query), Upcoming Maintenance (workshop-scoped, next 14 days).
- **Desktop**: `renderDashboard()` now branches on `role==='mechanician'` to render this tailored view instead of the generic, ungated company dashboard the audit flagged as leaking unrelated sales/finance data to this role.
- **Mobile**: new `MechanicianDashboardScreen.tsx`, wired as the first tab, reusing the same `MiniKpi`/widget-card visual language already established across Fleet/Inventory's own mobile dashboards — no new design language introduced.

## 7. Desktop/Mobile Parity

| Capability | Desktop | Mobile |
|---|---|---|
| Create/view material requests | ✅ (now works, via existing `renderMaterialRequests`) | ✅ (now works, via existing `MaterialRequestsStack`) |
| Tailored dashboard | ✅ new | ✅ new |
| Notifications | Page reachable (was always true) | No dedicated screen — **not added**, see §9 |

Both platforms now offer equivalent operational capability for this role. The one remaining gap (mobile Notifications) is explicitly *not* mechanician-specific — no non-CEO role has a mobile Notifications screen today (confirmed by checking every navigator) — so building one exclusively for mechanician would be inconsistent with how every other role currently works, not a parity fix. Documented as an outstanding, systemic item rather than patched unilaterally for one role.

## 8. Verification Results

**Static**: `node --check` clean on `db/services/data.js`, `electron/main.js`, `electron/preload.js`, `mobile-api/routes/materialRequests.js`, `mobile-api/routes/dashboard.js`, `renderer/app.js`. `npx tsc --noEmit` clean on mobile.

**Live** (5 throwaway QA accounts — `_qa_mech_p1` [mechanician], `_qa_super_p1`/`_qa_super_p1b` [supervisor, two different workshops], `_qa_storekeeper_p1` [storekeeper], `_qa_sawmill_p1` [sawmill-leader] — plus one throwaway stock item, `_QA_MECH_TEST_ITEM`, seeded with stock via the real `stockMovementsCreate` function, never raw SQL):

1. Mechanician `materialRequestsCreate`/`List` — confirmed working (previously always denied).
2. Mechanician `materialRequestsApprove` — confirmed still denied (no approval-authority broadening).
3. Supervisor at a *different* workshop attempting to approve — confirmed denied with the correct workshop-mismatch message.
4. Supervisor at the *same* workshop approving — confirmed succeeds, auto-creates an approved Stock Transfer with the correct source/destination warehouses.
5. Storekeeper dispatch → Supervisor receive — confirmed the transfer completes and `stock_levels` moves correctly at both warehouses (verified by direct read).
6. Notifications — confirmed the mechanician receives personal (`for_user_id`) notifications at both approval and completion (an initial check appeared to show these missing; traced to the test script closing the DB pool before the app's own fire-and-forget notification writes completed — not a real defect, confirmed by re-running with the writes allowed to finish).
7. Generalization — confirmed `sawmill-leader` can also create/list requests via the same fix; confirmed a pre-existing role (`storekeeper`) is unaffected (still works, including reject).
8. `mechanicianDashboard` — confirmed KPI/widget data correct and reconciles to the total after the completed-status bucketing fix.

All 5 accounts and the throwaway stock item were deactivated (never hard-deleted) after testing; no real production data was touched.

## 9. Outstanding Items

- **Mobile Notifications has no screen for any non-CEO role**, mechanician included — a pre-existing, systemic gap, not something this phase's scope covers or should fix unilaterally for one role.
- **Whether to grant mechanician `machine-logs`/`machine-fuel`/`machines`** so it can actually perform the machine-side responsibilities the org chart implies (logging activity, recording downtime, viewing machine history) remains an open business decision, exactly as flagged in the audit — this phase deliberately did not broaden permissions beyond restoring the request-workflow this role was already seeded for.
- **A genuine "Mechanician Officer"/"Mechanician Assistant" tier split** (matching the `storekeeper`/`storekeeper-assistant` precedent already in this codebase) was explicitly out of scope for this phase and remains a future business decision.
- **The unrelated `getCeoOverview`/`monthly_approvals` crash**, found during the Fleet & Equipment audit and never in this role's scope, remains untouched.

## 10. Production Readiness Assessment

**The mechanician role can now complete its currently-intended responsibility — requesting materials and tracking that request to completion — entirely inside the ERP, on both platforms, verified end-to-end against real production data.** This is a materially different state from the audit's finding of "cannot complete a single intended responsibility." What remains open is a scope question, not a defect: whether the business wants to expand this role's responsibilities (machine logs, fuel, maintenance) beyond what it was originally seeded to do. That decision — and any resulting Phase 2 — is intentionally left to you.

## Not committed

Per standing release discipline, none of the above has been committed or pushed.
