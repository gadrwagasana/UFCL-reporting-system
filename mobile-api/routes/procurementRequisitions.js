'use strict';

const express      = require('express');
const data         = require('../../db/services/data');
const { respond }  = require('../middleware/respond');

const router = express.Router();

// ── Dashboard / Reports / Analytics / Config ────────────────────────────────
// Declared before the /:id routes below — otherwise Express would match
// "/meta" against ":id" (since routes match in declaration order) and these
// would never be reached.
router.get('/meta/dashboard', async (req, res) => {
  respond(res, await data.procurementDashboard(req.user.userId));
});
router.get('/meta/reports/spend-analysis', async (req, res) => {
  respond(res, await data.procurementReportSpendAnalysis(req.user.userId));
});
router.get('/meta/reports/supplier-performance', async (req, res) => {
  respond(res, await data.procurementReportSupplierPerformance(req.user.userId));
});
router.get('/meta/reports/delivery-performance', async (req, res) => {
  respond(res, await data.procurementReportDeliveryPerformance(req.user.userId));
});
router.get('/meta/reports/budget-utilization', async (req, res) => {
  respond(res, await data.procurementReportBudgetUtilization(req.user.userId));
});
router.get('/meta/reports/revisions', async (req, res) => {
  respond(res, await data.procurementRequisitionRevisionReports(req.user.userId));
});
router.get('/meta/analytics', async (req, res) => {
  respond(res, await data.procurementAnalytics(req.user.userId));
});

// Phase 5A — Executive Procurement Dashboard (Procurement Analytics & Forecasting)
router.get('/meta/executive-dashboard', async (req, res) => {
  respond(res, await data.procurementExecutiveDashboard(req.user.userId));
});

// Phase 5B — Spend & Budget Analytics
router.get('/meta/spend-budget-analytics', async (req, res) => {
  respond(res, await data.procurementSpendBudgetAnalytics(req.user.userId));
});

// Phase 5C + 5D — Procurement Forecasting & Executive Reporting
router.get('/meta/forecasting-dashboard', async (req, res) => {
  respond(res, await data.procurementForecastingDashboard(req.user.userId));
});
router.get('/meta/executive-reports/:reportType', async (req, res) => {
  respond(res, await data.procurementExecutiveReport(req.user.userId, req.params.reportType, req.query));
});

// ── Supplier Intelligence — Phase 3C. Thin wrappers only; every calculation
// lives in data.js's Supplier Intelligence Engine (single source of truth
// shared with the Electron IPC layer). ─────────────────────────────────────
router.get('/meta/intelligence/dashboard', async (req, res) => {
  respond(res, await data.supplierIntelligenceDashboard(req.user.userId, req.query));
});
router.get('/meta/intelligence/profile/:supplierId', async (req, res) => {
  respond(res, await data.procurementSupplierIntelligenceProfile(req.user.userId, Number(req.params.supplierId)));
});
router.post('/meta/intelligence/compare', async (req, res) => {
  respond(res, await data.procurementSupplierComparison(req.user.userId, req.body?.supplierIds));
});
router.get('/meta/intelligence/reports/:reportType', async (req, res) => {
  respond(res, await data.procurementSupplierIntelligenceReports(req.user.userId, req.params.reportType, req.query));
});

router.get('/meta/config', async (req, res) => {
  respond(res, await data.procurementConfigGet(req.user.userId));
});
router.patch('/meta/config', async (req, res) => {
  respond(res, await data.procurementConfigUpdate(req.user.userId, req.body?.ceoThreshold));
});

