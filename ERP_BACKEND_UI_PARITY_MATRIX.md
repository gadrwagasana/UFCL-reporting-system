# ERP Backend → UI Parity Matrix

**Method**: full-population cross-reference, not a sample. Every one of the 407 exported
functions in `db/services/data.js`'s `module.exports` block was classified by cross-referencing
`electron/main.js` (IPC wiring), `renderer/app.js` (actual `UFCL.*` call sites — not just
wiring), `electron/preload.js` (bridge mapping), and every `mobile-api/routes/*.js` file (REST
wiring). ~35 ambiguous cases (aliases, HTTP-proxy patterns, superseded/legacy functions) were
individually traced to ground truth by reading the function bodies and call chains, not
assumed from naming alone.

## Department Breakdown

| Department | Total | Desktop-reachable | Mobile-reachable | Backend-only (intentional) | Missing UI (flagged) |
|---|---|---|---|---|---|
| Finance | 36 | 36 | 36 | 0 | 0 |
| Procurement/Supplier/SRM | 36 | 36 | 36 | 0 | 0 |
| Maintenance/Machine | 51 | 51 | 41 | 0 | 0 |
| Delivery/Dispatch/Transport/Logistics | 30 | 30 | 26 | 0 | 0 |
| Automation/BI/Workflow/Escalation/Approval | 29 | 22 | 8 | 5 | **2 (P2)** |
| Payroll | 24 | 24 | 24 | 0 | 0 |
| Harvest/Compartments | 24 | 24 | 23 | 0 | 0 |
| Governance/PendingEdits/Deletion/Rejection/Resolution/Trash/Attachments | 24 | 24 | 24 | 0 | 0 |
| Stock/Inventory/Warehouse | 29 | 29 | 27 | 0 | 0 |
| Reporting/Executive/KPI/Performance | 20 | 20 | 15 | 0 | 0 |
| Pole | 11 | 11 | 11 | 0 | 0 |
| Casual Labour | 10 | 10 | 9 | 0 | 0 |
| Vehicle/Fleet/Fuel | 10 | 10 | 9 | 0 | 0 |
| Sales | 10 | 10 | 10 | 0 | 0 |
| Production/VAP/Quality | 16 | 16 | 15 | 0 | 0 |
| User/Role | 7 | 7 | 7 | 0 | 0 |
| Attendance | 8 | 8 | 8 | 0 | 0 |
| Customer | 6 | 6 | 6 | 0 | 0 |
| Sawmill/Daily | 6 | 6 | 6 | 0 | 0 |
| Products/Catalog | 6 | 6 | 5 | 0 | 0 |
| Notification | 4 | 4 | 4 | 0 | 0 |
| Showroom | 3 | 3 | 3 | 0 | 0 |
| Material Requests | 3 | 3 | 3 | 0 | 0 |
| Workshop | 3 | 2 | 3 | 0 | 0 (mobile-only by design, not missing) |
| Audit | 1 | 1 | 1 | 0 | 0 |
| **TOTAL** | **407** | **399** | **360** | **5** | **2** |

## Genuine Missing-UI Findings (see Gap Register PR-22, PR-23 for full detail)

1. **`createAutomationRule`** (`db/services/data.js:20119`) — fully validated, IPC-wired,
   preload-exposed, zero UI call site on either platform.
2. **`deleteAutomationRule`** (`db/services/data.js:20095`) — same pattern; its own error
   message implies custom rules were meant to be deletable, confirming this is an oversight.

Both are in the Automation Center admin screen — every other department's export surface is
**100% accounted for** (reachable on at least one platform, or a confirmed intentional
backend-only cron/internal task).

## Intentional Backend-Only (5 functions)

All confirmed to be internal cron-engine tasks started by `data.startScheduler()`
(`electron/main.js:1165`) via `_schedulerTick` (`data.js:20839`) — `escalatePendingRequests`,
`runAutomationEngine`, `runEscalationEngine`, `scheduleJob`, `routeApprovalRequest`. Correctly
never exposed to any UI; these are system processes, not user actions.

## Notable Near-Misses Investigated and Ruled Out (not flagged as gaps)

- **`harvestList`** — wired but dead/superseded; the actual UI (desktop and mobile) renders
  from `dailyHarvestData`, a superset query built later. The *capability* is fully covered;
  this is a redundant-code note, not a UI gap.
- **`stockTransferApprove`** (singular) — self-documented in-code as legacy, superseded by
  `stockTransfersApproveReject`, kept only for already-cached clients.
- **`performanceExport`** — server function never called; the desktop UI duplicates the same
  CSV-building logic client-side before calling an unrelated same-named save-dialog helper (a
  naming collision, not a missing capability).
- **`automationHistory`/`automationRulesList`/`automationRuleUpdate`/`automationRunNow`** —
  confirmed plain aliases of already-fully-wired functions.
- **`workshopsListWithMetrics`** — mobile-only; desktop has no equivalent all-workshops-with-
  metrics table (only single-workshop or name-only variants). A real platform asymmetry, but
  since mobile does have a working UI for it, it doesn't meet the "missing on both platforms"
  bar for a flagged gap — noted as a minor footnote only.
- Attachment/SRM-document functions — desktop proxies these over HTTP to the same mobile-api
  routes rather than calling `data.*` directly; explicitly intentional
  (`electron/main.js:996-1109`), fully covered on both platforms.

## Totals

- **Total backend capability count: 407** exported functions (smaller than the ~600 initial
  estimate — many CRUD operations are consolidated into single multi-action functions rather
  than one function per verb).
- **Desktop parity: 399/407 = 98.0%**
- **Mobile parity: 360/407 = 88.5%** (the gap is expected and intentional — mobile correctly
  omits most admin/configuration/executive-report-export functionality, which is desktop's
  natural home per this program's own established mobile-scoping precedent).
- **Intentional backend-only: 5/407 = 1.2%**
- **Confirmed genuine missing-UI capabilities: 2/407 = 0.5%**
