# UFCL ERP — Workshop Department Enterprise Audit

**End-to-End Operations, Cross-Department Collaboration & Professional ERP Assessment**

This is an audit-only deliverable. No code was written, no database was modified, no business process was redesigned. Every finding below is cited to an exact file and, where useful, an exact line number, verified directly against the current source of truth (`db/services/data.js`), the desktop frontend (`renderer/app.js`), and the mobile app (`mobile/src/`). This audit follows the same standard and citation discipline as `LOGISTICS_ENTERPRISE_AUDIT.md` and feeds Workshop Phase 1/2/3, mirroring how the Logistics department was taken through its own three phases.

---

## 1. Executive Summary

The Workshop Department, as a distinct enterprise module, **does not exist as a single coherent thing today** — it is a set of adjacent-but-disconnected subsystems (Workshop/Warehouse registry, Machine registry + daily logs + KPI performance, Material Requests, and a separate Vehicle Maintenance system that actually lives under the *Vehicles/Fleet* permission, not Workshop) that were built in different phases with different conventions, and were never unified into the "Workshop" identity the NAV sidebar implies. Concretely:

- The Workshop-relevant pages are scattered across **five different NAV sections** (`Operations`, `Workshop & Inventory`, `Fleet & Equipment`, `Reports & Finance`, and — because Vehicle Maintenance is gated by the `vehicles` permission — effectively also under Fleet). There is no unified "Workshop" navigation group at all (§7.1).
- The idealized 13-step "Machine Breakdown → … → Management Dashboard" workflow in the audit brief **does not exist in the codebase**. There is no maintenance-request record, no approval step, no workshop/mechanic assignment, no "testing" phase, and no formal "machine released" event. What exists is a forward-looking maintenance *schedule* (`machine_maintenance_schedules`), a retrospective maintenance *log* (`maintenance_records`, vehicles only), and a generic stock *material request* — three separate, disconnected pieces (§4).
- Two concrete, low-risk security defects were found and are worth fixing in Phase 1: (a) Machine Registry's write operations (create/update/delete machines and categories) use hardcoded role arrays instead of the `mustRole` permission system used everywhere else, and (b) the `machines` table itself is **never workshop-scoped** anywhere it's queried — a workshop-restricted user sees every machine, every KPI row, and every fuel-reconciliation row company-wide, not just their own workshop's (§6, §12).
- `workshopOverview()` — the backend for the "Workshop Overview" dashboard — checks `mustRole(user, 'inventory')`, not `mustRole(user, 'workshop-overview')`, even though `'workshop-overview'` is the actual permission key the role-permission system (and the NAV entry) use. This is a real, verified permission-key mismatch (§6, §12).
- The UI/UX gap versus Logistics is stark and easy to demonstrate: Machine Registry, Machine Daily Logs, and Machine KPI Performance are **still on the pre-Logistics-upgrade plain table** (`table.dt`, no search, no filter, no sort, no bulk actions, no detail overlay, no audit history) — the exact state every Logistics page was in before Phase 2. Vehicle Fleet, by contrast, has already been upgraded to the enterprise table toolkit in an earlier phase (§7).
- Machine KPI Performance — a full desktop NAV page — **has no mobile screen at all**. Every other Workshop-adjacent module (Machines, Machine Logs, Machine Fuel, Workshops, Material Requests, Vehicles) has reasonable mobile coverage (§9).
- No Workshop cost ever reaches Finance or the Executive Dashboard. `maintenance_records.cost` is captured on every maintenance entry and is never summed anywhere in the codebase (§5, §10).
- Procurement→Workshop collaboration is real and reasonably rich (`procurementWorkshopPerformance`), but it is one-directional — nothing in the Workshop Overview dashboard shows a workshop's own pending procurement requests or spend (§5).

None of this requires redesigning UFCL's business processes. It requires: consolidating navigation, extending the existing table toolkit and detail-overlay pattern (already built for Logistics) to the Machine modules, fixing two narrowly-scoped permission defects, and closing a handful of genuinely missing (not redesigned) collaboration links. This is directly analogous in shape and effort to the Logistics Phase 1→3 arc.

---

## 2. Workshop Architecture Review

