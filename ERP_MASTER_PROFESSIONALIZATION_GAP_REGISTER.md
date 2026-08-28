# ERP Master Enterprise Professionalization — Phase 1 — Gap Register

This audit uses a **different lens** than the immediately-prior Final Enterprise Completion Gate
(which covered correctness, security, Workshop Isolation, and CRUD/navigation defects, and
found 7 real bugs, all fixed). This phase asks a different question: does every backend
capability have an **intentional, verified, professionally usable** UI outcome — search,
filter, sort, export, dashboard actionability, and drill-down — not just "does it work."

**Method**: 3 parallel read-only audits — (1) search/filter/sort/export coverage across 30
major operational lists, both platforms; (2) dashboard completeness (does each dashboard answer
"what's happening / what needs attention / what's abnormal") plus drill-down chain testing;
(3) a full-population backend→UI parity cross-reference of all 407 exported `data.js`
functions (not a sample — every export was classified, ~35 ambiguous cases individually
traced to ground truth).

**Result: zero P0, zero P1 findings.** Every finding is P2 (major operational — works, but
users can't efficiently operate it) or P3 (professionalization polish). This is the expected
outcome given the app was just exhaustively hardened for correctness/security immediately prior
— this pass measures usability completeness, not defects.

Format: ID / Severity / Type / Area / Finding / Evidence / Disposition.

---

## P2 — Major Operational

### PR-01 — Sales Orders: zero search/filter/sort/export, hard-capped at 50 rows server-side
- **Type**: UX GAP.
- **Area**: Sales.
- **Finding**: `renderSales` (`renderer/app.js:4737`) is the primary day-to-day order screen
  for the whole company — zero search box, zero filter, zero sort, zero export. The backend
  query itself (`db/services/data.js:1199-1230`) hard-caps at 50 rows with **no server-side
  search/filter parameter at all** — not just a missing UI control, the backend doesn't accept
  one. Every comparable module (Procurement, Logistics, Fleet, Payroll) already uses the shared
  `procFilterBarHtml`/`wireSortableTable` toolkit; Sales Orders never was brought into that
  pattern.
- **Evidence**: `renderer/app.js:4737`; `db/services/data.js:1199-1230` (`limit 50`, no filter
  params).
- **Disposition**: **RESOLVED — Phase C1** (`ERP_PROFESSIONALIZATION_PHASE_C1_SALES_ORDERS_*`).
  `salesList` extended with server-side search/status/payment/date/sort/pagination params;
  desktop rebuilt onto `procFilterBarHtml`/`wireSortableTable`/pagination; new `salesGet` detail
  view + Excel export added on both platforms. 47/47 live checks passed.

### PR-02 — Customers: no search/filter/sort/export, unbounded backend query
- **Type**: UX GAP.
- **Area**: Sales / Customers.
- **Finding**: `renderCustomers` (`app.js:5707-5792`) is a flat, unfiltered table; the backend
  (`data.js:9012-9026`) returns the full customer list with no `limit` at all — it will
  degrade as the register grows, and also feeds the Sales Order customer picker.
- **Disposition**: Not fixed this pass (P2).

### PR-03 through PR-16 — Export missing on 14 more operational lists
All of the following have working search+filter+sort but **no Excel/CSV export of the actual
row data** (several have an export button that only exports an aggregated summary — see
PR-24 for that distinct sub-pattern):
- **PR-03** Purchase Orders (`app.js:24525`, capped 200 rows, `data.js:23713`). **RESOLVED —
  Phase C8.**
- **PR-04** Requisitions (`app.js:23022`, capped 200, `data.js:23152`). **RESOLVED — Phase C8.**
- **PR-05** Suppliers (`app.js:23825`) — best-filtered list in the app, still no export.
  **RESOLVED — Phase C8.**
- **PR-06** Invoices (`app.js:24766`, capped 200, `data.js:24266`). **RESOLVED — Phase C8.**
  Phase C8 also built export for RFQs and Goods Receipts (found to have the identical gap during
  its own audit, not previously registered here) — see
  `ERP_PROFESSIONALIZATION_PHASE_C8_PROCUREMENT_*` for the full 6-list dispatcher, permission
  delegation, and live reopened-workbook verification.
- **PR-07** Stock Transfers (`app.js:11897`, capped 100, `data.js:4384`)
- **PR-08** Dispatch (`app.js:14114`, capped 100, `data.js:6444`)
- **PR-09** Delivery Orders (`app.js:13711`, capped 200)
- **PR-10** Transport Jobs (`app.js:14604`, self-labeled "last 100" in its own KPI tile,
  capped 100)
- **PR-11** Stock Movements (`app.js:11510`, self-labeled "last 100", the full audit trail
  of stock in/out/adjust/loss with real cost implications for Finance)
- **PR-12** Machine Fuel Logs (`app.js:18474`, capped 200)
- **PR-13** Maintenance Jobs (`app.js:17690`, capped **300** — the largest cap found in the
  app, confirming high real volume)
- **PR-14** Casual Workers (`app.js:19192`, unbounded backend query)
- **PR-15** Finance Operations Center (`app.js:20544`) — shows "up to 500" results, has
  server-side `sort_by`/`sort_dir` state but no UI control exposing it, and no export at all,
  despite its own subtitle describing it as a reconciliation/export tool. **RESOLVED — Phase C4**
  (`ERP_PROFESSIONALIZATION_PHASE_C4_*`). Sortable Date/Party/Amount/Status headers added
  (pure frontend wiring — the backend's `sort_by`/`sort_dir` handling was already fully
  correct); new `financeOperationsExportExcel` function + Excel export button added (thin
  wrapper, inherits `financeOperationsSearch`'s exact permission gate and Workshop Isolation by
  delegation). Confirmed desktop-only is correct/intentional (pre-existing documented decision
  in `mobile/src/hooks/useFinance.ts`), not a mobile gap. 21/21 live checks passed, including a
  disposable-QA-account proof that Workshop Isolation cannot be bypassed even via an explicit
  `workshop_id` override attempt. That same research pass also surfaced a new, more significant,
  **undisclosed-until-now** finding — see NF-01 below — which was investigated, confirmed real,
  and explicitly documented as out of safe single-phase scope rather than attempted.
- **PR-16** Audit Log (`app.js:9272`, capped 500, no sort, no export) — the compliance/forensic
  record of the whole system; "get everything for period X" is a standard audit ask this
  screen cannot currently do. **RESOLVED — Phase C6.** Sort/pagination/export were only safely
  buildable once Workshop Isolation was proven (Phase C6's actual purpose, NF-01) — export
  reuses the exact isolated query so it can never see more than the equivalent list; the old
  hard `limit 500` was replaced with real server-side pagination. See
  `ERP_PROFESSIONALIZATION_PHASE_C6_*` for full detail.
- **Disposition**: PR-03–14 (13 of the original 14) not fixed this pass (P2). Recommended as a
  batch Phase C item — all 13 can reuse the exact CSV/Excel infrastructure already proven on
  Stock Catalog, Vehicles, Payroll, and now Audit Log (`_payrollBuildExcelBuffer`, the
  base64-decode-and-download desktop pattern, and plain client-side CSV builders where Excel
  isn't already used).

### PR-17, PR-18 — Nyanza/VAT and Poles production batch lists have NO search/filter/sort/export at all
- **Type**: UX GAP.
- **Area**: Production.
- **Finding**: Unlike every other production list, these two have zero navigation aids of any
  kind — plain unfiltered tables, both capped at 200 rows.
- **Evidence**: VAT (`app.js:16976`, table `17013-17038`, cap `data.js:10853`); Poles
  (`loadPoleBatches` within `renderDailyPoles`, ~`app.js:3330-3398`, cap `data.js:4025`).
- **Disposition**: Not fixed this pass (P2 each).

### PR-19 — CEO Overview computes 2 real "needs attention" fields, never renders either
- **Type**: UI GAP.
- **Area**: CEO / Executive.
- **Finding**: `getCeoOverview` (`data.js:17586`) computes and returns `pendingPolesRequests`
  (`data.js:17656`) and `pendingMonthlyApproval` (`data.js:17657`) on every load —
  `renderCeoOverview` (`app.js:1689-1751`) reads neither field anywhere (verified via grep,
  zero matches). Two real, already-computed pending-action counts are silently discarded.
- **Disposition**: **RESOLVED — Phase C2** (`ERP_PROFESSIONALIZATION_PHASE_C2_CEO_OVERVIEW_*`).
  Both fields now rendered on desktop via `kpiTileHtml` clickable tiles under a new "Pending
  Approvals" section. That phase also found and fixed 2 related bugs beyond the original scope: a
  real data-correctness issue (3 queries missing `deleted_at is null`, confirmed live to have
  been over-counting cancelled sales orders into the CEO's monthly revenue) and a permission-gate
  inconsistency (hardcoded role array vs. the permission system). 12/12 live checks passed.

### PR-20 — Systemic: dashboard KPI tiles are not clickable across nearly every dashboard
- **Type**: UX GAP (systemic, cross-cutting).
- **Area**: Executive, CEO, Procurement, Inventory, Logistics, Maintenance Officer dashboards.
- **Finding**: KPI tiles and list-widgets on 6 of 9 dashboards audited are rendered as plain,
  non-interactive elements with no click handler anywhere — confirmed by grep for `onclick`/
  `addEventListener` near each tile's markup, returning nothing. A dashboard showing "12
  pending approvals" cannot be clicked to reach them; the user must already know the separate
  page exists and navigate there manually. Finance and Payroll dashboards (built most recently)
  do NOT have this problem — their tiles/rows are already interactive, proving the pattern
  exists and just wasn't retrofitted onto the older dashboards.
- **Evidence**: Executive (`app.js:7045-7059`, class `ex-kpi`, zero click handlers); CEO
  (`app.js:1700-1706`, `kpi()` helper produces plain divs); Procurement (`app.js:24882-24886`,
  `.kpi-card`); Inventory (`app.js:9993-10004`, `kpiTileHtml()` only becomes clickable with an
  `id`/`data` arg, none of the 12 tiles pass either); Logistics (`app.js:10325-10338`, 15
  `.mc` tiles).
- **Disposition**: Not fixed this pass (P2, systemic). Recommended: retrofit the existing
  `kpiTileHtml()` helper's already-supported `id`/click-target capability onto the 6 affected
  dashboards' tiles — the mechanism already exists in the codebase (Finance/Inventory Dashboard's
  own non-KPI widgets prove it), this is a retrofit, not a new pattern. **Inventory Dashboard
  instance RESOLVED — Phase C5** (`ERP_PROFESSIONALIZATION_PHASE_C5_*`). 10 of 12 Executive KPI
  tiles made clickable on desktop (5 filter the on-page Stock Register table, 5 navigate to
  Stock Transfers/Material Requests/Stock Movements) and the 3 with a clean cross-tab target on
  mobile (`StockLevelsScreen.tsx`, gated per-navigator since the screen is reused across 4
  different tab navigators with differing sibling tabs — CEO/Logistics have no Material Requests
  tab). Zero backend change — `inventoryDashboard()` already computed every value shown. 4 of the
  original 6 dashboard instances (Executive, Procurement, Logistics, Maintenance Officer) remain
  open at the time of Phase C5.

  **Executive Dashboard instance RESOLVED — Phase C7**
  (`ERP_PROFESSIONALIZATION_PHASE_C7_EXECUTIVE_DASHBOARD_*`). 8 KPI tiles + 10 Stock Summary/
  Governance stat rows made clickable, routed to 7 distinct pre-existing pages (`sales`,
  `sales-dashboard`, `secgov`, `deliveries`, `dispatch`, `inventory`, `stock-transfers`,
  `material-requests`, `audit` — each verified live to be the actual owning page for that
  figure's underlying records before being wired; "Active Users" left non-interactive, no
  separate destination exists). A new 9-sheet `.xlsx` export
  (`executiveDashboardExportExcel`) was also added — the dashboard's rich multi-section data
  previously had only a client-side CSV formatter — live-verified by reopening the generated
  file and confirming every sheet's row count against the underlying data. A live permission
  audit (against `role_definitions`, the authoritative runtime table) found `operations`
  missing the `deliveries` permission one new drill-down now targets — disclosed, not silently
  granted (write-capable permission; this session's standing rule requires asking first).
  Mobile has no Executive Analytics screen at all despite a ready, correctly-permissioned REST
  route — disclosed as a genuine capability gap, deliberately deferred to its own dedicated
  future phase rather than rushed inside this one. **3 of the original 6 dashboard instances
  (Procurement, Logistics, Maintenance Officer) remained open at the time of Phase C7.**

  **Procurement instance RESOLVED — Phase C8**
  (`ERP_PROFESSIONALIZATION_PHASE_C8_PROCUREMENT_*`). KPI tiles on `renderProcurementDashboard`
  made clickable, but conditionally: a live permission audit found `procurement-dashboard` (view
  access) is held by 11 roles without the underlying list-page permissions (a visibility-only
  tier by design), so each tile is only rendered clickable for a viewer who actually holds the
  destination page's own permission (`STORAGE.pages`) — never unconditionally, which would have
  produced a wall of "Access Denied" clicks for most of the dashboard's actual audience.
  **2 of the original 6 dashboard instances (Logistics, Maintenance Officer) remain open.**

### PR-21 — Sales Orders have zero audit-history UI on any platform, despite the data being captured
- **Type**: UI GAP.
- **Area**: Sales.
- **Finding**: `logAudit(user, ..., { module: 'sales', actionType: ..., recordId: orderId })`
  is genuinely called at `data.js:1616`, `1694`, `8962` — the audit rows exist in the database.
  But `logisticsRecordHistory`'s own `MODULE_PERMISSION_CHECK` map (`data.js:1902-1937`) lists
  17 other entity types (deliveries, stock_catalog, vehicles, machines, maintenance_jobs, etc.)
  and never includes `'sales'`/`sales_orders` — there is no UI surface anywhere in the app to
  view a sales order's audit trail, unlike Stock Catalog items, which have a complete,
  working History tab via the exact same shared mechanism.
- **Evidence**: `data.js:1616,1694,8962` (writes); `data.js:1902-1937` (the registry that omits
  sales); compare `app.js:11333` (Stock Catalog's own working History tab, same mechanism).
- **Disposition**: **RESOLVED — Phase C1** (`ERP_PROFESSIONALIZATION_PHASE_C1_SALES_ORDERS_*`),
  bundled into the same phase as PR-01 since both touch the new Sales Order detail view. Added
  `sales: () => mustRole(user, 'sales')` to `MODULE_PERMISSION_CHECK` and wired a History tab
  into the new detail overlay/screen on both platforms, reusing `logisticsRecordHistory` exactly
  as Stock Catalog already does. Live-verified audit rows are readable for a sales-permitted user
  and correctly denied for a non-sales role.

### PR-22, PR-23 — `createAutomationRule`/`deleteAutomationRule`: fully built, zero UI on either platform
- **Type**: BACKEND GAP (the one genuine "backend exists, no UI at all" finding out of 407
  functions checked).
- **Area**: Automation / Admin.
- **Finding**: Both functions are fully validated (`rule_key` format, `severity`/`auto_action`
  enums, `notify_roles`, threshold JSON, admin/ceo-restricted, audit-logged), wired to IPC
  (`electron/main.js:404-405`) and exposed on `UFCL.automationCreate`/`Delete`
  (`electron/preload.js:161-162`) — but the Automation Center page
  (`renderAutomationCenter`, `app.js:21844`) only lets a user toggle/edit the fixed seed rule
  set; there is no "Add Rule" control anywhere, and `mobile-api/routes/automation.js` has no
  POST route for creation at all. `deleteAutomationRule`'s own error message ("Built-in rules
  cannot be deleted. Disable them instead.") only makes sense if custom rules were meant to be
  creatable and deletable — confirming this is an oversight, not an intentional restriction.
- **Evidence**: `data.js:20095` (delete), `20119` (create); `electron/main.js:404-405`;
  `electron/preload.js:161-162`; zero call sites anywhere in `renderer/app.js` or
  `mobile-api/routes/automation.js`.
- **Disposition**: **RESOLVED — Phase C3** (`ERP_PROFESSIONALIZATION_PHASE_C3_*`, see that
  phase's Completion Report/Changelog/Gap Register for full detail). Desktop: "New Rule" button +
  overlay, per-row Delete button added to `renderAutomationCenter`. Mobile: `POST`/`DELETE
  /rules` routes added to `mobile-api/routes/automation.js`, `useCreateAutomationRule`/
  `useDeleteAutomationRule` hooks added, `AutomationRuleDetailScreen` extended with a create-mode
  render path and a Delete action. Re-verification during that phase additionally found and fixed
  a real, related bug: `BUILT_IN_RULES` (the set that blocks deletion) was missing 6
  `procurement_*` rule keys that `db/migrate.js` also re-seeds on every startup — without that
  fix, deleting one of those 6 through the new UI would have silently reappeared after the next
  restart. Live-verified: 24/24 checks passed, including permission denial, validation, duplicate
  rejection, a real concurrency race (2 simultaneous creates, exactly 1 wins), and both the
  original 8 and the 6 newly-protected procurement rules correctly rejected for deletion.

### PR-24 — "Export" buttons that export a summary/report, not the row data shown (found repeatedly)
- **Type**: UX GAP (pattern, cross-cutting).
- **Area**: Harvest, VAT/Nyanza.
- **Finding**: A button labeled "Export CSV" exists on the Harvest log table and the VAT/Nyanza
  batch table, but both export an aggregated *report* (executive summary / quality-
  reconciliation report), not the rows actually on screen — this can create false confidence
  that a list is exportable when it isn't.
- **Evidence**: Harvest (`app.js:3797/4510`); VAT (`app.js:17047`, explicitly self-documented
  at `17066-17071` as a separate concern from row export).
- **Disposition**: Disclosed, not fixed — a documentation/labeling clarity issue more than a
  missing-capability one; folded into PR-17/PR-18's broader "no row export" finding for VAT,
  and noted separately for Harvest since Harvest otherwise has search+sort already.

---

## Newly Discovered — Phase C4 (re-assessed Phase C5, RESOLVED Phase C6)

### NF-01 — Audit Log has zero Workshop Isolation, and the permission grant makes this a real, live gap — RESOLVED — Phase C6
- **Disposition**: **RESOLVED — Phase C6** (`ERP_PROFESSIONALIZATION_PHASE_C6_*`). `audit_log`
  gained a nullable `workshop_id` column; all 3 audit-writing paths (`logAudit`,
  `handleAuditReplay`, mobile's separate `auditLogin`) now derive or accept trusted workshop
  attribution (actor's own workshop by default — safe by construction given existing write-side
  Workshop Isolation — with an explicit override threaded through 64 of 238 call sites where a
  workshop-exempt actor could plausibly act on a specific workshop's record); `auditList`/the new
  `auditExportExcel` enforce `isWorkshopRestricted` server-side via one shared, un-bypassable
  query builder. Historical rows (2,511 of them) are deliberately not backfilled — `audit_log`'s
  own immutability rule (`audit_log_no_update`) was never suspended, even briefly, to do so — and
  are instead grandfathered via a one-time cutover marker so no viewer lost any pre-existing
  visibility. **26/26 live security checks passed** against production data using 2 disposable QA
  accounts in 2 different workshops (cross-workshop denial, own-workshop access, global-user
  full-visibility, parameter-override-ignored, export-isolation-parity, concurrent-write
  correctness, non-audit-role denial, global-event NULL-attribution — all confirmed). The
  threading pass itself surfaced and fixed 7 real pre-shipping bugs (5 crash-class, caught by a
  dedicated scope-verifier before any live testing began — see that phase's Changelog). See
  `ERP_PROFESSIONALIZATION_PHASE_C6_COMPLETION_REPORT.md` for full detail, including a live,
  role-by-role permission audit showing 11 of 19 `audit`-holding roles have real, active,
  workshop-assigned users today (this was not a theoretical risk).

### Original finding (superseded by the resolution above; preserved for history)
- **Type**: SECURITY FINDING (newly discovered during Phase C4's candidate research; rigorously
  re-investigated from scratch during Phase C5 per that phase's explicit "special attention"
  instruction — not part of the original 3-audit pass that produced PR-01 through PR-33).
- **Area**: Admin / Audit.
- **Finding**: `auditList` (`db/services/data.js:2188`) applies zero `workshop_id`/
  `isWorkshopRestricted` filtering — it is company-wide for every viewer who can reach the page.
  The `'audit'` page permission is held live (`db/migrate.js`) not just by `admin`/`ceo` but by a
  wide set of genuinely workshop-scoped operational roles (`storekeeper`, `sales`, `logistics`,
  `finance`, and the large leader/supervisor role block). A workshop-restricted storekeeper or
  supervisor can currently view audit rows describing changes made at every *other* workshop too.
  Confirmed identical on mobile (same unfiltered `auditList` behind `mobile-api/routes/*`).
- **Why not fixed**: `audit_log` has no `workshop_id` column in either `db/schema.sql` or any
  `ALTER TABLE audit_log` in `db/migrate.js` — confirmed again in C5's re-investigation. Phase
  C5's deeper pass additionally confirmed: **all ~239 `logAudit(...)` call sites live in a single
  file** (`db/services/data.js`), and at every sampled site the affected record's `workshop_id`
  is **already in local scope** at the point `logAudit` is called — so a future fix is more
  mechanically tractable than C4's quick-check suggested (one file to touch, no new lookups
  needed, only plumbing to pass the value through). Despite that, the sheer volume (~239 call
  sites) plus the need for a companion migration and a full regression pass across every
  audit-writing code path is still too large and too architecturally significant for a
  single-item phase — a partial fix would leave the column present but inconsistently populated,
  which is worse than today's honest, fully-disclosed gap. No heuristic/fake workshop filter
  (e.g. scoping by the *acting* user instead of the *affected record*) was added — that would be
  actively wrong, not just incomplete.
- **Disposition**: **OPEN — requires a dedicated future phase.** Not a business decision in the
  pricing/policy sense but a genuine engineering-design task, now with a concrete, validated,
  ready-to-execute plan: one migration (add `workshop_id`, nullable, no historical backfill,
  matching this app's own convention) + a single pass touching all ~239 call sites in the one
  file that has them + one filter added to `auditList` + a full regression pass. See
  `ERP_PROFESSIONALIZATION_PHASE_C5_GAP_REGISTER.md` for the full investigation and reasoning
  (supersedes `PHASE_C4_GAP_REGISTER.md`'s shallower version of this entry).

---

## P3 — Professionalization

- **PR-25** Sales Dashboard has no distinct "needs attention" grouping and no overdue-payment
  flag despite `payment_status`/`payment_due_date` already existing and being used elsewhere
  (`salesReport`, `data.js:1466-1477`). `app.js:5528`.
- **PR-26** No dedicated HR/Payroll dashboard exists — the only payroll "needs attention"
  signal lives inside Finance's dashboard, not an HR-scoped view. `attendanceDashboard`
  (`data.js:11674`) is a pure snapshot with no trend/anomaly flag.
- **PR-27** No dedicated dashboards exist for Poles, Nyanza/VAT, Showroom, or a generic
  "Operations" role (confirmed via grep, zero `*Dashboard` functions match) — these rely on
  the shared executive/CEO/finance dashboards or plain list pages, unlike Sawmill/Harvest/
  Fleet/Mechanician, which each got a purpose-built one.
- **PR-28** Harvest Logs — missing row-level export only (already has search+sort+an executive
  summary export). `app.js:3627`.
- **PR-29** Sawmill Daily Production — missing sort control and row export (already has search
  + date-range filter + pagination). `app.js:2488`.
- **PR-30** Attendance History — missing sort and free-text name search (already has date/
  status/type/workshop filters + export, the more useful controls). `app.js:19531`.
- **PR-31** Casual Labour Requests — flat table, no search/filter/sort (smaller-volume list
  than Casual Workers itself). `app.js:18948`.
- **PR-32** Users (admin registry) — flat table, no search/filter/sort; realistically dozens of
  accounts in this org, so lower urgency than other findings. `app.js:9571`.
- **PR-33** Procurement Dashboard's "Pending Approvals" KPI always reads 0 — the requisition
  status value (`'in_approval'`) it filters on is never actually persisted (real in-progress
  requisitions carry `'submitted'`). **RESOLVED — found already fixed during Phase C8's live
  re-verification, not by Phase C8 itself.** An earlier, unlogged phase's "Phase 2B fix"
  (`ENTITY_MID_STATUS` in `procurementApprovalAction`) already writes `'in_approval'` correctly;
  live query against production confirmed real `in_approval` rows exist and are correctly
  counted by the dashboard. This finding, and the in-code comment that repeated it, were both
  stale documentation, not an active defect — the comment has been corrected. See
  `ERP_PROFESSIONALIZATION_PHASE_C8_PROCUREMENT_GAP_REGISTER.md` for the full re-verification.

---

## Summary Table

*Updated after Phase C1 (Sales Orders), Phase C2 (CEO Overview), Phase C3 (Automation Custom
Rules), Phase C4 (Finance Operations Center), Phase C5 (Inventory Dashboard Drill-Down), Phase C6
(Audit Log Security & Workshop Isolation), Phase C7 (Executive Dashboard), and Phase C8
(Procurement) — see each phase's own `_COMPLETION_REPORT.md`/`_CHANGELOG.md`/`_GAP_REGISTER.md`
for full detail. Historical findings are preserved above, not deleted; this table reflects
current status only.*

| ID | Severity | Type | Area | Status |
|---|---|---|---|---|
| PR-01 | P2 | UX GAP | Sales Orders | **Resolved — Phase C1** |
| PR-02 | P2 | UX GAP | Customers | Open (re-checked live in Phase C5: production still holds 1 customer row — real but low current urgency) |
| PR-03–06 | P2 (×4) | UX GAP | Procurement export (PO/Requisitions/Suppliers/Invoices) | **Resolved — Phase C8** |
| PR-07–14 | P2 (×8) | UX GAP | Export missing, 8 lists | Open |
| PR-15 | P2 | UX GAP | Finance Operations Center | **Resolved — Phase C4** |
| PR-16 | P2 | UX GAP | Audit Log (sort/export/pagination) | **Resolved — Phase C6** |
| PR-17, 18 | P2 (×2) | UX GAP | VAT/Nyanza + Poles batch lists | Open (re-checked live: both tables currently hold 0 rows in production — real gap, zero current-data urgency) |
| PR-19 | P2 | UI GAP | CEO Overview | **Resolved — Phase C2** |
| PR-20 | P2 | UX GAP | Dashboard drill-down (systemic) | Partially resolved — CEO Overview (C2), Inventory Dashboard (C5), Executive Dashboard (C7), and Procurement Dashboard (C8) instances fixed; Logistics/Maintenance Officer dashboards still open |
| PR-21 | P2 | UI GAP | Sales Orders audit history | **Resolved — Phase C1** |
| PR-22, 23 | P2 (×2) | BACKEND GAP | Automation custom rules | **Resolved — Phase C3** |
| PR-24 | P2 | UX GAP | Export-is-a-summary pattern | Disclosed, folded into 17/18 |
| PR-25–32 | P3 (×8) | UX GAP | Various dashboards/lists | Open, backlog |
| PR-33 | P3 | DATA QUALITY | Procurement pending-approvals count | **Resolved — found already fixed during Phase C8's live re-verification** (stale finding; not an active defect — see Phase C8 Gap Register) |
| NF-01 | — | SECURITY (discovered Phase C4, re-assessed Phase C5) | Audit Log Workshop Isolation | **Resolved — Phase C6** |
| NF-C8-01, 02 | — | SECURITY (discovered + resolved Phase C8) | Procurement RFQ + Invoice Workshop Isolation | **Resolved — Phase C8** |
| NF-C8-03 | — | DATA HYGIENE (discovered Phase C8, pre-existing) | Un-cleaned QA residue in Procurement tables | Open — disclosed, needs user decision |

**Resolved: PR-01, PR-03–06, PR-15, PR-16, PR-19, PR-20 (partial — 4 of 6 dashboard instances),
PR-21, PR-22, PR-23, PR-33, NF-01, NF-C8-01, NF-C8-02 (15 of 28 findings, across 8 phases).
Remaining open: 10 P2 (2 as partial-PR-20 instances), 8 P3, 1 newly-disclosed data-hygiene item
(NF-C8-03).** Every resolution above was live-verified against production data with disposable
QA records (or, where a phase touched no backend/data-mutation surface — Phase C5, Phase C7 —
via static verification and live permission-parity/data-correctness checks instead), fully
cleaned up, per each phase's own Completion Report. No historical finding was removed; each is
marked with its current, accurate status.
