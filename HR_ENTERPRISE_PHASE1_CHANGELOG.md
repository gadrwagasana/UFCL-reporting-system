# HR Enterprise Phase 1 — Changelog

## Backend (`db/services/data.js`)

- `casualsUpdate(userId, casualId, payload)`:
  - Role gate widened from `['admin','ceo','operations']` to `['admin','ceo','operations','supervisor']` (approved via `AskUserQuestion` — desktop already showed Edit to supervisor, but the backend always rejected it).
  - New Workshop Isolation check: a workshop-restricted caller (now includes `supervisor`) can only edit a casual worker belonging to their own workshop.
  - Fixed the `active` field: was `p.active !== false` (any non-`false` value, including `undefined`, forced `true` on every edit — a casual worker could never actually be deactivated, and a prior deactivation would be silently undone by the next unrelated edit). Now falls back to the existing stored value when the caller doesn't explicitly send `active`.
- `casualsDelete(userId, casualId, reason)`:
  - Role gate widened to match `casualsUpdate` (same approval).
  - New Workshop Isolation check, same reasoning as above.
- `casualLabourRequestsReview(userId, requestId, status)`:
  - Added a status guard: only a `Pending` request can be reviewed (was previously reviewable any number of times, silently re-stamping `reviewed_by`/`reviewed_at` or flipping a decision after the fact).
  - Added a `pushNotification` to the request's `created_by` on approve/reject (this workflow had zero notification producers before), matching the established `materialRequestsApprove` pattern (`relatedModule: 'casual-requests'`, `relatedId`, `category: 'hr'`).

## Desktop (`renderer/app.js`)

- `NOTIFICATION_ROUTES` — added a `'casual-requests'` entry (page-only, routes to the `casual-requests` page — same class as the existing `material-requests` entry).
- `renderCasuals()`'s `casualForm()`/`payloadFrom()` — added an "Active" checkbox to the Employment/Status section of the Register/Edit form, and included `active` in the submitted payload (previously never sent at all).

## Mobile (`mobile/`)

- **New**: `mobile-api/routes/casuals.js` — REST exposure for the Casuals registry (`GET/POST /api/casuals`, `PUT/DELETE /api/casuals/:id`), registered in `mobile-api/server.js`. First-ever REST/mobile exposure for this capability.
- `src/api/endpoints.ts` — added `CASUALS_LIST`/`CASUALS_CREATE`/`CASUALS_UPDATE`/`CASUALS_DELETE`.
- `src/types/api.ts` — added `CasualWorker`/`CasualWorkerListResponse` types, mirroring `casualsList`'s SELECT exactly.
- **New**: `src/hooks/useCasuals.ts` — `useCasualsList`/`useCasualCreate`/`useCasualUpdate`/`useCasualDelete`, mirroring `useCustomers.ts`'s shape.
- **New**: `src/screens/casuals/CasualsListScreen.tsx` — list with active/total metrics, register (+), edit (row tap), delete (with `ReasonModal`).
- **New**: `src/screens/casuals/CasualFormScreen.tsx` — full registration/edit form (personal info, employment details, emergency contact, salary, and an Active `Switch` shown only when editing), reusing `FormInput`/`FormSelect`/`DatePickerField`.
- `src/navigation/types.ts` — `CasualLabourStackParamList` gained `CasualsList`/`CasualForm` entries (stack push into the existing shared stack, not a new tab).
- `src/navigation/CasualLabourStack.tsx` — registered the two new screens.
- `src/screens/labour/CasualLabourListScreen.tsx` — added a role-gated ("Casual Workers") header action, visible only to `admin/ceo/operations/supervisor` (the roles that actually hold the `casuals` permission) — this stack is also mounted for `harvesting-leader`/`sawmill-leader`/`vat-leader`, who never see the button.
- `src/utils/permissions.ts` — added a new `'casual.manage'` permission key, granted to `admin`/`ceo`/`operations`/`supervisor` (read and write share the same backend role gate, unlike e.g. `sales.view` vs `sales.create`).
- `src/utils/notificationRouting.ts` — added a `'casual-requests'` entry (page-only, routes to `CasualLabourList` — same class as `purchased_pole_qc`/`machines`/`dispatch`).

## Verification artefacts

Temporary QA scripts (`_qa_hr1_*.js`) were used for live verification against the production database and deleted after use; see the Completion Report §18–§20 for results.