The architecture itself (Electron → IPC → `db/services/data.js` → PostgreSQL; REST API → `db/services/data.js` → React Native) is intact and correctly followed everywhere Workshop-adjacent code touches it — no violation of the single-backend principle was found. The problem is not architectural, it's organizational: what should be one cohesive "Workshop" domain is actually four separate domains that happen to share the word "workshop" in casual conversation:

1. **Warehouses / Workshop registry** (`warehouses` table — yes, workshops are literally rows in the `warehouses` table, distinguished by `workshop_type`) — `workshopsForDropdown` (data.js:1959), `workshopsListWithMetrics` (1994), `workshopOverview` (2809).
2. **Machine Management** (`machines`, `machine_categories`, `machine_daily_logs`, `machine_kpi_definitions`/`machine_kpi_targets`, `machine_maintenance_schedules`, `machine_fuel_logs`) — a self-contained registry+logging+KPI subsystem, `data.js:8221`–`8845`.
3. **Material Requests** (`material_requests` table, requests for stock items against a workshop) — `data.js:2699`–`2805`, gated by the `stock-movements` permission, not a `material-requests` or `workshop` permission.
4. **Vehicle Maintenance** (`maintenance_records`, tied to `vehicles`) — `data.js:3036`–`3067`, `8773`–`8845` — gated entirely by the `vehicles` permission. This is the system that actually answers "maintenance history for an asset," but it lives under Fleet, not Workshop, and only covers vehicles — machines have no equivalent "maintenance record" table, only the forward-looking schedule.

No unifying "Workshop" backend module ties these together; `workshopOverview` is the closest thing to a hub, and it only touches (1), a subset of (2) (machine counts/availability), and (3) (pending material requests) — it has no visibility into (4) at all.

---

## 3. Module-by-Module Review

| Module (per audit brief) | Exists? | Backend | Permission gate | Workshop-isolated? | Notes |
|---|---|---|---|---|---|
| Workshop Dashboard | Partial | `workshopOverview` (2809) | `mustRole(user,'inventory')` ⚠️ mismatch | ✅ | See §12 for the permission-key mismatch |
| Workshop Overview | ✅ | same as above | same | ✅ | Aggregates stock, machine counts, pending transfers/requests, low stock |
| Workshops (registry) | ✅ | `workshopsListWithMetrics` (1994) | — | ✅ | Standard CRUD on `warehouses` |
| Machine Registry | ✅ | `machinesList/Create/Update/Delete` (8242–8317, 8699) | Mixed — List uses `mustRole`, Create/Update/Delete use hardcoded `['admin','ceo','logistics']` | ❌ **not scoped** | See §6, §12 |
| Equipment Registry | Same as Machine Registry | — | — | — | No separate "Equipment" concept exists; machines *are* the equipment registry |
| Maintenance Requests | ❌ **Does not exist** | — | — | — | No request/approval workflow for repairing a machine or vehicle exists anywhere |
| Work Orders | ❌ **Does not exist** | — | — | — | No concept of a dispatched, assignable "work order" anywhere in the schema or code |
| Preventive Maintenance | Partial | `machine_maintenance_schedules` (8642) | `mustRole(user,'machines')` | N/A (forward schedule, not workshop-tagged) | A `next_due` date per machine, no lifecycle, no notifications on due |
| Corrective Maintenance | Partial | `maintenance_records` (vehicles only, 3036) | `mustRole(user,'vehicles')` | N/A | Retrospective log only; no equivalent exists for machines |
| Spare Parts Usage | ❌ **Not tracked as consumption against a repair** | `material_requests` covers *requesting* parts, not recording what was *used* on a specific repair | — | ✅ (via material_requests) | No linkage between a maintenance_records row and the parts consumed for it |
| Material Requests | ✅ | `materialRequestsList/Create/Approve` (2699–2805) | `mustRole(user,'stock-movements')` for list/create; **hardcoded array** for approve | ✅ for list/create | Approve uses the hardcoded-role anti-pattern (§6) |
| Fuel Usage | ✅ (machines) / ✅ (vehicles, separate) | `machineFuelLogsList/Create` (4914–4957), `machineFuelSummary` (4843) | `mustRole(user,'machine-fuel')` OR hardcoded array | ❌ **not scoped** (queries `machines` unfiltered) | Two entirely separate fuel-log systems exist (machine vs vehicle) with no shared reporting |
| Machine Downtime | Partial | `downtime_hours`/`downtime_reason` fields on `machine_daily_logs` (8397), aggregated in `machineKpiPerformance` (8574) | — | ❌ (KPI query unscoped) | Tracked as a field, not a first-class module; no dedicated downtime-reason breakdown report exists |
| Maintenance Schedule | ✅ (machines only) | `machineMaintScheduleList/Create/Update/Delete` (8642–8698) | `mustRole(user,'machines')` | N/A | No equivalent forward schedule for vehicles beyond `maintenance_records.next_due_date` |
| Maintenance History | Partial | `maintenanceList` (vehicles, 3036) / `machine_daily_logs` (machines, informal) | — | — | Two different, non-unified histories; neither uses the structured per-record audit-history pattern established in Logistics Phase 2 (`logisticsRecordHistory`) |
| Workshop Reports | ❌ **No dedicated reporting page** | Closest: `machineKpiPerformance` (8552), `machineFuelSummary` (4843) | — | — | No report titled/scoped as "Workshop Reports"; no maintenance-cost report exists anywhere |

