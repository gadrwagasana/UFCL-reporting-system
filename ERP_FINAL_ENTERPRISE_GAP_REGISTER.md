# ERP Final Enterprise Cross-Department Completion Gate — Gap Register

This is a **confirmatory, final-gate audit**, not a greenfield one. The ERP has already been
through numerous full and partial completion/hardening programs (Procurement full audit + 3
phases, Logistics 3 phases, Stock & Inventory 4 phases, Sales 2 phases, Fleet 3 phases,
Mechanician 4 phases, Harvesting 4 phases, Sawmill 3 phases + a redesign, Nyanza/VAT rebuilt
from scratch, Poles 2 phases, HR 2 phases, Payroll 3 phases, Finance built + extended twice, and
at least 5 prior full-ERP completion/hardening gates). This pass's job was to find what those
passes missed — expect a short list, not a long one. Four parallel read-only audits (navigation/
permission/notification routing; commercial-operations cluster; production cluster; HR/
Attendance/Payroll/Finance) confirmed the overwhelming majority of the ERP is already correct.
**7 genuine defects were found and fixed. 3 smaller mobile-UI parity gaps were found and
disclosed (not built — see §Scoped Out).**

Format: ID / Severity / Area / Finding / Evidence / Disposition.

---

## FIXED THIS PASS

### G-01 — Workshop Isolation gap in `maintenanceJobAssign` — FIXED
- **Severity**: P1 (cross-workshop write, not just a read leak).
- **Area**: Mechanician / Maintenance Jobs.
- **Finding**: Unlike every sibling function in the same file
  (`maintenanceJobDetail`/`Transition`/`LabourAdd`/`ProductionImpactCreate`, all of which check
  `isWorkshopRestricted`), `maintenanceJobAssign` had no such check — a workshop-restricted
  `machines`/`maintenance-jobs` holder could reassign and re-route ANY workshop's maintenance
  job to a technician of their choosing, flipping its status.
- **Evidence**: `db/services/data.js` (`maintenanceJobAssign`), reachable via IPC
  (`electron/main.js:657`) and REST (`mobile-api/routes/maintenanceJobs.js:66`).
- **Fix**: added the identical guard `maintenanceJobTransition` already uses, immediately after
  loading the job.
- **Live-verified**: a real mechanician account (workshop 3) temporarily scoped to workshop 4
  attempted to assign real job #6 (workshop 3) — correctly denied (`Access denied`), job state
  unchanged before/after. Account restored to workshop 3.

### G-02 — Real cross-workshop data leak in `timberInventoryList` — FIXED
- **Severity**: P1 (financial/production data leak across workshops).
- **Area**: Sawmill / Timber Inventory.
- **Finding**: This large, multi-query reporting function had **no** `isWorkshopRestricted`
  check anywhere, yet `mobile-api/routes/timberInventory.js`'s own `ALLOWED` list deliberately
  grants it to workshop-restricted roles (`sawmill-leader`, `sawmill-supervisor`, `vat-leader`)
  — they were seeing every other workshop's production/cost/sales/reconciliation figures mixed
  into what should have been their own.
