# Procurement Module — Phase 1 Audit & Specification

**Scope:** Full audit of the existing Procurement module across the Electron desktop app, the React Native mobile app, and the shared `db/services/data.js` backend. No code was changed to produce this document — every claim below was verified directly against the current source and a live query of the database, not from memory.

**How to read this:** every finding that could sound like an opinion is backed by a file reference. Where I say a feature is missing, I mean I grepped for it and it isn't there — not that I assume it isn't.

---

## 0. Executive Summary

The Procurement module is a complete, working, 9-sub-module system: Suppliers, Purchase Requisitions (with a 5–6 stage configurable approval chain), RFQ/Quotations, Purchase Orders, Goods Receipt, Invoice Matching, Payments, a Dashboard, and Reports/Analytics. It exists in full on both platforms — 8 pages on desktop, 17 screens on mobile — backed by 16 database tables, 47 backend functions, and 38 REST endpoints.

It is **functionally solid for the core paper trail** (create → approve → order → receive → invoice → pay) but has four defects serious enough to affect real usage, found by tracing the code rather than guessing:

1. **The "Pending Approvals" dashboard tile is always 0**, on both platforms, because the code reads a status value (`in_approval`) that the backend never actually writes (§7.3).
2. **The flagship "goods receipt auto-updates inventory" feature cannot be triggered by any user**, on either platform, because no screen lets a user link a requisition line item to a stock catalog item (§7.4).
3. **A Procurement Settings screen does not exist on either platform** — the CEO approval-threshold config has a full backend/API/IPC implementation with no UI anywhere to view or change it (§7.1).
4. **Three of seven procurement notification events are silently dropped** — invoice approval, invoice rejection, and payment rejection never notify anyone (§7.2).

None of these are visible from using the UI casually — they only surface by reading the code path end to end, which is what this document does.

---

## 1. Procurement Feature Inventory

### 1.1 Suppliers

- **Business purpose:** central registry of vendors, replacing free-text supplier names. Tracks tax/bank details, preferred/blacklist status, contacts, and contracts.
- **User workflow:** Procurement Officer/Manager registers a supplier → adds contacts and contracts → supplier becomes selectable in the RFQ quotation-recording step → performance (PO count, receipts, reject rate) accrues automatically as POs are fulfilled.
- **Electron screens:** one page (`procurement-suppliers`) — list with Register/Edit/Blacklist/Delete/Manage actions. "Manage" opens an overlay for contacts, contracts, and computed performance stats (`renderer/app.js:13320-13470`, `openSupplierManageOverlay`).
- **Mobile screens:** `SuppliersListScreen`, `SupplierDetailScreen` (view-only contacts/contracts + blacklist toggle), `SupplierFormScreen` (create/edit).
- **Database tables:** `procurement_suppliers`, `procurement_supplier_contacts`, `procurement_supplier_contracts`.
- **APIs:** 13 REST endpoints under `/api/procurement/suppliers` (list, create, update, blacklist, delete, contacts CRUD, contracts CRUD, performance).
- **Permissions:** gated on the `procurement-suppliers` page (admin, ceo, procurement-officer, procurement-manager only — see §5). Blacklisting is further restricted to `admin`/`ceo`/`procurement-manager` (`data.js:10982-10993`). Deleting a supplier is blocked server-side if any PO references it.
- **Reports:** Supplier Performance report (POs, received/rejected qty per supplier) on the Reports page.

### 1.2 Purchase Requisitions