---

## 4. End-to-End Workflow Analysis

Tracing the audit brief's idealized chain against the actual implemented behavior:

| Step | Status | Evidence |
|---|---|---|
| Machine Breakdown | ❌ Missing | No "report a breakdown" action exists. A machine's `status` field can be manually set (e.g., to `Under Maintenance`), but there is no event, notification, or record created when that happens. |
| Maintenance Request | ❌ Missing | No request record exists for machines. `material_requests` exists but is a generic *parts* request, not a *repair* request — it has no link to a machine, no description of the fault, no urgency-of-repair concept (only `priority` on the parts request itself). |
| Approval | ❌ Missing | There is no approval step for "may this machine be worked on" — only `material_requests.status` (approve/reject a parts request) and `stock_transfers` approval exist in this space. |
| Workshop Assignment | ❌ Missing | Machines are already permanently tied to a workshop via `machines.workshop_id` (set at registration) — there is no per-incident "assign this repair to Workshop X" step because there's no incident record to assign. |
| Mechanic Assignment | ❌ Missing | `maintenance_records.performed_by` is a free-text field (3060), not a user reference — there is no way to assign, notify, or hold a specific mechanic accountable for a job in progress. |
| Material Request | ✅ Exists, but disconnected | `materialRequestsCreate` (2743) works correctly and is workshop-aware, but nothing links a specific material request to a specific maintenance job — it's a general "I need parts" request. |
| Inventory Validation | ✅ Exists | `materialRequestsApprove`'s approve path checks nothing beyond `status='pending'` — there is no explicit stock-availability check before approval (contrast with Logistics' Phase 1 `dispatchReview`, which validates against `mv_stock_summary` before allowing dispatch). This is a real gap: an approver can approve a material request for more than is in stock. |
| Inventory Issue | ✅ Exists | On approval with a `sourceWarehouseId`, `materialRequestsApprove` (2776–2795) correctly creates a `stock_movements` transfer row and updates both warehouses' `stock_levels` — this part is solid and auto-synchronized. |
| Repair | ⚠️ Partial | `maintenanceCreate` (vehicles) or a manual `machine_daily_logs` entry (machines) can retrospectively record that repair work happened, but there is no "repair in progress" state at all. |
| Testing | ❌ Missing | No concept exists anywhere. |
| Completion | ⚠️ Implicit only | Creating a `maintenance_records` row is itself the "completion" — there's no separate open→closed lifecycle. |
| Machine Released | ❌ Missing | Nothing automatically returns a machine's `status` to `Available` when a maintenance record is logged, nor is there any explicit "release" action (§12). |
| Maintenance History | ⚠️ Partial | `maintenanceList` (vehicles) is a genuine history view; machines only have the raw `machine_daily_logs` table, not a dedicated maintenance-history view. Neither uses the structured per-record `logAudit` opts (`module`/`recordId`) Logistics Phase 2 established for per-record audit-history lookups — so neither can support a "who did what, when" detail-overlay history tab the way Logistics now can. |
| Management Dashboard | ✅ Exists | `workshopOverview` and `machineKpiPerformance` both give real, useful management visibility — this is the one step of the 13 that's genuinely well-served today. |

