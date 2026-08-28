# ERP Master Professionalization — Role UX Matrix

This matrix uses the professionalization lens (dashboard actionability, list usability,
drill-down), distinct from the correctness-focused Role/UX Matrix produced by the immediately
prior Final Enterprise Completion Gate (all roles GREEN there — CRUD/workflow/permission
correctness). Here, "GREEN" means the role's daily-use screens are professionally usable, not
merely functionally correct.

| Role | Primary Dashboard | Dashboard Actionable? | Primary List(s) | List Usability | Verdict |
|---|---|---|---|---|---|
| **CEO / Admin** | CEO Overview + Executive Dashboard | ⚠ Both fully informative but tiles/widgets are not clickable (PR-20); CEO Overview also drops 2 computed pending-action fields entirely (PR-19) | Users, Audit Log | ⚠ Neither has search/filter/sort; Audit Log capped 500 with no export (PR-16, PR-32) | **YELLOW** — functional, not yet professionalized |
| **Operations** | Executive Dashboard (shared) | ⚠ Same as above | Varies by area | Inherits whichever department list they're using | **YELLOW** |
| **Finance** | Finance Dashboard | ✅ Best-built dashboard in the app — explicit data-quality warnings, exceptions section | Operations Center, 24-report suite | ⚠ Operations Center has no export/sort control despite being explicitly a reconciliation tool (PR-15); the 24-report suite itself is solid | **YELLOW** — dashboard excellent, one operational tool underbuilt |
| **Procurement Officer/Manager** | Procurement Dashboard | ⚠ Non-clickable tiles (PR-20) + "Pending Approvals" KPI structurally always reads 0 (PR-33, pre-existing disclosed issue) | POs, Requisitions, Suppliers, Invoices | ⚠ All 4 have search+filter+sort but zero export (PR-03–06) | **YELLOW** |
| **Logistics** | Logistics Dashboard | ⚠ Non-clickable widgets (PR-20) | Stock Transfers, Dispatch, Delivery Orders, Transport Jobs | ⚠ All 4 have search+filter+sort but zero export; Transport Jobs self-labels "last 100" with no way past it (PR-07–10) | **YELLOW** |
| **Storekeeper** | Inventory Dashboard | ⚠ Non-clickable tiles; full stock register table on the same page has no row click either (PR-20) | Stock Catalog, Stock Movements | ✅ Stock Catalog fully professionalized; ⚠ Stock Movements (the audit trail) has no export, self-labeled "last 100" (PR-11) | **YELLOW** |
| **Sales / Sales-Staff / Showroom-Staff** | Sales Dashboard | ⚠ Weak needs-attention grouping, no overdue-payment flag despite the data existing (PR-25) | **Sales Orders**, Customers | 🔴 Sales Orders: zero search/filter/sort/export, hard-capped at 50 rows server-side with no filter param at all (PR-01) — the single most significant finding in this audit; Customers unbounded with no navigation aids (PR-02) | **YELLOW** — the one role with the most consequential single gap in the whole audit |
| **Fleet** | Fleet Dashboard | ✅ Solid | Vehicles, Fuel Logs | ✅ Vehicles fully professionalized; ⚠ Fuel Logs has search+filter+sort but no export (PR-12) | **GREEN-leaning YELLOW** |
| **Mechanician** | Mechanician Dashboard + Maintenance Officer Dashboard | ✅ Both solid, including a "repeated failures" anomaly proxy | Maintenance Jobs | ⚠ Search+filter+sort present, capped at 300 (largest cap in the app) with no export (PR-13) | **YELLOW** |
| **Harvesting-Leader/-Supervisor** | (shared, no dedicated dashboard — PR-27) | N/A | Harvest Logs | ✅ Best-covered production list — search+sort+an executive summary export; only row-level export of the raw log entries is missing (PR-28, P3) | **GREEN-leaning YELLOW** |
| **Sawmill-Leader/-Supervisor** | Sawmill Manager Dashboard | ✅ Standout — genuine statistical anomaly detection (z-score production analysis), the exact "what is abnormal" capability this audit looks for | Sawmill daily production | ⚠ Search+date-filter+pagination present; missing sort control and export (PR-29, P3) | **GREEN** dashboard, **YELLOW** list |
| **VAT-Leader/-Supervisor (Nyanza)** | (shared, no dedicated dashboard — PR-27) | N/A | VAT/Nyanza production batches | 🔴 Zero search/filter/sort/export of any kind, capped 200 rows (PR-17) | **YELLOW** |
| **Poles-Leader/-Supervisor** | (shared, no dedicated dashboard — PR-27) | N/A | Poles production batches | 🔴 Zero search/filter/sort/export, capped 200 rows (PR-18) | **YELLOW** |
| **HR (Casuals/Attendance/Payroll administrators)** | No dedicated HR/Payroll dashboard (PR-26) — payroll's only "needs attention" signal lives inside Finance's dashboard | N/A | Casual Workers, Attendance, Payroll Periods/Lines | 🔴 Casual Workers: zero navigation aids, unbounded query (PR-14); ⚠ Attendance History: has the more useful date/status/workshop filters + export, missing only sort+name-search (PR-30, P3); ✅ Payroll Periods/Lines: **the reference implementation** — full search/filter/sort-with-direction-toggle/Excel export on both | **YELLOW** — Payroll is GREEN, Casuals is the weak point |

## Cross-cutting observations

- **Payroll is the gold-standard implementation** in the entire app for list professionalization
  (search, filter, sortable columns with direction toggle, real Excel export on both its
  Periods and Lines tables) — every other module's remediation should be measured against it,
  not a new pattern invented.
- **Finance's Dashboard is the gold-standard implementation** for dashboard actionability
  (explicit data-quality warnings, a real exceptions section, and — via its Operations Center's
  Trace feature — the single best drill-down chain in the app).
- **No role reaches a pure GREEN verdict** under this professionalization lens — every role has
  at least one P2/P3 finding — but critically, **no role is blocked from doing their job**;
  every finding is an efficiency/usability gap on top of a functionally correct workflow, not a
  broken one. This is consistent with the Gap Register's own P0=0/P1=0 result.
- **Sales is the one role whose primary daily screen (Sales Orders) has the single most
  consequential gap found in this entire audit** — worth prioritizing first in any Phase C
  implementation given its severity relative to the rest of the P2 backlog.
