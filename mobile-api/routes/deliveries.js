'use strict';

const express          = require('express');
const data             = require('../../db/services/data');
const { respond }      = require('../middleware/respond');

const router = express.Router();

// ── GET /api/deliveries ───────────────────────────────────────────────────────
// List delivery orders (pending, in-transit, POD-recorded).
// Also returns vehicles and open sales orders for dropdowns.
// data.js: deliveryOrdersList(userId)
//   Requires: deliveries page (logistics, sales, operations, admin, ceo)
//   NOT accessible to supervisor — supervisor lacks the deliveries page.

router.get('/', async (req, res) => {
  respond(res, await data.deliveryOrdersList(req.user.userId));
});

// ── POST /api/deliveries ──────────────────────────────────────────────────────
// Create a new delivery order.
// Body:
//   Required: driver_name (string)
//   Optional: vehicle_id, sales_order_id, qty_dispatched, delivery_date, route, notes
// data.js: deliveryOrdersCreate(userId, payload)
//   Requires: deliveries page (logistics, sales, operations, admin, ceo)
//   Side effects (all inside data.js):
//     - Auto-generates order_number DEL-{base36-ts} (server-side — never trust client)
//     - Sets status = 'Pending' always (server-side)
//     - If sales_order_id + qty_dispatched: updates SO qty_dispatched_total and status

router.post('/', async (req, res) => {
  const { driver_name } = req.body || {};
  if (!driver_name || !String(driver_name).trim()) {
    return res.status(400).json({ ok: false, error: 'Driver name is required' });
  }
  respond(res, await data.deliveryOrdersCreate(req.user.userId, req.body));
});

// ── POST /api/deliveries/:id/pod ──────────────────────────────────────────────
// Record Proof of Delivery at the customer site.
// This is the primary mobile use-case: driver records accepted/rejected qty.
// Body:
//   Required: qty_accepted (number ≥ 0)
//   Optional: rejection_reason
// data.js: deliveryOrdersRecordPOD(userId, orderId, payload)
//   Requires: deliveries page
//   Side effects (all inside data.js):
//     - Sets delivery_order.status = 'POD Recorded'
//     - Updates sales_order qty_accepted_total, qty_rejected_total, qty_remaining
//     - Sets sales_order.status = 'Fully Delivered' or 'Partially Delivered'
//     - Triggers refreshStockView() — rejected qty returns to available stock

router.post('/:id/pod', async (req, res) => {
  respond(res, await data.deliveryOrdersRecordPOD(
    req.user.userId,
    Number(req.params.id),
    req.body
  ));
});

// ── POST /api/deliveries/:id/status ───────────────────────────────────────────
// Update delivery status (Pending → Assigned → In Transit → Failed).
// Body: { status: "Pending"|"Assigned"|"In Transit"|"Failed" }
// data.js: deliveryOrdersUpdateStatus(userId, orderId, status)
//   Requires: deliveries page

router.post('/:id/status', async (req, res) => {
  const { status } = req.body || {};
  if (!status) return res.status(400).json({ ok: false, error: '"status" is required' });
  respond(res, await data.deliveryOrdersUpdateStatus(
    req.user.userId,
    Number(req.params.id),
    status
  ));
});

module.exports = router;