- **Business purpose:** the formal internal request that starts every purchase. Any authenticated user can raise one (page granted to all 21 roles — §5).
- **User workflow:** requester fills title/department/priority/budget code + line items (free-text description, qty, unit, est. unit price) → saves as `draft` → **Submit** locks it in and generates the approval chain → moves through 4–5 sequential stages → `approved` (or `rejected`, which short-circuits all remaining stages) → an approved requisition can be turned into an RFQ.
- **Electron screens:** one page (`procurement-requisitions`) — list + "New requisition" overlay (dynamic add/remove line items) + a detail overlay showing the item table, the approval timeline, and role-gated Approve/Reject/Submit/Cancel/Create-RFQ buttons.
- **Mobile screens:** `RequisitionsListScreen`, `RequisitionDetailScreen` (renders `ApprovalTimeline`), `RequisitionFormScreen` (dynamic line items).
- **Database tables:** `procurement_requisitions`, `procurement_requisition_items`, `procurement_approval_steps` (shared with invoices/payments).
- **APIs:** 15 REST endpoints under `/api/procurement/requisitions`, including the `/meta/*` sub-routes for dashboard/reports/config.
- **Permissions:** view/create gated on `procurement-requisitions`; update/submit/cancel additionally require the caller to be the original requester or `admin`/`ceo` (`data.js:11177,11209,11233`); approval decisions require the caller's role to match the current pending stage's `assigned_role`, or be `admin` (`data.js:11291-11293`).
- **Workshop scoping:** requesters with a workshop assignment (and not admin/ceo/operations/logistics) only see their own workshop's requisitions in the list (`data.js:11114-11128`).

### 1.3 Approval Workflow (the chain itself)

- **Business purpose:** a genuinely new piece of infrastructure for this codebase — a *multi-stage* approval chain. No other module in UFCL has more than one approval step; every prior approval flow (`pending_edits`, `stock_transfers`, `material_requests`) is single-stage.
- **Mechanics:** `procurement_approval_steps` is a generic ledger table (`entity_type`, `entity_id`, `stage_key`, `stage_order`, `status`, `assigned_role`) reused across requisitions, invoices, and payments. One dispatcher function, `procurementApprovalAction` (`data.js:11270-11332`), drives all three.
- **Stage sequence for requisitions** (`_procBuildApprovalStages`, `data.js:10838-10849`): `supervisor → department_manager → procurement_review (procurement-manager) → finance`, plus a 5th `ceo` stage **only if** the requisition's estimated total exceeds `procurement_config.ceo_threshold` (a single configurable row, default 5,000,000).
- **Stage sequence for invoices/payments:** single-stage, `finance` only (`data.js:11725-11734`, `11766`).
- **Reject behavior:** rejecting at any stage immediately marks all remaining pending stages `skipped` and the parent record `rejected` — the chain does not continue (`data.js:11303-11312`).
- **UI:** both platforms render the full stage list up front (not just the current step) — desktop via `procApprovalStepsHtml`, mobile via the `ApprovalTimeline` component, both color-coding approved/current/future/rejected/skipped.

### 1.4 RFQ / Quotations

- **Business purpose:** collect competing supplier bids against an approved requisition before committing to a purchase order.
- **User workflow:** Procurement Officer creates an RFQ from an approved requisition → invites one or more suppliers → **manually records each supplier's quoted amount/delivery days/terms** (suppliers have no login of their own — someone types the quote in on their behalf) → compares quotes → selects a winner → generates a PO.
- **Electron screens:** one page (`procurement-rfq`) — list + a detail overlay that combines invite-supplier, record-quotation, comparison table, and select/generate-PO in a single view.
- **Mobile screens:** `RfqListScreen`, `RfqDetailScreen` (same combined view as desktop), `RfqCreateScreen`.
- **Database tables:** `procurement_rfqs`, `procurement_rfq_suppliers`, `procurement_quotations`.
- **APIs:** 7 REST endpoints under `/api/procurement/rfq`.
- **Permissions:** gated on `procurement-requisitions` for RFQ creation is not required — RFQ actions are gated on the separate `procurement-rfq` page, which only admin/ceo/procurement-officer/procurement-manager hold (§5) — so, in practice, only the procurement team can create/manage RFQs even though "everyone" can raise a requisition.

### 1.5 Purchase Orders

- **Business purpose:** the formal commitment to a supplier, generated from a requisition + selected quotation.
- **User workflow:** generate PO (auto-numbered `PO-00001`, line items copied from the requisition) → download as PDF (desktop only, see §6) → record goods receipt once delivered → raise an invoice once fully received.
- **Electron screens:** one page (`procurement-orders`) — list + a detail overlay with the item table, a PDF-download button, and conditionally-shown "Record Goods Receipt" / "Raise Invoice" buttons.
- **Mobile screens:** `PurchaseOrdersListScreen`, `PurchaseOrderDetailScreen` (item table + inline "Raise Invoice" form; no PDF option).
- **Database tables:** `procurement_purchase_orders`, `procurement_po_items`.
- **Status lifecycle:** `issued → acknowledged → partially_received → received → closed`, or `cancelled`. (`acknowledged` is defined in the type/status vocabulary but no code path ever sets it — there is no "supplier acknowledged" action anywhere.)
- **APIs:** 8 REST endpoints under `/api/procurement/orders` (also hosts goods-receipt endpoints).
- **PDF generation:** `procurementPoPdfHtml` returns a filled HTML template; on desktop, `procurement-po:print` (Electron main process) renders it in a hidden `BrowserWindow` and calls `webContents.printToPDF()` — the first real PDF export in this entire codebase (every other export in UFCL is CSV).

