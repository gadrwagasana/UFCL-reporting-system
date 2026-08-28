# ERP Enterprise Completion Phase 1 — Permission, Notification & Audit Integrity Audit

**Status: AUDIT COMPLETE. No code was written, edited, or modified during this phase. No architecture — including Workshop Isolation — was redesigned, replaced, weakened, or broadened. Presented for review — implementation must not begin until explicitly approved.**

---

## 1. Executive Summary

This phase closes the three verification gaps the previous Enterprise End-to-End Work Completion Audit left open. Unlike that audit, all three background research agents completed successfully this time, producing **56 source-cited findings** across permissions (21), notifications (27), and audit trail (4), plus this auditor's own direct, live-tested Workshop Isolation investigation (4 findings, including one **live-confirmed** cross-workshop data exposure).

**Headline results:**
- **Audit trail tamper protection: PASS.** Database-level immutability is genuinely implemented via two real Postgres RULEs, independently confirmed by direct SQL inspection; application-level protection also PASS (no code path anywhere mutates `audit_log`).
- **Workshop Isolation: PASS overall**, with one confirmed exception. The standard, ~40-occurrence enforcement pattern (`isWorkshopRestricted(user) ? user.workshop_id : (p.workshop_id...)`) is correct and consistently applied everywhere except three functions in the Poles Procurement module, one of which was **live-verified exploitable**: a Nyanza-based `poles-leader` can view Gatare's poles purchase data by passing a foreign `workshopId` directly to the backend function — not reachable through the normal desktop UI (the workshop-filter dropdown is correctly hidden for restricted roles) but reachable via direct IPC invocation.
- **Two roles are effectively non-functional out of the box**: `poles-supervisor` and `vat-supervisor` are seeded with zero pages by the migration script and never granted their base pages by any subsequent grant function — the mobile app shows their tabs, but every action inside those tabs fails backend-side.
- **A real elevation-of-privilege path exists**: `storekeeper-assistant` and `logistics-officer` can approve/reject Material Requests company-wide (auto-creating live Stock Transfers), directly contradicting their own documented "cannot approve or delete records" role description.
- **Two unauthenticated-by-role reads exist**: the Procurement CEO-approval-threshold config and the full disposal/write-off resolution history are readable by any authenticated user of any role, with no permission check at all.
- **Notification coverage has real, systemic gaps**: Harvesting is almost entirely silent (plan creation, plan status changes, harvest execution, log transport, delays — only Harvest Waste notifies); Sawmill's core `dailyCreate` and pre-QC offcut pipeline are silent; Rework is the only one of four rejection-resolution paths that doesn't notify. The notifications table itself has **no workshop-scoping column at all**, so every workshop-specific event broadcasts to every holder of the relevant role company-wide, not just the relevant workshop's staff.
- Two Procurement notification recipient-correctness bugs: `invoice_approved` excludes the `finance` role that actually processes payment; `payment_approved`/`payment_rejected` broadcast financially sensitive information company-wide with no role filter, which the code's own comments acknowledge as deliberate.

**No findings in this phase reach Critical** under the brief's own definition (prevents completion of a real business process, or causes inventory/financial corruption) — the closest is PERM-1 (two roles non-functional) and the live-confirmed Workshop Isolation gap, both classified High. This is stated plainly, not softened: several of these findings are genuinely serious and should not wait indefinitely, but none of them corrupt data or block an entire department's ability to operate.

## 2. Audit Scope

Departments: Procurement, Harvesting, Logistics, Inventory, Workshops, Fleet & Equipment, Mechanician, Sawmill, Timber Lifecycle, Value-Added Production, Showroom, Sales, Financial/Reporting. Platforms: Desktop, Mobile, Backend services, REST API, Permission middleware, Database/service layer.

**Methodology**: three parallel background research agents (Part 1 — permission matrix; Part 3/4 — notification coverage; Part 5/6/7 — audit trail integrity), each independently verifying against current source code, all completed successfully this time. The primary auditor personally performed Part 2 (Workshop Isolation — kept under direct control given its sensitivity and the explicit no-redesign constraint), Part 10 (live verification), and Part 11 (static verification), then synthesized all four workstreams into this report. Every finding below traces to an exact file:line citation or a live database transaction; per Part 13, anything without sufficient evidence is marked UNCERTAIN rather than asserted.

## 3. Current Architecture

