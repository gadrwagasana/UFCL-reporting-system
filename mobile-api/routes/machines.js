'use strict';

const express          = require('express');
const data             = require('../../db/services/data');
const { requireRoles } = require('../middleware/authorize');
const { respond }      = require('../middleware/respond');

const router = express.Router();

// Roles with 'machines' in ROLE_PAGES: admin, ceo, operations, logistics
const MACHINE_ROLES    = ['admin', 'ceo', 'operations', 'logistics'];
// Roles that can register/edit machines (canRegister in desktop)
const REGISTER_ROLES   = ['admin', 'ceo', 'logistics'];
// Roles that can manage categories (canManageCats in desktop)
const CAT_ROLES        = ['admin', 'ceo', 'operations', 'logistics'];

// ── Categories — static routes must come before /:id ──────────────────────────

// GET /api/machines/categories — list of machine categories.
// Accessible to all roles that can view machines.
router.get('/categories', requireRoles(...MACHINE_ROLES), async (req, res) => {
  respond(res, await data.machineCategoriesList(req.user.userId), 300);
});

// POST /api/machines/categories — create a category.
router.post('/categories', requireRoles(...CAT_ROLES), async (req, res) => {
  respond(res, await data.machineCategoriesCreate(req.user.userId, req.body));
});

// PUT /api/machines/categories/:catId — update a category.
router.put('/categories/:catId', requireRoles(...CAT_ROLES), async (req, res) => {
  respond(res, await data.machineCategoriesUpdate(req.user.userId, Number(req.params.catId), req.body));
});

// DELETE /api/machines/categories/:catId — delete a category (blocked if machines use it).
router.delete('/categories/:catId', requireRoles(...CAT_ROLES), async (req, res) => {
  respond(res, await data.machineCategoriesDelete(req.user.userId, Number(req.params.catId)));
});

// ── Machine registry ──────────────────────────────────────────────────────────

// GET /api/machines — full registry with server-computed metrics.
// Returns: { machines, categories, workshops, metrics }
// categories + workshops are included for the create/edit form (avoids a separate round-trip).
router.get('/', requireRoles(...MACHINE_ROLES), async (req, res) => {
  const result = await data.machinesList(req.user.userId);
  if (!result.ok) return respond(res, result);
  const machines = result.rows || [];
  const metrics = {
    total:     machines.length,
    available: machines.filter(m => m.status === 'Available').length,
    running:   machines.filter(m => m.status === 'Running').length,
    offline:   machines.filter(m => m.status === 'Maintenance' || m.status === 'Breakdown').length,
  };
  respond(res, {
    ok:         true,
    machines,
    categories: result.categories || [],
    workshops:  result.workshops  || [],
    metrics,
  }, 30);
});

// GET /api/machines/:id — aggregate: machine row + maintenance schedules (parallel).
router.get('/:id', requireRoles(...MACHINE_ROLES), async (req, res) => {
  const machineId = Number(req.params.id);
  const [listResult, schedResult] = await Promise.all([
    data.machinesList(req.user.userId),
    data.machineMaintScheduleList(req.user.userId, machineId),
  ]);
  if (!listResult.ok) return respond(res, listResult);
  const machine = (listResult.rows || []).find(m => m.id === machineId);
  if (!machine) return respond(res, { ok: false, error: 'Machine not found' });
  respond(res, {
    ok:        true,
    machine,
    schedules: schedResult.ok ? (schedResult.rows || []) : [],
  }, 30);
});

// POST /api/machines — register a new machine.
router.post('/', requireRoles(...REGISTER_ROLES), async (req, res) => {
  respond(res, await data.machinesCreate(req.user.userId, req.body));
});

// PUT /api/machines/:id — edit a machine (governance passthrough).
router.put('/:id', requireRoles(...REGISTER_ROLES), async (req, res) => {
  const result = await data.machinesUpdate(req.user.userId, Number(req.params.id), req.body);
  if (!result.ok && result.pendingApproval) {
    return respond(res, { ok: true, pendingApproval: true, level: result.level, message: result.message });
  }
  respond(res, result);
});

// POST /api/machines/:id/maint-schedules — add a maintenance schedule entry.
router.post('/:id/maint-schedules', requireRoles(...REGISTER_ROLES), async (req, res) => {
  respond(res, await data.machineMaintScheduleCreate(req.user.userId, {
    ...req.body,
    machine_id: Number(req.params.id),
  }));
});

module.exports = router;
