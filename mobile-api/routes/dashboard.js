'use strict';

const express          = require('express');
const data             = require('../../db/services/data');
const { requireRoles } = require('../middleware/authorize');
const { respond }      = require('../middleware/respond');
const { computeTrend } = require('../utils/computeTrend');
const { ActivityType, PendingAction, Priority } = require('../constants/dashboardEnums');

const router = express.Router();

// Roles that have a general dashboard on Desktop (db/services/data.js ROLE_PAGES).
// Leaders (harvesting/sawmill/poles/vat-leader), the named supervisor sub-roles
// (harvesting/sawmill/poles/vat-supervisor), and mechanician do NOT have 'dashboard'
// in ROLE_PAGES — they go directly to their module page on Desktop.
// 'sales-staff' and 'showroom-staff' get 'dashboard' from their role_definitions
// seed (db/migrate.js), not the static ROLE_PAGES fallback.
const DASHBOARD_ROLES = [
  'admin', 'ceo', 'operations', 'finance', 'sales', 'logistics',
  'supervisor', 'storekeeper', 'sales-staff', 'showroom-staff',
];

// ── icon → ActivityType mapping ───────────────────────────────────────────────
// audit_log.icon contains Tabler icon names set at write time.
// Map them to semantic ActivityType constants for mobile clients.
const ICON_TO_ACTIVITY_TYPE = {
  'ti-shopping-cart':   ActivityType.SALES_ORDER,
  'ti-receipt':         ActivityType.SALES_ORDER,
  'ti-truck-delivery':  ActivityType.DELIVERY,
  'ti-truck':           ActivityType.DELIVERY,
  'ti-leaf':            ActivityType.HARVEST_LOG,
  'ti-axe':             ActivityType.HARVEST_LOG,
  'ti-saw':             ActivityType.SAWMILL_LOG,
  'ti-tool':            ActivityType.SAWMILL_LOG,
  'ti-align-center':    ActivityType.POLES_LOG,
  'ti-box':             ActivityType.MATERIAL_REQUEST,
  'ti-package':         ActivityType.MATERIAL_REQUEST,
  'ti-user-plus':       ActivityType.CASUAL_LABOUR,
  'ti-users':           ActivityType.CASUAL_LABOUR,
  'ti-settings':        ActivityType.MACHINE_LOG,
  'ti-settings-2':      ActivityType.MACHINE_LOG,
  'ti-gas-station':     ActivityType.FUEL_LOG,
  'ti-flame':           ActivityType.FUEL_LOG,
  'ti-arrow-down':      ActivityType.STOCK_MOVEMENT_IN,
  'ti-arrow-up':        ActivityType.STOCK_MOVEMENT_OUT,
  'ti-login':           ActivityType.USER_LOGIN,
  'ti-logout':          ActivityType.USER_LOGIN,
  'ti-git-pull-request':ActivityType.CHANGE_REQUEST,
  'ti-check':           ActivityType.APPROVAL,
  'ti-clipboard-check': ActivityType.APPROVAL,
};

function iconToActivityType(icon) {
  return ICON_TO_ACTIVITY_TYPE[icon] ?? 'default';
}

// ── pending action → PendingAction enum ──────────────────────────────────────
// getDashboardStats() uses internal type strings ('logistics', 'operations').
// Map them to the public PendingAction enum values.
function pendingTypeToPendingAction(type, title) {
  if (type === 'logistics')   return PendingAction.DELIVERY_ASSIGNMENT;
  if (type === 'operations')  return PendingAction.SALES_CONFIRMATION;
  return PendingAction.CHANGE_REQUEST;
}

// ── priority by action type and age ──────────────────────────────────────────
const PRIORITY_ORDER = { [Priority.HIGH]: 0, [Priority.MEDIUM]: 1, [Priority.LOW]: 2 };

function assignPriority(action, createdAtStr) {
  // Parse DD/MM/YYYY HH:MM format from data.js
  let ageHours = 0;
  if (createdAtStr) {
    const parts = createdAtStr.match(/(\d{2})\/(\d{2})\/(\d{4}) (\d{2}):(\d{2})/);
    if (parts) {
      const [, dd, mm, yyyy, hh, min] = parts;
      const dt = new Date(`${yyyy}-${mm}-${dd}T${hh}:${min}:00Z`);
      ageHours = (Date.now() - dt.getTime()) / 3_600_000;
    }
  }
  if (action === PendingAction.DELIVERY_ASSIGNMENT) {
    return ageHours > 48 ? Priority.HIGH : Priority.MEDIUM;
  }
  if (action === PendingAction.SALES_CONFIRMATION) {
    return ageHours > 24 ? Priority.HIGH : Priority.MEDIUM;
  }
  return Priority.LOW;
}

