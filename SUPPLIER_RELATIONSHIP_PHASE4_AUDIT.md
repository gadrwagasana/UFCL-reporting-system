# Supplier Relationship Management — Phase 4 Audit

**This is an audit only — no code was written to produce this document**, per Step 1's explicit instruction. Every claim below is grounded in a specific file and line number in the codebase at `c:\Users\hp\OneDrive\Desktop\UFCL 12`, verified directly. Where something does not exist, that is stated explicitly.

**Headline finding**: SRM is a genuinely new layer. Contracts and contacts exist but are minimal (no owner, no value, no category, no documents). Compliance tracking, a document center, communication history, and supplier development (corrective actions/improvement plans) **do not exist anywhere in this codebase** — no tables, no functions, no UI, on either platform. The one significant reusable asset this audit surfaces that prior phases didn't need: a **real, already-running scheduler** (`startScheduler`/`_schedulerTick`, `db/services/data.js:9549-9615`) that ticks every 15 minutes inside the Electron process and already drives reminder-style background tasks — this is the natural, zero-new-infrastructure home for contract/compliance expiry reminders (Step 2/3's explicit ask), and its absence from consideration would have led to reinventing a scheduler that already exists.

---

## 1. Supplier Tables

`procurement_suppliers` — 18 columns (`db/migrate.js:1128-1148` original + `1158-1161` Phase 3B lifecycle additions, confirmed unchanged since): `id, name, category, tax_number, bank_name, bank_account, phone, email, address, rating (dead), preferred, blacklisted, blacklist_reason, notes, active, created_by, created_at, status, status_reason, status_changed_by, status_changed_at`. No SRM-specific fields exist (no relationship owner, no strategic tier, no next-review-date).

## 2. Contract Tables

`procurement_supplier_contracts` (`db/migrate.js:1187-1198`, verified unchanged since Phase 3A):
```sql
id, supplier_id, contract_ref, start_date, end_date, terms, status default 'active', created_by, created_at
```
**Gap vs. Step 2's required fields**: no `category`, no `value` (monetary), no `owner` (responsible user), no `renewal_notice_days`, no `notes` (distinct from the free-text `terms`), no document attachment linkage, and no `draft` concept in practice (status is free text, default `'active'`, no enum/CHECK constraint — confirmed in Phase 3 audit, still true). CRUD exists: List/Create/Update (`procurementSupplierContractsList/Create/Update`, `data.js`) — **no Delete function exists anywhere**, confirmed unchanged since Phase 3A. No renewal concept (no "renew this contract" action — Update is the only mutation, and nothing distinguishes a renewal from an edit, and nothing carries history from an old contract to a new one).

## 3. Contact Tables

`procurement_supplier_contacts` (`db/migrate.js:1173-1183`, unchanged since Phase 3A): `id, supplier_id, name, role, phone, email, is_primary, created_at`. Full CRUD exists (List/Create/Update/Delete). No SRM-specific extension needed here — this table already covers "who do we talk to at this supplier," which SRM's Communication module (Step 5) can reference directly via `contact_id`.

## 4. Procurement History

Unchanged since Phase 3/3C audits — fully linked via `supplier_id` (direct or one hop through `po_id`) across `procurement_purchase_orders`, `procurement_rfq_suppliers`, `procurement_quotations`, `procurement_goods_receipts`, `procurement_invoices`. Already consolidated once by Phase 3C's `_supplierIntelRows()` — any new SRM function needing "does this supplier have PO/invoice/contract history" should call/reuse that existing engine rather than re-deriving the same joins a third time (Phase 3B's delete-guard was the first; Phase 3C's engine the second).

## 5. Supplier Intelligence Outputs (Phase 3C)

