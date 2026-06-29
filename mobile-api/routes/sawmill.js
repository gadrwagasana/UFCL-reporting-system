'use strict';

const express      = require('express');
const data         = require('../../db/services/data');
const { respond }  = require('../middleware/respond');

const router = express.Router();

// ── GET /api/sawmill ──────────────────────────────────────────────────────────
// List sawmill daily production logs for the caller's workshop.
// Query params: workshopId? (ignored for workshop-restricted roles)
// data.js: dailyList(userId, workshopId?)
//   Requires: daily or daily-timber page (supervisor, sawmill-leader, operations, admin, ceo)
//   Workshop isolation: YES — isWorkshopRestricted applied inside function

router.get('/', async (req, res) => {
  respond(res, await data.dailyList(req.user.userId, req.user.workshopId || null));
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

module.exports = router;
