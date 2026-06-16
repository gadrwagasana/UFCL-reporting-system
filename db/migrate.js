const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');
const { Client } = require('pg');
const { pool } = require('./pool');

dotenv.config();

async function ensureDatabaseExists() {
  const targetDb = process.env.PGDATABASE;
  if (!targetDb) throw new Error('Missing PGDATABASE in .env');

  const maintenanceDb = process.env.PGMAINTENANCE_DB || 'postgres';
  const client = new Client({
    host: process.env.PGHOST,
    port: Number(process.env.PGPORT || 5432),
    database: maintenanceDb,
    user: process.env.PGUSER,
    password: process.env.PGPASSWORD,
    connectionTimeoutMillis: 10_000
  });

  await client.connect();
  try {
    const { rows } = await client.query('select 1 from pg_database where datname=$1', [targetDb]);
    if (rows.length) return;

    // CREATE DATABASE cannot run inside a transaction.
    const safeName = targetDb.replace(/"/g, '""');
    await client.query(`create database "${safeName}"`);
  } finally {
    await client.end();
  }
}

async function ensureSchema() {
  const schemaSql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  await pool.query(schemaSql);
  await pool.query(
    `alter table role_definitions
     add column if not exists permissions jsonb not null default '[]'::jsonb`
  );
  await pool.query(
    `alter table app_users
     add column if not exists department text`
  );
  await pool.query(
    `alter table app_users
     add column if not exists user_permissions jsonb not null default '[]'::jsonb`
  );
  await pool.query(
    `alter table app_users
     add column if not exists user_responsibilities jsonb not null default '[]'::jsonb`
  );
  await pool.query(
    `alter table daily_logs
     add column if not exists machine text`
  );
  await pool.query(
    `alter table daily_logs
     add column if not exists product_size text`
  );
  await pool.query(
    `alter table sales_orders
     add column if not exists status text not null default 'Pending'`
  );
  // Product sub-types and structured dimensions
  await pool.query(`alter table products add column if not exists sub_type text`);
  await pool.query(`alter table products add column if not exists width_mm int`);
  await pool.query(`alter table products add column if not exists height_mm int`);
  await pool.query(`alter table products add column if not exists length_m numeric(5,2)`);
  await pool.query(`alter table products add column if not exists diameter_mm int`);
  await pool.query(`alter table products add column if not exists machine text`);
  // Sales sub-type
  await pool.query(`alter table sales_orders add column if not exists product_sub_type text`);
  // Daily log timber breakdown
  await pool.query(`alter table daily_logs add column if not exists timber_kiln_dried int not null default 0`);
  await pool.query(`alter table daily_logs add column if not exists timber_cca_treated int not null default 0`);
  await pool.query(`alter table daily_logs add column if not exists timber_untreated int not null default 0`);
  // Sawmill logs received tracking
  await pool.query(`alter table daily_logs add column if not exists logs_received int not null default 0`);
  // Harvest logs compartment link
  await pool.query(`alter table harvest_logs add column if not exists compt_id bigint references compartments(id)`);
  await pool.query(`alter table harvest_logs add column if not exists sub_name text`);
  // Harvest logs — actual log counts (trees may produce more than 2 logs for tall trees)
  await pool.query(`alter table harvest_logs add column if not exists logs_crosscut int not null default 0`);
  await pool.query(`alter table harvest_logs add column if not exists logs_handrolled int not null default 0`);
  // Machine plate number
  await pool.query(`alter table machines add column if not exists plate_number text`);
  // Log transport extra fields
  await pool.query(`alter table log_transport add column if not exists tractor_plate text`);
  await pool.query(`alter table log_transport add column if not exists loggers_number text`);
  // Rename expense category 'Labor' → 'Casuals'
  await pool.query(`update expense_categories set name='Casuals', description='Casual labour wages' where name='Labor'`);
  // Workshop assignment for users
  await pool.query(`alter table app_users add column if not exists workshop_id bigint references warehouses(id)`);
  // Workshop isolation for logistics_items (inventory)
  await pool.query(`alter table logistics_items add column if not exists workshop_id bigint references warehouses(id)`);
  // Vehicle fleet — extended fields
  const vAlter = [
    `alter table vehicles add column if not exists ownership_type text`,
    `alter table vehicles add column if not exists vehicle_category text`,
    `alter table vehicles add column if not exists year int`,
    `alter table vehicles add column if not exists chassis_vin text`,
    `alter table vehicles add column if not exists engine_number text`,
    `alter table vehicles add column if not exists odometer_reading int`,
    `alter table vehicles add column if not exists asset_code text`,
    `alter table vehicles add column if not exists purchase_date date`,
    `alter table vehicles add column if not exists purchase_cost numeric(14,2)`,
    `alter table vehicles add column if not exists department text`,
    `alter table vehicles add column if not exists driver_assigned text`,
    `alter table vehicles add column if not exists road_license_expiry date`,
    `alter table vehicles add column if not exists inspection_expiry date`,
    `alter table vehicles add column if not exists owner_name text`,
    `alter table vehicles add column if not exists owner_type text`,
    `alter table vehicles add column if not exists owner_id_number text`,
    `alter table vehicles add column if not exists owner_phone text`,
    `alter table vehicles add column if not exists owner_email text`,
    `alter table vehicles add column if not exists owner_address text`,
    `alter table vehicles add column if not exists contract_number text`,
    `alter table vehicles add column if not exists contract_start_date date`,
    `alter table vehicles add column if not exists contract_end_date date`,
    `alter table vehicles add column if not exists payment_rate numeric(14,2)`,
    `alter table vehicles add column if not exists payment_method text`,
    `alter table vehicles add column if not exists assigned_project text`,
    `alter table vehicles add column if not exists driver_name text`,
    `alter table vehicles add column if not exists driver_phone text`,
    `alter table vehicles add column if not exists driver_license_number text`,
    `alter table vehicles add column if not exists driver_license_expiry date`,
    `alter table vehicles add column if not exists doc_registration_card text`,
    `alter table vehicles add column if not exists doc_insurance_cert text`,
    `alter table vehicles add column if not exists doc_photos text`,
    `alter table vehicles add column if not exists doc_owner_id text`,
    `alter table vehicles add column if not exists doc_contract text`,
  ];
  for (const sql of vAlter) await pool.query(sql);
  // Machine log item category
  await pool.query(`alter table machine_daily_logs add column if not exists item_category text`);
  // Seed default machine log categories (idempotent)
  const defaultCats = ['Spare Parts','Lubricants','Fuel','Tools','Consumables','Maintenance','Other'];
  for (const name of defaultCats) {
    await pool.query(`insert into machine_log_categories(name) values($1) on conflict(name) do nothing`, [name]);
  }
  // Workshop type on warehouses
  await pool.query(`alter table warehouses add column if not exists workshop_type text`);
  // Machine → workshop assignment
  await pool.query(`alter table machines add column if not exists workshop_id bigint references warehouses(id)`);
  // Transfer approval workflow on stock movements
  await pool.query(`alter table stock_movements add column if not exists approval_status text`);
  await pool.query(`alter table stock_movements add column if not exists approved_by bigint references app_users(id)`);
  await pool.query(`alter table stock_movements add column if not exists approved_at timestamptz`);
  await pool.query(`alter table stock_movements add column if not exists rejection_reason text`);
  // Material requests table
  await pool.query(`
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
    )
  `);
  // Workshop cost center tracking on maintenance records
  await pool.query(`alter table maintenance_records add column if not exists workshop_id bigint references warehouses(id)`);

  // ── Soft-delete columns for all critical business tables ─────────────────────
  // Records are never hard-deleted; they move to Trash and can be restored within 30 days.
  const SOFT_DELETE_TABLES = [
    'daily_logs', 'harvest_logs', 'value_added_timber', 'machine_daily_logs',
    'compartments', 'log_transport', 'machine_fuel_logs', 'maintenance_records',
    'sales_orders', 'stock_movements'
  ];
  for (const t of SOFT_DELETE_TABLES) {
    await pool.query(`alter table ${t} add column if not exists pending_deletion boolean not null default false`);
    await pool.query(`alter table ${t} add column if not exists deleted_at timestamptz`);
    await pool.query(`alter table ${t} add column if not exists deleted_by bigint references app_users(id)`);
    await pool.query(`alter table ${t} add column if not exists deletion_reason text`);
  }
  // deletion_requests table (created by schema.sql; add reference column on stock_movements if missing)
  await pool.query(`create index if not exists idx_del_req_status on deletion_requests(status) where status='pending'`);
  // Approval workflow enhancements
  await pool.query(`alter table notifications add column if not exists for_user_id bigint references app_users(id) on delete cascade`);
  await pool.query(`create index if not exists idx_notif_for_user on notifications(for_user_id) where for_user_id is not null`);
  await pool.query(`alter table pending_edits add column if not exists old_snapshot jsonb`);
  // Machine fuel logs — support company vehicles alongside machines
  await pool.query(`alter table machine_fuel_logs add column if not exists vehicle_id bigint references vehicles(id)`);

  // Labour request breakdown items
  await pool.query(`alter table casual_labour_requests add column if not exists labour_items jsonb`);

  // Sales order — currency, tax type, payment due date & payment status
  await pool.query(`alter table sales_orders add column if not exists currency text not null default 'RWF'`);
  await pool.query(`alter table sales_orders add column if not exists price_tax_type text not null default 'Exclusive'`);
  await pool.query(`alter table sales_orders add column if not exists payment_due_date date`);
  await pool.query(`alter table sales_orders add column if not exists payment_status text not null default 'Unpaid'`);

  // Customer registry
  await pool.query(`
    create table if not exists customers (
      id bigserial primary key,
      name text not null,
      contact_person text,
      phone text,
      email text,
      address text,
      tin text,
      notes text,
      active boolean not null default true,
      created_by bigint references app_users(id),
      created_at timestamptz not null default now()
    )
  `);
  await pool.query(`create index if not exists idx_customers_active on customers(active)`);
  await pool.query(`alter table sales_orders add column if not exists customer_id bigint references customers(id)`);

  // Custom stock categories
  await pool.query(`
    create table if not exists stock_categories (
      id bigserial primary key,
      name text not null unique,
      created_by bigint references app_users(id),
      created_at timestamptz not null default now()
    )
  `);

  // ── Performance indexes ──────────────────────────────────────────────────────
  await pool.query(`create index if not exists idx_stock_mv_item     on stock_movements(item_id)`);
  await pool.query(`create index if not exists idx_stock_mv_wh       on stock_movements(warehouse_id)`);
  await pool.query(`create index if not exists idx_stock_mv_to_wh    on stock_movements(to_warehouse_id)`);
  await pool.query(`create index if not exists idx_stock_levels_item on stock_levels(item_id)`);
  await pool.query(`create index if not exists idx_stock_levels_wh   on stock_levels(warehouse_id)`);
  await pool.query(`create index if not exists idx_mdl_machine_date  on machine_daily_logs(machine_id, log_date desc)`);
  await pool.query(`create index if not exists idx_mat_req_workshop  on material_requests(workshop_id, status)`);
  await pool.query(`create index if not exists idx_notif_read_user   on notifications_read(user_id)`);

  // ── Stock summary materialized view ──────────────────────────────────────────
  // Drop and recreate so formula updates take effect (IF NOT EXISTS won't update an existing view).
  await pool.query(`drop materialized view if exists mv_stock_summary cascade`);
  await pool.query(`
    create materialized view mv_stock_summary as
    with produced as (
      select coalesce(sum(timber_units),0)::int as timber,
             coalesce(sum(poles_units),0)::int  as poles
      from daily_logs where deleted_at is null
    ),
    value_added as (
      select coalesce(sum(case when type_value_added='Kiln-dried timber'  then num_timber else 0 end),0)::int as kiln_dried,
             coalesce(sum(case when type_value_added='CCA treated timber' then num_timber else 0 end),0)::int as cca_treated
      from value_added_timber where deleted_at is null
    ),
    sold as (
      select
        coalesce(sum(case when product_type='Timber' then quantity else 0 end),0)::int as timber,
        coalesce(sum(case when product_type='Timber' and coalesce(product_sub_type,'')='Kiln-dried'  then quantity else 0 end),0)::int as kiln_dried,
        coalesce(sum(case when product_type='Timber' and coalesce(product_sub_type,'')='CCA-treated' then quantity else 0 end),0)::int as cca_treated,
        coalesce(sum(case when product_type='Timber' and coalesce(product_sub_type,'')='Untreated'   then quantity else 0 end),0)::int as untreated,
        coalesce(sum(case when product_type='Poles'  then quantity else 0 end),0)::int as poles
      from sales_orders where deleted_at is null
    )
    select
      p.timber                                                as timber_produced,
      p.poles                                                 as poles_produced,
      va.kiln_dried                                           as kiln_dried_produced,
      va.cca_treated                                          as cca_treated_produced,
      greatest(p.timber - va.kiln_dried - va.cca_treated, 0) as untreated_produced,
      s.timber     as timber_sold,     s.poles     as poles_sold,
      s.kiln_dried as kiln_dried_sold, s.cca_treated as cca_treated_sold, s.untreated as untreated_sold,
      (p.timber    - s.timber)                                as timber_stock,
      (p.poles     - s.poles)                                 as poles_stock,
      (va.kiln_dried  - s.kiln_dried)                        as kiln_dried_stock,
      (va.cca_treated - s.cca_treated)                       as cca_treated_stock,
      (greatest(p.timber - va.kiln_dried - va.cca_treated, 0) - s.untreated) as untreated_stock
    from produced p, value_added va, sold s
  `);
  await pool.query(`create unique index mv_stock_summary_unique on mv_stock_summary((1))`);
}

async function seedProductCatalog() {
  const { rows } = await pool.query('select count(*)::int as n from product_catalog');
  if (rows[0].n > 0) return;

  const catalog = [
    ['RT40', 'Small'],
    ['RT40', 'Medium'],
    ['RT40', 'Large'],
    ['RT70', 'Small'],
    ['RT70', 'Medium'],
    ['RT70', 'Large']
  ];

  for (const [machine, size] of catalog) {
    await pool.query(
      `insert into product_catalog(machine, product_size, active)
       values ($1,$2,true)`,
      [machine, size]
    );
  }
}

async function seedIfEmpty() {
  const { rows } = await pool.query('select count(*)::int as n from app_users');
  if (rows[0].n > 0) return;

  const pwHash = await bcrypt.hash('UFCL@1234', 10);
  const users = [
    ['admin', 'System Admin', 'admin', null],
    ['ceo', 'UFCL CEO', 'ceo', null],
    ['operations', 'Operations Manager', 'operations', 'Operations'],
    ['sales', 'Sales Manager', 'sales', 'Sales'],
    ['finance', 'Finance Manager', 'finance', 'Finance'],
    ['logistics', 'Logistics Manager', 'logistics', 'Logistics'],
    ['supervisor', 'Shift Supervisor', 'supervisor', 'Operations'],
    ['storekeeper', 'Storekeeper', 'storekeeper', 'Logistics']
  ];

  for (const [username, name, role, department] of users) {
    await pool.query(
      `insert into app_users(username, name, role, department, user_permissions, user_responsibilities, password_hash, active)
       values ($1,$2,$3,$4,$5,$6,$7,true)`,
      [username, name, role, department, JSON.stringify([]), JSON.stringify([]), pwHash]
    );
  }
}

async function seedRoles() {
  const { rows } = await pool.query('select count(*)::int as n from role_definitions');
  if (rows[0].n > 0) return;

  const roles = [
    ['admin', 'System Admin', 'Manage all users, roles, and system permissions.'],
    ['ceo', 'CEO', 'Oversee company performance, approvals, and executive dashboards.'],
    ['operations', 'Operations Manager', 'Manage production, daily logs, and operational workflows.'],
    ['sales', 'Sales Manager', 'Manage orders, customer relationships, and commercial activity.'],
    ['finance', 'Finance Manager', 'Manage financial reports, approvals, and reconciliations.'],
    ['logistics', 'Logistics Manager', 'Manage shipments, stock, and warehouse operations.'],
    ['supervisor', 'Supervisor', 'Supervise production teams and approve change requests.'],
    ['storekeeper', 'Storekeeper', 'Maintain inventory and manage stock flows.']
  ];

  const permissionsByRole = {
    admin: ['dashboard', 'users', 'audit', 'export', 'notifications', 'changes',
            'warehouses', 'stock-items', 'stock-movements', 'vehicles', 'deliveries', 'dispatch',
            'harvest', 'timber-inventory', 'transport'],
    ceo: ['dashboard', 'weekly-cost', 'weekly-perf', 'monthly', 'kpi', 'audit', 'export', 'users', 'notifications', 'changes',
          'timber-inventory', 'vehicles', 'deliveries', 'dispatch', 'transport'],
    operations: ['dashboard', 'daily', 'daily-timber', 'daily-poles', 'daily-harvest', 'products',
                 'weekly-cost', 'weekly-perf', 'inventory', 'audit', 'export', 'notifications', 'changes',
                 'timber-inventory', 'harvest', 'stock-items', 'stock-movements', 'transport'],
    sales: ['dashboard', 'sales', 'products', 'audit', 'export', 'notifications', 'changes', 'deliveries', 'transport'],
    finance: ['dashboard', 'weekly-cost', 'monthly', 'sage', 'audit', 'export', 'notifications', 'changes'],
    logistics: ['dashboard', 'logistics', 'inventory', 'audit', 'export', 'notifications', 'changes',
                'warehouses', 'stock-items', 'stock-movements', 'vehicles', 'deliveries', 'dispatch', 'transport'],
    supervisor: ['dashboard', 'daily', 'daily-timber', 'daily-poles', 'daily-harvest',
                 'audit', 'export', 'notifications', 'changes', 'harvest', 'timber-inventory'],
    storekeeper: ['dashboard', 'inventory', 'audit', 'export', 'notifications',
                  'warehouses', 'stock-items', 'stock-movements']
  };

  for (const [role, label, description] of roles) {
    await pool.query(
      `insert into role_definitions(role, label, description, responsibilities, permissions)
       values ($1,$2,$3,$4,$5)`,
      [role, label, description, JSON.stringify([]), JSON.stringify(permissionsByRole[role] || [])]
    );
  }
}

async function seedDefaultWarehouse() {
  const { rows } = await pool.query('select count(*)::int as n from warehouses');
  if (rows[0].n > 0) return;
  await pool.query(
    `insert into warehouses(name, location, capacity, notes, active)
     values ($1,$2,$3,$4,true)`,
    ['Main Warehouse', 'UFCL Main Site', 10000, 'Primary storage facility']
  );
}

async function seedExpenseCategories() {
  const { rows } = await pool.query('select count(*)::int as n from expense_categories');
  if (rows[0].n > 0) return;

  const categories = [
    ['Labor', 'Employee wages and salaries'],
    ['Materials', 'Raw materials and supplies'],
    ['Utilities', 'Electricity, water, and fuel'],
    ['Maintenance', 'Equipment maintenance and repairs'],
    ['Transport', 'Logistics and transportation costs'],
    ['Packaging', 'Product packaging materials'],
    ['Overhead', 'General administrative costs']
  ];

  for (const [name, description] of categories) {
    await pool.query(
      `insert into expense_categories(name, description, active)
       values ($1,$2,true)`,
      [name, description]
    );
  }
}

async function seedMachineCategories() {
  const { rows } = await pool.query('select count(*)::int as n from machine_categories');
  if (rows[0].n > 0) return;

  const categories = [
    ['Sawmill', 'Timber cutting and processing machines', 'ti-cut'],
    ['Log Loader', 'Machines for loading and unloading log volumes', 'ti-crane'],
    ['Chipper', 'Wood chipping and shredding equipment', 'ti-axe'],
    ['Crane / Forklift', 'Material handling and lifting equipment', 'ti-arrow-up'],
    ['Generator', 'Power generation equipment', 'ti-bolt']
  ];

  for (const [name, description, icon] of categories) {
    await pool.query(
      `insert into machine_categories(name, description, icon) values ($1,$2,$3)`,
      [name, description, icon]
    );
  }
}

async function seedMachineKpiDefinitions() {
  const { rows } = await pool.query('select count(*)::int as n from machine_kpi_definitions');
  if (rows[0].n > 0) return;

  const { rows: cats } = await pool.query('select id, name from machine_categories');
  const catMap = Object.fromEntries(cats.map(c => [c.name, c.id]));

  const defs = [
    // Universal (category_id = null applies to all)
    [null, 'utilization_hours', 'Utilization Hours', 'hrs', true, 1.0, 'Total productive hours worked'],
    [null, 'downtime_hours', 'Downtime Hours', 'hrs', false, 1.0, 'Total non-productive downtime'],
    [null, 'fuel_consumed', 'Fuel Consumed', 'L', false, 0.5, 'Total fuel consumption'],
    // Sawmill-specific
    [catMap['Sawmill'], 'daily_production', 'Daily Production', 'm³', true, 2.0, 'Actual daily output in cubic metres'],
    [catMap['Sawmill'], 'efficiency_pct', 'Production Efficiency %', '%', true, 2.0, 'Actual output vs capacity per day'],
    // Log Loader-specific
    [catMap['Log Loader'], 'logs_loaded', 'Logs Loaded', 'm³', true, 2.0, 'Volume of logs loaded'],
    [catMap['Log Loader'], 'logs_unloaded', 'Logs Unloaded', 'm³', true, 1.5, 'Volume of logs unloaded'],
    [catMap['Log Loader'], 'loading_trips', 'Loading Trips', 'trips', true, 1.0, 'Number of loading trips completed']
  ];

  for (const [cat_id, kpi_code, kpi_name, unit, higher_is_better, weight, description] of defs) {
    await pool.query(
      `insert into machine_kpi_definitions(category_id, kpi_code, kpi_name, unit, higher_is_better, weight, description)
       values ($1,$2,$3,$4,$5,$6,$7)`,
      [cat_id, kpi_code, kpi_name, unit, higher_is_better, weight, description]
    );
  }
}

async function updateRolePermissions() {
  const permissionsByRole = {
    admin: ['dashboard', 'ceo', 'users', 'audit', 'export', 'notifications', 'changes',
            'daily', 'daily-timber', 'daily-poles', 'daily-harvest', 'sales', 'products',
            'inventory', 'logistics', 'logistics-dashboard',
            'warehouses', 'stock-items', 'stock-movements', 'vehicles', 'deliveries', 'dispatch',
            'harvest', 'timber-inventory', 'transport',
            'machines', 'machine-logs', 'machine-kpi',
            'compartments', 'log-transport', 'value-added-timber',
            'machine-fuel', 'casual-requests', 'casuals',
            'weekly-cost', 'weekly-perf', 'monthly', 'kpi', 'sage'],
    ceo: ['dashboard', 'ceo', 'weekly-cost', 'weekly-perf', 'monthly', 'kpi', 'audit', 'export', 'users', 'notifications', 'changes',
          'daily-harvest', 'timber-inventory', 'vehicles', 'deliveries', 'dispatch', 'transport',
          'logistics-dashboard', 'machines', 'machine-kpi', 'compartments', 'log-transport', 'value-added-timber',
          'casual-requests', 'casuals'],
    operations: ['dashboard', 'daily', 'daily-timber', 'daily-poles', 'daily-harvest', 'products',
                 'weekly-cost', 'weekly-perf', 'inventory', 'audit', 'export', 'notifications', 'changes',
                 'timber-inventory', 'harvest', 'stock-items', 'stock-movements', 'transport',
                 'machines', 'machine-logs', 'machine-kpi',
                 'compartments', 'log-transport', 'value-added-timber',
                 'machine-fuel', 'casual-requests', 'casuals'],
    sales: ['dashboard', 'sales', 'products', 'audit', 'export', 'notifications', 'changes', 'deliveries', 'transport'],
    finance: ['dashboard', 'weekly-cost', 'monthly', 'sage', 'audit', 'export', 'notifications', 'changes'],
    logistics: ['dashboard', 'logistics', 'inventory', 'audit', 'export', 'notifications', 'changes',
                'warehouses', 'stock-items', 'stock-movements', 'vehicles', 'deliveries', 'dispatch', 'transport',
                'machines', 'log-transport', 'machine-fuel'],
    supervisor: ['dashboard', 'daily', 'daily-timber', 'daily-poles', 'daily-harvest',
                 'audit', 'export', 'notifications', 'changes', 'harvest', 'timber-inventory',
                 'machine-logs', 'compartments', 'log-transport', 'value-added-timber',
                 'machine-fuel', 'casual-requests', 'casuals',
                 'workshop-overview', 'material-requests'],
    storekeeper: ['dashboard', 'inventory', 'audit', 'export', 'notifications',
                  'warehouses', 'stock-items', 'stock-movements']
  };

  for (const [role, perms] of Object.entries(permissionsByRole)) {
    const { rows } = await pool.query('select permissions from role_definitions where role=$1', [role]);
    if (!rows.length) continue;
    const existing = Array.isArray(rows[0].permissions) ? rows[0].permissions : [];
    const newPerms = Array.from(new Set([...existing, ...perms]));
    await pool.query(
      'update role_definitions set permissions=$1, updated_at=now() where role=$2',
      [JSON.stringify(newPerms), role]
    );
  }
}

async function migrate() {
  await ensureDatabaseExists();
  await ensureSchema();
  await seedIfEmpty();
  await seedRoles();
  await seedExpenseCategories();
  await seedProductCatalog();
  await seedDefaultWarehouse();
  await seedMachineCategories();
  await seedMachineKpiDefinitions();
  await updateRolePermissions();
}

if (require.main === module) {
  migrate()
    .then(() => {
      console.log('Migration complete.');
      process.exit(0);
    })
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}

module.exports = { migrate };

