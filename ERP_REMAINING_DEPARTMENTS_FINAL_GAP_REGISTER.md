# ERP Remaining Departments — Final Gap Register

Format per entry: ID · Department · Capability · Severity · Backend status · Desktop status · Mobile status · Permission status · Workshop Isolation status · Business impact · Recommended action · Requires business approval?

---

## Fixed this phase (included for traceability)

**G-01 · Administration · Trash Restore/Purge**
Severity: **High** (core admin recovery workflow completely non-functional on both platforms)
Backend: was returning wrong field names (`id`/`entity_label` instead of the `record_id`/`label` both UIs expected) — **fixed**
Desktop: broken (undefined record id sent on every click) — **fixed, live-verified**
Mobile: same bug — **fixed, live-verified**
Permission: n/a
Workshop Isolation: n/a (admin/ceo/operations-only, company-wide)
Business impact: soft-deleted records across every module (compartments, harvest logs, sales orders, vehicles, etc.) could never actually be restored or permanently purged through the UI.
Recommended action: none — resolved.
Requires approval: No (bug fix, no data/policy change).

**G-02 · Administration · Mobile user role picker**
Severity: Medium
Backend: unaffected (role list was always correct)
Desktop: correct role dropdown, unaffected
Mobile: was missing `procurement-officer`/`procurement-manager`/`department-manager` — **fixed**
Permission: n/a
Workshop Isolation: n/a
Business impact: an admin using only the mobile app could not create or reassign a user into any Procurement management role.
Recommended action: none — resolved.
Requires approval: No.

**G-03 · Sales/Logistics · `deliveryOrdersDelete` reason forwarding**
Severity: Medium (audit/governance quality, not a functional blocker)
Backend: function always supported `reason`, unaffected
Desktop: `reason` silently dropped at 3 layers (preload/IPC/caller) — **fixed, live-verified**
Mobile: already correctly wired, unaffected
Permission: n/a
Workshop Isolation: unaffected (existing check preserved)
Business impact: every desktop-initiated delivery-order deletion recorded a blank reason in governance/audit records.
Recommended action: none — resolved.
Requires approval: No.

**G-04 · Inventory · `stockItemsDelete` reason forwarding**
Severity: Medium — same class and fix as G-03.
Backend/Desktop/Mobile/Permission/Workshop Isolation: identical shape to G-03 — **fixed, live-verified**.
Business impact: same as G-03, for stock item deletions.
Recommended action: none — resolved.
Requires approval: No.

**G-05 · Cross-department (Admin/Inventory/Sales) · Live permission drift**
Severity: **High** (real, live access gap affecting daily operations)
Backend: `role_definitions` (the authorization source) was missing `stock-movements` for `supervisor`/`harvesting-leader` and `customers` for `sales`, despite the code's own documented fallback (`ROLE_PAGES`) claiming these as baseline — **fixed**
Desktop/Mobile: both correctly respect whatever the DB says, so both were silently broken for these roles until the DB was corrected — **fixed, live-verified**
Permission: this *was* the permission gap
Workshop Isolation: unaffected
Business impact: supervisors/harvesting-leaders could not open Stock Movements at all; sales staff could not open Customers at all.
Recommended action: none — resolved (user-approved before applying).
Requires approval: **Yes — obtained** before this live authorization change was applied.

