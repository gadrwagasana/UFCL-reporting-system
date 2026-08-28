# Supplier & Vendor Management — Phase 3 Audit

**This is an audit only.** No code, migrations, APIs, or UI were changed to produce this document. Every claim below is grounded in a specific file and line number in the codebase at `c:\Users\hp\OneDrive\Desktop\UFCL 12`, verified directly rather than assumed. Where something does not exist, that is stated explicitly rather than omitted.

There is no "vendor" concept distinct from "supplier" anywhere in the codebase — a repo-wide search for "vendor" returns zero hits in application code; the word appears only in prior planning docs as a loose synonym for "supplier," and `PROCUREMENT_PHASE2B_CHANGELOG.md:24` explicitly records "vendor portal" as scoped out and never built. This report therefore uses "supplier" throughout, matching the codebase's own terminology, and confirms there is no supplier self-service/portal access anywhere (same source).

---

## 1. Existing Supplier Features

All supplier backend functions live in one contiguous block in `db/services/data.js:10994-11173` ("── Suppliers ──"), plus two report functions elsewhere (`§9` architecture note: none of these 13 functions call each other — each is a standalone entry point reached only from the API/IPC layer).

| Feature | Desktop | Mobile | Backend function | DB table(s) | API / IPC | Permission |
|---|---|---|---|---|---|---|
| Supplier CRUD (list/create/edit) | ✅ Full — list page + register/edit overlay (`renderProcurementSuppliers`, `renderer/app.js:13527-13703`) | ✅ Full — list/detail/form screens | `procurementSuppliersList` (10996), `procurementSupplierCreate` (11009), `procurementSupplierUpdate` (11025) | `procurement_suppliers` | `GET/POST/PATCH /api/procurement/suppliers[/:id]`; IPC `procurement-suppliers:list/create/update` | `mustRole(user,'procurement-suppliers')` — admin/ceo/procurement-officer/procurement-manager only (`migrate.js:1444-1447`) |
| Supplier delete | ✅ Row action, confirm dialog | ❌ Hook exists (`remove()`), **never called by any screen** | `procurementSupplierDelete` (11058) | `procurement_suppliers` | `DELETE /api/procurement/suppliers/:id`; IPC `procurement-suppliers:delete` | Same as above |
| Supplier search | ✅ Client-side filter on name/category/phone (`applyProcListFilters`) | ✅ Client-side filter on name/category (`ListSearchBar`) | n/a (client-side over `procurementSuppliersList` result) | — | — | Same as above |
| Supplier categories | ⚠️ Free-text input, **not** a fixed dropdown | ⚠️ Free-text input (placeholder gives examples), **not** a fixed dropdown | `category` column, set via Create/Update | `procurement_suppliers.category text` | same as CRUD | Same as above |
| Supplier status (Active/Blacklisted) | ⚠️ Displayed as a 3-way badge (Active/Blacklisted/Inactive); **no UI control to set "Inactive"** (see §6) | ⚠️ Blacklist banner shown; no "Inactive" concept surfaced at all | `active`, `blacklisted` columns | `procurement_suppliers` | — | — |
| Supplier blacklist | ✅ Per-row toggle, **mandatory reason** when blacklisting | ⚠️ Toggle exists on Detail screen, but **never collects/sends a reason**, even when blacklisting | `procurementSupplierToggleBlacklist` (11045) | `procurement_suppliers.blacklisted/blacklist_reason` | `POST /api/procurement/suppliers/:id/blacklist`; IPC `procurement-suppliers:blacklist` | **Hardcoded** `['admin','ceo','procurement-manager']` (11047) — `procurement-officer` is excluded despite holding full page access; this is a code-only gate, not represented in `role_definitions` |
| Supplier address | ✅ Field on form | ✅ Field on form | part of Create/Update | `procurement_suppliers.address text` | same as CRUD | Same as CRUD |
| Supplier payment terms | ❌ **Not a supplier field.** Free-text "terms" only exists per-contract, per-quotation, per-PO — never inherited from the supplier record | ❌ Same — not present anywhere | — | no `payment_terms` column anywhere (confirmed by grep) | — | — |
| Supplier tax information | ⚠️ Single free-text `tax_number` field only | ⚠️ Same | part of Create/Update | `procurement_suppliers.tax_number text` | same as CRUD | Same as CRUD |
| Supplier bank details | ⚠️ Two free-text fields (`bank_name`, `bank_account`); no branch/SWIFT/IBAN/verification | ⚠️ Same two fields | part of Create/Update | `procurement_suppliers.bank_name/bank_account text` | same as CRUD | Same as CRUD |
| Supplier documents (upload) | ❌ **Does not exist** | ❌ **Does not exist** | — | no column/table anywhere | no route; **`multer` is not even a dependency** in either `package.json` | — |
| Supplier contacts | ✅ List + inline add-contact form, inside "Manage" overlay | ⚠️ List only, **no add/edit/delete UI** (hooks for add exist and are unused) | List/Create/Update/Delete (11071/11079/11094/11109) | `procurement_supplier_contacts` (FK `ON DELETE CASCADE`) | `GET/POST /api/procurement/suppliers/:id/contacts`, `PATCH/DELETE /api/procurement/suppliers/contacts/:id`; matching IPC | Same as CRUD |
| Supplier contracts | ✅ List + inline add-contract form, inside "Manage" overlay. **No edit/delete UI even though Update exists in the backend** | ⚠️ List only, **no add/edit UI** (hook for add exists and is unused) | List/Create/Update (11116/11124/11139) — **no Delete function exists anywhere** (backend, API, or IPC) | `procurement_supplier_contracts` (FK `ON DELETE CASCADE`) | `GET/POST /api/procurement/suppliers/:id/contracts`, `PATCH /api/procurement/suppliers/contracts/:id`; matching IPC | Same as CRUD |
| Supplier purchase history / performance | ✅ 3 stat tiles (POs, Receipts, Reject Rate%) inside "Manage" overlay only | ✅ Same 3 stats, shown inline in the Detail screen body (more visible than desktop) | `procurementSupplierPerformance` (11154) — computed live from PO/goods-receipt history, nothing persisted | reads `procurement_purchase_orders`, `procurement_goods_receipts`, `procurement_goods_receipt_items` | `GET /api/procurement/suppliers/:id/performance`; IPC `procurement-suppliers:performance` | Same as CRUD |
| Preferred supplier flag | ✅ Editable checkbox on Register/Edit form | ⚠️ **Displayed only** (star icon) — **no checkbox in the mobile form**, so mobile users cannot set/unset it | part of Create/Update | `procurement_suppliers.preferred boolean` | same as CRUD | Same as CRUD |
| Supplier rating | ❌ Column exists (`rating numeric(3,2)`), displayed as `—` everywhere because **it is never written by any function** — no `INSERT`/`UPDATE` sets it, no UI form field on either platform | ❌ Same — displayed if present, never settable | — (orphaned column) | `procurement_suppliers.rating` | surfaced read-only in `procurementQuotationsCompare` (11495) and `procurementReportSupplierPerformance` (11920) | — |
| Spend analysis report (by supplier) | ✅ Reports page tab | *(desktop-only feature area — see §5)* | `procurementReportSpendAnalysis` (11903) | reads `procurement_purchase_orders` joined to `procurement_suppliers` | `GET /api/procurement/requisitions/meta/reports/spend-analysis` — note the URL lives under the `requisitions` prefix, not `suppliers` | `mustRole(user,'procurement-reports')` — same 4 roles, but **a different permission id** than the supplier CRUD block |
| Supplier performance report (fleet-wide) | ✅ Reports page tab | *(desktop-only feature area — see §5)* | `procurementReportSupplierPerformance` (11916) | reads `procurement_suppliers` left-joined to PO/receipt tables | `GET /api/procurement/requisitions/meta/reports/supplier-performance` | Same as above |

