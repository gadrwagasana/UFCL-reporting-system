'use strict';

// Timber Lifecycle Phase 2 (Workstream 3/4/13) — Rejection Holds + Quality/
// Resolution/Financial reporting.
const express      = require('express');
const data         = require('../../db/services/data');
const { respond }  = require('../middleware/respond');

const router = express.Router();

// ── GET /api/rejection-holds?status=&sourceType= ──────────────────────────────
// sourceType: 'sawmill' | 'value_added' (Timber Lifecycle Phase 3) — omit for both.
router.get('/', async (req, res) => {
  respond(res, await data.rejectionHoldsList(req.user.userId, req.query.status || null, req.query.sourceType || null));
});

// ── POST /api/rejection-holds/:id/rework ──────────────────────────────────────
router.post('/:id/rework', async (req, res) => {
  respond(res, await data.rejectionResolveRework(req.user.userId, Number(req.params.id)));
});

// ── POST /api/rejection-holds/:id/downgrade ───────────────────────────────────
// Body: downgrade_product_id, reason?
router.post('/:id/downgrade', async (req, res) => {
  respond(res, await data.rejectionResolveDowngrade(req.user.userId, Number(req.params.id), req.body));
});

// ── POST /api/rejection-holds/:id/return ──────────────────────────────────────
// Body: reason
router.post('/:id/return', async (req, res) => {
  respond(res, await data.rejectionResolveReturnToInventory(req.user.userId, Number(req.params.id), req.body));
});

// ── GET /api/rejection-holds/quality-report?workshopId= ───────────────────────
router.get('/quality-report', async (req, res) => {
  respond(res, await data.qualityReport(req.user.userId, req.query.workshopId ? Number(req.query.workshopId) : null));
});

module.exports = router;
