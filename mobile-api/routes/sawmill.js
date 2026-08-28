'use strict';

const express      = require('express');
const data         = require('../../db/services/data');
const { respond }  = require('../middleware/respond');

const router = express.Router();

// ── GET /api/sawmill ──────────────────────────────────────────────────────────
// List sawmill daily production logs for the caller's workshop.
// Query params: workshopId? (ignored for workshop-restricted roles),
//   date_from?, date_to? (YYYY-MM-DD), search? (supervisor/operators/machine),
//   limit?, offset? — Sawmill Phase 3 (Workstream 1), all optional/additive.
// data.js: dailyList(userId, workshopId?, filters?)
//   Requires: daily or daily-timber page (supervisor, sawmill-leader, operations, admin, ceo)
//   Workshop isolation: YES — isWorkshopRestricted applied inside function

router.get('/', async (req, res) => {
  const { date_from, date_to, search, limit, offset } = req.query;
  respond(res, await data.dailyList(req.user.userId, req.user.workshopId || null, { date_from, date_to, search, limit, offset }));
});

// ── POST /api/sawmill ─────────────────────────────────────────────────────────
// Create a sawmill daily production log entry.
// Body:
//   Required: log_date (YYYY-MM-DD)
//   Optional: machine, product_size, timber_units, timber_kiln_dried,
//             timber_cca_treated, timber_untreated, timber_waste,
//             poles_units, poles_waste, downtime_hours, downtime_reason,
//             supervisor, operators, remarks
// data.js: dailyCreate(userId, payload)
//   Requires: daily or daily-timber page
//   Workshop isolation: YES — workshopId auto-set from user if workshop-restricted

router.post('/', async (req, res) => {
  respond(res, await data.dailyCreate(req.user.userId, req.body));
});

// ── PUT /api/sawmill/:id — edit a production entry ────────────────────────────
// Sawmill Phase 1 (Workstream 3) — desktop has had Edit/Delete for this
// entity since the prior Sawmill Timber Entry redesign; mobile only had
// Create+Read until now. data.js dailyUpdate uses applyGovernance —
// passthrough as 200 success when pending, same convention as every other
// governed route in this app.
router.put('/:id', async (req, res) => {
  const result = await data.dailyUpdate(req.user.userId, Number(req.params.id), req.body);
  if (!result.ok && result.pendingApproval) {
    return respond(res, { ok: true, pendingApproval: true, level: result.level, message: result.message });
  }
  respond(res, result);
});

// ── DELETE /api/sawmill/:id — delete (soft) a production entry ───────────────
router.delete('/:id', async (req, res) => {
  const result = await data.dailyDelete(req.user.userId, Number(req.params.id), req.body?.reason);
  if (!result.ok && result.pendingApproval) {
    return respond(res, { ok: true, pendingApproval: true, level: result.level, message: result.message });
  }
  respond(res, result);
});

// ── GET /api/sawmill/dashboard — Sawmill Manager Dashboard ───────────────────
// Sawmill Phase 3 (Workstream 2 & 4). data.js: sawmillManagerDashboard(userId, workshopId?)
router.get('/dashboard', async (req, res) => {
  respond(res, await data.sawmillManagerDashboard(req.user.userId, req.user.workshopId || null), 60);
});

module.exports = router;
