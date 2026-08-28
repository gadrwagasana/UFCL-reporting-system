'use strict';

const express      = require('express');
const data         = require('../../db/services/data');
const { respond }  = require('../middleware/respond');

const router = express.Router();

// ── GET /api/procurement/rfq ─────────────────────────────────────────────────
router.get('/', async (req, res) => {
  respond(res, await data.procurementRfqList(req.user.userId));
});

// ── POST /api/procurement/rfq/from-requisition/:requisitionId ──────────────
router.post('/from-requisition/:requisitionId', async (req, res) => {
  respond(res, await data.procurementRfqCreate(req.user.userId, Number(req.params.requisitionId), req.body));
});

// ── GET /api/procurement/rfq/:id ─────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  respond(res, await data.procurementRfqDetail(req.user.userId, Number(req.params.id)));
});

// ── POST /api/procurement/rfq/:id/send ───────────────────────────────────────
// Body: { supplierIds: number[] }
router.post('/:id/send', async (req, res) => {
  respond(res, await data.procurementRfqSendToSuppliers(req.user.userId, Number(req.params.id), req.body?.supplierIds));
});

// ── POST /api/procurement/rfq/:id/quotations ────────────────────────────────
// Body: { supplierId, quoted_amount, delivery_days, terms, notes }
// Procurement Officer enters received quotes on the supplier's behalf — suppliers have no logins.
router.post('/:id/quotations', async (req, res) => {
  const { supplierId, ...payload } = req.body || {};
  if (!supplierId) return res.status(400).json({ ok: false, error: '"supplierId" is required' });
  respond(res, await data.procurementQuotationSubmit(req.user.userId, Number(req.params.id), Number(supplierId), payload));
});

// ── GET /api/procurement/rfq/:id/compare ────────────────────────────────────
router.get('/:id/compare', async (req, res) => {
  respond(res, await data.procurementQuotationsCompare(req.user.userId, Number(req.params.id)));
});

// ── POST /api/procurement/rfq/quotations/:quotationId/select ───────────────
router.post('/quotations/:quotationId/select', async (req, res) => {
  respond(res, await data.procurementQuotationSelect(req.user.userId, Number(req.params.quotationId)));
});

module.exports = router;
