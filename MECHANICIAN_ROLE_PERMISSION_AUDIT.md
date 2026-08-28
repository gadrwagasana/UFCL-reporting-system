# Mechanician Officer & Mechanician Assistant — Enterprise Audit

**Step 1 — Audit Only.** No code was written, no database was modified, no business logic was changed. Every finding below is cited with a file:line location and was verified by direct code reading (not assumed).

## 1. Executive Summary

The ERP does **not** implement "Mechanician Officer" and "Mechanician Assistant" as two roles. It implements a single, flat role literally named `mechanician` (`db/migrate.js:792, 842-845`), with no seniority tiers, no supervisor/subordinate relationship, and no work-assignment mechanism of any kind. The organizational chart in this audit's brief — Logistics Manager → Mechanician Officer → Mechanician Assistant — is only one-third real: the **Logistics Manager** tier exists and is correctly implemented (`role: 'logistics'`, seeded label literally `'Logistics Manager'`, `db/migrate.js:570`, with real workshop/machine/vehicle/maintenance oversight capability). The other two tiers collapse into one under-provisioned role.

The single most severe finding is a **silent permission key mismatch**: the `mechanician` role is seeded with the `'material-requests'` permission and a description stating its job is to "request spare parts and maintenance materials from the workshop store" (`db/migrate.js:844`) — but `materialRequestsList`/`Create`/`Approve` are gated on `mustRole(user, 'stock-movements')` (`db/services/data.js:3355, 3400, 3427-3433`), a permission the role does not hold. **Every material request call a mechanician makes is denied.** The one thing the role exists to do does not work, and has apparently never worked, since the gate and the granted permission have never matched.

Beyond that, the role has **zero write capability anywhere in the maintenance domain**: it cannot create a machine log (`machine-logs`/`machines` required, `data.js:9721,9769`), cannot log machine fuel (`machine-fuel` required, `data.js:6225,6249`), cannot create or view a machine maintenance schedule (`machines` required, `data.js:10051-10052,10072`), and cannot touch vehicle maintenance at all (`vehicles` required, `data.js:4257-4259`, `4240-4242` — this is arguably correct, since vehicle maintenance is Fleet's domain, not a machine mechanician's). The only things that genuinely work today are: a generic, ungated company-wide Dashboard that leaks unrelated sales/finance data (`data.js:1745`, no `mustRole` call at all), a perpetually-empty Notifications inbox (no `pushNotification` call in the entire codebase ever targets `'mechanician'`), and — almost by accident — a fully functional **Procurement Requisitions** flow, granted to every role including this one by a blanket `grantProcurementPermissions()` migration (`db/migrate.js:1720-1757`), which now serves as the only working "request something" channel this role has, running in parallel with the broken, purpose-built one.

Mobile makes this worse in one specific way: two of the three tabs mechanician is given (`MechanicianNavigator.tsx:6-8,32-34`) fail with an honest, visible error state, but the third — "My Requests" — has an AND-instead-of-OR bug in its combined error flag (`mobile/src/screens/shared/MyRequestsScreen.tsx:152`) that hides the fact that 2 of its 3 data sources are being silently denied, presenting what looks like a legitimate empty inbox.

**Bottom line:** as currently implemented, a `mechanician` user cannot complete a single one of the responsibilities the brief describes for either "Mechanician Officer" or "Mechanician Assistant" through the paths built for that purpose. The role can only get materials requested at all via the unrelated Procurement Requisitions screen it was granted as a side effect of a different feature's rollout.

## 2. Current Architecture

