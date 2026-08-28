# Supplier & Vendor Management — Phase 3B Changelog

Governance and business-rule enforcement, both platforms. One new database column set, one new backend function, one new permission, one new IPC channel/route. No document management, scoring, analytics, or contract deletion — see `SUPPLIER_VENDOR_PHASE3B_COMPLETION_REPORT.md` for full rationale and verification detail.

## Added
- **`procurement_suppliers.status`** (+ `status_reason`, `status_changed_by`, `status_changed_at`) — new columns, `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`, backfilled from existing `active`/`blacklisted` values. Six lifecycle values: `draft`, `pending_approval`, `active`, `suspended`, `blacklisted`, `archived`.
- **`procurementSupplierSetStatus(userId, supplierId, newStatus, reason)`** (`db/services/data.js`) — the single lifecycle-transition function: validates the status, requires a reason, validates the transition against an explicit state graph, updates `status` and the legacy `active`/`blacklisted` mirror columns atomically, and audits the change.
- **`procurement-suppliers-governance`** — new centralized permission (`db/migrate.js`), granted to `admin`/`ceo`/`procurement-manager` only, replacing a hardcoded role array.
- **Blacklist enforcement** at 5 workflow entry points: RFQ supplier invite, quotation submission, PO generation, goods receipt creation, invoice creation — all backend-enforced via a new shared helper, `_blockIfSupplierBlacklisted`.
- **Delete-protection hardening** — `procurementSupplierDelete`'s guard now checks Purchase Orders, RFQ invitations, Quotations, Invoices, Contracts, and Goods Receipts (previously POs only); blocked attempts are audited.
- **Archive-instead-of-delete** flow on both platforms when a delete is blocked by procurement history.
- **Supplier governance UI** on both platforms: status-appropriate Activate/Deactivate/Blacklist/Restore actions, all reason-required, all routed through one new IPC channel (`procurement-suppliers:set-status`) / REST route (`POST /api/procurement/suppliers/:id/status`).
- **Category filter** on the supplier list, both platforms (new — previously only search/status/preferred/blacklisted existed).
- **Executive supplier KPI cards** on the Procurement Dashboard, both platforms: Active, Preferred, Suspended, Blacklisted, New This Month, Contracts Expiring Soon — one new backend query (`procurementDashboard`'s `supplierKpis`).
- **Blacklist warning banners/cards** at every workflow touchpoint, both platforms: RFQ invite picker, quotation comparison, PO-generate button, goods receipt form, invoice-create form.
- 5 new lifecycle status colors/icons added to the shared mobile `StatusBadge` component and to desktop's `PROC_STATUS_META`.

## Changed
- `procurementSupplierToggleBlacklist` — now a one-line delegate to `procurementSupplierSetStatus`; the hardcoded `['admin','ceo','procurement-manager']` role check it used to contain is gone (replaced by the centralized permission, enforced one layer down).
- `procurementSupplierUpdate` — no longer accepts a direct `active` write (superseded by the governance-gated status mechanism; prevents the two fields from drifting out of sync).
- `procurementSupplierDelete` — permission moved from the general `procurement-suppliers` CRUD permission to the narrower `procurement-suppliers-governance` permission. **`procurement-officer` can no longer delete suppliers** (retains create/edit/view/contacts/contracts).
- Un-blacklisting a supplier now requires a reason on both platforms (previously one-click, no reason, on both) — a deliberate consistency change: every lifecycle transition now has the same rule.
- `procurementRfqDetail`/`procurementPoDetail` queries extended to also select `blacklisted`/`supplier_blacklisted`, feeding the new warning UI — additive, no existing consumer's shape changed.
- Desktop's Suppliers list status badge/filter now reads the new `status` field directly instead of deriving a 3-way state from `active`/`blacklisted` booleans.

## Fixed
- **Blacklist was advisory-only** — a blacklisted supplier could still be invited to an RFQ, quoted, issued a PO, receive goods, or be invoiced. All five paths are now hard-blocked server-side.
- **Supplier delete's history guard was incomplete** — only checked Purchase Orders; a supplier with an RFQ invitation, quotation, invoice, contract, or goods receipt but no PO could previously be deleted and orphan those records (or hit a raw FK error, per the Phase 3 audit's finding). Now checked comprehensively.
- **Audit Trail filter dropdown was missing `blacklist`/`unblacklist`** (`renderer/app.js`) — these action types were already being written (via a template-string expression a naive search would miss) but had no filter option, exactly the "write-only/unfilterable action type" pattern a prior audit flagged elsewhere. Added, along with the two new types this phase introduces (`status_change`, `delete_blocked`).

## Explicitly not changed (out of scope for this phase)
- No new backend function duplicates existing logic — `procurementSupplierToggleBlacklist` delegates rather than reimplementing; blacklist checks reuse one shared helper across all 5 call sites rather than 5 separate implementations.
- No document/attachment upload, supplier scoring, contract deletion, analytics beyond the KPI cards, or automation — all correctly deferred per the Phase 3B brief's explicit out-of-scope list.
- No approval workflow (Submit-for-Approval UI) was built for the `draft`/`pending_approval` states — they're fully modeled and enforced in the backend transition graph but have no dedicated screen this phase; documented as a known limitation rather than shipped shallow.
- Finance and Operations roles received no new supplier access — item 3 asked to verify these roles' access, not grant them anything; both remain without any `procurement-suppliers*` permission, unchanged from Phase 3A.
