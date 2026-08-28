'use strict';

const express          = require('express');
const data             = require('../../db/services/data');
const { respond }      = require('../middleware/respond');

const router = express.Router();

// ── GET /api/poles/purchase-requests ─────────────────────────────────────────
// List poles purchase requests + deliveries + available stock balance.
// data.js: polesPurchaseList(userId, workshopId?)
//   Requires: canAccessDaily (daily-timber or daily-poles page)

router.get('/purchase-requests', async (req, res) => {
  respond(res, await data.polesPurchaseList(req.user.userId));
});

// ── POST /api/poles/purchase-requests ────────────────────────────────────────
// Submit a new poles purchase request (pending CEO approval).
// Body:
//   Required: supplier_name, requested_qty
//   Optional: unit_price, notes
// data.js: polesPurchaseCreate(userId, payload)
//   Role check: ['admin','ceo','operations','supervisor','poles-leader']

router.post('/purchase-requests', async (req, res) => {
  respond(res, await data.polesPurchaseCreate(req.user.userId, req.body));
});

// ── GET /api/poles/deliveries ─────────────────────────────────────────────────
// List poles deliveries + available stock balance (shared endpoint with purchase list).
// Reuses polesPurchaseList which returns both requests and deliveries.

router.get('/deliveries', async (req, res) => {
  respond(res, await data.polesPurchaseList(req.user.userId));
});

// ── POST /api/poles/deliveries ────────────────────────────────────────────────
// Record a poles delivery from the supplier.
// Body:
//   Required: delivery_date (YYYY-MM-DD), delivered_qty
//   Optional: purchase_request_id, supplier_name, delivery_note_ref, notes
// data.js: polesDeliveryCreate(userId, payload)
//   Role check: ['admin','ceo','operations','supervisor','poles-leader']

router.post('/deliveries', async (req, res) => {
  respond(res, await data.polesDeliveryCreate(req.user.userId, req.body));
});

// ── POST /api/poles/deliveries/:id/quality-check ── (Phase 2) ─────────────────
// Record quality check result — approved and rejected quantities.
// Body:
//   Required: approved_qty
//   Optional: rejection_reason
// data.js: polesDeliveryQualityCheck(userId, deliveryId, payload)
//   Role check: ['admin','ceo','operations','supervisor','poles-leader']

router.post('/deliveries/:id/quality-check', async (req, res) => {
  respond(res, await data.polesDeliveryQualityCheck(
    req.user.userId,
    Number(req.params.id),
    req.body
  ));
});

// ── Pole Production Phase 1 ───────────────────────────────────────────────────
// Batches consume raw logs from the same pooled balance purchase-requests/
// deliveries above compute, and produce one or more real Product Catalog
// output lines, each going through the shared Quality Inspection engine.

// ── GET /api/poles/production ─────────────────────────────────────────────────
// List pole production batches (with their output lines).
// data.js: poleProductionBatchesList(userId, workshopId?)

router.get('/production', async (req, res) => {
  respond(res, await data.poleProductionBatchesList(req.user.userId));
});

// ── POST /api/poles/production ────────────────────────────────────────────────
// Record a new production batch.
// Body:
//   Required: batch_date, input_raw_log_qty, outputs: [{ output_product_id, quantity }, ...]
//   Optional: operator, supervisor, machine_id, start_time, end_time,
//             downtime_minutes, downtime_reason, notes, workshop_id
// data.js: poleProductionBatchCreate(userId, payload)
//   Role check: ['admin','ceo','operations','supervisor','poles-leader','poles-supervisor']

router.post('/production', async (req, res) => {
  respond(res, await data.poleProductionBatchCreate(req.user.userId, req.body));
});

// ── DELETE /api/poles/production/:id ──────────────────────────────────────────
// Delete a batch (only while no output line has been inspected yet).
// Body: { reason? }
// data.js: poleProductionBatchDelete(userId, batchId, reason) — governed (applyGovernance)

router.delete('/production/:id', async (req, res) => {
  const result = await data.poleProductionBatchDelete(req.user.userId, Number(req.params.id), req.body?.reason);
  if (!result.ok && result.pendingApproval) {
    return respond(res, { ok: true, pendingApproval: true, level: result.level, message: result.message });
  }
  respond(res, result);
});

// ── POST /api/poles/production/outputs/:id/inspect ────────────────────────────
// Quality-inspect a single output line — accepted quantity posts to real
// Finished Pole Inventory, rejected quantity creates a rejection_holds row
// (reusing the exact same Rework/Downgrade/Return-to-Inventory/Firewood/
// Scrap/Disposal resolution paths Sawmill/Nyanza already use).
// Body: { approved_qty, rejection_reason?, notes? }
// data.js: poleProductionInspect(userId, outputId, payload)

router.post('/production/outputs/:id/inspect', async (req, res) => {
  respond(res, await data.poleProductionInspect(req.user.userId, Number(req.params.id), req.body));
});

// ── GET /api/poles/production/reconciliation ──────────────────────────────────
// Input raw logs vs accepted/rejected/pending output, plus computed output
// volume (from each product's own diameter/length). See data.js for why
// input-side volume and a volume-based recovery % are not computable from
// current raw-log purchase records (piece count only, no per-log dimensions).

router.get('/production/reconciliation', async (req, res) => {
  respond(res, await data.poleProductionReconciliation(req.user.userId));
});

// ── Pole Production Phase 2 — Purchased Finished Poles ───────────────────────
// procurementGoodsReceiptCreate (procurement pipeline) now holds any line
// whose stock item is category 'Finished Poles' at qc_status='pending_qc'
// instead of posting it straight to stock — these routes are the Poles-side
// queue/action for that hold, mirroring /production/outputs/:id/inspect above.

// ── GET /api/poles/purchased/pending-qc ───────────────────────────────────────
// List purchased finished pole goods-receipt lines awaiting Quality Inspection.
// data.js: procurementGoodsReceiptPendingPoleQC(userId, workshopId?)

router.get('/purchased/pending-qc', async (req, res) => {
  respond(res, await data.procurementGoodsReceiptPendingPoleQC(req.user.userId));
});

// ── POST /api/poles/purchased/:id/inspect ─────────────────────────────────────
// Quality-inspect a single purchased-pole goods-receipt line — accepted
// quantity posts to real Finished Pole Inventory, rejected quantity creates a
// rejection_holds row (Downgrade/Return-to-Inventory/Firewood/Scrap/Disposal
// all already generic; Rework is not supported for this source — see data.js).
// Body: { approved_qty, rejection_reason?, notes? }
// data.js: procurementGoodsReceiptInspect(userId, receiptItemId, payload)

router.post('/purchased/:id/inspect', async (req, res) => {
  respond(res, await data.procurementGoodsReceiptInspect(req.user.userId, Number(req.params.id), req.body));
});

// ── GET /api/poles/source-report ──────────────────────────────────────────────
// Purchased vs Manufactured pole totals (produced/purchased/accepted/rejected/
// reworked/resolved), plus combined live inventory/sales — see data.js for why
// inventory/sales are combined rather than split by source.
// data.js: polesSourceReport(userId, workshopId?)

router.get('/source-report', async (req, res) => {
  respond(res, await data.polesSourceReport(req.user.userId));
});

module.exports = router;
