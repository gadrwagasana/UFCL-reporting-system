// All API responses follow this envelope
export interface ApiOk<T = Record<string, unknown>> {
  ok: true;
  error?: never;
}

export interface ApiFail {
  ok: false;
  error: string;
}

export type ApiResponse<T = Record<string, unknown>> = (ApiOk<T> & T) | ApiFail;

// Generic list wrapper returned by many endpoints
export interface ListResponse<T> {
  ok:   true;
  rows: T[];
}

// ─── Offline queue ────────────────────────────────────────────────────────────

export type QueueStatus = 'pending' | 'syncing' | 'failed';

export interface QueueItem {
  id:            string;         // uuid v4
  endpoint:      string;         // e.g. '/api/harvest'
  method:        'POST' | 'PUT' | 'PATCH';
  body:          Record<string, unknown>;
  context:       string;         // human-readable: 'harvest', 'log-transport', etc.
  createdAt:     string;         // ISO timestamp
  retries:       number;
  status:        QueueStatus;
  lastError?:    string;
}

// ─── CEO ─────────────────────────────────────────────────────────────────────

export interface CeoOverview {
  ok: true;
  harvest?:      { log_count?: number; total_trees?: number; [k: string]: unknown };
  sawmill?:      { volume_m3?: number; [k: string]: unknown };
  production?:   { total_units?: number; [k: string]: unknown };
  poles?:        { total_units?: number; [k: string]: unknown };
  sales?:        { total_orders?: number; total_revenue?: number; [k: string]: unknown };
  pendingPolesRequests?:   number;
  pendingMonthlyApproval?: boolean;
  [key: string]: unknown;
}

export interface PolesRequest {
  id:                number;
  supplier_name:     string;
  requested_qty:     number;
  unit_price?:       number;
  notes?:            string;
  status:            'pending' | 'approved' | 'rejected';
  rejection_reason?: string;
  requested_at:      string;
  approved_at?:      string;
  requested_by_name?: string;
  approved_by_name?: string;
}

export interface PolesDelivery {
  id:                       number;
  purchase_request_id?:     number;
  delivery_date:            string;
  supplier_name?:           string;
  delivered_qty:            number;
  delivery_note_ref?:       string;
  approved_qty?:            number;
  rejected_qty?:            number;
  rejection_reason?:        string;
  status:                   'pending' | 'quality_checked';
  notes?:                   string;
  confirmed_at?:            string;
  quality_checked_at?:      string;
  confirmed_by_name?:       string;
  quality_checked_by_name?: string;
}

export interface PolesListResponse {
  ok:             true;
  requests:       PolesRequest[];
  deliveries:     PolesDelivery[];
  available_qty:  number;
  approved_total: number;
}

// ─── Pole Production Batches (Pole Production Phase 1) ────────────────────────

export interface PoleBatchOutputLine {
  id:                 number;
  batch_id:           number;
  output_product_id:  number;
  type:               string;
  sub_type:           string | null;
  size:               string;
  diameter_mm?:       number | null;
  length_m?:          number | null;
  quantity:           number;
  status:             'pending_qc' | 'inspected';
  rework_of_rejection_id?: number | null;
}

export interface PoleProductionBatch {
  id:                number;
  workshop_id:       number | null;
  workshop_name?:    string;
  batch_date:        string;
  operator:          string | null;
  supervisor:        string | null;
  machine_id?:       number | null;
  start_time?:       string | null;
  end_time?:         string | null;
  downtime_minutes?: number | null;
  downtime_reason?:  string | null;
  input_raw_log_qty: number;
  notes:             string | null;
  pending_deletion?: boolean;
  created_by_name?:  string;
  outputs:           PoleBatchOutputLine[];
}

export interface PoleProductionBatchListResponse {
  ok:   true;
  rows: PoleProductionBatch[];
}

// ERP Final Enterprise Hardening Phase — usePoleProductionBatchDelete existed
// but was never called from any screen (same Backend=YES/Desktop=YES/
// Mobile=NO shape as VapPendingApproval's own history); wiring it in needs
// the same pendingApproval shape every other governed-delete hook declares.
export interface PolePendingApproval {
  ok:              true;
  pendingApproval: true;
  level:           'leader' | 'manager';
  message:         string;
}

export interface PoleProductionInspectResult {
  ok: true; id: number; approvedPosted: boolean; unmappedProduct: boolean; rejectionHoldId: number | null;
}

export interface PoleProductionReconciliation {
  ok:              true;
  inputRawLogQty:  number;
  outputTotal:     number;
  acceptedTotal:   number;
  rejectedTotal:   number;
  pendingQcTotal:  number;
  outputVolumeM3:  number;
  recoveryPct:     number | null;
  recoveryBasis:   string;
  note:            string;
}

// ─── Purchased Finished Poles (Pole Production Phase 2) ────────────────────────

export interface PendingPoleQCItem {
  id:                number;
  receipt_id:        number;
  po_item_id:        number;
  quantity_received:  number;
  qc_status:         'pending_qc';
  receipt_number:    string | null;
  received_at:       string;
  po_id:             number;
  po_number:         string;
  workshop_id:       number | null;
  supplier_name:     string;
  description:       string | null;
  workshop_name:     string | null;
}
export interface PendingPoleQCListResponse { ok: true; rows: PendingPoleQCItem[] }

export interface PoleGoodsReceiptInspectResult {
  ok: true; id: number; approvedPosted: boolean; unmappedProduct: boolean; rejectionHoldId: number | null;
}

export interface PolesSourceReport {
  ok: true;
  manufactured: { produced: number; accepted: number; rejected: number; reworked: number };
  purchased:    { purchased: number; accepted: number; rejected: number };
  resolvedQty:  number;
  inventoryQty: number;
  soldQty:      number;
  note:         string;
}

// ─── Deliveries ──────────────────────────────────────────────────────────────

export type DeliveryStatus =
  | 'Pending' | 'Assigned' | 'In Transit' | 'POD Recorded' | 'Failed';

export interface DeliveryOrder {
  id:                    number;
  order_number:          string;
  driver_name:           string;
  status:                DeliveryStatus;
  route?:                string;
  notes?:                string;
  qty_dispatched?:       number;
  qty_accepted?:         number;
  qty_rejected?:         number;
  rejection_reason?:     string;
  pod_recorded_at?:      string;
  delivery_date?:        string;
  created_at?:           string;
  vehicle_registration?: string;
  so_id?:                number;
  sales_order_number?:   string;
  customer_name?:        string;
  so_quantity?:          number;
  qty_accepted_total?:   number;
  qty_remaining?:        number;
  so_price_tax_type?:    string;
  created_by?:           string;
}

export interface MetaVehicle {
  id:                number;
  registration:      string;
  make?:             string;
  model?:            string;
  vehicle_category?: string;
  driver_assigned?:  string;
  status:            string;
}

export interface SalesOrderOption {
  id:                   number;
  order_number:         string;
  customer_name:        string;
  price_tax_type:       string;
  quantity:             number;
  qty_dispatched_total: number;
  qty_accepted_total:   number;
  qty_remaining:        number;
}

export interface DeliveryMetrics {
  total:       number;
  pending:     number;
  inTransit:   number;
  podRecorded: number;
}

export interface DeliveryListResponse {
  ok:          true;
  rows:        DeliveryOrder[];
  metrics:     DeliveryMetrics;
  vehicles:    MetaVehicle[];
  salesOrders: SalesOrderOption[];
}

// ─── Vehicle Fuel Logs ────────────────────────────────────────────────────────

export interface FuelLog {
  id:              number;
  registration:    string;
  liters:          number;
  cost_per_liter?: number;
  total_cost?:     number;
  odometer?:       number;
  log_date:        string;
  notes?:          string;
  logged_by?:      string;
}

export interface FuelLogListResponse {
  ok:   true;
  rows: FuelLog[];
}

// ─── Machine Fuel Logs ────────────────────────────────────────────────────────

export interface MachineFuelLog {
  id:              number;
  log_date:        string;
  date_fmt:        string;
  // Stabilization Phase 5 (F-21) — needed to pre-fill the Edit form's
  // machine/vehicle selector.
  machine_id?:     number | null;
  vehicle_id?:     number | null;
  operator?:       string;
  fuel_type:       string;
  quantity:        number;
  unit:            string;
  notes?:          string;
  machine_code?:   string;
  machine_name?:   string;
  plate_number?:   string;
  logged_by_name?: string;
}

export interface MachineFuelListResponse {
  ok:   true;
  rows: MachineFuelLog[];
}

export interface MachineFuelTarget {
  source:        'machine' | 'vehicle';
  id:            number;
  code:          string;
  label:         string;
  plate_number?: string;
}

export interface MachineFuelTargetsResponse {
  ok:   true;
  rows: MachineFuelTarget[];
}

// ─── Machine Daily Logs ───────────────────────────────────────────────────────

export interface MachineMeta {
  id:                   number;
  name:                 string;
  machine_code?:        string;
  category_name?:       string;
  production_capacity?: number;
  capacity_unit?:       string;
}

export interface MachineLog {
  id:               number;
  machine_id:       number;
  machine_name?:    string;
  machine_code?:    string;
  category_name?:   string;
  log_date:         string;
  shift?:           string;
  hours_worked?:    number;
  downtime_hours?:  number;
  downtime_reason?: string;
  fuel_consumed?:   number;
  fuel_issued?:     number;
  daily_production?: number;
  capacity_per_day?: number;
  product_type?:    string;
  item_category?:   string;
  logs_loaded?:     number;
  logs_unloaded?:   number;
  loading_trips?:   number;
  remarks?:         string;
}

export interface MachineLogListResponse {
  ok:             true;
  rows:           MachineLog[];
  machines:       MachineMeta[];
  itemCategories: { id: number; name: string }[];
}

// ─── Machine Registry ─────────────────────────────────────────────────────────

export type MachineStatus   = 'Available' | 'Running' | 'Maintenance' | 'Breakdown';
export type MachineFuelType = 'Diesel' | 'Petroleum/Essence' | 'DAT' | 'Petrol' | 'Chain Oil' | 'Engine Oil';

export interface MachineCategory {
  id:           number;
  name:         string;
  description?: string;
  icon?:        string;
}

export interface WorkshopRef {
  id:             number;
  name:           string;
  workshop_type?: string;
}

export interface Machine {
  id:                    number;
  machine_code:          string;
  name:                  string;
  category_id:           number;
  category_name:         string;
  workshop_id?:          number;
  workshop_name?:        string;
  status:                MachineStatus;
  plate_number?:         string;
  production_capacity:   number;
  capacity_unit:         string;
  fuel_consumption_rate: number;
  fuel_type?:            MachineFuelType;
  manufacturer?:         string;
  model_number?:         string;
  serial_number?:        string;
  year_manufactured?:    number;
  date_acquired?:        string;
  notes?:                string;
  next_maintenance?:     string;
}

export interface MachineMetrics {
  total:     number;
  available: number;
  running:   number;
  offline:   number;
}

export interface MachineListResponse {
  ok:         true;
  machines:   Machine[];
  categories: MachineCategory[];
  workshops:  WorkshopRef[];
  metrics:    MachineMetrics;
}

export interface MaintSchedule {
  id:               number;
  machine_id:       number;
  maintenance_type: string;
  frequency_days:   number;
  last_performed?:  string;
  next_due?:        string;
  estimated_hours:  number;
  notes?:           string;
}

export interface MachineDetailResponse {
  ok:        true;
  machine:   Machine;
  schedules: MaintSchedule[];
}

// Mechanician Phase 2 (Priority 3) — cross-machine Maintenance Schedule list.
export interface MaintScheduleWithMachine extends MaintSchedule {
  machine_name:         string;
  machine_code:         string;
  machine_status:       string;
  machine_workshop_id?: number;
}
export interface MaintScheduleListAllResponse {
  ok:         true;
  rows:       MaintScheduleWithMachine[];
  canManage:  boolean;
}

// Phase 1 Workshop parity fix — GET /api/machines/kpi-performance
export interface MachineKpiResult {
  machine_id:       number;
  kpi_id:            number;
  target_value:      number;
  kpi_code:          string;
  kpi_name:          string;
  unit:              string;
  higher_is_better:  boolean;
  actual:            number | null;
  achievement:       number | null;
}
export interface MachineKpiPerformanceRow {
  machine_id:           number;
  machine_code:         string;
  machine_name:         string;
  category_name:        string;
  production_capacity:  number;
  capacity_unit:        string;
  status:               MachineStatus;
  days_logged:          number;
  total_hours_worked:   number;
  total_downtime:       number;
  total_fuel:           number;
  total_production:     number;
  total_capacity:       number;
  total_logs_loaded:    number;
  total_logs_unloaded:  number;
  total_trips:          number;
  utilization_pct:      number;
  efficiency_pct:       number;
  kpiResults:           MachineKpiResult[];
  avgAchievement:       number | null;
}
export interface MachineKpiPerformanceResponse {
  ok:    true;
  rows:  MachineKpiPerformanceRow[];
  month: string;
}

export interface MachinePendingApproval {
  ok:              true;
  pendingApproval: true;
  level:           'leader' | 'manager';
  message:         string;
}

export interface MachineCategoryListResponse {
  ok:   true;
  rows: MachineCategory[];
}

// ─── Nyanza Value-Added Production ────────────────────────────────────────────
// Generalizes what was "VAT (Value-Added Timber)" — single row = one
// same-size treatment entry — into a batch + input/output-lines model that
// can manufacture a genuinely different Product Catalog item. See
// db/migrate.js createNyanzaValueAddedProduction() for the schema/rationale.

export interface VapAvailableInput {
  stock_item_id: number;
  name:          string;
  category:      string;
  uom:           string;
  available:     number;
}

export interface VapAvailableInputsResponse {
  ok:   true;
  rows: VapAvailableInput[];
}

export interface VapBatchInputLine {
  batch_id:        number;
  stock_item_id:   number;
  stock_item_name: string;
  quantity:        number;
}

export interface VapBatchOutputLine {
  id:                 number;
  batch_id:           number;
  output_product_id:  number;
  type:               string;
  sub_type:           string | null;
  size:               string;
  quantity:           number;
  status:             'pending_qc' | 'inspected';
  rework_of_rejection_id?: number | null;
  inspection_approved_qty?: number | null;
  inspection_rejected_qty?: number | null;
}

export interface VapBatch {
  id:                number;
  workshop_id:       number | null;
  batch_date:        string;
  date_fmt?:         string;
  production_type:   string | null;
  customer_id:       number | null;
  customer_name?:    string | null;
  order_reference:   string | null;
  operator:          string | null;
  supervisor:        string | null;
  start_time?:       string | null;
  end_time?:         string | null;
  downtime_minutes?: number | null;
  notes:             string | null;
  pending_deletion?: boolean;
  created_by_name?:  string;
  inputs:            VapBatchInputLine[];
  outputs:           VapBatchOutputLine[];
}

export interface VapBatchListResponse {
  ok:   true;
  rows: VapBatch[];
}

// ERP Enterprise Cross-Department Verification — useVatDelete existed but
// was never called from any screen; wiring it in now needs the same
// pendingApproval shape every other governed-delete hook already declares
// (see MachinePendingApproval/VehiclePendingApproval).
export interface VapPendingApproval {
  ok:              true;
  pendingApproval: true;
  level:           'leader' | 'manager';
  message:         string;
}

export interface VapInspectResult {
  ok: true; id: number; approvedPosted: boolean; unmappedProduct: boolean; rejectionHoldId: number | null;
}

export interface VapReconciliationRow {
  batchId: number; batchDate: string;
  inputQty: number; outputQty: number;
  outputAccepted: number; outputRejected: number; outputPendingQc: number;
  unitsComparable: boolean;
  reconciled: boolean | null;
  note: string | null;
}
export interface VapReconciliationResponse {
  ok: true; rows: VapReconciliationRow[]; unreconciledCount: number;
}

export interface VapReportResponse {
  ok: true;
  batchCount: number;
  inputConsumption: { stockItemId: number; name: string; totalConsumed: number }[];
  outputProduction: { productId: number; type: string; subType: string | null; size: string; totalProduced: number; totalAccepted: number }[];
}

export interface ShowroomInventoryRow {
  id: number; category: string; name: string; sku: string | null; uom: string; unit_cost: number; stock: number;
}
export interface ShowroomInventoryResponse { ok: true; rows: ShowroomInventoryRow[] }

export interface ShowroomDamageReportRow {
  id: number; stock_item_id: number; warehouse_id: number; quantity: number; reason: string;
  status: 'pending' | 'resolved'; resolution_id: number | null;
  stock_item_name: string | null; warehouse_name: string | null; reported_by_name: string | null;
  created_at: string; resolved_by: number | null; resolved_at: string | null;
}
export interface ShowroomDamageListResponse { ok: true; rows: ShowroomDamageReportRow[] }