Confirmed unchanged and correctly followed throughout the mechanician surface area — no architectural violations found:
- **Electron → IPC → data.js → PostgreSQL**: desktop's `renderMaterialRequests`/`renderMachineLogs`/etc. call `UFCL.x()` preload methods → `secureHandle` IPC → `data.js` functions → `pool.query`, same as every other module.
- **REST API**: `mobile-api/routes/*` are thin pass-throughs into the same `data.js` functions (e.g. `mobile-api/routes/materialRequests.js:11-32`), no independent business logic or independent permission logic in the route layer beyond `requireRoles(...)` wrappers.
- **Governance/audit/notification frameworks**: present and used correctly wherever mechanician-adjacent functions run (e.g. `logAudit` calls on `machineLogsCreate`, `machineFuelLogsCreate` — `data.js:9798-9799`, `6269-6270`); the issue throughout this audit is never "the framework is broken," it's "this role was never granted the permission the framework checks for."
- **Workshop isolation**: `mechanician` is correctly registered in `WORKSHOP_ONLY_ROLES` (`data.js:1666`) and in every workshop-restriction check that matters (`isWorkshopRestricted`, `data.js:199-202`), so wherever it *does* have access (Procurement Requisitions, Dashboard), workshop scoping is enforced correctly (`data.js:14022` forces `workshopId = user.workshop_id` for restricted roles).

## 3. Current Role Structure

| Brief's org chart | ERP role | Exists? | Notes |
|---|---|---|---|
| Logistics Manager | `logistics` | ✅ Yes | Seeded label is literally `'Logistics Manager'` (`db/migrate.js:570`). Full permission set (`db/migrate.js:768-778`): `workshop-overview`, `machines`, `machine-fuel`, `vehicles`, `material-requests`, `stock-movements`, `stock-transfers`, `logistics-dashboard`, etc. — genuinely has workshop/machine/vehicle/maintenance oversight. |
| Mechanician Officer | *(none)* | ❌ No | No role with this name or an equivalent "senior mechanician" tier exists anywhere in `db/migrate.js`, `db/schema.sql`, or the mobile app's role types. |
| Mechanician Assistant | *(none)* | ❌ No | Same — does not exist. Note the codebase **does** already use an Officer/Assistant-style split elsewhere (`storekeeper` + `storekeeper-assistant`, `db/migrate.js:596, 790-791, 836-840`), so there is established precedent for this pattern in this codebase — it was simply never applied to Mechanician. |
| *(both collapse into)* | `mechanician` | ✅ Yes, singular | One flat role, `db/migrate.js:792, 842-845`. No `manager_id`/`supervisor_id`/`reports_to` column exists on `app_users` (confirmed: no such column anywhere in `db/migrate.js`/`db/schema.sql`), so even the Logistics Manager → Mechanician reporting line is not data-modeled — it's only a UI grouping default (`ROLE_DEPT` map in `renderer/app.js:6526`, which puts `mechanician: 'Logistics'` next to `storekeeper`/`storekeeper-assistant` for the New User form's auto-suggested Department field — cosmetic only, not an enforced hierarchy).

**No assignment/work-order mechanism exists anywhere.** Exhaustive search of `db/migrate.js` and `db/services/data.js` for `assigned_to`, `assignee`, `assigned_by`, `work_order` returns zero matches. There is no way, today, for a Logistics Manager to "assign work" to a mechanician of either seniority — this is not a bug in an existing feature, it is a feature that was never built, and this audit does not assume it should be added without your decision.

## 4. Responsibility Review

### Logistics Manager (`logistics` role)

| Responsibility | Status | Evidence |
|---|---|---|
| Workshop supervision | Exists | `workshop-overview` permission (`db/migrate.js:778`) → `workshopOverview()` (`data.js:3505-3782`) — full workshop KPIs, pending transfers, pending material requests, machine status counts. |
| Maintenance oversight | Exists | Holds `machines` (`db/migrate.js:769`), so passes `machineMaintScheduleList/Create`'s `mustRole(user,'machines')` gate (`data.js:10051,10072`) — can view/create machine maintenance schedules. |
| Machine availability | Exists | `machines` permission → machine registry + status. |
| Vehicle availability | Exists | Holds `vehicles` (`db/migrate.js:769`) — one of the four `VEHICLE_ROLES` in `mobile-api/routes/vehicles.js:14` and passes desktop's `mustRole(user,'vehicles')` gate for `fleetDashboard`/`fleetIntelligence`. |
| Maintenance reporting | Exists | `workshop-overview`'s maintenance trend/cost figures (`data.js:3737-3757`, per Workshop Phase 3). |
| KPI monitoring | Exists | `logistics-dashboard` permission (`db/migrate.js:768`) → `logisticsDashboard()`. |
| Resource allocation | Exists | `material-requests` **and** `stock-movements` both held (`db/migrate.js:768,771`) — unlike mechanician, Logistics Manager's material-requests grant actually matches the real gate, so approving/allocating stock genuinely works. |
| Executive reporting | Partially Exists | Has `export`/`audit` (`db/migrate.js:768`) and department-level dashboards, but not the CEO-level `getCeoOverview` executive rollup — appropriate for this org level, not a defect. |