Fully available and reusable as-is: `supplierIntelligenceDashboard`, `procurementSupplierIntelligenceProfile` (score, tier, risk indicators, purchase history, timeline, 6-month trend), `procurementSupplierComparison`, `procurementSupplierIntelligenceReports` (9 report types) — all gated on `procurement-reports`. SRM should **compose with** this output (e.g., show a supplier's intelligence score alongside their SRM relationship data on the same profile) rather than duplicate any of its scoring/metric logic. Note: `procurementSupplierIntelligenceProfile`'s `timeline` already merges transactional events + `audit_log` lifecycle events (`data.js:12392-12398`) — SRM's Communication/Development entries should feed into this same merged timeline via the same `audit_log`-or-direct-query pattern, not a second timeline mechanism.

## 6. Existing Notifications

`pushNotification({type, title, body, roles, forUserId, relatedModule, relatedId, category})` (`data.js:476-503`) writes to a `notifications` table (`for_user_id`, `related_module`, `related_id`, `category` columns confirmed via `migrate.js:249-250` and the insert at `data.js:487-489`) and is the sole notification-writing primitive in the app — reused by `notifyProcurementEvent` (Phase 2B) for every existing procurement event. **No contract-expiry or compliance-expiry notification exists today** — the Phase 3B dashboard's "Contracts Expiring Soon" is a **count only**, computed on page load; nothing proactively notifies anyone. Mobile receives notifications via polling (`notifications:poll`/list endpoints, pre-existing, unrelated to this phase) — any new SRM notification automatically reaches mobile through this same existing channel with zero new mobile-side plumbing.

**Reusable scheduler** (the key finding for Steps 2/3's "automatic reminders"): `_schedulerTick()` (`data.js:9549-9602`) runs every 15 minutes (`startScheduler`, `data.js:9608-9615`, started once from `electron/main.js` on `app.whenReady()`) and executes a fixed list of named task functions (BI scan, security scan, workflow scan, approval SLA scan, notification cleanup, workflow job retry, escalation engine). **This is a real, running cron-equivalent already wired into the app** — a new `_schedContractExpiryReminders`-style task appended to that same `tasks` array is the correct, zero-new-infrastructure way to implement Step 2/3's reminders, rather than building a second scheduler. Caveat worth flagging: this scheduler only runs while the Electron desktop app process is alive — if no desktop instance is running, no tick occurs. This is a pre-existing architectural characteristic of every scheduled task in this app today (BI scans, SLA escalation, etc. all share this limitation), not something specific to SRM to solve.

## 7. Existing Dashboard Widgets

Phase 3C's Procurement Dashboard (both platforms) already has: 4 operational KPIs, 8 supplier-intelligence KPIs, Top Performers, High Risk Suppliers, Contract Summary (Active/Expiring/Expired **counts only**, no list), Spend Distribution chart, Spend Trend chart. No SRM-specific widget exists (no compliance %, no document status, no communication activity, no improvement-plan tracking) — Step 7's Executive SRM Dashboard is genuinely new content, though it should sit alongside (not duplicate) the existing Contract Summary counts.

## 8. Existing Document Handling

**Confirmed: does not exist anywhere**, re-verified this phase (`multer` grep returns zero matches in any real code file — only this audit series' own prior `.md` files mention it; no `CREATE TABLE` for attachments/documents anywhere in `migrate.js`). No file-upload route exists in any `mobile-api/routes/*.js` file. No Electron file-picker/save-dialog IPC exists for *uploading* a user-supplied file (only *exporting* generated CSV/PDF content, e.g. `exec:export`, `procurement-po:print` — both one-way, app-generates-the-file, not user-uploads-a-file). **Document upload is a hard prerequisite for Step 4 and is completely unbuilt** — this is the single largest new-infrastructure item in this phase.

## 9. Existing Permissions

Three procurement page-ids currently exist and are relevant: `procurement-suppliers` (CRUD/view — admin/ceo/procurement-officer/procurement-manager), `procurement-suppliers-governance` (activate/deactivate/blacklist/restore/delete — admin/ceo/procurement-manager only, Phase 3B), `procurement-reports` (all reporting/analytics including Phase 3C's intelligence — same 4 roles as `procurement-suppliers`, confirmed identical grant list). No permission exists yet that distinguishes "can view a supplier's compliance/documents/communication history" from "can upload a document" from "can create a corrective action" — SRM introduces at least three qualitatively different sensitivity levels (read SRM data; write routine SRM data like a communication log entry; write consequential SRM data like a contract's monetary value or a formal corrective action) that the current 3-permission model doesn't cleanly express.

## 10. Existing Reports

Five pre-Phase-3C report functions (Spend Analysis, Supplier Performance, Delivery Performance, Budget Utilization, Analytics) plus Phase 3C's 9 Supplier Intelligence report types — all supplier/spend/performance-focused. **None cover contracts, compliance, documents, or communication** — every report Step 8 asks for (Contract Register, Expiring Contracts, Compliance Status, Supplier Documents, Communication Log, Improvement Plans, Executive SRM Summary) is net new. The CSV-export mechanism both reports systems already use (`execExport` IPC on desktop, `Share.share` on mobile) is directly reusable with zero new export infrastructure — confirmed working in Phase 3C.

## 11. Existing APIs

Current supplier-adjacent route surface (`mobile-api/routes/procurementSuppliers.js` — 14 routes; `procurementRequisitions.js` — hosts `/meta/dashboard`, `/meta/reports/*`, `/meta/analytics`, `/meta/intelligence/*` (4 Phase 3C routes), `/meta/config`). No route exists for contracts-as-a-first-class-resource (today contracts are only reachable nested under a supplier, `/:id/contracts`), no route for documents, compliance, communication, or development — all net new.

## 12. Existing Electron Screens

- Suppliers list (`renderProcurementSuppliers`) + "Manage" overlay (`openSupplierManageOverlay`) — now includes (Phase 3C) score gauge, sub-scores, risk indicators, recommendation, purchase history, timeline, trend chart, alongside (Phase 3A/3B) contacts/contracts CRUD and governance actions. This overlay is already large (500+ lines of template) — Step 2-6's per-supplier SRM content (contract lifecycle detail, compliance status, documents, communication log, improvement plans) will not comfortably fit as further additions to this single modal and should be evaluated for promotion to a dedicated multi-tab supplier profile page or overlay during Step 2 planning, not stacked indefinitely onto the existing overlay.
- Procurement Dashboard (`renderProcurementDashboard`) — operational + supplier-intelligence KPIs, no SRM content.
- Procurement Reports (`renderProcurementReports`) — 6 tabs (spend/suppliers/delivery/budget/analytics/intelligence), no SRM tab.
- No Contract Register, Compliance Center, Document Center, or Communication/Development screen exists anywhere in `renderer/app.js`'s 9-entry Procurement NAV section.

## 13. Existing Mobile Screens

19 screens under `mobile/src/screens/procurement/` (18 Phase 1-3A screens + Phase 3C's `SupplierComparisonScreen`). `SupplierDetailScreen.tsx` (already the largest procurement screen at 600+ lines post-Phase-3C) carries the same "already dense" characteristic as its desktop counterpart — same recommendation applies. No SRM screens exist; none of Step 9's 8 required mobile screens (SRM Dashboard, Supplier Contracts, Contract Detail, Compliance Center, Document Center, Communication History, Improvement Plans, SRM Reports) exist today.

---

## Feature Inventory

| Feature | Exists today? | Where |
|---|---|---|
| Contract CRUD (basic) | Partial (List/Create/Update, no Delete, no renewal, no category/value/owner) | `data.js` Suppliers section |
| Contract expiry counting | Yes (count only) | Phase 3B dashboard `supplierKpis.contracts_expiring_soon` |
| Contract expiry reminders | **No** | — |
| Compliance document tracking | **No** | — |
| Document upload/storage/versioning | **No** | — |
| Communication log | **No** | — |
| Corrective actions / improvement plans | **No** | — |
| Supplier training / performance reviews | **No** | — |
| Contract Register report | **No** | — |
| Compliance Status report | **No** | — |
| Executive SRM dashboard | **No** | — |
| Reusable scheduler for reminders | Yes (repurposable) | `data.js:9549-9615` |
| Reusable notification primitive | Yes | `pushNotification`/`notifyProcurementEvent` |
| Reusable CSV export | Yes | `execExport` (desktop) / `Share.share` (mobile) |
| Reusable supplier-history join pattern | Yes | Phase 3B delete-guard, Phase 3C `_supplierIntelRows` |

## Screen Inventory

| Screen | Desktop | Mobile | SRM-ready? |
|---|---|---|---|
| Supplier list | ✅ | ✅ | Needs SRM summary column/badges (compliance %, contract status) |
| Supplier profile/detail | ✅ (overlay) | ✅ | Already dense — needs restructuring before adding 5 more content areas |
| Contract Register (standalone) | ❌ | ❌ | Net new |
| Contract Detail | ❌ | ❌ | Net new |
| Compliance Center | ❌ | ❌ | Net new |
| Document Center | ❌ | ❌ | Net new |
| Communication History | ❌ | ❌ | Net new |
| Improvement Plans | ❌ | ❌ | Net new |
| SRM Dashboard | ❌ | ❌ | Net new (or a new section on the existing Dashboard, per Phase 3C's precedent) |
| SRM Reports | ❌ | ❌ | Net new tab on existing Reports screen, per Phase 3C's precedent |

## Workflow Diagram (target state — none of this exists yet except the leftmost node)

```
Supplier (exists)
   │
   ├─► Contract created (draft) ──► Active ──► Renewal Notice fires (scheduler) ──► Renewed / Expired
   │                                                                                      │
   │                                                                                      ▼
   │                                                                          Contract History entry
   │
   ├─► Compliance document required ──► Uploaded (valid) ──► Expiry approaching (scheduler reminder) ──► Expired / Renewed
   │                                          │
   │                                    Missing (no document on file) ──► flagged on Compliance Center
   │
   ├─► Communication logged (meeting/call/email/visit/complaint) ──► Next Action due ──► follow-up logged
   │
   └─► Performance issue identified ──► Corrective Action created ──► Improvement Plan ──► % complete tracked ──► Closed
```

## Role Matrix (current permissions — SRM decisions needed are marked)

| Role | procurement-suppliers | procurement-suppliers-governance | procurement-reports | SRM read (proposed) | SRM write routine (proposed) | SRM write consequential (proposed) |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| admin | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| ceo | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| procurement-manager | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| procurement-officer | ✅ | ❌ | ✅ | ✅ | ✅ | ❌ (decision point) |
| all other roles | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |

"SRM write consequential" = editing a contract's monetary value, uploading a compliance document, closing a corrective action. Whether `procurement-officer` should have this (matching their existing `procurement-suppliers` CRUD level) or be excluded (matching their `procurement-suppliers-governance` exclusion) is an open decision for Step 1 approval, not assumed here.

## Gap Analysis

**Critical** (blocks Steps as literally specified): document upload/storage infrastructure (Step 4) — nothing to build on; contract fields (category/value/owner/renewal notice) (Step 2) — schema addition needed; compliance tracking (Step 3) — new table needed, no existing concept to extend.

**Important**: communication log (Step 5), corrective actions/improvement plans (Step 6) — both net-new tables, both otherwise straightforward given existing CRUD/audit-log/scheduler patterns to follow.

**Lower-risk / mostly composition**: Executive SRM Dashboard (Step 7) and Reports (Step 8) — once the underlying tables/functions from Steps 2-6 exist, these are largely aggregation + reuse of the existing KPI-card/chart/report-tab patterns already proven in Phase 3C, plus the existing CSV export mechanism.

## Architecture Review

- **No duplicated business logic risk identified for reused pieces**: the scheduler, `pushNotification`, `execExport`/`Share.share`, and the Phase 3C intelligence engine are all clean, composable primitives with no SRM-specific logic baked in — safe to extend/call into without modification in most cases (the scheduler needs one new task function *added to its list*, not modified itself).
- **New tables appear necessary** (contrary to the "avoid unless absolutely necessary" default) for: compliance documents/certificates, communication log entries, corrective actions/improvement plans, and a document-attachment table (documents need to attach to contracts, compliance records, *and* general supplier files — a single polymorphic-ish attachments table referencing `(supplier_id, entity_type, entity_id)` is the leaner design vs. three separate per-feature document tables). Contract fields need additive `ALTER TABLE` columns (category/value/owner_id/renewal_notice_days/notes), not a new table.
- **Document storage location** is an open decision this audit surfaces rather than resolves: options are (a) store files on local disk under a known app-data directory with the DB row holding just a path (matches this codebase's existing pattern for CSV exports — user/app-controlled filesystem, no blob-in-DB), or (b) store file bytes directly in Postgres (`bytea`) — simpler for mobile sync (no separate file-serving endpoint needed) but heavier on the database. Given mobile needs to *view* documents uploaded from desktop (and potentially vice versa), and given there's no existing shared file server/CDN in this stack, **storing file bytes in the database and serving them through the existing REST API (base64 over JSON, or a dedicated binary route) is the more consistent choice with this app's "the API is the only channel between platforms" architecture** — avoiding a new file-server component. This should be confirmed before implementation, not assumed.
- **Permission model**: recommend one new page-id, `procurement-srm`, granted alongside `procurement-suppliers` to the same 4 roles for read/routine-write, with consequential actions (document upload, contract value edits, closing corrective actions) gated on a role check consistent with whatever the Role Matrix decision above resolves to — mirroring the `procurement-suppliers` / `procurement-suppliers-governance` split precedent from Phase 3B rather than inventing a new pattern.

## CSS/UI Review

Every existing token/component this phase would need already exists and was proven in Phase 3B/3C: `.kpi-card`, `.mc`, `.badge`/`PROC_STATUS_META` (extensible for new Compliance/Contract badge variants exactly as tier badges were added in 3C), `.filter-bar`/`procFilterBarHtml`, `wireSortableTable`, `skeletonTableRows`, the SVG chart helpers (desktop) and `StatusBadge`/`FormSelect`/`HorizontalExpenseChart`/`SparklineChart` (mobile), the toast system, and `execExport`/`Share.share`. **Nothing new needs to be invented for Step 10's requirements** — they are a checklist of "use what already exists," consistent with every prior phase. The one genuinely new visual pattern needed is a **document preview/download card** (file name, type icon, size, expiry badge, download/preview action) — no precedent exists for this anywhere in the app today since no document system exists; this should follow the same restrained, token-reuse approach (a card variant, not a new component family).

## Priority Roadmap

**Phase 4A** (foundation — must come first): contract schema additions (category/value/owner/renewal_notice_days/notes) + document/attachment table + storage-mechanism decision + `procurement-srm` permission.

**Phase 4B**: Contract Lifecycle Management (Step 2) end-to-end on both platforms, including the scheduler-based renewal reminder task — this is the most literally-specified, most reusable-pattern-heavy step and the one every other step's "Contract Status/Register" reporting depends on.

**Phase 4C**: Supplier Compliance (Step 3) — depends directly on the Phase 4A document/attachment table; reuses the same scheduler-reminder pattern built in 4B.

**Phase 4D**: Document Center (Step 4) — by this point the underlying table exists (built in 4A) and is already partially exposed (contract/compliance document attachment); this phase is primarily the dedicated browse/search/version-history UI on top of it.

**Phase 4E**: Communication (Step 5) and Development (Step 6) — both new tables, both lower architectural risk than 4A-4D, can proceed in either order or in parallel once 4A's permission model is settled.

**Phase 4F**: Executive SRM Dashboard (Step 7) and Reports (Step 8) — composition/aggregation over everything built in 4A-4E; should be last so it reports on real, complete data rather than partially-built features.

**Phase 4G**: Mobile parity pass (Step 9) — per this project's established pattern (Phase 3A/3B/3C), build each desktop capability then its mobile equivalent within the same sub-phase rather than deferring all mobile work to the very end; listed last here only to flag it as a completeness gate, not a suggestion to batch it separately.

---

## Open Decisions Requiring Confirmation Before Implementation

1. **Document storage mechanism** — DB-stored bytes served over the existing REST API (recommended, see Architecture Review) vs. filesystem-path storage. This is a schema-shape decision that's expensive to reverse after data exists.
2. **New table count** — this audit identifies 4 likely new tables (compliance records, communication log, corrective actions/improvement plans, document attachments) plus `ALTER TABLE` additions to `procurement_supplier_contracts`. This exceeds "only if absolutely necessary" in raw count, though each is individually justified by a genuinely new concept with no existing table to extend — confirming this reading before building is worth an explicit go-ahead given the phase's own emphasis on minimizing new tables.
3. **`procurement-officer`'s access to "consequential" SRM writes** — see Role Matrix.
4. **Supplier profile restructuring** — whether to keep stacking SRM content onto the existing single "Manage Supplier" overlay/`SupplierDetailScreen`, or promote it to a tabbed/multi-page profile before adding 5 more content sections (contracts detail, compliance, documents, communication, development) on top of the already-substantial Phase 3C content. Recommended: restructure now rather than after Step 6 makes the file/overlay unwieldy.

This audit deliberately stops here without implementation, matching Step 1's explicit instruction and the same audit-then-confirm pattern used for Phase 3C.