**G-06 · Administration/Operations (mobile) · Dead "Pending" tab**
Severity: Medium
Backend: n/a (screen never called any backend function — it was a literal placeholder)
Desktop: n/a (mobile-only tab)
Mobile: was a live `ComingSoonScreen` — **fixed**, now shows the existing `GovernanceScreen`
Permission: unaffected (reuses `GovernanceScreen`'s own existing role gate)
Workshop Isolation: n/a (governance approvals are company-wide by design)
Business impact: the `operations` role's second-ever mobile tab led nowhere useful.
Recommended action: none — resolved.
Requires approval: No.

---

## Disclosed, not fixed this phase

**G-07 · Administration (cross-department) · Immutable stray test accounts**
Severity: Low (no security exposure — all inactive; data-hygiene only)
Backend: `audit_log_no_delete` FK correctly prevents removal of any user with a logged action
Desktop/Mobile: n/a
Permission: n/a
Workshop Isolation: n/a
Business impact: 57 stray, already-inactive test accounts will remain in `app_users` permanently by design; cosmetic clutter in user lists filtered to "all", none in "active" views.
Recommended action: none — this is the audit-integrity architecture functioning correctly, not a defect to remediate.
Requires approval: No (informational only).

**G-08 · Inventory · 7 ambiguous blank-reference `stock_movements` rows**
Severity: Low
Backend/Desktop/Mobile/Permission/Workshop Isolation: n/a — pure data-hygiene question
Business impact: none currently identified; could be legitimate pre-audit-trail entries or could be old test residue.
Recommended action: a dedicated future investigation (trace each row's item/warehouse/date against known QA test windows) before any deletion decision.
Requires approval: Yes, if deletion is ever proposed.

**G-09 · Cross-department · `mustRole(...) || [hardcoded roles]` structural risk**
Severity: Low (no live instance found in an 8-site sample)
Backend: pattern is currently safe everywhere sampled
Business impact: none today; if a role's DB permissions are ever narrowed without also updating the matching hardcoded fallback array in the same function, that function would silently keep granting access.
Recommended action: consider a periodic automated check (diff DB `role_definitions` against `ROLE_PAGES` on migration) to catch this class of drift going forward — this phase's G-05 finding shows it does happen.
Requires approval: Only if/when such a check is proposed as new tooling.

**G-10 · Inventory · `stockItemsDelete` confirmation copy inaccuracy**
Severity: Low (cosmetic)
Business impact: the reused `confirmDeleteSoft` dialog tells the user the record "will be moved to Trash and can be restored" — but `stockItemsDelete` is a genuine hard delete (`stock_catalog` is not in `TRASH_TABLES`); the message is inaccurate for this one call site.
Recommended action: either add stock items to `TRASH_TABLES` (turning it into a real soft delete, larger change) or build a third confirm-dialog variant with accurate copy (smaller change). Not done this phase to avoid inventing new UI for a copy-only issue.
Requires approval: No, but should be scoped before either option is picked.

**G-11 · Sales/Logistics · `deliveryOrdersDelete` soft-deletes but has no Trash restore path**
Severity: Medium
Backend: sets `deleted_at` (a real soft delete) but `delivery_orders` was never added to `TRASH_TABLES`
Desktop/Mobile: neither surfaces a way to restore a deleted delivery order
Business impact: a deleted delivery order is unrecoverable through any UI despite the backend not actually destroying the row.
Recommended action: add `delivery_orders` to `TRASH_TABLES` (small, well-precedented change, same shape as every other entry there) — recommended as a quick, low-risk follow-up, found incidentally while fixing G-03, not previously disclosed anywhere.
Requires approval: No (purely additive fix), but wasn't in this phase's approved scope, hence deferred rather than done opportunistically.

**G-12 · Procurement, Logistics, Fleet & Equipment, Mechanician, Harvesting, Sawmill, VAT, Poles Production, and the global Notifications/Approvals/Reporting mechanical sweep · RESOLVED — all 3 audits completed in the resumption session**
Severity: N/A (was a process gap, now closed)
Business impact: none — see G-22 through G-30 below for the concrete findings that resulted, and §3-§7 of the updated Completion Report for the full writeup.
Recommended action: none — resolved.
Requires approval: No.

**G-13 · Sales · 2 unrelated stray notifications (carried forward from Sales Enterprise Phase 2)**
Severity: Low (cosmetic residue)
Business impact: 2 notifications (ids ~731/732, dated 2026-08-10, titled "Sales order closed short — QA-SIP2-F/G") remain in the live `notifications` table — pre-existing residue from an unrelated, earlier Stock Inventory Phase 2 test run, re-confirmed still present and unchanged this phase.
Recommended action: batch with any future QA-residue cleanup pass; trivial one-line deletion once approved.
Requires approval: Yes (historical data).

**G-14 · Sawmill · Placeholder cost/price values (carried forward from Sawmill Phase 2)**
Severity: Medium (financial accuracy)
Business impact: 3 products' Standard Cost/Default Price are QA placeholder values, not Finance-approved real figures — every COGS/margin calculation downstream of them (Sales Reporting, etc.) is only as accurate as these placeholders.
Recommended action: Finance/Management sign-off on real values, unchanged recommendation from Sawmill Phase 2.
Requires approval: Yes.

**G-15 · Procurement · `procurementBenchmark` needs a business decision (carried forward)**
Severity: Low — confirmed dead on both platforms in an earlier phase (Remediation Phase 2); no new evidence this phase.
Recommended action: unchanged — needs a scoping decision on whether this capability is still wanted at all before any UI work.
Requires approval: Yes.

**G-16 · Fleet & Equipment · Leftover `_QA-RL-TEST` vehicle record (carried forward)**
Severity: Low
Business impact: one leftover test vehicle record from Fleet's own completion phase, never removed pending user confirmation.
Recommended action: confirm and delete, or confirm it should be kept.
Requires approval: Yes.

**G-17 · Mechanician · No mobile DELETE route for machine fuel logs (carried forward from Stabilization Phase 5)**
Severity: Low-Medium
Business impact: a mechanician cannot delete a fuel log entry from mobile (desktop-only).
Recommended action: add the missing REST route + mobile UI action, small well-precedented fix.
Requires approval: No (straightforward parity fix), just not yet scheduled.

**G-18 · HR · `casualLabourRequestsReview` route/backend role mismatch (carried forward from HR Phase 1)**
Severity: Low — currently unreachable via any UI.
Recommended action: decide whether to broaden the backend to match the REST route's `admin` allowance, or narrow the route to match the backend. No urgency.
Requires approval: Yes (permission-scope decision either direction).

**G-19 · HR · No separate "HR employee" entity / richer `app_users` fields (carried forward from HR Phase 1)**
Severity: N/A — business-scope decision, not a defect.
Recommended action: decide whether `app_users` should gain phone/national-ID/employment-date fields, or a genuinely separate HR employee entity should be built.
Requires approval: Yes.

**G-20 · HR · Attendance ↔ Casual Labour Request hours linkage (carried forward from HR Phase 2)**
Severity: N/A — business-rule decision, not a defect. No financial/hours-worked concept exists anywhere for casual labour today; building this link means inventing new business logic.
Recommended action: defer until a specific business need is articulated.
Requires approval: Yes.

---

## Fixed in the resumption session (3 interrupted audits completed)

**G-21 · Procurement · `procurementGoodsReceiptCreate` missing Workshop Isolation**
Severity: **High**
Backend: was missing the check every sibling function had — **fixed**
Desktop/Mobile: both call the same backend function, both now correctly protected
Permission: n/a
Workshop Isolation: this *was* the gap
Business impact: a workshop-restricted storekeeper could receive goods against, and credit stock into, a PO belonging to a different workshop.
Recommended action: none — resolved, live-verified (zero side effects confirmed).
Requires approval: No (bug fix).

**G-22 · Poles Production · Desktop `poles-supervisor` permission/UI mismatch**
Severity: Medium-High
Backend: already authorized `poles-supervisor` for delivery/batch-creation
Desktop: was hidden from this role — **fixed** (new `canManageProduction` gate)
Mobile: already correct (`PolesSupervisorNavigator` already gave this role its own screens)
Business impact: `poles-supervisor` could not record deliveries or create production batches from desktop despite the backend allowing it.
Recommended action: none — resolved.
Requires approval: No.

**G-23 · Poles Production (desktop) · Unguarded `newPoleBatch` click handler**
Severity: Medium (crash-class, found incidentally)
Business impact: any role able to view the Daily Poles page without being in the button's render gate would crash on page load.
Recommended action: none — resolved (added the same null-guard its sibling buttons already had).
Requires approval: No.

**G-24 · Cross-department (mobile) · 4 broken dashboard navigation routes**
Severity: Medium
Business impact: tapping the "pending changes", "sales confirmation", "material fulfillment", or "stock transfer" alert tile on the mobile Dashboard silently failed to navigate — none of the 4 route name strings matched any registered screen.
Recommended action: none — resolved (corrected to `Changes`/`SalesOrdersList`/`MaterialRequestsList`/`StockTransfersList`).
Requires approval: No.

**G-25 · Cross-department (desktop) · Notification routing gap — `'governance'`**
Severity: Medium-High (high frequency — fires on every restricted-user edit/delete approval request)
Business impact: every such notification on desktop always showed "No linked page available", while the identical notification correctly routed on mobile.
Recommended action: none — resolved (page-only route added to the existing Security & Governance page).
Requires approval: No.

**G-26 · Sales/Logistics (desktop) · Notification routing gap — `'sales'`/`'deliveries'`**
Severity: Low (consistency)
Business impact: minor — a prior phase had already documented these as intended page-only routes but never added them.
Recommended action: none — resolved.
Requires approval: No.

---

## New findings, disclosed not fixed (resumption session)

**G-27 · Administration · Automation Rule management has zero UI on either platform**
Severity: Medium-High (genuine capability gap, but sizeable)
Backend: full CRUD (`createAutomationRule`/`deleteAutomationRule`/`toggleAutomationRule`/`updateAutomationRule`/`getAutomationLog`) exists with role checks
Desktop/Mobile: only the read-only dashboard is wired anywhere; rule management and the automation log are unreachable
Business impact: admins have no interface anywhere to view, edit, enable/disable, or audit automation rules.
Recommended action: scope as its own dedicated future phase — building a full rule-management UI is out of proportion for an audit-and-fix pass.
Requires approval: No (purely a build-it-or-don't scoping decision), but sizeable enough to warrant its own planning.

**G-28 · Fleet & Equipment · Vehicle compliance documents are desktop-only**
Severity: Medium
Backend: 5 document-upload columns fully supported
Desktop: fully exposed (upload, view)
Mobile: zero references anywhere in `VehicleFormScreen.tsx`/`VehicleDetailScreen.tsx`
Business impact: a mechanician or logistics user in the field cannot view or upload a vehicle's registration/insurance/photos/owner-ID/contract documents from mobile.
Recommended action: scope a mobile file-upload/view UI for these 5 fields as a follow-up.
Requires approval: No, but non-trivial (new mobile file-handling UI).

**G-29 · Mechanician · Machine Maintenance Schedule mobile edit/delete — corrected framing**
Severity: Medium
Business impact: `admin`/`ceo`/`logistics` (the only roles the backend authorizes to edit/delete a schedule) have **no mobile navigation path to Maintenance Schedules at all** — not because the wiring is unfinished, but because no navigator currently mounts that screen for those 3 roles (only `mechanician` reaches it, correctly read-only by design since that role lacks edit/delete rights).
Recommended action: decide which navigator(s) should give `admin`/`ceo`/`logistics` a path to this screen, then wire the two hooks already added (`useMaintScheduleUpdate`/`useMaintScheduleDelete` in `useMachines.ts`) into it.
Requires approval: No, but needs a placement decision first.

**G-30 · Reporting (Sawmill/VAT/Poles/Harvest) · 8 reports lack CSV export on desktop**
Severity: Low-Medium (consistency)
Business impact: `qualityReport`, `productionReconciliation`, `valueAddedProductionReconciliation`/`Report`, `poleProductionReconciliation`, `polesSourceReport`, `harvestWasteList`, `rejectionHoldsList`, `resolutionsList` have no CSV export button, unlike sibling reports in the same departments (and unlike the app-wide established `downloadCsv()` pattern).
Recommended action: batch as a small, well-precedented follow-up (same helper function, 8 new button wire-ups).
Requires approval: No.

**G-31 · Notifications (cross-cutting) · Escalation/automation event routing gaps**
Severity: Low-Medium
Business impact: `ENTITY_ESCALATION_MODULE` only maps 4 of 10 escalation entity types (delivery/workflow/security/approval-edit/approval-delete/supplier-improvement-plan escalations are unroutable on both platforms); the automation scheduler's capitalized module literals (`'Security'`, `'Governance'`, `'System'`, `'Stock'`, `'Machines'`, `'Logistics'`, `'Fuel'`, `'Harvest'`, `'Approvals'`) match nothing in either routing table.
Recommended action: map each to a real screen where one exists, or explicitly mark page-only/none per the established documentation convention — needs per-case judgment, not a mechanical fix.
Requires approval: No, but needs investigation time.

**G-32 · Administration · Desktop cannot reach 4 functions with no `secureHandle` at all**
Severity: Low-Medium
Business impact: `attachmentGet`/`attachmentRegister`/`attachmentsDelete` (generic attachment viewer/delete) and `workshopsListWithMetrics` have zero desktop path under any name (mobile already has all 4) — desktop has no generic attachment viewer and no workshop-KPI-metrics view.
Recommended action: scope whether desktop needs these, or whether existing desktop-specific equivalents already cover the same need.
Requires approval: No, needs investigation first.

**G-33 · Various · Several backend functions confirmed to have zero UI caller on ≥1 platform**
Severity: Low each (individually), sampled not exhaustive
Business impact: `transportCompaniesList` (manage-list screen, desktop only has the dropdown version), `procurementQuotationsCompare` (mobile-only side-by-side view), `procurementSupplierPerformance` (possibly superseded by a newer function, unconfirmed) — each needs its own small investigation.
Recommended action: case-by-case follow-up; none appear urgent.
Requires approval: No.

---

## Summary counts (combined, both sessions)

- Fixed and live/static-verified: **12** (G-01–G-06 first session; G-21–G-26 resumption session)
- Disclosed, no code change (informational / by-design): **2** (G-07, G-09 partial)
- Disclosed, deferred pending a small scoped fix (low risk, no approval needed): **7** (G-10 partial, G-11, G-17, G-28, G-29, G-30, G-33)
- Disclosed, needs investigation before a fix/no-fix decision: **2** (G-31, G-32)
- Disclosed, sizeable enough to need its own future phase: **1** (G-27 — Automation Rule management UI)
- Disclosed, requires business/data approval before any action: **8** (G-08, G-13, G-14, G-15, G-16, G-18, G-19, G-20)
- Coverage gaps: **0** (G-12 resolved — all 3 previously-interrupted audits completed this session)