**Conclusion: Logistics Manager is correctly and completely implemented.** No changes needed here.

### Mechanician Officer (mapped to the single `mechanician` role, since no separate Officer tier exists)

| Responsibility (from brief) | Status | Evidence |
|---|---|---|
| Machine Registry (view) | Missing | No `machines` permission (`db/migrate.js:792`); `machinesList` requires it. |
| Vehicle Fleet | Missing (and arguably out of scope — see §7) | No `vehicles` permission; vehicle maintenance is Fleet's domain per `data.js:3690-3691`'s own code comment. |
| Maintenance Records (create/view) | Missing | `maintenanceCreate`/`List` require `vehicles` (`data.js:4257-4259, 4240-4242`) — this is the *vehicle*-side table; there is no separate machine-side "maintenance record" creation function at all — the closest is `machineMaintScheduleCreate`, which requires `machines` (`data.js:10072`), also missing. |
| Machine Logs | Exists but inaccessible due to permissions | `machineLogsCreate`/`List` require `machine-logs` or `machines` (`data.js:9721,9769`) — neither held. Mobile even shows a working "+" Add button that leads to a full form before failing server-side (`mobile/src/screens/machineLogs/MachineLogListScreen.tsx:96`, `permissions.ts:82` grants the client-side `machine.log` flag inconsistently with the real backend gate). |
| Fuel Logs | Exists but inaccessible due to permissions | Same pattern — `machine-fuel` required (`data.js:6225,6249`), not held; mobile shows a working Add button that will fail. |
| Material Requests | **Exists but inaccessible due to a permission-key bug** | This is the critical finding — see §1/§11. |
| Maintenance scheduling | Missing | `machineMaintScheduleCreate` requires `machines` (`data.js:10072`). |
| Repair recording | Missing | No dedicated "repair" function exists distinct from `machineLogsCreate` (downtime/remarks fields) — and that's denied too. |
| Machine downtime | Exists but inaccessible | `downtime_hours`/`downtime_reason` are fields on `machine_daily_logs` (`data.js:9771-9773`), reachable only via the denied `machineLogsCreate`. |
| Maintenance history | Missing | `machineMaintScheduleList` denied (`data.js:10051-10052`). |
| Spare part requests | **Broken** (see §1) | The permission-key mismatch. |
| Notifications | Exists, but structurally empty | Page reachable (`data.js:1326` gate passes), but no `pushNotification` call anywhere ever targets `'mechanician'` — confirmed by reviewing every call site. |
| Reports | Missing | No report/export permission tied to machine or maintenance data. |

**Every single named responsibility for "Mechanician Officer" is currently impossible to perform** through its intended path.

### Mechanician Assistant (no distinct role — same `mechanician` role, same findings apply, plus:)

| Responsibility (from brief) | Status |
|---|---|
| View assigned work | Missing — no assignment concept exists anywhere (§3). |
| Record maintenance / update progress / record labour / record notes | Missing — no such granular sub-record concept exists in the schema at all (machine logs are single daily-summary rows, not task-level progress records); this is a genuine feature gap, not a permission gap. |
| Record spare parts used | Missing — no `machine_id`/`maintenance_record_id` column exists on `material_requests` (`db/migrate.js:214-229`) to link a request to a specific repair; only a free-text `reason` field exists. |
| Request additional materials | Same broken path as Officer. |
| View machine/vehicle history | Missing — same permission gaps as Officer. |
| Record fuel | Exists but inaccessible — same `machine-fuel` gap as Officer. |

