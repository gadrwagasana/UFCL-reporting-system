const { pool } = require('../pool');
const bcrypt = require('bcryptjs');

// All-time stock balance: total produced minus total sold, broken down by timber sub-type
const STOCK_SQL = `
  WITH produced AS (
    SELECT COALESCE(SUM(timber_units),0)::int         AS timber,
           COALESCE(SUM(timber_kiln_dried),0)::int    AS kiln_dried,
           COALESCE(SUM(timber_cca_treated),0)::int   AS cca_treated,
           COALESCE(SUM(timber_untreated),0)::int     AS untreated,
           COALESCE(SUM(poles_units),0)::int          AS poles
    FROM daily_logs
  ),
  sold AS (
    SELECT COALESCE(SUM(CASE WHEN product_type='Timber' THEN quantity ELSE 0 END),0)::int AS timber,
           COALESCE(SUM(CASE WHEN product_type='Timber' AND COALESCE(product_sub_type,'')='Kiln-dried'  THEN quantity ELSE 0 END),0)::int AS kiln_dried,
           COALESCE(SUM(CASE WHEN product_type='Timber' AND COALESCE(product_sub_type,'')='CCA-treated' THEN quantity ELSE 0 END),0)::int AS cca_treated,
           COALESCE(SUM(CASE WHEN product_type='Timber' AND COALESCE(product_sub_type,'')='Untreated'   THEN quantity ELSE 0 END),0)::int AS untreated,
           COALESCE(SUM(CASE WHEN product_type='Poles'  THEN quantity ELSE 0 END),0)::int AS poles
    FROM sales_orders
  )
  SELECT p.timber AS timber_produced, p.poles AS poles_produced,
         p.kiln_dried AS kiln_dried_produced, p.cca_treated AS cca_treated_produced, p.untreated AS untreated_produced,
         s.timber AS timber_sold,     s.poles AS poles_sold,
         s.kiln_dried AS kiln_dried_sold, s.cca_treated AS cca_treated_sold, s.untreated AS untreated_sold,
         (p.timber    - s.timber)    AS timber_stock,
         (p.poles     - s.poles)     AS poles_stock,
         (p.kiln_dried  - s.kiln_dried)  AS kiln_dried_stock,
         (p.cca_treated - s.cca_treated) AS cca_treated_stock,
         (p.untreated   - s.untreated)   AS untreated_stock
  FROM produced p, sold s
`;

function buildStock(st) {
  return {
    timberProduced:     Number(st.timber_produced    || 0),
    polesProduced:      Number(st.poles_produced     || 0),
    kilnDriedProduced:  Number(st.kiln_dried_produced  || 0),
    ccaTreatedProduced: Number(st.cca_treated_produced || 0),
    untreatedProduced:  Number(st.untreated_produced   || 0),
    timberSold:         Number(st.timber_sold        || 0),
    polesSold:          Number(st.poles_sold         || 0),
    kilnDriedSold:      Number(st.kiln_dried_sold    || 0),
    ccaTreatedSold:     Number(st.cca_treated_sold   || 0),
    untreatedSold:      Number(st.untreated_sold     || 0),
    timberStock:        Number(st.timber_stock       || 0),
    polesStock:         Number(st.poles_stock        || 0),
    kilnDriedStock:     Number(st.kiln_dried_stock   || 0),
    ccaTreatedStock:    Number(st.cca_treated_stock  || 0),
    untreatedStock:     Number(st.untreated_stock    || 0)
  };
}

const PROD_SUB_TOKENS = ['daily-harvest', 'daily-timber', 'daily-poles', 'value-added-timber', 'machine-logs'];

// ── Module-level caches ───────────────────────────────────────────────────────
const _userCache = new Map(); // userId → { user, expiresAt }
const USER_CACHE_TTL = 60_000;
const _roleCache = new Map(); // role → pages[]

// Expand legacy tokens — module-level so mustRole and getBootstrap share one copy
function expandPages(pages) {
  if (!Array.isArray(pages)) return pages;
  const out = [...pages];
  if (out.includes('daily')) {
    for (const t of ['daily-timber', 'daily-poles', 'daily-harvest'])
      if (!out.includes(t)) out.push(t);
  }
  return out;
}

// Fire-and-forget refresh — stock view becomes stale for <1 s after each write
function refreshStockView() {
  pool.query('refresh materialized view concurrently mv_stock_summary').catch(() => {});
}

const ROLE_PAGES = {
  admin: ['dashboard', 'users', 'audit', 'export', 'notifications', 'changes',
          'daily', 'daily-timber', 'daily-poles', 'daily-harvest', 'value-added-timber', 'machine-logs',
          'logistics-dashboard', 'workshop-overview', 'warehouses', 'stock-items', 'stock-movements', 'material-requests',
          'vehicles', 'deliveries', 'dispatch', 'timber-inventory', 'transport',
          'machines', 'machine-kpi', 'compartments', 'log-transport',
          'machine-fuel', 'casual-requests', 'casuals'],
  ceo: ['dashboard', 'ceo', 'weekly-cost', 'weekly-perf', 'monthly', 'kpi', 'audit', 'export', 'users', 'notifications', 'changes',
        'daily-harvest', 'value-added-timber',
        'logistics-dashboard', 'workshop-overview', 'timber-inventory', 'vehicles', 'deliveries', 'dispatch', 'transport',
        'machines', 'machine-kpi', 'compartments', 'log-transport',
        'casual-requests', 'casuals'],
  operations: ['dashboard', 'daily', 'daily-timber', 'daily-poles', 'daily-harvest', 'value-added-timber', 'machine-logs',
               'products', 'weekly-cost', 'weekly-perf', 'inventory', 'audit', 'export', 'notifications', 'changes',
               'logistics-dashboard', 'workshop-overview', 'timber-inventory', 'stock-items', 'stock-movements', 'material-requests', 'transport',
               'machines', 'machine-kpi', 'compartments', 'log-transport',
               'machine-fuel', 'casual-requests', 'casuals'],
  sales: ['dashboard', 'sales', 'products', 'audit', 'export', 'notifications', 'changes', 'deliveries', 'transport'],
  finance: ['dashboard', 'weekly-cost', 'monthly', 'sage', 'audit', 'export', 'notifications', 'changes'],
  logistics: ['dashboard', 'logistics-dashboard', 'workshop-overview', 'logistics', 'inventory', 'audit', 'export', 'notifications', 'changes',
              'warehouses', 'stock-items', 'stock-movements', 'material-requests', 'vehicles', 'deliveries', 'dispatch', 'transport',
              'machines', 'log-transport', 'machine-fuel'],
  supervisor: ['dashboard', 'daily', 'daily-timber', 'daily-poles', 'daily-harvest', 'value-added-timber', 'machine-logs',
               'audit', 'export', 'notifications', 'changes', 'timber-inventory',
               'workshop-overview', 'compartments', 'log-transport',
               'machine-fuel', 'casual-requests', 'casuals'],
  storekeeper: ['dashboard', 'logistics-dashboard', 'workshop-overview', 'inventory', 'audit', 'export', 'notifications',
                'warehouses', 'stock-items', 'stock-movements', 'material-requests']
};

async function getRolePages(role) {
  const { rows } = await pool.query('select permissions from role_definitions where role=$1 limit 1', [role]);
  if (!rows.length) return ROLE_PAGES[role] || [];
  const perms = Array.isArray(rows[0].permissions) ? rows[0].permissions : [];
  return perms.length ? perms : ROLE_PAGES[role] || [];
}

async function getResolvedPages(user) {
  if (Array.isArray(user.user_permissions) && user.user_permissions.length)
    return user.user_permissions;
  if (_roleCache.has(user.role)) return _roleCache.get(user.role);
  const pages = await getRolePages(user.role);
  _roleCache.set(user.role, pages);
  return pages;
}

async function mustRole(user, pageId) {
  return (await getResolvedPages(user)).includes(pageId);
}

async function canAccessDaily(user) {
  const pages = await getResolvedPages(user);
  return pages.includes('daily') || pages.includes('daily-timber') || pages.includes('daily-poles');
}

async function getUser(userId) {
  const now = Date.now();
  const cached = _userCache.get(userId);
  if (cached && cached.expiresAt > now) return cached.user;
  const { rows } = await pool.query(
    'select id, username, name, role, department, user_permissions, user_responsibilities, active, workshop_id from app_users where id=$1',
    [userId]
  );
  if (!rows.length) throw new Error('User not found');
  if (!rows[0].active) throw new Error('User inactive');
  _userCache.set(userId, { user: rows[0], expiresAt: now + USER_CACHE_TTL });
  return rows[0];
}

function invalidateUserCache(userId) {
  _userCache.delete(userId);
}

function isWorkshopRestricted(user) {
  return user.workshop_id != null &&
    !['admin', 'ceo', 'operations', 'logistics', 'storekeeper'].includes(user.role);
}

async function logAudit(user, action, icon = 'ti-check', meta = {}) {
  if (user.role === 'ceo') return;
  try {
    await pool.query(
      'insert into audit_log(user_id, role, action, icon, meta) values ($1,$2,$3,$4,$5::jsonb)',
      [user.id, user.role, action, icon, JSON.stringify(meta || {})]
    );
  } catch (e) {
    console.error('[audit] failed:', e.message);
  }
}

async function pushNotification({ type, title, body, roles }) {
  await pool.query('insert into notifications(type,title,body,roles) values ($1,$2,$3,$4)', [
    type,
    title,
    body,
    roles || []
  ]);
}

async function unreadCount(userId) {
  const { rows } = await pool.query(
    `select count(*)::int as n
     from notifications n
     left join notifications_read r on r.notification_id=n.id and r.user_id=$1
     where r.notification_id is null`,
    [userId]
  );
  return rows[0]?.n || 0;
}

async function getBootstrap(userId) {
  const user = await getUser(userId);
  const currentMonth = new Date().toISOString().slice(0, 7);
  const { rows: appr } = await pool.query('select approved from monthly_approvals where month_key=$1', [currentMonth]);
  const approved = appr[0]?.approved || false;
  const { rows: roles } = await pool.query('select role, permissions from role_definitions');

  const rolePages = roles.reduce((acc, row) => {
    const perms = Array.isArray(row.permissions) ? row.permissions : [];
    acc[row.role] = expandPages(perms.length ? perms : ROLE_PAGES[row.role] || []);
    return acc;
  }, {});
  const rawUserPages = Array.isArray(user.user_permissions) && user.user_permissions.length
    ? user.user_permissions
    : rolePages[user.role] || [];
  const userPages = expandPages(rawUserPages);
  return {
    ok: true,
    user,
    rolePages,
    userPages,
    unreadNotifications: await unreadCount(userId),
    approved: { monthly: approved }
  };
}

async function rolesList(userId) {
  const user = await getUser(userId);
  if (!['admin', 'ceo'].includes(user.role)) return { ok: false, error: 'Access denied' };
  const { rows } = await pool.query(
    `select role, label, description, responsibilities, permissions
     from role_definitions
     order by role`
  );
  return { ok: true, rows };
}

async function rolesUpdate(userId, role, payload) {
  const user = await getUser(userId);
  if (!['admin', 'ceo'].includes(user.role)) return { ok: false, error: 'Access denied' };
  const r = payload || {};
  if (!role) return { ok: false, error: 'Invalid role' };
  await pool.query(
    `update role_definitions
     set description=$1, responsibilities=$2, permissions=$3, updated_at=now()
     where role=$4`,
    [
      r.description || '',
      JSON.stringify(Array.isArray(r.responsibilities) ? r.responsibilities : []),
      JSON.stringify(Array.isArray(r.permissions) ? r.permissions : []),
      role
    ]
  );
  _roleCache.delete(role);
  logAudit(user, `Updated role responsibilities for ${role}`, 'ti-settings', {
    role,
    responsibilities: r.responsibilities,
    permissions: r.permissions
  });
  return { ok: true };
}

async function dailyList(userId) {
  const user = await getUser(userId);
  if (!(await canAccessDaily(user))) return { ok: false, error: 'Access denied' };
  const [{ rows }, { rows: stockRows }, { rows: transportRows }] = await Promise.all([
    pool.query(
      `select id, to_char(log_date,'DD/MM/YYYY') as date, machine, product_size,
              timber_units, timber_kiln_dried, timber_cca_treated, timber_untreated,
              timber_waste, poles_units, poles_waste, downtime_hours, logs_received,
              supervisor, remarks, created_at
       from daily_logs
       order by log_date desc, id desc
       limit 50`
    ),
    pool.query('select * from mv_stock_summary'),
    pool.query(
      `select
         coalesce(sum(case when transport_date = current_date then qty_transported else 0 end),0)::int as today_transported,
         coalesce(sum(case when extract(year from transport_date) = extract(year from now()) then qty_transported else 0 end),0)::int as annual_transported
       from log_transport`
    )
  ]);
  const tr = transportRows[0] || {};
  return {
    ok: true,
    rows,
    stock: buildStock(stockRows[0] || {}),
    transport: {
      todayTransported:  Number(tr.today_transported  || 0),
      annualTransported: Number(tr.annual_transported || 0)
    }
  };
}

async function dailyCreate(userId, payload) {
  const user = await getUser(userId);
  if (!(await canAccessDaily(user))) return { ok: false, error: 'Access denied' };
  const p = payload || {};
  if (!p.date) return { ok: false, error: 'Date is required' };
  const logsReceived = Number(p.logs_received || 0);
  if (logsReceived > 0) {
    const { rows: [lt] } = await pool.query(
      `select coalesce(sum(qty_transported),0)::int as transported from log_transport where transport_date=$1`,
      [p.date]
    );
    const transported = Number(lt?.transported || 0);
    if (transported === 0) return { ok: false, error: `No logs were transported on ${p.date}. Record a Log Transport entry first.` };
    if (logsReceived > transported) return { ok: false, error: `Logs received (${logsReceived}) cannot exceed logs transported on this date (${transported}).` };
  }
  const kilnDried   = Number(p.timber_kiln_dried  || 0);
  const ccaTreated  = Number(p.timber_cca_treated || 0);
  const untreated   = Number(p.timber_untreated   || 0);
  const timberTotal = kilnDried + ccaTreated + untreated || Number(p.timber_units || 0);
  await pool.query(
    `insert into daily_logs(log_date, supervisor, timber_units, timber_kiln_dried, timber_cca_treated, timber_untreated,
                            timber_waste, poles_units, poles_waste, downtime_hours, downtime_reason, remarks, product_size, machine, logs_received, created_by)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`,
    [
      p.date,
      p.supervisor || user.name,
      timberTotal,
      kilnDried,
      ccaTreated,
      untreated,
      Number(p.timber_waste || 0),
      Number(p.poles_units  || 0),
      Number(p.poles_waste  || 0),
      Number(p.downtime_hours || 0),
      p.downtime_reason || null,
      p.remarks || null,
      p.product_size || null,
      p.machine || null,
      Number(p.logs_received || 0),
      user.id
    ]
  );
  logAudit(user, `Created daily log for ${p.date}`, 'ti-clipboard-list', { date: p.date, timber: timberTotal, poles: Number(p.poles_units || 0) });
  refreshStockView();
  return { ok: true };
}

async function productCatalogList(userId) {
  const user = await getUser(userId);
  if (!['admin', 'ceo', 'operations', 'supervisor'].includes(user.role)) return { ok: false, error: 'Access denied' };
  const { rows } = await pool.query(`select id, machine, product_size from product_catalog where active=true order by machine, product_size`);
  return { ok: true, rows };
}

async function kpiBudgetsList(userId, month) {
  const user = await getUser(userId);
  if (user.role !== 'ceo' && user.role !== 'admin') return { ok: false, error: 'Access denied' };
  const queryMonth = month || new Date().toISOString().slice(0, 7);
  const { rows: categories } = await pool.query('select id, name from expense_categories order by name');
  const { rows: budgets } = await pool.query(
    `select category_id, budget_amount from kpi_budgets where month=$1`,
    [queryMonth]
  );
  const budgetMap = Object.fromEntries(budgets.map((b) => [b.category_id, Number(b.budget_amount)]));
  return {
    ok: true,
    month: queryMonth,
    rows: categories.map((cat) => ({
      id: cat.id,
      name: cat.name,
      budget_amount: budgetMap[cat.id] || 0
    }))
  };
}

async function kpiBudgetSave(userId, payload) {
  const user = await getUser(userId);
  if (user.role !== 'ceo' && user.role !== 'admin') return { ok: false, error: 'Access denied' };
  const p = payload || {};
  if (!p.month || !Array.isArray(p.items)) return { ok: false, error: 'Missing required payload' };

  const month   = p.month;
  const ids     = p.items.map(i => i.id);
  const amounts = p.items.map(i => Number(i.budget_amount || 0));

  const client = await pool.connect();
  try {
    await client.query('begin');
    await client.query(
      `insert into kpi_budgets(category_id, month, budget_amount, set_by, created_at, updated_at)
       select unnest($1::bigint[]), $2, unnest($3::numeric[]), $4, now(), now()
       on conflict(category_id, month) do update
         set budget_amount=excluded.budget_amount, set_by=excluded.set_by, updated_at=now()`,
      [ids, month, amounts, user.id]
    );
    await client.query('commit');
  } catch (e) {
    await client.query('rollback');
    throw e;
  } finally {
    client.release();
  }

  logAudit(user, `Updated KPI budgets for ${month}`, 'ti-target', { month, items: p.items });
  return { ok: true };
}

function weekRange(date = new Date()) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - ((day + 6) % 7);
  const monday = new Date(d);
  monday.setDate(diff);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return { monday, sunday };
}

async function weeklyPerformanceReport(userId) {
  const user = await getUser(userId);
  if (!(await mustRole(user, 'weekly-perf'))) return { ok: false, error: 'Access denied' };

  const now = new Date();
  const { monday, sunday } = weekRange(now);
  const month = now.toISOString().slice(0, 7);
  const weekNumber = Math.ceil((now - new Date(now.getFullYear(), 0, 1)) / (7 * 24 * 60 * 60 * 1000));

  const { rows: dailyRows } = await pool.query(
    `select to_char(log_date,'DD Mon YYYY') as date, machine, product_size, timber_units, timber_waste, poles_units, poles_waste, downtime_hours, supervisor, remarks
     from daily_logs
     where log_date >= $1 and log_date <= $2
     order by log_date asc, id asc`,
    [monday.toISOString().slice(0, 10), sunday.toISOString().slice(0, 10)]
  );

  const { rows: expenseRows } = await pool.query(
    `select c.name as category, e.amount, e.reason, u.name as entered_by
     from weekly_expenses e
     join expense_categories c on c.id=e.category_id
     join app_users u on u.id=e.entered_by
     where e.week_number=$1 and e.month=$2
     order by c.name`,
    [weekNumber, month]
  );

  const { rows: budgets } = await pool.query(
    `select category_id, budget_amount from kpi_budgets where month=$1`,
    [month]
  );
  const budgetMap = Object.fromEntries(budgets.map((b) => [b.category_id, Number(b.budget_amount)]));
  const { rows: categoryDefs } = await pool.query('select id, name from expense_categories');
  const categoryByName = Object.fromEntries(categoryDefs.map((c) => [c.name, c.id]));

  const totalTimber = dailyRows.reduce((sum, r) => sum + Number(r.timber_units || 0), 0);
  const totalPoles = dailyRows.reduce((sum, r) => sum + Number(r.poles_units || 0), 0);
  const totalDowntime = dailyRows.reduce((sum, r) => sum + Number(r.downtime_hours || 0), 0);
  const totalCost = expenseRows.reduce((sum, r) => sum + Number(r.amount || 0), 0);
  const costPerTimber = totalTimber ? totalCost / totalTimber : 0;
  const costPerPole = totalPoles ? totalCost / totalPoles : 0;

  const categoryStatus = expenseRows.map((exp) => {
    const catId = categoryByName[exp.category];
    const budget = catId ? budgetMap[catId] || 0 : 0;
    const variance = budget ? ((Number(exp.amount) - budget) / budget) * 100 : 0;
    let status = 'green';
    if (budget && exp.amount > budget * 1.05) status = 'red';
    else if (budget && exp.amount >= budget * 0.9) status = 'amber';
    return {
      category: exp.category,
      amount: Number(exp.amount),
      budget,
      variance: Number(variance.toFixed(1)),
      reason: exp.reason,
      entered_by: exp.entered_by,
      status
    };
  });

  const flags = categoryStatus.filter((c) => c.status !== 'green').length;

  return {
    ok: true,
    weekNumber,
    month,
    range: `${monday.toISOString().slice(0, 10)} - ${sunday.toISOString().slice(0, 10)}`,
    production: {
      timber: totalTimber,
      poles: totalPoles,
      downtime_hours: Number(totalDowntime.toFixed(1)),
      cost_per_timber: Number(costPerTimber.toFixed(2)),
      cost_per_pole: Number(costPerPole.toFixed(2)),
      comment_count: flags
    },
    expenses: expenseRows,
    dailyRows,
    categoryStatus,
    budgets: budgets.map((b) => ({ category_id: b.category_id, budget_amount: Number(b.budget_amount) }))
  };
}