export interface MonthlyDashboard {
  ok: true;
  month_key: string;
  status: 'pending' | 'approved';
  approved_at: string | null;
  approved_by_name: string | null;
  harvest?: { total_logs?: number; total_trees?: number; total_volume_m3?: number };
  sawmill?: { total_volume_m3?: number; total_production?: number };
  poles?: { total_purchase_requests?: number; total_delivered?: number };
  sales?: { total_orders?: number; total_revenue?: number };
  [key: string]: unknown;
}

// ─── Harvest ─────────────────────────────────────────────────────────────────

export interface HarvestEntry {
  id:              number;
  location?:       string;
  species:         string;
  quantity:        number;
  uom?:            string;
  notes?:          string;
  compt_id?:       number;
  sub_name?:       string;
  logs_crosscut?:  number;
  logs_handrolled?: number;
  harvest_date:    string;   // "DD/MM/YYYY"
  created_at?:     string;
  logged_by?:      string;
  compt_name?:     string;
}

export interface HarvestSummary {
  [species: string]: { trees: number; crosscut: number; handrolled: number };
}

export interface HarvestListResponse {
  ok:           true;
  rows:         HarvestEntry[];
  summary:      HarvestSummary;
  compartments: HarvestCompartment[];
}

export interface HarvestCompartment {
  id:                  number;
  compt_name:          string;
  sub_name?:           string;
  species?:            string;
  area_ha?:            number;
  volume_m3?:          number;
  status?:             string;
  trees_harvested?:    number;
  volume_harvested_m3?: number;
}

// Harvesting Phase 1 (Workstream 2); extended in Harvesting Phase 2
// (Workstreams 2/3/4/5) with planning, productivity, and pipeline visibility.
export interface HarvestDashboardResponse {
  ok:                     true;
  todayHarvest:           number;
  weeklyHarvest:          number;
  monthlyHarvest:         number;
  logsProduced:           number;
  volumeProducedM3:       number;
  activeCompartments:     number;
  completedCompartments:  number;
  transportWaiting:       number;
  rawLogInventory:        number;
  dailyProductivityM3:    number;
  weeklyProductivityM3:   number;
  monthlyProductivityM3:  number;
  plannedVolumeM3:        number;
  actualVolumeM3:         number;
  plannedLogs:             number;
  actualLogs:              number;
  planningSummary: {
    planned:    number;
    inProgress: number;
    completed:  number;
    delayed:    number;
  };
  todaysSchedule: {
    id: number; species: string; status: string; priority: string;
    comptName: string | null; targetVolumeM3: number | null; targetLogs: number | null;
  }[];
  pipeline: {
    logsHarvested:         number;
    logsTransported:       number;
    logsConsumedBySawmill: number;
  };
}

// ─── Harvest Planning (Harvesting Phase 2, Workstream 1) ──────────────────────

export interface HarvestPlan {
  id:                number;
  compt_id?:         number;
  sub_name?:         string;
  species:           string;
  priority:          string;   // 'low' | 'normal' | 'high' | 'urgent'
  status:            string;   // 'Planned' | 'In Progress' | 'Completed' | 'Cancelled'
  notes?:            string;
  planned_date:      string;   // "DD/MM/YYYY"
  target_volume_m3?: number;
  target_logs?:      number;
  compt_name?:       string;
  created_by_name?:  string;
  actual_logs:       number;
  actual_volume_m3:  number;
  is_delayed:        boolean;
}

export interface HarvestPlanListResponse {
  ok:   true;
  rows: HarvestPlan[];
}

// ─── Active Harvest Operations / Production Performance / Delays
//     (Harvesting Phase 3) ─────────────────────────────────────────────────────

export interface HarvestOperationCompartment {
  id:              number;
  comptName:       string;
  subName:         string | null;
  species:         string | null;
  areaHa:          number | null;
  volumeM3:        number | null;
  status:          string;
  logsCrosscut:    number;
  treesHarvested:  number;
  bucket:          'waitingToStart' | 'inProgress' | 'completed' | 'delayed';
}

export interface HarvestOperationsResponse {
  ok:           true;
  compartments: HarvestOperationCompartment[];
  counts: {
    waitingToStart: number;
    inProgress:     number;
    completed:      number;
    delayed:        number;
  };
}

export interface HarvestTrendPoint {
  label:    string;
  volumeM3: number;
}

export interface HarvestPerformanceResponse {
  ok:                  true;
  volumeByCompartment: { comptName: string; volumeM3: number; logs: number }[];
  dailyTrend:          HarvestTrendPoint[];
  weeklyTrend:         HarvestTrendPoint[];
  monthlyTrend:        HarvestTrendPoint[];
  plannedVolumeM3:     number;
  actualVolumeM3:      number;
  achievementPct:      number | null;
  varianceM3:          number;
}

export interface HarvestDelay {
  id:                number;
  category:          string;
  duration_hours?:   number;
  production_impact?: string;
  created_at:        string;   // "DD/MM/YYYY HH:MM"
  compt_name?:       string;
  logged_by_name?:   string;
}

export interface HarvestDelayListResponse {
  ok:         true;
  rows:       HarvestDelay[];
  categories: string[];
}

// ─── Decision Support / Executive Reporting Extras (Harvesting Phase 4) ──────

export interface HarvestRankedCompartment {
  comptName: string;
  species:   string | null;
  logs:      number;
  volumeM3:  number;
}

export interface HarvestDecisionSupportResponse {
  ok:                      true;
  topCompartments:         HarvestRankedCompartment[];
  bottomCompartments:      HarvestRankedCompartment[];
  mostDelayedCompartments: { comptName: string; delayCount: number; totalHours: number }[];
  highestProductionDays:   HarvestTrendPoint[];
  lowestProductionDays:    HarvestTrendPoint[];
  speciesRanking:          { species: string; trees: number; logs: number; volumeM3: number }[];
}

export interface HarvestExecutiveExtrasResponse {
  ok: true;
  planningAccuracy: {
    totalPlans:         number;
    completedPlans:     number;
    cancelledPlans:     number;
    openPlans:          number;
    completionRatePct:  number | null;
    onSchedulePct:      number | null;
  };
  delayAnalysis: {
    byCategory:         { category: string; count: number; hours: number }[];
    totalDelayHours:    number;
    mostCommonCategory: string | null;
  };
}

// ─── Log Transport ────────────────────────────────────────────────────────────

export interface LogTransportEntry {
  id:               number;
  transport_date:   string;
  date_fmt?:        string;   // "DD/MM/YYYY"
  qty_transported:  number;
  unit?:            string;
  notes?:           string;
  compt_id?:        number;
  sub_name?:        string;
  tractor_plate?:   string;
  loggers_number?:  string;
  created_at?:      string;
  compt_name?:      string;
  species?:         string;
  logged_by_name?:  string;
}

export interface LogTransportListResponse {
  ok:     true;
  rows:   LogTransportEntry[];
  totals: {
    totalLogsHarvested:  number;
    totalLogsTransported: number;
    remainingLogs:       number;
    totalVolumeM3:       number;
  };
}

// ─── Compartments (meta) — full definition added later in this file ───────────

// ─── Sawmill / Daily Log ──────────────────────────────────────────────────────

// Sawmill Timber Entry enhancement — a single production entry can now yield
// multiple timber sizes (one log doesn't always produce just one size).
export interface DailyLogTimberSize {
  widthMm:     number;
  thicknessMm: number;
  lengthM:     number;
  quantity:    number;
  volumeM3:    number;
}

export interface DailyLog {
  id:                 number;
  date:               string;  // "DD/MM/YYYY"
  machine?:           string;
  product_size?:      string;
  timber_units?:      number;
  timber_kiln_dried?: number;
  timber_cca_treated?: number;
  timber_untreated?:  number;
  timber_waste?:      number;
  poles_units?:       number;
  poles_waste?:       number;
  downtime_hours?:    number;
  downtime_reason?:   string;
  logs_received?:     number;
  supervisor?:        string;
  operators?:         string;
  remarks?:           string;
  pending_deletion?:  boolean;
  // Sawmill Timber Entry enhancement
  log_diameter_cm?:   number;
  start_time?:        string;  // 'HH:MM'
  end_time?:          string;  // 'HH:MM'
  timberSizes?:       DailyLogTimberSize[];
  actualVolumeM3?:    number;
  expectedVolumeM3?:  number;
}

export interface DailyListResponse {
  ok:        true;
  rows:      DailyLog[];
  stock:     Record<string, unknown>;
  transport: { todayTransported: number; annualTransported: number };
  // Sawmill Timber Entry enhancement — cumulative inbound log-yard stock
  // (harvested & transported, not yet processed), replacing the old
  // same-day log_transport requirement.
  availableLogStock: number;
  // Sawmill Phase 3 (Workstream 1) — pagination metadata.
  totalCount?: number;
  limit?:      number;
  offset?:     number;
}

// ─── Sawmill Phase 3 — Sawmill Manager Dashboard ───────────────────────────────

export interface SawmillDashboardPeriod { units: number; logs: number; waste: number; downtimeHours?: number }
export interface SawmillProductionTrendPoint { date: string; units: number; logs: number }
export interface SawmillWeeklyTrend {
  trend: { total_slope: number; total_intercept: number; total_r2: number; timber_slope: number; poles_slope: number; total_avg: number; last_x: number; n: number };
  history: Array<{ week: string; timber: number; poles: number }>;
  forecast: number[];
  pct_change_4w: number;
}
export interface SawmillByProductRow { productId: number; type: string; subType: string | null; size: string; unitsMonth: number }
export interface SawmillByDimensionRow { widthMm: number; thicknessMm: number; lengthM: number; unitsMonth: number }
export interface SawmillAlert { type: string; severity: 'critical' | 'high' | 'medium' | 'low'; message: string }

export interface SawmillDashboardResponse {
  ok: true;
  today: SawmillDashboardPeriod;
  week:  SawmillDashboardPeriod;
  month: SawmillDashboardPeriod;
  recoveryPctMonth: number | null;
  wastePctMonth: number;
  expectedVolMonth: number;
  actualVolMonth: number;
  rawTimberAvailable: number;
  finishedTimberAvailable: number;
  productionTrend: SawmillProductionTrendPoint[];
  weeklyTrend: SawmillWeeklyTrend;
  byProduct: SawmillByProductRow[];
  byDimension: SawmillByDimensionRow[];
  alerts: SawmillAlert[];
}

// ─── Material Requests ────────────────────────────────────────────────────────

export interface MaterialRequest {
  id:            number;
  item_name:     string;
  category?:     string;
  uom?:          string;
  workshop_name?: string;
  workshop_id?:  number;
  requested_qty: number;
  approved_qty?: number;
  reason?:       string;
  priority:      'normal' | 'urgent' | 'critical';
  status:        'pending' | 'approved' | 'rejected' | 'partial' | 'completed';
  review_notes?: string;
  requested_by?: string;
  reviewed_by?:  string;
  requested_at:  string;
  reviewed_at?:  string;
  needed_by?:    string | null;
  // UI/UX redesign — read-only lookup of the linked Stock Transfer; Stock
  // Transfer remains the sole owner of this data/logic, this is just a join.
  transfer_id?:                     number | null;
  transfer_status?:                 string | null;
  transfer_reference?:              string | null;
  transfer_from_warehouse_name?:    string | null;
  transfer_to_warehouse_name?:      string | null;
  transfer_dispatched_qty?:         number | null;
  transfer_received_qty?:           number | null;
  transfer_discrepancy_qty?:        number | null;
  transfer_discrepancy_notes?:      string | null;
}

export interface StockItemRef {
  id:       number;
  name:     string;
  category?: string;
  uom?:     string;
  total_stock?: number;
}

export interface MaterialRequestsListResponse {
  ok:               true;
  rows:             MaterialRequest[];
  items:            StockItemRef[];
  workshops:        { id: number; name: string }[];
  user_workshop_id?: number;
}

// Mechanician Phase 1 (Priority 5) — tailored dashboard. Mirrors desktop's
// mechanicianDashboard() shape.
export interface MechanicianDashboardWidgetItem {
  [key: string]: unknown;
}
export interface MechanicianDashboardResponse {
  ok:  true;
  kpi: {
    myTotalRequests: number;
    myPending:       number;
    myApproved:      number;
    myRejected:      number;
    // Mechanician Phase 3
    openJobs:           number;
    assignedJobs:       number;
    waitingForParts:    number;
    completedJobsToday: number;
    // Mechanician Phase 4
    inProgressCount:      number;
    testingCount:         number;
    externalRepairCount:  number;
  };
  widgets: {
    myRecentRequests:           MechanicianDashboardWidgetItem[];
    machinesRequiringAttention: MechanicianDashboardWidgetItem[];
    upcomingMaintenance:        MechanicianDashboardWidgetItem[];
    // Mechanician Phase 2
    myMaintenanceActivity:      MechanicianDashboardWidgetItem[];
    myFuelActivity:             MechanicianDashboardWidgetItem[];
    // Mechanician Phase 3
    overdueMaintenance:         MechanicianDashboardWidgetItem[];
    myJobs:                     MechanicianDashboardWidgetItem[];
  };
}

// ─── Maintenance Jobs (Mechanician Phase 3) ─────────────────────────────────────
export type MaintenanceJobStatus =
  | 'inspection' | 'diagnosis' | 'assigned' | 'in_progress' | 'waiting_parts'
  | 'external_repair' | 'testing' | 'returned_to_service' | 'closed' | 'cancelled';

export interface MaintenanceJob {
  id:                          number;
  machine_id:                  number;
  machine_code:                string;
  machine_name:                string;
  workshop_id?:                number;
  workshop_name?:               string;
  title:                       string;
  description?:                string;
  priority:                    'normal' | 'high' | 'urgent';
  status:                      MaintenanceJobStatus;
  assigned_to?:                number;
  assigned_to_name?:            string;
  assigned_at?:                 string;
  started_at?:                  string;
  returned_to_service_at?:      string;
  completed_at?:                string;
  delay_reason?:                string;
  cancelled_reason?:            string;
  external_repair_vendor?:      string;
  external_repair_reason?:      string;
  external_repair_sent_at?:     string;
  external_repair_returned_at?: string;
  external_repair_cost?:        number;
  external_repair_notes?:       string;
  notes?:                      string;
  created_at:                  string;
}

export interface MaintenanceJobsListResponse {
  ok:        true;
  rows:      MaintenanceJob[];
  canManage: boolean;
}

export interface MaintenanceJobLabourEntry {
  id:                number;
  job_id:            number;
  technician_id?:     number;
  technician_name?:   string;
  start_time?:        string;
  finish_time?:        string;
  hours_worked?:       number;
  notes?:             string;
  delay_reason?:       string;
}

export interface MaintenanceJobPartLine {
  id:               number;
  item_id:          number;
  item_name:        string;
  unit_cost:        number;
  requested_qty:    number;
  approved_qty?:     number;
  status:           string;
  transfer_id?:      number;
  transfer_status?:  string;
  received_qty?:      number;
}

export interface MaintenanceProductionImpact {
  id:                         number;
  job_id:                     number;
  log_date:                   string;
  downtime_hours?:             number;
  reason?:                    string;
  estimated_production_loss?:  number;
  comments?:                  string;
  recorded_by_name?:           string;
}

export interface MaintenanceJobDetailResponse {
  ok:               true;
  job:              MaintenanceJob;
  labour:           MaintenanceJobLabourEntry[];
  parts:            MaintenanceJobPartLine[];
  productionImpact: MaintenanceProductionImpact[];
  canManage:        boolean;
  cost: {
    partsCostActual:    number;
    partsCostPending:   number;
    labourHours:        number;
    externalRepairCost: number;
    totalCost:          number;
  };
}

// Mechanician Phase 4 — Waiting for Parts dedicated view row (enriched job +
// linked material request + transfer, mirrors maintenanceWaitingForPartsList).
export interface MaintenanceWaitingForPartsRow {
  id:                number;
  title:             string;
  delay_reason?:      string;
  assigned_to?:       number;
  assigned_to_name?:  string;
  machine_code:      string;
  machine_name:      string;
  workshop_id?:       number;
  request_id?:        number;
  request_status?:    string;
  requested_qty?:      number;
  approved_qty?:       number;
  item_name?:         string;
  transfer_id?:        number;
  transfer_status?:    string;
  dispatched_qty?:     number;
  received_qty?:       number;
}

export interface MaintenanceWaitingForPartsResponse {
  ok:   true;
  rows: MaintenanceWaitingForPartsRow[];
}

