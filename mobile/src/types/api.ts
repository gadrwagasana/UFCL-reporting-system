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
  id:            number;
  supplier_name: string;
  requested_qty: number;
  unit_price?:   number;
  notes?:        string;
  status:        'pending' | 'approved' | 'rejected';
  rejection_reason?: string;
  requested_at:  string;
  approved_at?:  string;
  approved_by_name?: string;
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