There is no functional distinction implemented between "Officer" and "Assistant" work today, because there is only one role.

## 5. Permission Matrix

Legend: ✅ = works end-to-end · ⚠️ = permission granted but gate uses a different key (broken) · ❌ = not granted, correctly denied · N/A = no such capability exists in the schema.

| Screen / Action | Read | Create | Edit | Delete | Approve | Assign | Export | Search/Filter |
|---|---|---|---|---|---|---|---|---|
| Dashboard (`data.js:1745`, no gate) | ✅ (leaks company-wide data, see §8) | — | — | — | — | — | ❌ | — |
| Material Requests (`data.js:3353,3398,3427`, gate=`stock-movements`) | ⚠️ | ⚠️ | — | — | ⚠️ | N/A | ❌ | ⚠️ (moot, list denied) |
| Machine Registry (`machines`) | ❌ | ❌ | ❌ | ❌ | N/A | N/A | ❌ | ❌ |
| Machine Logs (`data.js:9721,9769`, gate=`machine-logs`/`machines`) | ❌ | ❌ | ❌ | ❌ | N/A | N/A | ❌ | ❌ |
| Machine Fuel (`data.js:6225,6249`, gate=`machine-fuel`) | ❌ | ❌ | ❌ | ❌ | N/A | N/A | ❌ | ❌ |
| Machine Maintenance Schedule (`data.js:10051,10072`, gate=`machines`) | ❌ | ❌ | ❌ | ❌ | N/A | N/A | ❌ | ❌ |
| Vehicle Maintenance/Fleet (`data.js:4240,4257`, gate=`vehicles`) | ❌ | ❌ | ❌ | ❌ | N/A | N/A | ❌ | ❌ |
| Notifications (`data.js:1326`, gate=`notifications`) | ✅ (always empty, §11) | N/A | ✅ (mark-read) | N/A | N/A | N/A | N/A | ✅ |
| Procurement Requisitions (`data.js:13987,14016`, gate=`procurement-requisitions`) | ✅ | ✅ | — | — | — | N/A | — | (desktop screen only) |
| Procurement Dashboard (`data.js:14709-14711`) | ✅ (company-wide, not workshop-scoped) | N/A | N/A | N/A | N/A | N/A | N/A | N/A |

**Role Definition → Desktop → REST → Mobile → Actual Behaviour, for the two capabilities that matter most:**

| Layer | Material Requests | Machine Logs / Fuel |
|---|---|---|
| Role Definition | Grants `material-requests` (`db/migrate.js:792`) | Does not grant `machine-logs`/`machines`/`machine-fuel` |
| Desktop | `renderMaterialRequests` calls `materialRequestsList` → denied → `renderDenied('material-requests', ...)` (`renderer/app.js:8986`) | No NAV entry rendered at all (sidebar built from resolved pages, `renderer/app.js:483-503`) |
| REST | `mobile-api/routes/materialRequests.js:11-32` — no independent gate, inherits the `data.js` denial | `mobile-api/routes/machines.js`/fuel routes — same, inherits denial |
| Mobile | No `MaterialRequestsStack` wired into `MechanicianNavigator` at all — feature absent from nav tree, not even attempted | `MechanicianNavigator.tsx:32-33` shows working tabs with functional-looking "+Add" buttons that fail on submit |
| Actual Behaviour | Completely inaccessible, two different ways on two platforms (denied vs. absent) | Visible, inviting, and non-functional |

## 6. Workflow Analysis

Full intended maintenance lifecycle, traced step by step, with exactly where a `mechanician` hits a wall:

