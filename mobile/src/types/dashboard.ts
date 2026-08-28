import {
  TrendDirectionValue,
  ActivityTypeValue,
  PendingActionValue,
  PriorityValue,
  DowntimeStatusValue,
} from '../constants/dashboardEnums';

// ── Shared ───────────────────────────────────────────────────────────────────

export interface Trend {
  percent:   number;
  direction: TrendDirectionValue;
}

export interface AlertItem {
  type:  'low_stock' | 'pending_changes' | 'unread' | string;
  count: number;
}

export interface ActivityItem {
  id:          number | string;
  type:        ActivityTypeValue | 'default';
  description: string;
  role:        string;
  time:        string;
  user_name:   string;
}

export interface PendingItem {
  id:         string;
  action:     PendingActionValue;
  priority:   PriorityValue;
  title:      string;
  body:       string;
  created_at: string;
}

// ── GET /api/dashboard/stats ─────────────────────────────────────────────────

export interface StockBlock {
  timberStock:    number;
  polesStock:     number;
  timberProduced: number;
  polesProduced:  number;
  timberSold:     number;
  polesSold:      number;
}

export interface ProductionMonth {
  timber:   number;
  poles:    number;
  downtime?: number;
}

export interface DailyEntry {
  log_date:     string;
  timber_units: number;
  poles_units:  number;
}

export interface ProductionBlock {
  thisMonth: ProductionMonth;
  lastMonth: Omit<ProductionMonth, 'downtime'>;
  trend: {
    timber: Trend;
    poles:  Trend;
  };
  daily7: DailyEntry[];
}

export interface SalesMonth {
  orders:   number;
  qty:      number;
  revenue:  number;
  currency: string;
}

export interface SalesOrderRow {
  id:            number;
  order_number:  string;
  customer_name: string;
  product_type:  string;
  product_size:  string;
  quantity:      number;
  unit_price:    number;
  currency:      string;
}

export interface SalesBlock {
  thisMonth: SalesMonth;
  recent:    SalesOrderRow[];
}

export interface ExpenseCategoryRow {
  name:  string;
  total: number;
}

export interface ExpensesBlock {
  thisMonth:  number;
  currency:   string;
  byCategory: ExpenseCategoryRow[];
}

export interface DashboardStats {
  greeting:   string;
  date:       string;
  month:      string;
  alerts:     AlertItem[];
  stock:      StockBlock;
  production: ProductionBlock;
  sales:      SalesBlock;
  expenses:   ExpensesBlock;
  activity:   ActivityItem[];
  pending:    PendingItem[];
}

// ── GET /api/ceo/overview ────────────────────────────────────────────────────

export interface CeoProduction {
  timber_units:    number;
  poles_units:     number;
  downtime_hours:  number;
  entries:         number;
  downtime_status: DowntimeStatusValue;
}

export interface CeoHarvest {
  trees: number;
  logs:  number;
}

export interface CeoSales {
  total_orders: number;
  revenue:      number;
  currency:     string;
}

export interface CeoMachines {
  total:       number;
  available:   number;
  in_use:      number;
  maintenance: number;
}

export interface CeoOperations {
  vehicles:      number;
  casuals:       number;
  pendingLabour: number;
}

export interface CeoGovernance {
  pendingChanges:         number;
  pendingPolesRequests:   number;
  pendingMonthlyApproval: boolean;
}

export interface CeoOverview {
  month:      string;
  monthKey:   string;
  production: CeoProduction;
  harvest:    CeoHarvest;
  sales:      CeoSales;
  machines:   CeoMachines;
  operations: CeoOperations;
  governance: CeoGovernance;
}

// ── GET /api/logistics/dashboard ────────────────────────────────────────────

export interface WorkshopRow {
  id:          number;
  name:        string;
  location:    string;
  item_count:  number;
  stock_value: number;
  currency:    string;
  total_qty:   number;
}

