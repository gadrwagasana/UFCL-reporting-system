'use strict';

// Phase 2 — Dispatch request review (logistics / operations)
// Routes defined but returning 501 until Phase 2 is built.

const express = require('express');
const data    = require('../../db/services/data');
const { respond } = require('../middleware/respond');

const router = express.Router();
const PHASE2 = (_req, res) => res.status(501).json({ ok: false, error: 'Phase 2 — not yet implemented' });

// ── GET /api/dispatch ─────────────────────────────────────────────────────────
// List dispatch requests + pending delivery orders awaiting dispatch.
// data.js: dispatchList(userId)
//   Requires: dispatch page (admin, ceo, logistics)
//   NOTE: operations lacks 'dispatch' page by default (Gap D — do not fix).

router.get('/', PHASE2);

// ── POST /api/dispatch/:id/review ────────────────────────────────────────────
// Approve, reject, or mark a dispatch request as dispatched.
// Body: { status: "Approved"|"Rejected"|"Dispatched", notes? }
// data.js: dispatchReview(userId, requestId, status, notes)
//   Role check (direct): admin|ceo|logistics|operations
//   When status = "Dispatched":
//     - Sets delivery_order.status = 'In Transit'
//     - Sets sales_order.status = 'Dispatched'
//     - Triggers refreshStockView()

router.post('/:id/review', PHASE2);

module.exports = router;
