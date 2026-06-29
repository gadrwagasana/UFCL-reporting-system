const { pool } = require('../pool');
const bcrypt = require('bcryptjs');

// All-time stock balance: total produced minus total sold, broken down by timber sub-type.
// Kiln-dried and CCA-treated volumes come from value_added_timber (not daily_logs, which
// always records all timber as untreated at the point of production).
const STOCK_SQL = `
  WITH produced AS (
    SELECT COALESCE(SUM(timber_units),0)::int AS timber,
           COALESCE(SUM(poles_units),0)::int  AS poles
    FROM daily_logs
    WHERE deleted_at IS NULL
  ),
  value_added AS (
    SELECT COALESCE(SUM(CASE WHEN type_value_added='Kiln-dried timber'  THEN num_timber ELSE 0 END),0)::int AS kiln_dried,
           COALESCE(SUM(CASE WHEN type_value_added='CCA treated timber' THEN num_timber ELSE 0 END),0)::int AS cca_treated
    FROM value_added_timber
    WHERE deleted_at IS NULL
  ),
  sold AS (
    SELECT COALESCE(SUM(CASE WHEN product_type='Timber' THEN quantity ELSE 0 END),0)::int AS timber,
           COALESCE(SUM(CASE WHEN product_type='Timber' AND COALESCE(product_sub_type,'')='Kiln-dried'  THEN quantity ELSE 0 END),0)::int AS kiln_dried,
           COALESCE(SUM(CASE WHEN product_type='Timber' AND COALESCE(product_sub_type,'')='CCA-treated' THEN quantity ELSE 0 END),0)::int AS cca_treated,
           COALESCE(SUM(CASE WHEN product_type='Timber' AND COALESCE(product_sub_type,'')='Untreated'   THEN quantity ELSE 0 END),0)::int AS untreated,
           COALESCE(SUM(CASE WHEN product_type='Poles'  THEN quantity ELSE 0 END),0)::int AS poles
    FROM sales_orders
    WHERE deleted_at IS NULL
  )
  SELECT p.timber                                                AS timber_produced,
         p.poles                                                AS poles_produced,
         va.kiln_dried                                          AS kiln_dried_produced,
         va.cca_treated                                         AS cca_treated_produced,
         GREATEST(p.timber - va.kiln_dried - va.cca_treated, 0) AS untreated_produced,
         s.timber     AS timber_sold,     s.poles     AS poles_sold,
         s.kiln_dried AS kiln_dried_sold, s.cca_treated AS cca_treated_sold, s.untreated AS untreated_sold,
         (p.timber    - s.timber)                               AS timber_stock,
         (p.poles     - s.poles)                                AS poles_stock,
         (va.kiln_dried  - s.kiln_dried)                       AS kiln_dried_stock,
         (va.cca_treated - s.cca_treated)                      AS cca_treated_stock,
         (GREATEST(p.timber - va.kiln_dried - va.cca_treated, 0) - s.untreated) AS untreated_stock
  FROM produced p, value_added va, sold s
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
  // 'daily' or legacy 'production' token expands to all 5 production sub-pages
  if (out.includes('daily') || out.includes('production')) {
    for (const t of ['daily-timber', 'daily-poles', 'daily-harvest', 'value-added-timber', 'machine-logs'])
      if (!out.includes(t)) out.push(t);
  }
  return out;
}

// Fire-and-forget refresh — stock view becomes stale for <1 s after each write
function refreshStockView() {
  pool.query('refresh materialized view concurrently mv_stock_summary').catch(() => {});
}

// Also refresh the per-workshop view (non-concurrent; no unique index needed)
function refreshStockByWorkshop() {
  pool.query('refresh materialized view mv_stock_by_workshop').catch(() => {});
}

const ROLE_PAGES = {
  admin: ['dashboard', 'users', 'audit', 'export', 'notifications', 'changes', 'secgov', 'executive', 'bi', 'automation', 'epm',
          'daily', 'daily-timber', 'daily-poles', 'daily-harvest', 'value-added-timber', 'machine-logs',
          'logistics-dashboard', 'workshop-overview', 'warehouses', 'stock-items', 'stock-movements', 'material-requests',
          'vehicles', 'deliveries', 'dispatch', 'timber-inventory', 'transport',
          'machines', 'machine-kpi', 'compartments', 'log-transport',
          'machine-fuel', 'casual-requests', 'casuals', 'customers'],
  ceo: ['dashboard', 'ceo', 'weekly-cost', 'weekly-perf', 'monthly', 'kpi', 'audit', 'export', 'users', 'notifications', 'changes', 'secgov', 'executive', 'bi', 'automation', 'epm',
        'daily-harvest', 'value-added-timber',
        'logistics-dashboard', 'workshop-overview', 'warehouses', 'stock-items', 'inventory', 'stock-movements', 'timber-inventory',
        'vehicles', 'deliveries', 'dispatch', 'transport',
        'machines', 'machine-kpi', 'compartments', 'log-transport',
        'casual-requests', 'casuals', 'customers', 'sales', 'products'],
  operations: ['dashboard', 'daily', 'daily-timber', 'daily-poles', 'daily-harvest', 'value-added-timber', 'machine-logs',
               'products', 'weekly-cost', 'weekly-perf', 'inventory', 'audit', 'export', 'notifications', 'changes', 'secgov', 'executive', 'bi', 'automation', 'epm',
               'logistics-dashboard', 'workshop-overview', 'timber-inventory', 'stock-items', 'stock-movements', 'material-requests', 'transport',
               'machines', 'machine-kpi', 'compartments', 'log-transport',
               'machine-fuel', 'casual-requests', 'casuals', 'customers', 'sales'],
  sales: ['dashboard', 'sales', 'customers', 'products', 'audit', 'export', 'notifications', 'changes', 'deliveries', 'transport'],
  finance: ['dashboard', 'weekly-cost', 'monthly', 'sage', 'audit', 'export', 'notifications', 'changes'],
  logistics: ['dashboard', 'logistics-dashboard', 'workshop-overview', 'logistics', 'inventory', 'audit', 'export', 'notifications', 'changes',
              'warehouses', 'stock-items', 'stock-movements', 'material-requests', 'vehicles', 'deliveries', 'dispatch', 'transport',
              'machines', 'log-transport', 'machine-fuel'],
  supervisor: ['dashboard', 'bi', 'daily', 'daily-timber', 'daily-poles', 'daily-harvest', 'value-added-timber', 'machine-logs',
               'audit', 'export', 'notifications', 'changes', 'timber-inventory',
               'workshop-overview', 'compartments', 'log-transport',
               'machine-fuel', 'casual-requests', 'casuals',
               'stock-movements', 'material-requests'],
  storekeeper: ['dashboard', 'bi', 'logistics-dashboard', 'workshop-overview', 'inventory', 'audit', 'export', 'notifications',
                'warehouses', 'stock-items', 'stock-movements', 'material-requests'],
  'harvesting-leader':    ['bi', 'stock-movements', 'material-requests'],
  'sawmill-leader':       ['bi', 'stock-movements', 'material-requests'],
  'vat-leader':           ['bi', 'stock-movements', 'material-requests'],
  'poles-leader':         ['bi', 'stock-movements', 'material-requests'],
  'harvesting-supervisor': ['bi', 'daily-harvest', 'log-transport'],
  'sawmill-supervisor':    ['bi', 'daily-timber'],
  'poles-supervisor':      ['daily-poles'],
  'vat-supervisor':        ['value-added-timber'],
  'storekeeper-assistant': ['bi', 'stock-movements', 'material-requests'],
};

async function getRolePages(role) {
  const { rows } = await pool.query('select permissions from role_definitions where role=$1 limit 1', [role]);
  if (!rows.length) return ROLE_PAGES[role] || [];
  const perms = Array.isArray(rows[0].permissions) ? rows[0].permissions : [];
  return perms.length ? perms : ROLE_PAGES[role] || [];
}

async function getResolvedPages(user) {
  if (Array.isArray(user.user_permissions) && user.user_permissions.length)
    return expandPages(user.user_permissions);
  if (_roleCache.has(user.role)) return _roleCache.get(user.role);
  const pages = expandPages(await getRolePages(user.role));
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
    `select u.id, u.username, u.name, u.role, u.department, u.user_permissions,
            u.user_responsibilities, u.active, u.workshop_id,
            w.name as workshop_name
     from app_users u
     left join warehouses w on w.id = u.workshop_id
     where u.id = $1`,
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
    !['admin', 'ceo', 'operations', 'logistics'].includes(user.role);
}

// Ownership check for update/delete operations.
// Privileged roles (admin, ceo, operations) can modify any record.
// All other roles can only modify records they personally created.
// Returns true  → caller may proceed directly.
// Returns false → caller must block or redirect to pending-edits/deletion-requests workflow.
// ownerCol: the column storing the creator's user id — usually 'created_by' or 'logged_by'.
async function canDirectlyModify(user, table, recordId, ownerCol = 'created_by') {
  const PRIVILEGED = ['admin', 'ceo', 'operations'];
  if (PRIVILEGED.includes(user.role)) return true;
  const { rows } = await pool.query(
    `SELECT ${ownerCol} AS owner_id FROM ${table} WHERE id = $1`, [recordId]
  );
  if (!rows.length) return false;
  const ownerId = rows[0].owner_id;
  if (ownerId == null) return false;
  return ownerId === user.id;
}

// ── Time-Based Governance Layer ───────────────────────────────────────────────
// Replaces canDirectlyModify for all user-facing update/delete operations.

const FIVE_MIN_MS    = 5  * 60 * 1_000;
const TWENTY_FOUR_MS = 24 * 60 * 60 * 1_000;
const GOVERNANCE_PRIVILEGED = ['admin', 'ceo', 'operations'];

// ── Step 3: Approval Workflow Engine — role sets & SLA thresholds ─────────────
// Roles that can APPROVE leader-level requests (site leaders + all privileged).
const LEADER_APPROVERS = [
  'supervisor', 'harvesting-leader', 'sawmill-leader', 'logistics-leader',
  'poles-leader', 'vat-leader', 'admin', 'ceo', 'operations'
];
// Roles that can APPROVE manager-level requests (senior staff only).
const MANAGER_APPROVERS = ['admin', 'ceo', 'operations', 'logistics', 'sales'];

// SLA deadlines (ms after submission)
const SLA_LEADER_REMIND_MS    =  6 * 60 * 60 * 1_000;  // 6 h  → first reminder
const SLA_LEADER_ESCALATE_MS  = 24 * 60 * 60 * 1_000;  // 24 h → escalate to manager group
const SLA_MANAGER_REMIND_MS   = 12 * 60 * 60 * 1_000;  // 12 h → first reminder
const SLA_MANAGER_ESCALATE_MS = 24 * 60 * 60 * 1_000;  // 24 h → escalate to CEO+admin

// Sentinel user for system-generated audit entries (escalation runner, etc.)
const SYSTEM_USER = { id: null, username: 'system', name: 'System', role: 'system' };

// Core decision function. Returns:
//   { action:'allow', privileged, ownedByUser }
//   { action:'require_approval', level:'leader'|'manager', reason }
//   { action:'deny', reason }
async function timeGatedAuthorization(user, table, recordId, ownerCol = 'created_by') {
  if (GOVERNANCE_PRIVILEGED.includes(user.role)) {
    const { rows } = await pool.query(
      `SELECT ${ownerCol} AS owner_id FROM ${table} WHERE id = $1`, [recordId]
    );
    if (!rows.length) return { action: 'deny', reason: 'not_found' };
    const ownedByUser = rows[0].owner_id != null &&
      String(rows[0].owner_id) === String(user.id);
    return { action: 'allow', privileged: true, ownedByUser };
  }

  const { rows } = await pool.query(
    `SELECT t.${ownerCol} AS owner_id, t.created_at, u.role AS owner_role
     FROM ${table} t
     LEFT JOIN app_users u ON u.id = t.${ownerCol}
     WHERE t.id = $1`, [recordId]
  );
  if (!rows.length) return { action: 'deny', reason: 'not_found' };

  const { owner_id, created_at, owner_role } = rows[0];
  const isOwner         = owner_id != null && String(owner_id) === String(user.id);
  const ownerPrivileged = owner_role != null && GOVERNANCE_PRIVILEGED.includes(owner_role);
  const ageMs           = created_at ? (Date.now() - new Date(created_at).getTime()) : Infinity;

  // Non-privileged users cannot request edits or deletions of records owned by admin/ceo/operations.
  if (!isOwner && ownerPrivileged) {
    return { action: 'deny', reason: 'owner_is_privileged' };
  }

  if (!isOwner) {
    return {
      action: 'require_approval',
      level:  ageMs < TWENTY_FOUR_MS ? 'leader' : 'manager',
      reason: 'not_owner'
    };
  }

  if (ageMs < FIVE_MIN_MS)    return { action: 'allow', privileged: false, ownedByUser: true };
  if (ageMs < TWENTY_FOUR_MS) return { action: 'require_approval', level: 'leader',  reason: 'owner_past_5min' };
  return                              { action: 'require_approval', level: 'manager', reason: 'owner_past_24h' };
}

// Roles that can approve leader-level requests (receives notifications for those requests).
const LEADER_NOTIFY_ROLES  = ['supervisor', 'harvesting-leader', 'sawmill-leader',
                               'poles-leader', 'vat-leader', 'admin', 'ceo', 'operations'];
// Roles that can approve manager-level requests.
const MANAGER_NOTIFY_ROLES = ['admin', 'ceo', 'operations', 'logistics', 'sales'];

async function autoRequestEdit(user, table, recordId, entityType, entityRef, payload, before, level) {
  const { rows: [req] } = await pool.query(
    `INSERT INTO pending_edits
       (action_type, entity_type, entity_id, entity_ref, payload, old_snapshot,
        submitted_by, required_level, auto_generated)
     VALUES ('edit',$1,$2,$3,$4,$5,$6,$7,true)
     RETURNING id`,
    [entityType, recordId, entityRef,
     payload != null ? JSON.stringify(payload) : null,
     before   != null ? JSON.stringify(before)  : null,
     user.id, level]
  );
  const pendingId  = req.id;
  const now        = new Date();
  const remindMs   = level === 'leader' ? SLA_LEADER_REMIND_MS   : SLA_MANAGER_REMIND_MS;
  const escalMs    = level === 'leader' ? SLA_LEADER_ESCALATE_MS : SLA_MANAGER_ESCALATE_MS;
  await scheduleJob(
    'escalation_reminder',
    { requestTable: 'pending_edits', requestId: pendingId, level, ref: entityRef },
    new Date(now.getTime() + remindMs),
    `reminder_pe_${pendingId}`
  );
  await scheduleJob(
    'escalation_escalate',
    { requestTable: 'pending_edits', requestId: pendingId, fromLevel: level, ref: entityRef },
    new Date(now.getTime() + escalMs),
    `escalate_pe_${pendingId}`
  );
  pushNotification({
    type: 'amber',
    title: `Edit Approval Required — ${entityRef}`,
    body:  `${user.name} requested to edit ${entityRef}. Requires ${level} approval.`,
    roles: level === 'leader' ? LEADER_NOTIFY_ROLES : MANAGER_NOTIFY_ROLES
  });
}

async function autoRequestDelete(user, table, recordId, entityType, entityRef, reason, before, level) {
  const { rows: [req] } = await pool.query(
    `INSERT INTO deletion_requests
       (table_name, record_id, entity_type, entity_ref, deletion_reason,
        requested_by, record_snapshot, required_level)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     RETURNING id`,
    [table, recordId, entityType, entityRef,
     reason || `Deletion requested by ${user.name}`,
     user.id, before != null ? JSON.stringify(before) : null, level]
  );
  const requestId  = req.id;
  const now        = new Date();
  const remindMs   = level === 'leader' ? SLA_LEADER_REMIND_MS   : SLA_MANAGER_REMIND_MS;
  const escalMs    = level === 'leader' ? SLA_LEADER_ESCALATE_MS : SLA_MANAGER_ESCALATE_MS;
  await scheduleJob(
    'escalation_reminder',
    { requestTable: 'deletion_requests', requestId, level, ref: entityRef },
    new Date(now.getTime() + remindMs),
    `reminder_dr_${requestId}`
  );
  await scheduleJob(
    'escalation_escalate',
    { requestTable: 'deletion_requests', requestId, fromLevel: level, ref: entityRef },
    new Date(now.getTime() + escalMs),
    `escalate_dr_${requestId}`
  );
  pushNotification({
    type: 'red',
    title: `Deletion Approval Required — ${entityRef}`,
    body:  `${user.name} requested to delete ${entityRef}. Requires ${level} approval.`,
    roles: level === 'leader' ? LEADER_NOTIFY_ROLES : MANAGER_NOTIFY_ROLES
  });
}

// Fired when a privileged user directly modifies a record they don't own,
// bypassing the approval queue. Logs to audit and alerts CEO+admin.
async function logPrivilegedOverride(user, actionType, table, recordId, before) {
  logAudit(user,
    `Privileged ${actionType}: ${table} #${recordId} (not owned by ${user.name})`,
    'ti-alert-triangle',
    { table, recordId },
    { module: table, actionType: 'privileged_override', recordId, before }
  );
  pushNotification({
    type: 'red',
    title: `Override Alert — ${user.role} directly ${actionType}d ${table} #${recordId}`,
    body:  `${user.name} (${user.role}) bypassed the approval queue for ${table} #${recordId}.`,
    roles: ['ceo', 'admin']
  });
}

// Single entry point called by every update/delete function.
// Returns a blocking { ok:false, ... } response when the action needs approval or is denied.
// Returns null when the action is allowed to proceed directly.
async function applyGovernance(user, table, recordId, actionType, opts) {
  const { ownerCol = 'created_by', entityType, entityRef, payload, before, reason } = opts;

  const gov = await timeGatedAuthorization(user, table, recordId, ownerCol);

  if (gov.action === 'deny') {
    if (gov.reason === 'owner_is_privileged')
      return { ok: false, error: 'You cannot edit or delete records created by an administrator. Contact admin if a change is needed.' };
    return { ok: false, error: 'Record not found' };
  }

  if (gov.action === 'require_approval') {
    if (actionType === 'delete') {
      await autoRequestDelete(user, table, recordId, entityType, entityRef, reason, before, gov.level);
    } else {
      await autoRequestEdit(user, table, recordId, entityType, entityRef, payload, before, gov.level);
    }
    logAudit(user,
      `${actionType === 'delete' ? 'Deletion' : 'Edit'} request submitted for ${entityRef}`,
      'ti-clock',
      { entityType, entityRef, level: gov.level, governanceReason: gov.reason },
      { module: table, actionType: 'approval_request', recordId, before, after: payload }
    );
    return {
      ok: false,
      pendingApproval: true,
      level: gov.level,
      message: `${actionType === 'delete' ? 'Deletion' : 'Edit'} request submitted — awaiting ${gov.level} approval.`
    };
  }

  // allow — log privileged override when a privileged user touches someone else's record
  if (gov.privileged && !gov.ownedByUser) {
    await logPrivilegedOverride(user, actionType, table, recordId, before);
  }

  return null; // caller may proceed
}

// opts = { module, actionType, recordId, before, after, ipAddress, reason }
// All opts fields are optional — existing call sites that omit opts still work unchanged.
// No role is exempt: CEO and all other roles are fully logged.
async function logAudit(user, action, icon = 'ti-check', meta = {}, opts = {}) {
  const { module, actionType, recordId, before, after, ipAddress, reason } = opts;
  const params = [
    user.id,           user.username || null, user.name || null, user.role,
    action, icon,      JSON.stringify(meta || {}),
    module || null,    actionType || null,
    recordId != null ? String(recordId) : null,
    before   != null ? JSON.stringify(before) : null,
    after    != null ? JSON.stringify(after)  : null,
    ipAddress || null, reason || null,
  ];
  try {
    await pool.query(
      `insert into audit_log(
         user_id, username, full_name, role,
         action, icon, meta,
         module, action_type, record_id,
         before_values, after_values,
         ip_address, reason
       ) values ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9,$10,$11::jsonb,$12::jsonb,$13,$14)`,
      params
    );
  } catch (e) {
    console.error('[audit] write failed, queuing audit_replay:', e.message);
    try {
      await pool.query(
        `INSERT INTO workflow_jobs(type, payload, run_at)
         VALUES ('audit_replay', $1::jsonb, now() + interval '1 minute')`,
        [JSON.stringify({
          userId: user.id, username: user.username || null,
          name: user.name || null, role: user.role,
          action, icon: icon || 'ti-check', meta: meta || {},
          module: module || null, actionType: actionType || null,
          recordId: recordId != null ? String(recordId) : null,
          before: before || null, after: after || null,
          ipAddress: ipAddress || null, reason: reason || null
        })]
      );
    } catch (e2) {
      console.error('[audit] replay queue also failed:', e2.message);
    }
  }
}

async function pushNotification({ type, title, body, roles, forUserId,
                                   relatedModule, relatedId, category }) {
  const params = [
    type, title, body, roles || [],
    forUserId     || null,
    relatedModule || null,
    relatedId     || null,
    category      || null,
  ];
  try {
    await pool.query(
      `insert into notifications(type,title,body,roles,for_user_id,related_module,related_id,category)
       values ($1,$2,$3,$4,$5,$6,$7,$8)`,
      params
    );
  } catch (e) {
    console.error('[pushNotification] write failed, queuing retry:', e.message);
    try {
      await pool.query(
        `INSERT INTO workflow_jobs(type, payload, run_at)
         VALUES ('notification_retry', $1::jsonb, now() + interval '1 minute')`,
        [JSON.stringify({
          type, title, body, roles: roles || [],
          forUserId:     forUserId     || null,
          relatedModule: relatedModule || null,
          relatedId:     relatedId     || null,
          category:      category      || null,
        })]
      );
    } catch (e2) {
      console.error('[pushNotification] retry queue also failed:', e2.message);
    }
  }
}

async function unreadCount(userId) {
  const user = await getUser(userId);
  const { rows } = await pool.query(
    `select count(*)::int as n
     from notifications n
     left join notifications_read r on r.notification_id=n.id and r.user_id=$1
     where r.notification_id is null
       and ((array_length(n.roles,1) is null or n.roles='{}' or $2=any(n.roles))
            or n.for_user_id=$1)`,
    [userId, user.role]
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

async function dailyList(userId, workshopId) {
  const user = await getUser(userId);
  if (!(await canAccessDaily(user))) return { ok: false, error: 'Access denied' };
  const restricted = isWorkshopRestricted(user);
  const wId = restricted ? user.workshop_id : (workshopId || null);
  const [{ rows }, { rows: stockRows }, { rows: transportRows }] = await Promise.all([
    pool.query(
      `select id, to_char(log_date,'DD/MM/YYYY') as date, machine, product_size,
              timber_units, timber_kiln_dried, timber_cca_treated, timber_untreated,
              timber_waste, poles_units, poles_waste, downtime_hours, logs_received,
              supervisor, operators, remarks, created_at, pending_deletion
       from daily_logs
       where deleted_at is null
         and ($1::bigint is null or workshop_id = $1 or workshop_id is null)
       order by log_date desc, id desc
       limit 50`,
      [wId]
    ),
    pool.query('select * from mv_stock_summary'),
    pool.query(
      `select
         coalesce(sum(case when transport_date = current_date then qty_transported else 0 end),0)::int as today_transported,
         coalesce(sum(case when extract(year from transport_date) = extract(year from now()) then qty_transported else 0 end),0)::int as annual_transported
       from log_transport
       where ($1::bigint is null or workshop_id = $1 or workshop_id is null)`,
      [wId]
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

async function productionStaffList(userId) {
  const user = await getUser(userId);
  if (!(await canAccessDaily(user))) return { ok: false, error: 'Access denied' };
  const { rows } = await pool.query(
    `select id, name, role from app_users
     where role in ('supervisor','sawmill-leader','poles-leader','vat-leader','mechanician','harvesting-leader')
       and active = true and deleted_at is null
     order by role, name`
  );
  return { ok: true, rows };
}

async function dailyCreate(userId, payload) {
  const user = await getUser(userId);
  if (!(await canAccessDaily(user))) return { ok: false, error: 'Access denied' };
  const p = payload || {};
  if (!p.date) return { ok: false, error: 'Date is required' };
  const workshopId = isWorkshopRestricted(user) ? user.workshop_id : (p.workshop_id ? Number(p.workshop_id) : null);
  const logsReceived = Number(p.logs_received || 0);
  if (logsReceived > 0) {
    // Scope the log-transport validation to the same workshop so Gatare and Nyanza
    // transport counts don't bleed into each other. Legacy NULL-workshop records count for all.
    const { rows: [lt] } = await pool.query(
      `select coalesce(sum(qty_transported),0)::int as transported
       from log_transport
       where transport_date=$1
         and ($2::bigint is null or workshop_id = $2 or workshop_id is null)`,
      [p.date, workshopId]
    );
    const transported = Number(lt?.transported || 0);
    if (transported === 0) return { ok: false, error: `No logs were transported on ${p.date}. Record a Log Transport entry first.` };
    if (logsReceived > transported) return { ok: false, error: `Logs received (${logsReceived}) cannot exceed logs transported on this date (${transported}).` };
  }
  const kilnDried   = Number(p.timber_kiln_dried  || 0);
  const ccaTreated  = Number(p.timber_cca_treated || 0);
  const untreated   = Number(p.timber_untreated   || 0);
  const timberTotal = kilnDried + ccaTreated + untreated || Number(p.timber_units || 0);

  if (timberTotal > 0 && !p.machine) return { ok: false, error: 'Machine is required for timber production entries' };

  const polesUnits = Number(p.poles_units || 0);
  const polesWaste = Number(p.poles_waste || 0);
  if (polesUnits > 0) {
    // Validate against approved poles stock — only when the delivery system has been used for this workshop
    const { rows: [avail] } = await pool.query(
      `select
         coalesce(sum(case when status='quality_checked' then approved_qty else 0 end),0)::int as approved_total
       from poles_deliveries
       where ($1::bigint is null or workshop_id = $1)`,
      [workshopId]
    );
    const approvedTotal = Number(avail.approved_total);
    if (approvedTotal > 0) {
      const { rows: [used] } = await pool.query(
        `select coalesce(sum(poles_units + poles_waste),0)::int as produced_total
         from daily_logs
         where deleted_at is null and ($1::bigint is null or workshop_id = $1 or workshop_id is null)`,
        [workshopId]
      );
      const available = Math.max(0, approvedTotal - Number(used.produced_total));
      if (polesUnits + polesWaste > available) {
        return { ok: false, error: `Insufficient approved pole stock: ${available} available, ${polesUnits + polesWaste} needed. Record a delivery and complete a quality check first.` };
      }
    }
  }

  await pool.query(
    `insert into daily_logs(log_date, supervisor, operators, timber_units, timber_kiln_dried, timber_cca_treated, timber_untreated,
                            timber_waste, poles_units, poles_waste, downtime_hours, downtime_reason, remarks, product_size, machine, logs_received, created_by, workshop_id)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)`,
    [
      p.date,
      p.supervisor || null,
      p.operators  || null,
      timberTotal,
      kilnDried,
      ccaTreated,
      untreated,
      Number(p.timber_waste || 0),
      polesUnits,
      polesWaste,
      Number(p.downtime_hours || 0),
      p.downtime_reason || null,
      p.remarks || null,
      p.product_size || null,
      p.machine || null,
      Number(p.logs_received || 0),
      user.id,
      workshopId
    ]
  );
  logAudit(user, `Created daily log for ${p.date}`, 'ti-clipboard-list', { date: p.date, timber: timberTotal, poles: polesUnits });
  refreshStockView();
  refreshStockByWorkshop();
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

async function salesList(userId, workshopId) {
  const user = await getUser(userId);
  if (!(await mustRole(user, 'sales'))) return { ok: false, error: 'Access denied' };
  const restricted = isWorkshopRestricted(user);
  const wId = restricted ? user.workshop_id : (workshopId || null);
  const [{ rows }, { rows: stockRows }] = await Promise.all([
    pool.query(
      `select so.id, so.order_number, so.customer_name, so.customer_id,
              so.product_type, so.product_sub_type, so.product_size,
              so.quantity, so.unit_price, so.currency, so.price_tax_type,
              so.payment_due_date, so.payment_status,
              so.notes, so.status, so.created_at, so.pending_deletion,
              coalesce(so.qty_dispatched_total,0)  as qty_dispatched_total,
              coalesce(so.qty_accepted_total,0)    as qty_accepted_total,
              coalesce(so.qty_rejected_total,0)    as qty_rejected_total,
              coalesce(so.qty_remaining, so.quantity) as qty_remaining,
              c.name as customer_registered_name,
              del.delivery_count,
              del.delivery_number, del.delivery_status
       from sales_orders so
       left join customers c on c.id = so.customer_id
       left join lateral (
         select count(*)::int                        as delivery_count,
                max(order_number)                    as delivery_number,
                (array_agg(status order by created_at desc))[1] as delivery_status
         from delivery_orders
         where sales_order_id = so.id
       ) del on true
       where so.deleted_at is null
         and ($1::bigint is null or so.workshop_id = $1 or so.workshop_id is null)
       order by so.created_at desc, so.id desc
       limit 50`,
      [wId]
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
  const currency     = p.currency || 'RWF';
  const priceTaxType = ['Inclusive','Exclusive'].includes(p.price_tax_type) ? p.price_tax_type : 'Exclusive';
  const paymentDue   = p.payment_due_date || null;
  const customerId   = p.customer_id ? Number(p.customer_id) : null;
  const workshopId   = isWorkshopRestricted(user) ? user.workshop_id : (p.workshop_id ? Number(p.workshop_id) : null);
  let customerName   = p.customer_name || '';
  if (customerId) {
    const { rows: cRows } = await pool.query('select name from customers where id=$1', [customerId]);
    if (cRows.length) customerName = cRows[0].name;
  }
  await pool.query(
    `insert into sales_orders(order_number, customer_name, customer_id, product_type, product_sub_type, product_size,
                              quantity, unit_price, currency, price_tax_type, payment_due_date, payment_status,
                              notes, reason, created_by, workshop_id)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`,
    [
      p.order_number, customerName, customerId, p.product_type, p.product_sub_type || null, p.product_size,
      Number(p.quantity), Number(p.unit_price), currency, priceTaxType, paymentDue, 'Unpaid',
      p.notes || null, p.reason, user.id, workshopId
    ]
  );
  const label = p.product_sub_type ? `${p.product_sub_type} ${p.product_size}` : `${p.product_type} ${p.product_size}`;
  logAudit(user, `Created order ${p.order_number} — ${p.customer_name}: ${p.quantity} × ${label}`, 'ti-shopping-cart', { order_number: p.order_number, sub_type: p.product_sub_type });
  refreshStockView();
  refreshStockByWorkshop();
  return { ok: true };
}

async function salesProductsForDropdown(userId) {
  const user = await getUser(userId);
  if (!user) return { ok: false, error: 'Not authenticated' };
  const { rows } = await pool.query(
    `select id, type, sub_type, size from products where active = true order by type, sub_type, size`
  );
  return { ok: true, rows };
}

async function salesUpdatePayment(userId, orderId, paymentStatus) {
  const user = await getUser(userId);
  if (!(await mustRole(user, 'sales'))) return { ok: false, error: 'Access denied' };
  if (!['Paid', 'Unpaid'].includes(paymentStatus)) return { ok: false, error: 'Invalid payment status' };
  const { rows: snap } = await pool.query('SELECT * FROM sales_orders WHERE id=$1 AND deleted_at IS NULL', [orderId]);
  if (!snap.length) return { ok: false, error: 'Order not found' };
  const before = snap[0];
  const blocked = await applyGovernance(user, 'sales_orders', orderId, 'edit', {
    ownerCol: 'created_by', entityType: 'sales_order',
    entityRef: `Order ${before.order_number || '#' + orderId}`,
    payload: { payment_status: paymentStatus }, before
  });
  if (blocked) return blocked;
  await pool.query('update sales_orders set payment_status=$1 where id=$2', [paymentStatus, orderId]);
  logAudit(user, `Marked order ${before.order_number} payment as ${paymentStatus}`, 'ti-cash',
    { orderId, paymentStatus },
    { module: 'sales', actionType: 'update', recordId: orderId,
      before: { payment_status: before.payment_status }, after: { payment_status: paymentStatus } });
  return { ok: true };
}

async function salesUpdateStatus(userId, orderId, status) {
  const user = await getUser(userId);
  if (!(await mustRole(user, 'sales'))) return { ok: false, error: 'Access denied' };
  const allowed = ['Pending', 'Confirmed', 'Dispatched', 'Delivered', 'Cancelled'];
  if (!allowed.includes(status)) return { ok: false, error: 'Invalid status' };
  const { rows: snap } = await pool.query('SELECT * FROM sales_orders WHERE id=$1 AND deleted_at IS NULL', [orderId]);
  if (!snap.length) return { ok: false, error: 'Order not found' };
  const before = snap[0];
  const blocked = await applyGovernance(user, 'sales_orders', orderId, 'edit', {
    ownerCol: 'created_by', entityType: 'sales_order',
    entityRef: `Order ${before.order_number || '#' + orderId}`,
    payload: { status }, before
  });
  if (blocked) return blocked;
  await pool.query(`update sales_orders set status=$1 where id=$2`, [status, orderId]);
  logAudit(user, `Updated order ${before.order_number} status to ${status}`, 'ti-shopping-cart',
    { orderId, status },
    { module: 'sales', actionType: 'update', recordId: orderId,
      before: { status: before.status }, after: { status } });
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
    `select m.id, m.machine_code, m.name, m.plate_number, mc.name as category_name
     from machines m
     join machine_categories mc on mc.id = m.category_id
     where m.active = true
     order by mc.name, m.name`
  );
  return { ok: true, rows };
}

async function machineFuelDropdown(userId) {
  const user = await getUser(userId);
  if (!user) return { ok: false, error: 'Not authenticated' };
  const { rows } = await pool.query(
    `select 'machine' as source, m.id, m.machine_code as code, m.name as label, m.plate_number
     from machines m
     where m.active = true
     union all
     select 'vehicle' as source, v.id, v.registration as code,
            trim(coalesce(v.make,'') || case when v.model is not null then ' ' || v.model else '' end) as label,
            v.registration as plate_number
     from vehicles v
     where coalesce(v.ownership_type,'') != 'Third-Party Car'
       and coalesce(v.status,'Active') = 'Active'
     order by source, code`
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

async function auditList(userId, filters = {}) {
  const user = await getUser(userId);
  if (!(await mustRole(user, 'audit'))) return { ok: false, error: 'Access denied' };

  // admin and ceo can see each other's actions; all other viewers cannot.
  const hiddenRoles = ['admin', 'ceo'].includes(user.role) ? [] : ['ceo', 'admin'];
  const params = [hiddenRoles];
  const conds = [`a.role != all($1::text[])`];

  const { roleFilter, module: mod, actionType, fromDate, toDate, search } = filters;

  if (roleFilter && roleFilter !== 'All') {
    params.push(roleFilter.toLowerCase().replace(/\s+/g, '-'));
    conds.push(`a.role = $${params.length}`);
  }
  if (mod && mod !== 'All') {
    params.push(mod);
    conds.push(`a.module = $${params.length}`);
  }
  if (actionType && actionType !== 'All') {
    params.push(actionType);
    conds.push(`a.action_type = $${params.length}`);
  }
  if (fromDate) {
    params.push(fromDate);
    conds.push(`a.created_at::date >= $${params.length}::date`);
  }
  if (toDate) {
    params.push(toDate);
    conds.push(`a.created_at::date <= $${params.length}::date`);
  }
  if (search) {
    params.push(`%${search}%`);
    conds.push(`(a.action ilike $${params.length} or a.username ilike $${params.length} or a.full_name ilike $${params.length})`);
  }

  const { rows } = await pool.query(
    `select a.id, a.action, a.icon, a.role,
            a.username, a.full_name,
            a.module, a.action_type, a.record_id,
            a.ip_address, a.reason,
            a.before_values, a.after_values,
            to_char(a.created_at,'DD Mon YYYY HH24:MI') as time,
            u.name as user_name
     from audit_log a
     left join app_users u on u.id = a.user_id
     where ${conds.join(' and ')}
     order by a.created_at desc, a.id desc
     limit 500`,
    params
  );

  // Distinct module values for filter dropdown (excluding nulls)
  const { rows: modules } = await pool.query(
    `select distinct module from audit_log
     where module is not null and role != all($1::text[])
     order by module`,
    [hiddenRoles]
  );

  return { ok: true, rows, modules: modules.map(m => m.module) };
}

async function notificationsList(userId, filters = {}) {
  const user = await getUser(userId);
  if (!(await mustRole(user, 'notifications'))) return { ok: false, error: 'Access denied' };

  const typeFilter     = filters.type     || null;
  const categoryFilter = filters.category || null;
  const searchLike     = filters.search   ? `%${filters.search}%` : null;
  const fromDate       = filters.fromDate || null;
  const toDate         = filters.toDate   || null;
  const page           = Math.max(0, Number(filters.page  || 0));
  const limit          = Math.min(200, Math.max(1, Number(filters.limit || 50)));
  const offset         = page * limit;

  const { rows } = await pool.query(
    `select n.id, n.type, n.title, n.body,
            n.related_module, n.related_id, n.category,
            to_char(n.created_at,'DD Mon YYYY HH24:MI') as time,
            (r.notification_id is not null) as read,
            (n.for_user_id is not null and n.for_user_id=$1) as direct,
            count(*) over() as total_count
     from notifications n
     left join notifications_read r on r.notification_id=n.id and r.user_id=$1
     where (
       (array_length(n.roles,1) is null or n.roles='{}' or $2=any(n.roles))
       or n.for_user_id=$1
     )
       and ($3::text is null or n.type     = $3)
       and ($4::text is null or n.category = $4)
       and ($5::text is null or (n.title ilike $5 or n.body ilike $5))
       and ($6::date is null or n.created_at >= $6::date)
       and ($7::date is null or n.created_at <  $7::date + interval '1 day')
     order by n.created_at desc, n.id desc
     limit $8 offset $9`,
    [userId, user.role,
     typeFilter, categoryFilter, searchLike,
     fromDate, toDate,
     limit, offset]
  );

  const total  = rows.length > 0 ? Number(rows[0].total_count) : 0;
  const hasMore = offset + rows.length < total;

  // Strip the window-function column from each returned row
  const pageRows = rows.map(({ total_count, ...r }) => r);

  return { ok: true, rows: pageRows, total, page, hasMore, unread: await unreadCount(userId) };
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
     where (array_length(n.roles,1) is null or n.roles='{}' or $2=any(n.roles))
        or n.for_user_id=$1
     on conflict do nothing`,
    [userId, user.role]
  );
  return { ok: true, unread: await unreadCount(userId) };
}

async function notificationsPoll(userId) {
  try {
    return { ok: true, unread: await unreadCount(userId) };
  } catch (e) {
    return { ok: true, unread: 0 };
  }
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
    where u.deleted_at is null
    order by u.id`);
  const { rows: workshops } = await pool.query(`select id, name from warehouses where active=true order by name`);
  return { ok: true, rows, workshops };
}

async function usersDelete(userId, targetUserId) {
  const user = await getUser(userId);
  if (user.role !== 'admin') return { ok: false, error: 'Only administrators can delete user accounts' };

  const tid = Number(targetUserId);
  if (Number(userId) === tid) return { ok: false, error: 'You cannot delete your own account' };

  const { rows: target } = await pool.query(
    'select id, username, role from app_users where id=$1 and deleted_at is null', [tid]
  );
  if (!target.length) return { ok: false, error: 'User not found' };

  if (target[0].role === 'admin') {
    const { rows: adminCount } = await pool.query(
      'select count(*)::int as n from app_users where role=$1 and active=true and deleted_at is null', ['admin']
    );
    if (adminCount[0].n <= 1) return { ok: false, error: 'Cannot delete the last administrator account' };
  }

  await pool.query(
    'update app_users set active=false, deleted_at=now(), deleted_by=$1 where id=$2',
    [Number(userId), tid]
  );
  invalidateUserCache(tid);
  logAudit(user, `Deleted user account: ${target[0].username}`, 'ti-user-x', {
    deletedUserId: tid,
    deletedUsername: target[0].username,
    deletedRole: target[0].role,
  });
  return { ok: true };
}

// Roles that must always be assigned to a specific workshop — server-side enforcement.
const WORKSHOP_ONLY_ROLES = new Set([
  'supervisor', 'storekeeper', 'storekeeper-assistant', 'mechanician',
  'harvesting-leader', 'sawmill-leader', 'poles-leader', 'vat-leader',
  'sales-staff', 'showroom-staff',
]);

async function usersCreate(userId, payload) {
  const user = await getUser(userId);
  if (!['ceo', 'operations', 'admin'].includes(user.role)) return { ok: false, error: 'Access denied' };
  const p = payload || {};
  if (!p.username || !p.name || !p.role || !p.password) return { ok: false, error: 'Missing required fields' };
  if (WORKSHOP_ONLY_ROLES.has(p.role) && !p.workshop_id) {
    return { ok: false, error: `Role "${p.role}" requires a workshop assignment` };
  }
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
    // Determine the effective role after the update (may have just changed)
    const { rows: targetRows } = await pool.query('select role from app_users where id=$1', [targetUserId]);
    const effectiveRole = p.role || targetRows[0]?.role;
    if (WORKSHOP_ONLY_ROLES.has(effectiveRole) && !p.workshop_id) {
      return { ok: false, error: `Role "${effectiveRole}" requires a workshop assignment` };
    }
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

  // ── Pending actions — role-specific ─────────────────────────────────────────
  const pendingActions = [];

  // Logistics: confirmed orders with no delivery order yet
  if (['admin', 'ceo', 'logistics', 'operations'].includes(user.role)) {
    const { rows: awaitingDelivery } = await pool.query(
      `select so.id, so.order_number, so.customer_name, so.product_type, so.product_size,
              so.quantity, so.unit_price,
              to_char(so.created_at,'DD/MM/YYYY HH24:MI') as created_at,
              u.name as created_by_name
       from sales_orders so
       left join app_users u on u.id = so.created_by
       where so.status = 'Confirmed'
         and so.deleted_at is null
         and not exists (select 1 from delivery_orders do2 where do2.sales_order_id = so.id)
       order by so.created_at desc limit 10`
    );
    for (const r of awaitingDelivery) {
      pendingActions.push({
        type: 'logistics',
        icon: 'ti-truck-delivery',
        color: '#D97706',
        title: `Delivery not assigned — ${r.order_number}`,
        body: `${r.customer_name} · ${r.quantity} ${r.product_type}${r.product_size ? ' ' + r.product_size : ''} · by ${r.created_by_name || '—'}`,
        created_at: r.created_at,
        page: 'deliveries',
        so_id: r.id
      });
    }
  }

  // Operations + sales: orders still Pending (need confirmation)
  if (['admin', 'ceo', 'operations', 'sales', 'supervisor'].includes(user.role)) {
    const byWho = user.role === 'sales'
      ? `and so.created_by = ${user.id}`
      : '';
    const { rows: awaitingConfirm } = await pool.query(
      `select so.id, so.order_number, so.customer_name, so.product_type, so.product_size,
              so.quantity, so.unit_price,
              to_char(so.created_at,'DD/MM/YYYY HH24:MI') as created_at,
              u.name as created_by_name
       from sales_orders so
       left join app_users u on u.id = so.created_by
       where so.status = 'Pending'
         and so.deleted_at is null
         ${byWho}
       order by so.created_at desc limit 10`
    );
    for (const r of awaitingConfirm) {
      pendingActions.push({
        type: 'operations',
        icon: 'ti-clipboard-check',
        color: '#2563EB',
        title: `Awaiting confirmation — ${r.order_number}`,
        body: `${r.customer_name} · ${r.quantity} ${r.product_type}${r.product_size ? ' ' + r.product_size : ''} · by ${r.created_by_name || '—'}`,
        created_at: r.created_at,
        page: 'sales',
        so_id: r.id
      });
    }
  }

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
    recentActivity,
    pendingActions
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
        // restricted users: INNER JOIN so only items with a stock_levels entry at their warehouse are shown
        `select sc.id, sc.category, sc.name, sc.sku, sc.uom, sc.unit_cost,
                sc.min_stock, sc.max_stock, sc.notes, sc.active,
                coalesce(sl.quantity,0)::int as total_stock
         from stock_catalog sc
         inner join stock_levels sl on sl.item_id=sc.id and sl.warehouse_id=$1
         where sc.active=true
         order by sc.category, sc.name`, [filterWh])
    : await pool.query(
        `select sc.id, sc.category, sc.name, sc.sku, sc.uom, sc.unit_cost,
                sc.min_stock, sc.max_stock, sc.notes, sc.active,
                coalesce(sum(sl.quantity),0)::int as total_stock,
                coalesce(
                  json_object_agg(w.id::text, coalesce(sl.quantity,0)) filter (where w.id is not null),
                  '{}'::json
                ) as wh_breakdown
         from stock_catalog sc
         left join stock_levels sl on sl.item_id=sc.id
         left join warehouses w on w.id=sl.warehouse_id and w.active=true
         where sc.active=true
         group by sc.id
         order by sc.category, sc.name`);
  const { rows: wh } = await pool.query(`select id, name from warehouses where active=true order by name`);
  const { rows: cats } = await pool.query(`select id, name from stock_categories order by name`);
  return { ok: true, rows: items, warehouses: wh, categories: cats, user_workshop_id: user.workshop_id };
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
  const newId = rows[0].id;
  // Workshop-restricted users: register item at their warehouse so it appears in their catalog immediately
  if (isWorkshopRestricted(user)) {
    await pool.query(
      `insert into stock_levels(item_id, warehouse_id, quantity) values ($1,$2,0) on conflict do nothing`,
      [newId, user.workshop_id]
    );
  }
  logAudit(user, `Added stock item: ${p.name}`, 'ti-package', { id: newId, category: p.category });
  return { ok: true };
}

async function stockItemsUpdate(userId, itemId, payload) {
  const user = await getUser(userId);
  if (!(await mustRole(user, 'stock-items'))) return { ok: false, error: 'Access denied' };
  const { rows: snap } = await pool.query('SELECT * FROM stock_catalog WHERE id=$1', [itemId]);
  const before = snap[0] || null;
  const blocked = await applyGovernance(user, 'stock_catalog', itemId, 'edit', {
    ownerCol: 'created_by', entityType: 'stock_item',
    entityRef: `Stock item #${itemId}`, payload, before
  });
  if (blocked) return blocked;
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

// ── Stock Categories ──────────────────────────────────────────────────────────

async function stockCategoriesList(userId) {
  const user = await getUser(userId);
  if (!(await mustRole(user, 'stock-items'))) return { ok: false, error: 'Access denied' };
  const { rows } = await pool.query(`select id, name from stock_categories order by name`);
  return { ok: true, rows };
}

async function stockCategoriesCreate(userId, name) {
  const user = await getUser(userId);
  if (!(await mustRole(user, 'stock-items'))) return { ok: false, error: 'Access denied' };
  if (!name?.trim()) return { ok: false, error: 'Category name is required' };
  try {
    await pool.query(`insert into stock_categories(name, created_by) values ($1,$2)`, [name.trim(), user.id]);
    logAudit(user, `Created stock category: ${name.trim()}`, 'ti-tag', { name: name.trim() });
    return { ok: true };
  } catch (e) {
    if (e.code === '23505') return { ok: false, error: 'Category already exists' };
    throw e;
  }
}

async function stockCategoriesDelete(userId, categoryId) {
  const user = await getUser(userId);
  if (!(await mustRole(user, 'stock-items'))) return { ok: false, error: 'Access denied' };
  const { rows: sc } = await pool.query(`select name from stock_categories where id=$1`, [categoryId]);
  if (!sc.length) return { ok: false, error: 'Category not found' };
  const catName = sc[0].name;
  const { rows: used } = await pool.query(
    `select count(*)::int as n from stock_catalog where category=$1 and active=true`, [catName]
  );
  if (used[0].n > 0) return { ok: false, error: `Cannot delete — ${used[0].n} item(s) still use this category` };
  await pool.query(`delete from stock_categories where id=$1`, [categoryId]);
  logAudit(user, `Deleted stock category: ${catName}`, 'ti-tag', { name: catName });
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
                sm.movement_type, sm.quantity, sm.unit_cost,
                (sm.quantity * coalesce(sm.unit_cost, 0))::numeric(14,2) as total_value,
                sm.reference, sm.notes,
                sm.approval_status, sm.rejection_reason,
                to_char(sm.created_at,'DD/MM/YYYY HH24:MI') as created_at,
                u.name as created_by
         from stock_movements sm
         join stock_catalog sc on sc.id=sm.item_id
         left join warehouses w on w.id=sm.warehouse_id
         left join warehouses tw on tw.id=sm.to_warehouse_id
         left join app_users u on u.id=sm.created_by
         where sm.deleted_at is null and (sm.warehouse_id=$1 or sm.to_warehouse_id=$1)
         order by sm.created_at desc limit 100`, [filterWh])
    : await pool.query(
        `select sm.id, sc.name as item_name, sc.category, sc.uom,
                w.name as warehouse_name, tw.name as to_warehouse_name,
                sm.movement_type, sm.quantity, sm.unit_cost,
                (sm.quantity * coalesce(sm.unit_cost, 0))::numeric(14,2) as total_value,
                sm.reference, sm.notes,
                sm.approval_status, sm.rejection_reason, sm.pending_deletion,
                to_char(sm.created_at,'DD/MM/YYYY HH24:MI') as created_at,
                u.name as created_by
         from stock_movements sm
         join stock_catalog sc on sc.id=sm.item_id
         left join warehouses w on w.id=sm.warehouse_id
         left join warehouses tw on tw.id=sm.to_warehouse_id
         left join app_users u on u.id=sm.created_by
         where sm.deleted_at is null
         order by sm.created_at desc limit 100`);
  const { rows: items } = filterWh
    ? await pool.query(
        `select sc.id, sc.name, sc.category, sc.uom, sc.unit_cost as default_unit_cost,
                coalesce(sum(sl.quantity),0)::int as total_stock
         from stock_catalog sc
         left join stock_levels sl on sl.item_id=sc.id and sl.warehouse_id=$1
         where sc.active=true group by sc.id order by sc.category, sc.name`, [filterWh])
    : await pool.query(
        `select sc.id, sc.name, sc.category, sc.uom, sc.unit_cost as default_unit_cost,
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

  const unitCost = p.unit_cost != null && p.unit_cost !== '' ? Number(p.unit_cost) : null;

  const { rows: mvRows } = await pool.query(
    `insert into stock_movements(item_id, warehouse_id, to_warehouse_id, movement_type, quantity, unit_cost, reference, notes, approval_status, created_by)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) returning id`,
    [p.item_id, p.warehouse_id || null, p.to_warehouse_id || null,
     p.movement_type, qty, unitCost, p.reference || null, p.notes || null, approvalStatus, user.id]
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

// ── Poles Procurement Workflow ────────────────────────────────────────────────

async function polesPurchaseList(userId, workshopId) {
  const user = await getUser(userId);
  if (!(await canAccessDaily(user))) return { ok: false, error: 'Access denied' };
  const wid = workshopId ? Number(workshopId) : (user.workshop_id || null);

  const { rows: requests } = await pool.query(
    `select pr.id, pr.supplier_name, pr.requested_qty, pr.unit_price, pr.notes, pr.status,
            pr.requested_at, pr.approved_at, pr.rejection_reason,
            u1.name as requested_by_name, u2.name as approved_by_name
     from poles_purchase_requests pr
     left join app_users u1 on u1.id = pr.requested_by
     left join app_users u2 on u2.id = pr.approved_by
     where ($1::bigint is null or pr.workshop_id = $1)
     order by pr.requested_at desc`,
    [wid]
  );

  const { rows: deliveries } = await pool.query(
    `select d.id, d.purchase_request_id, d.delivery_date, d.supplier_name, d.delivered_qty,
            d.delivery_note_ref, d.approved_qty, d.rejected_qty, d.rejection_reason,
            d.status, d.notes, d.confirmed_at, d.quality_checked_at,
            u1.name as confirmed_by_name, u2.name as quality_checked_by_name
     from poles_deliveries d
     left join app_users u1 on u1.id = d.confirmed_by
     left join app_users u2 on u2.id = d.quality_checked_by
     where ($1::bigint is null or d.workshop_id = $1)
     order by d.delivery_date desc, d.id desc`,
    [wid]
  );

  const { rows: [stock] } = await pool.query(
    `select
       coalesce(sum(case when d.status='quality_checked' then d.approved_qty else 0 end),0)::int as approved_total,
       coalesce((select sum(dl.poles_units + dl.poles_waste) from daily_logs dl
                  where dl.deleted_at is null and ($1::bigint is null or dl.workshop_id = $1 or dl.workshop_id is null)),0)::int as produced_total
     from poles_deliveries d
     where ($1::bigint is null or d.workshop_id = $1)`,
    [wid]
  );
  const available = Math.max(0, Number(stock.approved_total) - Number(stock.produced_total));

  return { ok: true, requests, deliveries, available_qty: available, approved_total: Number(stock.approved_total) };
}

async function polesPurchaseCreate(userId, payload) {
  const user = await getUser(userId);
  if (!['admin','ceo','operations','supervisor','poles-leader'].includes(user.role))
    return { ok: false, error: 'Access denied' };
  const p = payload || {};
  if (!p.supplier_name) return { ok: false, error: 'Supplier name is required' };
  if (!p.requested_qty || Number(p.requested_qty) <= 0) return { ok: false, error: 'Requested quantity must be greater than 0' };
  const wid = user.workshop_id || (p.workshop_id ? Number(p.workshop_id) : null);
  const { rows } = await pool.query(
    `insert into poles_purchase_requests(supplier_name, requested_qty, unit_price, notes, requested_by, workshop_id)
     values ($1,$2,$3,$4,$5,$6) returning id`,
    [p.supplier_name, Number(p.requested_qty), p.unit_price ? Number(p.unit_price) : null, p.notes || null, user.id, wid]
  );
  logAudit(user, `Created poles purchase request — ${p.supplier_name} for ${p.requested_qty} poles`, 'ti-package', { ...p });
  return { ok: true, id: rows[0].id };
}

async function polesPurchaseApprove(userId, requestId, approve, rejectionReason) {
  const user = await getUser(userId);
  if (user.role !== 'ceo') return { ok: false, error: 'Only the CEO can approve purchase requests' };
  const { rows: [req] } = await pool.query('select id, status from poles_purchase_requests where id=$1', [Number(requestId)]);
  if (!req) return { ok: false, error: 'Purchase request not found' };
  if (req.status !== 'pending') return { ok: false, error: 'This request has already been processed' };
  const newStatus = approve ? 'approved' : 'rejected';
  await pool.query(
    `update poles_purchase_requests set status=$1, approved_by=$2, approved_at=now(), rejection_reason=$3 where id=$4`,
    [newStatus, user.id, approve ? null : (rejectionReason || null), Number(requestId)]
  );
  logAudit(user, `${approve ? 'Approved' : 'Rejected'} poles purchase request #${requestId}`, 'ti-package', { requestId, approve, rejectionReason });
  return { ok: true };
}

async function polesDeliveryCreate(userId, payload) {
  const user = await getUser(userId);
  if (!['admin','ceo','operations','supervisor','poles-leader','poles-supervisor'].includes(user.role))
    return { ok: false, error: 'Access denied' };
  const p = payload || {};
  if (!p.delivery_date) return { ok: false, error: 'Delivery date is required' };
  if (!p.delivered_qty || Number(p.delivered_qty) <= 0) return { ok: false, error: 'Delivered quantity must be greater than 0' };
  const wid = user.workshop_id || (p.workshop_id ? Number(p.workshop_id) : null);
  const { rows } = await pool.query(
    `insert into poles_deliveries(purchase_request_id, delivery_date, supplier_name, delivered_qty, delivery_note_ref, notes, created_by, workshop_id)
     values ($1,$2,$3,$4,$5,$6,$7,$8) returning id`,
    [
      p.purchase_request_id ? Number(p.purchase_request_id) : null,
      p.delivery_date,
      p.supplier_name || null,
      Number(p.delivered_qty),
      p.delivery_note_ref || null,
      p.notes || null,
      user.id,
      wid
    ]
  );
  logAudit(user, `Recorded poles delivery — ${p.delivered_qty} poles from ${p.supplier_name || 'supplier'}`, 'ti-truck-delivery', { ...p });
  return { ok: true, id: rows[0].id };
}

async function polesDeliveryQualityCheck(userId, deliveryId, payload) {
  const user = await getUser(userId);
  if (!['admin','ceo','operations','supervisor','poles-leader'].includes(user.role))
    return { ok: false, error: 'Only a supervisor or poles leader can complete a quality check' };
  const p = payload || {};
  if (p.approved_qty === undefined || p.approved_qty === null) return { ok: false, error: 'Approved quantity is required' };
  const approved = Number(p.approved_qty);
  const { rows: [del] } = await pool.query('select id, delivered_qty, status from poles_deliveries where id=$1', [Number(deliveryId)]);
  if (!del) return { ok: false, error: 'Delivery not found' };
  if (del.status === 'quality_checked') return { ok: false, error: 'Quality check already completed for this delivery' };
  if (approved > Number(del.delivered_qty)) return { ok: false, error: 'Approved quantity cannot exceed delivered quantity' };
  const rejected = Number(del.delivered_qty) - approved;
  await pool.query(
    `update poles_deliveries
     set status='quality_checked', approved_qty=$1, rejected_qty=$2, rejection_reason=$3,
         quality_checked_by=$4, quality_checked_at=now()
     where id=$5`,
    [approved, rejected, p.rejection_reason || null, user.id, Number(deliveryId)]
  );
  logAudit(user, `Quality check: ${approved} poles approved, ${rejected} rejected`, 'ti-circle-check', { deliveryId, approved, rejected, reason: p.rejection_reason });
  return { ok: true };
}

// ── Stock Transfers (multi-stage) ─────────────────────────────────────────────

async function stockTransfersList(userId, workshopId) {
  const user = await getUser(userId);
  if (!(await mustRole(user, 'stock-transfers'))) return { ok: false, error: 'Access denied' };
  const restricted = isWorkshopRestricted(user);
  const filterWh = restricted ? user.workshop_id : (workshopId || null);
  const base = `
    select st.id, sc.name as item_name, sc.category, sc.uom,
           fw.name as from_warehouse_name, tw.name as to_warehouse_name,
           st.from_warehouse_id, st.to_warehouse_id,
           st.requested_qty, st.dispatched_qty, st.received_qty, st.status,
           st.reference, st.notes, st.rejection_reason,
           u1.name as requested_by, u2.name as approved_by,
           to_char(st.requested_at,'DD/MM/YYYY HH24:MI') as requested_at,
           to_char(st.approved_at,'DD/MM/YYYY HH24:MI') as approved_at
    from stock_transfers st
    join stock_catalog sc on sc.id=st.item_id
    join warehouses fw on fw.id=st.from_warehouse_id
    join warehouses tw on tw.id=st.to_warehouse_id
    left join app_users u1 on u1.id=st.requested_by
    left join app_users u2 on u2.id=st.approved_by
    where st.deleted_at is null`;
  const { rows } = filterWh
    ? await pool.query(base + ` and (st.from_warehouse_id=$1 or st.to_warehouse_id=$1) order by st.requested_at desc limit 100`, [filterWh])
    : await pool.query(base + ` order by st.requested_at desc limit 100`);
  const { rows: items } = filterWh
    ? await pool.query(
        `select sc.id, sc.name, sc.category, sc.uom, coalesce(sum(sl.quantity),0)::int as total_stock
         from stock_catalog sc left join stock_levels sl on sl.item_id=sc.id and sl.warehouse_id=$1
         where sc.active=true group by sc.id order by sc.category, sc.name`, [filterWh])
    : await pool.query(
        `select sc.id, sc.name, sc.category, sc.uom, coalesce(sum(sl.quantity),0)::int as total_stock
         from stock_catalog sc left join stock_levels sl on sl.item_id=sc.id
         where sc.active=true group by sc.id order by sc.category, sc.name`);
  const { rows: wh } = await pool.query(`select id, name from warehouses where active=true order by name`);
  const { rows: vehicles } = await pool.query(
    `select id, registration,
            trim(coalesce(make,'') || case when model is not null then ' ' || model else '' end) as label,
            driver_assigned
     from vehicles
     where coalesce(status,'Active') = 'Active'
     order by registration`
  );
  return { ok: true, rows, items, warehouses: wh, vehicles, user_workshop_id: user.workshop_id };
}

async function stockTransfersCreate(userId, payload) {
  const user = await getUser(userId);
  if (!(await mustRole(user, 'stock-transfers'))) return { ok: false, error: 'Access denied' };
  const p = payload || {};
  if (!p.item_id || !p.from_warehouse_id || !p.to_warehouse_id || !p.requested_qty)
    return { ok: false, error: 'Item, source warehouse, destination warehouse, and quantity are required' };
  const qty = Number(p.requested_qty);
  if (qty <= 0) return { ok: false, error: 'Quantity must be greater than zero' };
  if (Number(p.from_warehouse_id) === Number(p.to_warehouse_id))
    return { ok: false, error: 'Source and destination warehouses must be different' };
  if (isWorkshopRestricted(user) && Number(p.from_warehouse_id) !== Number(user.workshop_id))
    return { ok: false, error: 'You can only request transfers from your assigned workshop' };
  await pool.query(
    `insert into stock_transfers(item_id, from_warehouse_id, to_warehouse_id, requested_qty, reference, notes, requested_by)
     values ($1,$2,$3,$4,$5,$6,$7)`,
    [p.item_id, p.from_warehouse_id, p.to_warehouse_id, qty, p.reference || null, p.notes || null, user.id]
  );
  logAudit(user, `Transfer request: ${qty} × item #${p.item_id} from wh #${p.from_warehouse_id} → #${p.to_warehouse_id}`, 'ti-arrows-right-left', { ...p });
  return { ok: true };
}

async function stockTransfersApproveReject(userId, transferId, action, rejectionReason) {
  const user = await getUser(userId);
  if (!['admin', 'ceo', 'operations', 'logistics'].includes(user.role))
    return { ok: false, error: 'Access denied — manager approval required' };
  const { rows } = await pool.query(
    `select id from stock_transfers where id=$1 and status='pending' and deleted_at is null`,
    [transferId]
  );
  if (!rows.length) return { ok: false, error: 'Transfer not found or already reviewed' };
  if (action === 'approve') {
    await pool.query(
      `update stock_transfers set status='approved', approved_by=$1, approved_at=now() where id=$2`,
      [user.id, transferId]
    );
    logAudit(user, `Transfer #${transferId} approved`, 'ti-circle-check', { transferId });
  } else {
    await pool.query(
      `update stock_transfers set status='rejected', approved_by=$1, approved_at=now(), rejection_reason=$2 where id=$3`,
      [user.id, rejectionReason || null, transferId]
    );
    logAudit(user, `Transfer #${transferId} rejected`, 'ti-circle-x', { transferId, rejectionReason });
  }
  return { ok: true };
}

async function stockTransfersDispatch(userId, transferId, payload) {
  const user = await getUser(userId);
  if (!['admin', 'ceo', 'operations', 'logistics', 'supervisor', 'storekeeper'].includes(user.role))
    return { ok: false, error: 'Access denied' };
  const { qty, vehicle_id, driver_name, dispatched_at, reference, notes } = payload || {};
  if (!vehicle_id) return { ok: false, error: 'A vehicle must be assigned before dispatch can be completed' };
  const qty_n = Number(qty);
  if (!qty_n || qty_n <= 0) return { ok: false, error: 'Quantity must be greater than zero' };
  const client = await pool.connect();
  try {
    await client.query('begin');
    const { rows } = await client.query(
      `select * from stock_transfers where id=$1 and deleted_at is null for update skip locked`,
      [transferId]
    );
    if (!rows.length) { await client.query('rollback'); return { ok: false, error: 'Transfer not found' }; }
    const tr = rows[0];
    if (!['approved', 'in_transit'].includes(tr.status)) {
      await client.query('rollback');
      return { ok: false, error: `Cannot dispatch: transfer status is "${tr.status}"` };
    }
    const remaining = tr.requested_qty - tr.dispatched_qty;
    if (qty_n > remaining) {
      await client.query('rollback');
      return { ok: false, error: `Cannot dispatch ${qty_n} — only ${remaining} remaining to dispatch` };
    }
    const { rows: sl } = await client.query(
      `select quantity from stock_levels where item_id=$1 and warehouse_id=$2`,
      [tr.item_id, tr.from_warehouse_id]
    );
    const available = sl.length ? Number(sl[0].quantity) : 0;
    if (available < qty_n) {
      await client.query('rollback');
      return { ok: false, error: `Insufficient stock at source: ${available} available, ${qty_n} requested` };
    }
    await client.query(
      `insert into stock_movements(item_id, warehouse_id, movement_type, quantity, reference, notes, transfer_id, created_by)
       values ($1,$2,'transfer_out',$3,$4,$5,$6,$7)`,
      [tr.item_id, tr.from_warehouse_id, qty_n, reference || null, notes || null, transferId, user.id]
    );
    await client.query(
      `update stock_levels set quantity=greatest(0, quantity-$1), updated_at=now()
       where item_id=$2 and warehouse_id=$3`,
      [qty_n, tr.item_id, tr.from_warehouse_id]
    );
    await client.query(
      `update stock_transfers set dispatched_qty=dispatched_qty+$1, status='in_transit' where id=$2`,
      [qty_n, transferId]
    );
    const { rows: dispRows } = await client.query(
      `insert into stock_transfer_dispatches(transfer_id, vehicle_id, driver_name, qty, dispatched_at, reference, notes, dispatched_by)
       values ($1,$2,$3,$4,coalesce($5::timestamptz, now()),$6,$7,$8)
       returning id, to_char(dispatched_at,'DD/MM/YYYY HH24:MI') as dispatched_at_fmt`,
      [transferId, Number(vehicle_id), driver_name || null, qty_n, dispatched_at || null, reference || null, notes || null, user.id]
    );
    await client.query('commit');
    logAudit(user, `Transfer #${transferId} dispatch: ${qty_n} units via vehicle #${vehicle_id}`, 'ti-truck', { transferId, qty_n, vehicle_id });
    return {
      ok: true,
      dispatch: {
        id: dispRows[0].id,
        dispatched_at: dispRows[0].dispatched_at_fmt,
        qty: qty_n,
        driver_name: driver_name || null,
        reference: reference || null,
        notes: notes || null,
        dispatched_by: user.name,
      },
    };
  } catch (e) {
    await client.query('rollback');
    throw e;
  } finally {
    client.release();
  }
}

async function stockTransfersDispatchHistory(userId, transferId) {
  const user = await getUser(userId);
  if (!(await mustRole(user, 'stock-transfers'))) return { ok: false, error: 'Access denied' };
  const { rows: dispatches } = await pool.query(
    `select std.id, std.qty, std.driver_name, std.reference, std.notes,
            v.registration,
            trim(coalesce(v.make,'') || case when v.model is not null then ' ' || v.model else '' end) as vehicle_label,
            u.name as dispatched_by_name,
            to_char(std.dispatched_at,'DD/MM/YYYY HH24:MI') as dispatched_at
     from stock_transfer_dispatches std
     left join vehicles v on v.id = std.vehicle_id
     left join app_users u on u.id = std.dispatched_by
     where std.transfer_id = $1
     order by std.dispatched_at asc`,
    [transferId]
  );
  const { rows: tr } = await pool.query(
    `select st.id, st.status, st.requested_qty, st.dispatched_qty, st.received_qty, st.reference as transfer_ref,
            sc.name as item_name, sc.uom,
            fw.name as from_warehouse_name, tw.name as to_warehouse_name,
            u1.name as requested_by, u2.name as approved_by,
            to_char(st.requested_at,'DD/MM/YYYY HH24:MI') as requested_at,
            to_char(st.approved_at,'DD/MM/YYYY HH24:MI') as approved_at
     from stock_transfers st
     join stock_catalog sc on sc.id = st.item_id
     join warehouses fw on fw.id = st.from_warehouse_id
     join warehouses tw on tw.id = st.to_warehouse_id
     left join app_users u1 on u1.id = st.requested_by
     left join app_users u2 on u2.id = st.approved_by
     where st.id = $1`,
    [transferId]
  );
  return { ok: true, transfer: tr[0] || null, dispatches };
}

async function stockTransfersReceive(userId, transferId, qty, notes) {
  const user = await getUser(userId);
  if (!['admin', 'ceo', 'operations', 'logistics', 'supervisor', 'storekeeper'].includes(user.role))
    return { ok: false, error: 'Access denied' };
  const qty_n = Number(qty);
  if (!qty_n || qty_n <= 0) return { ok: false, error: 'Quantity must be greater than zero' };
  const client = await pool.connect();
  try {
    await client.query('begin');
    const { rows } = await client.query(
      `select * from stock_transfers where id=$1 and deleted_at is null for update skip locked`,
      [transferId]
    );
    if (!rows.length) { await client.query('rollback'); return { ok: false, error: 'Transfer not found' }; }
    const tr = rows[0];
    if (!['in_transit', 'partially_received'].includes(tr.status)) {
      await client.query('rollback');
      return { ok: false, error: `Cannot receive: transfer status is "${tr.status}"` };
    }
    const in_transit = tr.dispatched_qty - tr.received_qty;
    if (qty_n > in_transit) {
      await client.query('rollback');
      return { ok: false, error: `Cannot receive ${qty_n} — only ${in_transit} currently in transit` };
    }
    await client.query(
      `insert into stock_movements(item_id, warehouse_id, movement_type, quantity, notes, transfer_id, created_by)
       values ($1,$2,'transfer_in',$3,$4,$5,$6)`,
      [tr.item_id, tr.to_warehouse_id, qty_n, notes || null, transferId, user.id]
    );
    await client.query(
      `insert into stock_levels(item_id, warehouse_id, quantity, updated_at) values ($1,$2,$3,now())
       on conflict(item_id, warehouse_id) do update set quantity=stock_levels.quantity+$3, updated_at=now()`,
      [tr.item_id, tr.to_warehouse_id, qty_n]
    );
    const new_received = tr.received_qty + qty_n;
    const new_status = new_received >= tr.requested_qty ? 'completed' : 'partially_received';
    await client.query(
      `update stock_transfers set received_qty=received_qty+$1, status=$2 where id=$3`,
      [qty_n, new_status, transferId]
    );
    await client.query('commit');
    logAudit(user, `Transfer #${transferId} receipt: ${qty_n} units — ${new_status}`, 'ti-package-import', { transferId, qty_n, new_status });
    return { ok: true, completed: new_status === 'completed' };
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

async function vehiclesForTransport(userId) {
  const user = await getUser(userId);
  if (!user) return { ok: false, error: 'Not authenticated' };
  const { rows } = await pool.query(
    `select id, registration, make, model, vehicle_category, driver_assigned, status
     from vehicles
     where vehicle_category in ('Truck','Tractor')
       and status = 'Active'
     order by vehicle_category, registration`
  );
  return { ok: true, rows };
}

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
            mr.performed_by, mr.notes, mr.pending_deletion
     from maintenance_records mr
     join vehicles v on v.id=mr.vehicle_id
     where mr.vehicle_id=$1 and mr.deleted_at is null
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
            do2.qty_dispatched, do2.qty_accepted, do2.qty_rejected,
            do2.rejection_reason,
            to_char(do2.pod_recorded_at,'DD/MM/YYYY HH24:MI') as pod_recorded_at,
            to_char(do2.delivery_date,'DD/MM/YYYY') as delivery_date,
            to_char(do2.created_at,'DD/MM/YYYY') as created_at,
            v.registration as vehicle_registration,
            so.id as so_id,
            so.order_number as sales_order_number,
            so.customer_name,
            so.quantity as so_quantity,
            so.qty_accepted_total,
            so.qty_remaining,
            so.price_tax_type as so_price_tax_type,
            u.name as created_by
     from delivery_orders do2
     left join vehicles v on v.id=do2.vehicle_id
     left join sales_orders so on so.id=do2.sales_order_id
     left join app_users u on u.id=do2.created_by
     order by do2.created_at desc
     limit 200`
  );
  const { rows: vehicles } = await pool.query(
    `select id, registration, make, model from vehicles where status='Active' order by registration`
  );
  const { rows: salesOrders } = await pool.query(
    `select id, order_number, customer_name, price_tax_type, quantity,
            coalesce(qty_dispatched_total,0)  as qty_dispatched_total,
            coalesce(qty_accepted_total,0)    as qty_accepted_total,
            coalesce(qty_remaining, quantity) as qty_remaining
     from sales_orders
     where status not in ('Fully Delivered','Closed (Short)','Cancelled') and deleted_at is null
     order by created_at desc limit 200`
  );
  return { ok: true, rows, vehicles, salesOrders };
}

async function deliveryOrdersCreate(userId, payload) {
  const user = await getUser(userId);
  if (!(await mustRole(user, 'deliveries'))) return { ok: false, error: 'Access denied' };
  const p = payload || {};
  const driverName = String(p.driver_name || '').trim();
  if (!driverName) return { ok: false, error: 'Driver name is required' };
  const qtyDispatched = p.qty_dispatched ? Number(p.qty_dispatched) : null;

  const client = await pool.connect();
  try {
    await client.query('begin');

    // Lock the SO row for the duration of this transaction so concurrent
    // requests cannot both read the same remaining qty and both succeed.
    if (p.sales_order_id && qtyDispatched) {
      const { rows: soRows } = await client.query(
        `select quantity, coalesce(qty_dispatched_total,0) as dispatched_total
         from sales_orders
         where id=$1 and deleted_at is null
         for update`,
        [p.sales_order_id]
      );
      if (!soRows.length) {
        await client.query('rollback');
        return { ok: false, error: 'Sales order not found' };
      }
      const remaining = Number(soRows[0].quantity) - Number(soRows[0].dispatched_total);
      if (qtyDispatched > remaining) {
        await client.query('rollback');
        return { ok: false, error: `Quantity exceeds remaining sales order quantity (${remaining} remaining)` };
      }
    }

    const ts = Date.now().toString(36).toUpperCase();
    const orderNum = `DEL-${ts}`;
    const { rows } = await client.query(
      `insert into delivery_orders(order_number, sales_order_id, vehicle_id, driver_name, delivery_date, status, route, notes, qty_dispatched, created_by)
       values ($1,$2,$3,$4,$5,'Pending',$6,$7,$8,$9) returning id`,
      [orderNum, p.sales_order_id || null, p.vehicle_id || null, driverName,
       p.delivery_date || null, p.route || null, p.notes || null, qtyDispatched, user.id]
    );

    if (p.sales_order_id && qtyDispatched) {
      await client.query(
        `update sales_orders set
           qty_dispatched_total = coalesce(qty_dispatched_total,0) + $1,
           status = case
             when status in ('Partially Delivered','Fully Delivered','Closed (Short)','Cancelled') then status
             when coalesce(qty_dispatched_total,0) + $1 >= quantity then 'Fully Dispatched'
             else 'Partially Dispatched'
           end
         where id=$2 and deleted_at is null`,
        [qtyDispatched, p.sales_order_id]
      );
    }

    await client.query('commit');
    const afterValues = {
      id:             rows[0].id,
      order_number:   orderNum,
      sales_order_id: p.sales_order_id || null,
      vehicle_id:     p.vehicle_id     || null,
      driver_name:    driverName,
      delivery_date:  p.delivery_date  || null,
      status:         'Pending',
      route:          p.route          || null,
      notes:          p.notes          || null,
      qty_dispatched: qtyDispatched,
      created_by:     user.id,
    };
    logAudit(user, `Created delivery order ${orderNum}`, 'ti-truck-delivery',
      { id: rows[0].id },
      { module: 'deliveries', actionType: 'create', recordId: rows[0].id,
        after: afterValues });
    return { ok: true };
  } catch (e) {
    await client.query('rollback');
    throw e;
  } finally {
    client.release();
  }
}

async function deliveryOrdersUpdateStatus(userId, orderId, status) {
  const user = await getUser(userId);
  if (!(await mustRole(user, 'deliveries'))) return { ok: false, error: 'Access denied' };
  const valid = ['Pending', 'Assigned', 'In Transit', 'Failed'];
  if (!valid.includes(status)) return { ok: false, error: 'Invalid status' };
  const { rows: snap } = await pool.query('SELECT * FROM delivery_orders WHERE id=$1', [orderId]);
  if (!snap.length) return { ok: false, error: 'Delivery order not found' };
  const before = snap[0];
  const blocked = await applyGovernance(user, 'delivery_orders', orderId, 'edit', {
    ownerCol: 'created_by', entityType: 'delivery_order',
    entityRef: `Delivery order ${before.order_number || '#' + orderId}`,
    payload: { status }, before
  });
  if (blocked) return blocked;
  await pool.query('update delivery_orders set status=$1 where id=$2', [status, orderId]);
  logAudit(user, `Updated delivery #${orderId} to ${status}`, 'ti-truck-delivery',
    { orderId, status },
    { module: 'deliveries', actionType: 'update', recordId: orderId,
      before: { status: before.status }, after: { status } });
  return { ok: true };
}

async function deliveryOrdersRecordPOD(userId, orderId, payload) {
  const user = await getUser(userId);
  if (!(await mustRole(user, 'deliveries'))) return { ok: false, error: 'Access denied' };
  const p = payload || {};
  const qtyAccepted = Number(p.qty_accepted);
  if (isNaN(qtyAccepted) || qtyAccepted < 0) return { ok: false, error: 'Quantity accepted is required' };

  // Get DO and its linked SO totals
  const { rows: doRows } = await pool.query(
    `select do2.id, do2.qty_dispatched, do2.sales_order_id,
            so.quantity                              as so_quantity,
            coalesce(so.qty_accepted_total,0)        as qty_accepted_total,
            coalesce(so.qty_rejected_total,0)        as qty_rejected_total,
            coalesce(so.qty_returned_to_stock,0)     as qty_returned_to_stock
     from delivery_orders do2
     left join sales_orders so on so.id = do2.sales_order_id
     where do2.id=$1`, [orderId]
  );
  if (!doRows.length) return { ok: false, error: 'Delivery order not found' };
  const doRow = doRows[0];

  const qtyDispatched = doRow.qty_dispatched || qtyAccepted;
  const qtyRejected   = Math.max(0, qtyDispatched - qtyAccepted);

  // Record POD on the delivery order
  await pool.query(
    `update delivery_orders set
       qty_accepted=$1, qty_rejected=$2, rejection_reason=$3,
       pod_recorded_at=now(), pod_recorded_by=$4, status='POD Recorded'
     where id=$5`,
    [qtyAccepted, qtyRejected, p.rejection_reason || null, user.id, orderId]
  );

  // Update the linked Sales Order
  if (doRow.sales_order_id) {
    const newAcceptedTotal       = doRow.qty_accepted_total    + qtyAccepted;
    const newRejectedTotal       = doRow.qty_rejected_total    + qtyRejected;
    const newReturnedToStock     = doRow.qty_returned_to_stock + qtyRejected; // rejected = back to stock
    const newRemaining           = Math.max(0, doRow.so_quantity - newAcceptedTotal);
    const newSoStatus            = newRemaining <= 0 ? 'Fully Delivered' : 'Partially Delivered';

    await pool.query(
      `update sales_orders set
         qty_accepted_total=$1, qty_rejected_total=$2,
         qty_returned_to_stock=$3, qty_remaining=$4, status=$5
       where id=$6`,
      [newAcceptedTotal, newRejectedTotal, newReturnedToStock, newRemaining, newSoStatus, doRow.sales_order_id]
    );
    refreshStockView();
  }

  logAudit(user,
    `POD recorded for delivery #${orderId} — accepted: ${qtyAccepted}, rejected: ${qtyRejected}`,
    'ti-clipboard-check', { orderId, qtyAccepted, qtyRejected }
  );
  return { ok: true };
}

async function salesCloseShort(userId, soId) {
  const user = await getUser(userId);
  if (!(await mustRole(user, 'sales'))) return { ok: false, error: 'Access denied' };
  const { rows } = await pool.query(
    `select order_number, quantity,
            coalesce(qty_accepted_total,0)    as qty_accepted_total,
            coalesce(qty_remaining, quantity) as qty_remaining,
            coalesce(qty_returned_to_stock,0) as qty_returned_to_stock
     from sales_orders where id=$1 and deleted_at is null`, [soId]
  );
  if (!rows.length) return { ok: false, error: 'Order not found' };
  const so = rows[0];
  // Return the undelivered remaining quantity back to stock without touching the original order quantity
  const newReturnedToStock = so.qty_returned_to_stock + so.qty_remaining;
  await pool.query(
    `update sales_orders set
       qty_returned_to_stock=$1, qty_remaining=0, status='Closed (Short)'
     where id=$2`,
    [newReturnedToStock, soId]
  );
  refreshStockView();
  logAudit(user,
    `Closed short SO ${so.order_number} — accepted ${so.qty_accepted_total} of ${so.quantity}, returned ${so.qty_remaining} to stock`,
    'ti-x', { soId }
  );
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
            so.order_number as so_order_number,
            so.customer_name,
            u.name as created_by,
            au.name as approved_by
     from dispatch_requests dr
     left join delivery_orders do2 on do2.id=dr.delivery_order_id
     left join sales_orders so on so.id=do2.sales_order_id
     left join vehicles v on v.id=do2.vehicle_id
     left join app_users u on u.id=dr.created_by
     left join app_users au on au.id=dr.approved_by
     order by dr.created_at desc
     limit 100`
  );
  const { rows: pendingDeliveries } = await pool.query(
    `select do2.id, do2.order_number, do2.driver_name, so.order_number as so_order_number, so.customer_name
     from delivery_orders do2
     left join sales_orders so on so.id=do2.sales_order_id
     where do2.status='Assigned' order by do2.created_at desc`
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
    // Cascade: mark linked sales order as Dispatched
    await pool.query(
      `update sales_orders set status='Dispatched'
       where id=(
         select do2.sales_order_id from dispatch_requests dr
         join delivery_orders do2 on do2.id=dr.delivery_order_id
         where dr.id=$1 and do2.sales_order_id is not null
       )`,
      [requestId]
    );
    refreshStockView();
  }
  logAudit(user, `Dispatch request #${requestId} ${status}`, 'ti-send', { requestId, status });
  return { ok: true };
}

// ── Harvest ───────────────────────────────────────────────────────────────────

async function harvestList(userId, workshopId) {
  const user = await getUser(userId);
  if (!(await mustRole(user, 'harvest'))) return { ok: false, error: 'Access denied' };
  const restricted = isWorkshopRestricted(user);
  const wId = restricted ? user.workshop_id : (workshopId || null);
  const { rows } = await pool.query(
    `select hl.id, hl.location, hl.species, hl.quantity, hl.uom, hl.notes,
            to_char(hl.harvest_date,'DD/MM/YYYY') as harvest_date,
            to_char(hl.created_at,'DD/MM/YYYY') as created_at,
            u.name as logged_by, hl.pending_deletion
     from harvest_logs hl
     left join app_users u on u.id=hl.logged_by
     where hl.deleted_at is null
       and ($1::bigint is null or hl.workshop_id = $1 or hl.workshop_id is null)
     order by hl.harvest_date desc
     limit 100`,
    [wId]
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
  const workshopId = isWorkshopRestricted(user) ? user.workshop_id : (p.workshop_id ? Number(p.workshop_id) : null);
  await pool.query(
    `insert into harvest_logs(location, species, harvest_date, quantity, uom, notes, logged_by, compt_id, sub_name, logs_crosscut, logs_handrolled, workshop_id)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
    [location, p.species, p.harvest_date, Number(p.quantity),
     p.uom || 'trees', p.notes || null, user.id,
     p.compt_id ? Number(p.compt_id) : null, p.sub_name || null,
     logsCrosscut, logsHandrolled, workshopId]
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

async function dailyHarvestData(userId, workshopId) {
  const user = await getUser(userId);
  const userPerms = Array.isArray(user.user_permissions) && user.user_permissions.length
    ? user.user_permissions
    : await getRolePages(user.role);
  if (!userPerms.includes('daily-harvest') && !userPerms.includes('harvest') && !userPerms.includes('daily'))
    return { ok: false, error: 'Access denied' };
  const restricted = isWorkshopRestricted(user);
  const wId = restricted ? user.workshop_id : (workshopId || null);
  const [{ rows }, { rows: compts }] = await Promise.all([
    pool.query(
      `select hl.id, hl.location, hl.species, hl.quantity, hl.uom, hl.notes,
              hl.compt_id, hl.sub_name, hl.logs_crosscut, hl.logs_handrolled,
              to_char(hl.harvest_date,'DD/MM/YYYY') as harvest_date,
              to_char(hl.created_at,'DD/MM/YYYY') as created_at,
              u.name as logged_by,
              c.compt_name, c.area_ha, c.volume_m3 as compt_volume_m3,
              hl.pending_deletion
       from harvest_logs hl
       left join app_users u on u.id=hl.logged_by
       left join compartments c on c.id=hl.compt_id
       where hl.deleted_at is null
         and ($1::bigint is null or hl.workshop_id = $1 or hl.workshop_id is null)
       order by hl.harvest_date desc
       limit 100`,
      [wId]
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
  // Managers see all requests; leader-level approvers see only leader-level requests;
  // everyone else sees only their own submissions.
  let levelFilter = '';
  let params = [];
  if (MANAGER_APPROVERS.includes(user.role)) {
    levelFilter = '';  // no filter — see everything
  } else if (LEADER_APPROVERS.includes(user.role)) {
    levelFilter = `WHERE pe.required_level = 'leader'`;
  } else {
    levelFilter = `WHERE pe.submitted_by = $1`;
    params = [user.id];
  }
  const { rows } = await pool.query(
    `select pe.id, pe.action_type, pe.entity_type, pe.entity_id, pe.entity_ref,
            pe.payload, pe.old_snapshot, pe.status, pe.review_notes,
            pe.required_level, pe.auto_generated, pe.escalation_level,
            pe.first_reminder_at, pe.escalated_at,
            to_char(pe.submitted_at,'DD/MM/YYYY HH24:MI') as submitted_at,
            to_char(pe.reviewed_at,'DD/MM/YYYY HH24:MI') as reviewed_at,
            su.name as submitted_by_name,
            ru.name as reviewed_by_name
     from pending_edits pe
     left join app_users su on su.id=pe.submitted_by
     left join app_users ru on ru.id=pe.reviewed_by
     ${levelFilter}
     order by pe.submitted_at desc
     limit 200`,
    params
  );
  return { ok: true, rows };
}

const ENTITY_TABLE_MAP = {
  daily_log:          'daily_logs',
  harvest_log:        'harvest_logs',
  logistics_item:     'logistics_items',
  sales_order:        'sales_orders',
  machine_daily_log:  'machine_daily_logs',
  compartment:        'compartments',
  value_added_timber: 'value_added_timber',
  log_transport:      'log_transport'
};

async function pendingEditsCreate(userId, payload) {
  const user = await getUser(userId);
  const p = payload || {};
  if (!p.entity_type || !p.entity_id || !p.action_type)
    return { ok: false, error: 'Missing required fields' };

  // Capture old record snapshot for audit trail
  let oldSnapshot = null;
  const tbl = ENTITY_TABLE_MAP[p.entity_type];
  if (tbl) {
    const { rows: snap } = await pool.query(`SELECT * FROM ${tbl} WHERE id=$1`, [p.entity_id]);
    oldSnapshot = snap[0] || null;
  }

  await pool.query(
    `insert into pending_edits(action_type, entity_type, entity_id, entity_ref, payload, old_snapshot, submitted_by)
     values ($1,$2,$3,$4,$5,$6,$7)`,
    [p.action_type, p.entity_type, p.entity_id, p.entity_ref || null,
     p.payload ? JSON.stringify(p.payload) : null,
     oldSnapshot ? JSON.stringify(oldSnapshot) : null, user.id]
  );
  logAudit(user,
    `Submitted ${p.action_type} request for ${p.entity_type} #${p.entity_id}`,
    'ti-send', { entity_type: p.entity_type, entity_id: p.entity_id, old: oldSnapshot, new: p.payload }
  );
  // Notify managers
  pushNotification({
    type: 'amber',
    title: `New ${p.action_type} request — ${p.entity_ref || p.entity_type + ' #' + p.entity_id}`,
    body: `${user.name} has submitted a ${p.action_type} request that requires your approval.`,
    roles: ['admin', 'ceo', 'operations', 'logistics']
  });
  return { ok: true };
}

async function pendingEditsReview(userId, pendingId, status, reviewNotes) {
  // Delegates to the unified Step 3 approval engine which validates required_level.
  return processApprovalDecision(userId, 'edit', pendingId, status, reviewNotes);
}

async function applyPendingEdit(pe) {
  const p = pe.payload || {};

  if (pe.action_type === 'delete') {
    const tableMap = {
      daily_log:          'daily_logs',
      harvest_log:        'harvest_logs',
      logistics_item:     'logistics_items',
      sales_order:        'sales_orders',
      machine_daily_log:  'machine_daily_logs',
      compartment:        'compartments',
      value_added_timber: 'value_added_timber',
      log_transport:      'log_transport'
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
         set log_date=$1, supervisor=$2, operators=$3, timber_units=$4,
             timber_kiln_dried=$5, timber_cca_treated=$6, timber_untreated=$7,
             timber_waste=$8, poles_units=$9, poles_waste=$10,
             downtime_hours=$11, downtime_reason=$12, remarks=$13
         where id=$14`,
        [p.date, p.supervisor || null, p.operators || null, tot, kd, cca, unt,
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
    case 'sales_order':
      await pool.query(
        `update sales_orders
         set order_number=$1, customer_name=$2, product_type=$3, product_sub_type=$4,
             product_size=$5, quantity=$6, unit_price=$7, notes=$8
         where id=$9`,
        [p.order_number, p.customer_name, p.product_type, p.product_sub_type || null,
         p.product_size, Number(p.quantity), Number(p.unit_price), p.notes || null, pe.entity_id]
      );
      break;
    case 'machine_daily_log':
      await pool.query(
        `update machine_daily_logs set hours_worked=$1, downtime_hours=$2, downtime_reason=$3,
           fuel_consumed=$4, daily_production=$5, capacity_per_day=$6, product_type=$7,
           item_category=$8, logs_loaded=$9, logs_unloaded=$10, loading_trips=$11, remarks=$12
         where id=$13`,
        [p.hours_worked || 0, p.downtime_hours || 0, p.downtime_reason || null,
         p.fuel_consumed || 0, p.daily_production || 0, p.capacity_per_day || 0, p.product_type || null,
         p.item_category || null,
         p.logs_loaded || 0, p.logs_unloaded || 0, p.loading_trips || 0, p.remarks || null, pe.entity_id]
      );
      break;
    case 'compartment': {
      const vol = p.area_ha ? Math.round(Number(p.area_ha) * 219 * 100) / 100 : null;
      await pool.query(
        `update compartments set compt_name=$1, sub_name=$2, species=$3, area_ha=$4, volume_m3=$5,
         entry_date=$6, status=$7 where id=$8`,
        [p.compt_name?.trim(), p.sub_name?.trim() || null, p.species, Number(p.area_ha),
         vol, p.entry_date, p.status || 'Active', pe.entity_id]
      );
      break;
    }
    case 'value_added_timber':
      await pool.query(
        `update value_added_timber set entry_date=$1, type_value_added=$2, product_size=$3, num_timber=$4 where id=$5`,
        [p.entry_date, p.type_value_added, p.product_size, Number(p.num_timber), pe.entity_id]
      );
      break;
    case 'log_transport':
      await pool.query(
        `update log_transport set transport_date=$1, compt_id=$2, sub_name=$3, qty_transported=$4,
           unit=$5, notes=$6, tractor_plate=$7, loggers_number=$8 where id=$9`,
        [p.transport_date, p.compt_id ? Number(p.compt_id) : null, p.sub_name || null,
         Number(p.qty_transported), p.unit || 'logs', p.notes || null,
         p.tractor_plate?.trim() || null, p.loggers_number?.trim() || null, pe.entity_id]
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
  const { rows: snap } = await pool.query('SELECT * FROM daily_logs WHERE id=$1', [logId]);
  const before = snap[0] || null;
  const blocked = await applyGovernance(user, 'daily_logs', logId, 'edit', {
    ownerCol: 'created_by', entityType: 'daily_log',
    entityRef: `Daily log #${logId}`, payload, before
  });
  if (blocked) return blocked;
  const p = payload || {};
  if (!p.date) return { ok: false, error: 'Date is required' };
  const kd = Number(p.timber_kiln_dried || 0);
  const cca = Number(p.timber_cca_treated || 0);
  const unt = Number(p.timber_untreated || 0);
  const total = kd + cca + unt || Number(p.timber_units || 0);
  await pool.query(
    `update daily_logs set log_date=$1, supervisor=$2, operators=$3, timber_units=$4,
     timber_kiln_dried=$5, timber_cca_treated=$6, timber_untreated=$7,
     timber_waste=$8, poles_units=$9, poles_waste=$10,
     downtime_hours=$11, downtime_reason=$12, remarks=$13, product_size=$14, machine=$15,
     logs_received=$16
     where id=$17`,
    [p.date, p.supervisor || null, p.operators || null, total, kd, cca, unt,
     Number(p.timber_waste || 0), Number(p.poles_units || 0), Number(p.poles_waste || 0),
     Number(p.downtime_hours || 0), p.downtime_reason || null, p.remarks || null,
     p.product_size || null, p.machine || null, Number(p.logs_received || 0), logId]
  );
  logAudit(user, `Updated daily log #${logId}`, 'ti-edit', { logId, date: p.date });
  refreshStockView();
  refreshStockByWorkshop();
  return { ok: true };
}

async function dailyDelete(userId, logId, reason) {
  const user = await getUser(userId);
  if (!(await canAccessDaily(user))) return { ok: false, error: 'Access denied' };
  const { rows: snap } = await pool.query('SELECT * FROM daily_logs WHERE id=$1 AND deleted_at IS NULL', [logId]);
  if (!snap.length) return { ok: false, error: 'Entry not found' };
  const before = snap[0];
  const blocked = await applyGovernance(user, 'daily_logs', logId, 'delete', {
    ownerCol: 'created_by', entityType: 'daily_log',
    entityRef: `Daily log ${before.log_date || '#' + logId}`, before, reason
  });
  if (blocked) return blocked;
  await pool.query(
    'update daily_logs set deleted_at=now(), deleted_by=$1, deletion_reason=$2, pending_deletion=false where id=$3',
    [user.id, reason || null, logId]
  );
  logAudit(user, `Moved daily log #${logId} to trash`, 'ti-trash', { logId, reason });
  refreshStockView();
  refreshStockByWorkshop();
  return { ok: true };
}

async function salesUpdate(userId, orderId, payload) {
  const user = await getUser(userId);
  if (!(await mustRole(user, 'sales'))) return { ok: false, error: 'Access denied' };
  const { rows: snap } = await pool.query('SELECT * FROM sales_orders WHERE id=$1 AND deleted_at IS NULL', [orderId]);
  const before = snap[0] || null;
  const blocked = await applyGovernance(user, 'sales_orders', orderId, 'edit', {
    ownerCol: 'created_by', entityType: 'sales_order',
    entityRef: `Order ${before?.order_number || '#' + orderId}`, payload, before
  });
  if (blocked) return blocked;
  const p = payload || {};
  if (!p.product_type) return { ok: false, error: 'Product type is required' };
  const priceTaxType = ['Inclusive','Exclusive'].includes(p.price_tax_type) ? p.price_tax_type : 'Exclusive';
  const customerId   = p.customer_id ? Number(p.customer_id) : null;
  let customerName   = p.customer_name || '';
  if (customerId) {
    const { rows: cRows } = await pool.query('select name from customers where id=$1', [customerId]);
    if (cRows.length) customerName = cRows[0].name;
  }
  if (!customerName) return { ok: false, error: 'Customer is required' };
  await pool.query(
    `update sales_orders
     set order_number=$1, customer_name=$2, customer_id=$3, product_type=$4, product_sub_type=$5,
         product_size=$6, quantity=$7, unit_price=$8, currency=$9, price_tax_type=$10,
         payment_due_date=$11, notes=$12
     where id=$13`,
    [p.order_number, customerName, customerId, p.product_type, p.product_sub_type || null,
     p.product_size, Number(p.quantity), Number(p.unit_price),
     p.currency || 'RWF', priceTaxType, p.payment_due_date || null,
     p.notes || null, orderId]
  );
  logAudit(user, `Updated sales order #${orderId}`, 'ti-edit', { orderId });
  refreshStockView();
  return { ok: true };
}

async function salesDelete(userId, orderId, reason) {
  const user = await getUser(userId);
  if (!(await mustRole(user, 'sales'))) return { ok: false, error: 'Access denied' };
  const { rows: snap } = await pool.query('SELECT * FROM sales_orders WHERE id=$1 AND deleted_at IS NULL', [orderId]);
  if (!snap.length) return { ok: false, error: 'Order not found' };
  const before = snap[0];
  const blocked = await applyGovernance(user, 'sales_orders', orderId, 'delete', {
    ownerCol: 'created_by', entityType: 'sales_order',
    entityRef: `Order ${before.order_number || '#' + orderId}`, before, reason
  });
  if (blocked) return blocked;
  await pool.query(
    'update sales_orders set deleted_at=now(), deleted_by=$1, deletion_reason=$2, pending_deletion=false where id=$3',
    [user.id, reason || null, orderId]
  );
  logAudit(user, `Moved sales order ${before.order_number} to trash`, 'ti-trash', { orderId, reason });
  refreshStockView();
  refreshStockByWorkshop();
  return { ok: true };
}

// ── Customer Registry ─────────────────────────────────────────────────────────

async function customersForDropdown(userId) {
  const user = await getUser(userId);
  if (!user) return { ok: false, error: 'Not authenticated' };
  const { rows } = await pool.query(
    `select id, name, contact_person, phone from customers where active = true order by name`
  );
  return { ok: true, rows };
}

async function customersList(userId) {
  const user = await getUser(userId);
  if (!(await mustRole(user, 'customers'))) return { ok: false, error: 'Access denied' };
  const { rows } = await pool.query(
    `select c.id, c.name, c.contact_person, c.phone, c.email, c.address, c.tin, c.notes, c.active,
            to_char(c.created_at,'DD Mon YYYY') as created_at,
            u.name as created_by
     from customers c
     left join app_users u on u.id = c.created_by
     order by c.name`
  );
  return { ok: true, rows };
}

async function customersCreate(userId, payload) {
  const user = await getUser(userId);
  if (!user) return { ok: false, error: 'Not authenticated' };
  const p = payload || {};
  if (!p.name?.trim()) return { ok: false, error: 'Customer name is required' };
  const { rows } = await pool.query(
    `insert into customers(name, contact_person, phone, email, address, tin, notes, created_by)
     values ($1,$2,$3,$4,$5,$6,$7,$8) returning id, name`,
    [p.name.trim(), p.contact_person?.trim() || null, p.phone?.trim() || null,
     p.email?.trim() || null, p.address?.trim() || null, p.tin?.trim() || null,
     p.notes?.trim() || null, user.id]
  );
  logAudit(user, `Registered customer: ${p.name.trim()}`, 'ti-users', { id: rows[0].id });
  return { ok: true, id: rows[0].id, name: rows[0].name };
}

async function customersUpdate(userId, customerId, payload) {
  const user = await getUser(userId);
  if (!(await mustRole(user, 'customers'))) return { ok: false, error: 'Access denied' };
  const { rows: snap } = await pool.query('SELECT * FROM customers WHERE id=$1', [customerId]);
  const before = snap[0] || null;
  const blocked = await applyGovernance(user, 'customers', customerId, 'edit', {
    ownerCol: 'created_by', entityType: 'customer',
    entityRef: `Customer ${before?.name || '#' + customerId}`, payload, before
  });
  if (blocked) return blocked;
  const p = payload || {};
  if (!p.name?.trim()) return { ok: false, error: 'Customer name is required' };
  await pool.query(
    `update customers set name=$1, contact_person=$2, phone=$3, email=$4, address=$5, tin=$6, notes=$7 where id=$8`,
    [p.name.trim(), p.contact_person?.trim() || null, p.phone?.trim() || null,
     p.email?.trim() || null, p.address?.trim() || null, p.tin?.trim() || null,
     p.notes?.trim() || null, customerId]
  );
  logAudit(user, `Updated customer #${customerId}: ${p.name.trim()}`, 'ti-edit', { customerId });
  return { ok: true };
}

async function logisticsUpdate(userId, itemId, payload) {
  const user = await getUser(userId);
  if (!(await mustRole(user, 'logistics'))) return { ok: false, error: 'Access denied' };
  const { rows: snap } = await pool.query('SELECT * FROM logistics_items WHERE id=$1', [itemId]);
  const before = snap[0] || null;
  const blocked = await applyGovernance(user, 'logistics_items', itemId, 'edit', {
    ownerCol: 'created_by', entityType: 'logistics_item',
    entityRef: `Logistics item ${before?.name || '#' + itemId}`, payload, before
  });
  if (blocked) return blocked;
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

async function logisticsDelete(userId, itemId, reason) {
  const user = await getUser(userId);
  if (!(await mustRole(user, 'logistics'))) return { ok: false, error: 'Access denied' };
  const { rows: snap } = await pool.query('SELECT * FROM logistics_items WHERE id=$1', [itemId]);
  if (!snap.length) return { ok: false, error: 'Item not found' };
  const before = snap[0];
  const blocked = await applyGovernance(user, 'logistics_items', itemId, 'delete', {
    ownerCol: 'created_by', entityType: 'logistics_item',
    entityRef: `Logistics item ${before.name || '#' + itemId}`, before, reason
  });
  if (blocked) return blocked;
  await pool.query('delete from logistics_items where id=$1', [itemId]);
  logAudit(user, `Deleted logistics item: ${before.name}`, 'ti-trash', { itemId, reason });
  return { ok: true };
}

async function harvestUpdate(userId, logId, payload) {
  const user = await getUser(userId);
  if (!(await mustRole(user, 'harvest')) && !(await mustRole(user, 'daily-harvest')))
    return { ok: false, error: 'Access denied' };
  const { rows: snap } = await pool.query('SELECT * FROM harvest_logs WHERE id=$1', [logId]);
  const before = snap[0] || null;
  const blocked = await applyGovernance(user, 'harvest_logs', logId, 'edit', {
    ownerCol: 'logged_by', entityType: 'harvest_log',
    entityRef: `Harvest log #${logId}`, payload, before
  });
  if (blocked) return blocked;
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

async function harvestDelete(userId, logId, reason) {
  const user = await getUser(userId);
  if (!(await mustRole(user, 'harvest')) && !(await mustRole(user, 'daily-harvest')))
    return { ok: false, error: 'Access denied' };
  const { rows: snap } = await pool.query('SELECT * FROM harvest_logs WHERE id=$1 AND deleted_at IS NULL', [logId]);
  if (!snap.length) return { ok: false, error: 'Entry not found' };
  const before = snap[0];
  const blocked = await applyGovernance(user, 'harvest_logs', logId, 'delete', {
    ownerCol: 'logged_by', entityType: 'harvest_log',
    entityRef: `Harvest log ${before.harvest_date || '#' + logId}`, before, reason
  });
  if (blocked) return blocked;
  await pool.query(
    'update harvest_logs set deleted_at=now(), deleted_by=$1, deletion_reason=$2, pending_deletion=false where id=$3',
    [user.id, reason || null, logId]
  );
  logAudit(user, `Moved harvest log #${logId} to trash`, 'ti-trash', { logId, reason });
  return { ok: true };
}

async function deliveryOrdersUpdate(userId, orderId, payload) {
  const user = await getUser(userId);
  if (!(await mustRole(user, 'deliveries'))) return { ok: false, error: 'Access denied' };
  const { rows: snap } = await pool.query('SELECT * FROM delivery_orders WHERE id=$1', [orderId]);
  const before = snap[0] || null;
  const blocked = await applyGovernance(user, 'delivery_orders', orderId, 'edit', {
    ownerCol: 'created_by', entityType: 'delivery_order',
    entityRef: `Delivery order ${before?.order_number || '#' + orderId}`, payload, before
  });
  if (blocked) return blocked;
  const p = payload || {};
  await pool.query(
    `update delivery_orders set vehicle_id=$1, driver_name=$2, delivery_date=$3, route=$4, notes=$5, qty_dispatched=$6
     where id=$7`,
    [p.vehicle_id || null, p.driver_name, p.delivery_date || null, p.route || null, p.notes || null,
     p.qty_dispatched ? Number(p.qty_dispatched) : null, orderId]
  );
  logAudit(user, `Updated delivery order #${orderId}`, 'ti-edit', { orderId });
  return { ok: true };
}

async function deliveryOrdersDelete(userId, orderId, reason) {
  const user = await getUser(userId);
  if (!(await mustRole(user, 'deliveries'))) return { ok: false, error: 'Access denied' };
  const { rows: snap } = await pool.query('SELECT * FROM delivery_orders WHERE id=$1', [orderId]);
  if (!snap.length) return { ok: false, error: 'Delivery order not found' };
  const before = snap[0];
  const blocked = await applyGovernance(user, 'delivery_orders', orderId, 'delete', {
    ownerCol: 'created_by', entityType: 'delivery_order',
    entityRef: `Delivery order ${before.order_number || '#' + orderId}`, before, reason
  });
  if (blocked) return blocked;
  await pool.query('delete from dispatch_requests where delivery_order_id=$1', [orderId]);
  await pool.query('delete from delivery_orders where id=$1', [orderId]);
  logAudit(user, `Deleted delivery order ${before.order_number}`, 'ti-trash', { orderId, reason });
  return { ok: true };
}

async function dispatchDelete(userId, requestId, reason) {
  const user = await getUser(userId);
  if (!(await mustRole(user, 'dispatch'))) return { ok: false, error: 'Access denied' };
  const { rows: snap } = await pool.query('SELECT * FROM dispatch_requests WHERE id=$1', [requestId]);
  const before = snap[0] || null;
  const blocked = await applyGovernance(user, 'dispatch_requests', requestId, 'delete', {
    ownerCol: 'created_by', entityType: 'dispatch_request',
    entityRef: `Dispatch request #${requestId}`, before, reason
  });
  if (blocked) return blocked;
  await pool.query('delete from dispatch_requests where id=$1', [requestId]);
  logAudit(user, `Deleted dispatch request #${requestId}`, 'ti-trash', { requestId, reason });
  return { ok: true };
}

async function transportJobsUpdate(userId, jobId, payload) {
  const user = await getUser(userId);
  if (!(await mustRole(user, 'transport'))) return { ok: false, error: 'Access denied' };
  const { rows: snap } = await pool.query('SELECT * FROM transport_jobs WHERE id=$1', [jobId]);
  const before = snap[0] || null;
  const blocked = await applyGovernance(user, 'transport_jobs', jobId, 'edit', {
    ownerCol: 'created_by', entityType: 'transport_job',
    entityRef: `Transport job #${jobId}`, payload, before
  });
  if (blocked) return blocked;
  const p = payload || {};
  const carrierType = p.carrier_type === 'Own Vehicle' ? 'Own Vehicle' : 'Third-party';
  await pool.query(
    `update transport_jobs
     set carrier_type=$1,
         transport_company_id=$2, vehicle_id=$3,
         sales_order_id=$4, job_type=$5,
         origin=$6, destination=$7, job_date=$8, quantity=$9,
         uom=$10, cost=$11, waybill_ref=$12, notes=$13
     where id=$14`,
    [carrierType,
     carrierType === 'Third-party' ? p.transport_company_id : null,
     carrierType === 'Own Vehicle'  ? p.vehicle_id : null,
     p.sales_order_id || null, p.job_type || 'Delivery',
     p.origin || null, p.destination || null, p.job_date,
     p.quantity ? Number(p.quantity) : null, p.uom || null,
     p.cost ? Number(p.cost) : null, p.waybill_ref || null, p.notes || null, jobId]
  );
  logAudit(user, `Updated transport job #${jobId}`, 'ti-edit', { jobId });
  return { ok: true };
}

async function transportJobsDelete(userId, jobId, reason) {
  const user = await getUser(userId);
  if (!(await mustRole(user, 'transport'))) return { ok: false, error: 'Access denied' };
  const { rows: snap } = await pool.query('SELECT * FROM transport_jobs WHERE id=$1', [jobId]);
  const before = snap[0] || null;
  const blocked = await applyGovernance(user, 'transport_jobs', jobId, 'delete', {
    ownerCol: 'created_by', entityType: 'transport_job',
    entityRef: `Transport job #${jobId}`, before, reason
  });
  if (blocked) return blocked;
  await pool.query('delete from transport_jobs where id=$1', [jobId]);
  logAudit(user, `Deleted transport job #${jobId}`, 'ti-trash', { jobId, reason });
  return { ok: true };
}

async function fuelLogsDelete(userId, logId, reason) {
  const user = await getUser(userId);
  if (!(await mustRole(user, 'vehicles'))) return { ok: false, error: 'Access denied' };
  const { rows: snap } = await pool.query('SELECT * FROM fuel_logs WHERE id=$1', [logId]);
  const before = snap[0] || null;
  const blocked = await applyGovernance(user, 'fuel_logs', logId, 'delete', {
    ownerCol: 'logged_by', entityType: 'fuel_log',
    entityRef: `Fuel log #${logId}`, before, reason
  });
  if (blocked) return blocked;
  await pool.query('delete from fuel_logs where id=$1', [logId]);
  logAudit(user, `Deleted fuel log #${logId}`, 'ti-trash', { logId, reason });
  return { ok: true };
}

async function maintenanceDelete(userId, recordId, reason) {
  const user = await getUser(userId);
  if (!(await mustRole(user, 'vehicles'))) return { ok: false, error: 'Access denied' };
  const { rows: snap } = await pool.query('SELECT * FROM maintenance_records WHERE id=$1 AND deleted_at IS NULL', [recordId]);
  if (!snap.length) return { ok: false, error: 'Record not found' };
  const before = snap[0];
  const blocked = await applyGovernance(user, 'maintenance_records', recordId, 'delete', {
    ownerCol: 'created_by', entityType: 'maintenance_record',
    entityRef: `Maintenance record #${recordId}`, before, reason
  });
  if (blocked) return blocked;
  await pool.query(
    'update maintenance_records set deleted_at=now(), deleted_by=$1, deletion_reason=$2, pending_deletion=false where id=$3',
    [user.id, reason || null, recordId]
  );
  logAudit(user, `Moved maintenance record #${recordId} to trash`, 'ti-trash', { recordId, reason });
  return { ok: true };
}

async function stockMovementsDelete(userId, movementId, reason) {
  const user = await getUser(userId);
  if (!(await mustRole(user, 'stock-movements'))) return { ok: false, error: 'Access denied' };
  const { rows: snap } = await pool.query('SELECT * FROM stock_movements WHERE id=$1 AND deleted_at IS NULL', [movementId]);
  if (!snap.length) return { ok: false, error: 'Movement not found' };
  const before = snap[0];
  const blocked = await applyGovernance(user, 'stock_movements', movementId, 'delete', {
    ownerCol: 'created_by', entityType: 'stock_movement',
    entityRef: `Stock movement #${movementId}`, before, reason
  });
  if (blocked) return blocked;
  const { item_id, warehouse_id, to_warehouse_id, movement_type, quantity } = before;
  // Reverse stock levels so inventory stays correct while record is in trash
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
  await pool.query(
    'update stock_movements set deleted_at=now(), deleted_by=$1, deletion_reason=$2, pending_deletion=false where id=$3',
    [user.id, reason || null, movementId]
  );
  logAudit(user, `Moved stock movement #${movementId} (${movement_type}) to trash`, 'ti-trash', { movementId, reason });
  return { ok: true };
}

async function warehousesDelete(userId, warehouseId, reason) {
  const user = await getUser(userId);
  if (!(await mustRole(user, 'warehouses'))) return { ok: false, error: 'Access denied' };
  const { rows: snap } = await pool.query('SELECT * FROM warehouses WHERE id=$1', [warehouseId]);
  if (!snap.length) return { ok: false, error: 'Warehouse not found' };
  const before = snap[0];
  await pool.query('delete from stock_levels where warehouse_id=$1', [warehouseId]);
  await pool.query('delete from warehouses where id=$1', [warehouseId]);
  logAudit(user, `Deleted warehouse: ${before.name}`, 'ti-trash',
    { warehouseId, reason },
    { module: 'warehouses', actionType: 'delete', recordId: warehouseId, before, after: null, reason }
  );
  return { ok: true };
}

async function stockItemsDelete(userId, itemId, reason) {
  const user = await getUser(userId);
  if (!(await mustRole(user, 'stock-items'))) return { ok: false, error: 'Access denied' };
  const { rows: snap } = await pool.query('SELECT * FROM stock_catalog WHERE id=$1', [itemId]);
  if (!snap.length) return { ok: false, error: 'Item not found' };
  const before = snap[0];
  const blocked = await applyGovernance(user, 'stock_catalog', itemId, 'delete', {
    ownerCol: 'created_by', entityType: 'stock_item',
    entityRef: `Stock item ${before.name || '#' + itemId}`, before, reason
  });
  if (blocked) return blocked;
  await pool.query('delete from stock_levels where item_id=$1', [itemId]);
  await pool.query('delete from stock_movements where item_id=$1', [itemId]);
  await pool.query('delete from stock_catalog where id=$1', [itemId]);
  logAudit(user, `Deleted stock item: ${before.name}`, 'ti-trash', { itemId, reason });
  return { ok: true };
}

async function vehiclesDelete(userId, vehicleId, reason) {
  const user = await getUser(userId);
  if (!(await mustRole(user, 'vehicles'))) return { ok: false, error: 'Access denied' };
  const { rows: snap } = await pool.query('SELECT * FROM vehicles WHERE id=$1', [vehicleId]);
  if (!snap.length) return { ok: false, error: 'Vehicle not found' };
  const before = snap[0];
  await pool.query('delete from fuel_logs where vehicle_id=$1', [vehicleId]);
  await pool.query('delete from maintenance_records where vehicle_id=$1 and deleted_at is null', [vehicleId]);
  await pool.query('update delivery_orders set vehicle_id=null where vehicle_id=$1', [vehicleId]);
  await pool.query('delete from vehicles where id=$1', [vehicleId]);
  logAudit(user, `Deleted vehicle: ${before.registration}`, 'ti-trash',
    { vehicleId, reason },
    { module: 'vehicles', actionType: 'delete', recordId: vehicleId, before, after: null, reason }
  );
  return { ok: true };
}

async function transportCompaniesDelete(userId, companyId, reason) {
  const user = await getUser(userId);
  if (!(await mustRole(user, 'transport'))) return { ok: false, error: 'Access denied' };
  const { rows } = await pool.query('select name from transport_companies where id=$1', [companyId]);
  if (!rows.length) return { ok: false, error: 'Company not found' };
  const { rows: jobRows } = await pool.query('select count(*)::int as n from transport_jobs where transport_company_id=$1', [companyId]);
  if (jobRows[0].n > 0) return { ok: false, error: `Cannot delete — ${jobRows[0].n} job(s) recorded for this company. Deactivate it instead.` };
  await pool.query('delete from transport_companies where id=$1', [companyId]);
  logAudit(user, `Deleted transport company: ${rows[0].name}`, 'ti-trash', { companyId, reason });
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
     values ($1,$2,$3,$4,$5,$6,$7) returning id`,
    [p.name, p.contact_person || null, p.phone || null, p.email || null,
     p.rate_per_km ? Number(p.rate_per_km) : null, p.notes || null, p.active !== false]
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
    `select tj.id, tj.job_number, tj.carrier_type, tj.job_type, tj.origin, tj.destination,
            tj.quantity, tj.uom, tj.cost, tj.waybill_ref, tj.status, tj.notes,
            to_char(tj.job_date,'DD/MM/YYYY') as job_date,
            to_char(tj.created_at,'DD/MM/YYYY') as created_at,
            tc.name as company_name, tc.phone as company_phone,
            v.registration as vehicle_registration, v.make as vehicle_make, v.model as vehicle_model,
            so.order_number as sales_order_number, so.customer_name,
            do2.order_number as delivery_order_number,
            u.name as created_by
     from transport_jobs tj
     left join transport_companies tc on tc.id=tj.transport_company_id
     left join vehicles v on v.id=tj.vehicle_id
     left join sales_orders so on so.id=tj.sales_order_id
     left join delivery_orders do2 on do2.id=tj.delivery_order_id
     left join app_users u on u.id=tj.created_by
     order by tj.created_at desc
     limit 100`
  );
  const { rows: companies } = await pool.query(
    `select tc.id, tc.name, tc.contact_person, tc.phone, tc.email, tc.rate_per_km, tc.notes, tc.active,
            (select count(*)::int from transport_jobs tj2 where tj2.transport_company_id=tc.id) as job_count,
            (select coalesce(sum(tj2.cost),0)::numeric from transport_jobs tj2 where tj2.transport_company_id=tc.id) as total_cost
     from transport_companies tc order by tc.name`
  );
  const { rows: salesOrders } = await pool.query(
    `select id, order_number, customer_name, product_type, product_size, quantity, price_tax_type
     from sales_orders
     where status in ('Confirmed','Pending')
     order by created_at desc limit 50`
  );
  const { rows: vehicles } = await pool.query(
    `select id, registration, make, model from vehicles where status='Active' order by registration`
  );
  return { ok: true, rows, companies, salesOrders, vehicles };
}

async function transportJobsCreate(userId, payload) {
  const user = await getUser(userId);
  if (!(await mustRole(user, 'transport'))) return { ok: false, error: 'Access denied' };
  const p = payload || {};
  if (!p.job_date) return { ok: false, error: 'Job date is required' };
  const carrierType = p.carrier_type === 'Own Vehicle' ? 'Own Vehicle' : 'Third-party';
  if (carrierType === 'Third-party' && !p.transport_company_id)
    return { ok: false, error: 'Transport company is required for third-party jobs' };
  if (carrierType === 'Own Vehicle' && !p.vehicle_id)
    return { ok: false, error: 'Vehicle is required for own-vehicle jobs' };
  const ts = Date.now().toString(36).toUpperCase();
  const jobNum = `TRN-${ts}`;
  await pool.query(
    `insert into transport_jobs(job_number, carrier_type, transport_company_id, vehicle_id,
      sales_order_id, delivery_order_id, job_type, origin, destination,
      job_date, quantity, uom, cost, waybill_ref, status, notes, created_by)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,'Scheduled',$15,$16)`,
    [jobNum, carrierType,
     carrierType === 'Third-party' ? p.transport_company_id : null,
     carrierType === 'Own Vehicle'  ? p.vehicle_id : null,
     p.sales_order_id || null, p.delivery_order_id || null,
     p.job_type || 'Delivery', p.origin || null, p.destination || null, p.job_date,
     p.quantity ? Number(p.quantity) : null, p.uom || null,
     p.cost ? Number(p.cost) : null, p.waybill_ref || null, p.notes || null, user.id]
  );
  logAudit(user, `Created transport job ${jobNum} (${carrierType})`, 'ti-truck', {
    carrier_type: carrierType, transport_company_id: p.transport_company_id, vehicle_id: p.vehicle_id
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
            round(coalesce(sum(hl.logs_crosscut::numeric / 3.4),0)::numeric, 2) as volume_harvested_m3,
            c.pending_deletion
     from compartments c
     left join app_users u on u.id=c.created_by
     left join harvest_logs hl on hl.compt_id=c.id and hl.deleted_at is null
     where c.deleted_at is null
     group by c.id, c.compt_name, c.sub_name, c.species, c.area_ha, c.volume_m3, c.status,
              c.entry_date, c.created_at, u.name, c.pending_deletion
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
  const { rows: snap } = await pool.query('SELECT * FROM compartments WHERE id=$1', [comptId]);
  const before = snap[0] || null;
  const volume_m3 = p.area_ha ? Math.round(Number(p.area_ha) * 219 * 100) / 100 : undefined;
  await pool.query(
    `update compartments set compt_name=$1, sub_name=$2, species=$3, area_ha=$4, volume_m3=$5,
     entry_date=$6, status=$7 where id=$8`,
    [p.compt_name.trim(), p.sub_name?.trim() || null, p.species, Number(p.area_ha),
     volume_m3, p.entry_date, p.status || 'Active', comptId]
  );
  logAudit(user, `Updated compartment: ${p.compt_name.trim()}`, 'ti-edit',
    { comptId },
    { module: 'compartments', actionType: 'edit', recordId: comptId, before, after: p }
  );
  return { ok: true };
}

async function compartmentsDelete(userId, comptId, reason) {
  const user = await getUser(userId);
  if (!['admin','ceo','operations'].includes(user.role))
    return { ok: false, error: 'Access denied' };
  const { rows } = await pool.query('select compt_name from compartments where id=$1 and deleted_at is null', [comptId]);
  if (!rows.length) return { ok: false, error: 'Compartment not found' };
  await pool.query(
    'update compartments set deleted_at=now(), deleted_by=$1, deletion_reason=$2, pending_deletion=false where id=$3',
    [user.id, reason || null, comptId]
  );
  logAudit(user, `Moved compartment ${rows[0].compt_name} to trash`, 'ti-trash', { comptId, reason });
  return { ok: true };
}

async function compartmentsForDropdown(userId) {
  const user = await getUser(userId);
  const { rows } = await pool.query(
    `select c.id, c.compt_name, c.sub_name, c.species, c.area_ha, c.volume_m3, c.status,
            round(coalesce(sum(hl.logs_crosscut::numeric / 3.4),0)::numeric, 2) as volume_harvested_m3
     from compartments c
     left join harvest_logs hl on hl.compt_id=c.id and hl.deleted_at is null
     where c.deleted_at is null
     group by c.id, c.compt_name, c.sub_name, c.species, c.area_ha, c.volume_m3, c.status
     order by c.compt_name`
  );
  return { ok: true, rows };
}

// ── Log Transport ─────────────────────────────────────────────────────────────

async function logTransportList(userId, workshopId) {
  const user = await getUser(userId);
  if (!(await mustRole(user, 'log-transport')) && !['admin','ceo','operations','logistics','supervisor'].includes(user.role))
    return { ok: false, error: 'Access denied' };
  const restricted = isWorkshopRestricted(user);
  const wId = restricted ? user.workshop_id : (workshopId || null);
  const [{ rows }, { rows: totals }] = await Promise.all([
    pool.query(
      `select lt.id, lt.transport_date, lt.qty_transported, lt.unit, lt.notes, lt.sub_name,
              lt.tractor_plate, lt.loggers_number,
              to_char(lt.transport_date,'DD/MM/YYYY') as date_fmt,
              to_char(lt.created_at,'DD/MM/YYYY') as created_at,
              c.compt_name, c.species, c.volume_m3 as compt_volume_m3,
              u.name as logged_by_name, lt.pending_deletion
       from log_transport lt
       left join compartments c on c.id=lt.compt_id
       left join app_users u on u.id=lt.logged_by
       where lt.deleted_at is null
         and ($1::bigint is null or lt.workshop_id = $1 or lt.workshop_id is null)
       order by lt.transport_date desc
       limit 200`,
      [wId]
    ),
    pool.query(
      `select
         coalesce(sum(hl.logs_handrolled),0)::int                              as total_logs_harvested,
         coalesce((select sum(qty_transported) from log_transport
                   where $1::bigint is null or workshop_id = $1 or workshop_id is null),0)::int as total_logs_transported,
         round(coalesce(sum(hl.logs_handrolled::numeric / 3.4),0)::numeric, 2) as total_volume_m3
       from harvest_logs hl
       where $1::bigint is null or hl.workshop_id = $1 or hl.workshop_id is null`,
      [wId]
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
  const workshopId = isWorkshopRestricted(user) ? user.workshop_id : (p.workshop_id ? Number(p.workshop_id) : null);
  await pool.query(
    `insert into log_transport(transport_date, compt_id, sub_name, qty_transported, unit, notes, logged_by, tractor_plate, loggers_number, workshop_id)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
    [p.transport_date, p.compt_id ? Number(p.compt_id) : null, p.sub_name || null,
     Number(p.qty_transported), p.unit || 'logs', p.notes || null, user.id,
     p.tractor_plate?.trim() || null, p.loggers_number?.trim() || null, workshopId]
  );
  logAudit(user, `Log transport entry: ${p.qty_transported} logs`, 'ti-truck', { ...p });
  return { ok: true };
}

async function logTransportDelete(userId, id, reason) {
  const user = await getUser(userId);
  if (!(await mustRole(user, 'log-transport')) && !['admin','ceo','operations'].includes(user.role))
    return { ok: false, error: 'Access denied' };
  const { rows: snap } = await pool.query('SELECT * FROM log_transport WHERE id=$1 AND deleted_at IS NULL', [id]);
  if (!snap.length) return { ok: false, error: 'Entry not found' };
  const before = snap[0];
  const blocked = await applyGovernance(user, 'log_transport', id, 'delete', {
    ownerCol: 'logged_by', entityType: 'log_transport',
    entityRef: `Log transport ${before.transport_date || '#' + id}`, before, reason
  });
  if (blocked) return blocked;
  await pool.query(
    'update log_transport set deleted_at=now(), deleted_by=$1, deletion_reason=$2, pending_deletion=false where id=$3',
    [user.id, reason || null, id]
  );
  logAudit(user, `Moved log transport #${id} to trash`, 'ti-trash', { id, reason });
  return { ok: true };
}

// ── Value-Added Timber ───────────────────────────────────────────────────────

async function vatInboundList(userId) {
  const user = await getUser(userId);
  if (!(await mustRole(user, 'value-added-timber')) && !['admin','ceo','operations','supervisor'].includes(user.role))
    return { ok: false, error: 'Access denied' };
  // Nyanza Workshop warehouse_id = 4; show stock transfers received at Nyanza
  const { rows } = await pool.query(
    `select st.id, coalesce(sc.name, st.notes, 'Unknown') as product_size,
            st.requested_qty, st.received_qty,
            to_char(st.requested_at,'DD/MM/YYYY') as requested_date,
            st.status,
            coalesce(
              (select sum(vt.num_timber) from value_added_timber vt
               where vt.source_transfer_id = st.id and vt.deleted_at is null),
            0)::int as intake_used
     from stock_transfers st
     left join stock_catalog sc on sc.id = st.item_id
     where st.to_warehouse_id = 4
       and st.status in ('received','partially_received')
       and st.received_qty > 0
       and st.deleted_at is null
     order by st.requested_at desc`
  );
  return { ok: true, rows };
}

async function valueAddedTimberList(userId, workshopId) {
  const user = await getUser(userId);
  if (!(await mustRole(user, 'value-added-timber')) && !['admin','ceo','operations','supervisor'].includes(user.role))
    return { ok: false, error: 'Access denied' };
  const restricted = isWorkshopRestricted(user);
  const wId = restricted ? user.workshop_id : (workshopId || null);
  const { rows } = await pool.query(
    `select vt.id, vt.type_value_added, vt.product_size, vt.num_timber,
            vt.source_transfer_id,
            to_char(vt.entry_date,'DD/MM/YYYY') as date_fmt,
            to_char(vt.created_at,'DD/MM/YYYY') as created_at,
            u.name as created_by_name, vt.pending_deletion
     from value_added_timber vt
     left join app_users u on u.id=vt.created_by
     where vt.deleted_at is null
       and ($1::bigint is null or vt.workshop_id = $1 or vt.workshop_id is null)
     order by vt.entry_date desc
     limit 200`,
    [wId]
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
  const workshopId = isWorkshopRestricted(user) ? user.workshop_id : (p.workshop_id ? Number(p.workshop_id) : null);

  // ADM-31: validate intake against inbound when a source transfer is selected
  const sourceTransferId = p.source_transfer_id ? Number(p.source_transfer_id) : null;
  if (sourceTransferId) {
    const { rows: [st] } = await pool.query(
      `select received_qty,
              coalesce((select sum(vt.num_timber) from value_added_timber vt where vt.source_transfer_id=$1 and vt.deleted_at is null),0)::int as intake_used
       from stock_transfers where id=$1`,
      [sourceTransferId]
    );
    if (!st) return { ok: false, error: 'Source transfer not found' };
    const available = Math.max(0, Number(st.received_qty) - Number(st.intake_used));
    if (Number(p.num_timber) > available) {
      return { ok: false, error: `Intake (${p.num_timber}) exceeds available inbound timber for this transfer (${available} remaining)` };
    }
  }

  await pool.query(
    `insert into value_added_timber(entry_date, type_value_added, product_size, num_timber, source_transfer_id, created_by, workshop_id)
     values ($1,$2,$3,$4,$5,$6,$7)`,
    [p.entry_date, p.type_value_added, p.product_size, Number(p.num_timber), sourceTransferId, user.id, workshopId]
  );
  logAudit(user, `Value-added timber: ${p.num_timber} × ${p.product_size} (${p.type_value_added})`, 'ti-trees', { ...p });
  refreshStockByWorkshop();
  return { ok: true };
}

async function valueAddedTimberDelete(userId, id, reason) {
  const user = await getUser(userId);
  if (!(await mustRole(user, 'value-added-timber')) && !['admin','ceo','operations'].includes(user.role))
    return { ok: false, error: 'Access denied' };
  const { rows: snap } = await pool.query('SELECT * FROM value_added_timber WHERE id=$1 AND deleted_at IS NULL', [id]);
  if (!snap.length) return { ok: false, error: 'Entry not found' };
  const before = snap[0];
  const blocked = await applyGovernance(user, 'value_added_timber', id, 'delete', {
    ownerCol: 'created_by', entityType: 'value_added_timber',
    entityRef: `VAT entry ${before.entry_date || '#' + id}`, before, reason
  });
  if (blocked) return blocked;
  await pool.query(
    'update value_added_timber set deleted_at=now(), deleted_by=$1, deletion_reason=$2, pending_deletion=false where id=$3',
    [user.id, reason || null, id]
  );
  logAudit(user, `Moved value-added timber #${id} to trash`, 'ti-trash', { id, reason });
  refreshStockByWorkshop();
  return { ok: true };
}

// ── Machine Fuel / Consumption Logs ──────────────────────────────────────────

async function machineFuelSummary(userId, month) {
  const user = await getUser(userId);
  if (!(await mustRole(user, 'machine-fuel')) && !['admin','ceo','operations','logistics','supervisor'].includes(user.role))
    return { ok: false, error: 'Access denied' };

  const monthFilter = month || null;
  const params = monthFilter ? [monthFilter] : [];
  const dateWhere = monthFilter ? `and to_char(log_date,'YYYY-MM') = $1` : '';

  // Per-machine reconciliation: fuel issued (from fuel logs) vs fuel consumed (from daily logs)
  const { rows: byMachine } = await pool.query(`
    select
      m.id,
      m.machine_code,
      m.name  as machine_name,
      mc.name as category_name,
      coalesce(fi.issued,   0)::numeric as fuel_issued,
      coalesce(fc.consumed, 0)::numeric as fuel_consumed,
      (coalesce(fi.issued, 0) - coalesce(fc.consumed, 0))::numeric as variance
    from machines m
    join machine_categories mc on mc.id = m.category_id
    left join (
      select machine_id, sum(quantity)::numeric as issued
      from machine_fuel_logs
      where deleted_at is null ${dateWhere}
      group by machine_id
    ) fi on fi.machine_id = m.id
    left join (
      select machine_id, sum(fuel_consumed)::numeric as consumed
      from machine_daily_logs
      where deleted_at is null ${dateWhere}
      group by machine_id
    ) fc on fc.machine_id = m.id
    where m.active = true
      and (fi.machine_id is not null or fc.machine_id is not null)
    order by m.machine_code
  `, params);

  // Per-date reconciliation (last 30 entries across all machines)
  const { rows: byDate } = await pool.query(`
    select
      to_char(d.log_date,'DD/MM/YYYY') as date_fmt,
      d.log_date,
      m.machine_code,
      m.name as machine_name,
      coalesce(fi.issued, 0)::numeric   as fuel_issued,
      coalesce(mdl.fuel_consumed, 0)::numeric as fuel_consumed,
      (coalesce(fi.issued, 0) - coalesce(mdl.fuel_consumed, 0))::numeric as variance
    from (
      select machine_id, log_date from machine_fuel_logs where deleted_at is null ${dateWhere}
      union
      select machine_id, log_date from machine_daily_logs  where deleted_at is null ${dateWhere}
    ) d
    join machines m on m.id = d.machine_id
    left join (
      select machine_id, log_date, sum(quantity)::numeric as issued
      from machine_fuel_logs where deleted_at is null
      group by machine_id, log_date
    ) fi on fi.machine_id = d.machine_id and fi.log_date = d.log_date
    left join (
      select machine_id, log_date, sum(fuel_consumed)::numeric as fuel_consumed
      from machine_daily_logs where deleted_at is null
      group by machine_id, log_date
    ) mdl on mdl.machine_id = d.machine_id and mdl.log_date = d.log_date
    order by d.log_date desc, m.machine_code
    limit 60
  `, params);

  return { ok: true, byMachine, byDate };
}

async function machineFuelLogsList(userId) {
  const user = await getUser(userId);
  if (!(await mustRole(user, 'machine-fuel')) && !['admin','ceo','operations','logistics','supervisor'].includes(user.role))
    return { ok: false, error: 'Access denied' };
  const { rows } = await pool.query(
    `select mfl.id, mfl.log_date, mfl.operator, mfl.fuel_type, mfl.quantity, mfl.unit, mfl.notes,
            to_char(mfl.log_date,'DD/MM/YYYY') as date_fmt,
            coalesce(m.machine_code, v.registration) as machine_code,
            coalesce(m.name, trim(coalesce(v.make,'') || case when v.model is not null then ' '||v.model else '' end)) as machine_name,
            coalesce(m.plate_number, v.registration) as plate_number,
            u.name as logged_by_name, mfl.pending_deletion
     from machine_fuel_logs mfl
     left join machines m on m.id=mfl.machine_id
     left join vehicles v on v.id=mfl.vehicle_id
     left join app_users u on u.id=mfl.logged_by
     where mfl.deleted_at is null
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
  const machineId = p.machine_id ? Number(p.machine_id) : null;
  const vehicleId = p.vehicle_id ? Number(p.vehicle_id) : null;
  if (!machineId && !vehicleId) return { ok: false, error: 'Machine or vehicle is required' };
  if (!p.fuel_type) return { ok: false, error: 'Fuel type is required' };
  if (!p.quantity || Number(p.quantity) < 0) return { ok: false, error: 'Quantity is required' };
  await pool.query(
    `insert into machine_fuel_logs(log_date, machine_id, vehicle_id, operator, fuel_type, quantity, unit, notes, logged_by)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [p.log_date, machineId, vehicleId, p.operator?.trim() || null,
     p.fuel_type, Number(p.quantity), p.unit || 'liters', p.notes?.trim() || null, user.id]
  );
  logAudit(user, `Machine fuel log: ${p.fuel_type} ${p.quantity}L — ${machineId ? 'machine #'+machineId : 'vehicle #'+vehicleId}`, 'ti-droplet', { ...p });
  return { ok: true };
}

async function machineFuelLogsDelete(userId, id, reason) {
  const user = await getUser(userId);
  if (!(await mustRole(user, 'machine-fuel')) && !['admin','ceo','operations','logistics'].includes(user.role))
    return { ok: false, error: 'Access denied' };
  const { rows: snap } = await pool.query('SELECT * FROM machine_fuel_logs WHERE id=$1 AND deleted_at IS NULL', [id]);
  if (!snap.length) return { ok: false, error: 'Entry not found' };
  const before = snap[0];
  const blocked = await applyGovernance(user, 'machine_fuel_logs', id, 'delete', {
    ownerCol: 'logged_by', entityType: 'machine_fuel_log',
    entityRef: `Machine fuel log ${before.log_date || '#' + id}`, before, reason
  });
  if (blocked) return blocked;
  await pool.query(
    'update machine_fuel_logs set deleted_at=now(), deleted_by=$1, deletion_reason=$2, pending_deletion=false where id=$3',
    [user.id, reason || null, id]
  );
  logAudit(user, `Moved machine fuel log #${id} to trash`, 'ti-trash', { id, reason });
  return { ok: true };
}

// ── Casual Labour Requests ────────────────────────────────────────────────────

async function casualLabourRequestsList(userId, workshopId) {
  const user = await getUser(userId);
  if (!(await mustRole(user, 'casual-requests')) && !['admin','ceo','operations','supervisor'].includes(user.role))
    return { ok: false, error: 'Access denied' };
  const restricted = isWorkshopRestricted(user);
  const wId = restricted ? user.workshop_id : (workshopId || null);
  const { rows } = await pool.query(
    `select clr.id, clr.start_date, clr.end_date, clr.task, clr.num_casuals,
            clr.labour_items, clr.description, clr.comments, clr.status,
            to_char(clr.start_date,'DD/MM/YYYY') as start_fmt,
            to_char(clr.end_date,'DD/MM/YYYY') as end_fmt,
            to_char(clr.created_at,'DD/MM/YYYY') as created_fmt,
            u.name as created_by_name, rv.name as reviewed_by_name
     from casual_labour_requests clr
     left join app_users u on u.id=clr.created_by
     left join app_users rv on rv.id=clr.reviewed_by
     where ($1::bigint is null or clr.workshop_id = $1 or clr.workshop_id is null)
     order by clr.start_date desc
     limit 200`,
    [wId]
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
  const items = Array.isArray(p.labour_items) && p.labour_items.length ? p.labour_items : null;
  const workshopId = isWorkshopRestricted(user) ? user.workshop_id : (p.workshop_id ? Number(p.workshop_id) : null);
  await pool.query(
    `insert into casual_labour_requests(start_date, end_date, task, num_casuals, labour_items, description, comments, created_by, workshop_id)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [p.start_date, p.end_date, p.task.trim(), Number(p.num_casuals),
     items ? JSON.stringify(items) : null,
     p.description?.trim() || null, p.comments?.trim() || null, user.id, workshopId]
  );
  logAudit(user, `Casual request: ${p.num_casuals} casuals for "${p.task}"`, 'ti-users', { ...p });
  return { ok: true };
}

async function casualLabourRequestsSubmit(userId, payload) {
  const user = await getUser(userId);
  if (!(await mustRole(user, 'casual-requests')) && !['admin','ceo','operations','supervisor'].includes(user.role))
    return { ok: false, error: 'Access denied' };
  const p = payload || {};
  if (!p.start_date) return { ok: false, error: 'Start date is required' };
  if (!p.end_date) return { ok: false, error: 'End date is required' };
  if (!p.task?.trim()) return { ok: false, error: 'Task is required' };
  if (!p.num_casuals || Number(p.num_casuals) <= 0) return { ok: false, error: 'Number of casuals must be > 0' };
  const items = Array.isArray(p.labour_items) && p.labour_items.length ? p.labour_items : null;
  const workshopId = isWorkshopRestricted(user) ? user.workshop_id : (p.workshop_id ? Number(p.workshop_id) : null);
  await pool.query(
    `insert into casual_labour_requests
       (start_date, end_date, task, num_casuals, labour_items, description, comments, created_by, workshop_id)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [p.start_date, p.end_date, p.task.trim(), Number(p.num_casuals),
     items ? JSON.stringify(items) : null,
     p.description?.trim() || null, p.comments?.trim() || null, user.id, workshopId]
  );
  logAudit(user, `Casual request submitted: ${p.num_casuals} casuals for "${p.task}"`, 'ti-users', { ...p });
  return { ok: true };
}

async function casualLabourRequestsReview(userId, requestId, status) {
  const user = await getUser(userId);
  if (!['ceo','operations'].includes(user.role)) return { ok: false, error: 'Access denied' };
  const valid = ['Approved', 'Rejected'];
  if (!valid.includes(status)) return { ok: false, error: 'Invalid status' };
  await pool.query(
    `update casual_labour_requests set status=$1, reviewed_by=$2, reviewed_at=now() where id=$3`,
    [status, user.id, requestId]
  );
  logAudit(user, `Casual request #${requestId} ${status}`, 'ti-users', { requestId, status });
  return { ok: true };
}

async function casualLabourRequestsDelete(userId, id, reason) {
  const user = await getUser(userId);
  if (!(await mustRole(user, 'casual-requests')) && !['admin','ceo','operations'].includes(user.role))
    return { ok: false, error: 'Access denied' };
  const { rows: snap } = await pool.query('SELECT * FROM casual_labour_requests WHERE id=$1', [id]);
  const before = snap[0] || null;
  const blocked = await applyGovernance(user, 'casual_labour_requests', id, 'delete', {
    ownerCol: 'created_by', entityType: 'casual_request',
    entityRef: `Casual labour request #${id}`, before, reason
  });
  if (blocked) return blocked;
  await pool.query('delete from casual_labour_requests where id=$1', [id]);
  logAudit(user, `Deleted casual request #${id}`, 'ti-trash', { id, reason });
  return { ok: true };
}

// ── Casuals ───────────────────────────────────────────────────────────────────

async function casualsList(userId, workshopId) {
  const user = await getUser(userId);
  if (!(await mustRole(user, 'casuals')) && !['admin','ceo','operations','supervisor'].includes(user.role))
    return { ok: false, error: 'Access denied' };
  const restricted = isWorkshopRestricted(user);
  const wId = restricted ? user.workshop_id : (workshopId || null);
  const { rows } = await pool.query(
    `select c.id, c.full_name, c.national_id, c.phone, c.gender, c.date_of_birth,
            c.address, c.department, c.work_location, c.job_role, c.supervisor,
            c.start_date, c.end_date, c.emergency_name, c.emergency_relationship,
            c.emergency_phone, c.salary_per_action, c.active,
            to_char(c.start_date,'DD/MM/YYYY') as start_fmt,
            to_char(c.end_date,'DD/MM/YYYY') as end_fmt,
            to_char(c.created_at,'DD/MM/YYYY') as created_fmt
     from casuals c
     where ($1::bigint is null or c.workshop_id = $1 or c.workshop_id is null)
     order by c.full_name`,
    [wId]
  );
  return { ok: true, rows };
}

async function casualsCreate(userId, payload) {
  const user = await getUser(userId);
  if (!(await mustRole(user, 'casuals')) && !['admin','ceo','operations','supervisor'].includes(user.role))
    return { ok: false, error: 'Access denied' };
  const p = payload || {};
  if (!p.full_name?.trim()) return { ok: false, error: 'Full name is required' };
  const workshopId = isWorkshopRestricted(user) ? user.workshop_id : (p.workshop_id ? Number(p.workshop_id) : null);
  const { rows } = await pool.query(
    `insert into casuals(full_name, national_id, phone, gender, date_of_birth, address,
       department, work_location, job_role, supervisor, start_date, end_date,
       emergency_name, emergency_relationship, emergency_phone, salary_per_action, created_by, workshop_id)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
     returning id`,
    [p.full_name.trim(), p.national_id?.trim() || null, p.phone?.trim() || null,
     p.gender?.trim() || null, p.date_of_birth || null, p.address?.trim() || null,
     p.department?.trim() || null, p.work_location?.trim() || null,
     p.job_role?.trim() || null, p.supervisor?.trim() || null,
     p.start_date || null, p.end_date || null,
     p.emergency_name?.trim() || null, p.emergency_relationship?.trim() || null,
     p.emergency_phone?.trim() || null,
     p.salary_per_action ? Number(p.salary_per_action) : null, user.id, workshopId]
  );
  logAudit(user, `Casual registered: ${p.full_name}`, 'ti-user-plus', { id: rows[0].id, name: p.full_name });
  return { ok: true, id: rows[0].id };
}

async function casualsUpdate(userId, casualId, payload) {
  const user = await getUser(userId);
  if (!['admin','ceo','operations'].includes(user.role)) return { ok: false, error: 'Access denied' };
  const p = payload || {};
  if (!p.full_name?.trim()) return { ok: false, error: 'Full name is required' };
  const { rows: snap } = await pool.query('SELECT * FROM casuals WHERE id=$1', [casualId]);
  const before = snap[0] || null;
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
  logAudit(user, `Updated casual: ${p.full_name.trim()}`, 'ti-edit',
    { casualId },
    { module: 'casuals', actionType: 'edit', recordId: casualId, before, after: p }
  );
  return { ok: true };
}

async function casualsDelete(userId, casualId, reason) {
  const user = await getUser(userId);
  if (!['admin','ceo','operations'].includes(user.role)) return { ok: false, error: 'Access denied' };
  const { rows } = await pool.query('select full_name from casuals where id=$1', [casualId]);
  if (!rows.length) return { ok: false, error: 'Casual not found' };
  await pool.query('delete from casuals where id=$1', [casualId]);
  logAudit(user, `Deleted casual: ${rows[0].full_name}`, 'ti-trash', { casualId, reason });
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

// ── Deletion Request Workflow ─────────────────────────────────────────────────

const SOFT_DELETE_ALLOWED = new Set([
  'daily_logs','harvest_logs','value_added_timber','machine_daily_logs',
  'compartments','log_transport','machine_fuel_logs','maintenance_records',
  'sales_orders','stock_movements'
]);

async function deletionRequestCreate(userId, { tableName, recordId, entityType, entityRef, reason }) {
  const user = await getUser(userId);
  if (!reason?.trim()) return { ok: false, error: 'Deletion reason is required' };
  if (!SOFT_DELETE_ALLOWED.has(tableName)) return { ok: false, error: 'Invalid table' };
  const { rows: existing } = await pool.query(
    `SELECT id FROM ${tableName} WHERE id=$1 AND deleted_at IS NULL`, [recordId]
  );
  if (!existing.length) return { ok: false, error: 'Record not found' };
  const { rows: snap } = await pool.query(`SELECT * FROM ${tableName} WHERE id=$1`, [recordId]);
  await pool.query(`UPDATE ${tableName} SET pending_deletion=TRUE WHERE id=$1`, [recordId]);
  const { rows: [req] } = await pool.query(
    `INSERT INTO deletion_requests(table_name,record_id,entity_type,entity_ref,deletion_reason,requested_by,record_snapshot)
     VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
    [tableName, recordId, entityType, entityRef || null, reason.trim(), user.id, JSON.stringify(snap[0] || {})]
  );
  logAudit(user, `Deletion request submitted for ${entityType} #${recordId}`, 'ti-hourglass', { tableName, recordId, reason });
  // Notify managers
  pushNotification({
    type: 'red',
    title: `Deletion request — ${entityRef || entityType + ' #' + recordId}`,
    body: `${user.name} has requested deletion of a ${entityType} record. Reason: ${reason.trim()}`,
    roles: ['admin', 'ceo', 'operations']
  });
  return { ok: true, requestId: req.id };
}

async function deletionRequestsList(userId) {
  const user = await getUser(userId);
  const canSeeAll  = MANAGER_APPROVERS.includes(user.role);
  const canSeeLeader = LEADER_APPROVERS.includes(user.role);
  if (!canSeeAll && !canSeeLeader) return { ok: false, error: 'Access denied' };

  const levelFilter = canSeeAll ? '' : `AND dr.required_level = 'leader'`;
  const { rows } = await pool.query(`
    SELECT dr.*, u.name as requested_by_name, rv.name as reviewed_by_name,
           to_char(dr.requested_at,'DD/MM/YYYY HH24:MI') as requested_at_fmt
    FROM deletion_requests dr
    LEFT JOIN app_users u  ON u.id  = dr.requested_by
    LEFT JOIN app_users rv ON rv.id = dr.reviewed_by
    WHERE dr.status = 'pending' ${levelFilter}
    ORDER BY dr.requested_at DESC
  `);
  return { ok: true, rows };
}

async function deletionRequestApprove(userId, requestId, notes) {
  return processApprovalDecision(userId, 'delete', requestId, 'Approved', notes);
}

async function deletionRequestReject(userId, requestId, notes) {
  return processApprovalDecision(userId, 'delete', requestId, 'Rejected', notes);
}

// ── Step 3: Approval Workflow Engine ─────────────────────────────────────────

// Single unified handler for approving OR rejecting any approval request.
// requestType: 'edit'   → works against pending_edits table
// requestType: 'delete' → works against deletion_requests table
// decision:    'Approved' | 'Rejected'
async function processApprovalDecision(userId, requestType, requestId, decision, notes) {
  const user = await getUser(userId);
  const isEdit = requestType === 'edit';

  const { rows } = await pool.query(
    isEdit
      ? 'SELECT * FROM pending_edits WHERE id=$1'
      : 'SELECT * FROM deletion_requests WHERE id=$1',
    [requestId]
  );
  if (!rows.length) return { ok: false, error: 'Request not found' };
  const req = rows[0];

  // Prevent double approval
  const currentStatus = req.status;
  if (currentStatus !== (isEdit ? 'Pending' : 'pending'))
    return { ok: false, error: 'This request has already been reviewed' };

  // Validate approver role against required_level
  const level = req.required_level || 'manager';
  const allowedRoles = level === 'leader' ? LEADER_APPROVERS : MANAGER_APPROVERS;
  if (!allowedRoles.includes(user.role))
    return { ok: false, error: `Your role (${user.role}) cannot approve ${level}-level requests` };

  const approved = decision === 'Approved';

  // Apply the change when approved
  if (approved) {
    try {
      if (isEdit) {
        await applyPendingEdit(req);
      } else {
        if (!SOFT_DELETE_ALLOWED.has(req.table_name)) return { ok: false, error: 'Invalid table' };
        await pool.query(
          `UPDATE ${req.table_name}
           SET deleted_at=NOW(), deleted_by=$1, deletion_reason=$2, pending_deletion=FALSE
           WHERE id=$3`,
          [user.id, req.deletion_reason, req.record_id]
        );
        if (['daily_logs', 'sales_orders', 'stock_movements'].includes(req.table_name)) {
          refreshStockView();
          refreshStockByWorkshop();
        }
      }
    } catch (e) {
      return { ok: false, error: `Could not apply change: ${e.message}` };
    }
  } else {
    // On rejection clear pending_deletion flag so the record becomes visible again
    if (!isEdit && SOFT_DELETE_ALLOWED.has(req.table_name)) {
      await pool.query(
        `UPDATE ${req.table_name} SET pending_deletion=FALSE WHERE id=$1`,
        [req.record_id]
      );
    }
  }

  // Update the request status
  const dbTable  = isEdit ? 'pending_edits' : 'deletion_requests';
  const dbStatus = isEdit
    ? (approved ? 'Approved' : 'Rejected')
    : (approved ? 'approved' : 'rejected');
  await pool.query(
    `UPDATE ${dbTable} SET status=$1, reviewed_by=$2, reviewed_at=NOW(), review_notes=$3 WHERE id=$4`,
    [dbStatus, user.id, notes || null, requestId]
  );

  // Cancel any pending escalation/reminder jobs for this request — no longer needed
  const jPrefix = isEdit ? 'pe' : 'dr';
  await pool.query(
    `UPDATE workflow_jobs SET status='done', processed_at=now()
     WHERE idempotency_key IN ($1, $2) AND status='pending'`,
    [`reminder_${jPrefix}_${requestId}`, `escalate_${jPrefix}_${requestId}`]
  );

  // Audit log with full before/after trail
  const entityRef   = req.entity_ref || `${req.entity_type || req.table_name} #${req.entity_id || req.record_id}`;
  const actionLabel = isEdit ? (req.action_type || 'edit') : 'delete';
  const before      = req.old_snapshot || req.record_snapshot || null;
  const after       = approved && isEdit ? (req.payload || null) : null;
  logAudit(user,
    `${decision} ${actionLabel} request for ${entityRef}`,
    approved ? 'ti-circle-check' : 'ti-circle-x',
    { requestId, requestType, entityRef, level, approver: user.name, notes },
    { module: req.entity_type || req.table_name,
      actionType: `approval_${approved ? 'approved' : 'rejected'}`,
      recordId: req.entity_id || req.record_id,
      before, after, reason: notes }
  );

  // Notify the original requester
  const submitterId = req.submitted_by || req.requested_by;
  pushNotification({
    type:  approved ? 'green' : 'red',
    title: `Request ${approved ? 'approved' : 'rejected'} — ${entityRef}`,
    body:  approved
      ? `Your ${actionLabel} request was approved by ${user.name} and has been applied.`
      : `Your ${actionLabel} request was rejected by ${user.name}.${notes ? ' Reason: ' + notes : ''}`,
    forUserId: submitterId
  });

  return { ok: true };
}

// Resolves the notification/approval role sets for a given level.
// Used both here and in autoRequestEdit/autoRequestDelete.
function routeApprovalRequest(level) {
  return {
    notifyRoles:  level === 'leader' ? LEADER_NOTIFY_ROLES  : MANAGER_NOTIFY_ROLES,
    approverRoles: level === 'leader' ? LEADER_APPROVERS      : MANAGER_APPROVERS
  };
}

// Periodic SLA enforcement runner.
// Sends reminders and escalates overdue requests.
// Call escalatePendingRequests() from a setInterval in electron/main.js (every 30 min).
async function escalatePendingRequests() {
  try {
    const now = Date.now();

    for (const cfg of [
      {
        table:      'pending_edits',
        status:     'Pending',
        timeCol:    'submitted_at',
        entityCol:  'entity_ref',
        actionWord: 'edit'
      },
      {
        table:      'deletion_requests',
        status:     'pending',
        timeCol:    'requested_at',
        entityCol:  'entity_ref',
        actionWord: 'deletion'
      }
    ]) {
      const { rows } = await pool.query(
        `SELECT id, required_level, first_reminder_at, escalated_at,
                ${cfg.timeCol}, ${cfg.entityCol}
         FROM ${cfg.table}
         WHERE status = $1`,
        [cfg.status]
      );

      for (const req of rows) {
        const ageMs  = now - new Date(req[cfg.timeCol]).getTime();
        const level  = req.required_level || 'manager';
        const ref    = req[cfg.entityCol] || `${cfg.actionWord} request #${req.id}`;
        const remindMs = level === 'leader' ? SLA_LEADER_REMIND_MS   : SLA_MANAGER_REMIND_MS;
        const escalMs  = level === 'leader' ? SLA_LEADER_ESCALATE_MS : SLA_MANAGER_ESCALATE_MS;

        if (ageMs >= escalMs && !req.escalated_at) {
          // Escalate to the next tier
          const escalateRoles = level === 'leader' ? MANAGER_NOTIFY_ROLES : ['ceo', 'admin'];
          const newLevel      = level === 'leader' ? 'manager' : level;
          await pool.query(
            `UPDATE ${cfg.table}
             SET escalated_at=now(), escalation_level='escalated', required_level=$1
             WHERE id=$2`,
            [newLevel, req.id]
          );
          await pushNotification({
            type: 'red',
            title: `ESCALATED — ${cfg.actionWord} request for ${ref}`,
            body:  `A ${level}-level ${cfg.actionWord} request for "${ref}" has been pending 24+ hours and is now escalated.`,
            roles: escalateRoles
          });
          logAudit(
            SYSTEM_USER,
            `Escalated ${cfg.actionWord} request #${req.id} (${ref}) after 24h without action`,
            'ti-alert-triangle',
            { requestId: req.id, table: cfg.table, level, ageHours: Math.round(ageMs / 3_600_000) },
            { module: cfg.table, actionType: 'escalation',
              recordId: req.id, reason: `${level}-level request unanswered for 24h` }
          );

        } else if (ageMs >= remindMs && !req.first_reminder_at) {
          // First reminder only
          const remindRoles = level === 'leader' ? LEADER_NOTIFY_ROLES : MANAGER_NOTIFY_ROLES;
          await pool.query(
            `UPDATE ${cfg.table}
             SET first_reminder_at=now(), escalation_level='reminded'
             WHERE id=$1`,
            [req.id]
          );
          await pushNotification({
            type: 'amber',
            title: `REMINDER — ${cfg.actionWord} approval pending for ${ref}`,
            body:  `A ${cfg.actionWord} request for "${ref}" has been waiting ${Math.round(ageMs / 3_600_000)}h for ${level}-level approval.`,
            roles: remindRoles
          });
        }
      }
    }
  } catch (e) {
    console.error('[escalatePendingRequests]', e.message);
  }
}

// Dashboard data for the approval queue — visible to any approver role.
async function getApprovalDashboard(userId) {
  const user = await getUser(userId);
  const canApproveManager = MANAGER_APPROVERS.includes(user.role);
  const canApproveLeader  = LEADER_APPROVERS.includes(user.role);
  if (!canApproveManager && !canApproveLeader)
    return { ok: false, error: 'Access denied' };

  const levelFilter = canApproveManager ? '' : `AND required_level = 'leader'`;
  const levelFilterDel = canApproveManager ? '' : `AND required_level = 'leader'`;

  const [
    editsPending, delsPending,
    editsOverdue, delsOverdue,
    editsEscalated, delsEscalated,
    recentEdits, recentDels,
    slaEdits
  ] = await Promise.all([
    // Pending edits broken down by required_level
    pool.query(`SELECT required_level, count(*)::int as n FROM pending_edits
                WHERE status='Pending' ${levelFilter} GROUP BY required_level`),
    // Pending deletions
    pool.query(`SELECT required_level, count(*)::int as n FROM deletion_requests
                WHERE status='pending' ${levelFilterDel} GROUP BY required_level`),
    // Overdue edits (first reminder sent, not yet escalated)
    pool.query(`SELECT count(*)::int as n FROM pending_edits
                WHERE status='Pending' ${levelFilter}
                  AND first_reminder_at IS NOT NULL AND escalated_at IS NULL`),
    // Overdue deletions
    pool.query(`SELECT count(*)::int as n FROM deletion_requests
                WHERE status='pending' ${levelFilterDel}
                  AND first_reminder_at IS NOT NULL AND escalated_at IS NULL`),
    // Escalated edits
    pool.query(`SELECT count(*)::int as n FROM pending_edits
                WHERE status='Pending' ${levelFilter} AND escalated_at IS NOT NULL`),
    // Escalated deletions
    pool.query(`SELECT count(*)::int as n FROM deletion_requests
                WHERE status='pending' ${levelFilterDel} AND escalated_at IS NOT NULL`),
    // Recent decisions (edits)
    pool.query(`SELECT pe.id, pe.entity_ref, pe.action_type, pe.status,
                       pe.required_level, pe.escalation_level,
                       to_char(pe.submitted_at,'DD/MM/YYYY HH24:MI') as submitted_at,
                       to_char(pe.reviewed_at,'DD/MM/YYYY HH24:MI')  as reviewed_at,
                       approver.name as reviewed_by_name,
                       sub.name     as submitted_by_name
                FROM pending_edits pe
                LEFT JOIN app_users approver ON approver.id = pe.reviewed_by
                LEFT JOIN app_users sub      ON sub.id      = pe.submitted_by
                WHERE pe.status IN ('Approved','Rejected') ${levelFilter}
                ORDER BY pe.reviewed_at DESC LIMIT 20`),
    // Recent decisions (deletions)
    pool.query(`SELECT dr.id, dr.entity_ref, dr.entity_type, dr.status,
                       dr.required_level, dr.escalation_level,
                       to_char(dr.requested_at,'DD/MM/YYYY HH24:MI') as requested_at,
                       to_char(dr.reviewed_at,'DD/MM/YYYY HH24:MI')  as reviewed_at,
                       approver.name as reviewed_by_name,
                       req.name      as requested_by_name
                FROM deletion_requests dr
                LEFT JOIN app_users approver ON approver.id = dr.reviewed_by
                LEFT JOIN app_users req      ON req.id      = dr.requested_by
                WHERE dr.status IN ('approved','rejected') ${levelFilterDel}
                ORDER BY dr.reviewed_at DESC LIMIT 20`),
    // Average hours from submission to approval (last 30 days)
    pool.query(`SELECT round(avg(extract(epoch from (reviewed_at - submitted_at))/3600)::numeric,1) as avg_h
                FROM pending_edits
                WHERE status='Approved'
                  AND reviewed_at IS NOT NULL
                  AND submitted_at > now() - interval '30 days'`)
  ]);

  return {
    ok: true,
    pending: {
      edits:     editsPending.rows,
      deletions: delsPending.rows
    },
    overdue: {
      edits:     editsOverdue.rows[0].n,
      deletions: delsOverdue.rows[0].n
    },
    escalated: {
      edits:     editsEscalated.rows[0].n,
      deletions: delsEscalated.rows[0].n
    },
    history: {
      edits:     recentEdits.rows,
      deletions: recentDels.rows
    },
    sla: {
      avgApprovalHoursLast30d: slaEdits.rows[0]?.avg_h ?? null
    }
  };
}

// ── Step 4: Persistent Job Queue Engine ──────────────────────────────────────
// Replaces all in-memory setInterval timers for critical workflow logic.
// Crash-safe: jobs survive app restarts. Retry-safe: idempotency keys
// prevent duplicate execution. Every job is individually auditable.

// Exponential backoff delays per attempt (index = attempt number already consumed).
const JOB_RETRY_DELAYS_MS = [
  1  * 60 * 1_000,   // attempt 1 failed → retry in 1 min
  5  * 60 * 1_000,   // attempt 2 failed → retry in 5 min
  15 * 60 * 1_000,   // attempt 3 failed → retry in 15 min
  60 * 60 * 1_000,   // attempt 4 failed → retry in 1 h
  4 * 60 * 60 * 1_000 // attempt 5 failed → retry in 4 h (then permanently failed)
];

// Insert a single job, safely ignoring duplicate idempotency_keys.
async function scheduleJob(type, payload, runAt = new Date(), idempotencyKey = null) {
  try {
    await pool.query(
      `INSERT INTO workflow_jobs(type, payload, run_at, idempotency_key)
       VALUES ($1, $2::jsonb, $3, $4)
       ON CONFLICT (idempotency_key) DO NOTHING`,
      [type, JSON.stringify(payload), runAt, idempotencyKey]
    );
  } catch (e) {
    console.error('[scheduleJob]', type, e.message);
  }
}

// ── Individual job handlers ───────────────────────────────────────────────────

async function handleEscalationReminder({ requestTable, requestId, level, ref }) {
  const statusVal = requestTable === 'pending_edits' ? 'Pending' : 'pending';
  const { rows }  = await pool.query(
    `SELECT required_level, first_reminder_at FROM ${requestTable} WHERE id=$1 AND status=$2`,
    [requestId, statusVal]
  );
  if (!rows.length || rows[0].first_reminder_at) return; // resolved or already reminded

  const currentLevel = rows[0].required_level || level;
  const remindRoles  = currentLevel === 'leader' ? LEADER_NOTIFY_ROLES : MANAGER_NOTIFY_ROLES;
  const actionWord   = requestTable === 'pending_edits' ? 'edit' : 'deletion';

  await pool.query(
    `UPDATE ${requestTable} SET first_reminder_at=now(), escalation_level='reminded' WHERE id=$1`,
    [requestId]
  );
  await pushNotification({
    type: 'amber',
    title: `REMINDER — ${actionWord} approval needed for ${ref}`,
    body:  `A ${actionWord} request for "${ref}" is awaiting ${currentLevel}-level approval.`,
    roles: remindRoles
  });
}

async function handleEscalationEscalate({ requestTable, requestId, fromLevel, ref }) {
  const statusVal = requestTable === 'pending_edits' ? 'Pending' : 'pending';
  const { rows }  = await pool.query(
    `SELECT required_level, escalated_at FROM ${requestTable} WHERE id=$1 AND status=$2`,
    [requestId, statusVal]
  );
  if (!rows.length || rows[0].escalated_at) return; // resolved or already escalated

  const newLevel      = fromLevel === 'leader' ? 'manager' : fromLevel;
  const escalateRoles = fromLevel === 'leader' ? MANAGER_NOTIFY_ROLES : ['ceo', 'admin'];
  const actionWord    = requestTable === 'pending_edits' ? 'edit' : 'deletion';

  await pool.query(
    `UPDATE ${requestTable}
     SET escalated_at=now(), escalation_level='escalated', required_level=$1
     WHERE id=$2`,
    [newLevel, requestId]
  );
  await pushNotification({
    type: 'red',
    title: `ESCALATED — ${actionWord} request for ${ref}`,
    body:  `A ${fromLevel}-level ${actionWord} request for "${ref}" has been pending 24+ hours and is now escalated.`,
    roles: escalateRoles
  });
  logAudit(
    SYSTEM_USER,
    `Escalated ${actionWord} request #${requestId} (${ref}) after 24h without action`,
    'ti-alert-triangle',
    { requestId, table: requestTable, fromLevel, newLevel },
    { module: requestTable, actionType: 'escalation', recordId: requestId,
      reason: `${fromLevel}-level request unanswered for 24h` }
  );
}

async function handleNotificationRetry({ type, title, body, roles, forUserId,
                                          relatedModule, relatedId, category }) {
  await pool.query(
    `INSERT INTO notifications(type,title,body,roles,for_user_id,related_module,related_id,category)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [type, title, body, roles || [], forUserId || null,
     relatedModule || null, relatedId || null, category || null]
  );
}

async function handleAuditReplay(p) {
  await pool.query(
    `INSERT INTO audit_log(
       user_id, username, full_name, role,
       action, icon, meta,
       module, action_type, record_id,
       before_values, after_values,
       ip_address, reason
     ) VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9,$10,$11::jsonb,$12::jsonb,$13,$14)`,
    [p.userId || null, p.username || null, p.name || null, p.role,
     p.action, p.icon || 'ti-check', JSON.stringify(p.meta || {}),
     p.module || null, p.actionType || null,
     p.recordId != null ? String(p.recordId) : null,
     p.before   != null ? JSON.stringify(p.before) : null,
     p.after    != null ? JSON.stringify(p.after)  : null,
     p.ipAddress || null, p.reason || null]
  );
}

const JOB_DISPATCH = {
  escalation_reminder:  handleEscalationReminder,
  escalation_escalate:  handleEscalationEscalate,
  notification_retry:   handleNotificationRetry,
  audit_replay:         handleAuditReplay,
  // Phase 8 — Intelligent Automation Engine
  bi_automation:        () => runAutomationEngine(),
};

// Guard against re-entrant concurrent calls (single-instance desktop app).
let _jobProcessorRunning = false;
// Set to true during graceful shutdown so no new ticks begin.
let _jobProcessorStopped = false;

function stopJobProcessor() {
  _jobProcessorStopped = true;
}

// Main job processor. Called by setInterval in electron/main.js every 2 minutes.
// Claims up to 20 runnable jobs atomically via SKIP LOCKED, executes handlers,
// marks done or reschedules failed jobs with exponential backoff.
async function processWorkflowJobs() {
  if (_jobProcessorRunning || _jobProcessorStopped) return;
  _jobProcessorRunning = true;
  try {
    // Atomically claim runnable jobs (SKIP LOCKED prevents duplicate processing)
    const { rows: jobs } = await pool.query(
      `UPDATE workflow_jobs
       SET status='processing', attempts=attempts+1
       WHERE id IN (
         SELECT id FROM workflow_jobs
         WHERE status = 'pending'
           AND run_at <= now()
           AND attempts < max_attempts
         ORDER BY run_at
         LIMIT 20
         FOR UPDATE SKIP LOCKED
       )
       RETURNING id, type, payload, attempts, max_attempts`
    );

    for (const job of jobs) {
      const handler = JOB_DISPATCH[job.type];
      if (!handler) {
        await pool.query(
          `UPDATE workflow_jobs SET status='failed', last_error=$1, processed_at=now() WHERE id=$2`,
          [`Unknown job type: ${job.type}`, job.id]
        );
        continue;
      }
      try {
        await handler(job.payload);
        await pool.query(
          `UPDATE workflow_jobs SET status='done', processed_at=now() WHERE id=$1`,
          [job.id]
        );
      } catch (e) {
        // job.attempts was already incremented by the claiming UPDATE above
        if (job.attempts >= job.max_attempts) {
          await pool.query(
            `UPDATE workflow_jobs SET status='failed', last_error=$1, processed_at=now() WHERE id=$2`,
            [e.message, job.id]
          );
          console.error(`[job:${job.type}] permanently failed after ${job.attempts} attempts:`, e.message);
          // Notify admin — skip notification/audit job types to prevent recursion
          if (!['notification_retry', 'audit_replay'].includes(job.type)) {
            await pushNotification({
              type:     'red',
              title:    `Workflow Job Failed — ${job.type}`,
              body:     `Job #${job.id} (${job.type}) permanently failed after ${job.attempts} attempts: ${e.message.slice(0, 200)}`,
              roles:    ['admin'],
              category: 'system',
            });
          }
        } else {
          const delayMs = JOB_RETRY_DELAYS_MS[Math.min(job.attempts, JOB_RETRY_DELAYS_MS.length - 1)];
          const retryAt = new Date(Date.now() + delayMs);
          await pool.query(
            `UPDATE workflow_jobs SET status='pending', last_error=$1, run_at=$2 WHERE id=$3`,
            [e.message, retryAt, job.id]
          );
        }
      }
    }
  } catch (e) {
    console.error('[processWorkflowJobs]', e.message);
  } finally {
    _jobProcessorRunning = false;
  }
}

// Called once at app startup.
// 1. Resets jobs stuck in 'processing' (process was killed mid-run).
// 2. Re-schedules missing escalation jobs for any existing pending requests
//    (handles the case where jobs were never created, e.g. requests from before Step 4).
async function recoverWorkflowState() {
  try {
    // Reset crashed-in-progress jobs
    const { rowCount } = await pool.query(
      `UPDATE workflow_jobs
       SET status='pending', last_error='Recovered after restart'
       WHERE status='processing'`
    );
    if (rowCount > 0) console.log(`[recoverWorkflowState] Reset ${rowCount} stuck processing job(s)`);

    // Ensure every pending approval request has its escalation jobs scheduled
    for (const cfg of [
      { table: 'pending_edits',     status: 'Pending', timeCol: 'submitted_at', prefix: 'pe' },
      { table: 'deletion_requests', status: 'pending', timeCol: 'requested_at', prefix: 'dr' }
    ]) {
      const { rows } = await pool.query(
        `SELECT id, required_level, first_reminder_at, escalated_at, entity_ref,
                ${cfg.timeCol} AS submitted_at
         FROM ${cfg.table} WHERE status=$1`,
        [cfg.status]
      );

      const now = Date.now();
      for (const req of rows) {
        const level    = req.required_level || 'manager';
        const ref      = req.entity_ref || `Request #${req.id}`;
        const ageMs    = now - new Date(req.submitted_at).getTime();
        const remindMs = level === 'leader' ? SLA_LEADER_REMIND_MS   : SLA_MANAGER_REMIND_MS;
        const escalMs  = level === 'leader' ? SLA_LEADER_ESCALATE_MS : SLA_MANAGER_ESCALATE_MS;
        const origin   = new Date(req.submitted_at).getTime();

        // Reminder job — schedule if not yet sent
        if (!req.first_reminder_at) {
          await scheduleJob(
            'escalation_reminder',
            { requestTable: cfg.table, requestId: req.id, level, ref },
            ageMs >= remindMs ? new Date() : new Date(origin + remindMs),
            `reminder_${cfg.prefix}_${req.id}`
          );
        }

        // Escalation job — schedule if not yet triggered
        if (!req.escalated_at) {
          await scheduleJob(
            'escalation_escalate',
            { requestTable: cfg.table, requestId: req.id, fromLevel: level, ref },
            ageMs >= escalMs ? new Date() : new Date(origin + escalMs),
            `escalate_${cfg.prefix}_${req.id}`
          );
        }
      }
    }

    console.log('[recoverWorkflowState] Complete');
    // Immediately process any overdue jobs that were just re-queued
    await processWorkflowJobs();
  } catch (e) {
    console.error('[recoverWorkflowState]', e.message);
  }
}

// ── Trash / Recycle Bin ───────────────────────────────────────────────────────

const TRASH_TABLES = [
  { table: 'daily_logs',          type: 'daily_log',          label: 'Daily Production Log',
    refSql: `to_char(log_date,'DD/MM/YYYY')` },
  { table: 'harvest_logs',        type: 'harvest_log',        label: 'Harvest Log',
    refSql: `species || ' — ' || to_char(harvest_date,'DD/MM/YYYY')` },
  { table: 'value_added_timber',  type: 'value_added_timber', label: 'Value-Added Timber',
    refSql: `type_value_added || ' — ' || to_char(entry_date,'DD/MM/YYYY')` },
  { table: 'machine_daily_logs',  type: 'machine_daily_log',  label: 'Machine Daily Log',
    refSql: `to_char(log_date,'DD/MM/YYYY')` },
  { table: 'compartments',        type: 'compartment',        label: 'Compartment',
    refSql: `compt_name` },
  { table: 'log_transport',       type: 'log_transport',      label: 'Log Transport',
    refSql: `to_char(transport_date,'DD/MM/YYYY') || ' (' || qty_transported || ' logs)'` },
  { table: 'machine_fuel_logs',   type: 'machine_fuel_log',   label: 'Machine Fuel Log',
    refSql: `to_char(log_date,'DD/MM/YYYY') || ' — ' || fuel_type` },
  { table: 'maintenance_records', type: 'maintenance_record',  label: 'Maintenance Record',
    refSql: `maintenance_type || ' — ' || to_char(maintenance_date,'DD/MM/YYYY')` },
  { table: 'sales_orders',        type: 'sales_order',        label: 'Sales Order',
    refSql: `order_number || ' — ' || customer_name` },
  { table: 'stock_movements',     type: 'stock_movement',     label: 'Stock Movement',
    refSql: `movement_type || ' — ' || to_char(created_at,'DD/MM/YYYY')` },
];

async function trashList(userId) {
  const user = await getUser(userId);
  if (!['admin','ceo','operations'].includes(user.role))
    return { ok: false, error: 'Access denied' };
  const now = Date.now();
  const items = [];
  for (const t of TRASH_TABLES) {
    const { rows } = await pool.query(
      `SELECT id, ${t.refSql} as entity_ref,
              to_char(deleted_at,'DD/MM/YYYY HH24:MI') as deleted_at_fmt,
              deleted_at, deleted_by, deletion_reason
       FROM ${t.table} WHERE deleted_at IS NOT NULL
       ORDER BY deleted_at DESC LIMIT 100`
    );
    for (const r of rows) {
      items.push({
        ...r,
        table_name: t.table,
        entity_type: t.type,
        entity_label: t.label,
        days_remaining: Math.max(0, 30 - Math.floor((now - new Date(r.deleted_at).getTime()) / 86400000))
      });
    }
  }
  const userIds = [...new Set(items.map(i => i.deleted_by).filter(Boolean))];
  if (userIds.length) {
    const { rows: users } = await pool.query(`SELECT id, name FROM app_users WHERE id = ANY($1)`, [userIds]);
    const byId = {};
    users.forEach(u => { byId[u.id] = u.name; });
    items.forEach(i => { i.deleted_by_name = byId[i.deleted_by] || '—'; });
  } else {
    items.forEach(i => { i.deleted_by_name = '—'; });
  }
  items.sort((a, b) => new Date(b.deleted_at) - new Date(a.deleted_at));
  return { ok: true, rows: items };
}

async function trashRestore(userId, tableName, recordId) {
  const user = await getUser(userId);
  if (!['admin','ceo','operations'].includes(user.role))
    return { ok: false, error: 'Access denied' };
  if (!SOFT_DELETE_ALLOWED.has(tableName)) return { ok: false, error: 'Invalid table' };
  const { rows } = await pool.query(
    `SELECT id FROM ${tableName} WHERE id=$1 AND deleted_at IS NOT NULL`, [recordId]
  );
  if (!rows.length) return { ok: false, error: 'Record not found in trash' };
  await pool.query(
    `UPDATE ${tableName} SET deleted_at=NULL, deleted_by=NULL, deletion_reason=NULL, pending_deletion=FALSE WHERE id=$1`,
    [recordId]
  );
  if (['daily_logs','sales_orders'].includes(tableName)) refreshStockView();
  logAudit(user, `Restored ${tableName} #${recordId} from trash`, 'ti-restore', { tableName, recordId });
  return { ok: true };
}

async function trashPurge(userId, tableName, recordId) {
  const user = await getUser(userId);
  if (!['admin','ceo'].includes(user.role))
    return { ok: false, error: 'Access denied — admin/CEO only' };
  if (!SOFT_DELETE_ALLOWED.has(tableName)) return { ok: false, error: 'Invalid table' };
  const { rows } = await pool.query(
    `SELECT id FROM ${tableName} WHERE id=$1 AND deleted_at IS NOT NULL`, [recordId]
  );
  if (!rows.length) return { ok: false, error: 'Record not found in trash' };
  await pool.query(`DELETE FROM deletion_requests WHERE table_name=$1 AND record_id=$2`, [tableName, recordId]);
  await pool.query(`DELETE FROM ${tableName} WHERE id=$1`, [recordId]);
  logAudit(user, `Permanently purged ${tableName} #${recordId}`, 'ti-trash-x', { tableName, recordId });
  return { ok: true };
}

async function secGovDashboard(userId) {
  const user = await getUser(userId);
  if (!['ceo', 'admin', 'operations'].includes(user.role))
    return { ok: false, error: 'Access denied' };

  const [kpiRes, apprRes, secRes, wfRes, auditRes, notifRes] = await Promise.all([
    // ── KPI counts ──────────────────────────────────────────────────────
    pool.query(`
      SELECT
        (SELECT count(*)::int FROM audit_log WHERE action_type='login_failed'        AND created_at > now()-interval'24 hours') AS failed_logins,
        (SELECT count(*)::int FROM audit_log WHERE action_type='privileged_override' AND created_at > now()-interval'24 hours') AS priv_overrides,
        (SELECT count(*)::int FROM pending_edits     WHERE status='Pending') +
        (SELECT count(*)::int FROM deletion_requests WHERE status='pending')   AS pending_approvals,
        (SELECT count(*)::int FROM workflow_jobs WHERE status='failed')        AS workflow_failures
    `),
    // ── Approval overview ────────────────────────────────────────────────
    pool.query(`
      SELECT
        (SELECT count(*)::int FROM pending_edits     WHERE status='Pending' AND required_level='leader')  AS leader_edits,
        (SELECT count(*)::int FROM pending_edits     WHERE status='Pending' AND required_level='manager') AS manager_edits,
        (SELECT count(*)::int FROM deletion_requests WHERE status='pending' AND required_level='leader')  AS leader_dels,
        (SELECT count(*)::int FROM deletion_requests WHERE status='pending' AND required_level='manager') AS manager_dels,
        (SELECT count(*)::int FROM pending_edits     WHERE status='Pending' AND escalated_at IS NOT NULL) +
        (SELECT count(*)::int FROM deletion_requests WHERE status='pending' AND escalated_at IS NOT NULL) AS escalated,
        (SELECT round(extract(epoch from avg(reviewed_at - submitted_at))/3600, 1)
         FROM pending_edits
         WHERE status IN ('Approved','Rejected') AND reviewed_at IS NOT NULL
           AND reviewed_at > now()-interval'30 days')                         AS avg_edit_hours,
        (SELECT round(extract(epoch from avg(reviewed_at - requested_at))/3600, 1)
         FROM deletion_requests
         WHERE status IN ('approved','rejected') AND reviewed_at IS NOT NULL
           AND reviewed_at > now()-interval'30 days')                         AS avg_del_hours
    `),
    // ── Security events (latest 25) ──────────────────────────────────────
    pool.query(`
      SELECT id,
             to_char(created_at,'DD Mon HH24:MI') AS time,
             coalesce(username, role, 'unknown')   AS username,
             role,
             action_type,
             action
      FROM audit_log
      WHERE action_type IN ('login_failed','login_denied','privileged_override')
      ORDER BY created_at DESC
      LIMIT 25
    `),
    // ── Workflow health (failed / processing / retrying) ─────────────────
    pool.query(`
      SELECT id, type, attempts, max_attempts, status, last_error,
             to_char(created_at,'DD Mon HH24:MI') AS created_fmt
      FROM workflow_jobs
      WHERE status = 'failed'
         OR status = 'processing'
         OR (status = 'pending' AND attempts > 0)
      ORDER BY
        CASE status WHEN 'failed' THEN 0 WHEN 'processing' THEN 1 ELSE 2 END,
        id DESC
      LIMIT 50
    `),
    // ── Audit activity feed (latest 50) ──────────────────────────────────
    pool.query(`
      SELECT id,
             to_char(created_at,'DD Mon HH24:MI') AS time,
             coalesce(username, role, 'system')   AS username,
             coalesce(full_name,'')               AS full_name,
             role,
             coalesce(module,'system')            AS module,
             action_type,
             action
      FROM audit_log
      ORDER BY created_at DESC
      LIMIT 50
    `),
    // ── Unread notification counts by category ───────────────────────────
    pool.query(`
      SELECT
        count(*) FILTER (WHERE n.category='security') ::int AS security,
        count(*) FILTER (WHERE n.category='approval') ::int AS approval,
        count(*) FILTER (WHERE n.category='system')   ::int AS system
      FROM notifications n
      LEFT JOIN notifications_read r ON r.notification_id=n.id AND r.user_id=$1
      WHERE r.notification_id IS NULL
        AND (
          n.for_user_id=$1
          OR $2=ANY(n.roles)
          OR array_length(n.roles,1) IS NULL
          OR n.roles='{}'
        )
    `, [userId, user.role]),
  ]);

  const kpi   = kpiRes.rows[0]   || {};
  const appr  = apprRes.rows[0]  || {};
  const notif = notifRes.rows[0] || {};

  const eh = Number(appr.avg_edit_hours || 0);
  const dh = Number(appr.avg_del_hours  || 0);
  const avgHours = eh > 0 && dh > 0 ? Number(((eh + dh) / 2).toFixed(1))
                 : eh > 0            ? eh
                 : dh > 0            ? dh
                 : null;

  return {
    ok: true,
    kpi: {
      failedLogins:     Number(kpi.failed_logins)     || 0,
      privOverrides:    Number(kpi.priv_overrides)     || 0,
      pendingApprovals: Number(kpi.pending_approvals)  || 0,
      workflowFailures: Number(kpi.workflow_failures)  || 0,
    },
    approvals: {
      leaderPending:  (Number(appr.leader_edits  || 0) + Number(appr.leader_dels  || 0)),
      managerPending: (Number(appr.manager_edits || 0) + Number(appr.manager_dels || 0)),
      escalated:       Number(appr.escalated) || 0,
      avgHours,
    },
    securityEvents:  secRes.rows,
    workflowHealth:  wfRes.rows,
    auditFeed:       auditRes.rows,
    notifCounts: {
      security: Number(notif.security) || 0,
      approval: Number(notif.approval) || 0,
      system:   Number(notif.system)   || 0,
    },
  };
}

// ── Phase 6F — Executive Analytics & Reporting ───────────────────────────────

async function executiveDashboard(userId) {
  const user = await getUser(userId);
  if (!['ceo', 'admin', 'operations'].includes(user.role))
    return { ok: false, error: 'Access denied' };

  const [kpiRes, salesTrendRes, fuelTrendRes, harvestTrendRes, workshopTrendRes,
         approvalTrendRes, machinesRes, driversRes, compartmentsRes,
         activeUsersRes, stockRes, govRes, notifRes] = await Promise.all([

    // ── 1. KPI Counters ─────────────────────────────────────────────────────
    pool.query(`
      SELECT
        COALESCE((SELECT SUM(quantity::numeric * unit_price) FROM sales_orders
          WHERE DATE(created_at) = CURRENT_DATE AND deleted_at IS NULL AND status != 'Cancelled'), 0)::numeric(14,2) AS revenue_today,
        COALESCE((SELECT SUM(quantity::numeric * unit_price) FROM sales_orders
          WHERE DATE_TRUNC('month', created_at) = DATE_TRUNC('month', NOW())
            AND deleted_at IS NULL AND status != 'Cancelled'), 0)::numeric(14,2) AS revenue_month,
        COALESCE((SELECT SUM(quantity::numeric * unit_price) FROM sales_orders
          WHERE DATE_TRUNC('year', created_at) = DATE_TRUNC('year', NOW())
            AND deleted_at IS NULL AND status != 'Cancelled'), 0)::numeric(14,2) AS revenue_year,
        ((SELECT COUNT(*)::int FROM pending_edits     WHERE status = 'Pending') +
         (SELECT COUNT(*)::int FROM deletion_requests WHERE status = 'pending'))  AS pending_approvals,
        (SELECT COUNT(*)::int FROM workflow_jobs WHERE status = 'failed')          AS failed_jobs,
        (SELECT COUNT(DISTINCT user_id)::int FROM audit_log
          WHERE created_at > NOW() - INTERVAL '24 hours' AND user_id IS NOT NULL) AS active_users_today,
        (SELECT COUNT(*)::int FROM delivery_orders
          WHERE status = 'Pending')                                                 AS deliveries_pending,
        (SELECT COUNT(*)::int FROM dispatch_requests WHERE status = 'Pending')     AS dispatch_pending
    `),

    // ── 2. Sales Trend (30 days) ─────────────────────────────────────────────
    pool.query(`
      SELECT
        DATE(created_at)::text AS day,
        COALESCE(SUM(quantity::numeric * unit_price), 0)::numeric(14,2) AS amount,
        COUNT(*)::int AS orders
      FROM sales_orders
      WHERE created_at >= NOW() - INTERVAL '30 days'
        AND deleted_at IS NULL AND status != 'Cancelled'
      GROUP BY DATE(created_at)
      ORDER BY day
    `),

    // ── 3. Fuel Trend (30 days — machine + vehicle fuel combined) ────────────
    pool.query(`
      SELECT day::text, ROUND(SUM(liters)::numeric, 2) AS liters FROM (
        SELECT log_date AS day, quantity AS liters
          FROM machine_fuel_logs WHERE log_date >= CURRENT_DATE - 30 AND deleted_at IS NULL
        UNION ALL
        SELECT log_date, liters FROM fuel_logs WHERE log_date >= CURRENT_DATE - 30
      ) t
      GROUP BY day ORDER BY day
    `),

    // ── 4. Harvest Trend (12 weeks) ──────────────────────────────────────────
    pool.query(`
      SELECT
        DATE_TRUNC('week', harvest_date)::date::text AS week,
        SUM(quantity)::int AS trees,
        SUM(COALESCE(logs_crosscut,0) + COALESCE(logs_handrolled,0))::int AS logs
      FROM harvest_logs
      WHERE harvest_date >= CURRENT_DATE - 84 AND deleted_at IS NULL
      GROUP BY DATE_TRUNC('week', harvest_date)
      ORDER BY week
    `),

    // ── 5. Workshop Production Trend (12 weeks) ──────────────────────────────
    pool.query(`
      SELECT
        DATE_TRUNC('week', log_date)::date::text AS week,
        SUM(timber_units)::int AS timber,
        SUM(poles_units)::int  AS poles
      FROM daily_logs
      WHERE log_date >= CURRENT_DATE - 84 AND deleted_at IS NULL
      GROUP BY DATE_TRUNC('week', log_date)
      ORDER BY week
    `),

    // ── 6. Approval Processing Time Trend (12 weeks) ─────────────────────────
    pool.query(`
      SELECT
        DATE_TRUNC('week', submitted_at)::date::text AS week,
        ROUND(AVG(EXTRACT(EPOCH FROM (reviewed_at - submitted_at)) / 3600), 1)::numeric AS avg_hours,
        COUNT(*)::int AS resolved
      FROM pending_edits
      WHERE status IN ('Approved','Rejected')
        AND reviewed_at IS NOT NULL
        AND submitted_at >= NOW() - INTERVAL '84 days'
      GROUP BY DATE_TRUNC('week', submitted_at)
      ORDER BY week
    `),

    // ── 7. Top Machines by Efficiency (last 30 days) ─────────────────────────
    pool.query(`
      SELECT
        m.machine_code,
        m.name,
        COALESCE(SUM(mdl.hours_worked),     0)::numeric(10,1) AS hours_worked,
        COALESCE(SUM(mdl.daily_production), 0)::numeric(10,1) AS production,
        COALESCE(SUM(mdl.fuel_consumed),    0)::numeric(10,1) AS fuel,
        CASE WHEN SUM(mdl.capacity_per_day) > 0
          THEN ROUND(SUM(mdl.daily_production)::numeric / NULLIF(SUM(mdl.capacity_per_day),0) * 100, 1)
          ELSE 0
        END AS efficiency_pct
      FROM machines m
      LEFT JOIN machine_daily_logs mdl
        ON mdl.machine_id = m.id AND mdl.log_date >= CURRENT_DATE - 30 AND mdl.deleted_at IS NULL
      WHERE m.active = true
      GROUP BY m.id, m.machine_code, m.name
      ORDER BY efficiency_pct DESC, hours_worked DESC
      LIMIT 8
    `),

    // ── 8. Top Drivers by Deliveries (last 30 days) ──────────────────────────
    pool.query(`
      SELECT
        COALESCE(driver_name, 'Unassigned') AS driver_name,
        COUNT(*)::int AS deliveries,
        SUM(COALESCE(qty_accepted,0))::int AS qty_accepted,
        SUM(COALESCE(qty_rejected,0))::int AS qty_rejected
      FROM delivery_orders
      WHERE driver_name IS NOT NULL
        AND created_at >= NOW() - INTERVAL '30 days'
      GROUP BY driver_name
      ORDER BY deliveries DESC
      LIMIT 8
    `),

    // ── 9. Top Compartments by Harvest Volume ────────────────────────────────
    pool.query(`
      SELECT
        c.compt_name,
        c.species,
        c.area_ha::numeric(10,2) AS area_ha,
        COALESCE(SUM(h.quantity), 0)::int AS trees_felled,
        COALESCE(SUM(COALESCE(h.logs_crosscut,0) + COALESCE(h.logs_handrolled,0)), 0)::int AS logs_produced
      FROM compartments c
      LEFT JOIN harvest_logs h ON h.compt_id = c.id AND h.deleted_at IS NULL
      GROUP BY c.id, c.compt_name, c.species, c.area_ha
      ORDER BY trees_felled DESC
      LIMIT 8
    `),

    // ── 10. Most Active Users (last 7 days) ──────────────────────────────────
    pool.query(`
      SELECT
        u.username,
        u.name   AS full_name,
        u.role,
        COUNT(a.id)::int AS actions,
        to_char(MAX(a.created_at), 'DD Mon HH24:MI') AS last_active
      FROM app_users u
      JOIN audit_log a ON a.user_id = u.id
      WHERE a.created_at >= NOW() - INTERVAL '7 days' AND u.deleted_at IS NULL
      GROUP BY u.id, u.username, u.name, u.role
      ORDER BY actions DESC
      LIMIT 8
    `),

    // ── 11. Stock Summary ────────────────────────────────────────────────────
    pool.query(`
      SELECT
        COUNT(*)::int AS movements_30d,
        (SELECT COUNT(*)::int FROM stock_levels sl
          JOIN stock_catalog sc ON sc.id = sl.item_id
          WHERE sl.quantity <= sc.min_stock AND sc.active = true) AS low_stock_items,
        (SELECT COUNT(*)::int FROM stock_transfers
          WHERE status IN ('pending','dispatched') AND deleted_at IS NULL) AS pending_transfers,
        (SELECT COUNT(*)::int FROM material_requests WHERE status = 'pending') AS pending_material_req
      FROM stock_movements
      WHERE created_at >= NOW() - INTERVAL '30 days' AND deleted_at IS NULL
    `),

    // ── 12. Governance & Security Metrics ────────────────────────────────────
    pool.query(`
      SELECT
        ROUND(
          100.0 * COUNT(CASE WHEN EXTRACT(EPOCH FROM (reviewed_at - submitted_at)) <= 172800 THEN 1 END)
          / NULLIF(COUNT(*), 0), 1
        )::numeric AS sla_compliance_pct,
        COUNT(*)::int AS total_resolved_30d,
        COUNT(CASE WHEN escalated_at IS NOT NULL THEN 1 END)::int AS escalated_count,
        ROUND(
          100.0 * COUNT(CASE WHEN escalated_at IS NOT NULL THEN 1 END) / NULLIF(COUNT(*),0), 1
        )::numeric AS escalation_rate_pct,
        (SELECT COUNT(*)::int FROM audit_log
          WHERE action_type = 'privileged_override' AND created_at > NOW() - INTERVAL '24 hours') AS priv_overrides_24h,
        (SELECT COUNT(*)::int FROM audit_log
          WHERE action_type = 'login_failed' AND created_at > NOW() - INTERVAL '24 hours')        AS failed_logins_24h,
        (SELECT COUNT(*)::int FROM audit_log
          WHERE created_at > NOW() - INTERVAL '24 hours') AS audit_volume_24h
      FROM pending_edits
      WHERE status IN ('Approved','Rejected')
        AND reviewed_at IS NOT NULL
        AND submitted_at >= NOW() - INTERVAL '30 days'
    `),

    // ── 13. Notification Summary ─────────────────────────────────────────────
    pool.query(`
      SELECT
        COUNT(*)::int AS total_unread,
        COUNT(CASE WHEN n.category = 'security' THEN 1 END)::int AS security,
        COUNT(CASE WHEN n.category = 'approval' THEN 1 END)::int AS approval,
        COUNT(CASE WHEN n.category = 'system'   THEN 1 END)::int AS system
      FROM notifications n
      LEFT JOIN notifications_read r ON r.notification_id = n.id AND r.user_id = $1
      WHERE r.notification_id IS NULL
        AND (n.for_user_id = $1 OR $2 = ANY(n.roles)
          OR array_length(n.roles,1) IS NULL OR n.roles = '{}')
    `, [userId, user.role]),
  ]);

  const kpi   = kpiRes.rows[0]   || {};
  const gov   = govRes.rows[0]   || {};
  const stk   = stockRes.rows[0] || {};
  const notif = notifRes.rows[0] || {};

  return {
    ok: true,
    kpi: {
      revenueToday:      Number(kpi.revenue_today)      || 0,
      revenueMonth:      Number(kpi.revenue_month)      || 0,
      revenueYear:       Number(kpi.revenue_year)       || 0,
      pendingApprovals:  Number(kpi.pending_approvals)  || 0,
      failedJobs:        Number(kpi.failed_jobs)        || 0,
      activeUsersToday:  Number(kpi.active_users_today) || 0,
      deliveriesPending: Number(kpi.deliveries_pending) || 0,
      dispatchPending:   Number(kpi.dispatch_pending)   || 0,
    },
    salesTrend:      salesTrendRes.rows,
    fuelTrend:       fuelTrendRes.rows,
    harvestTrend:    harvestTrendRes.rows,
    workshopTrend:   workshopTrendRes.rows,
    approvalTrend:   approvalTrendRes.rows,
    topMachines:     machinesRes.rows,
    topDrivers:      driversRes.rows,
    topCompartments: compartmentsRes.rows,
    activeUsers:     activeUsersRes.rows,
    stock: {
      movements30d:       Number(stk.movements_30d)        || 0,
      lowStockItems:      Number(stk.low_stock_items)       || 0,
      pendingTransfers:   Number(stk.pending_transfers)     || 0,
      pendingMaterialReq: Number(stk.pending_material_req)  || 0,
    },
    governance: {
      slaCompliancePct:  Number(gov.sla_compliance_pct)  || 0,
      totalResolved30d:  Number(gov.total_resolved_30d)  || 0,
      escalatedCount:    Number(gov.escalated_count)      || 0,
      escalationRatePct: Number(gov.escalation_rate_pct) || 0,
      privOverrides24h:  Number(gov.priv_overrides_24h)  || 0,
      failedLogins24h:   Number(gov.failed_logins_24h)   || 0,
      auditVolume24h:    Number(gov.audit_volume_24h)     || 0,
    },
    notifications: {
      totalUnread: Number(notif.total_unread) || 0,
      security:    Number(notif.security)     || 0,
      approval:    Number(notif.approval)     || 0,
      system:      Number(notif.system)       || 0,
    },
  };
}

// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║  PHASE 7A — BUSINESS INTELLIGENCE ENGINE FOUNDATION                         ║
// ║  All helpers below are internal only — NOT exported.                         ║
// ║  Every query is read-only and fully parameterized.                           ║
// ╚══════════════════════════════════════════════════════════════════════════════╝

// ── Statistical utilities (pure JS, no DB) ────────────────────────────────────
function _biLinReg(xs, ys) {
  const n  = xs.length;
  if (n < 2) return { slope: 0, intercept: ys[0] || 0, r2: 0 };
  const mx  = xs.reduce((a, b) => a + b, 0) / n;
  const my  = ys.reduce((a, b) => a + b, 0) / n;
  const ssxy = xs.reduce((s, x, i) => s + (x - mx) * (ys[i] - my), 0);
  const ssx  = xs.reduce((s, x)    => s + (x - mx) ** 2, 0);
  const ssy  = ys.reduce((s, y)    => s + (y - my) ** 2, 0);
  const slope = ssx > 0 ? ssxy / ssx : 0;
  return {
    slope,
    intercept: my - slope * mx,
    r2: (ssx > 0 && ssy > 0) ? (ssxy ** 2) / (ssx * ssy) : 0,
  };
}

function _biMovAvg(arr, w = 7) {
  return arr.map((_, i) => {
    const s = arr.slice(Math.max(0, i - w + 1), i + 1);
    return s.reduce((a, b) => a + b, 0) / s.length;
  });
}

function _biZscore(v, mean, sd) {
  return sd > 0 ? (v - mean) / sd : 0;
}

function _biForecasted(reg, lastX, n) {
  return Array.from({ length: n }, (_, i) =>
    Math.max(0, Math.round(reg.slope * (lastX + 1 + i) + reg.intercept)));
}

// ── Configurable health penalty weights ───────────────────────────────────────
const BI_HEALTH_PENALTIES = Object.freeze({
  failedJob:          2,
  failedLogin:        1,
  pendingApproval:    1,
  stalledApproval:    3,
  lowStockItem:       2,
  delayedDelivery:    2,
  overdueMaintenance: 2,
  govOverride:        3,
  decliningMachine:   5,
  fuelAnomaly_high:   5,
  fuelAnomaly_med:    3,
});

// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║  SECTION 1 — PREDICTION FUNCTIONS                                           ║
// ╚══════════════════════════════════════════════════════════════════════════════╝

async function _biPredictSales() {
  const [histRes, regRes] = await Promise.all([
    pool.query(`
      SELECT DATE(created_at)::text AS day,
             ROUND(SUM(quantity::numeric * unit_price)::numeric, 0) AS revenue
      FROM sales_orders
      WHERE created_at >= NOW() - INTERVAL '30 days'
        AND deleted_at IS NULL
        AND status != 'Cancelled'
      GROUP BY DATE(created_at)
      ORDER BY day`),
    pool.query(`
      WITH daily AS (
        SELECT ROW_NUMBER() OVER (ORDER BY DATE(created_at)) - 1 AS x,
               SUM(quantity::numeric * unit_price) AS y
        FROM sales_orders
        WHERE created_at >= NOW() - INTERVAL '90 days'
          AND deleted_at IS NULL
          AND status != 'Cancelled'
        GROUP BY DATE(created_at)
      )
      SELECT
        ROUND(COALESCE(regr_slope(y, x),     0)::numeric, 4) AS slope,
        ROUND(COALESCE(regr_intercept(y, x), 0)::numeric, 2) AS intercept,
        ROUND(COALESCE(regr_r2(y, x),        0)::numeric, 4) AS r2,
        ROUND(COALESCE(AVG(y),               0)::numeric, 2) AS avg_daily,
        COALESCE(MAX(x), 0)::int                             AS last_x,
        COUNT(*)::int                                        AS n
      FROM daily`),
  ]);

  const r       = regRes.rows[0] || {};
  const slope   = Number(r.slope)    || 0;
  const icept   = Number(r.intercept)|| 0;
  const r2      = Number(r.r2)       || 0;
  const avg     = Number(r.avg_daily)|| 0;
  const lastX   = Number(r.last_x)   || 0;
  const n       = Number(r.n)        || 0;
  const direction = avg > 0
    ? (slope > avg * 0.01 ? 'up' : slope < -avg * 0.01 ? 'down' : 'flat')
    : 'flat';

  const hist     = histRes.rows;
  const ys       = hist.map(h => Number(h.revenue));
  const r14      = ys.slice(-14);
  const p14      = ys.slice(-28, -14);
  const r14a     = r14.length ? r14.reduce((a, b) => a + b, 0) / r14.length : 0;
  const p14a     = p14.length ? p14.reduce((a, b) => a + b, 0) / p14.length : 0;
  const pct14    = p14a > 0 ? Number(((r14a - p14a) / p14a * 100).toFixed(1)) : 0;

  return {
    trend:          { slope, intercept: icept, r2, direction, avg_daily: avg, n, last_x: lastX },
    history:        hist,
    forecast:       _biForecasted({ slope, intercept: icept }, lastX, 30),
    pct_change_14d: pct14,
    moving_avg_7d:  _biMovAvg(ys, 7).map(v => Number(v.toFixed(2))),
  };
}

async function _biPredictFuelConsumption() {
  const { rows } = await pool.query(`
    WITH mf AS (
      SELECT log_date AS day, SUM(quantity)::numeric AS liters
      FROM machine_fuel_logs
      WHERE log_date >= CURRENT_DATE - 60
        AND deleted_at IS NULL
      GROUP BY log_date
    ),
    vf AS (
      SELECT log_date AS day, SUM(liters)::numeric AS liters
      FROM fuel_logs
      WHERE log_date >= CURRENT_DATE - 60
      GROUP BY log_date
    ),
    combined AS (
      SELECT day, SUM(liters) AS liters FROM (SELECT * FROM mf UNION ALL SELECT * FROM vf) x
      GROUP BY day ORDER BY day
    )
    SELECT day::text, ROUND(liters::numeric, 2) AS liters FROM combined`);

  if (!rows.length) return {
    history: [], mean: 0, stddev: 0, recent_7d_avg: 0,
    prev_period_avg: 0, pct_change: 0, z_score: 0, data_points: 0,
  };

  const vals   = rows.map(r => Number(r.liters));
  const mean   = vals.reduce((a, b) => a + b, 0) / vals.length;
  const sdraw  = Math.sqrt(vals.reduce((s, v) => s + (v - mean) ** 2, 0) / vals.length);
  const recent = vals.slice(-7);
  const prior  = vals.slice(-14, -7);
  const r7avg  = recent.length ? recent.reduce((a, b) => a + b, 0) / recent.length : 0;
  const p7avg  = prior.length  ? prior.reduce((a, b) => a + b, 0)  / prior.length  : 0;
  const pct    = p7avg > 0 ? Number(((r7avg - p7avg) / p7avg * 100).toFixed(1)) : 0;
  const z      = Number(_biZscore(r7avg, mean, sdraw).toFixed(2));

  return {
    history:         rows,
    data_points:     rows.length,
    mean:            Number(mean.toFixed(2)),
    stddev:          Number(sdraw.toFixed(2)),
    recent_7d_avg:   Number(r7avg.toFixed(2)),
    prev_period_avg: Number(p7avg.toFixed(2)),
    pct_change:      pct,
    z_score:         z,
  };
}

async function _biPredictStockRunout() {
  const { rows } = await pool.query(`
    WITH consumption AS (
      SELECT item_id,
             SUM(CASE WHEN movement_type = 'out' THEN quantity ELSE 0 END)::numeric / 30 AS avg_daily_out
      FROM stock_movements
      WHERE created_at >= NOW() - INTERVAL '30 days'
        AND deleted_at IS NULL
      GROUP BY item_id
    ),
    stock_totals AS (
      SELECT item_id, SUM(quantity)::numeric AS total_qty
      FROM stock_levels GROUP BY item_id
    )
    SELECT sc.id, sc.name, sc.category, sc.uom, sc.min_stock,
           COALESCE(st.total_qty, 0)::int                        AS current_stock,
           COALESCE(c.avg_daily_out, 0)::numeric(10,2)           AS avg_daily_consumption,
           CASE WHEN COALESCE(c.avg_daily_out, 0) > 0
             THEN LEAST(ROUND(COALESCE(st.total_qty, 0) / NULLIF(c.avg_daily_out, 0)), 999)::int
             ELSE NULL END                                       AS days_until_depletion
    FROM stock_catalog sc
    LEFT JOIN stock_totals st ON st.item_id = sc.id
    LEFT JOIN consumption  c  ON c.item_id  = sc.id
    WHERE sc.active = true
      AND ((COALESCE(c.avg_daily_out, 0) > 0
            AND (COALESCE(st.total_qty, 0) / NULLIF(COALESCE(c.avg_daily_out, 0), 1e-9) <= 30
                 OR st.total_qty IS NULL))
           OR COALESCE(st.total_qty, 0) <= sc.min_stock)
    ORDER BY COALESCE(ROUND(COALESCE(st.total_qty, 0) / NULLIF(COALESCE(c.avg_daily_out, 0), 1e-9)), 999),
             COALESCE(st.total_qty, 0)
    LIMIT 15`);
  return rows;
}

async function _biPredictHarvestCompletion() {
  const { rows } = await pool.query(`
    SELECT c.id, c.compt_name, c.sub_name, c.species,
           c.area_ha, c.volume_m3, c.status,
           COALESCE(SUM(h.quantity), 0)::int           AS total_harvested,
           COALESCE((
             SELECT SUM(quantity)::numeric / 30
             FROM harvest_logs
             WHERE compt_id = c.id
               AND harvest_date >= CURRENT_DATE - 30
               AND deleted_at IS NULL
           ), 0)::numeric(10,2)                        AS rate_per_day,
           GREATEST(c.volume_m3 - COALESCE(SUM(h.quantity), 0), 0)::numeric(10,1) AS est_remaining
    FROM compartments c
    LEFT JOIN harvest_logs h ON h.compt_id = c.id AND h.deleted_at IS NULL
    WHERE c.status = 'Active' AND c.deleted_at IS NULL
    GROUP BY c.id, c.compt_name, c.sub_name, c.species, c.area_ha, c.volume_m3, c.status
    ORDER BY c.entry_date
    LIMIT 10`);

  return rows.map(r => {
    const rate    = Number(r.rate_per_day);
    const rem     = Number(r.est_remaining);
    const daysLeft = (rate > 0 && rem > 0) ? Math.round(rem / rate) : null;
    const pctDone  = Number(r.volume_m3) > 0
      ? Math.min(100, Math.round(Number(r.total_harvested) / Number(r.volume_m3) * 100)) : 0;
    return { ...r, days_to_complete: daysLeft, pct_complete: pctDone };
  });
}

async function _biPredictWorkshopProduction() {
  const [histRes, regRes] = await Promise.all([
    pool.query(`
      SELECT DATE_TRUNC('week', log_date)::date::text AS week,
             SUM(COALESCE(timber_units, 0))::int      AS timber,
             SUM(COALESCE(poles_units,  0))::int      AS poles
      FROM daily_logs
      WHERE log_date >= CURRENT_DATE - 84
        AND deleted_at IS NULL
      GROUP BY DATE_TRUNC('week', log_date)
      ORDER BY week`),
    pool.query(`
      WITH weekly AS (
        SELECT ROW_NUMBER() OVER (ORDER BY DATE_TRUNC('week', log_date)) - 1 AS x,
               SUM(COALESCE(timber_units, 0) + COALESCE(poles_units, 0))::numeric AS total,
               SUM(COALESCE(timber_units, 0))::numeric AS timber,
               SUM(COALESCE(poles_units,  0))::numeric AS poles
        FROM daily_logs
        WHERE log_date >= CURRENT_DATE - 84
          AND deleted_at IS NULL
        GROUP BY DATE_TRUNC('week', log_date)
      )
      SELECT
        ROUND(COALESCE(regr_slope(total,  x), 0)::numeric, 4) AS total_slope,
        ROUND(COALESCE(regr_intercept(total, x), 0)::numeric, 2) AS total_intercept,
        ROUND(COALESCE(regr_r2(total,  x), 0)::numeric, 4) AS total_r2,
        ROUND(COALESCE(regr_slope(timber, x), 0)::numeric, 4) AS timber_slope,
        ROUND(COALESCE(regr_slope(poles,  x), 0)::numeric, 4) AS poles_slope,
        ROUND(COALESCE(AVG(total),  0)::numeric, 1)          AS total_avg,
        COALESCE(MAX(x), 0)::int                             AS last_x,
        COUNT(*)::int                                        AS n
      FROM weekly`),
  ]);

  const hist = histRes.rows;
  const r    = regRes.rows[0] || {};
  const trend = {
    total_slope:     Number(r.total_slope)     || 0,
    total_intercept: Number(r.total_intercept) || 0,
    total_r2:        Number(r.total_r2)        || 0,
    timber_slope:    Number(r.timber_slope)    || 0,
    poles_slope:     Number(r.poles_slope)     || 0,
    total_avg:       Number(r.total_avg)       || 0,
    last_x:          Number(r.last_x)          || 0,
    n:               Number(r.n)               || 0,
  };

  const totals = hist.map(h => Number(h.timber) + Number(h.poles));
  const r4  = totals.slice(-4);
  const p4  = totals.slice(-8, -4);
  const r4a = r4.length ? r4.reduce((a, b) => a + b, 0) / r4.length : 0;
  const p4a = p4.length ? p4.reduce((a, b) => a + b, 0) / p4.length : 0;
  const pct4w = p4a > 0 ? Number(((r4a - p4a) / p4a * 100).toFixed(1)) : 0;

  return {
    trend,
    history:       hist,
    forecast:      _biForecasted({ slope: trend.total_slope, intercept: trend.total_intercept }, trend.last_x, 4),
    pct_change_4w: pct4w,
  };
}

async function _biPredictMaintenance() {
  const { rows } = await pool.query(`
    SELECT m.id, m.machine_code, m.name, m.status,
           mms.id AS schedule_id, mms.maintenance_type, mms.frequency_days,
           mms.last_performed, mms.next_due::text,
           (CURRENT_DATE - mms.next_due)::int AS days_overdue,
           (SELECT ROUND(AVG(
             CASE WHEN capacity_per_day > 0
               THEN daily_production::numeric / capacity_per_day * 100 END
           )::numeric, 1)
            FROM machine_daily_logs
            WHERE machine_id = m.id
              AND log_date >= CURRENT_DATE - 14
              AND deleted_at IS NULL
           ) AS recent_eff_pct
    FROM machines m
    JOIN machine_maintenance_schedules mms ON mms.machine_id = m.id
    WHERE m.active = true
      AND mms.next_due <= CURRENT_DATE + 14
    ORDER BY days_overdue DESC NULLS LAST, mms.next_due
    LIMIT 15`);
  return rows;
}

// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║  SECTION 2 — RISK DETECTION FUNCTIONS                                       ║
// ╚══════════════════════════════════════════════════════════════════════════════╝

function _biDetectFuelAnomalies(fuelData) {
  const { z_score, pct_change, recent_7d_avg, mean, data_points } = fuelData;
  const z   = Number(z_score)   || 0;
  const pct = Number(pct_change)|| 0;
  const detected  = z > 1.5;
  const severity  = z > 2 ? 'critical' : z > 1.5 ? 'high' : z > 0.8 ? 'medium' : 'low';
  const score     = z > 2 ? 40 : z > 1.5 ? 25 : z > 0.8 ? 10 : 0;
  const description = (data_points || 0) < 5
    ? 'Insufficient fuel data for anomaly detection'
    : detected
    ? `Fuel consumption ${Math.abs(pct).toFixed(1)}% ${pct > 0 ? 'above' : 'below'} baseline (Z=${z.toFixed(2)})`
    : `Fuel consumption within normal range (Z=${z.toFixed(2)})`;
  return {
    detected, z_score: z, pct_change: pct,
    recent_avg: Number(recent_7d_avg) || 0,
    baseline:   Number(mean)          || 0,
    score, severity, description,
    metrics: { z_score: z, pct_change: pct, data_points: data_points || 0 },
  };
}

async function _biDetectStockAnomalies() {
  const { rows } = await pool.query(`
    WITH stats AS (
      SELECT item_id,
             AVG(ABS(quantity))::numeric              AS mean_qty,
             COALESCE(STDDEV_POP(ABS(quantity)), 0)::numeric AS stddev_qty
      FROM stock_movements
      WHERE created_at >= NOW() - INTERVAL '60 days'
        AND deleted_at IS NULL
      GROUP BY item_id
    )
    SELECT sm.item_id, sm.quantity, sm.movement_type,
           sm.created_at::text AS created_at,
           sc.name             AS item_name,
           ROUND(((ABS(sm.quantity) - s.mean_qty)
             / NULLIF(s.stddev_qty, 0))::numeric, 2) AS z_score
    FROM stock_movements sm
    JOIN stock_catalog  sc ON sc.id = sm.item_id
    JOIN stats          s  ON s.item_id = sm.item_id
    WHERE sm.created_at >= NOW() - INTERVAL '7 days'
      AND sm.deleted_at IS NULL
      AND s.stddev_qty > 0
      AND ABS(sm.quantity) > s.mean_qty + 2 * s.stddev_qty
    ORDER BY z_score DESC NULLS LAST
    LIMIT 10`);

  const maxZ     = rows.length ? Math.max(...rows.map(r => Number(r.z_score) || 0)) : 0;
  const severity = rows.length >= 5 || maxZ > 4 ? 'critical'
    : rows.length >= 2 || maxZ > 3 ? 'high'
    : rows.length >= 1 ? 'medium' : 'low';
  return {
    anomalies:   rows,
    count:       rows.length,
    score:       Math.min(rows.length * 10, 40),
    severity,
    description: rows.length
      ? `${rows.length} abnormal stock movement(s) in last 7 days`
      : 'No abnormal stock movements detected',
    metrics: { count: rows.length, max_z_score: maxZ },
  };
}

async function _biDetectMachineEfficiency() {
  const { rows } = await pool.query(`
    WITH weekly_eff AS (
      SELECT machine_id,
             ROW_NUMBER() OVER (PARTITION BY machine_id ORDER BY DATE_TRUNC('week', log_date)) - 1 AS x,
             AVG(CASE WHEN capacity_per_day > 0
               THEN daily_production::numeric / capacity_per_day * 100 END)::numeric AS eff
      FROM machine_daily_logs
      WHERE log_date >= CURRENT_DATE - 63
        AND deleted_at IS NULL
      GROUP BY machine_id, DATE_TRUNC('week', log_date)
    )
    SELECT m.machine_code, m.name,
           ROUND(regr_slope(eff, x)::numeric, 2)  AS eff_slope,
           ROUND(AVG(eff)::numeric, 1)             AS avg_eff,
           COUNT(*)::int                           AS weeks
    FROM weekly_eff we
    JOIN machines m ON m.id = we.machine_id
    WHERE we.eff IS NOT NULL
    GROUP BY m.id, m.machine_code, m.name
    HAVING COUNT(*) >= 3 AND regr_slope(eff, x) < -2
    ORDER BY regr_slope(eff, x) ASC
    LIMIT 8`);

  const severity = rows.some(r => Number(r.eff_slope) < -10) ? 'critical'
    : rows.length > 2 ? 'high' : rows.length > 0 ? 'medium' : 'low';
  return {
    declining:   rows,
    count:       rows.length,
    score:       Math.min(rows.length * 15, 45),
    severity,
    description: rows.length
      ? `${rows.length} machine(s) with declining weekly efficiency`
      : 'No significant efficiency decline detected',
    metrics: { count: rows.length },
  };
}

async function _biDetectDelayedDeliveries() {
  const { rows } = await pool.query(`
    SELECT id, order_number, delivery_date::text,
           (CURRENT_DATE - delivery_date)::int AS days_overdue,
           status, driver_name
    FROM delivery_orders
    WHERE status IN ('Pending', 'Dispatched')
      AND delivery_date < CURRENT_DATE
    ORDER BY days_overdue DESC
    LIMIT 20`);

  const maxOverdue = rows.length ? Math.max(...rows.map(r => Number(r.days_overdue))) : 0;
  const severity   = maxOverdue > 7 || rows.length > 5 ? 'critical'
    : maxOverdue > 3 || rows.length > 2 ? 'high'
    : rows.length > 0 ? 'medium' : 'low';
  return {
    items:       rows,
    count:       rows.length,
    score:       Math.min(rows.length * 10, 40),
    severity,
    description: rows.length
      ? `${rows.length} delivery order(s) past due (max ${maxOverdue} day(s) overdue)`
      : 'All deliveries on schedule',
    metrics: { count: rows.length, max_days_overdue: maxOverdue },
  };
}

async function _biDetectSecurityRisks() {
  const { rows } = await pool.query(`
    SELECT
      (SELECT COUNT(*)::int FROM audit_log
       WHERE action_type = 'login_failed'
         AND created_at > NOW() - INTERVAL '24 hours') AS failed_logins_24h,
      (SELECT COUNT(DISTINCT user_id)::int FROM audit_log
       WHERE action_type = 'login_failed'
         AND created_at > NOW() - INTERVAL '24 hours') AS unique_users_failed,
      (SELECT COUNT(*)::int FROM audit_log
       WHERE action_type = 'login_failed'
         AND created_at > NOW() - INTERVAL '1 hour')   AS failed_logins_1h`);

  const r   = rows[0] || {};
  const fl  = Number(r.failed_logins_24h)  || 0;
  const uu  = Number(r.unique_users_failed) || 0;
  const h1  = Number(r.failed_logins_1h)   || 0;
  const brute   = h1 >= 5 || (fl >= 10 && uu <= 2);
  const severity = brute || fl >= 20 ? 'critical' : fl >= 10 ? 'high' : fl >= 3 ? 'medium' : 'low';
  return {
    failed_logins_24h:     fl,
    unique_users_failed:   uu,
    failed_logins_1h:      h1,
    brute_force_suspected: brute,
    score:       brute ? 50 : Math.min(fl * 2, 30),
    severity,
    description: brute
      ? `Possible brute-force: ${h1} failures in 1h (${fl} total 24h)`
      : fl >= 3 ? `${fl} failed login attempt(s) in last 24h`
      : 'No unusual login activity',
    metrics: { failed_logins_24h: fl, unique_users_failed: uu, failed_logins_1h: h1 },
  };
}

async function _biDetectGovernanceRisks() {
  const [gRes, slaRes] = await Promise.all([
    pool.query(`
      SELECT
        (SELECT COUNT(*)::int FROM audit_log
         WHERE action_type = 'privileged_override'
           AND created_at > NOW() - INTERVAL '24 hours')            AS priv_overrides_24h,
        (SELECT COUNT(*)::int FROM pending_edits
         WHERE status = 'Pending'
           AND submitted_at < NOW() - INTERVAL '48 hours')          AS stalled_48h,
        (SELECT COUNT(*)::int FROM pending_edits
         WHERE status = 'Pending'
           AND submitted_at < NOW() - INTERVAL '96 hours')          AS stalled_96h,
        (SELECT COUNT(*)::int FROM pending_edits WHERE status='Pending') +
        (SELECT COUNT(*)::int FROM deletion_requests WHERE status='pending') AS total_pending,
        (SELECT ROUND(AVG(EXTRACT(EPOCH FROM (NOW() - submitted_at))/3600)::numeric, 1)
         FROM pending_edits WHERE status = 'Pending')               AS avg_pending_hours`),
    pool.query(`
      SELECT ROUND(
        100.0 * COUNT(CASE WHEN EXTRACT(EPOCH FROM (reviewed_at - submitted_at)) <= 172800 THEN 1 END)
        / NULLIF(COUNT(id), 0), 1)::numeric AS sla_pct
      FROM pending_edits
      WHERE status IN ('Approved','Rejected')
        AND submitted_at >= NOW() - INTERVAL '30 days'`),
  ]);

  const g   = gRes.rows[0]   || {};
  const s   = slaRes.rows[0] || {};
  const ov  = Number(g.priv_overrides_24h) || 0;
  const s48 = Number(g.stalled_48h)        || 0;
  const s96 = Number(g.stalled_96h)        || 0;
  const tp  = Number(g.total_pending)      || 0;
  const aph = Number(g.avg_pending_hours)  || 0;
  const sla = Number(s.sla_pct)            ?? 100;

  const severity = (ov > 3 || s96 > 0 || sla < 50) ? 'critical'
    : (ov > 0 || s48 > 3 || sla < 70) ? 'high'
    : (s48 > 0 || sla < 90) ? 'medium' : 'low';
  return {
    priv_overrides_24h: ov,
    stalled_48h:        s48,
    stalled_96h:        s96,
    total_pending:      tp,
    avg_pending_hours:  aph,
    sla_compliance_pct: sla,
    score: Math.min(ov * 10 + s48 * 5 + Math.max(0, 100 - sla), 50),
    severity,
    description: ov > 0
      ? `${ov} privileged override(s) in 24h; ${s48} stalled approval(s)`
      : s48 > 0 ? `${s48} approval(s) pending over 48h (SLA: ${sla}%)`
      : `Governance healthy — SLA: ${sla}%`,
    metrics: { priv_overrides_24h: ov, stalled_48h: s48, total_pending: tp, sla_compliance_pct: sla },
  };
}

async function _biDetectWorkflowRisks() {
  const { rows } = await pool.query(`
    SELECT
      COUNT(*) FILTER (WHERE status = 'failed')::int                        AS failed_jobs,
      COUNT(*) FILTER (WHERE status = 'processing'
        AND created_at < NOW() - INTERVAL '30 minutes')::int                AS stuck_processing,
      COUNT(*) FILTER (WHERE status = 'pending')::int                       AS pending_jobs,
      COUNT(*)::int                                                         AS total_jobs
    FROM workflow_jobs`);

  const r  = rows[0] || {};
  const fj = Number(r.failed_jobs)      || 0;
  const sp = Number(r.stuck_processing) || 0;
  const severity = fj > 10 || sp > 0 ? 'critical' : fj > 5 ? 'high' : fj > 0 ? 'medium' : 'low';
  return {
    failed_jobs:      fj,
    stuck_processing: sp,
    pending_jobs:     Number(r.pending_jobs) || 0,
    score:            Math.min(fj * 5 + sp * 20, 60),
    severity,
    description:      sp > 0 ? `${sp} job(s) stuck in processing; ${fj} failed`
      : fj > 0 ? `${fj} failed workflow job(s) need attention`
      : 'All workflow jobs healthy',
    metrics: { failed_jobs: fj, stuck_processing: sp },
  };
}

// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║  SECTION 3 — SYNTHESIS FUNCTIONS                                            ║
// ╚══════════════════════════════════════════════════════════════════════════════╝

function _biGenerateRecommendations(predictions, detections) {
  const SEV_ORDER = { critical: 0, high: 1, medium: 2, low: 3 };
  const recs  = [];
  let   _seq  = 0;
  const addR  = (sev, icon, mod, text, action = '') =>
    recs.push({ id: `bi-rec-${++_seq}`, title: text.slice(0, 60),
      description: text, priority: sev, module: mod, action, icon });

  const { stockRunout, harvest, production, sales, maintenance } = predictions;
  const { fuelAnomaly, machineEfficiency, delayedDeliveries,
          security, governance, workflow } = detections;

  // Stock shortages
  for (const s of (stockRunout || []).filter(r => r.days_until_depletion != null && r.days_until_depletion <= 7).slice(0, 3))
    addR('critical', 'ti-package', 'Stock',
      `"${s.name}" will run out in ${s.days_until_depletion} day(s) — reorder immediately.`,
      'Raise a material request now');
  const hs = (stockRunout || []).filter(r => r.days_until_depletion != null && r.days_until_depletion > 7 && r.days_until_depletion <= 14);
  if (hs.length)
    addR('high', 'ti-package', 'Stock',
      `${hs.length} stock item(s) will deplete within 14 days.`,
      'Review procurement schedule');

  // Maintenance
  for (const m of (maintenance || []).filter(r => Number(r.days_overdue) > 0).slice(0, 3))
    addR(Number(m.days_overdue) > 14 ? 'critical' : 'high',
      'ti-settings-2', 'Machines',
      `Machine "${m.machine_code} ${m.name}" — ${m.maintenance_type} is ${m.days_overdue} day(s) overdue.`,
      'Schedule maintenance immediately');

  // Fuel anomaly
  if (fuelAnomaly && fuelAnomaly.detected) {
    const fp = fuelAnomaly.pct_change || 0;
    addR(fuelAnomaly.severity, 'ti-droplet', 'Fuel',
      fp > 0
        ? `Fuel up ${Math.abs(fp).toFixed(1)}% vs baseline — investigate abnormal usage.`
        : `Fuel down ${Math.abs(fp).toFixed(1)}% — verify machines are running normally.`,
      fp > 0 ? 'Audit fuel logs and check for leaks' : 'Confirm machines are operational');
  }

  // Sales trend
  if (sales && sales.trend.avg_daily > 0) {
    const tp = (sales.trend.slope / sales.trend.avg_daily) * 100;
    if (tp > 5)
      addR('low', 'ti-trending-up', 'Sales',
        `Sales trending up +${tp.toFixed(1)}%/day — consider increasing production capacity.`,
        'Review production capacity plan');
    else if (tp < -5)
      addR('medium', 'ti-trending-down', 'Sales',
        `Sales declining ${Math.abs(tp).toFixed(1)}%/day — review pricing and customer retention.`,
        'Conduct customer and pricing review');
  }

  // Production trend
  if (production && production.trend.total_avg > 0) {
    const pt = (production.trend.total_slope / production.trend.total_avg) * 100;
    if (pt < -10)
      addR('high', 'ti-building-factory', 'Production',
        `Workshop output dropped ${Math.abs(pt).toFixed(0)}%/week — check downtime and machine efficiency.`,
        'Audit production downtime logs');
    else if (pt > 10)
      addR('low', 'ti-trending-up', 'Production',
        `Workshop output up ${pt.toFixed(0)}%/week — strong output trend continues.`,
        'Maintain current operational pace');
  }

  // Slow harvests
  for (const h of (harvest || []).filter(r => r.days_to_complete !== null && r.days_to_complete > 90))
    addR('medium', 'ti-trees', 'Harvest',
      `Compartment "${h.compt_name}" — est. ${h.days_to_complete} more days at current pace.`,
      'Review harvest scheduling and resource allocation');

  // Declining machine efficiency
  for (const m of (machineEfficiency?.declining || []).slice(0, 2))
    addR('high', 'ti-settings-2', 'Machines',
      `Machine "${m.machine_code} ${m.name}" efficiency declining ${Math.abs(Number(m.eff_slope)).toFixed(1)}%/week.`,
      'Schedule preventive inspection');

  // Approvals
  if (governance && governance.stalled_48h > 0)
    addR('medium', 'ti-clock-check', 'Approvals',
      `${governance.stalled_48h} approval request(s) pending over 48h — SLA breached.`,
      'Escalate to senior approver');
  if (governance && governance.priv_overrides_24h > 0)
    addR(governance.priv_overrides_24h > 3 ? 'critical' : 'high',
      'ti-shield-exclamation', 'Governance',
      `${governance.priv_overrides_24h} privileged override(s) used in last 24h.`,
      'Review override justifications in audit log');

  // Security
  if (security && security.brute_force_suspected)
    addR('critical', 'ti-lock', 'Security',
      `Possible brute-force: ${security.failed_logins_1h} failed logins in 1h.`,
      'Consider temporary lockout or IP restriction');
  else if (security && security.failed_logins_24h >= 10)
    addR('high', 'ti-lock', 'Security',
      `${security.failed_logins_24h} failed login attempts in last 24h.`,
      'Review audit log and notify affected users');

  // Workflow jobs
  if (workflow && workflow.stuck_processing > 0)
    addR('critical', 'ti-alert-triangle', 'System',
      `${workflow.stuck_processing} workflow job(s) stuck in processing — system may be stalled.`,
      'Run workflow recovery: recoverWorkflowState()');
  else if (workflow && workflow.failed_jobs > 0)
    addR(workflow.failed_jobs > 5 ? 'critical' : 'high',
      'ti-alert-triangle', 'System',
      `${workflow.failed_jobs} failed workflow job(s) detected.`,
      'Review workflow_jobs table for error details');

  // Delayed deliveries
  if (delayedDeliveries && delayedDeliveries.count > 0)
    addR(delayedDeliveries.severity, 'ti-truck', 'Logistics',
      `${delayedDeliveries.count} delivery order(s) are past their due date.`,
      'Contact drivers and update delivery status');

  recs.sort((a, b) => SEV_ORDER[a.priority] - SEV_ORDER[b.priority]);
  return recs;
}

function calculateCompanyHealth(predictions, detections, config = {}) {
  const pen      = { ...BI_HEALTH_PENALTIES, ...config };
  let   score    = 100;
  const breakdown = [];

  const sub = (label, raw, icon) => {
    const pts = Math.max(0, Math.min(Math.round(raw), 25));
    if (pts > 0) breakdown.push({ label, pts, icon, deduction: pts });
    score -= pts;
  };

  const { stockRunout, maintenance }  = predictions;
  const { workflow, governance, security,
          fuelAnomaly, delayedDeliveries, machineEfficiency } = detections;

  sub('Failed Workflow Jobs',
    (workflow.failed_jobs + workflow.stuck_processing * 2) * pen.failedJob,
    'ti-alert-triangle');
  sub('Failed Logins (24h)',
    security.failed_logins_24h * pen.failedLogin,
    'ti-lock');
  sub('Pending Approvals',
    Math.min(governance.total_pending * pen.pendingApproval, 15),
    'ti-clock');
  sub('Stalled Approvals (>48h)',
    governance.stalled_48h * pen.stalledApproval,
    'ti-clock-off');
  sub('Near-Depletion Stock',
    (stockRunout || []).length * pen.lowStockItem,
    'ti-package');
  sub('Delayed Deliveries',
    delayedDeliveries.count * pen.delayedDelivery,
    'ti-truck');
  sub('Overdue Maintenance',
    (maintenance || []).filter(m => Number(m.days_overdue) > 0).length * pen.overdueMaintenance,
    'ti-settings-2');
  sub('Governance Overrides (24h)',
    governance.priv_overrides_24h * pen.govOverride,
    'ti-shield-exclamation');
  sub('Declining Machine Efficiency',
    (machineEfficiency?.declining || []).length * pen.decliningMachine,
    'ti-trending-down');
  sub('Fuel Anomaly',
    fuelAnomaly.detected
      ? (fuelAnomaly.z_score > 2 ? pen.fuelAnomaly_high : pen.fuelAnomaly_med) : 0,
    'ti-droplet');

  score = Math.max(0, Math.round(score));
  const grade = score >= 80 ? 'Excellent' : score >= 60 ? 'Good' : score >= 40 ? 'Warning' : 'Critical';
  return { score, grade, breakdown };
}

// ── Main orchestrator (exported, same API surface as Phase 7) ─────────────────
const BI_SECTIONS = {
  admin:                   ['health','stock','fuel','machines','workshop','harvest','sales','governance','recommendations','charts'],
  ceo:                     ['health','stock','fuel','machines','workshop','harvest','sales','governance','recommendations','charts'],
  operations:              ['health','stock','fuel','machines','workshop','harvest','sales','governance','recommendations','charts'],
  supervisor:              ['health','stock','fuel','machines','workshop','harvest','recommendations','charts'],
  'sawmill-leader':        ['health','fuel','machines','workshop'],
  'sawmill-supervisor':    ['health','fuel','machines','workshop'],
  'harvesting-leader':     ['health','fuel','harvest'],
  'harvesting-supervisor': ['health','fuel','harvest'],
  'vat-leader':            ['health','workshop','harvest'],
  'poles-leader':          ['health','machines','harvest'],
  storekeeper:             ['health','stock','fuel'],
  'storekeeper-assistant': ['health','stock'],
};

async function businessIntelligenceDashboard(userId) {
  const user     = await getUser(userId);
  const sections = BI_SECTIONS[user.role];
  if (!sections)
    return { ok: false, error: 'Access denied' };

  const [
    sales,
    fuelRaw,
    stockRunout,
    harvest,
    production,
    maintenance,
    stockAnomalyDet,
    machineEfficiency,
    delayedDeliveries,
    security,
    governance,
    workflow,
  ] = await Promise.all([
    _biPredictSales(),
    _biPredictFuelConsumption(),
    _biPredictStockRunout(),
    _biPredictHarvestCompletion(),
    _biPredictWorkshopProduction(),
    _biPredictMaintenance(),
    _biDetectStockAnomalies(),
    _biDetectMachineEfficiency(),
    _biDetectDelayedDeliveries(),
    _biDetectSecurityRisks(),
    _biDetectGovernanceRisks(),
    _biDetectWorkflowRisks(),
  ]);

  const fuelAnomaly    = _biDetectFuelAnomalies(fuelRaw);
  const allPredictions = { stockRunout, fuel: fuelRaw, harvest, production, sales, maintenance };
  const allDetections  = {
    fuelAnomaly, stockAnomalies: stockAnomalyDet,
    machineEfficiency, delayedDeliveries, security, governance, workflow,
  };

  const recommendations = _biGenerateRecommendations(allPredictions, allDetections);
  const health          = calculateCompanyHealth(allPredictions, allDetections);

  // Build sorted risk list from all detections
  const SEV_ORDER = { critical: 0, high: 1, medium: 2, low: 3 };
  const risks     = [];
  const addRisk   = (severity, module, title, detail, icon) =>
    risks.push({ severity, module, title, detail, icon });

  for (const item of stockRunout) {
    const d   = item.days_until_depletion;
    const sev = d != null ? (d <= 7 ? 'critical' : d <= 14 ? 'high' : 'medium') : 'medium';
    addRisk(sev, 'Stock', `Shortage: ${item.name}`,
      d != null ? `${d} day(s) until depletion` : 'Below minimum stock', 'ti-package');
  }
  if (fuelAnomaly.detected)
    addRisk(fuelAnomaly.severity, 'Fuel', 'Fuel Consumption Anomaly',
      fuelAnomaly.description, 'ti-droplet');
  for (const m of maintenance) {
    const ov = Number(m.days_overdue);
    addRisk(ov > 14 ? 'critical' : ov > 0 ? 'high' : 'medium', 'Machines',
      `Maintenance: ${m.machine_code}`,
      ov > 0 ? `${m.maintenance_type} — ${ov} day(s) overdue`
             : `${m.maintenance_type} due within 14 days`, 'ti-settings-2');
  }
  for (const m of machineEfficiency.declining)
    addRisk('high', 'Machines', `Declining Efficiency: ${m.machine_code}`,
      `${Math.abs(Number(m.eff_slope)).toFixed(1)}%/week decline`, 'ti-trending-down');
  if (security.failed_logins_24h >= 3)
    addRisk(security.severity, 'Security',
      security.brute_force_suspected ? 'Possible Brute-Force Attack' : 'Multiple Failed Logins',
      security.description, 'ti-lock');
  if (governance.priv_overrides_24h > 0)
    addRisk(governance.priv_overrides_24h > 3 ? 'critical' : 'high', 'Governance',
      'Privileged Override Activity',
      `${governance.priv_overrides_24h} override(s) in 24h`, 'ti-shield-exclamation');
  if (governance.stalled_48h > 0)
    addRisk(governance.stalled_48h > 5 ? 'high' : 'medium', 'Approvals',
      'Stalled Approval Requests',
      `${governance.stalled_48h} request(s) pending > 48h`, 'ti-clock-off');
  if (delayedDeliveries.count > 0)
    addRisk(delayedDeliveries.severity, 'Logistics', 'Delayed Deliveries',
      `${delayedDeliveries.count} delivery order(s) past due`, 'ti-truck');
  if (workflow.failed_jobs > 0)
    addRisk(workflow.severity, 'System', 'Failed Workflow Jobs',
      `${workflow.failed_jobs} job(s) in failed state`, 'ti-alert-triangle');
  for (const sm of stockAnomalyDet.anomalies)
    addRisk(Number(sm.z_score) > 3 ? 'critical' : 'high', 'Stock',
      `Abnormal Movement: ${sm.item_name}`,
      `Qty ${sm.quantity} (${sm.movement_type}) — ${Number(sm.z_score).toFixed(1)}σ from mean`,
      'ti-arrows-exchange');
  risks.sort((a, b) => SEV_ORDER[a.severity] - SEV_ORDER[b.severity]);

  // govRisk summary — keeps the same renderer API shape from Phase 7
  const govRow = {
    failed_logins_24h:  security.failed_logins_24h,
    priv_overrides_24h: governance.priv_overrides_24h,
    failed_jobs:        workflow.failed_jobs,
    total_pending:      governance.total_pending,
    stalled_48h:        governance.stalled_48h,
    delayed_deliveries: delayedDeliveries.count,
    avg_pending_hours:  governance.avg_pending_hours,
  };

  return {
    ok: true,
    sections,
    health,
    predictions: {
      stockShortages:     stockRunout,
      fuelAnomaly:        { ...fuelRaw, z_score: fuelAnomaly.z_score, pct_change: fuelAnomaly.pct_change },
      machineAlerts:      maintenance,
      efficiencyDecline:  machineEfficiency.declining,
      harvestForecast:    harvest,
      salesRegression:    sales.trend,
      workshopRegression: production.trend,
    },
    forecasts: {
      sales30d:      sales.history,
      salesForecast: sales.forecast,
      wkTrend:       production.history,
      wkForecast:    production.forecast,
    },
    risks,
    recommendations,
    govRisk:        govRow,
    stockAnomalies: stockAnomalyDet.anomalies,
  };
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
  salesProductsForDropdown,
  salesUpdatePayment,
  customersForDropdown,
  customersList,
  customersCreate,
  customersUpdate,
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
  notificationsPoll,
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
  usersDelete,
  usersResetPassword,
  rolesList,
  rolesUpdate,
  warehousesList,
  warehousesCreate,
  warehousesUpdate,
  stockItemsList,
  stockItemsCreate,
  stockItemsUpdate,
  stockCategoriesList,
  stockCategoriesCreate,
  stockCategoriesDelete,
  stockMovementsList,
  stockMovementsCreate,
  stockTransferApprove,
  stockTransfersList,
  stockTransfersCreate,
  stockTransfersApproveReject,
  stockTransfersDispatch,
  stockTransfersDispatchHistory,
  stockTransfersReceive,
  materialRequestsList,
  materialRequestsCreate,
  materialRequestsApprove,
  workshopOverview,
  vehiclesForTransport,
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
  deliveryOrdersRecordPOD,
  salesCloseShort,
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
  machineFuelIssuedLookup,
  machineKpiDefinitionsList,
  machineKpiDefinitionsCreate,
  machineKpiTargetsList,
  machineKpiTargetsSave,
  machineKpiPerformance,
  machineMaintScheduleList,
  machineMaintScheduleCreate,
  machineMaintScheduleUpdate,
  machineMaintScheduleDelete,
  machinesDelete,
  machineCategoriesUpdate,
  machineCategoriesDelete,
  machineKpiDefinitionsUpdate,
  machineKpiDefinitionsDelete,
  maintenanceUpdate,
  valueAddedTimberUpdate,
  logTransportUpdate,
  machineFuelLogsUpdate,
  productsUpdate,
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
  machineFuelDropdown,
  machineFuelSummary,
  machineFuelLogsList,
  machineFuelLogsCreate,
  machineFuelLogsDelete,
  casualLabourRequestsList,
  casualLabourRequestsCreate,
  casualLabourRequestsSubmit,
  casualLabourRequestsReview,
  casualLabourRequestsDelete,
  casualsList,
  casualsCreate,
  casualsUpdate,
  casualsDelete,
  getCeoOverview,
  deletionRequestCreate,
  deletionRequestsList,
  deletionRequestApprove,
  deletionRequestReject,
  trashList,
  trashRestore,
  trashPurge,
  productionStaffList,
  polesPurchaseList,
  polesPurchaseCreate,
  polesPurchaseApprove,
  polesDeliveryCreate,
  polesDeliveryQualityCheck,
  vatInboundList,
  // Step 3 — Approval Workflow Engine
  processApprovalDecision,
  escalatePendingRequests,
  getApprovalDashboard,
  routeApprovalRequest,
  // Step 4 — Persistent Job Queue Engine
  scheduleJob,
  processWorkflowJobs,
  recoverWorkflowState,
  // Phase 6E — Security & Governance Dashboard
  secGovDashboard,
  // Phase 6F — Executive Analytics & Reporting
  executiveDashboard,
  // Phase 7 — Business Intelligence & Predictive Analytics
  businessIntelligenceDashboard,
  // Phase 8 — Intelligent Automation Engine
  runAutomationEngine,
  getAutomationRules,
  toggleAutomationRule,
  getAutomationLog,
  triggerAutomationNow,
  // Phase 8 Part 3 — Rule Engine management
  getAutomationRule,
  updateAutomationRule,
  deleteAutomationRule,
  createAutomationRule,
  // Phase 8 Part 4 — Escalation Engine
  runEscalationEngine,
  getEscalations,
  getEscalationHistory,
  resolveEscalation,
  acknowledgeEscalation,
  // Phase 8 Part 5/6 — Automation Dashboard + canonical aliases
  automationDashboard,
  automationRunNow:     triggerAutomationNow,
  automationRulesList:  getAutomationRules,
  automationRuleUpdate: updateAutomationRule,
  automationHistory:    getAutomationLog,
  // Phase 8 Part 2 — Internal Scheduler
  startScheduler,
  stopScheduler,
  stopJobProcessor,
  // Phase 9 — Enterprise Performance Management
  performanceDashboard,
  performanceKPIs,
  departmentScorecards,
  executiveScorecard,
  performanceTrends,
  performanceActionPlans,
  performanceExport,
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

    pool.query(`select count(*)::int as total from vehicles where status='Active'`),

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
  if (!['admin', 'ceo', 'operations', 'logistics'].includes(user.role)) return { ok: false, error: 'Access denied' };
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
  if (!['admin', 'ceo', 'logistics'].includes(user.role)) return { ok: false, error: 'Access denied' };
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
  if (!['admin', 'ceo', 'logistics'].includes(user.role)) return { ok: false, error: 'Access denied' };
  const { rows: snap } = await pool.query('SELECT * FROM machines WHERE id=$1', [machineId]);
  const before = snap[0] || null;
  const blocked = await applyGovernance(user, 'machines', machineId, 'edit', {
    ownerCol: 'created_by', entityType: 'machine',
    entityRef: `Machine ${before?.machine_code || '#' + machineId}`, payload, before
  });
  if (blocked) return blocked;
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
  const { rows: snap } = await pool.query(`SELECT * FROM machine_log_categories WHERE id=$1`, [id]);
  if (!snap.length) return { ok: false, error: 'Category not found' };
  const before = snap[0];
  await pool.query(`UPDATE machine_log_categories SET active=false WHERE id=$1`, [id]);
  logAudit(user, `Deactivated machine log category: ${before.name || '#' + id}`, 'ti-trash',
    { id, name: before.name },
    { module: 'machine_log_categories', actionType: 'delete', recordId: id, before, after: null }
  );
  return { ok: true };
}

async function machineLogsList(userId, machineId, month, workshopId) {
  const user = await getUser(userId);
  const hasPerm = (await mustRole(user, 'machine-logs')) || (await mustRole(user, 'machines'));
  if (!hasPerm) return { ok: false, error: 'Access denied' };

  const restricted = isWorkshopRestricted(user);
  let whereClause = '';
  const params = [];
  if (machineId) { params.push(machineId); whereClause += ` and mdl.machine_id = $${params.length}`; }
  if (month) { params.push(month); whereClause += ` and to_char(mdl.log_date,'YYYY-MM') = $${params.length}`; }
  const effectiveWorkshop = restricted ? user.workshop_id : (workshopId || null);
  if (effectiveWorkshop) {
    params.push(effectiveWorkshop);
    whereClause += ` and (mdl.workshop_id = $${params.length} or mdl.workshop_id is null)`;
  }

  const { rows } = await pool.query(`
    select mdl.*, m.name as machine_name, m.machine_code, mc.name as category_name,
           coalesce(fi.fuel_issued, 0)::numeric as fuel_issued
    from machine_daily_logs mdl
    join machines m on m.id = mdl.machine_id
    join machine_categories mc on mc.id = m.category_id
    left join (
      select machine_id, log_date, sum(quantity)::numeric as fuel_issued
      from machine_fuel_logs
      where machine_id is not null
      group by machine_id, log_date
    ) fi on fi.machine_id = mdl.machine_id and fi.log_date = mdl.log_date
    where mdl.deleted_at is null ${whereClause}
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
  // Attribute the log to the machine's workshop (not necessarily the user's workshop)
  const { rows: machineRows } = await pool.query('select workshop_id from machines where id=$1', [machine_id]);
  const workshopId = machineRows[0]?.workshop_id || null;
  await pool.query(
    `insert into machine_daily_logs(machine_id, log_date, shift, hours_worked, downtime_hours, downtime_reason,
       fuel_consumed, daily_production, capacity_per_day, product_type, item_category,
       logs_loaded, logs_unloaded, loading_trips, remarks, created_by, workshop_id)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)`,
    [machine_id, log_date, shift || 'Full Day',
     hours_worked || 0, downtime_hours || 0, downtime_reason || null,
     fuel_consumed || 0, daily_production || 0, capacity_per_day || 0, product_type || null,
     item_category || null,
     logs_loaded || 0, logs_unloaded || 0, loading_trips || 0, remarks || null, userId, workshopId]
  );
  logAudit(user, `Machine log created: machine #${machine_id} on ${log_date}`, 'ti-list-details', { machine_id, log_date });
  return { ok: true };
}

async function machineLogsUpdate(userId, logId, payload) {
  const user = await getUser(userId);
  if (!(await mustRole(user, 'machine-logs')) && !(await mustRole(user, 'machines')))
    return { ok: false, error: 'Access denied' };
  const { rows: snap } = await pool.query('SELECT * FROM machine_daily_logs WHERE id=$1', [logId]);
  const before = snap[0] || null;
  const blocked = await applyGovernance(user, 'machine_daily_logs', logId, 'edit', {
    ownerCol: 'created_by', entityType: 'machine_log',
    entityRef: `Machine daily log #${logId}`, payload, before
  });
  if (blocked) return blocked;
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

async function machineLogsDelete(userId, logId, reason) {
  const user = await getUser(userId);
  if (!(await mustRole(user, 'machine-logs')) && !(await mustRole(user, 'machines')))
    return { ok: false, error: 'Access denied' };
  const { rows: snap } = await pool.query('SELECT * FROM machine_daily_logs WHERE id=$1 AND deleted_at IS NULL', [logId]);
  if (!snap.length) return { ok: false, error: 'Entry not found' };
  const before = snap[0];
  const blocked = await applyGovernance(user, 'machine_daily_logs', logId, 'delete', {
    ownerCol: 'created_by', entityType: 'machine_log',
    entityRef: `Machine daily log ${before.log_date || '#' + logId}`, before, reason
  });
  if (blocked) return blocked;
  await pool.query(
    'update machine_daily_logs set deleted_at=now(), deleted_by=$1, deletion_reason=$2, pending_deletion=false where id=$3',
    [user.id, reason || null, logId]
  );
  logAudit(user, `Moved machine log #${logId} to trash`, 'ti-trash', { logId, reason });
  return { ok: true };
}

async function machineFuelIssuedLookup(userId, machineId, logDate) {
  const user = await getUser(userId);
  if (!user) return { ok: false, error: 'Not authenticated' };
  if (!machineId || !logDate) return { ok: true, issued: 0 };
  const { rows } = await pool.query(
    `select coalesce(sum(quantity), 0)::numeric as issued
     from machine_fuel_logs
     where machine_id = $1 and log_date = $2`,
    [Number(machineId), logDate]
  );
  return { ok: true, issued: Number(rows[0]?.issued || 0) };
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

async function machineMaintScheduleDelete(userId, schedId) {
  const user = await getUser(userId);
  if (!(await mustRole(user, 'machines'))) return { ok: false, error: 'Access denied' };
  const { rows: snap } = await pool.query('SELECT * FROM machine_maintenance_schedules WHERE id=$1', [schedId]);
  const before = snap[0] || null;
  await pool.query('delete from machine_maintenance_schedules where id=$1', [schedId]);
  logAudit(user, `Deleted maintenance schedule #${schedId}`, 'ti-trash',
    { schedId },
    { module: 'machine_maintenance_schedules', actionType: 'delete', recordId: schedId, before, after: null }
  );
  return { ok: true };
}

async function machinesDelete(userId, machineId) {
  const user = await getUser(userId);
  if (!['admin', 'ceo', 'logistics'].includes(user.role)) return { ok: false, error: 'Access denied' };
  const { rows: snap } = await pool.query('SELECT * FROM machines WHERE id=$1', [machineId]);
  const before = snap[0] || null;
  const blocked = await applyGovernance(user, 'machines', machineId, 'delete', {
    ownerCol: 'created_by', entityType: 'machine',
    entityRef: `Machine ${before?.machine_code || '#' + machineId}`, before
  });
  if (blocked) return blocked;
  await pool.query('update machines set active=false where id=$1', [machineId]);
  logAudit(user, `Deactivated machine #${machineId}`, 'ti-trash', { machineId });
  return { ok: true };
}

async function machineCategoriesUpdate(userId, categoryId, payload) {
  const user = await getUser(userId);
  if (!['admin', 'ceo', 'operations', 'logistics'].includes(user.role)) return { ok: false, error: 'Access denied' };
  const { name, description, icon } = payload || {};
  if (!name?.trim()) return { ok: false, error: 'Name is required' };
  await pool.query(
    `update machine_categories set name=$1, description=$2, icon=$3 where id=$4`,
    [name.trim(), description || null, icon || 'ti-tool', categoryId]
  );
  logAudit(user, `Machine category updated: ${name}`, 'ti-tool', { categoryId, name });
  return { ok: true };
}

async function machineCategoriesDelete(userId, categoryId) {
  const user = await getUser(userId);
  if (!['admin', 'ceo', 'operations', 'logistics'].includes(user.role)) return { ok: false, error: 'Access denied' };
  const { rows } = await pool.query('SELECT count(*) AS cnt FROM machines WHERE category_id=$1 AND active=true', [categoryId]);
  if (Number(rows[0].cnt) > 0) return { ok: false, error: 'Cannot delete: active machines are using this category' };
  const { rows: snap } = await pool.query('SELECT * FROM machine_categories WHERE id=$1', [categoryId]);
  const before = snap[0] || null;
  // Remove KPI targets and definitions linked to this category before deleting
  await pool.query(`delete from machine_kpi_targets where kpi_id in (select id from machine_kpi_definitions where category_id=$1)`, [categoryId]);
  await pool.query(`delete from machine_kpi_definitions where category_id=$1`, [categoryId]);
  await pool.query(`delete from machine_categories where id=$1`, [categoryId]);
  logAudit(user, `Deleted machine category: ${before?.name || '#' + categoryId}`, 'ti-trash',
    { categoryId },
    { module: 'machine_categories', actionType: 'delete', recordId: categoryId, before, after: null }
  );
  return { ok: true };
}

async function machineKpiDefinitionsUpdate(userId, kpiId, payload) {
  const user = await getUser(userId);
  if (!['admin', 'operations', 'ceo'].includes(user.role)) return { ok: false, error: 'Access denied' };
  const { category_id, kpi_code, kpi_name, unit, higher_is_better, weight, description } = payload || {};
  if (!kpi_name?.trim()) return { ok: false, error: 'KPI name is required' };
  const { rows: snap } = await pool.query('SELECT * FROM machine_kpi_definitions WHERE id=$1', [kpiId]);
  const before = snap[0] || null;
  await pool.query(
    `update machine_kpi_definitions set category_id=$1, kpi_code=$2, kpi_name=$3, unit=$4,
       higher_is_better=$5, weight=$6, description=$7 where id=$8`,
    [category_id || null, kpi_code?.trim() || '', kpi_name.trim(),
     unit || '', higher_is_better !== false, weight || 1.0, description || null, kpiId]
  );
  logAudit(user, `KPI definition updated: ${kpi_name}`, 'ti-target',
    { kpiId, kpi_name },
    { module: 'machine_kpi_definitions', actionType: 'edit', recordId: kpiId, before, after: payload }
  );
  return { ok: true };
}

async function machineKpiDefinitionsDelete(userId, kpiId) {
  const user = await getUser(userId);
  if (!['admin', 'operations', 'ceo'].includes(user.role)) return { ok: false, error: 'Access denied' };
  await pool.query('update machine_kpi_definitions set active=false where id=$1', [kpiId]);
  logAudit(user, `Deactivated KPI definition #${kpiId}`, 'ti-trash', { kpiId });
  return { ok: true };
}

async function maintenanceUpdate(userId, recordId, payload) {
  const user = await getUser(userId);
  if (!(await mustRole(user, 'vehicles'))) return { ok: false, error: 'Access denied' };
  const { rows: snap } = await pool.query('SELECT * FROM maintenance_records WHERE id=$1', [recordId]);
  const before = snap[0] || null;
  const blocked = await applyGovernance(user, 'maintenance_records', recordId, 'edit', {
    ownerCol: 'created_by', entityType: 'maintenance_record',
    entityRef: `Maintenance record #${recordId}`, payload, before
  });
  if (blocked) return blocked;
  const p = payload || {};
  if (!p.maintenance_type || !p.description || !p.maintenance_date)
    return { ok: false, error: 'Type, description, and date are required' };
  await pool.query(
    `update maintenance_records set maintenance_type=$1, description=$2, cost=$3, maintenance_date=$4,
       next_due_date=$5, performed_by=$6, notes=$7 where id=$8`,
    [p.maintenance_type, p.description, p.cost ? Number(p.cost) : null,
     p.maintenance_date, p.next_due_date || null, p.performed_by || null, p.notes || null, recordId]
  );
  logAudit(user, `Updated maintenance record #${recordId}`, 'ti-tool', { recordId });
  return { ok: true };
}

async function valueAddedTimberUpdate(userId, id, payload) {
  const user = await getUser(userId);
  if (!(await mustRole(user, 'value-added-timber')) && !['admin','ceo','operations','supervisor'].includes(user.role))
    return { ok: false, error: 'Access denied' };
  const { rows: snap } = await pool.query('SELECT * FROM value_added_timber WHERE id=$1', [id]);
  const before = snap[0] || null;
  const blocked = await applyGovernance(user, 'value_added_timber', id, 'edit', {
    ownerCol: 'created_by', entityType: 'value_added_timber',
    entityRef: `VAT entry ${before?.entry_date || '#' + id}`, payload, before
  });
  if (blocked) return blocked;
  const p = payload || {};
  if (!p.entry_date) return { ok: false, error: 'Date is required' };
  if (!p.type_value_added) return { ok: false, error: 'Value-added type is required' };
  if (!p.product_size) return { ok: false, error: 'Product size is required' };
  if (!p.num_timber || Number(p.num_timber) <= 0) return { ok: false, error: 'Number of timber must be greater than 0' };
  await pool.query(
    `update value_added_timber set entry_date=$1, type_value_added=$2, product_size=$3, num_timber=$4 where id=$5`,
    [p.entry_date, p.type_value_added, p.product_size, Number(p.num_timber), id]
  );
  logAudit(user, `Updated value-added timber #${id}`, 'ti-trees', { id, ...p });
  return { ok: true };
}

async function logTransportUpdate(userId, id, payload) {
  const user = await getUser(userId);
  if (!(await mustRole(user, 'log-transport')) && !['admin','ceo','operations','logistics','supervisor'].includes(user.role))
    return { ok: false, error: 'Access denied' };
  const { rows: snap } = await pool.query('SELECT * FROM log_transport WHERE id=$1', [id]);
  const before = snap[0] || null;
  const blocked = await applyGovernance(user, 'log_transport', id, 'edit', {
    ownerCol: 'logged_by', entityType: 'log_transport',
    entityRef: `Log transport ${before?.transport_date || '#' + id}`, payload, before
  });
  if (blocked) return blocked;
  const p = payload || {};
  if (!p.transport_date) return { ok: false, error: 'Date is required' };
  if (!p.qty_transported || Number(p.qty_transported) <= 0) return { ok: false, error: 'Quantity must be greater than 0' };
  await pool.query(
    `update log_transport set transport_date=$1, compt_id=$2, sub_name=$3, qty_transported=$4,
       unit=$5, notes=$6, tractor_plate=$7, loggers_number=$8 where id=$9`,
    [p.transport_date, p.compt_id ? Number(p.compt_id) : null, p.sub_name || null,
     Number(p.qty_transported), p.unit || 'logs', p.notes || null,
     p.tractor_plate?.trim() || null, p.loggers_number?.trim() || null, id]
  );
  logAudit(user, `Updated log transport #${id}`, 'ti-truck', { id });
  return { ok: true };
}

async function machineFuelLogsUpdate(userId, id, payload) {
  const user = await getUser(userId);
  if (!(await mustRole(user, 'machine-fuel')) && !['admin','ceo','operations','logistics','supervisor'].includes(user.role))
    return { ok: false, error: 'Access denied' };
  const { rows: snap } = await pool.query('SELECT * FROM machine_fuel_logs WHERE id=$1', [id]);
  const before = snap[0] || null;
  const blocked = await applyGovernance(user, 'machine_fuel_logs', id, 'edit', {
    ownerCol: 'logged_by', entityType: 'machine_fuel_log',
    entityRef: `Machine fuel log ${before?.log_date || '#' + id}`, payload, before
  });
  if (blocked) return blocked;
  const p = payload || {};
  if (!p.log_date) return { ok: false, error: 'Date is required' };
  if (!p.machine_id) return { ok: false, error: 'Machine is required' };
  if (!p.fuel_type) return { ok: false, error: 'Fuel type is required' };
  if (!p.quantity || Number(p.quantity) < 0) return { ok: false, error: 'Quantity is required' };
  await pool.query(
    `update machine_fuel_logs set log_date=$1, machine_id=$2, operator=$3, fuel_type=$4,
       quantity=$5, unit=$6, notes=$7 where id=$8`,
    [p.log_date, Number(p.machine_id), p.operator?.trim() || null,
     p.fuel_type, Number(p.quantity), p.unit || 'liters', p.notes?.trim() || null, id]
  );
  logAudit(user, `Updated machine fuel log #${id}`, 'ti-droplet', { id });
  return { ok: true };
}

async function productsUpdate(userId, productId, payload) {
  const user = await getUser(userId);
  if (!(await mustRole(user, 'products'))) return { ok: false, error: 'Access denied' };
  const p = payload || {};
  if (!p.type || !p.size) return { ok: false, error: 'Type and size are required' };
  await pool.query(
    `update products set type=$1, sub_type=$2, size=$3, ref=$4,
       width_mm=$5, height_mm=$6, length_m=$7, diameter_mm=$8, machine=$9, updated_at=now()
     where id=$10`,
    [p.type, p.sub_type || null, p.size, p.ref || null,
     p.width_mm  ? Number(p.width_mm)  : null,
     p.height_mm ? Number(p.height_mm) : null,
     p.length_m  ? Number(p.length_m)  : null,
     p.diameter_mm ? Number(p.diameter_mm) : null,
     p.machine || null, productId]
  );
  logAudit(user, `Updated product #${productId}`, 'ti-package', { productId, type: p.type, size: p.size });
  return { ok: true };
}

// ─────────────────────────────────────────────────────────────────────────────
// Phase 8 — Intelligent Automation Engine
//
// Architecture:
//   • runAutomationEngine() is called by main.js every 30 min via setInterval
//   • Each rule runs its own focused query — no dependency on the BI engine
//   • Every action: notification + audit_log + automation_log entry
//   • Cooldown per (rule_key, related_id) prevents notification spam
//   • Draft material requests (stock_low) go through the normal approval
//     workflow — no stock is modified without human approval
//   • All SQL is parameterized; access checks use server-side session userId
// ─────────────────────────────────────────────────────────────────────────────

// ── Phase 8 Part 3 — Rule Engine constants ────────────────────────────────────
// Severity → notification type mapping. All check functions read severity from
// the DB rule row — no hardcoded severity in JS logic.
const SEVERITY_NOTIF_TYPE = {
  critical: 'red',
  high:     'amber',
  medium:   'blue',
  low:      'green',
  info:     'blue',
};
const VALID_SEVERITIES   = new Set(['critical', 'high', 'medium', 'low', 'info']);
const VALID_AUTO_ACTIONS = new Set(['notify', 'draft_request', 'escalate', 'log_only']);
// Built-in rules cannot be deleted (only disabled or reconfigured).
const BUILT_IN_RULES = new Set([
  'stock_low', 'maintenance_due', 'delivery_overdue', 'workflow_failure',
  'security_alert', 'approval_escalate', 'fuel_anomaly', 'harvest_behind',
]);

// Returns true when the rule has NOT fired for related_id within the cooldown window.
async function _autoCooldownOk(ruleKey, relatedId, cooldownHours) {
  const { rows } = await pool.query(
    `SELECT 1 FROM automation_log
     WHERE rule_key   = $1
       AND related_id = $2
       AND fired_at   > NOW() - ($3::numeric * INTERVAL '1 hour')
     LIMIT 1`,
    [ruleKey, String(relatedId ?? '_global'), Number(cooldownHours)]
  );
  return rows.length === 0;
}

// Persist a rule firing entry for cooldown tracking.
async function _autoLogFire(ruleKey, module, relatedId, actionTaken, meta = {}) {
  try {
    await pool.query(
      `INSERT INTO automation_log(rule_key, related_module, related_id, action_taken, meta)
       VALUES ($1, $2, $3, $4, $5::jsonb)`,
      [ruleKey, module ?? null,
       relatedId != null ? String(relatedId) : null,
       actionTaken, JSON.stringify(meta)]
    );
  } catch (e) {
    console.error('[automation] _autoLogFire failed:', e.message);
  }
}

// Single entry point for every automated action.
// Writes audit + automation_log always. Skips notification when autoAction='log_only'.
async function _autoAct({ ruleKey, module: mod, relatedId, notif, auditAction, meta = {}, autoAction = 'notify' }) {
  if (autoAction !== 'log_only') {
    await pushNotification({
      type:          notif.type   || 'amber',
      title:         notif.title,
      body:          notif.body,
      roles:         notif.roles  || [],
      forUserId:     notif.forUserId  ?? null,
      relatedModule: mod ?? null,
      relatedId:     relatedId != null ? String(relatedId) : null,
      category:      'automation',
    });
  }
  await logAudit(
    SYSTEM_USER,
    auditAction,
    'ti-cpu',
    { rule: ruleKey, relatedId, ...meta },
    { module: mod ?? null, actionType: 'AUTOMATION',
      recordId: relatedId != null ? String(relatedId) : null,
      reason: `Automated rule: ${ruleKey}` }
  );
  await _autoLogFire(ruleKey, mod, relatedId, auditAction, meta);
}

// ── Rule: stock_low ───────────────────────────────────────────────────────────
// Identifies items with days_until_depletion ≤ threshold.days OR below min_stock.
// Creates a draft material_request (status=pending, requested_by=NULL/system)
// that still requires normal human approval before stock is affected.
async function _autoCheckStockLow(rule) {
  const threshDays = Number(rule.threshold?.days);
  if (!Number.isFinite(threshDays) || threshDays <= 0) return;
  const { rows } = await pool.query(`
    WITH consumption AS (
      SELECT item_id,
             SUM(CASE WHEN movement_type = 'out' THEN quantity ELSE 0 END)::numeric / 30
               AS avg_daily_out
      FROM stock_movements
      WHERE created_at >= NOW() - INTERVAL '30 days'
        AND deleted_at IS NULL
      GROUP BY item_id
    ),
    stock_totals AS (
      SELECT item_id, SUM(quantity)::numeric AS total_qty
      FROM stock_levels
      GROUP BY item_id
    )
    SELECT sc.id, sc.name, sc.uom, sc.min_stock,
           COALESCE(st.total_qty, 0)::int                   AS current_stock,
           COALESCE(c.avg_daily_out, 0)::numeric(10,2)      AS avg_daily_out,
           CASE WHEN COALESCE(c.avg_daily_out, 0) > 0
             THEN LEAST(
               ROUND(COALESCE(st.total_qty, 0) / NULLIF(c.avg_daily_out, 0)),
               999
             )::int
             ELSE NULL END                                   AS days_until_depletion
    FROM stock_catalog sc
    LEFT JOIN stock_totals st ON st.item_id = sc.id
    LEFT JOIN consumption  c  ON c.item_id  = sc.id
    WHERE sc.active = true
      AND (
        (COALESCE(c.avg_daily_out, 0) > 0
         AND COALESCE(st.total_qty, 0)
               / NULLIF(COALESCE(c.avg_daily_out, 0), 0) <= $1)
        OR COALESCE(st.total_qty, 0) <= sc.min_stock
      )
    ORDER BY COALESCE(
      COALESCE(st.total_qty, 0) / NULLIF(COALESCE(c.avg_daily_out, 0), 0),
      999
    )
    LIMIT 10`,
    [threshDays]
  );

  for (const item of rows) {
    const ok = await _autoCooldownOk(rule.rule_key, item.id, rule.cooldown_hours);
    if (!ok) continue;

    const days      = item.days_until_depletion;
    const notifType = SEVERITY_NOTIF_TYPE[rule.severity] || 'amber';
    const isDraft   = rule.auto_action === 'draft_request';
    const body      = [
      `Item: ${item.name} (${item.uom})`,
      `Current stock: ${item.current_stock}  |  Min stock: ${item.min_stock}`,
      days != null ? `Est. depletion: ${days} day(s)` : 'Below minimum stock level.',
      isDraft ? 'A draft material request has been created — please review and approve.' : null,
    ].filter(Boolean).join('\n');

    await _autoAct({
      ruleKey:     rule.rule_key,
      module:      'Stock',
      relatedId:   item.id,
      notif:       { type: notifType, title: `LOW STOCK — ${item.name}`,
                     body, roles: rule.notify_roles },
      auditAction: isDraft
        ? `Auto: Low stock for "${item.name}" (#${item.id}) — draft request created`
        : `Auto: Low stock detected for "${item.name}" (#${item.id})`,
      meta:        { item_id: item.id, current_stock: item.current_stock,
                     days_until_depletion: days },
      autoAction:  rule.auto_action,
    });

    if (isDraft) {
      // Draft material request — stays in 'pending' until a human approves it.
      // requested_by is NULL (system); the approval workflow is unchanged.
      try {
        const reorderQty = Math.max(
          Math.ceil(Number(item.avg_daily_out) * 30),
          item.min_stock - item.current_stock,
          1
        );
        await pool.query(
          `INSERT INTO material_requests
             (item_id, requested_qty, reason, priority, status, requested_by)
           VALUES ($1, $2, $3, $4, 'pending', NULL)`,
          [item.id, reorderQty,
           `[Automation Engine] Stock critically low — est. ${days != null ? days + ' day(s) remaining' : 'below minimum'}. Requires review & approval before ordering.`,
           rule.severity === 'critical' ? 'urgent' : 'normal']
        );
      } catch (e) {
        console.error('[automation] stock_low: draft request insert failed:', e.message);
      }
    }
  }
}

// ── Rule: maintenance_due ─────────────────────────────────────────────────────
// Alerts when machine maintenance is overdue or due within threshold.days (default 3).
// Notification only — no record modification.
async function _autoCheckMaintenanceDue(rule) {
  const threshDays = Number(rule.threshold?.days);
  if (!Number.isFinite(threshDays) || threshDays <= 0) return;
  const { rows } = await pool.query(`
    SELECT m.id AS machine_id, m.machine_code, m.name AS machine_name,
           mms.id AS schedule_id, mms.maintenance_type, mms.next_due::text,
           (CURRENT_DATE - mms.next_due)::int AS days_overdue
    FROM machines m
    JOIN machine_maintenance_schedules mms ON mms.machine_id = m.id
    WHERE m.active = true
      AND mms.next_due <= CURRENT_DATE + ($1::int)
    ORDER BY days_overdue DESC NULLS LAST
    LIMIT 15`,
    [threshDays]
  );

  for (const r of rows) {
    const ok = await _autoCooldownOk(rule.rule_key, r.schedule_id, rule.cooldown_hours);
    if (!ok) continue;

    const overdue   = Number(r.days_overdue) || 0;
    const isOverdue = overdue > 0;

    await _autoAct({
      ruleKey:   rule.rule_key,
      module:    'Machines',
      relatedId: r.machine_id,
      notif: {
        type:  SEVERITY_NOTIF_TYPE[rule.severity] || 'amber',
        title: `${isOverdue ? 'OVERDUE' : 'DUE SOON'} MAINTENANCE — ${r.machine_code}`,
        body:  [
          `Machine: ${r.machine_code} — ${r.machine_name}`,
          `Service type: ${r.maintenance_type}  |  Due: ${r.next_due}`,
          isOverdue
            ? `${overdue} day(s) overdue — immediate attention required.`
            : `Due within ${threshDays} day(s) — please schedule service.`,
        ].join('\n'),
        roles: rule.notify_roles,
      },
      auditAction: `Auto: Maintenance ${isOverdue ? 'overdue' : 'due'} for ${r.machine_code} — schedule #${r.schedule_id}`,
      meta: { machine_id: r.machine_id, schedule_id: r.schedule_id, days_overdue: overdue },
      autoAction: rule.auto_action,
    });
  }
}

// ── Rule: delivery_overdue ────────────────────────────────────────────────────
// Finds delivery orders past their due date. Notification only.
async function _autoCheckDeliveryOverdue(rule) {
  const { rows } = await pool.query(`
    SELECT id, order_number, delivery_date::text,
           (CURRENT_DATE - delivery_date)::int AS days_overdue,
           status, driver_name
    FROM delivery_orders
    WHERE status IN ('Pending', 'Dispatched')
      AND delivery_date < CURRENT_DATE
    ORDER BY days_overdue DESC
    LIMIT 10`);

  for (const r of rows) {
    const ok = await _autoCooldownOk(rule.rule_key, r.id, rule.cooldown_hours);
    if (!ok) continue;

    await _autoAct({
      ruleKey:   rule.rule_key,
      module:    'Logistics',
      relatedId: r.id,
      notif: {
        type:  SEVERITY_NOTIF_TYPE[rule.severity] || 'amber',
        title: `OVERDUE DELIVERY — ${r.order_number}`,
        body:  [
          `Order: ${r.order_number}  |  Status: ${r.status}`,
          `Due: ${r.delivery_date}  |  ${r.days_overdue} day(s) overdue`,
          r.driver_name ? `Driver: ${r.driver_name}` : null,
          'Please update the delivery status or contact the assigned driver.',
        ].filter(Boolean).join('\n'),
        roles: rule.notify_roles,
      },
      auditAction: `Auto: Delivery ${r.order_number} is ${r.days_overdue} day(s) overdue`,
      meta: { order_id: r.id, order_number: r.order_number, days_overdue: r.days_overdue },
      autoAction: rule.auto_action,
    });
  }
}

// ── Rule: workflow_failure ────────────────────────────────────────────────────
// Detects workflow jobs in 'failed' state within last 24h. Notification only.
async function _autoCheckWorkflowFailure(rule) {
  const { rows } = await pool.query(`
    SELECT id, type, last_error, attempts, created_at::text
    FROM workflow_jobs
    WHERE status = 'failed'
      AND processed_at > NOW() - INTERVAL '24 hours'
    ORDER BY processed_at DESC
    LIMIT 10`);

  if (!rows.length) return;

  const ok = await _autoCooldownOk(rule.rule_key, '_global', rule.cooldown_hours);
  if (!ok) return;

  const sample = rows.slice(0, 3).map(j =>
    `• Job #${j.id} [${j.type}]: ${j.last_error || 'unknown error'}`
  );
  await _autoAct({
    ruleKey:   rule.rule_key,
    module:    'System',
    relatedId: null,
    notif: {
      type:  SEVERITY_NOTIF_TYPE[rule.severity] || 'amber',
      title: `WORKFLOW FAILURES — ${rows.length} job(s) failed`,
      body:  [
        `${rows.length} workflow job(s) failed in the last 24 hours.`,
        ...sample,
        rows.length > 3 ? `…and ${rows.length - 3} more.` : null,
        'Go to Security & Governance → Workflow to investigate.',
      ].filter(Boolean).join('\n'),
      roles: rule.notify_roles,
    },
    auditAction: `Auto: ${rows.length} workflow job(s) in failed state`,
    meta: { failed_count: rows.length, job_types: [...new Set(rows.map(j => j.type))] },
    autoAction: rule.auto_action,
  });
}

// ── Rule: security_alert ──────────────────────────────────────────────────────
// Elevated failed login detection. Notifies CEO + admin. No data changes.
async function _autoCheckSecurityAlert(rule) {
  const minFails = Number(rule.threshold?.min_fails);
  if (!Number.isFinite(minFails) || minFails <= 0) return;
  const { rows } = await pool.query(`
    SELECT
      (SELECT COUNT(*)::int FROM audit_log
       WHERE action_type = 'login_failed'
         AND created_at  > NOW() - INTERVAL '24 hours') AS failed_24h,
      (SELECT COUNT(*)::int FROM audit_log
       WHERE action_type = 'login_failed'
         AND created_at  > NOW() - INTERVAL '1 hour')   AS failed_1h,
      (SELECT COUNT(DISTINCT user_id)::int FROM audit_log
       WHERE action_type = 'login_failed'
         AND created_at  > NOW() - INTERVAL '24 hours') AS unique_users`);

  const r       = rows[0] || {};
  const fl24    = Number(r.failed_24h)   || 0;
  const fl1h    = Number(r.failed_1h)    || 0;
  const uu      = Number(r.unique_users) || 0;
  const isBrute = fl1h >= 5 || (fl24 >= 10 && uu <= 2);

  if (fl24 < minFails && !isBrute) return;

  const ok = await _autoCooldownOk(rule.rule_key, '_global', rule.cooldown_hours);
  if (!ok) return;

  await _autoAct({
    ruleKey:   rule.rule_key,
    module:    'Security',
    relatedId: null,
    notif: {
      type:  SEVERITY_NOTIF_TYPE[rule.severity] || 'red',
      title: isBrute
        ? 'SECURITY ALERT — Possible Brute-Force Attack'
        : `SECURITY NOTICE — ${fl24} Failed Login Attempt(s)`,
      body: [
        isBrute
          ? `Possible brute-force: ${fl1h} failures in 1h (${fl24} total in 24h).`
          : `${fl24} failed login attempt(s) in the last 24 hours.`,
        `Accounts targeted: ${uu} unique user(s)`,
        'Review the Audit Log → Security for full details.',
      ].join('\n'),
      roles: rule.notify_roles,
    },
    auditAction: `Auto: Security alert — ${fl24} failed login(s) in 24h${isBrute ? ' (brute-force suspected)' : ''}`,
    meta: { failed_24h: fl24, failed_1h: fl1h, unique_users: uu, brute_force: isBrute },
    autoAction: rule.auto_action,
  });
}

// ── Rule: approval_escalate ───────────────────────────────────────────────────
// Finds pending approvals stalled beyond SLA (threshold.hours, default 48h).
// Schedules escalation_escalate jobs using the existing job-queue machinery.
// Notifies admin/ceo. Does NOT directly modify approval records.
async function _autoCheckApprovalEscalate(rule) {
  const slaHours = Number(rule.threshold?.hours);
  if (!Number.isFinite(slaHours) || slaHours <= 0) return;

  const [editRows, delRows] = await Promise.all([
    pool.query(`
      SELECT id, entity_ref AS ref, required_level
      FROM pending_edits
      WHERE status = 'Pending'
        AND submitted_at < NOW() - ($1::numeric * INTERVAL '1 hour')
        AND escalated_at IS NULL
      LIMIT 10`,
      [slaHours]),
    pool.query(`
      SELECT id, entity_ref AS ref, required_level
      FROM deletion_requests
      WHERE status = 'pending'
        AND requested_at < NOW() - ($1::numeric * INTERVAL '1 hour')
        AND escalated_at IS NULL
      LIMIT 10`,
      [slaHours]),
  ]);

  const stalledEdits = editRows.rows;
  const stalledDels  = delRows.rows;
  const total        = stalledEdits.length + stalledDels.length;
  if (!total) return;

  const ok = await _autoCooldownOk(rule.rule_key, '_global', rule.cooldown_hours);
  if (!ok) return;

  // Schedule escalation jobs only when auto_action = 'escalate'
  if (rule.auto_action === 'escalate') {
    for (const e of stalledEdits) {
      await scheduleJob(
        'escalation_escalate',
        { requestTable: 'pending_edits', requestId: e.id,
          fromLevel: e.required_level || 'leader', ref: e.ref || `edit #${e.id}` },
        new Date(),
        `auto-esc-edit-${e.id}`
      );
    }
    for (const d of stalledDels) {
      await scheduleJob(
        'escalation_escalate',
        { requestTable: 'deletion_requests', requestId: d.id,
          fromLevel: d.required_level || 'leader', ref: d.ref || `del #${d.id}` },
        new Date(),
        `auto-esc-del-${d.id}`
      );
    }
  }

  await _autoAct({
    ruleKey:   rule.rule_key,
    module:    'Approvals',
    relatedId: null,
    notif: {
      type:  SEVERITY_NOTIF_TYPE[rule.severity] || 'red',
      title: `SLA BREACH — ${total} Approval(s) Stalled`,
      body:  [
        `${total} approval request(s) pending longer than ${slaHours} hours.`,
        stalledEdits.length ? `• ${stalledEdits.length} edit request(s)` : null,
        stalledDels.length  ? `• ${stalledDels.length} deletion request(s)` : null,
        rule.auto_action === 'escalate'
          ? 'Escalation jobs scheduled — requests will be bumped to next approval level.'
          : 'Review them in the Approvals section.',
      ].filter(Boolean).join('\n'),
      roles: rule.notify_roles,
    },
    auditAction: `Auto: ${total} stalled approval(s) after ${slaHours}h — action: ${rule.auto_action}`,
    meta: { stalled_edits: stalledEdits.length, stalled_dels: stalledDels.length,
            sla_hours: slaHours },
    autoAction: rule.auto_action,
  });
}

// ── Rule: fuel_anomaly ────────────────────────────────────────────────────────
// Z-score anomaly in vehicle fuel consumption. Notification only.
async function _autoCheckFuelAnomaly(rule) {
  const minZ = Number(rule.threshold?.min_z);
  if (!Number.isFinite(minZ) || minZ <= 0) return;
  const { rows } = await pool.query(`
    WITH daily AS (
      SELECT log_date,
             SUM(liters)::numeric AS total_liters
      FROM fuel_logs
      WHERE log_date >= CURRENT_DATE - 60
      GROUP BY log_date
    ),
    baseline AS (
      SELECT AVG(total_liters)::numeric       AS mean,
             STDDEV_POP(total_liters)::numeric AS sd,
             COUNT(*)::int                    AS data_points
      FROM daily
      WHERE log_date < CURRENT_DATE - 7
    ),
    recent AS (
      SELECT AVG(total_liters)::numeric AS recent_avg
      FROM daily
      WHERE log_date >= CURRENT_DATE - 7
    )
    SELECT b.mean, b.sd, b.data_points, r.recent_avg,
           CASE WHEN b.sd > 0
             THEN ROUND(((r.recent_avg - b.mean) / b.sd)::numeric, 2)
             ELSE 0 END AS z_score,
           CASE WHEN b.mean > 0
             THEN ROUND(((r.recent_avg - b.mean) / b.mean * 100)::numeric, 1)
             ELSE 0 END AS pct_change
    FROM baseline b, recent r`);

  const r       = rows[0] || {};
  const z       = Number(r.z_score)    || 0;
  const pct     = Number(r.pct_change) || 0;
  const dataPts = Number(r.data_points)|| 0;

  if (dataPts < 5 || Math.abs(z) < minZ) return;

  const ok = await _autoCooldownOk(rule.rule_key, '_global', rule.cooldown_hours);
  if (!ok) return;

  await _autoAct({
    ruleKey:   rule.rule_key,
    module:    'Fuel',
    relatedId: null,
    notif: {
      type:  SEVERITY_NOTIF_TYPE[rule.severity] || 'amber',
      title: `FUEL ANOMALY — ${pct >= 0 ? '+' : ''}${pct.toFixed(1)}% vs Baseline`,
      body:  [
        `Vehicle fuel consumption is ${Math.abs(pct).toFixed(1)}% ${pct > 0 ? 'above' : 'below'} the 53-day baseline.`,
        `Z-score: ${z.toFixed(2)}  |  7-day avg: ${Number(r.recent_avg).toFixed(1)} L/day`,
        `Baseline avg: ${Number(r.mean).toFixed(1)} L/day`,
        'Review Fuel Logs for unauthorized usage or vehicle faults.',
      ].join('\n'),
      roles: rule.notify_roles,
    },
    auditAction: `Auto: Fuel anomaly — Z=${z.toFixed(2)}, ${pct >= 0 ? '+' : ''}${pct.toFixed(1)}% vs baseline`,
    meta: { z_score: z, pct_change: pct, recent_avg: Number(r.recent_avg),
            baseline_mean: Number(r.mean) },
    autoAction: rule.auto_action,
  });
}

// ── Rule: harvest_behind ──────────────────────────────────────────────────────
// Finds active harvest compartments projected to take > threshold.days_to_complete.
// Notification only.
async function _autoCheckHarvestBehind(rule) {
  const threshDays = Number(rule.threshold?.days_to_complete);
  if (!Number.isFinite(threshDays) || threshDays <= 0) return;
  const { rows } = await pool.query(`
    WITH harvest_rates AS (
      SELECT c.id, c.compt_name, c.sub_name, c.species, c.volume_m3,
             COALESCE(SUM(h.quantity), 0)::int            AS total_harvested,
             COALESCE((
               SELECT SUM(quantity)::numeric / 30
               FROM harvest_logs hr
               WHERE hr.compt_id = c.id
                 AND hr.harvest_date >= CURRENT_DATE - 30
                 AND hr.deleted_at IS NULL
             ), 0)::numeric(10,2)                         AS rate_per_day,
             GREATEST(
               c.volume_m3 - COALESCE(SUM(h.quantity), 0), 0
             )::numeric(10,1)                             AS est_remaining
      FROM compartments c
      LEFT JOIN harvest_logs h ON h.compt_id = c.id AND h.deleted_at IS NULL
      WHERE c.status = 'Active' AND c.deleted_at IS NULL
      GROUP BY c.id, c.compt_name, c.sub_name, c.species, c.volume_m3
    )
    SELECT *,
           ROUND(est_remaining / NULLIF(rate_per_day, 0))::int AS days_to_complete
    FROM harvest_rates
    WHERE rate_per_day > 0
      AND est_remaining > 0
      AND ROUND(est_remaining / NULLIF(rate_per_day, 0)) > $1`,
    [threshDays]
  );

  for (const r of rows) {
    const ok = await _autoCooldownOk(rule.rule_key, r.id, rule.cooldown_hours);
    if (!ok) continue;

    const days = Number(r.days_to_complete);
    const pct  = Number(r.volume_m3) > 0
      ? Math.min(100, Math.round(Number(r.total_harvested) / Number(r.volume_m3) * 100))
      : 0;

    await _autoAct({
      ruleKey:   rule.rule_key,
      module:    'Harvest',
      relatedId: r.id,
      notif: {
        type:  SEVERITY_NOTIF_TYPE[rule.severity] || 'amber',
        title: `HARVEST BEHIND SCHEDULE — ${r.compt_name}`,
        body:  [
          `Compartment: ${r.compt_name}${r.sub_name ? ` / ${r.sub_name}` : ''} (${r.species})`,
          `Progress: ${pct}%  |  Rate: ${Number(r.rate_per_day).toFixed(1)} m³/day`,
          `Est. days to complete: ${days} (target: <${threshDays} days)`,
          'Consider increasing harvest capacity or revising the target plan.',
        ].join('\n'),
        roles: rule.notify_roles,
      },
      auditAction: `Auto: Harvest behind schedule — ${r.compt_name} est. ${days} days to complete`,
      meta: { compartment_id: r.id, compt_name: r.compt_name,
              days_to_complete: days, pct_complete: pct },
      autoAction: rule.auto_action,
    });
  }
}

// ── Orchestrator ──────────────────────────────────────────────────────────────
// Fetches all enabled rules then runs every applicable check in parallel.
// Errors in individual checks are logged but do not stop other checks.
async function runAutomationEngine() {
  let ruleRows;
  try {
    ({ rows: ruleRows } = await pool.query(
      `SELECT rule_key, label, enabled, cooldown_hours, notify_roles,
              threshold, severity, auto_action
       FROM automation_rules WHERE enabled = true`
    ));
  } catch (e) {
    console.error('[automation] failed to load rules:', e.message);
    return;
  }

  if (!ruleRows.length) return;

  const rules = {};
  for (const r of ruleRows) rules[r.rule_key] = r;

  const checks = [];
  if (rules.stock_low)         checks.push(_autoCheckStockLow(rules.stock_low));
  if (rules.maintenance_due)   checks.push(_autoCheckMaintenanceDue(rules.maintenance_due));
  if (rules.delivery_overdue)  checks.push(_autoCheckDeliveryOverdue(rules.delivery_overdue));
  if (rules.workflow_failure)  checks.push(_autoCheckWorkflowFailure(rules.workflow_failure));
  if (rules.security_alert)    checks.push(_autoCheckSecurityAlert(rules.security_alert));
  if (rules.approval_escalate) checks.push(_autoCheckApprovalEscalate(rules.approval_escalate));
  if (rules.fuel_anomaly)      checks.push(_autoCheckFuelAnomaly(rules.fuel_anomaly));
  if (rules.harvest_behind)    checks.push(_autoCheckHarvestBehind(rules.harvest_behind));

  const results = await Promise.allSettled(checks);
  for (const res of results) {
    if (res.status === 'rejected') {
      console.error('[automation] check failed:', res.reason?.message ?? res.reason);
    }
  }
}

// ── Exported management functions ─────────────────────────────────────────────

async function getAutomationRules(userId) {
  const user = await getUser(userId);
  if (!['admin', 'ceo', 'operations'].includes(user.role))
    return { ok: false, error: 'Access denied' };
  const { rows } = await pool.query(
    `SELECT id, rule_key, label, description, enabled,
            cooldown_hours, notify_roles, threshold, severity, auto_action,
            created_at, updated_at
     FROM automation_rules
     ORDER BY rule_key`
  );
  return { ok: true, rules: rows };
}

async function toggleAutomationRule(userId, ruleKey, enabled) {
  const user = await getUser(userId);
  if (!['admin', 'ceo'].includes(user.role)) return { ok: false, error: 'Access denied' };
  if (!ruleKey) return { ok: false, error: 'Missing rule_key' };
  const { rowCount } = await pool.query(
    `UPDATE automation_rules SET enabled=$1, updated_at=now() WHERE rule_key=$2`,
    [Boolean(enabled), ruleKey]
  );
  if (!rowCount) return { ok: false, error: 'Rule not found' };
  await logAudit(
    user,
    `${enabled ? 'Enabled' : 'Disabled'} automation rule: ${ruleKey}`,
    'ti-cpu',
    { rule_key: ruleKey, enabled },
    { module: 'automation', actionType: 'UPDATE', recordId: ruleKey }
  );
  return { ok: true };
}

async function getAutomationLog(userId, filters = {}) {
  const user = await getUser(userId);
  if (!['admin', 'ceo', 'operations'].includes(user.role))
    return { ok: false, error: 'Access denied' };
  const { rule_key, limit = 100 } = filters;
  const params = [];
  const wheres = [];
  if (rule_key) { params.push(rule_key); wheres.push(`rule_key = $${params.length}`); }
  const where = wheres.length ? `WHERE ${wheres.join(' AND ')}` : '';
  const cap   = Math.min(Math.max(Number(limit) || 100, 1), 500);
  const { rows } = await pool.query(
    `SELECT id, rule_key, related_module, related_id, action_taken, fired_at, meta
     FROM automation_log ${where}
     ORDER BY fired_at DESC
     LIMIT ${cap}`,
    params
  );
  return { ok: true, log: rows };
}

// Admin/CEO can manually trigger an immediate automation pass.
// Minimum seconds between manual trigger calls (rate limit — prevents abuse)
let _lastManualTriggerMs = 0;
const MANUAL_TRIGGER_COOLDOWN_MS = 60_000;

async function triggerAutomationNow(userId) {
  const user = await getUser(userId);
  if (!['admin', 'ceo', 'operations'].includes(user.role))
    return { ok: false, error: 'Access denied' };

  // Rate limit: one manual run per minute per server process
  const now = Date.now();
  if (now - _lastManualTriggerMs < MANUAL_TRIGGER_COOLDOWN_MS) {
    const secsLeft = Math.ceil((MANUAL_TRIGGER_COOLDOWN_MS - (now - _lastManualTriggerMs)) / 1000);
    return { ok: false, error: `Please wait ${secsLeft}s before triggering again.` };
  }
  _lastManualTriggerMs = now;

  // Fire-and-forget — returns immediately; errors surfaced in server log
  runAutomationEngine().catch(e => console.error('[automation:manual]', e.message));
  await logAudit(user, 'Manually triggered automation engine', 'ti-cpu', {},
    { module: 'automation', actionType: 'UPDATE' });
  return { ok: true, message: 'Automation check triggered' };
}

// ── Phase 8 Part 3 — Rule Engine management functions ─────────────────────────

// Get a single rule by key. admin / ceo / operations.
async function getAutomationRule(userId, ruleKey) {
  const user = await getUser(userId);
  if (!['admin', 'ceo', 'operations'].includes(user.role))
    return { ok: false, error: 'Access denied' };
  if (!ruleKey) return { ok: false, error: 'Missing rule_key' };
  const { rows } = await pool.query(
    `SELECT id, rule_key, label, description, enabled, cooldown_hours,
            notify_roles, threshold, severity, auto_action, created_at, updated_at
     FROM automation_rules WHERE rule_key = $1`,
    [ruleKey]
  );
  if (!rows.length) return { ok: false, error: 'Rule not found' };
  return { ok: true, rule: rows[0] };
}

// Partial update of any automation rule. admin / ceo only.
// Accepts any combination of: label, description, enabled, cooldown_hours,
// notify_roles, threshold (object), severity, auto_action.
// Only supplied fields are updated — absent fields are left unchanged.
async function updateAutomationRule(userId, ruleKey, updates = {}) {
  const user = await getUser(userId);
  if (!['admin', 'ceo'].includes(user.role)) return { ok: false, error: 'Access denied' };
  if (!ruleKey) return { ok: false, error: 'Missing rule_key' };

  const { rows: existing } = await pool.query(
    `SELECT rule_key FROM automation_rules WHERE rule_key = $1`, [ruleKey]
  );
  if (!existing.length) return { ok: false, error: 'Rule not found' };

  const { label, description, enabled, cooldown_hours, notify_roles,
          threshold, severity, auto_action } = updates;

  if (severity != null && !VALID_SEVERITIES.has(severity))
    return { ok: false, error: `Invalid severity. Allowed: ${[...VALID_SEVERITIES].join(', ')}` };
  if (auto_action != null && !VALID_AUTO_ACTIONS.has(auto_action))
    return { ok: false, error: `Invalid auto_action. Allowed: ${[...VALID_AUTO_ACTIONS].join(', ')}` };
  if (cooldown_hours != null && (!Number.isFinite(Number(cooldown_hours)) || Number(cooldown_hours) < 0))
    return { ok: false, error: 'cooldown_hours must be a non-negative number' };
  if (notify_roles != null && !Array.isArray(notify_roles))
    return { ok: false, error: 'notify_roles must be an array of strings' };
  if (threshold != null && (typeof threshold !== 'object' || Array.isArray(threshold)))
    return { ok: false, error: 'threshold must be a plain JSON object' };

  const sets   = ['updated_at = now()'];
  const params = [ruleKey]; // $1 reserved for WHERE rule_key = $1

  if (label          != null) { params.push(label);                    sets.push(`label = $${params.length}`); }
  if (description    != null) { params.push(description);              sets.push(`description = $${params.length}`); }
  if (enabled        != null) { params.push(Boolean(enabled));         sets.push(`enabled = $${params.length}`); }
  if (cooldown_hours != null) { params.push(Number(cooldown_hours));   sets.push(`cooldown_hours = $${params.length}`); }
  if (notify_roles   != null) { params.push(notify_roles);             sets.push(`notify_roles = $${params.length}`); }
  if (threshold      != null) { params.push(JSON.stringify(threshold)); sets.push(`threshold = $${params.length}::jsonb`); }
  if (severity       != null) { params.push(severity);                 sets.push(`severity = $${params.length}`); }
  if (auto_action    != null) { params.push(auto_action);              sets.push(`auto_action = $${params.length}`); }

  if (sets.length === 1) return { ok: false, error: 'No fields to update' };

  await pool.query(
    `UPDATE automation_rules SET ${sets.join(', ')} WHERE rule_key = $1`,
    params
  );
  await logAudit(
    user,
    `Updated automation rule: ${ruleKey}`,
    'ti-cpu',
    { rule_key: ruleKey, updated_fields: Object.keys(updates) },
    { module: 'automation', actionType: 'UPDATE', recordId: ruleKey }
  );
  return { ok: true };
}

// Delete a custom (non-built-in) rule. admin / ceo only.
// Built-in rules must be disabled rather than deleted.
async function deleteAutomationRule(userId, ruleKey) {
  const user = await getUser(userId);
  if (!['admin', 'ceo'].includes(user.role)) return { ok: false, error: 'Access denied' };
  if (!ruleKey) return { ok: false, error: 'Missing rule_key' };
  if (BUILT_IN_RULES.has(ruleKey))
    return { ok: false, error: 'Built-in rules cannot be deleted. Disable them instead.' };

  const { rowCount } = await pool.query(
    `DELETE FROM automation_rules WHERE rule_key = $1`, [ruleKey]
  );
  if (!rowCount) return { ok: false, error: 'Rule not found' };

  await logAudit(
    user,
    `Deleted automation rule: ${ruleKey}`,
    'ti-trash',
    { rule_key: ruleKey },
    { module: 'automation', actionType: 'DELETE', recordId: ruleKey }
  );
  return { ok: true };
}

// Create a new custom rule. admin / ceo only.
// rule_key and label are required. All other fields optional with safe defaults.
async function createAutomationRule(userId, payload = {}) {
  const user = await getUser(userId);
  if (!['admin', 'ceo'].includes(user.role)) return { ok: false, error: 'Access denied' };

  const { rule_key, label, description, enabled = true, cooldown_hours = 4,
          notify_roles = [], threshold = {}, severity = 'medium', auto_action = 'notify' } = payload;

  if (!rule_key) return { ok: false, error: 'rule_key is required' };
  if (!label)    return { ok: false, error: 'label is required' };
  if (!/^[a-z0-9_]{2,64}$/.test(rule_key))
    return { ok: false, error: 'rule_key must be 2-64 lowercase letters, digits, or underscores' };
  if (!VALID_SEVERITIES.has(severity))
    return { ok: false, error: `Invalid severity. Allowed: ${[...VALID_SEVERITIES].join(', ')}` };
  if (!VALID_AUTO_ACTIONS.has(auto_action))
    return { ok: false, error: `Invalid auto_action. Allowed: ${[...VALID_AUTO_ACTIONS].join(', ')}` };
  if (!Array.isArray(notify_roles))
    return { ok: false, error: 'notify_roles must be an array of strings' };
  if (typeof threshold !== 'object' || Array.isArray(threshold))
    return { ok: false, error: 'threshold must be a plain JSON object' };

  const { rows, rowCount } = await pool.query(
    `INSERT INTO automation_rules
       (rule_key, label, description, enabled, cooldown_hours,
        notify_roles, threshold, severity, auto_action)
     VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9)
     ON CONFLICT (rule_key) DO NOTHING
     RETURNING rule_key`,
    [rule_key, label, description ?? null, Boolean(enabled), Number(cooldown_hours),
     notify_roles, JSON.stringify(threshold), severity, auto_action]
  );
  if (!rowCount) return { ok: false, error: `Rule key "${rule_key}" already exists` };

  await logAudit(
    user,
    `Created automation rule: ${rule_key}`,
    'ti-cpu',
    { rule_key, label, severity, auto_action },
    { module: 'automation', actionType: 'CREATE', recordId: rule_key }
  );
  return { ok: true, rule_key: rows[0].rule_key };
}

// ─────────────────────────────────────────────────────────────────────────────
// Phase 8 Part 2 — Internal Scheduler
//
// A single 15-minute interval runs six sequential tasks.
// Singleton guard (_schedulerTimer !== null) prevents duplicate schedulers
// even if startScheduler() is accidentally called more than once.
// Each task is wrapped in try/catch so one failure never blocks the others.
// ─────────────────────────────────────────────────────────────────────────────

let _schedulerTimer   = null; // null = not started; prevents duplicate init
let _schedulerRunning = false; // re-entrance guard for the tick itself

// ── Task 1: BI scan — delegates to the Phase 8 automation engine ─────────────
// (runAutomationEngine is defined above; called directly here)

// ── Task 2: Security scan ─────────────────────────────────────────────────────
// Targeted 15-minute window check. Faster/more granular than the full BI scan.
// Fires immediately if an active brute-force attempt is detected mid-interval.
async function _schedSecurityScan() {
  const { rows: ruleRows } = await pool.query(
    `SELECT threshold FROM automation_rules WHERE rule_key = 'security_alert' LIMIT 1`
  );
  const ruleThresh    = ruleRows[0]?.threshold || {};
  const minFails15m   = Number(ruleThresh.min_fails_15m)    || 5;
  const minOverride15 = Number(ruleThresh.min_overrides_15m) || 3;

  const { rows } = await pool.query(`
    SELECT
      (SELECT COUNT(*)::int FROM audit_log
       WHERE action_type = 'login_failed'
         AND created_at  > NOW() - INTERVAL '15 minutes')    AS failed_15m,
      (SELECT COUNT(*)::int FROM audit_log
       WHERE action_type = 'privileged_override'
         AND created_at  > NOW() - INTERVAL '15 minutes')    AS overrides_15m`);

  const r          = rows[0] || {};
  const failed15m  = Number(r.failed_15m)    || 0;
  const overrides  = Number(r.overrides_15m) || 0;

  if (failed15m >= minFails15m) {
    await pushNotification({
      type:          'red',
      title:         `ACTIVE THREAT — ${failed15m} failed logins in 15 min`,
      body:          [
        `${failed15m} failed login attempts detected in the last 15 minutes.`,
        'Possible brute-force attack in progress.',
        'Review Security & Governance → Audit Log immediately.',
      ].join('\n'),
      roles:         ['admin', 'ceo'],
      relatedModule: 'Security',
      category:      'automation',
    });
    await logAudit(
      SYSTEM_USER,
      `Scheduler security scan: ${failed15m} failed logins in 15 min — possible active attack`,
      'ti-shield-exclamation',
      { failed_15m: failed15m },
      { module: 'Security', actionType: 'AUTOMATION' }
    );
  }

  if (overrides >= minOverride15) {
    await pushNotification({
      type:          'amber',
      title:         `GOVERNANCE ALERT — ${overrides} privileged override(s) in 15 min`,
      body:          `${overrides} privileged override(s) recorded in the last 15 minutes. Review the Governance dashboard.`,
      roles:         ['admin', 'ceo'],
      relatedModule: 'Governance',
      category:      'automation',
    });
  }
}

// ── Task 3: Workflow scan ─────────────────────────────────────────────────────
// Counts failed/stuck/overdue jobs. Resets jobs stuck in 'processing' >30 min
// (a crash recovery path supplementing recoverWorkflowState on startup).
async function _schedWorkflowScan() {
  const { rows: ruleRows } = await pool.query(
    `SELECT threshold, severity FROM automation_rules WHERE rule_key = 'workflow_failure' LIMIT 1`
  );
  const ruleThresh   = ruleRows[0]?.threshold || {};
  const ruleSeverity = ruleRows[0]?.severity  || 'high';
  const failedThresh = Number(ruleThresh.notify_failed_threshold) || 10;
  const stuckThresh  = Number(ruleThresh.notify_stuck_threshold)  || 3;

  const { rows } = await pool.query(`
    SELECT
      COUNT(*) FILTER (WHERE status = 'failed')::int                                    AS failed_total,
      COUNT(*) FILTER (WHERE status = 'processing'
                         AND run_at < NOW() - INTERVAL '30 minutes')::int               AS stuck,
      COUNT(*) FILTER (WHERE status = 'pending'
                         AND run_at < NOW() - INTERVAL '2 hours')::int                  AS overdue_pending
    FROM workflow_jobs`);

  const r       = rows[0] || {};
  const failed  = Number(r.failed_total)    || 0;
  const stuck   = Number(r.stuck)           || 0;
  const overdue = Number(r.overdue_pending) || 0;

  // Recover jobs that got stranded in 'processing' (app crash mid-run)
  if (stuck > 0) {
    await pool.query(`
      UPDATE workflow_jobs
         SET status     = 'pending',
             last_error = 'Reset by scheduler — stuck in processing >30 min'
       WHERE status = 'processing'
         AND run_at < NOW() - INTERVAL '30 minutes'`);
    await logAudit(
      SYSTEM_USER,
      `Scheduler: Reset ${stuck} workflow job(s) stuck in processing`,
      'ti-refresh',
      { stuck },
      { module: 'System', actionType: 'AUTOMATION' }
    );
  }

  if (failed > failedThresh || stuck > stuckThresh) {
    await pushNotification({
      type:          SEVERITY_NOTIF_TYPE[ruleSeverity] || 'amber',
      title:         `WORKFLOW HEALTH — ${failed} failed · ${stuck} stuck`,
      body:          [
        'Workflow health check (scheduler):',
        `• ${failed} job(s) in failed state`,
        `• ${stuck} job(s) were stuck in processing (reset)`,
        `• ${overdue} job(s) pending for >2 hours`,
        'Review Security & Governance → Workflow Jobs.',
      ].join('\n'),
      roles:         ['admin'],
      relatedModule: 'System',
      category:      'automation',
    });
  }
}

// ── Task 4: Approval SLA scan ─────────────────────────────────────────────────
// Delegates to the existing Step 3 SLA enforcement function which sends
// reminders and escalates overdue pending_edits / deletion_requests.
async function _schedApprovalSLAScan() {
  await escalatePendingRequests();
}

// ── Task 5: Notification cleanup ──────────────────────────────────────────────
// Prunes stale notifications so the table stays manageable:
//   • Automation-category notifications older than 30 days (regenerated each cycle)
//   • All notifications older than 180 days (cascade-deletes notifications_read)
async function _schedNotificationCleanup() {
  const { rowCount: autoGone } = await pool.query(`
    DELETE FROM notifications
    WHERE category    = 'automation'
      AND created_at  < NOW() - INTERVAL '30 days'`);

  const { rowCount: agedGone } = await pool.query(`
    DELETE FROM notifications
    WHERE created_at < NOW() - INTERVAL '180 days'`);

  const total = (autoGone || 0) + (agedGone || 0);
  if (total > 0) {
    await logAudit(
      SYSTEM_USER,
      `Scheduler: Cleaned up ${total} old notification(s) (auto=${autoGone}, aged=${agedGone})`,
      'ti-trash',
      { auto_deleted: autoGone, aged_deleted: agedGone },
      { module: 'System', actionType: 'AUTOMATION' }
    );
  }
}

// ── Task 6: Retry failed workflow jobs ────────────────────────────────────────
// Calls the existing job processor to drain and retry any eligible jobs that
// the 2-minute interval may have queued since its last run.
// processWorkflowJobs has its own _jobProcessorRunning guard — safe to call here.

// ── Scheduler tick ────────────────────────────────────────────────────────────
async function _schedulerTick() {
  if (_schedulerRunning) {
    console.warn('[scheduler] Previous tick still running — skipping interval.');
    return;
  }
  _schedulerRunning = true;
  const wallStart = Date.now();
  console.log('[scheduler] Tick started', new Date(wallStart).toISOString());

  // Record tick start — best-effort; never abort the tick if this fails
  let runId = null;
  try {
    const { rows } = await pool.query(
      `INSERT INTO scheduler_runs (status) VALUES ('running') RETURNING id`
    );
    runId = rows[0].id;
  } catch (e) {
    console.error('[scheduler] scheduler_runs insert failed:', e.message);
  }

  const tasks = [
    ['BI scan',              runAutomationEngine],
    ['security scan',        _schedSecurityScan],
    ['workflow scan',        _schedWorkflowScan],
    ['approval SLA scan',    _schedApprovalSLAScan],
    ['notification cleanup', _schedNotificationCleanup],
    ['workflow job retry',   processWorkflowJobs],
    ['escalation engine',    runEscalationEngine],
  ];

  let errorCount = 0;
  for (const [name, fn] of tasks) {
    try {
      await fn();
    } catch (e) {
      errorCount++;
      console.error(`[scheduler] ${name} failed:`, e.message);
    }
  }

  const durationMs = Date.now() - wallStart;
  _schedulerRunning = false;
  console.log(`[scheduler] Tick complete in ${durationMs}ms (errors: ${errorCount})`);

  // Update run record — best-effort; fire-and-forget
  if (runId !== null) {
    pool.query(
      `UPDATE scheduler_runs
         SET completed_at = now(), status = 'completed', duration_ms = $1, errors = $2
       WHERE id = $3`,
      [durationMs, errorCount, runId]
    ).catch(e => console.error('[scheduler] scheduler_runs update failed:', e.message));
  }
}

// ── Public entry point ────────────────────────────────────────────────────────
// Call once from electron/main.js app.whenReady().
// Runs the first tick immediately, then every 15 minutes.
// Guards against duplicate initialization with the _schedulerTimer sentinel.
function startScheduler() {
  if (_schedulerTimer !== null) {
    console.warn('[scheduler] Already started — ignoring duplicate call.');
    return;
  }
  const INTERVAL_MS = 15 * 60 * 1_000;
  _schedulerTick(); // fire immediately; don't await (non-blocking)
  _schedulerTimer = setInterval(_schedulerTick, INTERVAL_MS);
  console.log('[scheduler] Started — 15-minute interval');
}

function stopScheduler() {
  if (_schedulerTimer !== null) {
    clearInterval(_schedulerTimer);
    _schedulerTimer = null;
    console.log('[scheduler] Stopped');
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Phase 8 Part 4 — Escalation Engine
//
// Tracks long-running issues through a 4-level path: leader → manager →
// director → ceo.  Every level transition writes an immutable history entry,
// pushes a notification to the target level's roles, and creates an audit log.
//
// Supported entity types:
//   maintenance  — overdue machine maintenance schedules
//   delivery     — delivery orders past their due date
//   workflow     — permanently-failed job queue types
//   security     — repeated/escalating failed login patterns
//   approval_edit / approval_del — approval requests past SLA
//
// All timing thresholds (hours_at_leader, hours_at_manager, etc.) are stored
// in automation_rules.threshold — no hardcoded values in JS.
// ─────────────────────────────────────────────────────────────────────────────

const ESCALATION_LEVELS = ['leader', 'manager', 'director', 'ceo'];

const ESCALATION_LEVEL_ROLES = {
  leader:   ['leader', 'forestry_manager', 'logistics_manager', 'workshop_manager', 'sawmill_manager'],
  manager:  ['manager', 'operations'],
  director: ['director'],
  ceo:      ['ceo', 'admin'],
};

// Severity climbs as the escalation moves up the chain.
const ESCALATION_LEVEL_SEVERITY = {
  leader:   'medium',
  manager:  'high',
  director: 'critical',
  ceo:      'critical',
};

// ── Core function ─────────────────────────────────────────────────────────────
// Creates a new escalation at leader level, or advances an existing one to the
// next level if enough time has passed at the current level.
// Returns the escalation id, or null when the cooldown prevents action.
async function _escalateEntity(entityType, entityId, entityRef, rule, reason, meta = {}) {
  const id = String(entityId);

  const { rows: existing } = await pool.query(
    `SELECT id, current_level, notified_at
     FROM escalations
     WHERE entity_type = $1 AND entity_id = $2 AND status = 'active'`,
    [entityType, id]
  );

  let escalationId, fromLevel, toLevel, isNew = false;

  if (!existing.length) {
    // ── New escalation — start at leader level ──
    fromLevel = null;
    toLevel   = 'leader';
    isNew     = true;
    const { rows } = await pool.query(
      `INSERT INTO escalations
         (entity_type, entity_id, entity_ref, triggered_by, current_level)
       VALUES ($1, $2, $3, $4, 'leader')
       RETURNING id`,
      [entityType, id, entityRef || null, rule.rule_key]
    );
    escalationId = rows[0].id;
  } else {
    // ── Existing escalation — check timing before advancing ──
    const esc    = existing[0];
    fromLevel    = esc.current_level;
    const idx    = ESCALATION_LEVELS.indexOf(fromLevel);
    const atCeo  = idx >= ESCALATION_LEVELS.length - 1;
    const hoursSinceNotif = (Date.now() - new Date(esc.notified_at).getTime()) / 3_600_000;

    const timingKey   = atCeo ? 'ceo_reminder_hours' : `hours_at_${fromLevel}`;
    const hoursNeeded = Number(rule.threshold?.[timingKey]);
    if (!Number.isFinite(hoursNeeded) || hoursSinceNotif < hoursNeeded) return null;

    toLevel      = atCeo ? 'ceo' : ESCALATION_LEVELS[idx + 1];
    escalationId = esc.id;
    await pool.query(
      `UPDATE escalations
         SET current_level = $1, notified_at = now(), updated_at = now()
       WHERE id = $2`,
      [toLevel, escalationId]
    );
  }

  // ── Immutable history entry ──
  await pool.query(
    `INSERT INTO escalation_history
       (escalation_id, from_level, to_level, reason, actor, meta)
     VALUES ($1, $2, $3, $4, 'system', $5::jsonb)`,
    [escalationId, fromLevel, toLevel, reason, JSON.stringify(meta)]
  );

  // ── Notification to target level ──
  const notifRoles = ESCALATION_LEVEL_ROLES[toLevel] || [];
  const severity   = ESCALATION_LEVEL_SEVERITY[toLevel] || 'medium';
  const notifType  = SEVERITY_NOTIF_TYPE[severity] || 'amber';
  const isRenotif  = !isNew && fromLevel === toLevel; // CEO re-alert

  const title = isNew
    ? `[ESCALATION] ${entityRef || entityType} — Level: ${toLevel.toUpperCase()}`
    : isRenotif
      ? `[ESCALATION ⚠] ${entityRef || entityType} — Still Unresolved`
      : `[ESCALATION ↑] ${entityRef || entityType}: ${fromLevel?.toUpperCase()} → ${toLevel.toUpperCase()}`;

  await pushNotification({
    type:          notifType,
    title,
    body:          [
      entityRef || `${entityType} #${entityId}`,
      isNew
        ? `Assigned to ${toLevel} level — immediate action required.`
        : isRenotif
          ? `No resolution at CEO level — re-alerting. Reason: ${reason}`
          : `Escalated: no action taken at ${fromLevel} level. Reason: ${reason}`,
    ].join('\n'),
    roles:         notifRoles,
    relatedModule: entityType.charAt(0).toUpperCase() + entityType.slice(1).replace('_', ' '),
    relatedId:     id,
    category:      'escalation',
  });

  // ── Audit log ──
  await logAudit(
    SYSTEM_USER,
    isNew
      ? `Escalation created — ${entityType} "${entityRef || id}" at ${toLevel} level`
      : `Escalation ${isRenotif ? 're-alerted at CEO' : `advanced ${fromLevel} → ${toLevel}`} — ${entityRef || id}`,
    'ti-arrow-up',
    { escalation_id: escalationId, entity_type: entityType, entity_id: id,
      from_level: fromLevel, to_level: toLevel, reason, ...meta },
    { module: 'Escalation', actionType: 'ESCALATION', recordId: String(escalationId) }
  );

  return escalationId;
}

// ── Auto-resolve helper ───────────────────────────────────────────────────────
// Marks active escalations as resolved when the underlying issue is gone.
// Writes a history entry and audit log for each resolved escalation.
async function _autoResolveEscalations() {
  // Helper: resolve a batch, write history + audit for each
  async function _resolveRows(rows, reason) {
    for (const esc of rows) {
      await pool.query(
        `UPDATE escalations
           SET status = 'resolved', resolved_reason = $1,
               resolved_at = now(), updated_at = now()
         WHERE id = $2`,
        [reason, esc.id]
      );
      await pool.query(
        `INSERT INTO escalation_history
           (escalation_id, from_level, to_level, reason, actor)
         VALUES ($1, $2, 'resolved', $3, 'system')`,
        [esc.id, esc.current_level, reason]
      );
      await logAudit(
        SYSTEM_USER,
        `Escalation #${esc.id} auto-resolved: ${esc.entity_ref || esc.entity_type}`,
        'ti-circle-check',
        { escalation_id: esc.id, entity_type: esc.entity_type, entity_ref: esc.entity_ref },
        { module: 'Escalation', actionType: 'UPDATE', recordId: String(esc.id) }
      );
    }
  }

  // Maintenance — resolved when next_due moved to a future date (maintenance completed)
  const { rows: m } = await pool.query(`
    SELECT e.id, e.current_level, e.entity_ref, e.entity_type
    FROM escalations e
    WHERE e.entity_type = 'maintenance' AND e.status = 'active'
      AND EXISTS (
        SELECT 1 FROM machine_maintenance_schedules mms
        WHERE mms.id = e.entity_id::bigint AND mms.next_due > CURRENT_DATE
      )`);
  await _resolveRows(m, 'Maintenance completed — schedule updated to future date');

  // Delivery — resolved when order is no longer overdue+pending
  const { rows: d } = await pool.query(`
    SELECT e.id, e.current_level, e.entity_ref, e.entity_type
    FROM escalations e
    WHERE e.entity_type = 'delivery' AND e.status = 'active'
      AND NOT EXISTS (
        SELECT 1 FROM delivery_orders dv
        WHERE dv.id = e.entity_id::bigint
          AND dv.status IN ('Pending', 'Dispatched')
          AND dv.delivery_date < CURRENT_DATE
      )`);
  await _resolveRows(d, 'Delivery no longer overdue or pending');

  // Workflow — resolved when no failed jobs of that type remain
  const { rows: w } = await pool.query(`
    SELECT e.id, e.current_level, e.entity_ref, e.entity_type
    FROM escalations e
    WHERE e.entity_type = 'workflow' AND e.status = 'active'
      AND NOT EXISTS (
        SELECT 1 FROM workflow_jobs wj
        WHERE wj.type = e.entity_id AND wj.status = 'failed'
      )`);
  await _resolveRows(w, 'No more failed workflow jobs of this type');

  // Security — resolved when no login failures in last 24h
  const { rows: s } = await pool.query(`
    SELECT e.id, e.current_level, e.entity_ref, e.entity_type
    FROM escalations e
    WHERE e.entity_type = 'security' AND e.status = 'active'
      AND NOT EXISTS (
        SELECT 1 FROM audit_log
        WHERE action_type = 'login_failed'
          AND created_at > NOW() - INTERVAL '24 hours'
      )`);
  await _resolveRows(s, 'No login failures in past 24 hours');

  // Approval edits — resolved when no longer pending
  const { rows: ae } = await pool.query(`
    SELECT e.id, e.current_level, e.entity_ref, e.entity_type
    FROM escalations e
    WHERE e.entity_type = 'approval_edit' AND e.status = 'active'
      AND NOT EXISTS (
        SELECT 1 FROM pending_edits pe
        WHERE pe.id = e.entity_id::bigint AND pe.status = 'Pending'
      )`);
  await _resolveRows(ae, 'Approval request resolved or removed');

  // Deletion requests — resolved when no longer pending
  const { rows: dr } = await pool.query(`
    SELECT e.id, e.current_level, e.entity_ref, e.entity_type
    FROM escalations e
    WHERE e.entity_type = 'approval_del' AND e.status = 'active'
      AND NOT EXISTS (
        SELECT 1 FROM deletion_requests del
        WHERE del.id = e.entity_id::bigint AND del.status = 'pending'
      )`);
  await _resolveRows(dr, 'Deletion request resolved or removed');
}

// ── Detection: maintenance overdue ────────────────────────────────────────────
async function _checkEscalationMaintenanceOverdue(rule) {
  const { rows } = await pool.query(`
    SELECT m.id AS machine_id, m.machine_code, m.name AS machine_name,
           mms.id AS schedule_id, mms.maintenance_type, mms.next_due::text,
           (CURRENT_DATE - mms.next_due)::int AS days_overdue
    FROM machines m
    JOIN machine_maintenance_schedules mms ON mms.machine_id = m.id
    WHERE m.active = true
      AND mms.next_due < CURRENT_DATE
    ORDER BY days_overdue DESC
    LIMIT 20`);

  for (const r of rows) {
    await _escalateEntity(
      'maintenance', r.schedule_id,
      `${r.machine_code} — ${r.maintenance_type}`,
      rule,
      `Maintenance overdue by ${r.days_overdue} day(s)`,
      { machine_id: r.machine_id, machine_code: r.machine_code,
        maintenance_type: r.maintenance_type, days_overdue: r.days_overdue }
    );
  }
}

// ── Detection: delivery overdue ───────────────────────────────────────────────
async function _checkEscalationDeliveryOverdue(rule) {
  const { rows } = await pool.query(`
    SELECT id, order_number, delivery_date::text,
           (CURRENT_DATE - delivery_date)::int AS days_overdue,
           status
    FROM delivery_orders
    WHERE status IN ('Pending', 'Dispatched')
      AND delivery_date < CURRENT_DATE
    ORDER BY days_overdue DESC
    LIMIT 20`);

  for (const r of rows) {
    await _escalateEntity(
      'delivery', r.id,
      `Order ${r.order_number}`,
      rule,
      `Delivery overdue by ${r.days_overdue} day(s) — status: ${r.status}`,
      { order_id: r.id, order_number: r.order_number, days_overdue: r.days_overdue }
    );
  }
}

// ── Detection: workflow retries exhausted ─────────────────────────────────────
// Groups permanently-failed jobs by type — one escalation per job type.
async function _checkEscalationWorkflowExhausted(rule) {
  const { rows } = await pool.query(`
    SELECT type,
           COUNT(*)::int             AS failed_count,
           MAX(attempts)::int        AS max_attempts_seen,
           MAX(processed_at)::text   AS last_failed_at
    FROM workflow_jobs
    WHERE status = 'failed'
    GROUP BY type
    HAVING COUNT(*) > 0
    ORDER BY failed_count DESC
    LIMIT 10`);

  for (const r of rows) {
    await _escalateEntity(
      'workflow', r.type,
      `Workflow: ${r.type}`,
      rule,
      `${r.failed_count} permanently-failed job(s) of type "${r.type}"`,
      { job_type: r.type, failed_count: r.failed_count,
        max_attempts_seen: r.max_attempts_seen }
    );
  }
}

// ── Detection: security attack escalation ────────────────────────────────────
async function _checkEscalationSecurityAttack(rule) {
  const minFails = Number(rule.threshold?.min_fails);
  if (!Number.isFinite(minFails) || minFails <= 0) return;

  const { rows } = await pool.query(`
    SELECT
      COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '1 hour')   AS h1,
      COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '4 hours')  AS h4,
      COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours') AS h24,
      COUNT(DISTINCT user_id)
        FILTER (WHERE created_at > NOW() - INTERVAL '24 hours')        AS unique_users
    FROM audit_log
    WHERE action_type = 'login_failed'`);

  const r       = rows[0] || {};
  const h1      = Number(r.h1)           || 0;
  const h24     = Number(r.h24)          || 0;
  const uu      = Number(r.unique_users) || 0;
  const isBrute = h1 >= 5 || (h24 >= 10 && uu <= 2);

  if (h24 < minFails && !isBrute) return;

  await _escalateEntity(
    'security', '_global',
    'Security — Failed Logins',
    rule,
    isBrute
      ? `Possible brute-force: ${h1} failure(s) in 1h, ${h24} in 24h (${uu} user(s) targeted)`
      : `${h24} failed login(s) in 24h — ${uu} user(s) targeted`,
    { failed_1h: h1, failed_24h: h24, unique_users: uu, brute_force: isBrute }
  );
}

// ── Detection: approval SLA breach ───────────────────────────────────────────
async function _checkEscalationApprovalOverdue(rule) {
  const slaHours = Number(rule.threshold?.hours);
  if (!Number.isFinite(slaHours) || slaHours <= 0) return;

  const [editRows, delRows] = await Promise.all([
    pool.query(`
      SELECT id, entity_ref AS ref
      FROM pending_edits
      WHERE status = 'Pending'
        AND submitted_at < NOW() - ($1::numeric * INTERVAL '1 hour')`,
      [slaHours]),
    pool.query(`
      SELECT id, entity_ref AS ref
      FROM deletion_requests
      WHERE status = 'pending'
        AND requested_at < NOW() - ($1::numeric * INTERVAL '1 hour')`,
      [slaHours]),
  ]);

  for (const e of editRows.rows) {
    await _escalateEntity(
      'approval_edit', e.id,
      `Edit Request #${e.id}${e.ref ? ` — ${e.ref}` : ''}`,
      rule,
      `Pending edit has exceeded ${slaHours}h SLA`,
      { request_type: 'edit', request_id: e.id }
    );
  }
  for (const d of delRows.rows) {
    await _escalateEntity(
      'approval_del', d.id,
      `Deletion Request #${d.id}${d.ref ? ` — ${d.ref}` : ''}`,
      rule,
      `Pending deletion has exceeded ${slaHours}h SLA`,
      { request_type: 'deletion', request_id: d.id }
    );
  }
}

// ── Orchestrator ──────────────────────────────────────────────────────────────
async function runEscalationEngine() {
  // Load the 5 relevant rules (all must be enabled)
  const { rows: ruleRows } = await pool.query(`
    SELECT rule_key, threshold, severity, auto_action
    FROM automation_rules
    WHERE rule_key IN (
      'maintenance_due', 'delivery_overdue', 'workflow_failure',
      'security_alert', 'approval_escalate'
    ) AND enabled = true`);

  const rules = {};
  for (const r of ruleRows) rules[r.rule_key] = r;

  // Step 1 — auto-resolve escalations whose underlying issue is gone
  try {
    await _autoResolveEscalations();
  } catch (e) {
    console.error('[escalation] auto-resolve failed:', e.message);
  }

  // Step 2 — detect new / advance existing escalations
  const checks = [];
  if (rules.maintenance_due)   checks.push(_checkEscalationMaintenanceOverdue(rules.maintenance_due));
  if (rules.delivery_overdue)  checks.push(_checkEscalationDeliveryOverdue(rules.delivery_overdue));
  if (rules.workflow_failure)  checks.push(_checkEscalationWorkflowExhausted(rules.workflow_failure));
  if (rules.security_alert)    checks.push(_checkEscalationSecurityAttack(rules.security_alert));
  if (rules.approval_escalate) checks.push(_checkEscalationApprovalOverdue(rules.approval_escalate));

  const results = await Promise.allSettled(checks);
  for (const res of results) {
    if (res.status === 'rejected')
      console.error('[escalation] check failed:', res.reason?.message ?? res.reason);
  }
}

// ── Exported management functions ─────────────────────────────────────────────

// List escalations. admin/ceo/director/manager/operations see all; leader sees
// only leader-level active escalations.
async function getEscalations(userId, filters = {}) {
  const user = await getUser(userId);
  const allowed = ['admin','ceo','director','manager','operations',
                   'leader','forestry_manager','logistics_manager',
                   'workshop_manager','sawmill_manager'];
  if (!allowed.includes(user.role)) return { ok: false, error: 'Access denied' };

  const { status = 'active', entity_type, limit = 100 } = filters;
  const params  = [];
  const wheres  = [];

  if (status) { params.push(status); wheres.push(`e.status = $${params.length}`); }
  if (entity_type) { params.push(entity_type); wheres.push(`e.entity_type = $${params.length}`); }

  // Leaders only see escalations at their own level
  if (['leader','forestry_manager','logistics_manager','workshop_manager','sawmill_manager']
        .includes(user.role)) {
    wheres.push(`e.current_level = 'leader'`);
  }

  const where = wheres.length ? `WHERE ${wheres.join(' AND ')}` : '';
  const cap   = Math.min(Math.max(Number(limit) || 100, 1), 500);

  const { rows } = await pool.query(`
    SELECT e.id, e.entity_type, e.entity_id, e.entity_ref, e.triggered_by,
           e.current_level, e.status, e.resolved_reason,
           e.notified_at, e.escalated_at, e.resolved_at, e.created_at,
           (SELECT COUNT(*)::int FROM escalation_history h WHERE h.escalation_id = e.id)
             AS history_count
    FROM escalations e
    ${where}
    ORDER BY e.created_at DESC
    LIMIT ${cap}`, params);

  return { ok: true, escalations: rows };
}

// Full history for one escalation.
async function getEscalationHistory(userId, escalationId) {
  const user = await getUser(userId);
  const allowed = ['admin','ceo','director','manager','operations',
                   'leader','forestry_manager','logistics_manager',
                   'workshop_manager','sawmill_manager'];
  if (!allowed.includes(user.role)) return { ok: false, error: 'Access denied' };
  if (!escalationId) return { ok: false, error: 'Missing escalation_id' };

  const { rows: esc } = await pool.query(
    `SELECT id, entity_type, entity_id, entity_ref, current_level, status
     FROM escalations WHERE id = $1`,
    [Number(escalationId)]
  );
  if (!esc.length) return { ok: false, error: 'Escalation not found' };

  const { rows: history } = await pool.query(`
    SELECT id, from_level, to_level, reason, actor, meta, created_at
    FROM escalation_history
    WHERE escalation_id = $1
    ORDER BY created_at ASC`,
    [Number(escalationId)]
  );

  return { ok: true, escalation: esc[0], history };
}

// Manually resolve an escalation. admin/ceo/director/manager/operations only.
async function resolveEscalation(userId, escalationId, reason = 'Manually resolved') {
  const user = await getUser(userId);
  if (!['admin','ceo','director','manager','operations'].includes(user.role))
    return { ok: false, error: 'Access denied' };
  if (!escalationId) return { ok: false, error: 'Missing escalation_id' };

  const { rows } = await pool.query(
    `SELECT id, current_level, entity_type, entity_ref
     FROM escalations WHERE id = $1 AND status = 'active'`,
    [Number(escalationId)]
  );
  if (!rows.length) return { ok: false, error: 'Active escalation not found' };
  const esc = rows[0];

  await pool.query(
    `UPDATE escalations
       SET status = 'resolved', resolved_reason = $1,
           resolved_at = now(), updated_at = now()
     WHERE id = $2`,
    [reason, esc.id]
  );
  await pool.query(
    `INSERT INTO escalation_history
       (escalation_id, from_level, to_level, reason, actor)
     VALUES ($1, $2, 'resolved', $3, $4)`,
    [esc.id, esc.current_level, reason, user.username || user.name || 'user']
  );
  await logAudit(
    user,
    `Resolved escalation #${esc.id}: ${esc.entity_ref || esc.entity_type}`,
    'ti-circle-check',
    { escalation_id: esc.id, reason },
    { module: 'Escalation', actionType: 'UPDATE', recordId: String(esc.id) }
  );
  return { ok: true };
}

// Acknowledge an escalation — signals "aware, working on it."
// Resets the level timer by updating notified_at, giving the current level
// one more full cycle before the next automatic advance.
async function acknowledgeEscalation(userId, escalationId) {
  const user = await getUser(userId);
  const allowed = ['admin','ceo','director','manager','operations',
                   'leader','forestry_manager','logistics_manager',
                   'workshop_manager','sawmill_manager'];
  if (!allowed.includes(user.role)) return { ok: false, error: 'Access denied' };
  if (!escalationId) return { ok: false, error: 'Missing escalation_id' };

  const { rows } = await pool.query(
    `SELECT id, current_level, entity_ref, entity_type
     FROM escalations WHERE id = $1 AND status = 'active'`,
    [Number(escalationId)]
  );
  if (!rows.length) return { ok: false, error: 'Active escalation not found' };
  const esc = rows[0];

  // Reset the notified_at clock — gives the current level a fresh time window
  await pool.query(
    `UPDATE escalations SET notified_at = now(), updated_at = now() WHERE id = $1`,
    [esc.id]
  );
  await pool.query(
    `INSERT INTO escalation_history
       (escalation_id, from_level, to_level, reason, actor)
     VALUES ($1, $2, $2, $3, $4)`,
    [esc.id, esc.current_level,
     `Acknowledged by ${user.name || user.username}`,
     user.username || user.name || 'user']
  );
  await logAudit(
    user,
    `Acknowledged escalation #${esc.id}: ${esc.entity_ref || esc.entity_type}`,
    'ti-check',
    { escalation_id: esc.id },
    { module: 'Escalation', actionType: 'UPDATE', recordId: String(esc.id) }
  );
  return { ok: true };
}

// ── Phase 8 Part 5 — Automation Dashboard ────────────────────────────────────
async function automationDashboard(userId) {
  const user = await getUser(userId);
  if (!['admin', 'ceo', 'operations'].includes(user.role))
    return { ok: false, error: 'Access denied' };

  const [rulesRes, logRes, pendingRes, failedRes, escalRes, statsRes, lastFireRes, runsRes, activityRes] =
    await Promise.all([
      pool.query(
        `SELECT id, rule_key, label, description, enabled, cooldown_hours,
                notify_roles, threshold, severity, auto_action, updated_at
         FROM automation_rules ORDER BY rule_key`
      ),
      pool.query(
        `SELECT id, rule_key, related_module, related_id, action_taken,
                fired_at::text, meta
         FROM automation_log ORDER BY fired_at DESC LIMIT 50`
      ),
      pool.query(
        `SELECT id, type, status, run_at::text, attempts, max_attempts,
                created_at::text
         FROM workflow_jobs WHERE status = 'pending'
         ORDER BY run_at ASC LIMIT 20`
      ),
      pool.query(
        `SELECT id, type, status, attempts, max_attempts, last_error,
                processed_at::text, created_at::text
         FROM workflow_jobs WHERE status = 'failed'
         ORDER BY processed_at DESC NULLS LAST LIMIT 20`
      ),
      pool.query(
        `SELECT id, entity_type, entity_id, entity_ref, triggered_by,
                current_level, status, escalated_at::text, notified_at::text,
                EXTRACT(EPOCH FROM (NOW() - escalated_at))::int / 3600 AS age_hours
         FROM escalations WHERE status = 'active'
         ORDER BY escalated_at ASC`
      ),
      pool.query(
        `SELECT
           (SELECT COUNT(*)::int FROM automation_rules)                       AS total_rules,
           (SELECT COUNT(*)::int FROM automation_rules WHERE enabled = true)  AS enabled_rules,
           (SELECT COUNT(*)::int FROM escalations WHERE status = 'active')    AS active_escalations,
           (SELECT COUNT(*)::int FROM workflow_jobs WHERE status = 'pending') AS pending_jobs,
           (SELECT COUNT(*)::int FROM workflow_jobs WHERE status = 'failed')  AS failed_jobs,
           (SELECT COUNT(*)::int FROM automation_log
            WHERE fired_at > NOW() - INTERVAL '24 hours')                    AS automations_24h,
           (SELECT MAX(fired_at)::text FROM automation_log)                   AS last_automation,
           (SELECT MAX(fired_at)::text FROM automation_log
            WHERE rule_key = 'security_alert')                                AS last_security,
           (SELECT AVG(duration_ms)::int FROM scheduler_runs
            WHERE status = 'completed' AND started_at > NOW() - INTERVAL '7 days') AS avg_tick_ms,
           (SELECT COUNT(*)::int FROM scheduler_runs
            WHERE started_at > NOW() - INTERVAL '24 hours')                  AS ticks_24h`
      ),
      pool.query(
        `SELECT rule_key, MAX(fired_at)::text AS last_fired
         FROM automation_log GROUP BY rule_key`
      ),
      // Last 10 scheduler runs for health table
      pool.query(
        `SELECT id, started_at::text, completed_at::text, duration_ms, errors, status
         FROM scheduler_runs ORDER BY started_at DESC LIMIT 10`
      ),
      // 7-day per-day automation count for activity chart
      pool.query(
        `SELECT date_trunc('day', fired_at AT TIME ZONE 'UTC')::date::text AS day,
                COUNT(*)::int AS count
         FROM automation_log
         WHERE fired_at > NOW() - INTERVAL '7 days'
         GROUP BY 1 ORDER BY 1`
      ),
    ]);

  const lastFiredMap = {};
  for (const r of lastFireRes.rows) lastFiredMap[r.rule_key] = r.last_fired;

  const rules = rulesRes.rows.map(r => ({ ...r, last_fired: lastFiredMap[r.rule_key] || null }));
  const s     = statsRes.rows[0] || {};

  const levelCounts = { leader: 0, manager: 0, director: 0, ceo: 0 };
  for (const e of escalRes.rows)
    if (levelCounts[e.current_level] !== undefined) levelCounts[e.current_level]++;

  return {
    ok: true,
    timestamp: new Date().toISOString(),
    summary: {
      rules_total:        Number(s.total_rules)         || 0,
      rules_enabled:      Number(s.enabled_rules)       || 0,
      rules_disabled:     (Number(s.total_rules) || 0) - (Number(s.enabled_rules) || 0),
      active_escalations: Number(s.active_escalations)  || 0,
      pending_jobs:       Number(s.pending_jobs)        || 0,
      failed_jobs:        Number(s.failed_jobs)         || 0,
      automations_24h:    Number(s.automations_24h)     || 0,
      avg_tick_ms:        Number(s.avg_tick_ms)         || null,
      ticks_24h:          Number(s.ticks_24h)           || 0,
    },
    scheduler: {
      last_automation: s.last_automation || null,
      last_security:   s.last_security   || null,
      recent_runs:     runsRes.rows,
    },
    activity_by_day: activityRes.rows,
    rules,
    automation_log: logRes.rows,
    pending_jobs:   pendingRes.rows,
    failed_jobs:    failedRes.rows,
    escalations: {
      active:       escalRes.rows,
      level_counts: levelCounts,
    },
  };
}

// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║  PHASE 9 — ENTERPRISE PERFORMANCE MANAGEMENT                                ║
// ╚══════════════════════════════════════════════════════════════════════════════╝

function _epmAchievement(current, target, direction) {
  if (current === null || current === undefined) return null;
  const c = Number(current), t = Number(target);
  if (t <= 0) return 100;
  if (direction === 'lower_better') {
    return c <= t ? 100 : Math.max(0, Math.round(200 - (c / t * 100)));
  }
  return Math.min(100, Math.round((c / t) * 100));
}

function _epmStatus(achievement) {
  if (achievement === null) return 'no-data';
  return achievement >= 90 ? 'on-track' : achievement >= 70 ? 'at-risk' : 'off-track';
}

function _epmTrend(achievement, direction) {
  if (achievement === null) return 'stable';
  if (direction === 'lower_better') {
    return achievement >= 100 ? 'improving' : achievement >= 80 ? 'stable' : 'declining';
  }
  return achievement >= 90 ? 'improving' : achievement >= 70 ? 'stable' : 'declining';
}

async function _epmComputeCurrentValues() {
  const month = new Date().toISOString().slice(0, 7);
  const [r0,r1,r2,r3,r4,r5,r6,r7,r8,r9,r10,r11,r12,r13,r14,r15,r16,r17,r18,r19] =
    await Promise.all([
      // 0 sales-revenue-month
      pool.query(`SELECT COALESCE(SUM(quantity::numeric*unit_price),0)::numeric(14,2) AS v
                  FROM sales_orders WHERE to_char(created_at,'YYYY-MM')=$1
                    AND deleted_at IS NULL AND status!='Cancelled'`, [month]),
      // 1 sales-orders-month
      pool.query(`SELECT COUNT(*)::int AS v FROM sales_orders
                  WHERE to_char(created_at,'YYYY-MM')=$1
                    AND deleted_at IS NULL AND status!='Cancelled'`, [month]),
      // 2 sales-delivery-rate
      pool.query(`SELECT ROUND(100.0*COUNT(CASE WHEN status IN('Delivered','Partially Delivered') THEN 1 END)
                    ::numeric/NULLIF(COUNT(*),0),1)::numeric AS v
                  FROM delivery_orders
                  WHERE DATE_TRUNC('month',created_at)=DATE_TRUNC('month',NOW())`),
      // 3 harvest-trees-month
      pool.query(`SELECT COALESCE(SUM(quantity),0)::int AS v FROM harvest_logs
                  WHERE to_char(harvest_date,'YYYY-MM')=$1 AND deleted_at IS NULL`, [month]),
      // 4 harvest-logs-month
      pool.query(`SELECT COALESCE(SUM(COALESCE(logs_crosscut,0)+COALESCE(logs_handrolled,0)),0)::int AS v
                  FROM harvest_logs WHERE to_char(harvest_date,'YYYY-MM')=$1 AND deleted_at IS NULL`, [month]),
      // 5 harvest-active-compts
      pool.query(`SELECT COUNT(*)::int AS v FROM compartments WHERE status='Active' AND deleted_at IS NULL`),
      // 6 workshop-timber-month
      pool.query(`SELECT COALESCE(SUM(timber_units),0)::int AS v FROM daily_logs
                  WHERE to_char(log_date,'YYYY-MM')=$1 AND deleted_at IS NULL`, [month]),
      // 7 workshop-poles-month
      pool.query(`SELECT COALESCE(SUM(poles_units),0)::int AS v FROM daily_logs
                  WHERE to_char(log_date,'YYYY-MM')=$1 AND deleted_at IS NULL`, [month]),
      // 8 workshop-machine-util
      pool.query(`SELECT ROUND(AVG(CASE WHEN capacity_per_day>0
                    THEN daily_production::numeric/capacity_per_day*100 END),1)::numeric AS v
                  FROM machine_daily_logs WHERE log_date>=CURRENT_DATE-30 AND deleted_at IS NULL`),
      // 9 logistics-stock-avail
      pool.query(`SELECT ROUND(100.0*COUNT(CASE WHEN sl.quantity>=sc.min_stock THEN 1 END)
                    ::numeric/NULLIF(COUNT(*),0),1)::numeric AS v
                  FROM stock_catalog sc
                  LEFT JOIN stock_levels sl ON sl.item_id=sc.id WHERE sc.active=true`),
      // 10 logistics-mat-fulfil
      pool.query(`SELECT ROUND(100.0*COUNT(CASE WHEN status IN('approved','issued') THEN 1 END)
                    ::numeric/NULLIF(COUNT(*),0),1)::numeric AS v
                  FROM material_requests WHERE requested_at>=NOW()-INTERVAL '30 days'`),
      // 11 logistics-transfer-rate
      pool.query(`SELECT ROUND(100.0*COUNT(CASE WHEN status IN('received','partially_received','dispatched') THEN 1 END)
                    ::numeric/NULLIF(COUNT(*),0),1)::numeric AS v
                  FROM stock_transfers WHERE requested_at>=NOW()-INTERVAL '30 days' AND deleted_at IS NULL`),
      // 12 hr-casual-pending
      pool.query(`SELECT COUNT(*)::int AS v FROM casual_labour_requests WHERE status='Pending'`),
      // 13 hr-casual-active
      pool.query(`SELECT COUNT(*)::int AS v FROM casuals WHERE active=true`),
      // 14 security-sla-compliance
      pool.query(`SELECT ROUND(100.0*COUNT(CASE WHEN EXTRACT(EPOCH FROM(reviewed_at-submitted_at))<=172800 THEN 1 END)
                    ::numeric/NULLIF(COUNT(*),0),1)::numeric AS v
                  FROM pending_edits WHERE status IN('Approved','Rejected')
                    AND reviewed_at IS NOT NULL AND submitted_at>=NOW()-INTERVAL '30 days'`),
      // 15 security-failed-logins
      pool.query(`SELECT COUNT(*)::int AS v FROM audit_log
                  WHERE action_type='login_failed' AND created_at>NOW()-INTERVAL '24 hours'`),
      // 16 ops-machine-avail
      pool.query(`SELECT ROUND(100.0*COUNT(CASE WHEN status IN('Available','In Use') THEN 1 END)
                    ::numeric/NULLIF(COUNT(*),0),1)::numeric AS v
                  FROM machines WHERE active=true`),
      // 17 ops-maintenance-compl
      pool.query(`SELECT ROUND(100.0*COUNT(CASE WHEN mms.next_due IS NULL OR mms.next_due>CURRENT_DATE THEN 1 END)
                    ::numeric/NULLIF(COUNT(*),0),1)::numeric AS v
                  FROM machines m
                  LEFT JOIN machine_maintenance_schedules mms ON mms.machine_id=m.id
                  WHERE m.active=true`),
      // 18 finance-fuel-efficiency
      pool.query(`WITH prod AS(SELECT COALESCE(SUM(timber_units),0)+COALESCE(SUM(poles_units),0) AS u
                    FROM daily_logs WHERE log_date>=CURRENT_DATE-30 AND deleted_at IS NULL),
                  fuel AS(SELECT COALESCE(SUM(quantity),0) AS l
                    FROM machine_fuel_logs WHERE log_date>=CURRENT_DATE-30 AND deleted_at IS NULL)
                  SELECT CASE WHEN fuel.l>0 THEN ROUND((prod.u::numeric/fuel.l),2) ELSE 0 END AS v
                  FROM prod,fuel`),
      // 19 finance-pending-approv
      pool.query(`SELECT ((SELECT COUNT(*)::int FROM pending_edits WHERE status='Pending')+
                          (SELECT COUNT(*)::int FROM deletion_requests WHERE status='pending')) AS v`),
    ]);

  return {
    'sales-revenue-month':    Number(r0.rows[0]?.v)  || 0,
    'sales-orders-month':     Number(r1.rows[0]?.v)  || 0,
    'sales-delivery-rate':    Number(r2.rows[0]?.v)  || 0,
    'harvest-trees-month':    Number(r3.rows[0]?.v)  || 0,
    'harvest-logs-month':     Number(r4.rows[0]?.v)  || 0,
    'harvest-active-compts':  Number(r5.rows[0]?.v)  || 0,
    'workshop-timber-month':  Number(r6.rows[0]?.v)  || 0,
    'workshop-poles-month':   Number(r7.rows[0]?.v)  || 0,
    'workshop-machine-util':  Number(r8.rows[0]?.v)  || 0,
    'logistics-stock-avail':  Number(r9.rows[0]?.v)  || 0,
    'logistics-mat-fulfil':   Number(r10.rows[0]?.v) || 0,
    'logistics-transfer-rate':Number(r11.rows[0]?.v) || 0,
    'hr-casual-pending':      Number(r12.rows[0]?.v) || 0,
    'hr-casual-active':       Number(r13.rows[0]?.v) || 0,
    'security-sla-compliance':Number(r14.rows[0]?.v) || 0,
    'security-failed-logins': Number(r15.rows[0]?.v) || 0,
    'ops-machine-avail':      Number(r16.rows[0]?.v) || 0,
    'ops-maintenance-compl':  Number(r17.rows[0]?.v) || 0,
    'finance-fuel-efficiency':Number(r18.rows[0]?.v) || 0,
    'finance-pending-approv': Number(r19.rows[0]?.v) || 0,
  };
}

async function performanceKPIs(userId) {
  const user = await getUser(userId);
  if (!['ceo','admin','operations'].includes(user.role))
    return { ok: false, error: 'Access denied' };

  const [{ rows: defs }, currentValues] = await Promise.all([
    pool.query(`SELECT * FROM performance_kpis WHERE active=true ORDER BY department,name`),
    _epmComputeCurrentValues(),
  ]);

  const month = new Date().toISOString().slice(0, 7);
  const kpis  = defs.map(k => {
    const current     = currentValues[k.kpi_key] ?? null;
    const achievement = _epmAchievement(current, k.target_value, k.direction);
    return {
      id:          k.id,
      kpi_key:     k.kpi_key,
      name:        k.name,
      department:  k.department,
      module:      k.module,
      owner:       k.owner,
      description: k.description,
      target:      Number(k.target_value),
      current,
      previous:    null,
      unit:        k.unit,
      direction:   k.direction,
      achievement,
      status:      _epmStatus(achievement),
      trend:       _epmTrend(achievement, k.direction),
      review_freq: k.review_freq,
    };
  });

  return { ok: true, kpis, month };
}

async function departmentScorecards(userId) {
  const kpiRes = await performanceKPIs(userId);
  if (!kpiRes.ok) return kpiRes;

  const DEPT_META = {
    Sales:      { icon: 'ti-shopping-cart',   color: '#2E8B57' },
    Harvest:    { icon: 'ti-trees',            color: '#15803D' },
    Workshop:   { icon: 'ti-building-factory', color: '#7C3AED' },
    Logistics:  { icon: 'ti-truck',            color: '#2563EB' },
    HR:         { icon: 'ti-users',            color: '#D97706' },
    Security:   { icon: 'ti-shield-lock',      color: '#DC2626' },
    Operations: { icon: 'ti-settings-2',       color: '#EA580C' },
    Finance:    { icon: 'ti-coin',             color: '#0891B2' },
  };

  const deptMap = {};
  for (const k of kpiRes.kpis) {
    if (!deptMap[k.department]) deptMap[k.department] = [];
    deptMap[k.department].push(k);
  }

  const [pendingRes, actionsRes] = await Promise.all([
    pool.query(`SELECT COUNT(*)::int AS n FROM pending_edits WHERE status='Pending'`),
    pool.query(`SELECT responsible_dept, status, COUNT(*)::int AS n
                FROM performance_action_plans GROUP BY responsible_dept, status`),
  ]);
  const actionMap = {};
  for (const r of actionsRes.rows) {
    if (!actionMap[r.responsible_dept]) actionMap[r.responsible_dept] = { open: 0, completed: 0 };
    if (r.status === 'completed') actionMap[r.responsible_dept].completed += r.n;
    else actionMap[r.responsible_dept].open += r.n;
  }

  const scorecards = Object.entries(deptMap).map(([dept, dkpis]) => {
    const scored     = dkpis.filter(k => k.achievement !== null);
    const score      = scored.length
      ? Math.round(scored.reduce((s, k) => s + k.achievement, 0) / scored.length)
      : 0;
    const onTrack    = dkpis.filter(k => k.status === 'on-track').length;
    const atRisk     = dkpis.filter(k => k.status === 'at-risk').length;
    const offTrack   = dkpis.filter(k => k.status === 'off-track').length;
    const riskLevel  = offTrack > 0 ? 'high' : atRisk > 0 ? 'medium' : 'low';
    const trend      = score >= 90 ? 'up' : score >= 70 ? 'stable' : 'down';
    const actions    = actionMap[dept] || { open: 0, completed: 0 };
    const meta       = DEPT_META[dept] || { icon: 'ti-chart-bar', color: '#6B7280' };
    return {
      department:     dept,
      score,
      kpi_count:      dkpis.length,
      on_track:       onTrack,
      at_risk:        atRisk,
      off_track:      offTrack,
      risk_level:     riskLevel,
      trend,
      open_actions:   actions.open,
      done_actions:   actions.completed,
      pending_approv: dept === 'Security' || dept === 'Finance' ? Number(pendingRes.rows[0]?.n) || 0 : 0,
      kpis:           dkpis,
      icon:           meta.icon,
      color:          meta.color,
    };
  });

  scorecards.sort((a, b) => a.score - b.score);
  const companyScore = scorecards.length
    ? Math.round(scorecards.reduce((s, d) => s + d.score, 0) / scorecards.length)
    : 0;

  return { ok: true, scorecards, companyScore };
}

async function executiveScorecard(userId) {
  const user = await getUser(userId);
  if (!['ceo','admin','operations'].includes(user.role))
    return { ok: false, error: 'Access denied' };

  const month = new Date().toISOString().slice(0, 7);
  const [revRes,budRes,prodRes,harvRes,govRes,secRes,autoRes,machRes,pendRes,fuelProdRes] =
    await Promise.all([
      pool.query(`SELECT COALESCE(SUM(quantity::numeric*unit_price),0)::numeric(14,2) AS v
                  FROM sales_orders WHERE to_char(created_at,'YYYY-MM')=$1
                    AND deleted_at IS NULL AND status!='Cancelled'`, [month]),
      pool.query(`SELECT COALESCE(SUM(budget_amount),0)::numeric(14,2) AS v FROM kpi_budgets WHERE month=$1`, [month]),
      pool.query(`SELECT COALESCE(SUM(timber_units),0)::int AS timber,
                         COALESCE(SUM(poles_units),0)::int  AS poles
                  FROM daily_logs WHERE to_char(log_date,'YYYY-MM')=$1 AND deleted_at IS NULL`, [month]),
      pool.query(`SELECT COALESCE(SUM(quantity),0)::int AS trees
                  FROM harvest_logs WHERE to_char(harvest_date,'YYYY-MM')=$1 AND deleted_at IS NULL`, [month]),
      pool.query(`SELECT ROUND(100.0*COUNT(CASE WHEN EXTRACT(EPOCH FROM(reviewed_at-submitted_at))<=172800 THEN 1 END)
                    ::numeric/NULLIF(COUNT(*),0),1)::numeric AS sla_pct,
                  COUNT(*)::int AS resolved
                  FROM pending_edits WHERE status IN('Approved','Rejected')
                    AND submitted_at>=NOW()-INTERVAL '30 days'`),
      pool.query(`SELECT COUNT(CASE WHEN action_type='login_failed'       THEN 1 END)::int AS failed_logins,
                         COUNT(CASE WHEN action_type='privileged_override' THEN 1 END)::int AS overrides
                  FROM audit_log WHERE created_at>NOW()-INTERVAL '24 hours'`),
      pool.query(`SELECT COUNT(*)::int AS rules_fired,
                  (SELECT COUNT(*)::int FROM scheduler_runs
                   WHERE started_at>NOW()-INTERVAL '24 hours' AND status='completed') AS sched_ok
                  FROM automation_log WHERE fired_at>NOW()-INTERVAL '24 hours'`),
      pool.query(`SELECT ROUND(AVG(CASE WHEN capacity_per_day>0
                    THEN daily_production::numeric/capacity_per_day*100 END),1)::numeric AS eff
                  FROM machine_daily_logs WHERE log_date>=CURRENT_DATE-30 AND deleted_at IS NULL`),
      pool.query(`SELECT ((SELECT COUNT(*)::int FROM pending_edits WHERE status='Pending')+
                          (SELECT COUNT(*)::int FROM deletion_requests WHERE status='pending')) AS v`),
      pool.query(`WITH p AS(SELECT COALESCE(SUM(timber_units),0)+COALESCE(SUM(poles_units),0) AS u
                              FROM daily_logs WHERE log_date>=CURRENT_DATE-30 AND deleted_at IS NULL),
                       f AS(SELECT COALESCE(SUM(quantity),0) AS l
                              FROM machine_fuel_logs WHERE log_date>=CURRENT_DATE-30 AND deleted_at IS NULL)
                  SELECT CASE WHEN f.l>0 THEN ROUND((p.u::numeric/f.l),2) ELSE 0 END AS eff,
                         p.u AS units, f.l AS liters FROM p,f`),
    ]);

  const revenue      = Number(revRes.rows[0]?.v)          || 0;
  const budget       = Number(budRes.rows[0]?.v)          || 0;
  const timber       = Number(prodRes.rows[0]?.timber)    || 0;
  const poles        = Number(prodRes.rows[0]?.poles)     || 0;
  const trees        = Number(harvRes.rows[0]?.trees)     || 0;
  const slaPct       = Number(govRes.rows[0]?.sla_pct)    || 0;
  const pending      = Number(pendRes.rows[0]?.v)         || 0;
  const failedLogins = Number(secRes.rows[0]?.failed_logins) || 0;
  const overrides    = Number(secRes.rows[0]?.overrides)  || 0;
  const schedOk      = Number(autoRes.rows[0]?.sched_ok)  || 0;
  const rulesFired   = Number(autoRes.rows[0]?.rules_fired) || 0;
  const machEff      = Number(machRes.rows[0]?.eff)       || 0;
  const fuelEff      = Number(fuelProdRes.rows[0]?.eff)   || 0;

  const revScore    = budget > 0 ? Math.min(100, Math.round((revenue / budget) * 100)) : 50;
  const prodScore   = Math.min(100, Math.max(0, Math.round(machEff) || 50));
  const govScore    = Math.round(slaPct) || 80;
  const secScore    = Math.max(0, Math.min(100, 100 - failedLogins * 2 - overrides * 5));
  const autoScore   = schedOk > 0 ? Math.min(100, 70 + schedOk * 3) : 50;
  const sustScore   = fuelEff > 0 ? Math.min(100, Math.round(fuelEff / 0.01)) : 50;
  const biScore     = 85; // static confidence indicator

  const _rag = s => s >= 80 ? 'green' : s >= 60 ? 'amber' : 'red';

  const overall = Math.round(
    revScore  * 0.28 +
    prodScore * 0.22 +
    govScore  * 0.18 +
    secScore  * 0.12 +
    autoScore * 0.10 +
    sustScore * 0.10
  );

  return {
    ok: true,
    overall:   { score: overall, status: _rag(overall), period: month },
    dimensions: [
      { name: 'Revenue Performance',     score: revScore,  status: _rag(revScore),  icon: 'ti-coin',              detail: `${revenue.toLocaleString('en-ZM')} / ${budget.toLocaleString('en-ZM')} ZMW` },
      { name: 'Operational Performance', score: prodScore, status: _rag(prodScore), icon: 'ti-building-factory',  detail: `${timber} timber + ${poles} poles units · ${trees} trees felled` },
      { name: 'Governance Performance',  score: govScore,  status: _rag(govScore),  icon: 'ti-shield-check',      detail: `${govScore}% SLA compliance · ${pending} pending approvals` },
      { name: 'Security Performance',    score: secScore,  status: _rag(secScore),  icon: 'ti-lock',              detail: `${failedLogins} failed logins · ${overrides} overrides (24h)` },
      { name: 'Sustainability',          score: sustScore, status: _rag(sustScore), icon: 'ti-leaf',              detail: `${fuelEff} units/L fuel efficiency` },
      { name: 'Automation Performance',  score: autoScore, status: _rag(autoScore), icon: 'ti-robot',             detail: `${rulesFired} rules fired · ${schedOk} scheduler runs (24h)` },
      { name: 'BI Accuracy',             score: biScore,   status: _rag(biScore),   icon: 'ti-chart-line',        detail: 'Live PostgreSQL analytics — statistical forecasting active' },
      { name: 'Company Health Score',    score: Math.min(100, machEff || 75), status: _rag(machEff || 75), icon: 'ti-activity-heartbeat', detail: `${machEff.toFixed(1)}% average machine efficiency (30d)` },
    ],
  };
}

async function performanceTrends(userId) {
  const user = await getUser(userId);
  if (!['ceo','admin','operations'].includes(user.role))
    return { ok: false, error: 'Access denied' };

  const [revRes, prodRes, harvRes, fuelRes, stockRes, approvalRes] = await Promise.all([
    pool.query(`SELECT to_char(DATE_TRUNC('week',created_at),'YYYY-MM-DD') AS period,
                       ROUND(SUM(quantity::numeric*unit_price)::numeric,0) AS value
                FROM sales_orders WHERE created_at>=NOW()-INTERVAL '84 days'
                  AND deleted_at IS NULL AND status!='Cancelled'
                GROUP BY DATE_TRUNC('week',created_at) ORDER BY 1`),
    pool.query(`SELECT to_char(DATE_TRUNC('week',log_date),'YYYY-MM-DD') AS period,
                       SUM(COALESCE(timber_units,0)+COALESCE(poles_units,0))::int AS value
                FROM daily_logs WHERE log_date>=CURRENT_DATE-84 AND deleted_at IS NULL
                GROUP BY DATE_TRUNC('week',log_date) ORDER BY 1`),
    pool.query(`SELECT to_char(DATE_TRUNC('week',harvest_date),'YYYY-MM-DD') AS period,
                       SUM(quantity)::int AS value
                FROM harvest_logs WHERE harvest_date>=CURRENT_DATE-84 AND deleted_at IS NULL
                GROUP BY DATE_TRUNC('week',harvest_date) ORDER BY 1`),
    pool.query(`SELECT log_date::text AS period, SUM(quantity)::numeric AS value
                FROM machine_fuel_logs WHERE log_date>=CURRENT_DATE-30 AND deleted_at IS NULL
                GROUP BY log_date ORDER BY 1`),
    pool.query(`SELECT date_trunc('day',created_at)::date::text AS period,
                       COUNT(CASE WHEN movement_type='out' THEN 1 END)::int AS value
                FROM stock_movements WHERE created_at>=NOW()-INTERVAL '30 days' AND deleted_at IS NULL
                GROUP BY 1 ORDER BY 1`),
    pool.query(`SELECT to_char(DATE_TRUNC('week',submitted_at),'YYYY-MM-DD') AS period,
                       COUNT(*)::int AS value,
                       ROUND(AVG(EXTRACT(EPOCH FROM(reviewed_at-submitted_at))/3600)::numeric,1) AS avg_hours
                FROM pending_edits WHERE status IN('Approved','Rejected')
                  AND submitted_at>=NOW()-INTERVAL '84 days'
                GROUP BY DATE_TRUNC('week',submitted_at) ORDER BY 1`),
  ]);

  return {
    ok: true,
    trends: {
      revenue:   revRes.rows,
      production:prodRes.rows,
      harvest:   harvRes.rows,
      fuel:      fuelRes.rows,
      stock:     stockRes.rows,
      approvals: approvalRes.rows,
    },
  };
}

async function performanceActionPlans(userId) {
  const user = await getUser(userId);
  if (!['ceo','admin','operations'].includes(user.role))
    return { ok: false, error: 'Access denied' };

  const { rows: plans } = await pool.query(`
    SELECT p.*, u.name AS created_by_name, a.name AS approved_by_name,
           k.name AS kpi_name, k.department
    FROM performance_action_plans p
    LEFT JOIN app_users u ON u.id = p.created_by
    LEFT JOIN app_users a ON a.id = p.approved_by
    LEFT JOIN performance_kpis k ON k.kpi_key = p.kpi_key
    ORDER BY p.created_at DESC`);

  const summary = {
    total:           plans.length,
    draft:           plans.filter(p => p.status === 'draft').length,
    pending_approval:plans.filter(p => p.status === 'pending_approval').length,
    approved:        plans.filter(p => p.status === 'approved').length,
    in_progress:     plans.filter(p => p.status === 'in_progress').length,
    completed:       plans.filter(p => p.status === 'completed').length,
  };

  return { ok: true, plans, summary };
}

async function _epmAutoGeneratePlans(kpis, adminUserId) {
  const offTrack = kpis.filter(k => k.status === 'off-track');
  if (!offTrack.length) return;

  const { rows: existingPlans } = await pool.query(
    `SELECT kpi_key FROM performance_action_plans WHERE status NOT IN('completed','rejected')`
  );
  const coveredKeys = new Set(existingPlans.map(r => r.kpi_key));

  const PLAN_TEMPLATES = {
    'sales-revenue-month':    { problem: 'Monthly revenue below target', root_cause: 'Insufficient sales volume or pricing below standard', recommended_action: 'Review pricing strategy, increase sales outreach, and follow up on pending quotations', priority: 'high' },
    'sales-orders-month':     { problem: 'Sales order volume below target', root_cause: 'Low customer activity or market demand', recommended_action: 'Activate promotions, contact dormant customers, and review product availability', priority: 'medium' },
    'sales-delivery-rate':    { problem: 'Delivery completion rate below target', root_cause: 'Vehicle unavailability, driver shortages, or logistics bottlenecks', recommended_action: 'Review dispatch schedule, ensure vehicle maintenance is current, and assign additional drivers', priority: 'high' },
    'harvest-trees-month':    { problem: 'Monthly harvest below target', root_cause: 'Equipment downtime, weather delays, or workforce shortage', recommended_action: 'Accelerate harvest schedule, deploy additional teams, and resolve equipment issues', priority: 'high' },
    'harvest-logs-month':     { problem: 'Log production below target', root_cause: 'Slow cross-cutting rate or harvesting inefficiency', recommended_action: 'Review log processing workflow and ensure adequate cutting equipment is operational', priority: 'medium' },
    'workshop-timber-month':  { problem: 'Timber production below monthly target', root_cause: 'Machine downtime, raw material shortage, or workforce gaps', recommended_action: 'Restore machine availability, ensure log supply from harvest, and review shift schedules', priority: 'high' },
    'workshop-poles-month':   { problem: 'Poles production below monthly target', root_cause: 'Production line issues or raw material shortage', recommended_action: 'Review poles production workflow, secure raw material supply, and address equipment issues', priority: 'medium' },
    'workshop-machine-util':  { problem: 'Machine utilization below 75%', root_cause: 'Idle machines due to downtime, maintenance, or operator shortage', recommended_action: 'Reduce machine downtime through preventive maintenance and ensure operators are available', priority: 'medium' },
    'logistics-stock-avail':  { problem: 'Stock availability below minimum levels', root_cause: 'Insufficient stock ordering or high consumption rate', recommended_action: 'Review stock replenishment process, increase order quantities for critical items, and set automated reorder alerts', priority: 'high' },
    'logistics-mat-fulfil':   { problem: 'Material request fulfillment rate below target', root_cause: 'Stock shortages or slow approval process', recommended_action: 'Expedite approval of pending material requests and replenish commonly requested items', priority: 'medium' },
    'logistics-transfer-rate':{ problem: 'Stock transfer completion rate below target', root_cause: 'Transfer delays or receiving bottlenecks', recommended_action: 'Follow up on pending dispatches, ensure receiving teams are available, and clear backlog', priority: 'medium' },
    'hr-casual-pending':      { problem: 'High number of unresolved casual labour requests', root_cause: 'Slow review process or insufficient casual worker pool', recommended_action: 'Expedite review of pending requests and expand the casual worker register', priority: 'medium' },
    'security-sla-compliance':{ problem: 'Approval SLA compliance below 90%', root_cause: 'Slow response to pending edit and deletion requests', recommended_action: 'Assign dedicated reviewer for pending approvals and set daily review schedule', priority: 'high' },
    'ops-machine-avail':      { problem: 'Machine availability rate below target', root_cause: 'Machines under maintenance or breakdown', recommended_action: 'Expedite maintenance completion, review maintenance schedule, and ensure spare parts availability', priority: 'high' },
    'ops-maintenance-compl':  { problem: 'Overdue machine maintenance schedules', root_cause: 'Delayed maintenance execution or parts unavailability', recommended_action: 'Complete overdue maintenance immediately and schedule preventive maintenance before due dates', priority: 'critical' },
    'finance-fuel-efficiency':{ problem: 'Fuel efficiency below target', root_cause: 'High fuel consumption relative to production output', recommended_action: 'Review machine fuel consumption patterns, check for fuel leakage, and optimize production schedules', priority: 'medium' },
    'finance-pending-approv': { problem: 'High number of pending approval requests', root_cause: 'Backlog of edit and deletion requests awaiting review', recommended_action: 'Clear pending approval backlog — assign reviewer and set daily processing targets', priority: 'high' },
  };

  for (const kpi of offTrack) {
    if (coveredKeys.has(kpi.kpi_key)) continue;
    const tmpl = PLAN_TEMPLATES[kpi.kpi_key];
    if (!tmpl) continue;
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + (tmpl.priority === 'critical' ? 7 : tmpl.priority === 'high' ? 14 : 21));
    await pool.query(`
      INSERT INTO performance_action_plans
        (kpi_key,problem,root_cause,recommended_action,responsible_dept,priority,due_date,
         expected_improvement,status,auto_generated,created_by)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,'draft',true,$9)`,
      [kpi.kpi_key, tmpl.problem, tmpl.root_cause, tmpl.recommended_action,
       kpi.department, tmpl.priority, dueDate.toISOString().slice(0,10),
       `Bring ${kpi.name} from ${kpi.achievement}% to at least 70% achievement`,
       adminUserId || null]);
    await logAudit(
      { id: adminUserId, name: 'System', role: 'system' },
      `Auto-generated improvement plan: ${kpi.name} (${kpi.achievement}% achievement)`,
      'ti-alert-triangle', {}, { module: 'epm', actionType: 'CREATE' }
    );
  }
}

async function performanceDashboard(userId) {
  const user = await getUser(userId);
  if (!['ceo','admin','operations'].includes(user.role))
    return { ok: false, error: 'Access denied' };

  const [kpiRes, execRes, planRes] = await Promise.all([
    performanceKPIs(userId),
    executiveScorecard(userId),
    performanceActionPlans(userId),
  ]);
  if (!kpiRes.ok) return kpiRes;

  // Auto-generate action plans for off-track KPIs (fire-and-forget)
  _epmAutoGeneratePlans(kpiRes.kpis, user.id).catch(e =>
    console.error('[epm] auto-generate plans failed:', e.message)
  );

  const deptMap = {};
  for (const k of kpiRes.kpis) {
    if (!deptMap[k.department]) deptMap[k.department] = [];
    deptMap[k.department].push(k);
  }
  const companyScore = kpiRes.kpis.length
    ? Math.round(kpiRes.kpis
        .filter(k => k.achievement !== null)
        .reduce((s, k) => s + k.achievement, 0)
      / kpiRes.kpis.filter(k => k.achievement !== null).length)
    : 0;

  const summary = {
    company_score:  companyScore,
    total_kpis:     kpiRes.kpis.length,
    on_track:       kpiRes.kpis.filter(k => k.status === 'on-track').length,
    at_risk:        kpiRes.kpis.filter(k => k.status === 'at-risk').length,
    off_track:      kpiRes.kpis.filter(k => k.status === 'off-track').length,
    departments:    Object.keys(deptMap).length,
    open_plans:     planRes.ok ? planRes.summary.draft + planRes.summary.pending_approval : 0,
    period:         kpiRes.month,
  };

  return {
    ok: true,
    summary,
    kpis:      kpiRes.kpis,
    executive: execRes.ok ? execRes : null,
    plans:     planRes.ok ? planRes : null,
  };
}

async function performanceExport(userId) {
  const user = await getUser(userId);
  if (!['ceo','admin','operations'].includes(user.role))
    return { ok: false, error: 'Access denied' };

  const kpiRes = await performanceKPIs(userId);
  if (!kpiRes.ok) return kpiRes;

  await logAudit(user, 'Exported EPM performance report', 'ti-file-download', {},
    { module: 'epm', actionType: 'EXPORT' });

  const header = 'KPI Key,Name,Department,Owner,Target,Current,Unit,Achievement %,Status,Trend,Review Freq';
  const rows   = kpiRes.kpis.map(k =>
    [k.kpi_key, `"${k.name}"`, k.department, `"${k.owner||''}"`,
     k.target, k.current, k.unit, k.achievement, k.status, k.trend, k.review_freq].join(',')
  );
  const csv = [header, ...rows].join('\n');

  return { ok: true, csv, filename: `ufcl_epm_${kpiRes.month}.csv` };
}


