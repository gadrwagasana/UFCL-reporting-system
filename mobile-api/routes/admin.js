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
    const result = await data.secGovDashboard(req.user.id);
    respond(res, result, 60);
  });

// ── Audit trail ───────────────────────────────────────────────────────────────
router.get('/audit',
  requireRoles('ceo', 'admin', 'operations'),
  async (req, res) => {
    const filters = {
      module:     req.query.module     || null,
      actionType: req.query.actionType || null,
      roleFilter: req.query.roleFilter || null,
      fromDate:   req.query.fromDate   || null,
      toDate:     req.query.toDate     || null,
      search:     req.query.search     || null,
      limit:      parseInt(req.query.limit || '500', 10),
    };
    const result = await data.auditList(req.user.id, filters);
    respond(res, result, 30);
  });

// ── Users ─────────────────────────────────────────────────────────────────────
router.get('/users',
  requireRoles('ceo', 'admin', 'operations'),
  async (req, res) => {
    const result = await data.usersList(req.user.id);
    respond(res, result, 0);
  });

router.post('/users',
  requireRoles('ceo', 'admin', 'operations'),
  async (req, res) => {
    const result = await data.usersCreate(req.user.id, req.body);
    respond(res, result);
  });

router.put('/users/:id',
  requireRoles('ceo', 'admin', 'operations'),
  async (req, res) => {
    const result = await data.usersUpdate(req.user.id, Number(req.params.id), req.body);
    respond(res, result);
  });

router.delete('/users/:id',
  requireRoles('ceo', 'admin', 'operations'),
  async (req, res) => {
    const result = await data.usersDelete(req.user.id, Number(req.params.id));
    respond(res, result);
  });

router.post('/users/:id/reset-password',
  requireRoles('ceo', 'admin', 'operations'),
  async (req, res) => {
    const result = await data.usersResetPassword(req.user.id, Number(req.params.id), req.body.newPassword);
    respond(res, result);
  });

// ── Roles ─────────────────────────────────────────────────────────────────────
router.get('/roles',
  requireRoles('ceo', 'admin'),
  async (req, res) => {
    const result = await data.rolesList(req.user.id);
    respond(res, result, 300);
  });

router.put('/roles/:role',
  requireRoles('ceo', 'admin'),
  async (req, res) => {
    const result = await data.rolesUpdate(req.user.id, req.params.role, req.body);
    respond(res, result);
  });

// ── Trash ─────────────────────────────────────────────────────────────────────
router.get('/trash',
  requireRoles('ceo', 'admin', 'operations'),
  async (req, res) => {
    const result = await data.trashList(req.user.id);
    respond(res, result, 0);
  });

router.post('/trash/restore',
  requireRoles('ceo', 'admin', 'operations'),
  async (req, res) => {
    const result = await data.trashRestore(req.user.id, req.body.tableName, req.body.recordId);
    respond(res, result);
  });

router.post('/trash/purge',
  requireRoles('ceo', 'admin'),
  async (req, res) => {
    const result = await data.trashPurge(req.user.id, req.body.tableName, req.body.recordId);
    respond(res, result);
  });

// ── Change requests ───────────────────────────────────────────────────────────
router.get('/changes',
  requireRoles(...ALL_ROLES),
  async (req, res) => {
    const result = await data.changesList(req.user.id);
    respond(res, result, 0);
  });

router.post('/changes',
  requireRoles(...ALL_ROLES),
  async (req, res) => {
    const result = await data.changesCreate(req.user.id, req.body);
    respond(res, result);
  });

router.put('/changes/:id',
  requireRoles('ceo', 'admin', 'operations', 'sales', 'finance', 'logistics'),
  async (req, res) => {
    const result = await data.changesReview(
      req.user.id,
      Number(req.params.id),
      req.body.status,
      req.body.response
    );
    respond(res, result);
  });

module.exports = router;
