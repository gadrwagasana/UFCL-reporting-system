# UFCL ERP — Logistics Department Enterprise Audit

*End-to-end workflow, collaboration, and professional-ERP-standards review. Research-only — no code, schema, or business logic was changed to produce this document. Every finding below cites the verified source file/line it was drawn from.*

---

## 1. Executive Summary

The Logistics department (Delivery Orders, Dispatch, Transport Carriers, Transport Jobs, plus a "Logistics Dashboard" and a "Legacy Logistics" spare-parts page) is **functionally present on desktop but only partially usable in practice**, and **materially behind on mobile**. The core data model is sound — deliveries link to Sales Orders, dispatch cascades status back onto both, transport jobs link to carriers/vehicles — but several defects break real operational use before this can be called production-grade:

- The mobile "Record Delivery from Sales Order" flow calls a backend function that **does not exist**, and fails silently (no error surfaced, request just hangs).
- Every governance-blocked edit/delete on a Logistics record (the normal path once a record is more than 5 minutes old) shows the user the literal text **"undefined"** instead of an approval-pending message, because the UI never reads the `pendingApproval`/`message` fields the backend returns.
- Those same governance approval requests, once created, **can never be approved or rejected** — no page in the app surfaces `delivery_order`/`dispatch_request`/`transport_job` pending-edit or deletion requests to any manager. They are created, escalated, and notified into a dead end.
- **No stock reservation or deduction happens anywhere in the delivery/dispatch pipeline** — a delivery can be fully dispatched with no check against real warehouse stock levels, unlike Procurement's Goods Receipt (a closely analogous "delivery" concept), which correctly updates stock.
- The `logistics-officer` role is shown a 14-tab mobile navigator, but roughly 6 of those tabs 403 at the API layer because the mobile navigation and the backend route guards were built from two different permission lists.
- Transport Carriers and Transport Jobs — full CRUD modules on desktop — **have no mobile presence at all.**
- The one server-side security gap found: `logisticsDashboard()` has **no permission check whatsoever** — any authenticated session can call it via IPC regardless of role.

None of this requires redesigning how UFCL operates. Every recommendation below either completes an already-half-built workflow, fixes a defect in existing code, or adds a capability (search/filter/export/notifications) that the rest of the ERP already has elsewhere and Logistics is simply missing. Section 15 lists the four items that should be treated as blocking before this department can be considered reliable; Sections 16–18 rank everything else.

---

## 2. Department Overview

Logistics, as defined by the desktop navigation (`renderer/app.js:172-178`, `sec: 'Logistics'`), consists of exactly six pages:

| Page | Purpose |
|---|---|
| Logistics Dashboard | Read-only operational overview |
| Delivery Orders | Create/track deliveries against Sales Orders, record Proof of Delivery |
| Dispatch | Single-stage approval queue that authorizes a delivery to actually leave |
| Transport Carriers | Third-party carrier master data (name, contact, rate/km) |
| Transport Jobs | Logged haulage jobs against a carrier or own vehicle |
| Legacy Logistics | Spare-parts/materials mini-inventory, unrelated to deliveries |

Two things are worth stating plainly because they recur throughout this audit:

1. **"Logistics" means at least four different things in this codebase**, and they disagree with each other (see §3). Material Requests, Stock Transfers, and Warehouses — which most operations teams would consider logistics work — are filed under "Workshop & Inventory" in the NAV, not here. Vehicle Fleet is its own "Fleet & Equipment" section. Yet the User Management department dropdown, the KPI Scorecard seed data, and the permissions-checklist UI each draw the department boundary differently from the NAV and from each other.
2. **"Delivery" is used for two entirely unrelated concepts.** Procurement's Goods Receipt (supplier → UFCL) and this department's Delivery Orders (UFCL → customer) share no table, no foreign key, and no code path — confirmed by direct inspection of both. A new user reading page/report names alone would reasonably assume these are related; they are not.

---

## 3. Current Architecture

```
Sales Order (sales_orders)
      │  deliveryOrdersCreate()              — data.js:3086
      ▼
Delivery Order (delivery_orders) ──────────────┐
      │  dispatchCreate()  — data.js:3311      │  vehicle_id → vehicles (Fleet & Equipment)
      ▼                                        │
Dispatch Request (dispatch_requests)           │
      │  dispatchReview()  — data.js:3327      │
      │  (cascades status back to              │
      │   delivery_orders + sales_orders)       │
      ▼                                        │
[Dispatched] ──── deliveryOrdersRecordPOD() ────┘ (data.js:3191, updates sales_orders qty fields)
      │
      ▼
Proof of Delivery recorded — workflow complete

Transport Jobs (transport_jobs) — a parallel, loosely-coupled haulage log:
  FKs to transport_companies, vehicles, sales_orders, delivery_orders (all nullable/optional)
  Not required for a delivery to complete; used for carrier-cost tracking only.
```

