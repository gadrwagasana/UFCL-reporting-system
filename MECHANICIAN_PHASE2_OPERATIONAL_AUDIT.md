# Mechanician Phase 2 Pre-Implementation — Maintenance Operations Enterprise Audit

**Audit only.** No code was written, no permissions were changed, no roles were created, no database was modified. Every finding below was verified against source code (file:line) and, where noted, cross-checked against Phase 1's live-tested behavior.

## 1. Executive Summary

Phase 1 fixed the *back half* of the mechanician's workflow: requesting materials, tracking approval, and seeing the resulting stock transfer through to completion all work correctly now. This audit examines the *front half* — actually recording the maintenance work itself — and finds it is still entirely closed to this role, for the same reason as before Phase 1: mechanician holds none of `machines`, `machine-logs`, or `machine-fuel`.

But the more important finding is what granting those permissions would — and would not — actually deliver. **The underlying maintenance data model in this ERP is a daily operating-hours log (`machine_daily_logs`) plus a recurring-reminder schedule (`machine_maintenance_schedules`) — not a work-order system.** Neither table has a completion state, a labor-hours-by-person field, a spare-parts linkage, or any completion-evidence concept. This is true for *every* role today, not a mechanician-specific gap. So the honest framing for Phase 2 is: granting mechanician the existing `machine-logs`/`machine-fuel` permissions would bring it to parity with what a supervisor already has — a real, useful, but modest capability — not a full "open a job, track labor and parts, close it out" experience, because that experience doesn't exist in this codebase for anyone yet.

On the Officer/Assistant question: there is no operational evidence in the current permissions, workflows, screens, or data model to justify a two-tier split. No assignment mechanism exists to divide "who assigns work" from "who does it," and no task-level granularity exists to divide between a planning tier and an execution tier. The recommendation is to not create the split now, and to treat "genuine task-level assignment exists" as the natural future trigger to revisit the question — not before.

## 2. Current Maintenance Architecture

Two independent, unlinked tables carry all machine-side maintenance data:

- **`machine_daily_logs`** (`db/schema.sql:499-515`) — one row per machine per shift: `hours_worked` (machine operating hours, not a technician's labor hours — confirmed by its co-fields `daily_production`, `capacity_per_day`, `loading_trips`), `downtime_hours`, `downtime_reason`, `remarks` (free text), `created_by` (who logged the entry). Governed by `machineLogsList/Create/Update/Delete` (`data.js`), gated on `machine-logs` or `machines`.
- **`machine_maintenance_schedules`** (`db/schema.sql:527-537`) — one row per recurring maintenance type per machine: `maintenance_type`, `frequency_days`, `last_performed`, `next_due`, `estimated_hours` (a planning estimate, not actual time taken), `notes` (free text). No user-attribution column at all. Governed by `machineMaintScheduleList/Create/Update/Delete` (`data.js:10049,10072`+), gated on `machines` (create/update/delete) or `machines`/`machine-logs` (list).

Vehicle-side maintenance (`maintenance_records`, Fleet's domain) is architecturally separate — confirmed no FK or shared table with the machine side, and correctly out of scope for mechanician (machine maintenance and vehicle maintenance are different operators' jobs, per the Fleet & Equipment audit).

Material requests (`material_requests`, now usable by mechanician per Phase 1) has no column linking a request to a machine, a log, or a schedule row — only a free-text `reason` field.

## 3. Maintenance Workflow Analysis

```
Machine
  ↓
Maintenance need — no formal trigger beyond machine_maintenance_schedules.next_due
  reaching today, or an ad-hoc downtime_reason noted in a daily log. There is no
  distinct "maintenance request/ticket" step — the schedule row itself doubles as
  the only forward-looking signal.
  ↓
Maintenance Recording — machine_daily_logs (downtime) or machine_maintenance_schedules
  (last_performed/next_due), whichever the user happens to use. No unified record ties
  a single maintenance EVENT together across both tables.
  ↓
Material Request — [FIXED IN PHASE 1] mechanician can now create/track requests, but
  they carry no link back to which machine/schedule/log the materials are for — only
  free text in `reason`.
  ↓
Stock Transfer — works exactly as designed (unchanged, Phase 1 didn't touch this).
  ↓
Inventory Consumption — works (transfer receive moves stock_levels correctly, live-
  verified in Phase 1).
  ↓
Completion — DOES NOT EXIST AS A DISTINCT STATE. "Completing" maintenance today means
  manually re-editing last_performed/next_due on the schedule row via the same generic
  edit form used to create it (data.js:10202-10225) — there is no status transition,
  no "mark as done" action, for any role.
  ↓
History — machineLogsList/machineMaintScheduleList — both still denied to mechanician
  (unchanged from before Phase 1); for roles that DO have access, it's a flat list, not
  a curated "history of this maintenance event" view.
  ↓
Reporting — workshopOverview() aggregates (fuel/downtime/utilization totals) are
  unattributed to any individual; per-user attribution only exists via the generic
  audit_log feed, and only for non-workshop-restricted roles (data.js:3802).
```

**Where the workflow ends today, for mechanician specifically:** it now runs cleanly from Material Request through Inventory Consumption (Phase 1's fix). It cannot *start* — mechanician cannot record the maintenance need or the work performed — and it cannot *close* — even a fully-permissioned role has no real completion step, only a field edit.

## 4. Responsibility Matrix

| Domain | Who actually holds it today | Evidence |
|---|---|---|
| Logistics Manager | `logistics` role | Full, correctly-implemented oversight: `machines`, `machine-logs` (via `machines`), `machine-fuel`, `vehicles`, `material-requests`, `stock-movements`, `workshop-overview` (`db/migrate.js:768-778`). Unchanged, still correct. |
| Mechanician | `mechanician` role | `material-requests` (works, Phase 1), `dashboard`, `notifications`, plus the blanket `procurement-requisitions` grant. Nothing else. |
| "Workshop" | Anyone holding `workshop-overview` | Aggregate, cross-machine visibility only (`workshopOverview()`) — not a role, a permission any of several roles can hold. Provides no individual-technician attribution for workshop-restricted holders. |
| Inventory | Storekeeper-tier roles (`stock-transfers`/`stock-movements` holders) | Handles dispatch/receive of whatever a material request turns into — has no visibility into which machine/job triggered the request, because that link doesn't exist. |

**Per-responsibility classification** (from the audit brief's checklist):

| Responsibility | Status | Why |
|---|---|---|
| Recording maintenance (schedule) | Exists but inaccessible (mechanician); Partially Supported in general | Schedule create/edit works for permissioned roles, but has no completion tracking for anyone. |
| Recording repairs | **Missing** | No discrete "repair" concept distinct from the recurring schedule exists for machines, for any role. |
| Recording labour | **Missing** | No per-person labor-hours field exists anywhere (`machine_daily_logs.hours_worked` is machine operating hours; `casual_labour_requests` is a headcount-request mechanism, not a labor log — confirmed no `machine_id` or per-person hours field on it). |
| Recording downtime | Exists but inaccessible (mechanician) | `machine_daily_logs.downtime_hours`/`downtime_reason` — fully functional for `machine-logs` holders. |
| Recording maintenance duration | Partially Supported | `estimated_hours` is a planning field on the schedule, set once; no actual-time-taken field, no start/end timestamps, for anyone. |
| Recording spare parts used | **Missing** | No FK or reference-matching link between `material_requests`/`stock_movements` and a specific machine job, for any role. |
| Recording additional material requests | **Fully Supported** (mechanician) | Phase 1 fix — live-verified end-to-end. |
| Recording fuel usage | Exists but inaccessible (mechanician) | `machineFuelLogsCreate` fully functional for `machine-fuel` holders. |
| Recording repair notes | Exists but inaccessible; Partially Supported in general | Only free-text `remarks`/`notes` fields — no structured repair log for anyone. |
| Recording completion evidence | **Missing** | No photo/checklist/signoff concept exists for machines (or, as previously found, for vehicles — `vehicles.doc_photos` is unused/broken). |
| Closing maintenance | **Missing** | No status/state concept on `machine_maintenance_schedules`, for any role. |
| Reviewing maintenance history | Exists but inaccessible (mechanician) | Flat list, functional for permissioned roles. |

## 5. Officer/Assistant Assessment

**Recommendation: do not create the split now — the evidence doesn't support it.**

Evidence reviewed:
- **No assignment mechanism exists** (confirmed again this audit — `assigned_to`/`assignee`/`work_order` still return zero matches anywhere). An Officer/Assistant split conventionally hinges on "the Officer assigns, the Assistant executes" — that distinction cannot be data-modeled with what exists today without new schema, which is out of this audit's and Phase 2's scope.
- **No task-level granularity exists to divide.** A maintenance schedule row is a single undifferentiated unit — there's no sub-task, no diagnosis-vs-repair split, no planning-vs-execution distinction anywhere in the data model that a two-tier role could map onto.
- **The only real precedent for a two-tier split in this codebase is `storekeeper`/`storekeeper-assistant`** (`db/migrate.js:596, 790-791, 836-840`) — and that split exists because those two roles genuinely have different, independently-defined permission sets (the assistant is scoped narrower on purpose, both already fully built). No equivalent pair of independently-justified permission sets has been requested or designed for Mechanician; inventing one now would be manufacturing a distinction to fit a title, not responding to an operational need.
- **No workflow evidence of the two-tier need surfaced during Phase 1's live testing or the original audit** — the business's own stated need throughout has been singular ("requests spare parts and maintenance materials"), matching the single seeded role.

If the business later introduces genuine task-level assignment (a real work-order or job-ticket system, per §16's Phase 3 roadmap), that is the natural point to revisit this question, since assignment data is exactly what would let an Officer/Assistant split mean something operationally rather than being a label over identical permissions.

## 6. Cross-Department Collaboration

| Department | Existing integration | Gap |
|---|---|---|
| Fleet | Cleanly separated by design (machine vs. vehicle maintenance, different tables, different permission, no FK) — confirmed unchanged, correct. | None — this is intentional, not a gap. |
| Workshop | `workshopOverview()` aggregates fuel/downtime/utilization from `machine_daily_logs`, machine status counts, maintenance trend (`data.js:3776-3833`+). | All aggregate/unattributed; workshop-restricted roles don't get the audit-log attribution feed non-restricted roles get (`data.js:3802`). |
| Inventory | Material Request → Stock Transfer → Consumption chain works generically (Phase 1 confirmed for mechanician specifically). | No attribution back to which machine/job the consumed stock served — Inventory-side roles can never answer "what did this get used for" beyond free text. |
| Logistics | Logistics Manager has full, correct oversight (§4). | None. |
| Procurement | `procurement-requisitions` works as a parallel request channel (Phase 1 audit finding, unchanged). | Still two disconnected "request materials" paths coexisting — a UX-clarity question, not fixed by this audit. |
| Finance | Vehicle-side `maintenance_records.cost` rolls into Fleet's cost reporting. **Machine-side has no cost field at all** — `machine_maintenance_schedules` and `machine_daily_logs` carry no cost column anywhere. | Real asymmetry: machine maintenance can never be financially reported on the way vehicle maintenance can, for any role, today. |
| Management | No executive dashboard references machine maintenance activity with individual attribution — only anonymous aggregates. | Consistent with the Fleet & Equipment audit's own finding; unchanged. |

## 7. Dashboard Review

Phase 1's `mechanicianDashboard()` already covers, from existing data: My Material Requests (KPIs + recent list), Machines Requiring Attention (workshop-scoped), Upcoming Maintenance (workshop-scoped, from the schedule table).

Against the brief's checklist:

| Item | Status |
|---|---|
| Assigned maintenance | Not shown — cannot be shown, no assignment concept exists. |
| Machines requiring service | ✅ Already shown (Phase 1). |
| Vehicles requiring service | Correctly absent — vehicles are Fleet's domain, not this role's. |
| Overdue maintenance | ✅ Already shown as "Upcoming Maintenance" (next 14 days; a true "overdue" split — next_due < today — was not built in Phase 1 and would be a small, additive Phase 2 refinement). |
| Material Requests | ✅ Already shown (Phase 1). |
| Linked Stock Transfers | ✅ Already shown (transfer_status on each recent request). |
| Spare parts | Not shown — no linkage exists to show it against. |
| Fuel activity | Not shown — mechanician has no `machine-fuel` read access; could be added read-only (matching how "Machines Requiring Attention" already exposes machine data without granting full `machines` access) as a Phase 2 item if fuel permissions are granted. |
| Notifications | Reachable, but structurally near-empty for this role beyond the material-request personal notifications Phase 1 restored. |
| KPIs | Present for material requests only; no maintenance-specific KPIs (jobs logged, downtime hours) since the role can't create that data yet. |

## 8. UI/UX Review

- **Machine Logs (desktop)** — mature: search/filter/sort, KPI cards (`renderer/app.js:12311`+). No tabbed detail overlay, no bulk actions, no `_lgdWidget` — behind the enterprise standard set by Procurement/Logistics/Workshop/Inventory/Fleet, unchanged since the earlier Fleet audit.
- **Maintenance Schedules (desktop)** — **no dedicated screen exists at all.** Reachable only as a per-machine sub-panel/overlay launched from the Machines list or Machine detail view (`renderer/app.js:11899, 12129-12233, 12258`). There is no way to see maintenance schedules across machines/workshops in one place today, for any role.
- **Machine Logs (mobile)** — functional create/detail/list screens capturing downtime/remarks correctly (the reference implementation for what "working" looks like).
- **Maintenance Schedules (mobile)** — **create-only.** No list or detail screen exists — a permissioned mobile user can add a new schedule but cannot view existing ones. This is a real gap independent of mechanician's access question.

## 9. Mobile/Desktop Review

| Screen | Desktop | Mobile |
|---|---|---|
| Machine Logs | Search/filter/sort, no overlay | Full create/detail/list |
| Machine Fuel | Search/filter/sort + detail (Fleet Phase 2) | Search/filter + detail |
| Maintenance Schedules | Per-machine sub-panel only | Create-only, no list/detail |

Mobile is actually slightly ahead of desktop on Machine Logs (has a detail screen desktop's toolkit doesn't extend to) but meaningfully behind on Maintenance Schedules (no viewing at all). Neither gap is mechanician-specific — both would need addressing for whichever roles eventually use these screens.

## 10. Critical Issues

1. **Mechanician still cannot record the maintenance itself.** Phase 1 fixed the request-and-track half of the workflow; the record-the-work half (`machine-logs`, `machine-fuel`, `machines`) is untouched, so "complete an entire maintenance activity inside the ERP" remains impossible for this role.
2. **There is no genuine maintenance-completion concept in this ERP, for any role.** This is a data-model gap, not a permission bug — granting mechanician full machine access would not, by itself, produce a "close out a job" experience, because none exists yet.
3. **No spare-parts-to-maintenance-job linkage exists, for any role.** A material request can never be traced back to which repair consumed it except by free text.

## 11. High Priority Improvements

4. **Machine-side maintenance has zero cost tracking** — unlike vehicle-side `maintenance_records.cost`, there is no cost field anywhere on `machine_daily_logs`/`machine_maintenance_schedules`. Machine maintenance can never be financially reported the way vehicle maintenance can.
5. **No dedicated Maintenance Schedule screen exists on either platform** — it's a per-machine sub-panel on desktop and a blind create-only flow on mobile. This limits operational visibility for every role that touches maintenance scheduling today, not just mechanician.
6. **Mobile Maintenance Schedule has no list/view capability at all** — a real, independent gap worth fixing regardless of the mechanician decision.

## 12. Medium Priority Improvements

7. **No per-technician labor-hours tracking exists anywhere** — `casual_labour_requests` is a different concept (requesting temporary headcount, not logging an individual's hours against a job) and cannot be repurposed for this without redesign.
8. **No completion-evidence concept (photos/checklist/signoff) exists for machines** — matches the already-known gap on the vehicle side (`doc_photos`, unused/broken).
9. **Desktop Machine Logs lacks the tabbed-overlay/bulk-action/widget layer** other modernized departments already have — cosmetic, carried over from the earlier Fleet audit, still true.

## 13. Low Priority Improvements

10. A true "Overdue Maintenance" split (next_due < today, distinct from "upcoming") on the mechanician dashboard would be a small, additive refinement using data already fetched.
11. `workshopOverview`'s audit-log attribution feed could, if ever extended to workshop-restricted roles, give mechanician (or any restricted role) some visibility into "who did what" without needing a new schema column — worth noting as a cheap partial mitigation for the missing per-technician tracking, not a substitute for it.

## 14. Production Readiness

**A mechanician cannot complete an entire maintenance activity inside the ERP today**, and — this is the audit's central point — **neither could a fully-permissioned role**, because the "complete" step doesn't structurally exist. Two separate blockers, not one:
- **Access blocker** (fixable in a permission-only Phase 2): mechanician lacks `machine-logs`/`machine-fuel`/`machines`, so it can't reach even the existing, modest recording capability.
- **Capability blocker** (not fixable without new schema — a genuine Phase 3 decision): even full access wouldn't yield labor tracking, spare-parts linkage, cost tracking, or a real completion/close-out state, because those don't exist for any role in this ERP yet.

## 15. Recommended Phase 2 Implementation

Scoped to what already exists elsewhere in the app — no new schema, no new workflow, matching the Phase 1 discipline:
- Grant mechanician `machine-logs` and `machine-fuel` (record daily logs including downtime/remarks; log fuel) — brings this role to parity with what other roles already have, closing the loop Phase 1 left open. Recommend this over also granting full `machines` (registry CRUD) unless the business confirms mechanicians need to *register* machines, not just operate against existing ones — flagged for your decision, not assumed.
- Extend `mechanicianDashboard()` with a "Recent Machine Activity" widget (logs/fuel entries this user created) once the above access exists — purely additive, same pattern as the existing widgets.
- Build a dedicated Maintenance Schedule screen (desktop nav entry, mobile list/detail) — independently justified by §8/§11's findings regardless of the mechanician decision, and would let mechanician's "Upcoming Maintenance" dashboard widget deep-link somewhere real.
- Bring desktop Machine Logs up to the same tabbed-overlay/widget standard as the rest of the enterprise UI (§12).

## 16. Recommended Phase 3 Roadmap

Genuine new capability, requiring schema changes and explicit business decisions — not a permission fix:
- A real maintenance-completion/close-out state (status field or a job-instance table) so "closing maintenance" becomes a real action instead of a field edit.
- Spare-parts-to-maintenance-job linkage (e.g. an optional `machine_maintenance_schedule_id`/`machine_daily_log_id` on `material_requests`) so consumption can be traced to the work it served.
- Per-technician labor-hours recording, distinct from the existing machine-operating-hours field.
- Cost tracking for machine maintenance, bringing it to parity with vehicle-side `maintenance_records.cost`.
- Completion evidence (photos/checklist) — ideally solved once for both machines and vehicles together, since neither has a working upload pipeline today.
- Only once the above exists would revisiting the Officer/Assistant question (§5) have real operational substance to hinge on.

---

## Stop Point

This is an audit only. No code was written, no permissions were changed, no roles were created, and no workflow was redesigned. Awaiting your review and approval before any Phase 2 implementation begins.
