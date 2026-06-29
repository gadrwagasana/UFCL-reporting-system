# UFCL Mobile — Phase 1 UI Plan

> **Status:** Design-ready. All API endpoints verified working (2026-06-22).
> Implement screens in the order listed in §8.

---

## 1. Tech Stack

| Concern | Choice | Why |
|---|---|---|
| Framework | React Native + Expo SDK 51 | CORS already configured for Expo; single codebase for iOS + Android |
| Navigation | React Navigation v6 | Stack + Bottom Tabs per role |
| Server state | TanStack Query (React Query) | Built-in caching, loading/error states, background refetch |
| Local state | Zustand | Lightweight; avoids Redux boilerplate for a small app |
| JWT storage | Expo SecureStore | Encrypted; persists across restarts |
| Offline cache | AsyncStorage + React Query `staleTime` | Serve last fetch when offline |
| Offline queue | AsyncStorage write queue | POST requests queued while offline, flushed on reconnect |
| HTTP client | Axios with JWT interceptor | Automatic 401 logout, centralized error handling |

---

## 2. Brand Colours

Taken from the desktop UAT stylesheet — keep the same identity on mobile.

```
--navy:        #1a3c5e   primary text, headers, tabs
--green:       #2d6a4f   success, active states, FAB
--orange:      #b5500a   poles workflow accent, warnings
--bg:          #f4f6f8   page background
--card:        #ffffff   cards, list items
--border:      #d8dce2   dividers
--error:       #b00020   validation errors, rejection
--warn-bg:     #fff3cd   warning banners
--warn-text:   #856404
--success-bg:  #d4edda
--success-text:#155724
--muted:       #6c757d   secondary text
```

---

## 3. Global Navigation Architecture

```
RootNavigator (Stack)
├── SplashScreen          — JWT check → route to Login or Main
├── LoginScreen           — public
└── MainNavigator         — authenticated; structure varies per role (see §4)
```

**Bottom tab pattern (max 5 tabs):** tabs differ per role. Each tab has its own Stack navigator for drill-down.

---

## 4. Role → Tab Mapping

### 4.1 CEO / Admin

```
Bottom Tabs:
  [Overview]   CeoOverviewScreen
  [Approvals]  ApprovalsNavigator
                 PolesRequestsScreen
                   └─ PolesRequestDetailScreen
                 MonthlyListScreen
                   └─ MonthlyApproveScreen
  [Status]     MyRequestsScreen
```

### 4.2 Supervisor (Gatare / Nyanza)

```
Bottom Tabs:
  [Today]      TodayDashboardScreen        ← today's summary from multiple endpoints
  [Production] ProductionNavigator
                 HarvestListScreen
                   └─ HarvestCreateScreen
                 LogTransportListScreen
                   └─ LogTransportCreateScreen
  [Requests]   RequestsNavigator
                 MaterialRequestListScreen
                   └─ MaterialRequestCreateScreen
                 CasualLabourListScreen
                   └─ CasualLabourCreateScreen
  [Machines]   MachinesNavigator
                 MachineLogListScreen
                   └─ MachineLogCreateScreen
                 MachineFuelListScreen
                   └─ MachineFuelCreateScreen
  [Status]     MyRequestsScreen
```

### 4.3 Harvesting Leader

```
Bottom Tabs:
  [Harvest]    HarvestListScreen
                 └─ HarvestCreateScreen
  [Transport]  LogTransportListScreen
                 └─ LogTransportCreateScreen
  [Status]     MyRequestsScreen
```

### 4.4 Sawmill Leader / Mechanician

```
Bottom Tabs:
  [Machine Logs] MachineLogListScreen
                   └─ MachineLogCreateScreen
  [Fuel]         MachineFuelListScreen
                   └─ MachineFuelCreateScreen
  [Status]       MyRequestsScreen
```

### 4.5 Poles Leader

```
Bottom Tabs:
  [Purchases]  PolesPurchaseListScreen
                 └─ PolesPurchaseCreateScreen
  [Deliveries] PolesDeliveryListScreen
                 └─ PolesDeliveryCreateScreen
                      └─ PolesQCScreen (from delivery item action)
  [Status]     MyRequestsScreen
```

### 4.6 VAT Leader

```
Bottom Tabs:
  [Status]     MyRequestsScreen    ← Phase 1 only; VAT intake endpoint TBD Phase 2
```

> **Gap identified:** No `/api/value-added-timber` endpoint exists in Phase 1.
> VAT leaders get a "coming soon" placeholder tab. Add in Phase 2.

### 4.7 Operations

```
Bottom Tabs:
  [Pending]    PendingReviewsScreen        ← combined pending material + casual
                 MaterialRequestReviewScreen
                 CasualLabourReviewScreen
  [Status]     MyRequestsScreen
```

### 4.8 Logistics