- **Roles**: 24 roles confirmed live in source (see §4), seeded in `db/migrate.js` across three waves (`seedRoles()`, `seedNewLogisticsRoles()`, `seedProcurementRoles()`), with `role_definitions.permissions` as the live, admin-editable source of truth and `db/services/data.js`'s static `ROLE_PAGES` object as a fallback used only when a role's live permissions array is empty (`getRolePages`, `data.js:151-156`).
- **Workshop Isolation**: `isWorkshopRestricted(user)` (`data.js:199-202`) — true for any user with a `workshop_id` except `admin`/`ceo`/`operations`/`logistics` (the documented administrative-override set). ~40 call sites use the correct `restricted ? user.workshop_id : (workshopId||null)` read pattern and 12 use the correct `isWorkshopRestricted(user) ? user.workshop_id : (p.workshop_id...)` write pattern.
- **Notifications**: single shared `pushNotification()` (`data.js:476-509`) writing to one `notifications` table with no workshop column; both desktop (Electron IPC) and mobile (`mobile-api/routes/notifications.js`) read the identical backend list/poll functions — confirmed no platform-specific gap, but also confirmed no workshop-scoping capability exists at all.
- **Audit Trail**: single primary writer `logAudit()` (`data.js:432-474`), fire-and-forget with a self-healing retry queue on insert failure; two additional narrow, INSERT-only writers exist specifically for login/logout events (`mobile-api/routes/auth.js`, `db/services/auth.js`) since a failed login has no valid `user` object for `logAudit`'s signature. Tamper protection is via two genuine Postgres `RULE`s, not application convention.
- **Approval**: not one engine — several purpose-built mechanisms (generic `pending_edits`/`deletion_requests` engine via `processApprovalDecision`; Procurement's own step-based `procurementApprovalAction`; simple elevated-role gates used throughout Timber Lifecycle). Confirmed working correctly where traced; the generic engine has no workshop-scoping concept at all (see §5, WI-4).

## 4. 13-Role Permission Matrix

The live role count is **24**, not 13 — the brief's "13-role" framing undercounts the actual current role set; all 24 are audited below, not a subset.

| # | Role | Seeded | Base pages granted? |
|---|---|---|---|
| 1 | admin | migrate.js:597 | ✓ |
| 2 | ceo | migrate.js:598 | ✓ |
| 3 | operations | migrate.js:599 | ✓ |
| 4 | sales | migrate.js:600 | ✓ |
| 5 | finance | migrate.js:601 | ✓ |
| 6 | logistics | migrate.js:602 | ✓ |
| 7 | supervisor | migrate.js:603 | ✓ |
| 8 | storekeeper | migrate.js:604 | ✓ |
| 9 | logistics-officer | migrate.js:858 | ✓ |
| 10 | storekeeper-assistant | migrate.js:863 | ✓ |
| 11 | mechanician | migrate.js:868 | ✓ |
| 12 | harvesting-leader | migrate.js:874 | ✓ |
| 13 | sawmill-leader | migrate.js:879 | ✓ |
| 14 | poles-leader | migrate.js:885 | ✓ |
| 15 | vat-leader | migrate.js:890 | ✓ |
| 16 | harvesting-supervisor | migrate.js:896 | ✓ |
| 17 | sawmill-supervisor | migrate.js:901 | ✓ |
| 18 | **poles-supervisor** | migrate.js:907 | **✗ — PERM-1** |
| 19 | **vat-supervisor** | migrate.js:912 | **✗ — PERM-1** |
| 20 | sales-staff | migrate.js:918 | ✓ |
| 21 | showroom-staff | migrate.js:923 | ✓ |
| 22 | procurement-officer | migrate.js:2455 | ✓ |
| 23 | procurement-manager | migrate.js:2460 | ✓ |
| 24 | department-manager | migrate.js:2465 | ✓ |

Full capability matrix (role × key action), as built by the permission-matrix research pass:

| Role | Dashboard | Harvest create | Sawmill production | Quality Inspection | Rejection/Disposal | Stock Transfer create/receive | Mat. Req create/approve | Sales create | Maint. Job create/assign | Vehicle/Fuel log |
|---|---|---|---|---|---|---|---|---|---|---|
| admin | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓/✓ | ✓ | ✓/✓ | ✓ |
| ceo | ✓ | ✓ | ✗ | ✓ | ✓ | ✓ | ✓/✗ (no stock-movements) | ✓ | ✓/✓ | ✓ |
| operations | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓/✓ | ✓ | ✓/PERM-6 | ✗ |
| sales | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗/✗ | ✓ | ✗ | ✗ |
| finance | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗/✗ | ✗ | ✗ | ✗ |
| logistics | ✓ | ✗ | ✗ | ✗ | ✗ | ✓ | ✓/✓ | ✗ | ✓/✓ | ✓ |
| supervisor | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓/✓ (own workshop) | ✗ | route✓/PERM-7,8 | ✗ |
| storekeeper | ✓ | ✗ | ✗ | ✗ | ✗ | ✓ | ✓/✓ (via stock-movements) | ✗ | ✗ | ✗ |
| logistics-officer | ✓ | ✗ | ✗ | ✗ | ✗ | ✓ | ✓/**PERM-3** | ✗ | ✗ | ✗ |
| storekeeper-assistant | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓/**PERM-3** | ✗ | ✗ | ✗ (machine-fuel only) |
| mechanician | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓/✗ | ✗ | route✓/PERM-7,8 | ✓ |
| harvesting-leader | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✓/✗ | ✗ | ✗ | ✗ |
| sawmill-leader | ✓ | ✗ | ✓ | ✓ (offcut only) | ✗ (downgrade/return excluded) | ✗ | ✓/✗ | ✗ | route✓/PERM-7,8 | ✓ |
| poles-leader | ✓ | ✗ | ✓ | ✓ (poles QC) | ✗ | ✗ | ✓/✗ | ✗ | route✓/PERM-7,8 | ✓ |
| vat-leader | ✓ | ✗ | ✓ (VAT entry) | ✓ (VAT inspect) | ✗ | ✓ | ✓/✗ | ✗ | ✗ | ✗ |
| harvesting-supervisor | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗/✗ | ✗ | ✗ | ✗ |
| sawmill-supervisor | ✓ | ✗ | ✓ | ✗ | ✗ | ✗ | ✗/✗ | ✗ | ✗ | ✗ |
| **poles-supervisor** | **PERM-1 ✗** | ✗ | **PERM-1 ✗** | ✗ | ✗ | ✗ | ✗/✗ | ✗ | ✗ | ✗ |
| **vat-supervisor** | **PERM-1 ✗** | ✗ | **PERM-1 ✗** (VAT entry) | ✓ array-only, unreachable (PERM-1) | ✗ | ✓ | ✗/✗ | ✗ | ✗ | ✗ |
| sales-staff | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗/✗ | ✓ | ✗ | ✗ |
| showroom-staff | ✓ | ✗ | ✗ | ✗ | ✗ | ✓ | ✗/✗ | ✓ | ✗ | ✗ |
| procurement-officer | n/c | ✗ | ✗ | ✗ | ✗ | ✗ | ✗/✗ | ✗ | ✗ | ✗ |
| procurement-manager | n/c | ✗ | ✗ | ✗ | ✗ | ✗ | ✗/✗ | ✗ | ✗ | ✗ |
| department-manager | n/c | ✗ | ✗ | ✗ | ✗ | ✗ | ✗/✗ | ✗ | ✗ | ✗ |

Procurement Requisition **create** is granted to every role (an all-roles grant loop). Procurement Requisition **approve** is a dynamic, step-based workflow keyed on `procurement_approval_steps.assigned_role`, not a static role list — marked `n/c` throughout since resolving it accurately needs live workflow-config data, out of scope for a static-source pass.

## 5. Workshop Isolation Verification

Per the brief's explicit instruction, this section reports **PASS / FAIL / UNCERTAIN only**, with source evidence. Nothing was redesigned, replaced, weakened, or broadened.

```
WI-1: Standard write-side enforcement pattern
Trace: Authenticated User → Role → isWorkshopRestricted(user) → workshopId forced server-side → INSERT
Evidence: 12 confirmed call sites of `const workshopId = isWorkshopRestricted(user) ? user.workshop_id : (p.workshop_id ? Number(p.workshop_id) : null);` (data.js:846,1164,3910,5404,5501,6807,8169,8888,9153,9175,9247,17740), covering dailyCreate, salesCreate, materialRequestsCreate, harvestCreate, harvestPlanCreate, valueAddedTimberCreate, procurementRequisitionCreate, and others.
Result: PASS — NO CHANGE REQUIRED.
```

```
WI-2: Standard read-side enforcement pattern
Trace: Authenticated User → Role → isWorkshopRestricted(user) → wId forced to user's own workshop, ignoring any client-supplied value, unless the user is in the admin/ceo/operations/logistics exemption set → SELECT ... WHERE workshop_id = wId
Evidence: ~40 confirmed call sites of `const restricted = isWorkshopRestricted(user); const wId = restricted ? user.workshop_id : (workshopId || null);` across stockItemsList, inventoryList, harvestList, harvestPlanList, materialRequestsList, and the majority of list/report functions.
Result: PASS — NO CHANGE REQUIRED.
```

```
WI-3: Poles Procurement Workflow (read + write) — CONFIRMED EXCEPTION
Trace (read): Authenticated User → canAccessDaily(user) [generic page check, NOT isWorkshopRestricted] → wid = workshopId ? Number(workshopId) : (user.workshop_id || null) [CLIENT VALUE PRIORITIZED] → SELECT
Evidence: polesPurchaseList (data.js:3291-3294) uses `const wid = workshopId ? Number(workshopId) : (user.workshop_id || null);` — the ONLY occurrence in the entire codebase of this client-priority ordering (confirmed via `grep "workshopId ? Number(workshopId)"` — exactly 1 match).
Live verification (Part 10, read-only + one throwaway QA record, cleaned up — see §16):
  - TEST A (normal desktop UI path, WORKSHOP_FILTER=null for a restricted role — confirmed by reading workshopBannerHtml, data.js/app.js:34-52, which renders a non-interactive badge with NO dropdown when userWorkshopId is set, so a restricted user has no UI-reachable way to change WORKSHOP_FILTER): a real poles-leader user (workshop 4) correctly did NOT see a throwaway QA poles_purchase_request created at workshop 3. PASS through normal UI.
  - TEST B (crafted call, workshopId=3 passed explicitly, same poles-leader user, workshop 4): the same user DID see the workshop-3 fixture. VULNERABILITY LIVE-CONFIRMED at the service layer.
Trace (write): polesPurchaseCreate (data.js:3335-3350) and polesDeliveryCreate (data.js:3367-3387) both use `const wid = user.workshop_id || (p.workshop_id ? Number(p.workshop_id) : null);` — falls through to trusting the client-supplied workshop_id ONLY when user.workshop_id is null/falsy. Live DB check (read-only, §16) confirmed the one poles-leader and both supervisor accounts that can currently call these functions all have workshop_id correctly set — this write-side issue is NOT currently exploitable with live data, but has no structural safeguard preventing it if a future account of one of these roles were ever created or edited with a null workshop_id.
Result: FAIL for polesPurchaseList (live-confirmed, service-layer, not reachable via normal UI). FAIL (latent/conditional) for polesPurchaseCreate/polesDeliveryCreate (real code deviation from the established pattern; not currently exploitable given today's live account data, but no safeguard prevents the precondition).
Recommendation: bring all three functions in line with the standard pattern used everywhere else (WI-1/WI-2). Do not implement during this audit phase.
```

```
WI-4: Generic Approval Engine (pending_edits / deletion_requests) — workshop scoping
Trace: processApprovalDecision (data.js:9574) checks `allowedRoles.includes(user.role)` (LEADER_APPROVERS/MANAGER_APPROVERS, data.js:231-236) — role membership only.
Evidence: pending_edits and deletion_requests tables have NO workshop_id column at all (confirmed via grep across db/schema.sql and db/migrate.js — zero matches). LEADER_APPROVERS includes 'supervisor' with no workshop qualifier anywhere in the function. The same absence of workshop-scoping was independently found in the notification layer's escalation roles (LEADER_NOTIFY_ROLES/MANAGER_NOTIFY_ROLES, NOTIF-18) — suggesting this may be a deliberate, consistent design choice (a company-wide governance/escalation layer, distinct from the day-to-day data-access restriction that IS workshop-scoped) rather than an oversight.
Result: UNCERTAIN — additional verification required. This audit cannot determine from source code alone whether cross-workshop approval authority for the generic edit/delete governance layer is intentional business policy or an unaddressed gap. Per Part 13, this is reported as UNCERTAIN, not converted into a FAIL.
```

**Overall Workshop Isolation verdict: PASS for the established architecture and its ~52 correctly-implemented call sites, with one confirmed, narrow exception (Poles Procurement, 3 functions) and one open question (WI-4) requiring a business-policy decision, not a code investigation, to resolve.**

## 6. Backend Permission Verification

Covered in full in §4/§10 (Confirmed Findings). Summary: the backend service-layer checks themselves (the actual `mustRole()`/literal-role-array logic inside `data.js` functions) were found to be the more reliable, better-designed layer overall — most Tier 2 findings (§10) are cases where the backend is *correct* and a separate route-layer array is stale, not the reverse.

## 7. Desktop Permission Verification

One confirmed desktop-specific gap: PERM-2 (Showroom page unreachable via desktop sidebar for any role, including admin, because the literal permission key `'showroom'` is never granted by default anywhere in `db/migrate.js` — only addable via the admin's manual permission-editor checkbox). All other desktop-layer checks in this pass were marked "not independently checked" by the research agent rather than guessed — see §19 (Uncertain Findings).

## 8. Mobile Permission Verification

Multiple confirmed mobile-specific gaps, all in §10: PERM-1 (tabs shown, every action fails), PERM-4 through PERM-16 (route arrays narrower or wider than the backend they front). Mobile's navigator-level routing (`MainNavigator.tsx`) itself was confirmed complete — every one of the 24 roles has a working top-level navigator mapping; all mobile findings are at the page/action layer, not "can't log in."

## 9. Notification Coverage

Full findings in §10. Summary table (business event → fires?):

| Department | Confirmed Firing | Confirmed Missing |
|---|---|---|
| Procurement | Requisition submit/approve/reject/return, RFQ create, PO create, Goods receipt, Invoice match/approve, Payment approval-required/approved/rejected | Supplier selection, Invoice created |
| Harvesting | Harvest Waste only | Plan created, Plan status change (incl. auto-Completed), Harvest execution, Log transport, Delays |
| Logistics | Dispatch created, POD rejection | Dispatch reviewed (decision), Delivery order created/status update, POD **completion** (only rejection notifies) |
| Inventory | Material Request create/approve/reject, Stock Transfer create/approve/reject/receive-complete/discrepancy, Low stock alert | Stock Transfer **dispatch**, Stock adjustment |
| Sawmill/Timber Lifecycle | Harvest Waste, QC rejection (Sawmill+VAT), Downgrade, Return-to-Inventory, Scrap/Disposal, Showroom Damage | Production (`dailyCreate`), Offcut create/decide/resaw-recovery, **Rework** (only one of four rejection-resolution paths silent) |
| Mechanician/Fleet | Job create/assign/request-parts/send-external/close | Job **cancel**, Fuel logging (likely intentional — see NOTIF-26) |

## 10. Confirmed Findings

Findings are grouped by domain. Each uses the exact field format required by Part 12 / the finding-format templates used by each research pass.

### 10.1 Permission Findings (High priority — Tier 1)

```
ID: PERM-1
Module: Sawmill (Poles) / Timber Lifecycle (Value-Added)
Page / Workflow: Daily Poles entry (poles-supervisor); Value-Added Timber entry (vat-supervisor); Dashboard (both)
Layer: Backend, Desktop, Mobile
Finding: poles-supervisor and vat-supervisor are seeded with zero permissions (migrate.js:907,912,935) and never granted base pages by any subsequent grant function — updateRolePermissions()'s permissionsByRole object (migrate.js:738-841) omits both roles entirely, unlike every sibling leader/supervisor role. The data.js ROLE_PAGES fallback (data.js:143-144) that WOULD cover them is unreachable once any permission is granted (getRolePages, data.js:151-156) — and grantProcurementPermissions()/grantStockTransfersToNyanzaShowroom() do grant a couple of unrelated pages, permanently disabling the fallback.
Evidence: migrate.js:738-841 (absence), migrate.js:907,912,935 (zero-permission seed), data.js:143-144,151-156 (unreachable fallback), data.js:841-843 (dailyCreate denies), data.js:8879-8882 (valueAddedTimberCreate denies), mobile/src/navigation/PolesSupervisorNavigator.tsx:40-41, VatSupervisorNavigator.tsx:40-41 (mobile tabs render unconditionally, no client-side gate)
Expected Behavior: These roles should be able to log daily production and view the dashboard, per their own migrate.js descriptions ("Records daily poles entries...", "Records VAT entries...").
Actual Behavior: Net permissions after full migration: poles-supervisor = procurement pages only; vat-supervisor = procurement pages + stock-transfers only. Neither holds 'dashboard', 'daily-poles', or 'value-added-timber'.
Business Impact: A poles-supervisor or vat-supervisor account, as shipped by a fresh migration, cannot perform the core job the role exists for. Mobile makes this worse by showing fully-reachable tabs that fail on every submit.
Priority: High
Recommendation: Add both roles to updateRolePermissions()'s permissionsByRole, mirroring harvesting-supervisor/sawmill-supervisor's pattern. Do not implement.
```

```
ID: PERM-3
Module: Inventory / Logistics
Page / Workflow: Material Requests — Approve/Reject
Layer: Backend, API
Finding: materialRequestsApprove (data.js:3936,3955-3958) grants full, company-wide, non-workshop-scoped approval authority to any role holding the 'stock-movements' permission. Both logistics-officer and storekeeper-assistant hold 'stock-movements' (migrate.js:794-799), directly contradicting logistics-officer's own documented description ("...cannot approve or delete records", migrate.js:860).
Evidence: data.js:3936,3955-3958,3967-3996 (approval auto-creates a live Stock Transfer as a side effect); migrate.js:794-799,860; mobile-api/routes/materialRequests.js:51-76 (no route-level gate narrows this)
Expected Behavior: Per the role's own documentation, storekeeper-assistant/logistics-officer should have read/limited-scope access, not company-wide approval authority.
Actual Behavior: Both roles can approve/reject any pending material request company-wide, immediately creating a live Stock Transfer.
Business Impact: A real, functioning elevation-of-privilege path — not cosmetic.
Priority: High
Recommendation: Narrow materialRequestsApprove's check to an actual approval-tier role list, or introduce a distinct 'material-requests-approve' permission. Do not implement.
```

```
ID: PERM-17
Module: Procurement
Page / Workflow: GET /api/procurement/meta/config (CEO approval threshold)
Layer: Backend
Finding: procurementConfigGet (data.js:17392-17401) has no role/page check at all — only JWT validity. Its sibling procurementConfigUpdate correctly requires admin/ceo.
Evidence: data.js:17392-17401 vs. 17403-17411
Expected Behavior: A sensitive financial control threshold should require at minimum a procurement-reports-tier permission to read.
Actual Behavior: Any authenticated user of any role can read it.
Business Impact: Any employee can learn the exact threshold above which a requisition requires CEO approval, enabling deliberate under-threshold structuring.
Priority: High
Recommendation: Add a role/page check to procurementConfigGet. Do not implement.
```

```
ID: PERM-18
Module: Timber Lifecycle
Page / Workflow: GET /api/resolutions (disposal/write-off history — all sources)
Layer: Backend
Finding: resolutionsList (data.js:8486-8488) has no role check beyond authentication.
Evidence: data.js:8486-8488, contrasted with resolutionCreate's proper gate
Expected Behavior: Financially sensitive disposal/write-off records (volumes, unit costs, resolver identity) across every department should require a relevant permission to view.
Actual Behavior: Any authenticated user of any role can view them.
Business Impact: Broad, unnecessary exposure of financial write-off data.
Priority: High
Recommendation: Add a role/page check mirroring resolutionCreate's gate. Do not implement.
```

### 10.2 Permission Findings (Medium priority — Tier 2, Authorization Drift)

```
ID: PERM-2 — Showroom page unreachable on desktop (any role, including admin) — mobile unaffected. Layer: Desktop. Evidence: app.js:179 NAV entry + buildSidebar's allowed.has('showroom') gate (app.js:501-521) vs. migrate.js's total absence of 'showroom' from any default grant. Priority: Medium. Recommendation: grant 'showroom' by default to showroom-staff/admin/ceo. Do not implement.

ID: PERM-4 — harvesting-leader/sawmill-leader/poles-leader/vat-leader hold 'workshop-overview' backend-side but mobile-api/routes/workshops.js's OVERVIEW_ROLES array omits all four, dead-ending them at 403 despite an existing prior fix that added supervisor/storekeeper-assistant for this exact class of gap. Priority: Medium. Do not implement.

ID: PERM-5 — mechanician/supervisor/sawmill-leader/poles-leader hold 'machine-logs' (satisfying machinesList's OR-chain) but mobile-api/routes/machines.js's MACHINE_ROLES omits all four — confirmed concretely broken (machine picker in Maintenance Job Create fails for exactly the roles that workflow was built for). Priority: Medium-High. Do not implement.

ID: PERM-6 — operations holds 'machines' but mobile-api/routes/machines.js's REGISTER_ROLES (create/edit/delete + maintenance-schedule) omits it, with no documenting comment (unlike the mechanician exclusion elsewhere). Priority: Medium. Do not implement.

ID: PERM-7 — maintenanceJobCreate (data.js:13199) still gates on the old, narrower 'machines' permission instead of 'maintenance-jobs' (which its own siblings correctly use) — mechanician, the role this feature was built for, plus supervisor/sawmill-leader/poles-leader, all hit a dead-end 403 on submit despite the route allowing them through. Priority: High (core feature broken for its primary intended role). Do not implement.

ID: PERM-8 — Same root cause as PERM-7, affecting maintenanceJobAssign (data.js:13232), which — unlike its siblings maintenanceJobTransition/LabourAdd — has no _maintCanWork() fallback. Priority: High. Do not implement.

ID: PERM-9 — changesReview (data.js:1786-1789) excludes 'admin' from its isMgr array, unlike every sibling changes-endpoint and unlike the route layer (which does include admin) — admin gets Access Denied approving change requests on mobile. Priority: Medium. Do not implement.

ID: PERM-10 — usersDelete is intentionally admin-only (data.js:1974-1976) but the route lets ceo/operations through to a UI action that always fails — misleading UX, backend is the safe/correct side. Priority: Low. Do not implement.

ID: PERM-11/12/13 — Automation Escalations (list/resolve/acknowledge): backend intends ~10-13 leader/manager/procurement/finance roles; mobile-api/routes/automation.js's route arrays admit only 3 (ADMIN_CEO_OPS) or a narrower MGR_ROLES missing procurement-manager/finance for resolve specifically. Priority: Medium. Do not implement.

ID: PERM-14/15 — mobile-api/routes/ceo.js's shared ceoOnly const (ceo+admin) fronts two functions that are hardcoded strictly ceo-only in the backend (monthlyApprove, polesPurchaseApprove) — admin sees the action, backend always denies it; reports.js's equivalent route for the same monthlyApprove function is correctly ceo-only, so the same backend function is gated inconsistently across two route files. Priority: Low-Medium. Do not implement.

ID: PERM-16 — casualLabourRequestsReview is ceo/operations-only in the backend (data.js:9188-9190); the route explicitly includes admin (mobile-api/routes/casualLabour.js:39) — directly contradicting that same route file's own inline comment stating "ceo or operations ONLY." Priority: Low-Medium. Do not implement.
```

### 10.3 Permission Findings (Lower priority)

```
ID: PERM-19 — customersCreate (data.js:7416-7420) has no mustRole check at all — currently safe only because the route array (mobile-api/routes/customers.js) happens to cover it; a latent landmine for any future direct caller. Priority: Low. Do not implement.

ID: PERM-20 — canAccessDaily() (a generic 'daily'/'daily-timber'/'daily-poles' page check) gates Sawmill-specific Production Offcuts/Resaw/Reconciliation/Quality Report endpoints, letting poles-leader/poles-supervisor (holders of 'daily-poles' only) reach Sawmill (Gatare) data — contrary to poles-leader's own documented "No access to timber... modules" description. productionOffcutCreate also trusts the referenced daily_log's own workshop_id rather than validating it against the caller's, unlike dailyCreate. Priority: Medium. Do not implement.

ID: PERM-21 — a stale code comment in mobile-api/routes/poles.js:44 lists an outdated role set for polesDeliveryCreate; the actual backend array is correct and there is no enforced gate on this route today, so the comment has zero live effect — flagged only because a future developer copying the comment into a new enforced gate would introduce real drift. Priority: Low (documentation only). Do not implement.
```

### 10.4 Workshop Isolation Findings

See §5 (WI-1 through WI-4) for the full PASS/FAIL/UNCERTAIN evidence. Summary for this section's index:

```
ID: WI-3a
Module: Sawmill (Poles)
Page / Workflow: polesPurchaseList
Layer: Backend
Finding: Live-confirmed cross-workshop data exposure via a crafted workshopId parameter.
Evidence: data.js:3291-3294; live test in §16.
Expected Behavior: A poles-leader/poles-supervisor should only ever see their own workshop's poles purchase/delivery data, matching every other list function in the codebase.
Actual Behavior: The function honors a client-supplied workshopId unconditionally.
Business Impact: Cross-workshop visibility into supplier names, quantities, and prices — not reachable via normal UI (dropdown correctly hidden for restricted roles) but reachable via direct IPC invocation from the desktop app.
Priority: High
Recommendation: Change to the standard restricted ? user.workshop_id : (workshopId||null) pattern. Do not implement.
```

```
ID: WI-3b
Module: Sawmill (Poles)
Page / Workflow: polesPurchaseCreate, polesDeliveryCreate
Layer: Backend
Finding: Write-side workshop_id resolution (user.workshop_id || p.workshop_id) falls through to trusting the client value only when user.workshop_id is null — not currently exploitable (live-checked: the accounts that can call these functions all have workshop_id set) but structurally inconsistent with the standard pattern and has no safeguard against the precondition ever occurring.
Evidence: data.js:3342,3374; live DB check in §16.
Priority: Medium
Recommendation: Align with the standard isWorkshopRestricted(user) ? user.workshop_id : (p.workshop_id...) pattern. Do not implement.
```

### 10.5 Notification Findings

```
ID: NOTIF-03 — Procurement invoice_approved notifies procurement-officer/manager only; finance (the role that actually creates payment, gated to admin/ceo/finance) is never told. Priority: Medium-High. Do not implement.

ID: NOTIF-04 — payment_approved/payment_rejected have NO roles/forUserId filter at all (confirmed by the code's own comment calling this deliberate) — every employee company-wide receives supplier payment amounts and status. Priority: Medium-High (financial-data over-exposure). Do not implement.

ID: NOTIF-01 — Supplier selection (procurementQuotationSelect) generates zero notification despite closing the RFQ and rejecting competing quotations. Priority: Medium. Do not implement.

ID: NOTIF-02 — Invoice creation generates zero notification (narrow window, since matching typically follows same-day). Priority: Low. Do not implement.

ID: NOTIF-05 — Invoice approval_required fires, then is immediately superseded by invoice_approved/rejected in the same request when no approval step pre-existed — a stale-on-arrival notification, UX defect not data-integrity. Priority: Low. Do not implement.

ID: NOTIF-06/07/08/09/10 — Harvesting is almost entirely silent: plan created, plan status change (including the automatic Planned→In Progress→Completed cascade), harvest execution, log transport readiness, and delays all generate zero notification — only Harvest Waste (added later, Timber Lifecycle Phase 1) notifies. Priority: Medium (the auto-Completed transition, NOTIF-07, is arguably the most impactful single gap here since it's a genuine unattended milestone). Do not implement.

ID: NOTIF-12 — Dispatch decision (approve/reject/dispatched) never notifies the original requester, though dispatch creation itself does notify approvers — breaks the create→decide→notify-requester pattern used everywhere else. Priority: Medium. Do not implement.

ID: NOTIF-13 — Delivery order creation and status updates (including 'Failed') generate zero notification. Priority: Medium (Failed status specifically). Do not implement.

ID: NOTIF-14 — Delivery completion (POD) only notifies on the rejection branch; a fully successful delivery — the more common outcome — is silent. An inverted priority (bad news speaks, good news doesn't). Priority: Medium. Do not implement.

ID: NOTIF-15 — Stock Transfer dispatch is the one stage in an otherwise fully-notified create→approve→dispatch→receive lifecycle with no notification. Priority: Medium. Do not implement.

ID: NOTIF-16 — Stock adjustment (the function's own code comment calls it "the least-guarded direct stock-level write in the department") generates zero notification despite the elevated risk already acknowledged in the surrounding code. Priority: Medium. Do not implement.

ID: NOTIF-17 — The Automation Engine's auto-drafted Material Request (from the stock_low rule) bypasses materialRequestsCreate's own notification entirely via a raw-SQL insert, so 'storekeeper'/'supervisor' — who can act on it — aren't in the rule's default notify_roles and won't see it flagged the way a human-submitted request would be. This is the exact behavior observed firing live and unexpectedly during earlier QA testing this session. Priority: Medium. Do not implement.

ID: NOTIF-18 — Systemic: the notifications table has no workshop_id column at all; every role-broadcast notification for a workshop-specific event (Stock Transfer requested, Material Request submitted, Harvest Waste, Maintenance job request_parts, etc.) reaches every holder of that role company-wide, not just the relevant workshop. Priority: Medium (signal-dilution/noise risk at multi-workshop scale, not a data-corruption risk). Do not implement.

ID: NOTIF-19 — dailyCreate (Sawmill's core production-entry function, including cases that post directly to Finished Timber Inventory) generates zero notification — the single most central Sawmill event in the whole codebase is silent. Priority: Medium. Do not implement.

ID: NOTIF-20 — The full pre-QC offcut pipeline (create/recoverable-decision/resaw-recovery) is silent at all three stages. Priority: Low-Medium (may be intentional, to avoid notification spam on intermediate steps — flagged for business confirmation, not asserted as a defect). Do not implement.

ID: NOTIF-22 — Rework (rejectionResolveRework) is the only one of the four rejection-hold resolution paths (Downgrade, Return-to-Inventory, Scrap/Disposal all notify; Rework doesn't) with no notification, despite being structurally identical to its three siblings. Priority: Medium. Do not implement.

ID: NOTIF-25 — Maintenance job 'cancel' (a terminal, mandatory-reason transition) doesn't notify the job's creator, unlike the sibling 'close' transition which does. Priority: Low-Medium. Do not implement.
```

Confirmed-working, no finding needed: Procurement Requisition submit/approve/reject/return-for-revision (NOTIF's own summary), Material Request full lifecycle, Stock Transfer create/approve/receive/discrepancy, Sawmill/VAT rejection-path Downgrade/Return/Scrap/Disposal/Showroom-Damage (all four correctly role-scoped, no duplication found across 53 traced call sites), Maintenance Job create/assign/request-parts/send-external/close, Low-stock alert itself (the LOW STOCK notification fires correctly; only its downstream auto-draft artifact has the NOTIF-17 gap), Quality Inspection rejection-path notifications (Sawmill and VAT, symmetric and correctly targeted; approved-only path is silently confirmed as an intentional low-noise design, not a defect), Fuel logging (silence here appears intentional, anomaly detection is handled by a separate threshold rule).

### 10.6 Audit Trail Findings

```
ID: AUDIT-01
Module: Cross-cutting (Sales, Sawmill, Harvesting, Users/Roles admin — legacy-era functions)
Layer: Backend
Finding: ~31% of logAudit() call sites (~63 of 204) use only the 4-argument form, omitting module/actionType/recordId — unqueryable by module/action-type/record-id in the audit UI.
Evidence: data.js:1229,941,5455,2028 (legacy 4-arg) vs. :3482-3483 (structured form, the pattern newer modules consistently use).
Business Impact: Filtering the audit trail by Module or Action Type silently misses these ~63 call sites, understating audit coverage for exactly the departments named above.
Priority: Medium
Recommendation: Backfill opts on the legacy call sites. Do not implement.
```

```
ID: AUDIT-02
Module: Stock Transfers, Material Requests, Procurement approval stages, Dispatch, Deliveries
Layer: Backend
Finding: Most UPDATE/status-change logAudit calls populate opts.after but omit opts.before, even though the prior row is frequently already fetched in the same function.
Evidence: data.js:3516,3529,3600,3994,17967-17969,18026-18028 (after-only or neither) vs. processApprovalDecision (:9652-9661), salesUpdatePaymentStatus/Status (:1266,:1288) which do capture real before/after diffs.
Business Impact: For these modules, an auditor can see the new state but not the state transitioned from, from the audit_log row alone.
Priority: Low
Recommendation: Thread the already-fetched prior row through as opts.before. Do not implement.
```

```
ID: AUDIT-03
Module: Authentication (informational, not a defect)
Layer: Backend
Finding: Two additional narrow writers exist outside logAudit() (mobile-api/routes/auth.js:18-42, db/services/auth.js:41-65), both INSERT-only, both deliberately mirroring each other so desktop/mobile login events are indistinguishable. Confirmed architecturally reasonable (a failed login has no valid user.role for logAudit's NOT NULL role column) — not a tamper risk, flagged only so a future reviewer searching solely for logAudit( doesn't undercount total write paths.
Priority: Low
Recommendation: None required — document as intentional. Do not implement.
```

```
ID: AUDIT-04
Module: Cross-cutting (opts.ipAddress)
Layer: Backend
Finding: The ipAddress field exists end-to-end in logAudit's contract and the audit-replay retry path, but no business-action call site among ~204 logAudit invocations was found to ever pass it — it is populated only by the two login-specific writers (AUDIT-03).
Business Impact: None currently; flagged so a future reviewer doesn't assume business-action audit rows carry IP/device attribution — they do not.
Priority: Low
Recommendation: None — informational; document actual scope (login/logout only). Do not implement.
```

**Tamper Protection Conclusion (exact required format):**
```
Database-level immutability: Implemented
Application-level protection: PASS
```
Two genuine Postgres RULEs (`audit_log_no_update`, `audit_log_no_delete`, `db/migrate.js:958-965`, exact SQL: `create or replace rule audit_log_no_update as on update to audit_log do instead nothing` / same for delete) rewrite any UPDATE/DELETE against `audit_log` to a no-op at the database engine level — not bypassable by application code, only by a superuser dropping the rule directly. Confirmed zero UPDATE/DELETE-against-audit_log statements exist anywhere in the codebase. The only two IPC/API surfaces touching `audit_log` beyond the three INSERT-only writers are both pure, permission-gated, parameterized SELECTs (`auditList`, `electron/main.js:348`, `mobile-api/routes/admin.js:27-41`).

## 11. Uncertain Findings

Per Part 13, these are reported as genuinely uncertain, not converted into defects:

- **WI-4** (§5) — whether the generic edit/delete Approval Engine's lack of workshop-scoping is intentional company-wide governance policy or an unaddressed gap. Requires a business-policy answer, not further code investigation.
- **Desktop-layer verification for PERM-4 through PERM-21** — the permission-matrix research pass explicitly marked these "not independently checked" for desktop visibility (it verified backend/API/mobile with high confidence but ran out of scope for a full desktop cross-check on every individual finding). Not asserted either way.
- **NOTIF-20** — whether the silent pre-QC offcut pipeline is an intentional low-noise design choice or a gap; flagged for business confirmation rather than asserted as a defect.
- **Procurement Requisition approval** (§4 matrix, marked `n/c` throughout) — a dynamic, step-based workflow keyed on live `procurement_approval_steps` config data, not resolvable from static source alone.

## 12. Risk Assessment

| Risk | Domain | Severity | Currently exploited? |
|---|---|---|---|
| Cross-workshop poles data exposure | Workshop Isolation | High | No (not via normal UI); live-confirmed reachable via direct IPC |
| Material Request approval elevation-of-privilege | Permissions | High | Structurally yes, for any storekeeper-assistant/logistics-officer who chooses to use it |
| Unauthenticated-by-role reads (procurement config, resolution history) | Permissions | High | Structurally yes, for any authenticated user |
| Two roles non-functional (poles-supervisor, vat-supervisor) | Permissions | High | Yes, if any such account is actually in use |
| Financially sensitive payment notifications broadcast company-wide | Notifications | Medium-High | Yes, every time a payment is approved/rejected |
| Harvesting near-total notification silence | Notifications | Medium | Yes, ongoing |
| Audit trail tamper protection | Audit | None | N/A — confirmed PASS |

## 13. Priority Matrix

**High**: PERM-1, PERM-3, PERM-17, PERM-18, PERM-7, PERM-8, WI-3a, NOTIF-03, NOTIF-04.
**Medium**: PERM-2, PERM-4, PERM-5, PERM-6, PERM-9, PERM-11/12/13, PERM-20, WI-3b, NOTIF-01, NOTIF-06 through NOTIF-19 (excluding those already High), NOTIF-22, AUDIT-01.
**Low**: PERM-10, PERM-14/15, PERM-16, PERM-19, PERM-21, NOTIF-02, NOTIF-05, NOTIF-20 (uncertain), NOTIF-25, AUDIT-02, AUDIT-03, AUDIT-04.

## 14. Recommended Remediation Order

Presented for review only — nothing here should be implemented without separate approval.

1. **PERM-1** — two non-functional roles; a single migration-config fix (add both roles to `updateRolePermissions()`'s `permissionsByRole`), highest impact-to-effort ratio in this entire report.
2. **PERM-3, PERM-17, PERM-18** — the three genuine elevation-of-privilege/unauthorized-read findings; each is a small, targeted permission-check fix.
3. **WI-3a/WI-3b** — align the three Poles Procurement functions with the codebase's own established pattern.
4. **PERM-7/PERM-8** — the maintenance-job creation/assignment dead-end, since it affects the role (mechanician) the whole feature was built for.
5. **NOTIF-03/NOTIF-04** — the two Procurement recipient-correctness bugs.
6. Batch the remaining Tier 2 permission drift findings (PERM-4,5,6,9,11-16,20,21) into one consolidated route-array sweep, since they're individually small but numerous and share the same root-cause pattern.
7. Batch the remaining notification gaps (Harvesting silence, Sawmill production silence, Rework, Dispatch-decision, Delivery, Stock Transfer dispatch, Stock adjustment) into one department-by-department pass once business priorities are confirmed for which are genuinely wanted vs. intentionally low-noise.
8. AUDIT-01/AUDIT-02 — backfill structured fields on legacy audit calls, lowest urgency (Application-level tamper protection already PASSes regardless).
9. NOTIF-18 (workshop-scoping for notifications) — larger structural change (new column + filter logic), recommend scoping as its own small phase rather than folding into the sweep above, since it touches the shared notification read-path used everywhere.

## 15. Production Readiness Assessment

The three previously-open verification gaps from the prior audit are now closed with evidence: permission matrix complete (24 roles, not 13), notification coverage traced, audit-log tamper protection confirmed PASS. **No finding in this report reaches Critical.** The High-priority findings are real and should not be left indefinitely, but none of them corrupt data, silently lose inventory, or block an entire department from operating — each has a narrow, specific blast radius (one workflow, one role pair, one data-exposure path) with a small, well-understood fix.

**Recommendation: the ERP can proceed toward final Production Readiness / UAT**, on the condition that the High-priority findings in §13 (PERM-1, PERM-3, PERM-17, PERM-18, PERM-7, PERM-8, WI-3a, NOTIF-03, NOTIF-04) are remediated first, given a follow-up implementation phase is explicitly approved. The Medium/Low findings can reasonably be scheduled after go-live as a maintenance/hardening pass.

## 16. Live Verification Results

| Test | Expected | Actual | Result | Evidence | Cleanup |
|---|---|---|---|---|---|
| Restricted-role users with null workshop_id (precondition check for WI-3b) | None among poles-leader/supervisor accounts (the roles that call the affected functions) | Confirmed: 0 such accounts among poles-leader/supervisor; 4 unrelated roles (sales, finance, logistics-officer, procurement-manager) have null workshop_id but none of them can call the affected functions | PASS (not currently exploitable) | Read-only query, no data created | N/A |
| polesPurchaseList — normal UI path (no workshopId arg) as poles-leader (workshop 4) | Does not see a Gatare (workshop 3) fixture | Correctly did not see it | PASS | `data.polesPurchaseList(plUser.id)` → `requests: []` | N/A (read-only) |
| polesPurchaseList — crafted call (workshopId=3 explicit) as poles-leader (workshop 4) | Should NOT see Gatare's data (if isolation holds) | **Did see it** — vulnerability live-confirmed | **FAIL** | `data.polesPurchaseList(plUser.id, 3)` → returned the workshop-3 fixture | Fixture (poles_purchase_request #1, supplier_name='QA-WORKSHOP-ISOLATION-TEST') deleted; independently re-queried, confirmed 0 rows remaining |
| Static verification | Codebase compiles/type-checks cleanly at baseline (no code changed this phase) | `node --check` clean across db/migrate.js, db/services/data.js, renderer/app.js, electron/main.js, electron/preload.js, mobile-api/server.js; `npx tsc --noEmit` clean in mobile/ | PASS | Command output, see §17 | N/A |

## 17. Static Verification Results

```
node --check db/services/data.js   → OK
node --check db/migrate.js         → OK
node --check renderer/app.js       → OK
node --check electron/main.js      → OK
node --check electron/preload.js   → OK
node --check mobile-api/server.js  → OK
cd mobile && npx tsc --noEmit      → clean, zero errors
```
No source file was modified during this audit phase, so this confirms the current baseline compiles cleanly — not a regression check against changes (there were none).

## 18. Outstanding Items

- Desktop-layer visibility was not independently re-verified for PERM-4 through PERM-21 (see §11).
- WI-4 requires a business-policy decision, not further code work.
- The dynamic, step-based Procurement Requisition approval workflow was not resolved into the static role matrix (§4) — would need a live-data pass against `procurement_approval_steps`.
- NOTIF-20's silence may be intentional; recommend a one-line business confirmation before treating it as a gap.

## 19. Uncertain Findings

(Consolidated from §11 for the deliverable's required section — see §11 for full detail; not duplicated here to avoid redundancy.)

## 20-24. See §§12-18 above for Risk Assessment, Priority Matrix, Recommended Remediation Order, Production Readiness Assessment, and Outstanding Items respectively — numbered per the brief's TOC but consolidated in presentation order for readability.
