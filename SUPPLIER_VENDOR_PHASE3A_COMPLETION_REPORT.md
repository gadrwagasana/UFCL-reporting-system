# Supplier & Vendor Management — Phase 3A Completion Report

**Scope discipline maintained throughout:** zero changes to `db/services/data.js`, `db/migrate.js`, any `mobile-api/routes/*.js` file, `mobile-api/server.js`, `electron/main.js`, or `electron/preload.js` — confirmed via `git status` at the end of this phase (only `renderer/app.js`, `renderer/styles.css`, and 4 files under `mobile/src/{hooks,screens/procurement}` changed). Every feature below calls a backend function that already existed and was already fully wired end-to-end (route + IPC) per `SUPPLIER_VENDOR_PHASE3_AUDIT.md` §1/§9 — this phase is UI-only, on both platforms, closing the mobile/desktop parity gap the audit identified as the largest concrete finding: three mobile hooks (`remove`, `addContact`, `addContract`) already existed and worked against a live backend but were never called from any screen.

---

## 1. Mobile Supplier Delete

**Backend reused, unchanged**: `procurementSupplierDelete` (already existed; guard against in-use suppliers untouched).

**Mobile** (`mobile/src/screens/procurement/SupplierDetailScreen.tsx`): added a full-width "Delete supplier" button at the bottom of the detail screen. Tapping it opens a native `Alert.alert` confirmation ("This cannot be undone."), calls the existing `remove()` action from `useProcurementSupplierActions()` (previously exported, never called by any screen — see audit §5/§8 Priority 2 item 1), shows a success toast, and navigates back to the list on success. On failure (e.g. the backend's PO-reference guard rejecting the delete), the server's error message is surfaced via a toast rather than silently failing.

**Parity**: matches desktop's existing row-level delete (confirm dialog → `procurementSupplierDelete` → toast) exactly in outcome; the only difference is presentation (desktop: row action + modal confirm; mobile: bottom button + native Alert), which follows each platform's own established confirmation-dialog convention rather than inventing a new one.

**Permission gating**: no client-side role gate was added beyond what already exists — same as desktop, delete is available to anyone who can reach the supplier detail screen (i.e., anyone with the `procurement-suppliers` page permission), because the backend gates delete with the exact same `mustRole` check as every other supplier CRUD action (there is no narrower delete-specific permission on either platform, and this phase did not invent one).

---

## 2. Supplier Contacts

**Backend reused, unchanged**: `procurementSupplierContactsList`, `procurementSupplierContactCreate`, `procurementSupplierContactUpdate`, `procurementSupplierContactDelete` — all pre-existing, all already reachable via mobile-api and Electron IPC per the audit.

**Mobile** (`SupplierDetailScreen.tsx`): the Contacts card now has an "Add" link (opens a new `ContactFormModal` — Name*, Role, Phone, Email, Primary-contact switch) and, per contact row, an edit-pencil icon (reopens the same modal pre-filled, saves via the new `updateContact` hook) and a delete-trash icon (native confirm, then the new `removeContact` hook). Previously this card was strictly display-only.

**Desktop** (`renderer/app.js`, `openSupplierManageOverlay`, line 13468): the "Manage Supplier" overlay's Contacts table previously only supported Add (no edit/delete, per the audit). To reach genuine cross-platform parity — the phase's stated objective, not just a mobile catch-up — added an edit-pencil and delete-trash action per contact row, calling the same, previously-unused-from-the-UI `procurementSupplierContactUpdate`/`procurementSupplierContactDelete` functions.

**New hook methods** (`mobile/src/hooks/useProcurementSuppliers.ts`): `updateContact(supplierId, contactId, payload)` and `removeContact(supplierId, contactId)`, following the exact shape/invalidation pattern of the pre-existing `addContact`.

---

## 3. Supplier Contracts

**Backend reused, unchanged**: `procurementSupplierContractsList`, `procurementSupplierContractCreate`, `procurementSupplierContractUpdate`. **No delete function was added** — none exists in `data.js`, and per the explicit Phase 3A instruction this phase does not invent one.

**Mobile** (`SupplierDetailScreen.tsx`): the Contracts card gained an "Add" link and, per contract row, an edit-pencil icon — both open a new `ContractFormModal` (Contract Ref*, Start Date / End Date via the existing shared `DatePickerField` component, Status, Terms). No delete action is rendered anywhere for contracts, matching the backend's actual capability.

**Desktop** (`openSupplierManageOverlay`): the Contracts table previously only supported Add. Added an edit-pencil action per row (no delete, same reasoning as above), reusing `procurementSupplierContractUpdate`. The edit form additionally exposes **Status** and **Terms** fields that the existing Add-Contract form never collected (the backend's `Create`/`Update` functions both accept them; only the Add form's UI omitted them) — both left as free-text inputs rather than a fixed dropdown, since no `CHECK` constraint or enum exists on `procurement_supplier_contracts.status` in the schema and inventing one would be a business-rule change outside this phase's scope.

**New hook method**: `updateContract(supplierId, contractId, payload)` in `useProcurementSuppliers.ts`.

---

## 4. Preferred Supplier

**Backend reused, unchanged**: `procurementSupplierCreate`/`Update` already accepted `preferred` — desktop's form already had the checkbox; mobile's did not.

**Mobile** (`SupplierFormScreen.tsx`): added a `preferred` state variable (seeded from `existing?.preferred` when editing) and a labeled `Switch` toggle ("Preferred supplier", with a one-line hint about what it affects), styled identically to the existing Active-toggle pattern already used in `WorkshopFormScreen.tsx` (same `trackColor`/`thumbColor` values) rather than introducing a new toggle visual. Included in both the create and update payloads.

**Desktop**: unchanged — the checkbox already existed.

---

## 5. Blacklist Reason

**Backend reused, unchanged**: `procurementSupplierToggleBlacklist(userId, supplierId, blacklisted, reason)` already accepted and stored a `reason`; desktop already required one when blacklisting (mandatory-reason overlay). Mobile called this same function but never collected or sent a reason, even when blacklisting.

**Mobile** (`SupplierDetailScreen.tsx`): replaced the previous single always-immediate blacklist toggle with: unblacklisting still goes through a one-tap `Alert.alert` confirm (matching desktop's one-click "remove blacklist" behavior — no reason needed either platform, since the backend doesn't require one for that direction), while blacklisting now opens a new `BlacklistReasonModal` — a required, validated multi-line text field ("Reason is required." inline error if empty) — before calling `toggleBlacklist(id, true, reason)`. This is a direct behavioral fix, not just a UI addition: the API call now sends the same data desktop has always sent.

**Desktop**: unchanged — this behavior already existed; verified still correct while making the contacts/contracts changes above (`renderer/app.js` line ~13780, the `sup-blacklist` handler).

**Parity achieved**: both platforms now require and transmit a reason under identical conditions, calling the identical backend function with the identical argument shape.

---

## CSS / UI Modernization

Every change below reuses existing design-system primitives; nothing introduces a new visual language on either platform.

**Desktop**
- Manage-overlay contact/contract tables gained a `row-actions`-styled actions column, matching the main Suppliers list's row-action buttons exactly (same `.bs1` icon-button pattern, same red styling for destructive actions).
- **Fixed a pre-existing CSS scoping bug** while doing this: `table.tbl .row-actions{display:flex;gap:5px;justify-content:flex-end}` in `renderer/styles.css` only ever matched `.tbl` tables, not `.dt` tables — but `.row-actions` is already used inside `.dt` tables on several other pages (Requisitions, RFQ, Purchase Orders, Goods Receipt, Invoices — confirmed via grep, not just the Suppliers overlay). Broadened the selector to `table.tbl .row-actions,table.dt .row-actions` — a backward-compatible, additive fix that also corrects the same latent bug on those other pages, not just Suppliers.
- Extended the shared `procFilterBarHtml()` helper with an optional `extraHtml` parameter (defaults to `''`, so all 6 other existing callers are byte-identical in behavior) rather than building a second, bespoke filter bar just for Suppliers.
- New "Preferred" and "Blacklisted" quick-filter toggles use the pre-existing `.filter-chip`/`.filter-chip.active` classes (already defined in `styles.css` from Phase 2A, previously unused by any page) rather than a new toggle-button style.
- Toast, skeleton loading (`skeletonTableRows`), and the sticky `.page-head` were all already present and correct on this page — confirmed while auditing, left untouched.

**Mobile**
- New `BlacklistReasonModal`/`ContactFormModal`/`ContractFormModal` all reuse the exact bottom-sheet visual language already established by `FormSelect.tsx` (`Colors.overlay` backdrop, `Radius.xl` top corners, `Shadow.lg`) rather than introducing a new modal style.
- Contract date fields reuse the existing shared `DatePickerField` component (already used elsewhere in the app) instead of a raw text input.
- The "Preferred supplier" switch reuses the exact toggle-row pattern (colors, spacing, layout) already established in `WorkshopFormScreen.tsx`'s Active toggle.
- New supplier-list filter chips reuse the same visual vocabulary as the existing `FilterBottomSheet`'s `Chip` component (border/radius/active-state colors) without a functional dependency on that component, since `FilterBottomSheet` is tightly coupled to the Global Search feature's own filter types and reusing it directly would have required changing unrelated code.
- All new success/error feedback goes through the existing shared `showToast()` (`stores/toastStore.ts`) — no new feedback mechanism.

---

## Search & Filter (Supplier List)

Both platforms now offer, on the Suppliers list: **Search** (name/category/phone — unchanged), **Status filter** (All/Active/Blacklisted/Inactive — desktop unchanged; added to mobile as chip group), **Preferred filter** (new, both platforms — quick toggle), **Blacklist filter** (new, both platforms — quick toggle, independent of the Status dropdown/chips for a one-tap shortcut), and **Sort** (desktop: existing clickable column headers, unchanged; mobile: new tap-to-cycle chip — Name → Category → Rating).

---

## Permissions

No permission rule was changed, added, bypassed, or relaxed anywhere in this phase. Specifically:
- The mobile blacklist button is now gated to `['admin', 'ceo', 'procurement-manager']` — a client-side mirror of the exact hardcoded array already present in `procurementSupplierToggleBlacklist` (`db/services/data.js`), reproducing the same asymmetric exclusion of `procurement-officer` that the audit flagged (§4) as an inconsistency. This phase deliberately did **not** resolve that inconsistency (fixing the underlying business rule was explicitly out of scope — see audit §8 Priority 1, not Priority 2/3A); it only ensured mobile faithfully matches the current, existing rule instead of silently omitting the restriction.
- Delete/contacts/contracts actions on both platforms remain gated purely by whether the user's role has the `procurement-suppliers` page permission at all (server-enforced via `mustRole` inside every `data.js` function, unchanged) — no new client-side permission logic was introduced.

---

## Success Feedback

Every successful operation added or touched in this phase shows a toast on both platforms: supplier delete, contact add/edit/delete, contract add/edit, blacklist/unblacklist. All reuse the existing shared toast infrastructure (`showToast()` on both platforms) — no new feedback mechanism was built.

---

## Files Changed

| File | Nature of change |
|---|---|
| `renderer/app.js` | Contact edit/delete + contract edit UI in `openSupplierManageOverlay`; Preferred/Blacklisted filter chips + wiring in `renderProcurementSuppliers`; `procFilterBarHtml()` extended with optional `extraHtml` |
| `renderer/styles.css` | One-line `.row-actions` selector fix (see CSS section) |
| `mobile/src/hooks/useProcurementSuppliers.ts` | Added `updateContact`, `removeContact`, `updateContract` |
| `mobile/src/screens/procurement/SupplierDetailScreen.tsx` | Delete button, blacklist-reason modal, contact CRUD UI, contract add/edit UI, preferred banner |
| `mobile/src/screens/procurement/SupplierFormScreen.tsx` | Added Preferred switch |
| `mobile/src/screens/procurement/SuppliersListScreen.tsx` | Added Status/Preferred/Blacklisted filter chips + Sort |

No files under `db/`, `mobile-api/`, or `electron/` were touched.

---

## Known Limitations Remaining

Carried forward from the audit, explicitly not addressed in this phase (all correctly out of scope per the Phase 3A brief):
- Blacklist status is still not enforced downstream (a blacklisted supplier can still be quoted/PO'd) — audit Priority 1, not this phase.
- No way to deactivate a supplier (`active=false` has no UI trigger on either platform) — audit Priority 1, not this phase.
- The `procurement-officer`/blacklist hardcoded-exclusion inconsistency still exists in the backend — this phase mirrored it faithfully on mobile rather than fixing it.
- Contract deletion remains unsupported on both platforms, by design, per explicit instruction.
- No document/attachment upload — explicitly out of scope.
- Desktop's Suppliers list still uses one shared "Access denied" panel for every non-`ok` list-load response (not just genuine permission denials) — a systemic, pre-existing pattern across multiple procurement pages, not touched in this phase to avoid an inconsistent one-off fix.
- Desktop's Suppliers list still shows one generic empty-state message for both "genuinely no suppliers" and "no rows match your filters" — same systemic-pattern reasoning as above.

---

## Verification Results

- `node --check renderer/app.js` — pass.
- `cd mobile && npx tsc --noEmit` — pass, zero errors (one style-array type error was introduced and fixed during development: `error && sheetStyles.inputError` needed to become `error ? sheetStyles.inputError : null`).
- `git status` confirms zero changes outside `renderer/app.js`, `renderer/styles.css`, and the 4 listed `mobile/src/` files — no backend, API, IPC, or migration files touched.