// Mechanician Phase 4 — per-machine Asset Summary card (reuses existing data
// only: job counts, schedule due dates, daily-log downtime, cost formula).
export interface MaintenanceAssetSummaryResponse {
  ok:                          true;
  machine:                     { id: number; machine_code: string; name: string; status: string; workshop_id?: number; category_name?: string; workshop_name?: string };
  openMaintenance:             number;
  lastMaintenance:             string | null;
  nextPreventiveMaintenance:   string | null;
  downtimeHoursThisMonth:      number;
  recentFailures90d:           number;
  externalRepairActive:        boolean;
  maintenanceCostSummary:      number;
  recentJobs:                  { id: number; title: string; status: MaintenanceJobStatus; priority: string; created_at: string }[];
}

export interface StockItemsResponse {
  ok:   true;
  rows: StockItemRef[];
}

// ─── Governance (Pending Edit / Deletion Request) ─────────────────────────────
// ERP Enterprise Completion Phase 4 — mirrors db/services/data.js's
// pendingEditsList/deletionRequestsList row shapes exactly.

export type GovernanceLevel  = 'leader' | 'manager';
export type PendingEditStatus = 'Pending' | 'Approved' | 'Rejected';
export type DeletionRequestStatus = 'pending' | 'approved' | 'rejected';

export interface PendingEditRequest {
  id:                 number;
  action_type:        'edit' | 'delete';
  entity_type:        string;
  entity_id:          number;
  entity_ref:         string | null;
  payload:            Record<string, any> | null;
  old_snapshot:       Record<string, any> | null;
  status:             PendingEditStatus;
  review_notes:       string | null;
  required_level:     GovernanceLevel;
  auto_generated:     boolean;
  submitted_at:       string;
  reviewed_at:        string | null;
  submitted_by_name:  string | null;
  reviewed_by_name:   string | null;
}

export interface PendingEditsListResponse {
  ok:   true;
  rows: PendingEditRequest[];
}

export interface DeletionRequestItem {
  id:                 number;
  table_name:         string;
  record_id:          number;
  entity_type:        string;
  entity_ref:         string | null;
  deletion_reason:    string | null;
  requested_by:       number;
  requested_at_fmt:   string;
  status:             DeletionRequestStatus;
  reviewed_by:        number | null;
  review_notes:       string | null;
  required_level:     GovernanceLevel;
  requested_by_name:  string | null;
  reviewed_by_name:   string | null;
}

export interface DeletionRequestsListResponse {
  ok:   true;
  rows: DeletionRequestItem[];
}

// ─── Casual Labour ────────────────────────────────────────────────────────────

export interface CasualLabourRequest {
  id:               number;
  start_date:       string;
  end_date:         string;
  task:             string;
  num_casuals:      number;
  labour_items?:    string | string[];
  description?:     string;
  comments?:        string;
  status:           'Pending' | 'Approved' | 'Rejected';
  start_fmt?:       string;
  end_fmt?:         string;
  created_fmt?:     string;
  created_by_name?: string;
  reviewed_by_name?: string;
}

export interface CasualLabourListResponse {
  ok:   true;
  rows: CasualLabourRequest[];
}

// ─── Products ────────────────────────────────────────────────────────────────

export type ProductType    = 'Timber' | 'Poles' | 'Manufactured Product';
export type ProductSubType = 'Kiln-dried' | 'CCA-treated' | 'Untreated';

export interface Product {
  id:          number;
  type:        ProductType;
  sub_type:    ProductSubType | null;
  size:        string;           // e.g. "100x200x4m" or "O255x9m"
  width_mm:    number | null;
  height_mm:   number | null;
  length_m:    number | null;
  diameter_mm: number | null;
  machine:     string | null;
  active:      boolean;
  reason:      string | null;
  ref:         string | null;
  by:          string | null;    // created_by user name (joined)
  date:        string;           // 'DD Mon YYYY'
  standard_cost: number | null;
  default_price: number | null;
  stock_item_id: number | null;
  standard_cost_approved_by:      string | null;
  standard_cost_approved_at:      string | null;
  standard_cost_effective_date:   string | null;
  default_price_approved_by:      string | null;
  default_price_approved_at:      string | null;
  default_price_effective_date:   string | null;
}

export interface ProductListResponse {
  ok:      true;
  rows:    Product[];
  isAdmin: boolean;  // true when role is ceo or operations — controls toggle button visibility
}

export interface ProductActiveItem {
  id:       number;
  type:     string;
  sub_type: string | null;
  size:     string;
  machine:  string | null;
}

export interface ProductActiveResponse {
  ok:   true;
  rows: ProductActiveItem[];
}

// ─── Vehicles ────────────────────────────────────────────────────────────────

export type VehicleOwnership  = 'Company Car' | 'Third-Party Car';
export type VehicleStatus     = 'Active' | 'In Maintenance' | 'Inactive';
export type VehicleCategory   = 'Pickup' | 'Truck' | 'Van' | 'Bus' | 'Lorry' | 'Motorcycle' | 'Excavator' | 'Tractor' | 'Other';
export type VehicleFuelType   = 'Diesel' | 'Petrol' | 'Electric' | 'Hybrid';
export type MaintenanceType   = 'Scheduled' | 'Corrective' | 'Inspection';
export type VehicleOwnerType  = 'Individual' | 'Company';
export type VehiclePayMethod  = 'Monthly' | 'Weekly' | 'Per Trip' | 'Per Day' | 'Fixed Contract';

export interface Vehicle {
  id:                    number;
  registration:          string;
  make:                  string | null;
  model:                 string | null;
  vehicle_type:          string | null;
  status:                VehicleStatus;
  fuel_type:             VehicleFuelType | null;
  insurance_expiry:      string | null;   // ISO date string
  road_license_expiry:   string | null;
  inspection_expiry:     string | null;
  notes:                 string | null;
  ownership_type:        VehicleOwnership | null;
  vehicle_category:      VehicleCategory | null;
  year:                  number | null;
  chassis_vin:           string | null;
  engine_number:         string | null;
  odometer_reading:      number | null;
  asset_code:            string | null;
  purchase_date:         string | null;
  purchase_cost:         number | null;
  department:            string | null;
  driver_assigned:       string | null;
  // Third-Party fields
  owner_name:            string | null;
  owner_type:            VehicleOwnerType | null;
  owner_id_number:       string | null;
  owner_phone:           string | null;
  owner_email:           string | null;
  owner_address:         string | null;
  contract_number:       string | null;
  contract_start_date:   string | null;
  contract_end_date:     string | null;
  payment_rate:          number | null;
  payment_method:        VehiclePayMethod | null;
  assigned_project:      string | null;
  driver_name:           string | null;
  driver_phone:          string | null;
  driver_license_number: string | null;
  driver_license_expiry: string | null;
  // Aggregated server-side
  total_fuel_cost:       number;
  total_liters:          number;
  maintenance_count:     number;
}

export interface VehicleMetrics {
  fleet:            number;
  active:           number;
  maintenance:      number;
  fuelCost:         number;
  expiredInsurance: number;
}

export interface VehicleListResponse {
  ok:      true;
  rows:    Vehicle[];
  metrics: VehicleMetrics;
}

// Fleet & Equipment Phase 2 — executive dashboard (vehicles + machines
// combined). Mirrors desktop's fleetDashboard() shape exactly.
export interface FleetDashboardKpi {
  totalVehicles: number; activeVehicles: number; vehiclesInMaintenance: number; vehiclesOutOfService: number;
  totalMachines: number; activeMachines: number;
  fuelLitersThisMonth: number; fuelCostThisMonth: number; maintenanceCostThisMonth: number;
  openMaintenanceJobs: number; availableFleetPct: number; utilizationPct: number;
}
export interface FleetDashboardWidgetItem {
  [key: string]: unknown;
}
export interface FleetDashboardResponse {
  ok: true;
  kpi: FleetDashboardKpi;
  widgets: {
    vehiclesNeedingMaintenance: FleetDashboardWidgetItem[];
    machinesRequiringAttention: FleetDashboardWidgetItem[];
    recentFuelActivity: FleetDashboardWidgetItem[];
    recentMaintenance: FleetDashboardWidgetItem[];
    assignedVehicles: FleetDashboardWidgetItem[];
    pendingApprovals: FleetDashboardWidgetItem[];
    recentActivity: FleetDashboardWidgetItem[];
  };
}

// Fleet & Equipment Phase 3 — operational intelligence (trends, top lists,
// cross-department visibility). Mirrors desktop's fleetIntelligence() shape.
export interface FleetTrendMonth {
  month: string;
  count?: number;
  liters?: number;
  cost: number;
}
export interface FleetIntelligenceListItem {
  [key: string]: unknown;
}
export interface FleetIntelligenceResponse {
  ok: true;
  trends: {
    maintenanceMonths: FleetTrendMonth[];
    fuelMonths: FleetTrendMonth[];
  };
  maintenance: {
    completedThisMonth: number;
    upcoming: FleetIntelligenceListItem[];
    overdue: FleetIntelligenceListItem[];
  };
  fuel: {
    topConsumers: FleetIntelligenceListItem[];
    byDepartment: FleetIntelligenceListItem[];
  };
  vehicleIntelligence: {
    mostUtilized: FleetIntelligenceListItem[];
    leastUtilized: FleetIntelligenceListItem[];
    highestMaintenanceFrequency: FleetIntelligenceListItem[];
    recentlyInactive: FleetIntelligenceListItem[];
    attentionRequired: FleetIntelligenceListItem[];
  };
  crossDepartment: {
    topDispatchedVehicles: FleetIntelligenceListItem[];
    workshopMaintenanceThisMonth: number;
  };
  costSummary: {
    totalOperatingCostThisMonth: number;
  };
}

export interface MaintenanceRecord {
  id:               number;
  registration:     string;
  maintenance_type: MaintenanceType;
  description:      string;
  cost:             number | null;
  maintenance_date: string;        // 'DD/MM/YYYY'
  next_due_date:    string | null;
  performed_by:     string | null;
  notes:            string | null;
  pending_deletion: boolean;
}

export interface VehicleDetailResponse {
  ok:          true;
  vehicle:     Vehicle;
  fuelLogs:    FuelLog[];
  maintenance: MaintenanceRecord[];
}

export interface TransportDropdownItem {
  id:   number;
  name: string;
}

export interface TransportDropdownResponse {
  ok:   true;
  rows: TransportDropdownItem[];
}

export interface VehiclePendingApproval {
  ok:              true;
  pendingApproval: true;
  level:           'leader' | 'manager';
  message:         string;
}

// ─── Customers ───────────────────────────────────────────────────────────────

export interface Customer {
  id:               number;
  name:             string;
  contact_person:   string | null;
  phone:            string | null;
  email:            string | null;
  address:          string | null;
  tin:              string | null;
  notes:            string | null;
  active:           boolean;
  created_at:       string;      // 'DD Mon YYYY' from server
  created_by:       string | null; // creator's name (joined from app_users)
}

export interface CustomerDropdownItem {
  id:             number;
  name:           string;
  contact_person: string | null;
  phone:          string | null;
}

export interface CustomerListResponse {
  ok:   true;
  rows: Customer[];
}

export interface CustomerDropdownResponse {
  ok:   true;
  rows: CustomerDropdownItem[];
}

// Returned when a customer edit is queued for governance approval instead of
// being applied immediately (data.js applyGovernance → pendingApproval: true).
export interface CustomerPendingApproval {
  ok:              true;
  pendingApproval: true;
  level:           'leader' | 'manager';
  message:         string;
}

// ─── Casuals (casual worker registry) — HR Enterprise Phase 1 ────────────────
// Mirrors data.js casualsList's SELECT exactly (db/services/data.js ~11208).
export interface CasualWorker {
  id:                       number;
  full_name:                string;
  national_id:              string | null;
  phone:                    string | null;
  gender:                   string | null;
  date_of_birth:            string | null;
  address:                  string | null;
  department:               string | null;
  work_location:            string | null;
  job_role:                 string | null;
  supervisor:                string | null;
  start_date:               string | null;
  end_date:                 string | null;
  emergency_name:           string | null;
  emergency_relationship:   string | null;
  emergency_phone:          string | null;
  salary_per_action:        number | null;
  active:                   boolean;
  start_fmt:                string | null;
  end_fmt:                  string | null;
  created_fmt:              string | null;
}

export interface CasualWorkerListResponse {
  ok:   true;
  rows: CasualWorker[];
}

// ─── Attendance — HR Enterprise Phase 2 ───────────────────────────────────────
export type AttendancePersonType = 'user' | 'casual';
export type AttendanceStatus = 'Present' | 'Absent' | 'Late' | 'Half Day' | 'Leave' | 'Off Day';

export interface AttendanceRosterRow {
  person_id:      number;
  name:           string;
  sub_label:      string | null;
  attendance_id:  number | null;
  status:         AttendanceStatus | null;
  check_in:       string | null;
  check_out:      string | null;
  notes:          string | null;
  person_type:    AttendancePersonType;
}

export interface AttendanceRosterResponse {
  ok:         true;
  workshopId: number;
  date:       string;
  employees:  AttendanceRosterRow[];
  casuals:    AttendanceRosterRow[];
}

export interface AttendanceRecord {
  id:               number;
  attendance_date:  string;
  workshop_id:      number | null;
  workshop_name:    string | null;
  user_id:          number | null;
  casual_id:        number | null;
  person_name:      string;
  person_type:      AttendancePersonType;
  status:           AttendanceStatus;
  check_in:         string | null;
  check_out:        string | null;
  notes:            string | null;
  hours:            number | null;
  created_by:       number | null;
  created_by_name:  string | null;
  created_at:       string;
  updated_at:       string | null;
}

export interface AttendanceListResponse {
  ok:   true;
  rows: AttendanceRecord[];
}

export interface AttendanceDashboardResponse {
  ok:             true;
  date:           string;
  workshopId:     number | null;
  present:        number;
  absent:         number;
  late:           number;
  halfDay:        number;
  leave:          number;
  offDay:         number;
  casualsPresent: number;
  totalHours:     number;
  rosterSize:     number;
  marked:         number;
  unmarked:       number;
  attendanceRate: number | null;
}

export interface AttendanceReportResponse {
  ok: true;
  rows: AttendanceRecord[];
  summary: {
    totalRecords: number;
    totalHours: number;
    hoursKnownRecords: number;
    [statusCount: string]: number; // countPresent, countAbsent, countLate, countHalfDay, countLeave, countOffDay
  };
}

// ─── Payroll (Payroll Enterprise Phase 2) ──────────────────────────────────────
// Deliberately narrow mobile scope — review/approve/inspect only. Rate
// setting, period creation/calculation, and adjustment creation are
// desktop-only (see PayrollStack comment in navigation/types.ts).

export type PayrollPeriodStatus =
  'draft' | 'calculating' | 'pending_approval' | 'approved' | 'rejected' | 'exported' | 'closed';

export interface PayrollPeriod {
  id:              number;
  workshop_id:     number | null;
  workshop_name:   string | null;
  start_date:      string;
  end_date:        string;
  status:          PayrollPeriodStatus;
  notes:           string | null;
  created_by:      number | null;
  created_by_name: string | null;
  created_at:      string;
  closed_by:       number | null;
  closed_by_name:  string | null;
  closed_at:       string | null;
  line_count:      number;
  total_net:       number;
}

export interface PayrollLine {
  id:                   number;
  period_id:            number;
  user_id:              number | null;
  casual_id:            number | null;
  person_name:          string;
  person_type:          'user' | 'casual';
  workshop_id:          number | null;
  workshop_name:        string | null;
  rate_type_snapshot:   string;
  rate_amount_snapshot: number;
  source_qty:           number;
  source_summary?:      { note?: string; attendance?: { attendance_id: number; date: string; status: string; hours: number | null }[] };
  gross_amount:         number;
  adjustments_total:    number;
  net_amount:           number;
  status:               string;
  created_at:           string;
  updated_at:           string | null;
  // Only present on payrollLineDetail (not the list)
  start_date?:          string;
  end_date?:            string;
  period_status?:       PayrollPeriodStatus;
}

export interface PayrollAdjustment {
  id:               number;
  line_id:          number;
  category:         'bonus' | 'deduction' | 'correction' | 'other';
  amount:           number;
  reason:           string;
  status:           'pending' | 'approved' | 'rejected';
  created_by:       number | null;
  created_by_name:  string | null;
  created_at:       string;
  approved_by:      number | null;
  approved_by_name: string | null;
  approved_at:      string | null;
}