**Bottom line**: 3 of 13 steps are solid (Material Request creation, Inventory Issue, Management Dashboard visibility), 3 are partial, and 7 do not exist in any form. This is not a "few gaps in an otherwise-complete workflow" — it's an absent workflow with three good, disconnected building blocks around its edges.

---

## 5. Cross-Department Collaboration Analysis

### Inventory
Material Requests → Stock Movement → Stock Levels is real and automatic (`materialRequestsApprove`, 2760–2805): approving a request with a source warehouse creates the transfer and updates both sides' stock levels in one call, no duplicate entry. **Gap**: no stock-availability check happens before approval — an approver can approve a request for more units than the source warehouse actually holds, and `stock_levels.quantity` is clamped with `greatest(0, ...)` (2786) rather than rejected, silently producing an inaccurate stock figure instead of surfacing the shortfall.

### Procurement
Real, reasonably rich, but one-directional. `procurementWorkshopPerformance` (14310) computes per-workshop procurement spend, lead time, and budget compliance — genuinely useful data. **Gap**: none of this is surfaced back *inside* the Workshop Overview dashboard — a workshop manager has no visibility into their own outstanding procurement requests or spend without leaving Workshop entirely and going into Procurement Reports. **Gap**: when a Material Request is rejected for lack of stock, there's no bridge to Procurement — staff must manually re-enter the same item/quantity/reason as a new Procurement Requisition (real duplicate-entry gap, §13).

### Logistics
Vehicle-side collaboration is sound: delivery/transport-job vehicle-selection dropdowns already correctly filter `where status='Active'` (confirmed during the Logistics Phase 3 collaboration audit), so a vehicle marked unavailable can't be picked for a delivery. **Gap (already flagged in the Logistics Phase 3 report, reconfirmed here)**: creating a `maintenance_records` entry does not itself change `vehicles.status` — staff must remember to flip status separately, so a vehicle mid-repair could still in theory be selected if that manual step is missed. Machines have no equivalent dispatch/scheduling consumer at all today, so this risk doesn't yet apply to them.

### Fleet
Machines and vehicles are two entirely separate registries with no shared reporting, no shared maintenance-history view, and two separate fuel-log systems (`machine_fuel_logs` vs `fuel_logs`) that are never reconciled against each other despite both existing to answer the same underlying question ("how much fuel did this asset use").

### Finance
**No collaboration exists.** `maintenance_records.cost` is captured on every entry (3060) and is never summed, reported, or surfaced anywhere — not in `workshopOverview`, not in any executive dashboard, not in any Finance-facing query in the entire codebase (verified by search — zero `sum(...cost...)` queries against `maintenance_records`). This mirrors the identical gap already documented for transport/fuel costs in the Logistics audit.

### Management
The strongest link. `workshopOverview` and `machineKpiPerformance` both give genuine, real-time operational visibility (stock, machine availability, downtime, utilization, efficiency vs. KPI targets). This is a solid foundation to build an Executive-tier Workshop dashboard on top of in Phase 3, matching what was done for Logistics.

---

## 6. Collaboration Matrix

| Department | Duplicate entry eliminated? | Auto-synchronized? | Notifications fired? | Audit trail? | Overall |
|---|---|---|---|---|---|
| Inventory | ✅ Yes (material requests → stock movement) | ✅ Yes | ❌ No notification on request/approval/rejection | ✅ `logAudit` on create/approve/reject | 🟡 Good, missing notifications + stock-availability check |
| Procurement | ⚠️ Partial (no bridge for rejected material requests) | ⚠️ One-directional reporting only | — | — | 🟡 Real but incomplete |
| Logistics | ✅ Yes (vehicle status filtering) | ⚠️ Manual status flip required after maintenance | — | — | 🟡 Matches Logistics' own already-documented finding |
| Fleet | N/A — two disconnected registries | ❌ No | — | — | 🔴 Weakest link — machines and vehicles never talk to each other |
| Finance | N/A | ❌ No cost ever reaches Finance | — | — | 🔴 Zero collaboration |
| Management | ✅ Yes | ✅ Yes | N/A | N/A | 🟢 Strongest link |

