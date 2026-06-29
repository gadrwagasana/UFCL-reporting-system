# UFCL Mobile API — Specification

Version: 1.0 (Phase 1)  
Base URL: `http://<server-ip>:3001`  
Auth: Bearer JWT, 8-hour expiry

All responses are JSON. Success: `{ ok: true, ... }`. Failure: `{ ok: false, error: "..." }`.

No business logic lives in this API. Every write endpoint is a thin wrapper over a function in `db/services/data.js`. The section header for each endpoint names the data.js function called, so you can cross-reference validation rules, side effects, and DB queries there.

---

## Authentication

### POST /api/auth/login
Public — issues a JWT.

**Body**
```json
{ "username": "alice", "password": "secret" }
```

**Response 200**
```json
{
  "ok": true,
  "token": "<jwt>",
  "user": { "id": 5, "name": "Alice", "role": "supervisor", "workshopId": 2, "workshopName": "Gatare" }
}
```

**Errors**
| Status | Meaning |
|--------|---------|
| 400 | Missing username or password |
| 401 | Wrong credentials |
| 403 | Account deactivated |

---

### GET /api/auth/me
Verify token, return current user profile. Used on app startup to restore session.

**Headers:** `Authorization: Bearer <token>`

**Response 200**
```json
{ "ok": true, "user": { "id": 5, "name": "Alice", "role": "supervisor", "workshopId": 2, "workshopName": "Gatare" } }
```

---

## CEO

All CEO routes require role `ceo` or `admin`.

### GET /api/ceo/overview
Current-month KPI summary.  
**data.js:** `getCeoOverview(userId)`

**Response 200**
```json
{
  "ok": true,
  "month": "June 2026",
  "production": { "timber_units": 1200, "poles_units": 340, "downtime_hours": "4.5", "entries": 18 },
  "harvest":    { "trees": 650, "logs": 210 },
  "sales":      { "total_orders": 12, "revenue": "4500000" },
  "machines":   { "total": 8, "available": 5, "in_use": 2, "maintenance": 1 },
  "vehicles":   4,
  "casuals":    22,
  "pendingLabour":  3,
  "pendingChanges": 1
}
```

---

### GET /api/ceo/poles-requests
Poles purchase requests + deliveries + available stock balance.  
**data.js:** `polesPurchaseList(userId)`

---

### POST /api/ceo/poles-requests/:id/approve
CEO approves or rejects a poles purchase request.  
**data.js:** `polesPurchaseApprove(userId, requestId, approve, rejectionReason)`  
**Permission:** `ceo` ONLY (data.js enforces — admin at API layer for emergency access)

**Body**
```json
{ "approve": true }
```
```json
{ "approve": false, "rejectionReason": "Budget not available this quarter" }
```

---

### GET /api/ceo/monthly?month=2026-06
Monthly dashboard data for approval display.  
**data.js:** `monthlyDashboard(userId, monthKey)`

---

### POST /api/ceo/monthly/:monthKey/approve
CEO stamps the monthly production data as approved. Notifies operations, sales, finance, logistics.  
**data.js:** `monthlyApprove(userId, monthKey)`  
**Permission:** `ceo` ONLY

**Example:** `POST /api/ceo/monthly/2026-06/approve` — no body required.

---

## Harvest

### GET /api/harvest
Harvest entries for the caller's workshop + compartment summary.  
**data.js:** `dailyHarvestData(userId)`  
**Permitted roles:** supervisor, operations, ceo, admin (any with `daily-harvest` or `harvest` page)  
**Workshop isolation:** YES — restricted users see only their own workshop's entries

---

### POST /api/harvest
Create a harvest log entry.  
**data.js:** `harvestCreate(userId, payload)`  
**Permitted roles:** same as GET  
**Workshop isolation:** YES — `workshopId` auto-set from user for restricted roles

