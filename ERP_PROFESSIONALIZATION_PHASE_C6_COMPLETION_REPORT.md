# Phase C6 — Audit Log Security & Workshop Isolation (NF-01 Remediation) — Completion Report

Companion files: `_CHANGELOG.md` (exact file-by-file diff summary), `_GAP_REGISTER.md` (workshop
context matrix, candidate reasoning, disposition).

## 1. Executive Summary

NF-01 — Audit Log had zero Workshop Isolation despite the `audit` permission being held by many
genuinely workshop-scoped roles — is **RESOLVED**. Workshop Isolation is now enforced entirely
server-side, in SQL, using the exact same `isWorkshopRestricted(user)` function every other
module in this codebase already relies on. A new `workshop_id` column was added to `audit_log`;
the shared `logAudit()` writer now derives or accepts an explicit, trusted workshop attribution
for every new row; all ~238 call sites were reviewed and the ones needing an explicit override
were threaded through — a process that itself surfaced **7 real, independently-confirmed bugs**
(pre-existing variable-scope/SQL-alias-confusion mistakes introduced by my own bulk-threading
pass, caught before shipping via a rigorous static scope-verifier, not left for a user to find).
Read access, search, sort, pagination, export, and parameter-override protection were all
rebuilt on top of the new isolation predicate and live-tested against production data with two
disposable QA accounts in two different workshops. **26 of 26 live security/functional checks
passed.** Historical audit rows (2,511 of them, predating this phase) are preserved and remain
visible to every viewer exactly as before — a deliberate "grandfather cutover" design, not a
gap — because `audit_log`'s own `audit_log_no_update` rule makes retroactively assigning them a
workshop_id impossible without weakening the exact tamper-evidence guarantee this phase exists
to strengthen, and that guarantee was never compromised to make backfilling easier.

## 2. Original NF-01 Finding