---

## 7. UI / UX Review

### 7.1 Navigation
Workshop-relevant NAV entries are split across five sections in `renderer/app.js` (lines 137–186): `Operations` (Machine Daily Logs), `Workshop & Inventory` (Workshop Overview, Workshops, Material Requests, plus generic stock pages), `Fleet & Equipment` (Machine Registry, Fuel Logs, Vehicle Fleet), and `Reports & Finance` (KPI Performance). There is no single "Workshop" navigation group a user could click through top-to-bottom — this directly undermines the "feels like one enterprise module" goal and is the single highest-leverage, lowest-risk UI fix available (pure `sec:` label reassignment, zero logic change).

### 7.2 Table/page quality — direct comparison to the Logistics standard
Using the same `table.tbl` + `procFilterBarHtml` + `wireSortableTable` + `.bulk-bar` + detail-overlay pattern established across all 6 Logistics pages as the yardstick:

| Page | Search/filter bar | Sortable columns | Bulk actions | Detail overlay + history | Table class |
|---|---|---|---|---|---|
| Vehicle Fleet (`renderVehicles`) | ✅ | ✅ | ✅ | Partial | `table.tbl` |
| Workshop Overview | ❌ | ❌ | ❌ | ❌ | Mixed `dt`/`tbl` |
| Material Requests | ❌ | ❌ | ❌ | ❌ | `table.tbl` (styled, but no toolkit wired) |
| **Machine Registry** | ❌ | ❌ | ❌ | ❌ | `table.dt` (pre-upgrade) |
| **Machine Daily Logs** | ❌ | ❌ | ❌ | ❌ | `table.dt` (pre-upgrade) |
| **Machine KPI Performance** | ❌ | ❌ | ❌ | ❌ | `table.dt` (pre-upgrade) |

Vehicle Fleet was evidently upgraded in an earlier, separate phase and is the one page already at the Logistics bar. The three Machine pages are in exactly the pre-Phase-2 state every Logistics page used to be in — this is the clearest, most mechanical, lowest-risk win available for a Workshop Phase 2, since the exact toolkit to apply already exists and is proven.

### 7.3 General quality notes
Where `openOverlay`-based forms exist (all pages reviewed have them), they're consistent with the rest of the app — no rogue visual language was found. The gap is entirely about the *table* layer (search/filter/sort/bulk/detail) and the *dashboard* layer (KPI strip/widgets, matching what Logistics Phase 3 built), not about forms or overlays.

---

## 8. CSS Improvement Recommendations

No new CSS classes are needed — every gap in §7 is addressed by *applying* classes that already exist and are already proven in production (`.tbl`, `.filter-bar`, `.bulk-bar`, `.mc`/`.card` KPI tiles, the badge palette, `_statusTimelineHtml`/`_logisticsHistoryHtml`-equivalent helpers). Recommend generalizing the Logistics-specific helper names (e.g. `_logisticsHistoryHtml`) into department-agnostic shared helpers if/when Workshop Phase 2 reuses them, rather than forking a parallel copy — but that's an implementation detail for Phase 2, not a CSS finding in itself. No dark-mode, no new typography scale, no new spacing system needed — the existing design language is sufficient once applied consistently.

---

## 9. Mobile vs Electron Review

