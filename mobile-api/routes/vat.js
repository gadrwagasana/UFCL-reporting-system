'use strict';

const express     = require('express');
const data        = require('../../db/services/data');
const { respond } = require('../middleware/respond');

const router = express.Router();

// ── GET /api/vat/available-inputs ─────────────────────────────────────────────
// Nyanza Value-Added Production Completion Phase — replaces the old
// /api/vat/inbound (which showed transfer budgets, not real stock). Lists
// what's actually available at the workshop to consume as production input,
// straight from stock_levels.
// data.js: valueAddedProductionAvailableInputs(userId, workshopId?)

router.get('/available-inputs', async (req, res) => {
  respond(res, await data.valueAddedProductionAvailableInputs(req.user.userId, req.query.workshopId ? Number(req.query.workshopId) : null));
});

// ── GET /api/vat ────────────────────────────────────────────────────────────────
// List value-added production batches (with joined input/output lines) for
// the current user's workshop.
// data.js: valueAddedProductionBatchList(userId, workshopId?)

router.get('/', async (req, res) => {
  respond(res, await data.valueAddedProductionBatchList(req.user.userId, req.query.workshopId ? Number(req.query.workshopId) : null));
});

// ── GET /api/vat/reconciliation ──────────────────────────────────────────────
// data.js: valueAddedProductionReconciliation(userId, workshopId?)

router.get('/reconciliation', async (req, res) => {
  respond(res, await data.valueAddedProductionReconciliation(req.user.userId, req.query.workshopId ? Number(req.query.workshopId) : null));
});

// ── GET /api/vat/report ──────────────────────────────────────────────────────
// data.js: valueAddedProductionReport(userId, workshopId?)

router.get('/report', async (req, res) => {
  respond(res, await data.valueAddedProductionReport(req.user.userId, req.query.workshopId ? Number(req.query.workshopId) : null));
});

// ── POST /api/vat ─────────────────────────────────────────────────────────────
// Record a value-added production batch: metadata + input lines (consumed
// from real stock, validated against stock_levels) + output lines (enter
// pending_qc, awaiting inspection).
// Body: batch_date, production_type?, customer_id?, order_reference?,
//   operator?, supervisor?, start_time?, end_time?, downtime_minutes?, notes?,
//   inputs: [{ stock_item_id, quantity }] (>=1),
//   outputs: [{ output_product_id, quantity }] (>=1)
// data.js: valueAddedProductionBatchCreate(userId, payload)

router.post('/', async (req, res) => {
  respond(res, await data.valueAddedProductionBatchCreate(req.user.userId, req.body));
});

// ── PUT /api/vat/:id ──────────────────────────────────────────────────────────
// Metadata-only edit — input/output lines have real stock/QC consequences
// attached and aren't editable after creation.
// data.js: valueAddedProductionBatchUpdate(userId, id, payload)

router.put('/:id', async (req, res) => {
  respond(res, await data.valueAddedProductionBatchUpdate(req.user.userId, Number(req.params.id), req.body));
});

// ── DELETE /api/vat/:id ───────────────────────────────────────────────────────
// Moves the batch to Trash and reverses its input stock consumption.
// Body: reason
// data.js: valueAddedProductionBatchDelete(userId, id, reason)

router.delete('/:id', async (req, res) => {
  respond(res, await data.valueAddedProductionBatchDelete(req.user.userId, Number(req.params.id), req.body?.reason));
});

// ── POST /api/vat/outputs/:outputId/inspect ──────────────────────────────────
// Value-Added Quality Inspection, now per output line rather than per raw
// VAT entry — output_product_id was already chosen at output-line creation,
// so there's no product-inference step here.
// Body: approved_qty (required), rejection_reason?, notes?
// data.js: valueAddedProductionInspect(userId, outputId, payload)

router.post('/outputs/:outputId/inspect', async (req, res) => {
  respond(res, await data.valueAddedProductionInspect(req.user.userId, Number(req.params.outputId), req.body));
});

module.exports = router;