```
Bottom Tabs:
  [Deliveries] DeliveryListScreen
                 └─ DeliveryDetailScreen
                      ├─ PODRecordScreen
                      └─ DeliveryStatusScreen
  [Vehicle Fuel] VehicleFuelListScreen
                   └─ VehicleFuelCreateScreen
  [Status]     MyRequestsScreen
```

### 4.9 Sales Staff

```
Bottom Tabs:
  [Deliveries] DeliveryListScreen
                 └─ DeliveryDetailScreen
                      └─ PODRecordScreen
  [Status]     MyRequestsScreen
```

### 4.10 Storekeeper / Storekeeper-Assistant

```
Bottom Tabs:
  [Requests]   MaterialRequestListScreen    ← read-only list; no create button
  [Status]     MyRequestsScreen
```

---

## 5. Screen-by-Screen Design

---

### S-01 · SplashScreen

**Purpose:** App startup — check stored JWT validity.

**Flow:**
```
Load SecureStore JWT
  → valid  → GET /api/auth/me → success → MainNavigator (role-based tabs)
  → valid  → GET /api/auth/me → 401      → LoginScreen (token expired)
  → no JWT                               → LoginScreen
  → network error                        → OfflineSplashScreen (show last known user)
```

**UI states:**
- Loading: UFCL logo + spinner (navy bg, white logo)
- Error: inline message + "Try again" button

---

### S-02 · LoginScreen

**Purpose:** Username + password → JWT.

**API:** `POST /api/auth/login`

**Layout:**
```
─────────────────────────────
  UFCL logo  (centred)
  "Production Management"
─────────────────────────────
  [Username field]
  [Password field  👁]
  [Log In  button]
─────────────────────────────
  App version (footer, muted)
```

**UI states:**
| State | Behaviour |
|---|---|
| Idle | Normal fields |
| Loading | Button shows spinner; fields disabled |
| Error 401 | Red banner: "Invalid username or password" |
| Error 403 | Red banner: "Account deactivated — contact admin" |
| Error 500 | Red banner: "Server error — try again" |
| No network | Yellow banner: "No connection — check your network" |
| Success | Navigate to MainNavigator; store JWT in SecureStore |

**Validation (client-side):**
- Both fields required before submit
- Trim whitespace from username

---

### S-03 · CeoOverviewScreen

**Purpose:** KPI dashboard for CEO/admin — production, harvest, sales at a glance.

**API:** `GET /api/ceo/overview`

**Layout:**
```
Header: "Overview — [current month]"   [Refresh ⟳]
─────────────────────────────
KPI Cards (2-column grid):
  ┌──────────┐ ┌──────────┐
  │ Harvest  │ │ Sawmill  │
  │  N trees │ │  N units │
  └──────────┘ └──────────┘
  ┌──────────┐ ┌──────────┐
  │  Poles   │ │  Sales   │
  │  N pcs   │ │  N orders│
  └──────────┘ └──────────┘
─────────────────────────────
Pending Approvals section:
  "Poles Requests: N pending"  [Review →]
  "Monthly Report: pending"    [Review →]
```

**UI states:**
| State | Behaviour |
|---|---|
| Loading | Skeleton cards (grey pulsing) |
| Error | Red banner + "Retry" button |
| Empty month | Cards show 0 — not hidden |
| Offline | Stale data badge: "Last updated HH:MM" on each card |

---

### S-04 · PolesRequestsScreen

**Purpose:** List poles purchase requests for CEO to approve/reject.

**API:** `GET /api/ceo/poles-requests`

**Layout:**
```
Header: "Poles Purchase Requests"
─────────────────────────────
Filter pills: [All] [Pending] [Approved] [Rejected]
─────────────────────────────
List of request cards:
  ┌──────────────────────────┐
  │ REQ-001                  │
  │ Supplier: XYZ Ltd        │
  │ Qty: 500 poles  ETB 250k │
  │ Submitted: 15 Jun 2026   │
  │ Status: [PENDING]        │
  │ [Approve] [Reject]       │ ← only on Pending
  └──────────────────────────┘
```

**UI states:**
| State | Behaviour |
|---|---|
| Loading | Skeleton list items |
| Empty (all) | "No purchase requests yet" illustration |
| Empty (filtered) | "No [status] requests" — with clear filter link |
| Error | Red banner + retry |
| Approving/Rejecting | Button shows spinner; card dims |
| Success | Card updates status inline (no re-fetch needed; optimistic) |

---

### S-05 · PolesRequestDetailScreen

**Purpose:** Full detail view + inline approve/reject action.

**API:** `POST /api/ceo/poles-requests/:id/approve`

**Layout:**
```
Header: "Purchase Request #ID"  [← back]
─────────────────────────────
Detail rows:
  Supplier, Qty Requested, Unit Price, Total, Notes
  Status badge, Submitted by, Submitted at
─────────────────────────────
[If status === 'pending']
  [✓ Approve]      [✗ Reject]
  Rejection reason text area (shown only after tapping Reject)
  [Confirm Rejection] button
```

**UI states:**
- Confirming: bottom sheet modal with summary before submitting
- Success: navigate back, flash success toast on list screen
- Error: inline red banner

