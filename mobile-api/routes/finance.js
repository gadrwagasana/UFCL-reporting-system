'use strict';

const express          = require('express');
const data              = require('../../db/services/data');
const { requireRoles }  = require('../middleware/authorize');
const { respond }       = require('../middleware/respond');

const router = express.Router();

// Finance Enterprise Phase 2 — pure delegation to data.js, same convention as
// payroll.js. Roles mirror data.js's own FINANCE_ROLES fallback
// (admin/ceo/operations/finance); each function also re-checks
// _canAccessFinance internally (mustRole('finance-center') OR FINANCE_ROLES),
// so this route-level gate is a fast-fail, not the source of truth.
const FINANCE_ROLES = ['admin', 'ceo', 'operations', 'finance'];

// ── Dashboard ────────────────────────────────────────────────────────────────
router.get('/dashboard', requireRoles(...FINANCE_ROLES), async (req, res) => {
  respond(res, await data.financeDashboard(req.user.userId, req.query));
});

// ── AR / AP ──────────────────────────────────────────────────────────────────
router.get('/customer-outstanding', requireRoles(...FINANCE_ROLES), async (req, res) => {
  respond(res, await data.financeCustomerOutstanding(req.user.userId, req.query));
});
router.get('/supplier-outstanding', requireRoles(...FINANCE_ROLES), async (req, res) => {
  respond(res, await data.financeSupplierOutstanding(req.user.userId, req.query));
});

// ── Operations Center ────────────────────────────────────────────────────────
router.get('/operations', requireRoles(...FINANCE_ROLES), async (req, res) => {
  const filters = { ...req.query };
  if (req.query.source_modules) {
    filters.source_modules = Array.isArray(req.query.source_modules)
      ? req.query.source_modules
      : String(req.query.source_modules).split(',');
  }
  respond(res, await data.financeOperationsSearch(req.user.userId, filters));
});

// ── Approval Center — the queue only; decisions go through the shared engine ─
router.get('/approvals', requireRoles(...FINANCE_ROLES), async (req, res) => {
  respond(res, await data.financeApprovalQueue(req.user.userId, req.query));
});

// ── Cost reports ─────────────────────────────────────────────────────────────
router.get('/reports/workshop-cost', requireRoles(...FINANCE_ROLES), async (req, res) => {
  respond(res, await data.financeWorkshopCostSummary(req.user.userId, req.query));
});
router.get('/reports/department-cost', requireRoles(...FINANCE_ROLES), async (req, res) => {
  respond(res, await data.financeDepartmentCostSummary(req.user.userId, req.query));
});
router.get('/reports/approvals', requireRoles(...FINANCE_ROLES), async (req, res) => {
  respond(res, await data.financeApprovalReport(req.user.userId, req.query));
});
router.get('/reports/exceptions', requireRoles(...FINANCE_ROLES), async (req, res) => {
  respond(res, await data.financeExceptionReport(req.user.userId));
});
router.get('/reports/audit', requireRoles(...FINANCE_ROLES), async (req, res) => {
  respond(res, await data.financeAuditReport(req.user.userId, req.query));
});

// ── Traceability ─────────────────────────────────────────────────────────────
router.get('/trace/:sourceType/:sourceId', requireRoles(...FINANCE_ROLES), async (req, res) => {
  respond(res, await data.financeTransactionTrace(req.user.userId, req.params.sourceType, Number(req.params.sourceId)));
});

// ── Approval decisions — thin pass-through to the shared engine, same
// pattern procurementRequisitions.js's own /:id/approve route already uses,
// generalized across entity type since the Finance queue spans several
// (requisition/po/invoice/payment/payroll_period). No new approval logic.
router.post('/approvals/:entityType/:entityId/decide', requireRoles(...FINANCE_ROLES), async (req, res) => {
  const { decision, notes } = req.body || {};
  if (!decision) return res.status(400).json({ ok: false, error: '"decision" is required' });
  respond(res, await data.procurementApprovalAction(req.user.userId, req.params.entityType, Number(req.params.entityId), decision, notes));
});

// ── Configuration (read-only view) ──────────────────────────────────────────
router.get('/config', requireRoles(...FINANCE_ROLES), async (req, res) => {
  respond(res, await data.financeConfigView(req.user.userId));
});

