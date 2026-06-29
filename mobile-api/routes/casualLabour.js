'use strict';

const express          = require('express');
const data             = require('../../db/services/data');
const { requireRoles } = require('../middleware/authorize');
const { respond }      = require('../middleware/respond');

const router = express.Router();

// ── GET /api/casual-labour ────────────────────────────────────────────────────
// List casual labour requests for the caller's workshop.
// data.js: casualLabourRequestsList(userId, workshopId?)
//   Requires: casual-requests page or role in [admin,ceo,operations,supervisor]
//   Workshop isolation: YES — isWorkshopRestricted applied inside function

router.get('/', async (req, res) => {
  respond(res, await data.casualLabourRequestsList(req.user.userId));
});

// ── POST /api/casual-labour ───────────────────────────────────────────────────
// Submit a casual labour request.
// Body:
//   Required: start_date (YYYY-MM-DD), end_date (YYYY-MM-DD), task, num_casuals
//   Optional: labour_items (array of strings), description, comments
// data.js: casualLabourRequestsCreate(userId, payload)
//   Requires: casual-requests page (supervisor ✓, operations ✓)
//   Workshop isolation: YES

router.post('/', async (req, res) => {
  respond(res, await data.casualLabourRequestsCreate(req.user.userId, req.body));
});

// ── POST /api/casual-labour/:id/review ── (Phase 2) ──────────────────────────
// Approve or reject a casual labour request.
// Body: { status: "Approved"|"Rejected" }
// data.js: casualLabourRequestsReview(userId, requestId, status)
//   Requires role: ceo or operations ONLY

router.post('/:id/review', requireRoles('ceo', 'operations', 'admin'), async (req, res) => {
  const { status } = req.body || {};
  if (!['Approved', 'Rejected'].includes(status)) {
    return res.status(400).json({ ok: false, error: '"status" must be "Approved" or "Rejected"' });
  }
  respond(res, await data.casualLabourRequestsReview(
    req.user.userId,
    Number(req.params.id),
    status
  ));
});

module.exports = router;