---

### S-06 · MonthlyListScreen

**Purpose:** Select a month to review/approve.

**API:** `GET /api/ceo/monthly?month=YYYY-MM`

**Layout:**
```
Header: "Monthly Reports"
Month picker: [< Jun 2026 >]
─────────────────────────────
Report summary cards:
  Production totals, Sales totals
  Approval status badge
  [View & Approve →]
```

---

### S-07 · MonthlyApproveScreen

**Purpose:** View monthly summary and stamp approval.

**API:** `POST /api/ceo/monthly/:monthKey/approve`

**Layout:**
```
Header: "June 2026 — Monthly Report"
─────────────────────────────
Summary tables: timber, poles, sales
─────────────────────────────
[Approve Monthly Report]  button
  → Confirmation modal: "This action cannot be undone"
  → [Confirm] / [Cancel]
```

---

### S-08 · TodayDashboardScreen  *(Supervisor)*

**Purpose:** At-a-glance view of today's entries across all production areas.

**API calls (parallel):**
```
GET /api/harvest         → today's harvest count
GET /api/log-transport   → today's transport trips
GET /api/machine-logs    → today's machine entries
GET /api/fuel/machine    → today's fuel issues
```

**Layout:**
```
Header: "Today — [DD Mon YYYY]"   [Refresh]
─────────────────────────────
Workshop badge: "Gatare" / "Nyanza"
─────────────────────────────
Summary cards (tappable → list screen):
  [Harvest: 3 entries]
  [Transport: 2 trips]
  [Machine Logs: 1 shift]
  [Fuel Issued: 2 records]
─────────────────────────────
Pending section:
  [Material Requests: 2 pending]
  [Casual Requests: 1 pending]
```

**UI states:**
- Loading: skeleton cards in 2-col grid
- All zero: not hidden — show 0 with "Add first entry" CTA
- Partial offline: show cached cards with staleness indicator per section

---

### S-09 · HarvestListScreen

**Purpose:** View all harvest entries; navigate to create.

**API:** `GET /api/harvest`

**Layout:**
```
Header: "Harvest Entries"
─────────────────────────────
Date filter: [This Week] [This Month] [All]
─────────────────────────────
List:
  ┌──────────────────────────┐
  │ 18 Jun · Compartment A1  │
  │ Species: Eucalyptus       │
  │ 120 trees                 │
  └──────────────────────────┘
─────────────────────────────
FAB [+ Add Harvest]
```

**UI states:**
| State | Behaviour |
|---|---|
| Loading | Skeleton list (3 items) |
| Empty | "No harvest entries yet" + "Add First Entry" button (no FAB conflict) |
| Error | Banner + retry |
| Refreshing | Pull-to-refresh spinner |

---

### S-10 · HarvestCreateScreen

**Purpose:** Log a new harvest entry.

**API:**
- `GET /api/meta/compartments` (on screen open, cached)
- `POST /api/harvest`

**Layout:**
```
Header: "New Harvest Entry"  [← Cancel]
─────────────────────────────
Form:
  Harvest Date *    [Date picker — defaults today]
  Species *         [Text input]
  Quantity *        [Number input]  UOM [picker: trees/m³/logs]
  Compartment       [Dropdown from /api/meta/compartments]
  Sub-name          [Text input, optional]
  Location          [Text input, optional]
  Logs Crosscut     [Number, optional]
  Logs Handrolled   [Number, optional]
  Notes             [Multi-line, optional]
─────────────────────────────
[Submit Entry]  button
```

**Validation:**
- harvest_date, species, quantity all required
- quantity must be > 0
- Date cannot be in the future

**UI states:**
| State | Behaviour |
|---|---|
| Loading compartments | Dropdown shows "Loading..." |
| Compartment error | Dropdown shows "Failed to load — tap to retry" |
| Submitting | Button disabled + spinner |
| Success | Navigate back to list + toast "Harvest entry saved" |
| Error 400 | Red banner below form with error message from API |
| Offline | Queue POST; show "Saved locally — will sync when online" banner |

---

### S-11 · LogTransportListScreen

**Purpose:** View log transport trips.

**API:** `GET /api/log-transport`

**Layout:**
```
Header: "Log Transport"
─────────────────────────────
Summary bar: "Total transported this month: N logs"
─────────────────────────────
List (grouped by date):
  ┌──────────────────────────┐
  │ 18 Jun                    │
  │ Compt A1 → Sawmill        │
  │ 45 logs  · Tractor KA-001 │
  └──────────────────────────┘
─────────────────────────────
FAB [+ Add Trip]
```

---

### S-12 · LogTransportCreateScreen

**Purpose:** Record a transport trip.

**API:**
- `GET /api/meta/compartments` (cached)
- `POST /api/log-transport`

**Form fields:**
- Transport Date * (date picker, default today)
- Qty Transported * (number)
- UOM (picker: logs/m³)
- Compartment (dropdown)
- Sub-name (text)
- Tractor Plate (text)
- Number of Loggers (number)
- Notes (multi-line)