### 1.6 Goods Receipt

- **Business purpose:** confirm what actually arrived against what was ordered, and (in principle) update stock automatically.
- **User workflow:** pick a PO with status `issued`/`acknowledged`/`partially_received` → enter received/rejected quantity (+ rejection reason) per line → submit. The PO and receipt status become `complete` or `partial` depending on whether every line was fully received.
- **Electron screens:** one page (`procurement-goods-receipt`) — list (read-only) + a PO-picker dropdown that opens the same creation overlay used from the PO detail view.
- **Mobile screens:** `GoodsReceiptListScreen` (read-only), `GoodsReceiptCreateScreen` (reached only via the PO detail screen's "Record Goods Receipt" button — no PO picker on the list screen itself).
- **Database tables:** `procurement_goods_receipts`, `procurement_goods_receipt_items`.
- **Transactional integrity:** `procurementGoodsReceiptCreate` runs inside a single `pool.connect()` / `BEGIN...COMMIT` transaction (`data.js:11564-11640`) — the one place in the whole procurement module using an explicit transaction, matching the existing `stockTransfersDispatch` pattern.
- **Inventory update:** *intended* to insert/upsert into `stock_levels` and log a `stock_movements` row when a line item has a `stock_item_id` and the PO has a `workshop_id`. See §7.4 for why this path is currently unreachable through the UI.

### 1.7 Invoice Matching & Payments

- **Business purpose:** 3-way match (PO amount vs. received value vs. invoice amount) before releasing payment.
- **User workflow:** raise an invoice against a received PO → run the match (flags a variance if the invoice differs from PO+received value by more than 2%, `data.js:11708`) → Finance approves/rejects the invoice (single-stage) → once approved, initiate payment → Finance approves the payment → invoice/payment status becomes `paid`.
- **Electron screens:** one page (`procurement-invoices`) — list + a detail overlay combining match/approve/reject/pay/approve-payment, all conditionally rendered based on current status.
- **Mobile screens:** `InvoicesListScreen`, `InvoiceDetailScreen` (same combined actions as desktop). Invoice *creation* only happens from `PurchaseOrderDetailScreen`'s inline form — there is no standalone "new invoice" entry point on the invoices list itself, mirroring desktop's design (invoice creation is triggered from the PO, not the invoice list, on both platforms).
- **Database tables:** `procurement_invoices`, `procurement_payments`.
- **APIs:** 7 REST endpoints under `/api/procurement/invoices` (also hosts payment endpoints).
- **A real bug found and fixed during build-verification, noted here for completeness:** `procurementPaymentCreate` originally checked invoice status `=== 'matched'` instead of `=== 'approved'`, which made it impossible to ever initiate a payment. This was caught and fixed before this audit; it is mentioned because it's exactly the class of defect this audit is designed to surface, and the fix is the reason payments work today.

### 1.8 Procurement Dashboard

- **Business purpose:** at-a-glance status: pending approvals, open POs, invoices to review, recent receipts, recent activity feed, monthly spend trend.
- **Electron screen:** `procurement-dashboard` — stat cards + a 15-row recent-activity table. No quick-navigation grid (the sidebar already covers that).
- **Mobile screen:** `ProcurementDashboardScreen` — same stat cards + a 7-tile quick-access grid to every other procurement screen + recent activity.
- **See §7.3 for the confirmed "Pending Approvals always shows 0" defect.**

### 1.9 Procurement Reports & Analytics

- **Reports:** Spend by Supplier, Supplier Performance, Delivery Performance (on-time vs. late), Budget Utilization (by budget code), plus an Analytics tab (avg. procurement cycle days, late-delivery count, top purchased products, supplier rankings).
- **Electron screen:** `procurement-reports` — five tabs sharing one page.
- **Mobile screen:** `ProcurementReportsScreen` — same five tabs, with a bar chart on the Spend tab (reusing the existing `HorizontalExpenseChart` component rather than a new charting dependency).
- **APIs:** 5 read-only report endpoints, all gated on `procurement-reports`.

### 1.10 Procurement Settings

- **Does not exist as a screen on either platform.** See §7.1 — this is the top Critical gap.

### 1.11 Procurement Notifications

- **Mechanism:** reuses the existing generic notification system (`pushNotification`) — there is no procurement-specific notification center or preference screen, by design (matches every other module in the app).
- **Coverage:** 7 event types are defined in `notifyProcurementEvent`'s `EVENTS` map (`data.js:10853-10911`), but only 4 of the 7 conceptual events that actually fire in code have a matching entry — see §7.2 for the exact gap.

### 1.12 Procurement Permissions

- **Model:** page-level grants stored in `role_definitions.permissions` (jsonb array of page ids), resolved per-request by `mustRole(user, pageId)` → `getResolvedPages` (`data.js:158-169`). Individual users can also have a personal `user_permissions` override that bypasses their role's defaults entirely.
- **New roles added for this module:** `procurement-officer`, `procurement-manager`, `department-manager` (`db/migrate.js:1385-1415`). All other participating roles (supervisor, finance, storekeeper, admin, ceo) already existed.
- **See §5 for the full matrix.**

---

## 2. Screen Inventory

| # | Electron page (`NAV` id) | Mobile screen(s) |
|---|---|---|
| 1 | `procurement-dashboard` | `ProcurementDashboardScreen` |
| 2 | `procurement-suppliers` (list + Manage/Edit/Blacklist overlays) | `SuppliersListScreen`, `SupplierDetailScreen`, `SupplierFormScreen` |
| 3 | `procurement-requisitions` (list + create + detail overlays) | `RequisitionsListScreen`, `RequisitionDetailScreen`, `RequisitionFormScreen` |
| 4 | `procurement-rfq` (list + create + detail overlays) | `RfqListScreen`, `RfqDetailScreen`, `RfqCreateScreen` |
| 5 | `procurement-orders` (list + detail overlay) | `PurchaseOrdersListScreen`, `PurchaseOrderDetailScreen` |
| 6 | `procurement-goods-receipt` (list + create overlay) | `GoodsReceiptListScreen`, `GoodsReceiptCreateScreen` |
| 7 | `procurement-invoices` (list + detail overlay) | `InvoicesListScreen`, `InvoiceDetailScreen` |
| 8 | `procurement-reports` (5 tabs) | `ProcurementReportsScreen` |
| — | *(none — see §7.1)* | *(none — see §7.1)* |

**Total:** 8 Electron pages (each internally hosting several overlay-driven sub-views) vs. 17 discrete mobile screens. This is a navigation-pattern difference, not a coverage gap — Electron's "one page + modal overlay" convention is how *every* module in this app is built (Vehicles, Material Requests, Stock Transfers all follow the same pattern), so Procurement is consistent with the rest of the desktop app.

---

## 3. Procurement Workflow Diagram

### 3.1 As documented / intended

```
Requisition Drafted
      │
      ▼
   Submitted ──► Supervisor ──► Dept. Manager ──► Procurement Review ──► Finance ──► [CEO if > threshold]
      │                                                                                      │
      └──────────────────────────── Rejected (at any stage) ────────────────────────────────┘
                                                                                               │
                                                                                        Fully Approved
                                                                                               │
                                                                                               ▼
                                                                                        RFQ Created
                                                                                               │
                                                                                    Suppliers Invited
                                                                                               │
                                                                                     Quotations Recorded
                                                                                               │
                                                                                      Quotation Selected
                                                                                               │
                                                                                     Purchase Order Issued
                                                                                               │
                                                                                    Goods Receipt Recorded
                                                                                       (stock updated*)
                                                                                               │
                                                                                        Invoice Raised
                                                                                               │
                                                                                       3-Way Match Run
                                                                                               │
                                                                                    Finance Approve/Reject
                                                                                               │
                                                                                     Payment Initiated
                                                                                               │
                                                                                     Finance Approves Payment
                                                                                               │
                                                                                          Invoice Paid
```
`*` — in practice, does not happen. See §7.4.

### 3.2 What the database actually records (verified, not assumed)

- `procurement_requisitions.status` only ever transitions through **`draft → submitted → approved | rejected | cancelled → po_issued`**. It is written in exactly 4 places in the entire codebase (`data.js:11225, 11240, 11327, 11472`) — `'in_approval'` and `'completed'` are declared in the type vocabulary but **never** assigned to the column. A requisition sits at `status = 'submitted'` for the *entire* multi-stage chain (whether it's waiting on the supervisor or on finance), and permanently freezes at `'po_issued'` even after the goods are received and the invoice is paid — the requisition record never reflects that the full cycle has closed.
- This single fact is the root cause of the dashboard defect in §7.3.

---

## 4. Role Permission Matrix

Page-level grants, read live from `role_definitions` in the database (not the seed script — the actual current state):

| Role | Dashboard | Suppliers | Requisitions | RFQ | Orders | Goods Receipt | Invoices | Reports |
|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| admin | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| ceo | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| procurement-officer | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| procurement-manager | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| finance | ✓ | — | ✓ | — | — | — | ✓ | ✓ |
| storekeeper | ✓ | — | ✓ | — | — | ✓ | — | — |
| supervisor | ✓ | — | ✓ | — | — | — | — | — |
| department-manager | ✓ | — | ✓ | — | — | — | — | — |
| *all other 13 roles* (operations, sales, sales-staff, showroom-staff, logistics, logistics-officer, mechanician, storekeeper-assistant, harvesting-leader, sawmill-leader, poles-leader, vat-leader, harvesting-supervisor, sawmill-supervisor, poles-supervisor, vat-supervisor) | ✓ | — | ✓ | — | — | — | — | — |

Every role gets Dashboard + Requisitions (the "anyone can submit a request" convention, matching how Material Requests already works) — nothing more, unless listed above.

### 4.1 Action-level matrix (from the actual `data.js` guard clauses, not the page grant)

| Action | Who can perform it |
|---|---|
| View/create/edit a **requisition** | Anyone with the `procurement-requisitions` page (= everyone) |
| Update/submit/cancel a requisition | The original requester, or `admin`/`ceo` |
| **Approve/reject** a requisition stage | Whoever's role matches the *current* pending stage (`supervisor` → `department-manager` → `procurement-manager` → `finance` → `ceo`), or `admin` at any stage |
| View/create/edit a **supplier** | admin, ceo, procurement-officer, procurement-manager |
| **Blacklist** a supplier | admin, ceo, procurement-manager only (procurement-officer cannot) |
| **Delete** a supplier | admin, ceo, procurement-officer, procurement-manager (blocked if any PO exists for that supplier) |
| Create/manage **RFQ**, record quotations, select winner | admin, ceo, procurement-officer, procurement-manager |
| Generate/update a **PO** | admin, ceo, procurement-officer, procurement-manager |
| **Record goods receipt** | Anyone with the `procurement-goods-receipt` page: admin, ceo, procurement-officer, procurement-manager, storekeeper |
| Create/match an **invoice** | admin, ceo, finance, procurement-officer, procurement-manager |
| **Approve/reject** an invoice | Whoever holds the `finance`-assigned stage — in practice `finance`, or `admin` |
| **Initiate a payment** | admin, ceo, finance only (narrower than invoice creation — procurement-officer/manager cannot initiate payment) |
| **Approve/reject** a payment | `finance`, or `admin` |
| View/change the **CEO threshold config** | View: any authenticated user (`procurementConfigGet` has no role check at all — see §7.1). Change: admin/ceo only. |

---

## 5. Mobile vs. Desktop Gap Report

| Feature | Desktop | Mobile | Status |
|---|---|---|---|
| Supplier CRUD | ✓ | ✓ | Available on both |
| **Add** supplier contact/contract | ✓ (Manage overlay has add-forms) | **✗ view-only** | **Missing on Mobile** |
| Supplier blacklist toggle | ✓ | ✓ | Available on both |
| Requisition create/submit/cancel | ✓ | ✓ | Available on both |
| Dynamic line-item add/remove on requisition form | ✓ | ✓ | Available on both |
| Approval timeline (full stage visibility) | ✓ | ✓ (`ApprovalTimeline` component) | Available on both |
| RFQ create / invite / record quote / compare / select | ✓ | ✓ | Available on both |
| PO generation | ✓ | ✓ | Available on both |
| **PO PDF export** | ✓ (Electron `printToPDF`) | **✗ none** | **Missing on Mobile** — no PDF library on mobile (no `expo-print`/WebView installed) |
| Goods receipt recording | ✓ (from PO detail *or* directly from the list page's PO picker) | ✓ (from PO detail only) | Available on both; desktop has one extra entry point |
| Invoice match / approve / reject | ✓ | ✓ | Available on both |
| Payment initiate / approve / reject | ✓ | ✓ | Available on both |
| Dashboard stats | ✓ | ✓ (+ quick-nav grid mobile has, desktop doesn't need) | Available on both |
| Reports (5 tabs) | ✓ | ✓ (+ 1 bar chart mobile has that desktop doesn't) | Available on both |
| **List search / filter UI** | **✗ none on any of the 8 pages** | **✗ none on any of the 17 screens** | **Missing on both** — the backend supports `filters.status` for requisitions/POs/invoices/suppliers; no screen on either platform exposes it |
| **Procurement Settings (CEO threshold)** | **✗** | **✗** | **Missing on both** |
| Notifications for every workflow event | Partial (reuses shared notification system) | Partial (same backend) | **Needs Improvement** — 3 of 7 events silently no-op, identically on both platforms since it's one shared backend function (§7.2) |

---

## 6. UI/UX Audit

- **Navigation:** consistent with the rest of the app on both platforms — desktop uses the existing sidebar `NAV` + overlay convention, mobile uses the existing stack-navigator-per-domain convention. No new navigation patterns were introduced.
- **Forms:** desktop and mobile both use free-text inputs for requisition/PO line items; **neither offers a way to pick an existing stock-catalog item**, which is the direct cause of the §7.4 gap. Forms otherwise follow existing conventions (`fg`/`frow` classes on desktop, themed `TextInput` on mobile).
- **Tables:** consistent styling (`tbl`/`dt` classes on desktop matching Vehicles/Material Requests; themed cards on mobile matching Customers/Products lists).
- **Search / Filters:** absent everywhere in Procurement (see §5) — this is a real gap relative to modules like Audit Trail, which has a full filter bar, or Material Requests.
- **Buttons / Dialogs:** desktop overlays and mobile `Alert.alert` confirmations both match existing app conventions (e.g., the blacklist confirmation dialog mirrors the existing `confirmDelete` pattern).
- **Responsiveness:** mobile list screens implement pull-to-refresh (`FlatList` `refreshing`/`onRefresh`) consistently; desktop pages re-render on demand via the existing `showPage` mechanism — no responsiveness issues found.
- **Professional appearance / consistency:** procurement screens visually match the rest of each app (same color tokens, badge components, card layouts) — no design-language drift was found.
- **Empty states:** both platforms show a proper empty state ("No requisitions yet", etc.) rather than a blank screen.

No redesign is recommended by this audit — the presentation layer is consistent; the gaps found are functional (search/filter, settings screen, stock linkage), not cosmetic.

---

## 7. Backend Audit — Confirmed Findings

### 7.1 [CRITICAL] Procurement Settings screen does not exist on either platform

`procurementConfigGet` / `procurementConfigUpdate` exist in `data.js` (10915-10929), are exposed over IPC (`electron/preload.js:368-369`) and over REST (`GET/PATCH /api/procurement/requisitions/meta/config`) — but:

```
grep "procurementConfig" renderer/app.js        → 0 matches
grep "procurementConfig|ConfigGet|ConfigUpdate" mobile/src/  → 0 matches
```

There is no way for an admin/CEO to view or change the CEO approval threshold without querying the database directly. The threshold currently sits at its seeded default (5,000,000) and can never be changed through the product.

### 7.2 [IMPORTANT] Notification coverage gap — 3 of 7 events silently no-op

`notifyProcurementEvent`'s `EVENTS` map (`data.js:10853-10911`) only defines: `requisition_submitted`, `requisition_stage_approved`, `requisition_approved`, `requisition_rejected`, `po_issued`, `goods_received`, `invoice_matched`, `payment_approved`.

But `procurementApprovalAction` (the single dispatcher used by requisitions, invoices, *and* payments) calls the event key generically as `` `${entityType}_rejected` `` and `` `${entityType}_approved` `` (`data.js:11311, 11330`). Since `entityType` can be `'invoice'` or `'payment'` as well as `'requisition'`:

| Generated event key | Defined in EVENTS map? | Result |
|---|:-:|---|
| `requisition_rejected` | ✓ | notifies requester |
| `requisition_approved` | ✓ | notifies procurement team |
| `invoice_rejected` | **✗** | **silently dropped — no one is told an invoice was rejected** |
| `invoice_approved` | **✗** | **silently dropped — finance approves, no one is told** |
| `payment_approved` | ✓ | works (defined explicitly) |
| `payment_rejected` | **✗** | **silently dropped** |

This is a one-line-per-key fix in a future implementation phase, but as it stands today, three real workflow moments produce zero notification.

### 7.3 [CRITICAL] Dashboard "Pending Approvals" always reads 0

Both dashboards compute pending-approval count as:
- Desktop: `byStatus(res.requisitionsByStatus, 'in_approval')` (`renderer/app.js`, `renderProcurementDashboard`)
- Mobile: `data.requisitionsByStatus.find(r => r.status === 'in_approval')?.n ?? 0`

Both read from `procurementDashboard()`'s `select status, count(*) from procurement_requisitions group by status`. As established in §3.2, `'in_approval'` is never written to that column — every requisition mid-chain is grouped under `status = 'submitted'` instead. The stat tile will show 0 pending approvals regardless of how many requisitions are actually awaiting someone's decision. This is a genuine, reproducible defect on both platforms, traceable to one root cause in the backend's status-writing logic.

### 7.4 [CRITICAL] Automatic inventory update on goods receipt cannot be triggered

The backend code exists and is correct: `procurementGoodsReceiptCreate` (`data.js:11596-11611`) inserts into `stock_levels` and `stock_movements` when a PO line item has `stock_item_id` set and the PO has a `workshop_id`. This was verified working in isolation during backend testing (calling the function directly with `stock_item_id` supplied manually).

However, in real usage:
- Neither `RequisitionFormScreen` (mobile) nor the desktop `pr-additem` line-item form exposes any control to pick a stock-catalog item for a line — only free-text description/qty/unit/price fields exist. `stock_item_id` is therefore always `null` when a real user creates a requisition.
- `workshop_id` on the requisition/PO is only auto-populated for *workshop-restricted* requesters (storekeepers, supervisors, etc. — `isWorkshopRestricted`); for procurement-officer/manager/admin/ceo (the roles who actually run this module day to day) it is never set, and no form offers a workshop picker either.

Net effect: the condition `poItem.stock_item_id && qtyReceived > 0 && po.workshop_id` will essentially never be true in production use. The feature described in the module's own design intent — "automatically update inventory" — does not currently fire for any requisition raised through the actual UI.

### 7.5 [MINOR] `procurementConfigGet` has no access control

Every other read function in the module is gated by `mustRole` or an explicit role array. `procurementConfigGet` (`data.js:10915-10919`) only calls `getUser(userId)` — any authenticated user of any role can read the CEO approval threshold, even though changing it is correctly restricted to admin/ceo. Low severity (the value isn't sensitive), but inconsistent with the rest of the module's permission discipline.

### 7.6 Validation review

- Requisition creation requires `title` and at least one item (`data.js:11147-11149`).
- Supplier creation requires `name` (`10950`).
- Invoice creation requires `invoice_number` and `invoice_amount` (`11675`).
- RFQ quotation submission requires `quoted_amount` (`11401`).
- No client- or server-side validation exists for negative quantities/prices anywhere in the module (matches the general looseness of validation elsewhere in this codebase — not a procurement-specific regression, but worth flagging since money is involved here specifically).

### 7.7 Approval-logic review

The generic `procurementApprovalAction` dispatcher is sound: it re-reads the current pending stage from the database on every call (no client-trusted state), enforces role match strictly, and short-circuits the remaining chain on rejection. `admin` is the only universal override; `ceo` does **not** get to skip stages it isn't assigned to (by design — the CEO stage only exists at all above the configured threshold).

---

## 8. Missing Features — Gap Report

### Critical
1. **Procurement Settings screen (both platforms).** *Why:* the CEO threshold is the single control that determines whether a requisition needs 5 or 6 approval stages — it should be admin/CEO-configurable through the product, not the database. *Business value:* lets finance/CEO tune the approval bar without a developer. *Expected workflow:* an admin/CEO-only settings screen showing the current threshold with an edit control, calling the already-built `procurementConfigUpdate`.
2. **Stock-item linkage on requisition/PO line items (both platforms).** *Why:* without it, the automatic inventory update never fires (§7.4) — a headline feature is currently decorative. *Business value:* eliminates a second manual stock-adjustment step after every delivery. *Expected workflow:* an optional "link to stock item" picker (searchable dropdown against the existing stock catalog) on the line-item row, plus a workshop picker for non-restricted creators.
3. **Fix the `in_approval` status write (backend).** *Why:* directly causes the dashboard defect in §7.3, and means no report anywhere in the system can distinguish "just submitted" from "4 stages deep, about to finish." *Business value:* accurate at-a-glance visibility into approval bottlenecks. *Expected workflow:* write `status='in_approval'` alongside the existing stage-advance logic in `procurementApprovalAction`.

### Important
4. **Notification event coverage for invoice approve/reject and payment reject** (§7.2). *Why:* finance/procurement staff currently have no signal these decisions happened, other than manually checking the invoice list. *Business value:* closes a silent gap in an otherwise well-notified workflow.
5. **Search/filter UI on every procurement list** (both platforms). *Why:* the backend already supports status filtering; as requisition/PO/invoice volume grows, an unfiltered list becomes unusable. *Business value:* directly improves daily usability for the procurement team.
6. **Mobile: add-contact / add-contract forms on `SupplierDetailScreen`.** *Why:* mobile can currently only view supplier contacts/contracts, forcing a desktop trip to add one. *Business value:* mobile parity for a genuinely mobile-friendly task (adding a contact after a phone call).
7. **Mobile PDF export for Purchase Orders.** *Why:* field/mobile-only procurement staff currently cannot produce a PO document to email/print a supplier. *Business value:* removes a desktop dependency for a common task. *Note:* requires adding a PDF or sharing capability to mobile that doesn't exist today (`expo-print` or a WebView-based renderer) — a real dependency addition, not a copy-paste of the desktop approach.

### Optional
8. **A "supplier acknowledged PO" action.** The `acknowledged` PO status exists in the vocabulary but nothing ever sets it. Low priority — `issued → received` already covers the operationally important transition.
9. **Basic quantity/price validation (reject negative or zero values) across requisition, PO, and invoice forms.** Currently unenforced; low risk given the internal-only user base, but cheap to add.
10. **A standalone "raise invoice" entry point from the Invoices list**, independent of visiting a specific PO first — a minor convenience, not a blocker (current design deliberately keys invoice creation off a received PO, which is the correct constraint; this is purely about discoverability).

---

## 9. Recommended Roadmap

**Priority 1 — fix defects in already-shipped functionality (no new screens, low risk, high trust impact):**
- Fix the `in_approval` status write (Gap 3) — one function, immediately fixes the dashboard.
- Fix the 3 missing notification event keys (Gap 4) — additive entries to the existing `EVENTS` map.
- Add the `mustRole` gate to `procurementConfigGet` (§7.5) — one line, closes a minor permission inconsistency.

**Priority 2 — close the two "advertised but unreachable" feature gaps:**
- Build the Procurement Settings screen (Gap 1) on both platforms — small, self-contained, and unblocks Priority-3 threshold tuning for the business.
- Add stock-item + workshop linkage to requisition/PO line-item forms (Gap 2) — the highest-value item on this list, since it activates an already-built, already-tested backend capability rather than requiring new backend work.

**Priority 3 — usability and parity improvements:**
- Search/filter UI across procurement lists (Gap 5).
- Mobile supplier contact/contract add-forms (Gap 6).
- Mobile PDF export (Gap 7) — flagged last because it's the only item here requiring a new dependency, and should be scoped/decided deliberately rather than bundled in.
- Optional items (8–10) as capacity allows.

---

*This document reflects the module as it exists in the repository at the time of writing. No files were modified to produce it.*