Backend: all logic lives in `db/services/data.js` (functions listed in §4). Desktop renders directly against these via IPC (`electron/main.js`/`preload.js`). Mobile goes through `mobile-api/routes/*.js` REST wrappers to the same `data.js` functions — architecturally correct (no duplicated business logic found), but §10 documents where the REST layer itself has bugs or gaps that desktop doesn't have.

Three governance mechanisms apply generically to every mutating Logistics function: `applyGovernance`/`timeGatedAuthorization` (time-based edit/delete approval), `logAudit` (audit trail), and `pushNotification` (in-app alerts). All three are shared infrastructure used across the whole ERP, not Logistics-specific — which is exactly why the gaps found in §6/§13 are structural rather than one-off bugs.

---

## 4. Module-by-Module Review

### 4.1 Logistics Dashboard
- **Functional completeness**: read-only by design (no create/edit/approve expected). KPI cards, per-workshop cards, low-stock table, recent-movements table all present. No search, filter, or export — acceptable for a pure overview page, though a "view all" link into the underlying stock pages would help.
- **Workflow**: N/A (informational only).
- **Integration**: reads `warehouses`/`stock_levels`/`stock_catalog`/`stock_movements` — i.e., despite its name and NAV placement, its actual content is a **stock/workshop summary**, not a delivery/dispatch/transport summary. This is a naming/content mismatch, not a bug, but it means the department has no dashboard that actually reflects its own core workflows.
- **Security**: `logisticsDashboard()` (data.js:4961) has **no server-side permission check at all** — critical finding, see §13.

### 4.2 Delivery Orders
- **Functional completeness**: Create, inline status change, Record POD, Edit, Delete all present. Missing: search box, filter control, export, pagination/pagination-disclosure (query is `limit 200`, silently truncated).
- **Workflow**: Begins from a Sales Order (or, per the create form, presumably standalone — not fully clear whether a delivery can exist with no linked SO; worth a quick manual check since the schema allows `sales_order_id` to be nullable). Processing/completion is the create → status-change → POD chain described in §3. All steps are logged to audit.
- **Integration**: `sales_orders.qty_dispatched_total`/`status` updated automatically on create; `qty_accepted_total`/`qty_rejected_total`/`qty_remaining`/`status` updated automatically on POD. This is genuinely good, low-friction integration — no re-keying of shared fields.
- **Gaps found**: `deliveryOrdersRecordPOD` is the only mutating function in this module that bypasses `applyGovernance` — anyone with the `deliveries` permission can record POD on any delivery at any time, with none of the ownership/time-gating every sibling action enforces. Status-change and POD actions give no success toast (Create/Edit do).

### 4.3 Dispatch
- **Functional completeness**: Create request, Approve/Reject/Dispatch, Delete. Missing: search, filter, export, pagination disclosure (`limit 100`).
- **Workflow**: This is the one genuine domain-specific approval workflow in the department (Pending → Approved/Rejected/Dispatched), and it correctly cascades to `delivery_orders` and `sales_orders` status on approval.
- **Integration**: Good cascade behavior. **No notification fires when a dispatch request is created** — an approver only discovers a pending request by opening the page themselves.
- **Gaps found**: `dispatchReview`'s permission check is a **hardcoded role array**, not `mustRole` — the one place in this module that doesn't use the standard permission mechanism, meaning a permissions-page grant of the `dispatch` page doesn't guarantee approval rights (the two are decided by different code paths). Approve/Dispatch buttons give no success toast.

### 4.4 Transport Carriers
- **Functional completeness**: Add/Edit/Delete carrier. Missing: search, filter, export, pagination (though carrier lists are inherently small, so this is lower priority than the same gap elsewhere).
- **Workflow**: Simple master-data CRUD — no approval chain, which is appropriate for reference data.
- **Integration**: Feeds `transport_jobs` and a read-only vehicle-ownership dropdown on the Fleet & Equipment side. No issues found beyond the general search/filter/export gaps in §4.9.

### 4.5 Transport Jobs
- **Functional completeness**: Log job, inline status change, Edit, Delete. Has the *only* filter control in the department (a carrier dropdown) — but it is a pure client-side filter over the already-fetched ≤100 rows, not a real query filter, so it cannot reach jobs beyond that cap. Missing: search, export.
- **Workflow**: Independent of the Dispatch approval chain — a transport job can reference a delivery/SO but isn't required to, and isn't gated by dispatch approval.
- **Integration**: Carrier/vehicle/SO/delivery FKs all present and nullable-flexible.
- **Gaps found**: Permission-checked against `mustRole(user, 'transport')` everywhere, **not** `'transport-jobs'` — despite `transport-jobs` being an independently grantable permission in the User Management UI. A user granted only `transport-jobs` is denied on every action. Status-change gives no success toast.

