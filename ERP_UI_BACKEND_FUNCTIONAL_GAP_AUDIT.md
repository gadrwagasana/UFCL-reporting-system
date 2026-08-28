# UFCL ERP — UI vs Backend Functional Gap Audit

Enterprise audit comparing implemented backend capabilities against Desktop (Electron) and Mobile (React Native) UIs. Read-only source-code verification — no code, schema, business logic, or permissions were modified in the course of this audit.

---

## 1. Executive Summary

Six modules — Procurement, Inventory, Logistics, Workshops, Fleet & Equipment, Mechanician — were audited page-by-page across all three tiers (backend `db/services/data.js`, desktop `renderer/app.js`, mobile `mobile/src/screens/**`). The audit found the app is, on the whole, **substantially built out on both platforms** — most CRUD surfaces, approval workflows, and status machines are fully reachable from both Desktop and Mobile. However, verification surfaced **one critical, verified backend bug that fully disables three entire mobile modules**, several **verified permission mismatches that block specific roles from actions the backend explicitly supports**, one **workflow-blocking gap** (mobile cannot assign a technician to a maintenance job, which blocks job progression), and a long tail of smaller UI parity gaps and dead/orphaned backend functions.

The single highest-priority finding: `mobile-api/routes/dispatch.js`, `transport.js`, and `sales.js` all call `requireRoles(ROLES_ARRAY)` without spreading the array (`requireRoles(...ROLES_ARRAY)` is the correct form used everywhere else in the codebase). This means `requireRoles` receives one array-of-one-array argument, and `.includes(req.user.role)` never matches any role string — **every mobile request to Dispatch, Sales Orders, and Transport Carriers/Jobs is rejected with 403 for every role, including admin.** The mobile screens, hooks, and endpoint wiring for all three are otherwise fully and correctly implemented; this is purely a one-line-per-file server bug, invisible from reading the mobile client code alone.

No schema issues were found. No security vulnerability beyond the permission mismatches noted (which are under-permissive, not over-permissive — the found mismatches hide capabilities from roles the backend allows, not the reverse) was identified.

## 2. Audit Methodology

For each of the 6 named modules, every page was audited individually (not summarized) across three tiers:
1. **Backend**: exported functions in `db/services/data.js`, their `mustRole()`/permission gates, and (where relevant) status-machine transition maps.
2. **Desktop**: the corresponding `render*`/`open*Overlay` function(s) in `renderer/app.js`, its `UFCL.*` calls (via `electron/preload.js` → `electron/main.js` IPC handlers), and its permission gating (`STORAGE.pages.includes(...)` or hardcoded role arrays).
3. **Mobile**: the corresponding screen(s) in `mobile/src/screens/**`, their hooks in `mobile/src/hooks/**`, the REST routes they call in `mobile-api/routes/*.js`, and mobile's `hasPermission(role, key)` gating (`mobile/src/utils/permissions.ts`).

Six parallel research passes (one per module) were run, each required to cite an exact `file:line` for every claim and to mark anything unverifiable as "Unverified" rather than assumed. Two passes (Inventory, Mechanician) were interrupted mid-run by an unrelated session limit and re-run to completion from scratch — their findings below are from the completed re-runs, not the interrupted partial runs.

Every finding below is classified as exactly one of: **UI Functional Gap**, **Broken UI Workflow**, **Permission Mismatch**, **Workflow Gap**, **Intentional Backend Capability**, or **Not a Gap**. Findings affecting multiple pages (e.g. the same backend bug or the same missing mobile permission) are reported once and cross-referenced, per the audit's duplicate-control instruction — see §11.

## 3. Audit Coverage

| Module | Pages Audited | Desktop Source | Mobile Source |
|---|---|---|---|
| Procurement | Dashboard, Requisitions, Suppliers, RFQ/Quotations, Purchase Orders, Goods Receipt, Invoices & Payments, Reports, Settings, Contract Register/Compliance Center, SRM Dashboard, Automation Center (scope check) | `renderer/app.js` (17408-20700 range) | `mobile/src/screens/procurement/**` |
| Inventory | Inventory Dashboard/Stock Levels, Stock Catalog, Stock Movements, Stock Transfers, Material Requests, Warehouses, Inventory Loss Reports | `renderer/app.js` (7149-9799, 15097 range) | `mobile/src/screens/stock/**`, `stockTransfers/**`, `material/**` |
| Logistics | Logistics Dashboard, Deliveries, Dispatch, Sales Orders, Transport/Transport Jobs, Customers, Products | `renderer/app.js` (2710-11754 range) | `mobile/src/screens/{logistics,deliveries,dispatch,salesOrders,transport,customers,products}/**` |
| Workshops | Workshop Overview, Workshops List/Management, workshop-specific stock (confirmed dead concept), workshop-level reports (confirmed non-existent as a separate page) | `renderer/app.js` (7748, 8028 range) | `mobile/src/screens/workshops/**` |
| Fleet & Equipment | Vehicles, Vehicle Maintenance, Vehicle Fuel Logs, Machines/Categories/KPI Performance, Machine Maintenance Schedule, Machine Fuel Logs, Machine Logs, Fleet Reports, External Repair | `renderer/app.js` (10031-15538 range) | `mobile/src/screens/{vehicles,vehicleFuel,machines,machineFuel,machineLogs}/**` |
| Mechanician | Mechanician Dashboard, Maintenance Jobs (full lifecycle), Waiting for Parts/External Repair views, Material Requests entry point, Machine Logs, Machine Fuel Logs, Maintenance Schedule, Corrective Maintenance (confirmed = Maintenance Jobs), Maintenance Reports/Officer Dashboard | `renderer/app.js` (1152-15043 range) | `mobile/src/screens/{mechanician,maintenance,machineLogs,machineFuel}/**` |

Total: **~39 individual pages** audited across 6 modules, both platforms, cross-referenced against `db/services/data.js`, `db/migrate.js`, `electron/main.js`/`preload.js`, and `mobile-api/routes/*.js`.

## 4. Enterprise Findings (Cross-Cutting Themes)

These patterns recurred across multiple independent module audits and are the most consequential findings in this report:

1. **`requireRoles()` array-spread bug** — one root cause, disables 3 entire mobile modules (Dispatch, Sales Orders, Transport). See §8, Finding W-1.
2. **Desktop hardcodes role arrays that are narrower than the backend permission they're supposed to reflect**, and mobile independently derives its own role→permission map — the two are maintained separately with no shared source of truth, and they drift. This is the root cause behind at least 4 separate confirmed mismatches (mechanician excluded from 2 desktop "Add" buttons; supervisor excluded from mobile's `workshop.approve`; logistics-officer excluded from mobile's `stock.catalog`; logistics-officer excluded from both platforms' stock-transfer act permission).
3. **Procurement's mobile screens have no per-page permission check at all** — every other module's mobile screens gate via `hasPermission()`; Procurement's rely solely on which role can reach the `ProcurementNavigator` stack. Confirmed across all 6 procurement pages audited (Dashboard, Requisitions, Suppliers, POs, Goods Receipt, Invoices).
4. **Several backend functions have a fully-wired IPC/REST path and, in some cases, a mobile hook — but zero UI caller on either platform.** Six such orphans were found (`maintenanceUpdate`, `machineFuelLogsUpdate`, `procurementPoUpdate`, `machinesDelete`, `stockTransferApprove` [legacy singular], plus two mobile-only-dead hooks: `useMaintenanceJobAssign` and `useMaintenanceWaitingForParts`). `machinesDelete` is the most consequential of these — there is genuinely no way to deactivate or archive a machine from either UI today.
5. **The admin Roles & Permissions editor is missing checkboxes for several real, actively-enforced permission keys** (`maintenance-jobs`, `machine-maintenance`, `maintenance-oversight`) — these can only be granted via a one-time database migration, not through the admin UI, found independently by two audits.
6. **The Maintenance Officer Dashboard and Maintenance Reports have a fully working backend function and mobile-api route, but zero mobile screen consumes either** — confirmed independently by both the Fleet & Equipment and Mechanician audits.

## 5. Page-by-Page Findings

### Procurement

**Dashboard** — Desktop `renderProcurementDashboard` / Mobile `ProcurementDashboardScreen.tsx`. Not a Gap: both call the same three aggregates (`procurementDashboard`, `procurementExecutiveDashboard`, supplier-intel dashboard). Permission Mismatch: see Enterprise Finding 3 (P-1 below).

**Requisitions** — Desktop `renderProcurementRequisitions`/`openRequisitionDetailOverlay`/`openRequisitionEditOverlay` / Mobile `RequisitionsListScreen.tsx`/`RequisitionDetailScreen.tsx`/`RequisitionFormScreen.tsx`. Not a Gap: full CRUD + submit/cancel/approve/reject/return-for-revision parity, identical status gating. Permission Mismatch: P-1.

**Suppliers** — Desktop `renderProcurementSuppliers`/`openSupplierManageOverlay`/`openSupplierComparisonOverlay` / Mobile `SuppliersListScreen.tsx`/`SupplierDetailScreen.tsx`/`SupplierComparisonScreen.tsx`. Not a Gap: all 7 supplier-detail tabs and governance actions (blacklist/suspend/reactivate/delete) present on both, identically role-gated. Permission Mismatch: P-1.

**RFQ / Quotations** — Desktop `renderProcurementRfq`/RFQ detail overlay / Mobile `RfqListScreen.tsx`/`RfqDetailScreen.tsx`/`RfqCreateScreen.tsx`. **Broken UI Workflow (F-1)**: mobile's `submitQuotation` hook (`mobile/src/hooks/useProcurementRfq.ts:47`) correctly wraps the backend `procurementQuotationSubmit` (data.js:15516) but is never called from any screen — mobile users can invite suppliers and select/compare quotes, but cannot record a quotation received by phone/email, a workflow desktop fully supports (`renderer/app.js:18744-18783`). Confidence: High.

**Purchase Orders (incl. Close with Shortage)** — Desktop `renderProcurementOrders`/`openPoDetailOverlay` / Mobile `PurchaseOrdersListScreen.tsx`/`PurchaseOrderDetailScreen.tsx`. Not a Gap: Close-with-Shortage lifecycle fully reachable both platforms. **Backend-Only Capability (F-2)**: `procurementPoUpdate` (data.js:15678) is IPC- and REST-wired but has zero caller anywhere — no "Edit PO" UI exists on either platform. Permission Mismatch: P-1.

**Goods Receipt** — Desktop `renderProcurementGoodsReceipt` / Mobile `GoodsReceiptListScreen.tsx`/`GoodsReceiptCreateScreen.tsx`. Not a Gap: create/list/detail parity confirmed. Permission Mismatch: P-1.

**Invoices & Payments** — Desktop `renderProcurementInvoices` / Mobile `InvoicesListScreen.tsx`/`InvoiceDetailScreen.tsx`. Not a Gap: match/approve/reject invoice and create/approve/reject payment present on both. Permission Mismatch: P-1.

**Reports** — Desktop `renderProcurementReports` (14 tabs) / Mobile `ProcurementReportsScreen.tsx`. Not a Gap: exact 1:1 tab parity confirmed by comparing `TAB_META` to mobile's `TABS` array.

**Settings (CEO threshold)** — Desktop `renderProcurementSettings` / Mobile `ProcurementSettingsScreen.tsx` (confirmed to exist, contrary to an initial hypothesis). Not a Gap: full parity, identical `admin`/`ceo`-only client gate mirroring server enforcement.

**Contract Register / Compliance Center** — Desktop `openContractRegisterOverlay`/`openComplianceCenterOverlay` / Mobile `ContractRegisterScreen.tsx`/`ComplianceCenterScreen.tsx`. Not a Gap: Approve/Renew present on both, same governance-role gating. Naming inconsistency only (`srm-contracts:*` IPC namespace vs `procurement*` function names) — cosmetic, not functional.

**SRM Dashboard / Supplier Intelligence** — Mobile has a dedicated `SrmDashboardScreen.tsx`; desktop's closest equivalent is folded into the Reports SRM tab and Dashboard widgets rather than a standalone page. Workflow Gap (platform asymmetry), Low-Medium confidence — not independently verified whether the two surfaces show identical data.

**Automation Center** — Confirmed correctly out of scope for Procurement (generic cross-module engine); the procurement-specific automation surface (Automation & Tasks tab inside Reports) has full parity. Notable *because* mobile's Automation Center screens correctly use `hasPermission()` (`automation.view/run/edit_rules`) — reinforcing that Procurement's screens are the outlier in *not* doing so (P-1).

### Inventory

