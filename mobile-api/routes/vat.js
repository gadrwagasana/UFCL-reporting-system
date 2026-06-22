'use strict';

const express     = require('express');
const data        = require('../../db/services/data');
const { respond } = require('../middleware/respond');

const router = express.Router();

// ── GET /api/vat/inbound ──────────────────────────────────────────────────────
// List stock transfers received at Nyanza workshop (warehouse_id = 4)
// that still have remaining capacity for VAT intake.
// Returns each transfer with intake_used so the UI can compute available.
// data.js: vatInboundList(userId)
//   Access: mustRole('value-added-timber') OR admin/ceo/operations/supervisor

router.get('/inbound', async (req, res) => {
  respond(res, await data.vatInboundList(req.user.userId));
});

// ── GET /api/vat ──────────────────────────────────────────────────────────────
// List value-added timber entries for the current user's workshop.
// data.js: valueAddedTimberList(userId, workshopId?)
//   Access: mustRole('value-added-timber') OR admin/ceo/operations/supervisor

router.get('/', async (req, res) => {
  respond(res, await data.valueAddedTimberList(req.user.userId));
});

// ── POST /api/vat ─────────────────────────────────────────────────────────────
// Record a VAT intake entry linked to an inbound stock transfer.
// Body:
//   Required: entry_date (YYYY-MM-DD), type_value_added, product_size, num_timber
//   Optional: source_transfer_id (link to inbound transfer for validation)
// data.js: valueAddedTimberCreate(userId, payload)
//   Validates: if source_transfer_id provided, num_timber ≤ available remaining
//   Side effects: refreshStockByWorkshop()

router.post('/', async (req, res) => {
  respond(res, await data.valueAddedTimberCreate(req.user.userId, req.body));
});

module.exports = router;