---

### S-13 · MaterialRequestListScreen

**Purpose:** View workshop material requests; create new requests.

**API:** `GET /api/material-requests`

**Layout:**
```
Header: "Material Requests"
─────────────────────────────
Filter: [Pending] [Approved] [Rejected] [All]
─────────────────────────────
List:
  ┌──────────────────────────┐
  │ Engine Oil 15W-40        │
  │ Requested: 10 L          │
  │ Priority: [URGENT] badge │
  │ Status: [PENDING]        │
  │ Submitted: 17 Jun        │
  └──────────────────────────┘
─────────────────────────────
FAB [+ Request Item]
```

> **Note for storekeeper role:** No FAB. List is read-only.
> **Note for operations role:** Each pending item shows [Review] button (navigates to review screen).

---

### S-14 · MaterialRequestCreateScreen

**Purpose:** Submit a material request to the storekeeper/operations for approval.

**API:**
- `GET /api/meta/stock-items` (cached for dropdown)
- `POST /api/material-requests`

**Form fields:**
- Stock Item * (searchable dropdown from /api/meta/stock-items; shows name, category, UOM)
- Requested Qty * (number)
- Priority (picker: Normal / Urgent / Critical; default Normal)
- Reason (text, optional but recommended for Urgent/Critical)

---

### S-15 · MaterialRequestReviewScreen  *(Operations only)*

**Purpose:** Approve or reject a material request, setting the approved quantity and source warehouse.

**API:**
- `GET /api/meta/warehouses` (source warehouse dropdown)
- `POST /api/material-requests/:id/approve`

**Layout:**
```
Header: "Review Material Request"
─────────────────────────────
Request detail: item, qty, priority, workshop, submitted by
─────────────────────────────
[Approve]  section:
  Approved Qty * [number, default = requested]
  Source Warehouse * [dropdown from /api/meta/warehouses]
  Review Notes [text, optional]
  [✓ Approve] button

[Reject] section (toggle):
  Review Notes [text, optional]
  [✗ Reject] button
```

---

### S-16 · CasualLabourListScreen

**Purpose:** View casual labour requests for the workshop.

**API:** `GET /api/casual-labour`

**Layout:**
```
Header: "Casual Labour Requests"
─────────────────────────────
Filter: [Pending] [Approved] [Rejected] [All]
─────────────────────────────
List:
  ┌──────────────────────────┐
  │ Weeding — Block A        │
  │ 20 Jun – 22 Jun          │
  │ 12 casuals needed        │
  │ Status: [PENDING]        │
  └──────────────────────────┘
─────────────────────────────
FAB [+ New Request]  (supervisor/operations only)
```

---

### S-17 · CasualLabourCreateScreen

**Purpose:** Submit a casual labour request.

**API:** `POST /api/casual-labour`

**Form fields:**
- Task / Activity * (text)
- Start Date * (date picker)
- End Date * (date picker; must be ≥ start date)
- Number of Casuals * (number, min 1)
- Labour Items (add multiple text lines, e.g. "Weeding", "Clearing")
- Description (multi-line)
- Comments (multi-line)

**Validation:**
- end_date ≥ start_date enforced
- num_casuals must be a positive integer

---

### S-18 · CasualLabourReviewScreen  *(Operations / CEO only)*

**Purpose:** Approve or reject a casual labour request.

**API:** `POST /api/casual-labour/:id/review`

**Body:** `{ status: "Approved" | "Rejected" }`

**Layout:**
```
Header: "Review Casual Labour Request"
─────────────────────────────
Request details: task, dates, casuals, workshop, submitted by
─────────────────────────────
[✓ Approve]    [✗ Reject]  (side by side)
Confirmation modal before each action
```

---

### S-19 · PolesPurchaseListScreen

**Purpose:** View poles purchase requests; create new ones.

**API:** `GET /api/poles/purchase-requests`

**Layout:**
```
Header: "Poles Purchase Requests"
─────────────────────────────
Available stock bar: "In Stock: N poles"  (from API response)
─────────────────────────────
Filter: [Pending] [Approved] [Rejected] [All]
─────────────────────────────
List:
  ┌──────────────────────────┐
  │ REQ-003 · XYZ Timber Ltd  │
  │ 500 poles · ETB 250,000   │
  │ Requested: 14 Jun         │
  │ Status: [APPROVED]        │
  └──────────────────────────┘
─────────────────────────────
FAB [+ Request Purchase]  (poles-leader, operations, admin, ceo only)
```

---

### S-20 · PolesPurchaseCreateScreen

**Purpose:** Submit a new poles purchase request to CEO for approval.

**API:** `POST /api/poles/purchase-requests`

**Form fields:**
- Supplier Name * (text)
- Requested Qty * (number, poles count)
- Unit Price (number, ETB, optional)
- Notes (multi-line, optional)

> After submit → status is "pending". Remind user: "Awaiting CEO approval."

---