| Module | Desktop | Mobile | Parity |
|---|---|---|---|
| Workshop Overview | ✅ | ✅ `WorkshopOverviewScreen.tsx` | ✅ |
| Workshops registry | ✅ | ✅ `WorkshopsListScreen.tsx`/`WorkshopFormScreen.tsx` | ✅ |
| Machine Registry | ✅ | ✅ `MachinesListScreen.tsx`/`MachineDetailScreen.tsx`/`MachineFormScreen.tsx` | ✅ |
| Machine Categories | ✅ | ✅ `MachineCategoriesScreen.tsx` | ✅ |
| Machine Daily Logs | ✅ | ✅ `MachineLogListScreen.tsx`/`MachineLogDetailScreen.tsx`/`MachineLogCreateScreen.tsx` | ✅ |
| Machine Fuel Logs | ✅ | ✅ `MachineFuelListScreen.tsx`/`MachineFuelDetailScreen.tsx`/`MachineFuelCreateScreen.tsx` | ✅ |
| Machine Maintenance Schedule | ✅ | ⚠️ Create-only (`MachineMaintScheduleCreateScreen.tsx`, embedded in `MachineDetailScreen`) — no standalone list | 🟡 |
| **Machine KPI Performance** | ✅ dedicated NAV page | ❌ **No screen exists at all** | 🔴 |
| Material Requests | ✅ | ✅ `MaterialRequestsListScreen.tsx`/`MaterialRequestDetailScreen.tsx`/`MaterialRequestCreateScreen.tsx` | ✅ |
| Vehicle Fleet | ✅ | ✅ `VehiclesListScreen.tsx`/`VehicleDetailScreen.tsx`/`VehicleFormScreen.tsx` | ✅ |
| Vehicle Maintenance | ✅ | ✅ `VehicleMaintenanceCreateScreen.tsx` (create only, embedded in Vehicle Detail) | ✅ (matches desktop's own lack of a dedicated maintenance-history page) |
| Vehicle Fuel Logs | ✅ | ✅ `VehicleFuelLogCreateScreen.tsx` | ✅ |

Mobile parity is actually **better than expected** across most of the module set — the one clear, unambiguous gap is Machine KPI Performance having zero mobile presence, which matters because it's the one module in this whole audit that already gives genuine executive-grade visibility (utilization %, downtime, efficiency vs. targets) — exactly the kind of thing a manager would want to check from a phone.

---

## 10. Reporting Review

- **Operational**: `workshopOverview` covers this reasonably (pending transfers, pending requests, low stock) — adequate.
- **Maintenance Reports**: **do not exist**. No report aggregates `maintenance_records` by type, cost, vehicle, or time period; no report exists for machines at all (only the raw daily-log table).
- **Machine Reports**: `machineKpiPerformance` is a strong per-machine monthly performance table (utilization %, efficiency %, KPI achievement vs. targets) but is not exportable/printable as a "report" — it's a live table only (worth checking whether a CSV export exists; none was found in the render function for this page).
- **Downtime Reports**: downtime hours are aggregated (`machineKpiPerformance`), but `downtime_reason` (captured per log, 8397) is never grouped/reported on anywhere — a manager cannot answer "what's our #1 cause of downtime this month" without manually reading every log row.
- **Workshop Reports**: no page or function exists under this name or concept.
- **Executive Reports**: Workshop data does not appear in the app-wide Executive Dashboard at all (consistent with the Finance gap in §5).

---

## 11. Performance Review

No load-testing was performed (out of scope for a code-only audit), but structural risk factors were identified by inspection:
- `machinesList` (8246) and `machineKpiPerformance` (8562) both run unfiltered, company-wide queries with no `limit` clause — as the machine fleet and log history grow, these will scale linearly with zero pagination, the same class of risk Logistics' list pages had before Phase 2's client-side-over-capped-results pattern was applied.
- `machineLogsList` has no explicit row limit either (8368–8382) — a full year of daily logs across many machines, unfiltered by month, could return a very large result set to the client.
- No structural issue was found in the Material Requests or Workshop Overview queries — both are already reasonably bounded (`limit 100`, `limit 25`).

---

## 12. Security Review

**Verified defects** (all narrowly scoped, no workshop-isolation *model* change implied):

1. **Hardcoded role arrays instead of `mustRole`** on Machine Registry writes and Material Request approval — the exact anti-pattern already found and fixed in Logistics Phase 1 (H4):
   - `machinesCreate` (8263), `machinesUpdate` (8288), `machinesDelete` (8701): `['admin','ceo','logistics']`
   - `machineCategoriesCreate` (8231), `machineCategoriesUpdate` (8716), `machineCategoriesDelete` (8729): `['admin','ceo','operations','logistics']`
   - `materialRequestsApprove` (2762): `['admin','ceo','operations','logistics','supervisor']`
   - `stockTransfersApproveReject` (2511), `stockTransfersDispatch` (2536), `stockTransfersReceive` (2648): similar hardcoded arrays
   - Effect: a custom role granted the relevant page permission through the Roles/Permissions admin UI (but not literally one of the hardcoded role names) can *view* these pages but is silently denied on every write action — permissions-UI promises that the code doesn't honor.

2. **`machines` table is never workshop-scoped**, anywhere it's queried:
   - `machinesList` (8246) — `where m.active = true`, no `isWorkshopRestricted` check at all.
   - `machineKpiPerformance` (8562) — same.
   - `machineFuelSummary` (4853) — same.
   - `machineLogsList`'s own embedded machine-picker dropdown (8383–8386) — same, even though the log *rows themselves* in the same function are correctly workshop-filtered (8357–8366).
   - Effect: a workshop-restricted user sees every machine, every KPI row, and every fuel-reconciliation row company-wide — a real, verified isolation gap, not a hypothetical one.

3. **Permission-key mismatch**: `workshopOverview` (2811) checks `mustRole(user, 'inventory')`, but the role-permission system's own `ROLE_PAGES` fallback constant (data.js:102, 109, 116, 124, 130, 134) treats `'workshop-overview'` as the real, distinct permission key granted to roles. A role granted `'workshop-overview'` but not `'inventory'` would be denied by the backend despite the permission system saying they should have access; the reverse is also true.

**No defect found**: audit logging coverage on Workshop mutations is adequate (every Create/Update/Delete/Approve reviewed calls `logAudit`), though none use the structured `module`/`recordId` opts pattern Logistics Phase 2 introduced — noted as a Phase 2 dependency, not a security defect. Governance/soft-delete wiring on Material Requests and Machine Logs (both have `deleted_at`/`pending_deletion` columns and correctly filter on them) is consistent with the rest of the app.

**Explicitly not recommended**: any change to the workshop-isolation *model* itself (`isWorkshopRestricted`) — the fix for finding #2 is applying the existing, proven pattern (already used correctly by `machineLogsList`'s row query, `workshopOverview`, `materialRequestsList`) to the three call sites that are missing it, not inventing a new isolation mechanism.

---

## 13. Missing Features

Recommended only where justified against an existing workflow, department, or reporting gap — no generic ERP features included.

| Feature | Justification | Departments affected | Priority | Est. effort |
|---|---|---|---|---|
| Consolidate NAV into one "Workshop" section | Removes the navigation fragmentation documented in §7.1; zero logic change | Workshop (all) | High | Small (NAV metadata only) |
| Apply the Logistics table toolkit (search/filter/sort/bulk/detail-overlay+history) to Machine Registry, Machine Logs, Machine KPI Performance | Closes the UI/UX gap in §7.2 using an already-built, already-proven pattern | Workshop | High | Medium (mirrors Logistics Phase 2 exactly) |
| Fix the 2 hardcoded-role-array classes and the `workshops` isolation gap in §12 | Verified defects, narrow fix, matches Logistics Phase 1 precedent | Workshop, security | Critical | Small |
| Maintenance-cost rollup into Finance/Executive Dashboard | Closes the zero-visibility gap in §5/§10; `maintenance_records.cost` already exists, purely additive read | Workshop, Finance, Management | Medium | Small–Medium |
| Downtime-reason breakdown report | `downtime_reason` is already captured per log and unused; removes manual log-reading to answer a basic operational question | Workshop, Management | Medium | Small |
| Bridge rejected Material Requests into a suggested Procurement Requisition | Removes the duplicate-entry gap in §5 (staff currently re-type the same request) | Workshop, Procurement | Medium | Medium |
| Machine KPI Performance mobile screen | Closes the one clear parity gap in §9 for the module with the most executive value | Workshop, Management | High | Medium |
| Stock-availability check before Material Request approval | Prevents the silent stock-clamping behavior in §5 (`greatest(0, ...)`) | Workshop, Inventory | Medium | Small |

**Explicitly not recommended** (would require new business logic/schema, out of scope for "complete the existing workflow"): a full Maintenance Request → Approval → Assignment → Work Order lifecycle. This is the biggest gap in the entire audit (§4), but building it is a genuine new workflow, not a completion of an existing one — it should be scoped as its own deliberate Phase 2/3 decision with explicit user sign-off, not implied by this audit.

---

## 14. Critical Issues

1. Hardcoded role arrays bypassing `mustRole` on Machine Registry writes and Material Request/Stock Transfer approvals (§12.1).
2. `machines` table never workshop-scoped — a real, verified cross-workshop data leak for restricted users (§12.2).
3. `workshopOverview` permission-key mismatch (§12.3).

---

## 15. High Priority Improvements

1. Consolidate Workshop-related NAV entries into a single section (§7.1, §13).
2. Apply the enterprise table toolkit + detail-overlay/history pattern to Machine Registry, Machine Daily Logs, Machine KPI Performance (§7.2, §13).
3. Build a Machine KPI Performance mobile screen (§9, §13).
4. Add pagination/limits to `machinesList` and `machineKpiPerformance` before they become a real performance problem (§11).

---

## 16. Medium Priority Improvements

1. Maintenance-cost rollup into Finance/Executive visibility (§5, §10, §13).
2. Downtime-reason breakdown report (§10, §13).
3. Stock-availability check before Material Request approval (§5, §13).
4. Bridge rejected Material Requests into Procurement (§5, §13).
5. Surface a workshop's own procurement spend/pending requests inside Workshop Overview (§5).

---

## 17. Low Priority Improvements

1. Reconcile the two separate fuel-log systems (machine vs vehicle) into a single reporting view, or at least a shared summary (§5).
2. Adopt structured `logAudit` `module`/`recordId` opts on Workshop mutations, enabling a future per-record history view matching Logistics' `logisticsRecordHistory` (§4, §8).
3. Standalone Machine Maintenance Schedule list screen on mobile (currently embedded-only) (§9).

---

## 18. Recommended Phase 1 Roadmap (Critical Issues & Security)

- Fix the 3 Critical Issues in §14 (hardcoded role arrays, missing workshop isolation on `machines`, permission-key mismatch).
- Verify via live smoke test, exactly as done for Logistics Phase 1.
- No UI changes required for Phase 1 — this mirrors Logistics Phase 1's scope precisely (defects only, no redesign).

## 19. Recommended Phase 2 Roadmap (Functional Completion & Professional UI/UX)

- Consolidate NAV (§7.1).
- Apply the table toolkit + detail-overlay/history pattern to Machine Registry, Machine Daily Logs, Machine KPI Performance, and Material Requests (§7.2, §13).
- Add pagination to the two unbounded queries (§11).
- Stock-availability check before Material Request approval (§13).
- Downtime-reason breakdown report (§13).
- Build the Machine KPI Performance mobile screen (§13).

## 20. Recommended Phase 3 Roadmap (Executive Visibility & Collaboration)

- Maintenance-cost rollup into Finance/Executive Dashboard (§13).
- Surface procurement spend/pending-requests inside Workshop Overview (§5).
- Bridge rejected Material Requests into Procurement (§13).
- Executive KPI strip + Operational Widgets on Workshop Overview, mirroring the Logistics Phase 3 dashboard pattern exactly (utilization, downtime, availability, pending approvals, alerts).
- Decision point (requires explicit user sign-off, not implied by this audit): whether to build a genuine Maintenance Request/Work Order lifecycle, given it's new business logic rather than a completion of existing workflow (§13).

## 21. Production Readiness Assessment

**Not production-ready as a unified "Workshop Department."** Individually, most of the underlying pieces (Machine Registry, Machine Logs, Material Requests, Vehicle Maintenance, Workshop Overview) are functionally correct and already in production use — this is not a "broken" system. What's missing is the enterprise packaging: unified navigation, consistent UI quality across all its pages, closed security gaps, and cross-department financial/executive visibility. The 3 Critical Issues should be treated as a required Phase 1 before any further Workshop investment, exactly as was done for Logistics. After Phase 1–3 (estimated at a similar scope to the Logistics 3-phase arc, given the two departments' structural similarity), Workshop would reach the same production-readiness bar Logistics achieved.
