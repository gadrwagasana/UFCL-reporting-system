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