**Body**
```json
{
  "harvest_date": "2026-06-19",
  "species": "Eucalyptus",
  "quantity": 120,
  "uom": "trees",
  "compt_id": 3,
  "sub_name": "Sub-A",
  "location": "Compartment 3",
  "logs_crosscut": 80,
  "logs_handrolled": 40,
  "notes": "Morning harvest"
}
```

Required: `harvest_date`, `species`, `quantity`  
**Side effect:** if compartment volume is now fully harvested, compartment status auto-updates to `Completed`.

---

## Log Transport

### GET /api/log-transport
Log transport entries + totals (harvested vs transported vs remaining).  
**data.js:** `logTransportList(userId)`  
**Permitted roles:** supervisor, operations, logistics, ceo, admin (log-transport page or role list)  
**Workshop isolation:** YES

---

### POST /api/log-transport
Record a log transport trip from forest to sawmill.  
**data.js:** `logTransportCreate(userId, payload)`  
**Permitted roles:** same as GET  
**Workshop isolation:** YES

**Body**
```json
{
  "transport_date": "2026-06-19",
  "qty_transported": 60,
  "unit": "logs",
  "compt_id": 3,
  "sub_name": "Sub-A",
  "tractor_plate": "RAC 123A",
  "loggers_number": "8",
  "notes": "Morning run"
}
```

Required: `transport_date`, `qty_transported`

---

## Material Requests

**Pre-requisite (Gap A):** Before supervisors can use these endpoints, run this SQL once on the production database:

```sql
INSERT INTO role_definitions (role, permissions)
VALUES (
  'supervisor',
  ARRAY['dashboard','daily','daily-timber','daily-poles','daily-harvest',
        'value-added-timber','machine-logs','audit','export','notifications',
        'changes','timber-inventory','workshop-overview','compartments',
        'log-transport','machine-fuel','casual-requests','casuals',
        'stock-movements']
)
ON CONFLICT (role) DO UPDATE
  SET permissions = array_append(
    array_remove(role_definitions.permissions, 'stock-movements'),
    'stock-movements'
  )
  WHERE NOT ('stock-movements' = ANY(role_definitions.permissions));
```

### GET /api/material-requests
Material requests for the caller's workshop + stock catalog + workshop list.  
**data.js:** `materialRequestsList(userId)`  
**Permitted roles:** storekeeper, supervisor (after Gap A), operations, logistics, admin, ceo  
**Workshop isolation:** YES

---

### POST /api/material-requests
Submit a material request.  
**data.js:** `materialRequestsCreate(userId, payload)`  
**Permitted roles:** same as GET  
**Workshop isolation:** YES

**Body**
```json
{
  "item_id": 12,
  "requested_qty": 5,
  "reason": "Stock depleted after chainsaw maintenance",
  "priority": "urgent"
}
```

Required: `item_id`, `requested_qty`  
`priority`: `"normal"` | `"urgent"` | `"critical"` (default: `"normal"`)

---

### POST /api/material-requests/:id/approve
Approve or reject a material request (Phase 2 in mobile but route is live).  
**data.js:** `materialRequestsApprove(userId, requestId, action, approvedQty, reviewNotes, sourceWarehouseId)`  
**Permitted roles:** admin, ceo, operations, logistics, supervisor  
**Gap C enforcement:** if caller is `supervisor`, API verifies their `workshopId` matches the request's `workshop_id` before calling data.js.  
**Side effect when approved with `sourceWarehouseId`:** auto-creates stock movement and adjusts `stock_levels` at both source and destination.

**Body**
```json
{
  "action": "approve",
  "approvedQty": 4,
  "reviewNotes": "Approved partial — 1 unit reserved for HQ",
  "sourceWarehouseId": 1
}
```
```json
{ "action": "reject", "reviewNotes": "Resubmit next quarter" }
```

---

## Casual Labour

