'use strict';

const express          = require('express');
const data              = require('../../db/services/data');
const { requireRoles }  = require('../middleware/authorize');
const { respond }       = require('../middleware/respond');

const router = express.Router();

// Payroll Enterprise Phase 2 — pure delegation to data.js, same convention as
// every other route file. Roles mirror data.js's own mustRole('payroll')
// fallback (admin/ceo/operations/supervisor). The approval endpoint below
// deliberately has NO role gate at the route level — data.procurementApprovalAction
// enforces the exact per-stage assigned_role itself (operations/ceo), the
// same pattern procurementRequisitions.js's own /:id/approve route already
// uses for the shared engine.
const PAYROLL_ROLES = ['admin', 'ceo', 'operations', 'supervisor'];

// ── Rates ────────────────────────────────────────────────────────────────────
router.post('/rates', requireRoles(...PAYROLL_ROLES), async (req, res) => {
  respond(res, await data.payrollRateSet(req.user.userId, req.body));
});
router.get('/rates', requireRoles(...PAYROLL_ROLES), async (req, res) => {
  respond(res, await data.payrollRatesList(req.user.userId, req.query.workshopId));
});
router.get('/rates/history', requireRoles(...PAYROLL_ROLES), async (req, res) => {
  respond(res, await data.payrollRateHistory(req.user.userId, req.query.personType, req.query.personId));
});

// ── Periods ──────────────────────────────────────────────────────────────────
router.post('/periods', requireRoles(...PAYROLL_ROLES), async (req, res) => {
  respond(res, await data.payrollPeriodCreate(req.user.userId, req.body));
});
router.get('/periods', requireRoles(...PAYROLL_ROLES), async (req, res) => {
  respond(res, await data.payrollPeriodList(req.user.userId, req.query));
});
router.get('/periods/:id', requireRoles(...PAYROLL_ROLES), async (req, res) => {
  respond(res, await data.payrollPeriodDetail(req.user.userId, Number(req.params.id)));
});
router.put('/periods/:id', requireRoles(...PAYROLL_ROLES), async (req, res) => {
  respond(res, await data.payrollPeriodUpdate(req.user.userId, Number(req.params.id), req.body));
});
router.delete('/periods/:id', requireRoles(...PAYROLL_ROLES), async (req, res) => {
  respond(res, await data.payrollPeriodDelete(req.user.userId, Number(req.params.id), req.body?.reason));
});
router.post('/periods/:id/calculate', requireRoles(...PAYROLL_ROLES), async (req, res) => {
  respond(res, await data.payrollPeriodCalculate(req.user.userId, Number(req.params.id)));
});
router.post('/periods/:id/submit', requireRoles(...PAYROLL_ROLES), async (req, res) => {
  respond(res, await data.payrollPeriodSubmit(req.user.userId, Number(req.params.id)));
});
router.post('/periods/:id/mark-exported', requireRoles(...PAYROLL_ROLES), async (req, res) => {
  respond(res, await data.payrollPeriodMarkExported(req.user.userId, Number(req.params.id)));
});
router.post('/periods/:id/close', requireRoles(...PAYROLL_ROLES), async (req, res) => {
  respond(res, await data.payrollPeriodClose(req.user.userId, Number(req.params.id)));
});

// ── Approval — reuses the shared multi-stage engine ─────────────────────────
// Body: { decision: 'approved'|'rejected'|'returned_for_revision', notes }
router.post('/periods/:id/approve', async (req, res) => {
  const { decision, notes } = req.body || {};
  if (!decision) return res.status(400).json({ ok: false, error: '"decision" is required' });
  respond(res, await data.procurementApprovalAction(req.user.userId, 'payroll_period', Number(req.params.id), decision, notes));
});