// Phase 6 — Procurement Automation Engine (workflow automation, reminders,
// escalations, Task Center). Thin wrappers only — all logic lives in data.js.
router.get('/meta/automation/dashboard', async (req, res) => {
  respond(res, await data.procurementAutomationDashboard(req.user.userId));
});
router.get('/meta/automation/tasks', async (req, res) => {
  respond(res, await data.procurementTasksList(req.user.userId, req.query));
});
router.patch('/meta/automation/tasks/:taskId/complete', async (req, res) => {
  respond(res, await data.procurementTaskComplete(req.user.userId, Number(req.params.taskId)));
});
// Reuses the existing generic escalations engine/UI backend (getEscalations/
// resolveEscalation), already extended in data.js to recognize procurement
// entity types and roles — no separate procurement escalations endpoint.
router.get('/meta/automation/escalations', async (req, res) => {
  respond(res, await data.getEscalations(req.user.userId, req.query));
});
router.post('/meta/automation/escalations/:escalationId/resolve', async (req, res) => {
  respond(res, await data.resolveEscalation(req.user.userId, Number(req.params.escalationId), req.body?.reason));
});

// Phase 7 — Procurement Performance Management. Thin wrappers only — every
// KPI/ranking/benchmark calculation lives in data.js, composed from the
// existing Analytics/Forecasting/Supplier Intelligence/Automation engines.
router.get('/meta/performance/scorecard', async (req, res) => {
  respond(res, await data.procurementPerformanceScorecard(req.user.userId));
});
router.get('/meta/performance/buyers', async (req, res) => {
  respond(res, await data.procurementBuyerPerformance(req.user.userId));
});
router.get('/meta/performance/departments', async (req, res) => {
  respond(res, await data.procurementDepartmentPerformance(req.user.userId));
});
router.get('/meta/performance/workshops', async (req, res) => {
  respond(res, await data.procurementWorkshopPerformance(req.user.userId));
});
router.get('/meta/performance/executive-dashboard', async (req, res) => {
  respond(res, await data.procurementExecutivePerformanceDashboard(req.user.userId));
});
router.get('/meta/performance/benchmark', async (req, res) => {
  respond(res, await data.procurementBenchmark(req.user.userId, req.query));
});
router.get('/meta/performance/risk', async (req, res) => {
  respond(res, await data.procurementRiskMonitor(req.user.userId));
});

// ── GET /api/procurement/requisitions ───────────────────────────────────────
router.get('/', async (req, res) => {
  respond(res, await data.procurementRequisitionsList(req.user.userId, req.query));
});

// ── POST /api/procurement/requisitions ──────────────────────────────────────
router.post('/', async (req, res) => {
  respond(res, await data.procurementRequisitionCreate(req.user.userId, req.body));
});

// ── GET /api/procurement/requisitions/:id ───────────────────────────────────
router.get('/:id', async (req, res) => {
  respond(res, await data.procurementRequisitionDetail(req.user.userId, Number(req.params.id)));
});

// ── PATCH /api/procurement/requisitions/:id ─────────────────────────────────
router.patch('/:id', async (req, res) => {
  respond(res, await data.procurementRequisitionUpdate(req.user.userId, Number(req.params.id), req.body));
});

// ── POST /api/procurement/requisitions/:id/submit ───────────────────────────
router.post('/:id/submit', async (req, res) => {
  respond(res, await data.procurementRequisitionSubmit(req.user.userId, Number(req.params.id)));
});

// ── POST /api/procurement/requisitions/:id/cancel ───────────────────────────
router.post('/:id/cancel', async (req, res) => {
  respond(res, await data.procurementRequisitionCancel(req.user.userId, Number(req.params.id), req.body?.reason));
});

// ── POST /api/procurement/requisitions/:id/approve ──────────────────────────
// Body: { decision: 'approved'|'rejected', notes }
// Advances the current pending stage of the requisition's approval chain —
// see data.procurementApprovalAction for the generic multi-stage dispatcher
// (also reused by invoices/payments).
router.post('/:id/approve', async (req, res) => {
  const { decision, notes } = req.body || {};
  if (!decision) return res.status(400).json({ ok: false, error: '"decision" ("approved" or "rejected") is required' });
  respond(res, await data.procurementApprovalAction(req.user.userId, 'requisition', Number(req.params.id), decision, notes));
});

module.exports = router;
