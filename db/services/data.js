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

const ROLE_PAGES = {
  admin: ['dashboard', 'users', 'audit', 'export', 'notifications', 'changes'],
  ceo: [
    'dashboard',
    'weekly-cost',
    'weekly-perf',
    'monthly',
    'kpi',
    'audit',
    'export',
    'users',
    'notifications',
    'changes'
  ],
  operations: ['dashboard', 'daily', 'products', 'weekly-cost', 'weekly-perf', 'inventory', 'audit', 'export', 'notifications', 'changes'],
  sales: ['dashboard', 'sales', 'products', 'audit', 'export', 'notifications', 'changes'],
  finance: ['dashboard', 'weekly-cost', 'monthly', 'sage', 'audit', 'export', 'notifications', 'changes'],
  logistics: ['dashboard', 'logistics', 'inventory', 'audit', 'export', 'notifications', 'changes'],
  supervisor: ['dashboard', 'daily', 'audit', 'export', 'notifications', 'changes'],
  storekeeper: ['dashboard', 'inventory', 'audit', 'export', 'notifications']
};

async function getRolePages(role) {
  const { rows } = await pool.query('select permissions from role_definitions where role=$1 limit 1', [role]);
  if (!rows.length) return ROLE_PAGES[role] || [];
  const perms = Array.isArray(rows[0].permissions) ? rows[0].permissions : [];
  return perms.length ? perms : ROLE_PAGES[role] || [];
}

async function mustRole(user, pageId) {
  const allowed = Array.isArray(user.user_permissions) && user.user_permissions.length
    ? user.user_permissions
    : await getRolePages(user.role);
  return allowed.includes(pageId);
}

async function getUser(userId) {
  const { rows } = await pool.query(
    'select id, username, name, role, department, user_permissions, user_responsibilities, active from app_users where id=$1',
    [userId]
  );
  if (!rows.length) throw new Error('User not found');
  if (!rows[0].active) throw new Error('User inactive');
  return rows[0];
}

async function logAudit(user, action, icon = 'ti-check', meta = {}) {
  if (user.role === 'ceo') return;
  await pool.query(
    'insert into audit_log(user_id, role, action, icon, meta) values ($1,$2,$3,$4,$5::jsonb)',
    [user.id, user.role, action, icon, JSON.stringify(meta || {})]
  );
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
  const { rows: appr } = await pool.query('select approved from monthly_approvals where month_key=$1', ['2024-11']);
  const approved = appr[0]?.approved || false;
  const { rows: roles } = await pool.query('select role, permissions from role_definitions');
  const rolePages = roles.reduce((acc, row) => {
    const perms = Array.isArray(row.permissions) ? row.permissions : [];
    acc[row.role] = perms.length ? perms : ROLE_PAGES[row.role] || [];
    return acc;
  }, {});
  const userPages = Array.isArray(user.user_permissions) && user.user_permissions.length ? user.user_permissions : rolePages[user.role] || [];
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
  await logAudit(user, `Updated role responsibilities for ${role}`, 'ti-settings', {
    role,
    responsibilities: r.responsibilities,
    permissions: r.permissions
  });
  return { ok: true };
}

async function dailyList(userId) {
  const user = await getUser(userId);
  if (!(await mustRole(user, 'daily'))) return { ok: false, error: 'Access denied' };
  const [{ rows }, { rows: stockRows }] = await Promise.all([
    pool.query(
      `select id, to_char(log_date,'DD/MM/YYYY') as date, machine, product_size,
              timber_units, timber_kiln_dried, timber_cca_treated, timber_untreated,
              timber_waste, poles_units, poles_waste, downtime_hours, supervisor, remarks, created_at
       from daily_logs
       order by log_date desc, id desc
       limit 50`
    ),
    pool.query(STOCK_SQL)
  ]);
  return { ok: true, rows, stock: buildStock(stockRows[0] || {}) };
}