---

## 2. Supplier Workflow

```
Create Supplier (draft entry — no separate "draft" status; row exists immediately as active=true)
      ↓
Supplier Approval                              ❌ MISSING — no approval step exists. A new supplier
                                                    is usable in an RFQ the instant it's created; there
                                                    is no `procurement_approval_steps` entity_type for
                                                    suppliers (that generic table is only used for
                                                    requisitions/invoices/payments per Phase 2 work).
      ↓
Supplier Active                                ⚠️ PARTIAL — `active` column exists and is filterable,
                                                    but no UI on either platform can ever set it to
                                                    false. Every supplier that has ever been created is
                                                    functionally permanently "active."
      ↓
Supplier used in RFQ                           ✅ Implemented — `procurementRfqSendToSuppliers` (11433)
                                                    invites suppliers; `procurementQuotationSubmit` (11475)
                                                    records their quote (suppliers have no login — an
                                                    officer enters quotes on their behalf, per comment
                                                    at 11474).
      ↓
Supplier used in Purchase Order                ✅ Implemented — `procurementPoGenerate` carries the
                                                    winning quotation's `supplier_id` onto the PO.
      ↓
Supplier Invoice                               ✅ Implemented (Phase 1/2 work) — `procurement_invoices`
                                                    carries `supplier_id`, matched against the PO.
      ↓
Supplier Performance                           ✅ Implemented — computed live from PO + goods-receipt
                                                    history (§1), not a workflow "stage," just a report.
```

