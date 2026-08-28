'use strict';

const express          = require('express');
const data             = require('../../db/services/data');
const { requireRoles } = require('../middleware/authorize');
const { respond }      = require('../middleware/respond');

const router = express.Router();

// Mirrors exactly who holds 'maintenance-jobs' in role_definitions.permissions
// (verified live in db/migrate.js's grantMaintenanceJobsPermissions before
// writing this list — not assumed, same discipline as MAINT_SCHEDULE_ROLES
// in machines.js).
const JOB_ROLES = ['admin', 'ceo', 'operations', 'logistics', 'supervisor', 'mechanician', 'sawmill-leader', 'poles-leader'];
// Company-wide "Mechanician Officer" capability — logistics/admin/ceo only.
const OVERSIGHT_ROLES = ['admin', 'ceo', 'logistics'];

// ── GET /api/maintenance-jobs/officer-dashboard — static route, before /:id ────
router.get('/officer-dashboard', requireRoles(...OVERSIGHT_ROLES), async (req, res) => {
  respond(res, await data.maintenanceOfficerDashboard(req.user.userId), 30);
});

// ── GET /api/maintenance-jobs/reports?from=&to= ─────────────────────────────────
router.get('/reports', requireRoles(...OVERSIGHT_ROLES), async (req, res) => {
  respond(res, await data.maintenanceReports(req.user.userId, { from: req.query.from, to: req.query.to }));
});

// ── POST /api/maintenance-jobs/production-impact ────────────────────────────────
router.post('/production-impact', requireRoles(...JOB_ROLES), async (req, res) => {
  respond(res, await data.maintenanceProductionImpactCreate(req.user.userId, req.body));
});

// ── GET /api/maintenance-jobs/waiting-for-parts — Phase 4, static route ─────────
router.get('/waiting-for-parts', requireRoles(...JOB_ROLES), async (req, res) => {
  respond(res, await data.maintenanceWaitingForPartsList(req.user.userId), 20);
});

// ── GET /api/maintenance-jobs/asset-summary/:machineId — Phase 4, static route ──
router.get('/asset-summary/:machineId', requireRoles(...JOB_ROLES), async (req, res) => {
  respond(res, await data.maintenanceAssetSummary(req.user.userId, Number(req.params.machineId)), 20);
});

// ── GET /api/maintenance-jobs ────────────────────────────────────────────────────
router.get('/', requireRoles(...JOB_ROLES), async (req, res) => {
  respond(res, await data.maintenanceJobsList(req.user.userId, {
    status: req.query.status || null,
    machineId: req.query.machineId || null,
    assignedTo: req.query.assignedTo || null,
  }), 30);
});

// ── POST /api/maintenance-jobs ───────────────────────────────────────────────────
router.post('/', requireRoles(...JOB_ROLES), async (req, res) => {
  respond(res, await data.maintenanceJobCreate(req.user.userId, req.body));
});

// ── GET /api/maintenance-jobs/:id ────────────────────────────────────────────────
router.get('/:id', requireRoles(...JOB_ROLES), async (req, res) => {
  respond(res, await data.maintenanceJobDetail(req.user.userId, Number(req.params.id)), 15);
});

// ── POST /api/maintenance-jobs/:id/assign ────────────────────────────────────────
router.post('/:id/assign', requireRoles(...JOB_ROLES), async (req, res) => {
  const { technicianId } = req.body || {};
  if (!technicianId) return res.status(400).json({ ok: false, error: 'technicianId is required' });
  respond(res, await data.maintenanceJobAssign(req.user.userId, Number(req.params.id), Number(technicianId)));
});

// ── POST /api/maintenance-jobs/:id/transition ────────────────────────────────────
// Body: { action: 'diagnose'|'start'|'request_parts'|'resume'|'send_external'|
//                  'return_external'|'test'|'return_to_service'|'close'|'cancel',
//         ...payload }
router.post('/:id/transition', requireRoles(...JOB_ROLES), async (req, res) => {
  const { action, ...payload } = req.body || {};
  if (!action) return res.status(400).json({ ok: false, error: 'action is required' });
  respond(res, await data.maintenanceJobTransition(req.user.userId, Number(req.params.id), action, payload));
});

// ── POST /api/maintenance-jobs/:id/labour ────────────────────────────────────────
router.post('/:id/labour', requireRoles(...JOB_ROLES), async (req, res) => {
  respond(res, await data.maintenanceJobLabourAdd(req.user.userId, Number(req.params.id), req.body));
});

module.exports = router;