### S-21 · PolesDeliveryListScreen

**Purpose:** View deliveries from suppliers; record new deliveries.

**API:** `GET /api/poles/deliveries`

**Layout:**
```
Header: "Poles Deliveries"
─────────────────────────────
Available Stock bar: "Approved Stock: N poles"
─────────────────────────────
List (grouped by date):
  ┌──────────────────────────┐
  │ DEL-001 · XYZ Timber Ltd  │
  │ 18 Jun · 500 delivered    │
  │ QC: 480 approved / 20 rej │
  │ Status: [QC COMPLETE]     │
  │ [Record QC]               │ ← if no QC yet
  └──────────────────────────┘
─────────────────────────────
FAB [+ Record Delivery]
```

---

### S-22 · PolesDeliveryCreateScreen

**Purpose:** Record a supplier delivery.

**API:**
- `GET /api/meta/poles-purchase-requests` (link to purchase request dropdown)
- `POST /api/poles/deliveries`

**Form fields:**
- Delivery Date * (date picker)
- Delivered Qty * (number)
- Linked Purchase Request (dropdown from /api/meta/poles-purchase-requests, optional)
- Supplier Name (text — auto-filled if purchase request selected)
- Delivery Note Ref (text, optional)
- Notes (multi-line, optional)

---

### S-23 · PolesQCScreen

**Purpose:** Record quality check results — approved vs rejected poles.

**API:** `POST /api/poles/deliveries/:id/quality-check`

**Layout:**
```
Header: "Quality Check — DEL-001"
─────────────────────────────
Delivery info: supplier, date, qty delivered
─────────────────────────────
QC Form:
  Approved Qty *   [number; max = delivered qty]
  Rejected Qty     [auto-calculated = delivered − approved]
  Rejection Reason [text; required if rejected > 0]
─────────────────────────────
[Record QC Result]
```

**Validation:**
- approved_qty ≤ delivered_qty
- If rejected > 0, rejection_reason required

---

### S-24 · PendingReviewsScreen  *(Operations)*

**Purpose:** Unified inbox of all requests awaiting review.

**API calls (parallel):**
```
GET /api/material-requests  → filter status='pending'
GET /api/casual-labour      → filter status='Pending'
```

**Layout:**
```
Header: "Pending Reviews"
─────────────────────────────
Tabs: [Material Requests (N)] [Casual Labour (N)]
─────────────────────────────
[Material tab]
  list of pending requests → tap → MaterialRequestReviewScreen

[Casual tab]
  list of pending requests → tap → CasualLabourReviewScreen
```

**UI states:**
- Badge on tab shows count of pending items
- Empty tab: "No pending [type] requests" (not an error)

---

### S-25 · DeliveryListScreen  *(Logistics / Sales)*

**Purpose:** View open delivery orders; navigate to POD recording.

**API:** `GET /api/deliveries`

**Layout:**
```
Header: "Delivery Orders"
─────────────────────────────
Filter: [All] [Pending] [In Transit] [POD Recorded]
─────────────────────────────
List:
  ┌──────────────────────────┐
  │ DO-045 · Green Valley Ltd │
  │ 50 poles  ·  KA 001 B    │
  │ Status: [IN TRANSIT]      │
  │ [Record POD]              │ ← only when in transit
  └──────────────────────────┘
```

> **Sales staff:** see same list but only "Record POD" action is available (no status update).
> **Logistics:** also sees "Update Status" action.

---

### S-26 · PODRecordScreen

**Purpose:** Driver records proof of delivery at customer site.

**API:** `POST /api/deliveries/:id/pod`

**Layout:**
```
Header: "Record POD — DO-045"
─────────────────────────────
Delivery info: customer, product, qty dispatched, vehicle
─────────────────────────────
POD Form:
  Qty Accepted * [number; 0 to qty dispatched]
  Qty Rejected  [auto = dispatched − accepted]
  Rejection Reason [text; required if rejected > 0]
─────────────────────────────
[Record Delivery]
```

**Side effects (handled by data.js — no extra API calls needed):**
- Sales order status updates automatically
- Stock view refreshes automatically
- If partial delivery → sales order stays open

**Confirmation before submit:** "Qty accepted: N. Qty rejected: N. Confirm?"

---

### S-27 · DeliveryStatusScreen  *(Logistics only)*

**Purpose:** Update delivery order status (assign vehicle, mark in transit, etc.)

**API:** `POST /api/deliveries/:id/status`

**Layout:**
```
Header: "Update Status — DO-045"
─────────────────────────────
Current status badge
─────────────────────────────
Select new status:
  ○ Pending
  ○ Assigned
  ● In Transit   (currently selected)
  ○ Failed
─────────────────────────────
[Update Status]
```

---

### S-28 · MachineLogListScreen

**Purpose:** View machine daily shift logs.

**API:** `GET /api/machine-logs?machineId=&month=`