### GET /api/casual-labour
Casual labour requests for the caller's workshop.  
**data.js:** `casualLabourRequestsList(userId)`  
**Permitted roles:** supervisor, operations, ceo, admin  
**Workshop isolation:** YES

---

### POST /api/casual-labour
Submit a casual labour request.  
**data.js:** `casualLabourRequestsCreate(userId, payload)`  
**Permitted roles:** same as GET  
**Workshop isolation:** YES

**Body**
```json
{
  "start_date": "2026-06-23",
  "end_date": "2026-06-27",
  "task": "Log loading",
  "num_casuals": 15,
  "labour_items": ["Machetes", "Ropes"],
  "description": "Loading trimmed logs onto trucks",
  "comments": "Need experienced loaders"
}
```

Required: `start_date`, `end_date`, `task`, `num_casuals`

---

### POST /api/casual-labour/:id/review
Approve or reject a casual labour request.  
**data.js:** `casualLabourRequestsReview(userId, requestId, status)`  
**Permitted roles:** `ceo`, `operations` ONLY (data.js enforces)

**Body:** `{ "status": "Approved" }` or `{ "status": "Rejected" }`

---

## Poles

### GET /api/poles/purchase-requests
Poles purchase requests + deliveries + available stock balance.  
**data.js:** `polesPurchaseList(userId)`  
**Permitted roles:** any with `daily-timber` or `daily-poles` page

---

### POST /api/poles/purchase-requests
Submit a poles purchase request (CEO approval required before delivery can proceed).  
**data.js:** `polesPurchaseCreate(userId, payload)`  
**Permitted roles:** supervisor, poles-leader, operations, ceo, admin

**Body**
```json
{
  "supplier_name": "Rwanda Poles Ltd",
  "requested_qty": 500,
  "unit_price": 2500,
  "notes": "Standard grade, 4m length"
}
```

Required: `supplier_name`, `requested_qty`

---

### GET /api/poles/deliveries
Same as `GET /api/poles/purchase-requests` — returns requests, deliveries, and available stock together.

---

### POST /api/poles/deliveries
Record a delivery from the supplier.  
**data.js:** `polesDeliveryCreate(userId, payload)`  
**Permitted roles:** supervisor, poles-leader, operations, ceo, admin

**Body**
```json
{
  "delivery_date": "2026-06-20",
  "delivered_qty": 480,
  "purchase_request_id": 7,
  "supplier_name": "Rwanda Poles Ltd",
  "delivery_note_ref": "DN-2026-0614",
  "notes": "20 poles rejected on site — cracked"
}
```

Required: `delivery_date`, `delivered_qty`  
Note: `purchase_request_id` links the delivery to a CEO-approved request — do not record delivery without a linked approved request.

---

### POST /api/poles/deliveries/:id/quality-check
Record quality check on a delivery (approved and rejected qty).  
**data.js:** `polesDeliveryQualityCheck(userId, deliveryId, payload)`  
**Permitted roles:** supervisor, poles-leader, operations, ceo, admin

**Body**
```json
{ "approved_qty": 460, "rejection_reason": "20 cracked poles returned to supplier" }
```

Required: `approved_qty` (cannot exceed the recorded `delivered_qty`)

---

## Deliveries (Proof of Delivery)

### GET /api/deliveries
Delivery orders list + vehicles + open sales orders.  
**data.js:** `deliveryOrdersList(userId)`  
**Permitted roles:** logistics, sales, operations, ceo, admin (requires `deliveries` page)  
**NOT accessible** to supervisor — supervisors do not have the `deliveries` page.

---

### POST /api/deliveries/:id/pod
Record Proof of Delivery at the customer site. This is the primary on-site mobile action for drivers.  
**data.js:** `deliveryOrdersRecordPOD(userId, orderId, payload)`  
**Permitted roles:** logistics, sales, operations, ceo, admin

**Body**
```json
{ "qty_accepted": 90, "rejection_reason": "10 boards arrived damaged" }
```