export interface PayrollApprovalStep {
  stage_key:        string;
  stage_order:      number;
  status:           string;
  assigned_role:    string;
  approved_by:      number | null;
  approved_by_name: string | null;
  approved_at:      string | null;
  notes:            string | null;
}

export interface PayrollPeriodListResponse { ok: true; rows: PayrollPeriod[]; }
export interface PayrollLineListResponse   { ok: true; rows: PayrollLine[]; }
export interface PayrollAdjustmentListResponse { ok: true; rows: PayrollAdjustment[]; }
export interface PayrollPeriodDetailResponse {
  ok: true;
  period: PayrollPeriod;
  lines: PayrollLine[];
  approvalSteps: PayrollApprovalStep[];
}
export interface PayrollLineDetailResponse {
  ok: true;
  line: PayrollLine;
  adjustments: PayrollAdjustment[];
}

// ─── My Requests ──────────────────────────────────────────────────────────────

export interface MyRequest {
  id:           number;
  action_type:  string;
  entity_type:  string;
  entity_ref:   string;
  status:       string;
  review_notes?: string;
  submitted_at: string;
  reviewed_at?: string;
  reason?:      string;
}

export interface MyRequestsResponse {
  ok:        true;
  edits:     MyRequest[];
  deletions: MyRequest[];
}

// ─── Compartments ────────────────────────────────────────────────────────────

export type CompartmentStatus = 'Active' | 'Completed';

export interface Compartment {
  id:                  number;
  compt_name:          string;
  sub_name?:           string;
  species:             string;
  area_ha:             number;
  volume_m3:           number;
  status:              CompartmentStatus;
  entry_date:          string;   // 'DD/MM/YYYY'
  created_at?:         string;
  created_by_name?:    string;
  trees_harvested:     number;
  logs_harvested:      number;
  volume_harvested_m3: number;
  pending_deletion:    boolean;
}

export interface CompartmentMetrics {
  total:            number;
  active:           number;
  totalAreaHa:      number;
  totalVolumeM3:    number;
  totalHarvestedM3: number;
}

export interface CompartmentListResponse {
  ok:      true;
  rows:    Compartment[];
  metrics: CompartmentMetrics;
}

export interface CompartmentPendingApproval {
  ok:              true;
  pendingApproval: true;
  message:         string;
}

// ─── Workshops ────────────────────────────────────────────────────────────────

export type WorkshopType =
  | 'Sawmill Workshop'
  | 'Logging Equipment Workshop'
  | 'Vehicle Workshop'
  | 'Pole Treatment Workshop'
  | 'Electrical Workshop'
  | 'Central Warehouse';

export interface Workshop {
  id:            number;
  name:          string;
  location?:     string;
  workshop_type?: WorkshopType;
  capacity?:     number;
  notes?:        string;
  active:        boolean;
  created_at:    string;
}

export interface WorkshopMetrics {
  total:    number;
  active:   number;
  inactive: number;
  capacity: number;
}

export interface WorkshopListResponse {
  ok:                true;
  workshops:         Workshop[];
  allWarehouses:     { id: number; name: string; workshop_type?: string }[];
  user_workshop_id?: number;
  metrics:           WorkshopMetrics;
}

export interface OverviewWorkshopCard {
  id:                   number;
  name:                 string;
  location?:            string;
  workshop_type?:       string;
  active:               boolean;
  item_count:           number;
  stock_value:          number;
  machine_count:        number;
  machines_available:   number;
  machines_maintenance: number;
}

export interface PendingTransfer {
  id:            number;
  item_name:     string;
  uom:           string;
  from_workshop: string;
  to_workshop:   string;
  quantity:      number;
  notes?:        string;
  created_at:    string;
  requested_by:  string;
}

export interface PendingMaterialRequest {
  id:            number;
  item_name:     string;
  uom:           string;
  workshop_name: string;
  workshop_id?:  number;
  requested_qty: number;
  priority:      string;
  reason?:       string;
  requested_at:  string;
  requested_by:  string;
}

export interface LowStockItem {
  name:           string;
  category:       string;
  uom:            string;
  min_stock:      number;
  total_stock:    number;
  warehouse_name: string;
  warehouse_id:   number;
}

// Phase 1/2 Workshop — Finance visibility + Executive KPIs/Operational Widgets
export interface WorkshopFinanceVisibility {
  maintenanceCostThisMonth:        number;
  maintenanceRecordCountThisMonth: number;
  maintenanceCostByType:           { type: string; total: number; count: number }[];
}
export interface MaintenanceScheduleAlert {
  id:            number;
  machine_id:    number;
  machine_code:  string;
  machine_name:  string;
  maintenance_type: string;
  next_due:      string;
}
export interface EquipmentAlert {
  id:           number;
  machine_code: string;
  name:         string;
  status:       string;
}
export interface WorkshopFleetAlert {
  id:                   number;
  vehicle_registration: string;
  maintenance_type:     string;
  next_due_date:        string;
}
export interface WorkshopNotification {
  action:      string;
  icon:        string | null;
  created_at:  string;
  module:      string;
  action_type: string | null;
  full_name:   string | null;
  username:    string | null;
}

export interface WorkshopCostTrendMonth {
  month: string;
  total: number;
}
export interface WorkshopMaintenanceTrendMonth {
  month: string;
  cnt:   number;
}

export interface WorkshopOverviewResponse {
  ok:                true;
  workshops:         OverviewWorkshopCard[];
  pendingTransfers:  PendingTransfer[];
  pendingRequests:   PendingMaterialRequest[];
  lowStock:          LowStockItem[];
  user_workshop_id?: number;
  is_restricted:     boolean;
  financeVisibility: WorkshopFinanceVisibility | null;
  // Phase 2 — Executive KPIs + Operational Widgets
  totalMachines:              number;
  availableMachines:          number;
  activeMaintenanceCount:     number;
  machineAvailabilityPct:     number;
  scheduledMaintenanceCount:  number;
  overdueMaintenanceCount:    number;
  fuelConsumedThisMonth:      number;
  downtimeHoursThisMonth:     number;
  workshopCostsThisMonth:     number;
  todaysMaintenance:          MaintenanceScheduleAlert[];
  upcomingMaintenance:        MaintenanceScheduleAlert[];
  overdueMaintenanceList:     MaintenanceScheduleAlert[];
  equipmentAlerts:            EquipmentAlert[];
  fleetAlerts:                WorkshopFleetAlert[];
  workshopNotifications:      WorkshopNotification[];
  // Phase 3 — Operational Intelligence
  workshopUtilizationPct:     number;
  maintenanceThisMonthCount:  number;
  costTrendMonths:            WorkshopCostTrendMonth[];
  maintenanceTrendMonths:     WorkshopMaintenanceTrendMonth[];
}

// ─── Sales Orders ─────────────────────────────────────────────────────────────

export interface SalesOrder {
  id:                    number;
  order_number:          string;
  customer_name:         string;
  customer_id:           number | null;
  product_type:          'Timber' | 'Poles';
  product_sub_type:      'Kiln-dried' | 'CCA-treated' | 'Untreated' | null;
  product_size:          string;
  quantity:              number;
  unit_price:            number;
  currency:              'RWF' | 'USD' | 'EUR' | 'GBP';
  price_tax_type:        'Inclusive' | 'Exclusive';
  payment_due_date:      string | null;
  payment_status:        'Paid' | 'Unpaid';
  notes:                 string | null;
  status:                string;
  created_at:            string;
  pending_deletion:      boolean;
  qty_dispatched_total:  number;
  qty_accepted_total:    number;
  qty_rejected_total:    number;
  qty_remaining:         number;
  delivery_number:       string | null;
  delivery_status:       string | null;
  customer_registered_name?: string | null;
  workshop_name?:        string | null;
}

export interface SalesStockSummary {
  timberStock:       number;
  timberProduced:    number;
  timberSold:        number;
  polesStock:        number;
  polesProduced:     number;
  polesSold:         number;
  kilnDriedStock:    number;
  ccaTreatedStock:   number;
  untreatedStock:    number;
}

export interface SalesMetrics {
  pending:    number;
  confirmed:  number;
  inProgress: number;
  delivered:  number;
  closed:     number;
}

export interface SalesDropdownCustomer {
  id:             number;
  name:           string;
  contact_person: string | null;
  phone:          string | null;
}

export interface SalesDropdownProduct {
  id:       number;
  type:     string;
  sub_type: string | null;
  size:     string;
  default_price: number | null;
}

export interface SalesDropdownVehicle {
  id:             number;
  registration:   string;
  make:           string | null;
  driver_assigned:string | null;
}

export interface SalesListResponse {
  ok:       true;
  rows:     SalesOrder[];
  total?:   number;
  page?:    number;
  pageSize?: number;
  metrics:  SalesMetrics;
  stock:    SalesStockSummary;
  dropdowns: {
    customers: SalesDropdownCustomer[];
    products:  SalesDropdownProduct[];
    vehicles:  SalesDropdownVehicle[];
  };
}

// Master Professionalization Phase C1 — Sales Orders had no single-record
// detail endpoint anywhere; every screen re-derived a row from the already-
// fetched list. Mirrors data.salesGet's response shape.
export interface SalesOrderDetailResponse {
  ok:            true;
  order:         SalesOrder & { standard_cost: number | null; cogs: number | null; margin: number | null; customer_phone: string | null; customer_email: string | null };
  deliveries:    DeliveryOrder[];
  totalValue:    number;
  inventoryNote: string;
}

// ERP Final Enterprise Completion Gate — Sales Dashboard/Reporting/Customer History
export interface SalesDashboardStatusEntry { count: number; value: number; }
export interface SalesDashboardTopProduct {
  product_type: string; product_sub_type: string | null; product_size: string | null;
  units_sold: number; value: number;
}
export interface SalesDashboardRecentOrder {
  id: number; order_number: string; customer_name: string;
  product_type: string; product_size: string | null; quantity: number;
  unit_price: number; status: string; created_at: string;
}
// Sales Enterprise Phase 2 (Priority 2) — "Sales by Customer" / "Sales by Workshop"
export interface SalesDashboardTopCustomer { customer_name: string; customer_id: number | null; order_count: number; value: number; }
export interface SalesDashboardWorkshopEntry { workshop_id: number; workshop_name: string; order_count: number; value: number; }
export interface SalesDashboardResponse {
  ok: true;
  totalOrders: number;
  statusCounts: Record<string, SalesDashboardStatusEntry>;
  kpi: { revenueToday: number; revenueMonth: number; revenueYear: number; deliveriesPending: number };
  salesTrend: { day: string; amount: number; orders: number }[];
  topProducts: SalesDashboardTopProduct[];
  recentOrders: SalesDashboardRecentOrder[];
  topCustomers: SalesDashboardTopCustomer[];
  byWorkshop: SalesDashboardWorkshopEntry[];
}

export interface SalesReportRow {
  id: number; order_number: string; customer_name: string; customer_registered_name: string | null;
  product_type: string; product_sub_type: string | null; product_size: string | null;
  quantity: number; unit_price: number; total_value: number;
  status: string; payment_status: string | null; payment_due_date: string | null;
  workshop_name: string | null; order_date: string;
  // Sales Enterprise Phase 2 — null (not 0) when the order's product wasn't
  // resolved to a Product Catalog item at creation time (unknown cost, not zero margin).
  standard_cost: number | null; cogs: number | null; margin: number | null;
}
export interface SalesReportResponse {
  ok: true;
  rows: SalesReportRow[];
  summary: { totalOrders: number; totalUnits: number; totalValue: number; totalCogs: number; totalMargin: number; marginKnownOrders: number };
  workshops: { id: number; name: string }[];
}

export interface CustomerOrderRow {
  id: number; order_number: string; product_type: string; product_sub_type: string | null;
  product_size: string | null; quantity: number; unit_price: number; total_value: number;
  status: string; payment_status: string | null; payment_due_date: string | null; order_date: string;
  // Sales Enterprise Phase 2 — delivery history per order
  delivery_count: number | null; delivery_number: string | null; delivery_status: string | null;
}
export interface CustomerOrdersResponse {
  ok: true;
  customer: Customer;
  orders: CustomerOrderRow[];
  summary: { totalOrders: number; totalValue: number };
  // Sales Enterprise Phase 2 (Priority 9) — count of this customer's orders
  // at OTHER workshops, hidden from a workshop-restricted viewer by design.
  hiddenOtherWorkshopOrders: number;
}

// ─── Stock Transfers ──────────────────────────────────────────────────────────

export interface StockTransfer {
  id:                   number;
  reference:            string | null;
  status:               string;
  item_name:            string;
  category:             string;
  uom:                  string;
  from_warehouse_name:  string;
  to_warehouse_name:    string;
  from_warehouse_id:    number;
  to_warehouse_id:      number;
  requested_qty:        number;
  dispatched_qty:       number;
  received_qty:         number;
  rejection_reason:     string | null;
  notes:                string | null;
  requested_by:         string | null;
  approved_by:          string | null;
  requested_at:         string;
  approved_at:          string | null;
  discrepancy_notes?:   string | null;
  discrepancy_qty?:     number | null;
}

export interface TransferItem {
  id: number; name: string; category: string; uom: string; total_stock: number;
}

export interface TransferVehicle {
  id: number; registration: string; label: string; driver_assigned: string | null;
}

export interface TransferSummary {
  total: number; pending: number; inTransit: number; completed: number;
}

export interface StockTransfersListResponse {
  ok:               true;
  rows:             StockTransfer[];
  items:            TransferItem[];
  warehouses:       WarehouseRef[];
  vehicles:         TransferVehicle[];
  user_workshop_id: number | null;
  summary:          TransferSummary;
}

export interface TransferDispatchEvent {
  id:                number;
  qty:               number;
  driver_name:       string | null;
  reference:         string | null;
  notes:             string | null;
  registration:      string | null;
  vehicle_label:     string;
  dispatched_by_name:string | null;
  dispatched_at:     string;
}

export interface StockTransferHistoryResponse {
  ok:        true;
  transfer:  (StockTransfer & { transfer_ref: string | null }) | null;
  dispatches:TransferDispatchEvent[];
}

// ─── Dispatch ─────────────────────────────────────────────────────────────────

export interface DispatchRequest {
  id:                      number;
  request_number:          string;
  status:                  'Pending' | 'Approved' | 'Rejected' | 'Dispatched';
  notes:                   string | null;
  created_at:              string;
  approved_at:             string | null;
  delivery_order_number:   string | null;
  driver_name:             string | null;
  route:                   string | null;
  vehicle_registration:    string | null;
  so_order_number:         string | null;
  customer_name:           string | null;
  created_by:              string | null;
  approved_by:             string | null;
}

export interface PendingDelivery {
  id:             number;
  order_number:   string;
  driver_name:    string | null;
  so_order_number:string | null;
  customer_name:  string | null;
}

export interface DispatchListResponse {
  ok:                true;
  rows:              DispatchRequest[];
  pendingDeliveries: PendingDelivery[];
}

// ── Transport Carriers & Jobs (Phase 1 Logistics fix) ───────────────────────
export interface TransportCompany {
  id:             number;
  name:           string;
  contact_person: string | null;
  phone:          string | null;
  email:          string | null;
  rate_per_km:    number | null;
  notes:          string | null;
  active:         boolean;
  job_count:      number;
  total_cost:     number;
}
export interface TransportCompaniesListResponse { ok: true; rows: TransportCompany[] }

export interface TransportJob {
  id:                    number;
  job_number:            string;
  carrier_type:          'Third-party' | 'Own Vehicle';
  job_type:              string;
  origin:                string | null;
  destination:           string | null;
  quantity:               number | null;
  uom:                    string | null;
  cost:                   number | null;
  waybill_ref:            string | null;
  status:                 'Scheduled' | 'In Transit' | 'Completed' | 'Cancelled';
  notes:                  string | null;
  job_date:               string | null;
  created_at:             string;
  company_name:           string | null;
  company_phone:          string | null;
  vehicle_registration:   string | null;
  vehicle_make:           string | null;
  vehicle_model:          string | null;
  sales_order_number:     string | null;
  customer_name:          string | null;
  delivery_order_number:  string | null;
  created_by:             string | null;
}
export interface TransportJobsListResponse {
  ok: true;
  rows: TransportJob[];
  companies: Array<{ id: number; name: string; contact_person: string | null; phone: string | null; email: string | null; rate_per_km: number | null; notes: string | null; active: boolean }>;
  salesOrders: Array<{ id: number; order_number: string; customer_name: string; product_type: string; product_size: string; quantity: number; price_tax_type: string }>;
  vehicles: Array<{ id: number; registration: string; make: string; model: string }>;
}

