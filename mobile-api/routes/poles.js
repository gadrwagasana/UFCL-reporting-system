'use strict';

const express          = require('express');
const data             = require('../../db/services/data');
const { respond }      = require('../middleware/respond');

const router = express.Router();

// ── GET /api/poles/purchase-requests ─────────────────────────────────────────
// List poles purchase requests + deliveries + available stock balance.
// data.js: polesPurchaseList(userId, workshopId?)
//   Requires: canAccessDaily (daily-timber or daily-poles page)

router.get('/purchase-requests', async (req, res) => {
  respond(res, await data.polesPurchaseList(req.user.userId));
});

// ── POST /api/poles/purchase-requests ────────────────────────────────────────
// Submit a new poles purchase request (pending CEO approval).
// Body:
//   Required: supplier_name, requested_qty
//   Optional: unit_price, notes
// data.js: polesPurchaseCreate(userId, payload)
//   Role check: ['admin','ceo','operations','supervisor','poles-leader']

router.post('/purchase-requests', async (req, res) => {
  respond(res, await data.polesPurchaseCreate(req.user.userId, req.body));
});

// ── GET /api/poles/deliveries ─────────────────────────────────────────────────
// List poles deliveries + available stock balance (shared endpoint with purchase list).
// Reuses polesPurchaseList which returns both requests and deliveries.

router.get('/deliveries', async (req, res) => {
  respond(res, await data.polesPurchaseList(req.user.userId));
});

// ── POST /api/poles/deliveries ────────────────────────────────────────────────
// Record a poles delivery from the supplier.
// Body:
//   Required: delivery_date (YYYY-MM-DD), delivered_qty
//   Optional: purchase_request_id, supplier_name, delivery_note_ref, notes
// data.js: polesDeliveryCreate(userId, payload)
//   Role check: ['admin','ceo','operations','supervisor','poles-leader']

router.post('/deliveries', async (req, res) => {
  respond(res, await data.polesDeliveryCreate(req.user.userId, req.body));
});

// ── POST /api/poles/deliveries/:id/quality-check ── (Phase 2) ─────────────────
// Record quality check result — approved and rejected quantities.
// Body:
//   Required: approved_qty
//   Optional: rejection_reason
// data.js: polesDeliveryQualityCheck(userId, deliveryId, payload)
//   Role check: ['admin','ceo','operations','supervisor','poles-leader']

router.post('/deliveries/:id/quality-check', async (req, res) => {
  respond(res, await data.polesDeliveryQualityCheck(
    req.user.userId,
    Number(req.params.id),
    req.body
  ));
});

module.exports = router;