Required: `qty_accepted` (≥ 0)

**Side effects (all inside data.js):**
- Sets `delivery_orders.status = 'POD Recorded'`
- Recalculates `sales_orders.qty_accepted_total`, `qty_rejected_total`, `qty_remaining`
- Sets sales order status to `'Fully Delivered'` or `'Partially Delivered'`
- Triggers `refreshStockView()` — rejected qty returns to available stock automatically

---

### POST /api/deliveries/:id/status
Update delivery status (pre-POD stages).  
**data.js:** `deliveryOrdersUpdateStatus(userId, orderId, status)`  
**Body:** `{ "status": "In Transit" }`  
Valid values: `"Pending"` | `"Assigned"` | `"In Transit"` | `"Failed"`

---

## Machine Logs (Daily Shift)

### GET /api/machine-logs?machineId=&month=
List machine daily shift logs.  
**data.js:** `machineLogsList(userId, machineId?, month?, workshopId?)`  
**Permitted roles:** supervisor, operations, ceo, admin (machine-logs page via `daily` expansion)

---

### POST /api/machine-logs
Create a machine daily shift log.  
**data.js:** `machineLogsCreate(userId, payload)` (internal name: `machineLogsCreate`)  
**Permitted roles:** same as GET

**Body**
```json
{
  "machine_id": 3,
  "log_date": "2026-06-19",
  "shift": "Full Day",
  "hours_worked": 7.5,
  "downtime_hours": 0.5,
  "downtime_reason": "Chain replacement",
  "fuel_consumed": 45,
  "daily_production": 110,
  "capacity_per_day": 120,
  "product_type": "Timber",
  "item_category": null,
  "logs_loaded": 80,
  "logs_unloaded": 80,
  "loading_trips": 4,
  "remarks": "Normal shift"
}
```

Required: `machine_id`, `log_date`  
`shift`: `"Full Day"` | `"AM"` | `"PM"` (default: `"Full Day"`)  
**Workshop assignment:** derived from the machine's own `workshop_id` — not the user's workshop.

---

## Fuel

### GET /api/fuel/machine
List machine fuel issue records.  
**data.js:** `machineFuelLogsList(userId)`  
**Permitted roles:** supervisor, operations, logistics, ceo, admin (machine-fuel page)

---

### POST /api/fuel/machine
Record fuel issued from the store to a machine or vehicle.  
**data.js:** `machineFuelLogsCreate(userId, payload)`  
**Permitted roles:** same as GET

**Body**
```json
{
  "log_date": "2026-06-19",
  "machine_id": 3,
  "fuel_type": "Diesel",
  "quantity": 45,
  "unit": "liters",
  "operator": "Jean Pierre",
  "notes": "Morning refuel before shift"
}
```

Required: `log_date`, `fuel_type`, `quantity`, and ONE OF `machine_id` or `vehicle_id`

---

### GET /api/fuel/vehicle?vehicleId=
List fill-up records for a specific vehicle (with odometer).  
**data.js:** `fuelLogsList(userId, vehicleId)`  
**Permitted roles:** logistics, admin ONLY (requires `vehicles` page)

---

### POST /api/fuel/vehicle
Record a vehicle fuel fill-up with odometer.  
**data.js:** `fuelLogsCreate(userId, payload)`  
**Permitted roles:** logistics, admin ONLY

**Body**
```json
{
  "vehicle_id": 2,
  "log_date": "2026-06-19",
  "liters": 80,
  "cost_per_liter": 1150,
  "total_cost": 92000,
  "odometer": 54320,
  "notes": "Filled at Total station, Route 1"
}
```

Required: `vehicle_id`, `log_date`, `liters`

---

## My Requests

### GET /api/my-requests
Returns the caller's own pending edit and deletion submissions.

**Gap B implementation:**
- Managers (`admin`, `ceo`, `operations`, `logistics`) receive the full system-wide list via `pendingEditsList`.
- All other roles receive only their own submissions via a direct filtered query in the API layer.

