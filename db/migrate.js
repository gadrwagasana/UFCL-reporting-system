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
  // Machine log item category
  await pool.query(`alter table machine_daily_logs add column if not exists item_category text`);
  // Seed default machine log categories (idempotent)
  const defaultCats = ['Spare Parts','Lubricants','Fuel','Tools','Consumables','Maintenance','Other'];
  for (const name of defaultCats) {
    await pool.query(`insert into machine_log_categories(name) values($1) on conflict(name) do nothing`, [name]);
  }
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
    admin: ['dashboard', 'users', 'audit', 'export', 'notifications', 'changes',
            'warehouses', 'stock-items', 'stock-movements', 'vehicles', 'deliveries', 'dispatch',
            'harvest', 'timber-inventory', 'transport',
            'machines', 'machine-logs', 'machine-kpi',
            'compartments', 'daily-harvest', 'daily-timber', 'daily-poles',
            'log-transport', 'value-added-timber',
            'machine-fuel', 'casual-requests', 'casuals'],
    ceo: ['dashboard', 'weekly-cost', 'weekly-perf', 'monthly', 'kpi', 'audit', 'export', 'users', 'notifications', 'changes',
          'timber-inventory', 'vehicles', 'deliveries', 'dispatch', 'transport',
          'machines', 'machine-kpi', 'compartments', 'log-transport', 'value-added-timber',
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
                 'machine-fuel', 'casual-requests', 'casuals'],
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

