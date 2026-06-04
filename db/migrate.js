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
    admin: ['dashboard', 'users', 'audit', 'export', 'notifications', 'changes'],
    ceo: ['dashboard', 'weekly-cost', 'weekly-perf', 'monthly', 'kpi', 'audit', 'export', 'users', 'notifications', 'changes'],
    operations: ['dashboard', 'daily', 'products', 'weekly-cost', 'weekly-perf', 'inventory', 'audit', 'export', 'notifications', 'changes'],
    sales: ['dashboard', 'sales', 'products', 'audit', 'export', 'notifications', 'changes'],
    finance: ['dashboard', 'weekly-cost', 'monthly', 'sage', 'audit', 'export', 'notifications', 'changes'],
    logistics: ['dashboard', 'logistics', 'inventory', 'audit', 'export', 'notifications', 'changes'],
    supervisor: ['dashboard', 'daily', 'audit', 'export', 'notifications', 'changes'],
    storekeeper: ['dashboard', 'inventory', 'audit', 'export', 'notifications']
  };

  for (const [role, label, description] of roles) {
    await pool.query(
      `insert into role_definitions(role, label, description, responsibilities, permissions)
       values ($1,$2,$3,$4,$5)`,
      [role, label, description, JSON.stringify([]), JSON.stringify(permissionsByRole[role] || [])]
    );
  }
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

async function migrate() {
  await ensureDatabaseExists();
  await ensureSchema();
  await seedIfEmpty();
  await seedRoles();
  await seedExpenseCategories();
  await seedProductCatalog();
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