**Inventory Dashboard / Stock Levels** — Desktop `renderInventory` (confirmed same function serves both "Inventory Dashboard" nav label and "Stock Levels" concept) / Mobile `StockLevelsScreen.tsx`. Not a Gap: both call `inventoryList`/`inventoryDashboard`/`inventoryIntelligence`; read-only page, no CUD to compare.

**Stock Catalog** — Desktop `renderStockItems`/detail-edit-use overlays / Mobile `StockCatalogScreen.tsx`/`StockItemFormScreen.tsx`/`StockCategoriesScreen.tsx`. Not a Gap for base CRUD (all 7 backend functions wired both platforms). **UI Functional Gap (F-3)**: desktop has bulk-deactivate and a read-only Detail+History overlay; neither exists on mobile. **Permission Mismatch (P-2)**: `logistics-officer` is explicitly granted full stock-item management server-side (`mobile-api/routes/stock.js:12`, citing a deliberate "Phase 1 Logistics fix") and holds it on desktop, but mobile's `ROLE_PERMISSIONS['logistics-officer']` (`permissions.ts:78`) omits `stock.catalog`, hiding Add/Edit/Delete for this role on mobile only. Confidence: High.

**Stock Movements** — Desktop `renderStockMovements` / Mobile `StockMovementsScreen.tsx`/`StockMovementFormScreen.tsx`. Not a Gap: movement types (`in`/`out`/`adjustment`/`return`) and the delete-approval workflow are identical on both; `transfer`/`loss` correctly excluded from manual creation on both. **Backend-Only Capability (F-4)**: the legacy singular `stockTransferApprove` (data.js:2872) is fully wired through IPC, REST, and two dedicated mobile hooks, but has zero caller anywhere — superseded by the current `stockTransfersApproveReject`, deliberately kept live per its own code comment "for any already-cached mobile build still calling it."

**Stock Transfers** — Desktop `renderStockTransfers`/`openStockTransferDetailOverlay` / Mobile `StockTransfersListScreen.tsx`/`StockTransferDetailScreen.tsx`/`StockTransferDispatchScreen.tsx`. Not a Gap: full lifecycle (create, approve/reject, dispatch, receive/partial-receive, report-discrepancy) confirmed reachable on both. **UI Functional Gap (F-5)**: desktop has bulk-approve; no mobile equivalent. **Permission Mismatch (P-3)**: `logistics-officer` can view but not act on transfers on mobile (missing `transfer.act`) — and is *also* excluded from desktop's hardcoded `canApprove` array, so this gap exists on both platforms for this specific role, not just mobile.

**Material Requests** — Desktop `renderMaterialRequests`/`openApproveOverlay`/`openRejectOverlay` / Mobile `MaterialRequestsListScreen.tsx`/`MaterialRequestDetailScreen.tsx` (approve/reject actually live in `WorkshopOverviewScreen.tsx`). **Broken UI Workflow (F-6)**: mobile's actual Material Requests screens have zero approve/reject actions — the only mobile entry point for approving/rejecting is buried in the unrelated Workshop Overview tab, not reachable from Material Requests navigation at all. **Permission Mismatch (P-4, see Workshops page for the same root cause)**: supervisor can approve/reject material requests for their own workshop on desktop, but the equivalent mobile action (`hasPermission('workshop.approve')`) excludes supervisor entirely, despite an explicit backend code comment stating cross-platform parity was intended. A secondary, lower-severity mismatch: `storekeeper`/`logistics-officer` hold the backend permission for full-access approval but are excluded from the approve-gating array on *both* platforms (Medium confidence, gap on both UIs equally, not a cross-platform mismatch).

**Warehouses** — Desktop `renderWarehouses` / Mobile `WorkshopsListScreen.tsx`/`WorkshopFormScreen.tsx` (confirmed to exist with full CRUD, correcting an initial hypothesis that mobile lacked this). Not a Gap: `canManage`/`workshop.manage` role sets line up on both platforms. Mobile calls a richer, mobile-specific `workshopsListWithMetrics` variant rather than desktop's `warehousesList` — intentional, not a gap. Workshop-isolation parity for this richer variant is Unverified.

**Inventory Loss Reports** — Desktop `renderInventoryLossReports`, added in an earlier Inventory Integrity phase. **UI Functional Gap (F-7)**: zero mobile equivalent — no route, hook, or screen references `inventoryLossReports` anywhere on mobile. Read-only page (CSV export only), so no CUD asymmetry beyond the page's total absence.

### Logistics

**Logistics Dashboard** — Not a Gap: role gating deliberately handled inside the backend function itself, no Express-level role check, documented as intentional so every role granted the page works uniformly.

**Deliveries** — Desktop `renderDeliveries` / Mobile `DeliveriesListScreen.tsx`/`DeliveryDetailScreen.tsx`/`DeliveryStatusScreen.tsx`/`PODCaptureScreen.tsx`. **Broken UI Workflow (F-8)**: desktop's detail-overlay "Change status" button doesn't open a status control at all — it opens the Edit overlay, which has no status field, so a user must close and use a separate row-level dropdown instead. Mobile's equivalent button correctly opens `DeliveryStatusScreen`. Minor: desktop's delete IPC never passes the optional `reason` argument that mobile always supplies via `ReasonModal`, weakening desktop's audit trail for this action (Medium confidence, low severity).

**Dispatch** — Desktop `renderDispatch` / Mobile `DispatchListScreen.tsx`/`DispatchFormScreen.tsx`. **Broken UI Workflow, CRITICAL (W-1)**: every mobile-api Dispatch route 403s for every role due to the `requireRoles` array-spread bug (see §4/§8). **Permission Mismatch (P-5)**: independent of the bug, desktop's `canApprove` includes `operations` (deliberately, per a documented migration comment) but mobile's `hasPermission('dispatch.approve')` excludes it, and `OperationsNavigator.tsx` has no Dispatch tab at all — an Operations Manager cannot reach Dispatch on mobile by any path. **Workflow Gap (F-9)**: as a result of both findings, the entire Approve/Reject/Dispatch/Delete workflow is desktop-only in practice today.

**Sales Orders** — Desktop `renderSales` / Mobile `SalesOrdersListScreen.tsx`/`SalesOrderFormScreen.tsx`/`SalesOrderDeliverScreen.tsx`. **Broken UI Workflow, CRITICAL (W-1, same root cause)**: same array-spread bug in `mobile-api/routes/sales.js` blocks 100% of mobile Sales Orders traffic for every role. **UI Functional Gap (F-10)**: desktop has a per-row "Transport" quick-action to assign a Transport Job directly from a Sales Order; no equivalent exists on mobile (compounded by Transport itself being unreachable on mobile — see next page).