### 4.6 Legacy Logistics (spare parts)
- **Functional completeness**: Create/Edit/Delete, plus the department's only on-page pending-approval panel (supervisor-specific manual request flow). Missing: search, filter, in-page export (a separate Administration-wide export exists).
- **Workflow**: The only page with a working, user-visible approval surface for its own entity type — but only because it uses a bespoke manual `pendingEditsCreate` path for supervisors, not the standard `applyGovernance` outcome-handling every other Logistics page silently mishandles (§4.2–4.5, §6).
- **Integration**: A `workshop_id` column exists on `logistics_items` specifically for workshop isolation but is **never read, filtered, or written** by any of the three CRUD functions — dead schema, and a real gap versus how Stock Items/Warehouses correctly enforce workshop isolation.

### 4.7 Vehicles/Fleet (adjacent, not part of Logistics NAV section, referenced for completeness)
Vehicle Fleet is architecturally a dependency of Logistics (`delivery_orders.vehicle_id`, `transport_jobs.vehicle_id`) but organizationally its own department (`sec: 'Fleet & Equipment'`, separate permission `vehicles`). No defects specific to this boundary were found beyond the mobile role-mismatch already covered in §10 — flagged here only so the department-boundary question in §3 is fully answered.

### 4.8 Cross-cutting: approval-request dead end
This applies to §4.2–4.6 collectively and is significant enough to call out once at the module level rather than repeat six times: **every governance-triggered pending edit/deletion request for `delivery_order`, `dispatch_request`, `transport_job`, and (for non-supervisors) `logistics_item` is created, escalated, and notified — but no page in the entire application lets a manager see or act on it.** The two review panels that exist elsewhere in the app (`insertPendingPanel`, `insertDeletionPanel`) are wired per-page with a hardcoded entity-type allow-list, and none of these four entity types is on either list. This is functionally equivalent to the approval chain not existing at all for these entities, despite all the supporting plumbing (SLA reminders, escalation, notifications) firing correctly underneath it.

### 4.9 Cross-cutting: search, filter, export
Across all six pages: **zero** have a search box; **one** (Transport Jobs) has any filter, and it's client-side-only over a capped result set; **zero** have an export button (Logistics items are only exportable via a separate, generic Administration page). This is the most consistent, department-wide gap found and is addressed as a single recommendation in §17 rather than six duplicate ones.

---

## 5. End-to-End Workflow Analysis

**Primary workflow: Sales Order → Delivery → Dispatch → POD → Completion**

| Stage | Status | Notes |
|---|---|---|
| Input (SO exists, ready to ship) | ✅ Complete | Sales module hands off cleanly; delivery create form can select an SO |
| Processing (Delivery Order created) | ✅ Complete on desktop; ❌ **broken on mobile** for the dedicated "Deliver from SO" entry point (calls a nonexistent backend function — silent hang, no error) | Desktop `deliveryOrdersCreate` works correctly; the standalone mobile `DeliveryCreateScreen` also works (user must manually pick the SO instead of being deep-linked) |
| Approval (Dispatch review) | ✅ Complete for the happy path | No notification alerts the approver that a request is waiting — they must check manually |
| Execution (goods physically dispatched) | ⚠️ **No stock check** | Nothing in the pipeline verifies or reserves warehouse stock before a delivery is marked dispatched |
| Completion (POD recorded) | ✅ Complete, cascades correctly to SO quantities/status | POD bypasses the standard governance/ownership gate that every sibling action enforces |
| Reporting | ❌ **Missing** | No delivery/dispatch/transport-focused report exists anywhere; the page named "Logistics Dashboard" is actually a stock dashboard |
| Audit Trail | ⚠️ **Present but not correlatable** | Every mutation is logged, but there is no relational link between a Sales Order's audit entries and the resulting Delivery Order's audit entries — an auditor must manually extract `sales_order_id` from a JSON blob to connect the two |

**Secondary workflow: Governed edit/delete of any Logistics record older than 5 minutes**

| Stage | Status | Notes |
|---|---|---|
| Input (user attempts edit/delete) | ✅ Complete | Standard governance check runs correctly |
| Processing (request auto-created) | ✅ Complete | `pending_edits`/`deletion_requests` row created, SLA reminders scheduled |
| Approvals | ❌ **Dead end** | No page displays these requests for these four entity types — see §4.8 |
| Execution/Completion | ❌ **Never happens** | The request simply expires into escalation with no way to resolve it |
| Notifications | ✅ Fires | Correctly notifies leader/manager roles — of a request they can't actually act on |
| UI feedback to the requester | ❌ **Broken** | User sees the literal text "undefined" instead of "awaiting approval," because the UI never reads the `pendingApproval`/`message` fields the backend returns |

**Tertiary workflow: Transport Job logging (carrier cost tracking)**

Complete end-to-end as a standalone log (create → status update → cost accrual), but the resulting cost figures do not flow anywhere — Finance's weekly expense entry for the "Transport" category is manually keyed, not populated from `transport_jobs.cost`/`vehicle_fuel_logs.total_cost` (see §6).

---

## 6. Inter-Department Collaboration Analysis

