'use strict';

const express          = require('express');
const router           = express.Router();
const { requireRoles } = require('../middleware/authorize');
const { respond }      = require('../middleware/respond');
const data             = require('../../db/services/data');

// All roles that can submit / view change requests (data.js does the fine-grained check)
const ALL_ROLES = [
  'ceo', 'admin', 'operations', 'sales', 'finance', 'logistics',
  'supervisor', 'storekeeper', 'storekeeper-assistant', 'mechanician',
  'harvesting-leader', 'sawmill-leader', 'poles-leader', 'vat-leader',
  'harvesting-supervisor', 'sawmill-supervisor', 'poles-supervisor', 'vat-supervisor',
  'sales-staff', 'showroom-staff', 'logistics-officer',
];

// ── Security & Governance dashboard ──────────────────────────────────────────
router.get('/secgov',
  requireRoles('ceo', 'admin', 'operations'),
  async (req, res) => {
    const result = await data.secGovDashboard(req.user.userId);
    respond(res, result, 60);
  });

// ── Audit trail ───────────────────────────────────────────────────────────────
// Phase C6 (NF-01 remediation) — this route's own role gate (ceo/admin/
// operations) already predates this phase and is narrower than desktop's
// permission-based gate (mustRole(user,'audit'), held by many more, often
// workshop-scoped, roles) — every role this route admits is already
// workshop-exempt per isWorkshopRestricted, so mobile was never actually
// exposed to the NF-01 leak in the first place. Left unchanged (broadening
// it to match desktop's wider role set would be a new capability decision,
// out of this security phase's scope) — only the filter surface is extended
// to match auditList's now-real search/sort/pagination/workshop capability.
router.get('/audit',
  requireRoles('ceo', 'admin', 'operations'),
  async (req, res) => {
    const filters = {
      module:         req.query.module     || null,
      actionType:     req.query.actionType || null,
      roleFilter:     req.query.roleFilter || null,
      fromDate:       req.query.fromDate   || null,
      toDate:         req.query.toDate     || null,
      search:         req.query.search     || null,
      sortBy:         req.query.sortBy     || null,
      sortDir:        req.query.sortDir    || null,
      page:           req.query.page       || null,
      pageSize:       req.query.pageSize   || null,
      workshopFilter: req.query.workshopFilter || null,
    };
    const result = await data.auditList(req.user.userId, filters);
    respond(res, result, 30);
  });

router.get('/audit/export',
  requireRoles('ceo', 'admin', 'operations'),
  async (req, res) => {
    const filters = {
      module: req.query.module || null, actionType: req.query.actionType || null,
      roleFilter: req.query.roleFilter || null, fromDate: req.query.fromDate || null,
      toDate: req.query.toDate || null, search: req.query.search || null,
      sortBy: req.query.sortBy || null, sortDir: req.query.sortDir || null,
      workshopFilter: req.query.workshopFilter || null,
    };
    const result = await data.auditExportExcel(req.user.userId, filters);
    if (!result.ok) return respond(res, result);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    res.send(Buffer.from(result.buffer));
  });

// ── Users ─────────────────────────────────────────────────────────────────────
router.get('/users',
  requireRoles('ceo', 'admin', 'operations'),
  async (req, res) => {
    const result = await data.usersList(req.user.userId);
    respond(res, result, 0);
  });

router.post('/users',
  requireRoles('ceo', 'admin', 'operations'),
  async (req, res) => {
    const result = await data.usersCreate(req.user.userId, req.body);
    respond(res, result);
  });

router.put('/users/:id',
  requireRoles('ceo', 'admin', 'operations'),
  async (req, res) => {
    const result = await data.usersUpdate(req.user.userId, Number(req.params.id), req.body);
    respond(res, result);
  });

router.delete('/users/:id',
  requireRoles('ceo', 'admin', 'operations'),
  async (req, res) => {
    const result = await data.usersDelete(req.user.userId, Number(req.params.id));
    respond(res, result);
  });

router.post('/users/:id/reset-password',
  requireRoles('ceo', 'admin', 'operations'),
  async (req, res) => {
    const result = await data.usersResetPassword(req.user.userId, Number(req.params.id), req.body.newPassword);
    respond(res, result);
  });

// ── Roles ─────────────────────────────────────────────────────────────────────
router.get('/roles',
  requireRoles('ceo', 'admin'),
  async (req, res) => {
    const result = await data.rolesList(req.user.userId);
    respond(res, result, 300);
  });

router.put('/roles/:role',
  requireRoles('ceo', 'admin'),
  async (req, res) => {
    const result = await data.rolesUpdate(req.user.userId, req.params.role, req.body);
    respond(res, result);
  });

// ── Trash ─────────────────────────────────────────────────────────────────────
router.get('/trash',
  requireRoles('ceo', 'admin', 'operations'),
  async (req, res) => {
    const result = await data.trashList(req.user.userId);
    respond(res, result, 0);
  });

router.post('/trash/restore',
  requireRoles('ceo', 'admin', 'operations'),
  async (req, res) => {
    const result = await data.trashRestore(req.user.userId, req.body.tableName, req.body.recordId);
    respond(res, result);
  });

router.post('/trash/purge',
  requireRoles('ceo', 'admin'),
  async (req, res) => {
    const result = await data.trashPurge(req.user.userId, req.body.tableName, req.body.recordId);
    respond(res, result);
  });

// ── Change requests ───────────────────────────────────────────────────────────
router.get('/changes',
  requireRoles(...ALL_ROLES),
  async (req, res) => {
    const result = await data.changesList(req.user.userId);
    respond(res, result, 0);
  });

router.post('/changes',
  requireRoles(...ALL_ROLES),
  async (req, res) => {
    const result = await data.changesCreate(req.user.userId, req.body);
    respond(res, result);
  });

router.put('/changes/:id',
  requireRoles('ceo', 'admin', 'operations', 'sales', 'finance', 'logistics'),
  async (req, res) => {
    const result = await data.changesReview(
      req.user.userId,
      Number(req.params.id),
      req.body.status,
      req.body.response
    );
    respond(res, result);
  });

module.exports = router;