// Phase 2 — generic per-record audit history (GET /api/logistics/history/:module/:recordId)
export interface LogisticsHistoryRow {
  action:      string;
  icon:        string | null;
  created_at:  string;
  action_type: string | null;
  reason:      string | null;
  username:    string | null;
  full_name:   string | null;
}
export interface LogisticsHistoryResponse {
  ok:   true;
  rows: LogisticsHistoryRow[];
}

// ─── Timber Inventory ─────────────────────────────────────────────────────────

export interface TimberStock {
  timberProduced:     number;
  polesProduced:      number;
  kilnDriedProduced:  number;
  ccaTreatedProduced: number;
  untreatedProduced:  number;
  timberSold:         number;
  polesSold:          number;
  kilnDriedSold:      number;
  ccaTreatedSold:     number;
  untreatedSold:      number;
  timberStock:        number;
  polesStock:         number;
  kilnDriedStock:     number;
  ccaTreatedStock:    number;
  untreatedStock:     number;
}

export interface ProductionDay {
  date:                string;
  timber_units:        number;
  timber_kiln_dried:   number;
  timber_cca_treated:  number;
  timber_untreated:    number;
  timber_waste:        number;
  poles_units:         number;
  poles_waste:         number;
  downtime_hours:      number;
  supervisor:          string | null;
}

export interface HarvestSpecies {
  species:  string;
  total:    number;
  harvests: number;
}

// Sawmill Phase 1 (Workstream 4) — per-location Finished Timber/Poles flow,
// reusing stock_levels/stock_transfers directly.
export interface FinishedTimberFlowRow {
  productId:            number;
  type:                 string;
  subType:               string | null;
  size:                  string;
  stockItemId:           number;
  stockItemName:         string;
  readyForSaleGatare:    number;
  readyForTransfer:      number;
  inTransit:             number;
  availableAtNyanza:     number;
  availableAtShowroom:   number;
}

// Sawmill Phase 2 — Enterprise Costing & Pricing Foundation
export interface SawmillCosting {
  inventoryValue:              number;
  productionCostMonth:         number;
  productionCostAllTime:       number;
  salesValueMonth:              number;
  cogsMonth:                    number;
  grossProfitMonth:             number;
  grossMarginPctMonth:          number | null;
  unresolvedSalesValueMonth:    number;
  rawLogsConsumedMonth:         number;
  finishedTimberProducedMonth:  number;
}
export interface SawmillReconciliation {
  totalProduced:  number;
  totalSold:      number;
  currentStock:   number;
  expectedStock:  number;
  mismatch:       number;
  reconciled:     boolean;
}
export interface TimberProcessingReconciliation {
  totalProduced: number;
  kilnDried:     number;
  ccaTreated:    number;
  untreated:     number;
  breakdownSum:  number;
  reconciled:    boolean;
  note:          string;
}
export interface InventoryValueByLocation {
  warehouseId:   number;
  warehouseName: string;
  value:         number;
}
export interface ProductProfitability {
  productId:           number;
  type:                string;
  subType:             string | null;
  size:                string;
  standardCost:        number | null;
  defaultPrice:        number | null;
  unitsSoldMonth:      number;
  salesValueMonth:     number;
  cogsMonth:           number;
  grossProfitMonth:    number;
  grossMarginPctMonth: number | null;
}

export interface TimberInventoryResponse {
  ok:              true;
  stock:           TimberStock;
  logs7:           ProductionDay[];
  harvestSummary:  HarvestSpecies[];
  wasteRate:       string;
  finishedTimberFlow: FinishedTimberFlowRow[];
  costing:         SawmillCosting;
  reconciliation:  SawmillReconciliation;
  timberProcessingReconciliation: TimberProcessingReconciliation;
  inventoryValueByLocation: InventoryValueByLocation[];
  productProfitability: ProductProfitability[];
}

// ─── Stock Management ─────────────────────────────────────────────────────────

export type MovementType    = 'in' | 'out' | 'adjustment' | 'transfer' | 'return' | 'loss';
export type ApprovalStatus  = 'pending' | 'approved' | 'rejected';

export interface WarehouseRef { id: number; name: string }

export interface StockCategory { id: number; name: string }

export interface StockItem {
  id:             number;
  category:       string;
  name:           string;
  sku?:           string;
  uom:            string;
  unit_cost:      number;
  min_stock:      number;
  max_stock?:     number;
  notes?:         string;
  total_stock:    number;
  wh_breakdown?:  Record<string, number>;
  active:         boolean;
  default_unit_cost?: number;
}

export interface StockItemListResponse {
  ok:               true;
  rows:             StockItem[];
  warehouses:       WarehouseRef[];
  categories:       StockCategory[];
  user_workshop_id?: number;
}

export interface InventoryItem {
  id:        number;
  category:  string;
  name:      string;
  sku?:      string;
  uom:       string;
  unit_cost: number;
  stock:     number;
  min_stock: number;
}

export interface InventoryListResponse {
  ok:               true;
  rows:             InventoryItem[];
  lowStockCount:    number;
  warehouses:       WarehouseRef[];
  user_workshop_id?: number;
}

// Phase 2 — Inventory Dashboard (Executive KPIs + Operational Widgets).
export interface InventoryDashboardWidgetItem {
  id?:              number;
  name?:            string;
  item_name?:       string;
  category?:        string;
  uom?:             string;
  min_stock?:       number;
  total_stock?:     number;
  from_workshop?:   string;
  to_workshop?:     string;
  requested_qty?:   number;
  po_number?:       string;
  supplier_name?:   string;
  status?:          string;
  workshop_name?:   string;
  priority?:        string;
  moved?:           number;
  movement_type?:   string;
  quantity?:        number;
  created_at?:      string;
  created_by?:      string;
  max_stock?:       number | null;
  exception_type?:  string | null;
}

export interface InventoryDashboardResponse {
  ok:                        true;
  user_workshop_id?:         number;
  is_restricted:             boolean;
  totalItems:                number;
  totalValue:                number;
  availableStock:            number;
  reservedStock:              number;
  lowStockCount:              number;
  outOfStockCount:            number;
  goodsReceivedThisMonth:      number;
  transfersPending:            number;
  materialRequestsPending:     number;
  adjustmentsThisMonth:        number;
  consumptionThisMonth:        number;
  turnoverRatio:               number;
  lowStockAlerts:              InventoryDashboardWidgetItem[];
  pendingTransfers:            InventoryDashboardWidgetItem[];
  goodsReceiptsAwaiting:       InventoryDashboardWidgetItem[];
  materialRequestsAwaiting:    InventoryDashboardWidgetItem[];
  fastMovingItems:             InventoryDashboardWidgetItem[];
  slowMovingItems:             InventoryDashboardWidgetItem[];
  recentlyUpdated:             InventoryDashboardWidgetItem[];
  stockExceptions:             InventoryDashboardWidgetItem[];
}

// Phase 3 — Inventory Operational Intelligence (trends, top items, aging,
// health, forecasting).
export interface InventoryTrendPoint {
  month: string;
  value: number;
}
export interface InventoryTopItem {
  id:         number;
  name:       string;
  uom:        string;
  total?:     number;
  requests?:  number;
  transfers?: number;
  qty?:       number;
}
export interface InventoryAgingItem {
  id:          number;
  name:        string;
  category:    string;
  total_stock: number;
  days_idle:   number;
}
export interface InventoryHealth {
  critical:   number;
  low:        number;
  healthy:    number;
  inactive:   number;
  fastMoving: number;
  slowMoving: number;
}
export interface InventoryForecast {
  expectedConsumption:     number;
  expectedReceiving:       number;
  expectedTransfers:       number;
  expectedInventoryLevel:  number;
  basis:                   string;
}
export interface InventoryReorderWatchItem {
  id:             number;
  name:           string;
  uom:            string;
  total_stock:    number;
  min_stock:      number;
  days_remaining: number;
  riskLevel:      'Critical' | 'Warning';
}
export interface InventoryIntelligenceResponse {
  ok:                     true;
  user_workshop_id?:      number;
  is_restricted:          boolean;
  consumptionTrendMonths: InventoryTrendPoint[];
  receivingTrendMonths:   InventoryTrendPoint[];
  adjustmentTrendMonths:  InventoryTrendPoint[];
  inventoryTrendMonths:   InventoryTrendPoint[];
  transferTrendMonths:    InventoryTrendPoint[];
  mostConsumedItems:      InventoryTopItem[];
  mostRequestedItems:     InventoryTopItem[];
  mostTransferredItems:   InventoryTopItem[];
  agingItems:             InventoryAgingItem[];
  health:                 InventoryHealth;
  forecast:               InventoryForecast;
  reorderWatchList:       InventoryReorderWatchItem[];
}

export interface StockMovement {
  id:                number;
  item_name:         string;
  category:          string;
  uom:               string;
  warehouse_name?:   string;
  to_warehouse_name?: string;
  movement_type:     MovementType;
  quantity:          number;
  unit_cost?:        number;
  total_value?:      number;
  reference?:        string;
  notes?:            string;
  loss_reason?:      string;
  transfer_id?:      number;
  approval_status?:  ApprovalStatus;
  rejection_reason?: string;
  pending_deletion?: boolean;
  created_at:        string;
  created_by:        string;
}

export interface StockMovementListResponse {
  ok:               true;
  rows:             StockMovement[];
  items:            StockItem[];
  warehouses:       WarehouseRef[];
  user_workshop_id?: number;
}

export interface StockPendingApproval {
  ok:             true;
  pendingApproval: true;
  message:        string;
}

// ─── Reports — Weekly Cost ────────────────────────────────────────────────────

export interface WeeklyCostCategory {
  id:           number;
  name:         string;
  week_amount:  number;
  month_amount: number;
  budget:       number;
  variance:     number;
  status:       'green' | 'amber' | 'red';
}

export interface WeeklyCostResponse {
  ok:         true;
  weekNumber: number;
  month:      string;
  summary:    WeeklyCostCategory[];
  totals: {
    week:     number;
    month:    number;
    budget:   number;
    variance: number;
  };
}

// ─── Reports — Weekly Performance ────────────────────────────────────────────

export interface WeeklyPerfDailyRow {
  date:           string;
  machine?:       string;
  product_size?:  string;
  timber_units:   number;
  timber_waste:   number;
  poles_units:    number;
  poles_waste:    number;
  downtime_hours: number;
  supervisor?:    string;
}

export interface WeeklyPerfCategoryStatus {
  category:   string;
  amount:     number;
  budget:     number;
  variance:   number;
  reason?:    string;
  entered_by: string;
  status:     'green' | 'amber' | 'red';
}

export interface WeeklyPerfResponse {
  ok:         true;
  weekNumber: number;
  month:      string;
  range:      string;
  production: {
    timber:           number;
    poles:            number;
    downtime_hours:   number;
    cost_per_timber:  number;
    cost_per_pole:    number;
    comment_count:    number;
  };
  dailyRows:      WeeklyPerfDailyRow[];
  categoryStatus: WeeklyPerfCategoryStatus[];
}

// ─── Reports — KPI Scorecard ──────────────────────────────────────────────────

export interface KpiBudgetRow {
  id:            number;
  name:          string;
  budget_amount: number;
}

export interface KpiBudgetsResponse {
  ok:   true;
  month: string;
  rows:  KpiBudgetRow[];
}

// ─── Reports — Executive Dashboard ───────────────────────────────────────────

export interface ExecTrendDay {
  day?:    string;
  week?:   string;
  amount?: number;
  orders?: number;
  liters?: number;
  trees?:  number;
  logs?:   number;
  timber?: number;
  poles?:  number;
  avg_hours?: number;
  resolved?:  number;
}

export interface ExecTopMachine {
  machine_code:   string;
  name:           string;
  hours_worked:   number;
  production:     number;
  fuel:           number;
  efficiency_pct: number;
}

export interface ExecTopDriver {
  driver_name:  string;
  deliveries:   number;
  qty_accepted: number;
  qty_rejected: number;
}

export interface ExecTopCompartment {
  compt_name:    string;
  species:       string | null;
  area_ha:       number;
  trees_felled:  number;
  logs_produced: number;
}

export interface ExecActiveUser {
  username:    string;
  full_name:   string;
  role:        string;
  actions:     number;
  last_active: string;
}

export interface ExecutiveDashboardResponse {
  ok: true;
  kpi: {
    revenueToday:      number;
    revenueMonth:      number;
    revenueYear:       number;
    pendingApprovals:  number;
    failedJobs:        number;
    activeUsersToday:  number;
    deliveriesPending: number;
    dispatchPending:   number;
  };
  salesTrend:      ExecTrendDay[];
  fuelTrend:       ExecTrendDay[];
  harvestTrend:    ExecTrendDay[];
  workshopTrend:   ExecTrendDay[];
  approvalTrend:   ExecTrendDay[];
  topMachines:     ExecTopMachine[];
  topDrivers:      ExecTopDriver[];
  topCompartments: ExecTopCompartment[];
  activeUsers:     ExecActiveUser[];
  stock: {
    movements30d:       number;
    lowStockItems:      number;
    pendingTransfers:   number;
    pendingMaterialReq: number;
  };
  governance: {
    slaCompliancePct:  number;
    totalResolved30d:  number;
    escalatedCount:    number;
    escalationRatePct: number;
    privOverrides24h:  number;
    failedLogins24h:   number;
    auditVolume24h:    number;
  };
  notifications: {
    totalUnread: number;
    security:    number;
    approval:    number;
    system:      number;
  };
}

// ─── Reports — Business Intelligence ─────────────────────────────────────────

export interface BiBreakdownItem {
  icon:  string;
  label: string;
  pts:   number;
}

export interface BiHealth {
  score:     number;
  breakdown: BiBreakdownItem[];
}

export interface BiRisk {
  severity: 'critical' | 'high' | 'medium' | 'low';
  module:   string;
  title:    string;
  detail:   string;
  icon:     string;
}

export interface BiRecommendation {
  priority:    'critical' | 'high' | 'medium' | 'low';
  module:      string;
  title:       string;
  description: string;
  action?:     string;
  icon?:       string;
}

export interface BiStockShortage {
  name:                  string;
  current_stock:         number;
  uom:                   string;
  avg_daily_consumption: number;
  days_until_depletion:  number | null;
}

export interface BiHarvestForecast {
  compt_name:       string;
  sub_name?:        string;
  species?:         string;
  pct_complete:     number;
  days_to_complete: number | null;
  rate_per_day:     number;
}

export interface BiStockAnomaly {
  item_name:     string;
  quantity:      number;
  movement_type: string;
  z_score:       number;
}

export interface BiDashboardResponse {
  ok:      true;
  sections: string[];
  health:   BiHealth;
  predictions: {
    stockShortages:     BiStockShortage[];
    fuelAnomaly:        { z_score: number; pct_change: number; data_points?: number };
    machineAlerts:      Array<{ machine_code: string; name: string; maintenance_type: string; days_overdue: number }>;
    efficiencyDecline:  Array<{ machine_code: string; avg_eff: number; eff_slope?: number }>;
    harvestForecast:    BiHarvestForecast[];
    salesRegression:    { avg_daily: number; slope: number; r2: number };
    workshopRegression: { total_avg: number; total_slope: number; n?: number };
  };
  forecasts: {
    sales30d:      Array<{ day: string; revenue: number }>;
    salesForecast: number[];
    wkTrend:       Array<{ week: string; timber: number; poles: number }>;
    wkForecast:    number[];
  };
  risks:           BiRisk[];
  recommendations: BiRecommendation[];
  govRisk: {
    failed_logins_24h:  number;
    priv_overrides_24h: number;
    failed_jobs:        number;
    total_pending:      number;
    stalled_48h:        number;
    delayed_deliveries: number;
    avg_pending_hours:  number;
  };
  stockAnomalies: BiStockAnomaly[];
}

// ─── Admin — Security & Governance ───────────────────────────────────────────

export interface SecGovSecurityEvent {
  id: number; time: string; username: string; role: string;
  action_type: string; action: string;
}

export interface SecGovWorkflowJob {
  id: number; type: string; attempts: number; max_attempts: number;
  status: string; last_error: string | null; created_fmt: string;
}

export interface SecGovAuditRow {
  id: number; time: string; username: string; full_name: string;
  role: string; module: string; action_type: string; action: string;
}

export interface SecGovDashboardResponse {
  ok: true;
  kpi: {
    failedLogins: number; privOverrides: number;
    pendingApprovals: number; workflowFailures: number;
  };
  approvals: {
    leaderPending: number; managerPending: number;
    escalated: number; avgHours: number | null;
  };
  notifCounts: { security: number; approval: number; system: number };
  securityEvents: SecGovSecurityEvent[];
  workflowHealth: SecGovWorkflowJob[];
  auditFeed:      SecGovAuditRow[];
}

