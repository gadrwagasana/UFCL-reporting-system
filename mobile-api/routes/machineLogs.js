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

// ── PUT /api/machine-logs/:id ─────────────────────────────────────────────────
// Edit a machine daily shift log entry.
// data.js: machineLogsUpdate(userId, logId, payload) — governed (applyGovernance)
// Remediation Phase 3 — desktop already had edit/delete for this record type
// (same class as Vehicle Fuel/Maintenance and Machine Fuel Logs, all field
// data-entry corrected same-day); mobile had create/list only. A pending-
// approval response is passed through as ok:true, same convention already
// established in fuel.js/casualLabour.js/logTransport.js.
router.put('/:id', async (req, res) => {
  const result = await data.machineLogsUpdate(req.user.userId, Number(req.params.id), req.body);
  if (!result.ok && result.pendingApproval) {
    return respond(res, { ok: true, pendingApproval: true, level: result.level, message: result.message });
  }
  respond(res, result);
});

// ── DELETE /api/machine-logs/:id ──────────────────────────────────────────────
// data.js: machineLogsDelete(userId, logId, reason) — governed
router.delete('/:id', async (req, res) => {
  const result = await data.machineLogsDelete(req.user.userId, Number(req.params.id), req.body?.reason);
  if (!result.ok && result.pendingApproval) {
    return respond(res, { ok: true, pendingApproval: true, level: result.level, message: result.message });
  }
  respond(res, result);
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
