'use strict';

const express          = require('express');
const data             = require('../../db/services/data');
const { respond }      = require('../middleware/respond');

const router = express.Router();

// ── GET /api/machine-logs ─────────────────────────────────────────────────────
// List machine daily shift logs with fuel reconciliation.
// Query params: machineId?, month? (YYYY-MM)
// data.js: machineLogsList(userId, machineId?, month?, workshopId?)
//   Requires: machine-logs or machines page
//   (supervisor and operations have machine-logs via 'daily' token expansion)

router.get('/', async (req, res) => {
  const { machineId, month } = req.query;
  respond(res, await data.machineLogsList(
    req.user.userId,
    machineId ? Number(machineId) : null,
    month || null,
    null  // workshopId — data.js derives from user if workshop-restricted
  ));
});

// ── POST /api/machine-logs ────────────────────────────────────────────────────
// Create a machine daily shift log entry.
// Body:
//   Required: machine_id, log_date (YYYY-MM-DD)
//   Optional: shift ("Full Day"|"AM"|"PM"), hours_worked, downtime_hours,
//             downtime_reason, fuel_consumed, daily_production, capacity_per_day,
//             product_type, item_category, logs_loaded, logs_unloaded,
//             loading_trips, remarks
// data.js: machineLogsCreate(userId, payload)
//   Requires: machine-logs or machines page
//   Workshop assignment: derived from the machine's own workshop_id, NOT the user's.
//   No user-level workshop isolation — machine location determines the log's workshop.

router.post('/', async (req, res) => {
  respond(res, await data.machineLogsCreate(req.user.userId, req.body));
});

// ── GET /api/machine-logs/fuel-issued ────────────────────────────────────────
// Look up fuel already issued to a machine on a given date.
// Used by the create form to pre-fill the fuel_consumed field.
// Query params: machineId (required), logDate (required, YYYY-MM-DD)
// data.js: machineFuelIssuedLookup(userId, machineId, logDate)

router.get('/fuel-issued', async (req, res) => {
  const { machineId, logDate } = req.query;
  if (!machineId || !logDate) {
    return res.status(400).json({ ok: false, error: 'machineId and logDate are required' });
  }
  respond(res, await data.machineFuelIssuedLookup(
    req.user.userId,
    Number(machineId),
    logDate
  ));
});

module.exports = router;
