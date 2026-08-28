# Supplier Relationship Management (SRM) — Phase 4 Completion Report

**Date:** 2026-07-29
**Scope:** Contracts, Compliance, Documents, Communications, Improvement Plans, Executive SRM Dashboard, and 7 SRM reports — on Electron and Mobile, reusing existing permissions/scheduler/notification/audit/chart/export infrastructure.

---

## 1. Executive Summary

Phase 4 adds a strategic Supplier Relationship Management layer on top of the existing Procurement module (suppliers, requisitions, RFQ/PO, Supplier Intelligence). It was implemented per the approved design from `SUPPLIER_RELATIONSHIP_PHASE4_AUDIT.md`:

- **4 new tables**: `supplier_documents`, `supplier_compliance`, `supplier_communications`, `supplier_improvement_plans` — plus 7 additive columns on the existing `procurement_supplier_contracts` table. No existing table was redesigned.
- **Contract lifecycle**: contracts now always start `draft`; the only path to `active` is a governance-gated approval; renewal creates a new linked contract row (`renewed_from_id`), which also serves as the contract's history trail — no separate history table was needed.
- **Compliance**: a fixed 7-type checklist per supplier (Tax Certificate, Business Registration, Insurance, Quality Certifications, Environmental Compliance, Safety Certificates, NDA), with live-computed status (`active`/`expiring`/`expired`/`missing`/`waived`).
- **Document Center**: file bytes live on `mobile-api`'s filesystem (`mobile-api/uploads/suppliers/<supplierId>/`); metadata lives in Postgres. Electron reaches this the same way Mobile does — by calling `mobile-api` over HTTP — since Electron and mobile-api are separate processes with no shared disk.
- **Communications & Improvement Plans**: full CRUD, supplier-scoped and fleet-wide.
- **Executive SRM Dashboard + 7 reports**: contract/compliance/document/communication/improvement-plan registers, an expiring-contracts view, and an executive summary — all served by one `srmReport` dispatcher.
- **Automated reminders**: a new scheduler task (`_schedSrmReminders`) checks contract and compliance expiry at 90/60/30/7-day thresholds every 15-minute tick, reusing the existing `_schedulerTick()`/`pushNotification()` infrastructure.
- **Permissions**: no new permission page-id was created. Every SRM function gates on the two existing procurement permissions — `procurement-suppliers` (routine CRUD, granted to Procurement Officer) and `procurement-suppliers-governance` (contract approval, compliance waiver — Admin/CEO/Procurement Manager only).
- **UI**: the supplier profile (previously a single ~650-line scrolling overlay/screen) is now a 7-tab profile — Overview, Contracts, Compliance, Documents, Communications, Improvements, Intelligence — on both Electron and Mobile.

All new/changed files pass `node --check` and `tsc --noEmit`. The migration has since been run against the live database and a full backend functional smoke test (35 checks) plus a live scheduler tick both passed — see §5.

---

## 2. Files Changed

### Database
- `db/migrate.js` — 4 new tables, 7 additive columns + 1 index on `procurement_supplier_contracts`, all via `CREATE TABLE IF NOT EXISTS` / `ADD COLUMN IF NOT EXISTS`.

### Backend (single source of truth)
- `db/services/data.js` — extended `procurementSupplierContractCreate`/`Update` in place; added the full SRM function set (contracts register/approve/renew, compliance list/upsert/register, documents register/list/get/deactivate/register, communications CRUD + register, improvement plans CRUD + register, `srmExecutiveDashboard`, `srmReport`); added `_schedSrmReminders` and wired it into `_schedulerTick()`'s task array; added all new functions to `module.exports`.

### Mobile API (thin REST wrapper — no business logic)
- `mobile-api/routes/srm.js` *(new)* — contracts/compliance/communications/improvement-plans/dashboard/reports routes.
- `mobile-api/routes/supplierDocuments.js` *(new)* — multer-based upload/list/download/delete/register routes; the one place in this codebase that writes file bytes to disk.
- `mobile-api/server.js` — mounted both routers under `/api/srm` and `/api/srm/documents`.
- `mobile-api/package.json` — added `multer@^2.2.0` (installed at `^2.0.0`, auto-upgraded past a flagged 1.x vulnerability).

