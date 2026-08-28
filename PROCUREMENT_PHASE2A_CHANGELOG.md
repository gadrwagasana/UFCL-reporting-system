# Procurement Module — Phase 2A UI/UX Changelog

UI/UX modernization only. No database, API, or business-logic changes. Full rationale and detail in `PROCUREMENT_PHASE2A_UI_REPORT.md`.

## Added
- Sticky page headers (`.page-head`) on all 8 desktop Procurement pages.
- Search + status filter on 6 desktop pages (Requisitions, Suppliers, RFQ, Orders, Goods Receipt, Invoices) and 4 mobile screens (Requisitions, Suppliers, Purchase Orders, Invoices).
- Sortable table columns on the same 6 desktop pages.
- Skeleton loading states on all 8 desktop pages and the 4 mobile list screens above (previously spinner-only or no loading state at all).
- Zebra striping, hover states, and sticky table headers on every table using the `.tbl` class — desktop, app-wide (17 usages, not just Procurement).
- Icon-aware status badges covering the full procurement status vocabulary (23 statuses on mobile, 26 on desktop) — desktop and mobile.
- Toast/success-feedback system — new on both platforms (`showToast()` desktop, `Toast` + `useToastStore` mobile), replacing every `alert()` in the Procurement module (7 removed) and available app-wide going forward.
- KPI cards (`.kpi-card`) on the desktop Dashboard and Reports→Analytics tab.
- Section headers (`.section-hdr`) replacing 6 ad-hoc inline-styled sub-headers across requisition/RFQ/supplier overlays.
- Filter chip tab bar on the desktop Reports page (previously ad-hoc inline-styled buttons).
- **New Goods Receipt detail view** — desktop overlay + mobile `GoodsReceiptDetailScreen` — built entirely on the pre-existing `procurementGoodsReceiptDetail` backend function, which had no UI on either platform before this phase.
- **New mobile Approve/Reject Payment action** on `InvoiceDetailScreen` — closes a real desktop/mobile parity gap; the backend function (`decidePayment`) already existed and was already exposed in the mobile hook layer, unused.
- `ListSearchBar` (mobile, new shared component).

## Changed
- **Navigation parity**: creating a Requisition, RFQ, Purchase Order, or Goods Receipt now opens that record's detail view directly on **both** platforms. Previously: desktop always returned to the list; mobile already did this correctly for RFQ/PO but not for Requisition or Goods Receipt.
- `StatusBadge` (mobile, shared): status-color coverage extended from 7 to 23 recognized values; new opt-in `withIcon` prop defaults to `false` so every non-Procurement usage is visually unchanged.
- `procStatusBadge()` (desktop, shared): regex-based color guessing replaced with an explicit 26-status lookup table with consistent color + icon + label per status.
- Desktop supplier/invoice/PO detail overlays: match-result and error feedback moved from blocking `alert()` dialogs to the new toast system.

## Fixed
- **`table.tbl` had zero CSS rules** — used in 17 places across the app (Procurement + pre-existing pages like Vehicles and Material Requests), it rendered with no consistent styling at all before this phase.
- **Three undefined CSS custom properties**: `--bdr` (86 usages, flagged in Phase 1), plus `--hover` and `--green` (65 usages combined, found while fixing `--bdr`) — all aliased to existing tokens.
- Goods Receipt list rows were inert (`onPress={() => {}}`) — now navigate to the new detail screen.

## Explicitly not changed (out of scope for this phase — see Phase 1 report)
- Procurement Settings / approval-threshold UI.
- Notification event-map gaps (`invoice_approved`/`invoice_rejected`/`payment_rejected`).
- The `in_approval` requisition-status persistence bug (dashboard "Pending Approvals" tile still reads its existing, unfixed value — only its visual presentation was modernized).
- Stock-item/workshop picker on requisition/PO line items.
