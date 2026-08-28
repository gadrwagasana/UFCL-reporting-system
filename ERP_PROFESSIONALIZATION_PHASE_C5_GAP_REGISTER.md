# Phase C5 — Inventory Dashboard Drill-Down — Gap Register

## Reconciliation of the remaining backlog (Priority 0)

Read `ERP_MASTER_PROFESSIONALIZATION_GAP_REGISTER.md` plus the C1–C4 gap registers fresh (not
relying on stale line numbers). Of the original 24 P2 findings, 7 already resolved across C1–C4
(PR-01, PR-15, PR-19, PR-20-partial, PR-21, PR-22, PR-23). One security finding (NF-01) was
discovered but deliberately not fixed in C4. Remaining open going into this phase: PR-02,
PR-03–14/16 (13 export gaps), PR-17/18, PR-20 (5 dashboards: Executive/Procurement/Inventory/
Logistics/Maintenance Officer), PR-24 (folded), PR-25–32 (P3), PR-33 (blocked on business
decision), NF-01 (blocked on dedicated engineering phase).

## SPECIAL ATTENTION — rigorous re-assessment of NF-01

Per this phase's explicit brief, NF-01 was re-investigated from scratch (not reflexively
carried forward) using a dedicated background research pass covering: `audit_log` schema (both
`db/schema.sql` and every `ALTER TABLE audit_log` in `db/migrate.js`), the `logAudit` helper's
own definition and signature, an enumeration of **every** `logAudit(...)` call site in the
codebase, the live role→permission grants for `'audit'` (`db/migrate.js`), which of those roles
are genuinely workshop-scoped (`isWorkshopRestricted`), how `auditList` currently reads and
returns rows, existing consumers of the audit trail (the generic per-record History tab
mechanism, `logisticsRecordHistory`/`MODULE_PERMISSION_CHECK`, any reports), and the mobile Audit
Log screen.

**Findings, upgraded from C4's quick-check basis:**
- **All ~239 `logAudit(...)` call sites live in a single file**, `db/services/data.js` — not
  scattered across `main.js`/route files/mobile. This lowers the *mechanical* difficulty of a
  future fix (one file to touch, not a codebase-wide hunt).
- At every call site sampled, the acting function **already has the affected record's
  `workshop_id` in scope** at the point `logAudit` is called (it's typically read from the row
  being mutated, or from `user.workshop_id` for user-scoped actions) — so a future fix would not
  need new queries to *obtain* the value, only plumbing to *pass* it through.
- `audit_log` genuinely has **no `workshop_id` column** in any migration — confirmed again, this
  part of C4's finding was correct.
- The generic History tab (`logisticsRecordHistory`) is a **different, already-correct**
  mechanism (it reads from module-specific tables filtered by the record's own workshop, not from
  `audit_log`) — NF-01 is specific to the standalone Audit Log page/route, not the History tabs.
  Confirmed no other consumer of `auditList` exists that would be affected by a fix.
- Mobile's Audit Log screen calls the same unfiltered `auditList` via `mobile-api/routes/*` — the
  gap is identical on both platforms (a single backend fix would close it everywhere).

**Why this was still NOT implemented this phase, despite being more tractable than C4 believed:**
239 call sites — even in one file, even with `workshop_id` already locally available at each —
is still a large, mechanical-but-blast-radius-significant diff for a single-item phase whose own
scoring framework requires "low architectural risk" and full live-testability. A partial fix
(e.g., only the highest-traffic call sites) would leave the column present but inconsistently
populated, which is worse than the current honest "known gap" state — a half-populated
`workshop_id` column would look authoritative while silently being wrong for whichever call
sites weren't touched yet, and nothing in this app's own conventions supports shipping a
column that's known-incomplete. The correct scope is: **one migration (add the column, nullable,
no backfill — matches this app's own "never silently correct historical data" convention) + a
single pass touching all ~239 call sites in one file + one filter added to `auditList` + a live
regression pass proving every existing audit-writing code path still writes correctly** — that is
a coherent, single-purpose phase, not a partial one this phase should attempt piecemeal.

**Disposition: STILL OPEN — REQUIRES DEDICATED ENGINEERING PHASE.** The classification is
unchanged from C4, but the evidentiary basis is now far stronger and the future phase has a
concrete, validated, ready-to-execute plan (above) rather than a rough sketch. No fake/heuristic
workshop filter (e.g., scoping by the *acting* user's workshop instead of the affected record's)
was added — that would have been actively wrong, exactly as C4 already reasoned, and this phase's
deeper investigation did not change that conclusion.

## Candidates audited this phase (scoring table)

Three strongest remaining candidates were deep-audited against current code before selecting:

| Candidate | Business impact | Security impact | Backend/UI gap | Affected roles | Op. frequency | Backend readiness | Implementation risk | Verification feasibility |
|---|---|---|---|---|---|---|---|---|
| **PR-20 — Inventory Dashboard drill-down** | High (Inventory Dashboard is a daily-use screen for Storekeeper/Logistics/Operations/CEO/Admin) | None | Backend fully ready (`inventoryDashboard`/`inventoryList` already compute every value shown) — pure UI retrofit, exact `kpiTileHtml`/`.ceo-kpi-link` pattern already proven in C2 | Storekeeper, Logistics, Logistics Officer, Operations, Admin, CEO | High (daily) | High (zero new backend) | Low | High (fully desktop/mobile inspectable, no data mutation) |
| **PR-02 — Customers search/filter/sort/export** | Medium (real gap, but production currently holds **1** customer row — re-verified live this phase, unchanged since C4) | None | Requires *building* new backend search/filter capability (`customersList` has no params today) — a larger scope than a UI retrofit | Sales | Low (current data volume) | Low (needs new backend work) | Medium | High |
| **PR-16 — Audit Log export/pagination** | Medium-High (compliance/forensic tool) | **High** — re-confirmed to sit directly on top of the still-open NF-01 cross-workshop leak | Backend partially ready (search/filter exist; sort/export/pagination don't) | All `'audit'`-permission roles, including workshop-scoped ones | Medium | Medium | **High** — shipping bulk export on a page with a confirmed cross-workshop leak would let a workshop-restricted user export *other* workshops' audit trail to a file, which is strictly worse than the current read-only leak | High for the export mechanics, but shipping it would be irresponsible before NF-01 is fixed |

**PR-20 (Inventory Dashboard) selected.** It uniquely satisfies every high-weight dimension: real
daily-use business impact, zero backend risk (nothing to build, only to wire), an established
working pattern from Phase C2 to copy exactly, and full live-verifiability with zero data
mutation. PR-02 is real but lower current urgency and a larger (build, not wire) scope. PR-16 was
correctly excluded again this phase — adding an *export* capability to a page with a live,
undisclosed-turned-disclosed Workshop Isolation gap would make that gap strictly more damaging
(a screenshot-only leak becomes a downloadable-file leak), so it must wait for NF-01's dedicated
phase, not be worked around.

## Selected item and disposition

### PR-20 (Inventory Dashboard instance) — Executive KPI tiles are rendered as plain, non-interactive elements
- **Type**: UX GAP (this phase closes 1 of the remaining 5 dashboard instances of this
  systemic finding; Executive, Procurement, Logistics, Maintenance Officer remain open).
- **Area**: Inventory.
- **Finding** (re-verified against current code): `renderInventory` (`renderer/app.js:10244`)
  builds all 12 Executive KPI tiles via the shared `kpiTileHtml()` helper, which the helper's own
  doc comment states only becomes clickable when passed an `id` and/or `data` argument — none of
  the 12 tiles passed either, confirmed via direct read of the (pre-edit) tile block.
  `inventoryDashboard()` (`data.js`) already computes every value shown; nothing was missing on
  the backend.
- **Disposition**: **RESOLVED — Phase C5.** 10 of 12 tiles made clickable:
  - **Total items / Inventory value / Available stock** — reset the page's own local status
    filter to "all" and scroll to the Stock Register table (same page, same data already fetched).
  - **Low stock / Out of stock** — set the local status filter to the matching value and scroll
    to the table — the exact filter values `procFilterBarHtml`'s own status dropdown already uses.
  - **In transit / Transfers pending** — navigate to Stock Transfers.
  - **Material requests** — navigate to Material Requests.
  - **Adjustments / Consumption** — navigate to Stock Movements.
  - **Goods received / Turnover** deliberately left non-interactive — no single clean navigation
    or same-page filter target exists for either (mirrors Phase C2's own precedent of leaving
    dimensionless CEO Overview tiles alone rather than inventing a target).
  Mobile (`StockLevelsScreen.tsx`) got the equivalent treatment for the 3 KPI tiles it renders
  that have a clean cross-tab target (In transit/Transfers pending → Stock Transfers, Material
  requests → Material Requests, Consumption → Stock Movements) — see Completion Report for why
  Available stock/Goods received are correctly left non-interactive on mobile (no local filter
  state exists there; the full list is already the same screen, immediately below).

## Bug caught and fixed during implementation (same phase, not a separate finding)

While wiring the desktop tiles, an initial edit used camelCase `data` keys (`filterStatus`,
`gotoPage`) inside `kpiTileHtml`'s `data` param. `kpiTileHtml` does raw `data-${k}="${v}"` string
interpolation with no case conversion; HTML lowercases attribute names on parse, so
`element.dataset.filterStatus` would never have matched the resulting `data-filterstatus`
attribute — a silent, would-have-shipped-broken click handler. Caught via direct comparison
against the helper's own doc-comment example (`.mj-kpi-link[data-status]`) and Phase C2's own
working precedent (`data: { page: 'sales' }`), both single lowercase words. Fixed before any
click-handler code was written, by renaming to `filter`/`page`.
