'use strict';
const { Router }        = require('express');
const { requireRoles }  = require('../middleware/auth');
const { respond }       = require('../middleware/respond');
const data              = require('../../db/services/data');
const pool              = require('../lib/pool');

const router     = Router();
const SALES_ROLES = ['admin', 'ceo', 'operations', 'sales'];

// ── helpers ───────────────────────────────────────────────────────────────────
function computeMetrics(rows) {
  return rows.reduce((acc, r) => {
    const s = r.status || 'Pending';
    if      (s === 'Pending')   acc.pending++;
    else if (s === 'Confirmed') acc.confirmed++;
    else if (['In Progress', 'Dispatched', 'Partially Delivered'].includes(s)) acc.inProgress++;
    else if (['Fully Delivered', 'Delivered'].includes(s)) acc.delivered++;
    else if (s === 'Closed (Short)') acc.closed++;
    return acc;
  }, { pending: 0, confirmed: 0, inProgress: 0, delivered: 0, closed: 0 });
}

// ── Static sub-routes BEFORE /:id ────────────────────────────────────────────

// PATCH /api/sales/:id/pay
router.patch('/:id/pay', requireRoles(SALES_ROLES), async (req, res) => {
  const { paymentStatus } = req.body;
  const result = await data.salesUpdatePayment(req.user.userId, Number(req.params.id), paymentStatus);
  if (result.pendingApproval) return respond(res, result, 202);
  respond(res, result);
});

// PATCH /api/sales/:id/status
router.patch('/:id/status', requireRoles(SALES_ROLES), async (req, res) => {
  const { status } = req.body;
  const result = await data.salesUpdateStatus(req.user.userId, Number(req.params.id), status);
  if (result.pendingApproval) return respond(res, result, 202);
  respond(res, result);
});

// POST /api/sales/:id/close-short
router.post('/:id/close-short', requireRoles(SALES_ROLES), async (req, res) => {
  respond(res, await data.salesCloseShort(req.user.userId, Number(req.params.id)));
});

// POST /api/sales/:id/deliver  — creates a delivery order from this SO
router.post('/:id/deliver', requireRoles(SALES_ROLES), async (req, res) => {
  const soId    = Number(req.params.id);
  const payload = { ...req.body, sales_order_id: soId };
  respond(res, await data.deliveriesCreate(req.user.userId, payload));
});

// ── Generic routes ────────────────────────────────────────────────────────────

// GET /api/sales
router.get('/', requireRoles(SALES_ROLES), async (req, res) => {
  const userId       = req.user.userId;
  const workshopId   = req.query.workshop_id ? Number(req.query.workshop_id) : null;

  const [listRes, prodsRes, custsRes, vehiclesRes] = await Promise.all([
    data.salesList(userId, workshopId),
    data.salesProductsForDropdown(userId),
    data.customersForDropdown(userId),
    pool.query(
      `select id, registration, make, driver_assigned
       from vehicles where active=true order by registration`
    ),
  ]);

  if (!listRes.ok)  return respond(res, listRes);

  const rows = listRes.rows || [];

  respond(res, {
    ok:      true,
    rows,
    metrics: computeMetrics(rows),
    stock:   listRes.stock,
    dropdowns: {
      customers: custsRes.ok ? (custsRes.rows || []) : [],
      products:  prodsRes.ok ? (prodsRes.rows || []) : [],
      vehicles:  vehiclesRes.rows || [],
    },
  }, 200, 30);
});

// POST /api/sales  — create order
router.post('/', requireRoles(SALES_ROLES), async (req, res) => {
  respond(res, await data.salesCreate(req.user.userId, req.body));
});

// PATCH /api/sales/:id  — edit order (governance-aware)
router.patch('/:id', requireRoles(SALES_ROLES), async (req, res) => {
  const result = await data.salesUpdate(req.user.userId, Number(req.params.id), req.body);
  if (result.pendingApproval) return respond(res, result, 202);
  respond(res, result);
});

// DELETE /api/sales/:id  — soft-delete (governance-aware)
router.delete('/:id', requireRoles(SALES_ROLES), async (req, res) => {
  const result = await data.salesDelete(req.user.userId, Number(req.params.id), req.body?.reason);
  if (result.pendingApproval) return respond(res, result, 202);
  respond(res, result);
});

module.exports = router;
