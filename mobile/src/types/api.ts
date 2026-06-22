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
