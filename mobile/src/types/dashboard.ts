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

export interface LogisticsDashboard {
  workshops:   WorkshopRow[];
  lowStock:    LowStockRow[];
  activity:    StockMovementRow[];
  monthTotals: MonthTotalRow[];
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