```
Machine                                          [mechanician: ❌ no `machines` permission]
  ↓
Fault / downtime logged (machine_daily_logs)     [mechanician: ❌ machineLogsCreate needs machine-logs/machines — data.js:9769]
  ↓
Maintenance scheduled (machine_maintenance_schedules) [mechanician: ❌ machineMaintScheduleCreate needs machines — data.js:10072]
  ↓
Material Request (spare parts)                   [mechanician: ❌ materialRequestsCreate needs stock-movements, not material-requests — data.js:3400]
  ↓
Stock Transfer (auto-created on approval)         [never reached — request never created]
  ↓
Inventory Consumption                             [never reached]
  ↓
Maintenance Completion                            [never reached — no completion step even exists distinct from editing the log/schedule row]
  ↓
History                                           [mechanician: ❌ machineMaintScheduleList needs machines/machine-logs — data.js:10051]
  ↓
Reporting (workshopOverview)                      [mechanician: ❌ needs workshop-overview, not held]
```

**The workflow does not merely stop partway through for a mechanician — it never starts.** The first step (`machineLogsCreate`) is already denied. This audit does not invent a "should exist" step beyond this chain; every node above is a real function that exists in the code today, gated the way stated.

For comparison, the workflow genuinely works end-to-end for a **Logistics Manager** or **supervisor** (both hold `machines`+`material-requests`+`stock-movements` correctly matched — `db/migrate.js:768-771, 779-783`, noting `supervisor` is also missing `stock-movements` per §11's High Priority findings, so even supervisor's Material Requests path has the identical bug, just discovered independently).

## 7. Collaboration Matrix

