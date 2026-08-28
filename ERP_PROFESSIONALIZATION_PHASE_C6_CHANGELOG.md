# Phase C6 — Audit Log Security & Workshop Isolation — Changelog

Scope: NF-01 — the Audit Log had zero Workshop Isolation despite the `audit` permission being
held by many genuinely workshop-scoped roles. This phase resolves it end-to-end: schema,
migration, write-path derivation, read-path enforcement, override protection, UI, and export.
Only NF-01 was implemented — no unrelated P2/P3 backlog item was touched.

## Database — `db/migrate.js`

- **`auditLogWorkshopIsolation()`** — new migration function, called from `migrate()` right after
  `auditLogEnhancement()`. Adds `audit_log.workshop_id bigint references warehouses(id)`
  (nullable), an index (`idx_audit_log_workshop`), and a new single-row table
  `audit_log_workshop_cutover(id, cutover_id, created_at)` capturing `max(id)` from `audit_log` at
  first run — the boundary before which every row is grandfathered (visible to every viewer
  exactly as before this phase) because historical rows cannot be retroactively assigned a
  workshop without suspending `audit_log`'s own `audit_log_no_update` rule, which this phase
  deliberately never does. The insert is `where not exists`, so re-running this idempotent
  migration on later app restarts never moves the cutover forward.
- Live-executed against production twice (fresh run + idempotency re-run) — see Completion
  Report §7/§8 for the exact counts.

## Backend — `db/services/data.js`