### Electron (desktop)
- `electron/main.js` — `secureHandle` wrappers for every SRM function; a document-upload/download proxy (`fetch`/`FormData` to `mobile-api`, authenticated with a short-lived service JWT minted from the shared `JWT_SECRET`); a `srm-documents:pick-file` native file-picker handler.
- `electron/preload.js` — `window.UFCL.srm*` exposures for every new IPC channel.
- `package.json` — added `jsonwebtoken@^9.0.3` (needed for the service-JWT minting above; the root Electron project never made an authenticated HTTP call before this phase).

### Desktop UI
- `renderer/app.js` — `openSupplierManageOverlay` rebuilt as a 7-tab profile (lazy-loaded per tab, mirroring the existing report-tab pattern); two new cross-supplier overlays, `openContractRegisterOverlay()` and `openComplianceCenterOverlay()`; a new "Supplier Relationship Management" KPI section on the Procurement Dashboard; a new "SRM" tab in Procurement Reports (7 report types, generic-column CSV export via the existing `execExport()`); `openOverlay()` gained an optional 5th `extraClass` parameter (backward compatible — all existing callers unaffected).
- `renderer/styles.css` — `.ow-wide` (wider overlay variant for the tabbed profile and register overlays), `.smo-tabs`/`.smo-tab` (tab-bar chip styling, reusing existing CSS custom properties only).