// ─── Admin — Audit ────────────────────────────────────────────────────────────

export interface AuditRow {
  id:           number;
  action:       string;
  icon:         string;
  role:         string;
  username:     string;
  full_name:    string;
  module:       string;
  action_type:  string;
  record_id:    number | null;
  ip_address:   string | null;
  reason:       string | null;
  before_values: unknown;
  after_values:  unknown;
  time:         string;
  user_name:    string | null;
}

export interface AuditListResponse {
  ok:      true;
  rows:    AuditRow[];
  modules: string[];
}

// ─── Admin — Users ────────────────────────────────────────────────────────────

export interface UserRow {
  id:                   number;
  username:             string;
  name:                 string;
  role:                 string;
  department:           string | null;
  user_permissions:     string[];
  user_responsibilities: string[];
  active:               boolean;
  workshop_id:          number | null;
  workshop_name:        string | null;
  created:              string;
}

export interface UsersListResponse {
  ok:        true;
  rows:      UserRow[];
  workshops: { id: number; name: string }[];
}

// ─── Admin — Roles ────────────────────────────────────────────────────────────

export interface RoleDefinition {
  role:             string;
  label:            string | null;
  description:      string | null;
  responsibilities: string[];
  permissions:      string[];
}

export interface RolesListResponse {
  ok:   true;
  rows: RoleDefinition[];
}

// ─── Admin — Trash ────────────────────────────────────────────────────────────

export interface TrashRow {
  table_name:      string;
  record_id:       number;
  label:           string;
  entity_ref:      string | null;
  deleted_by_name: string | null;
  deleted_at:      string;
  deletion_reason: string | null;
  days_remaining:  number;
}

export interface TrashListResponse {
  ok:   true;
  rows: TrashRow[];
}

// ─── Admin — Change Requests ──────────────────────────────────────────────────

export interface ChangeRequest {
  id:           number;
  record_type:  string;
  record_ref:   string;
  request_text: string;
  status:       string;
  response:     string | null;
  created:      string;
  by:           string | null;
}

export interface ChangesListResponse {
  ok:    true;
  rows:  ChangeRequest[];
  isMgr: boolean;
}

// ─── Automation Center ────────────────────────────────────────────────────────

export type AutomationSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';
export type AutomationAction   = 'notify' | 'draft_request' | 'escalate' | 'log_only';
export type EscalationLevel    = 'leader' | 'manager' | 'director' | 'ceo';

export interface AutomationRule {
  id:             number;
  rule_key:       string;
  label:          string;
  description:    string | null;
  enabled:        boolean;
  cooldown_hours: number;
  notify_roles:   string[];
  threshold:      Record<string, unknown>;
  severity:       AutomationSeverity;
  auto_action:    AutomationAction;
  updated_at:     string;
  last_fired:     string | null;
}

export interface AutomationLogEntry {
  id:             number;
  rule_key:       string;
  related_module: string | null;
  related_id:     string | null;
  action_taken:   string;
  fired_at:       string;
  meta:           Record<string, unknown> | null;
}

export interface WorkflowJob {
  id:           number;
  type:         string;
  status:       string;
  run_at:       string | null;
  attempts:     number;
  max_attempts: number;
  last_error:   string | null;
  processed_at: string | null;
  created_at:   string;
}

export interface EscalationRow {
  id:            number;
  entity_type:   string;
  entity_id:     string;
  entity_ref:    string | null;
  triggered_by:  string;
  current_level: EscalationLevel;
  status:        string;
  escalated_at:  string;
  notified_at:   string | null;
  age_hours:     number;
}

export interface SchedulerRun {
  id:           number;
  started_at:   string;
  completed_at: string | null;
  duration_ms:  number | null;
  errors:       number;
  status:       string;
}

export interface AutomationSummary {
  rules_total:        number;
  rules_enabled:      number;
  rules_disabled:     number;
  active_escalations: number;
  pending_jobs:       number;
  failed_jobs:        number;
  automations_24h:    number;
  avg_tick_ms:        number | null;
  ticks_24h:          number;
}

export interface AutomationDashboardResponse {
  ok:              true;
  timestamp:       string;
  summary:         AutomationSummary;
  scheduler: {
    last_automation: string | null;
    last_security:   string | null;
    recent_runs:     SchedulerRun[];
  };
  activity_by_day: { day: string; count: number }[];
  rules:           AutomationRule[];
  automation_log:  AutomationLogEntry[];
  pending_jobs:    WorkflowJob[];
  failed_jobs:     WorkflowJob[];
  escalations: {
    active:       EscalationRow[];
    level_counts: Record<EscalationLevel, number>;
  };
}

export interface AutomationRuleResponse {
  ok:   true;
  rule: AutomationRule;
}

export interface EscalationsResponse {
  ok:          true;
  escalations: EscalationRow[];
}

// ─── EPM — Enterprise Performance Management ─────────────────────────────────

export type KpiStatus          = 'on-track' | 'at-risk' | 'off-track' | 'no-data';
export type KpiTrend           = 'up' | 'stable' | 'down';
export type ActionPlanStatus   = 'draft' | 'pending_approval' | 'approved' | 'in_progress' | 'completed' | 'rejected';
export type ActionPlanPriority = 'critical' | 'high' | 'medium' | 'low';
export type RagStatus          = 'green' | 'amber' | 'red';

export interface PerformanceKpi {
  id:          number;
  kpi_key:     string;
  name:        string;
  department:  string;
  module:      string | null;
  owner:       string | null;
  description: string | null;
  target:      number;
  current:     number | null;
  previous:    number | null;
  unit:        string;
  direction:   string;
  achievement: number | null;
  status:      KpiStatus;
  trend:       KpiTrend;
  review_freq: string;
}

export interface ExecDimension {
  name:   string;
  score:  number;
  status: RagStatus;
  icon:   string;
  detail: string;
}

export interface ExecScorecard {
  ok:         true;
  overall:    { score: number; status: RagStatus; period: string };
  dimensions: ExecDimension[];
}

export interface ActionPlan {
  id:                   number;
  kpi_key:              string | null;
  kpi_name:             string | null;
  problem:              string;
  root_cause:           string | null;
  recommended_action:   string | null;
  expected_improvement: string | null;
  responsible_dept:     string;
  department:           string | null;
  priority:             ActionPlanPriority;
  due_date:             string | null;
  status:               ActionPlanStatus;
  auto_generated:       boolean;
  created_by_name:      string | null;
  approved_by_name:     string | null;
  created_at:           string;
}

export interface ActionPlanSummary {
  total:            number;
  draft:            number;
  pending_approval: number;
  approved:         number;
  in_progress:      number;
  completed:        number;
}

export interface EpmSummary {
  company_score: number;
  total_kpis:    number;
  on_track:      number;
  at_risk:       number;
  off_track:     number;
  departments:   number;
  open_plans:    number;
  period:        string;
}

export interface EpmDashboardResponse {
  ok:        true;
  summary:   EpmSummary;
  kpis:      PerformanceKpi[];
  executive: ExecScorecard | null;
  plans:     { ok: true; plans: ActionPlan[]; summary: ActionPlanSummary } | null;
}

export interface DeptScorecard {
  department:     string;
  score:          number;
  kpi_count:      number;
  on_track:       number;
  at_risk:        number;
  off_track:      number;
  risk_level:     'high' | 'medium' | 'low';
  trend:          KpiTrend;
  open_actions:   number;
  done_actions:   number;
  pending_approv: number;
  kpis:           PerformanceKpi[];
  icon:           string;
  color:          string;
}

export interface EpmDepartmentsResponse {
  ok:           true;
  scorecards:   DeptScorecard[];
  companyScore: number;
}

export interface TrendPoint { period: string; value: number | string; }

export interface EpmTrendsResponse {
  ok:     true;
  trends: {
    revenue:    TrendPoint[];
    production: TrendPoint[];
    harvest:    TrendPoint[];
    fuel:       TrendPoint[];
    stock:      TrendPoint[];
    approvals:  TrendPoint[];
  };
}

// ─── Reports — Monthly Dashboard ─────────────────────────────────────────────

export interface MonthlyExpenseRow {
  category: string;
  total:    number;
}

export interface MonthlyDashboardResponse {
  ok:    true;
  month: string;
  production: {
    log_days:        number;
    timber_units:    number;
    timber_waste:    number;
    poles_units:     number;
    poles_waste:     number;
    downtime_hours:  number;
  };
  sales: {
    order_count:    number;
    total_qty:      number;
    total_revenue:  number;
  };
  expenses:      MonthlyExpenseRow[];
  totalExpenses: number;
  approval: {
    approved:     boolean;
    approved_at?: string;
  };
}

// ─── Global Search ───────────────────────────────────────────────────────────

export type SearchModule =
  | 'sales' | 'deliveries' | 'dispatch' | 'stock_transfers' | 'inventory'
  | 'timber' | 'poles' | 'workshop' | 'machines' | 'fuel'
  | 'material_requests' | 'purchase_requests' | 'labour' | 'production'
  | 'reports' | 'customers' | 'products' | 'vehicles' | 'users'
  | 'audit_logs' | 'change_requests' | 'notifications';

export type SearchSort = 'newest' | 'oldest' | 'relevance' | 'alphabetical';

export interface SearchResult {
  module:       SearchModule;
  id:           number | string;
  title:        string;
  subtitle:     string | null;
  description:  string | null;
  status:       string | null;
  created_at:   string | null;
  route:        string | null;
  // 'production' only — which workshop type (Timber/Poles/other) this daily
  // log belongs to, since the module has no single destination screen.
  workshop_type?: string | null;
}

export interface SearchResponse {
  ok:            true;
  total:         number;
  moduleCounts:  Partial<Record<SearchModule, number>>;
  results:       SearchResult[];
}

export interface SearchFilters {
  module?:     SearchModule;
  status?:     string;
  workshop?:   number;
  department?: string;
  createdBy?:  string;
  fromDate?:   string; // 'YYYY-MM-DD'
  toDate?:     string; // 'YYYY-MM-DD'
  sort?:       SearchSort;
}

// ═══════════════════════════════════════════════════════════════════════════
// Procurement Management
// ═══════════════════════════════════════════════════════════════════════════

export type ProcurementApprovalStatus = 'pending' | 'approved' | 'rejected' | 'skipped' | 'returned';
export type ProcurementApprovalStageKey = 'supervisor' | 'department_manager' | 'procurement_review' | 'finance' | 'ceo';

export interface ProcurementApprovalStep {
  id:               number;
  entity_type:      'requisition' | 'invoice' | 'payment';
  entity_id:        number;
  stage_key:        string;
  stage_order:      number;
  status:           ProcurementApprovalStatus;
  assigned_role:    string;
  approved_by:      number | null;
  approved_by_name?: string | null;
  approved_at:      string | null;
  notes:            string | null;
  created_at:       string;
}

// Phase 3B lifecycle. `status` is the authoritative field; `active`/
// `blacklisted`/`blacklist_reason` remain as backend-synced mirrors (kept
// for every pre-3B consumer that already reads them).
export type ProcurementSupplierStatus = 'draft' | 'pending_approval' | 'active' | 'suspended' | 'blacklisted' | 'archived';

export interface ProcurementSupplier {
  id:                 number;
  name:               string;
  category:           string | null;
  tax_number:         string | null;
  bank_name:          string | null;
  bank_account:       string | null;
  phone:              string | null;
  email:              string | null;
  address:            string | null;
  rating:             number | null;
  preferred:          boolean;
  blacklisted:        boolean;
  blacklist_reason:   string | null;
  notes:              string | null;
  active:             boolean;
  status:             ProcurementSupplierStatus;
  status_reason:      string | null;
  created_at:         string;
}

// ── Supplier Intelligence — Phase 3C ────────────────────────────────────────
// Shapes mirror db/services/data.js's Supplier Intelligence Engine exactly
// (the single source of truth for every score/metric) — nothing here is
// recomputed client-side, only rendered.
export type SupplierScoreTier = 'Excellent' | 'Good' | 'Average' | 'High Risk';

export interface SupplierIntelligenceScores {
  delivery:       number;
  quality:        number;
  cost:           number;
  compliance:     number;
  responsiveness: number;
}

export interface SupplierIntelligence {
  id:                    number;
  name:                  string;
  category:              string | null;
  status:                ProcurementSupplierStatus;
  preferred:             boolean;
  blacklisted:           boolean;
  active:                boolean;
  totalPos:              number;
  totalSpend:            number;
  lastPurchaseDate:      string | null;
  totalReceipts:         number;
  totalReceived:         number;
  totalRejected:         number;
  rejectRatePct:         number;
  deliverySample:        number;
  onTimeCount:           number;
  lateCount:             number;
  onTimeRatePct:         number | null;
  avgDeliveryDays:       number | null;
  totalInvoices:         number;
  avgInvoiceVariancePct: number | null;
  avgResponseDays:       number | null;
  activeContracts:       number;
  expiringContracts:     number;
  expiredContracts:      number;
  scores:                SupplierIntelligenceScores;
  overallScore:          number;
  tier:                  SupplierScoreTier;
  riskIndicators:        string[];
  recommendation:        string;
}

export interface SupplierIntelligenceKpis {
  totalSuppliers:        number;
  activeSuppliers:       number;
  preferredSuppliers:    number;
  blacklistedSuppliers:  number;
  highRiskSuppliers:     number;
  contractsExpiring:     number;
  totalProcurementSpend: number;
  averageSupplierScore:  number;
}

export interface SupplierIntelligenceDashboard {
  kpis:              SupplierIntelligenceKpis;
  topPerformers:      Array<{ id: number; name: string; score: number; tier: SupplierScoreTier; preferred: boolean; totalSpend: number; spendTrend?: 'up' | 'down' | 'flat' }>;
  highRiskSuppliers:  Array<{ id: number; name: string; score: number; primaryIssue: string; recommendation: string }>;
  contractSummary:    { active: number; expiringSoon: number; expired: number };
  spendDistribution:  Array<{ name: string; value: number }>;
}

export interface SupplierPurchaseHistoryItem {
  kind:   'purchase_order' | 'invoice' | 'goods_receipt';
  id:     number;
  ref:    string | null;
  date:   string;
  status: string;
  amount: number | null;
}

export interface SupplierTimelineItem {
  date:    string;
  kind:    string;
  label:   string;
  status:  string | null;
  amount:  number | null;
  reason?: string | null;
}

export interface SupplierTrendPoint {
  month:         string;
  spend:         number;
  pos:           number;
  onTimeRatePct: number | null;
  rejectRatePct: number | null;
}

export interface SupplierIntelligenceProfile {
  supplier:        SupplierIntelligence;
  purchaseHistory: SupplierPurchaseHistoryItem[];
  timeline:        SupplierTimelineItem[];
  trend:           SupplierTrendPoint[];
}

export interface ProcurementSupplierContact {
  id:          number;
  supplier_id: number;
  name:        string;
  role:        string | null;
  phone:       string | null;
  email:       string | null;
  is_primary:  boolean;
}

export interface ProcurementSupplierContract {
  id:                    number;
  supplier_id:           number;
  contract_ref:          string;
  category:              string | null;
  start_date:            string | null;
  end_date:              string | null;
  contract_value:        number | null;
  owner_user_id:         number | null;
  owner_name?:           string | null;
  renewal_notice_days:   number | null;
  terms:                 string | null;
  notes:                 string | null;
  status:                string;
  renewed_from_id:       number | null;
  last_reminder_at:      string | null;
  supplier_name?:        string;
  // Only present on rows returned by procurementContractsRegister —
  // 'renewed'/'cancelled' pass through as-is, everything else is derived
  // from end_date via the shared _expiryStatus() date math.
  computedStatus?:       'active' | 'expiring' | 'expired' | 'renewed' | 'cancelled';
}

export interface ProcurementRequisitionItem {
  id:                    number;
  requisition_id:        number;
  description:           string;
  quantity:              number;
  unit:                  string | null;
  estimated_unit_price:  number;
  stock_item_id:         number | null;
}

export type ProcurementRequisitionStatus =
  | 'draft' | 'submitted' | 'in_approval' | 'returned_for_revision' | 'approved' | 'rejected' | 'cancelled' | 'po_issued' | 'completed';
export type ProcurementPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface ProcurementRequisition {
  id:                     number;
  requisition_number:     string | null;
  requester_id:           number;
  requester_name?:        string | null;
  department:             string | null;
  workshop_id:            number | null;
  title:                  string;
  description:            string | null;
  priority:               ProcurementPriority;
  budget_code:            string | null;
  status:                 ProcurementRequisitionStatus;
  total_estimated_amount: number;
  notes:                  string | null;
  created_at:             string;
  submitted_at:           string | null;
  cancelled_at:           string | null;
  cancelled_reason:       string | null;
  revision_number:        number;
}

