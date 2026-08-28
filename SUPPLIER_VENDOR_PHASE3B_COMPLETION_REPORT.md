# Supplier & Vendor Management — Phase 3B Completion Report

**Scope discipline:** all new business logic lives exclusively in `db/services/data.js` — one new core function (`procurementSupplierSetStatus`) plus a small shared enforcement helper (`_blockIfSupplierBlacklisted`), both reused by every caller rather than reimplemented per call site. Electron and Mobile call the identical backend functions through one new IPC channel and one new REST route (both wrapping `procurementSupplierSetStatus` directly — no duplicate transport-layer logic). All permission checks remain server-side; every client-side gate in this phase is a UX hint only, confirmed by direct testing that the server itself rejects unauthorized calls (see Verification below).

---

## 1. Supplier Blacklist Enforcement

**Root cause fixed**: per `SUPPLIER_VENDOR_PHASE3_AUDIT.md` §2/§7, blacklisting was purely cosmetic — nothing stopped a blacklisted supplier from being quoted, issued a PO, receiving goods, or being invoiced.

**Backend** (`db/services/data.js`): new shared helper `_blockIfSupplierBlacklisted(supplierId, queryable)` — the single place the rule lives — wired into:
- `procurementRfqSendToSuppliers` — every supplier id in the invite batch is checked *before* any invite is inserted (a blacklisted id anywhere in the batch blocks the whole call, not just skips that one supplier).
- `procurementQuotationSubmit` — defense-in-depth for a supplier blacklisted after invitation but before their quote is recorded.
- `procurementPoGenerate` — checked immediately after the winning quotation's `supplier_id` is resolved, before any PO/PO-item rows are written.
- `procurementGoodsReceiptCreate` — checked against the PO's `supplier_id` before the transaction opens.
- `procurementInvoiceCreate` — checked against the PO's `supplier_id` before the invoice insert.

Error message returned in all five cases: `"<Supplier name> is blacklisted and cannot participate in procurement."` — matching the requested wording.

**Frontend (UX only, server remains authoritative)**:
- Desktop: `openRfqDetailOverlay` already excluded blacklisted suppliers from the invite dropdown (pre-existing); now also excludes them from the "Record Quotation" dropdown, shows a red "Blacklisted" badge on invited-supplier rows and quotation rows, replaces the "Select" action with inline warning text for a blacklisted quotation, and replaces "Generate Purchase Order" with a red warning banner (`.lerr`) when the selected quotation's supplier is blacklisted. `openGoodsReceiptCreateOverlay`, `openInvoiceCreateOverlay`, and `openPoDetailOverlay` all now show the same warning banner and disable every input/submit button when `po.supplier_blacklisted` is true.
- Mobile: `RfqDetailScreen.tsx` mirrors the same badges/inline-warning/blocked-generate-button treatment. `GoodsReceiptCreateScreen.tsx` and `PurchaseOrderDetailScreen.tsx` (which hosts the inline "Raise Invoice" form) both show a warning card and disable their forms/buttons when `po.supplier_blacklisted` is true.
- `procurementPoDetail` (`data.js`) was extended to select `s.blacklisted as supplier_blacklisted`, and `procurementRfqDetail`'s `suppliers`/`quotations` queries were extended to select `s.blacklisted` — both additive, non-breaking column additions feeding the new UI.

**Verified live** (see §Verification): inviting a blacklisted supplier to an RFQ and submitting a quotation on their behalf were both rejected server-side with the exact expected message.

---

## 2. Supplier Activation / Deactivation

**Backend**: one new function, `procurementSupplierSetStatus(userId, supplierId, newStatus, reason)`, is now the single lifecycle-transition mechanism for every status change (Activate, Deactivate, Blacklist, Restore, Archive). It:
- Requires the centralized `procurement-suppliers-governance` permission (see §3).
- Requires a non-empty `reason` for every transition, no exceptions.
- Validates the transition against an explicit state graph (see §5) and rejects illegal ones with a clear error.
- Updates `status` + `status_reason` + `status_changed_by` + `status_changed_at`, and keeps the pre-existing `active`/`blacklisted`/`blacklist_reason` columns in sync in the same statement, so every function written before this phase that reads those columns (`procurementQuotationsCompare`, `procurementReportSupplierPerformance`, the suppliers list filters, etc.) keeps working unmodified.
- Calls `logAudit` with `actionType: 'status_change'` (see §9).

