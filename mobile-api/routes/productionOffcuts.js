'use strict';

// Timber Lifecycle Phase 1 (Workstream 4 & 5) — Production Offcuts, Resaw,
// Quality Inspection, and Production Reconciliation.
const express      = require('express');
const data         = require('../../db/services/data');
const { respond }  = require('../middleware/respond');

const router = express.Router();

// ── GET /api/production-offcuts?status=&workshopId= ──────────────────────────
router.get('/', async (req, res) => {
  respond(res, await data.productionOffcutsList(
    req.user.userId,
    req.query.workshopId ? Number(req.query.workshopId) : null,
    req.query.status || null
  ));
});

// ── POST /api/production-offcuts ──────────────────────────────────────────────
// Body: daily_log_id, quantity
router.post('/', async (req, res) => {
  respond(res, await data.productionOffcutCreate(req.user.userId, req.body));
});

// ── POST /api/production-offcuts/:id/decide ──────────────────────────────────
// Body: recoverable (boolean)
router.post('/:id/decide', async (req, res) => {
  respond(res, await data.productionOffcutDecide(req.user.userId, Number(req.params.id), !!req.body?.recoverable));
});

// ── POST /api/production-offcuts/:id/recovery ────────────────────────────────
// Body: machine_id, recovered_quantity, width_mm?, thickness_mm?, length_m?
router.post('/:id/recovery', async (req, res) => {
  respond(res, await data.productionOffcutRecordRecovery(req.user.userId, Number(req.params.id), req.body));
});

// ── POST /api/production-offcuts/:id/inspect ──────────────────────────────────
// Body: approved_qty, rejection_reason?, notes?
router.post('/:id/inspect', async (req, res) => {
  respond(res, await data.qualityInspectionCreate(req.user.userId, Number(req.params.id), req.body));
});

// ── GET /api/production-offcuts/reconciliation ────────────────────────────────
router.get('/reconciliation', async (req, res) => {
  respond(res, await data.productionReconciliation(req.user.userId, req.query.workshopId ? Number(req.query.workshopId) : null));
});

module.exports = router;
