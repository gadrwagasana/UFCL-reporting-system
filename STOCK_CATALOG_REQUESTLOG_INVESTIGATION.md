# Stock Catalog → Material Request / Request Log — Investigation

## 1. Executive Summary

**Finding: No defect exists.** Creating a Stock Catalog item does not create, trigger, or otherwise produce a Material Request, in any code path — desktop, mobile, or REST API. The two features write to different tables through different functions with no call chain, event, IPC message, or REST call connecting them. This was verified two ways: (a) full source-code trace of every function capable of writing to `material_requests`, `pending_edits`, or `stock_catalog`, and (b) a live end-to-end test against the running database, using a throwaway item created and destroyed solely for this investigation, which is the authoritative proof.

The reported symptom ("I add a Stock Catalog item and it shows up in the Request Log needing approval") is real as an *observation*, but its cause is a **workflow sequence**, not a system defect: the moment an item is added to the Stock Catalog, it becomes selectable in the "New Material Request" form's item dropdown. If a request is then submitted for that item — by the same person continuing their work, or by someone else who now sees the new item available — that request legitimately appears in the Request Log pending approval. Nothing automatic created it; a request had to be explicitly submitted through the "New request" button.

A secondary, easily-confused UI element was also identified and ruled out: the Stock Catalog page has its own "N pending approval(s) from supervisor(s)" panel, but it only ever surfaces **edit/delete** governance requests on existing items, never item creation, and it renders on the Stock Catalog page itself — not the Material Requests page.

## 2. Business Expectation

Per the architecture already in place (and per the recent Material Request → Stock Transfer unification work), the two workflows are intentionally independent:

- **Stock Catalog** is the item master — a direct-write CRUD table gated only by the `stock-items` permission. Creating an item is an administrative/catalog action, not a stock movement or a demand signal, so it should never require approval.
- **Material Requests** is a demand-signal workflow ("I need X units of item Y") gated by the `stock-movements` permission, requiring explicit submission and manager approval before it results in a Stock Transfer and any actual inventory movement.

There is no legitimate business reason for adding an item to the catalog to imply a request for that item — the catalog doesn't know how many units anyone needs, from where, or for which workshop, which is exactly the information a Material Request exists to capture.

## 3. Current Behavior (confirmed)

### 3.1 Stock Catalog creation — `db/services/data.js:2536-2559` (`stockItemsCreate`)

```js
async function stockItemsCreate(userId, payload) {
  const user = await getUser(userId);
  if (!(await mustRole(user, 'stock-items'))) return { ok: false, error: 'Access denied' };
  const p = payload || {};
  if (!p.category || !p.name || !p.uom) return { ok: false, error: 'Category, name, and unit of measure are required' };
  const { rows } = await pool.query(
    `insert into stock_catalog(category, name, sku, uom, unit_cost, min_stock, max_stock, notes, created_by)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9) returning id`, [...]);
  const newId = rows[0].id;
  if (isWorkshopRestricted(user)) {
    await pool.query(`insert into stock_levels(item_id, warehouse_id, quantity) values ($1,$2,0) on conflict do nothing`, [newId, user.workshop_id]);
  }
  logAudit(user, `Added stock item: ${p.name}`, ..., { module: 'stock_catalog', actionType: 'create', recordId: newId });
  return { ok: true, id: newId };
}
```

This is the entire function. It:
- Inserts **only** into `stock_catalog`.
- Optionally inserts a zero-quantity `stock_levels` row (workshop-restricted users only, so the item shows up in their own catalog view immediately).
- Writes one `logAudit` entry (module `stock_catalog`, action `create`).
- Does **not** call `applyGovernance` (unlike its sibling `stockItemsUpdate`, see §3.3).
- Does **not** touch `material_requests`.
- Does **not** touch `pending_edits`.
- Does **not** send a `pushNotification`.
- Does **not** trigger any IPC event, REST callback, or webhook beyond the single `secureHandle('stock-items:create', ...)` request/response pair.

### 3.2 Material Request creation — the only way a `material_requests` row is ever inserted

The **only** function that inserts into `material_requests` is `materialRequestsCreate` (`db/services/data.js:3387`):

```js
async function materialRequestsCreate(userId, payload) {
  ...
  const { rows: created } = await pool.query(
    `insert into material_requests(item_id, workshop_id, requested_qty, reason, priority, requested_by)
     values ($1,$2,$3,$4,$5,$6) returning id`, [...]);
  ...
}
```