**Sales → Logistics.** Data handoff is clean where it works: `deliveryOrdersCreate` carries `sales_order_id` and automatically derives SO quantity/status fields — no re-keying of shared data. Sales' own delivery list shows the linked delivery's status inline on both desktop and mobile, which is good visibility. The defect is entirely in the mobile dedicated entry point (`SalesOrderDeliverScreen` → a nonexistent backend function), not in the underlying data model.

**Logistics → Inventory/Stock.** No collaboration exists at all where the business would expect it: dispatching or completing a delivery **never touches `stock_levels`/`stock_movements`**. The only "stock" side effect is a materialized-view refresh of an unrelated timber/poles production aggregate, not a per-item warehouse deduction. This is the single largest functional gap in the department — a delivery can be fully processed and marked complete while physical stock records are entirely unaware it happened.

**Logistics → Workshop/Production.** No connection exists, and — unlike the Inventory gap above — none is currently expected by the business process either; raw-material intake isn't modeled as flowing through delivery orders. Noted for completeness, not flagged as a gap.

**Procurement → Logistics.** Not actually connected — confirmed these are two independent systems (`procurement_goods_receipts` vs `delivery_orders`) that happen to share the word "delivery" in their UI labels. Recommend a naming clarification (§14) so users and future developers don't assume a relationship that doesn't exist.

**Logistics → Finance.** One-directional, manual. Vehicle fuel cost and transport job cost are both tracked and summed correctly within Logistics/Fleet, but Finance's weekly expense ledger has a "Transport" category that must be hand-populated — the real transport/fuel totals sitting in the database are never pulled in automatically.

**Dispatch (intra-department escalation).** The approval step itself works, but with no proactive notification to approvers on request creation, throughput depends entirely on someone remembering to check the Dispatch page.

### Collaboration Matrix

| From | Current | To | Workflow Complete | Missing Collaboration |
|---|---|---|---|---|
| Sales | Logistics | Customer | Partial | Mobile "Deliver from Sales Order" button calls a nonexistent backend function (silent failure); desktop path and the underlying data model are sound |
| Logistics | Inventory/Stock | Warehouse | No | No stock reservation or deduction anywhere in the delivery/dispatch pipeline |
| Logistics (Dispatch) | Logistics (Delivery/Sales) | — | Partial | Cascade on approval is correct; no notification is sent when a dispatch request is first created |
| Procurement | — | Logistics | N/A | Not actually connected — two unrelated systems sharing the word "delivery"; recommend renaming to avoid confusion, not connecting them |
| Logistics (Fleet costs) | Logistics | Finance | No | Transport/fuel costs are tracked but not automatically fed into Finance's weekly expense category; manual re-entry required |
| Logistics (any entity) | Governance engine | Manager approval | No | Pending edit/deletion requests for delivery/dispatch/transport-job/legacy-item records are created and escalated but never surfaced to any approver |
| Workshop/Production | — | Logistics | N/A | No connection exists or is expected |

---

## 7. Integration Matrix

| Shared data | Owning table | Consumers | Synchronization |
|---|---|---|---|
| Sales Order quantities/status | `sales_orders` | Delivery Orders, Dispatch | Automatic, bidirectional (delivery/POD write back to SO; SO list reads delivery status) — working correctly |
| Vehicle assignment | `vehicles` (Fleet & Equipment) | Delivery Orders, Transport Jobs | One-directional FK reference, read-only from Logistics' side — working correctly |
| Carrier master data | `transport_companies` | Transport Jobs, Vehicle "third-party owner" dropdown | One-directional reference — working correctly |
| Warehouse stock | `stock_levels`/`stock_catalog`/`stock_movements` | *Nothing in Logistics reads or writes these on the delivery/dispatch path* | **Not integrated** — see §6 |
| Transport/fuel cost totals | `transport_jobs.cost`, `vehicle_fuel_logs.total_cost` | Finance's weekly expense ledger (in theory) | **Not integrated** — manual only |
| Audit trail | `audit_log` | Any downstream audit/compliance review | No relational cross-entity link column exists (`related_id` does not exist anywhere in the schema); correlation across departments requires manual JSON inspection |
| Global Search index | in-memory `_searchModules()` registry | Deliveries, Dispatch (registered); Transport Carriers, Transport Jobs, Legacy Logistics (**not registered**) | Partial — see §11 |

---

## 8. UI / UX Review

Summary table (full detail in §4 per-page notes):

| Page | KPI cards | Loading state | Empty state | Success feedback | Search/Filter | Export |
|---|---|---|---|---|---|---|
| Logistics Dashboard | Yes | Yes | Yes | N/A (read-only) | No | No |
| Delivery Orders | Yes | **No** | Yes | Partial (status change silent) | No | No |
| Dispatch | Yes | **No** | Yes | Partial (approve/dispatch silent) | No | No |
| Transport Carriers | Yes | **No** | Yes | Yes | No | No |
| Transport Jobs | Yes | Yes | Yes | Partial (status change silent) | Client-side only, capped | No |
| Legacy Logistics | Yes | **No** | Yes | Yes | No | No |

