'use strict';

const express      = require('express');
const data         = require('../../db/services/data');
const { respond }  = require('../middleware/respond');

const router = express.Router();

// ── Payments (declared before /:id so "/payments" never matches ":id") ──────

router.get('/payments', async (req, res) => {
  respond(res, await data.procurementPaymentList(req.user.userId));
});

// Body: { amount, payment_date, payment_method, reference }
router.post('/:invoiceId/payments', async (req, res) => {
  respond(res, await data.procurementPaymentCreate(req.user.userId, Number(req.params.invoiceId), req.body));
});

// Body: { decision: 'approved'|'rejected', notes }
router.post('/payments/:paymentId/approve', async (req, res) => {
  const { decision, notes } = req.body || {};
  if (!decision) return res.status(400).json({ ok: false, error: '"decision" ("approved" or "rejected") is required' });
  respond(res, await data.procurementPaymentApprove(req.user.userId, Number(req.params.paymentId), decision, notes));
});

// ── Invoices ─────────────────────────────────────────────────────────────────

router.get('/', async (req, res) => {
  respond(res, await data.procurementInvoiceList(req.user.userId, req.query));
});

// Body: { invoice_number, invoice_date, invoice_amount }
router.post('/from-po/:poId', async (req, res) => {
  respond(res, await data.procurementInvoiceCreate(req.user.userId, Number(req.params.poId), req.body));
});

// Three-way match: PO vs. goods receipt vs. invoice amount.
router.post('/:id/match', async (req, res) => {
  respond(res, await data.procurementInvoiceMatch(req.user.userId, Number(req.params.id)));
});

// Body: { decision: 'approved'|'rejected', notes }
router.post('/:id/approve', async (req, res) => {
  const { decision, notes } = req.body || {};
  if (!decision) return res.status(400).json({ ok: false, error: '"decision" ("approved" or "rejected") is required' });
  respond(res, await data.procurementInvoiceApprove(req.user.userId, Number(req.params.id), decision, notes));
});

module.exports = router;