export interface LowStockRow {
  name:           string;
  category:       string;
  uom:            string;
  min_stock:      number;
  total_stock:    number;
  warehouse_name: string;
}

export interface StockMovementRow {
  id:            number | string;
  type:          'stock_movement_in' | 'stock_movement_out';
  item_name:     string;
  quantity:      number;
  workshop_name: string;
  time:          string;
  user_name:     string;
}

export interface MonthTotalRow {
  movement_type: string;
  count:         number;
  total_qty:     number;
}

export interface StatusCountRow {
  status: string;
  cnt:    number;
}

export interface TransportJobStatusRow extends StatusCountRow {
  total_cost: number;
}

export interface FuelOverview {
  total_liters: number;
  total_cost:   number;
  log_count:    number;
}

export interface PendingActionsBlock {
  dispatchApprovals: number;
  editRequests:      number;
}

export interface DelayedDeliveryRow {
  id: number; order_number: string; delivery_date: string | null; status: string; driver_name: string | null;
}
export interface DelayedTransportJobRow {
  id: number; job_number: string; job_date: string | null; status: string;
}
export interface WorkshopAlertRow {
  id: number; vehicle_registration: string; maintenance_type: string; next_due_date: string;
}
export interface TodaysDeliveryRow {
  id: number; order_number: string; delivery_date: string | null; status: string; driver_name: string | null;
}
export interface TodaysTransportJobRow {
  id: number; job_number: string; job_date: string | null; status: string; carrier_type: string;
}
export interface ActiveDeliveryRow {
  id: number; order_number: string; status: string; driver_name: string | null;
}
export interface VehicleOnRouteRow {
  id: number; registration: string; driver_name: string | null; order_number: string;
}
export interface VehicleWaitingRow {
  id: number; registration: string; driver_name: string | null;
}
export interface PriorityDeliveryRow {
  id: number; order_number: string; delivery_date: string | null; status: string; driver_name: string | null; is_delayed: boolean;
}

export interface LogisticsDashboard {
  workshops:   WorkshopRow[];
  lowStock:    LowStockRow[];
  activity:    StockMovementRow[];
  monthTotals: MonthTotalRow[];
  // Phase 2 — department-wide operational summary (mirrors the desktop
  // Logistics Dashboard redesign).
  deliveryStatusCounts:     StatusCountRow[];
  dispatchStatusCounts:     StatusCountRow[];
  transportJobStatusCounts: TransportJobStatusRow[];
  fleetStatusCounts:        StatusCountRow[];
  vehiclesInUse:            number;
  fuelThisMonth:            FuelOverview;
  pendingActions:           PendingActionsBlock;
  // Phase 3 — Enterprise Operations Dashboard: Executive KPIs + Operational
  // Widgets + Alerts.
  deliveriesToday:           number;
  deliveriesThisWeek:        number;
  delayedDeliveriesCount:    number;
  delayedTransportJobsCount: number;
  activeDriversCount:        number;
  fleetActiveCount:          number;
  fleetUtilizationPct:       number;
  vehicleAvailability:       number;
  workshopAlertsCount:       number;
  delayedDeliveries:         DelayedDeliveryRow[];
  delayedTransportJobs:      DelayedTransportJobRow[];
  workshopAlerts:            WorkshopAlertRow[];
  todaysDeliveries:          TodaysDeliveryRow[];
  todaysTransportJobs:       TodaysTransportJobRow[];
  activeDeliveries:          ActiveDeliveryRow[];
  vehiclesOnRoute:           VehicleOnRouteRow[];
  vehiclesWaiting:           VehicleWaitingRow[];
  priorityDeliveries:        PriorityDeliveryRow[];
}

// ── API envelope wrappers ────────────────────────────────────────────────────

export interface ApiSuccess<T> {
  ok:           true;
  version:      number;
  generatedAt:  string;
  cacheSeconds: number;
  data:         T;
}

export interface ApiError {
  ok:      false;
  version: number;
  error: {
    code:    string;
    message: string;
  };
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError;
