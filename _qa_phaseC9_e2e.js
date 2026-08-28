require('dotenv').config();
const data = require('./db/services/data');
const { pool } = require('./db/pool');

let pass = 0, fail = 0;
function check(label, cond) {
  if (cond) { pass++; console.log('PASS -', label); }
  else { fail++; console.log('FAIL -', label); }
}

(async () => {
  const admin = (await pool.query("select id from app_users where role='admin' and active=true limit 1")).rows[0].id;

  const wsRows = (await pool.query("select id, name from warehouses where active=true order by id limit 3")).rows;
  const [wsA, wsB] = wsRows;
  console.log('Using workshops:', wsA, wsB);

  // Pick a low-value, low-risk stock item (avoid Diesel Fuel per this
  // session's own established caution around that specific item/warehouse).
  const item = (await pool.query("select id, name from stock_catalog where active=true and name not ilike '%diesel%' limit 1")).rows[0];
  console.log('Using item:', item);

  async function stockAt(wsId) {
    const r = await pool.query('select quantity from stock_levels where item_id=$1 and warehouse_id=$2', [item.id, wsId]);
    return r.rows.length ? Number(r.rows[0].quantity) : 0;
  }

  const beforeA = await stockAt(wsA.id);
  const beforeB = await stockAt(wsB.id);
  console.log('stock before — A:', beforeA, '| B:', beforeB);

  // Ensure source workshop A has enough stock to dispatch from (top up via
  // the real, reviewable materialRequestsApprove -> stockTransfers path is
  // circular for seeding, so this one seed step uses a direct, delta-only
  // adjustment — never an absolute SET — and is fully reversed in cleanup).
  const seedQty = 20;
  await pool.query(
    `insert into stock_levels(item_id, warehouse_id, quantity, updated_at) values ($1,$2,$3,now())
     on conflict(item_id, warehouse_id) do update set quantity = stock_levels.quantity + $3, updated_at = now()`,
    [item.id, wsA.id, seedQty]
  );
  console.log('seeded +', seedQty, 'at workshop A for test dispatch capacity');

  // ── Material Request (workshop B needs the item) ───────────────────────
  const mr = await data.materialRequestsCreate(admin, {
    item_id: item.id, workshop_id: wsB.id, requested_qty: 10, reason: '_QA_PhaseC9 test',
  });
  check('material request created', mr.ok);

  // ── Approve -> auto-creates Stock Transfer (source=A, dest=B) ──────────
  const appr = await data.materialRequestsApprove(admin, mr.id, 'approve', 10, '_QA_PhaseC9 approve', wsA.id, wsB.id);
  check('material request approved, transfer auto-created', appr.ok);
  const mrDetail = (await pool.query('select transfer_id, status from material_requests where id=$1', [mr.id])).rows[0];
  const transferId = mrDetail.transfer_id;
  check('transfer_id linked to material request', !!transferId);
  check('material request status = approved', mrDetail.status === 'approved');

  const transferAfterApprove = (await pool.query('select status, from_warehouse_id, to_warehouse_id, requested_qty from stock_transfers where id=$1', [transferId])).rows[0];
  check('transfer starts as approved (no second approval chain)', transferAfterApprove.status === 'approved');
  check('transfer correct source/destination', Number(transferAfterApprove.from_warehouse_id) === Number(wsA.id) && Number(transferAfterApprove.to_warehouse_id) === Number(wsB.id));

  // ── Dispatch (partial: 6 of 10) ─────────────────────────────────────────
  const vehicle = (await pool.query("select id from vehicles where status='Active' limit 1")).rows[0];
  const disp1 = await data.stockTransfersDispatch(admin, transferId, { qty: 6, vehicle_id: vehicle?.id, notes: '_QA_PhaseC9 dispatch 1' });
  check('partial dispatch (6 of 10) succeeded', disp1.ok);

  const afterDispatch1 = await stockAt(wsA.id);
  check('source stock decremented by dispatched qty (6)', afterDispatch1 === beforeA + seedQty - 6);

  // ── Receive (partial: 4 of the 6 dispatched) ────────────────────────────
  const recv1 = await data.stockTransfersReceive(admin, transferId, 4, '_QA_PhaseC9 receive 1');
  check('partial receive (4 of 6 in-transit) succeeded', recv1.ok);
  check('transfer not yet complete after partial receive', recv1.completed === false);

  const afterReceive1 = await stockAt(wsB.id);
  check('destination stock incremented by received qty (4)', afterReceive1 === beforeB + 4);

  const transferMid = (await pool.query('select status, dispatched_qty, received_qty from stock_transfers where id=$1', [transferId])).rows[0];
  check('transfer status = partially_received', transferMid.status === 'partially_received');

  // ── Dispatch remainder (4 of 10) + Receive remainder ────────────────────
  const disp2 = await data.stockTransfersDispatch(admin, transferId, { qty: 4, vehicle_id: vehicle?.id, notes: '_QA_PhaseC9 dispatch 2' });
  check('second dispatch (remaining 4) succeeded', disp2.ok);
  const recv2 = await data.stockTransfersReceive(admin, transferId, 6, '_QA_PhaseC9 receive 2'); // 2 remaining from disp1 + 4 from disp2
  check('final receive succeeded', recv2.ok);
  check('transfer now completed', recv2.completed === true);

  const mrFinal = (await pool.query('select status from material_requests where id=$1', [mr.id])).rows[0];
  check('material request auto-completed on full receipt', mrFinal.status === 'completed');

  const afterAll = { A: await stockAt(wsA.id), B: await stockAt(wsB.id) };
  console.log('stock after full cycle — A:', afterAll.A, '| B:', afterAll.B);
  check('source fully decremented by 10 total', afterAll.A === beforeA + seedQty - 10);
  check('destination fully incremented by 10 total', afterAll.B === beforeB + 10);

  const movements = await pool.query(
    "select movement_type, quantity, warehouse_id from stock_movements where transfer_id=$1 order by id", [transferId]
  );
  console.log('stock_movements for this transfer:', movements.rows);
  check('exactly 4 stock_movements rows (2 out, 2 in)', movements.rows.length === 4);
  check('movement types correct (2x transfer_out, 2x transfer_in)',
    movements.rows.filter(m => m.movement_type === 'transfer_out').length === 2 &&
    movements.rows.filter(m => m.movement_type === 'transfer_in').length === 2);

  // ── Concurrency: two simultaneous dispatch attempts on a SECOND transfer ─
  const mr2 = await data.materialRequestsCreate(admin, { item_id: item.id, workshop_id: wsB.id, requested_qty: 5, reason: '_QA_PhaseC9 concurrency test' });
  const appr2 = await data.materialRequestsApprove(admin, mr2.id, 'approve', 5, '_QA_PhaseC9 approve', wsA.id, wsB.id);
  const transferId2 = (await pool.query('select transfer_id from material_requests where id=$1', [mr2.id])).rows[0].transfer_id;

  const [c1, c2] = await Promise.all([
    data.stockTransfersDispatch(admin, transferId2, { qty: 5, vehicle_id: vehicle?.id, notes: '_QA_PhaseC9 concurrent A' }),
    data.stockTransfersDispatch(admin, transferId2, { qty: 5, vehicle_id: vehicle?.id, notes: '_QA_PhaseC9 concurrent B' }),
  ]);
  console.log('concurrent dispatch results:', c1, c2);
  const successes = [c1, c2].filter(r => r.ok);
  check('exactly one of two simultaneous full-qty dispatches succeeded (no double-dispatch)', successes.length === 1);

  const transfer2Final = (await pool.query('select dispatched_qty from stock_transfers where id=$1', [transferId2])).rows[0];
  check('dispatched_qty is exactly 5, not 10 (no phantom double-deduction)', Number(transfer2Final.dispatched_qty) === 5);

  const stockAAfterConcurrency = await stockAt(wsA.id);
  console.log('stock A after concurrency test:', stockAAfterConcurrency);
  check('source stock decremented by exactly 5 from the concurrency test (not 10)', stockAAfterConcurrency === afterAll.A - 5);

  // ── Cleanup ──────────────────────────────────────────────────────────────
  // Reverse the concurrency-test dispatch (5 units sitting in transit at
  // transfer2, never received) — restore to A via the same real receive
  // path isn't applicable since dest is B; use a direct, delta-only
  // adjustment mirroring the dispatch's own effect, fully documented.
  await pool.query('delete from stock_movements where transfer_id in ($1,$2)', [transferId, transferId2]);
  await pool.query('delete from stock_transfer_dispatches where transfer_id in ($1,$2)', [transferId, transferId2]);
  await pool.query('update material_requests set transfer_id=null where id in ($1,$2)', [mr.id, mr2.id]);
  await pool.query('delete from stock_transfers where id in ($1,$2)', [transferId, transferId2]);
  await pool.query('delete from material_requests where id in ($1,$2)', [mr.id, mr2.id]);

  // Restore stock_levels to EXACT pre-test baseline via relative deltas only.
  const nowA = await stockAt(wsA.id);
  const nowB = await stockAt(wsB.id);
  const deltaA = beforeA - nowA; // negative deltas add back, positive deltas remove excess
  const deltaB = beforeB - nowB;
  if (deltaA !== 0) await pool.query('update stock_levels set quantity = quantity + $1 where item_id=$2 and warehouse_id=$3', [deltaA, item.id, wsA.id]);
  if (deltaB !== 0) await pool.query('update stock_levels set quantity = quantity + $1 where item_id=$2 and warehouse_id=$3', [deltaB, item.id, wsB.id]);

  const restoredA = await stockAt(wsA.id);
  const restoredB = await stockAt(wsB.id);
  console.log('stock after cleanup — A:', restoredA, '(expected', beforeA, ') | B:', restoredB, '(expected', beforeB, ')');
  check('workshop A stock restored to exact pre-test baseline', restoredA === beforeA);
  check('workshop B stock restored to exact pre-test baseline', restoredB === beforeB);

  const residue = await pool.query("select count(*) from material_requests where reason ilike '%_QA_PhaseC9%'");
  check('zero residual QA material requests', Number(residue.rows[0].count) === 0);
  const residueTr = await pool.query("select count(*) from stock_transfers where reference like 'MAT-REQ-%' and notes ilike '%_QA_PhaseC9%'");
  check('zero residual QA stock transfers', Number(residueTr.rows[0].count) === 0);

  console.log('\n=== RESULTS:', pass, 'passed,', fail, 'failed ===');
  process.exit(fail > 0 ? 1 : 0);
})().catch(e => { console.error('FATAL', e); process.exit(1); });
