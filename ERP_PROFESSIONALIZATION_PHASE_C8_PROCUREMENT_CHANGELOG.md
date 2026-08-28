# Phase C8 — Procurement Operational Excellence — Changelog

Scope: professionalize Procurement to the same standard as prior C-phases. The department was
found to already be extraordinarily mature (76 backend functions, 9 fully-built desktop pages).
Real work this phase: 2 Workshop Isolation fixes, a 6-list Excel export dispatcher, permission-
aware dashboard KPI drill-down, and correction of stale documentation that had the master
register under-reporting the module's actual (already-resolved) state.

## Backend — `db/services/data.js`

- **`procurementRfqList(userId, filters)`** — gained real Workshop Isolation. Previously applied
  zero scoping despite RFQs being derivable from their originating requisition's `workshop_id`;
  now joins through that relationship using the same `isWorkshopRestricted`/"null = unscoped, not
  blocked" convention used throughout this file. Signature technically unchanged (already
  accepted no params before — the export dispatcher now also calls it with a `filters` arg it
  silently ignores, harmless).
- **`procurementRfqDetail(userId, rfqId)`** — same fix applied to direct-by-ID access: a
  workshop-restricted user can no longer view another workshop's RFQ by id even if the (now-fixed)
  list wouldn't have shown it to them.
- **`procurementInvoiceList(userId, filters)`** — same class of gap (joined to `procurement_purchase_orders`,
  which has `workshop_id`, but never filtered by it), same fix. No currently active user is
  workshop-scoped and holds `procurement-invoices`, so this was latent rather than actively
  exploited — fixed anyway.
- **`procurementExportExcel(userId, listType, filters)`** — new. One dispatcher for 6 exportable
  lists (`requisitions`, `suppliers`, `rfqs`, `purchase-orders`, `goods-receipts`, `invoices`),
  matching the established `payrollExportExcel` dispatcher pattern. Each branch delegates to its
  own already-correct List function for data and permission/Workshop-Isolation enforcement (never
  re-implemented), then formats via a local `addSheet`-equivalent using the same styling
  convention as every prior Excel export in this codebase (bold white-on-green header, frozen
  header row, autofilter, generated-timestamp line, filter-summary line). `module.exports` gained
  `procurementExportExcel`.
  - One bug caught during this phase's own testing (not shipped): the Invoices column definition
    initially referenced a non-existent `amount` field; the real field is `invoice_amount`.
    Caught by reopening the generated workbook and inspecting cell values, not merely checking
    "did the export function return `ok:true`" — fixed before this changelog was written.

## IPC — `electron/main.js` / `electron/preload.js`

- Added `secureHandle('procurement:export-excel', ...)`, base64-encoding the buffer for the IPC
  round-trip — identical pattern to every other Excel export channel in this app.
- Added `procurementExportExcel` to the preload bridge.

## Desktop — `renderer/app.js`

- **6 list pages** (`renderProcurementRequisitions`, `renderProcurementSuppliers`,
  `renderProcurementRfq`, `renderProcurementOrders`, `renderProcurementGoodsReceipt`,
  `renderProcurementInvoices`) — each gained an "Export Excel" toolbar button, wired to the new
  shared `_procExportExcel(listType, filters)` helper (same base64→Blob→download +
  `showToast(...)` convention as every prior Excel export in this app). Two pages
  (`renderProcurementOrders`, `renderProcurementInvoices`) had no toolbar `<div>` at all before
  this — one was added, matching the page-head/toolbar structure every other list page already
  uses.
- **`renderProcurementDashboard`** — the 4 top KPI cards and 5 of the 7 Supplier Intelligence KPI
  cards gained conditional drill-down: a new `dpAttr(target)` helper only emits the
  `data-page`/`cursor:pointer`/`title` attributes when `STORAGE.pages` (the viewer's own resolved
  permission list) actually includes the target page — never unconditionally, since a live
  permission audit (see Completion Report §21) found the dashboard is intentionally visible to
  many roles without list-page access. "Contracts Expiring" wired to the existing
  `openContractRegisterOverlay()` (already built, not new). "Total Procurement Spend"/"Average
  Supplier Score" deliberately left non-interactive (dimensionless, no destination).
- **Stale comment corrected**: `renderProcurementDashboard`'s own comment claiming the backend
  "does not currently persist" the `in_approval` requisition status was factually wrong as of
  current code (re-verified live — the status IS persisted, real rows exist, correctly counted).
  Comment rewritten to reflect the actual, re-verified state rather than repeating stale
  documentation.

## What was deliberately NOT changed

- **No second approval engine** — `procurement_approval_steps` remains the sole engine; the 2
  Workshop Isolation fixes and the export dispatcher only read from/through existing tables.
- **No Finished Poles QC weakening** — `procurementGoodsReceiptCreate`'s pole-QC gate was read
  and confirmed intact, not touched.
- **No Sage/accounting logic touched** — Procurement remains an operational control layer; no
  financial calculation was added or modified.
- **No pre-existing QA residue was deleted.** A significant amount of un-cleaned QA data from
  earlier, unlogged phases was discovered in production tables (duplicated `_QA Supplier Ltd`,
  `_QA Phase2B` requisitions/RFQs/invoices) — disclosed in the Gap Register, not unilaterally
  removed, since this phase did not create it and this session's own precedent is to ask before
  deleting data it didn't create.
- **No permission was granted or widened.** The 11-role gap between `procurement-dashboard` and
  the underlying list permissions (Completion Report §21) was worked around via conditional UI,
  not closed by expanding anyone's access.
- **Mobile was not touched.** No mobile Excel export was built; mobile's existing Procurement
  screens (confirmed to already support per-line `stock_item_id` selection on the Requisition
  form, contradicting an old, stale finding) were read for verification only.
- **No pagination was added** — all 6 lists remain intentionally bounded (≤200 rows,
  backend-capped), matching this app's own established convention.

## Verification

- `node --check` clean on all 4 touched files.
- `npx tsc --noEmit` clean across the mobile project (exit 0; no mobile file touched).
- Live-tested: `procurementExportExcel` succeeds for all 6 list types against production data;
  every generated workbook was reopened with ExcelJS and its sheet name, headers, and row count
  verified against the underlying list's own data.
- Live E2E: full Requisition→RFQ→Quotation→Evaluation→PO→Goods-Receipt→Inventory chain run
  against production with disposable QA data — 17/19 checks passed (2 failures were the test
  script's own cleanup-ordering bug, not an application defect; remediated and re-verified zero
  residual rows via a direct FK-dependency query).
- Live concurrency test: two simultaneous identical approval calls from the same actor advanced
  exactly one approval stage and produced exactly one audit log entry — confirmed via direct
  database inspection, not just the functions' own return values.
- Live permission audit against `role_definitions` (the authoritative runtime table) for every
  role holding `procurement-dashboard`, driving the conditional drill-down design (not assumed).
- No commit made, no push — consistent with this session's established practice.
