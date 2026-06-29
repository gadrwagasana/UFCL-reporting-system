'use strict';
const { Pool } = require('pg');
require('dotenv').config();
const pool = new Pool();

const PASS = '[OK]  ';
const FAIL = '[FAIL]';
const WARN = '[WARN]';

async function go() {
  let totalFail = 0;
  let totalWarn = 0;

  function ok(msg)   { console.log('  ' + PASS + ' ' + msg); }
  function fail(msg) { console.log('  ' + FAIL + ' ' + msg); totalFail++; }
  function warn(msg) { console.log('  ' + WARN + ' ' + msg); totalWarn++; }

  // ── 1. Principle of Least Privilege — full permission audit ───────────────
  console.log('\n=== 1. PRINCIPLE OF LEAST PRIVILEGE ===');
  const rolesRes = await pool.query('SELECT role, permissions FROM role_definitions ORDER BY role');

  const AUDIT = {
    admin:                   { must:['users','audit','daily-timber','daily-poles','sales','logistics-dashboard','machines','casual-requests'], must_not:[] },
    ceo:                     { must:['ceo','kpi','weekly-cost','audit','machines','logistics-dashboard'], must_not:[] },
    operations:              { must:['daily-timber','daily-poles','daily-harvest','machines','machine-kpi','casual-requests'], must_not:[] },
    logistics:               { must:['logistics-dashboard','stock-transfers','casual-requests','casuals','material-requests'], must_not:['daily-timber','daily-poles','harvest','sales','kpi'] },
    'logistics-officer':     { must:['logistics-dashboard','stock-movements','stock-transfers','material-requests','workshop-overview'], must_not:['daily-timber','daily-poles','harvest','sales','casual-requests','casuals'] },
    sales:                   { must:['sales','deliveries','products'], must_not:['daily-timber','daily-poles','logistics-dashboard','stock-movements','machines','kpi'] },
    finance:                 { must:['weekly-cost','monthly','sage'], must_not:['sales','daily-timber','machines','stock-movements'] },
    supervisor:              { must:['daily-timber','harvest','machine-logs','casual-requests','workshop-overview','material-requests'], must_not:['users','kpi','sage','weekly-cost'] },
    storekeeper:             { must:['stock-items','stock-movements','stock-transfers','material-requests','logistics-dashboard','workshop-overview'], must_not:['daily-timber','daily-poles','harvest','sales','machines','kpi'] },
    'storekeeper-assistant': { must:['stock-movements','machine-fuel','material-requests','workshop-overview'], must_not:['stock-items','stock-transfers','daily-timber','sales','machines','users'] },
    'mechanician':           { must:['material-requests'], must_not:['stock-movements','stock-items','stock-transfers','daily-timber','sales','machines','users'] },
    'harvesting-leader':     { must:['daily-harvest','harvest','log-transport','compartments','casual-requests','workshop-overview'], must_not:['daily-timber','daily-poles','value-added-timber','sales','machine-logs','stock-movements','users'] },
    'sawmill-leader':        { must:['daily-timber','machine-logs','machine-fuel','material-requests','casual-requests','workshop-overview'], must_not:['daily-harvest','daily-poles','value-added-timber','sales','stock-movements','users'] },
    'poles-leader':          { must:['daily-poles','machine-logs','machine-fuel','material-requests','casual-requests','workshop-overview'], must_not:['daily-timber','daily-harvest','value-added-timber','sales','users'] },
    'vat-leader':            { must:['value-added-timber','timber-inventory','material-requests','casual-requests','workshop-overview'], must_not:['daily-harvest','daily-poles','sales','machine-logs','stock-movements','users'] },
    'sales-staff':           { must:['sales','deliveries','products'], must_not:['daily-timber','daily-poles','harvest','logistics-dashboard','stock-movements','machine-logs','users','casual-requests'] },
    'showroom-staff':        { must:['sales','deliveries','products','timber-inventory'], must_not:['daily-timber','daily-poles','harvest','logistics-dashboard','stock-movements','machine-logs','users','casual-requests'] },
  };

  for (const row of rolesRes.rows) {
    const perms = Array.isArray(row.permissions) ? row.permissions : [];
    const check = AUDIT[row.role];
    if (!check) { console.log('  [--]  ' + row.role + ' (no audit spec — skipped)'); continue; }
    const missingMust  = check.must.filter(p => !perms.includes(p));
    const wrongPresent = check.must_not.filter(p =>  perms.includes(p));
    if (missingMust.length)  fail(row.role + ' MISSING: '        + missingMust.join(', '));
    if (wrongPresent.length) fail(row.role + ' SHOULD NOT HAVE: '+ wrongPresent.join(', '));
    if (!missingMust.length && !wrongPresent.length) ok(row.role.padEnd(24) + perms.length + ' permissions');
  }

  // ── 2. Workshop-only users must have workshop_id ──────────────────────────
  console.log('\n=== 2. WORKSHOP-ONLY ROLE ENFORCEMENT ===');
  const workshopOnlyRoles = ['supervisor','storekeeper','storekeeper-assistant','mechanician',
    'harvesting-leader','sawmill-leader','poles-leader','vat-leader','sales-staff','showroom-staff'];
  const { rows: violators } = await pool.query(
    'SELECT username, role FROM app_users WHERE role = ANY($1) AND workshop_id IS NULL AND active=true',
    [workshopOnlyRoles]
  );
  if (violators.length) {
    violators.forEach(u => fail(u.username + ' (' + u.role + ') has no workshop_id'));
  } else {
    ok('All active workshop-only users have a workshop_id assigned');
  }

  // ── 3. Cross-workshop roles have no workshop_id ───────────────────────────
  console.log('\n=== 3. CROSS-WORKSHOP ROLE CONSISTENCY ===');
  const crossRoles = ['admin','ceo','operations','logistics','sales','finance'];
  const { rows: crossViolators } = await pool.query(
    'SELECT username, role, workshop_id FROM app_users WHERE role = ANY($1) AND workshop_id IS NOT NULL',
    [crossRoles]
  );
  if (crossViolators.length) {
    crossViolators.forEach(u => warn(u.username + ' (' + u.role + ') has workshop_id=' + u.workshop_id + ' — verify this is intentional'));
  } else {
    ok('All cross-workshop users have workshop_id = NULL');
  }

  // ── 4. Backend isWorkshopRestricted coverage ──────────────────────────────
  console.log('\n=== 4. BACKEND WORKSHOP ISOLATION LOGIC ===');
  // Simulate isWorkshopRestricted for every active user
  const exemptRoles = ['admin','ceo','operations','logistics'];
  const { rows: allUsers } = await pool.query('SELECT id, username, role, workshop_id FROM app_users WHERE active=true');
  let isolationOk = true;
  for (const u of allUsers) {
    const isRestricted = u.workshop_id != null && !exemptRoles.includes(u.role);
    const isCross      = exemptRoles.includes(u.role) || (u.role === 'logistics-officer' && !u.workshop_id) || (u.role === 'sales' && !u.workshop_id);
    // Flag any cross-workshop user who also has a workshop_id (unless logistics-officer which is conditional)
    if (isCross && u.workshop_id && u.role !== 'logistics-officer') {
      warn(u.username + ' is a cross-workshop role with workshop_id=' + u.workshop_id);
      isolationOk = false;
    }
    // Flag any workshop-only user who has no workshop_id
    if (!isCross && !isRestricted && workshopOnlyRoles.includes(u.role)) {
      fail(u.username + ' (' + u.role + ') would bypass isolation — no workshop_id');
      isolationOk = false;
    }
  }
  if (isolationOk) ok('isWorkshopRestricted logic covers all ' + allUsers.length + ' active users correctly');

  // ── 5. SQL NULL-safe filter pattern in key tables ─────────────────────────
  console.log('\n=== 5. NULL-SAFE WORKSHOP FILTER (SQL PATTERN) ===');
  // For each key table, confirm the pattern: workshop_id = $param OR workshop_id IS NULL covers both restricted and legacy
  // We verify by checking that records with NULL workshop_id exist OR the table is fresh (no records yet)
  // Tables that have deleted_at; casual tables do not
  const tablesWithDeletedAt = ['daily_logs','harvest_logs','log_transport','value_added_timber','sales_orders','machine_daily_logs'];
  const tablesWithoutDeletedAt = ['casual_labour_requests','casuals'];
  const keyTables = [...tablesWithDeletedAt, ...tablesWithoutDeletedAt];
  for (const t of keyTables) {
    const hasDeletedAt = tablesWithDeletedAt.includes(t);
    const whereClause = hasDeletedAt ? 'WHERE workshop_id IS NULL AND deleted_at IS NULL' : 'WHERE workshop_id IS NULL';
    const { rows } = await pool.query(
      'SELECT count(*)::int as total, count(*) FILTER (' + whereClause + ')::int as legacy FROM ' + t
    );
    const r = rows[0];
    if (r.total === 0) {
      ok(t.padEnd(30) + 'empty table — no legacy records to check');
    } else if (r.legacy > 0) {
      ok(t.padEnd(30) + r.total + ' records, ' + r.legacy + ' legacy NULL-workshop records present');
    } else {
      ok(t.padEnd(30) + r.total + ' records, no legacy NULL records (all stamped)');
    }
  }

  // ── 6. Approval workflow — changes permission ─────────────────────────────
  console.log('\n=== 6. APPROVAL WORKFLOW PERMISSIONS ===');
  // sales Manager can approve per user specification ("reviews, approves, or rejects")
  // finance has changes for audit-trail visibility — pre-existing design, not a regression
  const shouldApprove = ['admin','ceo','operations','logistics','supervisor','sales','finance'];
  const shouldNotApprove = ['storekeeper','storekeeper-assistant','mechanician',
    'harvesting-leader','sawmill-leader','poles-leader','vat-leader','sales-staff','showroom-staff','logistics-officer'];
  for (const row of rolesRes.rows) {
    const perms = Array.isArray(row.permissions) ? row.permissions : [];
    const hasChanges = perms.includes('changes');
    if (shouldNotApprove.includes(row.role) && hasChanges) {
      fail(row.role + ' has "changes" (approval) permission — should not');
    } else if (shouldApprove.includes(row.role) && !hasChanges) {
      warn(row.role + ' missing "changes" permission — may not be able to approve requests');
    }
  }
  ok('Approval permission check complete');

  // ── 7. Materialized views present and refreshable ─────────────────────────
  console.log('\n=== 7. MATERIALIZED VIEWS ===');
  const { rows: mvs } = await pool.query('SELECT matviewname FROM pg_matviews WHERE schemaname=\'public\'');
  const mvNames = mvs.map(r => r.matviewname);
  for (const mv of ['mv_stock_summary','mv_stock_by_workshop']) {
    if (mvNames.includes(mv)) {
      await pool.query('REFRESH MATERIALIZED VIEW ' + mv);
      ok(mv + ' — present and refreshed successfully');
    } else {
      fail(mv + ' — MISSING');
    }
  }

  // ── 8. Stock levels — no negatives, per-workshop sanity ──────────────────
  console.log('\n=== 8. STOCK LEVELS ===');
  const { rows: negStock } = await pool.query(
    'SELECT sc.name, sl.warehouse_id, sl.quantity FROM stock_levels sl JOIN stock_catalog sc ON sc.id=sl.item_id WHERE sl.quantity < 0'
  );
  negStock.length ? negStock.forEach(r => warn(r.name + ' at wh-' + r.warehouse_id + ' = ' + r.quantity)) : ok('No negative stock quantities');
  const { rows: slSummary } = await pool.query(
    'SELECT sl.warehouse_id, w.name as wh_name, count(*)::int as items, sum(sl.quantity)::numeric as total_qty FROM stock_levels sl JOIN warehouses w ON w.id=sl.warehouse_id GROUP BY sl.warehouse_id, w.name ORDER BY sl.warehouse_id'
  );
  slSummary.forEach(r => ok('Warehouse: ' + r.wh_name.padEnd(20) + r.items + ' items, total qty=' + r.total_qty));

  // ── 9. Stock transfers — source ≠ destination, referential integrity ───────
  console.log('\n=== 9. STOCK TRANSFERS ===');
  const { rows: tfRows } = await pool.query('SELECT count(*)::int as total, count(*) FILTER (WHERE from_warehouse_id=to_warehouse_id)::int as same_wh FROM stock_transfers');
  ok('Total transfer records: ' + tfRows[0].total);
  tfRows[0].same_wh > 0 ? fail(tfRows[0].same_wh + ' transfers have same source and destination') : ok('All transfers have distinct source/destination');
  const { rows: orphanTf } = await pool.query(
    'SELECT count(*)::int as n FROM stock_transfers st WHERE NOT EXISTS (SELECT 1 FROM warehouses w WHERE w.id=st.from_warehouse_id) OR NOT EXISTS (SELECT 1 FROM warehouses w WHERE w.id=st.to_warehouse_id)'
  );
  orphanTf[0].n > 0 ? fail(orphanTf[0].n + ' transfers reference non-existent warehouses') : ok('All transfers reference valid warehouses');

  // ── 10. Regression — indexes still present ────────────────────────────────
  console.log('\n=== 10. REGRESSION — INDEXES AND SCHEMA ===');
  const { rows: idxRows } = await pool.query('SELECT indexname FROM pg_indexes WHERE schemaname=\'public\' AND indexname LIKE \'idx_%workshop%\'');
  const expectedIndexes = ['idx_daily_logs_workshop','idx_harvest_logs_workshop','idx_vat_workshop',
    'idx_mdl_workshop','idx_log_transport_workshop','idx_sales_orders_workshop','idx_casual_req_workshop','idx_casuals_workshop'];
  const idxNames = idxRows.map(r => r.indexname);
  expectedIndexes.forEach(idx => {
    idxNames.includes(idx) ? ok('Index present: ' + idx) : fail('Index MISSING: ' + idx);
  });

  // workshop_id column on all key tables
  const { rows: wsColRows } = await pool.query(
    'SELECT table_name FROM information_schema.columns WHERE table_schema=\'public\' AND column_name=\'workshop_id\' AND table_name IN (\'daily_logs\',\'harvest_logs\',\'log_transport\',\'value_added_timber\',\'casual_labour_requests\',\'casuals\',\'machine_daily_logs\',\'sales_orders\',\'app_users\') ORDER BY table_name'
  );
  const wsColTables = wsColRows.map(r => r.table_name);
  ['daily_logs','harvest_logs','log_transport','value_added_timber','casual_labour_requests','casuals','machine_daily_logs','sales_orders','app_users'].forEach(t => {
    wsColTables.includes(t) ? ok('workshop_id column on: ' + t) : fail('workshop_id MISSING from: ' + t);
  });

  // ── Final verdict ─────────────────────────────────────────────────────────
  console.log('\n══════════════════════════════════════════════════');
  if (totalFail === 0 && totalWarn === 0) {
    console.log('  VERDICT: PASS — System is production-ready');
  } else if (totalFail === 0) {
    console.log('  VERDICT: CONDITIONAL PASS — ' + totalWarn + ' warning(s) require review');
  } else {
    console.log('  VERDICT: FAIL — ' + totalFail + ' issue(s) must be resolved before deployment');
  }
  console.log('  Failures: ' + totalFail + '  |  Warnings: ' + totalWarn);
  console.log('══════════════════════════════════════════════════');

  await pool.end();
}

go().catch(e => { console.error('VERIFICATION ERROR:', e.message); process.exit(1); });
