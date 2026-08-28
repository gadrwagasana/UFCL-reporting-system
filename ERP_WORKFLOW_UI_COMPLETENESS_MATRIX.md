# ERP Master Professionalization — Workflow UI Completeness Matrix

Assesses whether each department's full backend lifecycle can actually be **completed by an
authorized user through the UI** — not "does the backend support it," per the brief's own
standard (§10-15). Lifecycle correctness/reachability (can each status transition be performed
at all) was already exhaustively verified in the prior Final Enterprise Completion Gate; this
matrix instead asks whether the *professional usability* of executing that lifecycle (finding
the right record, understanding its state, acting efficiently) is complete.

## Production (Harvesting / Sawmill / Nyanza-VAT / Poles)
`Input → Production → Inspection → Accept/Reject → Rework/Downgrade/Return/Disposal → Finished Inventory → Transfer → Sale`

| Stage | Reachable via UI? | Professionally usable? |
|---|---|---|
| Input/intake | ✅ all 4 lines | ✅ |
| Production entry | ✅ all 4 lines | ⚠ Sawmill missing sort/export (PR-29); VAT/Poles batch lists have zero search/filter/sort/export at all (PR-17, PR-18) |
| Inspection/QC | ✅ all 4 lines, via the shared polymorphic QC engine (verified consistent across all 4 lines in the prior Completion Gate) | ✅ |
| Accept/Reject/Rework/Downgrade/Return/Disposal | ✅ all 4 lines (Rework correctly N/A for purchased-finished poles, with clear pre-emptive UI messaging) | ✅ |
| Finished Inventory posting | ✅ real stock posting confirmed on Accept for all 4 lines | ✅ |
| Transfer/Sale | ✅ via Stock Transfers / Sales Orders | ⚠ Sales Orders itself has the PR-01 gap |

**Verdict**: Lifecycle **completable end-to-end on all 4 production lines**. Professional
usability gap concentrated specifically in the VAT/Poles batch list screens (zero navigation
aids) — the QC/inspection/resolution steps themselves are fully usable everywhere.

## Sales
`Customer → Order → Delivery → Cancellation/Rejection/Short-Close → Customer History`

| Stage | Reachable via UI? | Professionally usable? |
|---|---|---|
| Customer CRUD | ✅ | 🔴 No search/filter on an unbounded list (PR-02) |
| Order creation (Timber/Poles/Pallets/Manufactured/Value-added, negotiated pricing) | ✅ | 🔴 The list itself: zero search/filter/sort/export, hard-capped at 50 rows (PR-01) |
| Delivery/Dispatch | ✅ | ✅ (Logistics side is well-covered, see below) |
| Cancellation/Rejection/Short-Close | ✅ status transitions confirmed reachable in prior audits | ✅ |
| Customer History | ✅ (`customersOrders`) | ✅ |
| Audit trail (order-level) | 🔴 **Not reachable anywhere** — audit rows are captured (`logAudit` calls confirmed real) but no UI surface exists to view them (PR-21) | — |

**Verdict**: Lifecycle **completable**, but Sales has the **weakest overall professional-
usability score of any department audited** — its primary list has no navigation aids at all,
and it's the only entity type in the app whose captured audit history has zero UI to view it.

## HR (Casual Workers / Attendance / Casual Labour / Payroll)

| Stage | Reachable via UI? | Professionally usable? |
|---|---|---|
| Casual Worker registration/edit/activate | ✅ | 🔴 No search/filter on the registry (PR-14) |
| Attendance checklist/history/correction | ✅ | ⚠ History has the useful filters + export, missing only sort/name-search (PR-30, minor) |
| Casual Labour Request → Review/Approval | ✅ | ⚠ Flat list, no search/filter (PR-31, minor — lower volume than Casuals itself) |
| Payroll rates → periods → calculation → approval → adjustments → reports → Excel → close | ✅ full lifecycle, reuses the shared Engine B approval mechanism | ✅ **the best-professionalized list toolkit in the entire app** |

**Verdict**: Lifecycle **completable**. Payroll is exemplary; Casual Workers is the weak point
in this department specifically because it has real seasonal volume with zero navigation aids.

## Maintenance
`Scheduled → Assigned → In Progress → Paused → Waiting for Parts → Completed → Cancelled`

| Stage | Reachable via UI? | Professionally usable? |
|---|---|---|
| All 7 status transitions | ✅ confirmed reachable, workshop-isolated (prior Completion Gate fixed the one real gap here, `maintenanceJobAssign`'s Workshop Isolation check) | ✅ |
| Technician/labour/hours/delays/pause reasons | ✅ | ✅ |
| Material Request → Stock Transfer → consumption linkage | ✅ | ✅ |
| Cost/completion evidence/history | ✅ | ⚠ Maintenance Jobs list itself: search+filter+sort present, but capped at 300 (largest cap in the app) with no export (PR-13) |

**Verdict**: Lifecycle **fully completable and well-instrumented** — the one gap is export on
the list view, not the workflow itself.

## Procurement
`Supplier → Requisition → Approval → RFQ → Quotation → PO → Goods Receipt → Inspection → Inventory`

| Stage | Reachable via UI? | Professionally usable? |
|---|---|---|
| Full chain | ✅ confirmed complete and workshop-isolated in the prior Completion Gate; live-traced against a real production PO | ✅ workflow itself |
| Requisition approval visibility | ⚠ **the Dashboard's own "Pending Approvals" KPI is unreliable** (PR-33 — reads 0 regardless of actual pending count, a pre-existing disclosed issue, NOT newly introduced) — the underlying Requisitions list itself correctly shows real status | — |
| POs/Requisitions/Suppliers/Invoices lists | ✅ search+filter+sort on all 4 | 🔴 Zero export on all 4 (PR-03–06) |

**Verdict**: Lifecycle **completable**; the approval-count data-quality issue is real but
predates this audit and requires a scoped business/engineering decision, not a quick fix (see
Gap Register PR-33).

## Logistics
`Material Requests → Stock Transfers → Dispatch → Receiving → Delivery Orders → Transport Jobs → Log Transport`

| Stage | Reachable via UI? | Professionally usable? |
|---|---|---|
| Full chain | ✅ confirmed complete, workshop-isolated, notification-routed (prior audits) | ✅ workflow itself |
| Stock Transfers/Dispatch/Delivery Orders/Transport Jobs lists | ✅ search+filter+sort on all 4 | 🔴 Zero export on all 4 (PR-07–10); Transport Jobs self-labels "last 100" |

**Verdict**: Lifecycle **fully completable**; the gap is uniformly "no export," not a workflow
break.

---

## Overall Workflow Completeness

**All 6 major department lifecycles are completable end-to-end through the UI on both
platforms where applicable.** Zero broken workflows found. The professionalization gaps found
are concentrated in two specific patterns, both already catalogued in the Gap Register:
(1) missing row-level export on otherwise-functional lists (14 instances), and (2) two
screens — Sales Orders and the VAT/Poles production batch lists — with essentially no
navigation aids at all, standing out sharply against every other department's list-toolkit
maturity.