- **Evidence**: `db/services/data.js` (`timberInventoryList`).
- **Fix**: real, per-query scoping, not a blanket deny (a "company-wide only, access denied"
  fallback would have taken away a capability those roles were deliberately granted). Uses the
  exact precedent already established elsewhere in this codebase (`dispatchReview`'s own fix):
  swapped `mv_stock_summary` for its already-existing per-workshop sibling
  `mv_stock_by_workshop` (identical columns, confirmed live) when the caller is restricted;
  added `workshop_id`/`warehouse_id` filters to every cost/sales/production sub-query
  (`daily_logs`, `sales_orders`, `harvest_logs` all carry `workshop_id` directly, confirmed
  live); the 3-location comparison tables (finished-timber-flow, value-by-location) keep their
  pivot shape but zero out the other two locations' figures in JS for a restricted caller
  rather than being blocked outright.
- **Live-verified**: company-wide call (admin) still returns all 3 warehouses; a real restricted
  `sawmill-leader` account (workshop 3) now correctly gets exactly 1 warehouse row instead of 3,
  and zeroed cross-location flow figures.

### G-03 — Scheduler security/governance alerts unopenable on both platforms — FIXED
- **Severity**: P1 (the ERP's top-severity automated alerts — active brute-force detection,
  privileged-override alerts, workflow-health alerts — were undiscoverable via notification).
- **Area**: Automation / Notifications (cross-cutting).
- **Finding**: Three `pushNotification` calls in the internal scheduler used
  `relatedModule: 'Security'` / `'Governance'` / `'System'` (capitalized) — none of these
  strings exist as keys in `NOTIFICATION_ROUTES` (desktop, `renderer/app.js`) or the routing
  registry (mobile, `notificationRouting.ts`), both of which are case-sensitive lookups. Every
  one of these alerts showed "No linked page available" when clicked, despite each alert's own
  body text explicitly directing the user to the Security & Governance page.
- **Evidence**: `db/services/data.js` (`_schedSecurityScan`, `_schedWorkflowScan`).
- **Fix**: changed all 3 to the existing lowercase `'governance'` key, which already correctly
  routes to the `secgov` page on desktop and the root-level Governance screen on mobile —
  reused verbatim, nothing invented.
- **Verified**: confirmed the `'governance'` key exists and resolves correctly in both
  `renderer/app.js:8524` and `mobile/src/utils/notificationRouting.ts:89`.

### G-04 — Maintenance Officer Dashboard / Maintenance Reports unreachable from any menu — FIXED
- **Severity**: P1 (fully-built, fully-authorized feature with zero entry point).
- **Area**: Mechanician / Maintenance Oversight.
- **Finding**: `maintenanceOfficerDashboard`/`maintenanceReports` both correctly gate on
  `mustRole(user, 'maintenance-oversight')`, and the desktop NAV entries + `showPage()` switch
  cases both exist and work — but the NAV items use different literal permission ids
  (`maintenance-officer-dashboard`, `maintenance-reports`), and nothing anywhere ever granted
  those exact strings to any role. Every role that legitimately holds `maintenance-oversight`
  (admin, ceo, logistics) had no menu item to reach either screen.
- **Evidence**: `db/services/data.js` gate lines; `renderer/app.js` NAV/switch entries;
  `db/migrate.js` grant history.
- **Fix**: extended `expandPages()` — the exact mechanism already used to expand the legacy
  `'daily'` token into its 5 production sub-pages — so holding `'maintenance-oversight'`
  automatically also unlocks `'maintenance-officer-dashboard'`/`'maintenance-reports'`. No
  migration, no backend gate change, no new mechanism.
- **Live-verified**: `getBootstrap(1)` (admin) now resolves both new page ids into
  `userPages`, confirmed directly.

### G-05 — `ROLE_PAGES` fallback drift (5 permission keys, up to 8 roles each) — FIXED
- **Severity**: P1-as-designed but currently **latent** (the live DB is correctly seeded today
  — this closes a silent-lockout risk, the same class of bug `restoreRolePagesDrift` already
  fixed once for other roles).
- **Area**: Cross-cutting (permission fallback registry).
- **Finding**: `db/migrate.js` actively grants 5 permission keys to roles that
  `ROLE_PAGES` (the in-code fallback used only when a role's DB `permissions` row is
  empty/missing) never lists:
  - `maintenance-jobs` — DB-granted to mechanician, supervisor, sawmill-leader, poles-leader,
    logistics, operations, admin, ceo; fallback only had mechanician.
  - `maintenance-oversight` — DB-granted to logistics, admin, ceo; fallback had none.
  - `sawmill-dashboard` — DB-granted to any `daily-timber` holder (admin, operations,
    supervisor, sawmill-supervisor); fallback had none.
  - `stock-transfers` for `vat-leader`/`vat-supervisor` — DB-granted; fallback missing.
  - `inventory-loss-reports` — DB-granted to storekeeper-assistant, storekeeper, logistics,
    ceo, operations, admin; fallback only had logistics-officer.
- **Evidence**: `db/services/data.js` `ROLE_PAGES` vs `db/migrate.js` grant history (matched
  precisely, role by role).
- **Fix**: added each missing key to exactly the roles the live DB actually grants it to — no
  over-granting (e.g. `ceo` deliberately excluded from `sawmill-dashboard` since it doesn't
  hold `daily-timber`, the permission that grant is keyed off of).
- **Verified**: each addition read back and cross-checked role-by-role against the audit's own
  finding before committing to the file.

### G-06 — Transport Jobs NAV item unreachable via the fallback for any role — FIXED
- **Severity**: P2.
- **Area**: Logistics / Transport Jobs.
- **Finding**: `transport-jobs`'s backend gate is deliberately lenient (`mustRole(user,
  'transport') || mustRole(user, 'transport-jobs')`) — any role holding plain `'transport'`
  (admin, ceo, operations, sales, logistics) is meant to also reach it — but `'transport-jobs'`
  never appeared as a literal fallback string for any role.
- **Fix**: added `'transport-jobs'` to the fallback for admin, ceo, operations, sales,
  logistics (the 5 roles holding plain `'transport'`).

### G-07 — VAT batch metadata edit missing from mobile — FIXED
- **Severity**: P2 (backend=YES, desktop=YES, mobile=NO — the exact class of gap this whole
  program exists to close).
- **Area**: Nyanza / Value-Added Production.
- **Finding**: `valueAddedProductionBatchUpdate` was fully wired end-to-end on backend/IPC/REST/
  desktop, but mobile never called it — `useVat.ts` had no update hook, and the declared
  `VAT_UPDATE` endpoint constant was referenced nowhere in the mobile codebase.
- **Fix**: added `useVatUpdate` (mirroring `useVatDelete`'s own pendingApproval-handling
  pattern) and a metadata-only edit modal (order reference/operator/supervisor/notes — the same
  boundary the backend and desktop both already draw: input/output lines stay uneditable after
  creation on every platform) wired into `VatDetailScreen.tsx`.
- **Verified**: `tsc --noEmit` clean across the entire mobile project after the change.

---

## SCOPED OUT — genuine findings, disclosed rather than silently fixed or silently ignored

### G-08 — Sawmill Production Offcut creation has zero mobile UI or messaging
- **Severity**: P2.
- **Finding**: `productionOffcutCreate` (the entry point that turns a daily log's
  `timber_waste` into a trackable, QC-able offcut) has a working desktop form but no mobile
  screen and no explanatory message at all — unlike Record Recovery/Downgrade, which mobile
  explicitly shows with a "use desktop" badge, offcut creation gives a mobile sawmill user no
  indication this step even exists.
- **Disposition**: NOT built this pass. This requires a genuinely new mobile screen (a form),
  not wiring an existing hook to an existing screen (the class of fix this pass scoped itself
  to for the smaller findings) — building it properly is a reasonable follow-up phase, not a
  five-minute fix. Recommended: either build the form screen, or at minimum add the same
  "use desktop" messaging pattern already proven for Record Recovery/Downgrade as a fast
  interim fix.

### G-09 — No Update/Edit for Pole Production batches anywhere in the stack
- **Severity**: P2.
- **Finding**: `poleProductionBatchesList/Create/Delete` exist; `poleProductionBatchUpdate`
  does not exist at all — no backend function, no IPC, no REST route, no desktop button, no
  mobile hook. Asymmetric with Sawmill (`dailyUpdate`) and VAT (`valueAddedProductionBatchUpdate`,
  now also on mobile per G-07), both of which support metadata-only edits. Any typo in
  operator/supervisor/machine/notes/date on a pole batch (before QC even starts) can only be
  corrected by deleting and recreating the whole batch.
- **Disposition**: NOT built this pass. Per this program's own Stop Rule ("do not invent new
  departmental functionality"), a brand-new backend function is a materially different
  category of work than wiring an existing one — this is new capability, not a wiring gap.
  Recommended as a small, well-scoped follow-up (mirror `valueAddedProductionBatchUpdate`'s
  exact shape: metadata-only, governed via the same `pending_edits` mechanism).

### G-10 — Sales/Payroll positive-path traceability could not be live-tested
- **Severity**: INFO (data-volume observation, not a defect).
- **Finding**: Production currently has 0 rows in `sales_orders`, `payroll_periods`, and
  `customers`. Functions touching these paths (Finance's `sales_order` trace branch, from the
  prior Finance expansion pass) are schema-correct and handle the empty case cleanly, but their
  positive path (a real record actually flowing through) has not been exercised against real
  data.
- **Disposition**: Disclosed, not fabricated. Not something this pass can fix — it's a
  reflection of the business's current data volume, not a code defect.

---

## Summary Table

| ID | Severity | Area | Disposition |
|---|---|---|---|
| G-01 | P1 | Mechanician | FIXED, live-verified |
| G-02 | P1 | Sawmill/Finance | FIXED, live-verified |
| G-03 | P1 | Automation/Notifications | FIXED, verified |
| G-04 | P1 | Mechanician | FIXED, live-verified |
| G-05 | P1 (latent) | Cross-cutting permissions | FIXED |
| G-06 | P2 | Logistics | FIXED |
| G-07 | P2 | Nyanza/VAT | FIXED, tsc-verified |
| G-08 | P2 | Sawmill | Disclosed, not built (new mobile screen required) |
| G-09 | P2 | Poles | Disclosed, not built (new backend capability required) |
| G-10 | INFO | Sales/Payroll | Disclosed data-volume limitation |

**No P0 findings.** No security-critical, data-corruption, or double-counting defects were
found anywhere across all four audit clusters — a meaningfully different result than earlier
completion-gate phases in this program's history, consistent with this being confirmatory
rather than greenfield work.