async function salesList(userId) {
  const user = await getUser(userId);
  if (!(await mustRole(user, 'sales'))) return { ok: false, error: 'Access denied' };
  const [{ rows }, { rows: stockRows }] = await Promise.all([
    pool.query(
      `select id, order_number, customer_name, product_type, product_sub_type, product_size, quantity, unit_price, notes, status, created_at
       from sales_orders
       order by created_at desc, id desc
       limit 50`
    ),
    pool.query('select * from mv_stock_summary')
  ]);
  return { ok: true, rows, stock: buildStock(stockRows[0] || {}) };
}

async function salesCreate(userId, payload) {
  const user = await getUser(userId);
  if (!(await mustRole(user, 'sales'))) return { ok: false, error: 'Access denied' };
  const p = payload || {};
  if (!p.order_number || !p.customer_name || !p.product_type || !p.product_size || !p.quantity || !p.unit_price || !p.reason) {
    return { ok: false, error: 'Missing required fields' };
  }
  if (p.product_type === 'Timber' && !p.product_sub_type) {
    return { ok: false, error: 'Sub-type is required for timber orders' };
  }
  await pool.query(
    `insert into sales_orders(order_number, customer_name, product_type, product_sub_type, product_size, quantity, unit_price, notes, reason, created_by)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
    [
      p.order_number,
      p.customer_name,
      p.product_type,
      p.product_sub_type || null,
      p.product_size,
      Number(p.quantity),
      Number(p.unit_price),
      p.notes || null,
      p.reason,
      user.id
    ]
  );
  const label = p.product_sub_type ? `${p.product_sub_type} ${p.product_size}` : `${p.product_type} ${p.product_size}`;
  logAudit(user, `Created order ${p.order_number} — ${p.customer_name}: ${p.quantity} × ${label}`, 'ti-shopping-cart', { order_number: p.order_number, sub_type: p.product_sub_type });
  refreshStockView();
  return { ok: true };
}

async function salesUpdateStatus(userId, orderId, status) {
  const user = await getUser(userId);
  if (!(await mustRole(user, 'sales'))) return { ok: false, error: 'Access denied' };
  const allowed = ['Pending', 'Confirmed', 'Dispatched', 'Delivered', 'Cancelled'];
  if (!allowed.includes(status)) return { ok: false, error: 'Invalid status' };
  const { rows } = await pool.query(`select order_number from sales_orders where id=$1`, [orderId]);
  if (!rows.length) return { ok: false, error: 'Order not found' };
  await pool.query(`update sales_orders set status=$1 where id=$2`, [status, orderId]);
  logAudit(user, `Updated order ${rows[0].order_number} status to ${status}`, 'ti-shopping-cart', { orderId, status });
  return { ok: true };
}

async function productsList(userId, filter) {
  const user = await getUser(userId);
  if (!(await mustRole(user, 'products'))) return { ok: false, error: 'Access denied' };

  let where = 'where 1=1';
  const params = [];
  const f = filter || 'All';
  if (f === 'Timber')      where += ` and p.type='Timber'`;
  if (f === 'Poles')       where += ` and p.type='Poles'`;
  if (f === 'Kiln-dried')  where += ` and p.sub_type='Kiln-dried'`;
  if (f === 'CCA-treated') where += ` and p.sub_type='CCA-treated'`;
  if (f === 'Untreated')   where += ` and p.sub_type='Untreated'`;
  if (f === 'Active')      where += ` and p.active=true`;

  const { rows } = await pool.query(
    `select p.id, p.type, p.sub_type, p.size, p.machine, p.active, p.reason, p.ref,
            p.width_mm, p.height_mm, p.length_m, p.diameter_mm,
            u.name as by, to_char(p.created_at,'DD Mon YYYY') as date
     from products p
     left join app_users u on u.id=p.created_by
     ${where}
     order by p.type, p.sub_type, p.size, p.created_at desc
     limit 200`,
    params
  );
  return { ok: true, rows, isAdmin: user.role === 'ceo' || user.role === 'operations' };
}

async function productsCreate(userId, payload) {
  const user = await getUser(userId);
  if (!(await mustRole(user, 'products'))) return { ok: false, error: 'Access denied' };
  const p = payload || {};
  if (!p.type || !p.size || !p.reason) return { ok: false, error: 'Type, size and reason are required' };
  if (p.type === 'Timber' && !p.sub_type) return { ok: false, error: 'Sub-type is required for timber products' };
  const label = p.type === 'Timber' ? `${p.sub_type} ${p.size}` : `Poles ${p.size}`;
  await pool.query(
    `insert into products(type, sub_type, size, active, reason, ref, width_mm, height_mm, length_m, diameter_mm, machine, created_by)
     values ($1,$2,$3,true,$4,$5,$6,$7,$8,$9,$10,$11)`,
    [
      p.type, p.sub_type || null, p.size, p.reason, p.ref || null,
      p.width_mm  ? Number(p.width_mm)  : null,
      p.height_mm ? Number(p.height_mm) : null,
      p.length_m  ? Number(p.length_m)  : null,
      p.diameter_mm ? Number(p.diameter_mm) : null,
      p.machine || null,
      user.id
    ]
  );
  logAudit(user, `Added product ${label}`, 'ti-package', { type: p.type, sub_type: p.sub_type, size: p.size });
  await pushNotification({
    type: 'green',
    title: `New product added — ${label}`,
    body: `${user.name} added ${label}. Reason: ${p.reason}`,
    roles: ['operations', 'sales', 'ceo']
  });
  return { ok: true };
}

async function productsToggle(userId, productId, reason) {
  const user = await getUser(userId);
  const isAdmin = user.role === 'ceo' || user.role === 'operations';
  if (!isAdmin) return { ok: false, error: 'Access denied' };
  if (!reason || !String(reason).trim()) return { ok: false, error: 'Reason required' };

  const { rows } = await pool.query('select id, type, size, active from products where id=$1', [productId]);
  if (!rows.length) return { ok: false, error: 'Product not found' };
  const p = rows[0];
  const targetActive = !p.active;

  await pool.query('update products set active=$1, reason=$2, updated_at=now() where id=$3', [
    targetActive,
    String(reason).trim(),
    productId
  ]);

  logAudit(user, `${targetActive ? 'Reactivated' : 'Deactivated'} product ${p.size}`, 'ti-shield-lock', {
    productId,
    active: targetActive
  });
  await pushNotification({
    type: targetActive ? 'green' : 'amber',
    title: `Product ${targetActive ? 'reactivated' : 'deactivated'} — ${p.size}`,
    body: `${user.name} changed ${p.type} ${p.size}. Reason: ${String(reason).trim()}`,
    roles: ['operations', 'sales', 'ceo']
  });
  return { ok: true };
}

async function productsActiveForForm(userId, type) {
  const user = await getUser(userId);
  if (!user) return { ok: false, error: 'Not authenticated' };
  const { rows } = await pool.query(
    `select id, type, sub_type, size, machine from products
     where active=true and type=$1
     order by sub_type, size`,
    [type]
  );
  return { ok: true, rows };
}

async function machinesForDropdown(userId) {
  const user = await getUser(userId);
  if (!user) return { ok: false, error: 'Not authenticated' };
  const { rows } = await pool.query(
    `select m.id, m.name, m.plate_number, mc.name as category_name
     from machines m
     join machine_categories mc on mc.id = m.category_id
     where m.active = true
     order by mc.name, m.name`
  );
  return { ok: true, rows };
}

async function logisticsList(userId) {
  const user = await getUser(userId);
  if (!(await mustRole(user, 'logistics'))) return { ok: false, error: 'Access denied' };
  const { rows } = await pool.query(
    `select id, category, name, sku, uom, unit_cost, stock, min_stock, reason, created_at
     from logistics_items
     order by created_at desc, id desc
     limit 200`
  );
  return { ok: true, rows };
}

async function logisticsCreate(userId, payload) {
  const user = await getUser(userId);
  if (!(await mustRole(user, 'logistics'))) return { ok: false, error: 'Access denied' };
  const p = payload || {};
  if (!p.category || !p.name || !p.uom || p.unit_cost == null || p.stock == null || p.min_stock == null || !p.reason) {
    return { ok: false, error: 'Missing required fields' };
  }
  await pool.query(
    `insert into logistics_items(category,name,sku,uom,unit_cost,stock,min_stock,reason,created_by)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [
      p.category,
      p.name,
      p.sku || null,
      p.uom,
      Number(p.unit_cost),
      Number(p.stock),
      Number(p.min_stock),
      p.reason,
      user.id
    ]
  );
  logAudit(user, `Added logistics item ${p.name}`, 'ti-truck', { name: p.name });
  return { ok: true };
}

async function auditList(userId, roleFilter) {
  const user = await getUser(userId);
  if (!(await mustRole(user, 'audit'))) return { ok: false, error: 'Access denied' };

  // CEO actions are never shown to anyone.
  // Admin actions are visible to CEO only.
  const hiddenRoles = user.role === 'ceo' ? ['ceo'] : ['ceo', 'admin'];
  const params = [hiddenRoles];
  let where = `where a.role != all($1::text[])`;

  if (roleFilter && roleFilter !== 'All') {
    params.push(roleFilter.toLowerCase().replace(/\s+/g, '_'));
    where += ` and a.role=$${params.length}`;
  }

  const { rows } = await pool.query(
    `select a.id, a.action, a.icon, a.role, to_char(a.created_at,'DD Mon YYYY HH24:MI') as time,
            u.name as user_name
     from audit_log a
     left join app_users u on u.id=a.user_id
     ${where}
     order by a.created_at desc, a.id desc
     limit 200`,
    params
  );
  return { ok: true, rows };
}

async function notificationsList(userId) {
  const user = await getUser(userId);
  if (!(await mustRole(user, 'notifications'))) return { ok: false, error: 'Access denied' };
  const { rows } = await pool.query(
    `select n.id, n.type, n.title, n.body, to_char(n.created_at,'DD Mon YYYY HH24:MI') as time,
            (r.notification_id is not null) as read
     from notifications n
     left join notifications_read r on r.notification_id=n.id and r.user_id=$1
     order by n.created_at desc, n.id desc
     limit 200`,
    [userId]
  );
  const unread = rows.filter(r => !r.read).length;
  return { ok: true, rows, unread };
}

async function notificationsMarkRead(userId, notificationId) {
  const user = await getUser(userId);
  if (!(await mustRole(user, 'notifications'))) return { ok: false, error: 'Access denied' };
  await pool.query(
    `insert into notifications_read(notification_id,user_id)
     values ($1,$2)
     on conflict do nothing`,
    [notificationId, userId]
  );
  return { ok: true, unread: await unreadCount(userId) };
}

async function notificationsMarkAllRead(userId) {
  const user = await getUser(userId);
  if (!(await mustRole(user, 'notifications'))) return { ok: false, error: 'Access denied' };
  await pool.query(
    `insert into notifications_read(notification_id,user_id)
     select n.id, $1
     from notifications n
     on conflict do nothing`,
    [userId]
  );
  return { ok: true, unread: await unreadCount(userId) };
}

async function changesList(userId) {
  const user = await getUser(userId);
  if (!(await mustRole(user, 'changes'))) return { ok: false, error: 'Access denied' };
  const isMgr = ['ceo', 'operations', 'sales', 'finance', 'logistics'].includes(user.role);
  const { rows } = await pool.query(
    `select c.id, c.record_type, c.record_ref, c.request_text, c.status, c.response,
            to_char(c.created_at,'DD Mon YYYY') as created,
            u.name as by
     from change_requests c
     left join app_users u on u.id=c.created_by
     order by c.created_at desc, c.id desc
     limit 200`
  );
  return { ok: true, rows, isMgr };
}

async function changesCreate(userId, payload) {
  const user = await getUser(userId);
  if (!(await mustRole(user, 'changes'))) return { ok: false, error: 'Access denied' };
  const p = payload || {};
  if (!p.record_type || !p.record_ref || !p.request_text) return { ok: false, error: 'Missing required fields' };

  await pool.query(
    `insert into change_requests(record_type, record_ref, request_text, created_by)
     values ($1,$2,$3,$4)`,
    [p.record_type, p.record_ref, p.request_text, user.id]
  );
  logAudit(user, `Submitted change request (${p.record_type})`, 'ti-send', { record_ref: p.record_ref });
  await pushNotification({
    type: 'amber',
    title: 'Change request submitted',
    body: `${user.name} submitted a change request for ${p.record_type} — ${p.record_ref}.`,
    roles: ['operations', 'sales', 'finance', 'logistics', 'ceo']
  });
  return { ok: true };
}

async function changesReview(userId, changeId, status, response) {
  const user = await getUser(userId);
  const isMgr = ['ceo', 'operations', 'sales', 'finance', 'logistics'].includes(user.role);
  if (!isMgr) return { ok: false, error: 'Access denied' };
  if (!['Approved', 'Rejected'].includes(status)) return { ok: false, error: 'Invalid status' };

  await pool.query(
    `update change_requests
     set status=$1, response=$2, reviewed_by=$3, reviewed_at=now()
     where id=$4`,
    [status, response || null, user.id, changeId]
  );
  logAudit(user, `${status} change request #${changeId}`, status === 'Approved' ? 'ti-check' : 'ti-x');
  return { ok: true };
}

async function monthlyApprove(userId, monthKey) {
  const user = await getUser(userId);
  if (user.role !== 'ceo') return { ok: false, error: 'Access denied' };
  await pool.query(
    `insert into monthly_approvals(month_key, approved, approved_by, approved_at)
     values ($1,true,$2,now())
     on conflict (month_key)
     do update set approved=true, approved_by=$2, approved_at=now()`,
    [monthKey, user.id]
  );
  logAudit(user, `Approved monthly dashboard ${monthKey}`, 'ti-signature');
  await pushNotification({
    type: 'green',
    title: 'Monthly report approved',
    body: `CEO approved monthly dashboard for ${monthKey}.`,
    roles: ['operations', 'sales', 'finance', 'logistics']
  });
  return { ok: true };
}

async function weeklyCostReport(userId) {
  const user = await getUser(userId);
  if (!(await mustRole(user, 'weekly-cost'))) return { ok: false, error: 'Access denied' };

  // Get current week number and month
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 1);
  const weekNumber = Math.ceil((now - start) / (7 * 24 * 60 * 60 * 1000));
  const month = now.toISOString().slice(0, 7); // YYYY-MM

  // Get expense categories
  const { rows: categories } = await pool.query('select id, name from expense_categories where active=true order by name');

  // Get this week's expenses
  const { rows: expenses } = await pool.query(
    `select e.id, e.category_id, c.name as category, e.amount, e.reason, u.name as entered_by, e.created_at
     from weekly_expenses e
     join expense_categories c on c.id=e.category_id
     join app_users u on u.id=e.entered_by
     where e.week_number=$1 and e.month=$2
     order by c.name`,
    [weekNumber, month]
  );

  // Get KPI budgets for this month
  const { rows: budgets } = await pool.query(
    `select category_id, budget_amount from kpi_budgets where month=$1`,
    [month]
  );
  const budgetMap = Object.fromEntries(budgets.map(b => [b.category_id, Number(b.budget_amount)]));

  // Get all weekly expenses for this month to calculate running total
  const { rows: monthExpenses } = await pool.query(
    `select category_id, sum(amount)::numeric as total
     from weekly_expenses
     where month=$1
     group by category_id`,
    [month]
  );
  const monthTotalMap = Object.fromEntries(monthExpenses.map(m => [m.category_id, Number(m.total)]));

  // Calculate summary with status flags
  const summary = categories.map(cat => {
    const weekAmount = expenses.filter(e => e.category_id === cat.id).reduce((s, e) => s + Number(e.amount), 0);
    const monthAmount = monthTotalMap[cat.id] || 0;
    const budget = budgetMap[cat.id] || 0;
    const variance = budget ? ((monthAmount - budget) / budget * 100).toFixed(1) : 0;
    
    let status = 'green';
    if (monthAmount > 0 && budget > 0) {
      const percent = (monthAmount / budget) * 100;
      if (percent > 105) status = 'red';
      else if (percent >= 90) status = 'amber';
    }

    return {
      id: cat.id,
      name: cat.name,
      week_amount: weekAmount,
      month_amount: monthAmount,
      budget,
      variance: Number(variance),
      status
    };
  });

  const totalWeek = expenses.reduce((s, e) => s + Number(e.amount), 0);
  const totalMonth = monthTotalMap ? Object.values(monthTotalMap).reduce((s, v) => s + v, 0) : 0;
  const totalBudget = Object.values(budgetMap).reduce((s, v) => s + v, 0);

  return {
    ok: true,
    weekNumber,
    month,
    summary,
    expenses,
    categories,
    totals: {
      week: totalWeek,
      month: totalMonth,
      budget: totalBudget,
      variance: totalBudget ? ((totalMonth - totalBudget) / totalBudget * 100).toFixed(1) : 0
    }
  };
}

async function weeklyExpensesSave(userId, payload) {
  const user = await getUser(userId);
  if (!['admin', 'ceo', 'finance'].includes(user.role)) return { ok: false, error: 'Access denied' };

  const p = payload || {};
  if (!p.categoryId || !p.amount || !p.weekNumber || !p.month) {
    return { ok: false, error: 'Missing required fields' };
  }

  const amount = Number(p.amount);
  if (amount < 0) return { ok: false, error: 'Amount must be positive' };

  // Check if expense already exists for this category/week
  const { rows: existing } = await pool.query(
    `select id, amount from weekly_expenses where category_id=$1 and week_number=$2 and month=$3`,
    [p.categoryId, p.weekNumber, p.month]
  );

  if (existing.length > 0) {
    const oldAmount = existing[0].amount;
    await pool.query(
      `update weekly_expenses set amount=$1, reason=$2, updated_at=now() where id=$3`,
      [amount, p.reason || null, existing[0].id]
    );
    logAudit(user, `Updated weekly expense for category ${p.categoryId}`, 'ti-cash', {
      categoryId: p.categoryId,
      oldAmount,
      newAmount: amount,
      week: p.weekNumber,
      month: p.month
    });
  } else {
    await pool.query(
      `insert into weekly_expenses(category_id, amount, week_number, month, entered_by, reason)
       values ($1,$2,$3,$4,$5,$6)`,
      [p.categoryId, amount, p.weekNumber, p.month, user.id, p.reason || null]
    );
    logAudit(user, `Created weekly expense for category ${p.categoryId}`, 'ti-cash', {
      categoryId: p.categoryId,
      amount,
      week: p.weekNumber,
      month: p.month
    });
  }

  return { ok: true };
}


// --- Users admin ---
async function usersList(userId) {
  const user = await getUser(userId);
  if (!['ceo', 'operations', 'admin'].includes(user.role)) return { ok: false, error: 'Access denied' };
  const { rows } = await pool.query(`
    select u.id, u.username, u.name, u.role, u.department,
           u.user_permissions, u.user_responsibilities, u.active,
           u.workshop_id, w.name as workshop_name,
           to_char(u.created_at,'DD Mon YYYY') as created
    from app_users u
    left join warehouses w on w.id = u.workshop_id
    order by u.id`);
  const { rows: workshops } = await pool.query(`select id, name from warehouses where active=true order by name`);
  return { ok: true, rows, workshops };
}