**Transport / Transport Carriers / Transport Jobs** — Desktop `renderTransport`/`renderTransportJobs` / Mobile `TransportCarriersListScreen.tsx`/`TransportJobsListScreen.tsx`. **Broken UI Workflow, CRITICAL (W-1, same root cause)**: same bug in `mobile-api/routes/transport.js` blocks all Transport Carriers/Jobs traffic for every role, including admin. The route file's own comment confirms this route was added specifically to fix an earlier "Transport had full CRUD on desktop but no mobile route at all" gap — the fix introduced this new bug, so the original gap is still effectively unresolved today.

**Customers / Products** — Not a Gap on both pages: full Create/Read/Update parity (no Delete on either platform by design, consistent); these two route files correctly use the spread operator and are unaffected by W-1.

### Workshops

**Workshop Overview** — Desktop `renderWorkshopOverview` / Mobile `WorkshopOverviewScreen.tsx`. **Broken UI Workflow (F-11)**: desktop's own quick-approve button for a pending Material Request always fails — it calls `materialRequestsApprove` with `sourceWarehouseId: null`, but the backend hard-requires a source warehouse; the dedicated Material Requests page's approve overlay correctly collects this first, but the Workshop Overview widget was never updated to match. Mobile's equivalent flow correctly collects the source (and destination, when needed) warehouse via a modal before submitting. **Permission Mismatch (P-6)**: mobile's `GET /api/workshops/overview` route hardcodes an `OVERVIEW_ROLES` list that excludes `supervisor` and `storekeeper-assistant`, even though the backend's authoritative gate (`mustRole(user,'workshop-overview')`) grants both — and both roles are placed in mobile's `workshop` bottom-nav tab group, so they will reach the screen and hit a 403 before the backend's own (more permissive) check ever runs. **Permission Mismatch (P-4, cross-referenced from Material Requests above)**: desktop shows Approve/Reject to `supervisor` here (backend genuinely supports it), mobile's `hasPermission('workshop.approve')` does not include `supervisor` — since this widget is also the *only* mobile path to approve Material Requests, this single permission gap blocks supervisors from two related workflows on mobile. **UI Functional Gap (F-12)**: desktop has a CSV export button; no mobile equivalent.

**Workshops List / Management** — Desktop `renderWarehouses` / Mobile `WorkshopsListScreen.tsx`/`WorkshopFormScreen.tsx`. Not a Gap: full CRUD parity (no Archive/Restore on either platform — `warehousesDelete` is a hard delete on both, a shared limitation not a cross-platform gap). **UI Functional Gap (F-13)**: desktop has a per-workshop Detail overlay with a History tab; mobile rows are not tappable and there is no detail screen. **UI Functional Gap (F-14)**: desktop has an "Add workshop user" quick-action (register a pre-scoped storekeeper/supervisor/logistics user); no mobile equivalent found (Medium confidence — may be intentionally out of scope for mobile, not confirmed). **UI Functional Gap (F-15)**: desktop has a cross-workshop filter dropdown for unrestricted users; mobile's list always fetches the full unfiltered set with no switcher.

**Workshop-specific stock (`wk_items`/`wk_stock`/`wk_consumption`)** — **Not a Gap / Dead Concept**: confirmed via full grep of `db/migrate.js`/`db/schema.sql`/`db/services/data.js` that no such tables or functions exist. A direct code comment confirms this system was explicitly removed after being found to reference nonexistent tables during an earlier audit; per-workshop stock is now fully unified into the main Inventory module's `stock_levels`/`warehouses` tables (out of this module's scope, covered under Inventory).

**Workshop-level reports/KPIs** — **Not a Gap / Clarification**: no dedicated page exists distinct from Workshop Overview; the only similarly-named function (`workshopPerformance`) belongs to the Fleet & Equipment module's Maintenance Reports feature, not this module.

### Fleet & Equipment

**Vehicles** — Desktop `renderVehicles`/`openVehicleDetailOverlay` / Mobile `VehiclesListScreen.tsx`/`VehicleDetailScreen.tsx`. Not a Gap: full vehicle CRUD and both dashboard aggregates (`fleetDashboard`/`fleetIntelligence`) present on both platforms. Mobile is actually slightly ahead here (see Vehicle Maintenance below).

**Vehicle Maintenance** — tab inside vehicle detail on both platforms. **Backend-Only Capability (F-16)**: `maintenanceUpdate` (data.js:11295) is fully IPC-wired but has no caller on desktop and no mobile-api route — a true orphan; no edit UI exists anywhere for a vehicle maintenance record. **UI Functional Gap (F-17, mobile ahead)**: mobile has Delete for maintenance records (`useMaintenanceDelete`); desktop's equivalent tab is strictly read-only-plus-create, no delete action, despite `maintenanceDelete` being IPC-wired.

**Vehicle Fuel Logs** — **UI Functional Gap (F-18, mobile ahead)**: desktop has no Delete for fuel logs (`fuelLogsDelete` is wired but never called from `renderer/app.js`); mobile has it. No `fuelLogsUpdate` function exists at all — edit is absent by design on both, consistent. **Permission Mismatch (P-7)**: mobile's fuel-log permission key (`fuel.vehicle`) is independently mapped only to `logistics`/`admin`/`ceo`, not derived from the same `vehicles` page grant desktop uses — a maintainability risk more than a confirmed live mismatch (Medium confidence).

**Machines — Registry, Categories, KPI Performance** — Desktop `renderMachines`/`renderMachineKpi` / Mobile `MachinesListScreen.tsx`/`MachineCategoriesScreen.tsx`/`MachineKpiPerformanceScreen.tsx`. Not a Gap for Categories (full CRUD both platforms). **UI Functional Gap, High severity (F-19)**: `machinesDelete` (data.js:11207, a soft-deactivate) is IPC-wired on desktop but never called — **no Delete/Deactivate action exists in the Machine Registry UI on either platform**, and no mobile-api route or hook exists for it either. This is the single clearest piece of evidence that this area of the module remains under-built: machines can be created and edited but never archived, on either client. **UI Functional Gap (F-20)**: KPI Definitions/Targets management (create/edit target values) exists only on desktop (`renderMachineKpi`); mobile's `MachineKpiPerformanceScreen.tsx` is read-only, and the backing functions (`machineKpiDefinitionsCreate/Update/Delete`, `machineKpiTargetsSave`) have no mobile-api route at all.