// Procurement Exception Management Phase 2 — Return for Revision.
export interface ProcurementRequisitionRevision {
  id:                 number;
  requisition_id:     number;
  revision_number:    number;
  returned_by:        number | null;
  returned_by_name?:  string | null;
  returned_at:        string;
  reviewer_notes:     string;
  items_before:       ProcurementRequisitionItem[];
  total_before:       number;
  resubmitted_by:       number | null;
  resubmitted_by_name?: string | null;
  resubmitted_at:       string | null;
  items_after:          ProcurementRequisitionItem[] | null;
  total_after:          number | null;
}

export interface ProcurementRfq {
  id:                 number;
  requisition_id:     number;
  requisition_title?: string;
  requisition_number?: string | null;
  rfq_number:         string | null;
  title:              string;
  due_date:           string | null;
  status:             'draft' | 'sent' | 'closed';
  created_at:         string;
}

export interface ProcurementRfqSupplier {
  id:            number;
  rfq_id:        number;
  supplier_id:   number;
  supplier_name?: string;
  blacklisted?:  boolean;
  sent_at:       string | null;
  status:        'invited' | 'responded' | 'declined';
}

export interface ProcurementQuotation {
  id:             number;
  rfq_id:         number;
  supplier_id:    number;
  supplier_name?: string;
  rating?:        number | null;
  preferred?:     boolean;
  blacklisted?:   boolean;
  quoted_amount:  number;
  delivery_days:  number | null;
  terms:          string | null;
  notes:          string | null;
  status:         'received' | 'selected' | 'rejected';
  received_at:    string;
}

export type ProcurementPoStatus =
  | 'issued' | 'acknowledged' | 'partially_received' | 'shortage_pending_approval' | 'closed_with_shortage'
  | 'received' | 'closed' | 'cancelled';

export interface ProcurementPurchaseOrder {
  id:                     number;
  requisition_id:         number;
  requisition_number?:    string | null;
  requisition_title?:     string | null;
  quotation_id:           number | null;
  supplier_id:            number;
  supplier_name?:         string;
  supplier_address?:      string | null;
  supplier_phone?:        string | null;
  supplier_email?:        string | null;
  supplier_blacklisted?:  boolean;
  po_number:              string | null;
  issue_date:             string;
  expected_delivery_date: string | null;
  total_amount:           number;
  tax_amount:             number;
  terms:                  string | null;
  status:                 ProcurementPoStatus;
  workshop_id:            number | null;
  created_at:             string;
  // Procurement Exception Management Phase 3 — Close with Shortage.
  shortage_reason?:               string | null;
  shortage_supplier_explanation?: string | null;
  shortage_requested_by?:         number | null;
  shortage_requested_at?:         string | null;
  shortage_closed_at?:            string | null;
  shortage_attempt_number:        number;
}

export interface ProcurementPoFulfillment {
  ordered:         number;
  received:        number;
  outstandingQty:  number;
  outstandingValue: number;
  fulfillmentPct:  number;
}

export interface ProcurementPoItem {
  id:                  number;
  po_id:               number;
  requisition_item_id: number | null;
  description:         string;
  quantity:            number;
  unit_price:          number;
  tax_rate:            number;
  stock_item_id:       number | null;
}

export interface ProcurementGoodsReceipt {
  id:                number;
  po_id:             number;
  po_number?:        string;
  supplier_name?:    string;
  receipt_number:    string | null;
  received_by:       number | null;
  received_by_name?: string | null;
  received_at:       string;
  status:            'partial' | 'complete' | 'rejected';
  notes:             string | null;
}

export interface ProcurementGoodsReceiptItem {
  id:                number;
  receipt_id:        number;
  po_item_id:        number;
  description?:      string;
  quantity_received: number;
  quantity_rejected: number;
  rejection_reason:  string | null;
  notes:             string | null;
}

export type ProcurementInvoiceStatus = 'pending_match' | 'matched' | 'disputed' | 'approved' | 'rejected' | 'paid';

export interface ProcurementInvoice {
  id:             number;
  po_id:          number;
  po_number?:     string;
  supplier_id:    number;
  supplier_name?: string;
  invoice_number: string;
  invoice_date:   string;
  invoice_amount: number;
  status:         ProcurementInvoiceStatus;
  matched_by:     number | null;
  matched_at:     string | null;
  notes:          string | null;
  created_at:     string;
}

export interface ProcurementPayment {
  id:             number;
  invoice_id:     number;
  invoice_number?: string;
  supplier_name?: string;
  amount:         number;
  payment_date:   string | null;
  payment_method: string | null;
  reference:      string | null;
  approved_by:    number | null;
  status:         'pending' | 'approved' | 'rejected' | 'paid';
  created_at:     string;
}

export interface ProcurementConfig {
  id:               number;
  ceo_threshold:    number;
  updated_by:       number | null;
  updated_by_name?: string | null;
  updated_at:       string | null;
}

export interface ProcurementSupplierKpis {
  active:                   number;
  preferred:                number;
  suspended:                number;
  blacklisted:              number;
  new_this_month:           number;
  contracts_expiring_soon:  number;
}

export interface ProcurementDashboard {
  requisitionsByStatus:   Array<{ status: string; n: number }>;
  posByStatus:            Array<{ status: string; n: number }>;
  invoicesByStatus:       Array<{ status: string; n: number }>;
  goodsReceiptsLast7Days: number;
  recentActivity:         Array<{ kind: string; id: number; ref: string | null; label: string; status: string; created_at: string }>;
  monthlySpend:           Array<{ month: string; total: number }>;
  supplierKpis:           ProcurementSupplierKpis;
}

export interface ProcurementAnalytics {
  avgProcurementCycleDays: number;
  lateDeliveriesCount:     number;
  topPurchasedProducts:    Array<{ description: string; times_ordered: number; total_qty: number }>;
  supplierRankings:        Array<{ name: string; po_count: number; total_spend: number }>;
}

// ═══════════════════════════════════════════════════════════════════════════
// Procurement Analytics & Forecasting — Phase 5A (Executive Dashboard)
// ═══════════════════════════════════════════════════════════════════════════

export interface ProcurementExecutiveKpis {
  totalSpend:            number;
  spendThisMonth:        number;
  spendThisQuarter:      number;
  spendThisYear:         number;
  activeSuppliers:       number;
  activeContracts:       number;
  purchaseOrders:        number;
  goodsReceipts:         number;
  avgProcurementCycleDays: number;
  avgApprovalDays:       number;
  budgetUtilization: {
    estimatedBudget: number;
    actualSpend:     number;
    utilizationPct:  number;
    variance:        number;
  };
  planningSavings:    { total: number; matchedCount: number };
  negotiationSavings: { total: number; rfqCount: number };
}

export interface ProcurementExecutiveCharts {
  monthlySpendTrend:         Array<{ month: string; total: number }>;
  supplierSpendDistribution: Array<{ name: string; value: number }>;
  departmentSpend:           Array<{ department: string; total: number }>;
  workshopSpend:             Array<{ workshop: string; total: number }>;
  approvalTimeline:          Array<{ stage: string; avgDays: number }>;
  contractExpiryTimeline:    Array<{ month: string; active: number; expiring: number; expired: number }>;
  procurementCycleTrend:     Array<{ month: string; avgDays: number }>;
}

export interface ProcurementExecutiveDashboard {
  kpis:   ProcurementExecutiveKpis;
  charts: ProcurementExecutiveCharts;
}

// ═══════════════════════════════════════════════════════════════════════════
// Procurement Analytics & Forecasting — Phase 5B (Spend & Budget Analytics)
// ═══════════════════════════════════════════════════════════════════════════

export interface ProcurementBudgetByCode {
  budgetCode:     string;
  requisitions:   number;
  estimated:      number;
  actual:         number;
  variance:       number;
  utilizationPct: number;
}

export interface ProcurementDepartmentSpend {
  department: string;
  total:      number;
  estimated:  number;
  variance:   number;
  trend:      Array<{ month: string; total: number }>;
}

export interface ProcurementWorkshopSpend {
  workshopId: number | null;
  workshop:   string;
  total:      number;
  estimated:  number;
  variance:   number;
  trend:      Array<{ month: string; total: number }>;
}

export interface ProcurementSupplierSpend {
  id:                  number;
  name:                string;
  totalSpend:          number;
  monthSpend:          number;
  poCount:             number;
  avgOrder:            number;
  procurementSharePct: number;
}

export type ProcurementContractIndicator = 'over' | 'under' | 'on-track' | 'unknown';

export interface ProcurementContractUtilization {
  contractId:     number;
  contractRef:    string;
  status:         string;
  supplierId:     number;
  supplierName:   string;
  contractValue:  number | null;
  actualSpend:    number;
  utilizationPct: number | null;
  indicator:      ProcurementContractIndicator;
}

// ═══════════════════════════════════════════════════════════════════════════
// Procurement Forecasting & Executive Reporting — Phase 5C + 5D
// ═══════════════════════════════════════════════════════════════════════════

export interface ProcurementBudgetProjection {
  projectedAnnualSpend:   number;
  estimatedBudget:        number;
  projectedUtilizationPct: number;
}

export interface ProcurementForecastKpis {
  expectedMonthlySpend:      number;
  expectedQuarterlySpend:    number;
  expectedAnnualSpend:       number;
  budgetProjection:          ProcurementBudgetProjection;
  forecastAccuracy:          number | null;
  upcomingContractRenewals:  number;
  expectedProcurementVolume: number;
  highDemandSuppliersCount:  number;
  procurementCapacity:       number;
}

export interface ProcurementSupplierDemand {
  supplierId:          number;
  supplierName:        string;
  historicalAvgMonthly: number;
  forecastedNextMonth:  number;
}

export interface ProcurementContractRenewalForecast {
  contractId:           number;
  contractRef:          string;
  endDate:              string;
  supplierName:         string;
  expectedRenewalValue: number | null;
}

export interface ProcurementCalendarEntry {
  date:  string;
  type:  'contract_renewal' | 'expected_delivery';
  label: string;
}

export interface ProcurementForecastingDashboard {
  kpis: ProcurementForecastKpis;
  charts: {
    forecastVsActual:      { actual: number[]; predicted: number[] };
    monthlyProjectionTrend: { historical: number[]; forecast: number[] };
    annualProjection:       { historical: number[]; forecast: number[] };
    procurementDemand:      { historical: number[]; forecast: number[] };
    supplierDemandTrend:    ProcurementSupplierDemand[];
    seasonalTrend:          Array<{ month: string; avg: number }>;
  };
  contractRenewalForecast: ProcurementContractRenewalForecast[];
  highDemandSuppliers:     ProcurementSupplierDemand[];
  calendar:                ProcurementCalendarEntry[];
}

export type ProcurementExecReportType =
  | 'executive_summary' | 'spend' | 'budget_utilization' | 'forecast' | 'supplier_performance'
  | 'supplier_spend' | 'contract_performance' | 'department_spend' | 'workshop_spend'
  | 'savings' | 'kpi_report' | 'trend_report' | 'executive_dashboard_report';

export interface ProcurementExecReportResult {
  reportType: ProcurementExecReportType;
  rows?:      Array<Record<string, unknown>>;
  summary?:   Record<string, unknown>;
}

// ── Phase 6 — Procurement Automation Engine ─────────────────────────────────
export type ProcurementTaskCategory =
  | 'pending_approvals' | 'rfqs' | 'purchase_orders' | 'goods_receipts'
  | 'supplier_invoices' | 'contracts' | 'compliance' | 'corrective_actions'
  | 'improvement_plans' | 'supplier_reviews';

export interface ProcurementAutomationTask {
  id:                 number;
  task_key:           string;
  category:           ProcurementTaskCategory;
  title:              string;
  priority:           'high' | 'medium' | 'low';
  due_date:           string | null;
  status:             'open' | 'closed';
  owner_role:         string;
  source_module:      string;
  source_entity_type: string;
  source_entity_id:   number;
  deep_link:          string | null;
  created_at:         string;
  closed_at:          string | null;
  closed_by:          number | null;
  auto_closed:        boolean;
}

export interface ProcurementEscalation {
  id:            number;
  entity_type:   string;
  entity_id:     string;
  entity_ref:    string | null;
  triggered_by:  string;
  current_level: 'leader' | 'manager' | 'director' | 'ceo';
  status:        string;
  escalated_at:  string;
  notified_at:   string;
  age_hours:     number;
}

export interface ProcurementAutomationSummary {
  pending_tasks:          number;
  overdue_tasks:          number;
  pending_approvals:      number;
  active_escalations:     number;
  contracts_expiring:     number;
  compliance_expiring:    number;
  outstanding_deliveries: number;
  outstanding_invoices:   number;
}

export interface ProcurementAutomationDashboard {
  timestamp:  string;
  summary:    ProcurementAutomationSummary;
  tasks_by_category: Record<string, { open: number; closed: number; overdue: number }>;
  scheduler:  { recent_runs: Array<Record<string, unknown>> };
  rules:      Array<Record<string, unknown>>;
  escalations: { active: ProcurementEscalation[]; level_counts: Record<string, number> };
}

// ── Phase 7 — Procurement Performance Management ────────────────────────────
export interface ProcurementPerfKpi {
  key: string; label: string;
  current: number | null; previous: number | null; target: number | null;
  unit: '%' | 'days' | 'currency' | 'score';
  variance: number | null;
  trend: 'up' | 'down' | 'flat';
  changePct: number | null;
}

export interface ProcurementPerformanceScorecard {
  period: { current: { from: string; to: string }; previous: { from: string; to: string } };
  kpis: {
    healthScore: ProcurementPerfKpi; efficiency: ProcurementPerfKpi; cycleTime: ProcurementPerfKpi;
    leadTime: ProcurementPerfKpi; approvalPerformance: ProcurementPerfKpi; supplierPerformance: ProcurementPerfKpi;
    contractUtilization: ProcurementPerfKpi; budgetUtilization: ProcurementPerfKpi; spendAccuracy: ProcurementPerfKpi;
    forecastAccuracy: ProcurementPerfKpi; automationSuccessRate: ProcurementPerfKpi; slaCompliance: ProcurementPerfKpi;
    procurementSavings: ProcurementPerfKpi; onTimeProcurement: ProcurementPerfKpi; riskScore: ProcurementPerfKpi;
  };
}

export interface ProcurementBuyerPerformance {
  id: number; username: string; name: string; role: string;
  requisitionsProcessed: number; rfqsManaged: number; purchaseOrdersIssued: number;
  avgApprovalTimeDays: number | null; avgProcurementCycleDays: number | null;
  procurementSavingsGenerated: number; supplierSatisfaction: number | null;
  contractCompliancePct: number | null; budgetCompliancePct: number | null;
  overdueTasks: number | null; escalationsReceived: number; tasksCompleted: number;
  overallScore: number | null; rank: number; performanceTrend: 'up' | 'down' | 'flat';
}

export interface ProcurementDepartmentPerformance {
  department: string; procurementSpend: number; estimatedBudget: number;
  budgetVariance: number; budgetUsagePct: number | null; procurementVolume: number;
  avgCycleDays: number | null; efficiency: number | null; forecastAccuracy: number | null;
  procurementRisk: 'high' | 'medium' | 'low'; trend: Array<{ month: string; total: number }>;
}

export interface ProcurementWorkshopPerformance {
  workshopId: number; workshop: string; procurementRequests: number; procurementCost: number;
  outstandingDeliveries: number; procurementLeadTimeDays: number | null; efficiency: number | null;
  budgetCompliancePct: number | null; trend: Array<{ month: string; total: number }>;
}

export interface ProcurementExecutivePerformanceDashboard {
  kpis: {
    procurementHealth: number | null; totalProcurementSpend: number; budgetUtilization: number | null;
    procurementSavings: number; forecastAccuracy: number | null; supplierPerformance: number | null;
    contractsExpiring: number; complianceStatus: number; automationPerformance: number | null;
    outstandingRisks: number | null;
  };
  charts: {
    procurementTrend: Array<{ month: string; total: number }>;
    budgetTrend: Array<Record<string, unknown>>;
    procurementSavingsTrend: Array<{ month: string; savings: number }>;
    supplierPerformanceTrend: Array<{ name: string; score: number }>;
    procurementCycleTrend: Array<{ month: string; avgDays: number }>;
    forecastAccuracyTrend: Array<{ label: string; value: number | null }>;
    departmentComparison: Array<{ department: string; spend: number; efficiency: number | null }>;
    workshopComparison: Array<{ workshop: string; cost: number; efficiency: number | null }>;
    buyerRanking: Array<{ name: string; score: number | null }>;
    procurementRiskDistribution: { high: number; medium: number; low: number };
  };
  scorecard: ProcurementPerformanceScorecard['kpis'];
}

