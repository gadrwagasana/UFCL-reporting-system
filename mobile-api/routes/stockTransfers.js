'use strict';

// Phase 2 — Stock Transfer lifecycle
// Routes defined and documented but returning 501 until Phase 2 is built.

const express          = require('express');
const data             = require('../../db/services/data');
const { respond }      = require('../middleware/respond');

const router = express.Router();
const PHASE2 = (_req, res) => res.status(501).json({ ok: false, error: 'Phase 2 — not yet implemented' });

// ── GET /api/stock-transfers ──────────────────────────────────────────────────
// List stock transfers (filtered by workshop for restricted roles).
// data.js: stockTransfersList(userId, workshopId?)
//   Requires: stock-transfers page

router.get('/', PHASE2);

// ── POST /api/stock-transfers/:id/approve ────────────────────────────────────
// Approve or reject a pending stock transfer.
// Body: { action: "approve"|"reject", rejectionReason? }
// data.js: stockTransfersApproveReject(userId, transferId, action, rejectionReason)
//   Requires role: admin|ceo|operations|logistics

router.post('/:id/approve', PHASE2);

// ── POST /api/stock-transfers/:id/dispatch ───────────────────────────────────
// Dispatch a quantity from the source warehouse on a vehicle.
// Body: { qty, vehicle_id, driver_name, dispatched_at?, reference?, notes? }
// data.js: stockTransfersDispatch(userId, transferId, payload)
//   Requires role: admin|ceo|operations|logistics|supervisor|storekeeper
//   Side effects: deducts stock_levels at source warehouse, creates stock_movement
//   Uses DB transaction with row-level locking (skip locked).

router.post('/:id/dispatch', PHASE2);

// ── POST /api/stock-transfers/:id/receive ────────────────────────────────────
// Confirm receipt of a qty at the destination warehouse.
// Body: { qty, notes? }
// data.js: stockTransfersReceive(userId, transferId, qty, notes)
//   Requires role: admin|ceo|operations|logistics|supervisor|storekeeper
//   Side effects: increments stock_levels at destination, status → completed or partially_received
//   Uses DB transaction.

router.post('/:id/receive', PHASE2);

// ── GET /api/stock-transfers/:id/history ─────────────────────────────────────
// Dispatch history for a specific transfer.
// data.js: stockTransfersDispatchHistory(userId, transferId)

router.get('/:id/history', PHASE2);

module.exports = router;