// ── Lines ────────────────────────────────────────────────────────────────────
router.get('/periods/:id/lines', requireRoles(...PAYROLL_ROLES), async (req, res) => {
  respond(res, await data.payrollLineList(req.user.userId, Number(req.params.id), req.query));
});
router.get('/lines/:id', requireRoles(...PAYROLL_ROLES), async (req, res) => {
  respond(res, await data.payrollLineDetail(req.user.userId, Number(req.params.id)));
});
router.post('/lines/:id/recalculate', requireRoles(...PAYROLL_ROLES), async (req, res) => {
  respond(res, await data.payrollLineRecalculate(req.user.userId, Number(req.params.id)));
});
router.put('/lines/:id/source-qty', requireRoles(...PAYROLL_ROLES), async (req, res) => {
  respond(res, await data.payrollLineUpdateSourceQty(req.user.userId, Number(req.params.id), req.body?.sourceQty, req.body?.reason));
});

// ── Adjustments ──────────────────────────────────────────────────────────────
router.post('/lines/:id/adjustments', requireRoles(...PAYROLL_ROLES), async (req, res) => {
  respond(res, await data.payrollAdjustmentCreate(req.user.userId, Number(req.params.id), req.body));
});
router.get('/lines/:id/adjustments', requireRoles(...PAYROLL_ROLES), async (req, res) => {
  respond(res, await data.payrollAdjustmentList(req.user.userId, Number(req.params.id)));
});
router.post('/adjustments/:id/approve', requireRoles(...PAYROLL_ROLES), async (req, res) => {
  respond(res, await data.payrollAdjustmentApprove(req.user.userId, Number(req.params.id), req.body?.notes));
});
router.post('/adjustments/:id/reject', requireRoles(...PAYROLL_ROLES), async (req, res) => {
  respond(res, await data.payrollAdjustmentReject(req.user.userId, Number(req.params.id), req.body?.notes));
});

// ── Reports ──────────────────────────────────────────────────────────────────
router.get('/periods/:id/report/summary', requireRoles(...PAYROLL_ROLES), async (req, res) => {
  respond(res, await data.payrollSummaryReport(req.user.userId, Number(req.params.id)));
});
router.get('/periods/:id/report/reconciliation', requireRoles(...PAYROLL_ROLES), async (req, res) => {
  respond(res, await data.attendancePayrollReconciliation(req.user.userId, Number(req.params.id)));
});
router.get('/periods/:id/report/casual-cost', requireRoles(...PAYROLL_ROLES), async (req, res) => {
  respond(res, await data.casualLabourCostSummary(req.user.userId, Number(req.params.id)));
});
router.get('/periods/:id/report/adjustments', requireRoles(...PAYROLL_ROLES), async (req, res) => {
  respond(res, await data.payrollAdjustmentsReport(req.user.userId, Number(req.params.id)));
});
router.get('/report/workshop-summary', requireRoles(...PAYROLL_ROLES), async (req, res) => {
  respond(res, await data.payrollWorkshopSummary(req.user.userId, req.query.periodId));
});

// ── Excel export — Payroll Enterprise Phase 3 ────────────────────────────────
// Binary response (not the JSON envelope), same exception class
// supplierDocuments.js's file route already established — a mobile client
// needs the raw .xlsx bytes to save+share, not JSON. reportType is one of
// 'periods'/'lines'/'summary'/'adjustments'/'approval'/'workshop';
// period_id/search/status/sort_by/sort_dir are passed straight through as
// query params, matching the desktop client's own filtered-export behavior
// (Priority 6) — the export always reflects the same params the on-screen
// list was fetched with.
router.get('/export/:reportType', requireRoles(...PAYROLL_ROLES), async (req, res) => {
  const result = await data.payrollExportExcel(req.user.userId, req.params.reportType, req.query);
  if (!result.ok) return res.status(400).json({ ok: false, error: { code: 'VALIDATION_ERROR', message: result.error } });
  res.set('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.set('Content-Disposition', `attachment; filename="${result.filename}"`);
  res.send(Buffer.from(result.buffer));
});

module.exports = router;
