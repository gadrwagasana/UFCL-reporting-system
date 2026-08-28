'use strict';

const express          = require('express');
const router           = express.Router();
const { requireRoles } = require('../middleware/authorize');
const { respond }      = require('../middleware/respond');
const data             = require('../../db/services/data');

const BI_ROLES = [
  'ceo', 'admin', 'operations', 'supervisor',
  'sawmill-leader',    'sawmill-supervisor',
  'harvesting-leader', 'harvesting-supervisor',
  'vat-leader',        'poles-leader',
  'storekeeper',       'storekeeper-assistant',
];

// ── Weekly cost vs budget ─────────────────────────────────────────────────────
router.get('/weekly-cost',
  requireRoles('ceo', 'operations', 'finance', 'admin'),
  async (req, res) => {
    const result = await data.weeklyCostReport(req.user.userId);
    respond(res, result, 60);
  });

// Save / update a weekly expense for a category
router.post('/weekly-expenses',
  requireRoles('ceo', 'finance', 'admin'),
  async (req, res) => {
    const result = await data.weeklyExpensesSave(req.user.userId, req.body);
    respond(res, result);
  });

// ── Weekly performance (production + cost categories) ─────────────────────────
router.get('/weekly-perf',
  requireRoles('ceo', 'operations', 'admin'),
  async (req, res) => {
    const result = await data.weeklyPerformanceReport(req.user.userId);
    respond(res, result, 60);
  });

// ── KPI budget targets ────────────────────────────────────────────────────────
router.get('/kpi',
  requireRoles('ceo', 'admin'),
  async (req, res) => {
    const result = await data.kpiBudgetsList(req.user.userId, req.query.month);
    respond(res, result, 60);
  });

// Bulk-save KPI budgets for a month
router.post('/kpi',
  requireRoles('ceo', 'admin'),
  async (req, res) => {
    const result = await data.kpiBudgetSave(req.user.userId, req.body);
    respond(res, result);
  });

// ── Executive dashboard ───────────────────────────────────────────────────────
router.get('/executive',
  requireRoles('ceo', 'operations', 'admin'),
  async (req, res) => {
    const result = await data.executiveDashboard(req.user.userId);
    respond(res, result, 60);
  });

// ── Business intelligence dashboard ──────────────────────────────────────────
router.get('/bi',
  requireRoles(...BI_ROLES),
  async (req, res) => {
    const result = await data.businessIntelligenceDashboard(req.user.userId);
    respond(res, result, 60);
  });

// ── Monthly dashboard ─────────────────────────────────────────────────────────
router.get('/monthly',
  requireRoles('ceo', 'finance', 'admin'),
  async (req, res) => {
    const result = await data.monthlyDashboard(req.user.userId, req.query.month);
    respond(res, result, 60);
  });

// CEO sign-off on monthly report
router.post('/monthly/approve',
  requireRoles('ceo'),
  async (req, res) => {
    const result = await data.monthlyApprove(req.user.userId, req.body.month);
    respond(res, result);
  });

module.exports = router;