### Mobile
- `mobile/src/types/api.ts` — extended `ProcurementSupplierContract`; added all SRM types (`SrmComplianceListItem`, `SrmComplianceMatrixRow`, `SrmDocument`, `SrmCommunication`, `SrmImprovementPlan`, `SrmDashboard`, `SrmReportResult`, etc.).
- `mobile/src/api/endpoints.ts` — SRM endpoint paths (contracts/compliance/communications/improvement-plans/dashboard/reports/documents).
- `mobile/src/api/client.ts` — added `upload()` (multipart) and `downloadFile()` (authenticated file download to cache dir, for use with `expo-sharing`).
- `mobile/src/hooks/useSrm.ts` *(new)* — every SRM query/mutation hook.
- `mobile/src/screens/procurement/SupplierDetailScreen.tsx` — rebuilt as a 7-tab profile (same tab set as desktop).
- `mobile/src/screens/procurement/SrmDashboardScreen.tsx`, `ContractRegisterScreen.tsx`, `ComplianceCenterScreen.tsx` *(new)*.
- `mobile/src/screens/procurement/ProcurementDashboardScreen.tsx` — added an "SRM Dashboard" quick-access shortcut.
- `mobile/src/screens/procurement/ProcurementReportsScreen.tsx` — added an "SRM" report tab (7 types, `Share.share()` CSV export).
- `mobile/src/navigation/types.ts`, `mobile/src/navigation/stacks/ProcurementStack.tsx` — new screen params + stack registration.
- `mobile/package.json` — added `expo-document-picker@~12.0.2` (SDK 51-compatible; needed for the Document Center's file-picker flow — `expo-file-system`/`expo-sharing` were already dependencies and were reused unchanged).

No files outside this list were modified.

---

## 3. Architecture Decisions

1. **Document storage — the cross-platform reachability problem.** The approved design says documents live on "the server filesystem," but Electron talks directly to Postgres via `data.js` and has never called `mobile-api`; Mobile can only ever reach files through `mobile-api`'s REST server. Resolution: `mobile-api`'s filesystem (`mobile-api/uploads/suppliers/<supplierId>/`) is the one canonical store both platforms can reach. Electron proxies uploads/downloads to `mobile-api` over HTTP using Node's built-in `fetch`/`FormData` (available natively in Electron 37 / Node 22, so no new HTTP client dependency), authenticating with a short-lived (5-minute) service JWT it mints itself from the same `JWT_SECRET` `mobile-api` already verifies against. This is the **first and only** place Electron calls `mobile-api`; every other Electron feature still talks to Postgres directly via `data.js`.
2. **Contract governance as a real gate, not a formality.** `procurementSupplierContractCreate` now unconditionally forces `status='draft'` regardless of what's in the payload, and `procurementSupplierContractUpdate` explicitly blocks a direct transition to `active`. The only way to `active` is `procurementSupplierContractApprove`, which requires the `procurement-suppliers-governance` permission and a non-empty reason. This makes "Procurement Officer cannot perform strategic contract approval" an enforced invariant, not a UI convention.
3. **Contract renewal as history.** Rather than a separate contract-history table, `procurementSupplierContractRenew` inserts a new contract row linked via `renewed_from_id` and marks the old row `renewed`. The renewal chain itself is the history — reachable by following `renewed_from_id` backward from any contract.
4. **One document table, two optional links.** `supplier_documents` has independent nullable `contract_id` and `compliance_id` foreign keys, letting one document system serve general attachments, contract documents, and compliance certificates without three separate tables.
5. **No new NAV/page entries on desktop.** The approved permission model reuses `procurement-suppliers`/`procurement-suppliers-governance` and explicitly forbids new permission page-ids. Desktop's sidebar visibility is keyed on an exact `STORAGE.pages` string match per NAV item id — adding a new top-level NAV entry would have required a matching new permission grant, contradicting that constraint. Instead, Contract Register and Compliance Center are cross-supplier **overlays** reached via links on the existing Procurement Dashboard page (same pattern already used for "Compare Suppliers"), and an "SRM Overview" KPI section was added directly to the Procurement Dashboard page. All three reuse the dashboard's/suppliers' already-granted permissions with zero new grants. Mobile's role model is coarser (whole-navigator-per-role), so its equivalent screens were added directly to the existing `ProcurementStack`.
6. **Reused, not duplicated, infrastructure.** The scheduler task lives in the existing `_schedulerTick()` array (no second scheduler). Notifications go through the existing `pushNotification()`. CSV export goes through the existing `execExport()` (desktop) / `Share.share()` (mobile) — the SRM report CSV builder is generic (derives columns from whatever keys each report's rows actually have) rather than seven hand-written exporters. Compliance and contract expiry status both go through one shared `_expiryStatus()` date-math function.

---

## 4. UI/CSS Improvements

- **Desktop**: two new CSS rules only — `.ow-wide` (a wider overlay variant, reusing the existing `.ow` box-shadow/border/radius tokens) and `.smo-tabs`/`.smo-tab` (a pill tab bar using the existing `--g-soft`/`--border`/`--surf`/`--t2` custom properties). No new colors, fonts, or design tokens were introduced.
- **Mobile**: the new tab bar in `SupplierDetailScreen` and the SRM screens reuse the existing `Colors`/`Spacing`/`Typography`/`Radius`/`Shadow` theme tokens exclusively; no new theme values were added.
- **Charts**: the SRM Dashboard (desktop and mobile) reuses existing chart primitives — desktop's hand-rolled inline-SVG helpers, mobile's `react-native-gifted-charts`-based components already used elsewhere. No new charting dependency on either platform.

---

## 5. Verification Results

| Check | Result |
|---|---|
| `node --check` — `db/migrate.js`, `db/services/data.js`, `mobile-api/server.js`, `mobile-api/routes/srm.js`, `mobile-api/routes/supplierDocuments.js`, `electron/main.js`, `electron/preload.js`, `renderer/app.js` | ✅ Pass (all files) |
| `npx tsc --noEmit` (mobile) | ✅ Pass, zero errors, after every SRM file addition |
| All new `data.js` SRM functions present in `module.exports` | ✅ Verified via `require()` + function-type check (24/24 present) |
| Permission reuse — no new `mustRole` page-id introduced by the SRM section | ✅ Verified via grep — only `procurement-suppliers` and `procurement-suppliers-governance` appear |
| Scheduler — `_schedSrmReminders` registered in `_schedulerTick()`'s task array | ✅ Verified |
| `npm audit` — new dependencies (`multer`, `jsonwebtoken`, `expo-document-picker`) | ✅ No vulnerabilities attributable to these three packages; pre-existing findings are all in `electron`/`electron-builder`/`electron-updater` (devDependency toolchain, unrelated to this phase) |
| Electron ↔ Mobile parity — same 7-tab structure, same SRM function set exposed on both platforms | ✅ By construction (both call the identical `data.js` functions) |
| Live migration run (`node db/migrate.js`) | ✅ Ran clean — `procurement tables ready`, `procurement roles seeded`, `procurement page permissions updated`, `Migration complete.` — all 4 SRM tables and all 7 additive contract columns confirmed present via `information_schema` query |
| Backend functional smoke test against the live database, via throwaway QA accounts (`_qa_p3b_officer` = procurement-officer, `_qa_p3b_mgr` = procurement-manager, reactivated for the test then deactivated again afterward) | ✅ **35/35 checks passed** — see breakdown below |
| Live scheduler tick, including the new `_schedSrmReminders` task, run end-to-end via `startScheduler()` and confirmed through the `scheduler_runs` table | ✅ Completed in 5997ms with 0 errors |
| Interactive Electron UI walkthrough — isolated instance (own profile dir, own remote-debugging port, never touched the user's real running app), driven via Chrome DevTools Protocol, logged in as a scoped QA account | ✅ **Passed** — see breakdown below |

**Interactive UI walkthrough breakdown:**
- Login, bootstrap, and Procurement Dashboard render correctly for a `procurement-manager` account.
- New "Supplier Relationship Management" KPI section renders on the Procurement Dashboard with live data (screenshot-verified).
- "Contract Register →" and "Compliance Center →" links open their overlays with live, correct, filterable data (screenshot-verified).
- Supplier profile overlay: all 7 tabs (Overview, Contracts, Compliance, Documents, Communications, Improvements, Intelligence) click through and render live smoke-test data correctly, including the Compliance tab's color-coded status pills and the Intelligence tab's score gauge/charts/purchase history (screenshot-verified for every tab).
- SRM report tab: all 7 report types render, including the generic-column table renderer and the Executive Summary KPI cards; the CSV Export button correctly hides itself for Executive Summary (screenshot-verified).
- **Bug found and fixed during this walkthrough**: `pg` returns `DATE` columns as JS `Date` objects (confirmed empirically — no custom type parser is registered), and the desktop SRM code interpolated several of them directly, producing a verbose `Date.toString()` instead of a short date, and — more seriously — silently breaking the date-picker pre-fill in every "Edit" form (`String(dateObj).slice(0,10)` does not yield a valid `YYYY-MM-DD`). Added a `_fmtDate()` helper (also had to correct it once: `pg`'s date parser turned out to construct the JS Date at *local* midnight, not UTC midnight, confirmed by comparing `getFullYear/getMonth/getDate` vs `getUTCFullYear/getUTCMonth/getUTCDate` against a known input) and applied it at every date-interpolation site across `openSupplierManageOverlay`, `openContractRegisterOverlay`, `openComplianceCenterOverlay`, and the SRM report table/CSV export. Verified fixed by reloading the live window and re-checking the rendered values. This bug pattern pre-dates Phase 4 (the original Phase 3 Contracts tab has the same latent issue) but was only fixed within the code this phase touched — see Known Limitations.
- **Document upload/download**: not exercised end-to-end in this pass — see Known Limitations for why, and the three independent proofs used instead to verify the underlying code is correct.

**Smoke test breakdown (all passed):**
- Contract: create (officer, defaults to `draft` regardless of payload) → approve denied for officer → approve OK for manager (status → `active`) → renew OK for manager (new row `active`, linked via `renewed_from_id`; old row → `renewed`) → cross-supplier register works.
- Compliance: upsert OK for officer → waive denied for officer → waive OK for manager → per-supplier list always returns all 7 checklist types → fleet-wide register works.
- Documents: register (metadata) → list → deactivate (soft delete) → fleet-wide register works.
- Communications: create → update → list → fleet-wide register works.
- Improvement Plans: create → update to `completed` (auto-sets `closed_at`) → verified in DB → fleet-wide register works.
- `srmExecutiveDashboard`: returns all 8 KPIs.
- `srmReport`: all 7 report types (`contract_register`, `expiring_contracts`, `compliance_status`, `document_register`, `communication_log`, `improvement_plans`, `executive_summary`) return successfully with the expected `rows`/`summary` shape.

---

## 6. Known Limitations

- **Document upload/download not exercised end-to-end through the running Electron UI.** During the interactive walkthrough, calling the real `srm-documents:upload` IPC path from the QA Electron instance failed with `Invalid token.` from `mobile-api`. Root-caused to a **local-testing-topology artifact, not a Phase 4 code defect**: this dev machine's `.env` has `PGHOST=192.168.1.5` pointing at the shared LAN server (documented in `project_mobile_api`/`project_phase12` memory as the real production `mobile-api` host), so `_srmApiBase()` — by design reusing `PGHOST`, since in the real deployment topology `mobile-api` and Postgres are co-located on that same host — correctly routed the QA instance's upload call to that remote host. But the `mobile-api` instance actually reachable there predates this phase (no `/api/srm/*` routes yet) and evidently has a different `JWT_SECRET` than this dev machine's local `.env`. The document-upload/download code itself was proven correct through three independent checks instead: (1) the full backend smoke test calling `supplierDocumentRegister`/`List`/`Deactivate` directly — all passed; (2) an in-process cross-check — a token signed with the root project's `jsonwebtoken` copy was successfully verified by `mobile-api`'s own nested `jsonwebtoken` copy using the same secret; (3) a real HTTP round-trip from a plain Node script through a locally-started `mobile-api` instance via `127.0.0.1`/`localhost` — both succeeded with a correct `200` envelope. **Action required before release**: once the LAN `mobile-api` host has this phase's code deployed (with a `.env` whose `JWT_SECRET` matches what Electron installs are configured with), re-run the upload/download walkthrough end-to-end against that real host.
- **Contract Register / Compliance Center are overlays, not full desktop pages.** This was a deliberate scope decision (§3.5) to avoid introducing a new permission page-id, not an oversight — flagging it explicitly since the original spec's wording ("Contract Register page…") could otherwise be read as requiring a dedicated NAV/page.
- **No dedicated fleet-wide screens for Documents/Communications/Improvement Plans beyond the Reports tab.** Per-supplier CRUD for all three lives in the supplier profile tabs; fleet-wide visibility is provided via the corresponding SRM report (Document Register / Communication Log / Improvement Plans) rather than three additional near-duplicate list screens. This mirrors the spec's explicit allowance for Communications ("or folded into supplier detail tabs") and was extended to the other two for the same reason — avoiding duplicate list-screen systems.
- **No file preview.** Document Center supports upload/download/delete/version number/expiry tracking, but not in-app preview (PDF/image rendering) on either platform — download-then-open is the current flow.

---

## 7. Recommendations

1. **Before any commit**: deploy this phase's `mobile-api` changes to the LAN host at `PGHOST`/`MOBILE_API_PORT` (with a matching `JWT_SECRET`), then re-run the document upload/download walkthrough against it — everything else (Electron UI, all 7 supplier-profile tabs, Contract Register/Compliance Center overlays, the SRM report tab, the full backend) has been verified live, interactively, this pass.
2. Also do a Mobile (React Native) interactive walkthrough — this pass verified Electron interactively and Mobile only by code review/type-check, matching how the mobile code calls the identical, already-verified backend functions.
3. Consider a v1.1 follow-up: in-app document preview (at minimum images and PDFs) once the base Document Center has been used in production and real usage patterns are known.
4. Consider promoting Contract Register / Compliance Center from overlays to full NAV pages in a future phase **if** a genuine need for a distinct `procurement-suppliers` sub-permission emerges — until then, the overlay approach keeps the permission model exactly as specified.
5. The generic-column SRM report renderer (desktop and mobile) trades a small amount of visual polish (raw column names, no per-report custom formatting) for zero-duplication across 7 report types. If a specific report needs bespoke formatting later, add it as a targeted override rather than reintroducing seven hand-written renderers.
6. The `_fmtDate()` fix (§5) was applied only within Phase 4's own code. The same latent `pg`-returns-Date-objects issue exists in the pre-existing Phase 3 Contracts tab and possibly elsewhere in `renderer/app.js` — worth a dedicated sweep in a future cleanup pass, since it's out of scope for this phase to fix code it didn't touch.
7. The QA smoke test left tagged test data on the existing `_QA Supplier Ltd` (id 1) fixture — one renewed contract pair, two compliance records (Insurance, NDA-waived), one closed improvement plan, one communication entry, and one archived (soft-deleted) document — consistent with how prior phases' QA data was already present on that same fixture. No cleanup was performed beyond deactivating the QA user accounts, since this data is clearly tagged and harmless to leave, matching existing convention.