A full grep of the codebase for every `insert into material_requests` confirms this is the single call site — there is no second, implicit, or automatic insertion path anywhere (no trigger, no batch job, no cron, no cascading insert from another table's write). It is called from exactly one place on desktop (`renderer/app.js`'s `mrAdd` button handler on the Material Requests page) and one REST route (`mobile-api/routes/materialRequests.js POST /`), both of which require the caller to have explicitly filled in and submitted the "New Material Request" form.

### 3.3 Governance queue (`pending_edits`) is a separate mechanism, not involved in creation at all

`stockItemsUpdate` (`db/services/data.js:2561`) — editing an *existing* catalog item — routes through `applyGovernance` (`data.js:390`), which for certain roles/time-windows inserts a row into `pending_edits` instead of applying the change immediately (`autoRequestEdit`/`autoRequestDelete`). This is a real approval queue, but:

- It only fires for **edit and delete**, never for **create**. `stockItemsCreate` has no `applyGovernance` call at all — confirmed by reading the function in full above.
- Its UI surface is a panel embedded directly at the top of the **Stock Catalog** page (`renderer/app.js:8290`: `await insertPendingPanel($('page-stock-items'), ['stock_item'], renderStockItems);`), titled "N pending approval(s) from supervisor(s)" — not the Material Requests page.
- It reads from `pendingEditsList`/`pending_edits`, a completely different table from `material_requests`.

### 3.4 Request Log — exact data source

`materialRequestsList` (`db/services/data.js:3343`):

```sql
select mr.id, sc.name as item_name, sc.category, sc.uom,
       w.name as workshop_name, mr.workshop_id,
       mr.requested_qty, mr.approved_qty, mr.reason, mr.priority, mr.status, ...
from material_requests mr
join stock_catalog sc on sc.id = mr.item_id
left join warehouses w on w.id = mr.workshop_id
left join app_users u1 on u1.id = mr.requested_by
left join app_users u2 on u2.id = mr.reviewed_by
where mr.workshop_id = $1   -- or unfiltered for unrestricted roles
order by mr.requested_at desc limit 100
```

It selects **only** from `material_requests`; the join to `stock_catalog` exists purely to display the item's name/category/UOM next to the request — it is not a data source for rows, only a lookup for display columns. There is no `union`, no secondary table contributing rows, no reference to `pending_edits`, `stock_transfers`, or anything else. A row appears here **if and only if** a `material_requests` row exists for it, which per §3.2 only happens via an explicit `materialRequestsCreate` call.

The desktop "Request Log" heading (`renderer/app.js:8998`, `<h3>... Request Log</h3>`) is the table inside `renderMaterialRequests` — confirming this is exactly the screen the user means.

## 4. Root Cause Analysis

There is no automatic-creation code path, so there is no "root cause" of a defect to trace. What actually happened, most plausibly:

1. A new item was added to the Stock Catalog.
2. That item immediately became available in the "New Material Request" form's item dropdown (this dropdown lists all active `stock_catalog` items — by design, so a newly-added item can be requested right away, same as any other item).
3. A Material Request was then submitted for that item — either by the same user continuing their workflow (e.g. "I just added this part, now let me request some for my workshop") or by a different user/role who saw it newly available.
4. That request appeared in the Request Log pending approval, as every request correctly does.

Two things make this easy to misread as automatic:
- **Timing**: if the request is submitted immediately after the catalog add, the two actions feel like one continuous flow even though they're two separate, deliberate user actions on two different pages.
- **The unrelated pending-approval panel on the Stock Catalog page itself** (§3.3) uses very similar visual language ("pending approval") to the Material Requests Request Log, which could be conflated even though it only ever concerns edits/deletes, never new items, and never appears on the Material Requests page.

## 5. Live Verification Results

All testing used a throwaway QA admin account (`_qa_sc_test`, deactivated afterward, never hard-deleted per the audit-log FK convention) and a throwaway Stock Catalog item (`_QA_TEST_ITEM_SC`, category "QA Test") created and destroyed solely for this investigation — nothing pre-existing was read from or written to via raw SQL at any point (learned from a mistake in the immediately preceding session task; see the `feedback_live_db_testing_safety` note in project memory).

### Scenario A — create a Stock Catalog item, confirm no Material Request is created