**Layout:**
```
Header: "Machine Logs"
─────────────────────────────
Month picker: [< Jun 2026 >]
Machine filter: [All machines] [dropdown]
─────────────────────────────
List (grouped by date):
  ┌──────────────────────────┐
  │ CAT 950 — 18 Jun         │
  │ Full Day · 8h worked      │
  │ Production: 120 units     │
  │ Fuel: 45 L               │
  └──────────────────────────┘
─────────────────────────────
FAB [+ Add Log]
```

---

### S-29 · MachineLogCreateScreen

**Purpose:** Log a machine shift.

**API:**
- `GET /api/meta/machines` (machine dropdown)
- `GET /api/meta/machine-log-categories` (item category dropdown)
- `GET /api/machine-logs/fuel-issued?machineId=&logDate=` ← **MISSING — see §7**
- `POST /api/machine-logs`

**Form fields:**
- Machine * (dropdown from /api/meta/machines)
- Log Date * (date picker, default today)
- Shift (picker: Full Day / AM / PM)
- Hours Worked (number, max 12)
- Downtime Hours (number)
- Downtime Reason (text; required if downtime > 0)
- Fuel Consumed (number, litres)
- Daily Production (number)
- Capacity Per Day (number)
- Product Type (text)
- Item Category (dropdown from /api/meta/machine-log-categories)
- Logs Loaded (number)
- Logs Unloaded (number)
- Loading Trips (number)
- Remarks (multi-line)

---

### S-30 · MachineFuelListScreen

**Purpose:** View machine fuel issuance records.

**API:** `GET /api/fuel/machine`

**Layout:**
```
Header: "Machine Fuel Issued"
─────────────────────────────
Month summary: "Total: N litres diesel / N litres petrol"
─────────────────────────────
List:
  ┌──────────────────────────┐
  │ CAT 950  · 18 Jun         │
  │ Diesel · 45 L             │
  │ Operator: John D.         │
  └──────────────────────────┘
─────────────────────────────
FAB [+ Issue Fuel]
```

---

### S-31 · MachineFuelCreateScreen

**Purpose:** Record fuel issued to a machine or vehicle from the store.

**API:**
- `GET /api/meta/machine-fuel-targets` (combined machines + vehicles dropdown)
- `POST /api/fuel/machine`

**Form fields:**
- Log Date * (date picker, default today)
- Fuel Type * (picker: Diesel / Petrol / Other)
- Quantity * (number, litres)
- Issued To * (searchable dropdown — machines + vehicles from /api/meta/machine-fuel-targets)
- Operator (text, optional)
- Notes (text, optional)

---

### S-32 · VehicleFuelListScreen  *(Logistics / Admin only)*

**Purpose:** View vehicle fill-up records.

**API:** `GET /api/fuel/vehicle?vehicleId=N`

**Layout:**
```
Header: "Vehicle Fuel Log"
─────────────────────────────
Vehicle picker: [KA 001 B ▾]   ← required; no default
─────────────────────────────
List (shows after vehicle selected):
  ┌──────────────────────────┐
  │ 18 Jun · 60 L diesel      │
  │ Odometer: 45,210 km       │
  │ Cost: ETB 4,200           │
  └──────────────────────────┘
─────────────────────────────
FAB [+ Record Fill-Up]
```

**UI states:**
- Initial: "Select a vehicle to view records" (no list, no FAB)
- After vehicle selected: list loads

---

### S-33 · VehicleFuelCreateScreen  *(Logistics / Admin only)*

**API:**
- `GET /api/meta/vehicles` (vehicle dropdown)
- `POST /api/fuel/vehicle`

**Form fields:**
- Vehicle * (dropdown from /api/meta/vehicles)
- Log Date * (date picker)
- Litres * (number)
- Cost Per Litre (number, optional)
- Total Cost (number — auto-calculated if both above filled, or manual)
- Odometer Reading (number, optional)
- Notes (text, optional)

---

### S-34 · MyRequestsScreen  *(all roles)*

**Purpose:** Show the user the status of requests they have submitted.

**API:** `GET /api/my-requests`

**Layout:**
```
Header: "My Submissions"
─────────────────────────────
Tabs: [Edit Requests (N)] [Deletion Requests (N)]
─────────────────────────────
List:
  ┌──────────────────────────┐
  │ Edit — Daily Log #45     │
  │ Submitted: 17 Jun 09:32  │
  │ Status: [PENDING]        │
  └──────────────────────────┘
  ┌──────────────────────────┐
  │ Edit — Daily Log #38     │
  │ Submitted: 15 Jun 14:11  │
  │ Status: [APPROVED]       │
  └──────────────────────────┘
```

> **Managers (admin, ceo, operations, logistics):** See ALL pending requests from all users (same as desktop view).

**UI states:**
- Empty edits tab: "No edit requests submitted"
- Empty deletions tab: "No deletion requests"
- Offline: show cached list

---

## 6. Universal UI States (apply to every screen)

### 6.1 Loading
- List screens: 3–5 skeleton card rows (grey pulsing animation)
- Detail screens: skeleton for each field section
- FAB: disabled (greyed out) while data is loading
- Minimum display time: 300 ms (avoid flash for fast connections)