async function dailyCreate(userId, payload) {
  const user = await getUser(userId);
  if (!(await mustRole(user, 'daily'))) return { ok: false, error: 'Access denied' };
  const p = payload || {};
  if (!p.date) return { ok: false, error: 'Date is required' };
  const kilnDried   = Number(p.timber_kiln_dried  || 0);
  const ccaTreated  = Number(p.timber_cca_treated || 0);
  const untreated   = Number(p.timber_untreated   || 0);
  const timberTotal = kilnDried + ccaTreated + untreated || Number(p.timber_units || 0);
  await pool.query(
    `insert into daily_logs(log_date, supervisor, timber_units, timber_kiln_dried, timber_cca_treated, timber_untreated,
                            timber_waste, poles_units, poles_waste, downtime_hours, downtime_reason, remarks, created_by)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
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
      user.id
    ]
  );
  await logAudit(user, `Created daily log for ${p.date}`, 'ti-clipboard-list', { date: p.date, timber: timberTotal, poles: Number(p.poles_units || 0) });
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

  const month = p.month;
  for (const item of p.items) {
    const amount = Number(item.budget_amount || 0);
    await pool.query(
      `insert into kpi_budgets(category_id, month, budget_amount, set_by, created_at, updated_at)
       values ($1,$2,$3,$4,now(),now())
       on conflict (category_id, month) do update set budget_amount=$3, set_by=$4, updated_at=now()`,
      [item.id, month, amount, user.id]
    );
  }
  await logAudit(user, `Updated KPI budgets for ${month}`, 'ti-target', { month, items: p.items });
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
    pool.query(STOCK_SQL)
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
  await logAudit(user, `Created order ${p.order_number} — ${p.customer_name}: ${p.quantity} × ${label}`, 'ti-shopping-cart', { order_number: p.order_number, sub_type: p.product_sub_type });
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
  await logAudit(user, `Updated order ${rows[0].order_number} status to ${status}`, 'ti-shopping-cart', { orderId, status });
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
    `select p.id, p.type, p.sub_type, p.size, p.active, p.reason, p.ref,
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
    `insert into products(type, sub_type, size, active, reason, ref, width_mm, height_mm, length_m, diameter_mm, created_by)
     values ($1,$2,$3,true,$4,$5,$6,$7,$8,$9,$10)`,
    [
      p.type, p.sub_type || null, p.size, p.reason, p.ref || null,
      p.width_mm  ? Number(p.width_mm)  : null,
      p.height_mm ? Number(p.height_mm) : null,
      p.length_m  ? Number(p.length_m)  : null,
      p.diameter_mm ? Number(p.diameter_mm) : null,
      user.id
    ]
  );
  await logAudit(user, `Added product ${label}`, 'ti-package', { type: p.type, sub_type: p.sub_type, size: p.size });
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

  await logAudit(user, `${targetActive ? 'Reactivated' : 'Deactivated'} product ${p.size}`, 'ti-shield-lock', {
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
  await logAudit(user, `Added logistics item ${p.name}`, 'ti-truck', { name: p.name });
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
  return { ok: true, rows, unread: await unreadCount(userId) };
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
  await logAudit(user, `Submitted change request (${p.record_type})`, 'ti-send', { record_ref: p.record_ref });
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
  await logAudit(user, `${status} change request #${changeId}`, status === 'Approved' ? 'ti-check' : 'ti-x');
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
  await logAudit(user, `Approved monthly dashboard ${monthKey}`, 'ti-signature');
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
    await logAudit(user, `Updated weekly expense for category ${p.categoryId}`, 'ti-cash', {
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
    await logAudit(user, `Created weekly expense for category ${p.categoryId}`, 'ti-cash', {
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
  const { rows } = await pool.query(`select id, username, name, role, department, user_permissions, user_responsibilities, active, to_char(created_at,'DD Mon YYYY') as created from app_users order by id`);
  return { ok: true, rows };
}

async function usersCreate(userId, payload) {
  const user = await getUser(userId);
  if (!['ceo', 'operations', 'admin'].includes(user.role)) return { ok: false, error: 'Access denied' };
  const p = payload || {};
  if (!p.username || !p.name || !p.role || !p.password) return { ok: false, error: 'Missing required fields' };
  const hash = await bcrypt.hash(String(p.password), 10);
  await pool.query(
    `insert into app_users(username,name,role,department,user_permissions,user_responsibilities,password_hash,active)
     values ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [p.username, p.name, p.role, p.department || null, JSON.stringify([]), JSON.stringify([]), hash, p.active !== false]
  );
  await logAudit(user, `Created user ${p.username}`, 'ti-users', { username: p.username, role: p.role, department: p.department });
  return { ok: true };
}

async function usersUpdate(userId, targetUserId, payload) {
  const user = await getUser(userId);
  if (!['ceo', 'operations', 'admin'].includes(user.role)) return { ok: false, error: 'Access denied' };
  const p = payload || {};
  await pool.query(
    `update app_users set
       name = coalesce($1, name),
       role = coalesce($2, role),
       department = coalesce($3, department),
       user_permissions = coalesce($4, user_permissions),
       user_responsibilities = coalesce($5, user_responsibilities),
       active = coalesce($6, active)
     where id=$7`,
    [
      p.name || null,
      p.role || null,
      p.department || null,
      p.permissions !== undefined ? JSON.stringify(p.permissions) : null,
      p.responsibilities !== undefined ? JSON.stringify(p.responsibilities) : null,
      p.active !== undefined ? p.active : null,
      targetUserId
    ]
  );
  await logAudit(user, `Updated user ${targetUserId}`, 'ti-users', {
    userId: targetUserId,
    department: p.department,
    permissions: p.permissions,
    responsibilities: p.responsibilities
  });
  return { ok: true };
}

async function usersResetPassword(userId, targetUserId, newPassword) {
  const user = await getUser(userId);
  if (!['ceo', 'operations', 'admin'].includes(user.role)) return { ok: false, error: 'Access denied' };
  const hash = await bcrypt.hash(String(newPassword || 'UFCL@1234'), 10);
  await pool.query(`update app_users set password_hash=$1 where id=$2`, [hash, targetUserId]);
  await logAudit(user, `Reset password for user ${targetUserId}`, 'ti-key', { userId: targetUserId });
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
       from daily_logs where to_char(log_date,'YYYY-MM')=$1`, [month]
    ),
    pool.query(
      `select coalesce(sum(timber_units),0)::int as timber,
              coalesce(sum(poles_units),0)::int as poles
       from daily_logs where to_char(log_date,'YYYY-MM')=$1`, [lastMonth]
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
       from sales_orders where to_char(created_at,'YYYY-MM')=$1`, [month]
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
    pool.query(STOCK_SQL)
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
  const monthStart = `${month}-01`;
  const monthEnd = new Date(year, mon, 0).toISOString().slice(0, 10);

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
     where to_char(created_at,'YYYY-MM')=$1`,
    [month]
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

async function inventoryList(userId) {
  const user = await getUser(userId);
  if (!(await mustRole(user, 'inventory'))) return { ok: false, error: 'Access denied' };
  const { rows } = await pool.query(
    `select id, category, name, sku, uom, unit_cost, stock, min_stock, created_at
     from logistics_items
     order by category, name`
  );
  const lowStockCount = rows.filter((r) => Number(r.stock) <= Number(r.min_stock)).length;
  return { ok: true, rows, lowStockCount };
}

module.exports = {
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
  rolesUpdate
};