- **`logAudit(user, action, icon, meta, opts)`** — `opts` gains `workshopId`. Resolution order:
  `opts.workshopId` (explicit, trusted override) → `user.workshop_id` (safe default — the
  overwhelming majority of call sites need nothing else, since a workshop-scoped actor can only
  already be mutating their own workshop's records) → `null`. The `INSERT` and the
  `audit_replay` fallback payload (for when the primary insert fails) were both updated to carry
  the resolved value through.
- **`handleAuditReplay(p)`** — the workflow-job replay handler's own `INSERT` now also writes
  `workshop_id` from the queued payload.
- **`_auditCutoverId()`** — new helper, reads the cutover marker.
- **`_auditBuildQuery(user, filters, hiddenRoles, cutoverId)`** — new, shared helper. Single
  source of truth for the Workshop Isolation predicate (`isWorkshopRestricted(user)` — the exact
  function every other module already uses, not a new one) plus every other filter (module,
  action type, role, date range, search, and the new workshop filter, which only a
  non-restricted caller may use). Used by both `auditList` and `auditExportExcel` — they cannot
  drift apart because they share the exact same query-building logic.
- **`auditList(userId, filters)`** — rewritten: real server-side sort (`sortBy`/`sortDir`,
  allow-listed to `created_at`/`role`/`module`/`action_type`), real pagination (`page`/`pageSize`,
  replacing the old hard `limit 500`), `total` count for the UI, a `workshop_name` join, and a
  `workshops` dropdown list (populated only for non-restricted callers — a restricted caller
  doesn't need it, since they're already locked to one workshop, and isn't sent one).
- **`auditExportExcel(userId, filters)`** — **new**. Thin, isolation-inheriting wrapper: builds
  its query via the identical `_auditBuildQuery`, formats via the existing
  `_payrollBuildExcelBuffer` helper. No new authorization logic, no new business logic. Only
  buildable safely *because* isolation was proven first (Completion Report §22).
- **68 `logAudit(...)` call sites** across ~15 modules (sales, material-requests, stock-transfers,
  deliveries, harvest, poles, VAT/value-added production, rejection/resolution, maintenance,
  payroll, procurement, SRM, finance, casuals, log transport, daily logs, trash restore) had an
  explicit `workshopId` override threaded in, sourced from either a local resolved variable
  (matching the record actually being written) or a previously-fetched record's own
  `workshop_id` — never from raw request input. `module.exports` gained `auditExportExcel`.

### Real bugs found and fixed during this phase's own verification (not shipped)

A purpose-built static scope-verifier (checking that every threaded variable's declaration
actually encloses its use, not merely "appears somewhere in the same function") caught 7 real
defects introduced while auto-threading the 64 mechanically-safe call sites, all fixed before
this phase's live testing began:

1. **`trashRestore`** — `batch` was declared only inside an `if (tableName ===
   'value_added_production_batches')` block but referenced unconditionally at the function's
   `logAudit` call, which would have thrown `ReferenceError` for every *other* soft-deletable
   table (sales orders, material requests, machines, ...). Fixed by hoisting a
   `restoreWorkshopId` variable, set only inside that one branch, defaulting to `null` otherwise.
2. **`deliveryOrdersUpdateStatus`** — referenced a bare `so` variable that doesn't exist in this
   function; the real value (`so_workshop_id`) is a SQL column alias inside the query string, not
   a JS variable. Fixed to `before.so_workshop_id`.
3. **`deliveryOrdersUpdate`** — same SQL-alias-vs-JS-variable confusion, same fix.
4. **`deliveryOrdersDelete`** — same class of bug, same fix.
5. **`machineMaintScheduleUpdate`** — referenced `m` (a SQL table alias, not a JS variable);
   additionally, the workshop lookup query itself was only ever run inside an
   `if (isWorkshopRestricted(user))` block, so no workshop value existed for a global caller
   either. Fixed by hoisting the lookup query outside the conditional and using its real result
   variable (`mWorkshop`).
6. **`machineMaintScheduleDelete`** — same `m`-is-not-a-variable bug; fixed to
   `before?.machine_workshop_id`.
7. **`dailyUpdate`** — referenced `before.workshop_id` without the optional chaining this exact
   function uses everywhere else for the same `before` variable (which can legitimately be
   `null` if the record isn't found) — a latent `TypeError` for an edge case, not a hard crash on
   every call. Fixed to `before?.workshop_id ?? null`, matching the function's own established
   convention.

As a blanket defensive measure after finding these, **all 44 remaining bare `X.workshop_id`
override expressions were converted to optional chaining** (`X?.workshop_id`) — safe no-ops
where the object was already guaranteed non-null, and a real safety net where it wasn't. One
incidental match from this blanket pass (`db/services/data.js` line ~25161, an unrelated
procurement report's return object that happens to also have a field named `workshopId`) was
identified as pre-existing, unrelated code and reverted to its original form rather than left
touched.

## Mobile API — `mobile-api/routes/auth.js`

- **`auditLogin(userId, username, fullName, role, actionType, action, ip, meta, workshopId)`** —
  gains a `workshopId` parameter, written to the new column. All 4 call sites updated: the 3
  where a real user row is known now pass `user.workshop_id`; the "user not found" case
  correctly passes nothing (defaults to `null` — no user, no determinable workshop).

## Mobile API — `mobile-api/routes/admin.js`

- `GET /audit` — extended with `sortBy`/`sortDir`/`page`/`pageSize`/`workshopFilter` query params
  (backward-compatible). Its own role gate (`ceo`/`admin`/`operations`) was left **unchanged** —
  a live discovery this phase: every role that gate admits is already workshop-exempt per
  `isWorkshopRestricted`, so mobile was never actually exposed to the NF-01 leak in the first
  place; broadening the gate to match desktop's wider permission-based set would be a new
  capability decision, out of this security phase's scope.
- `GET /audit/export` — **new**, mirrors `finance.js`'s own binary-export route pattern
  (`Content-Type`/`Content-Disposition` headers, raw buffer body).

## IPC — `electron/main.js` / `electron/preload.js`

- `audit:exportExcel` handler added (base64-encodes the buffer for the IPC round-trip, identical
  pattern to `finance:operationsExportExcel`/`payroll:exportExcel`/`sales:exportExcel`).
  `auditExportExcel` added to the preload bridge.

## Desktop — `renderer/app.js`

- `renderAudit()` rebuilt: sortable Time/Role/Module/Type column headers (▲/▼ indicator, same
  toggle-on-repeat-click convention as every other sortable table in this app); real pagination
  (Prev/Next, "page X of Y", replacing the old static "max 500" label); a Workshop filter
  dropdown and a Workshop column, both rendered **only** when the backend actually returns a
  `workshops` list (i.e., only for a non-restricted viewer — the control doesn't exist at all for
  a restricted one, not merely hidden); an Export Excel button using the same
  base64→Blob→download pattern established in Phase C1/C2/C4, with the same `showToast(...)`
  loading/success/error convention as `_finOpsExportExcel`.

## What was deliberately NOT changed

- **No historical backfill.** `audit_log_no_update` was never suspended, not even temporarily,
  not even for a narrowly-scoped metadata-only backfill — see Completion Report §8 for the full
  reasoning. All 2,511 pre-phase rows keep `workshop_id = NULL` permanently and are grandfathered
  into every viewer's visibility via the cutover marker instead.
- **No permission was widened or narrowed.** The Phase 14 permission table (Completion Report
  §15) is a live snapshot, not a change.
- **10 ambiguous call sites** (two plausible record variables, e.g. a sales order vs. its linked
  delivery order) were left on the safe default rather than guessed at.
- **Mobile `AuditScreen.tsx` UI** was not extended with sort/pagination/export controls — its
  access is already `ceo`/`admin`/`operations`-only, so none of this phase's isolation logic ever
  activates for it; adding that UI would be a PR-16-style UX improvement, not a security
  necessity, and was left out of this phase's scope.
- **No heuristic/fake workshop filter** (e.g., scoping by the *acting* user instead of the
  *affected record*) was used anywhere — every override traces to either the acting user's own
  real assignment or an explicitly-fetched record.

## Verification

- `node --check` clean on all 7 touched files.
- `npx tsc --noEmit` clean across the mobile project (exit 0) — no mobile TypeScript file was
  touched this phase; run anyway per the regression requirement.
- Live migration executed twice against production (fresh + idempotency re-run) — column, index,
  and cutover marker all confirmed via direct query.
- **Live E2E: 26/26 checks passed** — two disposable QA accounts in two different real
  production workshops; a real mutation (`materialRequestsCreate`) in each; correct workshop
  attribution confirmed on the resulting audit rows; cross-workshop read denial verified in both
  directions; own-workshop read success verified in both directions; global (admin) user
  confirmed to see both; parameter-override (`workshopFilter` set to the *other* workshop)
  confirmed silently ignored; export isolation and row-count parity confirmed; two concurrent
  writes (one per workshop, fired via `Promise.all`) confirmed to land with correct, non-cross-
  contaminated attribution; a role without the `audit` permission confirmed denied; an admin
  action (global event) confirmed to produce `workshop_id = NULL`, not a fabricated value.
- A second, separate live regression exercised a full create→update→delete lifecycle on a
  different module (`harvestPlanCreate`/`Update`/`Delete`) to confirm the fix generalizes beyond
  the module used in the primary E2E suite — all three operations succeeded, correct workshop
  attribution confirmed on the create.
- QA cleanup: all QA business data (`material_requests`, `harvest_plans` rows) hard-deleted and
  confirmed zero residue; QA user accounts soft-deleted (hard-delete is impossible once an
  account has produced any `audit_log` row — a live discovery, not a bug, see Completion Report
  §28) and confirmed zero *active* residual accounts. 8 permanent, undeletable, QA-tagged
  `audit_log` rows remain by design, documented rather than hidden.
- No commit made, no push — consistent with this session's established practice.