**What's genuinely missing from the workflow, not just the UI:**
- No supplier onboarding/approval gate — a supplier can be created and immediately invited to an RFQ or issued a PO with zero review step, no matter how incomplete its record (no tax number, no bank details, no contact).
- Blacklist/deactivation status is **not enforced downstream** — `procurementQuotationSubmit` and `procurementPoGenerate` contain no check against `blacklisted`. A blacklisted supplier can still receive a recorded quotation and be selected for a PO; blacklist status is currently informational only (visible in `procurementQuotationsCompare`, §1) rather than a hard stop.
- `active=false` is unreachable, so "deactivate a supplier without deleting it" — the normal enterprise lifecycle action — cannot currently be performed by anyone through either app.

---

## 3. Screen Inventory

### Electron (desktop)
| Screen | Function | Notes |
|---|---|---|
| Suppliers list | `renderProcurementSuppliers` (`renderer/app.js:13527-13703`) | Nav entry `procurement-suppliers` (icon `ti-building-store`, `app.js:190`), 2nd item in the Procurement nav section |
| Supplier "Manage" overlay (the closest thing to a detail screen) | `openSupplierManageOverlay` (`renderer/app.js:13467-13525`) | Shows performance stats + contacts + contracts, each with its own inline add-form; no single "detail page," it's a modal |
| Register/Edit Supplier form | `supplierForm()` (`renderer/app.js:13597-13617`), inline in the same file | Single flat overlay, not a separate screen/route |

No dedicated Electron page exists for "Contracts" or "Contacts" outside the Manage overlay — they are not independently navigable.

### Mobile
| Screen | File | Notes |
|---|---|---|
| Suppliers list | `SuppliersListScreen.tsx` (103 lines) | Registered as `SuppliersList` in `ProcurementStack.tsx:30` |
| Supplier detail | `SupplierDetailScreen.tsx` (153 lines) | Registered as `SupplierDetail`; display-only for contacts/contracts |
| Supplier create/edit form | `SupplierFormScreen.tsx` (96 lines) | Registered as `SupplierForm`; missing `preferred` field vs. desktop |

