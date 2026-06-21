-- UFCL Reporting App schema (idempotent)

create table if not exists app_users (
  id bigserial primary key,
  username text unique not null,
  name text not null,
  role text not null,
  department text,
  user_permissions jsonb not null default '[]'::jsonb,
  user_responsibilities jsonb not null default '[]'::jsonb,
  password_hash text not null,
  active boolean not null default true,
  workshop_id bigint,
  created_at timestamptz not null default now()
);

create table if not exists role_definitions (
  role text primary key,
  label text not null,
  description text not null,
  responsibilities jsonb not null default '[]'::jsonb,
  permissions jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists audit_log (
  id bigserial primary key,
  user_id bigint references app_users(id),
  role text not null,
  action text not null,
  icon text,
  created_at timestamptz not null default now(),
  meta jsonb not null default '{}'::jsonb
);

create table if not exists notifications (
  id bigserial primary key,
  type text not null default 'green', -- red/amber/green/blue
  title text not null,
  body text not null,
  roles text[] not null default '{}'::text[],
  for_user_id bigint references app_users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists notifications_read (
  notification_id bigint references notifications(id) on delete cascade,
  user_id bigint references app_users(id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (notification_id, user_id)
);

create table if not exists products (
  id bigserial primary key,
  type text not null, -- Timber / Poles
  size text not null,
  active boolean not null default true,
  reason text,
  ref text,
  created_by bigint references app_users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists daily_logs (
  id bigserial primary key,
  log_date date not null,
  supervisor text,
  timber_units int not null default 0,
  timber_waste int not null default 0,
  poles_units int not null default 0,
  poles_waste int not null default 0,
  downtime_hours numeric(10,2) not null default 0,
  downtime_reason text,
  remarks text,
  created_by bigint references app_users(id),
  created_at timestamptz not null default now()
);

create table if not exists sales_orders (
  id bigserial primary key,
  order_number text not null,
  customer_name text not null,
  product_type text not null,
  product_size text not null,
  quantity int not null,
  unit_price numeric(14,2) not null,
  notes text,
  reason text not null,
  qty_dispatched_total int not null default 0,
  qty_accepted_total int not null default 0,
  qty_rejected_total int not null default 0,
  qty_returned_to_stock int not null default 0,
  qty_remaining int,
  created_by bigint references app_users(id),
  created_at timestamptz not null default now()
);

create table if not exists logistics_items (
  id bigserial primary key,
  category text not null,
  name text not null,
  sku text,
  uom text not null,
  unit_cost numeric(14,2) not null,
  stock int not null,
  min_stock int not null,
  reason text not null,
  created_by bigint references app_users(id),
  created_at timestamptz not null default now()
);

create table if not exists change_requests (
  id bigserial primary key,
  record_type text not null,
  record_ref text not null,
  request_text text not null,
  status text not null default 'Pending', -- Pending / Approved / Rejected
  response text,
  created_by bigint references app_users(id),
  created_at timestamptz not null default now(),
  reviewed_by bigint references app_users(id),
  reviewed_at timestamptz
);

create table if not exists monthly_approvals (
  month_key text primary key, -- e.g. 2024-11
  approved boolean not null default false,
  approved_by bigint references app_users(id),
  approved_at timestamptz
);

create table if not exists expense_categories (
  id bigserial primary key,
  name text not null unique,
  description text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists weekly_expenses (
  id bigserial primary key,
  category_id bigint not null references expense_categories(id),
  amount numeric(14,2) not null,
  week_number int not null,
  month text not null, -- e.g. 2024-11
  entered_by bigint not null references app_users(id),
  reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists product_catalog (
  id bigserial primary key,
  machine text not null,
  product_size text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists weekly_performance_comments (
  id bigserial primary key,
  week_number int not null,
  month text not null,
  category text,
  comment text not null,
  entered_by bigint not null references app_users(id),
  created_at timestamptz not null default now()
);

create table if not exists kpi_budgets (
  id bigserial primary key,
  category_id bigint not null references expense_categories(id),
  month text not null, -- e.g. 2024-11
  budget_amount numeric(14,2) not null,
  set_by bigint not null references app_users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(category_id, month)
);

create index if not exists idx_daily_logs_date on daily_logs(log_date desc);
create index if not exists idx_sales_orders_created_at on sales_orders(created_at desc);
create index if not exists idx_notifications_created_at on notifications(created_at desc);
create index if not exists idx_audit_created_at on audit_log(created_at desc);
create index if not exists idx_weekly_expenses_month on weekly_expenses(month, week_number);
create index if not exists idx_kpi_budgets_month on kpi_budgets(month);

-- ── Inventory Management ─────────────────────────────────────────────────────

create table if not exists warehouses (
  id bigserial primary key,
  name text not null,
  location text,
  workshop_type text,
  capacity int,
  notes text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists stock_catalog (
  id bigserial primary key,
  category text not null,
  name text not null,
  sku text,
  uom text not null,
  unit_cost numeric(14,2) not null default 0,
  min_stock int not null default 0,
  max_stock int,
  notes text,
  active boolean not null default true,
  created_by bigint references app_users(id),
  created_at timestamptz not null default now()
);

create table if not exists stock_levels (
  id bigserial primary key,
  item_id bigint not null references stock_catalog(id) on delete cascade,
  warehouse_id bigint not null references warehouses(id) on delete cascade,
  quantity int not null default 0,
  updated_at timestamptz not null default now(),
  unique(item_id, warehouse_id)
);

create table if not exists stock_movements (
  id bigserial primary key,
  item_id bigint not null references stock_catalog(id),
  warehouse_id bigint references warehouses(id),
  to_warehouse_id bigint references warehouses(id),
  movement_type text not null,
  quantity int not null,
  unit_cost numeric(14,2),
  reference text,
  notes text,
  approval_status text,
  approved_by bigint references app_users(id),
  approved_at timestamptz,
  rejection_reason text,
  created_by bigint references app_users(id),
  created_at timestamptz not null default now()
);

create table if not exists stock_transfers (
  id bigserial primary key,
  item_id bigint not null references stock_catalog(id),
  from_warehouse_id bigint not null references warehouses(id),
  to_warehouse_id bigint not null references warehouses(id),
  requested_qty int not null,
  dispatched_qty int not null default 0,
  received_qty int not null default 0,
  status text not null default 'pending',
  reference text,
  notes text,
  requested_by bigint references app_users(id),
  requested_at timestamptz not null default now(),
  approved_by bigint references app_users(id),
  approved_at timestamptz,
  rejection_reason text,
  deleted_at timestamptz,
  deleted_by bigint references app_users(id),
  deletion_reason text
);

create table if not exists stock_transfer_dispatches (
  id            bigserial primary key,
  transfer_id   bigint not null references stock_transfers(id),
  vehicle_id    bigint references vehicles(id),
  driver_name   text,
  qty           int not null,
  dispatched_at timestamptz not null default now(),
  reference     text,
  notes         text,
  dispatched_by bigint references app_users(id),
  created_at    timestamptz not null default now()
);

create table if not exists material_requests (
  id bigserial primary key,
  item_id bigint not null references stock_catalog(id),
  workshop_id bigint references warehouses(id),
  requested_qty int not null,
  approved_qty int,
  reason text,
  priority text not null default 'normal',
  status text not null default 'pending',
  requested_by bigint references app_users(id),
  reviewed_by bigint references app_users(id),
  review_notes text,
  requested_at timestamptz not null default now(),
  reviewed_at timestamptz
);

-- ── Fleet & Logistics ─────────────────────────────────────────────────────────

create table if not exists vehicles (
  id bigserial primary key,
  registration text not null unique,
  make text,
  model text,
  vehicle_type text,
  status text not null default 'Active',
  fuel_type text,
  insurance_expiry date,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists fuel_logs (
  id bigserial primary key,
  vehicle_id bigint not null references vehicles(id),
  liters numeric(10,2) not null,
  cost_per_liter numeric(10,2),
  total_cost numeric(14,2),
  odometer int,
  log_date date not null,
  logged_by bigint references app_users(id),
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists maintenance_records (
  id bigserial primary key,
  vehicle_id bigint not null references vehicles(id),
  maintenance_type text not null,
  description text not null,
  cost numeric(14,2),
  maintenance_date date not null,
  next_due_date date,
  performed_by text,
  notes text,
  created_by bigint references app_users(id),
  created_at timestamptz not null default now()
);

create table if not exists delivery_orders (
  id bigserial primary key,
  order_number text not null unique,
  sales_order_id bigint references sales_orders(id),
  vehicle_id bigint references vehicles(id),
  driver_name text,
  delivery_date date,
  status text not null default 'Pending',
  route text,
  notes text,
  qty_dispatched int,
  qty_accepted int,
  qty_rejected int,
  rejection_reason text,
  pod_recorded_at timestamptz,
  pod_recorded_by bigint references app_users(id),
  created_by bigint references app_users(id),
  created_at timestamptz not null default now()
);

create table if not exists dispatch_requests (
  id bigserial primary key,
  request_number text not null unique,
  delivery_order_id bigint references delivery_orders(id),
  status text not null default 'Pending',
  notes text,
  approved_by bigint references app_users(id),
  approved_at timestamptz,
  created_by bigint references app_users(id),
  created_at timestamptz not null default now()
);

-- ── Forestry & Timber ─────────────────────────────────────────────────────────

create table if not exists harvest_logs (
  id bigserial primary key,
  location text not null,
  species text not null,
  harvest_date date not null,
  quantity int not null,
  uom text not null default 'units',
  notes text,
  logged_by bigint references app_users(id),
  created_at timestamptz not null default now()
);

-- ── Third-Party Transport ─────────────────────────────────────────────────────

create table if not exists transport_companies (
  id bigserial primary key,
  name text not null,
  contact_person text,
  phone text,
  email text,
  rate_per_km numeric(10,2),
  notes text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists transport_jobs (
  id bigserial primary key,
  job_number text not null unique,
  carrier_type text not null default 'Third-party',
  transport_company_id bigint references transport_companies(id),
  vehicle_id bigint references vehicles(id),
  sales_order_id bigint references sales_orders(id),
  delivery_order_id bigint references delivery_orders(id),
  job_type text not null default 'Delivery',
  origin text,
  destination text,
  job_date date not null,
  quantity int,
  uom text,
  cost numeric(14,2),
  waybill_ref text,
  status text not null default 'Scheduled',
  notes text,
  created_by bigint references app_users(id),
  created_at timestamptz not null default now()
);

-- ── Supervisor Pending-Edit Approvals ────────────────────────────────────────

create table if not exists pending_edits (
  id bigserial primary key,
  action_type text not null,      -- 'edit' or 'delete'
  entity_type text not null,      -- 'daily_log', 'harvest_log', 'logistics_item', etc.
  entity_id bigint not null,
  entity_ref text,                -- human-readable label (date, name, order #)
  payload jsonb,                  -- new field values for edits; null for deletes
  old_snapshot jsonb,             -- previous record values captured at request time
  status text not null default 'Pending', -- Pending / Approved / Rejected
  review_notes text,
  submitted_by bigint references app_users(id),
  submitted_at timestamptz not null default now(),
  reviewed_by bigint references app_users(id),
  reviewed_at timestamptz
);

create index if not exists idx_pending_edits_status on pending_edits(status, submitted_at desc);

create index if not exists idx_stock_movements_created_at on stock_movements(created_at desc);
create index if not exists idx_delivery_orders_created_at on delivery_orders(created_at desc);
create index if not exists idx_harvest_logs_date on harvest_logs(harvest_date desc);
create index if not exists idx_transport_jobs_created_at on transport_jobs(created_at desc);

-- ── Machine Management & KPI Performance ─────────────────────────────────────

create table if not exists machine_categories (
  id bigserial primary key,
  name text not null unique,
  description text,
  icon text not null default 'ti-tool',
  created_at timestamptz not null default now()
);

create table if not exists machines (
  id bigserial primary key,
  machine_code text not null unique,
  name text not null,
  category_id bigint not null references machine_categories(id),
  status text not null default 'Available',
  production_capacity numeric(10,2) not null default 0,
  capacity_unit text not null default 'm³',
  fuel_consumption_rate numeric(10,2) not null default 0,
  fuel_type text,
  manufacturer text,
  model_number text,
  serial_number text,
  year_manufactured int,
  date_acquired date,
  notes text,
  active boolean not null default true,
  created_by bigint references app_users(id),
  created_at timestamptz not null default now()
);

create table if not exists machine_kpi_definitions (
  id bigserial primary key,
  category_id bigint references machine_categories(id),
  kpi_code text not null,
  kpi_name text not null,
  unit text not null default '',
  higher_is_better boolean not null default true,
  weight numeric(5,2) not null default 1.0,
  description text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists machine_kpi_targets (
  id bigserial primary key,
  machine_id bigint not null references machines(id),
  kpi_id bigint not null references machine_kpi_definitions(id),
  target_value numeric(12,2) not null,
  effective_month text not null,
  set_by bigint references app_users(id),
  reason text,
  created_at timestamptz not null default now(),
  unique(machine_id, kpi_id, effective_month)
);

create table if not exists machine_daily_logs (
  id bigserial primary key,
  machine_id bigint not null references machines(id),
  log_date date not null,
  shift text not null default 'Full Day',
  hours_worked numeric(5,2) not null default 0,
  downtime_hours numeric(5,2) not null default 0,
  downtime_reason text,
  fuel_consumed numeric(8,2) not null default 0,
  daily_production numeric(10,2) not null default 0,
  capacity_per_day numeric(10,2) not null default 0,
  product_type text,
  logs_loaded numeric(10,2) not null default 0,
  logs_unloaded numeric(10,2) not null default 0,
  loading_trips int not null default 0,
  remarks text,
  created_by bigint references app_users(id),
  created_at timestamptz not null default now(),
  unique(machine_id, log_date, shift)
);

create table if not exists machine_log_categories (
  id bigserial primary key,
  name text not null unique,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists machine_maintenance_schedules (
  id bigserial primary key,
  machine_id bigint not null references machines(id),
  maintenance_type text not null,
  frequency_days int not null default 30,
  last_performed date,
  next_due date,
  estimated_hours numeric(5,2) not null default 1,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists idx_machine_daily_logs_date on machine_daily_logs(log_date desc);
create index if not exists idx_machine_kpi_targets_month on machine_kpi_targets(effective_month);

-- ── Forestry Compartments ─────────────────────────────────────────────────────

create table if not exists compartments (
  id bigserial primary key,
  compt_name text not null unique,
  sub_name text,
  species text not null,
  area_ha numeric(10,3) not null,
  volume_m3 numeric(10,3) not null, -- area_ha * 219 m³/ha
  entry_date date not null,
  status text not null default 'Active', -- Active / Completed
  created_by bigint references app_users(id),
  created_at timestamptz not null default now()
);

-- Link harvest_logs to compartments
alter table harvest_logs add column if not exists compt_id bigint references compartments(id);
alter table harvest_logs add column if not exists sub_name text;
-- trees_felled = quantity (already exists), num_logs and volume_m3 computed in queries

-- Alter daily_logs to track logs received at sawmill
alter table daily_logs add column if not exists logs_received int not null default 0;
alter table daily_logs add column if not exists timber_kiln_dried int not null default 0;
alter table daily_logs add column if not exists timber_cca_treated int not null default 0;
alter table daily_logs add column if not exists timber_untreated int not null default 0;
alter table daily_logs add column if not exists product_size text;
alter table daily_logs add column if not exists machine text;
alter table daily_logs add column if not exists operators text;

-- ── Poles Procurement Workflow ────────────────────────────────────────────────
create table if not exists poles_purchase_requests (
  id               bigserial primary key,
  supplier_name    text not null,
  requested_qty    int not null,
  unit_price       numeric(12,2),
  notes            text,
  status           text not null default 'pending',
  requested_by     bigint references app_users(id),
  requested_at     timestamptz not null default now(),
  approved_by      bigint references app_users(id),
  approved_at      timestamptz,
  rejection_reason text,
  workshop_id      bigint references warehouses(id)
);

create table if not exists poles_deliveries (
  id                  bigserial primary key,
  purchase_request_id bigint references poles_purchase_requests(id),
  delivery_date       date not null,
  supplier_name       text,
  delivered_qty       int not null,
  delivery_note_ref   text,
  approved_qty        int,
  rejected_qty        int,
  rejection_reason    text,
  confirmed_by        bigint references app_users(id),
  confirmed_at        timestamptz,
  quality_checked_by  bigint references app_users(id),
  quality_checked_at  timestamptz,
  status              text not null default 'pending',
  notes               text,
  workshop_id         bigint references warehouses(id),
  created_by          bigint references app_users(id),
  created_at          timestamptz not null default now()
);

-- ADM-31: link VAT entries to their source stock transfer
alter table value_added_timber add column if not exists source_transfer_id bigint references stock_transfers(id);

-- ── Log Transport ─────────────────────────────────────────────────────────────

create table if not exists log_transport (
  id bigserial primary key,
  transport_date date not null,
  compt_id bigint references compartments(id),
  sub_name text,
  qty_transported int not null,
  unit text not null default 'logs',
  notes text,
  logged_by bigint references app_users(id),
  created_at timestamptz not null default now()
);

-- ── Value-Added Timber ───────────────────────────────────────────────────────

create table if not exists value_added_timber (
  id bigserial primary key,
  entry_date date not null,
  type_value_added text not null, -- 'Kiln-dried timber' | 'CCA treated timber'
  product_size text not null,
  num_timber int not null,
  created_by bigint references app_users(id),
  created_at timestamptz not null default now()
);

create index if not exists idx_compartments_status on compartments(status);
create index if not exists idx_log_transport_date on log_transport(transport_date desc);
create index if not exists idx_value_added_timber_date on value_added_timber(entry_date desc);

-- ── Workshop Isolation ────────────────────────────────────────────────────────
-- Each production, sales, and labour record is tagged with the warehouse/workshop
-- that owns it. NULL means legacy (pre-isolation) — visible to all authorised roles.
alter table daily_logs             add column if not exists workshop_id bigint references warehouses(id);
alter table harvest_logs           add column if not exists workshop_id bigint references warehouses(id);
alter table value_added_timber     add column if not exists workshop_id bigint references warehouses(id);
alter table machine_daily_logs     add column if not exists workshop_id bigint references warehouses(id);
alter table log_transport          add column if not exists workshop_id bigint references warehouses(id);
alter table sales_orders           add column if not exists workshop_id bigint references warehouses(id);
alter table casual_labour_requests add column if not exists workshop_id bigint references warehouses(id);
alter table casuals                add column if not exists workshop_id bigint references warehouses(id);
alter table weekly_expenses        add column if not exists workshop_id bigint references warehouses(id);
alter table kpi_budgets            add column if not exists workshop_id bigint references warehouses(id);

-- Partial indexes on active records for fast per-workshop filtering
create index if not exists idx_daily_logs_workshop   on daily_logs(workshop_id)          where deleted_at is null;
create index if not exists idx_harvest_logs_workshop  on harvest_logs(workshop_id)         where deleted_at is null;
create index if not exists idx_vat_workshop           on value_added_timber(workshop_id)   where deleted_at is null;
create index if not exists idx_mdl_workshop           on machine_daily_logs(workshop_id)   where deleted_at is null;
create index if not exists idx_log_transport_workshop on log_transport(workshop_id)        where deleted_at is null;
create index if not exists idx_sales_orders_workshop  on sales_orders(workshop_id)         where deleted_at is null;
create index if not exists idx_casual_req_workshop    on casual_labour_requests(workshop_id);
create index if not exists idx_casuals_workshop       on casuals(workshop_id);

-- ── Machine Fuel / Consumption Logs ──────────────────────────────────────────

create table if not exists machine_fuel_logs (
  id bigserial primary key,
  log_date date not null,
  machine_id bigint references machines(id),
  vehicle_id bigint references vehicles(id),
  operator text,
  fuel_type text not null, -- diesel / petroleum / petrol / chain oil / engine oil
  quantity numeric(10,2) not null default 0,
  unit text not null default 'liters',
  notes text,
  logged_by bigint references app_users(id),
  created_at timestamptz not null default now()
);

create index if not exists idx_machine_fuel_logs_date on machine_fuel_logs(log_date desc);

-- ── Casual Labour Requests ────────────────────────────────────────────────────

create table if not exists casual_labour_requests (
  id bigserial primary key,
  start_date date not null,
  end_date date not null,
  task text not null,
  num_casuals int not null,
  description text,
  comments text,
  status text not null default 'Pending', -- Pending / Approved / Rejected
  reviewed_by bigint references app_users(id),
  reviewed_at timestamptz,
  created_by bigint references app_users(id),
  created_at timestamptz not null default now()
);

-- ── Casuals ───────────────────────────────────────────────────────────────────

create table if not exists casuals (
  id bigserial primary key,
  full_name text not null,
  national_id text,
  phone text,
  gender text,
  date_of_birth date,
  address text,
  department text,
  work_location text,
  job_role text,
  supervisor text,
  start_date date,
  end_date date,
  emergency_name text,
  emergency_relationship text,
  emergency_phone text,
  salary_per_action numeric(10,2),
  active boolean not null default true,
  created_by bigint references app_users(id),
  created_at timestamptz not null default now()
);

-- New columns on existing tables
alter table harvest_logs add column if not exists logs_crosscut int not null default 0;
alter table harvest_logs add column if not exists logs_handrolled int not null default 0;
alter table machines add column if not exists plate_number text;
alter table log_transport add column if not exists tractor_plate text;
alter table log_transport add column if not exists loggers_number text;

-- ── Deletion Request Workflow ─────────────────────────────────────────────────
-- Tracks pending deletion approvals and audit trail for soft-deleted records.
create table if not exists deletion_requests (
  id             bigserial primary key,
  table_name     text not null,
  record_id      bigint not null,
  entity_type    text not null,
  entity_ref     text,
  deletion_reason text not null,
  requested_by   bigint not null references app_users(id),
  requested_at   timestamptz not null default now(),
  status         text not null default 'pending', -- pending | approved | rejected
  reviewed_by    bigint references app_users(id),
  reviewed_at    timestamptz,
  review_notes   text,
  record_snapshot jsonb
);
create index if not exists idx_deletion_requests_status on deletion_requests(status);
create index if not exists idx_deletion_requests_table  on deletion_requests(table_name, record_id);

