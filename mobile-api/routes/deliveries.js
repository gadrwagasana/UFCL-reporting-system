'use strict';

const express               = require('express');
const data                  = require('../../db/services/data');
const { respond, buildEnvelope } = require('../middleware/respond');

const router = express.Router();

function computeMetrics(rows) {
  return {
    total:       rows.length,
    pending:     rows.filter(r => r.status === 'Pending').length,
    inTransit:   rows.filter(r => r.status === 'In Transit').length,
    podRecorded: rows.filter(r => r.status === 'POD Recorded').length,
  };
}

// ── GET /api/deliveries ───────────────────────────────────────────────────────
// List delivery orders. Also returns vehicles and open SOs for dropdowns.
// Server-side metrics: { total, pending, inTransit, podRecorded }
router.get('/', async (req, res) => {
  const result = await data.deliveryOrdersList(req.user.userId);
  if (!result.ok) return respond(res, result);
  const rows = result.rows || [];
  respond(res, {
    ok:          true,
    rows,
    metrics:     computeMetrics(rows),
    vehicles:    result.vehicles    || [],
    salesOrders: result.salesOrders || [],
  }, 30);
});

// ── POST /api/deliveries ──────────────────────────────────────────────────────
// Create a new delivery order.
// Required: driver_name
// Optional: vehicle_id, sales_order_id, qty_dispatched, delivery_date, route, notes
router.post('/', async (req, res) => {
  const { driver_name } = req.body || {};
  if (!driver_name || !String(driver_name).trim()) {
    return res.status(400).json({ ok: false, error: 'Driver name is required' });
  }
  respond(res, await data.deliveryOrdersCreate(req.user.userId, req.body));
});

// ── PATCH /api/deliveries/:id ─────────────────────────────────────────────────
// Edit a delivery order (driver, vehicle, date, route, notes, qty_dispatched).
// data.js deliveryOrdersUpdate may return pendingApproval when governance applies.
router.patch('/:id', async (req, res) => {
  const result = await data.deliveryOrdersUpdate(
    req.user.userId,
    Number(req.params.id),
    req.body
  );
  if (!result.ok && result.pendingApproval) {
    return res.json(buildEnvelope(true, {
      pendingApproval: true,
      level:           result.level,
      message:         result.message,
    }));
  }
  respond(res, result);
});

// ── DELETE /api/deliveries/:id ────────────────────────────────────────────────
// Delete a delivery order (cascades to dispatch_requests).
// data.js deliveryOrdersDelete may return pendingApproval when governance applies.
router.delete('/:id', async (req, res) => {
  const { reason } = req.body || {};
  const result = await data.deliveryOrdersDelete(
    req.user.userId,
    Number(req.params.id),
    reason || null
  );
  if (!result.ok && result.pendingApproval) {
    return res.json(buildEnvelope(true, {
      pendingApproval: true,
      level:           result.level,
      message:         result.message,
    }));
  }
  respond(res, result);
});

// ── POST /api/deliveries/:id/pod ──────────────────────────────────────────────
// Record Proof of Delivery.
// Required: qty_accepted (≥ 0). Optional: rejection_reason.
// qty_rejected computed in data.js: dispatched - accepted
router.post('/:id/pod', async (req, res) => {
  respond(res, await data.deliveryOrdersRecordPOD(
    req.user.userId,
    Number(req.params.id),
    req.body
  ));
});

// ── POST /api/deliveries/:id/status ───────────────────────────────────────────
// Update status. Allowed: Pending | Assigned | In Transit | Failed
// data.js validates and may return pendingApproval.
router.post('/:id/status', async (req, res) => {
  const { status } = req.body || {};
  if (!status) return res.status(400).json({ ok: false, error: '"status" is required' });
  const result = await data.deliveryOrdersUpdateStatus(
    req.user.userId,
    Number(req.params.id),
    status
  );
  if (!result.ok && result.pendingApproval) {
    return res.json(buildEnvelope(true, {
      pendingApproval: true,
      level:           result.level,
      message:         result.message,
    }));
  }
  respond(res, result);
});

module.exports = router;