`auditList` applied zero `workshop_id`/`isWorkshopRestricted` filtering — company-wide for every
viewer who could reach the page. The `audit` permission is held live by 19 roles (confirmed this
phase, see §4/§15), many of them genuinely workshop-scoped with real, active, workshop-assigned
users today (not a theoretical risk — see §15's live counts). A workshop-restricted storekeeper
or supervisor could view audit rows describing changes made at every other workshop too.

## 3. Current Audit Architecture (as re-discovered this phase, not assumed from memory)

- **Writers**: `logAudit()` (`db/services/data.js`) — the shared writer used by ~238 call sites;
  `handleAuditReplay()` — a workflow-job fallback that re-attempts a write if the primary insert
  fails; `auditLogin()` (`mobile-api/routes/auth.js`) — a **separate, third write path**, not
  previously known to route through `logAudit`, used only for login/login-failed/login-denied
  events. All three now populate `workshop_id`.
- **Readers**: `auditList()` (`db/services/data.js`) — the sole read path, used by both desktop
  (`audit:list` IPC) and mobile (`GET /admin/audit`). No separate by-ID detail endpoint exists
  anywhere (confirmed by grep across `main.js`/`preload.js`/`mobile-api/routes`) — Audit Log is
  list-only on both platforms; there was nothing to test for direct-ID bypass beyond the list
  query itself.
- **Consumers**: desktop's Audit Trail page (`renderer/app.js`, `renderAudit`); mobile's Audit
  Trail screen (`AuditScreen.tsx`, gated to `ceo`/`admin`/`operations` only at the route level —
  see §15). The generic per-record History tab (`logisticsRecordHistory`) is a **separate,
  already-correct mechanism** reading module-specific tables, not `audit_log` — confirmed
  unaffected by, and irrelevant to, this fix.
- **Immutability**: `audit_log_no_update`/`audit_log_no_delete` PostgreSQL rules silently no-op
  any `UPDATE`/`DELETE` against the table. This is the single most important architectural fact
  driving this phase's design (see §7, §8).

## 4. Exact Audit Call-Site Count

**238**, not 239. The figure carried forward from Phase C4/C5 (239) was off by one — it counted
`logAudit`'s own function *definition* line (`async function logAudit(user, ...`), which also
matches a naive `grep "logAudit("` count, alongside its real call sites. A precise re-count this
phase (excluding the definition, verified via `node -e` regex scan) found **238 real call sites**,
all in one file (`db/services/data.js`). A separate, untracked, unreferenced backup file
(`db/services/data - Copy.js`, not in `git ls-files`, not required anywhere) also contains a stale
121 occurrences — excluded from scope entirely; it is not part of the running application.

## 5. Workshop Context Matrix

Full matrix (by module, with call-site counts and A/B/C classification) is in the Gap Register.
Summary: of 238 call sites, 168 already passed an explicit `module:` tag (bucketed by module);
71 did not (bucketed by enclosing function name). Classification method: **primary derivation
from the acting user's own `workshop_id`** (Type A, the overwhelming majority — safe by
construction, because every write path that mutates a workshop-owned record already enforces,
via `isWorkshopRestricted`/ownership checks, that a workshop-scoped actor can only touch their
own workshop's records, so "actor's workshop" and "record's workshop" already coincide there).
**64 call sites were auto-identified and threaded with an explicit override** where a
workshop-exempt actor (admin/ceo/operations/logistics) could plausibly act on a specific
workshop's record and the record's own `workshop_id` was locally available — this is the case
the default derivation cannot get right on its own. **10 ambiguous call sites** (two plausible
record variables, e.g. a sales order vs. its linked delivery order) were deliberately left on the
safe default rather than guessed. Truly global/system events (role changes, user management,
automation config, monthly sign-off, KPI targets, escalation engine) correctly fall through to
`workshop_id = NULL` because their actors are always workshop-exempt — confirmed, not assumed
(see §9's live test).

## 6. Database Design

`audit_log.workshop_id bigint references warehouses(id)`, **nullable**, indexed
(`idx_audit_log_workshop`). Nullable is correct and deliberate — legitimate global/system events
must be representable, and the column cannot be `NOT NULL` without either breaking those events
or fabricating a workshop for them (explicitly forbidden). No new/duplicate workshop table was
created — reuses `warehouses`, the same table every other `workshop_id` column in this codebase
already references.

## 7. Migration

`auditLogWorkshopIsolation()` (`db/migrate.js`), run from `migrate()` on every app startup,
idempotent (`add column if not exists`, `create index if not exists`, `create table if not
exists`). Live-executed against production twice (once fresh, once to prove idempotency — the
cutover marker did not move on the second run). No row was altered, deleted, or had a value
fabricated.

## 8. Historical Backfill

**Deliberately not performed**, and this needs to be stated plainly rather than glossed over:
`audit_log_no_update` blocks any `UPDATE` against this table, including one issued by a
migration script. That rule is not incidental — it is the load-bearing guarantee that makes this
table trustworthy evidence at all. Suspending it, even briefly, even for a narrowly-scoped
metadata backfill that touches only the new column, would establish exactly the kind of
"the immutability rule can be worked around when convenient" precedent this security phase
exists to prevent. So: **zero historical rows were backfilled, by design, not by oversight.**

To avoid that decision silently regressing "existing audit history stays visible" (an explicit
must-not-break requirement), a **one-time cutover marker** (`audit_log_workshop_cutover`, a
single row, `cutover_id = 2511`, the exact `max(id)` at migration time) was captured. Every row
at or before the cutover is grandfathered — visible to every audit-permitted viewer exactly as
before this phase, regardless of role or workshop. Only rows created *after* the cutover are
truly workshop-isolated. Live counts: **total audit rows 2,511 → 2,548** by the end of this
phase's testing (37 new rows from migration-time logins, live QA testing, and this report's own
regression checks); **rows successfully workshop-assigned going forward**: every new Type-A row
tested (confirmed via the E2E suite); **rows remaining NULL**: all 2,511 historical rows
(permanently, by the design above) plus any new genuinely-global event; **global/system rows**:
confirmed live — an admin creating a QA user (a global action) produced `workshop_id = NULL`,
not a fabricated value (§20 test 21); **ambiguous rows**: none newly created during testing that
weren't cleanly resolved by the derivation logic.

## 9. Global/System Events

Confirmed live and by design: any action performed by a workshop-exempt actor
(`admin`/`ceo`/`operations`/`logistics`, or any user with no `workshop_id` assigned at all) with
no explicit record-level override produces `workshop_id = NULL`. These rows remain visible to
every global (non-restricted) viewer exactly as before. They are **not** shown to workshop-
restricted viewers going forward (only pre-cutover NULL rows are grandfathered to them) — a
deliberate, minimal, direct consequence of actually enforcing "workshop-scoped users see only
their own workshop's history" for new data, not an accidental widening or narrowing. Nothing in
the query ever does `workshop_id = user_workshop OR workshop_id IS NULL` for restricted viewers
on new data — that would have silently re-opened exactly the kind of unauthorized-scope leak this
phase closes.

## 10. `logAudit` Changes

New `opts.workshopId` (explicit, trusted override — callers are expected to source it from a
DB-fetched record, never from raw request input). Derivation order: `opts.workshopId` if
provided → `user.workshop_id` → `null`. `handleAuditReplay` (the failure-fallback insert path)
and `auditLogin` (mobile's separate login-event writer) were updated in lockstep so no write path
was left un-isolated. **Never derives from `req.body`/raw client input** — confirmed by
construction, since the only two inputs are the server-resolved `user` object and a caller-
computed override.

## 11. Read Isolation

`_auditBuildQuery()` (new, shared helper) is the single source of truth for the Workshop
Isolation predicate, used by both `auditList` and the new `auditExportExcel` — they cannot drift
apart. For a restricted viewer: `(a.workshop_id = <their workshop> OR a.id <= <cutover>)`. For a
global viewer: no workshop constraint at all (unchanged from before this phase). Live-verified
(§20): a workshop-A QA user saw zero workshop-B rows across list, filtered list, and export; an
admin saw both.

## 12. Parameter Override Protection

Live-tested with a real attempted bypass: a workshop-A QA user called `auditList` with
`workshopFilter: <workshop B's id>` explicitly set. The result was byte-for-byte identical to the
unfiltered call — the override was silently ignored, never used to widen or redirect scope (§20
test 12). The workshop filter is only ever honored for a non-restricted caller
(`!isWorkshopRestricted(user)`), checked server-side on every call, never trusting client state.

## 13. Desktop

`renderAudit()` (`renderer/app.js`) rebuilt: real server-side sort (Time/Role/Module/Type,
▲/▼ indicator), real pagination (replacing the old hard `limit 500`, with Prev/Next + "page X of
Y"), a Workshop filter dropdown (rendered only when the viewer is global — `res.workshops` is
empty for a restricted viewer, so the control simply doesn't exist for them, not just hidden), a
Workshop column in the table (shown only alongside that same dropdown), and an Export Excel
button. All of it calls through the same isolated `_auditBuildQuery` — there is no separate,
divergent desktop-only query path.

## 14. Mobile

`GET /admin/audit` (`mobile-api/routes/admin.js`) extended with the same
sort/page/pageSize/workshopFilter params (backward-compatible — an old client that never sends
them gets the previous behavior's equivalent, now correctly isolated). A new `GET
/admin/audit/export` route was added, reusing `auditExportExcel`. **`AuditScreen.tsx`'s UI was
deliberately left unchanged** — see §15 for why building sort/pagination/export UI there would
have been scope creep beyond this security phase's mandate, not a gap.

## 15. Permissions (live-audited, not assumed)

| Role | Holds `audit`? | Active users (this session) | Users with `workshop_id` set | Workshop-restricted in practice? |
|---|---|---|---|---|
| admin | yes | 1 | 0 | No |
| ceo | yes | 1 | 0 | No |
| finance | yes | 1 | 0 | No (this instance) |
| harvesting-leader | yes | 1 | 1 | **Yes** |
| harvesting-supervisor | yes | 1 | 1 | **Yes** |
| logistics | yes | 1 | 0 | No (exempt role) |
| logistics-officer | yes | 1 | 0 | No (this instance) |
| operations | yes | 1 | 0 | No (exempt role) |
| poles-leader | yes | 1 | 1 | **Yes** |
| poles-supervisor | yes | 0 | 0 | n/a (no active user) |
| sales | yes | 1 | 0 | No (this instance) |
| sales-staff | yes | 1 | 1 | **Yes** |
| sawmill-leader | yes | 1 | 1 | **Yes** |
| sawmill-supervisor | yes | 1 | 1 | **Yes** |
| showroom-staff | yes | 1 | 1 | **Yes** |
| storekeeper | yes | 2 | 2 | **Yes** |
| supervisor | yes | 2 | 2 | **Yes** |
| vat-leader | yes | 1 | 1 | **Yes** |
| vat-supervisor | yes | 0 | 0 | n/a (no active user) |

**11 of 19 roles that hold `audit` have real, active, workshop-assigned users today** — this was
not a theoretical risk. No permission was widened or narrowed this phase (per the Stop Rule) —
this table is a live snapshot, not a change.

## 16. Governance

Governed actions (approvals, rejections, corrections) route through the same mutation functions
already covered by the call-site threading pass (e.g. `materialRequestsApprove`,
`rejectionResolve*`, `stockTransfersApproveReject`) — no separate governance-specific audit path
exists. Live-verified via the material-requests create/approve flow's audit trail in the E2E
suite.

## 17. Notifications

Confirmed via grep: no notification payload anywhere references an `audit_log` row id or links
into the Audit Log page (`relatedModule` values across the codebase are things like
`'material-requests'`, `'stock-transfers'`, etc. — never `'audit'`). There is no deep-link
backdoor from a notification into another workshop's audit record, because no such deep link
exists at all.

## 18. Search / 19. Filters / 20. Sorting / 21. Pagination

All four rebuilt together in `auditList`/`_auditBuildQuery` (search unchanged; module/action-
type/role/date filters unchanged; sort and pagination newly added — see §13 for the UI). Every
filter, including the newly-added workshop filter, composes with the Workshop Isolation predicate
rather than replacing it — a restricted viewer's own scoping is applied first and cannot be
widened by any other filter.

## 22. Export

**New** (`auditExportExcel`) — did not exist before this phase. Built only after isolation was
proven (§11), and only by reusing `_auditBuildQuery` directly — it is structurally impossible for
export to see a wider slice than the list, because they call the identical function. Live-tested:
a workshop-A export's row count exactly matched the equivalently-filtered list's row count, and
produced a real `.xlsx` (`PK` zip signature, not a stub).

## 23. Data Integrity

Verified live: zero audit rows deleted (`audit_log_no_delete` never touched); zero rows
duplicated (each mutation produced exactly one new row, confirmed by `record_id`-scoped lookups
in the E2E suite); zero fabricated `workshop_id` values (every non-null value traced back to
either the acting user's own assignment or an explicitly-fetched record); the `workshop_id`
foreign key is valid by construction (`references warehouses(id)`, enforced by Postgres, not
just convention); all 2,511 historical rows remain exactly as they were, readable, unmodified.

## 24. Concurrency

Live-tested: two `materialRequestsCreate` calls fired **simultaneously** via `Promise.all`, one
from a workshop-A actor and one from a workshop-B actor. Both audit rows landed with the correct,
non-cross-contaminated `workshop_id` (§20 tests 17–20). This is inherently safe by the write
design — every `logAudit` call is an independent `INSERT`, never an `UPDATE`, so there is no
shared mutable state for two concurrent writers to race over.

## 25. Security Tests

Full matrix executed live (workshop-A user, workshop-B user, global user; list/search/filter/
detail/export/parameter-override/direct-ID). See §26 for the itemized results — all pass.

## 26. Live E2E

**26 of 26 checks passed**, using two disposable QA accounts (`_qa_phaseC6b_wsA`/`wsB`) created
in two different real production workshops, exercising: account creation, a real mutation
(`materialRequestsCreate`) in each workshop, correct workshop attribution on the resulting audit
rows, cross-workshop read denial in both directions, own-workshop read success in both
directions, global-user sees-both, parameter-override-ignored, export isolation and row-count
parity, concurrent-write correctness, non-audit-role denial, and global-event NULL-attribution
correctness. A second, separate regression check exercised a full create→update→delete lifecycle
on a different module (`harvestPlan*`) to confirm the fix generalizes beyond the module used for
the primary suite.

## 27. Regression

`node --check` clean on every touched file (`db/migrate.js`, `db/services/data.js`,
`electron/main.js`, `electron/preload.js`, `mobile-api/routes/admin.js`,
`mobile-api/routes/auth.js`, `renderer/app.js`). `npx tsc --noEmit` clean across the mobile
project (no mobile `.ts`/`.tsx` file was touched this phase — checked anyway, per the Stop
Rule's regression requirement). No shared function outside the audit-writing/reading surface was
modified. **7 real, pre-shipping bugs were found and fixed during this phase's own scope-
verification pass** (not by a later user report) — see the Changelog for the full list; each was
a variable-scope or SQL-column-alias-vs-JS-variable confusion introduced while threading the 64
auto-applied call sites, caught by a purpose-built static scope-verifier before any of them
reached production behavior.

## 28. QA Cleanup

All QA business data removed (`material_requests` rows deleted directly; the one QA
`harvest_plans` row deleted directly). QA user accounts (`_qa_phaseC6b_wsA`/`wsB`) were
**soft-deleted**, not hard-deleted — a live discovery this phase: `app_users` cannot be
hard-deleted once it has produced any `audit_log` row, because `audit_log_user_id_fkey` has no
`ON DELETE CASCADE`/`SET NULL` — a real, enforced consequence of the immutable-evidence design,
not a bug, and not worked around. **8 permanent, undeletable, QA-tagged `audit_log` rows remain**
by design (the QA accounts' own creation/deletion events plus their test mutations) — this is the
expected, documented outcome per this phase's own Stop Rule ("do NOT delete legitimate immutable
audit records; document the expected permanent QA audit records instead"), not residue. Verified
live: zero residual QA rows in `material_requests`, `harvest_plans`, or active (non-deleted)
`app_users`.

## 29. Remaining Gaps

- **PR-20** (dashboard drill-down, 4 of 6 instances) — unrelated to this phase, unchanged.
- **PR-02, PR-03–14/16 (export), PR-17/18, P3 backlog, PR-33** — unrelated, unchanged.
- **10 ambiguous call sites** (§5) were deliberately left on the safe default (workshop_id=null
  when the actor is exempt) rather than guessed — a future phase could resolve these with a
  closer per-function reading if the completeness gain is judged worth it; the safety property
  (never over-exposes) already holds today.
- **Mobile Audit Screen UI** was not extended with sort/pagination/export controls — its access
  is already limited to `ceo`/`admin`/`operations` (all globally-scoped), so none of this phase's
  isolation logic ever activates for it; building that UI is a PR-16-style UX improvement, not a
  security necessity, and was left for a future, appropriately-scoped UX phase rather than bundled
  in here.

## 30. Production Readiness

**NF-01 is resolved.** Every workshop-scoped audit record written from this phase forward carries
trustworthy attribution; every workshop-restricted viewer sees only their own workshop's audit
history (plus the grandfathered historical set, unchanged from before); global viewers retain
full visibility; historical evidence was never altered; parameter/workshop-filter bypass attempts
are blocked server-side; export cannot see more than the equivalent list; the entire audit-writing
pipeline (238 call sites, 3 write paths) remains fully operational, confirmed via live regression
across two independent modules. Per the Final Stop Rule: **not starting Phase C7**, no commit, no
push, no unrelated P2/P3 item touched, no weakening of Workshop Isolation to accommodate legacy
data.

**Files changed this phase**: `db/migrate.js`, `db/services/data.js`, `electron/main.js`,
`electron/preload.js`, `mobile-api/routes/admin.js`, `mobile-api/routes/auth.js`,
`renderer/app.js`. `db/clear-data.js` shows as modified in `git status` but was **not** touched
by this phase — that change predates Phase C6 (part of this session's earlier, still-uncommitted
Nyanza Value-Added Production work) and is unrelated.