```
material_requests count before: 6   →   after: 6   (unchanged)
pending_edits     count before: 4   →   after: 4   (unchanged)
material_requests rows referencing the new item: 0
pending_edits     rows referencing the new item: 0
```

`stockItemsCreate` returned `{ ok: true, id: 11 }` and neither table's row count moved. **Proven: creating a Stock Catalog item does not create a Material Request or a pending-edit record.**

### Scenario B — create a Material Request for that same item and verify the full lifecycle

| Step | Function | Result |
|---|---|---|
| Seed source stock (legitimate `in` movement, not raw SQL) | `stockMovementsCreate` | `{ ok: true }`, warehouse #2 qty → 50 |
| Submit request (10 units, destination = workshop #3) | `materialRequestsCreate` | `{ ok: true, id: 11 }`, appears in `materialRequestsList` with `status: 'pending'` |
| Approve (source = warehouse #2) | `materialRequestsApprove` | `{ ok: true }` — MR → `status: 'approved'`, `transfer_id: 8` (an already-approved Stock Transfer auto-created, per the Material Request → Stock Transfer unification work) |
| Dispatch 10 units | `stockTransfersDispatch` | succeeded |
| Receive 10 units (full) | `stockTransfersReceive` | `{ ok: true, completed: true }` |
| Final MR status | — | `completed` (auto-completed on full receipt) |
| Final stock levels | — | warehouse #2: 40 (50 − 10 dispatched), warehouse #3: 10 (received) |

This confirms the Material Request → approval → Stock Transfer → dispatch → receive → inventory-update → auto-complete chain works correctly end-to-end for an item that was itself just added to the catalog — i.e. a brand-new catalog item behaves identically to any other item once someone explicitly requests it, exactly as expected, and at no point did the *creation* step play any role in producing the request.

### Cleanup

Test material request hard-deleted (no soft-delete column on that table, nothing references it); test transfer and its dispatch record hard-deleted (isolated test data, no audit value worth retaining); test stock_levels/stock_movements rows for the test item removed; test catalog item hard-deleted (unreferenced after the above); throwaway vehicle removed; QA user deactivated (never hard-deleted, per the audit-log foreign key convention). Verified zero residue: `select id from stock_catalog where id=11` and `select id from stock_transfers where id=8` both return no rows.

## 6. Corrective Actions

**None required.** No defect was found in `stockItemsCreate`, `materialRequestsCreate`, `materialRequestsList`, `applyGovernance`, or any UI wiring on desktop or mobile. No code was changed as part of this investigation.

## 7. Final Recommendation

1. **Confirm with the reporting user(s) exactly what sequence they performed** — specifically, whether a Material Request was submitted (by them or a colleague) shortly after adding the item, even if it didn't feel like a separate deliberate step. If they can name the specific item, its `material_requests.requested_by`/`requested_at` can be checked directly to identify who actually submitted the request and when.
2. **Consider a small UX improvement** (not a defect fix, purely optional): the Stock Catalog page's "add item" success confirmation could make clearer that the item is now live and separately requestable, to reduce the chance of the two actions being run together and misremembered as one. This is a nice-to-have, not something the investigation found necessary.
3. No change to the Stock Catalog ↔ Material Request separation is warranted — the current independence is the correct, intended architecture, especially now that Material Requests are the sole entry point into the Stock Transfer lifecycle (see `MATERIAL_REQUEST_TRANSFER_UNIFICATION_CHANGELOG.md`). Merging or auto-linking them would undermine the demand-signal/approval purpose Material Requests exist for.

## Appendix: Files reviewed

- `db/services/data.js` — `stockItemsCreate` (2536), `stockItemsUpdate` (2561), `stockItemsDelete` (5293), `applyGovernance` (390), `autoRequestEdit`/`autoRequestDelete`, `pendingEditsList` (4527), `applyPendingEdit` (4616), `materialRequestsCreate` (3387), `materialRequestsList` (3343), `materialRequestsApprove`.
- `renderer/app.js` — `renderStockItems`/`siAdd` handler, `renderMaterialRequests`/`mrAdd` handler, `insertPendingPanel` (599), its call site for the Stock Items page (8290, absent for Material Requests).
- `mobile-api/routes/stock.js`, `mobile-api/routes/materialRequests.js` — confirmed no cross-calls between the two route files.
- Live database (throwaway data only) — see §5.