### Missing screens (both platforms)
- A dedicated Contacts management screen (mobile has no add/edit/delete UI at all; desktop only has inline add inside a modal).
- A dedicated Contracts management screen (same — desktop has no edit/delete UI despite Update existing in the backend; mobile has no add UI at all; no Delete exists anywhere in the stack for contracts).
- Any supplier onboarding/approval screen (doesn't exist because the workflow step doesn't exist, §2).
- Any document/attachment upload screen (feature doesn't exist at all, §1).
- Any supplier-facing portal/self-service screen (confirmed out of scope, intro).

---

## 4. Permission Matrix

Gate for every supplier CRUD/contacts/contracts/performance action is `mustRole(user, 'procurement-suppliers')`, and this permission id is granted to exactly four roles via `FULL_ACCESS_ROLES` in `db/migrate.js:1444-1447`: `admin`, `ceo`, `procurement-officer`, `procurement-manager`. No other role's grant list (checked: the baseline loop at `migrate.js:1438-1441`, and the targeted `supervisor`/`department-manager`/`finance`/`storekeeper` grants at `migrate.js:1451-1454`) includes `procurement-suppliers` — confirmed by direct inspection, not inferred.

| Action | admin | ceo | procurement-officer | procurement-manager | all other roles |
|---|:---:|:---:|:---:|:---:|:---:|
| View suppliers / contacts / contracts | ✅ | ✅ | ✅ | ✅ | ❌ |
| Create supplier | ✅ | ✅ | ✅ | ✅ | ❌ |
| Edit supplier | ✅ | ✅ | ✅ | ✅ | ❌ |
| Deactivate supplier (`active=false`) | ⚠️ backend allows it (folded into `Update`), **no UI on either platform can trigger it** | (same) | (same) | (same) | ❌ |
| Blacklist / unblacklist supplier | ✅ | ✅ | ❌ **excluded** (hardcoded, `data.js:11047`) | ✅ | ❌ |
| Delete supplier | ✅ | ✅ | ✅ | ✅ | ❌ |
| View supplier performance/history | ✅ | ✅ | ✅ | ✅ | ❌ |
| View contracts | ✅ | ✅ | ✅ | ✅ | ❌ |
| Add contract | ✅ | ✅ | ✅ | ✅ | ❌ |
| Delete contract | ❌ — no such capability exists for **any** role (function was never built) | | | | |
| Upload documents | ❌ — feature does not exist for **any** role | | | | |

**Flagged inconsistency:** `procurement-officer` has full CRUD/view/delete access to suppliers but is specifically carved out of the blacklist action via a hardcoded array inside `data.js`, not via `role_definitions.permissions`. This means the Settings page's permission checkboxes (`renderer/app.js:403`) show `procurement-officer` as having full "Suppliers" access with no visual indication that one specific action is silently denied — a role-definition/actual-behavior mismatch worth resolving in Phase 3, not just documenting.

---

## 5. Mobile vs Desktop Comparison

| Capability | Desktop only | Mobile only | Present on both, behaves differently |
|---|---|---|---|
| Delete supplier | ✅ (row action + confirm) | — | Mobile has the hook (`remove()`) but zero UI wires to it |
| Add contact | ✅ (inline form in Manage overlay) | — | Mobile has the hook (`addContact()`) but zero UI wires to it |
| Add contract | ✅ (inline form in Manage overlay) | — | Mobile has the hook (`addContract()`) but zero UI wires to it |
| Edit "Preferred" flag | ✅ (checkbox on form) | — | Mobile displays the star but the form has no control to set it |
| Spend Analysis / Supplier Performance reports | ✅ (Reports page tabs) | — | No mobile screen consumes `PROCUREMENT_REPORT_SPEND`/`PROCUREMENT_REPORT_SUPPLIER_PERF` at all |
| Blacklist reason capture | ✅ mandatory reason overlay when blacklisting | — | Mobile's toggle button calls the same API but **never sends a reason**, even when blacklisting — a real behavioral gap, not just missing UI polish |
| Performance stats visibility | Behind an extra click (inside "Manage" overlay) | Inline on the Detail screen body, no extra tap | Same data, different prominence — mobile arguably surfaces it better |
| Empty-state vs. no-results-from-search distinction | ❌ single generic message for both cases | ✅ distinct copy ("No matching suppliers" vs. "No suppliers yet") | Mobile is ahead here |
| Category input | Free-text `<input>` | Free-text `<TextInput>` | Identical behavior, same gap (no fixed category list on either platform) |

**Summary**: mobile is strictly behind desktop on supplier management — contacts, contracts, delete, and the preferred flag are all editable on desktop and read-only (or entirely absent) on mobile, despite the underlying hooks already existing and being unused. The two areas where mobile is arguably better (empty-state copy, performance-stat prominence) are both minor UX points, not functional gaps.

---

## 6. UI / UX Review

Scope: Supplier screens only, both platforms.

### Desktop (`renderer/app.js`)
- **Navigation**: standard, consistent with every other Procurement page — a left-nav entry plus a `showPage()` switch case (`app.js:947-948`). No sub-navigation for Contacts/Contracts; they live only inside a modal.
- **Search**: single text box filtering name/category/phone client-side (`applyProcListFilters`), shared implementation with other procurement list pages — consistent, not bespoke.
- **Filters**: one status `<select>`, relabeled from the generic requisition-status vocabulary to "All statuses / Active / Blacklisted / Inactive" (`app.js:13586-13589`) — functional, but "Inactive" is a dead filter option today (§2/§4) since nothing can produce it.
- **Tables**: shared `.tbl` component, sortable via `wireSortableTable` (Name/Category/Rating columns), consistent with the rest of the app.
- **Cards**: the "Manage" overlay uses the shared `.mc` mini-card component for the 3 performance stats — visually consistent with dashboards elsewhere in the app.
- **Forms**: single flat form, no tabs/wizard, no client-side field-level validation beyond "Name is required" — acceptable for the current field count, would not scale well if tax/bank/document fields grow.
- **Dialogs**: blacklist-with-reason overlay and `confirmDelete()` both reuse shared overlay/dialog patterns — consistent.
- **Loading state**: generic `skeletonTableRows(6)` — consistent with the rest of the app, not supplier-specific (that's fine, it's exactly what the shared component is for).
- **Empty states**: ⚠️ one message serves both "genuinely no suppliers" and "no rows match your filter" (`app.js:13564`) — every other reviewed procurement page has this same characteristic, so it's a systemic pattern, not a supplier-specific defect, but still worth fixing.
- **Success feedback**: none observed directly in the audited code path beyond the overlay closing and the list re-rendering — no toast call was found wired to supplier create/update/delete/blacklist in the sections reviewed. *(Toast infrastructure exists app-wide per Phase 2A; its absence here specifically should be double-checked before Phase 3 implementation — flagged, not fully re-verified in this pass since it fell outside the three research agents' explicit line-by-line quote requests.)*
- **Error handling**: ⚠️ `renderDenied()` is used for **every** non-`ok` response, including genuine load failures — a real network/DB error is presented to the user as "Access denied," which is misleading. Systemic pattern (also true of other procurement pages), but real.
- **Responsive layout**: not applicable in the same sense as mobile — desktop is a fixed-chrome Electron app; no responsiveness issue was found or expected.

### Mobile
- **Navigation**: `SuppliersList → SupplierDetail`/`SupplierForm`, a clean, conventional stack — no issues found.
- **Search**: `ListSearchBar` client-side filter, consistent with other list screens app-wide.
- **Filters**: none beyond search — desktop's Active/Blacklisted/Inactive status filter has no mobile equivalent.
- **Cards**: `SupplierCard` (file-scoped inside `SuppliersListScreen.tsx`, not extracted to `components/`) is clean and information-dense (star, blacklist pill, category, phone, rating) but is the **only** supplier-specific visual component in the whole mobile codebase — everything else is generic/shared.
- **Forms**: single flat form, same validation depth as desktop (name required only), missing the `preferred` control (§5).
- **Dialogs**: native `Alert.alert` used for the blacklist confirm — standard RN pattern, consistent with the rest of the app, but doesn't collect the reason text desktop requires.
- **Loading states**: `SearchSkeleton`/`LoadingState`, both shared components — consistent.
- **Empty states**: ✅ better than desktop — distinct copy for "no results from search" vs. "no suppliers yet" (`SuppliersListScreen.tsx`).
- **Success feedback**: `SupplierFormScreen` does call `showToast()` on save (confirmed present in the code reviewed) — ahead of what could be confirmed for desktop in this pass.
- **Error handling**: `ErrorState` component with a retry action on the list screen — a real retry affordance, better than desktop's `renderDenied()`-for-everything pattern.
- **Responsive layout**: standard RN `ScrollView`/`FlatList` — no phone-vs-tablet-specific issue was found or looked for in this pass (out of scope of the three research agents; flagging as unverified rather than claiming it's fine).

### CSS Review
Framed strictly as presentation-layer recommendations — none of the following change functionality.

- **Zero supplier-specific CSS exists in `renderer/styles.css`** (confirmed by grep — no `.sup-*`/`.supplier-*` block). Everything is inherited from shared classes (`.card`, `.tbl`, `.badge`, `.mc`, `.fg`/`.frow`, `.section-hdr`). This is architecturally correct (no duplicated styling) and should stay that way — Phase 3 should **extend** shared classes, not invent supplier-only ones, to preserve the "Enterprise Design System" consistency established in Phase 2A.
- **Professional supplier cards**: if a card-based list view is ever added to desktop (today it's table-only), reuse the `.kpi-card`/`.mc` accent-bar treatment from Phase 2A rather than a new visual language.
- **Sticky table headers**: the suppliers table should adopt the same sticky-header behavior Phase 2A already applied to 6 other procurement tables (`.tbl` class) — confirm it's actually applied here (not independently re-verified in this pass) or extend it if missing.
- **Status badge for "Inactive"**: the badge variant already exists (gray, moon icon, `app.js:13545`) for a state the UI can never currently produce (§2/§4) — worth keeping the badge but pairing it with an actual "Deactivate" control (a functional fix, not a CSS one) so the visual language isn't dead weight.
- **Rating display**: currently always renders `—`. Cosmetically, consider suppressing the column entirely (or graying it out more explicitly as "not yet rated") rather than showing a permanently-empty column, until/unless a rating-entry mechanism is built.
- **Blacklist banner (mobile)**: already implemented with a red banner + reason — good pattern; if desktop's Manage overlay is reworked into a full detail screen in Phase 3, mirror this same treatment for consistency with mobile rather than the current icon-only badge.
- **Consistent design tokens**: no new colors were found introduced ad hoc for suppliers (blacklist red, active green, preferred amber star all reuse existing tokens) — this discipline should continue into Phase 3's new screens.

---

## 7. Missing Enterprise Features

### Critical
- **No enforcement of blacklist status downstream.** A blacklisted supplier can still be quoted (`procurementQuotationSubmit`) and selected for a PO (`procurementPoGenerate`) — blacklisting is currently advisory-only. *Business justification: the entire point of a blacklist is to prevent further spend with a supplier; today it only changes a badge color.*
- **No way to deactivate a supplier.** `active` exists in the schema and is filterable in the UI, but nothing can set it to `false`. *Business justification: procurement teams need to retire suppliers who've gone out of business or ended a relationship without the nuclear option of a hard delete (which is itself blocked once any PO exists) — today there is no middle ground.*
- **`procurement-officer`/blacklist permission mismatch.** A hardcoded, undocumented exception to an otherwise page-permission-driven model. *Business justification: undocumented authorization exceptions are an audit/compliance risk — a reviewer checking `role_definitions` would incorrectly conclude procurement-officer can blacklist suppliers.*

### Important
- **Mobile parity gaps**: no delete-supplier, no add-contact/add-contract, no preferred-flag editing, no blacklist-reason capture on mobile, despite three of these four having ready-to-use hooks already written and simply never wired to a screen. *Business justification: field/warehouse staff who only have mobile access cannot perform basic supplier maintenance that desktop users take for granted — forces a desktop-only workflow for a subset of legitimate tasks.*
- **No supplier document/attachment storage.** No tax certificate, business registration, signed contract PDF, or bank-confirmation letter can be attached to a supplier record anywhere. *Business justification: procurement compliance and audit trails commonly require proof documents on file, not just free-text fields describing them.*
- **No structured payment terms.** "Net 30"-style terms exist only as scattered free text per-contract/per-quotation/per-PO, never standardized or inherited from the supplier. *Business justification: without a structured field, payment-terms reporting/analysis (e.g. "which suppliers are Net 60+") is not queryable — it would require parsing free text.*
- **Supplier delete's reference guard is incomplete.** Only checks `procurement_purchase_orders`; a supplier with an RFQ invitation or recorded quotation but no PO yet will pass the app-level check and then hit a raw, unhandled foreign-key error. *Business justification: this produces an ugly/unclear failure for a fairly ordinary sequence of events (invited to RFQ, never won any business, later someone tries to delete them).*
- **Contract deletion doesn't exist anywhere** (backend, API, or IPC) — only create/update. *Business justification: a contract entered in error today can never be removed, only edited around.*

### Optional
- **Supplier rating is a dead column.** Exists in schema, read in two places, never writable. *Business justification: lower priority than the above since `procurementSupplierPerformance` already provides an objective, computed alternative to a manually-entered rating — a real rating field would need a defined methodology (who rates, how often) before it's worth building.*
- **Category is free text, not a controlled list.** *Business justification: minor reporting/consistency benefit (no "Hardware" vs "hardware" vs "HW" fragmentation), but low urgency given current supplier counts are likely small.*
- **No supplier self-service portal.** *Business justification: explicitly out of scope per the Phase 2B changelog and a large undertaking (auth model, external-facing surface); correctly deferred, not a near-term gap.*
- **Reports live under `/api/procurement/requisitions/meta/reports/*` instead of `/api/procurement/suppliers/*`.** Purely an organizational/naming quirk, functionally reachable today. *Business justification: low — a future refactor convenience, not a user-facing problem.*

---

## 8. Roadmap

**Priority 1** (close correctness/compliance gaps in what already exists — small, surgical, reuses existing functions):
1. Enforce blacklist at the point of quotation entry and PO generation (reject or warn).
2. Add a "Deactivate" UI control on both platforms, writing to the already-supported `active` column via the existing `procurementSupplierUpdate`.
3. Resolve the `procurement-officer` blacklist-permission mismatch — either formally exclude it via `role_definitions` (documented) or grant it consistently with the rest of the page's permission.
4. Harden `procurementSupplierDelete`'s guard to also check `procurement_rfq_suppliers`/`procurement_quotations`, returning a clean `{ ok: false, error }` instead of a raw DB error.

**Priority 2** (close mobile/desktop parity gaps — wire up what already exists, no new backend work):
1. Mobile: wire the existing `remove()` hook to a delete action on `SupplierDetailScreen`.
2. Mobile: wire the existing `addContact()`/`addContract()` hooks to real add-forms (mirroring desktop's inline Manage-overlay forms).
3. Mobile: add the `preferred` checkbox to `SupplierFormScreen`.
4. Mobile: capture and send a blacklist reason from `SupplierDetailScreen`, matching desktop's mandatory-reason flow.
5. Add contract deletion (backend function + API/IPC + both UIs) — the one true "new capability" in this list, but it's a small, self-contained CRUD addition following the existing contract-update pattern exactly.

**Priority 3** (net-new enterprise capability — larger effort, needs its own design pass before implementation):
1. Supplier document/attachment upload (requires adding `multer` or equivalent, a new table, and storage strategy — out of scope for a quick add).
2. Structured payment-terms field on the supplier record, with migration of existing free-text values where feasible.
3. Supplier approval/onboarding workflow (would reuse the existing generic `procurement_approval_steps` table/`procurementApprovalAction` dispatcher pattern from the requisition workflow — architecturally straightforward, but a genuine new workflow stage needing its own review).
4. A real supplier detail *screen* on desktop (replacing the "Manage" modal) with contact/contract edit (not just add) — a UI-only investment once Priority 2's mobile parity work has established what the target feature set looks like on both platforms.

---

## 9. Architecture Review

- **No duplicated business logic**: confirmed. All 13 supplier functions plus the 2 report functions live exclusively in `db/services/data.js`; the mobile-api routes and Electron IPC handlers are both thin pass-throughs (`respond(res, await data.xxx(...))` / `(userId, args) => data.xxx(...)`), with zero business logic re-implemented in either transport layer.
- **Electron and Mobile use the same backend**: confirmed. Every one of the 13 supplier functions plus both report functions has a verified, correctly-matched route (mobile) and IPC channel (desktop) — no dead code, no orphaned handler, no naming mismatch between `main.js` and `preload.js` found in this audit.
- **Permissions enforced server-side**: confirmed, with a caveat. Every supplier mutation/read is gated inside `data.js` via `mustRole(...)` (or the hardcoded blacklist check) — the mobile-api route layer has **zero** `requireRoles()` calls for the entire procurement module (confirmed across all 5 route files), by explicit design (`mobile-api/server.js:194-196` comment: "Access enforced inside each data.js function"). This is consistent and correct as a pattern (server-side enforcement is genuinely present, not skipped), but it means there is no defense-in-depth at the route layer — a future bug inside `data.js`'s own role check would be the *only* safeguard. Desktop's `secureHandle` wrapper similarly only checks for a valid session, not a role, for the same reason.
- **Current backend functions are reusable**: confirmed and already demonstrated — `procurementQuotationsCompare` and `procurementReportSupplierPerformance` both reuse `blacklisted`/`preferred`/`rating` from the same `procurement_suppliers` table rather than re-querying or duplicating supplier state.
- **No unnecessary new tables required for Priority 1/2 work above.** `procurement_suppliers`, `procurement_supplier_contacts`, and `procurement_supplier_contracts` already have every column needed for the blacklist-enforcement, deactivation, and mobile-parity roadmap items. Only Priority 3's document-upload feature would need a new table (an attachments table), and only if that specific feature is undertaken.
- **`db/schema.sql` is stale for this entire module** — it contains zero references to `procurement_suppliers` or any other Procurement Management table (confirmed by grep; the only "procurement" hit in `schema.sql` is a comment header for the unrelated, older `poles_purchase_requests` workflow). `db/migrate.js` is the only accurate source of truth for this schema. This isn't a Phase 3 blocker, but any future engineer trusting `schema.sql` for this module will be misled — worth a housekeeping note, not a roadmap item.

---

## 10. Final Recommendation

**Implementation order**: Priority 1 (correctness/compliance) → Priority 2 (mobile parity) → Priority 3 (net-new capability), exactly as laid out in §8. The first two priorities are low-risk, additive, and reuse 100% of the existing schema and business-logic layer; Priority 3 items are the only ones that need genuine new design work and should not be started until 1 and 2 are settled.

**What can be reused as-is**: the entire `procurement_suppliers`/`procurement_supplier_contacts`/`procurement_supplier_contracts` schema, all 13 existing backend functions, the full API/IPC transport layer (route paths, IPC channel names, and their naming conventions), the shared UI component set on both platforms (`.card`/`.tbl`/`.badge`/`FormSelect`/`AppHeader`/toast/skeleton components), and the existing `xxxForDropdown` and `procurement_approval_steps` patterns established in Phase 2B if/when an approval workflow is added in Priority 3.

**What should be improved**: blacklist enforcement (currently cosmetic), the delete-guard's incomplete reference check, the undocumented `procurement-officer` blacklist exception, and — the single largest concrete gap found in this audit — the fact that three mobile hooks (`remove`, `addContact`, `addContract`) already exist, are fully functional against a working backend, and are simply never called from any screen. That last item alone would close most of the mobile/desktop parity gap in §5 with UI work only, no backend changes.

**What should NOT be changed**: the underlying schema (it already supports everything Priority 1/2 need), the "enforcement lives in `data.js`, not the route layer" architecture (it's consistent and correct, just worth keeping in mind as a single point of failure), and the shared-component-only CSS discipline (no supplier-specific stylesheet should be introduced — extend shared classes as Phase 2A already established).

**What should wait for later phases**: document/attachment upload (needs a new dependency, table, and storage-strategy decision), structured payment terms (needs a data-migration plan for existing free-text values), and any supplier approval/onboarding workflow (needs its own design pass even though the underlying `procurement_approval_steps` mechanism already exists and is reusable) — all three are correctly Priority 3, not blockers for the nearer-term correctness and parity work.
