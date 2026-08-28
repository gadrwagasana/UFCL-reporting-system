# Procurement Module — Phase 2A UI/UX Modernization Report

**Scope discipline maintained throughout:** no database schema changes, no new REST/IPC endpoints, no changes to `db/services/data.js` business logic, no workflow changes. Every improvement below is UI, navigation, or the presentation layer only. The two exceptions that touch data flow — the mobile "Approve/Reject Payment" buttons and the new Goods Receipt detail screen — call **pre-existing** backend functions (`procurementPaymentApprove` / `decidePayment`, `procurementGoodsReceiptDetail`) that already had full backend/API/IPC support but no UI trigger anywhere; wiring them up is a UI addition, not new business logic. Confirmed via `git status` at the end of this phase: the only files touched are `renderer/app.js`, `renderer/styles.css`, and files under `mobile/src/{screens,components,stores,navigation}` — `data.js`, `migrate.js`, the route files, and the IPC layer are untouched by this phase.

This report follows `PROCUREMENT_PHASE1_REVIEW.md` §9 (the UI/CSS Improvement Plan) as source of truth for what to build and why.

---

## 1. Screens Improved

### Electron desktop — all 8 pages
| Page | Changes |
|---|---|
| Procurement Dashboard | Sticky page header, new `.kpi-card` component (replacing plain `.mc`), skeleton loading on first load |
| Suppliers | Sticky header + toolbar, search + status filter, sortable columns, skeleton loading, standardized row actions |
| Purchase Requisitions | Sticky header + toolbar, search + status filter, sortable columns, skeleton loading, dynamic line-item form polish (required-field validation message, section header) |
| RFQ / Quotations | Sticky header + toolbar, search + status filter, sortable columns, skeleton loading, section headers on the detail overlay (Invited Suppliers / Record Quotation / Quotation Comparison) |
| Purchase Orders | Sticky header, search + status filter, sortable columns, skeleton loading |
| Goods Receipt | Sticky header + toolbar, search + status filter, sortable columns, skeleton loading, **new "View" action + detail overlay** (previously the list was read-only with no way to open a past receipt) |
| Invoices & Payments | Sticky header, search + status filter, sortable columns, skeleton loading, richer match-result feedback (was a blocking `alert()`) |
| Reports | Sticky header, tab bar converted from ad-hoc inline-styled buttons to the shared `.filter-chip` component, skeleton loading per tab, KPI cards + section headers on the Analytics tab |

### React Native mobile — 18 screens (17 existing + 1 new)
| Screen | Changes |
|---|---|
| `ProcurementDashboardScreen`, `ReportsScreen` | No change this phase (already used cards/skeleton-free patterns consistent with the rest of the app; not on the priority list) |
| `RequisitionsListScreen`, `SuppliersListScreen`, `PurchaseOrdersListScreen`, `InvoicesListScreen` | **New**: search bar (`ListSearchBar`), initial-load skeleton (`SearchSkeleton`, reused not duplicated), icon-aware status badges, better empty-state copy when a search yields nothing |
| `RequisitionFormScreen` | Navigates to the new record's detail screen on create (previously silent `goBack()`), success toast, inline validation error surfaced instead of a late failure |
| `RequisitionDetailScreen`, `RfqDetailScreen`, `PurchaseOrderDetailScreen`, `InvoiceDetailScreen` | Icon-aware status badges throughout |
| `RfqCreateScreen` | Success toast added (navigation to detail already existed) |
| `GoodsReceiptCreateScreen` | Now navigates to the new receipt's detail screen (previously silent `goBack()`), success toast |
| `GoodsReceiptListScreen` | Row press now navigates to detail (previously a no-op — rows were inert) |
| **`GoodsReceiptDetailScreen`** | **New screen.** No detail view existed for a goods receipt on mobile before this phase; built purely on top of the already-existing `procurementGoodsReceiptDetail` backend function and its already-existing `useProcurementGoodsReceiptDetail` hook |
| `InvoiceDetailScreen` | Success/error toasts on match/approve/reject/pay, richer match-result feedback, **new Approve/Reject Payment section** — desktop already had this action; mobile silently lacked it (see §4) |
| `SupplierFormScreen` | Success toast added |

---

## 2. Components Standardized

