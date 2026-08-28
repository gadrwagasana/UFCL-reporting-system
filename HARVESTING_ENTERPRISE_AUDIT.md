# UFCL ERP — Harvesting Department Enterprise Audit
### Backend + Desktop + Mobile + End-to-End Workflow Review

**Audit type:** read-only. No code was written or modified, no workflows redesigned, no permissions changed, no schema touched. Every finding below is backed by an exact file:line citation gathered from three independent, full-file research passes (backend `db/services/data.js`/`db/migrate.js`/`mobile-api/routes/harvest.js`; desktop `renderer/app.js`; mobile `mobile/src/`).

---

## 1. Executive Summary

Harvesting is a **functionally simple, operationally under-exposed** module. Its backend is a flat CRUD entity (`harvest_logs`) with no dedicated lifecycle/status, no bespoke approval chain, and no direct notification on create. It sits at the start of a real cross-department data chain (Compartments → Harvest → Log Transport → Timber Inventory → Executive Reporting), and that chain **does** function for the reporting/aggregation direction, but has **no evidence of a forward hand-off into Stock/Inventory or Workshop consumption** anywhere in the three codebases reviewed.

The most consequential findings:
- **Mobile cannot edit or delete a harvest log at all** — no REST route exists (`mobile-api/routes/harvest.js` has only `GET`/`POST`), so the two roles whose entire mobile experience *is* Harvesting (`harvesting-leader`, `harvesting-supervisor`) must switch to a desktop machine to fix a mistake.
- **The mobile roles who do the fieldwork see no harvest KPIs or dashboard at all** — the harvest trend/KPI screens that exist on mobile (`CeoOverviewScreen`, `ExecutiveScreen`) are gated to `ceo`/`admin`/`operations`-type roles via `reports.executive`, which `harvesting-leader`/`harvesting-supervisor` don't hold. The roles who can see the numbers can't reach the raw entries; the roles who log the entries can't see the numbers.
- **A live desktop page (`renderHarvest`/"Harvest Tracking") is dead code** — no nav entry, no page container in `index.html`, unreachable, yet a stale reference to it survives in the Timber Inventory page's empty-state copy.
- **No lifecycle exists for a harvest entry** — no draft/submitted/approved status, no planning stage, no team/tree assignment stage. "Harvest Planning," "Tree Allocation," and "Harvest Assignment" (named explicitly in this audit's brief) do not exist anywhere in the codebase in any form.
- **Permission drift between the backend's own two read paths** (`harvestList` vs `dailyHarvestData`) inconsistently excludes `ceo`/`harvesting-supervisor` from one but not the other, with a live (non-dead-code) consequence in Global Search.

No security-relevant over-permission was found anywhere in this module — every mismatch identified is *under*-exposure or *inconsistent* exposure, never a role reaching something the backend would silently allow without a proper check.

## 2. Current Harvesting Architecture

```
Compartments (adjacent module)
   │  compt_id, volume_m3, status
   ▼
harvest_logs  ◄── harvestCreate / harvestUpdate / harvestDelete / harvestList / dailyHarvestData
   │  species, harvest_date, quantity, uom, logs_crosscut, logs_handrolled, workshop_id
   │
   ├──► Compartments (write-back: auto-marks status='Completed' when harvested volume ≥ compartment volume)
   ├──► Log Transport (read: totalLogsHarvested, remaining = hand-rolled − transported)
   ├──► Timber Inventory (read: species-grouped harvest summary)
   ├──► CEO Overview / Executive Analytics / BI / EPM (read: trees/logs KPIs, trend charts, forecast)
   └──► Global Search "production"/"timber" module (read, permission-inconsistent — see §6)
```

No entity, table, or function representing "Harvest Plan," "Tree Allocation," or "Harvest Assignment" exists anywhere in `db/services/data.js`, `db/migrate.js`, `renderer/app.js`, or `mobile/src/`. The lifecycle in practice is: a compartment exists → a user logs a harvest event against it (retroactively, same-day) → the compartment's harvested-volume total accrues → once the threshold is reached the compartment auto-closes. There is no forward-looking planning or assignment step at all — the "workflow" is a single record-keeping action, not a multi-stage process.

## 3. Backend Review

**Full function inventory** (`db/services/data.js`):

| Function | Line | Purpose |
|---|---|---|
| `harvestList(userId, workshopId)` | 5011 | List (last 100) + species summary. Read. |
| `harvestCreate(userId, payload)` | 5037 | Insert; required `species`, `harvest_date`, `quantity`; auto-completes the linked compartment when volume threshold reached. |
| `harvestUpdate(userId, logId, payload)` | 5639 | Update, governed (§ below). |
| `harvestDelete(userId, logId, reason)` | 5666 | Soft-delete, governed. |
| `dailyHarvestData(userId, workshopId)` | 5104 | Alternate read: harvest rows joined to compartments + compartment progress table + species summary. This is what desktop's live page and mobile both actually call. |
| `timberInventoryList(userId)` | 5077 | Adjacent module; includes a harvest species summary. |
| `_biPredictHarvestCompletion()` | 8326 | Internal BI helper (no own permission check; not exported). |
| `_autoCheckHarvestBehind(rule)` | 11950 | Internal automation-rule check that fires a "HARVEST BEHIND SCHEDULE" notification. |

**Permissions**: `harvestList` gates on `mustRole(user,'harvest')` alone (5013). `harvestCreate`/`Update`/`Delete` gate on `mustRole('harvest') || mustRole('daily-harvest')` (5039, 5641, 5668). `dailyHarvestData` gates on a resolved-permissions check for any of `daily-harvest`, `harvest`, or `daily` (5106-5110).

**Approvals**: no harvest-specific chain. `harvestCreate` has no approval step at all — direct insert. `harvestUpdate`/`harvestDelete` route through the codebase-wide generic `applyGovernance`/`timeGatedAuthorization` mechanism (390-427, 251-291): privileged roles (`admin`/`ceo`/`operations`) always allowed; others require leader- or manager-level approval depending on record age and ownership. This is the same mechanism every other governed table uses — nothing harvest-specific about it.

**Notifications**: neither `harvestCreate` nor a direct (non-governed) `harvestUpdate`/`harvestDelete` path calls `pushNotification` at all. Notifications only fire when governance escalates a request (`autoRequestEdit`/`autoRequestDelete`, 327-332/362-367) or when a privileged user overrides someone else's record (`logPrivilegedOverride`, 379-384). Separately, the `_autoCheckHarvestBehind` automation rule pushes a schedule-risk alert independent of any CRUD action.

**Audit logging**: all three mutating functions call `logAudit`, but **none populate the structured `opts` argument** (`module`/`actionType`/`recordId`/`before`/`after` are all `null` for every harvest audit-log row — 5071, 5662, 5682), unlike sibling functions elsewhere in the same file that consistently pass this structured data. This is a real, verifiable inconsistency, not a stylistic nitpick — it means harvest's audit trail entries carry only a free-text message and raw payload, not the structured fields the Audit Trail/Trash UI elsewhere relies on for filtering and per-record linkage.

**Status transitions**: `harvest_logs` has no status/lifecycle column at all (confirmed against schema). A record is active, in Trash (`deleted_at` set), or has a `pending_deletion` flag from the generic governance layer — never a harvest-specific state.

**Reports/dashboards**: harvest figures appear in `getCeoOverview` (9814), `businessIntelligenceDashboard`'s harvest-forecast section (8867-8925), `executiveDashboard`'s harvest trend + top-compartments (7864), and `performanceKPIs`/`performanceTrends`/`performanceDashboard` (14025-14460) — the latter three are hardcoded to `['ceo','admin','operations']` despite the harvest KPIs' own seeded "owner" being **"Harvesting Leader"** (`db/migrate.js:2001-2002`), a role that cannot see them.

**Mobile-API routes** (`mobile-api/routes/harvest.js`): exactly two routes — `GET /` → `dailyHarvestData`, `POST /` → `harvestCreate`. **No PUT/PATCH, no DELETE.** `harvestUpdate`/`harvestDelete` are reachable only via Electron desktop IPC (`electron/main.js:533-534`).

**Orphans**: no fully zero-caller backend function was found. The concrete gap is that `harvestUpdate`/`harvestDelete` are desktop-only — not zero-caller, but unreachable from any mobile client regardless of the calling user's actual permission level.

## 4. Desktop Review

Two candidate pages were found; only one is live.

- **`renderPageDailyHarvest` → `renderDailyHarvest`** (`app.js:1689`/`2398-2696`) — the real, reachable "Daily Harvest" page (NAV id `daily-harvest`). Full feature set: a 6-metric static KPI strip (Trees Felled, Logs Cross-Cut, Hand-Rolled, Remaining on Site, Volume m³, Active Compartments — none clickable), a "Harvest by Species" table, a "Harvest Log" table (no sort/filter/search/pagination/bulk/export), a "Log Harvest" create overlay (Compartment dropdown that auto-fills species and sub-name and disables completed compartments, a live client-side computed-fields preview, Notes), per-row Edit and Delete.
- **`renderHarvest`** (`app.js:11481-11603`) — a second, older "Harvest Tracking" implementation. **Confirmed dead code**: no `NAV` entry, no `showPage` case, no `<div id="page-harvest">` in `renderer/index.html` (only `page-daily-harvest` exists). It cannot be reached by any user action and would throw if it ever ran. A stale reference to "the Harvest Tracking page" survives in Timber Inventory's empty-state text (`app.js:12315`).

**Approval UI**: no harvest-specific approve/reject control. Edit/Delete route through the same generic pending-edit/pending-deletion review panels used elsewhere, gated by `canApproveEdits()` (`admin,ceo,operations,logistics`) and `canManageTrash()` (`admin,ceo,operations`). **Notable gap**: the routing decision of "does this user's edit/delete need approval?" is driven by `isSupervisor()` (`app.js:702-704`), which checks the literal role string `'supervisor'` — **not** `'harvesting-supervisor'**, a distinct role that also exists in this system. This means `harvesting-supervisor` edits and deletes harvest logs **directly**, bypassing the review layer that the naming convention (and the equivalent `'supervisor'` role) would suggest should apply.

**Dashboards**: no dedicated Harvesting dashboard exists. Harvest data appears embedded, static, and non-drill-down, in CEO Overview, Executive Analytics (trend chart + top-compartments table, with CSV/PDF export of just those two sections), Business Intelligence (forecast card + completion-forecast table), and EPM (a weekly sparkline). None of "Active Teams," "Completed Harvest," "Outstanding Work," or "Machine Utilization" — all named explicitly in this audit's checklist — exist anywhere for Harvesting.

**Permissions on buttons**: none. "Log Harvest," Edit, and Delete render unconditionally for anyone who can reach the page at all — only the *behavior* (direct write vs. approval-routed) branches by role.

**Cross-department links visible from Harvesting screens**: Compartment dropdown (read, one-way) in the create/edit form is the only outbound link; the Harvest Log table's Compartment cell is plain text with no click-through. Inbound: Compartments, Log Transport, and Timber Inventory each embed a read-only, aggregated slice of harvest data. No visible link to Fleet, Mechanician, Sawmill, Poles, VAT, or Procurement anywhere.

**UI/UX**: noticeably older/simpler than modules refreshed in the Enterprise UI/UX Standardization program — no search/filter/sort/pagination toolbar on either table (present on Warehouses, Contracts, Compliance, and other newer screens), a plain-text empty-state row instead of the shared `emptyRowHtml()` helper, no status badges (Compartments, the adjacent module, has them; Harvest Log rows don't), and label-only required-field indicators with no client-side pre-submit validation.

## 5. Mobile Review

**Navigator scope**: only two roles route to a Harvest screen at all — `harvesting-leader` (`HarvestNavigator`, 8 tabs) and `harvesting-supervisor` (`HarvestSupervisorNavigator`, a stripped 4-tab version). `ceo`, `admin`, `supervisor`, and `operations` have **zero** Harvest references anywhere in their respective navigators.

**Screens** (`mobile/src/screens/harvest/`): `HarvestListScreen`, `HarvestCreateScreen`, `HarvestDetailScreen` — confirmed **create/read only**; `mobile/src/api/endpoints.ts` and `mobile/src/hooks/useHarvest.ts` define no update or delete hook/endpoint at all, matching the backend-side route gap exactly.

**List screen**: a thin summary banner (Trees Today, Logs Today, Species count — a small fraction of desktop's 6-metric strip), card list with pull-to-refresh, no search/filter/sort/pagination (matching desktop's own lack of these), tap-to-view only (no inline edit/delete, consistent with the missing hooks). Notably, the API response the list screen already receives (`HarvestListResponse`) **carries compartment-level data** (`status`, `trees_harvested`, `volume_m3`, `area_ha`) that the screen simply never renders — this is available data being left on the table, not a backend gap.

**Create screen**: same core fields as desktop, but the Compartment dropdown only auto-fills `sub_name`, **not species** (desktop fills both), and **does not filter out or disable already-completed compartments** (desktop does) — a genuine, confirmed data-integrity gap: a mobile user can log a new harvest entry against a compartment the system itself considers finished. No live computed-field preview exists on mobile (desktop has one). One area where mobile is *ahead* of desktop: an offline queue (`useOfflineStore`, tagged `context: 'harvest'`) lets a create action be queued and synced later — desktop, an always-connected Electron app, has no equivalent concept.

**Detail screen**: pure read-only, no actions at all.

**Permissions**: `harvest.write` and the `harvest` nav group are held only by `harvesting-leader`/`harvesting-supervisor` (`mobile/src/utils/permissions.ts:108,112,156,160`). Cross-referencing the backend's own role grants (§3, §6): `ceo` holds backend `daily-harvest` and could technically view harvest data via `dailyHarvestData`, but has **no mobile path whatsoever** to any Harvest screen — stricter than what the backend would allow. This is a defensible product choice (a CEO doesn't need raw field-entry access on a phone) rather than an obvious bug, but it is a confirmed platform asymmetry.

**Notifications**: the Notifications screen has exactly four fixed categories (`All`/`Approvals`/`Security`/`System`) with no harvest-specific category or tag — a harvest-behind-schedule alert or an edit/delete approval request would only ever surface, undifferentiated, under "Approvals."

**Search**: a harvest record is reachable via the generic "production" search module, but only lands on the **list** screen, not the specific record — the code's own comment confirms no per-record navigation exists for this module today.

**Dashboards**: `CeoOverviewScreen` and `ExecutiveScreen` **do** show harvest KPIs and a trend chart on mobile, closely matching desktop's equivalents — but both require `reports.executive`, which `harvesting-leader`/`harvesting-supervisor` do not hold (they only have `reports.bi`). **The two roles who actually route to a Harvest screen see no harvest dashboard anywhere on mobile.**

## 6. Permission Matrix

| Role | Backend `harvest` | Backend `daily-harvest` | Desktop page access | Desktop button gating | Mobile nav/screen access | Mobile dashboard access |
|---|---|---|---|---|---|---|
| admin | yes | yes | yes (unconditional buttons) | none (behaves as privileged: direct write, governance override) | **no Harvest screen at all** | yes (CeoOverview/Executive) |
| ceo | **no** | yes | yes, via `dailyHarvestData` | privileged (governance override) | **no Harvest screen at all** | yes |
| operations | yes | yes | yes | privileged | **no Harvest screen at all** | yes |
| supervisor | yes | yes | yes | edits/deletes routed to approval (`isSupervisor()` matches) | **no Harvest screen at all** | no |
| harvesting-leader | yes | yes | yes (desktop is role-agnostic UI-wise) | direct write, no approval routing | yes — only role with full 8-tab access | **no** (lacks `reports.executive`) |
| harvesting-supervisor | **no** | yes | yes, via `dailyHarvestData` | **direct write — approval routing does NOT apply** (isSupervisor() checks literal `'supervisor'`) | yes — stripped 4-tab access | **no** |

**Confirmed mismatches:**
1. **`harvestList` vs. `dailyHarvestData` gate inconsistency** — `ceo`/`harvesting-supervisor` are excluded from the narrower `mustRole('harvest')` gate but pass the broader `dailyHarvestData` gate. Since the live desktop page uses `dailyHarvestData`, this has no practical effect there — but Global Search's "timber" module (`data.js:9145`) gates on `mustRole('harvest')` alone, so **`ceo` and `harvesting-supervisor` cannot find harvest records via Global Search**, while every other role who can view the page can.
2. **`harvesting-supervisor` bypasses the edit/delete approval flow** desktop-side — a role-name-matching oversight (`isSupervisor()` checks `'supervisor'`, not `'harvesting-supervisor'`), not something that appears to be an intentional design decision given the parallel structure with the `'supervisor'` role elsewhere in the same file.
3. **Mobile is stricter than the backend for `ceo`/`admin`/`operations`/`supervisor`** (zero Harvest screen access vs. backend's `daily-harvest`/`harvest` grants) — a product-scoping choice, not a security gap, but worth explicit confirmation with the business that it's intentional.
4. **EPM/Executive KPI screens exclude the harvest KPIs' own designated owner role** (`harvesting-leader`) on both platforms.

No instance of a role reaching a capability the backend would not itself authorize was found anywhere in this review.

## 7. CRUD Review

| Operation | Backend | Desktop | Mobile |
|---|---|---|---|
| Create | ✅ `harvestCreate` | ✅ full form w/ compartment auto-fill + live preview | ✅ form, weaker compartment auto-fill, no preview, no completed-compartment guard |
| Read (list) | ✅ `harvestList`/`dailyHarvestData` | ✅ table + species summary | ✅ card list + thin summary |
| Read (detail) | — (no dedicated detail function; rows returned by list) | no dedicated detail overlay, only the Edit form | ✅ dedicated read-only detail screen |
| Update | ✅ `harvestUpdate`, governed | ✅ | ❌ **no route, no UI** |
| Delete | ✅ `harvestDelete`, governed (soft-delete) | ✅ | ❌ **no route, no UI** |
| Archive / Restore | soft-delete via generic Trash system; restore via generic Trash UI (`admin/ceo/operations`) | ✅ (via shared Trash panel) | not checked — no delete exists to restore from on mobile in the first place |
| Cancel | n/a — no lifecycle to cancel (§3) | n/a | n/a |
| View Details | rows include full record already | Edit form doubles as detail view | ✅ dedicated screen |

## 8. Workflow Review

There is **no harvest-specific workflow** beyond generic CRUD + the codebase-wide governance layer. None of the following exist for a harvest record, on either platform, at the backend, desktop, or mobile level: Submit, Approve/Reject (as a record-level action — only the generic edit/delete-request review exists), Return for Revision, Assign, Start, Pause, Resume, Complete, Close, Reopen. This is a flat, single-state record type. This is not necessarily wrong — the daily-harvest-log pattern may not need a multi-stage lifecycle — but it means every "workflow action" named in this audit's brief should be read as **not applicable to Harvesting as currently implemented**, not as a missing feature per se, except where the end-to-end lifecycle review (§12) identifies genuinely absent upstream stages (Planning, Allocation, Assignment).

## 9. Dashboard Review

| Dashboard | Harvest content | Drill-down | Role access |
|---|---|---|---|
| CEO Overview (desktop + mobile) | Trees Felled (+ logs sub-label) | none | `admin`,`ceo` |
| Executive Analytics / `ExecutiveScreen` (desktop + mobile) | 12-week harvest trend chart, Top Compartments by Volume table | none | `ceo`,`admin`,`operations` |
| Business Intelligence (desktop only) | Harvest Forecast prediction card, completion-forecast table, top-harvest-compartments panel | none | roles listed in `BI_SECTIONS` incl. `harvesting-leader`/`harvesting-supervisor` — the **one** dashboard surface those two roles can actually see, and it's desktop-only |
| EPM / Performance (desktop only) | weekly sparkline; `harvest-trees-month`/`harvest-logs-month`/`harvest-active-compts` KPIs | none | hardcoded `ceo,admin,operations` only — excludes the KPIs' own seeded owner role |

**Checklist items requested by this audit that do not exist anywhere for Harvesting**: Active Teams, Completed Harvest (as a distinct widget — compartment `status='Completed'` exists as data but isn't surfaced as a dashboard count anywhere), Outstanding Work, Machine Utilization. **Nothing in this module is clickable/drill-down** on either platform.

## 10. Reports Review

No dedicated Harvesting report screen exists on either platform. Harvest data reaches users only as:
- A CSV/PDF export of two sections (`HARVEST TREND`, `TOP COMPARTMENTS`) inside the general Executive Analytics export (desktop only).
- A print of the BI dashboard's completion-forecast table (desktop only, via the page's generic print button).
- A read-only "Harvest by species" card embedded in the Timber Inventory page (desktop; not confirmed on mobile beyond the list's own thin summary).

No harvest-specific filters, no chart other than the two trend widgets already covered in §9, no dashboard-integration beyond what's already listed there.

## 11. UI/UX Review

**Desktop**: functional but visibly older-generation compared to modules already through the Enterprise UI/UX Standardization program — missing the shared search/filter/sort/pagination toolkit, the shared empty-state helper, and any status-badge treatment. Minimal client-side validation (label asterisks only). Contains confirmed dead code (`renderHarvest`) that should be removed as a hygiene item, not audited as a functional gap.

**Mobile**: consistent with the app's general mobile design language (`AppHeader`, `LoadingState`/`ErrorState`/`EmptyState`, offline banner/queue) — actually **more consistent** with current app conventions than the desktop page is, since mobile screens across this app were built later and more uniformly. The confirmed functional gaps (§4/§5) are data-completeness and capability gaps, not visual-consistency gaps.

**Specific, verified recommendations** (only where a gap was actually confirmed, per this audit's own rule):
- Desktop: add search/filter/sort to the Harvest Log table; adopt the shared empty-state helper; remove the dead `renderHarvest` function and its stale Timber Inventory reference.
- Mobile: render the compartment-level data (`status`/`trees_harvested`/`volume_m3`) the list screen already receives but currently discards; auto-fill species (not just sub-name) and disable completed compartments in the create form, matching desktop.
- Both: no status badge exists for a harvest record on either platform — not necessarily a defect (there's no status field to badge), but if a future phase adds any lifecycle concept, badge treatment should be added consistently on both platforms from the start.

## 12. Cross-Department Integration

| Department | Integration found | Direction | Confidence |
|---|---|---|---|
| Compartments | Harvest writes into compartment completion status; Compartments displays harvested-volume progress | bidirectional (one write-back, one read) | Confirmed |
| Log Transport | reads harvest's hand-rolled-log totals to compute remaining-to-transport | read-only, into Log Transport | Confirmed |
| Timber Inventory | embeds a harvest-by-species summary | read-only, into Timber Inventory | Confirmed |
| Executive/CEO/BI/EPM reporting | trees/logs KPIs, trend charts, forecast | read-only, into reporting | Confirmed |
| Inventory (stock_catalog/stock_levels) | **no evidence found** of harvested log quantities becoming a stock/inventory transaction | — | **Not confirmed either way in this audit** — a dedicated Inventory-module audit would be needed to rule this out conclusively; flagged as the most significant potential end-to-end gap (§13) |
| Workshop consumption | **no evidence found** of any link | — | Same caveat as above |
| Fleet, Mechanician, Sawmill, Poles, VAT, Procurement | **no evidence found** of any link from or to Harvesting in any of the three codebases reviewed | — | No integration exists as far as this module's own code shows |

## 13. End-to-End Process Validation

Mapping the exact lifecycle named in this audit's brief against verified evidence:

| Stage | Status | Evidence |
|---|---|---|
| Harvest Planning | **Does not exist** | No planning entity, schedule, or target-setting function found anywhere. |
| Compartment Selection | **Exists** | Compartment dropdown in the create/edit form, both platforms. |
| Tree Allocation | **Does not exist** | No pre-allocation/quota entity or field found. |
| Harvest Assignment | **Does not exist** | `harvest_logs` has no assigned-team/assigned-user field; entries are retroactive records, not assignments. |
| Daily Harvesting | **Exists, fully functional on desktop; create/read-only on mobile** | §3-§5. |
| Log Production | **Exists, but folded into the same record** | `logs_crosscut`/`logs_handrolled` are fields on the harvest entry itself, not a separate downstream stage/entity. |
| Log Classification | **Does not exist** | Only a single free-text "species" field is captured; no grading/classification step found. |
| Transport Preparation | **Partially exists** | Realized via the adjacent Log Transport module's read of harvest totals — a real but indirect, aggregation-only link, not a "prepare for transport" action originating in Harvesting itself. |
| Inventory | **Not confirmed** | No evidence of harvested logs becoming a stock/inventory transaction in any of the three codebases reviewed (§12). |
| Workshop Consumption | **Not confirmed** | Same — no evidence found. |
| Executive Reporting | **Exists** | §9. |

**Conclusion**: the ERP fully supports the *logging* half of the harvesting lifecycle (a compartment gets selected, a harvest gets logged, downstream reporting picks it up) but has **no support at all** for the *planning/assignment* half named explicitly in this audit's brief, and the *hand-off into physical inventory* — arguably the most operationally important link in the whole chain — could not be confirmed to exist anywhere in the code reviewed. This does not necessarily mean it's missing (Inventory's own service layer wasn't audited in this pass), but it is the single most important open question this audit surfaces.

## 14. Missing Backend Exposure

- `harvestUpdate`/`harvestDelete` — full backend implementation, governed correctly, desktop-complete — **not exposed via any mobile-api route**, so unreachable from mobile regardless of the user's actual permission.
- Compartment-level detail (`status`/`trees_harvested`/`volume_m3`/`area_ha`) — already returned by the mobile list endpoint, **not rendered by the mobile UI at all**. This is a UI gap, not a backend gap, but is included here since it's the mirror image of the item above (backend already provides more than the client uses).

## 15. Broken UI Workflows

- **`renderHarvest`/"Harvest Tracking" desktop page** — fully coded, but structurally unreachable (no nav entry, no page container). Not "broken" in the sense of erroring for a real user (no one can reach it), but broken in the sense of being dead, unmaintained code with a stale cross-reference elsewhere in the app.
- **`harvesting-supervisor`'s desktop edit/delete approval routing** — functions, but not as the parallel `'supervisor'` role's naming would imply; this reads as an unintentional gap in the `isSupervisor()` check rather than a deliberate design choice, but cannot be confirmed as a "bug" without product-owner input on intent.

No instance of "UI exposes an action the backend then rejects" was found anywhere in this module — every gap runs the other direction (backend capability without a UI path).

## 16. Critical Issues

1. **Mobile has no way to correct a harvest entry.** The two roles whose entire mobile app *is* Harvesting cannot edit or delete a record they logged incorrectly without switching to a desktop machine. **Business justification**: field data-entry errors (wrong date, wrong species, mistyped quantity) are routine and currently require a platform switch to fix, delaying correction and risking the error propagating into downstream reports before it's caught. **Operational benefit of fixing**: eliminates a forced desktop dependency for the module's primary mobile users. **Affected roles**: `harvesting-leader`, `harvesting-supervisor`. **Priority**: Critical. **Estimated effort**: Small–Medium (2 new REST routes mirroring the existing desktop IPC calls almost exactly, plus mobile hook/UI additions — comparable in size to the individual items completed in the prior Stabilization Phase 5 workflow-completion effort).

2. **The field roles have zero dashboard/KPI visibility on mobile.** `harvesting-leader`/`harvesting-supervisor` can log data but never see aggregate progress, trends, or forecasts on the device they actually use. **Business justification**: a harvesting leader making daily operational calls (which compartment to prioritize, whether they're behind schedule) currently has no in-app way to see that on mobile — the one dashboard that does include them (BI) is desktop-only. **Operational benefit**: closes a real information gap for frontline decision-makers. **Affected roles**: `harvesting-leader`, `harvesting-supervisor`. **Priority**: Critical. **Estimated effort**: Medium (requires either extending `reports.bi`'s mobile screen with the missing KPI cards, or granting/building a scoped mobile view of the existing BI harvest section — a UI/permission task, no backend changes needed since the data already exists).

## 17. Recommended Phase 1 Roadmap

A future implementation phase (out of scope for this audit) should prioritize, in order:

1. Expose `harvestUpdate`/`harvestDelete` over REST and build the corresponding mobile edit/delete UI (Critical Issue #1) — directly mirrors the pattern already established and proven in Stabilization Phase 5 for other modules (new route + governance-passthrough + mobile hook + form UI).
2. Give `harvesting-leader`/`harvesting-supervisor` a mobile path to the harvest KPIs they already own as data (Critical Issue #2) — likely the smaller of the two fixes, since the data and even the desktop UI already exist; this is primarily a permission/routing decision plus a mobile screen, not new backend work.
3. Fix the `isSupervisor()`/`harvesting-supervisor` approval-routing gap on desktop (§6, §15) — pending explicit confirmation from the business on intended behavior, since this audit cannot determine intent from code alone.
4. Remove the dead `renderHarvest` desktop function and its stale Timber Inventory reference (§4, §15) — pure hygiene, zero risk, trivial effort.
5. Close the mobile create-form gaps versus desktop (auto-fill species, disable completed compartments) — data-integrity risk reduction, small effort.
6. Structure harvest's `logAudit` calls with the standard `module`/`actionType`/`recordId`/`before`/`after` fields other modules already use (§3) — improves Trash/Audit Trail integration for this module without changing any business behavior.
7. **Before any of the above**, commission a short, targeted follow-up check (not a full audit) into whether harvested log quantities actually reach Stock/Inventory anywhere — the single open question this audit could not resolve from Harvesting's own code (§12, §13), and the one finding most likely to represent a genuine end-to-end process gap rather than a UI/platform-parity gap.

None of items 1-6 require any business-logic, schema, approval-chain, or Workshop Isolation change — they are UI/route/permission-exposure work only, consistent with what this module's backend already supports.
