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
  harvest?:      { total_trees?: number; [k: string]: unknown };
  production?:   { total_units?: number; [k: string]: unknown };
  poles?:        { total_units?: number; [k: string]: unknown };
  sales?:        { total_orders?: number; [k: string]: unknown };
  pendingPolesRequests?: number;
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