- **`StatusBadge` (mobile, shared app-wide)** — extended from 7 recognized statuses to the full procurement vocabulary (23 keys: `draft`, `submitted`, `in_approval`, `pending`, `approved`, `rejected`, `cancelled`, `po_issued`, `issued`, `acknowledged`, `partially_received`, `received`, `closed`, `pending_match`, `matched`, `disputed`, `paid`, `sent`, `invited`, `responded`, `declined`, `selected`, `partial`, `complete`, `skipped`). Previously all of these fell through to a generic gray "draft" badge with zero visual differentiation. Added an **opt-in** `withIcon` prop (default `false`) so every other module using this component (Deliveries, Sales Orders, etc.) renders exactly as before — only the 13 procurement call sites that explicitly pass `withIcon` get the new icon treatment.
- **`.badge` / `procStatusBadge()` (desktop, shared app-wide)** — replaced the old 4-branch regex-guess color mapping with an explicit 26-key lookup table (`PROC_STATUS_META`) giving every status a consistent color, icon, and human label. Added one new badge color, `.bn` (neutral gray), reusing a color pairing (`#F3F4F6`/`#374151`) already used ad-hoc elsewhere in `styles.css` rather than inventing a new hue.
- **`Toast` / `useToastStore` (mobile, new, shared app-wide)** — Phase 1 found zero success-feedback mechanism anywhere on mobile, in any module. Built as a Zustand store (matching the existing `authStore`/`offlineStore` pattern) + one component mounted once at the app root (`App.tsx`), so `showToast()` is now callable from any screen in the app, not just Procurement.
- **`showToast()` (desktop, new, shared app-wide)** — same rationale, implemented as a small DOM-based toast host appended to `document.body`, replacing every `alert()` call in the procurement module (7 removed) and available to every other module going forward.
- **`ListSearchBar` (mobile, new, shared)** — one component reused across the 4 highest-traffic procurement lists rather than 4 slightly-different inline search inputs.
- **`.filter-bar` / `procFilterBarHtml()` / `applyProcListFilters()` / `wireSortableTable()` (desktop, new, shared)** — one filter/search implementation and one sort implementation reused identically across 6 pages, instead of writing filtering logic 6 times.
- **`.tbl` (desktop, shared app-wide, bug fix)** — this class was used in 17 places across the codebase (Procurement plus pre-existing pages like Vehicles and Material Requests) with **zero CSS rules behind it** — confirmed by grep before this phase. Every table using it rendered with only whatever inline styles individual cells happened to have, no consistent chrome at all. Now fully styled: sticky header, zebra rows, hover state, sortable-column affordance, consistent padding — benefiting every module that already used this class, not just Procurement.
- **`SearchSkeleton` (mobile, reused, not duplicated)** — already existed for Global Search only; reused as-is for procurement list skeletons rather than building a second skeleton component.

---

## 3. CSS Improvements

New shared classes added to `renderer/styles.css` (one clearly-delimited section, `ENTERPRISE TABLE + LAYOUT SYSTEM`):
- `.page-head` — sticky page header (title/subtitle/primary action), pinned under the topbar while content scrolls. Previously every page's header (`.ptitle`/`.psub`) was a plain block that scrolled away — confirmed absent via grep in Phase 1.
- `.toolbar` — consistent action-button grouping, replacing ad-hoc `display:flex` rows.
- `.filter-bar`, `.filter-search`, `.filter-select`, `.filter-chip`, `.filter-clear` — the search/filter system described in §2.
- `.kpi-card` (+ `.kpi-amber`/`.kpi-red`/`.kpi-blue`/`.kpi-green` accent variants) — richer dashboard stat cards with a top accent bar and hover elevation, used on the Dashboard and Analytics report tab.
- `.section-hdr` — a consistent divider+icon+label treatment for sub-sections within a page or overlay, replacing six different one-off inline `style="font-weight:600;..."` headers found and standardized in this phase.
- `table.tbl` — see §2.
- `.skel-row`, `.skel-table` — shimmer loading placeholders (CSS `@keyframes`, no new dependency), used for first-load skeletons on all 8 procurement pages.
- `.toast-host`, `.toast` (+ `.toast-success`/`.toast-error`) — the desktop toast system.
- One `@media(max-width:960px)` block — stacks the filter bar and page header vertically on narrow viewports.

All of the above use only the **existing** token set (`--g-soft`, `--t1`–`--t4`, `--r-sm`–`--r-xl`, `--sh`/`--sh-md`, `--amber`/`--red`/`--blue`/`--green` families) — no new color palette was introduced, per the "reuse the design system" instruction.

---

## 4. Navigation Improvements

**Electron/Mobile parity — "after creating X, open X, don't return to the list":**

