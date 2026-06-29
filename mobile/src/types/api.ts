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

export interface DeliveryListResponse {
  ok:          true;
  rows:        DeliveryOrder[];
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

// ─── VAT (Value-Added Timber) ─────────────────────────────────────────────────

export interface VatInboundEntry {
  id:           number;
  product_size: string;
  requested_qty: number;
  received_qty:  number;
  requested_date?: string;
  status:        string;
  intake_used:   number;
}

export interface VatInboundListResponse {
  ok:   true;
  rows: VatInboundEntry[];
}

export type VatTypeValueAdded = 'Kiln-dried timber' | 'CCA treated timber';

export interface VatEntry {
  id:                 number;
  type_value_added:   VatTypeValueAdded;
  product_size:       string;
  num_timber:         number;
  source_transfer_id?: number;
  date_fmt?:          string;
  created_at?:        string;
  created_by_name?:   string;
}

export interface VatListResponse {
  ok:   true;
  rows: VatEntry[];
}

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

// ─── Log Transport ────────────────────────────────────────────────────────────

export interface LogTransportEntry {
  id:               number;
  transport_date:   string;
  date_fmt?:        string;   // "DD/MM/YYYY"
  qty_transported:  number;
  unit?:            string;
  notes?:           string;
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

// ─── Compartments (meta) ──────────────────────────────────────────────────────

export interface Compartment {
  id:                  number;
  compt_name:          string;
  sub_name?:           string;
  species?:            string;
  area_ha?:            number;
  volume_m3?:          number;
  status?:             string;
  volume_harvested_m3?: number;
}

export interface CompartmentsResponse {
  ok:   true;
  rows: Compartment[];
}

// ─── Sawmill / Daily Log ──────────────────────────────────────────────────────

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
  logs_received?:     number;
  supervisor?:        string;
  operators?:         string;
  remarks?:           string;
}

export interface DailyListResponse {
  ok:        true;
  rows:      DailyLog[];
  stock:     Record<string, unknown>;
  transport: { todayTransported: number; annualTransported: number };
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
  status:        'pending' | 'approved' | 'rejected' | 'partial';
  review_notes?: string;
  requested_by?: string;
  reviewed_by?:  string;
  requested_at:  string;
  reviewed_at?:  string;
}

export interface StockItem {
  id:       number;
  name:     string;
  category?: string;
  uom?:     string;
}

export interface MaterialRequestsListResponse {
  ok:               true;
  rows:             MaterialRequest[];
  items:            StockItem[];
  workshops:        { id: number; name: string }[];
  user_workshop_id?: number;
}

export interface StockItemsResponse {
  ok:   true;
  rows: StockItem[];
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