**Findings:**
- 4 of 6 pages show a blank page while their initial fetch is in flight, inconsistent with the other 2 that show a spinner — this reads as unresponsive/broken to a user on a slow connection.
- The highest-frequency actions in the department (status-change dropdowns, Dispatch's Approve/Dispatch buttons) are the ones with no success confirmation, while lower-frequency Create/Edit/Delete overlays do confirm — the inverse of what user-frequency would suggest is important.
- Status badges consistently use the shared CSS classes across every page — no ad-hoc styling found, which is good and should be preserved.
- The "undefined" governance-error text (§4.8) is the single worst UX defect in the department because it actively misleads the user into thinking something broke, when in fact their request was correctly submitted for approval.

---

## 9. CSS Improvement Recommendations

No Logistics-specific CSS defects were found — every page correctly reuses the shared badge classes (`bg/br/ba/bb/bt/bp`), card styles, and table styles used throughout the rest of the application. The improvements needed here are not stylesheet changes but **consistency of usage**:

1. Add the same loading-skeleton treatment already used on Logistics Dashboard/Transport Jobs to the other four pages (Deliveries, Dispatch, Transport Carriers, Legacy Logistics) — reuse of an existing pattern, not a new one.
2. Add a sticky filter bar matching the pattern already established elsewhere in the app (e.g., Procurement's reporting tabs) to at least Delivery Orders and Dispatch, the two highest-traffic pages.
3. Surface a toast (reusing the existing `showOverlaySuccess`/`showToast` mechanism already used for Create/Edit/Delete) on status-change and Approve/Dispatch actions.

None of these require new design tokens, colors, or components — purely applying what already exists elsewhere in the app to the pages that currently lack it.

---

## 10. Mobile vs Electron Review

| Capability | Desktop | Mobile | Gap |
|---|---|---|---|
| Logistics Dashboard | Yes (stock/workshop view) | Yes, but payload is stock/warehouse-only and role-gated to `logistics`/`admin` only (excludes `logistics-officer`, who is nonetheless shown the tab) | Role mismatch |
| Delivery Order CRUD | Full | Full (List/Create/Edit/Detail/Delete) | None — full parity |
| Delivery status transitions | Yes | Yes (forward-only state machine) | None |
| Proof of Delivery | Yes | Yes (List/Capture/Detail) | None |
| Dispatch approve/reject/dispatch | Yes | Yes, but broken for `logistics-officer` (403 at API layer despite the tab being shown) | Role mismatch |
| Sales Order → Delivery handoff | Works | **Broken** — calls a nonexistent backend function, hangs silently with no error | Critical gap |
| Transport Carriers CRUD | Full | **None** — no screen, hook, or endpoint (only a read-only dropdown label inside the vehicle form) | Full capability gap |
| Transport Jobs CRUD/status | Full | **None** — no screen, hook, or endpoint found anywhere | Full capability gap |
| Legacy Logistics | Yes | **None** | Full capability gap (may be intentionally out of scope for mobile — recommend an explicit decision either way rather than a silent omission) |
| Export/CSV | Not verified as present on desktop Logistics pages either (see §4.9) | Generic reports-export screen exists but nothing Logistics-specific | Neither platform has this — not a parity gap, a shared gap |
| Governance-blocked delete UX | Shows the "undefined" bug on desktop | Surfaces `pendingApproval` correctly on Delivery/Dispatch delete flows | **Mobile is actually better here than desktop** — worth using as the reference implementation when fixing desktop |

**Root cause of the `logistics-officer` role-mismatch pattern**: the mobile `LogisticsNavigator` bundles 14 tabs (absorbing several screens that on desktop belong to Workshop/Inventory and Fleet & Equipment) and shows the identical set to both the `logistics` and `logistics-officer` roles, with no per-role tab filtering. The backend REST route guards, however, were written independently per-route and mostly exclude `logistics-officer` from Dispatch, Vehicles, Machines, Workshop, Stock, and Timber Inventory. The navigator and the API were evidently built without cross-checking each other's role lists. This is already partially tracked (`V11_BACKLOG.md` V11-08, filed as a single low-priority "Vehicle Fuel tab" issue) but is materially larger in scope than that entry suggests — at least six tabs are affected, not one.

---

## 11. Reporting Review

**No dedicated Logistics report exists at any level** — operational, management, or executive. The "Logistics Dashboard" page, despite its name and NAV placement, surfaces stock/workshop data, not delivery/dispatch/transport metrics. The only delivery-adjacent KPI Scorecard entry (`sales-delivery-rate`) is filed under the Sales department, not Logistics, and Dispatch/Transport have zero KPI Scorecard coverage at all.

A separate, similarly-named `procurementReportDeliveryPerformance` exists but measures supplier-side on-time delivery for Procurement — an easy source of confusion for anyone searching for "delivery report" without already knowing the codebase's department boundaries.

Recommendation: a genuine Logistics Reports capability (delivery throughput, on-time dispatch rate, transport cost by carrier, POD rejection rate) is one of the highest-value additions available here, precisely because so much of the underlying data (delivery status history, dispatch timestamps, transport job costs) already exists and simply isn't surfaced anywhere.

---

## 12. Performance Review

| Table/query | Row cap | Disclosed to user? | Index present? |
|---|---|---|---|
| `delivery_orders` list | 200 | No | Yes (`created_at`) |
| `dispatch_requests` list | 100 | No | **No index at all** |
| `transport_jobs` list | 100 | Yes ("last 100" on the KPI card) | Yes (`created_at`) |
| `transport_companies` list | Unbounded | N/A (small dataset in practice) | **No index at all** |
| `logistics_items` list | 200 | No | **No index at all** |

No unbounded `SELECT *` scans were found against large tables — the only `SELECT *` usages are single-row primary-key lookups for governance before/after snapshots, which is appropriate. The real performance risk here is not query design but **missing indexes on `dispatch_requests` and `transport_companies`** (neither has any index, including on `created_at`, despite both being sorted on it in every list query) and **`logistics_items`** (no index despite being queried by category/workshop in principle). None of these tables are large today, so this is not urgent, but it is a correctness-of-design gap that will surface as the data grows — cheap to fix now, more disruptive to fix under load later.

No server-side pagination exists anywhere in the department; all six pages fetch a capped result set once and render it in full. This is consistent with the rest of the app's general pattern (not a Logistics-specific regression) but should be tracked as the department's data volume grows.

---

## 13. Security Review

*Scope: verifying the existing permission/workshop-isolation/audit model is applied correctly — not proposing changes to the model itself.*

**Critical**: `logisticsDashboard()` (data.js:4961) performs **no permission check of any kind** — not a role check, not even a logged-in check beyond what the IPC layer itself requires. Any authenticated session, regardless of assigned role or page grants, receives full dashboard data if it calls the underlying IPC channel directly. Every sibling data-fetching function in the department (and the rest of the app) gates on `mustRole`. This is a real gap in an otherwise consistently-enforced model, not a design choice.

**High**: `dispatchReview` uses a hardcoded role array instead of the standard `mustRole` mechanism used by every other action in the department. Functionally this currently matches the intended access list, but it means a future permissions change made through the normal admin UI (granting/revoking the `dispatch` page) would not actually change who can approve dispatch requests — the two are decoupled in a way that isn't obvious from the UI.

**High**: the `transport-jobs` permission can be granted independently in the User Management UI but is never independently checked — every Transport Jobs function checks `mustRole(user, 'transport')` instead. A user granted exactly `transport-jobs` (and not `transport`) will see the page link and be denied on every action, which is confusing but not a privilege-escalation risk (it's overly restrictive, not overly permissive).

**Medium**: `logistics_items.workshop_id` exists specifically to support workshop isolation (per its own migration comment) but is never enforced by any of the three CRUD functions in that module — every user with the `logistics` permission sees every workshop's spare-parts inventory, unlike the equivalent Stock Items module which does correctly restrict by workshop. This is a genuine deviation from the "workshop isolation" principle applied consistently elsewhere, though it concerns spare-parts visibility rather than financial or customer data.

**Low**: an orphaned role token, `'logistics-leader'`, exists only inside the generic `LEADER_APPROVERS` list and is never seeded, never assignable, and never appears in any role dropdown. It has no practical effect (no user can ever hold it) but is dead code that could confuse a future maintainer reading the approval-tier logic.

**No issues found** in: audit logging coverage (every mutating function logs, per §4/§4.8 note about structured vs. free-text form — a filterability improvement, not a security gap), the core time-gated governance mechanism itself (works correctly; only its *outcome handling in the UI* is broken, per §4.8), or hard-delete behavior (consistent with the rest of the app's pattern, not a Logistics-specific deviation).

---

## 14. Missing Features

Each recommendation below completes an existing, already-partially-built workflow — none introduces a new business process.

1. **Wire delivery/dispatch/transport-job/legacy-item entity types into the existing pending-edit/deletion-request review panels.** The panels, the underlying data, and the approval logic all already exist; only the per-page entity-type allow-list needs extending. Eliminates a dead-end approval flow.
2. **Fix the governance-outcome UI handling** (read `pendingApproval`/`message` instead of falling through to `.error`). Directly related to #1 — without this fix, even a correctly-wired approval panel won't stop the requester from seeing "undefined" at submission time.
3. **Fix or replace the mobile Sales→Delivery handoff** (`data.deliveriesCreate` does not exist). Completes an already-designed, already-half-built cross-department workflow; currently the only way to create a delivery from mobile is the standalone form, which requires manually re-selecting the Sales Order rather than being deep-linked from it.
4. **Add a stock-check (at minimum) or stock-reservation (ideally) step before a delivery can be dispatched.** This is the department's single largest functional gap relative to what a "delivery" workflow should guarantee, and directly mirrors what Procurement's Goods Receipt already does correctly for the inbound side.
5. **Add a notification on dispatch-request creation.** Every other approval-style workflow in this codebase notifies the approver; Dispatch currently does not, forcing manual page-checking.
6. **Add a genuine Logistics Reports capability** (delivery throughput, on-time dispatch, transport cost by carrier, POD rejection rate) — the underlying data already exists; only the aggregation/report screen is missing. Directly addresses the "no consolidated reporting" gap in §11.
7. **Feed `transport_jobs.cost`/`vehicle_fuel_logs.total_cost` into Finance's weekly "Transport" expense category automatically**, eliminating a manual re-entry step that already has a designated home in the Finance UI.
8. **Build the missing mobile Transport Carriers and Transport Jobs screens**, matching the desktop CRUD capability that mobile users currently have no access to at all.
9. **Add search boxes and server-driven filters to Delivery Orders and Dispatch** (the two highest-traffic pages) — every other major module in the app already has this pattern to copy.
10. **Add an export action to Delivery Orders, Dispatch, and Transport Jobs**, matching the export capability every other operational list in the app already provides.

---

## 15. Critical Issues

*Blocking — these should be treated as defects to fix before this department is considered production-reliable, not backlog items.*

| # | Issue | Business justification | Departments affected | Effort |
|---|---|---|---|---|
| C1 | `logisticsDashboard()` has zero server-side permission check | Any authenticated user, regardless of role, can pull full dashboard data via IPC | Logistics; general platform security posture | Small (add one `mustRole` line + verify page-level gate) |
| C2 | Governance-blocked edit/delete shows literal "undefined" instead of an approval-pending message on every Logistics page except the one supervisor-only branch | Actively misleads users into thinking a legitimate action failed, when it was correctly submitted for approval — erodes trust in the system and generates unnecessary support/confusion | Logistics (pattern likely repeats elsewhere — worth a codebase-wide grep once fixed here) | Small–Medium (fix the shared result-handling helper, verify each of the ~10 call sites) |
| C3 | Pending edit/deletion requests for `delivery_order`/`dispatch_request`/`transport_job`/`logistics_item` are created and escalated but never surfaced to any approver | The approval mechanism exists in name only for these entities — records effectively cannot be governed once older than 5 minutes, defeating the purpose of the governance engine for this entire department | Logistics; anyone assigned as a leader/manager approver | Medium (extend the existing panel's entity-type list on the relevant pages; no new UI component needed) |
| C4 | No stock check/reservation anywhere in the delivery/dispatch pipeline | A delivery can be fully processed and marked complete with no relationship to actual warehouse stock levels — the core data integrity promise of a "delivery" is not being kept | Logistics, Inventory/Warehouse, Finance (inventory valuation) | Medium–Large (requires deciding the exact reservation semantics with the business before implementing — flagged for discussion, not a pure code fix) |

---

## 16. High Priority Improvements

| # | Issue | Justification | Departments affected | Effort |
|---|---|---|---|---|
| H1 | Mobile Sales→Delivery handoff calls a nonexistent function | Silently breaks a designed cross-department workflow on mobile only | Sales, Logistics | Small (implement the missing function or repoint the route to the existing `deliveryOrdersCreate`) |
| H2 | `logistics-officer` mobile navigator shows ~6 tabs that 403 at the API layer | Confusing, broken-feeling experience for an entire role; already partially tracked but underscoped | Logistics | Medium (either split the navigator by role or align the route guards — a product decision, not just code) |
| H3 | No notification on dispatch-request creation | Approval throughput depends on manual page-checking; every comparable workflow elsewhere notifies | Logistics | Small |
| H4 | `dispatchReview` permission check is hardcoded instead of using `mustRole` | Decouples the approval-rights decision from the normal permissions-admin UI | Logistics, platform permissions consistency | Small |
| H5 | `transport-jobs` permission granted independently but never checked (only `transport` is checked) | Makes a documented, admin-grantable permission non-functional | Logistics | Small |
| H6 | No Logistics-specific reporting exists anywhere | Managers have no consolidated view of delivery/dispatch/transport performance despite the raw data existing | Logistics, Executive/CEO reporting | Medium |
| H7 | Transport Carriers/Transport Jobs have no mobile presence | Full capability gap versus desktop for two of six modules | Logistics | Medium–Large (two new screen sets + hooks + routes) |
| H8 | `deliveryOrdersRecordPOD` bypasses the governance/ownership gate every sibling action enforces | Anyone with basic `deliveries` access can record POD on any delivery, any time, regardless of ownership | Logistics | Small |

---

## 17. Medium Priority Improvements

| # | Issue | Justification | Departments affected | Effort |
|---|---|---|---|---|
| M1 | No search box on any of the six Logistics pages | Standard capability present elsewhere in the app; absence slows down daily use as record counts grow | Logistics | Small–Medium per page |
| M2 | No server-side filters (Transport Jobs' carrier filter is client-side only, capped) | Same as M1 | Logistics | Small–Medium per page |
| M3 | No export button on any of the six pages | Standard capability present elsewhere; managers currently cannot pull delivery/dispatch/transport data out of the app at all | Logistics | Small per page |
| M4 | Transport/fuel costs not auto-fed into Finance's weekly expense category | Eliminates a manual re-entry step that already has a designated home in Finance's UI | Logistics, Finance | Medium (requires agreeing the aggregation rule with Finance) |
| M5 | Loading skeleton missing on 4 of 6 pages | Inconsistent, feels unresponsive on slower connections | Logistics | Small |
| M6 | No success toast on status-change/Approve/Dispatch actions (the highest-frequency actions in the department) | Inconsistent with Create/Edit/Delete, which do confirm | Logistics | Small |
| M7 | Missing indexes on `dispatch_requests`, `transport_companies`, `logistics_items` | Cheap to add now; will matter once data volume grows | Logistics | Small |
| M8 | `logistics_items.workshop_id` exists but is never enforced | Inconsistent with the workshop-isolation principle applied to the equivalent Stock Items module | Logistics, Workshop & Inventory | Small–Medium |
| M9 | Audit log entries for most Logistics mutations use the legacy free-text form, not the structured `module`/`actionType`/`recordId` fields | Reduces filterability/diffability in the Audit Trail page for this department specifically | Logistics, Audit/Compliance | Small (mechanical update per call site) |

---

## 18. Low Priority Improvements

| # | Issue | Justification | Departments affected | Effort |
|---|---|---|---|---|
| L1 | Transport Carriers, Transport Jobs, and Legacy Logistics are not registered in Global Search | Minor discoverability gap; these are lower-traffic reference/log screens | Logistics | Small |
| L2 | KPI Scorecard coverage is inconsistent (one delivery metric filed under Sales; Dispatch/Transport have none) | Cosmetic/organizational, not functional | Logistics, Sales, Executive reporting | Small |
| L3 | Orphaned `'logistics-leader'` role token in approval-tier logic | Dead code; zero current impact but a latent source of confusion for future maintainers | Logistics | Small |
| L4 | User Management's own permission checklist files "Legacy Logistics" under a "Commercial" group header instead of "Logistics" | Purely cosmetic organizational inconsistency in an admin screen | Logistics | Small |
| L5 | `transportCompaniesForDropdown` has no role gate | Low risk (read-only reference lookup used elsewhere in the app for similar cases) but worth aligning for consistency | Logistics | Small |
| L6 | `V11_BACKLOG.md`'s note that Stock Transfers/Dispatch return HTTP 501 is stale — both are now fully implemented | Documentation hygiene only | N/A | Trivial (delete the stale note) |

---

## 19. Professional ERP Recommendations

- **Resolve the department-boundary inconsistency** (§2/§3) — pick one authoritative definition of "Logistics" and align the NAV, the User Management department dropdown, and the KPI Scorecard seed data to it. This is a documentation/configuration alignment, not a workflow change.
- **Rename or re-label to remove the "delivery" naming collision** between Procurement's Goods Receipt reporting and Logistics' Delivery Orders — a one-line label change (e.g., "Supplier Delivery Performance" vs. "Customer Delivery Orders") prevents ongoing confusion for users and future developers alike.
- **Treat the Logistics Dashboard's actual content honestly** — either rename it to reflect that it's a stock/workshop overview, or build a second, genuinely delivery/dispatch/transport-focused dashboard alongside it. Currently the department has no dashboard that reflects its own core workflows.
- **Standardize the governance-outcome handling pattern once, centrally**, rather than per-page — this fixes C2 everywhere it might recur across the rest of the app in one pass, not just in Logistics.
- **Establish a consistent "capped list, disclosed cap, with a path to see more" pattern** across all list pages in the app (Transport Jobs already does the "disclosed cap" half correctly) — Logistics is a good place to standardize this since it currently has the most inconsistent implementation of the pattern.

---

## 20. Recommended Implementation Roadmap

**Phase A — Fix what's broken (Critical + selected High, ~1–2 weeks)**
C1, C2, C3, C4 (or at minimum a stock *check* if reservation needs more business discussion), H1, H4, H5, H8.

**Phase B — Close the collaboration/visibility gaps (remaining High, ~1–2 weeks)**
H2 (role/navigator alignment — needs a product decision first), H3, H6 (Logistics Reports), H7 (mobile Transport Carriers/Jobs).

**Phase C — Bring the department to parity with the rest of the app (Medium, ~1–2 weeks)**
M1–M3 (search/filter/export across the six pages), M5–M6 (loading/success-feedback consistency), M4 (Finance cost feed), M7–M9 (indexes, workshop isolation, audit structuring).

**Phase D — Polish (Low, opportunistic)**
L1–L6, folded into other work rather than scheduled as standalone effort.

This roadmap deliberately sequences *fixing existing broken behavior* before *adding new capability* before *polish* — the same priority order used throughout this report.
