'use strict';

const express          = require('express');
const data             = require('../../db/services/data');
const { respond }      = require('../middleware/respond');

const router = express.Router();

// ── GET /api/log-transport ────────────────────────────────────────────────────
// List log transport entries + totals (harvested vs transported vs remaining).
// data.js: logTransportList(userId, workshopId?)
//   Requires: log-transport page or role in [admin,ceo,operations,logistics,supervisor]
//   Workshop isolation: YES — isWorkshopRestricted applied inside function

router.get('/', async (req, res) => {
  respond(res, await data.logTransportList(req.user.userId));
});

// ── POST /api/log-transport ───────────────────────────────────────────────────
// Record a log transport trip from forest to sawmill.
// Body:
//   Required: transport_date (YYYY-MM-DD), qty_transported
//   Optional: unit (default "logs"), compt_id, sub_name,
//             tractor_plate, loggers_number, notes
// data.js: logTransportCreate(userId, payload)
//   Requires: log-transport page or role list (supervisor included)
//   Workshop isolation: YES — workshopId auto-set from user if workshop-restricted

router.post('/', async (req, res) => {
  respond(res, await data.logTransportCreate(req.user.userId, req.body));
});

// ── PUT /api/log-transport/:id ────────────────────────────────────────────────
// Edit a log transport entry.
// data.js: logTransportUpdate(userId, id, payload) — fully governed via
// applyGovernance (same as delete below); a pending-approval response is
// passed through as ok:true, same convention as fuel.js's governed routes.
// Remediation Phase 2 — this route (and all mobile UI for it) didn't exist;
// desktop already had logTransportUpdate wired via IPC with no caller of
// its own until this same phase added one.
router.put('/:id', async (req, res) => {
  const result = await data.logTransportUpdate(req.user.userId, Number(req.params.id), req.body);
  if (!result.ok && result.pendingApproval) {
    return respond(res, { ok: true, pendingApproval: true, level: result.level, message: result.message });
  }
  respond(res, result);
});

// ── DELETE /api/log-transport/:id ─────────────────────────────────────────────
// ERP Final Enterprise Completion Gate — real gap found: desktop has had full
// Create/Read/Update/Delete for this entity all along; mobile had Create/
// Read/Update only, with no route, endpoint, or UI action for Delete at all.
// data.js: logTransportDelete(userId, id, reason) — fully governed via
// applyGovernance, same pending-approval passthrough convention as PUT above.
router.delete('/:id', async (req, res) => {
  const result = await data.logTransportDelete(req.user.userId, Number(req.params.id), req.body?.reason);
  if (!result.ok && result.pendingApproval) {
    return respond(res, { ok: true, pendingApproval: true, level: result.level, message: result.message });
  }
  respond(res, result);
});

module.exports = router;