**Response 200 (non-manager)**
```json
{
  "ok": true,
  "edits": [
    {
      "id": 14,
      "action_type": "edit",
      "entity_type": "harvest_log",
      "entity_ref": "Eucalyptus — 15/06/2026",
      "status": "Pending",
      "review_notes": null,
      "submitted_at": "19/06/2026 08:14",
      "reviewed_at": null
    }
  ],
  "deletions": []
}
```

---

## Meta (Dropdowns)

All endpoints require a valid JWT. No role restriction — the permission guard is on the create/update endpoint, not on the dropdown.

| Endpoint | Returns | Used by |
|---|---|---|
| `GET /api/meta/compartments` | Compartments + harvested volume | Harvest, Log Transport forms |
| `GET /api/meta/machines` | Active machines | Machine log, Machine fuel forms |
| `GET /api/meta/machine-fuel-targets` | Machines + own-fleet vehicles | Machine fuel issue form |
| `GET /api/meta/vehicles` | All active vehicles | Vehicle fuel form, Stock transfer dispatch |
| `GET /api/meta/stock-items` | Stock catalog (name, category, uom) | Material request form |
| `GET /api/meta/warehouses` | Active warehouses | Material request approval (source picker) |
| `GET /api/meta/poles-purchase-requests` | Approved purchase requests | Poles delivery form (link to request) |
| `GET /api/meta/machine-log-categories` | Machine log categories | Machine daily log form |

---

## Phase 2 — Not Yet Implemented (HTTP 501)

| Method | Endpoint | data.js function | Key roles |
|---|---|---|---|
| GET | `/api/stock-transfers` | `stockTransfersList` | all |
| POST | `/api/stock-transfers/:id/approve` | `stockTransfersApproveReject` | operations, logistics |
| POST | `/api/stock-transfers/:id/dispatch` | `stockTransfersDispatch` | logistics, supervisor |
| POST | `/api/stock-transfers/:id/receive` | `stockTransfersReceive` | supervisor, storekeeper |
| GET | `/api/stock-transfers/:id/history` | `stockTransfersDispatchHistory` | all |
| GET | `/api/dispatch` | `dispatchList` | logistics |
| POST | `/api/dispatch/:id/review` | `dispatchReview` | logistics, operations |

---

## JWT Payload

```json
{ "userId": 5, "role": "supervisor", "workshopId": 2, "iat": 1750000000, "exp": 1750028800 }
```

`userId` is passed to every data.js function. `role` and `workshopId` are used by the API-layer guards only (the fast first gate). data.js always re-fetches the user from the DB (with 60-second cache) and performs its own permission check as the authoritative guard.

---

## Environment Variables Required

Add to the project root `.env` file before starting the mobile API:

```
JWT_SECRET=<strong-random-string-min-32-chars>
MOBILE_API_PORT=3001
```

The existing `PGHOST`, `PGPORT`, `PGDATABASE`, `PGUSER`, `PGPASSWORD` variables are shared with the Electron app.

---

## Starting the Server

```bash
cd "UFCL 12/mobile-api"
npm install
npm start
```

The server binds to `0.0.0.0:3001` — accessible from all devices on the same network.

---

## Known Gaps Applied in This Implementation

| Gap | Where handled |
|---|---|
| **Gap A** — supervisor lacks `stock-movements` page by default | SQL migration to run on DB (see Material Requests section) |
| **Gap B** — no filtered "my requests" view in data.js | `routes/myRequests.js` adds `WHERE submitted_by = userId` for non-managers |
| **Gap C** — supervisor material-request approval has no workshop isolation | `routes/materialRequests.js` POST `/:id/approve` checks `workshopId` before calling data.js |
| **Gap D** — operations lacks `dispatch` page (pre-existing, not fixed) | Phase 2 skeleton documents this constraint |
