# Phase C7 — Executive Dashboard Operational Excellence — Gap Register

## Reconciliation against the master register

This phase targets specifically the **Executive Dashboard instance** of PR-20 (systemic:
dashboard KPI tiles not clickable), one of the 4 remaining un-fixed instances after Phase C2 (CEO
Overview) and Phase C5 (Inventory Dashboard). It is now resolved; Procurement, Logistics, and
Maintenance Officer dashboard instances remain open, unrelated to this phase.

## Findings by workstream

### Resolved this phase

| Finding | Type | Disposition |
|---|---|---|
| Executive Dashboard's 8 KPI tiles had zero click handlers (the PR-20 pattern, confirmed live by reading the render function — `ex-kpi` divs, no `onclick`/`data-*` anywhere) | UX GAP | **RESOLVED** — wired to 7 distinct existing pages (Active Users deliberately left non-interactive, no destination exists) |
| 10 additional stat rows (Stock Summary ×4, Governance ×6) shared the same non-interactive problem, discovered during the same audit pass | UX GAP | **RESOLVED** — wired to `inventory`/`stock-transfers`/`material-requests`/`stock-movements`/`secgov`/`audit` |
| Dashboard's multi-section data had no professional `.xlsx` export (only a client-side CSV formatter) | UX GAP | **RESOLVED** — new `executiveDashboardExportExcel`, 9-sheet workbook, live-verified by reopening the generated file |

### Newly discovered this phase, NOT fixed (disclosed per the Stop Rule)

#### NF-C7-01 — `operations` role is missing the `deliveries` permission
- **Type**: PERMISSION GAP (pre-existing; surfaced by this phase's own drill-down wiring, not
  introduced by it).
- **Evidence**: Live query against `role_definitions` (the authoritative runtime table, checked
  directly — not assumed from the static `db/migrate.js` seed literal, which was found to differ
  from what's actually live): `admin` and `ceo` hold all 9 permissions the dashboard's new
  drill-downs target; `operations` holds 8 of 9, missing only `deliveries`.
- **Impact**: An `operations`-role user viewing the Executive Dashboard and clicking "Deliveries
  Pending" hits `Access denied` on the Deliveries Orders page, despite being one of only 3 roles
  permitted to view the Executive Dashboard at all.
- **Why not fixed**: `deliveries` is a write-capable permission — it gates create/update/delete of
  delivery orders (`mustRole(user, 'deliveries')`, confirmed at 7 call sites in `data.js`), not
  merely viewing. This session has a standing rule (established across multiple earlier phases):
  never grant a role edit/delete/update rights without asking the user first. Silently adding
  `deliveries` to `operations`'s permission set to make one dashboard tile "just work" would
  violate that rule for the sake of dashboard cosmetics.
- **Disposition**: **OPEN — requires an explicit business decision.** Recommended options for a
  future phase or immediate user decision: (a) grant `operations` the `deliveries` permission
  (matches its otherwise-broad logistics-adjacent permission set — it already holds
  `stock-transfers`, `material-requests`, `transport`, `dispatch`); (b) leave the tile wired but
  accept that `operations` viewers see a permission-denied page on click (consistent with "never
  rely on frontend hiding as a security mechanism" — the backend correctly still blocks it); (c)
  conditionally suppress the tile's click affordance for the `operations` role specifically. None
  of these was implemented — flagged for the user.

#### NF-C7-02 — Mobile has no Executive Analytics screen
- **Type**: CAPABILITY GAP (backend/REST fully ready, zero UI).
- **Evidence**: `GET /reports/executive` (`mobile-api/routes/reports.js`) exists, correctly
  permissioned (`ceo`/`operations`/`admin`), and predates this phase. Grepped across
  `mobile/src` — zero screens or hooks call it. Mobile's executive-tier users instead see a
  generic `DashboardScreen` (different backend endpoint, `dashboard-stats`) and
  `CeoOverviewScreen` (Phase C2's approvals-focused page) — neither is the same trend/leaderboard/
  governance-heavy view desktop has.
- **Why not fixed**: Building a full mobile equivalent (5 trend charts, 4 leaderboards, governance/
  stock/notification panels) is a **new mobile screen**, not a professionalization of an existing
  one — a substantially larger, standalone build than "wire up what's already there," and outside
  what a single bounded phase should safely attempt per this session's own repeated precedent
  (e.g. Phase C5 deferring full Audit Log mobile UI parity as a separate concern; NF-01 itself
  waiting across two phases for its own dedicated, properly-scoped phase before being built).
- **Disposition**: **OPEN — recommended for a future, dedicated Mobile Executive Analytics
  phase.** Suggested scope for that phase: reuse `DashboardStats`/`KpiCard`/existing mobile chart
  components (`BarChart`, `StackedProductionChart`) rather than inventing new ones, matching every
  other mobile dashboard's own established component vocabulary.

### Confirmed non-gaps (audited, found already correct — listed so this audit's completeness is
visible, not silently assumed)

- **Data correctness**: 3 KPIs (`revenueToday`, `lowStockItems`, `deliveriesPending`)
  independently recomputed against raw SQL — all matched exactly. No cancelled-order leak, no
  soft-delete leak, no inactive-catalog-item leak.
- **Search/filter/sort/pagination**: correctly absent from the dashboard itself — every
  drill-down destination already has its own, from an earlier phase. Adding a second layer here
  would duplicate business/UI logic the brief explicitly forbids duplicating.
- **Notifications**: correctly absent — the dashboard is a read-only aggregate, matching Finance
  Operations Center's and the Inventory Dashboard's own precedent of having no notification type.
- **CRUD parity**: all 9 linked entities already CRUD-complete per their own earlier, dedicated
  phases (Sales Enterprise, Stock & Inventory 1-4, Phase C6/Audit) — cross-referenced, not
  re-audited from scratch, and unmodified by this phase.
- **Security**: both dashboard functions (existing and new) correctly deny a non-executive role
  live-tested; neither trusts client-supplied parameters (the dashboard takes only a user id; the
  export takes no arguments at all).
- **Auto-refresh, CSV export, empty/loading/error states**: all pre-existing, all confirmed still
  working, none touched.

## Business decisions

**One required**: NF-C7-01 (whether to grant `operations` the `deliveries` permission) — see
above. Not decided or acted on this phase.

**One recommended for scoping, not required immediately**: NF-C7-02 (mobile Executive Analytics
screen) — a scope/priority decision for a future phase, not a business/policy question.