### 6.2 Error
```
┌─────────────────────────────────┐
│  ⚠  Unable to load data         │
│     Check your connection and   │
│     try again.                  │
│                                 │
│         [Try Again]             │
└─────────────────────────────────┘
```
- API 403: show "You don't have permission to view this" (no retry)
- API 401: automatic logout → LoginScreen with "Session expired" toast
- API 500: generic "Server error — contact IT support"

### 6.3 Empty Data
- Never show a blank white screen
- Always show: icon + friendly title + subtitle
- If the user can create: show a "Create First" button (skip FAB for empty)

### 6.4 Offline Banner
```
┌──────────────────────────────────┐
│ 📶  No connection                │
│  Showing data from [time ago].   │
│  Writes will sync when online.   │
└──────────────────────────────────┘
```
- Shown as a sticky bar at the top of every list screen when `netInfo.isConnected === false`
- Colour: `warn-bg` (#fff3cd) with orange left border
- Dismissible: NO — stays until reconnected

### 6.5 Success Toast
- Shown at bottom of screen for 3 seconds
- Green background, white text
- Examples:
  - "Harvest entry saved"
  - "Request submitted — awaiting approval"
  - "POD recorded successfully"

### 6.6 Confirmation Modals
Required before:
- Approve/Reject any request
- Record POD
- Approve monthly report
- Quality check (QC) submission

Modal format:
```
Title: "Confirm Approval"
Body:  Summary of the action
[Cancel]   [Confirm]   ← Confirm is green for approve, red for reject
```

### 6.7 Form Validation (inline)
- Show error below each field on blur (not on typing)
- Required field indicator: red asterisk `*`
- Summary banner at top of form on submit attempt if fields are invalid
- Disable submit button until required fields are filled

---

## 7. Missing API Gaps — Must Fix Before Implementation

| # | Gap | Affected Screen | Fix Required |
|---|---|---|---|
| G-1 | No `GET /api/machine-logs/fuel-issued` endpoint | MachineLogCreateScreen | The desktop IPC handler `machine-logs:fuel-issued` exists but is not exposed via REST. Add `GET /api/machine-logs/fuel-issued?machineId=&logDate=` in [machineLogs.js](routes/machineLogs.js) calling `data.machineFuelIssuedLookup` |
| G-2 | No `/api/value-added-timber` endpoints | VAT Leader home | Add Phase 2; show "coming soon" placeholder for Phase 1 |
| G-3 | No sawmill production endpoint on mobile | Sawmill Leader | `daily:list` / `daily:create` exist in Electron IPC but not REST. Add `GET/POST /api/sawmill` calling `data.dailyList` / `data.dailyCreate` |
| G-4 | `GET /api/ceo/poles-requests` calls `polesPurchaseList(userId)` without `workshopId` | PolesRequestsScreen | This is correct for CEO (cross-workshop). But confirm the function signature accepts `undefined` gracefully — it does (optional param). ✅ No fix needed |
| G-5 | No rate limiting or request throttle on the server | All screens | Add `express-rate-limit` to server.js (5 req/s per IP). Not blocking Phase 1 but required before production |
| G-6 | No HTTPS in server.js | All screens on real device | Add HTTPS via `https.createServer(certs, app)` or reverse proxy (nginx). Required before going on-device |

### G-1 Fix (implement now):

Add to [mobile-api/routes/machineLogs.js](routes/machineLogs.js):

```js
// GET /api/machine-logs/fuel-issued?machineId=&logDate=
// Looks up fuel already issued to a machine on a given date (pre-fill in form)
router.get('/fuel-issued', async (req, res) => {
  const { machineId, logDate } = req.query;
  if (!machineId || !logDate) {
    return res.status(400).json({ ok: false, error: 'machineId and logDate are required' });
  }
  respond(res, await data.machineFuelIssuedLookup(
    req.user.userId,
    Number(machineId),
    logDate
  ));
});
```

### G-3 Fix (implement now):

Add `mobile-api/routes/sawmill.js`:

```js
'use strict';
const express     = require('express');
const data        = require('../../db/services/data');
const { respond } = require('../middleware/respond');
const router      = express.Router();

// GET /api/sawmill — list sawmill daily production logs
router.get('/', async (req, res) => {
  respond(res, await data.dailyList(req.user.userId, req.user.workshopId));
});

// POST /api/sawmill — create a sawmill daily log
router.post('/', async (req, res) => {
  respond(res, await data.dailyCreate(req.user.userId, req.body));
});

module.exports = router;
```

Register in [server.js](server.js):
```js
app.use('/api/sawmill', require('./routes/sawmill'));
```

---

## 8. Offline Strategy

### 8.1 Token Persistence
- Store JWT in `expo-secure-store` (encrypted, survives app restart)
- On app start: read token → call `GET /api/auth/me` → if 200, restore session; if 401, show login
- If network is unavailable at startup: restore session from last-known user in AsyncStorage (read-only mode)

### 8.2 Read Cache
- Use React Query `staleTime: 5 * 60 * 1000` (5 min) and `gcTime: 24 * 60 * 60 * 1000` (24 h)
- All GET results are cached automatically
- On reconnect: React Query refetches in background (no user action needed)
- Show data age: "Last updated X minutes ago" when `dataUpdatedAt` > 5 min old

### 8.3 Write Queue (Offline POST)
When `netInfo.isConnected === false` and user submits a form:

```
1. Validate form fields locally (same rules as online)
2. Store payload in AsyncStorage queue:
   { id: uuid(), endpoint, method, body, createdAt }
3. Show toast: "Saved locally — will sync when you're back online"
4. On network reconnect (netInfo event):
   a. Read queue
   b. POST each item in order
   c. On success: remove from queue, show sync toast
   d. On conflict/error: flag item in queue; show "Sync failed" banner
```

**Screens that support offline writes:**
- HarvestCreateScreen ✅
- LogTransportCreateScreen ✅
- MachineLogCreateScreen ✅
- MachineFuelCreateScreen ✅
- CasualLabourCreateScreen ✅
- MaterialRequestCreateScreen ✅
- PolesPurchaseCreateScreen ✅
- PolesDeliveryCreateScreen ✅
- VehicleFuelCreateScreen ✅

**Screens that do NOT support offline writes** (require live confirmation):
- PODRecordScreen ❌ — affects stock and sales order; must be online
- PolesQCScreen ❌ — affects approved stock balance; must be online
- All approval/reject actions ❌ — require authoritative server response

---

## 9. Navigation UX Details

### 9.1 Header
- Left: back arrow (Stack) or hamburger (if needed)
- Centre: screen title
- Right: refresh icon (list screens) or optional action

### 9.2 FAB (Floating Action Button)
- Green (#2d6a4f), bottom-right, 56 dp
- Only shown when the user has create permission for that screen
- Hidden while list is loading

### 9.3 Pull-to-Refresh
- All list screens support pull-to-refresh
- Calls the list API again; clears stale indicator

### 9.4 Back Navigation Confirmation
- If a form has unsaved changes and the user taps back: show "Discard changes?" modal
- If form is empty: navigate immediately

### 9.5 Session Expiry
- JWT expires after 8 hours
- Axios interceptor catches 401 on any API call
- Clears SecureStore → navigates to LoginScreen with toast: "Session expired — please log in again"

---

## 10. Implementation Order

| Phase | Item | Depends on |
|---|---|---|
| 1a | Project setup (Expo, navigation, Axios, React Query, Zustand) | — |
| 1b | SplashScreen + LoginScreen | 1a |
| 1c | HTTP client + auth interceptor + NetInfo | 1b |
| 1d | MyRequestsScreen (simplest real data screen) | 1c |
| 2a | TodayDashboardScreen (Supervisor) | 1c |
| 2b | HarvestListScreen + HarvestCreateScreen | 2a |
| 2c | LogTransportListScreen + LogTransportCreateScreen | 2a |
| 2d | MachineLogListScreen + MachineLogCreateScreen + G-1 fix | 2a |
| 2e | MachineFuelListScreen + MachineFuelCreateScreen | 2a |
| 3a | MaterialRequestListScreen + MaterialRequestCreateScreen | 1c |
| 3b | PendingReviewsScreen + MaterialRequestReviewScreen (Operations) | 3a |
| 3c | CasualLabourListScreen + CasualLabourCreateScreen | 1c |
| 3d | CasualLabourReviewScreen (Operations) | 3c |
| 4a | CeoOverviewScreen | 1c |
| 4b | PolesRequestsScreen + PolesRequestDetailScreen | 4a |
| 4c | MonthlyListScreen + MonthlyApproveScreen | 4a |
| 5a | PolesPurchaseListScreen + PolesPurchaseCreateScreen | 1c |
| 5b | PolesDeliveryListScreen + PolesDeliveryCreateScreen + PolesQCScreen | 5a |
| 6a | DeliveryListScreen + PODRecordScreen | 1c |
| 6b | DeliveryStatusScreen | 6a |
| 6c | VehicleFuelListScreen + VehicleFuelCreateScreen | 6a |
| 7 | Offline write queue | all write screens |
| 8 | G-3 sawmill route + SawmillLogScreen (sawmill-leader) | 1c |
| 9 | G-5 rate limiting | — |
| 10 | G-6 HTTPS / nginx | — |

---

## 11. Screens Not In Phase 1 (Out-of-Scope — Desktop Only)

Per the requirements (§13 of the context document):

- User management
- Warehouse management
- Machine/vehicle registration
- Product catalog, stock catalog
- Weekly expenses
- Audit log viewer
- Complex reports (KPI targets, weekly performance)
- Pending deletion approvals
- VAT intake (Phase 2)
- Stock transfers dispatch/receive (Phase 2)
- Dispatch review (Phase 2)
