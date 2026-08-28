'use strict';

const express          = require('express');
const data             = require('../../db/services/data');
const { respond }      = require('../middleware/respond');

const router = express.Router();

// ── GET /api/logistics/dashboard ──────────────────────────────────────────────
// Warehouse stock summary. Role gating lives solely in data.logisticsDashboard()
// (mustRole(user, 'logistics-dashboard')) — no Express-level role list here, so
// this matches every role actually granted the page (including logistics-officer)
// instead of a hardcoded subset that used to exclude it.

router.get('/dashboard', async (req, res) => {
  const result = await data.logisticsDashboard(req.user.userId);
  if (!result.ok) return respond(res, result, 0);

  const {
    workshops, lowStock, recentMovements, monthTotals,
    deliveryStatusCounts, dispatchStatusCounts, transportJobStatusCounts,
    fleetStatusCounts, vehiclesInUse, fuelThisMonth, pendingActions,
    deliveriesToday, deliveriesThisWeek, delayedDeliveriesCount, delayedTransportJobsCount,
    delayedDeliveries, delayedTransportJobs, activeDriversCount, fleetActiveCount,
    fleetUtilizationPct, vehicleAvailability, workshopAlertsCount, workshopAlerts,
    todaysDeliveries, todaysTransportJobs, activeDeliveries, vehiclesOnRoute,
    vehiclesWaiting, priorityDeliveries,
  } = result;

  respond(res, {
    ok: true,
    workshops: (workshops || []).map((w) => ({
      id:          w.id,
      name:        w.name,
      location:    w.location,
      item_count:  Number(w.item_count  || 0),
      stock_value: Number(w.stock_value || 0),
      currency:    'RWF',
      total_qty:   Number(w.total_qty   || 0),
    })),
    lowStock: (lowStock || []).map((s) => ({
      name:           s.name,
      category:       s.category,
      uom:            s.uom,
      min_stock:      Number(s.min_stock   || 0),
      total_stock:    Number(s.total_stock || 0),
      warehouse_name: s.warehouse_name,
    })),
    activity: (recentMovements || []).map((m) => ({
      id:            m.id,
      type:          m.movement_type === 'in' ? 'stock_movement_in' : 'stock_movement_out',
      item_name:     m.item_name,
      quantity:      Number(m.quantity || 0),
      workshop_name: m.workshop_name,
      time:          m.created_at,
      user_name:     m.created_by,
    })),
    monthTotals: (monthTotals || []).map((t) => ({
      movement_type: t.movement_type,
      count:         Number(t.cnt       || 0),
      total_qty:     Number(t.total_qty || 0),
    })),
    // Phase 2 — department-wide operational summary (mirrors the desktop
    // Logistics Dashboard redesign): Delivery/Dispatch/Transport Jobs/Fleet/
    // Fuel/Pending Actions, in addition to the existing stock-only blocks above.
    deliveryStatusCounts: (deliveryStatusCounts || []).map((r) => ({ status: r.status, cnt: Number(r.cnt || 0) })),
    dispatchStatusCounts: (dispatchStatusCounts || []).map((r) => ({ status: r.status, cnt: Number(r.cnt || 0) })),
    transportJobStatusCounts: (transportJobStatusCounts || []).map((r) => ({
      status: r.status, cnt: Number(r.cnt || 0), total_cost: Number(r.total_cost || 0),
    })),
    fleetStatusCounts: (fleetStatusCounts || []).map((r) => ({ status: r.status, cnt: Number(r.cnt || 0) })),
    vehiclesInUse: Number(vehiclesInUse || 0),
    fuelThisMonth: {
      total_liters: Number(fuelThisMonth?.total_liters || 0),
      total_cost:   Number(fuelThisMonth?.total_cost   || 0),
      log_count:    Number(fuelThisMonth?.log_count    || 0),
    },
    pendingActions: {
      dispatchApprovals: Number(pendingActions?.dispatchApprovals || 0),
      editRequests:      Number(pendingActions?.editRequests      || 0),
    },
    // Phase 3 — Enterprise Operations Dashboard: Executive KPIs + Operational
    // Widgets + Alerts, mirroring the desktop dashboard redesign.
    deliveriesToday:           Number(deliveriesToday || 0),
    deliveriesThisWeek:        Number(deliveriesThisWeek || 0),
    delayedDeliveriesCount:    Number(delayedDeliveriesCount || 0),
    delayedTransportJobsCount: Number(delayedTransportJobsCount || 0),
    activeDriversCount:        Number(activeDriversCount || 0),
    fleetActiveCount:          Number(fleetActiveCount || 0),
    fleetUtilizationPct:       Number(fleetUtilizationPct || 0),
    vehicleAvailability:       Number(vehicleAvailability || 0),
    workshopAlertsCount:       Number(workshopAlertsCount || 0),
    delayedDeliveries: (delayedDeliveries || []).map((r) => ({
      id: r.id, order_number: r.order_number, delivery_date: r.delivery_date, status: r.status, driver_name: r.driver_name,
    })),
    delayedTransportJobs: (delayedTransportJobs || []).map((r) => ({
      id: r.id, job_number: r.job_number, job_date: r.job_date, status: r.status,
    })),
    workshopAlerts: (workshopAlerts || []).map((r) => ({
      id: r.id, vehicle_registration: r.vehicle_registration, maintenance_type: r.maintenance_type, next_due_date: r.next_due_date,
    })),
    todaysDeliveries: (todaysDeliveries || []).map((r) => ({
      id: r.id, order_number: r.order_number, delivery_date: r.delivery_date, status: r.status, driver_name: r.driver_name,
    })),
    todaysTransportJobs: (todaysTransportJobs || []).map((r) => ({
      id: r.id, job_number: r.job_number, job_date: r.job_date, status: r.status, carrier_type: r.carrier_type,
    })),
    activeDeliveries: (activeDeliveries || []).map((r) => ({
      id: r.id, order_number: r.order_number, status: r.status, driver_name: r.driver_name,
    })),
    vehiclesOnRoute: (vehiclesOnRoute || []).map((r) => ({
      id: r.id, registration: r.registration, driver_name: r.driver_name, order_number: r.order_number,
    })),
    vehiclesWaiting: (vehiclesWaiting || []).map((r) => ({
      id: r.id, registration: r.registration, driver_name: r.driver_name,
    })),
    priorityDeliveries: (priorityDeliveries || []).map((r) => ({
      id: r.id, order_number: r.order_number, delivery_date: r.delivery_date, status: r.status,
      driver_name: r.driver_name, is_delayed: !!r.is_delayed,
    })),
  }, 30);
});

// ── GET /api/logistics/history/:module/:recordId ──────────────────────────────
// Phase 2 — generic per-record audit history, reused by every Logistics
// detail screen (mobile equivalent of the desktop detail overlay's history tab).
router.get('/history/:module/:recordId', async (req, res) => {
  respond(res, await data.logisticsRecordHistory(req.user.userId, req.params.module, req.params.recordId));
});

module.exports = router;