export interface ProcurementRiskMonitor {
  highRiskSuppliers: Array<{ id: number; name: string; score: number; primaryIssue: string; recommendation: string }>;
  budgetRisk: Array<{ budgetCode: string; utilizationPct: number; overspend: number }>;
  procurementDelays: { open: number; closed: number; overdue: number };
  outstandingApprovals: number; expiringContracts: number; complianceRisks: number;
  escalationVolume: number; escalationsByLevel: Record<string, number>;
  automationFailedTicks: number; automationTicksChecked: number;
}

export interface ProcurementBenchmarkComparison {
  label: string; current: number | null; previous: number | null;
  absolute: number | null; pct: number | null; trend: 'up' | 'down' | 'flat';
}
export interface ProcurementBenchmarkResult {
  dimension: string; a?: string; b?: string; comparisons: ProcurementBenchmarkComparison[];
}

export interface ProcurementSpendBudgetAnalytics {
  kpis: ProcurementExecutiveKpis;
  budgetByCode:   ProcurementBudgetByCode[];
  departmentSpend: ProcurementDepartmentSpend[];
  workshopSpend:   ProcurementWorkshopSpend[];
  supplierSpend:   ProcurementSupplierSpend[];
  contractSpendSplit: { underContract: number; outsideContract: number; underContractPct: number };
  contractUtilization: ProcurementContractUtilization[];
  trends: {
    quarterly: Array<{ quarter: string; total: number }>;
    annual:    Array<{ year: string; total: number }>;
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Supplier Relationship Management (SRM) — Phase 4
// ═══════════════════════════════════════════════════════════════════════════

export const SRM_COMPLIANCE_TYPES = [
  'Tax Certificate', 'Business Registration', 'Insurance', 'Quality Certifications',
  'Environmental Compliance', 'Safety Certificates', 'NDA',
] as const;
export type SrmComplianceType = typeof SRM_COMPLIANCE_TYPES[number];

export type SrmComplianceComputedStatus = 'active' | 'expiring' | 'expired' | 'missing' | 'waived';

// supplierComplianceList(supplierId) — one row per checklist type for a single
// supplier. `status` is the raw DB value ('valid' | 'waived') for rows that
// exist, or the literal 'missing' when no row exists at all (in which case
// computedStatus is absent — fall back to `status` for display).
export interface SrmComplianceListItem {
  id:                number | null;
  supplier_id?:      number;
  compliance_type:   string;
  issue_date:        string | null;
  expiry_date:       string | null;
  status:            string;
  computedStatus?:   SrmComplianceComputedStatus;
  notes:             string | null;
  created_by?:       number;
  created_at?:       string;
  updated_at?:       string;
  last_reminder_at?: string | null;
}

// supplierComplianceRegister(filters) — fleet-wide supplier × type matrix;
// `status` here is already the fully computed value.
export interface SrmComplianceMatrixRow {
  supplier_id:     number;
  supplier_name:   string;
  compliance_type: string;
  status:          SrmComplianceComputedStatus;
  issue_date:      string | null;
  expiry_date:     string | null;
  notes:           string | null;
}

export interface SrmDocument {
  id:                number;
  supplier_id:       number;
  supplier_name?:    string;
  contract_id:       number | null;
  compliance_id:     number | null;
  document_type:     string;
  original_filename: string;
  stored_filename:   string;
  mime_type:         string | null;
  file_size:         number | null;
  uploaded_by:       number | null;
  uploaded_by_name?: string | null;
  uploaded_at:       string;
  expiry_date:       string | null;
  version:           number;
  status:            string;
  notes:             string | null;
}

export interface SrmCommunication {
  id:                     number;
  supplier_id:            number;
  supplier_name?:         string;
  communication_type:     string;
  subject:                string;
  notes:                  string | null;
  next_action:            string | null;
  next_action_date:       string | null;
  responsible_user_id:    number | null;
  responsible_user_name?: string | null;
  date:                   string;
  created_by:             number | null;
  created_at:             string;
}

export interface SrmImprovementPlan {
  id:                 number;
  supplier_id:        number;
  supplier_name?:     string;
  title:              string;
  description:        string | null;
  plan_type:          string;
  status:             string;
  owner_user_id:      number | null;
  owner_name?:        string | null;
  due_date:           string | null;
  completion_percent: number;
  created_by:         number | null;
  created_at:         string;
  updated_at:         string;
  closed_at:          string | null;
}

export interface SrmDashboardKpis {
  totalSuppliers:       number;
  activeContracts:      number;
  expiringContracts:    number;
  expiredContracts:     number;
  compliancePct:        number;
  missingDocuments:     number;
  openImprovementPlans: number;
  highRiskSuppliers:    number;
}

export interface SrmDashboard {
  kpis:                  SrmDashboardKpis;
  contractTimeline:      Array<{ month: string; active: number; expiring: number; expired: number }>;
  complianceTrend:       Array<{ type: string; validPct: number }>;
  communicationActivity: Array<{ month: string; n: number }>;
  improvementProgress:   { openCount: number; avgCompletion: number; closedCount: number };
  documentsNearExpiry:   number;
}

export type SrmReportType =
  | 'contract_register' | 'expiring_contracts' | 'compliance_status' | 'document_register'
  | 'communication_log' | 'improvement_plans' | 'executive_summary';

export interface SrmReportResult {
  reportType: SrmReportType;
  rows?:      Array<Record<string, unknown>>;
  summary?:   SrmDashboard;
}

// ─── Enterprise Timber Lifecycle Integration Program — Phase 1 ────────────────

export interface HarvestWasteCategory { id: number; name: string }

export interface HarvestWasteRow {
  id: number;
  harvest_log_id: number;
  species: string;
  harvest_date: string;
  category: string | null;
  volume_logs: number;
  percentage: number;
  supervisor: string;
  reason: string;
  resolution_id: number | null;
  created_at: string;
}

export interface HarvestWasteListResponse { ok: true; rows: HarvestWasteRow[] }
export interface HarvestWasteCategoriesResponse { ok: true; rows: HarvestWasteCategory[] }
export interface HarvestWasteCreateResult { ok: true; id: number; percentage: number }

export type ResolutionDestination = 'Firewood' | 'Scrap Sale' | 'Internal Use' | 'Disposal' | 'Other';
export type ResolutionSourceType = 'harvest_waste' | 'production_offcut' | 'rejected_timber' | 'showroom_damage';

export interface ResolutionRecord {
  id: number;
  source_type: ResolutionSourceType;
  source_id: number;
  destination: ResolutionDestination;
  destination_detail: string | null;
  volume: number;
  unit_cost: number | null;
  stock_item_name: string | null;
  warehouse_name: string | null;
  notes: string | null;
  resolved_by_name: string | null;
  resolved_at: string;
}
export interface ResolutionsListResponse { ok: true; rows: ResolutionRecord[] }
export interface ResolutionCreateResult { ok: true; id: number; stockItemId: number | null }

export type ProductionOffcutStatus = 'pending_decision' | 'pending_resaw' | 'resawn' | 'inspected' | 'resolved';

export interface ProductionOffcutRow {
  id: number;
  daily_log_id: number;
  production_date: string;
  production_machine: string | null;
  quantity: number;
  recoverable: boolean | null;
  resaw_machine_id: number | null;
  resaw_machine_name: string | null;
  recovered_quantity: number | null;
  recovered_width_mm: number | null;
  recovered_thickness_mm: number | null;
  recovered_length_m: number | null;
  resolution_id: number | null;
  status: ProductionOffcutStatus;
  inspection_approved_qty: number | null;
  inspection_rejected_qty: number | null;
  rework_of_rejection_id: number | null;
}
export interface ProductionOffcutsListResponse { ok: true; rows: ProductionOffcutRow[] }

export interface ProductionReconciliationRow {
  dailyLogId: number;
  productionDate: string;
  finishedTimber: number;
  recoveredTimber: number;
  trueWaste: number;
  recordedWaste: number;
  trackedOffcuts: number;
  unresolvedOffcuts: number;
  untrackedWaste: number;
  // Timber Lifecycle Phase 2 (Workstream 7)
  acceptedQty: number;
  rejectedQty: number;
  unresolvedRejections: number;
  reconciled: boolean;
}
export interface ProductionReconciliationResponse { ok: true; rows: ProductionReconciliationRow[]; unreconciledCount: number }

export interface AttachmentRow {
  id: number;
  original_filename: string;
  mime_type: string | null;
  file_size: number | null;
  uploaded_at: string;
  uploaded_by: string | null;
}
export interface AttachmentsListResponse { ok: true; rows: AttachmentRow[] }

// ─── Enterprise Timber Lifecycle Integration Program — Phase 2 ────────────────

export interface QualityInspectionCreateResult {
  ok: true; id: number; approvedPosted: boolean; unmappedProduct: boolean; rejectionHoldId: number | null;
}

export type RejectionHoldStatus = 'pending' | 'rework' | 'downgraded' | 'returned' | 'resolved';

export interface RejectionHoldRow {
  id: number;
  quality_inspection_id: number;
  production_offcut_id: number | null;
  value_added_production_output_id: number | null;
  // Pole Production Phase 1/2 — the third and fourth polymorphic sources
  // (manufactured pole output / purchased pole goods-receipt line). This
  // type had drifted out of date since Phase 1 shipped (source only ever
  // listed 'sawmill' | 'value_added') — corrected here, not a new field.
  pole_production_output_id: number | null;
  procurement_goods_receipt_item_id: number | null;
  quantity: number;
  status: RejectionHoldStatus;
  resolution_id: number | null;
  rework_offcut_id: number | null;
  rework_value_added_production_output_id: number | null;
  rework_pole_production_output_id: number | null;
  downgrade_product_id: number | null;
  downgrade_quantity: number | null;
  workshop_id: number | null;
  notes: string | null;
  inspection_rejection_reason: string | null;
  product_id: number | null;
  product_type: string | null;
  product_sub_type: string | null;
  product_size: string | null;
  daily_log_id: number | null;
  production_date: string | null;
  // Nyanza Value-Added Production Completion Phase — output_product_id is
  // chosen directly at output-line creation, so product_type/product_sub_type/
  // product_size above always resolve for VAT-origin holds now; vap_batch_date
  // replaces the old vat_entry_date/vat_type fallback-label pair.
  vap_batch_date: string | null;
  vap_batch_id: number | null;
  pole_batch_date: string | null;
  pole_batch_id: number | null;
  // Pole Production Phase 2 — populated only when source is 'purchased_pole'.
  purchase_po_number: string | null;
  purchase_supplier_name: string | null;
  purchase_receipt_number: string | null;
  source: 'sawmill' | 'value_added' | 'poles' | 'purchased_pole';
  workshop_name: string | null;
  downgrade_type: string | null;
  downgrade_sub_type: string | null;
  downgrade_size: string | null;
}
export interface RejectionHoldsListResponse { ok: true; rows: RejectionHoldRow[] }

export interface QualityReportResponse {
  ok: true;
  quality: {
    totalProduced: number; totalAccepted: number; totalRejected: number;
    rejectionRatePct: number | null; reworkRatePct: number | null; downgradeRatePct: number | null;
  };
  resolution: {
    reworked: number; downgraded: number; returned: number; pending: number;
    firewood: number; scrapSale: number; disposal: number; other: number;
  };
  financial: {
    rejectedInventoryValue: number; recoveredValue: number; scrapValue: number;
    disposalValue: number; firewoodValue: number; inventoryValueReturned: number;
  };
}

// ── Finance Control Center — Finance Enterprise Phase 2 ─────────────────────
// Mobile exposure is deliberately narrow (Dashboard + Approval Center only —
// same class of scope trim as Payroll above); shapes mirror financeDashboard/
// financeApprovalQueue's own return objects in db/services/data.js verbatim.
export interface FinanceDashboardResponse {
  ok: true;
  revenue: {
    today: number; month: number; yearToDate: number; salesAwaitingReview: number;
    byWorkshop: { workshop_name: string | null; v: number }[];
  };
  costs: {
    procurementMonth: number; maintenanceMonth: number; payrollMonth: number; inventoryValue: number;
    vapProducedUnits: number; vapInspectedUnits: number; productionCostAvailable: boolean; fleetCostScope: string;
  };
  profitability: {
    revenueMonth: number; cogsMonth: number; grossMargin: number; grossMarginPct: number | null;
    unpricedSalesLines: number; dataQualityWarning: string | null;
  };
  outstanding: {
    customerOutstanding: number | null; supplierOutstanding: number | null;
    pendingPayrollPeriods: number; pendingProcurementInvoices: number;
    pendingProcurementPayments: number; pendingFinancialApprovals: number;
  };
  exceptions: { missingCostInfoItems: number; rejectedThisMonth: number; returnedForCorrectionThisMonth: number };
}

export interface FinanceApprovalQueueItem {
  step_id: number; entity_type: string; entity_id: number; stage_key: string; stage_order: number;
  assigned_role: string; step_created_at: string;
  label: string; amount: number | null; workshop_id: number | null;
}
export interface FinanceApprovalQueueResponse { ok: true; rows: FinanceApprovalQueueItem[]; }

// ── Finance — Inventory Financial Control / Stock Count / Exception Center ──
// Shapes mirror financeInventoryOverview/financeStockVarianceReport/
// financeStockCount*/financeExceptionCase* return objects in
// db/services/data.js verbatim.
export interface FinanceInventoryOverviewResponse {
  ok: true;
  totals: { item_count: number; total_qty: number; total_value: number };
  byWorkshop: { workshop_id: number; workshop_name: string; total_qty: number; total_value: number }[];
  byCategory: { category: string; item_count: number; total_qty: number; total_value: number }[];
  topByValue: { id: number; name: string; category: string; uom: string; unit_cost: number; total_qty: number; total_value: number }[];
  missingCostItems: number; pendingRejectedQty: number; resolvedWasteThisMonth: number;
  reservedQtySupported: boolean; valuationNote: string;
}

export interface FinanceStockVarianceRow {
  line_id: number; session_id: number; workshop_id: number | null; workshop_name: string | null;
  item_id: number; item_name: string; system_qty_snapshot: number; physical_qty: number; variance: number;
  variance_pct: number | null; financial_variance: number; adjustment_request_id: number | null;
  initiated_at: string; repeated: boolean;
}
export interface FinanceStockVarianceResponse {
  ok: true; rows: FinanceStockVarianceRow[];
  negativeStock: { item_id: number; item_name: string; warehouse_id: number; workshop_name: string | null; quantity: number }[];
  highValueThreshold: number; highValueCount: number;
}

export interface FinanceStockCountSession {
  id: number; workshop_id: number | null; workshop_name: string | null; category: string | null;
  status: 'draft' | 'counting' | 'pending_review' | 'submitted' | 'completed' | 'cancelled';
  notes: string | null; initiated_by: number | null; initiated_by_name: string | null;
  initiated_at: string; completed_at: string | null;
  line_count: number; counted_count: number; variance_count: number;
}
export interface FinanceStockCountSessionListResponse { ok: true; rows: FinanceStockCountSession[]; }
export interface FinanceStockCountLine {
  id: number; session_id: number; item_id: number; item_name: string; category: string; uom: string;
  system_qty_snapshot: number; physical_qty: number | null; unit_cost_snapshot: number | null;
  status: 'pending' | 'counted' | 'reviewed'; notes: string | null;
  variance: number | null; financial_variance: number | null; adjustment_request_id: number | null;
}
export interface FinanceStockCountDetailResponse { ok: true; session: FinanceStockCountSession; lines: FinanceStockCountLine[]; }

export interface FinanceExceptionCase {
  id: number; category: string; source_ref: string; title: string; description: string | null;
  severity: 'low' | 'medium' | 'high' | 'critical'; financial_impact: number | null;
  workshop_id: number | null; workshop_name: string | null;
  status: 'open' | 'investigating' | 'resolved' | 'closed';
  created_by_name: string | null; created_at: string; assigned_to_name: string | null;
  resolved_by_name: string | null; resolved_at: string | null; resolution_notes: string | null;
  comment_count: number;
}
export interface FinanceExceptionCaseListResponse { ok: true; rows: FinanceExceptionCase[]; }
export interface FinanceExceptionComment { id: number; case_id: number; user_id: number | null; user_name: string | null; comment: string; created_at: string; }
export interface FinanceExceptionCaseDetailResponse { ok: true; case: FinanceExceptionCase; comments: FinanceExceptionComment[]; }
