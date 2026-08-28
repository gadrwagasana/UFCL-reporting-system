'use strict';

const express      = require('express');
const data         = require('../../db/services/data');
const { respond }  = require('../middleware/respond');

const router = express.Router();

// ── Purchase Orders ──────────────────────────────────────────────────────────

router.get('/', async (req, res) => {
  respond(res, await data.procurementPoList(req.user.userId, req.query));
});

// Body: { requisitionId, quotationId }
router.post('/generate', async (req, res) => {
  const { requisitionId, quotationId } = req.body || {};
  if (!requisitionId) return res.status(400).json({ ok: false, error: '"requisitionId" is required' });
  respond(res, await data.procurementPoGenerate(req.user.userId, Number(requisitionId), quotationId ? Number(quotationId) : null));
});

router.get('/receipts', async (req, res) => {
  respond(res, await data.procurementGoodsReceiptList(req.user.userId));
});

router.get('/receipts/:receiptId', async (req, res) => {
  respond(res, await data.procurementGoodsReceiptDetail(req.user.userId, Number(req.params.receiptId)));
});

// Declared before the /:id routes below, matching this file's own
// established convention for /meta-prefixed routes.
router.get('/meta/reports/po-shortages', async (req, res) => {
  respond(res, await data.procurementPoShortageReports(req.user.userId));
});

router.get('/:id', async (req, res) => {
  respond(res, await data.procurementPoDetail(req.user.userId, Number(req.params.id)));
});

router.patch('/:id', async (req, res) => {
  respond(res, await data.procurementPoUpdate(req.user.userId, Number(req.params.id), req.body));
});

// Filled HTML template — desktop renders this to a real PDF via Electron's
// own webContents.printToPDF(); this endpoint just returns the markup.
router.get('/:id/pdf-html', async (req, res) => {
  respond(res, await data.procurementPoPdfHtml(req.user.userId, Number(req.params.id)));
});

// ── Close with Shortage (Procurement Exception Management Phase 3) ──────────
// Body: { reason, supplierExplanation }
router.post('/:id/close-shortage', async (req, res) => {
  const { reason, supplierExplanation } = req.body || {};
  respond(res, await data.procurementPoCloseWithShortage(req.user.userId, Number(req.params.id), reason, supplierExplanation));
});

// Body: { decision: 'approved'|'rejected', notes }
router.post('/:id/approve', async (req, res) => {
  const { decision, notes } = req.body || {};
  if (!decision) return res.status(400).json({ ok: false, error: '"decision" ("approved" or "rejected") is required' });
  respond(res, await data.procurementApprovalAction(req.user.userId, 'po', Number(req.params.id), decision, notes));
});

// ── Goods Receipt ────────────────────────────────────────────────────────────
// Body: { items: [{po_item_id, quantity_received, quantity_rejected, rejection_reason, notes}], notes }
router.post('/:id/receipts', async (req, res) => {
  respond(res, await data.procurementGoodsReceiptCreate(req.user.userId, Number(req.params.id), req.body));
});

module.exports = router;
