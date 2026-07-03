'use strict';

const express = require('express');
const router  = express.Router();
const data    = require('../../db/services/data');
const { requireRoles } = require('../middleware/authorize');
const { respond }      = require('../middleware/respond');

const ACT_ROLES     = ['admin', 'ceo', 'operations', 'logistics', 'supervisor', 'storekeeper'];
const APPROVE_ROLES = ['admin', 'ceo', 'operations', 'logistics'];

// ── GET /api/stock-transfers ──────────────────────────────────────────────────
router.get('/', requireRoles(ACT_ROLES), async (req, res) => {
  const result = await data.stockTransfersList(req.user.id, req.query.workshopId || null);
  if (!result.ok) return respond(res, { ok: false, error: result.error }, 403);
  const rows = result.rows || [];
  const summary = {
    total:     rows.length,
    pending:   rows.filter(r => r.status === 'pending').length,
    inTransit: rows.filter(r => ['approved', 'in_transit', 'partially_received'].includes(r.status)).length,
    completed: rows.filter(r => r.status === 'completed').length,
  };
  return respond(res, { ...result, summary }, 200, 30);
});

// ── POST /api/stock-transfers ─────────────────────────────────────────────────
router.post('/', requireRoles(ACT_ROLES), async (req, res) => {
  const result = await data.stockTransfersCreate(req.user.id, req.body);
  if (!result.ok) return respond(res, { ok: false, error: result.error }, 400);
  return respond(res, result, 201);
});

// ── PATCH /api/stock-transfers/:id/approve ────────────────────────────────────
// Body: { action: "approve"|"reject", rejectionReason? }
router.patch('/:id/approve', requireRoles(APPROVE_ROLES), async (req, res) => {
  const { action, rejectionReason } = req.body || {};
  const result = await data.stockTransfersApproveReject(
    req.user.id, Number(req.params.id), action, rejectionReason || null
  );
  if (!result.ok) return respond(res, { ok: false, error: result.error }, 400);
  return respond(res, result, 200);
});

// ── POST /api/stock-transfers/:id/dispatch ────────────────────────────────────
// Body: { qty, vehicle_id, driver_name?, dispatched_at?, reference?, notes? }
router.post('/:id/dispatch', requireRoles(ACT_ROLES), async (req, res) => {
  const result = await data.stockTransfersDispatch(req.user.id, Number(req.params.id), req.body);
  if (!result.ok) return respond(res, { ok: false, error: result.error }, 400);
  return respond(res, result, 200);
});

// ── POST /api/stock-transfers/:id/receive ─────────────────────────────────────
// Body: { qty, notes? }
router.post('/:id/receive', requireRoles(ACT_ROLES), async (req, res) => {
  const { qty, notes } = req.body || {};
  const result = await data.stockTransfersReceive(req.user.id, Number(req.params.id), qty, notes || null);
  if (!result.ok) return respond(res, { ok: false, error: result.error }, 400);
  return respond(res, result, 200);
});

// ── GET /api/stock-transfers/:id/history ─────────────────────────────────────
// Static routes above must precede this parameterized GET.
router.get('/:id/history', requireRoles(ACT_ROLES), async (req, res) => {
  const result = await data.stockTransfersDispatchHistory(req.user.id, Number(req.params.id));
  if (!result.ok) return respond(res, { ok: false, error: result.error }, 403);
  return respond(res, result, 200, 0);
});

module.exports = router;