| Action | Before | After |
|---|---|---|
| Create Requisition | Desktop: list. Mobile: list (`goBack()`). | **Both** open the new requisition's detail view. |
| Create RFQ | Desktop: list. Mobile: detail (already correct). | **Both** open the new RFQ's detail view. |
| Generate PO | Desktop: list. Mobile: detail (already correct). | **Both** open the new PO's detail view. |
| Record Goods Receipt | Desktop: list. Mobile: `goBack()` — **no detail view existed on either platform.** | **Both** open the new receipt's detail view (new screen on mobile, new overlay on desktop — see §1). |
| Raise Invoice | Desktop: list. Mobile: detail (already correct). | **Both** open the new invoice's detail view. |

This was the single most direct requirement in this phase's instructions ("Electron and Mobile must behave identically... Navigate directly to the newly created record") and is now true for all five entity-creation flows, verified by reading both platforms' code path for each, not assumed.

**A second, previously-undetected parity gap, found and fixed in this phase:** desktop's invoice overlay has always had Approve/Reject Payment buttons (for a payment sitting at `status='pending'`); mobile's `InvoiceDetailScreen` never exposed this action at all, even though the underlying `decidePayment` function existed in the mobile hook layer, unused. Fixed by adding the missing UI section to mobile — no new backend/hook code required.

---

## 5. Shared Design Fixes

Three undefined CSS custom properties were found and fixed, all with the same one-line alias approach (safer than rewriting every call site):

```css
--bdr: var(--border);     /* 86 usages across styles.css/app.js — flagged in Phase 1 */
--hover: var(--surf);     /* 1 usage — found during this phase, same class of bug */
--green: var(--g-mid);    /* 65 usages across app.js — found during this phase, same class of bug */
```

Phase 1 flagged only `--bdr`. While fixing it, this phase found two more custom properties with the identical defect (referenced repeatedly, never defined anywhere) — `--hover` and `--green`. All three are now aliased to their nearest existing token rather than introducing new values, fixing every module that already used them (not just Procurement) with zero risk of visual regression.

Also fixed: `.tbl` having no CSS at all (§2) — the largest-impact shared fix in this phase, since it silently affected every pre-existing screen using that class name, not only the ones built for Procurement.

---

## 6. Remaining UI Work (deliberately out of scope for this phase)

Per the explicit "Out of Scope" instruction, none of the following were touched — listed here only so they aren't mistaken for oversights:

- Procurement Settings screen, approval-threshold UI — Phase 1 Gap #1, Priority 2.
- Notification event-map fixes (`invoice_approved`/`invoice_rejected`/`payment_rejected` silently dropped) — Phase 1 §7.2, Priority 1.
- The `in_approval` status not being persisted (dashboard "Pending Approvals" always reads 0) — Phase 1 §7.3, Priority 1. The dashboard KPI card visual was modernized in this phase; the number it displays was **not** touched, since fixing it requires a `data.js` change.
- Stock-item/workshop linkage on requisition/PO line items (inventory auto-update currently unreachable) — Phase 1 §7.4/Gap #2, Priority 2 — this is a new-field/new-picker addition, not a pure UI restyle, and was excluded per "no new procurement features."
- Sortable columns, filter bars, and skeleton loading were applied to the 6 highest-traffic desktop pages (all except Dashboard and Reports, which don't have a filterable list) and the 4 highest-traffic mobile screens, matching Phase 1's own roadmap sequencing ("sequenced by page traffic") rather than every screen uniformly — RFQ detail's nested tables (Invited Suppliers, Quotation Comparison) and the Supplier "Manage" overlay's contact/contract tables were left as simple `.dt` tables (already benefiting from the existing table styling) since they're short, bounded lists where sort/filter add no real value.
- Keyboard navigation (Electron) and screen-reader labels (mobile) were addressed narrowly (e.g. `accessibilityLabel` on the new `ListSearchBar`) rather than as a full accessibility audit — a full pass across all 8+18 screens is a larger, separate effort not attempted here.
- Full WCAG contrast audit of every color combination — not re-verified pixel-by-pixel in this pass; the existing token set was already designed with contrast in mind (per the prior Global Search badge-contrast fix), and no new colors were introduced, but a systematic re-check was not performed.

---

*No code outside `renderer/app.js`, `renderer/styles.css`, and `mobile/src/{screens,components,stores,navigation}` was modified in this phase. `db/services/data.js`, `db/migrate.js`, `mobile-api/routes/*`, and `electron/{main,preload}.js` are untouched.*