// ── Sage export ──────────────────────────────────────────────────────────────
router.get('/sage-export/preview', requireRoles(...FINANCE_ROLES), async (req, res) => {
  respond(res, await data.financeSageExportPreview(req.user.userId, req.query));
});
router.get('/sage-export/history', requireRoles(...FINANCE_ROLES), async (req, res) => {
  respond(res, await data.financeSageExportHistory(req.user.userId, req.query));
});
// Binary response, same exception class as payroll.js's own /export/:reportType.
router.get('/sage-export/run', requireRoles(...FINANCE_ROLES), async (req, res) => {
  const result = await data.financeSageExportRun(req.user.userId, req.query);
  if (!result.ok) return res.status(400).json({ ok: false, error: { code: 'VALIDATION_ERROR', message: result.error } });
  res.set('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.set('Content-Disposition', `attachment; filename="${result.filename}"`);
  res.send(Buffer.from(result.buffer));
});

// ── Inventory Financial Control ─────────────────────────────────────────────
router.get('/inventory-overview', requireRoles(...FINANCE_ROLES), async (req, res) => {
  respond(res, await data.financeInventoryOverview(req.user.userId, req.query));
});
router.get('/stock-movements', requireRoles(...FINANCE_ROLES), async (req, res) => {
  respond(res, await data.financeStockMovements(req.user.userId, req.query));
});
router.get('/stock-variance', requireRoles(...FINANCE_ROLES), async (req, res) => {
  respond(res, await data.financeStockVarianceReport(req.user.userId, req.query));
});
router.get('/reports/inventory-adjustment', requireRoles(...FINANCE_ROLES), async (req, res) => {
  respond(res, await data.financeInventoryAdjustmentReport(req.user.userId, req.query));
});

// ── Stock Count & Reconciliation ─────────────────────────────────────────────
router.post('/stock-counts', requireRoles(...FINANCE_ROLES), async (req, res) => {
  respond(res, await data.financeStockCountCreate(req.user.userId, req.body));
});
router.get('/stock-counts', requireRoles(...FINANCE_ROLES), async (req, res) => {
  respond(res, await data.financeStockCountList(req.user.userId, req.query));
});
router.get('/stock-counts/:id', requireRoles(...FINANCE_ROLES), async (req, res) => {
  respond(res, await data.financeStockCountDetail(req.user.userId, Number(req.params.id)));
});
router.put('/stock-counts/:id/lines/:lineId', requireRoles(...FINANCE_ROLES), async (req, res) => {
  respond(res, await data.financeStockCountEnterCount(req.user.userId, Number(req.params.id), Number(req.params.lineId), req.body?.physicalQty, req.body?.notes));
});
router.post('/stock-counts/:id/submit-review', requireRoles(...FINANCE_ROLES), async (req, res) => {
  respond(res, await data.financeStockCountSubmitForReview(req.user.userId, Number(req.params.id)));
});
router.post('/stock-counts/:id/submit-adjustments', requireRoles(...FINANCE_ROLES), async (req, res) => {
  respond(res, await data.financeStockCountSubmitAdjustments(req.user.userId, Number(req.params.id), req.body?.reason));
});
router.post('/stock-counts/:id/cancel', requireRoles(...FINANCE_ROLES), async (req, res) => {
  respond(res, await data.financeStockCountCancel(req.user.userId, Number(req.params.id), req.body?.reason));
});

// ── Financial Exception Center ──────────────────────────────────────────────
router.post('/exceptions', requireRoles(...FINANCE_ROLES), async (req, res) => {
  respond(res, await data.financeExceptionCaseOpen(req.user.userId, req.body));
});
router.get('/exceptions', requireRoles(...FINANCE_ROLES), async (req, res) => {
  respond(res, await data.financeExceptionCaseList(req.user.userId, req.query));
});
router.get('/exceptions/:id', requireRoles(...FINANCE_ROLES), async (req, res) => {
  respond(res, await data.financeExceptionCaseDetail(req.user.userId, Number(req.params.id)));
});
router.post('/exceptions/:id/comments', requireRoles(...FINANCE_ROLES), async (req, res) => {
  respond(res, await data.financeExceptionCaseComment(req.user.userId, Number(req.params.id), req.body?.comment));
});
router.post('/exceptions/:id/resolve', requireRoles(...FINANCE_ROLES), async (req, res) => {
  respond(res, await data.financeExceptionCaseResolve(req.user.userId, Number(req.params.id), req.body?.resolutionNotes));
});
router.post('/exceptions/:id/close', requireRoles(...FINANCE_ROLES), async (req, res) => {
  respond(res, await data.financeExceptionCaseClose(req.user.userId, Number(req.params.id)));
});

// ── Department Finance Control ──────────────────────────────────────────────
router.get('/production-control', requireRoles(...FINANCE_ROLES), async (req, res) => {
  respond(res, await data.financeProductionControl(req.user.userId, req.query.workshopId ? Number(req.query.workshopId) : null));
});
router.get('/maintenance-control', requireRoles(...FINANCE_ROLES), async (req, res) => {
  respond(res, await data.financeMaintenanceControl(req.user.userId));
});
router.get('/customers/:id', requireRoles(...FINANCE_ROLES), async (req, res) => {
  respond(res, await data.financeCustomerFinancialProfile(req.user.userId, Number(req.params.id)));
});
router.get('/suppliers/:id', requireRoles(...FINANCE_ROLES), async (req, res) => {
  respond(res, await data.financeSupplierFinancialProfile(req.user.userId, Number(req.params.id)));
});

module.exports = router;