// ── greeting ─────────────────────────────────────────────────────────────────
function buildGreeting(firstName) {
  const hour = new Date().getUTCHours();
  const part  = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';
  return `Good ${part}, ${firstName}`;
}

// ── date line ─────────────────────────────────────────────────────────────────
function buildDateLine() {
  return new Date().toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
}

// ── GET /api/dashboard/stats ─────────────────────────────────────────────────
// Single aggregated response for the general dashboard.
// Calls data.getDashboardStats() (desktop-compatible) and transforms to mobile
// envelope format. No statistics are computed here — only reshaping.

router.get('/stats', requireRoles(...DASHBOARD_ROLES), async (req, res) => {
  const result = await data.getDashboardStats(req.user.userId);
  if (!result.ok) return respond(res, result, 0);

  const { month, stock, production, sales, expenses, alerts, recentActivity, pendingActions } = result;

  // Trend — computed from server-side data, never on mobile client
  const trend = {
    timber: computeTrend(
      Number(production.thisMonth?.timber || 0),
      Number(production.lastMonth?.timber || 0)
    ),
    poles: computeTrend(
      Number(production.thisMonth?.poles || 0),
      Number(production.lastMonth?.poles || 0)
    ),
  };

  // Alerts — generic AlertItem array
  const alertsArray = [
    { type: 'low_stock',       count: Number(alerts.lowStock       || 0) },
    { type: 'pending_changes', count: Number(alerts.pendingChanges || 0) },
    { type: 'unread',          count: 0 },  // populated by client from notifications hook
  ];

  // Activity — semantic type replaces Tabler icon name; stable id for React lists
  const activity = (recentActivity || []).map((r) => ({
    id:          r.id,
    type:        iconToActivityType(r.icon),
    description: r.action,
    role:        r.role,
    time:        r.time,
    user_name:   r.user_name,
  }));

  // Pending actions — action enum + priority + no UI concepts
  const pending = (pendingActions || [])
    .map((p, i) => {
      const action   = pendingTypeToPendingAction(p.type, p.title);
      const priority = assignPriority(action, p.created_at);
      return { id: `pa-${i}`, action, priority, title: p.title, body: p.body, created_at: p.created_at };
    })
    .sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]);

  // Fetch caller's first name for the greeting
  const firstName = req.user.name?.split(' ')[0] ?? 'there';

  respond(res, {
    ok: true,
    greeting: buildGreeting(firstName),
    date:     buildDateLine(),
    month,
    alerts:   alertsArray,
    stock: {
      timberStock:    Number(stock.timberStock    || 0),
      polesStock:     Number(stock.polesStock     || 0),
      timberProduced: Number(stock.timberProduced || 0),
      polesProduced:  Number(stock.polesProduced  || 0),
      timberSold:     Number(stock.timberSold     || 0),
      polesSold:      Number(stock.polesSold      || 0),
    },
    production: {
      thisMonth: {
        timber:   Number(production.thisMonth?.timber   || 0),
        poles:    Number(production.thisMonth?.poles    || 0),
        downtime: Number(production.thisMonth?.downtime || 0),
      },
      lastMonth: {
        timber: Number(production.lastMonth?.timber || 0),
        poles:  Number(production.lastMonth?.poles  || 0),
      },
      trend,
      daily7: (production.daily7 || []).map((r) => ({
        log_date:     r.log_date,
        timber_units: Number(r.timber_units || 0),
        poles_units:  Number(r.poles_units  || 0),
      })),
    },
    sales: {
      thisMonth: {
        orders:   Number(sales.thisMonth?.orders   || 0),
        qty:      Number(sales.thisMonth?.qty      || 0),
        revenue:  Number(sales.thisMonth?.revenue  || 0),
        currency: 'RWF',
      },
      recent: (sales.recent || []).map((r) => ({
        id:            r.id,
        order_number:  r.order_number,
        customer_name: r.customer_name,
        product_type:  r.product_type,
        product_size:  r.product_size,
        quantity:      Number(r.quantity    || 0),
        unit_price:    Number(r.unit_price  || 0),
        currency:      'RWF',
      })),
    },
    expenses: {
      thisMonth:  Number(expenses.thisMonth || 0),
      currency:   'RWF',
      byCategory: (expenses.byCategory || []).map((c) => ({
        name:  c.name,
        total: Number(c.total || 0),
      })),
    },
    activity,
    pending,
  }, 30);
});

module.exports = router;
