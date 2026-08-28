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
// Mechanician Phase 2 — every role currently holding 'machines', 'machine-logs',
// or 'machine-maintenance' in role_definitions.permissions (verified live
// against the DB, not assumed). Deliberately NOT reusing MACHINE_ROLES above —
// that array is narrower than the DB's actual 'machines' grants (e.g. it
// excludes supervisor, who already holds 'machine-logs') and fixing that
// pre-existing mismatch is out of this phase's scope; this route gets its own
// accurate list rather than repeating the gap.
const MAINT_SCHEDULE_ROLES = ['admin', 'ceo', 'operations', 'logistics', 'supervisor', 'mechanician', 'sawmill-leader', 'poles-leader'];

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

// GET /api/machines/kpi-performance?month=YYYY-MM — monthly utilization/
// efficiency/downtime/KPI-achievement per machine. Static route, must come
// before /:id. Phase 1 Workshop parity fix — this desktop-only NAV page had
// no mobile screen at all.
router.get('/kpi-performance', requireRoles(...MACHINE_ROLES), async (req, res) => {
  const result = await data.machineKpiPerformance(req.user.userId, req.query.month || null);
  if (!result.ok) return respond(res, result);
  // Postgres returns ::numeric columns as strings — normalize to real
  // numbers here, matching every other mobile-api route's convention.
  respond(res, {
    ok: true,
    month: result.month,
    rows: (result.rows || []).map((r) => ({
      machine_id: r.machine_id, machine_code: r.machine_code, machine_name: r.machine_name,
      category_name: r.category_name, production_capacity: Number(r.production_capacity || 0),
      capacity_unit: r.capacity_unit, status: r.status,
      days_logged: Number(r.days_logged || 0),
      total_hours_worked: Number(r.total_hours_worked || 0),
      total_downtime: Number(r.total_downtime || 0),
      total_fuel: Number(r.total_fuel || 0),
      total_production: Number(r.total_production || 0),
      total_capacity: Number(r.total_capacity || 0),
      total_logs_loaded: Number(r.total_logs_loaded || 0),
      total_logs_unloaded: Number(r.total_logs_unloaded || 0),
      total_trips: Number(r.total_trips || 0),
      utilization_pct: Number(r.utilization_pct || 0),
      efficiency_pct: Number(r.efficiency_pct || 0),
      avgAchievement: r.avgAchievement == null ? null : Number(r.avgAchievement),
      kpiResults: (r.kpiResults || []).map((k) => ({
        machine_id: k.machine_id, kpi_id: k.kpi_id, target_value: Number(k.target_value || 0),
        kpi_code: k.kpi_code, kpi_name: k.kpi_name, unit: k.unit, higher_is_better: !!k.higher_is_better,
        actual: k.actual == null ? null : Number(k.actual),
        achievement: k.achievement == null ? null : Number(k.achievement),
      })),
    })),
  }, 60);
});

// GET /api/machines/maintenance-schedules — cross-machine Maintenance Schedule
// list (Mechanician Phase 2, Priority 3). Static route, must come before /:id.
// Workshop-scoped inside data.machineMaintScheduleListAll for restricted users.
router.get('/maintenance-schedules', requireRoles(...MAINT_SCHEDULE_ROLES), async (req, res) => {
  respond(res, await data.machineMaintScheduleListAll(req.user.userId, req.query.workshopId || null), 30);
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

// DELETE /api/machines/:id — archive (soft-deactivate) a machine (governance
// passthrough, same shape as PUT above). Stabilization Phase 5 (F-19) —
// machinesDelete had no mobile route at all before this.
router.delete('/:id', requireRoles(...REGISTER_ROLES), async (req, res) => {
  const result = await data.machinesDelete(req.user.userId, Number(req.params.id));
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

// PUT/DELETE /api/machines/maint-schedules/:schedId — ERP Final Enterprise
// Completion Gate — real gap found: desktop has had full edit/delete for
// maintenance schedule entries all along; mobile could list and create but
// never edit or delete one. machineMaintScheduleUpdate/Delete already carry
// their own Workshop Isolation checks (data.js), so no gate needed here
// beyond the existing REGISTER_ROLES used for Create/List above.
router.put('/maint-schedules/:schedId', requireRoles(...REGISTER_ROLES), async (req, res) => {
  respond(res, await data.machineMaintScheduleUpdate(req.user.userId, Number(req.params.schedId), req.body));
});

router.delete('/maint-schedules/:schedId', requireRoles(...REGISTER_ROLES), async (req, res) => {
  respond(res, await data.machineMaintScheduleDelete(req.user.userId, Number(req.params.schedId)));
});

module.exports = router;
