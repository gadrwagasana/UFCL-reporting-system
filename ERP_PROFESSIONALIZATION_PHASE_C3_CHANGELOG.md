# Phase C3 — Automation Custom Rules — Changelog

Scope: PR-22/PR-23 from the master gap register — `createAutomationRule`/`deleteAutomationRule`
had zero UI call site on either platform despite being fully built, validated, IPC-wired, and
preload-exposed. Only this item was worked; no other P2/P3 item, department, or unrelated
improvement was started.

## Backend — `db/services/data.js`

- **`BUILT_IN_RULES`** — extended from the original 8 rule keys to also include the 6
  `procurement_*` rule keys that `db/migrate.js`'s `seedProcurementAutomationRules()` re-seeds on
  every app startup via `ON CONFLICT (rule_key) DO UPDATE`, exactly like the original 8. Found
  during re-verification, not part of the originally-scoped finding: without this fix, deleting
  one of those 6 rules through the new Delete UI would have appeared to succeed and then silently
  reappeared on the next app restart. No IPC/REST/UI change was needed for this fix — it's
  entirely internal to `deleteAutomationRule`'s existing guard clause.
- No other backend change — `createAutomationRule`/`deleteAutomationRule` themselves were already
  fully correct (validated, audited, role-gated); confirmed via live testing, not modified.

## Desktop — `renderer/app.js`, `renderAutomationCenter()`

- Added a **"New Rule"** button to the Rule Status panel header, opening a new `_acNewRule()`
  overlay (same shape as the existing `_acEditRule()` overlay, plus the 3 identity fields an
  update can't touch: rule key, label, description). Calls the already-existing
  `UFCL.automationCreate`.
- Added a **Delete** button to each rule row, calling a new `_acDeleteRule(ruleKey, label)`
  function (native confirm dialog, then `UFCL.automationDelete`). No client-side duplication of
  which rules are "built-in" — the backend's own friendly rejection message
  ("Built-in rules cannot be deleted. Disable them instead.") is surfaced directly.

## Mobile

- **`mobile-api/routes/automation.js`** — added `POST /rules` → `createAutomationRule` and
  `DELETE /rules/:key` → `deleteAutomationRule`, both gated `requireRoles('ceo','admin')`
  (matching the existing `PUT /rules/:key` route's gate).
- **`mobile/src/hooks/useAutomation.ts`** — added `useCreateAutomationRule()` and
  `useDeleteAutomationRule()` mutations, both invalidating the `['automation','dashboard']`
  query on success, matching the existing `useUpdateAutomationRule()` pattern.
- **`mobile/src/navigation/types.ts`** — `AutomationRuleDetail`'s `ruleKey` param changed from
  required to optional; omitting it now means create mode.
- **`mobile/src/screens/automation/AutomationRulesScreen.tsx`** — added a "+" header action
  (visible only to `automation.edit_rules` holders) navigating to `AutomationRuleDetail` with no
  `ruleKey`.
- **`mobile/src/screens/automation/AutomationRuleDetailScreen.tsx`** — added a full create-mode
  render path (rule key/label/description + the same severity/action/cooldown/roles fields the
  edit mode already has; threshold starts empty, matching the screen's own pre-existing "edit
  threshold from desktop" precedent) and a Delete button in edit mode. Edit-mode behavior is
  otherwise byte-for-byte unchanged.

## What was deliberately NOT changed

- No new permission key — reused the existing `automation.edit_rules` key, already scoped to
  exactly `admin`/`ceo` (matching the backend's own gate).
- No governance/approval-engine integration — `createAutomationRule`/`deleteAutomationRule` were
  already deliberately built without one (admin-only system configuration, no ownership concept),
  consistent with other admin-only actions elsewhere in the app; not something this phase needed
  to add.
- No new `NOTIFICATION_ROUTES` entry — verified no notification ever fires for rule create/update/
  delete (only for a rule's own automated firing, a different concept).
- No threshold JSON editor added to mobile — the existing edit screen already scopes that to
  desktop-only; the new mobile create form follows the same, already-established precedent.
- No change to `createAutomationRule`/`deleteAutomationRule`'s own validation, role gate, or audit
  logging — all were already correct.

## Verification

- `node --check` clean on `db/services/data.js`, `renderer/app.js`, `mobile-api/routes/automation.js`.
- `npx tsc --noEmit` clean across the entire `mobile/` project (exit code 0).
- Live E2E test against production data (disposable, tagged QA rule keys, fully cleaned up
  afterward): **24/24 checks passed** — see the Completion Report for the full scenario list,
  including permission denial, validation, duplicate rejection, a genuine concurrency race
  (2 simultaneous creates with the same key — exactly 1 wins), built-in protection for both the
  original 8 rules and the 6 newly-protected procurement rules, audit trail verification, and a
  regression check that the dashboard/rule list still work normally afterward.
- No commit made, no push — consistent with this session's established practice.
