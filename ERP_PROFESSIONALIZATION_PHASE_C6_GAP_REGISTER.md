# Phase C6 — Audit Log Security & Workshop Isolation — Gap Register

## Workshop Context Matrix (by module, 238 call sites)

Method: every `logAudit(...)` call site in `db/services/data.js` was located (238, precisely
recounted this phase — see Completion Report §4 for why the prior "239" figure was off by one).
168 already carried an explicit `module:` tag and were bucketed by it; 71 did not and were
bucketed by enclosing function name instead.

| Module bucket | Call sites | Classification | Handling |
|---|---|---|---|
| procurement | 26 | A (workshop-scoped, `procurement_purchase_orders`/`procurement_requisitions` both carry `workshop_id`) | Default derivation (actor's own workshop) correct for the large majority; explicit override threaded where an exempt actor + a locally-available record variable existed |
| payroll | 13 | A/B mixed — payroll periods/lines are company-wide constructs but individual entries can be workshop-attributed via the underlying attendance/casual record | Explicit override threaded where a record variable (`period`, `line`) was locally available |
| srm | 11 | A (supplier/contract records are workshop-agnostic in most cases, but several call sites act on a workshop-scoped requisition/PO) | Explicit override threaded where available; remainder on safe default |
| finance | 8 | Mixed — stock-count/exception-center records are workshop-scoped (`session`, `c` records) | Explicit override threaded |
| stock_transfers | 7 | **C — genuinely ambiguous** (`from_warehouse_id`/`to_warehouse_id`, no single "owning" workshop) | Resolved conservatively: attributed to the *initiating* side only (the requesting/from workshop), never both — never over-exposes; the receiving workshop's visibility into "a transfer arrived" is a documented, accepted limitation, not silently guessed |
| sales | 6 | A (`sales_orders.workshop_id`) | Fully threaded, hand-verified (all 6 sites) |
| material-requests | 5 | A (`material_requests.workshop_id`) | Fully threaded, live-tested end-to-end (primary E2E suite) |
| deliveries | 5 | A (via `sales_orders.workshop_id` through a join — delivery_orders itself has no workshop column) | Threaded — 3 of the 5 threaded sites were among the 7 bugs found+fixed (SQL-alias-vs-JS-variable confusion, see Changelog) |
| rejection_holds | 5 | A (`rejection_holds.workshop_id`) | Threaded via `hold.workshop_id` |
| maintenance_jobs | 5 | A (`maintenance_jobs.workshop_id`) | Default derivation correct for the actor-driven majority |
| automation | 5 | **B — global/system** (automation rule config is company-wide) | Correctly falls to default (NULL for the always-exempt actors who configure it) |
| quality_inspections | 4 | A (`quality_inspections.workshop_id`) | Threaded via local `workshopId`/`offcut.workshop_id` |
| transport-jobs | 4 | **C — ambiguous** (spans a sales order and its linked delivery order, two candidate workshop sources) | Left on safe default rather than guessed — flagged explicitly during threading, not silently picked |
| Escalation | 4 | **B — global/system** | Correctly falls to default |
| logistics, warehouses, stock_catalog, vehicles, dispatch, transport, machine_fuel_logs, attendance, machines, machine-logs, machine_kpi_definitions, machine_maintenance_schedules | 3 each | Mixed A/B — fleet/logistics infrastructure (vehicles, dispatch, transport, fuel logs, maintenance records) is genuinely company-wide (no `workshop_id` column exists on any of those tables); `attendance`/`machines`/`machine_maintenance_schedules` are workshop-scoped | Default derivation for fleet modules (correct — they have no workshop concept to override with); explicit threading for the workshop-scoped ones (`machineMaintScheduleUpdate`/`Delete` were 2 of the 7 bugs found+fixed) |
| stock_movements, fuel_logs, maintenance_records, machine_log_categories, System, epm | 2 each | B (global/system) or A-via-actor (stock movements inherit the actor's own workshop, matching the isolation already enforced on the write path) | Default derivation |
| pole_production_batches, production_offcuts, customers, compartments, harvest_waste, resolution_records, showroom_damage_reports, value_added_production_batches, casuals, machine_kpi_targets, machine_categories, Security | 1 each | Mixed | Threaded where a record variable existed (poles, offcuts, VAT batches, casuals); default elsewhere |
| *(no module tag, 71 sites)* | 71 | Mixed — bucketed by function name (see Completion Report §5); includes genuinely global admin functions (`rolesUpdate`, `usersCreate/Update/Delete`, `changesCreate/Review`, `monthlyApprove`, `weeklyExpensesSave`, `kpiBudgetSave`) which are always invoked by workshop-exempt actors, so the default derivation self-classifies them correctly as global (`workshop_id = NULL`) without needing any special-casing — confirmed live in the E2E suite (test 21) | Default derivation (self-correct by construction) for the genuinely global ones; explicit threading for the workshop-scoped ones (harvest, poles, log transport, daily logs, trash restore, VAT production) |

**10 call sites classified Type C (ambiguous) and deliberately left unresolved** rather than
guessed: `_applyDeliveryOrderPOD`, `transportJobsUpdate`/`Delete`/`Create`/`UpdateStatus` (4,
sales-order-vs-delivery-order ambiguity), `resolutionCreate` (source record vs. rejection hold),
`payrollPeriodCalculate` (period vs. multiple person/line records), `maintenanceJobLabourAdd`/
`maintenanceProductionImpactCreate` (job vs. machine), `procurementGoodsReceiptInspect` (PO vs.
goods-receipt item). Each still safely defaults to the actor's own workshop (or NULL if exempt) —
the ambiguity only affects completeness for an exempt actor acting on someone else's workshop
record, never security (no path over-exposes).

## Candidates considered before selecting the implementation approach

This phase had exactly one selected item (NF-01 itself, per the brief's explicit instruction —
not a multi-candidate scoring exercise like C1-C5). The design-level choice actually requiring
judgment was **how to handle the 238 call sites without hand-editing all of them individually**:

| Approach | Considered | Disposition |
|---|---|---|
| Hand-edit all 238 call sites individually | Yes | Rejected — infeasible within a single phase at the rigor this requires, and the mechanical parts don't need it (see below) |
| Derive `workshop_id` from acting user by default, override explicitly only where needed | **Selected** | Correct for the large majority *by construction* (existing Workshop Isolation on write paths already ties actor-workshop to record-workshop for workshop-scoped actors); only ~64 sites needed an explicit override, not 238 |
| A single global default with no per-site overrides at all | Considered, rejected | Would have left every "exempt actor acts on a specific workshop's record" case (e.g. admin approving a Nyanza requisition) incorrectly NULL — safe, but a real completeness regression compared to what's achievable |
| Auto-thread the override via a scripted heuristic, ship without verification | Considered, rejected | This is exactly what produced the 7 bugs — shipping the heuristic's output without a dedicated scope-verification pass would have shipped 7 real defects (5 crash-class `ReferenceError`s, 1 edge-case `TypeError`, 1 pre-existing-conditional workshop lookup bug) straight to production |

## Disposition

### NF-01 — Audit Log has zero Workshop Isolation
- **Type**: SECURITY FINDING (discovered Phase C4, re-assessed Phase C5, **resolved Phase C6**).
- **Disposition**: **RESOLVED.** Schema extended, all 3 write paths (`logAudit`,
  `handleAuditReplay`, `auditLogin`) derive or accept trusted workshop attribution, read access
  enforces `isWorkshopRestricted` server-side via a single shared query-builder also used by the
  new export function, parameter-override attempts are ignored server-side, and 26/26 live
  security/functional checks passed against production data with two disposable QA accounts in
  two different workshops. Historical rows are preserved and grandfathered, not altered. See the
  Completion Report for full section-by-section detail and the exact reasoning behind every
  design decision (especially §8's no-backfill decision and §15's live permission audit).

## Business decisions

**None required.** Every decision this phase made (no-backfill, grandfather-cutover, global-event
NULL-attribution, initiating-side-only for stock transfers, leaving 10 ambiguous sites
unresolved) was a security/engineering-design judgment call within the brief's own stated
principles (never fabricate a workshop, never guess, prefer under-exposure to over-exposure),
not a pricing/policy question requiring stakeholder input.
