'use strict';

const express          = require('express');
const data             = require('../../db/services/data');
const { requireRoles } = require('../middleware/authorize');
const { respond }      = require('../middleware/respond');

const router = express.Router();

// ── GET /api/logistics/dashboard ──────────────────────────────────────────────
// Warehouse stock summary for logistics and admin roles.
// Calls data.logisticsDashboard() and transforms to mobile envelope.

router.get('/dashboard', requireRoles('logistics', 'admin'), async (req, res) => {
  const result = await data.logisticsDashboard(req.user.userId);
  if (!result.ok) return respond(res, result, 0);

  const { workshops, lowStock, recentMovements, monthTotals } = result;

  respond(res, {
    ok: true,
    workshops: (workshops || []).map((w) => ({
      id:          w.id,
      name:        w.name,
      location:    w.location,
      item_count:  Number(w.item_count  || 0),
      stock_value: Number(w.stock_value || 0),
      currency:    'RWF',
      total_qty:   Number(w.total_qty   || 0),
    })),
    lowStock: (lowStock || []).map((s) => ({
      name:           s.name,
      category:       s.category,
      uom:            s.uom,
      min_stock:      Number(s.min_stock   || 0),
      total_stock:    Number(s.total_stock || 0),
      warehouse_name: s.warehouse_name,
    })),
    activity: (recentMovements || []).map((m) => ({
      id:            m.id,
      type:          m.movement_type === 'in' ? 'stock_movement_in' : 'stock_movement_out',
      item_name:     m.item_name,
      quantity:      Number(m.quantity || 0),
      workshop_name: m.workshop_name,
      time:          m.created_at,
      user_name:     m.created_by,
    })),
    monthTotals: (monthTotals || []).map((t) => ({
      movement_type: t.movement_type,
      count:         Number(t.cnt       || 0),
      total_qty:     Number(t.total_qty || 0),
    })),
  }, 30);
});

module.exports = router;
