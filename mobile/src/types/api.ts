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

// ─── Compartments (meta) — full definition added later in this file ───────────

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

export interface StockItemRef {
  id:       number;
  name:     string;
  category?: string;
  uom?:     string;
}

export interface MaterialRequestsListResponse {
  ok:               true;
  rows:             MaterialRequest[];
  items:            StockItemRef[];
  workshops:        { id: number; name: string }[];
  user_workshop_id?: number;
}

export interface StockItemsResponse {
  ok:   true;
  rows: StockItemRef[];
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

export type ProductType    = 'Timber' | 'Poles';
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

export interface WorkshopOverviewResponse {
  ok:                true;
  workshops:         OverviewWorkshopCard[];
  pendingTransfers:  PendingTransfer[];
  pendingRequests:   PendingMaterialRequest[];
  lowStock:          LowStockItem[];
  user_workshop_id?: number;
  is_restricted:     boolean;
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
  metrics:  SalesMetrics;
  stock:    SalesStockSummary;
  dropdowns: {
    customers: SalesDropdownCustomer[];
    products:  SalesDropdownProduct[];
    vehicles:  SalesDropdownVehicle[];
  };
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

export interface TimberInventoryResponse {
  ok:              true;
  stock:           TimberStock;
  logs7:           ProductionDay[];
  harvestSummary:  HarvestSpecies[];
  wasteRate:       string;
}

// ─── Stock Management ─────────────────────────────────────────────────────────

export type MovementType    = 'in' | 'out' | 'adjustment' | 'transfer' | 'return';
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