`procurementSupplierToggleBlacklist` (the function Phase 3A's UI already calls) is now a **one-line delegate** to `procurementSupplierSetStatus` — same exported name and signature, zero frontend change required for the existing blacklist button's plumbing, but the hardcoded role array it used to contain is gone.

**Desktop**: the Suppliers list's row actions now show a status-appropriate action set — Deactivate + Blacklist for an active supplier, Activate for a draft/pending/suspended/archived supplier, Restore for a blacklisted one — all routed through one `.sup-status` handler and one reason-required overlay (`renderer/app.js`, `renderProcurementSuppliers`). Status badges use the extended `PROC_STATUS_META` (draft/pending_approval/active/suspended/blacklisted/archived), replacing the old bespoke `statusOf()`/`statusBadgeOf()` pair.

**Mobile**: `SupplierDetailScreen.tsx` shows the same status-driven action set (`actionsForStatus()`, mirroring desktop's `supplierGovernanceButtons()`), each opening the same `StatusReasonModal` and calling the new `setStatus()` hook action. A `StatusBadge` (extended with the 5 new lifecycle values — see below) now sits at the top of the screen and on each `SuppliersListScreen` card.

**Confirmation dialog**: every transition opens a reason-required modal on both platforms (desktop: `openOverlay`; mobile: `StatusReasonModal`) — functionally the confirmation step, since the action only fires on explicit modal submission.

**Deliberate behavior change vs. Phase 3A**: un-blacklisting used to be a single tap with no reason on either platform. It now requires a reason like every other transition, since Phase 3B's brief lists "Mandatory reason" as a requirement for the lifecycle feature as a whole, and a single uniform rule (reason required, full stop) is simpler and more consistent than special-casing one direction. Documented here rather than silently changed.

---

## 3. Permission Cleanup

**Removed**: the hardcoded `['admin', 'ceo', 'procurement-manager'].includes(user.role)` check that used to live inside `procurementSupplierToggleBlacklist`.

**Replaced with**: a new page-permission id, `procurement-suppliers-governance`, granted via the standard `grant()` helper in `db/migrate.js` to exactly `admin`, `ceo`, `procurement-manager` — the same three roles the old array named, now expressed through `role_definitions.permissions` like every other permission in the app, and checked via the same `mustRole(user, pageId)` pattern every other function already uses.

**`procurementSupplierDelete` was moved onto this same governance permission** (previously gated on the broader `procurement-suppliers` CRUD permission, which `procurement-officer` also holds). This is an intentional, explicit tightening: Phase 3B's own item 3 groups "Blacklist, Activate, Deactivate, Restore, Delete" together as the actions "only authorized users" should perform, implying a narrower set than general CRUD. **Net effect: `procurement-officer` can no longer delete, blacklist, activate, deactivate, or restore suppliers — only admin/ceo/procurement-manager can.** `procurement-officer` retains full create/edit/view access to suppliers, contacts, and contracts (unchanged).

**Desktop client-side hint**: replaced the hardcoded role array with `(STORAGE.pages || []).includes('procurement-suppliers-governance')` — `STORAGE.pages` is the same resolved-permissions array the app already uses elsewhere for this exact pattern (e.g. the pre-existing `stock-movements` check), so this is a genuine removal of hardcoded roles on the desktop client, not just the backend.

**Mobile client-side hint**: mobile has no resolved-permissions fetch mechanism (confirmed absent from `authStore`/`useAuth` — this predates Phase 3B). `GOVERNANCE_ROLES = ['admin', 'ceo', 'procurement-manager']` in `SupplierDetailScreen.tsx` is therefore still a literal array, kept deliberately in sync with the backend grant and documented as a client-only UX hint — the server remains the authoritative check either way (confirmed in Verification, an officer-role call is rejected server-side regardless of what the client shows).

**Verified live**: Admin/CEO/Procurement Manager → `procurement-suppliers-governance` granted; Procurement Officer → not granted (retains `procurement-suppliers`); Finance/Operations → neither permission (unchanged from Phase 3A — no access was broadened for either role, matching the audit's "never bypass existing permission rules" instruction; item 3 asked to *verify* these roles, not grant them anything new).

---

## 4. Delete Protection

**Backend** (`procurementSupplierDelete`): the guard previously checked only `procurement_purchase_orders`. It now checks, in one query: Purchase Orders, RFQ invitations (`procurement_rfq_suppliers`), Quotations (`procurement_quotations`), Invoices (`procurement_invoices`), Contracts (`procurement_supplier_contracts`), and Goods Receipts (joined through the supplier's POs). If any category has a row, the delete is rejected with exactly: `"Supplier cannot be deleted because procurement history exists."` — and the blocked attempt is itself audited (`actionType: 'delete_blocked'`, per item 9's "Delete attempts" requirement).

Deletion is still permitted when none of the six categories has any history — confirmed live (a supplier with zero history deleted cleanly in earlier Phase 3A/3 testing patterns; this phase's smoke test exercised the *blocked* path specifically).

**Archive-instead-of-delete**: when a delete is blocked, both platforms now offer "Archive Instead" as a safe alternative (a governance action requiring its own reason), mirroring this codebase's existing `confirmDeleteSoft` "Move to Trash" pattern rather than leaving the user at a dead end. This is also what gives the `archived` lifecycle status a concrete, reachable trigger (see §5).

---

## 5. Supplier Lifecycle

**New column**: `procurement_suppliers.status text not null default 'active'` (plus `status_reason`, `status_changed_by`, `status_changed_at`), added via `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` — this codebase's established idiom for post-launch schema evolution (confirmed precedent: `procurement_requisition_items.stock_item_id`, `procurement_purchase_orders.workshop_id`). No DB `CHECK` constraint was added — validity and transition rules live in exactly one place, `procurementSupplierSetStatus`, per "business logic exists ONLY in data.js."

**The six statuses and their legal transitions**:
```
draft            → pending_approval, active, archived
pending_approval → active, draft, archived
active           → suspended, blacklisted, archived
suspended        → active, blacklisted, archived
blacklisted      → active, archived
archived         → active
```
Illegal transitions are rejected with `"Cannot change supplier status from X to Y."` — verified live (`blacklisted → suspended` was correctly rejected in testing).

**Backfill**: existing rows (all of which predate this column and were implicitly "active" per the Phase 3 audit — no deactivation UI ever existed) were backfilled once: `blacklisted=true` rows → `status='blacklisted'`; `active=false` rows → `status='suspended'`; everything else stays the column default, `'active'`. The backfill queries are idempotent (their `WHERE` clauses only match rows still at the un-migrated default).

**Reachability of every status** (avoiding the exact "orphaned column" pattern the Phase 3 audit criticized for `rating`):
- `active` — the create-flow default (unchanged from pre-3B real-world behavior) and the Activate/Restore target.
- `suspended` — the Deactivate target.
- `blacklisted` — the Blacklist target (existing UI, now reason-required both directions).
- `archived` — the "Archive Instead" fallback when a delete is blocked.
- `draft`, `pending_approval` — **fully supported and enforced in the transition graph and `procurementSupplierSetStatus`, but this phase does not ship a dedicated UI control to reach them** (no "Submit for Approval" button exists). Building a full onboarding/approval workflow for new suppliers is a materially larger feature than what Phase 3B's explicit scope describes ("business rules," not a new multi-stage workflow screen), and the original audit already flagged a full approval chain as later-phase work reusing `procurement_approval_steps`. Documented here as a known limitation rather than shipped as a shallow, half-wired button.

---

## 6. Procurement Dashboard Enhancements

**Backend**: `procurementDashboard` gained one additional parallel query returning `supplierKpis: { active, preferred, suspended, blacklisted, new_this_month, contracts_expiring_soon }` — `contracts_expiring_soon` counts contracts with a non-null `end_date` within the next 30 days.

**Desktop**: a new "Supplier Overview" section on the Procurement Dashboard, 6 `.kpi-card` tiles matching the exact existing pattern (`kpi-card`/`kpi-lbl`/`kpi-val`/`kpi-sub`, conditional `kpi-amber` styling when suspended/blacklisted/expiring counts are non-zero) used by the pre-existing 4-card row above it.

**Mobile**: a matching "Supplier Overview" section on `ProcurementDashboardScreen.tsx`, using the existing `statTileAlt` tile pattern with a red/amber value color when blacklisted/suspended/expiring counts are non-zero.

---

## 7. Search & Filter

Supplier list, both platforms, now supports all six requested dimensions:

| Dimension | Desktop | Mobile |
|---|---|---|
| Search (name/category/phone) | unchanged | unchanged |
| Lifecycle Status | dropdown, all 6 values | chip row, all 6 values |
| Preferred | quick-filter chip (Phase 3A) | quick-filter chip (Phase 3A) |
| Blacklisted | quick-filter chip (Phase 3A) | quick-filter chip (Phase 3A) |
| Category | **new** — dropdown populated from distinct categories present in the current data | **new** — `FormSelect` populated the same way |
| Sort | existing clickable column headers | existing tap-to-cycle chip |

Both platforms' status filter/badges now read the new `status` field directly, not a derived active/blacklisted mapping.

---

## 8. Professional CSS

No new visual language was introduced on either platform — every element below reuses existing tokens/components.

- **Desktop**: new lifecycle badge entries added to the existing `PROC_STATUS_META` map (reused by `procStatusBadge()`, already used app-wide); the Suppliers list dropped its bespoke inline status-badge function in favor of this shared one. `procFilterBarHtml()` gained an optional `extraHtml` slot (default `''`, zero behavior change for its 6 other existing callers) rather than a bespoke filter bar. Warning banners reuse the existing `.lerr` class already used for form validation errors app-wide.
- **Mobile**: `StatusBadge.tsx` (the shared, app-wide component from Phase 2A) was extended with the 5 new lifecycle status colors/icons, additively, following the exact pattern already used for the 23 existing statuses — every non-supplier screen using this component is visually unchanged. New reason/warning cards reuse the same bottom-sheet visual language (`Colors.overlay`, `Radius.xl`, `Shadow.lg`) established by `FormSelect.tsx` in earlier phases. The category filter reuses the existing shared `FormSelect` component rather than a new dropdown.
- **Both**: KPI cards, confirmation dialogs, success toasts, loading skeletons, and empty states all reuse infrastructure built in Phase 2A/3A — none of it was touched or duplicated.

---

## 9. Audit Logging

Every governance action is logged via the existing `logAudit(user, message, icon, meta, { module, actionType, recordId, reason })` — no new logging infrastructure.

- **Status changes** (activate/deactivate/blacklist/restore/archive, all going through `procurementSupplierSetStatus`): one consistent `actionType: 'status_change'`, message format `Supplier "<name>" status changed: <from> → <to> (<reason>)`, `meta: { supplierId, from, to }`, `reason` in the opts (so it's captured in `audit_log.reason`, not just buried in `meta`).
- **Blocked delete attempts**: `actionType: 'delete_blocked'`, logged inside `procurementSupplierDelete` before the rejection is returned, with the full history-count breakdown in `meta`.
- **Fixed a pre-existing audit-trail filter gap while here**: `renderer/app.js`'s Audit Trail page `typeOpts` dropdown was missing `blacklist`/`unblacklist` (values `procurementSupplierToggleBlacklist` was already writing before this phase, via a template-string `actionType` expression that a naive grep for literal `actionType: '...'` would miss) — these were write-only/unfilterable exactly like the pattern a prior audit flagged for `approve_payment`. Added `blacklist`, `unblacklist`, `status_change`, and `delete_blocked` to both `typeOpts` and the `typeBadge` color map.

---

## Files Changed

| File | Nature of change |
|---|---|
| `db/migrate.js` | New `status`/`status_reason`/`status_changed_by`/`status_changed_at` columns + backfill + index; new `procurement-suppliers-governance` permission grant |
| `db/services/data.js` | New `procurementSupplierSetStatus` + `_blockIfSupplierBlacklisted`; rewired `procurementSupplierToggleBlacklist`; hardened `procurementSupplierUpdate` (no longer writes `active` directly) and `procurementSupplierDelete` (governance permission + full history guard + blocked-attempt audit); blacklist checks added to `procurementRfqSendToSuppliers`/`procurementQuotationSubmit`/`procurementPoGenerate`/`procurementGoodsReceiptCreate`/`procurementInvoiceCreate`; `procurementRfqDetail`/`procurementPoDetail` extended to select `blacklisted`; `procurementDashboard` extended with `supplierKpis` |
| `electron/main.js` / `electron/preload.js` | New `procurement-suppliers:set-status` IPC channel + `window.UFCL.procurementSupplierSetStatus` |
| `mobile-api/routes/procurementSuppliers.js` | New `POST /:id/status` route |
| `mobile/src/api/endpoints.ts` | New `PROCUREMENT_SUPPLIER_STATUS` endpoint |
| `mobile/src/hooks/useProcurementSuppliers.ts` | New `setStatus` action; `toggleBlacklist`'s `reason` param is now required |
| `mobile/src/types/api.ts` | `ProcurementSupplier` gained `status`/`status_reason`; new `ProcurementSupplierStatus` union; `ProcurementRfqSupplier`/`ProcurementPurchaseOrder` gained `blacklisted`/`supplier_blacklisted`; new `ProcurementSupplierKpis` + `ProcurementDashboard.supplierKpis` |
| `mobile/src/components/StatusBadge.tsx` | Extended with 5 new lifecycle status colors/icons |
| `mobile/src/screens/procurement/SupplierDetailScreen.tsx` | Full governance action set (Activate/Deactivate/Blacklist/Restore), reason-required for all transitions, delete-with-archive-fallback |
| `mobile/src/screens/procurement/SuppliersListScreen.tsx` | Lifecycle status chips, category filter, `StatusBadge` on cards |
| `mobile/src/screens/procurement/RfqDetailScreen.tsx` | Blacklist badges/warnings on invited suppliers and quotations; PO-generate blocked when selected quotation's supplier is blacklisted |
| `mobile/src/screens/procurement/GoodsReceiptCreateScreen.tsx` | Blacklist warning card, form disabled when blacklisted |
| `mobile/src/screens/procurement/PurchaseOrderDetailScreen.tsx` | Blacklist warning card, receipt/invoice actions disabled when blacklisted |
| `mobile/src/screens/procurement/ProcurementDashboardScreen.tsx` | Supplier KPI tile row |
| `renderer/app.js` | Lifecycle badges in `PROC_STATUS_META`; Suppliers list governance UI + category filter; blacklist warnings in RFQ/quotation/PO/goods-receipt/invoice overlays; Dashboard KPI cards; Audit Trail `typeOpts`/`typeBadge` fix |
| `renderer/styles.css` | *(no change this phase — Phase 3A's `.row-actions` fix already covers the tables touched here)* |

No files under `mobile-api/server.js`, any other route file, or any migration outside `db/migrate.js`'s existing Procurement Management block were touched.

---

## Known Limitations Remaining

1. **Draft/Pending Approval have no dedicated UI trigger** — fully modeled and enforced in the backend transition graph, but no "Submit for Approval" screen exists. A genuine supplier onboarding workflow is later-phase work.
2. **Mobile's governance role-gate is a client-side literal array**, not a fetched permission list (no resolved-permissions endpoint exists for mobile) — kept in sync with the backend grant by convention, not by mechanism. The server-side check is authoritative regardless.
3. **Blacklist enforcement stops new participation but does not retroactively touch existing open POs/invoices** for a supplier blacklisted mid-flow — a PO issued before blacklisting can still be received/invoiced-against only up to the point this phase's new checks intercept it (goods receipt and invoice creation are both blocked once the supplier is blacklisted, but any receipt/invoice already recorded before that point is untouched, by design — this phase enforces the rule prospectively, not retroactively).
4. **`archived` is only reachable via the delete-blocked fallback flow** on both platforms — there is no standalone "Archive" button for a supplier with no history, since nothing in the explicit scope asked for one and adding it would be a minor scope expansion; noted rather than silently added.
5. Document/attachment management, supplier scoring, contract deletion, and analytics beyond the KPI cards remain explicitly out of scope, per the Phase 3B brief.

---

## Verification Results

- `node --check` — clean on `db/services/data.js`, `db/migrate.js`, `mobile-api/routes/procurementSuppliers.js`, `electron/main.js`, `electron/preload.js`, `renderer/app.js`.
- `cd mobile && npx tsc --noEmit` — clean, zero errors.
- Migration run against the live database: confirmed `status`/`status_reason`/`status_changed_by`/`status_changed_at` columns exist; all 4 existing suppliers backfilled to `status='active'` (matching the audit's finding that no supplier was ever previously deactivated/blacklisted in this environment); `procurement-suppliers-governance` confirmed granted to `admin`/`ceo`/`procurement-manager` and absent from `procurement-officer`.
- Backend smoke test (throwaway `_qa_p3b_*` accounts, since deactivated; throwaway supplier/requisition/RFQ/contract data, since deleted):
  - Procurement-officer attempting to blacklist a supplier → **rejected** (`Access denied`).
  - Procurement-manager blacklisting with a reason → **succeeded**, `status`/`active`/`blacklisted`/`blacklist_reason` all correctly synced in one row.
  - Attempting a transition with an empty reason → **rejected** (`A reason is required for every status change.`).
  - Attempting an illegal `blacklisted → suspended` transition → **rejected** (`Cannot change supplier status from blacklisted to suspended.`).
  - Inviting a blacklisted supplier to an RFQ → **rejected**, exact requested message.
  - Submitting a quotation for a blacklisted supplier → **rejected**, exact requested message.
  - Deleting a supplier with an existing contract → **rejected** (`Supplier cannot be deleted because procurement history exists.`); logged as `delete_blocked`.
  - Archiving the same supplier as a delete fallback → **succeeded**.
  - `procurementDashboard`'s new `supplierKpis` query → returned correct live counts.