async function usersCreate(userId, payload) {
  const user = await getUser(userId);
  if (!['ceo', 'operations', 'admin'].includes(user.role)) return { ok: false, error: 'Access denied' };
  const p = payload || {};
  if (!p.username || !p.name || !p.role || !p.password) return { ok: false, error: 'Missing required fields' };
  const hash = await bcrypt.hash(String(p.password), 10);
  await pool.query(
    `insert into app_users(username,name,role,department,user_permissions,user_responsibilities,password_hash,active,workshop_id)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [p.username, p.name, p.role, p.department || null, JSON.stringify([]), JSON.stringify([]), hash,
     p.active !== false, p.workshop_id ? Number(p.workshop_id) : null]
  );
  logAudit(user, `Created user ${p.username}`, 'ti-users', { username: p.username, role: p.role, department: p.department });
  return { ok: true };
}

async function usersUpdate(userId, targetUserId, payload) {
  const user = await getUser(userId);
  if (!['ceo', 'operations', 'admin'].includes(user.role)) return { ok: false, error: 'Access denied' };
  const p = payload || {};
  const params = [
    p.name || null,
    p.role || null,
    p.department || null,
    p.permissions !== undefined ? JSON.stringify(p.permissions) : null,
    p.responsibilities !== undefined ? JSON.stringify(p.responsibilities) : null,
    p.active !== undefined ? p.active : null,
    targetUserId
  ];
  await pool.query(
    `update app_users set
       name = coalesce($1, name),
       role = coalesce($2, role),
       department = coalesce($3, department),
       user_permissions = coalesce($4, user_permissions),
       user_responsibilities = coalesce($5, user_responsibilities),
       active = coalesce($6, active)
     where id=$7`,
    params
  );
  // workshop_id is updated separately when explicitly provided
  if ('workshop_id' in p) {
    await pool.query(
      `update app_users set workshop_id=$1 where id=$2`,
      [p.workshop_id ? Number(p.workshop_id) : null, targetUserId]
    );
  }
  invalidateUserCache(targetUserId);
  logAudit(user, `Updated user ${targetUserId}`, 'ti-users', {
    userId: targetUserId, department: p.department,
    permissions: p.permissions, workshop_id: p.workshop_id
  });
  return { ok: true };
}

async function usersResetPassword(userId, targetUserId, newPassword) {
  const user = await getUser(userId);
  if (!['ceo', 'operations', 'admin'].includes(user.role)) return { ok: false, error: 'Access denied' };
  const hash = await bcrypt.hash(String(newPassword || 'UFCL@1234'), 10);
  await pool.query(`update app_users set password_hash=$1 where id=$2`, [hash, targetUserId]);
  invalidateUserCache(targetUserId);
  logAudit(user, `Reset password for user ${targetUserId}`, 'ti-key', { userId: targetUserId });
  return { ok: true };
}

async function getDashboardStats(userId) {
  const user = await getUser(userId);

  const today = new Date();
  const month = today.toISOString().slice(0, 7);
  const sevenDaysAgo = new Date(today);
  sevenDaysAgo.setDate(today.getDate() - 6);
  const [yr, mn] = month.split('-').map(Number);
  const lastMonth = new Date(yr, mn - 2, 1).toISOString().slice(0, 7);
  const [lyr, lmn] = lastMonth.split('-').map(Number);
  const monthStart     = `${month}-01`;
  const monthEnd       = new Date(yr, mn, 0).toISOString().slice(0, 10);
  const nextMonthStart = new Date(yr, mn, 1).toISOString().slice(0, 10);
  const lastMonthStart = `${lastMonth}-01`;
  const lastMonthEnd   = new Date(lyr, lmn, 0).toISOString().slice(0, 10);

  const [
    { rows: monthProd },
    { rows: lastMonthProd },
    { rows: daily7 },
    { rows: salesMonth },
    { rows: recentSales },
    { rows: expMonth },
    { rows: expByCategory },
    { rows: lowStock },
    { rows: pendingChanges },
    { rows: recentActivity },
    { rows: stockRows }
  ] = await Promise.all([
    pool.query(
      `select coalesce(sum(timber_units),0)::int as timber,
              coalesce(sum(poles_units),0)::int as poles,
              coalesce(sum(downtime_hours),0)::numeric as downtime,
              count(*)::int as log_days
       from daily_logs where log_date >= $1 and log_date <= $2`, [monthStart, monthEnd]
    ),
    pool.query(
      `select coalesce(sum(timber_units),0)::int as timber,
              coalesce(sum(poles_units),0)::int as poles
       from daily_logs where log_date >= $1 and log_date <= $2`, [lastMonthStart, lastMonthEnd]
    ),
    pool.query(
      `select log_date,
              coalesce(timber_units,0) as timber_units,
              coalesce(poles_units,0) as poles_units
       from daily_logs
       where log_date >= $1
       order by log_date asc`,
      [sevenDaysAgo.toISOString().slice(0, 10)]
    ),
    pool.query(
      `select count(*)::int as orders,
              coalesce(sum(quantity),0)::int as qty,
              coalesce(sum(quantity*unit_price),0)::numeric as revenue
       from sales_orders where created_at >= $1 and created_at < $2`, [monthStart, nextMonthStart]
    ),
    pool.query(
      `select order_number, customer_name, product_type, product_size, quantity, unit_price, created_at
       from sales_orders order by created_at desc limit 5`
    ),
    pool.query(
      `select coalesce(sum(amount),0)::numeric as total
       from weekly_expenses where month=$1`, [month]
    ),
    pool.query(
      `select c.name, coalesce(sum(e.amount),0)::numeric as total
       from expense_categories c
       left join weekly_expenses e on e.category_id=c.id and e.month=$1
       where c.active=true
       group by c.name order by total desc limit 6`, [month]
    ),
    pool.query(`select count(*)::int as n from logistics_items where stock <= min_stock`),
    pool.query(`select count(*)::int as n from change_requests where status='Pending'`),
    pool.query(
      `select a.action, a.icon, a.role,
              to_char(a.created_at,'DD Mon HH24:MI') as time,
              u.name as user_name
       from audit_log a
       left join app_users u on u.id=a.user_id
       where a.role != all($1::text[])
       order by a.created_at desc limit 7`,
      [user.role === 'ceo' ? ['ceo'] : ['ceo', 'admin']]
    ),
    pool.query('select * from mv_stock_summary')
  ]);

  return {
    ok: true,
    month,
    stock: buildStock(stockRows[0] || {}),
    production: {
      thisMonth: monthProd[0] || {},
      lastMonth: lastMonthProd[0] || {},
      daily7
    },
    sales: {
      thisMonth: salesMonth[0] || {},
      recent: recentSales
    },
    expenses: {
      thisMonth: Number(expMonth[0]?.total || 0),
      byCategory: expByCategory.map((r) => ({ name: r.name, total: Number(r.total) }))
    },
    alerts: {
      lowStock: Number(lowStock[0]?.n || 0),
      pendingChanges: Number(pendingChanges[0]?.n || 0)
    },
    recentActivity
  };
}

async function monthlyDashboard(userId, monthKey) {
  const user = await getUser(userId);
  if (!(await mustRole(user, 'monthly'))) return { ok: false, error: 'Access denied' };

  const month = monthKey || new Date().toISOString().slice(0, 7);
  const [year, mon] = month.split('-').map(Number);
  const monthStart     = `${month}-01`;
  const monthEnd       = new Date(year, mon, 0).toISOString().slice(0, 10);
  const nextMonthStart = new Date(year, mon, 1).toISOString().slice(0, 10);

  const { rows: prodRows } = await pool.query(
    `select
       count(*)::int as log_days,
       coalesce(sum(timber_units),0)::int as timber_units,
       coalesce(sum(timber_waste),0)::int as timber_waste,
       coalesce(sum(poles_units),0)::int as poles_units,
       coalesce(sum(poles_waste),0)::int as poles_waste,
       coalesce(sum(downtime_hours),0)::numeric as downtime_hours
     from daily_logs
     where log_date >= $1 and log_date <= $2`,
    [monthStart, monthEnd]
  );

  const { rows: salesRows } = await pool.query(
    `select count(*)::int as order_count,
            coalesce(sum(quantity),0)::int as total_qty,
            coalesce(sum(quantity * unit_price),0)::numeric as total_revenue
     from sales_orders
     where created_at >= $1 and created_at < $2`,
    [monthStart, nextMonthStart]
  );

  const { rows: expRows } = await pool.query(
    `select c.name as category, coalesce(sum(e.amount),0)::numeric as total
     from expense_categories c
     left join weekly_expenses e on e.category_id=c.id and e.month=$1
     where c.active=true
     group by c.name
     order by c.name`,
    [month]
  );

  const totalExpenses = expRows.reduce((s, r) => s + Number(r.total), 0);

  const { rows: apprRows } = await pool.query(
    'select approved, approved_at from monthly_approvals where month_key=$1',
    [month]
  );

  return {
    ok: true,
    month,
    production: prodRows[0] || {},
    sales: salesRows[0] || {},
    expenses: expRows.map((r) => ({ category: r.category, total: Number(r.total) })),
    totalExpenses,
    approval: apprRows[0] || { approved: false }
  };
}

async function inventoryList(userId, workshopId) {
  const user = await getUser(userId);
  if (!(await mustRole(user, 'inventory'))) return { ok: false, error: 'Access denied' };
  const filterWh = isWorkshopRestricted(user) ? user.workshop_id : (workshopId || null);
  const { rows } = filterWh
    ? await pool.query(
        `select id, category, name, sku, uom, unit_cost, stock, min_stock, created_at
         from logistics_items
         where workshop_id=$1 or workshop_id is null
         order by category, name`, [filterWh])
    : await pool.query(
        `select id, category, name, sku, uom, unit_cost, stock, min_stock, created_at
         from logistics_items order by category, name`);
  const lowStockCount = rows.filter((r) => Number(r.stock) <= Number(r.min_stock)).length;
  const { rows: wh } = await pool.query(`select id, name from warehouses where active=true order by name`);
  return { ok: true, rows, lowStockCount, warehouses: wh, user_workshop_id: user.workshop_id };
}

// ── Warehouses ───────────────────────────────────────────────────────────────

async function warehousesList(userId, workshopId) {
  const user = await getUser(userId);
  if (!(await mustRole(user, 'warehouses'))) return { ok: false, error: 'Access denied' };
  const restricted = isWorkshopRestricted(user);
  const filterWh = restricted ? user.workshop_id : (workshopId || null);
  const { rows } = filterWh
    ? await pool.query(
        `select id, name, location, workshop_type, capacity, notes, active, created_at
         from warehouses where id=$1 order by name`, [filterWh])
    : await pool.query(
        `select id, name, location, workshop_type, capacity, notes, active, created_at
         from warehouses order by name`);
  const { rows: allWh } = await pool.query(`select id, name, workshop_type from warehouses where active=true order by name`);
  return { ok: true, rows, allWarehouses: allWh, user_workshop_id: user.workshop_id };
}

async function warehousesCreate(userId, payload) {
  const user = await getUser(userId);
  if (!(await mustRole(user, 'warehouses'))) return { ok: false, error: 'Access denied' };
  const p = payload || {};
  if (!p.name) return { ok: false, error: 'Name is required' };
  const { rows } = await pool.query(
    `insert into warehouses(name, location, workshop_type, capacity, notes, active)
     values ($1,$2,$3,$4,$5,true) returning id`,
    [p.name, p.location || null, p.workshop_type || null, p.capacity ? Number(p.capacity) : null, p.notes || null]
  );
  logAudit(user, `Created warehouse: ${p.name}`, 'ti-building-warehouse', { id: rows[0].id });
  return { ok: true };
}

async function warehousesUpdate(userId, warehouseId, payload) {
  const user = await getUser(userId);
  if (!(await mustRole(user, 'warehouses'))) return { ok: false, error: 'Access denied' };
  const p = payload || {};
  await pool.query(
    `update warehouses set name=$1, location=$2, workshop_type=$3, capacity=$4, notes=$5, active=$6
     where id=$7`,
    [p.name, p.location || null, p.workshop_type || null, p.capacity ? Number(p.capacity) : null, p.notes || null, p.active !== false, warehouseId]
  );
  logAudit(user, `Updated warehouse #${warehouseId}`, 'ti-building-warehouse', { id: warehouseId });
  return { ok: true };
}

// ── Stock Catalog ─────────────────────────────────────────────────────────────

async function stockItemsList(userId, workshopId) {
  const user = await getUser(userId);
  if (!(await mustRole(user, 'stock-items'))) return { ok: false, error: 'Access denied' };
  const restricted = isWorkshopRestricted(user);
  const filterWh = restricted ? user.workshop_id : (workshopId || null);
  const { rows: items } = filterWh
    ? await pool.query(
        `select sc.id, sc.category, sc.name, sc.sku, sc.uom, sc.unit_cost,
                sc.min_stock, sc.max_stock, sc.notes, sc.active,
                coalesce(sum(sl.quantity),0)::int as total_stock
         from stock_catalog sc
         left join stock_levels sl on sl.item_id=sc.id and sl.warehouse_id=$1
         where sc.active=true
         group by sc.id
         order by sc.category, sc.name`, [filterWh])
    : await pool.query(
        `select sc.id, sc.category, sc.name, sc.sku, sc.uom, sc.unit_cost,
                sc.min_stock, sc.max_stock, sc.notes, sc.active,
                coalesce(sum(sl.quantity),0)::int as total_stock
         from stock_catalog sc
         left join stock_levels sl on sl.item_id=sc.id
         where sc.active=true
         group by sc.id
         order by sc.category, sc.name`);
  const { rows: wh } = await pool.query(`select id, name from warehouses where active=true order by name`);
  return { ok: true, rows: items, warehouses: wh, user_workshop_id: user.workshop_id };
}

async function stockItemsCreate(userId, payload) {
  const user = await getUser(userId);
  if (!(await mustRole(user, 'stock-items'))) return { ok: false, error: 'Access denied' };
  const p = payload || {};
  if (!p.category || !p.name || !p.uom) return { ok: false, error: 'Category, name, and unit of measure are required' };
  const { rows } = await pool.query(
    `insert into stock_catalog(category, name, sku, uom, unit_cost, min_stock, max_stock, notes, created_by)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9) returning id`,
    [p.category, p.name, p.sku || null, p.uom, Number(p.unit_cost || 0),
     Number(p.min_stock || 0), p.max_stock ? Number(p.max_stock) : null,
     p.notes || null, user.id]
  );
  logAudit(user, `Added stock item: ${p.name}`, 'ti-package', { id: rows[0].id, category: p.category });
  return { ok: true };
}

async function stockItemsUpdate(userId, itemId, payload) {
  const user = await getUser(userId);
  if (!(await mustRole(user, 'stock-items'))) return { ok: false, error: 'Access denied' };
  const p = payload || {};
  await pool.query(
    `update stock_catalog
     set category=$1, name=$2, sku=$3, uom=$4, unit_cost=$5,
         min_stock=$6, max_stock=$7, notes=$8, active=$9
     where id=$10`,
    [p.category, p.name, p.sku || null, p.uom, Number(p.unit_cost || 0),
     Number(p.min_stock || 0), p.max_stock ? Number(p.max_stock) : null,
     p.notes || null, p.active !== false, itemId]
  );
  logAudit(user, `Updated stock item #${itemId}`, 'ti-package', { id: itemId });
  return { ok: true };
}

// ── Stock Movements ───────────────────────────────────────────────────────────

async function stockMovementsList(userId, workshopId) {
  const user = await getUser(userId);
  if (!(await mustRole(user, 'stock-movements'))) return { ok: false, error: 'Access denied' };
  const restricted = isWorkshopRestricted(user);
  const filterWh = restricted ? user.workshop_id : (workshopId || null);
  const { rows } = filterWh
    ? await pool.query(
        `select sm.id, sc.name as item_name, sc.category, sc.uom,
                w.name as warehouse_name, tw.name as to_warehouse_name,
                sm.movement_type, sm.quantity, sm.reference, sm.notes,
                sm.approval_status, sm.rejection_reason,
                to_char(sm.created_at,'DD/MM/YYYY HH24:MI') as created_at,
                u.name as created_by
         from stock_movements sm
         join stock_catalog sc on sc.id=sm.item_id
         left join warehouses w on w.id=sm.warehouse_id
         left join warehouses tw on tw.id=sm.to_warehouse_id
         left join app_users u on u.id=sm.created_by
         where sm.warehouse_id=$1 or sm.to_warehouse_id=$1
         order by sm.created_at desc limit 100`, [filterWh])
    : await pool.query(
        `select sm.id, sc.name as item_name, sc.category, sc.uom,
                w.name as warehouse_name, tw.name as to_warehouse_name,
                sm.movement_type, sm.quantity, sm.reference, sm.notes,
                sm.approval_status, sm.rejection_reason,
                to_char(sm.created_at,'DD/MM/YYYY HH24:MI') as created_at,
                u.name as created_by
         from stock_movements sm
         join stock_catalog sc on sc.id=sm.item_id
         left join warehouses w on w.id=sm.warehouse_id
         left join warehouses tw on tw.id=sm.to_warehouse_id
         left join app_users u on u.id=sm.created_by
         order by sm.created_at desc limit 100`);
  const { rows: items } = filterWh
    ? await pool.query(
        `select sc.id, sc.name, sc.category, sc.uom,
                coalesce(sum(sl.quantity),0)::int as total_stock
         from stock_catalog sc
         left join stock_levels sl on sl.item_id=sc.id and sl.warehouse_id=$1
         where sc.active=true group by sc.id order by sc.category, sc.name`, [filterWh])
    : await pool.query(
        `select sc.id, sc.name, sc.category, sc.uom,
                coalesce(sum(sl.quantity),0)::int as total_stock
         from stock_catalog sc
         left join stock_levels sl on sl.item_id=sc.id
         where sc.active=true group by sc.id order by sc.category, sc.name`);
  const { rows: wh } = await pool.query(`select id, name from warehouses where active=true order by name`);
  return { ok: true, rows, items, warehouses: wh, user_workshop_id: user.workshop_id };
}

async function stockMovementsCreate(userId, payload) {
  const user = await getUser(userId);
  if (!(await mustRole(user, 'stock-movements'))) return { ok: false, error: 'Access denied' };
  const p = payload || {};
  if (!p.item_id || !p.movement_type || !p.quantity) return { ok: false, error: 'Item, movement type, and quantity are required' };
  const qty = Number(p.quantity);
  if (qty <= 0) return { ok: false, error: 'Quantity must be greater than zero' };

  const validTypes = ['in', 'out', 'adjustment', 'transfer', 'return'];
  if (!validTypes.includes(p.movement_type)) return { ok: false, error: 'Invalid movement type' };

  if (isWorkshopRestricted(user) && p.warehouse_id && Number(p.warehouse_id) !== Number(user.workshop_id)) {
    return { ok: false, error: 'You can only record movements for your assigned workshop.' };
  }

  // Transfers require manager approval — record as pending, don't touch stock yet
  const isTransfer = p.movement_type === 'transfer';
  const approvalStatus = isTransfer ? 'pending' : null;

  const { rows: mvRows } = await pool.query(
    `insert into stock_movements(item_id, warehouse_id, to_warehouse_id, movement_type, quantity, reference, notes, approval_status, created_by)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9) returning id`,
    [p.item_id, p.warehouse_id || null, p.to_warehouse_id || null,
     p.movement_type, qty, p.reference || null, p.notes || null, approvalStatus, user.id]
  );

  if (!isTransfer && p.warehouse_id) {
    const delta = ['in', 'return'].includes(p.movement_type) ? qty : p.movement_type === 'out' ? -qty : 0;
    if (p.movement_type === 'adjustment') {
      await pool.query(
        `insert into stock_levels(item_id, warehouse_id, quantity, updated_at)
         values ($1,$2,$3,now())
         on conflict(item_id, warehouse_id) do update set quantity=$3, updated_at=now()`,
        [p.item_id, p.warehouse_id, qty]
      );
    } else if (delta !== 0) {
      await pool.query(
        `insert into stock_levels(item_id, warehouse_id, quantity, updated_at)
         values ($1,$2,$3,now())
         on conflict(item_id, warehouse_id) do update
         set quantity=greatest(0, stock_levels.quantity+$3), updated_at=now()`,
        [p.item_id, p.warehouse_id, delta]
      );
    }
  }

  logAudit(user, `Stock ${p.movement_type}${isTransfer?' (pending approval)':''}: item #${p.item_id} qty ${qty}`, 'ti-arrows-exchange', { ...p });
  return { ok: true, pending: isTransfer, movement_id: mvRows[0].id };
}

async function stockTransferApprove(userId, movementId, action, rejectionReason) {
  const user = await getUser(userId);
  if (!['admin', 'ceo', 'operations', 'logistics', 'supervisor'].includes(user.role))
    return { ok: false, error: 'Access denied — manager role required' };

  const client = await pool.connect();
  try {
    await client.query('begin');
    const { rows } = await client.query(
      `select * from stock_movements
       where id=$1 and movement_type='transfer' and approval_status='pending'
       for update skip locked`,
      [movementId]
    );
    if (!rows.length) {
      await client.query('rollback');
      return { ok: false, error: 'Transfer not found or already reviewed' };
    }
    const mv = rows[0];

    if (action === 'approve') {
      await client.query(
        `update stock_movements set approval_status='approved', approved_by=$1, approved_at=now() where id=$2`,
        [user.id, movementId]
      );
      if (mv.warehouse_id) {
        await client.query(
          `insert into stock_levels(item_id, warehouse_id, quantity, updated_at) values ($1,$2,$3,now())
           on conflict(item_id, warehouse_id) do update
           set quantity=greatest(0, stock_levels.quantity-$3), updated_at=now()`,
          [mv.item_id, mv.warehouse_id, mv.quantity]
        );
      }
      if (mv.to_warehouse_id) {
        await client.query(
          `insert into stock_levels(item_id, warehouse_id, quantity, updated_at) values ($1,$2,$3,now())
           on conflict(item_id, warehouse_id) do update
           set quantity=stock_levels.quantity+$3, updated_at=now()`,
          [mv.item_id, mv.to_warehouse_id, mv.quantity]
        );
      }
      logAudit(user, `Transfer approved #${movementId}: item #${mv.item_id} qty ${mv.quantity}`, 'ti-circle-check', { movementId });
    } else {
      await client.query(
        `update stock_movements set approval_status='rejected', approved_by=$1, approved_at=now(), rejection_reason=$2 where id=$3`,
        [user.id, rejectionReason || null, movementId]
      );
      logAudit(user, `Transfer rejected #${movementId}`, 'ti-circle-x', { movementId, rejectionReason });
    }

    await client.query('commit');
    return { ok: true };
  } catch (e) {
    await client.query('rollback');
    throw e;
  } finally {
    client.release();
  }
}

// ── Material Requests ─────────────────────────────────────────────────────────

async function materialRequestsList(userId, workshopId) {
  const user = await getUser(userId);
  if (!(await mustRole(user, 'stock-movements'))) return { ok: false, error: 'Access denied' };
  const restricted = isWorkshopRestricted(user);
  const filterWh = restricted ? user.workshop_id : (workshopId || null);

  const { rows } = filterWh
    ? await pool.query(
        `select mr.id, sc.name as item_name, sc.category, sc.uom,
                w.name as workshop_name, mr.workshop_id,
                mr.requested_qty, mr.approved_qty, mr.reason, mr.priority, mr.status,
                mr.review_notes,
                u1.name as requested_by, u2.name as reviewed_by,
                to_char(mr.requested_at,'DD/MM/YYYY HH24:MI') as requested_at,
                to_char(mr.reviewed_at,'DD/MM/YYYY HH24:MI') as reviewed_at
         from material_requests mr
         join stock_catalog sc on sc.id=mr.item_id
         left join warehouses w on w.id=mr.workshop_id
         left join app_users u1 on u1.id=mr.requested_by
         left join app_users u2 on u2.id=mr.reviewed_by
         where mr.workshop_id=$1
         order by mr.requested_at desc limit 100`, [filterWh])
    : await pool.query(
        `select mr.id, sc.name as item_name, sc.category, sc.uom,
                w.name as workshop_name, mr.workshop_id,
                mr.requested_qty, mr.approved_qty, mr.reason, mr.priority, mr.status,
                mr.review_notes,
                u1.name as requested_by, u2.name as reviewed_by,
                to_char(mr.requested_at,'DD/MM/YYYY HH24:MI') as requested_at,
                to_char(mr.reviewed_at,'DD/MM/YYYY HH24:MI') as reviewed_at
         from material_requests mr
         join stock_catalog sc on sc.id=mr.item_id
         left join warehouses w on w.id=mr.workshop_id
         left join app_users u1 on u1.id=mr.requested_by
         left join app_users u2 on u2.id=mr.reviewed_by
         order by mr.requested_at desc limit 100`);

  const { rows: items } = await pool.query(
    `select id, name, category, uom from stock_catalog where active=true order by category, name`
  );
  const { rows: workshops } = await pool.query(`select id, name from warehouses where active=true order by name`);
  return { ok: true, rows, items, workshops, user_workshop_id: user.workshop_id };
}

async function materialRequestsCreate(userId, payload) {
  const user = await getUser(userId);
  if (!(await mustRole(user, 'stock-movements'))) return { ok: false, error: 'Access denied' };
  const p = payload || {};
  if (!p.item_id || !p.requested_qty) return { ok: false, error: 'Item and quantity are required' };
  const qty = Number(p.requested_qty);
  if (qty <= 0) return { ok: false, error: 'Quantity must be greater than zero' };
  const workshopId = isWorkshopRestricted(user) ? user.workshop_id : (p.workshop_id ? Number(p.workshop_id) : null);
  await pool.query(
    `insert into material_requests(item_id, workshop_id, requested_qty, reason, priority, requested_by)
     values ($1,$2,$3,$4,$5,$6)`,
    [p.item_id, workshopId, qty, p.reason || null, p.priority || 'normal', user.id]
  );
  logAudit(user, `Material request: item #${p.item_id} qty ${qty}`, 'ti-clipboard-list', { ...p });
  return { ok: true };
}

async function materialRequestsApprove(userId, requestId, action, approvedQty, reviewNotes, sourceWarehouseId) {
  const user = await getUser(userId);
  if (!['admin', 'ceo', 'operations', 'logistics', 'supervisor'].includes(user.role))
    return { ok: false, error: 'Access denied — manager role required' };

  const { rows } = await pool.query(`select * from material_requests where id=$1 and status='pending'`, [requestId]);
  if (!rows.length) return { ok: false, error: 'Request not found or already reviewed' };
  const req = rows[0];

  if (action === 'approve') {
    const qty = approvedQty ? Number(approvedQty) : req.requested_qty;
    await pool.query(
      `update material_requests set status='approved', approved_qty=$1, reviewed_by=$2, review_notes=$3, reviewed_at=now() where id=$4`,
      [qty, user.id, reviewNotes || null, requestId]
    );
    // Auto-create a stock movement (out) from source warehouse if provided
    if (sourceWarehouseId && req.workshop_id) {
      await pool.query(
        `insert into stock_movements(item_id, warehouse_id, to_warehouse_id, movement_type, quantity, reference, notes, created_by)
         values ($1,$2,$3,'transfer',$4,$5,$6,$7)`,
        [req.item_id, sourceWarehouseId, req.workshop_id, qty,
         `MAT-REQ-${requestId}`, reviewNotes || null, user.id]
      );
      await pool.query(
        `insert into stock_levels(item_id, warehouse_id, quantity, updated_at) values ($1,$2,$3,now())
         on conflict(item_id, warehouse_id) do update
         set quantity=greatest(0, stock_levels.quantity-$3), updated_at=now()`,
        [req.item_id, sourceWarehouseId, qty]
      );
      await pool.query(
        `insert into stock_levels(item_id, warehouse_id, quantity, updated_at) values ($1,$2,$3,now())
         on conflict(item_id, warehouse_id) do update
         set quantity=stock_levels.quantity+$3, updated_at=now()`,
        [req.item_id, req.workshop_id, qty]
      );
    }
    logAudit(user, `Material request approved #${requestId} qty ${qty}`, 'ti-circle-check', { requestId });
  } else {
    await pool.query(
      `update material_requests set status='rejected', reviewed_by=$1, review_notes=$2, reviewed_at=now() where id=$3`,
      [user.id, reviewNotes || null, requestId]
    );
    logAudit(user, `Material request rejected #${requestId}`, 'ti-circle-x', { requestId });
  }
  return { ok: true };
}

// ── Workshop Overview Dashboard ───────────────────────────────────────────────

async function workshopOverview(userId) {
  const user = await getUser(userId);
  if (!(await mustRole(user, 'inventory'))) return { ok: false, error: 'Access denied' };
  const restricted = isWorkshopRestricted(user);

  const { rows: workshops } = await pool.query(
    `select w.id, w.name, w.location, w.workshop_type, w.active,
            count(distinct sl.item_id)::int as item_count,
            coalesce(sum(sl.quantity * coalesce(sc.unit_cost,0)),0)::numeric(14,2) as stock_value,
            count(distinct m.id)::int as machine_count,
            count(distinct m.id) filter (where m.status='Available')::int as machines_available,
            count(distinct m.id) filter (where m.status='Under Maintenance')::int as machines_maintenance
     from warehouses w
     left join stock_levels sl on sl.warehouse_id=w.id
     left join stock_catalog sc on sc.id=sl.item_id
     left join machines m on m.workshop_id=w.id and m.active=true
     ${restricted ? 'where w.id=$1' : 'where w.active=true'}
     group by w.id order by w.name`,
    restricted ? [user.workshop_id] : []
  );

  const { rows: pendingTransfers } = await pool.query(
    `select sm.id, sc.name as item_name, sc.uom,
            w.name as from_workshop, tw.name as to_workshop,
            sm.quantity, sm.notes,
            to_char(sm.created_at,'DD/MM/YYYY HH24:MI') as created_at,
            u.name as requested_by
     from stock_movements sm
     join stock_catalog sc on sc.id=sm.item_id
     left join warehouses w on w.id=sm.warehouse_id
     left join warehouses tw on tw.id=sm.to_warehouse_id
     left join app_users u on u.id=sm.created_by
     where sm.movement_type='transfer' and sm.approval_status='pending'
     ${restricted ? 'and (sm.warehouse_id=$1 or sm.to_warehouse_id=$1)' : ''}
     order by sm.created_at desc`,
    restricted ? [user.workshop_id] : []
  );

  const { rows: pendingRequests } = await pool.query(
    `select mr.id, sc.name as item_name, sc.uom,
            w.name as workshop_name, mr.requested_qty, mr.priority, mr.reason,
            to_char(mr.requested_at,'DD/MM/YYYY HH24:MI') as requested_at,
            u.name as requested_by
     from material_requests mr
     join stock_catalog sc on sc.id=mr.item_id
     left join warehouses w on w.id=mr.workshop_id
     left join app_users u on u.id=mr.requested_by
     where mr.status='pending'
     ${restricted ? 'and mr.workshop_id=$1' : ''}
     order by case mr.priority when 'urgent' then 0 when 'high' then 1 when 'normal' then 2 else 3 end, mr.requested_at`,
    restricted ? [user.workshop_id] : []
  );

  const { rows: lowStock } = await pool.query(
    `select sc.name, sc.category, sc.uom, sc.min_stock,
            coalesce(sum(sl.quantity),0)::int as total_stock,
            w.name as warehouse_name, w.id as warehouse_id
     from stock_catalog sc
     left join stock_levels sl on sl.item_id=sc.id ${restricted ? 'and sl.warehouse_id=$1' : ''}
     left join warehouses w on w.id=sl.warehouse_id
     where sc.active=true
     group by sc.id, w.id, w.name
     having coalesce(sum(sl.quantity),0) <= sc.min_stock and sc.min_stock > 0
     order by sc.category, sc.name limit 25`,
    restricted ? [user.workshop_id] : []
  );

  return { ok: true, workshops, pendingTransfers, pendingRequests, lowStock, user_workshop_id: user.workshop_id, is_restricted: restricted };
}

// ── Vehicles ──────────────────────────────────────────────────────────────────

async function vehiclesList(userId) {
  const user = await getUser(userId);
  if (!(await mustRole(user, 'vehicles'))) return { ok: false, error: 'Access denied' };
  const { rows } = await pool.query(
    `select v.id, v.registration, v.make, v.model, v.vehicle_type, v.status,
            v.fuel_type, v.insurance_expiry, v.notes,
            v.ownership_type, v.vehicle_category, v.year, v.chassis_vin, v.engine_number,
            v.odometer_reading, v.asset_code, v.purchase_date, v.purchase_cost,
            v.department, v.driver_assigned, v.road_license_expiry, v.inspection_expiry,
            v.owner_name, v.owner_type, v.owner_id_number, v.owner_phone, v.owner_email,
            v.owner_address, v.contract_number, v.contract_start_date, v.contract_end_date,
            v.payment_rate, v.payment_method, v.assigned_project,
            v.driver_name, v.driver_phone, v.driver_license_number, v.driver_license_expiry,
            v.doc_registration_card, v.doc_insurance_cert, v.doc_photos,
            v.doc_owner_id, v.doc_contract,
            coalesce(sum(fl.total_cost),0)::numeric as total_fuel_cost,
            coalesce(sum(fl.liters),0)::numeric as total_liters,
            (select count(*)::int from maintenance_records mr where mr.vehicle_id=v.id) as maintenance_count
     from vehicles v
     left join fuel_logs fl on fl.vehicle_id=v.id
     group by v.id
     order by v.registration`
  );
  return { ok: true, rows };
}

async function vehiclesCreate(userId, payload) {
  const user = await getUser(userId);
  if (!(await mustRole(user, 'vehicles'))) return { ok: false, error: 'Access denied' };
  const p = payload || {};
  if (!p.registration) return { ok: false, error: 'Registration number is required' };
  const { rows } = await pool.query(
    `insert into vehicles(
       registration, make, model, vehicle_type, status, fuel_type, insurance_expiry, notes,
       ownership_type, vehicle_category, year, chassis_vin, engine_number, odometer_reading,
       asset_code, purchase_date, purchase_cost, department, driver_assigned,
       road_license_expiry, inspection_expiry,
       owner_name, owner_type, owner_id_number, owner_phone, owner_email, owner_address,
       contract_number, contract_start_date, contract_end_date, payment_rate, payment_method, assigned_project,
       driver_name, driver_phone, driver_license_number, driver_license_expiry,
       doc_registration_card, doc_insurance_cert, doc_photos, doc_owner_id, doc_contract
     ) values (
       $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,
       $22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34,$35,$36,$37,$38,$39,$40,$41,$42
     ) returning id`,
    [
      p.registration, p.make||null, p.model||null, p.vehicle_type||null,
      p.status||'Active', p.fuel_type||null, p.insurance_expiry||null, p.notes||null,
      p.ownership_type||null, p.vehicle_category||null, p.year||null, p.chassis_vin||null,
      p.engine_number||null, p.odometer_reading||null,
      p.asset_code||null, p.purchase_date||null, p.purchase_cost||null,
      p.department||null, p.driver_assigned||null,
      p.road_license_expiry||null, p.inspection_expiry||null,
      p.owner_name||null, p.owner_type||null, p.owner_id_number||null,
      p.owner_phone||null, p.owner_email||null, p.owner_address||null,
      p.contract_number||null, p.contract_start_date||null, p.contract_end_date||null,
      p.payment_rate||null, p.payment_method||null, p.assigned_project||null,
      p.driver_name||null, p.driver_phone||null, p.driver_license_number||null,
      p.driver_license_expiry||null,
      p.doc_registration_card||null, p.doc_insurance_cert||null, p.doc_photos||null,
      p.doc_owner_id||null, p.doc_contract||null
    ]
  );
  logAudit(user, `Registered vehicle: ${p.registration}`, 'ti-truck', { id: rows[0].id });
  return { ok: true };
}

async function vehiclesUpdate(userId, vehicleId, payload) {
  const user = await getUser(userId);
  if (!(await mustRole(user, 'vehicles'))) return { ok: false, error: 'Access denied' };
  const p = payload || {};
  await pool.query(
    `update vehicles set
       registration=$1, make=$2, model=$3, vehicle_type=$4, status=$5, fuel_type=$6,
       insurance_expiry=$7, notes=$8, ownership_type=$9, vehicle_category=$10,
       year=$11, chassis_vin=$12, engine_number=$13, odometer_reading=$14,
       asset_code=$15, purchase_date=$16, purchase_cost=$17, department=$18, driver_assigned=$19,
       road_license_expiry=$20, inspection_expiry=$21,
       owner_name=$22, owner_type=$23, owner_id_number=$24, owner_phone=$25, owner_email=$26,
       owner_address=$27, contract_number=$28, contract_start_date=$29, contract_end_date=$30,
       payment_rate=$31, payment_method=$32, assigned_project=$33,
       driver_name=$34, driver_phone=$35, driver_license_number=$36, driver_license_expiry=$37,
       doc_registration_card=$38, doc_insurance_cert=$39, doc_photos=$40, doc_owner_id=$41, doc_contract=$42
     where id=$43`,
    [
      p.registration, p.make||null, p.model||null, p.vehicle_type||null,
      p.status||'Active', p.fuel_type||null, p.insurance_expiry||null, p.notes||null,
      p.ownership_type||null, p.vehicle_category||null, p.year||null, p.chassis_vin||null,
      p.engine_number||null, p.odometer_reading||null,
      p.asset_code||null, p.purchase_date||null, p.purchase_cost||null,
      p.department||null, p.driver_assigned||null,
      p.road_license_expiry||null, p.inspection_expiry||null,
      p.owner_name||null, p.owner_type||null, p.owner_id_number||null,
      p.owner_phone||null, p.owner_email||null, p.owner_address||null,
      p.contract_number||null, p.contract_start_date||null, p.contract_end_date||null,
      p.payment_rate||null, p.payment_method||null, p.assigned_project||null,
      p.driver_name||null, p.driver_phone||null, p.driver_license_number||null,
      p.driver_license_expiry||null,
      p.doc_registration_card||null, p.doc_insurance_cert||null, p.doc_photos||null,
      p.doc_owner_id||null, p.doc_contract||null,
      vehicleId
    ]
  );
  logAudit(user, `Updated vehicle #${vehicleId}`, 'ti-truck', { id: vehicleId });
  return { ok: true };
}

async function fuelLogsList(userId, vehicleId) {
  const user = await getUser(userId);
  if (!(await mustRole(user, 'vehicles'))) return { ok: false, error: 'Access denied' };
  const { rows } = await pool.query(
    `select fl.id, v.registration, fl.liters, fl.cost_per_liter, fl.total_cost,
            fl.odometer, to_char(fl.log_date,'DD/MM/YYYY') as log_date, fl.notes,
            u.name as logged_by
     from fuel_logs fl
     join vehicles v on v.id=fl.vehicle_id
     left join app_users u on u.id=fl.logged_by
     where fl.vehicle_id=$1
     order by fl.log_date desc`,
    [vehicleId]
  );
  return { ok: true, rows };
}

async function fuelLogsCreate(userId, payload) {
  const user = await getUser(userId);
  if (!(await mustRole(user, 'vehicles'))) return { ok: false, error: 'Access denied' };
  const p = payload || {};
  if (!p.vehicle_id || !p.liters || !p.log_date) return { ok: false, error: 'Vehicle, liters, and date are required' };
  const liters = Number(p.liters);
  const costPerLiter = Number(p.cost_per_liter || 0);
  const totalCost = p.total_cost ? Number(p.total_cost) : liters * costPerLiter;
  await pool.query(
    `insert into fuel_logs(vehicle_id, liters, cost_per_liter, total_cost, odometer, log_date, logged_by, notes)
     values ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [p.vehicle_id, liters, costPerLiter || null, totalCost || null,
     p.odometer ? Number(p.odometer) : null, p.log_date, user.id, p.notes || null]
  );
  logAudit(user, `Fuel log for vehicle #${p.vehicle_id}: ${liters}L`, 'ti-gas-station', { vehicle_id: p.vehicle_id, liters });
  return { ok: true };
}

async function maintenanceList(userId, vehicleId) {
  const user = await getUser(userId);
  if (!(await mustRole(user, 'vehicles'))) return { ok: false, error: 'Access denied' };
  const { rows } = await pool.query(
    `select mr.id, v.registration, mr.maintenance_type, mr.description,
            mr.cost, to_char(mr.maintenance_date,'DD/MM/YYYY') as maintenance_date,
            to_char(mr.next_due_date,'DD/MM/YYYY') as next_due_date,
            mr.performed_by, mr.notes
     from maintenance_records mr
     join vehicles v on v.id=mr.vehicle_id
     where mr.vehicle_id=$1
     order by mr.maintenance_date desc`,
    [vehicleId]
  );
  return { ok: true, rows };
}

async function maintenanceCreate(userId, payload) {
  const user = await getUser(userId);
  if (!(await mustRole(user, 'vehicles'))) return { ok: false, error: 'Access denied' };
  const p = payload || {};
  if (!p.vehicle_id || !p.maintenance_type || !p.description || !p.maintenance_date)
    return { ok: false, error: 'Vehicle, type, description, and date are required' };
  await pool.query(
    `insert into maintenance_records(vehicle_id, maintenance_type, description, cost, maintenance_date, next_due_date, performed_by, notes, created_by)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [p.vehicle_id, p.maintenance_type, p.description, p.cost ? Number(p.cost) : null,
     p.maintenance_date, p.next_due_date || null, p.performed_by || null, p.notes || null, user.id]
  );
  logAudit(user, `Maintenance record for vehicle #${p.vehicle_id}`, 'ti-tool', { vehicle_id: p.vehicle_id, type: p.maintenance_type });
  return { ok: true };
}

// ── Delivery Orders ───────────────────────────────────────────────────────────

async function deliveryOrdersList(userId) {
  const user = await getUser(userId);
  if (!(await mustRole(user, 'deliveries'))) return { ok: false, error: 'Access denied' };
  const { rows } = await pool.query(
    `select do2.id, do2.order_number, do2.driver_name,
            do2.status, do2.route, do2.notes,
            to_char(do2.delivery_date,'DD/MM/YYYY') as delivery_date,
            to_char(do2.created_at,'DD/MM/YYYY') as created_at,
            v.registration as vehicle_registration,
            so.order_number as sales_order_number,
            so.customer_name,
            u.name as created_by
     from delivery_orders do2
     left join vehicles v on v.id=do2.vehicle_id
     left join sales_orders so on so.id=do2.sales_order_id
     left join app_users u on u.id=do2.created_by
     order by do2.created_at desc
     limit 100`
  );
  const { rows: vehicles } = await pool.query(
    `select id, registration, make, model from vehicles where status='Active' order by registration`
  );
  const { rows: salesOrders } = await pool.query(
    `select id, order_number, customer_name from sales_orders where status in ('Confirmed') order by created_at desc limit 50`
  );
  return { ok: true, rows, vehicles, salesOrders };
}

async function deliveryOrdersCreate(userId, payload) {
  const user = await getUser(userId);
  if (!(await mustRole(user, 'deliveries'))) return { ok: false, error: 'Access denied' };
  const p = payload || {};
  if (!p.driver_name) return { ok: false, error: 'Driver name is required' };
  const ts = Date.now().toString(36).toUpperCase();
  const orderNum = `DEL-${ts}`;
  const { rows } = await pool.query(
    `insert into delivery_orders(order_number, sales_order_id, vehicle_id, driver_name, delivery_date, status, route, notes, created_by)
     values ($1,$2,$3,$4,$5,'Pending',$6,$7,$8) returning id`,
    [orderNum, p.sales_order_id || null, p.vehicle_id || null, p.driver_name,
     p.delivery_date || null, p.route || null, p.notes || null, user.id]
  );
  logAudit(user, `Created delivery order ${orderNum}`, 'ti-truck-delivery', { id: rows[0].id });
  return { ok: true };
}

async function deliveryOrdersUpdateStatus(userId, orderId, status) {
  const user = await getUser(userId);
  if (!(await mustRole(user, 'deliveries'))) return { ok: false, error: 'Access denied' };
  const valid = ['Pending', 'Assigned', 'In Transit', 'Delivered', 'Failed'];
  if (!valid.includes(status)) return { ok: false, error: 'Invalid status' };
  await pool.query('update delivery_orders set status=$1 where id=$2', [status, orderId]);
  logAudit(user, `Updated delivery #${orderId} to ${status}`, 'ti-truck-delivery', { orderId, status });
  return { ok: true };
}

// ── Dispatch ──────────────────────────────────────────────────────────────────

async function dispatchList(userId) {
  const user = await getUser(userId);
  if (!(await mustRole(user, 'dispatch'))) return { ok: false, error: 'Access denied' };
  const { rows } = await pool.query(
    `select dr.id, dr.request_number, dr.status, dr.notes,
            to_char(dr.created_at,'DD/MM/YYYY HH24:MI') as created_at,
            to_char(dr.approved_at,'DD/MM/YYYY HH24:MI') as approved_at,
            do2.order_number as delivery_order_number,
            do2.driver_name, do2.route,
            v.registration as vehicle_registration,
            u.name as created_by,
            au.name as approved_by
     from dispatch_requests dr
     left join delivery_orders do2 on do2.id=dr.delivery_order_id
     left join vehicles v on v.id=do2.vehicle_id
     left join app_users u on u.id=dr.created_by
     left join app_users au on au.id=dr.approved_by
     order by dr.created_at desc
     limit 100`
  );
  const { rows: pendingDeliveries } = await pool.query(
    `select id, order_number, driver_name from delivery_orders where status='Assigned' order by created_at desc`
  );
  return { ok: true, rows, pendingDeliveries };
}

async function dispatchCreate(userId, payload) {
  const user = await getUser(userId);
  if (!(await mustRole(user, 'dispatch'))) return { ok: false, error: 'Access denied' };
  const p = payload || {};
  if (!p.delivery_order_id) return { ok: false, error: 'Delivery order is required' };
  const ts = Date.now().toString(36).toUpperCase();
  const reqNum = `DSP-${ts}`;
  await pool.query(
    `insert into dispatch_requests(request_number, delivery_order_id, status, notes, created_by)
     values ($1,$2,'Pending',$3,$4)`,
    [reqNum, p.delivery_order_id, p.notes || null, user.id]
  );
  logAudit(user, `Created dispatch request ${reqNum}`, 'ti-send', { delivery_order_id: p.delivery_order_id });
  return { ok: true };
}

async function dispatchReview(userId, requestId, status, notes) {
  const user = await getUser(userId);
  if (!['admin', 'ceo', 'logistics', 'operations'].includes(user.role))
    return { ok: false, error: 'Access denied' };
  const valid = ['Approved', 'Rejected', 'Dispatched'];
  if (!valid.includes(status)) return { ok: false, error: 'Invalid status' };
  await pool.query(
    `update dispatch_requests set status=$1, notes=coalesce($2,notes), approved_by=$3, approved_at=now()
     where id=$4`,
    [status, notes || null, user.id, requestId]
  );
  if (status === 'Dispatched') {
    await pool.query(
      `update delivery_orders set status='In Transit'
       where id=(select delivery_order_id from dispatch_requests where id=$1)`,
      [requestId]
    );
  }
  logAudit(user, `Dispatch request #${requestId} ${status}`, 'ti-send', { requestId, status });
  return { ok: true };
}

// ── Harvest ───────────────────────────────────────────────────────────────────

async function harvestList(userId) {
  const user = await getUser(userId);
  if (!(await mustRole(user, 'harvest'))) return { ok: false, error: 'Access denied' };
  const { rows } = await pool.query(
    `select hl.id, hl.location, hl.species, hl.quantity, hl.uom, hl.notes,
            to_char(hl.harvest_date,'DD/MM/YYYY') as harvest_date,
            to_char(hl.created_at,'DD/MM/YYYY') as created_at,
            u.name as logged_by
     from harvest_logs hl
     left join app_users u on u.id=hl.logged_by
     order by hl.harvest_date desc
     limit 100`
  );
  const summary = {};
  for (const r of rows) {
    if (!summary[r.species]) summary[r.species] = 0;
    summary[r.species] += Number(r.quantity);
  }
  return { ok: true, rows, summary };
}

async function harvestCreate(userId, payload) {
  const user = await getUser(userId);
  if (!(await mustRole(user, 'harvest')) && !(await mustRole(user, 'daily-harvest')))
    return { ok: false, error: 'Access denied' };
  const p = payload || {};
  if (!p.species || !p.harvest_date || !p.quantity)
    return { ok: false, error: 'Species, date, and quantity are required' };
  const location = p.location || p.compt_name || '';
  const logsCrosscut = Number(p.logs_crosscut || 0);
  const logsHandrolled = Number(p.logs_handrolled || 0);
  await pool.query(
    `insert into harvest_logs(location, species, harvest_date, quantity, uom, notes, logged_by, compt_id, sub_name, logs_crosscut, logs_handrolled)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
    [location, p.species, p.harvest_date, Number(p.quantity),
     p.uom || 'trees', p.notes || null, user.id,
     p.compt_id ? Number(p.compt_id) : null, p.sub_name || null,
     logsCrosscut, logsHandrolled]
  );
  // Auto-check if compartment is now fully harvested
  if (p.compt_id) {
    const { rows: [compt] } = await pool.query(
      `select c.volume_m3,
              round(coalesce(sum(hl.logs_crosscut::numeric / 3.4),0)::numeric, 2) as harvested_m3
       from compartments c
       left join harvest_logs hl on hl.compt_id=c.id
       where c.id=$1
       group by c.id, c.volume_m3`,
      [Number(p.compt_id)]
    );
    if (compt && Number(compt.harvested_m3) >= Number(compt.volume_m3)) {
      await pool.query(`update compartments set status='Completed' where id=$1`, [Number(p.compt_id)]);
    }
  }
  logAudit(user, `Harvest logged: ${p.species} at ${location}`, 'ti-tree', { ...p });
  return { ok: true };
}

// ── Timber Inventory ──────────────────────────────────────────────────────────

async function timberInventoryList(userId) {
  const user = await getUser(userId);
  if (!(await mustRole(user, 'timber-inventory'))) return { ok: false, error: 'Access denied' };

  const [{ rows: stockRows }, { rows: logs7 }, { rows: harvestRows }] = await Promise.all([
    pool.query('select * from mv_stock_summary'),
    pool.query(
      `select to_char(log_date,'DD Mon YYYY') as date,
              timber_units, timber_kiln_dried, timber_cca_treated, timber_untreated,
              timber_waste, poles_units, poles_waste, downtime_hours, supervisor
       from daily_logs order by log_date desc limit 7`
    ),
    pool.query(
      `select species, coalesce(sum(quantity),0)::int as total,
              count(*)::int as harvests
       from harvest_logs group by species order by total desc`
    )
  ]);

  const stock = buildStock(stockRows[0] || {});
  const wasteRate = stock.timberProduced > 0
    ? ((await pool.query(`select coalesce(sum(timber_waste),0)::int as w from daily_logs`)).rows[0].w / stock.timberProduced * 100).toFixed(1)
    : '0.0';

  return { ok: true, stock, logs7, harvestSummary: harvestRows, wasteRate };
}

async function dailyHarvestData(userId) {
  const user = await getUser(userId);
  const userPerms = Array.isArray(user.user_permissions) && user.user_permissions.length
    ? user.user_permissions
    : await getRolePages(user.role);
  if (!userPerms.includes('daily-harvest') && !userPerms.includes('harvest') && !userPerms.includes('daily'))
    return { ok: false, error: 'Access denied' };
  const [{ rows }, { rows: compts }] = await Promise.all([
    pool.query(
      `select hl.id, hl.location, hl.species, hl.quantity, hl.uom, hl.notes,
              hl.compt_id, hl.sub_name, hl.logs_crosscut, hl.logs_handrolled,
              to_char(hl.harvest_date,'DD/MM/YYYY') as harvest_date,
              to_char(hl.created_at,'DD/MM/YYYY') as created_at,
              u.name as logged_by,
              c.compt_name, c.area_ha, c.volume_m3 as compt_volume_m3
       from harvest_logs hl
       left join app_users u on u.id=hl.logged_by
       left join compartments c on c.id=hl.compt_id
       order by hl.harvest_date desc
       limit 100`
    ),
    pool.query(
      `select c.id, c.compt_name, c.sub_name, c.species, c.area_ha, c.volume_m3, c.status,
              coalesce(sum(hl.quantity),0)::int                                        as trees_harvested,
              coalesce(sum(hl.logs_crosscut),0)::int                                   as logs_crosscut,
              coalesce(sum(hl.logs_handrolled),0)::int                                 as logs_handrolled,
              round(coalesce(sum(hl.logs_crosscut::numeric / 3.4),0)::numeric, 2)      as volume_harvested_m3
       from compartments c
       left join harvest_logs hl on hl.compt_id=c.id
       group by c.id, c.compt_name, c.sub_name, c.species, c.area_ha, c.volume_m3, c.status
       order by c.compt_name`
    )
  ]);
  const summary = {};
  for (const r of rows) {
    if (!summary[r.species]) summary[r.species] = { trees: 0, crosscut: 0, handrolled: 0 };
    summary[r.species].trees    += Number(r.quantity);
    summary[r.species].crosscut += Number(r.logs_crosscut || 0);
    summary[r.species].handrolled += Number(r.logs_handrolled || 0);
  }
  return { ok: true, rows, summary, compartments: compts };
}

// ── Supervisor Pending-Edit Approvals ────────────────────────────────────────

const APPROVAL_MANAGERS = ['admin', 'ceo', 'operations', 'logistics'];

async function pendingEditsList(userId) {
  const user = await getUser(userId);
  const { rows } = await pool.query(
    `select pe.id, pe.action_type, pe.entity_type, pe.entity_id, pe.entity_ref,
            pe.payload, pe.status, pe.review_notes,
            to_char(pe.submitted_at,'DD/MM/YYYY HH24:MI') as submitted_at,
            to_char(pe.reviewed_at,'DD/MM/YYYY HH24:MI') as reviewed_at,
            su.name as submitted_by_name,
            ru.name as reviewed_by_name
     from pending_edits pe
     left join app_users su on su.id=pe.submitted_by
     left join app_users ru on ru.id=pe.reviewed_by
     order by pe.submitted_at desc
     limit 200`
  );
  return { ok: true, rows };
}

async function pendingEditsCreate(userId, payload) {
  const user = await getUser(userId);
  const p = payload || {};
  if (!p.entity_type || !p.entity_id || !p.action_type)
    return { ok: false, error: 'Missing required fields' };
  await pool.query(
    `insert into pending_edits(action_type, entity_type, entity_id, entity_ref, payload, submitted_by)
     values ($1,$2,$3,$4,$5,$6)`,
    [p.action_type, p.entity_type, p.entity_id, p.entity_ref || null,
     p.payload ? JSON.stringify(p.payload) : null, user.id]
  );
  logAudit(user,
    `Submitted ${p.action_type} request for ${p.entity_type} #${p.entity_id}`,
    'ti-send', { entity_type: p.entity_type, entity_id: p.entity_id }
  );
  return { ok: true };
}

async function pendingEditsReview(userId, pendingId, status, reviewNotes) {
  const user = await getUser(userId);
  if (!APPROVAL_MANAGERS.includes(user.role))
    return { ok: false, error: 'Only managers can review pending requests' };

  const { rows } = await pool.query('select * from pending_edits where id=$1', [pendingId]);
  if (!rows.length) return { ok: false, error: 'Request not found' };
  const pe = rows[0];
  if (pe.status !== 'Pending') return { ok: false, error: 'Already reviewed' };

  if (status === 'Approved') {
    try {
      await applyPendingEdit(pe);
    } catch (e) {
      return { ok: false, error: `Could not apply change: ${e.message}` };
    }
  }

  await pool.query(
    `update pending_edits
     set status=$1, review_notes=$2, reviewed_by=$3, reviewed_at=now()
     where id=$4`,
    [status, reviewNotes || null, user.id, pendingId]
  );
  logAudit(user,
    `${status} ${pe.action_type} request for ${pe.entity_type} #${pe.entity_id}`,
    status === 'Approved' ? 'ti-circle-check' : 'ti-circle-x',
    { pendingId, entity_type: pe.entity_type, entity_id: pe.entity_id }
  );
  return { ok: true };
}

async function applyPendingEdit(pe) {
  const p = pe.payload || {};

  if (pe.action_type === 'delete') {
    const tableMap = {
      daily_log:      'daily_logs',
      harvest_log:    'harvest_logs',
      logistics_item: 'logistics_items'
    };
    const tbl = tableMap[pe.entity_type];
    if (!tbl) throw new Error(`Unknown entity type: ${pe.entity_type}`);
    await pool.query(`delete from ${tbl} where id=$1`, [pe.entity_id]);
    return;
  }

  switch (pe.entity_type) {
    case 'daily_log': {
      const kd  = Number(p.timber_kiln_dried  || 0);
      const cca = Number(p.timber_cca_treated || 0);
      const unt = Number(p.timber_untreated   || 0);
      const tot = kd + cca + unt || Number(p.timber_units || 0);
      await pool.query(
        `update daily_logs
         set log_date=$1, supervisor=$2, timber_units=$3,
             timber_kiln_dried=$4, timber_cca_treated=$5, timber_untreated=$6,
             timber_waste=$7, poles_units=$8, poles_waste=$9,
             downtime_hours=$10, downtime_reason=$11, remarks=$12
         where id=$13`,
        [p.date, p.supervisor, tot, kd, cca, unt,
         Number(p.timber_waste || 0), Number(p.poles_units || 0), Number(p.poles_waste || 0),
         Number(p.downtime_hours || 0), p.downtime_reason || null, p.remarks || null,
         pe.entity_id]
      );
      break;
    }
    case 'harvest_log':
      await pool.query(
        `update harvest_logs
         set location=$1, species=$2, harvest_date=$3, quantity=$4, uom=$5, notes=$6
         where id=$7`,
        [p.location, p.species, p.harvest_date, Number(p.quantity),
         p.uom || 'units', p.notes || null, pe.entity_id]
      );
      break;
    case 'logistics_item':
      await pool.query(
        `update logistics_items
         set category=$1, name=$2, sku=$3, uom=$4, unit_cost=$5, stock=$6, min_stock=$7
         where id=$8`,
        [p.category, p.name, p.sku || null, p.uom,
         Number(p.unit_cost || 0), Number(p.stock || 0), Number(p.min_stock || 0),
         pe.entity_id]
      );
      break;
    default:
      throw new Error(`No apply handler for entity type: ${pe.entity_type}`);
  }
}

// ── Edit / Delete ─────────────────────────────────────────────────────────────

async function dailyUpdate(userId, logId, payload) {
  const user = await getUser(userId);
  if (!(await canAccessDaily(user))) return { ok: false, error: 'Access denied' };
  const p = payload || {};
  if (!p.date) return { ok: false, error: 'Date is required' };
  const kd = Number(p.timber_kiln_dried || 0);
  const cca = Number(p.timber_cca_treated || 0);
  const unt = Number(p.timber_untreated || 0);
  const total = kd + cca + unt || Number(p.timber_units || 0);
  await pool.query(
    `update daily_logs set log_date=$1, supervisor=$2, timber_units=$3,
     timber_kiln_dried=$4, timber_cca_treated=$5, timber_untreated=$6,
     timber_waste=$7, poles_units=$8, poles_waste=$9,
     downtime_hours=$10, downtime_reason=$11, remarks=$12, product_size=$13, machine=$14,
     logs_received=$15
     where id=$16`,
    [p.date, p.supervisor || user.name, total, kd, cca, unt,
     Number(p.timber_waste || 0), Number(p.poles_units || 0), Number(p.poles_waste || 0),
     Number(p.downtime_hours || 0), p.downtime_reason || null, p.remarks || null,
     p.product_size || null, p.machine || null, Number(p.logs_received || 0), logId]
  );
  logAudit(user, `Updated daily log #${logId}`, 'ti-edit', { logId, date: p.date });
  refreshStockView();
  return { ok: true };
}

async function dailyDelete(userId, logId) {
  const user = await getUser(userId);
  if (!(await canAccessDaily(user))) return { ok: false, error: 'Access denied' };
  const { rows } = await pool.query('select log_date from daily_logs where id=$1', [logId]);
  if (!rows.length) return { ok: false, error: 'Entry not found' };
  await pool.query('delete from daily_logs where id=$1', [logId]);
  logAudit(user, `Deleted daily log #${logId} (${rows[0].log_date})`, 'ti-trash', { logId });
  refreshStockView();
  return { ok: true };
}

async function salesUpdate(userId, orderId, payload) {
  const user = await getUser(userId);
  if (!(await mustRole(user, 'sales'))) return { ok: false, error: 'Access denied' };
  const p = payload || {};
  if (!p.customer_name || !p.product_type) return { ok: false, error: 'Customer and product type are required' };
  await pool.query(
    `update sales_orders
     set order_number=$1, customer_name=$2, product_type=$3, product_sub_type=$4,
         product_size=$5, quantity=$6, unit_price=$7, notes=$8
     where id=$9`,
    [p.order_number, p.customer_name, p.product_type, p.product_sub_type || null,
     p.product_size, Number(p.quantity), Number(p.unit_price), p.notes || null, orderId]
  );
  logAudit(user, `Updated sales order #${orderId}`, 'ti-edit', { orderId });
  refreshStockView();
  return { ok: true };
}

async function salesDelete(userId, orderId) {
  const user = await getUser(userId);
  if (!(await mustRole(user, 'sales'))) return { ok: false, error: 'Access denied' };
  const { rows } = await pool.query('select order_number from sales_orders where id=$1', [orderId]);
  if (!rows.length) return { ok: false, error: 'Order not found' };
  await pool.query('delete from sales_orders where id=$1', [orderId]);
  logAudit(user, `Deleted sales order ${rows[0].order_number}`, 'ti-trash', { orderId });
  refreshStockView();
  return { ok: true };
}

async function logisticsUpdate(userId, itemId, payload) {
  const user = await getUser(userId);
  if (!(await mustRole(user, 'logistics'))) return { ok: false, error: 'Access denied' };
  const p = payload || {};
  await pool.query(
    `update logistics_items
     set category=$1, name=$2, sku=$3, uom=$4, unit_cost=$5, stock=$6, min_stock=$7
     where id=$8`,
    [p.category, p.name, p.sku || null, p.uom,
     Number(p.unit_cost || 0), Number(p.stock || 0), Number(p.min_stock || 0), itemId]
  );
  logAudit(user, `Updated logistics item #${itemId}`, 'ti-edit', { itemId });
  return { ok: true };
}

async function logisticsDelete(userId, itemId) {
  const user = await getUser(userId);
  if (!(await mustRole(user, 'logistics'))) return { ok: false, error: 'Access denied' };
  const { rows } = await pool.query('select name from logistics_items where id=$1', [itemId]);
  if (!rows.length) return { ok: false, error: 'Item not found' };
  await pool.query('delete from logistics_items where id=$1', [itemId]);
  logAudit(user, `Deleted logistics item: ${rows[0].name}`, 'ti-trash', { itemId });
  return { ok: true };
}

async function harvestUpdate(userId, logId, payload) {
  const user = await getUser(userId);
  if (!(await mustRole(user, 'harvest')) && !(await mustRole(user, 'daily-harvest')))
    return { ok: false, error: 'Access denied' };
  const p = payload || {};
  if (!p.species || !p.harvest_date || !p.quantity)
    return { ok: false, error: 'Species, date, and quantity are required' };
  const location = p.location || p.compt_name || '';
  await pool.query(
    `update harvest_logs set location=$1, species=$2, harvest_date=$3, quantity=$4, uom=$5, notes=$6,
     compt_id=$7, sub_name=$8, logs_crosscut=$9, logs_handrolled=$10
     where id=$11`,
    [location, p.species, p.harvest_date, Number(p.quantity), p.uom || 'trees', p.notes || null,
     p.compt_id ? Number(p.compt_id) : null, p.sub_name || null,
     Number(p.logs_crosscut || 0), Number(p.logs_handrolled || 0), logId]
  );
  logAudit(user, `Updated harvest log #${logId}`, 'ti-edit', { logId });
  return { ok: true };
}

async function harvestDelete(userId, logId) {
  const user = await getUser(userId);
  if (!(await mustRole(user, 'harvest'))) return { ok: false, error: 'Access denied' };
  await pool.query('delete from harvest_logs where id=$1', [logId]);
  logAudit(user, `Deleted harvest log #${logId}`, 'ti-trash', { logId });
  return { ok: true };
}

async function deliveryOrdersUpdate(userId, orderId, payload) {
  const user = await getUser(userId);
  if (!(await mustRole(user, 'deliveries'))) return { ok: false, error: 'Access denied' };
  const p = payload || {};
  await pool.query(
    `update delivery_orders set vehicle_id=$1, driver_name=$2, delivery_date=$3, route=$4, notes=$5
     where id=$6`,
    [p.vehicle_id || null, p.driver_name, p.delivery_date || null, p.route || null, p.notes || null, orderId]
  );
  logAudit(user, `Updated delivery order #${orderId}`, 'ti-edit', { orderId });
  return { ok: true };
}

async function deliveryOrdersDelete(userId, orderId) {
  const user = await getUser(userId);
  if (!(await mustRole(user, 'deliveries'))) return { ok: false, error: 'Access denied' };
  const { rows } = await pool.query('select order_number from delivery_orders where id=$1', [orderId]);
  if (!rows.length) return { ok: false, error: 'Delivery order not found' };
  await pool.query('delete from dispatch_requests where delivery_order_id=$1', [orderId]);
  await pool.query('delete from delivery_orders where id=$1', [orderId]);
  logAudit(user, `Deleted delivery order ${rows[0].order_number}`, 'ti-trash', { orderId });
  return { ok: true };
}

async function dispatchDelete(userId, requestId) {
  const user = await getUser(userId);
  if (!(await mustRole(user, 'dispatch'))) return { ok: false, error: 'Access denied' };
  await pool.query('delete from dispatch_requests where id=$1', [requestId]);
  logAudit(user, `Deleted dispatch request #${requestId}`, 'ti-trash', { requestId });
  return { ok: true };
}

async function transportJobsUpdate(userId, jobId, payload) {
  const user = await getUser(userId);
  if (!(await mustRole(user, 'transport'))) return { ok: false, error: 'Access denied' };
  const p = payload || {};
  await pool.query(
    `update transport_jobs
     set transport_company_id=$1, sales_order_id=$2, job_type=$3,
         origin=$4, destination=$5, job_date=$6, quantity=$7,
         uom=$8, cost=$9, waybill_ref=$10, notes=$11
     where id=$12`,
    [p.transport_company_id, p.sales_order_id || null, p.job_type || 'Delivery',
     p.origin || null, p.destination || null, p.job_date,
     p.quantity ? Number(p.quantity) : null, p.uom || null,
     p.cost ? Number(p.cost) : null, p.waybill_ref || null, p.notes || null, jobId]
  );
  logAudit(user, `Updated transport job #${jobId}`, 'ti-edit', { jobId });
  return { ok: true };
}

async function transportJobsDelete(userId, jobId) {
  const user = await getUser(userId);
  if (!(await mustRole(user, 'transport'))) return { ok: false, error: 'Access denied' };
  await pool.query('delete from transport_jobs where id=$1', [jobId]);
  logAudit(user, `Deleted transport job #${jobId}`, 'ti-trash', { jobId });
  return { ok: true };
}

async function fuelLogsDelete(userId, logId) {
  const user = await getUser(userId);
  if (!(await mustRole(user, 'vehicles'))) return { ok: false, error: 'Access denied' };
  await pool.query('delete from fuel_logs where id=$1', [logId]);
  logAudit(user, `Deleted fuel log #${logId}`, 'ti-trash', { logId });
  return { ok: true };
}

async function maintenanceDelete(userId, recordId) {
  const user = await getUser(userId);
  if (!(await mustRole(user, 'vehicles'))) return { ok: false, error: 'Access denied' };
  await pool.query('delete from maintenance_records where id=$1', [recordId]);
  logAudit(user, `Deleted maintenance record #${recordId}`, 'ti-trash', { recordId });
  return { ok: true };
}

async function stockMovementsDelete(userId, movementId) {
  const user = await getUser(userId);
  if (!(await mustRole(user, 'stock-movements'))) return { ok: false, error: 'Access denied' };
  const { rows } = await pool.query(
    'select item_id, warehouse_id, to_warehouse_id, movement_type, quantity from stock_movements where id=$1',
    [movementId]
  );
  if (!rows.length) return { ok: false, error: 'Movement not found' };
  const { item_id, warehouse_id, to_warehouse_id, movement_type, quantity } = rows[0];
  // Reverse the stock level effect
  if (warehouse_id) {
    if (['in', 'return'].includes(movement_type)) {
      await pool.query(
        `update stock_levels set quantity=greatest(0,quantity-$1), updated_at=now()
         where item_id=$2 and warehouse_id=$3`,
        [quantity, item_id, warehouse_id]
      );
    } else if (movement_type === 'out') {
      await pool.query(
        `update stock_levels set quantity=quantity+$1, updated_at=now()
         where item_id=$2 and warehouse_id=$3`,
        [quantity, item_id, warehouse_id]
      );
    } else if (movement_type === 'transfer' && to_warehouse_id) {
      await pool.query(
        `update stock_levels set quantity=quantity+$1, updated_at=now() where item_id=$2 and warehouse_id=$3`,
        [quantity, item_id, warehouse_id]
      );
      await pool.query(
        `update stock_levels set quantity=greatest(0,quantity-$1), updated_at=now() where item_id=$2 and warehouse_id=$3`,
        [quantity, item_id, to_warehouse_id]
      );
    }
  }
  await pool.query('delete from stock_movements where id=$1', [movementId]);
  logAudit(user, `Deleted stock movement #${movementId} (${movement_type})`, 'ti-trash', { movementId });
  return { ok: true };
}

async function warehousesDelete(userId, warehouseId) {
  const user = await getUser(userId);
  if (!(await mustRole(user, 'warehouses'))) return { ok: false, error: 'Access denied' };
  const { rows } = await pool.query('select name from warehouses where id=$1', [warehouseId]);
  if (!rows.length) return { ok: false, error: 'Warehouse not found' };
  await pool.query('delete from stock_levels where warehouse_id=$1', [warehouseId]);
  await pool.query('delete from warehouses where id=$1', [warehouseId]);
  logAudit(user, `Deleted warehouse: ${rows[0].name}`, 'ti-trash', { warehouseId });
  return { ok: true };
}

async function stockItemsDelete(userId, itemId) {
  const user = await getUser(userId);
  if (!(await mustRole(user, 'stock-items'))) return { ok: false, error: 'Access denied' };
  const { rows } = await pool.query('select name from stock_catalog where id=$1', [itemId]);
  if (!rows.length) return { ok: false, error: 'Item not found' };
  await pool.query('delete from stock_levels where item_id=$1', [itemId]);
  await pool.query('delete from stock_movements where item_id=$1', [itemId]);
  await pool.query('delete from stock_catalog where id=$1', [itemId]);
  logAudit(user, `Deleted stock item: ${rows[0].name}`, 'ti-trash', { itemId });
  return { ok: true };
}

async function vehiclesDelete(userId, vehicleId) {
  const user = await getUser(userId);
  if (!(await mustRole(user, 'vehicles'))) return { ok: false, error: 'Access denied' };
  const { rows } = await pool.query('select registration from vehicles where id=$1', [vehicleId]);
  if (!rows.length) return { ok: false, error: 'Vehicle not found' };
  await pool.query('delete from fuel_logs where vehicle_id=$1', [vehicleId]);
  await pool.query('delete from maintenance_records where vehicle_id=$1', [vehicleId]);
  await pool.query('update delivery_orders set vehicle_id=null where vehicle_id=$1', [vehicleId]);
  await pool.query('delete from vehicles where id=$1', [vehicleId]);
  logAudit(user, `Deleted vehicle: ${rows[0].registration}`, 'ti-trash', { vehicleId });
  return { ok: true };
}

async function transportCompaniesDelete(userId, companyId) {
  const user = await getUser(userId);
  if (!(await mustRole(user, 'transport'))) return { ok: false, error: 'Access denied' };
  const { rows } = await pool.query('select name from transport_companies where id=$1', [companyId]);
  if (!rows.length) return { ok: false, error: 'Company not found' };
  const { rows: jobRows } = await pool.query('select count(*)::int as n from transport_jobs where transport_company_id=$1', [companyId]);
  if (jobRows[0].n > 0) return { ok: false, error: `Cannot delete — ${jobRows[0].n} job(s) recorded for this company. Deactivate it instead.` };
  await pool.query('delete from transport_companies where id=$1', [companyId]);
  logAudit(user, `Deleted transport company: ${rows[0].name}`, 'ti-trash', { companyId });
  return { ok: true };
}

// ── Third-Party Transport ─────────────────────────────────────────────────────

async function transportCompaniesForDropdown(userId) {
  const user = await getUser(userId);
  if (!user) return { ok: false, error: 'Not authenticated' };
  const { rows } = await pool.query(
    `select id, name from transport_companies where active=true order by name`
  );
  return { ok: true, rows };
}

async function transportCompaniesList(userId) {
  const user = await getUser(userId);
  if (!(await mustRole(user, 'transport'))) return { ok: false, error: 'Access denied' };
  const { rows } = await pool.query(
    `select id, name, contact_person, phone, email, rate_per_km, notes, active,
            (select count(*)::int from transport_jobs tj where tj.transport_company_id=tc.id) as job_count,
            (select coalesce(sum(tj.cost),0)::numeric from transport_jobs tj where tj.transport_company_id=tc.id) as total_cost
     from transport_companies tc
     order by name`
  );
  return { ok: true, rows };
}

async function transportCompaniesCreate(userId, payload) {
  const user = await getUser(userId);
  if (!(await mustRole(user, 'transport'))) return { ok: false, error: 'Access denied' };
  const p = payload || {};
  if (!p.name) return { ok: false, error: 'Company name is required' };
  const { rows } = await pool.query(
    `insert into transport_companies(name, contact_person, phone, email, rate_per_km, notes, active)
     values ($1,$2,$3,$4,$5,$6,true) returning id`,
    [p.name, p.contact_person || null, p.phone || null, p.email || null,
     p.rate_per_km ? Number(p.rate_per_km) : null, p.notes || null]
  );
  logAudit(user, `Added transport company: ${p.name}`, 'ti-building', { id: rows[0].id });
  return { ok: true };
}

async function transportCompaniesUpdate(userId, companyId, payload) {
  const user = await getUser(userId);
  if (!(await mustRole(user, 'transport'))) return { ok: false, error: 'Access denied' };
  const p = payload || {};
  await pool.query(
    `update transport_companies
     set name=$1, contact_person=$2, phone=$3, email=$4, rate_per_km=$5, notes=$6, active=$7
     where id=$8`,
    [p.name, p.contact_person || null, p.phone || null, p.email || null,
     p.rate_per_km ? Number(p.rate_per_km) : null, p.notes || null, p.active !== false, companyId]
  );
  logAudit(user, `Updated transport company #${companyId}`, 'ti-building', { id: companyId });
  return { ok: true };
}

async function transportJobsList(userId) {
  const user = await getUser(userId);
  if (!(await mustRole(user, 'transport'))) return { ok: false, error: 'Access denied' };
  const { rows } = await pool.query(
    `select tj.id, tj.job_number, tj.job_type, tj.origin, tj.destination,
            tj.quantity, tj.uom, tj.cost, tj.waybill_ref, tj.status, tj.notes,
            to_char(tj.job_date,'DD/MM/YYYY') as job_date,
            to_char(tj.created_at,'DD/MM/YYYY') as created_at,
            tc.name as company_name, tc.phone as company_phone,
            so.order_number as sales_order_number, so.customer_name,
            do2.order_number as delivery_order_number,
            u.name as created_by
     from transport_jobs tj
     join transport_companies tc on tc.id=tj.transport_company_id
     left join sales_orders so on so.id=tj.sales_order_id
     left join delivery_orders do2 on do2.id=tj.delivery_order_id
     left join app_users u on u.id=tj.created_by
     order by tj.created_at desc
     limit 100`
  );
  const { rows: companies } = await pool.query(
    `select id, name, phone from transport_companies where active=true order by name`
  );
  const { rows: salesOrders } = await pool.query(
    `select id, order_number, customer_name, product_type, product_size, quantity
     from sales_orders
     where status in ('Confirmed','Pending')
     order by created_at desc limit 50`
  );
  return { ok: true, rows, companies, salesOrders };
}

async function transportJobsCreate(userId, payload) {
  const user = await getUser(userId);
  if (!(await mustRole(user, 'transport'))) return { ok: false, error: 'Access denied' };
  const p = payload || {};
  if (!p.transport_company_id || !p.job_date)
    return { ok: false, error: 'Transport company and job date are required' };
  const ts = Date.now().toString(36).toUpperCase();
  const jobNum = `TRN-${ts}`;
  await pool.query(
    `insert into transport_jobs(job_number, transport_company_id, sales_order_id, delivery_order_id,
      job_type, origin, destination, job_date, quantity, uom, cost, waybill_ref, status, notes, created_by)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'Scheduled',$13,$14)`,
    [jobNum, p.transport_company_id, p.sales_order_id || null, p.delivery_order_id || null,
     p.job_type || 'Delivery', p.origin || null, p.destination || null, p.job_date,
     p.quantity ? Number(p.quantity) : null, p.uom || null,
     p.cost ? Number(p.cost) : null, p.waybill_ref || null, p.notes || null, user.id]
  );
  logAudit(user, `Created transport job ${jobNum}`, 'ti-truck', {
    company_id: p.transport_company_id, sales_order_id: p.sales_order_id
  });
  return { ok: true, jobNum };
}

async function transportJobsUpdateStatus(userId, jobId, status) {
  const user = await getUser(userId);
  if (!(await mustRole(user, 'transport'))) return { ok: false, error: 'Access denied' };
  const valid = ['Scheduled', 'In Transit', 'Completed', 'Cancelled'];
  if (!valid.includes(status)) return { ok: false, error: 'Invalid status' };
  await pool.query('update transport_jobs set status=$1 where id=$2', [status, jobId]);
  logAudit(user, `Transport job #${jobId} → ${status}`, 'ti-truck', { jobId, status });
  return { ok: true };
}

// ── Compartments ─────────────────────────────────────────────────────────────

async function compartmentsList(userId) {
  const user = await getUser(userId);
  if (!(await mustRole(user, 'compartments')) && !['admin','ceo','operations','supervisor'].includes(user.role))
    return { ok: false, error: 'Access denied' };
  const { rows } = await pool.query(
    `select c.id, c.compt_name, c.sub_name, c.species, c.area_ha, c.volume_m3, c.status,
            to_char(c.entry_date,'DD/MM/YYYY') as entry_date,
            to_char(c.created_at,'DD/MM/YYYY') as created_at,
            u.name as created_by_name,
            coalesce(sum(hl.quantity),0)::int as trees_harvested,
            coalesce(sum(hl.logs_crosscut),0)::int as logs_harvested,
            round(coalesce(sum(hl.logs_crosscut::numeric / 3.4),0)::numeric, 2) as volume_harvested_m3
     from compartments c
     left join app_users u on u.id=c.created_by
     left join harvest_logs hl on hl.compt_id=c.id
     group by c.id, c.compt_name, c.sub_name, c.species, c.area_ha, c.volume_m3, c.status,
              c.entry_date, c.created_at, u.name
     order by c.compt_name`
  );
  return { ok: true, rows };
}

async function compartmentsCreate(userId, payload) {
  const user = await getUser(userId);
  if (!['admin','ceo','operations','supervisor'].includes(user.role))
    return { ok: false, error: 'Access denied' };
  const p = payload || {};
  if (!p.compt_name?.trim()) return { ok: false, error: 'Compartment name is required' };
  if (!p.species?.trim()) return { ok: false, error: 'Species is required' };
  if (!p.area_ha || Number(p.area_ha) <= 0) return { ok: false, error: 'Area (ha) must be greater than 0' };
  if (!p.entry_date) return { ok: false, error: 'Date is required' };
  const volume_m3 = Math.round(Number(p.area_ha) * 219 * 100) / 100;
  const { rows } = await pool.query(
    `insert into compartments(compt_name, sub_name, species, area_ha, volume_m3, entry_date, status, created_by)
     values ($1,$2,$3,$4,$5,$6,'Active',$7)
     returning id`,
    [p.compt_name.trim(), p.sub_name?.trim() || null, p.species.trim(),
     Number(p.area_ha), volume_m3, p.entry_date, user.id]
  );
  logAudit(user, `Created compartment: ${p.compt_name}`, 'ti-map-pin', { compt_name: p.compt_name, area_ha: p.area_ha });
  return { ok: true, id: rows[0].id };
}

async function compartmentsUpdate(userId, comptId, payload) {
  const user = await getUser(userId);
  if (!['admin','ceo','operations'].includes(user.role))
    return { ok: false, error: 'Access denied' };
  const p = payload || {};
  if (!p.compt_name?.trim()) return { ok: false, error: 'Compartment name is required' };
  const volume_m3 = p.area_ha ? Math.round(Number(p.area_ha) * 219 * 100) / 100 : undefined;
  await pool.query(
    `update compartments set compt_name=$1, sub_name=$2, species=$3, area_ha=$4, volume_m3=$5,
     entry_date=$6, status=$7 where id=$8`,
    [p.compt_name.trim(), p.sub_name?.trim() || null, p.species, Number(p.area_ha),
     volume_m3, p.entry_date, p.status || 'Active', comptId]
  );
  logAudit(user, `Updated compartment #${comptId}`, 'ti-edit', { comptId });
  return { ok: true };
}

async function compartmentsDelete(userId, comptId) {
  const user = await getUser(userId);
  if (!['admin','ceo','operations'].includes(user.role))
    return { ok: false, error: 'Access denied' };
  const { rows } = await pool.query('select compt_name from compartments where id=$1', [comptId]);
  if (!rows.length) return { ok: false, error: 'Compartment not found' };
  await pool.query('delete from compartments where id=$1', [comptId]);
  logAudit(user, `Deleted compartment: ${rows[0].compt_name}`, 'ti-trash', { comptId });
  return { ok: true };
}

async function compartmentsForDropdown(userId) {
  const user = await getUser(userId);
  const { rows } = await pool.query(
    `select c.id, c.compt_name, c.sub_name, c.species, c.area_ha, c.volume_m3, c.status,
            round(coalesce(sum(hl.logs_crosscut::numeric / 3.4),0)::numeric, 2) as volume_harvested_m3
     from compartments c
     left join harvest_logs hl on hl.compt_id=c.id
     group by c.id, c.compt_name, c.sub_name, c.species, c.area_ha, c.volume_m3, c.status
     order by c.compt_name`
  );
  return { ok: true, rows };
}

// ── Log Transport ─────────────────────────────────────────────────────────────

async function logTransportList(userId) {
  const user = await getUser(userId);
  if (!(await mustRole(user, 'log-transport')) && !['admin','ceo','operations','logistics','supervisor'].includes(user.role))
    return { ok: false, error: 'Access denied' };
  const [{ rows }, { rows: totals }] = await Promise.all([
    pool.query(
      `select lt.id, lt.transport_date, lt.qty_transported, lt.unit, lt.notes, lt.sub_name,
              lt.tractor_plate, lt.loggers_number,
              to_char(lt.transport_date,'DD/MM/YYYY') as date_fmt,
              to_char(lt.created_at,'DD/MM/YYYY') as created_at,
              c.compt_name, c.species, c.volume_m3 as compt_volume_m3,
              u.name as logged_by_name
       from log_transport lt
       left join compartments c on c.id=lt.compt_id
       left join app_users u on u.id=lt.logged_by
       order by lt.transport_date desc
       limit 200`
    ),
    pool.query(
      `select
         coalesce(sum(hl.logs_handrolled),0)::int                              as total_logs_harvested,
         coalesce((select sum(qty_transported) from log_transport),0)::int     as total_logs_transported,
         round(coalesce(sum(hl.logs_handrolled::numeric / 3.4),0)::numeric, 2) as total_volume_m3
       from harvest_logs hl`
    )
  ]);
  const t = totals[0] || {};
  return {
    ok: true,
    rows,
    totals: {
      totalLogsHarvested:  Number(t.total_logs_harvested  || 0),
      totalLogsTransported: Number(t.total_logs_transported || 0),
      remainingLogs: Number(t.total_logs_harvested || 0) - Number(t.total_logs_transported || 0),
      totalVolumeM3: Number(t.total_volume_m3 || 0)
    }
  };
}

async function logTransportCreate(userId, payload) {
  const user = await getUser(userId);
  if (!(await mustRole(user, 'log-transport')) && !['admin','ceo','operations','logistics','supervisor'].includes(user.role))
    return { ok: false, error: 'Access denied' };
  const p = payload || {};
  if (!p.transport_date) return { ok: false, error: 'Date is required' };
  if (!p.qty_transported || Number(p.qty_transported) <= 0) return { ok: false, error: 'Quantity must be greater than 0' };
  await pool.query(
    `insert into log_transport(transport_date, compt_id, sub_name, qty_transported, unit, notes, logged_by, tractor_plate, loggers_number)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [p.transport_date, p.compt_id ? Number(p.compt_id) : null, p.sub_name || null,
     Number(p.qty_transported), p.unit || 'logs', p.notes || null, user.id,
     p.tractor_plate?.trim() || null, p.loggers_number?.trim() || null]
  );
  logAudit(user, `Log transport entry: ${p.qty_transported} logs`, 'ti-truck', { ...p });
  return { ok: true };
}

async function logTransportDelete(userId, id) {
  const user = await getUser(userId);
  if (!['admin','ceo','operations'].includes(user.role))
    return { ok: false, error: 'Access denied' };
  await pool.query('delete from log_transport where id=$1', [id]);
  logAudit(user, `Deleted log transport #${id}`, 'ti-trash', { id });
  return { ok: true };
}

// ── Value-Added Timber ───────────────────────────────────────────────────────

async function valueAddedTimberList(userId) {
  const user = await getUser(userId);
  if (!(await mustRole(user, 'value-added-timber')) && !['admin','ceo','operations','supervisor'].includes(user.role))
    return { ok: false, error: 'Access denied' };
  const { rows } = await pool.query(
    `select vt.id, vt.type_value_added, vt.product_size, vt.num_timber,
            to_char(vt.entry_date,'DD/MM/YYYY') as date_fmt,
            to_char(vt.created_at,'DD/MM/YYYY') as created_at,
            u.name as created_by_name
     from value_added_timber vt
     left join app_users u on u.id=vt.created_by
     order by vt.entry_date desc
     limit 200`
  );
  return { ok: true, rows };
}

async function valueAddedTimberCreate(userId, payload) {
  const user = await getUser(userId);
  if (!(await mustRole(user, 'value-added-timber')) && !['admin','ceo','operations','supervisor'].includes(user.role))
    return { ok: false, error: 'Access denied' };
  const p = payload || {};
  if (!p.entry_date) return { ok: false, error: 'Date is required' };
  if (!p.type_value_added) return { ok: false, error: 'Value-added type is required' };
  if (!p.product_size) return { ok: false, error: 'Product size is required' };
  if (!p.num_timber || Number(p.num_timber) <= 0) return { ok: false, error: 'Number of timber must be greater than 0' };
  await pool.query(
    `insert into value_added_timber(entry_date, type_value_added, product_size, num_timber, created_by)
     values ($1,$2,$3,$4,$5)`,
    [p.entry_date, p.type_value_added, p.product_size, Number(p.num_timber), user.id]
  );
  logAudit(user, `Value-added timber: ${p.num_timber} × ${p.product_size} (${p.type_value_added})`, 'ti-trees', { ...p });
  return { ok: true };
}

async function valueAddedTimberDelete(userId, id) {
  const user = await getUser(userId);
  if (!['admin','ceo','operations'].includes(user.role))
    return { ok: false, error: 'Access denied' };
  await pool.query('delete from value_added_timber where id=$1', [id]);
  logAudit(user, `Deleted value-added timber #${id}`, 'ti-trash', { id });
  return { ok: true };
}

// ── Machine Fuel / Consumption Logs ──────────────────────────────────────────

async function machineFuelLogsList(userId) {
  const user = await getUser(userId);
  if (!(await mustRole(user, 'machine-fuel')) && !['admin','ceo','operations','logistics','supervisor'].includes(user.role))
    return { ok: false, error: 'Access denied' };
  const { rows } = await pool.query(
    `select mfl.id, mfl.log_date, mfl.operator, mfl.fuel_type, mfl.quantity, mfl.unit, mfl.notes,
            to_char(mfl.log_date,'DD/MM/YYYY') as date_fmt,
            m.name as machine_name, m.plate_number,
            u.name as logged_by_name
     from machine_fuel_logs mfl
     left join machines m on m.id=mfl.machine_id
     left join app_users u on u.id=mfl.logged_by
     order by mfl.log_date desc, mfl.id desc
     limit 200`
  );
  return { ok: true, rows };
}

async function machineFuelLogsCreate(userId, payload) {
  const user = await getUser(userId);
  if (!(await mustRole(user, 'machine-fuel')) && !['admin','ceo','operations','logistics','supervisor'].includes(user.role))
    return { ok: false, error: 'Access denied' };
  const p = payload || {};
  if (!p.log_date) return { ok: false, error: 'Date is required' };
  if (!p.machine_id) return { ok: false, error: 'Machine is required' };
  if (!p.fuel_type) return { ok: false, error: 'Fuel type is required' };
  if (!p.quantity || Number(p.quantity) < 0) return { ok: false, error: 'Quantity is required' };
  await pool.query(
    `insert into machine_fuel_logs(log_date, machine_id, operator, fuel_type, quantity, unit, notes, logged_by)
     values ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [p.log_date, Number(p.machine_id), p.operator?.trim() || null,
     p.fuel_type, Number(p.quantity), p.unit || 'liters', p.notes?.trim() || null, user.id]
  );
  logAudit(user, `Machine fuel log: ${p.fuel_type} ${p.quantity}L — machine #${p.machine_id}`, 'ti-droplet', { ...p });
  return { ok: true };
}

async function machineFuelLogsDelete(userId, id) {
  const user = await getUser(userId);
  if (!['admin','ceo','operations','logistics'].includes(user.role))
    return { ok: false, error: 'Access denied' };
  await pool.query('delete from machine_fuel_logs where id=$1', [id]);
  logAudit(user, `Deleted machine fuel log #${id}`, 'ti-trash', { id });
  return { ok: true };
}

// ── Casual Labour Requests ────────────────────────────────────────────────────

async function casualLabourRequestsList(userId) {
  const user = await getUser(userId);
  if (!(await mustRole(user, 'casual-requests')) && !['admin','ceo','operations','supervisor'].includes(user.role))
    return { ok: false, error: 'Access denied' };
  const { rows } = await pool.query(
    `select clr.id, clr.start_date, clr.end_date, clr.task, clr.num_casuals,
            clr.description, clr.comments, clr.status,
            to_char(clr.start_date,'DD/MM/YYYY') as start_fmt,
            to_char(clr.end_date,'DD/MM/YYYY') as end_fmt,
            to_char(clr.created_at,'DD/MM/YYYY') as created_fmt,
            u.name as created_by_name, rv.name as reviewed_by_name
     from casual_labour_requests clr
     left join app_users u on u.id=clr.created_by
     left join app_users rv on rv.id=clr.reviewed_by
     order by clr.start_date desc
     limit 200`
  );
  return { ok: true, rows };
}

async function casualLabourRequestsCreate(userId, payload) {
  const user = await getUser(userId);
  if (!(await mustRole(user, 'casual-requests')) && !['admin','ceo','operations','supervisor'].includes(user.role))
    return { ok: false, error: 'Access denied' };
  const p = payload || {};
  if (!p.start_date) return { ok: false, error: 'Start date is required' };
  if (!p.end_date) return { ok: false, error: 'End date is required' };
  if (!p.task?.trim()) return { ok: false, error: 'Task is required' };
  if (!p.num_casuals || Number(p.num_casuals) <= 0) return { ok: false, error: 'Number of casuals must be > 0' };
  await pool.query(
    `insert into casual_labour_requests(start_date, end_date, task, num_casuals, description, comments, created_by)
     values ($1,$2,$3,$4,$5,$6,$7)`,
    [p.start_date, p.end_date, p.task.trim(), Number(p.num_casuals),
     p.description?.trim() || null, p.comments?.trim() || null, user.id]
  );
  logAudit(user, `Casual request: ${p.num_casuals} casuals for "${p.task}"`, 'ti-users', { ...p });
  return { ok: true };
}

async function casualLabourRequestsReview(userId, requestId, status) {
  const user = await getUser(userId);
  if (!['admin','ceo','operations'].includes(user.role)) return { ok: false, error: 'Access denied' };
  const valid = ['Approved', 'Rejected'];
  if (!valid.includes(status)) return { ok: false, error: 'Invalid status' };
  await pool.query(
    `update casual_labour_requests set status=$1, reviewed_by=$2, reviewed_at=now() where id=$3`,
    [status, user.id, requestId]
  );
  logAudit(user, `Casual request #${requestId} ${status}`, 'ti-users', { requestId, status });
  return { ok: true };
}

async function casualLabourRequestsDelete(userId, id) {
  const user = await getUser(userId);
  if (!['admin','ceo','operations'].includes(user.role)) return { ok: false, error: 'Access denied' };
  await pool.query('delete from casual_labour_requests where id=$1', [id]);
  logAudit(user, `Deleted casual request #${id}`, 'ti-trash', { id });
  return { ok: true };
}

// ── Casuals ───────────────────────────────────────────────────────────────────

async function casualsList(userId) {
  const user = await getUser(userId);
  if (!(await mustRole(user, 'casuals')) && !['admin','ceo','operations','supervisor'].includes(user.role))
    return { ok: false, error: 'Access denied' };
  const { rows } = await pool.query(
    `select c.id, c.full_name, c.national_id, c.phone, c.gender, c.date_of_birth,
            c.address, c.department, c.work_location, c.job_role, c.supervisor,
            c.start_date, c.end_date, c.emergency_name, c.emergency_relationship,
            c.emergency_phone, c.salary_per_action, c.active,
            to_char(c.start_date,'DD/MM/YYYY') as start_fmt,
            to_char(c.end_date,'DD/MM/YYYY') as end_fmt,
            to_char(c.created_at,'DD/MM/YYYY') as created_fmt
     from casuals c
     order by c.full_name`
  );
  return { ok: true, rows };
}

async function casualsCreate(userId, payload) {
  const user = await getUser(userId);
  if (!(await mustRole(user, 'casuals')) && !['admin','ceo','operations','supervisor'].includes(user.role))
    return { ok: false, error: 'Access denied' };
  const p = payload || {};
  if (!p.full_name?.trim()) return { ok: false, error: 'Full name is required' };
  const { rows } = await pool.query(
    `insert into casuals(full_name, national_id, phone, gender, date_of_birth, address,
       department, work_location, job_role, supervisor, start_date, end_date,
       emergency_name, emergency_relationship, emergency_phone, salary_per_action, created_by)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
     returning id`,
    [p.full_name.trim(), p.national_id?.trim() || null, p.phone?.trim() || null,
     p.gender?.trim() || null, p.date_of_birth || null, p.address?.trim() || null,
     p.department?.trim() || null, p.work_location?.trim() || null,
     p.job_role?.trim() || null, p.supervisor?.trim() || null,
     p.start_date || null, p.end_date || null,
     p.emergency_name?.trim() || null, p.emergency_relationship?.trim() || null,
     p.emergency_phone?.trim() || null,
     p.salary_per_action ? Number(p.salary_per_action) : null, user.id]
  );
  logAudit(user, `Casual registered: ${p.full_name}`, 'ti-user-plus', { id: rows[0].id, name: p.full_name });
  return { ok: true, id: rows[0].id };
}

async function casualsUpdate(userId, casualId, payload) {
  const user = await getUser(userId);
  if (!['admin','ceo','operations'].includes(user.role)) return { ok: false, error: 'Access denied' };
  const p = payload || {};
  if (!p.full_name?.trim()) return { ok: false, error: 'Full name is required' };
  await pool.query(
    `update casuals set full_name=$1, national_id=$2, phone=$3, gender=$4, date_of_birth=$5,
       address=$6, department=$7, work_location=$8, job_role=$9, supervisor=$10,
       start_date=$11, end_date=$12, emergency_name=$13, emergency_relationship=$14,
       emergency_phone=$15, salary_per_action=$16, active=$17
     where id=$18`,
    [p.full_name.trim(), p.national_id?.trim() || null, p.phone?.trim() || null,
     p.gender?.trim() || null, p.date_of_birth || null, p.address?.trim() || null,
     p.department?.trim() || null, p.work_location?.trim() || null,
     p.job_role?.trim() || null, p.supervisor?.trim() || null,
     p.start_date || null, p.end_date || null,
     p.emergency_name?.trim() || null, p.emergency_relationship?.trim() || null,
     p.emergency_phone?.trim() || null,
     p.salary_per_action ? Number(p.salary_per_action) : null,
     p.active !== false, casualId]
  );
  logAudit(user, `Updated casual #${casualId}`, 'ti-edit', { casualId });
  return { ok: true };
}

async function casualsDelete(userId, casualId) {
  const user = await getUser(userId);
  if (!['admin','ceo','operations'].includes(user.role)) return { ok: false, error: 'Access denied' };
  const { rows } = await pool.query('select full_name from casuals where id=$1', [casualId]);
  if (!rows.length) return { ok: false, error: 'Casual not found' };
  await pool.query('delete from casuals where id=$1', [casualId]);
  logAudit(user, `Deleted casual: ${rows[0].full_name}`, 'ti-trash', { casualId });
  return { ok: true };
}

async function logisticsDashboard(userId) {
  const user = await getUser(userId);
  const restricted = isWorkshopRestricted(user);

  // Per-workshop stock summary
  const { rows: workshops } = await pool.query(
    `select w.id, w.name, w.location, w.active,
            count(distinct sl.item_id)::int as item_count,
            coalesce(sum(sl.quantity * coalesce(sc.unit_cost,0)),0)::numeric(14,2) as stock_value,
            coalesce(sum(sl.quantity),0)::int as total_qty
     from warehouses w
     left join stock_levels sl on sl.warehouse_id=w.id
     left join stock_catalog sc on sc.id=sl.item_id
     ${restricted ? 'where w.id=$1' : ''}
     group by w.id order by w.name`,
    restricted ? [user.workshop_id] : []
  );

  // Low stock alerts
  const { rows: lowStock } = await pool.query(
    `select sc.name, sc.category, sc.uom, sc.min_stock,
            coalesce(sum(sl.quantity),0)::int as total_stock,
            w.name as warehouse_name
     from stock_catalog sc
     left join stock_levels sl on sl.item_id=sc.id
     ${restricted ? 'and sl.warehouse_id=$1' : ''}
     left join warehouses w on w.id=sl.warehouse_id
     where sc.active=true
     group by sc.id, w.id, w.name
     having coalesce(sum(sl.quantity),0) <= sc.min_stock and sc.min_stock > 0
     order by sc.category, sc.name
     limit 20`,
    restricted ? [user.workshop_id] : []
  );

  // Recent movements (last 15)
  const { rows: recentMovements } = await pool.query(
    `select sm.id, sc.name as item_name, sc.category, sc.uom,
            w.name as workshop_name, sm.movement_type, sm.quantity,
            to_char(sm.created_at,'DD/MM/YYYY HH24:MI') as created_at,
            u.name as created_by
     from stock_movements sm
     join stock_catalog sc on sc.id=sm.item_id
     left join warehouses w on w.id=sm.warehouse_id
     left join app_users u on u.id=sm.created_by
     ${restricted ? 'where (sm.warehouse_id=$1 or sm.to_warehouse_id=$1)' : ''}
     order by sm.created_at desc limit 15`,
    restricted ? [user.workshop_id] : []
  );

  // This-month movement totals
  const month = new Date().toISOString().slice(0, 7);
  const { rows: monthTotals } = await pool.query(
    `select movement_type, count(*)::int as cnt, sum(quantity)::int as total_qty
     from stock_movements sm
     where date_trunc('month', sm.created_at) = date_trunc('month', $1::date)
     ${restricted ? 'and (sm.warehouse_id=$2 or sm.to_warehouse_id=$2)' : ''}
     group by movement_type`,
    restricted ? [month + '-01', user.workshop_id] : [month + '-01']
  );

  return { ok: true, workshops, lowStock, recentMovements, monthTotals, user_workshop_id: user.workshop_id };
}

module.exports = {
  logisticsDashboard,
  getDashboardStats,
  getBootstrap,
  dailyList,
  dailyCreate,
  salesList,
  salesCreate,
  salesUpdateStatus,
  productsList,
  productsCreate,
  productsToggle,
  productsActiveForForm,
  machinesForDropdown,
  productCatalogList,
  logisticsList,
  logisticsCreate,
  inventoryList,
  auditList,
  notificationsList,
  notificationsMarkRead,
  notificationsMarkAllRead,
  changesList,
  changesCreate,
  changesReview,
  monthlyApprove,
  monthlyDashboard,
  weeklyCostReport,
  weeklyExpensesSave,
  weeklyPerformanceReport,
  kpiBudgetsList,
  kpiBudgetSave,
  usersList,
  usersCreate,
  usersUpdate,
  usersResetPassword,
  rolesList,
  rolesUpdate,
  warehousesList,
  warehousesCreate,
  warehousesUpdate,
  stockItemsList,
  stockItemsCreate,
  stockItemsUpdate,
  stockMovementsList,
  stockMovementsCreate,
  stockTransferApprove,
  materialRequestsList,
  materialRequestsCreate,
  materialRequestsApprove,
  workshopOverview,
  vehiclesList,
  vehiclesCreate,
  vehiclesUpdate,
  fuelLogsList,
  fuelLogsCreate,
  maintenanceList,
  maintenanceCreate,
  deliveryOrdersList,
  deliveryOrdersCreate,
  deliveryOrdersUpdateStatus,
  dispatchList,
  dispatchCreate,
  dispatchReview,
  harvestList,
  harvestCreate,
  timberInventoryList,
  transportCompaniesForDropdown,
  transportCompaniesList,
  transportCompaniesCreate,
  transportCompaniesUpdate,
  transportJobsList,
  transportJobsCreate,
  transportJobsUpdateStatus,
  pendingEditsList,
  pendingEditsCreate,
  pendingEditsReview,
  dailyUpdate,
  dailyDelete,
  salesUpdate,
  salesDelete,
  logisticsUpdate,
  logisticsDelete,
  harvestUpdate,
  harvestDelete,
  deliveryOrdersUpdate,
  deliveryOrdersDelete,
  dispatchDelete,
  transportJobsUpdate,
  transportJobsDelete,
  fuelLogsDelete,
  maintenanceDelete,
  stockMovementsDelete,
  warehousesDelete,
  stockItemsDelete,
  vehiclesDelete,
  transportCompaniesDelete,
  dailyHarvestData,
  machineCategoriesList,
  machineCategoriesCreate,
  machinesList,
  machinesCreate,
  machinesUpdate,
  machineLogCategoriesList,
  machineLogCategoriesCreate,
  machineLogCategoriesDelete,
  machineLogsCreate,
  machineLogsList,
  machineLogsUpdate,
  machineLogsDelete,
  machineKpiDefinitionsList,
  machineKpiDefinitionsCreate,
  machineKpiTargetsList,
  machineKpiTargetsSave,
  machineKpiPerformance,
  machineMaintScheduleList,
  machineMaintScheduleCreate,
  machineMaintScheduleUpdate,
  compartmentsList,
  compartmentsCreate,
  compartmentsUpdate,
  compartmentsDelete,
  compartmentsForDropdown,
  logTransportList,
  logTransportCreate,
  logTransportDelete,
  valueAddedTimberList,
  valueAddedTimberCreate,
  valueAddedTimberDelete,
  machineFuelLogsList,
  machineFuelLogsCreate,
  machineFuelLogsDelete,
  casualLabourRequestsList,
  casualLabourRequestsCreate,
  casualLabourRequestsReview,
  casualLabourRequestsDelete,
  casualsList,
  casualsCreate,
  casualsUpdate,
  casualsDelete,
  getCeoOverview
};

// ── CEO Overview ──────────────────────────────────────────────────────────────

async function getCeoOverview(userId) {
  const user = await getUser(userId);
  if (!['admin', 'ceo'].includes(user.role)) return { ok: false, error: 'Access denied' };

  const month = new Date().toISOString().slice(0, 7);
  const d = new Date();
  const monthLabel = d.toLocaleString('default', { month: 'long', year: 'numeric' });

  const [prod, harvest, sales, mach, veh, cas, labour, chg] = await Promise.all([
    pool.query(`
      select coalesce(sum(timber_units),0)::int  as timber_units,
             coalesce(sum(poles_units),0)::int   as poles_units,
             coalesce(sum(downtime_hours),0)::numeric as downtime_hours,
             count(*)::int                        as entries
      from daily_logs where to_char(log_date,'YYYY-MM')=$1`, [month]),

    pool.query(`
      select coalesce(sum(quantity),0)::int       as trees,
             coalesce(sum(logs_crosscut),0)::int  as logs
      from harvest_logs where to_char(harvest_date,'YYYY-MM')=$1`, [month]),

    pool.query(`
      select count(*)::int                                      as total_orders,
             coalesce(sum(quantity*unit_price),0)::numeric      as revenue
      from sales_orders where to_char(created_at,'YYYY-MM')=$1`, [month]),

    pool.query(`
      select count(*)::int                                                 as total,
             count(*) filter (where status='Available')::int               as available,
             count(*) filter (where status='In Use')::int                  as in_use,
             count(*) filter (where status='Under Maintenance')::int       as maintenance
      from machines where active=true`),

    pool.query(`select count(*)::int as total from vehicles where active=true`),

    pool.query(`select count(*)::int as total from casuals where active=true`),

    pool.query(`select count(*)::int as pending from casual_labour_requests where status='Pending'`),

    pool.query(`select count(*)::int as pending from change_requests where status='Pending'`)
  ]);

  return {
    ok: true,
    month: monthLabel,
    production: prod.rows[0],
    harvest:    harvest.rows[0],
    sales:      sales.rows[0],
    machines:   mach.rows[0],
    vehicles:   Number(veh.rows[0].total),
    casuals:    Number(cas.rows[0].total),
    pendingLabour:  Number(labour.rows[0].pending),
    pendingChanges: Number(chg.rows[0].pending)
  };
}

// ── Machine Management ────────────────────────────────────────────────────────

async function machineCategoriesList(userId) {
  const user = await getUser(userId);
  if (!(await mustRole(user, 'machines')) && !(await mustRole(user, 'machine-logs')) && !(await mustRole(user, 'machine-kpi')))
    return { ok: false, error: 'Access denied' };
  const { rows } = await pool.query('select * from machine_categories order by name');
  return { ok: true, rows };
}

async function machineCategoriesCreate(userId, payload) {
  const user = await getUser(userId);
  if (!['admin', 'operations', 'ceo'].includes(user.role)) return { ok: false, error: 'Access denied' };
  const { name, description, icon } = payload;
  if (!name?.trim()) return { ok: false, error: 'Name is required' };
  await pool.query(
    `insert into machine_categories(name, description, icon) values ($1,$2,$3)`,
    [name.trim(), description || null, icon || 'ti-tool']
  );
  logAudit(user, `Machine category created: ${name}`, 'ti-tool', { name });
  return { ok: true };
}

async function machinesList(userId) {
  const user = await getUser(userId);
  const hasPerm = (await mustRole(user, 'machines')) || (await mustRole(user, 'machine-logs')) || (await mustRole(user, 'machine-kpi'));
  if (!hasPerm) return { ok: false, error: 'Access denied' };
  const { rows: machines } = await pool.query(`
    select m.*, mc.name as category_name, mc.icon as category_icon,
           w.name as workshop_name,
           (select next_due from machine_maintenance_schedules where machine_id=m.id order by next_due asc limit 1) as next_maintenance
    from machines m
    join machine_categories mc on mc.id = m.category_id
    left join warehouses w on w.id = m.workshop_id
    where m.active = true
    order by mc.name, m.name
  `);
  const { rows: categories } = await pool.query('select * from machine_categories order by name');
  const { rows: workshops } = await pool.query('select id, name, workshop_type from warehouses where active=true order by name');
  return { ok: true, rows: machines, categories, workshops };
}

async function machinesCreate(userId, payload) {
  const user = await getUser(userId);
  if (!(await mustRole(user, 'machines'))) return { ok: false, error: 'Access denied' };
  const { machine_code, name, category_id, status, production_capacity, capacity_unit,
          fuel_consumption_rate, fuel_type, manufacturer, model_number,
          serial_number, year_manufactured, date_acquired, notes, plate_number, workshop_id } = payload;
  if (!machine_code?.trim()) return { ok: false, error: 'Machine code is required' };
  if (!name?.trim()) return { ok: false, error: 'Name is required' };
  if (!category_id) return { ok: false, error: 'Category is required' };
  await pool.query(
    `insert into machines(machine_code, name, category_id, status, production_capacity, capacity_unit,
       fuel_consumption_rate, fuel_type, manufacturer, model_number, serial_number,
       year_manufactured, date_acquired, notes, plate_number, workshop_id, created_by)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)`,
    [machine_code.trim(), name.trim(), category_id,
     status || 'Available', production_capacity || 0, capacity_unit || 'm³',
     fuel_consumption_rate || 0, fuel_type || null,
     manufacturer || null, model_number || null, serial_number || null,
     year_manufactured || null, date_acquired || null, notes || null,
     plate_number?.trim() || null, workshop_id ? Number(workshop_id) : null, userId]
  );
  logAudit(user, `Machine registered: ${machine_code} — ${name}`, 'ti-settings-2', { machine_code, name });
  return { ok: true };
}

async function machinesUpdate(userId, machineId, payload) {
  const user = await getUser(userId);
  if (!(await mustRole(user, 'machines'))) return { ok: false, error: 'Access denied' };
  const { name, category_id, status, production_capacity, capacity_unit,
          fuel_consumption_rate, fuel_type, manufacturer, model_number,
          serial_number, year_manufactured, date_acquired, notes, plate_number, workshop_id } = payload;
  if (!name?.trim()) return { ok: false, error: 'Name is required' };
  await pool.query(
    `update machines set name=$1, category_id=$2, status=$3, production_capacity=$4, capacity_unit=$5,
       fuel_consumption_rate=$6, fuel_type=$7, manufacturer=$8, model_number=$9,
       serial_number=$10, year_manufactured=$11, date_acquired=$12, notes=$13, plate_number=$14,
       workshop_id=$15
     where id=$16`,
    [name.trim(), category_id, status || 'Available',
     production_capacity || 0, capacity_unit || 'm³',
     fuel_consumption_rate || 0, fuel_type || null,
     manufacturer || null, model_number || null, serial_number || null,
     year_manufactured || null, date_acquired || null, notes || null,
     plate_number?.trim() || null, workshop_id ? Number(workshop_id) : null, machineId]
  );
  logAudit(user, `Machine updated: #${machineId}`, 'ti-settings-2', { machineId, status });
  return { ok: true };
}

async function machineLogCategoriesList(userId) {
  const user = await getUser(userId);
  const hasPerm = (await mustRole(user, 'machine-logs')) || (await mustRole(user, 'machines'));
  if (!hasPerm) return { ok: false, error: 'Access denied' };
  const { rows } = await pool.query(`select id, name, active from machine_log_categories order by name`);
  return { ok: true, rows };
}

async function machineLogCategoriesCreate(userId, payload) {
  const user = await getUser(userId);
  if (!['admin', 'operations', 'supervisor'].includes(user.role)) return { ok: false, error: 'Access denied' };
  const name = (payload?.name || '').trim();
  if (!name) return { ok: false, error: 'Category name is required' };
  await pool.query(
    `insert into machine_log_categories(name) values($1) on conflict(name) do update set active=true`,
    [name]
  );
  logAudit(user, `Created machine log category: ${name}`, 'ti-tag', { name });
  return { ok: true };
}

async function machineLogCategoriesDelete(userId, id) {
  const user = await getUser(userId);
  if (!['admin', 'operations'].includes(user.role)) return { ok: false, error: 'Access denied' };
  await pool.query(`update machine_log_categories set active=false where id=$1`, [id]);
  return { ok: true };
}

async function machineLogsList(userId, machineId, month) {
  const user = await getUser(userId);
  const hasPerm = (await mustRole(user, 'machine-logs')) || (await mustRole(user, 'machines'));
  if (!hasPerm) return { ok: false, error: 'Access denied' };

  let whereClause = '';
  const params = [];
  if (machineId) { params.push(machineId); whereClause += ` and mdl.machine_id = $${params.length}`; }
  if (month) { params.push(month); whereClause += ` and to_char(mdl.log_date,'YYYY-MM') = $${params.length}`; }

  const { rows } = await pool.query(`
    select mdl.*, m.name as machine_name, m.machine_code, mc.name as category_name
    from machine_daily_logs mdl
    join machines m on m.id = mdl.machine_id
    join machine_categories mc on mc.id = m.category_id
    where 1=1 ${whereClause}
    order by mdl.log_date desc, m.name
  `, params);
  const { rows: machines } = await pool.query(
    `select m.id, m.name, m.machine_code, mc.name as category_name, m.production_capacity, m.capacity_unit
     from machines m join machine_categories mc on mc.id=m.category_id where m.active=true order by m.name`
  );
  const { rows: itemCategories } = await pool.query(
    `select id, name from machine_log_categories where active=true order by name`
  );
  return { ok: true, rows, machines, itemCategories };
}

async function machineLogsCreate(userId, payload) {
  const user = await getUser(userId);
  if (!(await mustRole(user, 'machine-logs')) && !(await mustRole(user, 'machines')))
    return { ok: false, error: 'Access denied' };
  const { machine_id, log_date, shift, hours_worked, downtime_hours, downtime_reason,
          fuel_consumed, daily_production, capacity_per_day, product_type, item_category,
          logs_loaded, logs_unloaded, loading_trips, remarks } = payload;
  if (!machine_id) return { ok: false, error: 'Machine is required' };
  if (!log_date) return { ok: false, error: 'Date is required' };
  await pool.query(
    `insert into machine_daily_logs(machine_id, log_date, shift, hours_worked, downtime_hours, downtime_reason,
       fuel_consumed, daily_production, capacity_per_day, product_type, item_category,
       logs_loaded, logs_unloaded, loading_trips, remarks, created_by)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`,
    [machine_id, log_date, shift || 'Full Day',
     hours_worked || 0, downtime_hours || 0, downtime_reason || null,
     fuel_consumed || 0, daily_production || 0, capacity_per_day || 0, product_type || null,
     item_category || null,
     logs_loaded || 0, logs_unloaded || 0, loading_trips || 0, remarks || null, userId]
  );
  logAudit(user, `Machine log created: machine #${machine_id} on ${log_date}`, 'ti-list-details', { machine_id, log_date });
  return { ok: true };
}

async function machineLogsUpdate(userId, logId, payload) {
  const user = await getUser(userId);
  if (!(await mustRole(user, 'machine-logs')) && !(await mustRole(user, 'machines')))
    return { ok: false, error: 'Access denied' };
  const { hours_worked, downtime_hours, downtime_reason, fuel_consumed,
          daily_production, capacity_per_day, product_type, item_category,
          logs_loaded, logs_unloaded, loading_trips, remarks } = payload;
  await pool.query(
    `update machine_daily_logs set hours_worked=$1, downtime_hours=$2, downtime_reason=$3,
       fuel_consumed=$4, daily_production=$5, capacity_per_day=$6, product_type=$7,
       item_category=$8, logs_loaded=$9, logs_unloaded=$10, loading_trips=$11, remarks=$12
     where id=$13`,
    [hours_worked || 0, downtime_hours || 0, downtime_reason || null,
     fuel_consumed || 0, daily_production || 0, capacity_per_day || 0, product_type || null,
     item_category || null,
     logs_loaded || 0, logs_unloaded || 0, loading_trips || 0, remarks || null, logId]
  );
  logAudit(user, `Machine log updated: #${logId}`, 'ti-list-details', { logId });
  return { ok: true };
}

async function machineLogsDelete(userId, logId) {
  const user = await getUser(userId);
  if (!['admin', 'operations'].includes(user.role)) return { ok: false, error: 'Access denied' };
  await pool.query('delete from machine_daily_logs where id=$1', [logId]);
  logAudit(user, `Machine log deleted: #${logId}`, 'ti-trash', { logId });
  return { ok: true };
}

async function machineKpiDefinitionsList(userId) {
  const user = await getUser(userId);
  const hasPerm = (await mustRole(user, 'machine-kpi')) || (await mustRole(user, 'machines'));
  if (!hasPerm) return { ok: false, error: 'Access denied' };
  const { rows } = await pool.query(`
    select mkd.*, mc.name as category_name
    from machine_kpi_definitions mkd
    left join machine_categories mc on mc.id = mkd.category_id
    where mkd.active = true
    order by mc.name nulls first, mkd.kpi_name
  `);
  return { ok: true, rows };
}

async function machineKpiDefinitionsCreate(userId, payload) {
  const user = await getUser(userId);
  if (!['admin', 'operations', 'ceo'].includes(user.role)) return { ok: false, error: 'Access denied' };
  const { category_id, kpi_code, kpi_name, unit, higher_is_better, weight, description } = payload;
  if (!kpi_code?.trim()) return { ok: false, error: 'KPI code is required' };
  if (!kpi_name?.trim()) return { ok: false, error: 'KPI name is required' };
  await pool.query(
    `insert into machine_kpi_definitions(category_id, kpi_code, kpi_name, unit, higher_is_better, weight, description)
     values ($1,$2,$3,$4,$5,$6,$7)`,
    [category_id || null, kpi_code.trim(), kpi_name.trim(),
     unit || '', higher_is_better !== false, weight || 1.0, description || null]
  );
  logAudit(user, `KPI definition created: ${kpi_name}`, 'ti-target', { kpi_name });
  return { ok: true };
}

async function machineKpiTargetsList(userId, machineId, month) {
  const user = await getUser(userId);
  const hasPerm = (await mustRole(user, 'machine-kpi')) || (await mustRole(user, 'machines'));
  if (!hasPerm) return { ok: false, error: 'Access denied' };
  const params = [machineId, month];
  const { rows } = await pool.query(`
    select mkt.*, mkd.kpi_name, mkd.unit, mkd.higher_is_better, mkd.kpi_code,
           au.name as set_by_name
    from machine_kpi_targets mkt
    join machine_kpi_definitions mkd on mkd.id = mkt.kpi_id
    left join app_users au on au.id = mkt.set_by
    where mkt.machine_id=$1 and mkt.effective_month=$2
    order by mkd.kpi_name
  `, params);
  const { rows: kpiDefs } = await pool.query(`
    select mkd.*, mc.name as category_name
    from machine_kpi_definitions mkd
    left join machine_categories mc on mc.id = mkd.category_id
    where mkd.active=true order by mkd.kpi_name
  `);
  return { ok: true, rows, kpiDefs };
}

async function machineKpiTargetsSave(userId, payload) {
  const user = await getUser(userId);
  if (!['admin', 'operations', 'ceo'].includes(user.role)) return { ok: false, error: 'Access denied' };
  const { machine_id, kpi_id, target_value, effective_month, reason } = payload;
  if (!machine_id || !kpi_id || !effective_month) return { ok: false, error: 'Missing required fields' };
  if (target_value === null || target_value === undefined || target_value === '')
    return { ok: false, error: 'Target value is required' };
  await pool.query(
    `insert into machine_kpi_targets(machine_id, kpi_id, target_value, effective_month, set_by, reason)
     values ($1,$2,$3,$4,$5,$6)
     on conflict (machine_id, kpi_id, effective_month)
     do update set target_value=$3, set_by=$5, reason=$6, created_at=now()`,
    [machine_id, kpi_id, target_value, effective_month, userId, reason || null]
  );
  logAudit(user, `KPI target set: machine #${machine_id}, month ${effective_month}`, 'ti-target', { machine_id, effective_month });
  return { ok: true };
}

async function machineKpiPerformance(userId, month) {
  const user = await getUser(userId);
  const hasPerm = (await mustRole(user, 'machine-kpi')) || (await mustRole(user, 'machines'));
  if (!hasPerm) return { ok: false, error: 'Access denied' };

  const targetMonth = month || new Date().toISOString().slice(0, 7);
  const [kpiYr, kpiMn] = targetMonth.split('-').map(Number);
  const kpiMonthStart = `${targetMonth}-01`;
  const kpiMonthEnd   = new Date(kpiYr, kpiMn, 0).toISOString().slice(0, 10);

  const { rows: perf } = await pool.query(`
    with logs as (
      select
        m.id                                                     as machine_id,
        m.machine_code,
        m.name                                                   as machine_name,
        mc.name                                                  as category_name,
        m.production_capacity,
        m.capacity_unit,
        m.status,
        count(mdl.id)::int                                       as days_logged,
        coalesce(sum(mdl.hours_worked),0)::numeric               as total_hours_worked,
        coalesce(sum(mdl.downtime_hours),0)::numeric             as total_downtime,
        coalesce(sum(mdl.fuel_consumed),0)::numeric              as total_fuel,
        coalesce(sum(mdl.daily_production),0)::numeric           as total_production,
        coalesce(sum(mdl.capacity_per_day),0)::numeric           as total_capacity,
        coalesce(sum(mdl.logs_loaded),0)::numeric                as total_logs_loaded,
        coalesce(sum(mdl.logs_unloaded),0)::numeric              as total_logs_unloaded,
        coalesce(sum(mdl.loading_trips),0)::int                  as total_trips,
        case when sum(mdl.hours_worked + mdl.downtime_hours) > 0
             then round(sum(mdl.hours_worked) / sum(mdl.hours_worked + mdl.downtime_hours) * 100, 1)
             else 0 end                                          as utilization_pct,
        case when sum(mdl.capacity_per_day) > 0
             then round(sum(mdl.daily_production) / sum(mdl.capacity_per_day) * 100, 1)
             else 0 end                                          as efficiency_pct
      from machines m
      join machine_categories mc on mc.id = m.category_id
      left join machine_daily_logs mdl
        on mdl.machine_id = m.id and mdl.log_date >= $1 and mdl.log_date <= $2
      where m.active = true
      group by m.id, m.machine_code, m.name, mc.name, m.production_capacity, m.capacity_unit, m.status
    )
    select * from logs order by category_name, machine_name
  `, [kpiMonthStart, kpiMonthEnd]);

  // Fetch KPI targets for this month alongside definitions
  const { rows: targets } = await pool.query(`
    select mkt.machine_id, mkt.target_value, mkd.kpi_code, mkd.kpi_name, mkd.unit, mkd.higher_is_better
    from machine_kpi_targets mkt
    join machine_kpi_definitions mkd on mkd.id = mkt.kpi_id
    where mkt.effective_month = $1
  `, [targetMonth]);

  // Attach targets to each machine row
  const targetsByMachine = {};
  for (const t of targets) {
    if (!targetsByMachine[t.machine_id]) targetsByMachine[t.machine_id] = [];
    targetsByMachine[t.machine_id].push(t);
  }

  const rows = perf.map(m => {
    const mt = targetsByMachine[m.machine_id] || [];
    const actuals = {
      utilization_hours: Number(m.total_hours_worked),
      downtime_hours: Number(m.total_downtime),
      fuel_consumed: Number(m.total_fuel),
      daily_production: Number(m.total_production),
      efficiency_pct: Number(m.efficiency_pct),
      logs_loaded: Number(m.total_logs_loaded),
      logs_unloaded: Number(m.total_logs_unloaded),
      loading_trips: Number(m.total_trips)
    };
    const kpiResults = mt.map(t => {
      const actual = actuals[t.kpi_code] ?? null;
      const target = Number(t.target_value);
      const achievement = (actual !== null && target > 0)
        ? Math.round((actual / target) * 100)
        : null;
      return { ...t, actual, achievement };
    });
    const scored = kpiResults.filter(k => k.achievement !== null);
    const avgAchievement = scored.length
      ? Math.round(scored.reduce((s, k) => s + k.achievement, 0) / scored.length)
      : null;
    return { ...m, kpiResults, avgAchievement };
  });

  return { ok: true, rows, month: targetMonth };
}

async function machineMaintScheduleList(userId, machineId) {
  const user = await getUser(userId);
  const hasPerm = (await mustRole(user, 'machines')) || (await mustRole(user, 'machine-logs'));
  if (!hasPerm) return { ok: false, error: 'Access denied' };
  const { rows } = await pool.query(
    `select mms.*, m.name as machine_name, m.machine_code
     from machine_maintenance_schedules mms
     join machines m on m.id = mms.machine_id
     where mms.machine_id=$1
     order by mms.next_due asc nulls last`,
    [machineId]
  );
  return { ok: true, rows };
}

async function machineMaintScheduleCreate(userId, payload) {
  const user = await getUser(userId);
  if (!(await mustRole(user, 'machines'))) return { ok: false, error: 'Access denied' };
  const { machine_id, maintenance_type, frequency_days, last_performed, next_due, estimated_hours, notes } = payload;
  if (!machine_id) return { ok: false, error: 'Machine is required' };
  if (!maintenance_type?.trim()) return { ok: false, error: 'Maintenance type is required' };
  await pool.query(
    `insert into machine_maintenance_schedules(machine_id, maintenance_type, frequency_days, last_performed, next_due, estimated_hours, notes)
     values ($1,$2,$3,$4,$5,$6,$7)`,
    [machine_id, maintenance_type.trim(), frequency_days || 30,
     last_performed || null, next_due || null, estimated_hours || 1, notes || null]
  );
  logAudit(user, `Maintenance schedule created for machine #${machine_id}`, 'ti-calendar', { machine_id, maintenance_type });
  return { ok: true };
}

async function machineMaintScheduleUpdate(userId, schedId, payload) {
  const user = await getUser(userId);
  if (!(await mustRole(user, 'machines'))) return { ok: false, error: 'Access denied' };
  const { maintenance_type, frequency_days, last_performed, next_due, estimated_hours, notes } = payload;
  await pool.query(
    `update machine_maintenance_schedules set maintenance_type=$1, frequency_days=$2, last_performed=$3,
       next_due=$4, estimated_hours=$5, notes=$6 where id=$7`,
    [maintenance_type, frequency_days || 30, last_performed || null,
     next_due || null, estimated_hours || 1, notes || null, schedId]
  );
  return { ok: true };
}

