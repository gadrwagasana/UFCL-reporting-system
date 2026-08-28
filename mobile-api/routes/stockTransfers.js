'use strict';

const express = require('express');
const router  = express.Router();
const data    = require('../../db/services/data');
const { requireRoles } = require('../middleware/authorize');
const { respond }      = require('../middleware/respond');

// Phase 1 Inventory fix — the previous APPROVE_ROLES subset (excluding
// logistics-officer/supervisor/storekeeper) blocked roles that already hold
// 'stock-transfers' in role_definitions from approving transfers they can
// view/create/dispatch — the same hardcoded-array defect fixed in
// data.js's stockTransfersApproveReject (which is the real gatekeeper here;
// this array is now just the same full grant list, kept for defense in
// depth at the route layer).
// Stock & Inventory Phase 4 (audit finding M-15) — this list drifted again:
// showroom-staff/vat-leader/vat-supervisor all hold 'stock-transfers' live
// (role_definitions) but were missing here, 403ing the entire mobile Stock
// Transfers feature for all three. Same class of fix as above — widened to
// match the actual granted permission, not narrowed.
const ACT_ROLES     = ['admin', 'ceo', 'operations', 'logistics', 'logistics-officer', 'supervisor', 'storekeeper', 'showroom-staff', 'vat-leader', 'vat-supervisor'];

// ── GET /api/stock-transfers ──────────────────────────────────────────────────
router.get('/', requireRoles(...ACT_ROLES), async (req, res) => {
  const result = await data.stockTransfersList(req.user.userId, req.query.workshopId || null);
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
router.post('/', requireRoles(...ACT_ROLES), async (req, res) => {
  const result = await data.stockTransfersCreate(req.user.userId, req.body);
  if (!result.ok) return respond(res, { ok: false, error: result.error }, 400);
  return respond(res, result, 201);
});

// ── PATCH /api/stock-transfers/:id/approve ────────────────────────────────────
// Body: { action: "approve"|"reject", rejectionReason? }
router.patch('/:id/approve', requireRoles(...ACT_ROLES), async (req, res) => {
  const { action, rejectionReason } = req.body || {};
  const result = await data.stockTransfersApproveReject(
    req.user.userId, Number(req.params.id), action, rejectionReason || null
  );
  if (!result.ok) return respond(res, { ok: false, error: result.error }, 400);
  return respond(res, result, 200);
});

// ── POST /api/stock-transfers/:id/dispatch ────────────────────────────────────
// Body: { qty, vehicle_id, driver_name?, dispatched_at?, reference?, notes? }
router.post('/:id/dispatch', requireRoles(...ACT_ROLES), async (req, res) => {
  const result = await data.stockTransfersDispatch(req.user.userId, Number(req.params.id), req.body);
  if (!result.ok) return respond(res, { ok: false, error: result.error }, 400);
  return respond(res, result, 200);
});

// ── POST /api/stock-transfers/:id/receive ─────────────────────────────────────
// Body: { qty, notes? }
router.post('/:id/receive', requireRoles(...ACT_ROLES), async (req, res) => {
  const { qty, notes } = req.body || {};
  const result = await data.stockTransfersReceive(req.user.userId, Number(req.params.id), qty, notes || null);
  if (!result.ok) return respond(res, { ok: false, error: result.error }, 400);
  return respond(res, result, 200);
});

// ── POST /api/stock-transfers/:id/report-discrepancy ─────────────────────────
// Body: { notes, lossReason }. Closes a transfer that will never fully arrive
// (short delivery / damage in transit) at its current received_qty, and
// records the missing quantity as an inventory movement (Inventory Integrity
// Phase 1) — lossReason is one of the standardized DISCREPANCY_REASONS.
router.post('/:id/report-discrepancy', requireRoles(...ACT_ROLES), async (req, res) => {
  const { notes, lossReason } = req.body || {};
  const result = await data.stockTransfersReportDiscrepancy(req.user.userId, Number(req.params.id), notes || null, lossReason);
  if (!result.ok) return respond(res, { ok: false, error: result.error }, 400);
  return respond(res, result, 200);
});

// ── GET /api/stock-transfers/:id/history ─────────────────────────────────────
// Static routes above must precede this parameterized GET.
router.get('/:id/history', requireRoles(...ACT_ROLES), async (req, res) => {
  const result = await data.stockTransfersDispatchHistory(req.user.userId, Number(req.params.id));
  if (!result.ok) return respond(res, { ok: false, error: result.error }, 403);
  return respond(res, result, 200, 0);
});

module.exports = router;
