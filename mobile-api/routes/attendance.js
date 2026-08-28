'use strict';

const express          = require('express');
const data              = require('../../db/services/data');
const { requireRoles }  = require('../middleware/authorize');
const { respond }       = require('../middleware/respond');

const router = express.Router();

// HR Enterprise Phase 2 — Attendance's first REST exposure. Roles mirror
// data.js's own mustRole('attendance') fallback — the exact same set Phase 1
// established for the Casuals registry (admin/ceo/operations/supervisor).
const ATTENDANCE_ROLES = ['admin', 'ceo', 'operations', 'supervisor'];

// GET /api/attendance/roster?workshopId=&date= — checklist data source
router.get('/roster', requireRoles(...ATTENDANCE_ROLES), async (req, res) => {
  respond(res, await data.attendanceRoster(req.user.userId, req.query.workshopId, req.query.date));
});

// POST /api/attendance/mark — single upsert used by the checklist
router.post('/mark', requireRoles(...ATTENDANCE_ROLES), async (req, res) => {
  respond(res, await data.attendanceMark(req.user.userId, req.body));
});

// GET /api/attendance — list/history/report source, query-string filters
router.get('/', requireRoles(...ATTENDANCE_ROLES), async (req, res) => {
  respond(res, await data.attendanceList(req.user.userId, req.query));
});

// GET /api/attendance/dashboard?workshopId=
router.get('/dashboard', requireRoles(...ATTENDANCE_ROLES), async (req, res) => {
  respond(res, await data.attendanceDashboard(req.user.userId, req.query.workshopId));
});

// GET /api/attendance/report — same rows as list, plus a summary block
router.get('/report', requireRoles(...ATTENDANCE_ROLES), async (req, res) => {
  respond(res, await data.attendanceReport(req.user.userId, req.query));
});

// PUT /api/attendance/:id — correction
router.put('/:id', requireRoles(...ATTENDANCE_ROLES), async (req, res) => {
  respond(res, await data.attendanceUpdate(req.user.userId, Number(req.params.id), req.body));
});

// DELETE /api/attendance/:id — void (soft delete)
router.delete('/:id', requireRoles(...ATTENDANCE_ROLES), async (req, res) => {
  respond(res, await data.attendanceDelete(req.user.userId, Number(req.params.id), req.body?.reason));
});

module.exports = router;