**Machine Maintenance Schedule** — Desktop `renderMachineMaintenance` / Mobile `MachineMaintScheduleListScreen.tsx`. Not a Gap in intent: mobile's read-only design is explicit and documented in-code ("creating/editing schedules stays on desktop's Machine Registry"), and no role newly granted this page (mechanician, sawmill-leader, poles-leader) actually holds the `machines` permission needed to edit anyway — so the asymmetry matches the documented design, confirmed independently by the Mechanician audit. **Permission Mismatch / Admin UI Gap (P-8)**: the `machine-maintenance` page-permission key has no corresponding checkbox anywhere in the desktop Roles & Permissions admin editor, unlike `machines`/`machine-fuel`/`vehicles` which do — admins cannot grant or revoke this permission through the UI at all, only via a one-time migration.

**Machine Fuel Logs** — **Backend-Only Capability (F-21)**: `machineFuelLogsUpdate` (data.js:11373) is IPC-wired on desktop, never called, and has no mobile-api route — a true orphan. **UI Functional Gap (F-22)**: desktop has Delete; mobile's detail screen has neither edit nor delete, and no DELETE route exists on mobile-api at all.

**Machine Logs** — **UI Functional Gap, High severity (F-23)**: desktop has full edit+delete for machine logs; mobile has neither, and `mobile-api/routes/machineLogs.js` exposes only GET/POST — no PUT/DELETE route exists at all for this resource on mobile.

**Fleet/Equipment Reports** — **UI Functional Gap (F-24, corroborated independently by Mechanician audit)**: `maintenanceOfficerDashboard`/`maintenanceReports` have working mobile-api routes (`mobile-api/routes/maintenanceJobs.js:19-26`) calling the same backend functions desktop uses, but no mobile screen, hook, or endpoint reference consumes either — confirmed desktop-only despite full API readiness.

**External Repair tracking** — Not a Gap: fully reachable and fleet-visible (not purely mechanician-scoped) on both platforms, with matching transition wiring and role gating.

**Module maturity assessment**: evidence supports a "fractured maturity" profile rather than uniformly weak or uniformly strong — the newer Maintenance Job lifecycle (shared with Mechanician, see below) is fully and matchingly built on both platforms, while the older Vehicle/Machine registry, fuel-log, and daily-log CRUD surfaces retain real, asymmetric gaps (update/delete frequently desktop-only or missing everywhere).

### Mechanician

**Mechanician Dashboard** — Not a Gap: single backend function (`mechanicianDashboard`) powers both platforms identically, including correct data scoping (workshop-restricted for machine/maintenance widgets, strictly user-scoped for personal request/log/fuel widgets) — confirmed no company-wide data leak on either platform.

**Maintenance Jobs (full lifecycle)** — Not a Gap for the 10-transition status machine itself: all transitions (diagnose/start/request_parts/resume/send_external/return_external/test/return_to_service/close/cancel) are defined once server-side and exposed identically on both platforms; `send_external` is correctly restricted to `machines`-holding roles (excludes mechanician) on both. **Workflow Gap, High severity (F-25)**: `useMaintenanceJobAssign` exists and its backing route works, but is never called from any mobile screen — **there is no "Assign Technician" UI on mobile at all.** Since Assign is the transition that moves a job from inspection/diagnosis into `assigned` (a prerequisite for Start), a job manager on mobile cannot progress a job past diagnosis without switching to desktop. **UI Functional Gap (F-26)**: desktop's job-detail overlay has an Audit History tab; mobile's detail screen has no equivalent (minor). Permission Mismatch / Admin UI Gap: P-8 (also affects the `maintenance-jobs` and `maintenance-oversight` keys, not just `machine-maintenance`).

**Waiting for Parts / External Repair dedicated views** — **UI Functional Gap (F-27)**: desktop has two dedicated, backend-enriched views (Waiting for Parts shows linked material-request item/qty/status inline; External Repair shows vendor/date/cost inline); mobile only offers status-filter chips on the flat job list with a one-line note, no linked-record detail until drilling into job detail. **Backend-Only Capability, mobile-only-dead (F-28)**: `useMaintenanceWaitingForParts` hook exists, its route works, but is never called from any mobile screen.