| Department | What's implemented | What's missing/broken for mechanician |
|---|---|---|
| **Workshop** | `workshopOverview()` (`data.js:3505-3782`) references `machine_daily_logs` for fuel/downtime aggregates (`3668-3673`) and utilization % (`3718-3725`) — real, working, aggregate-only. | Page requires `workshop-overview`, not held. No per-mechanician attribution widget exists (by design — it's a company/workshop aggregate page, not an individual-activity page). |
| **Inventory** | `materialRequestsList` returns `requested_by` and desktop shows a "Requester" column (`renderer/app.js:9063,9087`); `inventoryDashboard`'s `materialRequestsAwaiting` widget (`data.js:2139-2148`) does not include `requested_by` — workshop/priority only. | Moot in practice: no mechanician-submitted request can ever exist, since `materialRequestsCreate` denies them (§1). |
| **Logistics** | Logistics Manager (`logistics` role) has full working oversight (§4) — correctly implemented, this is the one department relationship that works as designed. | Nothing missing on the Logistics side; the gap is entirely on the mechanician side. |
| **Fleet & Equipment** | Cleanly separated by design: `machines`/`machine_daily_logs`/`machine_maintenance_schedules` (machine-side) vs. `vehicles`/`maintenance_records`/`fuel_logs` (vehicle-side) are two independent data families with no schema link, explicitly documented in code (`data.js:3690-3691`). | Correctly no overlap — this is not a gap, it reflects that machine maintenance (mechanician's job) and vehicle maintenance (Fleet's job) are different domains with different intended operators. No change recommended here. |
| **Procurement** | `procurementRequisitionsList`/`Create` (`data.js:13985-14046`) work end-to-end for mechanician, including correct workshop-scoping (`data.js:14022`, `13991-14001`) — genuinely functional. | Creates the two-parallel-systems confusion already noted: a broken purpose-built flow (Material Requests) and a working generic one (Procurement Requisitions), with no in-app signal to a mechanician about which one to use. |
| **Finance** | `workshopOverview`'s finance-visibility cost block (`data.js:3599-3618`) sums `maintenance_records.cost` — that's the **vehicle**-side table, not machine-side. Machine-side figures (utilization %, fuel, downtime, maintenance trend) do roll into `workshopOverview`'s Phase 2/3 KPIs (`data.js:3763-3775`) as aggregates. | Page requires `workshop-overview`, not held; no individual mechanician attribution in any case — aggregate-only by design. |
| **Management** | No reference to `machine-logs`/`machine_daily_logs`/machine maintenance found in the executive (`getCeoOverview`) rollup. | Machine-side operational data does not currently roll up to any executive dashboard as an attributed or even aggregate contribution — this may be intentional scope (machine ops are workshop-level, not executive-level), not asserted as a defect. |

## 8. Dashboard Review

**Mechanician Officer / Assistant desktop Dashboard**: `getDashboardStats()` (`data.js:1745`) has **no `mustRole` gate at all** — every authenticated user, including mechanician, receives the identical company-wide dashboard: month production totals, sales revenue and recent orders, expense breakdown by category, and low-stock alert counts pulled from `mv_stock_summary` with no workshop filter. The `pendingActions` panel only populates for `['admin','ceo','logistics','operations']` (`data.js:1845`) or `['admin','ceo','operations','sales','supervisor']` (`data.js:1873`) — mechanician is in neither branch, so that panel is always empty. **This dashboard provides zero operational visibility relevant to a mechanician's actual job** (no assigned work, no machines requiring maintenance, no overdue maintenance, no fuel activity, no material request status, no KPIs) — instead it shows unrelated financial/sales data. This is not mechanician-specific brokenness (every role sees the same generic dashboard), but it is a real gap relative to what the brief asks this role's dashboard to provide.

**Mobile**: mechanician has **no Dashboard tab at all** (`MechanicianNavigator.tsx:32-34` — only MachineLogList/MachineFuelList/MyRequests). `mobile-api/routes/dashboard.js:12-21`'s `DASHBOARD_ROLES` explicitly excludes mechanician with a code comment confirming this is intentional — but the exclusion is inconsistent with the desktop side, which serves the same data to mechanician with no gate at all. Neither platform gives a mechanician-relevant dashboard; mobile at least doesn't leak unrelated data, desktop does.

None of the brief's suggested dashboard content — assigned work, machines requiring maintenance, vehicles requiring maintenance, overdue maintenance, fuel activity, material requests, spare parts, KPIs, alerts — exists anywhere for this role today.

## 9. UI/UX Review

Comparing against the enterprise standard already achieved in Procurement/Logistics/Workshop/Inventory/Fleet & Equipment (search/filter/sort, bulk actions, tabbed detail overlays, `_lgdWidget` attention widgets, executive KPI dashboards):

| Screen | Search | Filter | Sort | Bulk | Detail overlay | Widgets | Verdict |
|---|---|---|---|---|---|---|---|
| Desktop Material Requests (`renderer/app.js:8984`) | ✅ | ✅ | ✅ | ✅ | ✅ tabbed (`.smo-tabs`, `9186`) | ✅ (`9042`) | Fully at enterprise standard — but mechanician can never reach it. |
| Desktop Machine Logs (`renderer/app.js:12272`) | ✅ | ✅ | ✅ | ❌ | ❌ (flat overlay, `12632`) | ❌ | Partially modernized — behind the reference standard, and unreachable by mechanician regardless. |
| Desktop Machine Fuel | (per Fleet Phase 2) ✅ | ✅ | ✅ | — | ✅ | — | At standard — unreachable by mechanician. |
| Mobile MachineFuelListScreen | ✅ (`ListSearchBar`) | ✅ (fuel-type chips) | — | — | ✅ | — | Recently modernized (Fleet Phase 2) — unreachable in practice. |
| Mobile MachineLogListScreen | ❌ (no search bar) | Single dropdown only, no chips | — | — | ✅ | ❌ (has a "today stats" banner instead) | Behind even the mobile standard — and unreachable in practice. |
| Mobile MyRequestsScreen (mechanician's actual Material Requests equivalent) | ❌ | Kind-chips only, no status filter | — | — | ❌ (flat cards) | ❌ | The screen mechanician is actually routed to is the least mature of any request-related screen in the app, and it masks errors (§10). |

**Net assessment**: the screens mechanician is *supposed* to use (desktop Material Requests, and to a lesser extent Machine Logs/Fuel) are reasonably-to-fully modernized — but every one of them is unreachable. The one screen mechanician actually lands on (mobile My Requests) is the least mature UI in this comparison, and additionally hides failures rather than surfacing them.

## 10. Mobile/Desktop Review

- **Missing screens**: Machine Registry, Vehicle Fleet, Maintenance Schedule/History — absent from mechanician's nav on both platforms (correctly, since it lacks the underlying permissions — consistent, at least).
- **Missing buttons/actions**: Desktop shows no NAV entry for anything mechanician can't reach (clean). Mobile shows working-looking "+Add" buttons on Machine Logs and Machine Fuel (`MachineLogListScreen.tsx:96`, `MachineFuelListScreen.tsx:94`) that lead to full create forms which will fail on submit — this is the one place mobile is *less* honest than desktop about what the user can actually do.
- **Missing dashboards**: both platforms lack a mechanician-relevant dashboard (§8); desktop additionally over-shares unrelated data where mobile at least gates it off.
- **Permission inconsistencies (client-side vs. backend)**: `mobile/src/utils/permissions.ts:82`'s local `Permission` table grants mechanician `machine.log`/`fuel.machine` (enabling Add buttons) but the real backend gates (`machine-logs`/`machines`/`machine-fuel` page permissions) are not held — the two permission systems (client-side capability strings, server-side page tokens) are not kept in sync for this role.
- **Material Requests specifically**: desktop attempts to serve the real Material Requests screen and fails with a clear "Access Denied" (`renderDenied`); mobile never even offers the real screen (`MaterialRequestsStack` isn't wired into `MechanicianNavigator` at all) and instead substitutes the generic cross-role `MyRequestsScreen`, which has its own independent bug (§9, §11) masking the failure. **Mobile and desktop disagree on how this failure should look to the user**, and neither path results in a working feature.

## 11. Critical Issues

1. **Material Requests permission-key mismatch (the role's core defined purpose does not work).** `mechanician` is granted `material-requests` (`db/migrate.js:792`) and described as existing to "request spare parts and maintenance materials" (`db/migrate.js:844`), but `materialRequestsList`/`Create`/`Approve` check `mustRole(user,'stock-movements')` (`data.js:3355,3400,3427-3433`), a permission never granted to this role anywhere in the codebase. Every material request attempt is silently denied.
2. **`mechanician` has zero write capability in the entire maintenance domain.** It cannot create a machine log, cannot log fuel, cannot create or view a maintenance schedule, and (correctly, since it's Fleet's domain) cannot touch vehicle maintenance. Combined with Finding 1, this role can perform none of its brief-described responsibilities through any purpose-built path today.
3. **Mobile "My Requests" screen masks failures instead of surfacing them.** `hasError = editError && matError && labourError` (`MyRequestsScreen.tsx:152`) is a logical AND where it needs to be OR — since the third source (`/api/my-requests`) never errors, the combined flag stays `false` even when Material and Labour data are both being silently denied, so mechanician sees what looks like a legitimate empty inbox.

## 12. High Priority Issues

4. **The same `stock-movements`-vs-`material-requests` gate mismatch also affects other roles**, not just mechanician: `supervisor`, `sawmill-leader`, `poles-leader`, and `vat-leader` are all granted `material-requests` (`db/migrate.js:779-783, 794-805`) without `stock-movements`, so their Material Requests screens are equally broken. This is a systemic bug, not a mechanician-only defect, and should be considered/fixed as one coherent issue rather than four/five separate ones.
5. **Desktop Dashboard leaks unrelated company financial/sales data to every unrestricted role**, including mechanician, because `getDashboardStats()` (`data.js:1745`) has no permission gate at all — while mobile correctly excludes mechanician from the equivalent endpoint (`mobile-api/routes/dashboard.js:12-21`). The two platforms disagree, and desktop is the more permissive (and more wrong, relative to a workshop-scoped role) of the two.
6. **Mobile create buttons for Machine Logs/Fuel are shown to mechanician despite the backend always denying the submission** (`permissions.ts:82` vs. the real `machine-logs`/`machines`/`machine-fuel` gates) — a real UX dead end that wastes a user's time filling out a form that cannot succeed.

## 13. Medium Priority Improvements

7. **No description update alongside the permission mismatch** — `mechanician`'s seeded description (`db/migrate.js:844`) describes intended behavior that has never matched the actual gate; whichever side is fixed (grant `stock-movements`, or re-gate the function on `material-requests`), the description should be checked for accuracy afterward.
8. **Two parallel, uncoordinated "request materials" systems** now exist for this role (broken Material Requests vs. working Procurement Requisitions), with no in-app signal about which one is authoritative — this is a genuine process-clarity question for the business, not something this audit resolves unilaterally.
9. **Mobile client-side `Permission` table (`permissions.ts`) is a second, independent source of truth** from the backend's DB-seeded `role_definitions.permissions` — the two have already drifted for this role and could drift further for others without a matching backend gate check.

## 14. Low Priority Improvements

10. **Machine Logs desktop screen lacks the bulk-action/tabbed-overlay/attention-widget layer** that Material Requests, Inventory, Logistics, and Fleet already received — cosmetically behind the reference standard, though currently moot since mechanician can't reach it.
11. **Mobile MachineLogListScreen lacks a text search bar** (only a single machine-picker dropdown), unlike the recently-modernized MachineFuelListScreen — same "currently moot" caveat.
12. **`ROLE_DEPT` cosmetic grouping** (`renderer/app.js:6526`) puts `mechanician` under "Logistics" for the New User form's auto-suggested department — harmless today, but if an Officer/Assistant split or a real reporting-line field is ever introduced, this is the place that would need to grow with it.

## 15. Production Readiness Assessment

**Not production ready for either "Mechanician Officer" or "Mechanician Assistant" responsibilities.** A user assigned the `mechanician` role today cannot, through any intended path: view a machine, log a machine's daily activity or downtime, log machine fuel, schedule or record maintenance, view maintenance history, or successfully request spare parts. The single functioning capability (Procurement Requisitions) exists only because every role received it as a side effect of an unrelated feature rollout, not because the mechanician workflow was deliberately connected to it. This role, as it stands, cannot complete its real daily responsibilities entirely inside the ERP — it can complete almost none of them.

## 16. Recommended Phase 1 (proposed scope — not started, awaiting approval)

Critical fixes only, matching the pattern already used for Fleet & Equipment Phase 1:
- Resolve the `material-requests`/`stock-movements` permission-key mismatch — for `mechanician` **and** the other four roles found with the same bug (`supervisor`, `sawmill-leader`, `poles-leader`, `vat-leader`) — as one coherent fix, pending your decision on which key should be authoritative.
- Fix the `MyRequestsScreen` AND/OR error-flag bug (`MyRequestsScreen.tsx:152`) so denied data sources are always surfaced, not just sometimes.
- Business decision needed before any further work: should `mechanician` actually be granted `machine-logs`/`machines`/`machine-fuel` (so its named responsibilities become real), or should the mobile navigator/desktop expectations be scoped back down to match its current, narrower, description? This mirrors the exact same open question already flagged in the Fleet & Equipment Phase 1 report.

## 17. Recommended Phase 2 (proposed scope — not started, awaiting approval)

Contingent on the Phase 1 business decision:
- If permissions are expanded: bring Machine Logs/Fuel/Maintenance screens (both platforms) up to the same enterprise toolkit standard already achieved elsewhere, and build a mechanician-relevant dashboard (assigned-adjacent visibility, machines needing attention, own request status) rather than the generic company dashboard it currently inherits.
- If a genuine Officer/Assistant tier split is wanted (matching the `storekeeper`/`storekeeper-assistant` precedent), design the two roles' distinct permission sets and (if a real hierarchy is wanted, not just a label) whatever minimal `reports_to`/`assigned_by` data model would be needed — this is a business-process decision, not something to default into.

## 18. Recommended Phase 3 (proposed scope — not started, awaiting approval)

- If an assignment/work-order concept is wanted (the brief's "view assigned work" responsibility), this would be new schema and new workflow — a genuine net-new feature, not a fix, and should only be scoped after Phase 1/2 confirm the basic role actually works.
- Reporting/visibility rollups (machine mechanic activity into Workshop/Management dashboards) once the underlying data is actually being created by a working role.

---

## Stop Point

This is an audit only. No code was written, no permissions were changed, no workflows were modified, no tables were created, and neither Logistics nor Workshop was redesigned. Awaiting your review and approval before any Phase 1 implementation begins.
