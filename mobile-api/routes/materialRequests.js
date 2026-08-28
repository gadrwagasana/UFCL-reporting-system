'use strict';

const express                               = require('express');
const data                                  = require('../../db/services/data');
const { pool }                              = require('../../db/pool');
const { respond }                           = require('../middleware/respond');
const { supervisorWorkshopGuard }           = require('../middleware/authorize');

const router = express.Router();

// ── GET /api/material-requests ────────────────────────────────────────────────
// List material requests for the caller's workshop + stock catalog + workshop list.
// data.js: materialRequestsList(userId, workshopId?)
//   Requires: 'material-requests' OR 'stock-movements' page
//   (Mechanician Phase 1 — Gap A closed: mechanician/supervisor/sawmill-leader/
//   poles-leader/vat-leader hold 'material-requests' and can now reach this.)
//   Workshop isolation: YES — isWorkshopRestricted applied inside function

router.get('/', async (req, res) => {
  respond(res, await data.materialRequestsList(req.user.userId));
});

// ── POST /api/material-requests ───────────────────────────────────────────────
// Submit a new material request.
// Body:
//   Required: item_id, requested_qty
//   Optional: reason, priority ("normal"|"urgent"|"critical")
//   workshop_id is auto-set from user for workshop-restricted roles.
// data.js: materialRequestsCreate(userId, payload)
//   Requires: 'material-requests' OR 'stock-movements' page (Gap A closed, see above)
//   Workshop isolation: YES

router.post('/', async (req, res) => {
  respond(res, await data.materialRequestsCreate(req.user.userId, req.body));
});

// ── POST /api/material-requests/:id/approve ── (Phase 2) ─────────────────────
// Approve or reject a material request.
// Body:
//   Required: action ("approve"|"reject")
//   Optional: approvedQty, reviewNotes, sourceWarehouseId
// Gap C: if caller is supervisor, verify their workshop matches the request's
//   workshop before calling data.js. (Mechanician Phase 1 — data.js's own
//   materialRequestsApprove now enforces this same workshop check internally
//   too, so desktop callers get the same protection this route always gave
//   mobile; this route-level guard is kept as defense-in-depth, not removed.)
// data.js: materialRequestsApprove(userId, requestId, action, approvedQty, reviewNotes, sourceWarehouseId)
//   Requires role: admin|ceo|operations|logistics (via 'stock-movements'), or
//   supervisor (via 'material-requests' + own-workshop check)

router.post('/:id/approve', async (req, res) => {
  const { action, approvedQty, reviewNotes, sourceWarehouseId, destinationWorkshopId } = req.body || {};
  if (!action) return res.status(400).json({ ok: false, error: '"action" (approve or reject) is required' });

  // Gap C: supervisors may only approve their own workshop's requests
  if (req.user.role === 'supervisor') {
    const { rows } = await pool.query(
      'select workshop_id from material_requests where id=$1 and status=$2',
      [Number(req.params.id), 'pending']
    );
    if (!rows.length) return res.status(404).json({ ok: false, error: 'Request not found or already reviewed' });
    if (!supervisorWorkshopGuard(req, rows[0].workshop_id)) {
      return res.status(403).json({ ok: false, error: 'Access denied — request belongs to a different workshop' });
    }
  }

  respond(res, await data.materialRequestsApprove(
    req.user.userId,
    Number(req.params.id),
    action,
    approvedQty || null,
    reviewNotes || null,
    sourceWarehouseId ? Number(sourceWarehouseId) : null,
    destinationWorkshopId ? Number(destinationWorkshopId) : null
  ));
});

module.exports = router;