**Material Requests (mechanician entry point)** — Not a Gap: mechanician holds the correct permission on both platforms and both have a dedicated nav entry reaching the shared Material Requests flow (see Inventory module for that flow's own findings, F-6/P-4, which apply here too since mechanician is one of the affected roles for material-request creation, though not typically the approver).

**Machine Logs** — **Permission Mismatch / Broken UI Workflow, High severity (P-9)**: desktop hardcodes an "Add log entry" gate (`canAdd`) to `['admin','operations','supervisor']` — **excluding mechanician**, even though mechanician explicitly holds the backend `machine-logs` permission specifically so it "can actually record the maintenance work it was already meant to do" (per the migration's own comment), and mobile correctly gates the same button via `hasPermission('machine.log')`, which mechanician passes. **Net effect: a mechanician can log machine work on mobile, but the button is invisible to them on desktop** — the opposite of the usual "desktop ahead of mobile" pattern, and a direct contradiction of documented intent. Edit/Delete are desktop-only for admin/operations regardless of role (not mechanician-specific), and mobile has zero PUT/DELETE routes for this resource at all (cross-referenced from Fleet & Equipment, F-23).

**Machine Fuel Logs** — **Permission Mismatch / Broken UI Workflow, High severity (P-10, same pattern as P-9)**: desktop hardcodes `canManage` to `['admin','ceo','operations','logistics','supervisor']`, again excluding mechanician despite it holding the backend `machine-fuel` permission and mobile correctly allowing it via `hasPermission('fuel.machine')`.

**Preventive Maintenance / Maintenance Schedule** — Not a Gap: mechanician is correctly read-only on both platforms, matching documented design (cross-referenced from Fleet & Equipment).

**Corrective Maintenance** — Confirmed **not a separate page** — this is the Maintenance Job lifecycle (above), not a distinct feature; no duplicate audit performed.

**Maintenance Reports / Maintenance Officer Dashboard** — Not a Gap regarding mechanician's own access (correctly excluded from this oversight-only surface on both platforms). **UI Functional Gap confirmed independently (F-24, see Fleet & Equipment)**: fully working backend + mobile-api route, zero mobile UI consumer.

## 6. Permission Mismatches (Consolidated)

| ID | Finding | Roles Affected | Platforms | Confidence |
|---|---|---|---|---|
| P-1 | No `hasPermission()` check exists anywhere in mobile's Procurement screens (Dashboard, Requisitions, Suppliers, POs, Goods Receipt, Invoices) — access relies solely on navigator-level role routing, unlike every other module | All procurement roles | Mobile (systemic) | High |
| P-2 | `logistics-officer` granted full Stock Catalog management server-side + desktop; mobile's `stock.catalog` permission omits it | logistics-officer | Mobile only | High |
| P-3 | `logistics-officer` cannot act on Stock Transfers on **either** platform despite holding the underlying `stock-transfers` backend permission | logistics-officer | Both | High |
| P-4 | Supervisor can approve/reject Material Requests (own workshop) on desktop; mobile's `workshop.approve` excludes supervisor, blocking this on mobile — and since Workshop Overview is mobile's *only* Material Request approval entry point, this also blocks that workflow entirely | supervisor | Mobile only | High |
| P-5 | Desktop deliberately includes `operations` in Dispatch approve rights (migration comment confirms intent); mobile's `dispatch.approve` excludes it, and Operations has no Dispatch nav tab on mobile at all | operations | Mobile only | High |
| P-6 | Mobile's Workshop Overview route hardcodes an allowed-role list excluding `supervisor`/`storekeeper-assistant`, though the backend's own gate grants both, and both roles are in mobile's `workshop` tab group (they will reach the screen and 403) | supervisor, storekeeper-assistant | Mobile only | High |
| P-7 | Mobile's vehicle-fuel-log permission is independently mapped rather than derived from the same `vehicles` grant desktop uses (maintainability risk, not a confirmed live block) | logistics, admin, ceo (as currently mapped) | Mobile (latent) | Medium |
| P-8 | Admin Roles & Permissions editor has no checkbox for `maintenance-jobs`, `machine-maintenance`, or `maintenance-oversight` — these can only be granted via a one-time migration, not through the UI | All roles (admin-side gap) | Desktop only | High |
| P-9 | Mechanician excluded from desktop's hardcoded "Add Machine Log" button despite holding the backend permission and being correctly allowed on mobile | mechanician | Desktop only | High |
| P-10 | Mechanician excluded from desktop's hardcoded "Log Machine Fuel" button despite holding the backend permission and being correctly allowed on mobile | mechanician | Desktop only | High |

## 7. Workflow Gaps

| ID | Finding | Impact | Confidence |
|---|---|---|---|
| W-1 | `requireRoles(ARRAY)` called without spreading in `mobile-api/routes/dispatch.js`, `transport.js`, `sales.js` — every request 403s for every role, including admin | Dispatch, Sales Orders, Transport Carriers/Jobs fully non-functional on mobile | High |
| F-9 | (Consequence of W-1 + P-5) Entire Dispatch approve/reject/dispatch/delete workflow is desktop-only in practice today | Reduces mobile utility for Operations/Logistics roles | High |
| F-25 | No "Assign Technician" UI on mobile — blocks progressing a maintenance job past diagnosis from mobile | Mechanician/job-manager workflow interruption, forces a platform switch mid-task | High |

## 8. Broken UI Workflows

| ID | Finding | Confidence |
|---|---|---|
| W-1 | See §7 — the array-spread bug is the canonical "broken workflow": UI is fully built, server silently rejects every call | High |
| F-1 | Mobile RFQ: `submitQuotation` hook wired correctly but no screen calls it — cannot record a phone/email quotation on mobile | High |
| F-6 | Mobile Material Requests screens have zero approve/reject actions; the only path is an unrelated Workshop Overview tab | High |
| F-8 | Desktop delivery detail's "Change status" button opens the wrong overlay (Edit, which has no status field) instead of a status control | High |
| F-11 | Desktop Workshop Overview's quick-approve button omits the required source warehouse, so it always fails backend validation | High |
| P-9 / P-10 | Desktop hides Machine Logs / Machine Fuel "Add" buttons from mechanician despite backend + mobile allowing it | High |

## 9. UI Functional Gaps

Full list with IDs (F-2 through F-24, excluding those already listed as Broken/Workflow above): F-2 (Backend-only, see §10), F-3 (Stock Catalog bulk-deactivate + detail/history, desktop-only), F-4 (Backend-only, see §10), F-5 (Stock Transfers bulk-approve, desktop-only), F-7 (Inventory Loss Reports, desktop-only, no mobile route at all), F-10 (Sales Order "assign Transport" quick-action, desktop-only), F-12 (Workshop Overview CSV export, desktop-only), F-13 (Workshop detail/History view, desktop-only), F-14 (Add workshop user quick-action, desktop-only, unverified intentionality), F-15 (cross-workshop filter/switcher, desktop-only), F-16 (Backend-only, see §10), F-17 (Vehicle Maintenance delete, mobile-only — mobile ahead), F-18 (Vehicle Fuel delete, mobile-only — mobile ahead), F-19 (Machines delete/deactivate, **missing on both platforms**, see §10), F-20 (Machine KPI Definitions/Targets management, desktop-only, no mobile route), F-21 (Backend-only, see §10), F-22 (Machine Fuel edit/delete, desktop-only), F-23 (Machine Logs edit/delete, desktop-only, no mobile route at all), F-24 (Maintenance Officer Dashboard/Reports, desktop-only despite ready API), F-26 (Maintenance Job Audit History tab, desktop-only, minor), F-27 (Waiting for Parts/External Repair enriched views, desktop-only).

## 10. Backend-Only Capabilities (Orphaned / Dead / Intentional)

| ID | Function | Status | Assessment |
|---|---|---|---|
| F-2 | `procurementPoUpdate` (data.js:15678) | IPC + REST wired, zero UI caller either platform | True dead capability — no "Edit PO" feature exists anywhere despite full backend/API readiness. Candidate for either building the missing UI or removing the endpoint. |
| F-4 | `stockTransferApprove` (singular, legacy, data.js:2872) | IPC + REST + 2 mobile hooks wired, zero screen caller | Deliberately preserved per its own code comment ("for any already-cached mobile build still calling it") — **Intentional Backend Capability**, safe to remove once confirmed no old builds remain in the field. |
| F-16 | `maintenanceUpdate` (data.js:11295) | IPC wired on desktop, no caller; no mobile route | True dead capability — no edit UI exists for a vehicle maintenance record on either platform. |
| F-19 | `machinesDelete` (data.js:11207) | IPC wired on desktop, no caller; no mobile route/hook | **Most consequential orphan in this audit** — a working soft-delete/deactivate function exists, but there is no way to archive a machine from either UI. |
| F-21 | `machineFuelLogsUpdate` (data.js:11373) | IPC wired on desktop, no caller; no mobile route | True dead capability — no edit UI for machine fuel logs on either platform. |
| F-28 | `useMaintenanceWaitingForParts` (mobile hook only) | Route works, hook defined, no screen caller | Mobile-only-dead — desktop's equivalent view is fully built and used. |
| (ref) | `useMaintenanceJobAssign` (mobile hook only) | Route works, hook defined, no screen caller | Mobile-only-dead — this is the direct cause of Workflow Gap F-25 (§7), since desktop's Assign action does use the equivalent backend function. |

## 11. Duplicate Findings Removed

The following findings surfaced independently from two separate module-audit passes and were merged into a single entry (see the ID referenced) rather than reported twice:

- **Supervisor mobile approval gap**: found by the Workshops audit (via Workshop Overview) and the Inventory audit (via Material Requests) — these are the same root cause (mobile's `workshop.approve` permission), since Workshop Overview is mobile's only path to approve a Material Request. Merged into **P-4**.
- **Admin-UI permission-checkbox gaps**: found by the Fleet & Equipment audit (for `machine-maintenance`) and the Mechanician audit (for `maintenance-jobs`/`maintenance-oversight`). Merged into **P-8**, now covering all three keys.
- **Maintenance Officer Dashboard / Reports missing on mobile**: found independently by the Fleet & Equipment audit and the Mechanician audit (the latter verifying it from the mechanician-access angle). Merged into **F-24**.
- **Stock Transfers full-lifecycle confirmation**: the Logistics audit's scoping note and the Inventory audit's own dedicated pass both independently confirmed full CRUD/lifecycle parity — no conflicting information found; the Inventory audit's fuller citation set is retained as the canonical source for this "Not a Gap" finding.

No other exact duplicates were found; the remaining ~30 findings are each specific to one page/root-cause.

## 12. Business Impact Analysis

| Impact Category | Findings |
|---|---|
| **Blocks Daily Operations** | W-1 (mobile Dispatch/Sales/Transport fully down for every role), F-11 (Workshop Overview approve always fails), P-9/P-10 (mechanician cannot log work on desktop), F-25 (mobile cannot progress a job past diagnosis) |
| **Permission Risk** | P-1 through P-10 (all — each represents either an unintended capability restriction or, in principle, a latent risk if the two permission systems drift further) |
| **Reduces Productivity** | F-3, F-5, F-6, F-9, F-13, F-14, F-15, F-19, F-20, F-22, F-23, F-24, F-27 (workarounds exist via the other platform, but force context-switching or manual workarounds) |
| **Causes Incorrect Data** | F-19 (machines can never be archived, so registries accumulate stale/retired equipment indefinitely); minor Deliveries delete-reason gap (§5, Logistics) weakens audit-trail completeness on desktop |
| **Security Risk** | None identified — all permission mismatches found are *under-permissive* (hiding capability the backend allows), not over-permissive. No instance was found of a UI exposing an action the backend would silently allow without proper authorization. |
| **UX Improvement Only** | F-2, F-4, F-16, F-17, F-18, F-21, F-26, F-28, and the naming-inconsistency note under Procurement Contract Register |

## 13. Risk Assessment

- **Highest risk**: W-1. A complete, silent 403 across three mobile modules is the kind of defect that could easily go unnoticed in manual QA if testers primarily use desktop or an admin account that happens to also work on... actually admin is *also* blocked by this bug, since the array-inclusion check fails universally regardless of role. This should have been caught by any mobile smoke test of Dispatch/Sales/Transport; its presence suggests those flows may not be covered by current mobile testing practice.
- **Second-highest risk**: the P-9/P-10 pattern (desktop hiding capability from mechanician that mobile correctly grants) is a *process* risk, not just a point defect — it shows the same "two independently-maintained permission surfaces" architecture that caused W-1's sibling issues (P-2, P-3, P-5, P-6) is a recurring source of defects, not a one-off. A structural fix (a single shared role→permission source of truth consumed by both platforms) would prevent this whole class of future bugs, though that is a larger undertaking than any single fix in this backlog.
- **Lowest risk**: the backend-only orphans (§10) and desktop-ahead UI gaps (bulk actions, detail views) — these are real gaps but don't block any workflow since a working alternative path exists on the other platform (or, for orphans, the capability was never reachable to begin with, so nothing regressed).

## 14. Prioritized Implementation Backlog

### Critical
| ID | Fix | Effort | Type |
|---|---|---|---|
| W-1 | Add the missing spread operator (`...`) to `requireRoles()` calls in `mobile-api/routes/dispatch.js`, `transport.js`, `sales.js` | XS | Backend Change Required |
| F-11 | Workshop Overview desktop approve button: collect source warehouse before calling `materialRequestsApprove` (reuse the dedicated overlay's pattern) | S | UI Change Required, Reuse Existing Components |
| P-9, P-10 | Widen desktop's hardcoded `canAdd`/`canManage` role arrays for Machine Logs and Machine Fuel to include `mechanician` | XS | UI Change Required |
| F-25 | Build mobile "Assign Technician" UI wired to the existing `useMaintenanceJobAssign` hook | M | UI Change Required, Reuse Existing Components |

### High
| ID | Fix | Effort | Type |
|---|---|---|---|
| P-4 | Grant `workshop.approve` to `supervisor` in mobile's permission map | XS | Permission Change Required |
| P-6 | Add `supervisor`/`storekeeper-assistant` to mobile's Workshop Overview `OVERVIEW_ROLES` | XS | Permission Change Required |
| P-5 | Grant `dispatch.approve` to `operations` on mobile + add a Dispatch tab to `OperationsNavigator` | S | Permission Change Required + UI Change Required |
| P-2 | Grant `stock.catalog` to `logistics-officer` on mobile | XS | Permission Change Required |
| P-3 | Grant transfer-act rights to `logistics-officer` on both desktop's `canApprove` array and mobile's permission map | S | Permission Change Required + UI Change Required |
| F-6 | Add Approve/Reject actions directly to mobile's `MaterialRequestDetailScreen` (reuse the existing approval hook already used by Workshop Overview) | S–M | UI Change Required, Reuse Existing Components |
| F-19 | Add a Delete/Deactivate action for Machines to both desktop and mobile (backend function already exists) | S | UI Change Required (both platforms) |
| F-1 | Build a "Record Quotation" form on mobile RFQ detail (hook already exists) | S | UI Change Required, Reuse Existing Components |
| F-8 | Fix desktop's delivery "Change status" button to open the correct control | XS | UI Change Required |
| F-23 | Add PUT/DELETE mobile-api routes + edit/delete UI for Machine Logs | M | Backend Change Required + UI Change Required |

### Medium
| ID | Fix | Effort | Type |
|---|---|---|---|
| P-1 | Extend mobile's `Permission` taxonomy to cover Procurement and wire `hasPermission()` into all 6 procurement screens | L | Permission Change Required + UI Change Required, **Requires Business Decision** (desired granularity) |
| F-24 | Build mobile Maintenance Officer Dashboard/Reports screens (routes already exist) | M | UI Change Required, Reuse Existing Components |
| F-27 | Build enriched Waiting for Parts / External Repair mobile views (data already available) | M | UI Change Required |
| F-20 | Add mobile-api routes + mobile UI for Machine KPI Definitions/Targets management | L | Backend Change Required + UI Change Required |
| F-22 | Add DELETE route + mobile UI for Machine Fuel Logs | M | Backend Change Required + UI Change Required |
| P-8 | Add the 3 missing permission checkboxes to the desktop admin Roles editor | XS | UI Change Required |
| F-3, F-5 | Add bulk actions to mobile Stock Catalog / Stock Transfers | S each | UI Change Required |
| F-13, F-15 | Add a workshop detail view + cross-workshop filter to mobile Workshops List | M | UI Change Required |
| F-7 | Build mobile Inventory Loss Reports (or confirm intentionally desktop-only) | M | UI Change Required, **Requires Business Decision** |

### Low
| ID | Fix | Effort | Type |
|---|---|---|---|
| F-2, F-4, F-16, F-21 | Remove dead backend orphans, or build the missing UI if the capability is actually wanted | XS (remove) / S (build) each | **Requires Business Decision** per item |
| F-12, F-14, F-17, F-18, F-26 | Minor parity items (export button, quick-action, delete actions, history tab) | XS–S each | UI Change Required |
| Deliveries reason gap | Pass `reason` through desktop's delivery-delete IPC call | XS | UI Change Required |

## 15. Recommended Phase Order

1. **Phase A — Stop the Bleeding (Critical items)**: W-1, F-11, P-9, P-10, F-25. All are XS–M effort, several are one-line/one-array fixes, and together they resolve every finding classified as "Blocks Daily Operations." Estimated 1 focused sprint.
2. **Phase B — Permission Parity (High-priority permission mismatches)**: P-2 through P-6, plus F-6, F-19, F-1, F-8, F-23. These close every confirmed case of the backend permitting an action the UI silently hides, and fix the one confirmed missing-Delete gap (Machines). Estimated 1–2 sprints.
3. **Phase C — Reporting & Management Parity (Medium items)**: F-24, F-27, F-20, F-22, P-8, F-3/F-5 bulk actions, F-13/F-15 workshop detail/filter. Estimated 2–3 sprints, largely independent/parallelizable UI work.
4. **Phase D — Procurement Permission Architecture (P-1)**: the one item explicitly flagged as needing a business decision on scope before implementation — should be scheduled once stakeholders confirm the desired mobile permission granularity for Procurement. Estimated 1–2 sprints once scoped.
5. **Phase E — Cleanup**: dead-code decisions (F-2, F-4, F-16, F-21) and remaining Low-priority parity items — can be interleaved with any other phase as capacity allows.

## 16. Estimated Total Implementation Effort

Using the brief's XS/S/M/L/XL scale (XS ≈ <1 day, S ≈ 1–3 days, M ≈ 3–7 days, L ≈ 1–3 weeks):

- Critical (4 items): ~1 XS + 2 S/M + 1 XS ≈ **4–6 days**
- High (10 items): mix of XS/S/M ≈ **3–4 weeks**
- Medium (10 items, incl. 1 L): ≈ **4–6 weeks**
- Low (8+ items): ≈ **1–2 weeks**, contingent on business decisions for the dead-code items

**Total estimated effort: roughly 9–13 weeks of focused implementation work** across both platforms, assuming Phase D (P-1)'s scope is resolved quickly once reached. This is a rough sizing estimate for planning purposes, not a committed schedule — actual effort depends on team familiarity with each codebase area and how many items can run in parallel across desktop/mobile/backend workstreams.

## 17. Final Enterprise Readiness Assessment

The application's backend is broadly mature and its two UI clients are, for the large majority of pages audited, in genuine functional parity — most of this audit's ~39 pages returned "Not a Gap." The issues found are real but concentrated: one critical, narrow-scope bug (W-1) currently disables three mobile modules entirely and should be treated as a production-blocking defect, not a backlog item, if mobile Dispatch/Sales/Transport are in active use today. Beyond that, the recurring pattern across nearly every "Permission Mismatch" finding — two independently-maintained role/permission definitions (desktop's hardcoded arrays plus page-key grants, mobile's separate `hasPermission()` map) drifting out of sync — is the audit's most important structural finding, since it's the root cause of roughly half of all findings in this report and will keep generating similar defects until addressed architecturally, not just patched finding-by-finding.

**Readiness verdict**: **Not yet at full cross-platform functional parity**, but closer to it than the module-by-module framing might suggest — 4 of 6 modules (Logistics, Workshops, Procurement, Inventory) have their core workflows fully working end-to-end once W-1 is fixed; Fleet & Equipment and Mechanician have a longer tail of genuine gaps (several dead backend functions, no machine-archival path anywhere, and the mechanician-exclusion bugs) that reflect real, if narrower, incompleteness rather than a fundamentally broken foundation. Fixing the Critical and High backlog items (Phases A–B, roughly 4–5 weeks combined) would bring the application to a state where every backend-supported workflow is reachable, by the correct roles, from both platforms — a reasonable bar for calling this audit's objective met.
