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
  // Global Search — accent-insensitive matching (e.g. "Café" matches "Cafe").
  await pool.query(`create extension if not exists unaccent`);
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
  await pool.query(`alter table app_users add column if not exists deleted_at  timestamptz`);
  await pool.query(`alter table app_users add column if not exists deleted_by  bigint`);
  await pool.query(`alter table daily_logs add column if not exists operators text`);
  await pool.query(`
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
    )
  `);
  await pool.query(`
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
    )
  `);
  await pool.query(`
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
    )
  `);
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
    'daily_logs', 'harvest_logs', 'machine_daily_logs',
    'compartments', 'log_transport', 'machine_fuel_logs', 'maintenance_records',
    'sales_orders', 'stock_movements',
    // Phase 1 Logistics fix — these four tables were governed by applyGovernance
    // (time-gated edit/delete approval) but had no soft-delete columns, so an
    // approved deletion request for any of them failed at processApprovalDecision's
    // SOFT_DELETE_ALLOWED check. Bringing them into the same convention every
    // other governed table already uses.
    'delivery_orders', 'dispatch_requests', 'transport_jobs', 'logistics_items',
    // Fleet & Equipment Phase 1 — vehicles previously had no governance and no
    // soft-delete at all (hard delete, cascading hard-deletes of fuel_logs and
    // maintenance_records — permanent loss of operating history). Both tables
    // now follow the same convention as every other governed Fleet table
    // (maintenance_records, machine_fuel_logs, machine_daily_logs).
    'vehicles', 'fuel_logs',
  ];
  // applyGovernance's timeGatedAuthorization always selects `created_by` (the
  // default ownerCol) from the target table — vehicles had no such column at
  // all, which would have thrown "column does not exist" the moment
  // vehiclesUpdate/Delete's new governance call ran. Existing rows are left
  // NULL (no historical creator recorded); timeGatedAuthorization already
  // treats a null owner as "not the current user", routing those edits to
  // approval rather than crashing or silently auto-allowing them.
  await pool.query(`alter table vehicles add column if not exists created_by bigint references app_users(id)`);
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
  // Time-based governance: track which approval level is required and whether system auto-generated the request
  await pool.query(`alter table pending_edits add column if not exists required_level text not null default 'manager'`);
  await pool.query(`alter table pending_edits add column if not exists auto_generated boolean not null default false`);
  await pool.query(`alter table deletion_requests add column if not exists required_level text not null default 'manager'`);
  // Step 3: SLA tracking columns for escalation engine
  await pool.query(`alter table pending_edits add column if not exists first_reminder_at timestamptz`);
  await pool.query(`alter table pending_edits add column if not exists escalated_at timestamptz`);
  await pool.query(`alter table pending_edits add column if not exists escalation_level text`);
  await pool.query(`alter table deletion_requests add column if not exists first_reminder_at timestamptz`);
  await pool.query(`alter table deletion_requests add column if not exists escalated_at timestamptz`);
  await pool.query(`alter table deletion_requests add column if not exists escalation_level text`);
  await pool.query(`create index if not exists idx_pending_edits_sla on pending_edits(status, required_level, submitted_at) where status='Pending'`);
  await pool.query(`create index if not exists idx_deletion_req_sla  on deletion_requests(status, required_level, requested_at) where status='pending'`);
  // Step 4: Persistent job queue — crash-safe scheduling for escalations, notifications, audit replay
  await pool.query(`
    create table if not exists workflow_jobs (
      id              bigserial primary key,
      type            text        not null,
      payload         jsonb       not null default '{}',
      status          text        not null default 'pending'
                      check (status in ('pending','processing','done','failed')),
      run_at          timestamptz not null default now(),
      attempts        int         not null default 0,
      max_attempts    int         not null default 5,
      last_error      text,
      idempotency_key text        unique,
      created_at      timestamptz not null default now(),
      processed_at    timestamptz
    )
  `);
  await pool.query(`create index if not exists idx_wfjobs_runnable
    on workflow_jobs(run_at, status, attempts)
    where status in ('pending','failed')`);
  await pool.query(`create index if not exists idx_wfjobs_idem
    on workflow_jobs(idempotency_key) where idempotency_key is not null`);
  // Machine fuel logs — support company vehicles alongside machines
  await pool.query(`alter table machine_fuel_logs add column if not exists vehicle_id bigint references vehicles(id)`);

  // Labour request breakdown items
  await pool.query(`alter table casual_labour_requests add column if not exists labour_items jsonb`);

  // ── Workshop isolation columns ────────────────────────────────────────────────
  // Tags each production/sales/labour record with the warehouse that owns it.
  // NULL = legacy (pre-isolation) record, visible to all authorised cross-workshop roles.
  await pool.query(`alter table daily_logs             add column if not exists workshop_id bigint references warehouses(id)`);
  await pool.query(`alter table harvest_logs           add column if not exists workshop_id bigint references warehouses(id)`);
  await pool.query(`alter table machine_daily_logs     add column if not exists workshop_id bigint references warehouses(id)`);
  await pool.query(`alter table log_transport          add column if not exists workshop_id bigint references warehouses(id)`);
  await pool.query(`alter table sales_orders           add column if not exists workshop_id bigint references warehouses(id)`);
  await pool.query(`alter table casual_labour_requests add column if not exists workshop_id bigint references warehouses(id)`);
  await pool.query(`alter table casuals                add column if not exists workshop_id bigint references warehouses(id)`);
  await pool.query(`alter table weekly_expenses        add column if not exists workshop_id bigint references warehouses(id)`);
  await pool.query(`alter table kpi_budgets            add column if not exists workshop_id bigint references warehouses(id)`);

  // Indexes for per-workshop filtering
  await pool.query(`create index if not exists idx_daily_logs_workshop    on daily_logs(workshop_id)          where deleted_at is null`);
  await pool.query(`create index if not exists idx_harvest_logs_workshop   on harvest_logs(workshop_id)         where deleted_at is null`);
  await pool.query(`create index if not exists idx_mdl_workshop            on machine_daily_logs(workshop_id)   where deleted_at is null`);
  await pool.query(`create index if not exists idx_log_transport_workshop  on log_transport(workshop_id)        where deleted_at is null`);
  await pool.query(`create index if not exists idx_sales_orders_workshop   on sales_orders(workshop_id)         where deleted_at is null`);
  await pool.query(`create index if not exists idx_casual_req_workshop     on casual_labour_requests(workshop_id)`);
  await pool.query(`create index if not exists idx_casuals_workshop        on casuals(workshop_id)`);

  // ── Per-workshop stock summary materialized view ──────────────────────────────
  // Mirrors the logic of mv_stock_summary but grouped by workshop_id.
  // The global mv_stock_summary is left unchanged so all existing dashboard
  // queries continue to work without modification.
  await pool.query(`drop materialized view if exists mv_stock_by_workshop cascade`);
  await pool.query(`
    create materialized view mv_stock_by_workshop as
    with produced as (
      select workshop_id,
             coalesce(sum(timber_units),0)::int as timber,
             coalesce(sum(poles_units),0)::int  as poles
      from daily_logs where deleted_at is null
      group by workshop_id
    ),
    value_added as (
      -- ensureSchema() runs before value_added_production_outputs/batches
      -- exist (those are created much later, by createNyanzaValueAddedProduction
      -- below) — this materialized view gets fully dropped and recreated with
      -- the real query once those tables exist (see that function's own
      -- "mv_stock_by_workshop repointed" step), so this first pass only needs
      -- to not crash, not be accurate. A table-free zero-row CTE is safe on
      -- every DB state (fresh install or already-migrated).
      select null::bigint as workshop_id, 0::int as kiln_dried, 0::int as cca_treated where false
    ),
    sold as (
      select workshop_id,
             coalesce(sum(case when product_type='Timber' then quantity - coalesce(qty_returned_to_stock,0) else 0 end),0)::int as timber,
             coalesce(sum(case when product_type='Timber' and coalesce(product_sub_type,'')='Kiln-dried'  then quantity - coalesce(qty_returned_to_stock,0) else 0 end),0)::int as kiln_dried,
             coalesce(sum(case when product_type='Timber' and coalesce(product_sub_type,'')='CCA-treated' then quantity - coalesce(qty_returned_to_stock,0) else 0 end),0)::int as cca_treated,
             coalesce(sum(case when product_type='Timber' and coalesce(product_sub_type,'')='Untreated'   then quantity - coalesce(qty_returned_to_stock,0) else 0 end),0)::int as untreated,
             coalesce(sum(case when product_type='Poles'  then quantity - coalesce(qty_returned_to_stock,0) else 0 end),0)::int as poles
      from sales_orders where deleted_at is null and status != 'Cancelled'
      group by workshop_id
    )
    select
      p.workshop_id,
      p.timber                                                                         as timber_produced,
      p.poles                                                                          as poles_produced,
      coalesce(va.kiln_dried,  0)                                                      as kiln_dried_produced,
      coalesce(va.cca_treated, 0)                                                      as cca_treated_produced,
      greatest(p.timber - coalesce(va.kiln_dried,0) - coalesce(va.cca_treated,0), 0)  as untreated_produced,
      coalesce(s.timber,     0) as timber_sold,      coalesce(s.poles,      0) as poles_sold,
      coalesce(s.kiln_dried, 0) as kiln_dried_sold,  coalesce(s.cca_treated,0) as cca_treated_sold,
      coalesce(s.untreated,  0) as untreated_sold,
      (p.timber - coalesce(s.timber,    0))                                            as timber_stock,
      (p.poles  - coalesce(s.poles,     0))                                            as poles_stock,
      (coalesce(va.kiln_dried, 0)  - coalesce(s.kiln_dried, 0))                       as kiln_dried_stock,
      (coalesce(va.cca_treated,0)  - coalesce(s.cca_treated,0))                       as cca_treated_stock,
      (greatest(p.timber - coalesce(va.kiln_dried,0) - coalesce(va.cca_treated,0), 0)
        - coalesce(s.untreated,0))                                                     as untreated_stock
    from produced p
    left join value_added va on va.workshop_id is not distinct from p.workshop_id
    left join sold        s  on s.workshop_id  is not distinct from p.workshop_id
  `);

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

  // Sales orders — fulfilment tracking columns (must exist before mv_stock_summary)
  await pool.query(`alter table sales_orders add column if not exists qty_accepted_total int not null default 0`);
  await pool.query(`alter table sales_orders add column if not exists qty_remaining int`);
  await pool.query(`alter table sales_orders add column if not exists qty_dispatched_total int not null default 0`);
  await pool.query(`alter table sales_orders add column if not exists qty_rejected_total int not null default 0`);
  await pool.query(`alter table sales_orders add column if not exists qty_returned_to_stock int not null default 0`);

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
      -- Same reasoning as mv_stock_by_workshop above: value_added_production_
      -- outputs/batches don't exist yet this early in migrate() on a fresh
      -- install, and this view is fully recreated later once they do — a
      -- single zero row (this is a cross join below, not a left join, so it
      -- must return exactly one row) keeps this first pass crash-safe.
      select 0::int as kiln_dried, 0::int as cca_treated
    ),
    sold as (
      -- net sold = quantity committed minus any units returned to stock (rejected or close-short)
      select
        coalesce(sum(case when product_type='Timber' then quantity - coalesce(qty_returned_to_stock,0) else 0 end),0)::int as timber,
        coalesce(sum(case when product_type='Timber' and coalesce(product_sub_type,'')='Kiln-dried'  then quantity - coalesce(qty_returned_to_stock,0) else 0 end),0)::int as kiln_dried,
        coalesce(sum(case when product_type='Timber' and coalesce(product_sub_type,'')='CCA-treated' then quantity - coalesce(qty_returned_to_stock,0) else 0 end),0)::int as cca_treated,
        coalesce(sum(case when product_type='Timber' and coalesce(product_sub_type,'')='Untreated'   then quantity - coalesce(qty_returned_to_stock,0) else 0 end),0)::int as untreated,
        coalesce(sum(case when product_type='Poles'  then quantity - coalesce(qty_returned_to_stock,0) else 0 end),0)::int as poles
      from sales_orders where deleted_at is null and status != 'Cancelled'
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

  // Transport jobs — support own-vehicle jobs alongside third-party carriers
  await pool.query(`alter table transport_jobs alter column transport_company_id drop not null`);
  await pool.query(`alter table transport_jobs add column if not exists carrier_type text not null default 'Third-party'`);
  await pool.query(`alter table transport_jobs add column if not exists vehicle_id bigint references vehicles(id)`);

  // Delivery orders — partial delivery / POD tracking
  await pool.query(`alter table delivery_orders add column if not exists qty_dispatched int`);
  await pool.query(`alter table delivery_orders add column if not exists qty_accepted int`);
  await pool.query(`alter table delivery_orders add column if not exists qty_rejected int`);
  await pool.query(`alter table delivery_orders add column if not exists rejection_reason text`);
  await pool.query(`alter table delivery_orders add column if not exists pod_recorded_at timestamptz`);
  await pool.query(`alter table delivery_orders add column if not exists pod_recorded_by bigint references app_users(id)`);

  // Stock Transfers — multi-stage transfer workflow
  await pool.query(`
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
    )
  `);
  await pool.query(`alter table stock_movements add column if not exists unit_cost numeric(14,2)`);
  await pool.query(`alter table stock_movements add column if not exists transfer_id bigint references stock_transfers(id)`);
  await pool.query(`create index if not exists idx_stock_transfers_status on stock_transfers(status) where deleted_at is null`);
  await pool.query(`create index if not exists idx_stock_mv_transfer on stock_movements(transfer_id) where transfer_id is not null`);

  // Inventory Integrity Phase 1 — the standardized "Business Reason" category
  // for movement_type='loss' rows (Loss in Transit/Damaged/Short Shipment/
  // Theft/Write-off/Manual Count Adjustment/Expired Material/Other). Kept
  // separate from movement_type (the small mechanical vocabulary) and from
  // notes (free-text elaboration) so Loss reports can group by it reliably.
  await pool.query(`alter table stock_movements add column if not exists loss_reason text`);
  await pool.query(`create index if not exists idx_stock_mv_type on stock_movements(movement_type)`);

  // Material Request → Stock Transfer unification — Material Requests no
  // longer move stock directly; approval auto-creates a linked Stock
  // Transfer, and only that transfer's receive lifecycle moves inventory.
  await pool.query(`alter table material_requests add column if not exists transfer_id bigint references stock_transfers(id)`);
  await pool.query(`alter table stock_transfers add column if not exists discrepancy_notes text`);
  await pool.query(`alter table stock_transfers add column if not exists discrepancy_qty int`);

  // Material Request UI/UX redesign — captured, informational only (no
  // validation/business-logic tied to it, purely displayed so the requester
  // can communicate urgency by date, not just the existing priority field).
  await pool.query(`alter table material_requests add column if not exists needed_by date`);
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

// Seed the four official workshop locations as warehouses (idempotent — skips if name exists).
// These become the selectable workshop options for user assignment and record tagging.
async function seedWorkshops() {
  const WORKSHOPS = [
    { name: 'Headquarters',    location: 'Main Office', workshop_type: 'HQ'       },
    { name: 'Gatare Workshop', location: 'Gatare',      workshop_type: 'Timber'   },
    { name: 'Nyanza Workshop', location: 'Nyanza',      workshop_type: 'Poles'    },
    { name: 'Showroom',        location: 'Showroom',    workshop_type: 'Showroom' }
  ];
  for (const w of WORKSHOPS) {
    const { rows } = await pool.query(`select id from warehouses where name=$1`, [w.name]);
    if (!rows.length) {
      await pool.query(
        `insert into warehouses(name, location, workshop_type, active) values ($1,$2,$3,true)`,
        [w.name, w.location, w.workshop_type]
      );
    }
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
            'secgov', 'executive', 'bi', 'automation', 'epm',
            'daily', 'daily-timber', 'daily-poles', 'daily-harvest', 'sales', 'products', 'customers',
            'inventory', 'logistics', 'logistics-dashboard',
            'workshop-overview', 'warehouses', 'stock-items', 'stock-movements', 'stock-transfers', 'material-requests',
            'vehicles', 'deliveries', 'dispatch', 'transport', 'transport-jobs',
            'harvest', 'timber-inventory',
            'machines', 'machine-logs', 'machine-kpi', 'machine-maintenance',
            'compartments', 'log-transport', 'value-added-production',
            'machine-fuel', 'casual-requests', 'casuals',
            'weekly-cost', 'weekly-perf', 'monthly', 'kpi', 'sage'],
    ceo: ['dashboard', 'ceo', 'weekly-cost', 'weekly-perf', 'monthly', 'kpi', 'audit', 'export', 'users', 'notifications', 'changes',
          'secgov', 'executive', 'bi', 'automation', 'epm',
          'daily-harvest', 'value-added-production', 'timber-inventory', 'products', 'customers', 'sales',
          'vehicles', 'deliveries', 'dispatch', 'transport', 'transport-jobs',
          'logistics-dashboard', 'workshop-overview',
          'warehouses', 'stock-items', 'stock-movements', 'stock-transfers', 'material-requests',
          'machines', 'machine-logs', 'machine-kpi', 'machine-fuel', 'machine-maintenance',
          'compartments', 'log-transport',
          'casual-requests', 'casuals'],
    operations: ['dashboard', 'daily', 'daily-timber', 'daily-poles', 'daily-harvest', 'products', 'sales', 'customers',
                 'weekly-cost', 'weekly-perf', 'inventory', 'audit', 'export', 'notifications', 'changes',
                 'secgov', 'executive', 'bi', 'automation', 'epm',
                 'timber-inventory', 'harvest', 'workshop-overview',
                 'stock-items', 'stock-movements', 'stock-transfers', 'material-requests', 'transport',
                 // Phase 1 Logistics fix — dispatchReview's own hardcoded role
                 // check already allowed 'operations' to approve/reject dispatch
                 // requests, but dispatchList/dispatchCreate were mustRole('dispatch')-
                 // gated and 'dispatch' was never actually granted to this role, so
                 // operations could never see the queue to act on in the first place.
                 'dispatch',
                 'machines', 'machine-logs', 'machine-kpi', 'machine-maintenance',
                 'compartments', 'log-transport', 'value-added-production',
                 'machine-fuel', 'casual-requests', 'casuals'],
    sales: ['dashboard', 'sales', 'products', 'audit', 'export', 'notifications', 'changes', 'deliveries', 'transport'],
    finance: ['dashboard', 'weekly-cost', 'monthly', 'sage', 'audit', 'export', 'notifications', 'changes'],
    logistics: ['dashboard', 'logistics', 'logistics-dashboard', 'inventory', 'audit', 'export', 'notifications', 'changes',
                'warehouses', 'stock-items', 'stock-movements', 'stock-transfers', 'vehicles', 'deliveries', 'dispatch', 'transport',
                'machines', 'log-transport', 'machine-fuel', 'machine-maintenance',
                'casual-requests', 'casuals', 'material-requests',
                // Phase 1 Workshop fix — workshopOverview() was (wrongly) gated on
                // 'inventory' instead of the actual 'workshop-overview' key every
                // other role uses; this role had 'inventory' but never
                // 'workshop-overview', so correcting the backend check without this
                // grant would have silently taken the page away. Not a broadening
                // of access — preserves exactly what this role could already do.
                'workshop-overview'],
    supervisor: ['dashboard', 'bi', 'daily', 'daily-timber', 'daily-poles', 'daily-harvest',
                 'audit', 'export', 'notifications', 'changes', 'harvest', 'timber-inventory',
                 'machine-logs', 'machine-maintenance', 'compartments', 'log-transport', 'value-added-production',
                 'machine-fuel', 'casual-requests', 'casuals',
                 'workshop-overview', 'material-requests', 'stock-transfers'],
    storekeeper: ['dashboard', 'bi', 'logistics-dashboard', 'workshop-overview', 'inventory', 'audit', 'export', 'notifications',
                  'warehouses', 'stock-items', 'stock-movements', 'stock-transfers', 'material-requests'],
    'logistics-officer': ['dashboard', 'logistics-dashboard', 'workshop-overview', 'inventory',
                          'warehouses', 'stock-items', 'stock-movements', 'stock-transfers',
                          'vehicles', 'deliveries', 'transport', 'material-requests',
                          'notifications', 'audit', 'export'],
    'storekeeper-assistant': ['dashboard', 'bi', 'workshop-overview', 'stock-movements', 'machine-fuel',
                               'material-requests', 'notifications'],
    // Mechanician Phase 2 — 'machine-logs'/'machine-fuel'/'machine-maintenance'
    // added so this role can actually record the maintenance work it was
    // already meant to do (downtime, repair remarks, fuel) and see what
    // maintenance is due — per MECHANICIAN_PHASE2_OPERATIONAL_AUDIT.md's
    // recommended scope. Deliberately NOT granted 'machines' (full registry
    // CRUD) — that stays a Logistics Manager/supervisor-tier responsibility,
    // matching the audit's narrower recommendation; the new cross-machine
    // Maintenance Schedule screen (gated on 'machine-maintenance') is
    // read-only for 'machine-logs'-only holders like this role — creating/
    // editing a schedule still requires 'machines', unchanged.
    'mechanician': ['dashboard', 'material-requests', 'notifications', 'machine-logs', 'machine-fuel', 'machine-maintenance'],
    // Phase 2 — Operations leaders (all workshop-restricted, no approval rights)
    // Stock & Inventory Phase 4 (audit finding M-14) — 'material-requests'
    // added: every sibling "-leader" role below (sawmill-leader, poles-leader,
    // vat-leader) already holds it; harvesting-leader was the one production
    // department whose leader tier couldn't submit a material request at
    // all, an inconsistency with no documented rationale (unlike the
    // "-supervisor" tier's deliberately lighter permission set, which is
    // intentional and unchanged here).
    'harvesting-leader': ['dashboard', 'bi', 'daily-harvest', 'harvest', 'log-transport', 'compartments',
                          'material-requests', 'casual-requests', 'workshop-overview',
                          'notifications', 'audit', 'export'],
    // Mechanician Phase 2 — 'machine-maintenance' added alongside the
    // 'machine-logs' these two roles already held, for the same new
    // cross-machine Maintenance Schedule screen (read-only for them, same as
    // mechanician — they don't hold 'machines' either).
    'sawmill-leader':    ['dashboard', 'bi', 'daily-timber', 'timber-inventory', 'machine-logs', 'machine-fuel', 'machine-maintenance',
                          'material-requests', 'casual-requests', 'workshop-overview',
                          'notifications', 'audit', 'export'],
    'poles-leader':      ['dashboard', 'bi', 'daily-poles', 'machine-logs', 'machine-fuel', 'machine-maintenance',
                          'material-requests', 'casual-requests', 'workshop-overview',
                          'notifications', 'audit', 'export'],
    'vat-leader':        ['dashboard', 'bi', 'value-added-production', 'timber-inventory',
                          'material-requests', 'casual-requests', 'workshop-overview',
                          'notifications', 'audit', 'export'],
    'harvesting-supervisor': ['dashboard', 'bi', 'daily-harvest', 'log-transport',
                              'notifications', 'audit', 'export'],
    // Sawmill Phase 1 (Workstream 4/5) — 'timber-inventory' added so this role,
    // which already creates production entries, can see the Finished Timber
    // Inventory those entries post to (was previously granted 'sawmill.write'
    // with no way to view the resulting stock).
    'sawmill-supervisor':    ['dashboard', 'bi', 'daily-timber', 'timber-inventory',
                              'notifications', 'audit', 'export'],
    // ERP Enterprise Completion Phase 2 (Workstream 1/2, PERM-1) — poles-supervisor
    // and vat-supervisor were seeded with zero permissions and never granted
    // base pages by any subsequent grant function, leaving both roles unable
    // to perform their own documented job ("Records daily poles/VAT entries").
    // Mirrors the exact narrower supervisor-tier shape already established by
    // harvesting-supervisor/sawmill-supervisor above (dashboard/bi/production
    // entry/relevant inventory view/notifications/audit/export only — no
    // material-requests, casual-requests, or machine-* pages, matching how
    // this tier is deliberately lighter than the leader tier everywhere else
    // in this object) — not copied from poles-leader/vat-leader wholesale.
    'poles-supervisor':      ['dashboard', 'bi', 'daily-poles',
                              'notifications', 'audit', 'export'],
    'vat-supervisor':        ['dashboard', 'bi', 'value-added-production', 'timber-inventory',
                              'notifications', 'audit', 'export'],
    // Phase 2 — Sales roles (all workshop-restricted, no approval rights)
    'sales-staff':       ['dashboard', 'sales', 'deliveries', 'products',
                          'notifications', 'audit', 'export'],
    'showroom-staff':    ['dashboard', 'sales', 'deliveries', 'products', 'timber-inventory',
                          'notifications', 'audit', 'export']
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

async function seedNewLogisticsRoles() {
  const newRoles = [
    {
      role: 'logistics-officer',
      label: 'Logistics Officer',
      description: 'Monitors workshop inventory and product movements. Can manage stock movements and transfers within assigned scope but cannot approve or delete records.',
    },
    {
      role: 'storekeeper-assistant',
      label: 'Storekeeper Assistant',
      description: 'Supports the workshop stockkeeper. Focuses on consumption recording for mechanical operations and assists with stock transactions.',
    },
    {
      role: 'mechanician',
      label: 'Mechanician',
      description: 'Requests spare parts and maintenance materials from the workshop store. Access limited to material requests only.',
    },
    // Phase 2 — Operations leaders (Gatare)
    {
      role: 'harvesting-leader',
      label: 'Harvesting Leader',
      description: 'Leads harvesting operations at Gatare Workshop. Records harvest, log transport, and compartment activity. No access to sawmill, poles, VAT, or sales modules.',
    },
    {
      role: 'sawmill-leader',
      label: 'Sawmill Leader',
      description: 'Leads sawmill operations at Gatare Workshop. Records daily timber production, machine logs, fuel, and material requests. No access to harvesting, poles, or sales modules.',
    },
    // Phase 2 — Operations leaders (Nyanza)
    {
      role: 'poles-leader',
      label: 'Poles Production Leader',
      description: 'Leads poles production at Nyanza Workshop. Records daily poles output, machine logs, fuel, and material requests. No access to timber, harvesting, or sales modules.',
    },
    {
      role: 'vat-leader',
      label: 'Value-Added Timber Leader',
      description: 'Leads value-added timber processing at Nyanza Workshop. Records VAT entries and views timber inventory. No access to harvesting, poles, or sales modules.',
    },
    // Phase 3 — Department Supervisors (Gatare)
    {
      role: 'harvesting-supervisor',
      label: 'Harvesting Supervisor',
      description: 'Supervises harvesting operations at Gatare Workshop. Records harvest and log transport entries. No material requests, casual labour, or QC access.',
    },
    {
      role: 'sawmill-supervisor',
      label: 'Sawmill Supervisor',
      description: 'Supervises sawmill production at Gatare Workshop. Records daily timber entries. No material requests, casual labour, or QC access.',
    },
    // Phase 3 — Department Supervisors (Nyanza)
    {
      role: 'poles-supervisor',
      label: 'Poles Supervisor',
      description: 'Supervises poles production at Nyanza Workshop. Records daily poles entries and creates deliveries. No QC, purchase, or request access.',
    },
    {
      role: 'vat-supervisor',
      label: 'VAT Supervisor',
      description: 'Supervises value-added timber processing at Nyanza Workshop. Records VAT entries. No material requests or casual labour access.',
    },
    // Phase 2 — Sales roles
    {
      role: 'sales-staff',
      label: 'Workshop Sales Staff',
      description: 'Handles sales for their assigned workshop only. Access limited to sales, deliveries, and products. No production or logistics permissions.',
    },
    {
      role: 'showroom-staff',
      label: 'Showroom Sales Staff',
      description: 'Manages showroom sales only. Access limited to sales, deliveries, products, and read-only timber inventory to support showroom sales decisions.',
    },
  ];

  for (const r of newRoles) {
    const { rows } = await pool.query('select 1 from role_definitions where role=$1', [r.role]);
    if (!rows.length) {
      await pool.query(
        `insert into role_definitions(role, label, description, responsibilities, permissions)
         values ($1,$2,$3,$4,$5)`,
        [r.role, r.label, r.description, JSON.stringify([]), JSON.stringify([])]
      );
    }
  }
}

// Phase 1 — Audit log schema enhancement.
// Adds 9 new columns to audit_log and applies immutability rules.
// All statements are idempotent: safe to run on an existing production database.
async function auditLogEnhancement() {
  // New descriptive columns — all nullable so existing rows are unaffected
  await pool.query(`alter table audit_log add column if not exists username      text`);
  await pool.query(`alter table audit_log add column if not exists full_name     text`);
  await pool.query(`alter table audit_log add column if not exists module        text`);
  await pool.query(`alter table audit_log add column if not exists action_type   text`); // CREATE / UPDATE / DELETE / APPROVE / REJECT / LOGIN / LOGOUT / EXPORT
  await pool.query(`alter table audit_log add column if not exists record_id     text`);
  await pool.query(`alter table audit_log add column if not exists before_values jsonb`);
  await pool.query(`alter table audit_log add column if not exists after_values  jsonb`);
  await pool.query(`alter table audit_log add column if not exists ip_address    text`);
  await pool.query(`alter table audit_log add column if not exists reason        text`);

  // Immutability: silently block any application-level UPDATE or DELETE on audit rows.
  // CREATE OR REPLACE RULE is idempotent — safe to run multiple times.
  await pool.query(`
    create or replace rule audit_log_no_update
    as on update to audit_log do instead nothing
  `);
  await pool.query(`
    create or replace rule audit_log_no_delete
    as on delete to audit_log do instead nothing
  `);
}

// Phase C6 — Audit Log Workshop Isolation (resolves NF-01).
//
// Adds a nullable workshop_id column so future audit rows can be correctly
// scoped to the workshop the recorded action belongs to. Deliberately does
// NOT backfill historical rows via UPDATE: audit_log carries the
// `audit_log_no_update` rule specifically so no row can ever be altered
// after creation, by anyone — including this migration. Suspending that
// rule, even briefly and even for a well-intentioned metadata backfill,
// would undermine the exact tamper-evidence guarantee this security phase
// exists to strengthen, so it is never done. Historical rows are left with
// workshop_id = NULL permanently.
//
// To avoid that decision silently breaking "existing audit history stays
// visible" (every pre-existing row would otherwise vanish for every
// workshop-scoped viewer the moment isolation is enforced), a one-time
// cutover marker is captured on first run: the highest audit_log id that
// existed *before* workshop attribution began. auditList() (data.js) uses
// this marker to grandfather every row written before the cutover — shown
// to every audit-permitted viewer exactly as before — while enforcing real
// workshop scoping only on rows written from the cutover forward. The
// marker is written exactly once (`insert ... where not exists`), so
// re-running this idempotent migration on later app restarts never moves
// the cutover forward and never re-exposes newly-created rows.
async function auditLogWorkshopIsolation() {
  await pool.query(`alter table audit_log add column if not exists workshop_id bigint references warehouses(id)`);
  await pool.query(`create index if not exists idx_audit_log_workshop on audit_log(workshop_id)`);

  await pool.query(`
    create table if not exists audit_log_workshop_cutover (
      id          smallint primary key default 1 check (id = 1),
      cutover_id  bigint not null,
      created_at  timestamptz not null default now()
    )
  `);
  await pool.query(`
    insert into audit_log_workshop_cutover (id, cutover_id)
    select 1, coalesce((select max(id) from audit_log), 0)
    where not exists (select 1 from audit_log_workshop_cutover where id = 1)
  `);
}

// Phase 8 — seed default automation rules (idempotent via ON CONFLICT DO NOTHING)
async function seedAutomationRules() {
  // ── Phase 8 Part 3 additions: severity, auto_action, extended thresholds ──────
  // ADD COLUMN IF NOT EXISTS so this is safe to run on existing installs.
  await pool.query(`
    ALTER TABLE automation_rules
      ADD COLUMN IF NOT EXISTS severity    text NOT NULL DEFAULT 'medium',
      ADD COLUMN IF NOT EXISTS auto_action text NOT NULL DEFAULT 'notify'
  `);

  const rules = [
    {
      rule_key:       'stock_low',
      label:          'Stock Shortage Alert',
      description:    'Detects items with fewer than 7 days of stock remaining. Creates a draft material request and notifies the logistics team.',
      cooldown_hours: 4,
      notify_roles:   ['admin', 'operations', 'logistics'],
      threshold:      { days: 7 },
      severity:       'critical',
      auto_action:    'draft_request',
    },
    {
      rule_key:       'maintenance_due',
      label:          'Machine Maintenance Due',
      description:    'Alerts when a machine maintenance schedule is overdue or due within 3 days.',
      cooldown_hours: 8,
      notify_roles:   ['admin', 'operations'],
      // hours_at_* = time at each escalation level before advancing (Phase 8 Part 4)
      threshold:      { days: 3,
                        hours_at_leader: 4, hours_at_manager: 8, hours_at_director: 24,
                        ceo_reminder_hours: 4 },
      severity:       'high',
      auto_action:    'notify',
    },
    {
      rule_key:       'delivery_overdue',
      label:          'Delivery Overdue',
      description:    'Notifies the logistics team when a delivery order is past its due date.',
      cooldown_hours: 4,
      notify_roles:   ['logistics', 'admin'],
      threshold:      { hours_at_leader: 2, hours_at_manager: 4, hours_at_director: 12,
                        ceo_reminder_hours: 2 },
      severity:       'high',
      auto_action:    'notify',
    },
    {
      rule_key:       'workflow_failure',
      label:          'Workflow Job Failure',
      description:    'Alerts admin when workflow jobs have failed in the past 24 hours.',
      cooldown_hours: 2,
      notify_roles:   ['admin'],
      // notify_*_threshold used by _schedWorkflowScan; hours_at_* by escalation engine
      threshold:      { notify_failed_threshold: 10, notify_stuck_threshold: 3,
                        hours_at_leader: 2, hours_at_manager: 4, hours_at_director: 12,
                        ceo_reminder_hours: 2 },
      severity:       'high',
      auto_action:    'notify',
    },
    {
      rule_key:       'security_alert',
      label:          'Security Alert — Failed Logins',
      description:    'Notifies CEO and admin when repeated failed login attempts are detected (possible brute-force).',
      cooldown_hours: 1,
      notify_roles:   ['ceo', 'admin'],
      // min_fails_15m / min_overrides_15m used by _schedSecurityScan (15-min window)
      threshold:      { min_fails: 3, min_fails_15m: 5, min_overrides_15m: 3,
                        hours_at_leader: 1, hours_at_manager: 2, hours_at_director: 4,
                        ceo_reminder_hours: 1 },
      severity:       'critical',
      auto_action:    'notify',
    },
    {
      rule_key:       'approval_escalate',
      label:          'Approval SLA Escalation',
      description:    'Automatically escalates approval requests that have been pending longer than 48 hours.',
      cooldown_hours: 12,
      notify_roles:   ['admin', 'ceo', 'operations'],
      threshold:      { hours: 48,
                        hours_at_leader: 4, hours_at_manager: 8, hours_at_director: 24,
                        ceo_reminder_hours: 4 },
      severity:       'high',
      auto_action:    'escalate',
    },
    {
      rule_key:       'fuel_anomaly',
      label:          'Fuel Consumption Anomaly',
      description:    'Detects statistically abnormal vehicle fuel consumption (Z-score ≥ 1.5) and notifies operations.',
      cooldown_hours: 6,
      notify_roles:   ['admin', 'operations'],
      threshold:      { min_z: 1.5 },
      severity:       'medium',
      auto_action:    'notify',
    },
    {
      rule_key:       'harvest_behind',
      label:          'Harvest Behind Schedule',
      description:    'Alerts when an active harvest compartment is estimated to take more than 90 days to complete.',
      cooldown_hours: 8,
      notify_roles:   ['admin', 'operations'],
      threshold:      { days_to_complete: 90 },
      severity:       'medium',
      auto_action:    'notify',
    },
  ];

  for (const r of rules) {
    await pool.query(
      `INSERT INTO automation_rules
         (rule_key, label, description, cooldown_hours, notify_roles, threshold,
          severity, auto_action)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8)
       ON CONFLICT (rule_key) DO UPDATE
         SET threshold   = EXCLUDED.threshold,
             severity    = EXCLUDED.severity,
             auto_action = EXCLUDED.auto_action,
             updated_at  = now()`,
      [r.rule_key, r.label, r.description,
       r.cooldown_hours, r.notify_roles, JSON.stringify(r.threshold),
       r.severity, r.auto_action]
    );
  }
}

// Phase 6 — Procurement Automation Engine. Reuses the existing automation_rules
// table/UI (same pattern as seedAutomationRules above) rather than a separate
// procurement-only config table, so every new automation category is
// independently tunable/disableable through the Automation Rules screen that
// already exists — no new UI needed for this. hours_at_leader/manager/director +
// ceo_reminder_hours keep the exact key names _escalateEntity already expects;
// only the *roles* notified at each level differ for procurement entity types
// (see ENTITY_ESCALATION_ROLES in data.js), not the level names themselves.
async function seedProcurementAutomationRules() {
  const rules = [
    {
      rule_key:       'procurement_requisition_escalation',
      label:          'Procurement Requisition Approval Escalation',
      description:    'Escalates a requisition through Assigned Officer -> Procurement Manager -> Operations Manager -> CEO when a pending approval stage sits too long.',
      cooldown_hours: 12,
      notify_roles:   ['procurement-officer', 'procurement-manager', 'operations', 'ceo', 'admin'],
      threshold:      { hours: 48, hours_at_leader: 24, hours_at_manager: 48, hours_at_director: 72, ceo_reminder_hours: 24 },
      severity:       'high',
      auto_action:    'escalate',
    },
    {
      rule_key:       'procurement_rfq_reminder',
      label:          'RFQ Response & Closing Reminders',
      description:    'Notifies procurement staff when an RFQ is closing soon or overdue with no quotations received.',
      cooldown_hours: 20,
      notify_roles:   ['procurement-officer', 'procurement-manager'],
      threshold:      { closing_soon_days: 3, overdue_grace_hours: 4 },
      severity:       'medium',
      auto_action:    'notify',
    },
    {
      rule_key:       'procurement_po_reminder',
      label:          'Purchase Order Issue & Delivery Reminders',
      description:    'Notifies procurement staff of purchase orders pending issue too long and of upcoming or late expected deliveries.',
      cooldown_hours: 20,
      notify_roles:   ['procurement-officer', 'procurement-manager'],
      threshold:      { pending_issue_hours: 48, delivery_due_soon_days: 3, late_delivery_grace_days: 1 },
      severity:       'medium',
      auto_action:    'notify',
    },
    {
      rule_key:       'procurement_invoice_reminder',
      label:          'Supplier Invoice Approval & Payment Reminders',
      description:    'Notifies procurement and finance staff of invoices pending approval, pending payment, or overdue.',
      cooldown_hours: 20,
      notify_roles:   ['procurement-officer', 'procurement-manager', 'finance'],
      threshold:      { pending_approval_hours: 48, pending_payment_days: 14, overdue_grace_days: 3 },
      severity:       'high',
      auto_action:    'notify',
    },
    {
      rule_key:       'procurement_improvement_plan_reminder',
      label:          'Supplier Corrective Action & Improvement Plan Reminders',
      description:    'Notifies the plan owner of upcoming/overdue due dates and periodically nudges progress on open plans (includes corrective actions, which share this table).',
      cooldown_hours: 20,
      notify_roles:   ['procurement-manager'],
      threshold:      { due_soon_days: 7, overdue_grace_days: 1, progress_nag_days: 14 },
      severity:       'medium',
      auto_action:    'notify',
    },
    {
      rule_key:       'procurement_budget_forecast_alert',
      label:          'Procurement Budget & Forecast Alert',
      description:    'Notifies procurement management and finance when a budget code crosses its utilization threshold, or when projected annual spend is forecast to exceed the estimated budget.',
      cooldown_hours: 24,
      notify_roles:   ['procurement-manager', 'finance', 'ceo'],
      threshold:      { utilization_pct: 90, forecast_over_pct: 10 },
      severity:       'high',
      auto_action:    'notify',
    },
  ];

  for (const r of rules) {
    await pool.query(
      `INSERT INTO automation_rules
         (rule_key, label, description, cooldown_hours, notify_roles, threshold,
          severity, auto_action)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8)
       ON CONFLICT (rule_key) DO UPDATE
         SET threshold   = EXCLUDED.threshold,
             severity    = EXCLUDED.severity,
             auto_action = EXCLUDED.auto_action,
             updated_at  = now()`,
      [r.rule_key, r.label, r.description,
       r.cooldown_hours, r.notify_roles, JSON.stringify(r.threshold),
       r.severity, r.auto_action]
    );
  }
  console.log('[migrate] procurement automation rules seeded');
}

async function migrate() {
  await ensureDatabaseExists();
  await ensureSchema();
  await auditLogEnhancement();
  await auditLogWorkshopIsolation();
  await seedIfEmpty();
  await seedRoles();
  await seedExpenseCategories();
  await seedProductCatalog();
  await seedDefaultWarehouse();
  await seedMachineCategories();
  await seedMachineKpiDefinitions();
  await seedNewLogisticsRoles();
  await updateRolePermissions();
  await seedWorkshops();
  // Phase 8 — Intelligent Automation Engine
  await seedAutomationRules();
  // Phase 8 Part 5/6 — Scheduler Run Log
  await pool.query(`
    CREATE TABLE IF NOT EXISTS scheduler_runs (
      id                    bigserial PRIMARY KEY,
      started_at            timestamptz NOT NULL DEFAULT now(),
      completed_at          timestamptz,
      duration_ms           int,
      rules_fired           int NOT NULL DEFAULT 0,
      escalations_processed int NOT NULL DEFAULT 0,
      errors                int NOT NULL DEFAULT 0,
      status                text NOT NULL DEFAULT 'running'
    )
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_scheduler_runs_started
      ON scheduler_runs(started_at DESC)
  `);
  console.log('[migrate] scheduler_runs table ready');

  // Phase 9 — Enterprise Performance Management
  await pool.query(`
    CREATE TABLE IF NOT EXISTS performance_kpis (
      id           bigserial PRIMARY KEY,
      kpi_key      text NOT NULL UNIQUE,
      name         text NOT NULL,
      department   text NOT NULL,
      module       text,
      owner        text,
      description  text,
      target_value numeric(14,2) NOT NULL DEFAULT 0,
      unit         text NOT NULL DEFAULT '%',
      direction    text NOT NULL DEFAULT 'higher_better',
      review_freq  text NOT NULL DEFAULT 'monthly',
      active       boolean NOT NULL DEFAULT true,
      created_at   timestamptz NOT NULL DEFAULT now(),
      updated_at   timestamptz
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_perf_kpis_dept ON performance_kpis(department)`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS performance_action_plans (
      id                   bigserial PRIMARY KEY,
      kpi_key              text REFERENCES performance_kpis(kpi_key) ON DELETE SET NULL,
      problem              text NOT NULL,
      root_cause           text,
      recommended_action   text NOT NULL,
      responsible_dept     text NOT NULL,
      priority             text NOT NULL DEFAULT 'medium',
      due_date             date,
      expected_improvement text,
      status               text NOT NULL DEFAULT 'draft',
      auto_generated       boolean NOT NULL DEFAULT false,
      created_at           timestamptz NOT NULL DEFAULT now(),
      created_by           bigint REFERENCES app_users(id),
      approved_by          bigint REFERENCES app_users(id),
      approved_at          timestamptz
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_perf_plans_status ON performance_action_plans(status)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_perf_plans_kpi   ON performance_action_plans(kpi_key)`);

  console.log('[migrate] performance EPM tables ready');
  await seedPerformanceKpis();

  // Add 'epm' page to admin/ceo/operations in role_definitions
  const EPM_ROLES = ['admin','ceo','operations'];
  for (const role of EPM_ROLES) {
    const { rows } = await pool.query('SELECT permissions FROM role_definitions WHERE role=$1', [role]);
    if (!rows.length) continue;
    const perms = Array.isArray(rows[0].permissions) ? rows[0].permissions : [];
    if (perms.includes('epm')) continue;
    await pool.query('UPDATE role_definitions SET permissions=$1, updated_at=now() WHERE role=$2',
      [JSON.stringify([...perms, 'epm']), role]);
  }
  console.log('[migrate] epm page permissions updated');

  // ── Procurement Management module ────────────────────────────────────────────
  await pool.query(`
    CREATE TABLE IF NOT EXISTS procurement_config (
      id           bigserial PRIMARY KEY,
      ceo_threshold numeric(14,2) NOT NULL DEFAULT 5000000,
      updated_by   bigint REFERENCES app_users(id),
      updated_at   timestamptz NOT NULL DEFAULT now()
    )
  `);
  await pool.query(`
    INSERT INTO procurement_config (id, ceo_threshold)
    SELECT 1, 5000000
    WHERE NOT EXISTS (SELECT 1 FROM procurement_config WHERE id = 1)
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS procurement_suppliers (
      id               bigserial PRIMARY KEY,
      name             text NOT NULL,
      category         text,
      tax_number       text,
      bank_name        text,
      bank_account     text,
      phone            text,
      email            text,
      address          text,
      rating           numeric(3,2),
      preferred        boolean NOT NULL DEFAULT false,
      blacklisted      boolean NOT NULL DEFAULT false,
      blacklist_reason text,
      notes            text,
      active           boolean NOT NULL DEFAULT true,
      created_by       bigint REFERENCES app_users(id),
      created_at       timestamptz NOT NULL DEFAULT now()
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_proc_suppliers_active ON procurement_suppliers(active)`);

  // Phase 3B — supplier lifecycle. `status` becomes the authoritative field
  // (draft/pending_approval/active/suspended/blacklisted/archived, enforced
  // in db/services/data.js's procurementSupplierSetStatus — no DB CHECK
  // constraint, so there's exactly one place, not two, that validates it);
  // `active`/`blacklisted`/`blacklist_reason` above stay as kept-in-sync
  // mirrors so every pre-existing query/report that already reads them
  // keeps working unchanged.
  await pool.query(`ALTER TABLE procurement_suppliers ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active'`);
  await pool.query(`ALTER TABLE procurement_suppliers ADD COLUMN IF NOT EXISTS status_reason text`);
  await pool.query(`ALTER TABLE procurement_suppliers ADD COLUMN IF NOT EXISTS status_changed_by bigint REFERENCES app_users(id)`);
  await pool.query(`ALTER TABLE procurement_suppliers ADD COLUMN IF NOT EXISTS status_changed_at timestamptz`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_proc_suppliers_status ON procurement_suppliers(status)`);
  // One-time backfill for rows that predate this column (every supplier was
  // implicitly "active" before Phase 3B — no deactivation UI ever existed,
  // per SUPPLIER_VENDOR_PHASE3_AUDIT.md — so only blacklisted/inactive rows
  // need correcting away from the column's 'active' default). Safe to rerun:
  // once a row's status is set explicitly it no longer matches these WHERE
  // clauses.
  await pool.query(`UPDATE procurement_suppliers SET status='blacklisted' WHERE blacklisted=true AND status='active'`);
  await pool.query(`UPDATE procurement_suppliers SET status='suspended' WHERE active=false AND blacklisted=false AND status='active'`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS procurement_supplier_contacts (
      id          bigserial PRIMARY KEY,
      supplier_id bigint NOT NULL REFERENCES procurement_suppliers(id) ON DELETE CASCADE,
      name        text NOT NULL,
      role        text,
      phone       text,
      email       text,
      is_primary  boolean NOT NULL DEFAULT false,
      created_at  timestamptz NOT NULL DEFAULT now()
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_proc_contacts_supplier ON procurement_supplier_contacts(supplier_id)`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS procurement_supplier_contracts (
      id           bigserial PRIMARY KEY,
      supplier_id  bigint NOT NULL REFERENCES procurement_suppliers(id) ON DELETE CASCADE,
      contract_ref text NOT NULL,
      start_date   date,
      end_date     date,
      terms        text,
      status       text NOT NULL DEFAULT 'active',
      created_by   bigint REFERENCES app_users(id),
      created_at   timestamptz NOT NULL DEFAULT now()
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_proc_contracts_supplier ON procurement_supplier_contracts(supplier_id)`);

  // ═══════════════════════════════════════════════════════════════════════
  // Supplier Relationship Management (SRM) — Phase 4. Additive only, per the
  // approved design: contract fields extended in place, four new tables for
  // concepts with no existing table to reuse (documents, compliance,
  // communications, improvement plans — see SUPPLIER_RELATIONSHIP_PHASE4_
  // AUDIT.md §2/§8). No redesign of any existing procurement table.
  // ═══════════════════════════════════════════════════════════════════════
  await pool.query(`ALTER TABLE procurement_supplier_contracts ADD COLUMN IF NOT EXISTS category text`);
  await pool.query(`ALTER TABLE procurement_supplier_contracts ADD COLUMN IF NOT EXISTS contract_value numeric(14,2)`);
  await pool.query(`ALTER TABLE procurement_supplier_contracts ADD COLUMN IF NOT EXISTS owner_user_id bigint REFERENCES app_users(id)`);
  await pool.query(`ALTER TABLE procurement_supplier_contracts ADD COLUMN IF NOT EXISTS renewal_notice_days int`);
  await pool.query(`ALTER TABLE procurement_supplier_contracts ADD COLUMN IF NOT EXISTS notes text`);
  // Self-referencing link so a renewal creates a new row (preserving the old
  // one as history) rather than overwriting dates in place — this chain IS
  // the "Contract History" the brief asks for, no separate history table.
  await pool.query(`ALTER TABLE procurement_supplier_contracts ADD COLUMN IF NOT EXISTS renewed_from_id bigint REFERENCES procurement_supplier_contracts(id)`);
  // Tracks whether/when a renewal reminder has already fired this cycle, so
  // the scheduler task doesn't re-notify on every 15-minute tick.
  await pool.query(`ALTER TABLE procurement_supplier_contracts ADD COLUMN IF NOT EXISTS last_reminder_at timestamptz`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_proc_contracts_status ON procurement_supplier_contracts(status)`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS supplier_documents (
      id                bigserial PRIMARY KEY,
      supplier_id       bigint NOT NULL REFERENCES procurement_suppliers(id) ON DELETE CASCADE,
      contract_id       bigint REFERENCES procurement_supplier_contracts(id) ON DELETE SET NULL,
      compliance_id     bigint,
      document_type     text NOT NULL,
      original_filename text NOT NULL,
      stored_filename   text NOT NULL,
      mime_type         text,
      file_size         bigint,
      uploaded_by       bigint REFERENCES app_users(id),
      uploaded_at       timestamptz NOT NULL DEFAULT now(),
      expiry_date       date,
      version           int NOT NULL DEFAULT 1,
      status            text NOT NULL DEFAULT 'active',
      notes             text
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_supplier_docs_supplier ON supplier_documents(supplier_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_supplier_docs_contract ON supplier_documents(contract_id) WHERE contract_id IS NOT NULL`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS supplier_compliance (
      id              bigserial PRIMARY KEY,
      supplier_id     bigint NOT NULL REFERENCES procurement_suppliers(id) ON DELETE CASCADE,
      compliance_type text NOT NULL,
      issue_date      date,
      expiry_date     date,
      status          text NOT NULL DEFAULT 'valid',
      notes           text,
      created_by      bigint REFERENCES app_users(id),
      created_at      timestamptz NOT NULL DEFAULT now(),
      updated_at      timestamptz NOT NULL DEFAULT now(),
      last_reminder_at timestamptz,
      UNIQUE(supplier_id, compliance_type)
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_supplier_compliance_supplier ON supplier_compliance(supplier_id)`);
  // supplier_documents.compliance_id (declared as a plain bigint above, since
  // supplier_compliance didn't exist yet at that point in the script) gets
  // its FK constraint here, now that both tables exist. Idempotent via the
  // duplicate_object guard — plain ADD COLUMN's IF NOT EXISTS doesn't cover
  // ADD CONSTRAINT.
  await pool.query(`DO $$ BEGIN
    ALTER TABLE supplier_documents ADD CONSTRAINT fk_supplier_docs_compliance FOREIGN KEY (compliance_id) REFERENCES supplier_compliance(id) ON DELETE SET NULL;
  EXCEPTION WHEN duplicate_object THEN NULL; END $$;`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS supplier_communications (
      id                  bigserial PRIMARY KEY,
      supplier_id         bigint NOT NULL REFERENCES procurement_suppliers(id) ON DELETE CASCADE,
      communication_type  text NOT NULL,
      subject             text NOT NULL,
      notes               text,
      next_action         text,
      next_action_date    date,
      responsible_user_id bigint REFERENCES app_users(id),
      date                date NOT NULL DEFAULT current_date,
      created_by          bigint REFERENCES app_users(id),
      created_at          timestamptz NOT NULL DEFAULT now()
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_supplier_comm_supplier ON supplier_communications(supplier_id)`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS supplier_improvement_plans (
      id                 bigserial PRIMARY KEY,
      supplier_id        bigint NOT NULL REFERENCES procurement_suppliers(id) ON DELETE CASCADE,
      title              text NOT NULL,
      description        text,
      plan_type          text NOT NULL DEFAULT 'corrective_action',
      status             text NOT NULL DEFAULT 'open',
      owner_user_id      bigint REFERENCES app_users(id),
      due_date           date,
      completion_percent int NOT NULL DEFAULT 0,
      created_by         bigint REFERENCES app_users(id),
      created_at         timestamptz NOT NULL DEFAULT now(),
      updated_at         timestamptz NOT NULL DEFAULT now(),
      closed_at          timestamptz
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_supplier_improve_supplier ON supplier_improvement_plans(supplier_id)`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS procurement_requisitions (
      id                     bigserial PRIMARY KEY,
      requisition_number     text,
      requester_id           bigint NOT NULL REFERENCES app_users(id),
      department             text,
      workshop_id            bigint REFERENCES warehouses(id),
      title                  text NOT NULL,
      description            text,
      priority               text NOT NULL DEFAULT 'medium',
      budget_code            text,
      status                 text NOT NULL DEFAULT 'draft',
      total_estimated_amount numeric(14,2) NOT NULL DEFAULT 0,
      notes                  text,
      created_at             timestamptz NOT NULL DEFAULT now(),
      submitted_at           timestamptz,
      cancelled_at           timestamptz,
      cancelled_reason       text
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_proc_req_status ON procurement_requisitions(status)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_proc_req_requester ON procurement_requisitions(requester_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_proc_req_workshop ON procurement_requisitions(workshop_id)`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS procurement_requisition_items (
      id                  bigserial PRIMARY KEY,
      requisition_id      bigint NOT NULL REFERENCES procurement_requisitions(id) ON DELETE CASCADE,
      description         text NOT NULL,
      quantity            numeric(12,2) NOT NULL,
      unit                text,
      estimated_unit_price numeric(14,2) NOT NULL DEFAULT 0
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_proc_req_items_req ON procurement_requisition_items(requisition_id)`);
  // Optional link to the stock catalog — when set, goods receipt against the
  // resulting PO line can auto-update stock_levels; free-text-only lines
  // (services, one-off non-stock purchases) simply leave this null.
  await pool.query(`ALTER TABLE procurement_requisition_items ADD COLUMN IF NOT EXISTS stock_item_id bigint REFERENCES stock_catalog(id)`);

  // Generic multi-stage approval ledger — reused by requisitions, invoices, and
  // payments instead of three copies of the same stage-advancement logic.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS procurement_approval_steps (
      id            bigserial PRIMARY KEY,
      entity_type   text NOT NULL,
      entity_id     bigint NOT NULL,
      stage_key     text NOT NULL,
      stage_order   int NOT NULL,
      status        text NOT NULL DEFAULT 'pending',
      assigned_role text NOT NULL,
      approved_by   bigint REFERENCES app_users(id),
      approved_at   timestamptz,
      notes         text,
      created_at    timestamptz NOT NULL DEFAULT now()
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_proc_steps_entity ON procurement_approval_steps(entity_type, entity_id)`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS procurement_rfqs (
      id             bigserial PRIMARY KEY,
      requisition_id bigint NOT NULL REFERENCES procurement_requisitions(id),
      rfq_number     text,
      title          text NOT NULL,
      due_date       date,
      status         text NOT NULL DEFAULT 'draft',
      created_by     bigint REFERENCES app_users(id),
      created_at     timestamptz NOT NULL DEFAULT now()
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_proc_rfq_requisition ON procurement_rfqs(requisition_id)`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS procurement_rfq_suppliers (
      id          bigserial PRIMARY KEY,
      rfq_id      bigint NOT NULL REFERENCES procurement_rfqs(id) ON DELETE CASCADE,
      supplier_id bigint NOT NULL REFERENCES procurement_suppliers(id),
      sent_at     timestamptz,
      status      text NOT NULL DEFAULT 'invited'
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_proc_rfq_sup_rfq ON procurement_rfq_suppliers(rfq_id)`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS procurement_quotations (
      id             bigserial PRIMARY KEY,
      rfq_id         bigint NOT NULL REFERENCES procurement_rfqs(id) ON DELETE CASCADE,
      supplier_id    bigint NOT NULL REFERENCES procurement_suppliers(id),
      quoted_amount  numeric(14,2) NOT NULL,
      delivery_days  int,
      terms          text,
      notes          text,
      status         text NOT NULL DEFAULT 'received',
      received_at    timestamptz NOT NULL DEFAULT now()
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_proc_quote_rfq ON procurement_quotations(rfq_id)`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS procurement_purchase_orders (
      id                     bigserial PRIMARY KEY,
      requisition_id         bigint NOT NULL REFERENCES procurement_requisitions(id),
      quotation_id           bigint REFERENCES procurement_quotations(id),
      supplier_id            bigint NOT NULL REFERENCES procurement_suppliers(id),
      po_number              text,
      issue_date             date NOT NULL DEFAULT current_date,
      expected_delivery_date date,
      total_amount           numeric(14,2) NOT NULL DEFAULT 0,
      tax_amount             numeric(14,2) NOT NULL DEFAULT 0,
      terms                  text,
      status                 text NOT NULL DEFAULT 'issued',
      created_by             bigint REFERENCES app_users(id),
      created_at             timestamptz NOT NULL DEFAULT now()
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_proc_po_requisition ON procurement_purchase_orders(requisition_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_proc_po_status ON procurement_purchase_orders(status)`);
  // Which warehouse receives the goods — inherited from the requisition at PO
  // generation time, needed so goods receipt knows which stock_levels row to credit.
  await pool.query(`ALTER TABLE procurement_purchase_orders ADD COLUMN IF NOT EXISTS workshop_id bigint REFERENCES warehouses(id)`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS procurement_po_items (
      id                   bigserial PRIMARY KEY,
      po_id                bigint NOT NULL REFERENCES procurement_purchase_orders(id) ON DELETE CASCADE,
      requisition_item_id  bigint REFERENCES procurement_requisition_items(id),
      description          text NOT NULL,
      quantity             numeric(12,2) NOT NULL,
      unit_price           numeric(14,2) NOT NULL,
      tax_rate             numeric(5,2) NOT NULL DEFAULT 0
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_proc_po_items_po ON procurement_po_items(po_id)`);
  await pool.query(`ALTER TABLE procurement_po_items ADD COLUMN IF NOT EXISTS stock_item_id bigint REFERENCES stock_catalog(id)`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS procurement_goods_receipts (
      id             bigserial PRIMARY KEY,
      po_id          bigint NOT NULL REFERENCES procurement_purchase_orders(id),
      receipt_number text,
      received_by    bigint REFERENCES app_users(id),
      received_at    timestamptz NOT NULL DEFAULT now(),
      status         text NOT NULL DEFAULT 'partial',
      notes          text
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_proc_gr_po ON procurement_goods_receipts(po_id)`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS procurement_goods_receipt_items (
      id                bigserial PRIMARY KEY,
      receipt_id        bigint NOT NULL REFERENCES procurement_goods_receipts(id) ON DELETE CASCADE,
      po_item_id        bigint NOT NULL REFERENCES procurement_po_items(id),
      quantity_received numeric(12,2) NOT NULL DEFAULT 0,
      quantity_rejected numeric(12,2) NOT NULL DEFAULT 0,
      rejection_reason  text,
      notes             text
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_proc_gr_items_receipt ON procurement_goods_receipt_items(receipt_id)`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS procurement_invoices (
      id             bigserial PRIMARY KEY,
      po_id          bigint NOT NULL REFERENCES procurement_purchase_orders(id),
      supplier_id    bigint NOT NULL REFERENCES procurement_suppliers(id),
      invoice_number text NOT NULL,
      invoice_date   date NOT NULL DEFAULT current_date,
      invoice_amount numeric(14,2) NOT NULL,
      status         text NOT NULL DEFAULT 'pending_match',
      matched_by     bigint REFERENCES app_users(id),
      matched_at     timestamptz,
      notes          text,
      created_at     timestamptz NOT NULL DEFAULT now()
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_proc_inv_po ON procurement_invoices(po_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_proc_inv_status ON procurement_invoices(status)`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS procurement_payments (
      id             bigserial PRIMARY KEY,
      invoice_id     bigint NOT NULL REFERENCES procurement_invoices(id),
      amount         numeric(14,2) NOT NULL,
      payment_date   date,
      payment_method text,
      reference      text,
      approved_by    bigint REFERENCES app_users(id),
      status         text NOT NULL DEFAULT 'pending',
      created_at     timestamptz NOT NULL DEFAULT now()
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_proc_pay_invoice ON procurement_payments(invoice_id)`);

  console.log('[migrate] procurement tables ready');

  // ═══════════════════════════════════════════════════════════════════════
  // Phase 6 — Procurement Automation Engine. Additive only: last_reminder_at
  // gate columns on the tables that don't already have one (contracts and
  // compliance already got theirs in Phase 4), plus one new generic table
  // for the Task Center — no existing table can represent "a task, of any
  // category, with an owner/priority/due date/status/deep-link back to its
  // source record" (same justification used for procurement_approval_steps).
  // ═══════════════════════════════════════════════════════════════════════
  await pool.query(`ALTER TABLE procurement_rfqs ADD COLUMN IF NOT EXISTS last_reminder_at timestamptz`);
  await pool.query(`ALTER TABLE procurement_purchase_orders ADD COLUMN IF NOT EXISTS last_reminder_at timestamptz`);
  await pool.query(`ALTER TABLE procurement_invoices ADD COLUMN IF NOT EXISTS last_reminder_at timestamptz`);
  await pool.query(`ALTER TABLE supplier_improvement_plans ADD COLUMN IF NOT EXISTS last_reminder_at timestamptz`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS procurement_automation_tasks (
      id                 bigserial PRIMARY KEY,
      task_key           text NOT NULL,
      category           text NOT NULL,
      title              text NOT NULL,
      priority           text NOT NULL DEFAULT 'medium',
      due_date           date,
      status             text NOT NULL DEFAULT 'open',
      owner_role         text NOT NULL,
      source_module      text NOT NULL,
      source_entity_type text NOT NULL,
      source_entity_id   bigint NOT NULL,
      deep_link          text,
      created_at         timestamptz NOT NULL DEFAULT now(),
      closed_at          timestamptz,
      closed_by          bigint REFERENCES app_users(id),
      auto_closed        boolean NOT NULL DEFAULT false,
      UNIQUE(task_key)
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_proc_auto_tasks_status ON procurement_automation_tasks(status, due_date)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_proc_auto_tasks_owner ON procurement_automation_tasks(owner_role, status)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_proc_auto_tasks_source ON procurement_automation_tasks(source_entity_type, source_entity_id)`);
  console.log('[migrate] procurement automation tables ready');

  await seedProcurementAutomationRules();

  await seedProcurementRoles();
  await grantProcurementPermissions();

  await createMaintenanceJobsTables();
  await grantMaintenanceJobsPermissions();

  await grantInventoryLossReportsPermission();

  await createProcurementRevisionTable();

  await createProcurementPoShortageColumns();

  await createHarvestPlanningTables();
  await createHarvestDelaysTable();
  await createSawmillTimberSizeTracking();
  await createSawmillInventoryBridge();
  await createSawmillCostingFoundation();
  await grantSawmillDashboardPermission();

  await createTimberLifecyclePhase1();
  await createTimberLifecyclePhase2();
  await createTimberLifecyclePhase3();
  await grantStockTransfersToNyanzaShowroom();

  await createNyanzaValueAddedProduction();

  // Pole Production Phase 1
  await createPoleProductionPhase1();

  // Pole Production Phase 2 — Purchased Finished Poles
  await createPoleProductionPhase2();

  // ERP Final Enterprise Completion Gate — real gap found: the desktop
  // 'showroom' NAV page id was never seeded to any role's permissions
  // (confirmed via a full grep of every seed/grant block in this file), so
  // no role — including showroom-staff, the role this feature was built
  // for — could see the Showroom sidebar link out of the box, even though
  // the underlying backend functions (showroomInventoryList/
  // showroomDamageReportCreate/etc.) already correctly authorize
  // admin/ceo/operations/supervisor plus anyone holding timber-inventory/
  // sales. This grants the 'showroom' page id (NAV-visibility only — the
  // data-gate permissions those functions check are deliberately left
  // untouched, matching the existing inventory-loss-reports/
  // maintenance-jobs convention of a NAV-only key) to exactly the role set
  // those functions already authorize.
  await grantShowroomNavPermission();

  // Sales Enterprise Phase 1 (Final Enterprise Completion Gate) — confirmed
  // no Sales Dashboard/Reporting existed anywhere for the 'sales' role;
  // grants the new 'sales-dashboard' page id (backs both the Dashboard and
  // the Sales History report, gated identically) to every role that already
  // sees the Sales Orders page.
  await grantSalesDashboardPermission();

  // HR Enterprise Phase 2 — Attendance
  await createAttendanceTables();
  await grantAttendancePermission();

  // ERP Remaining Departments Completion Program
  await restoreRolePagesDrift();

  // Payroll Enterprise Phase 2
  await createPayrollTables();
  await grantPayrollPermission();

  // Finance Enterprise Phase 2
  await createFinanceTables();
  await grantFinanceCenterPermission();

  // Finance Enterprise — Complete Requirements Specification (Stock Count,
  // Reconciliation, Financial Exception Center)
  await createFinanceStockCountTables();
  await grantFinanceStockCountPermission();
  await createFinanceExceptionTables();
}

// No "stock count"/"physical count" concept existed anywhere in this codebase
// prior to this migration (confirmed by a dedicated audit — zero matches for
// stock_count/physical_count/cycle_count anywhere in data.js/schema.sql).
// stock_count_sessions is the count header (one warehouse per session, an
// optional category filter, a lifecycle status); stock_count_lines is one
// row per counted item, snapshotting the system quantity AT THE TIME THE
// SESSION WAS OPENED (so a later stock movement doesn't retroactively change
// what "the count found") alongside the physical quantity entered by staff.
// variance is deliberately NOT a stored/generated column — computing it at
// read time as (physical_qty - system_qty_snapshot) lets an uncounted line
// (physical_qty is null) naturally read as NULL variance instead of a false
// "missing all of it" negative number a coalesce-to-0 would produce.
// Corrections never touch stock_levels directly: adjustment_request_id
// records the pending_edits row created via the EXISTING governed
// stockAdjustmentRequestCreate()/MANAGER_APPROVERS approval engine once a
// variance line is submitted — this table only tracks that link, it is not
// a second source of truth for the correction itself.
async function createFinanceStockCountTables() {
  await pool.query(`
    create table if not exists stock_count_sessions (
      id             bigserial primary key,
      workshop_id    bigint references warehouses(id),
      category       text,
      status         text not null default 'draft'
                       check (status in ('draft','counting','pending_review','submitted','completed','cancelled')),
      notes          text,
      initiated_by   bigint references app_users(id),
      initiated_at   timestamptz not null default now(),
      completed_at   timestamptz,
      created_at     timestamptz not null default now()
    )
  `);
  await pool.query(`
    create table if not exists stock_count_lines (
      id                     bigserial primary key,
      session_id             bigint not null references stock_count_sessions(id) on delete cascade,
      item_id                bigint not null references stock_catalog(id),
      system_qty_snapshot    int not null,
      physical_qty           int,
      unit_cost_snapshot     numeric(14,2),
      status                 text not null default 'pending' check (status in ('pending','counted','reviewed')),
      notes                  text,
      counted_by             bigint references app_users(id),
      counted_at             timestamptz,
      adjustment_request_id  bigint references pending_edits(id),
      created_at             timestamptz not null default now(),
      unique(session_id, item_id)
    )
  `);
  await pool.query(`create index if not exists idx_stock_count_lines_session on stock_count_lines(session_id)`);
  await pool.query(`create index if not exists idx_stock_count_sessions_workshop on stock_count_sessions(workshop_id)`);
  console.log('[migrate] finance stock-count tables ready');
}

// Finance had ZERO stock-module page permission before this (confirmed by
// audit — role_definitions.finance carries none of 'stock-movements'/
// 'inventory'/'stock-items'/'warehouses'). Granting the broad 'stock-movements'
// page would also unlock the full Stock Movements/Catalog CRUD screens Finance
// doesn't need — a new, narrow permission key gates only the Stock Count
// workflow, matching this codebase's existing convention of purpose-specific
// permission keys (e.g. 'inventory-loss-reports') over reusing a broad one.
async function grantFinanceStockCountPermission() {
  const { rows } = await pool.query(
    `select role, permissions from role_definitions where role in ('admin','ceo','operations','finance')`
  );
  let updated = 0;
  for (const row of rows) {
    const existing = Array.isArray(row.permissions) ? row.permissions : [];
    if (existing.includes('finance-stock-count')) continue;
    const newPerms = [...existing, 'finance-stock-count'];
    await pool.query('update role_definitions set permissions=$1 where role=$2', [JSON.stringify(newPerms), row.role]);
    updated++;
  }
  console.log(`[migrate] finance-stock-count permission granted to ${updated} role(s)`);
}

// Financial Exception Center — case management (investigate → comment →
// resolve/close) over exceptions this codebase's own live reports already
// surface (financeExceptionReport, the new stock-variance report, etc.).
// resolution_records/rejection_holds were evaluated and rejected as a base
// for this (they're a one-shot, materials-write-off ledger with a hardcoded
// destination enum and mandatory stock-posting — not a general case-tracking
// table). unique(category, source_ref) makes "open or reuse" an idempotent
// upsert: re-investigating the same live-computed exception never creates a
// duplicate case.
async function createFinanceExceptionTables() {
  await pool.query(`
    create table if not exists finance_exception_cases (
      id                 bigserial primary key,
      category           text not null,
      source_ref         text not null,
      title              text not null,
      description        text,
      severity           text not null default 'medium' check (severity in ('low','medium','high','critical')),
      financial_impact   numeric(14,2),
      workshop_id        bigint references warehouses(id),
      status             text not null default 'open' check (status in ('open','investigating','resolved','closed')),
      created_by         bigint references app_users(id),
      created_at         timestamptz not null default now(),
      assigned_to        bigint references app_users(id),
      resolved_by        bigint references app_users(id),
      resolved_at        timestamptz,
      resolution_notes   text,
      unique(category, source_ref)
    )
  `);
  await pool.query(`
    create table if not exists finance_exception_comments (
      id          bigserial primary key,
      case_id     bigint not null references finance_exception_cases(id) on delete cascade,
      user_id     bigint references app_users(id),
      comment     text not null,
      created_at  timestamptz not null default now()
    )
  `);
  await pool.query(`create index if not exists idx_finance_exception_comments_case on finance_exception_comments(case_id)`);
  await pool.query(`create index if not exists idx_finance_exception_cases_status on finance_exception_cases(status)`);
  console.log('[migrate] finance exception-center tables ready');
}

// Procurement Exception Management Phase 3 — Purchase Order Close with
// Shortage. No new table: "Outstanding Quantity"/"Affected Items" are fully
// derivable at read time from procurement_po_items vs
// procurement_goods_receipt_items, so only genuinely new information gets
// columns. shortage_attempt_number reuses the exact same "which attempt"
// tagging mechanism procurement_approval_steps.revision_number already
// provides (added in Requisition Return for Revision Phase 2) — no new
// column needed on that table.
async function createProcurementPoShortageColumns() {
  await pool.query(`alter table procurement_purchase_orders add column if not exists shortage_reason text`);
  await pool.query(`alter table procurement_purchase_orders add column if not exists shortage_supplier_explanation text`);
  await pool.query(`alter table procurement_purchase_orders add column if not exists shortage_requested_by bigint references app_users(id)`);
  await pool.query(`alter table procurement_purchase_orders add column if not exists shortage_requested_at timestamptz`);
  await pool.query(`alter table procurement_purchase_orders add column if not exists shortage_closed_at timestamptz`);
  await pool.query(`alter table procurement_purchase_orders add column if not exists shortage_attempt_number int not null default 0`);
  console.log('[migrate] procurement PO shortage columns ready');
}

// Procurement Exception Management Phase 2 — Requisition Return for
// Revision. `revision_number` on both requisitions and approval_steps tags
// which approval "attempt" a row belongs to (0 = never returned); the new
// table is one row per return-for-revision event, with two full JSONB item
// snapshots (before the storekeeper's edit, after resubmission) rather than
// a per-field diff table — simplest way to guarantee nothing is overwritten.
async function createProcurementRevisionTable() {
  await pool.query(`alter table procurement_requisitions add column if not exists revision_number int not null default 0`);
  await pool.query(`alter table procurement_approval_steps add column if not exists revision_number int not null default 0`);
  await pool.query(`
    create table if not exists procurement_requisition_revisions (
      id bigserial primary key,
      requisition_id bigint not null references procurement_requisitions(id),
      revision_number int not null,
      returned_by bigint references app_users(id),
      returned_at timestamptz not null default now(),
      reviewer_notes text not null,
      items_before jsonb not null,
      total_before numeric(14,2) not null,
      resubmitted_by bigint references app_users(id),
      resubmitted_at timestamptz,
      items_after jsonb,
      total_after numeric(14,2)
    )
  `);
  await pool.query(`create index if not exists idx_proc_req_revisions_req on procurement_requisition_revisions(requisition_id)`);
  console.log('[migrate] procurement requisition revisions table ready');
}

// Inventory Integrity Phase 1 — page-visibility permission for the new
// desktop "Inventory Loss Reports" NAV entry. This is NOT a new
// authorization boundary — the backend function itself still gates on the
// existing 'stock-movements' permission (same data-access decision as the
// Stock Movements page it's built from). Every page in this app's sidebar
// needs its own NAV-id-matching permission key purely for visibility
// plumbing (see 'maintenance-reports' for the identical precedent), so this
// is granted to exactly the same live role list that already holds
// 'stock-movements' (verified live before writing this list).
async function grantInventoryLossReportsPermission() {
  async function grant(role, pages) {
    const { rows } = await pool.query('select permissions from role_definitions where role=$1', [role]);
    if (!rows.length) return;
    const existing = Array.isArray(rows[0].permissions) ? rows[0].permissions : [];
    const newPerms = Array.from(new Set([...existing, ...pages]));
    if (newPerms.length === existing.length) return;
    await pool.query('update role_definitions set permissions=$1, updated_at=now() where role=$2',
      [JSON.stringify(newPerms), role]);
  }
  const STOCK_MOVEMENTS_ROLES = ['storekeeper-assistant', 'storekeeper', 'logistics-officer', 'logistics', 'ceo', 'operations', 'admin'];
  for (const role of STOCK_MOVEMENTS_ROLES) await grant(role, ['inventory-loss-reports']);
  console.log('[migrate] inventory loss reports permission granted');
}

// Mechanician Phase 3 — Enterprise Maintenance Lifecycle & Asset Management.
// New tables only for machines (generators/forklifts/compressors/chainsaws
// already covered by machine_categories — confirmed live: 'Generator' and
// 'Crane / Forklift' categories already exist, so "any future equipment" is
// just a new category row, not new schema). Vehicles keep Fleet's existing,
// separate maintenance_records/fuel_logs system untouched — confirmed scope
// decision, not an oversight.
async function createMaintenanceJobsTables() {
  await pool.query(`
    create table if not exists maintenance_jobs (
      id                          bigserial primary key,
      machine_id                  bigint not null references machines(id),
      schedule_id                 bigint references machine_maintenance_schedules(id),
      workshop_id                 bigint references warehouses(id),
      title                       text not null,
      description                 text,
      priority                    text not null default 'normal',
      status                      text not null default 'inspection',
      assigned_to                 bigint references app_users(id),
      assigned_at                 timestamptz,
      started_at                  timestamptz,
      returned_to_service_at      timestamptz,
      completed_at                timestamptz,
      delay_reason                text,
      cancelled_reason            text,
      external_repair_vendor      text,
      external_repair_reason      text,
      external_repair_sent_at     date,
      external_repair_returned_at date,
      external_repair_cost        numeric(14,2),
      external_repair_notes       text,
      notes                       text,
      created_by                  bigint references app_users(id),
      created_at                  timestamptz not null default now()
    )
  `);
  await pool.query(`create index if not exists idx_maint_jobs_machine on maintenance_jobs(machine_id)`);
  await pool.query(`create index if not exists idx_maint_jobs_status on maintenance_jobs(status)`);
  await pool.query(`create index if not exists idx_maint_jobs_assigned on maintenance_jobs(assigned_to)`);
  await pool.query(`create index if not exists idx_maint_jobs_workshop on maintenance_jobs(workshop_id)`);

  await pool.query(`
    create table if not exists maintenance_job_labour (
      id             bigserial primary key,
      job_id         bigint not null references maintenance_jobs(id),
      technician_id  bigint references app_users(id),
      start_time     timestamptz,
      finish_time    timestamptz,
      hours_worked   numeric(6,2),
      notes          text,
      delay_reason   text,
      created_at     timestamptz not null default now()
    )
  `);
  await pool.query(`create index if not exists idx_maint_labour_job on maintenance_job_labour(job_id)`);

  // Priority 6 — Production Impact. job_id is required (not nullable): this
  // is the "reuse the existing maintenance activity, do not create duplicate
  // maintenance records" instruction enforced at the schema level, not just
  // in application code.
  await pool.query(`
    create table if not exists maintenance_production_impact (
      id                        bigserial primary key,
      job_id                    bigint not null references maintenance_jobs(id),
      machine_id                bigint not null references machines(id),
      workshop_id               bigint references warehouses(id),
      log_date                  date not null default current_date,
      downtime_hours            numeric(6,2),
      reason                    text,
      estimated_production_loss numeric(12,2),
      comments                  text,
      recorded_by               bigint references app_users(id),
      recorded_at               timestamptz not null default now()
    )
  `);
  await pool.query(`create index if not exists idx_maint_prod_impact_job on maintenance_production_impact(job_id)`);

  // Priority 7 — spare parts consumption integration. No new inventory
  // logic: materialRequestsCreate just accepts and stores this optional FK;
  // the existing Material Request -> Stock Transfer -> Dispatch -> Receive
  // pipeline is completely unchanged.
  await pool.query(`alter table material_requests add column if not exists maintenance_job_id bigint references maintenance_jobs(id)`);

  console.log('[migrate] maintenance jobs tables ready');
}

// New page-visibility permissions only — no new role, per the confirmed
// scope decision (company-wide supervision goes to the existing 'logistics'
// role, already labeled 'Logistics Manager' and already company-wide).
async function grantMaintenanceJobsPermissions() {
  async function grant(role, pages) {
    const { rows } = await pool.query('select permissions from role_definitions where role=$1', [role]);
    if (!rows.length) return;
    const existing = Array.isArray(rows[0].permissions) ? rows[0].permissions : [];
    const newPerms = Array.from(new Set([...existing, ...pages]));
    if (newPerms.length === existing.length) return;
    await pool.query('update role_definitions set permissions=$1, updated_at=now() where role=$2',
      [JSON.stringify(newPerms), role]);
  }
  // Mirrors exactly who holds 'machine-logs'/'machine-maintenance' today
  // (verified live before writing this list, same discipline as Phase 2).
  const JOB_ROLES = ['mechanician', 'supervisor', 'sawmill-leader', 'poles-leader', 'logistics', 'operations', 'admin', 'ceo'];
  for (const role of JOB_ROLES) await grant(role, ['maintenance-jobs']);
  // Company-wide "Mechanician Officer" capability — logistics/admin/ceo only.
  for (const role of ['logistics', 'admin', 'ceo']) await grant(role, ['maintenance-oversight']);
  console.log('[migrate] maintenance jobs permissions granted');
}

// Harvesting Phase 2, Workstream 1 — Harvest Planning. Reuses the existing
// 'harvest'/'daily-harvest' page permissions (already held by admin, ceo,
// harvesting-leader, harvesting-supervisor, operations, supervisor — verified
// live before writing this) rather than adding a new permission, per the
// brief's "reuse existing services wherever possible" rule. Status is a
// stored enum ('Planned' | 'In Progress' | 'Completed' | 'Cancelled');
// "Delayed" is deliberately NOT a stored status — it's derived at read time
// (status not in Completed/Cancelled AND planned_date < today), the same
// computed-not-stored convention Phase 1 used for Transport Waiting/Raw Log
// Inventory, so a plan can't get stuck in a stale "Delayed" state.
async function createHarvestPlanningTables() {
  await pool.query(`
    create table if not exists harvest_plans (
      id               bigserial primary key,
      compt_id         bigint references compartments(id),
      sub_name         text,
      species          text not null,
      planned_date     date not null,
      target_volume_m3 numeric(10,2),
      target_logs      integer,
      priority         text not null default 'normal',
      status           text not null default 'Planned',
      workshop_id      bigint references warehouses(id),
      notes            text,
      created_by       bigint references app_users(id),
      created_at       timestamptz not null default now(),
      pending_deletion boolean default false,
      deleted_at       timestamptz,
      deleted_by       bigint references app_users(id),
      deletion_reason  text
    )
  `);
  await pool.query(`create index if not exists idx_harvest_plans_compt on harvest_plans(compt_id)`);
  await pool.query(`create index if not exists idx_harvest_plans_status on harvest_plans(status)`);
  await pool.query(`create index if not exists idx_harvest_plans_date on harvest_plans(planned_date)`);
  await pool.query(`create index if not exists idx_harvest_plans_workshop on harvest_plans(workshop_id)`);

  // "Planning feeds Harvest Records" — an optional link so a harvest record
  // can (but doesn't have to) fulfil a plan. Additive column on the existing
  // table, not a redesign: harvest_logs works exactly as before when plan_id
  // is left null (unplanned/ad hoc harvesting, which the brief doesn't say
  // to stop supporting).
  await pool.query(`alter table harvest_logs add column if not exists plan_id bigint references harvest_plans(id)`);
  await pool.query(`create index if not exists idx_harvest_logs_plan on harvest_logs(plan_id)`);

  console.log('[migrate] harvest planning tables ready');
}

// Harvesting Phase 3, Workstream 3 — Operational Delay Analysis. Append-only
// log (no update/delete), matching the existing maintenance_production_impact
// table's shape exactly — the brief explicitly forbids a new approval
// workflow, so this deliberately has no governance/edit path, same as that
// precedent.
async function createHarvestDelaysTable() {
  await pool.query(`
    create table if not exists harvest_delays (
      id                bigserial primary key,
      compt_id          bigint references compartments(id),
      plan_id           bigint references harvest_plans(id),
      category          text not null,
      duration_hours    numeric(6,2),
      production_impact text,
      workshop_id       bigint references warehouses(id),
      logged_by         bigint references app_users(id),
      created_at        timestamptz not null default now()
    )
  `);
  await pool.query(`create index if not exists idx_harvest_delays_compt on harvest_delays(compt_id)`);
  await pool.query(`create index if not exists idx_harvest_delays_workshop on harvest_delays(workshop_id)`);
  await pool.query(`create index if not exists idx_harvest_delays_created on harvest_delays(created_at)`);
  console.log('[migrate] harvest delays table ready');
}

// Sawmill Timber Entry enhancement — captures log diameter and shift start/
// end time on daily_logs (additive columns, existing rows unaffected), and
// adds daily_log_items for the "one log can yield multiple timber sizes"
// case: a child table of (width_mm, thickness_mm, length_m, quantity) rows
// per daily_logs entry, replacing the old single-scalar product_size
// assumption. product_size itself is left in place for backward
// compatibility with existing reports that read it.
async function createSawmillTimberSizeTracking() {
  await pool.query(`alter table daily_logs add column if not exists log_diameter_cm numeric(6,2)`);
  await pool.query(`alter table daily_logs add column if not exists start_time time`);
  await pool.query(`alter table daily_logs add column if not exists end_time time`);

  await pool.query(`
    create table if not exists daily_log_items (
      id            bigserial primary key,
      daily_log_id  bigint not null references daily_logs(id),
      width_mm      numeric(8,2) not null,
      thickness_mm  numeric(8,2) not null,
      length_m      numeric(8,2) not null,
      quantity      integer not null default 1,
      created_at    timestamptz not null default now()
    )
  `);
  await pool.query(`create index if not exists idx_daily_log_items_log on daily_log_items(daily_log_id)`);
  console.log('[migrate] sawmill timber size tracking ready');
}

// Sawmill Phase 1 (Workstreams 1 & 7) — bridges Finished Timber Inventory
// into the SAME stock_catalog/stock_levels architecture Stock Transfer and
// Procurement already use, instead of a second inventory system.
// products.stock_item_id mirrors the existing
// procurement_requisition_items.stock_item_id precedent (a non-warehouse
// concept referencing a stock_catalog item). daily_log_items.product_id and
// sales_orders.product_id freeze which product a historical record resolved
// to, so later Product Catalog edits can't retroactively change what a past
// record posted/deducted against.
async function createSawmillInventoryBridge() {
  await pool.query(`alter table products add column if not exists stock_item_id bigint references stock_catalog(id)`);
  await pool.query(`alter table daily_log_items add column if not exists product_id bigint references products(id)`);
  await pool.query(`alter table sales_orders add column if not exists product_id bigint references products(id)`);
  await pool.query(`create index if not exists idx_products_stock_item on products(stock_item_id)`);
  await pool.query(`create index if not exists idx_daily_log_items_product on daily_log_items(product_id)`);
  await pool.query(`create index if not exists idx_sales_orders_product on sales_orders(product_id)`);

  // Backfill — link every existing active Timber/Poles product to a
  // stock_catalog item, so the bridge is live immediately for products
  // created before this phase (new products auto-link via productsCreate).
  const { rows: unlinked } = await pool.query(
    `select id, type, sub_type, size from products where stock_item_id is null and active=true`
  );
  for (const p of unlinked) {
    const label = p.type === 'Timber' ? `${p.sub_type || 'Untreated'} ${p.size}` : `${p.type} ${p.size}`;
    const category = p.type === 'Timber' ? 'Finished Timber' : 'Finished Poles';
    const { rows: [item] } = await pool.query(
      `insert into stock_catalog(category, name, uom, unit_cost, active) values ($1,$2,'pieces',0,true) returning id`,
      [category, label]
    );
    await pool.query(`update products set stock_item_id=$1 where id=$2`, [item.id, p.id]);
  }
  console.log(`[migrate] sawmill inventory bridge ready (${unlinked.length} existing product(s) linked to stock catalog)`);
}

// Sawmill Phase 2 (Enterprise Costing & Pricing Foundation) — separates
// Standard Cost (accounting — Inventory/COGS/Valuation) from Default Selling
// Price (commercial — the Sales-form default) from the Negotiated Selling
// Price (sales_orders.unit_price, already its own per-transaction column,
// untouched here — this migration never writes to it). Columns are nullable
// at the DB level (this codebase's existing convention for "mandatory per
// business rule, enforced in the application layer" — see e.g. reason
// fields elsewhere) since real approved values must come from management/
// finance, not be fabricated by a migration; productsCreate/productsUpdate
// enforce both fields as required going forward. The check constraint blocks
// a literal zero from ever being saved (brief: "may not contain zero unless
// explicitly allowed by company policy" — no such policy exists today).
async function createSawmillCostingFoundation() {
  await pool.query(`alter table products add column if not exists standard_cost numeric(14,2)`);
  await pool.query(`alter table products add column if not exists default_price numeric(14,2)`);
  await pool.query(`
    do $$ begin
      if not exists (select 1 from pg_constraint where conname = 'products_standard_cost_positive') then
        alter table products add constraint products_standard_cost_positive check (standard_cost is null or standard_cost > 0);
      end if;
      if not exists (select 1 from pg_constraint where conname = 'products_default_price_positive') then
        alter table products add constraint products_default_price_positive check (default_price is null or default_price > 0);
      end if;
    end $$;
  `);
  // Sawmill Phase 2 — Initial Product Costing & Pricing Approval. Standard
  // Cost is approved by Finance, Default Selling Price by Management — two
  // independent approval records (name/date/effective-date) rather than one,
  // matching the brief's insistence that the two concepts never share a
  // field. Free-text approver (not an app_users FK) because the approving
  // Finance/Management person is not necessarily the person operating this
  // form — same "reason"-field precedent used everywhere else in this app.
  await pool.query(`alter table products add column if not exists standard_cost_approved_by text`);
  await pool.query(`alter table products add column if not exists standard_cost_approved_at timestamptz`);
  await pool.query(`alter table products add column if not exists standard_cost_effective_date date`);
  await pool.query(`alter table products add column if not exists default_price_approved_by text`);
  await pool.query(`alter table products add column if not exists default_price_approved_at timestamptz`);
  await pool.query(`alter table products add column if not exists default_price_effective_date date`);
  // Brief explicitly names stock_catalog.default_selling_price as part of
  // ERP initialization. Sales still reads products.default_price directly
  // (its actual single source), but this keeps the mirrored figure visible
  // wherever stock_catalog is the joined table (same mirroring convention
  // already used for unit_cost <- standard_cost).
  await pool.query(`alter table stock_catalog add column if not exists default_selling_price numeric(14,2)`);

  const { rows: [missing] } = await pool.query(
    `select count(*)::int as n from products where active=true and (standard_cost is null or default_price is null)`
  );
  console.log(`[migrate] sawmill costing foundation ready (${missing.n} active product(s) still missing standard_cost/default_price — awaiting management/finance-approved values)`);
}

// Sawmill Phase 3 (Workstream 4) — grants the new 'sawmill-dashboard' page
// to exactly the roles that already hold 'daily-timber' (i.e. actually
// record Sawmill production today), read live from role_definitions rather
// than a hardcoded guess, so this can never drift from the real page-
// permission source of truth: admin, ceo, operations, sawmill-leader,
// sawmill-supervisor, supervisor. Idempotent union, same pattern as every
// other permission grant in this file.
async function grantSawmillDashboardPermission() {
  const { rows } = await pool.query(
    `select role, permissions from role_definitions where permissions::text like '%"daily-timber"%'`
  );
  let updated = 0;
  for (const row of rows) {
    const existing = Array.isArray(row.permissions) ? row.permissions : [];
    if (existing.includes('sawmill-dashboard')) continue;
    const newPerms = [...existing, 'sawmill-dashboard'];
    await pool.query('update role_definitions set permissions=$1 where role=$2', [JSON.stringify(newPerms), row.role]);
    updated++;
  }
  console.log(`[migrate] sawmill-dashboard permission granted to ${updated} role(s) already holding daily-timber`);
}

// Timber Lifecycle Phase 3 — confirmed via AskUserQuestion: vat-leader,
// vat-supervisor, and showroom-staff currently cannot receive stock transfers
// arriving at their own workshop (only admin/ceo/operations/logistics/
// storekeeper hold 'stock-transfers'). Grants the existing 'stock-transfers'
// permission additively — no new permission invented, matching
// grantSawmillDashboardPermission's established idempotent pattern.
async function grantStockTransfersToNyanzaShowroom() {
  const { rows } = await pool.query(
    `select role, permissions from role_definitions where role in ('vat-leader','vat-supervisor','showroom-staff')`
  );
  let updated = 0;
  for (const row of rows) {
    const existing = Array.isArray(row.permissions) ? row.permissions : [];
    if (existing.includes('stock-transfers')) continue;
    const newPerms = [...existing, 'stock-transfers'];
    await pool.query('update role_definitions set permissions=$1 where role=$2', [JSON.stringify(newPerms), row.role]);
    updated++;
  }
  console.log(`[migrate] stock-transfers permission granted to ${updated} Nyanza/Showroom role(s)`);
}

// ERP Final Enterprise Completion Gate — see the call site's comment. Grants
// the 'showroom' NAV-visibility page id to the exact role set the Showroom
// backend functions already authorize (showroomInventoryList/
// showroomDamageReportCreate/showroomDamageReportsList: admin/ceo/operations/
// supervisor by hardcoded role check, plus showroom-staff via its existing
// timber-inventory/sales permissions) — additive only, same idempotent
// pattern as grantSawmillDashboardPermission/grantStockTransfersToNyanzaShowroom.
async function grantShowroomNavPermission() {
  const { rows } = await pool.query(
    `select role, permissions from role_definitions where role in ('admin','ceo','operations','supervisor','showroom-staff')`
  );
  let updated = 0;
  for (const row of rows) {
    const existing = Array.isArray(row.permissions) ? row.permissions : [];
    if (existing.includes('showroom')) continue;
    const newPerms = [...existing, 'showroom'];
    await pool.query('update role_definitions set permissions=$1 where role=$2', [JSON.stringify(newPerms), row.role]);
    updated++;
  }
  console.log(`[migrate] showroom NAV permission granted to ${updated} role(s)`);
}

// ERP Final Enterprise Completion Gate — see the call site's comment. Same
// idempotent additive pattern as grantShowroomNavPermission above.
async function grantSalesDashboardPermission() {
  const { rows } = await pool.query(
    `select role, permissions from role_definitions where role in ('admin','ceo','operations','sales','sales-staff','showroom-staff')`
  );
  let updated = 0;
  for (const row of rows) {
    const existing = Array.isArray(row.permissions) ? row.permissions : [];
    if (existing.includes('sales-dashboard')) continue;
    const newPerms = [...existing, 'sales-dashboard'];
    await pool.query('update role_definitions set permissions=$1 where role=$2', [JSON.stringify(newPerms), row.role]);
    updated++;
  }
  console.log(`[migrate] sales-dashboard permission granted to ${updated} role(s)`);
}

// ── Enterprise Timber Lifecycle Integration Program — Phase 1 ────────────────
// Foundation: Harvest Waste, one reusable Resolution Engine (shared by both
// harvest waste and non-recoverable production offcuts, per the brief's own
// "build ONE reusable Resolution Engine" instruction), Production Offcuts/
// Resaw, Quality Inspection (mirrors the existing Poles Delivery QC shape —
// approved/rejected quantity split, no fabricated grade — confirmed via
// AskUserQuestion), and a generalized attachments subsystem (extends the
// existing Supplier Documents multer+disk pattern, generalized with a
// polymorphic entity_type/entity_id instead of a supplier-only FK).
//
// Raw Log Inventory stays the same VIRTUAL ledger it has always been
// (harvest_logs.logs_handrolled minus daily_logs.logs_received) — no
// stock_catalog item is created for raw logs, since that would itself be
// "creating a duplicate inventory system" against the established Phase 1
// Sawmill architecture. Harvest Waste reduces the transportable-logs figure
// for its batch by recording against harvest_logs directly.
async function createTimberLifecyclePhase1() {
  // Harvest Waste — configurable categories (admin-manageable, same free-form
  // lookup shape as machine_categories, seeded with sensible defaults).
  await pool.query(`
    create table if not exists harvest_waste_categories (
      id bigserial primary key,
      name text not null unique,
      active boolean not null default true,
      created_at timestamptz not null default now()
    )`);
  const { rows: existingCats } = await pool.query('select count(*)::int as n from harvest_waste_categories');
  if (Number(existingCats[0].n) === 0) {
    const defaults = ['Damaged in Felling', 'Rot / Decay', 'Undersized', 'Species Reject', 'Environmental Damage', 'Other'];
    for (const name of defaults) {
      await pool.query('insert into harvest_waste_categories(name) values ($1) on conflict (name) do nothing', [name]);
    }
  }

  // Harvest Waste transactions — belongs to a Harvest Batch (harvest_logs),
  // records volume + percentage + supervisor + reason; category is
  // configurable via the table above. resolution_id is set once the
  // Resolution Engine has processed this waste (nullable until then).
  await pool.query(`
    create table if not exists harvest_waste (
      id bigserial primary key,
      harvest_log_id bigint not null references harvest_logs(id),
      category_id bigint references harvest_waste_categories(id),
      volume_logs int not null check (volume_logs > 0),
      percentage numeric(5,2) not null,
      supervisor text not null,
      reason text not null,
      workshop_id bigint references warehouses(id),
      resolution_id bigint,
      created_by bigint references app_users(id),
      created_at timestamptz not null default now(),
      deleted_at timestamptz,
      deleted_by bigint references app_users(id),
      deletion_reason text
    )`);
  await pool.query('create index if not exists idx_harvest_waste_log on harvest_waste(harvest_log_id)');

  // ONE reusable Resolution Engine — used by harvest_waste AND
  // production_offcuts (source_type distinguishes them). destination is a
  // fixed set per the brief's own enumeration (Firewood/Scrap Sale/Internal
  // Use/Disposal/Other) — 'Other' carries destination_detail for anything
  // not covered. When a destination has recoverable value (Firewood, Scrap
  // Sale, Internal Use), stock_item_id links to an auto-created
  // stock_catalog row (category 'Waste Byproduct') so the resulting value
  // flows through the SAME stock_levels/stock_movements architecture every
  // other inventory concept in this app already uses — Disposal/Other post
  // no stock movement (nothing recoverable), but the resolution_records row
  // itself is the permanent audit trail, satisfying "no material may
  // disappear" even when the material's final value is zero.
  await pool.query(`
    create table if not exists resolution_records (
      id bigserial primary key,
      source_type text not null check (source_type in ('harvest_waste','production_offcut')),
      source_id bigint not null,
      destination text not null check (destination in ('Firewood','Scrap Sale','Internal Use','Disposal','Other')),
      destination_detail text,
      volume int not null check (volume > 0),
      unit_cost numeric(14,2),
      stock_item_id bigint references stock_catalog(id),
      warehouse_id bigint references warehouses(id),
      notes text,
      resolved_by bigint references app_users(id),
      resolved_at timestamptz not null default now(),
      created_by bigint references app_users(id),
      created_at timestamptz not null default now()
    )`);
  await pool.query('create index if not exists idx_resolution_records_source on resolution_records(source_type, source_id)');
  await pool.query(`alter table harvest_waste add constraint harvest_waste_resolution_fkey
    foreign key (resolution_id) references resolution_records(id)`).catch(() => {});

  // Generalized attachments — polymorphic entity_type/entity_id, extends the
  // existing Supplier Documents multer+disk pattern (mobile-api/routes/
  // supplierDocuments.js) rather than that supplier-only table, so any
  // record in the app (starting with harvest_waste and production_offcuts)
  // can attach files through one shared upload route going forward.
  await pool.query(`
    create table if not exists attachments (
      id bigserial primary key,
      entity_type text not null,
      entity_id bigint not null,
      original_filename text not null,
      stored_filename text not null,
      mime_type text,
      file_size int,
      uploaded_by bigint references app_users(id),
      uploaded_at timestamptz not null default now()
    )`);
  await pool.query('create index if not exists idx_attachments_entity on attachments(entity_type, entity_id)');

  // Raw Log Inventory validation (Workstream 3) — duplicate-receipt
  // prevention needs an optional reference number to dedupe against;
  // nullable so existing entries and free-form transports keep working.
  await pool.query(`alter table log_transport add column if not exists receipt_reference text`);
  await pool.query(`create unique index if not exists idx_log_transport_receipt_ref
    on log_transport(workshop_id, receipt_reference) where receipt_reference is not null and deleted_at is null`);

  // Production Offcuts — every timber_waste unit from a Sawmill production
  // entry now becomes a tracked offcut record (not an immediate write-off).
  // status: 'pending_decision' -> ('resolved' via Resolution Engine, not
  // recoverable) or ('pending_resaw' -> 'resawn' -> 'inspected', recoverable).
  await pool.query(`
    create table if not exists production_offcuts (
      id bigserial primary key,
      daily_log_id bigint not null references daily_logs(id),
      quantity int not null check (quantity > 0),
      recoverable boolean,
      resaw_machine_id bigint references machines(id),
      resaw_started_at timestamptz,
      recovered_quantity int,
      recovered_width_mm numeric(8,2),
      recovered_thickness_mm numeric(8,2),
      recovered_length_m numeric(8,2),
      resolution_id bigint references resolution_records(id),
      status text not null default 'pending_decision'
        check (status in ('pending_decision','pending_resaw','resawn','inspected','resolved')),
      workshop_id bigint references warehouses(id),
      created_by bigint references app_users(id),
      created_at timestamptz not null default now()
    )`);
  await pool.query('create index if not exists idx_production_offcuts_log on production_offcuts(daily_log_id)');

  // Quality Inspection — mirrors the existing Poles Delivery QC shape
  // (poles_deliveries.approved_qty/rejected_qty/rejection_reason/
  // quality_checked_by/at): quantity-split, not a fabricated grade scale.
  // Terminal step of this phase's scope — approved_qty here is NOT posted to
  // Finished Timber Inventory (that belongs to a later phase per the brief's
  // explicit scope boundary).
  await pool.query(`
    create table if not exists quality_inspections (
      id bigserial primary key,
      production_offcut_id bigint not null references production_offcuts(id),
      input_qty int not null check (input_qty > 0),
      approved_qty int not null,
      rejected_qty int not null,
      rejection_reason text,
      inspected_by bigint references app_users(id),
      inspected_at timestamptz not null default now(),
      notes text
    )`);
  await pool.query('create index if not exists idx_quality_inspections_offcut on quality_inspections(production_offcut_id)');

  console.log('[migrate] timber lifecycle phase 1 tables ready (harvest_waste, resolution_records, attachments, production_offcuts, quality_inspections)');
}

// ── Enterprise Timber Lifecycle Integration Program — Phase 2 ────────────────
// Quality, Rejection & Finished Inventory Integration. Extends Phase 1's
// quality_inspections/production_offcuts/resolution_records tables rather
// than replacing them — Accepted quantity now posts to Finished Timber
// Inventory (the same stock_catalog/stock_levels/stock_movements bridge
// Sawmill Phase 1 built), Rejected quantity gets its own first-class
// `rejection_holds` state machine (deliberately NOT reusing production_offcuts
// — the brief is explicit that Production Waste / Recoverable Offcut /
// Rejected Finished Timber / Final Disposal "are not interchangeable").
// Normal (non-offcut) production output is UNTOUCHED — it keeps Sawmill
// Phase 1's original direct-post design, confirmed intentional and
// out of this phase's scope (see completion report Workstream 1 audit).
async function createTimberLifecyclePhase2() {
  // Traceability (Workstream 2): which product/stock item Accepted quantity
  // resolved to and posted against, frozen at inspection time (same freezing
  // precedent as daily_log_items.product_id from Sawmill Phase 1 — a later
  // Product Catalog edit can't retroactively change what a past inspection
  // posted against).
  await pool.query(`alter table quality_inspections add column if not exists product_id bigint references products(id)`);
  await pool.query(`alter table quality_inspections add column if not exists stock_item_id bigint references stock_catalog(id)`);
  await pool.query(`alter table quality_inspections add column if not exists workshop_id bigint references warehouses(id)`);

  // Rejection Hold — Workstream 3. One row per inspection's rejected_qty
  // (only created when rejected_qty > 0). status starts 'pending' and ends
  // at exactly one of: rework / downgraded / returned / resolved (Firewood/
  // Scrap Sale/Disposal/Other, via the same Resolution Engine Phase 1 built).
  await pool.query(`
    create table if not exists rejection_holds (
      id bigserial primary key,
      quality_inspection_id bigint not null references quality_inspections(id),
      production_offcut_id bigint not null references production_offcuts(id),
      quantity int not null check (quantity > 0),
      status text not null default 'pending'
        check (status in ('pending','rework','downgraded','returned','resolved')),
      resolution_id bigint references resolution_records(id),
      rework_offcut_id bigint references production_offcuts(id),
      downgrade_product_id bigint references products(id),
      downgrade_quantity int,
      workshop_id bigint references warehouses(id),
      notes text,
      created_by bigint references app_users(id),
      created_at timestamptz not null default now(),
      resolved_by bigint references app_users(id),
      resolved_at timestamptz
    )`);
  await pool.query('create unique index if not exists idx_rejection_holds_inspection on rejection_holds(quality_inspection_id)');
  await pool.query('create index if not exists idx_rejection_holds_status on rejection_holds(status)');

  // Rework loop (Workstream 5) — a NEW production_offcuts row per rework
  // cycle (never overwrites the original), linked back to the rejection hold
  // that spawned it. Multiple reworks of the same original offcut are
  // naturally preserved as a chain: offcut -> inspection -> hold -> rework
  // -> new offcut -> new inspection -> ... each its own row.
  await pool.query(`alter table production_offcuts add column if not exists rework_of_rejection_id bigint references rejection_holds(id)`);

  // Extend the Phase 1 Resolution Engine's source_type to also accept
  // rejected_timber, per Workstream 4's "reuse the Phase 1 shared Resolution
  // Engine wherever technically appropriate" — no second engine.
  await pool.query(`
    do $$ begin
      if exists (select 1 from pg_constraint where conname = 'resolution_records_source_type_check') then
        alter table resolution_records drop constraint resolution_records_source_type_check;
      end if;
      alter table resolution_records add constraint resolution_records_source_type_check
        check (source_type in ('harvest_waste','production_offcut','rejected_timber'));
    end $$;
  `);

  console.log('[migrate] timber lifecycle phase 2 tables ready (rejection_holds, quality_inspections product/stock linkage, resolution_records extended for rejected_timber)');
}

// ── Enterprise Timber Lifecycle Integration Program — Phase 3 ────────────────
// Finished Timber Distribution, Nyanza Value-Added Production & Showroom.
// Value-Added Quality Inspection reuses the EXACT same quality_inspections/
// rejection_holds/resolution_records tables Phase 2 built for Sawmill QC —
// made polymorphic via a second nullable source FK (value_added_timber_id)
// rather than a duplicate QC engine, per the brief's explicit "reuse the
// Phase 2 architecture, do not create a duplicate QC engine" instruction.
// Downgrade/Return/Firewood/Scrap/Disposal all already operate generically
// through quality_inspection_id's frozen product/stock_item/workshop, so
// they work unchanged for VAT-origin holds; only Rework has source-specific
// logic (branches on which FK is set). Showroom Damage is deliberately a
// separate, lighter-weight table — damaged showroom stock is already LIVE
// posted inventory (unlike a pre-posting rejection hold), so it needs an
// immediate 'out' deduction rather than a pending-admission gate.
async function createTimberLifecyclePhase3() {
  await pool.query(`alter table quality_inspections alter column production_offcut_id drop not null`);
  await pool.query(`alter table rejection_holds alter column production_offcut_id drop not null`);
  // The value_added_timber_id column + one-source-check constraints that used
  // to be created here (on the now-permanently-retired value_added_timber
  // table) were moved into createNyanzaValueAddedProduction() below, which
  // creates them directly under their final name (value_added_production_
  // output_id) — see that function for both the already-migrated-DB rename
  // path and the fresh-install create-fresh path. value_added_timber's own
  // status/rework_of_rejection_id columns are likewise obsolete: those same
  // concepts are already native columns on value_added_production_outputs'
  // own CREATE TABLE definition, not retrofitted afterward.

  await pool.query(`
    create table if not exists showroom_damage_reports (
      id bigserial primary key,
      stock_item_id bigint not null references stock_catalog(id),
      warehouse_id bigint not null references warehouses(id),
      quantity int not null check (quantity > 0),
      reason text not null,
      status text not null default 'pending' check (status in ('pending','resolved')),
      resolution_id bigint references resolution_records(id),
      reported_by bigint references app_users(id),
      created_at timestamptz not null default now(),
      resolved_by bigint references app_users(id),
      resolved_at timestamptz
    )`);
  await pool.query('create index if not exists idx_showroom_damage_status on showroom_damage_reports(status)');

  // 'rejected_timber' already generically means "a rejection_holds row"
  // regardless of Sawmill vs. VAT origin (both are still timber products),
  // so no new source_type is needed there — only showroom_damage is genuinely new.
  await pool.query(`
    do $$ begin
      if exists (select 1 from pg_constraint where conname = 'resolution_records_source_type_check') then
        alter table resolution_records drop constraint resolution_records_source_type_check;
      end if;
      alter table resolution_records add constraint resolution_records_source_type_check
        check (source_type in ('harvest_waste','production_offcut','rejected_timber','showroom_damage'));
    end $$;
  `);

  console.log('[migrate] timber lifecycle phase 3 tables ready (rejection_holds polymorphic for VAT, showroom_damage_reports, resolution_records extended for showroom_damage)');
}

// ── Nyanza Value-Added Production & Finished Products Completion Phase ──────
// value_added_timber only ever supported converting timber into Kiln-dried/
// CCA-treated timber of the SAME size (no distinct output product, no real
// stock consumption — input was only checked against a soft counter of a
// stock_transfer's received_qty, never actually deducted from stock_levels).
// A live audit found ZERO production rows ever recorded and confirmed its
// accept-and-post-to-stock step never actually posted anything (no Product
// Catalog entries existed with the sub_types it looked for) — fully wired,
// never functional. With no data to migrate, this generalizes it into a
// batch + child-lines model that can manufacture a genuinely different
// Product Catalog item, modeled directly on the one existing precedent for
// this shape — Sawmill's production_offcuts (one daily_log parent, many
// independently-QC'd children) — and on quality_inspections/rejection_holds'
// existing polymorphic-sibling-column pattern (already has
// production_offcut_id + value_added_timber_id side by side; this repoints
// that second column at the new outputs table rather than adding a third —
// same shape, same enforcement, no redesign).
async function createNyanzaValueAddedProduction() {
  await pool.query(`
    create table if not exists value_added_production_batches (
      id bigserial primary key,
      workshop_id bigint references warehouses(id),
      batch_date date not null,
      production_type text,
      customer_id bigint references customers(id),
      order_reference text,
      operator text,
      supervisor text,
      start_time timestamptz,
      end_time timestamptz,
      downtime_minutes int,
      notes text,
      created_by bigint references app_users(id),
      created_at timestamptz not null default now(),
      pending_deletion boolean not null default false,
      deleted_at timestamptz,
      deleted_by bigint references app_users(id),
      deletion_reason text
    )`);
  await pool.query('create index if not exists idx_vap_batches_workshop on value_added_production_batches(workshop_id) where deleted_at is null');
  await pool.query('create index if not exists idx_vap_batches_date on value_added_production_batches(batch_date desc)');

  // Universal stock_item_id key (not a Product-Catalog-only key) — an input
  // can be finished timber (products.stock_item_id-bridged) or a raw
  // consumable already tracked in stock_catalog (e.g. nails), with zero
  // extra schema work either way, since stock_levels/stock_movements/
  // stock_transfers already all key off stock_catalog.id generically.
  await pool.query(`
    create table if not exists value_added_production_inputs (
      id bigserial primary key,
      batch_id bigint not null references value_added_production_batches(id),
      stock_item_id bigint not null references stock_catalog(id),
      quantity int not null check (quantity > 0),
      created_at timestamptz not null default now()
    )`);
  await pool.query('create index if not exists idx_vap_inputs_batch on value_added_production_inputs(batch_id)');

  // One row per output line — a batch can produce multiple distinct output
  // products (e.g. pallets + recovered offcut timber from one run), each
  // independently going through the existing QC/rejection/rework pipeline,
  // mirroring how one daily_log already gets multiple production_offcuts rows.
  await pool.query(`
    create table if not exists value_added_production_outputs (
      id bigserial primary key,
      batch_id bigint not null references value_added_production_batches(id),
      output_product_id bigint not null references products(id),
      quantity int not null check (quantity > 0),
      status text not null default 'pending_qc' check (status in ('pending_qc','inspected')),
      rework_of_rejection_id bigint references rejection_holds(id),
      workshop_id bigint references warehouses(id),
      created_by bigint references app_users(id),
      created_at timestamptz not null default now()
    )`);
  await pool.query('create index if not exists idx_vap_outputs_batch on value_added_production_outputs(batch_id)');
  await pool.query('create index if not exists idx_vap_outputs_status on value_added_production_outputs(status)');

  // Repoint the existing VAT sibling columns at the new outputs table.
  // value_added_timber has zero live rows (confirmed via live audit before
  // this phase), so this is a clean rename/repoint, not a data migration —
  // the CHECK constraints reference columns by attnum, not name, so they
  // keep working unchanged across the rename; only the FK target needs
  // dropping and re-adding.
  await pool.query(`
    do $$ begin
      if exists (select 1 from information_schema.columns
                 where table_name='quality_inspections' and column_name='value_added_timber_id') then
        alter table quality_inspections rename column value_added_timber_id to value_added_production_output_id;
      elsif not exists (select 1 from information_schema.columns
                 where table_name='quality_inspections' and column_name='value_added_production_output_id') then
        -- Fresh install — the old value_added_timber_id column was never
        -- created (value_added_timber itself no longer exists in schema.sql),
        -- so add the final column directly instead of renaming into it.
        alter table quality_inspections add column value_added_production_output_id bigint;
      end if;
    end $$;
  `);
  await pool.query(`alter table quality_inspections drop constraint if exists quality_inspections_value_added_timber_id_fkey`);
  await pool.query(`
    do $$ begin
      if not exists (select 1 from pg_constraint where conname = 'quality_inspections_vap_output_id_fkey') then
        alter table quality_inspections add constraint quality_inspections_vap_output_id_fkey
          foreign key (value_added_production_output_id) references value_added_production_outputs(id);
      end if;
    end $$;
  `);
  await pool.query(`drop index if exists idx_quality_inspections_vat`);
  await pool.query('create index if not exists idx_quality_inspections_vap_output on quality_inspections(value_added_production_output_id)');
  // One-source-per-row guard, moved here from createTimberLifecyclePhase3
  // (which used to create it under the old column name against the now-
  // dropped value_added_timber table). On an already-migrated DB the
  // original 'quality_inspections_one_source_check' constraint still exists
  // and still enforces correctly (Postgres CHECK constraints track columns
  // by attnum, not name, so it survived the rename above unaffected) — this
  // only fires for a fresh install that never had it.
  await pool.query(`
    do $$ begin
      if not exists (select 1 from pg_constraint where conname in
          ('quality_inspections_one_source_check', 'quality_inspections_vap_one_source_check')) then
        alter table quality_inspections add constraint quality_inspections_vap_one_source_check
          check (num_nonnulls(production_offcut_id, value_added_production_output_id) = 1);
      end if;
    end $$;
  `);

  await pool.query(`
    do $$ begin
      if exists (select 1 from information_schema.columns
                 where table_name='rejection_holds' and column_name='value_added_timber_id') then
        alter table rejection_holds rename column value_added_timber_id to value_added_production_output_id;
      elsif not exists (select 1 from information_schema.columns
                 where table_name='rejection_holds' and column_name='value_added_production_output_id') then
        alter table rejection_holds add column value_added_production_output_id bigint;
      end if;
      if exists (select 1 from information_schema.columns
                 where table_name='rejection_holds' and column_name='rework_value_added_timber_id') then
        alter table rejection_holds rename column rework_value_added_timber_id to rework_value_added_production_output_id;
      elsif not exists (select 1 from information_schema.columns
                 where table_name='rejection_holds' and column_name='rework_value_added_production_output_id') then
        alter table rejection_holds add column rework_value_added_production_output_id bigint;
      end if;
    end $$;
  `);
  await pool.query(`alter table rejection_holds drop constraint if exists rejection_holds_value_added_timber_id_fkey`);
  await pool.query(`alter table rejection_holds drop constraint if exists rejection_holds_rework_value_added_timber_id_fkey`);
  await pool.query(`
    do $$ begin
      if not exists (select 1 from pg_constraint where conname = 'rejection_holds_vap_output_id_fkey') then
        alter table rejection_holds add constraint rejection_holds_vap_output_id_fkey
          foreign key (value_added_production_output_id) references value_added_production_outputs(id);
      end if;
      if not exists (select 1 from pg_constraint where conname = 'rejection_holds_rework_vap_output_id_fkey') then
        alter table rejection_holds add constraint rejection_holds_rework_vap_output_id_fkey
          foreign key (rework_value_added_production_output_id) references value_added_production_outputs(id);
      end if;
    end $$;
  `);
  await pool.query(`
    do $$ begin
      if not exists (select 1 from pg_constraint where conname in
          ('rejection_holds_one_source_check', 'rejection_holds_vap_one_source_check')) then
        alter table rejection_holds add constraint rejection_holds_vap_one_source_check
          check (num_nonnulls(production_offcut_id, value_added_production_output_id) = 1);
      end if;
    end $$;
  `);

  // value_added_timber itself is now fully superseded — drop it (zero live
  // rows; every FK that pointed at it has already been repointed above).
  await pool.query(`drop table if exists value_added_timber cascade`);

  // Permission key rename, same array-rewrite pattern as
  // grantStockTransfersToNyanzaShowroom, applied to whichever roles
  // currently hold the old key. updateRolePermissions() no longer grants the
  // old 'value-added-timber' key (fixed alongside this migration bug — it
  // used to keep reintroducing the stale key on every run, which this loop
  // would then "rename" into a duplicate 'value-added-production' entry
  // since the correct key was usually already present too), so this now
  // only matters for roles that still carry the old key from before that
  // fix — de-duplicates via Set in case both keys are present.
  const { rows: roleRows } = await pool.query(
    `select role, permissions from role_definitions where permissions::text like '%value-added-timber%'`
  );
  let renamed = 0;
  for (const row of roleRows) {
    const existing = Array.isArray(row.permissions) ? row.permissions : [];
    if (!existing.includes('value-added-timber')) continue;
    const newPerms = Array.from(new Set(existing.map(p => p === 'value-added-timber' ? 'value-added-production' : p)));
    await pool.query('update role_definitions set permissions=$1 where role=$2', [JSON.stringify(newPerms), row.role]);
    renamed++;
  }

  // mv_stock_summary / mv_stock_by_workshop's own "drop and recreate so
  // formula updates take effect" pattern (see their original creation,
  // above) applied again here for the new source table/columns. Semantics
  // preserved exactly: sum ALL output quantity regardless of QC status
  // (matching value_added_timber.num_timber's own original behavior,
  // which was never adjusted by QC either), matched by products.sub_type
  // instead of the old free-text type_value_added string.
  await pool.query(`drop materialized view if exists mv_stock_summary cascade`);
  await pool.query(`
    create materialized view mv_stock_summary as
    with produced as (
      select coalesce(sum(timber_units),0)::int as timber,
             coalesce(sum(poles_units),0)::int  as poles
      from daily_logs where deleted_at is null
    ),
    value_added as (
      select coalesce(sum(case when pr.sub_type='Kiln-dried'  then vao.quantity else 0 end),0)::int as kiln_dried,
             coalesce(sum(case when pr.sub_type='CCA-treated' then vao.quantity else 0 end),0)::int as cca_treated
      from value_added_production_outputs vao
      join value_added_production_batches vab on vab.id = vao.batch_id and vab.deleted_at is null
      join products pr on pr.id = vao.output_product_id
    ),
    sold as (
      select
        coalesce(sum(case when product_type='Timber' then quantity - coalesce(qty_returned_to_stock,0) else 0 end),0)::int as timber,
        coalesce(sum(case when product_type='Timber' and coalesce(product_sub_type,'')='Kiln-dried'  then quantity - coalesce(qty_returned_to_stock,0) else 0 end),0)::int as kiln_dried,
        coalesce(sum(case when product_type='Timber' and coalesce(product_sub_type,'')='CCA-treated' then quantity - coalesce(qty_returned_to_stock,0) else 0 end),0)::int as cca_treated,
        coalesce(sum(case when product_type='Timber' and coalesce(product_sub_type,'')='Untreated'   then quantity - coalesce(qty_returned_to_stock,0) else 0 end),0)::int as untreated,
        coalesce(sum(case when product_type='Poles'  then quantity - coalesce(qty_returned_to_stock,0) else 0 end),0)::int as poles
      from sales_orders where deleted_at is null and status != 'Cancelled'
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

  await pool.query(`drop materialized view if exists mv_stock_by_workshop cascade`);
  await pool.query(`
    create materialized view mv_stock_by_workshop as
    with produced as (
      select workshop_id,
             coalesce(sum(timber_units),0)::int as timber,
             coalesce(sum(poles_units),0)::int  as poles
      from daily_logs where deleted_at is null
      group by workshop_id
    ),
    value_added as (
      select vao.workshop_id,
             coalesce(sum(case when pr.sub_type='Kiln-dried'  then vao.quantity else 0 end),0)::int as kiln_dried,
             coalesce(sum(case when pr.sub_type='CCA-treated' then vao.quantity else 0 end),0)::int as cca_treated
      from value_added_production_outputs vao
      join value_added_production_batches vab on vab.id = vao.batch_id and vab.deleted_at is null
      join products pr on pr.id = vao.output_product_id
      group by vao.workshop_id
    ),
    sold as (
      select workshop_id,
             coalesce(sum(case when product_type='Timber' then quantity - coalesce(qty_returned_to_stock,0) else 0 end),0)::int as timber,
             coalesce(sum(case when product_type='Timber' and coalesce(product_sub_type,'')='Kiln-dried'  then quantity - coalesce(qty_returned_to_stock,0) else 0 end),0)::int as kiln_dried,
             coalesce(sum(case when product_type='Timber' and coalesce(product_sub_type,'')='CCA-treated' then quantity - coalesce(qty_returned_to_stock,0) else 0 end),0)::int as cca_treated,
             coalesce(sum(case when product_type='Timber' and coalesce(product_sub_type,'')='Untreated'   then quantity - coalesce(qty_returned_to_stock,0) else 0 end),0)::int as untreated,
             coalesce(sum(case when product_type='Poles'  then quantity - coalesce(qty_returned_to_stock,0) else 0 end),0)::int as poles
      from sales_orders where deleted_at is null and status != 'Cancelled'
      group by workshop_id
    )
    select
      p.workshop_id,
      p.timber                                                                         as timber_produced,
      p.poles                                                                          as poles_produced,
      coalesce(va.kiln_dried,  0)                                                      as kiln_dried_produced,
      coalesce(va.cca_treated, 0)                                                      as cca_treated_produced,
      greatest(p.timber - coalesce(va.kiln_dried,0) - coalesce(va.cca_treated,0), 0)  as untreated_produced,
      coalesce(s.timber,     0) as timber_sold,      coalesce(s.poles,      0) as poles_sold,
      coalesce(s.kiln_dried, 0) as kiln_dried_sold,  coalesce(s.cca_treated,0) as cca_treated_sold,
      coalesce(s.untreated,  0) as untreated_sold,
      (p.timber - coalesce(s.timber,    0))                                            as timber_stock,
      (p.poles  - coalesce(s.poles,     0))                                            as poles_stock,
      (coalesce(va.kiln_dried, 0)  - coalesce(s.kiln_dried, 0))                       as kiln_dried_stock,
      (coalesce(va.cca_treated,0)  - coalesce(s.cca_treated,0))                       as cca_treated_stock,
      (greatest(p.timber - coalesce(va.kiln_dried,0) - coalesce(va.cca_treated,0), 0)
        - coalesce(s.untreated,0))                                                     as untreated_stock
    from produced p
    left join value_added va on va.workshop_id is not distinct from p.workshop_id
    left join sold        s  on s.workshop_id  is not distinct from p.workshop_id
  `);

  console.log(`[migrate] Nyanza Value-Added Production ready (value_added_timber replaced by batches/inputs/outputs, ${renamed} role(s) permission-renamed, mv_stock_summary/mv_stock_by_workshop repointed)`);
}

// ── Pole Production Phase 1 ───────────────────────────────────────────────────
// Unlike Timber, poles start from externally PURCHASED raw logs (via the
// existing poles_purchase_requests -> poles_deliveries pipeline, left
// completely untouched here — a live, working, workshop-isolated system with
// real history; ripping it out for the generic Requisition/PO pipeline is a
// major undertaking documented as a business decision, not done in this
// phase). What was genuinely missing: any way to record WHAT specific pole
// products a production run actually made (the prior mechanism was a bare
// poles_units/poles_waste count on daily_logs, with no per-spec breakdown, no
// QC linkage, and no real inventory posting). This phase adds a batch+output
// model directly mirroring value_added_production_batches/outputs (same
// shape, same reuse of the polymorphic quality_inspections/rejection_holds
// pattern — a THIRD sibling column added the exact same way the second one
// was), so poles get real per-SKU Finished Pole Inventory and full access to
// the existing Rework/Downgrade/Return-to-Inventory/Firewood/Scrap/Disposal
// resolution paths for the first time. The legacy daily_logs.poles_units
// entry path is NOT removed (many existing dashboards/reports read it, and
// real users use it daily) — both paths draw from the same pooled raw-log
// balance so neither can over-consume past what the other already used.
async function createPoleProductionPhase1() {
  await pool.query(`
    create table if not exists pole_production_batches (
      id bigserial primary key,
      workshop_id bigint references warehouses(id),
      batch_date date not null,
      operator text,
      supervisor text,
      machine_id bigint references machines(id),
      start_time timestamptz,
      end_time timestamptz,
      downtime_minutes int,
      downtime_reason text,
      input_raw_log_qty int not null check (input_raw_log_qty > 0),
      notes text,
      created_by bigint references app_users(id),
      created_at timestamptz not null default now(),
      pending_deletion boolean not null default false,
      deleted_at timestamptz,
      deleted_by bigint references app_users(id),
      deletion_reason text
    )`);
  await pool.query('create index if not exists idx_pole_batches_workshop on pole_production_batches(workshop_id) where deleted_at is null');
  await pool.query('create index if not exists idx_pole_batches_date on pole_production_batches(batch_date desc)');

  await pool.query(`
    create table if not exists pole_production_outputs (
      id bigserial primary key,
      batch_id bigint not null references pole_production_batches(id),
      output_product_id bigint not null references products(id),
      quantity int not null check (quantity > 0),
      status text not null default 'pending_qc' check (status in ('pending_qc','inspected')),
      rework_of_rejection_id bigint references rejection_holds(id),
      workshop_id bigint references warehouses(id),
      created_by bigint references app_users(id),
      created_at timestamptz not null default now()
    )`);
  await pool.query('create index if not exists idx_pole_outputs_batch on pole_production_outputs(batch_id)');
  await pool.query('create index if not exists idx_pole_outputs_status on pole_production_outputs(status)');

  // Third polymorphic source column on the shared QC/rejection engine,
  // added the exact same way value_added_production_output_id was (see
  // createNyanzaValueAddedProduction above) — extends the one-source-per-row
  // CHECK constraints from 2-way to 3-way rather than replacing them.
  await pool.query(`alter table quality_inspections add column if not exists pole_production_output_id bigint references pole_production_outputs(id)`);
  await pool.query(`alter table quality_inspections drop constraint if exists quality_inspections_one_source_check`);
  await pool.query(`alter table quality_inspections drop constraint if exists quality_inspections_vap_one_source_check`);
  await pool.query(`
    do $$ begin
      if not exists (select 1 from pg_constraint where conname = 'quality_inspections_source_check') then
        alter table quality_inspections add constraint quality_inspections_source_check
          check (num_nonnulls(production_offcut_id, value_added_production_output_id, pole_production_output_id) = 1);
      end if;
    end $$;
  `);
  await pool.query('create index if not exists idx_quality_inspections_pole_output on quality_inspections(pole_production_output_id)');

  await pool.query(`alter table rejection_holds add column if not exists pole_production_output_id bigint references pole_production_outputs(id)`);
  await pool.query(`alter table rejection_holds add column if not exists rework_pole_production_output_id bigint references pole_production_outputs(id)`);
  await pool.query(`alter table rejection_holds drop constraint if exists rejection_holds_one_source_check`);
  await pool.query(`alter table rejection_holds drop constraint if exists rejection_holds_vap_one_source_check`);
  await pool.query(`
    do $$ begin
      if not exists (select 1 from pg_constraint where conname = 'rejection_holds_source_check') then
        alter table rejection_holds add constraint rejection_holds_source_check
          check (num_nonnulls(production_offcut_id, value_added_production_output_id, pole_production_output_id) = 1);
      end if;
    end $$;
  `);
  await pool.query('create index if not exists idx_rejection_holds_pole_output on rejection_holds(pole_production_output_id)');

  // 'rejected_timber' already generically covers any rejection_holds row
  // regardless of origin (Sawmill/VAT/now Poles) — no new resolution_records
  // source_type needed, confirmed against the exact same reasoning already
  // applied when VAT-origin holds were added in Timber Lifecycle Phase 3.

  console.log('[migrate] Pole Production Phase 1 ready (pole_production_batches/outputs, quality_inspections/rejection_holds extended to a third polymorphic source)');
}

// ── Pole Production Phase 2 — Purchased Finished Poles ───────────────────────
// Generic procurementGoodsReceiptCreate posts every line straight to sellable
// stock_levels the instant it's keyed in (audited — see completion report
// §2), with zero category awareness anywhere in the function. Rather than
// touch that shared path for every procurement category, this adds a single
// opt-in gate: qc_status on procurement_goods_receipt_items, defaulting to
// 'not_required' so every existing/other-category row (and every future
// non-Poles receipt) takes the exact same immediate-post code path it always
// has. Only lines whose stock_catalog.category = 'Finished Poles' get flipped
// to 'pending_qc' and have their stock posting deferred — the same
// "decouple output creation from stock posting until inspection" shape
// pole_production_outputs.status already established for manufactured poles.
async function createPoleProductionPhase2() {
  await pool.query(`
    alter table procurement_goods_receipt_items
      add column if not exists qc_status text not null default 'not_required'
        check (qc_status in ('not_required','pending_qc','inspected'))
  `);
  await pool.query(`create index if not exists idx_gr_items_qc_status on procurement_goods_receipt_items(qc_status) where qc_status = 'pending_qc'`);

  // Fourth polymorphic source column on the shared QC/rejection engine, added
  // the exact same way pole_production_output_id (the third) was added in
  // createPoleProductionPhase1() above — extends the one-source-per-row CHECK
  // constraints from 3-way to 4-way rather than replacing their shape.
  await pool.query(`alter table quality_inspections add column if not exists procurement_goods_receipt_item_id bigint references procurement_goods_receipt_items(id)`);
  await pool.query(`alter table quality_inspections drop constraint if exists quality_inspections_source_check`);
  await pool.query(`
    do $$ begin
      if not exists (select 1 from pg_constraint where conname = 'quality_inspections_source_check') then
        alter table quality_inspections add constraint quality_inspections_source_check
          check (num_nonnulls(production_offcut_id, value_added_production_output_id, pole_production_output_id, procurement_goods_receipt_item_id) = 1);
      end if;
    end $$;
  `);
  await pool.query('create index if not exists idx_quality_inspections_gr_item on quality_inspections(procurement_goods_receipt_item_id)');

  await pool.query(`alter table rejection_holds add column if not exists procurement_goods_receipt_item_id bigint references procurement_goods_receipt_items(id)`);
  await pool.query(`alter table rejection_holds drop constraint if exists rejection_holds_source_check`);
  await pool.query(`
    do $$ begin
      if not exists (select 1 from pg_constraint where conname = 'rejection_holds_source_check') then
        alter table rejection_holds add constraint rejection_holds_source_check
          check (num_nonnulls(production_offcut_id, value_added_production_output_id, pole_production_output_id, procurement_goods_receipt_item_id) = 1);
      end if;
    end $$;
  `);
  await pool.query('create index if not exists idx_rejection_holds_gr_item on rejection_holds(procurement_goods_receipt_item_id)');

  // No rework_procurement_goods_receipt_item_id column — Priority 4's own
  // brief permits documenting non-applicability instead of inventing
  // behavior. A purchased finished pole arrives as a completed item with no
  // in-house production batch/process to re-enter; rejectionResolveRework
  // (data.js) now returns an explicit error for this source instead of
  // silently falling into the pole_production_outputs branch. Downgrade,
  // Return to Inventory, and the Resolution Engine's Firewood/Scrap/Disposal
  // destinations all still work — they operate off frozen quality_inspections/
  // rejection_holds fields only, never the source-specific FK.

  // 'rejected_timber' already generically covers any rejection_holds row
  // regardless of origin (Sawmill/VAT/manufactured Poles/now purchased
  // Poles) — no new resolution_records source_type needed, same reasoning
  // already applied twice before (VAT in Timber Lifecycle Phase 3, Poles in
  // Pole Production Phase 1).

  console.log('[migrate] Pole Production Phase 2 ready (procurement_goods_receipt_items.qc_status gate for Purchased Finished Poles, quality_inspections/rejection_holds extended to a fourth polymorphic source)');
}

// Procurement Management — new roles. Same two-step pattern as
// seedNewLogisticsRoles/updateRolePermissions: insert the role_definitions row
// (empty permissions) here, grant real pages in grantProcurementPermissions()
// below, which must run after this in migrate()'s call order.
async function seedProcurementRoles() {
  const newRoles = [
    {
      role: 'procurement-officer',
      label: 'Procurement Officer',
      description: 'Manages suppliers, RFQs, and purchase orders. Reviews requisitions after department approval and coordinates goods receipt and invoice matching.',
    },
    {
      role: 'procurement-manager',
      label: 'Procurement Manager',
      description: 'Oversees the procurement team. Approves purchase requisitions at the procurement review stage and has full visibility into suppliers, POs, and spend.',
    },
    {
      role: 'department-manager',
      label: 'Department Manager',
      description: 'Approves departmental purchase requisitions after supervisor sign-off, before they proceed to procurement review.',
    },
  ];

  for (const r of newRoles) {
    const { rows } = await pool.query('select 1 from role_definitions where role=$1', [r.role]);
    if (!rows.length) {
      await pool.query(
        `insert into role_definitions(role, label, description, responsibilities, permissions)
         values ($1,$2,$3,$4,$5)`,
        [r.role, r.label, r.description, JSON.stringify([]), JSON.stringify([])]
      );
    }
  }
  console.log('[migrate] procurement roles seeded');
}

async function grantProcurementPermissions() {
  const PROCUREMENT_PAGES = [
    'procurement-dashboard', 'procurement-suppliers', 'procurement-requisitions',
    'procurement-rfq', 'procurement-orders', 'procurement-goods-receipt',
    'procurement-invoices', 'procurement-reports',
  ];

  async function grant(role, pages) {
    const { rows } = await pool.query('select permissions from role_definitions where role=$1', [role]);
    if (!rows.length) return;
    const existing = Array.isArray(rows[0].permissions) ? rows[0].permissions : [];
    const newPerms = Array.from(new Set([...existing, ...pages]));
    if (newPerms.length === existing.length) return;
    await pool.query('update role_definitions set permissions=$1, updated_at=now() where role=$2',
      [JSON.stringify(newPerms), role]);
  }

  // Any employee can submit a purchase requisition — same "everyone gets the
  // request page" convention material-requests already uses — so grant the
  // dashboard + requisitions pages across every existing role rather than
  // hand-listing them.
  const { rows: allRoles } = await pool.query('select role from role_definitions');
  for (const r of allRoles) {
    await grant(r.role, ['procurement-dashboard', 'procurement-requisitions']);
  }

  // Full working set for the roles that actually run the module day to day.
  const FULL_ACCESS_ROLES = ['admin', 'ceo', 'procurement-officer', 'procurement-manager'];
  for (const role of FULL_ACCESS_ROLES) {
    await grant(role, PROCUREMENT_PAGES);
  }

  // Extra pages for the other approval-chain participants beyond the
  // baseline dashboard+requisitions every role already got above.
  await grant('supervisor', ['procurement-requisitions']);
  await grant('department-manager', ['procurement-requisitions']);
  await grant('finance', ['procurement-requisitions', 'procurement-invoices', 'procurement-reports']);
  await grant('storekeeper', ['procurement-goods-receipt']);

  // Procurement Settings (CEO approval threshold) — Phase 2B Priority 1.
  // Deliberately NOT part of PROCUREMENT_PAGES above: procurement-officer/
  // procurement-manager run the module day to day but must not be able to
  // change the approval threshold — only admin/ceo, per the same rule the
  // backend's procurementConfigUpdate already enforces.
  await grant('admin', ['procurement-settings']);
  await grant('ceo', ['procurement-settings']);

  // Supplier governance (activate/deactivate/blacklist/restore/delete) —
  // Phase 3B item 3, "Permission Cleanup". Deliberately NOT part of
  // PROCUREMENT_PAGES/FULL_ACCESS_ROLES above, and deliberately excludes
  // procurement-officer: this replaces the hardcoded ['admin','ceo',
  // 'procurement-manager'] role array that used to live inside
  // procurementSupplierToggleBlacklist with the same set of roles, now
  // expressed through the centralized role_definitions permission system
  // instead of a JS array — procurement-officer keeps full supplier
  // CRUD/view/contacts/contracts access via 'procurement-suppliers' above,
  // just not the governance actions.
  await grant('admin', ['procurement-suppliers-governance']);
  await grant('ceo', ['procurement-suppliers-governance']);
  await grant('procurement-manager', ['procurement-suppliers-governance']);

  console.log('[migrate] procurement page permissions updated');
}

async function seedPerformanceKpis() {
  const kpis = [
    // Sales
    { kpi_key: 'sales-revenue-month',    name: 'Monthly Revenue',            department: 'Sales',      module: 'sales',      owner: 'Sales Manager',    description: 'Total sales revenue created this month',                  target_value: 50000000, unit: 'ZMW', direction: 'higher_better', review_freq: 'monthly'  },
    { kpi_key: 'sales-orders-month',     name: 'Monthly Sales Orders',       department: 'Sales',      module: 'sales',      owner: 'Sales Manager',    description: 'Number of sales orders created this month',               target_value: 50,       unit: 'orders', direction: 'higher_better', review_freq: 'monthly' },
    { kpi_key: 'sales-delivery-rate',    name: 'Delivery Completion Rate',   department: 'Sales',      module: 'deliveries', owner: 'Logistics Manager',description: '% of delivery orders with confirmed delivery this month', target_value: 85,       unit: '%',   direction: 'higher_better', review_freq: 'monthly'  },
    // Harvest
    { kpi_key: 'harvest-trees-month',    name: 'Monthly Trees Felled',       department: 'Harvest',    module: 'harvest',    owner: 'Harvesting Leader',description: 'Total trees felled this month across all compartments',   target_value: 5000,     unit: 'trees', direction: 'higher_better', review_freq: 'monthly' },
    { kpi_key: 'harvest-logs-month',     name: 'Monthly Logs Produced',      department: 'Harvest',    module: 'harvest',    owner: 'Harvesting Leader',description: 'Total logs (crosscut + handrolled) produced this month',  target_value: 3000,     unit: 'logs', direction: 'higher_better', review_freq: 'monthly'  },
    { kpi_key: 'harvest-active-compts',  name: 'Active Compartments',        department: 'Harvest',    module: 'compartments',owner: 'Harvesting Leader',description: 'Number of compartments currently being harvested',        target_value: 5,        unit: 'compts', direction: 'higher_better', review_freq: 'monthly' },
    // Workshop
    { kpi_key: 'workshop-timber-month',  name: 'Monthly Timber Production',  department: 'Workshop',   module: 'daily-timber',owner: 'Sawmill Leader',   description: 'Total timber units produced this month',                  target_value: 2000,     unit: 'units', direction: 'higher_better', review_freq: 'monthly' },
    { kpi_key: 'workshop-poles-month',   name: 'Monthly Poles Production',   department: 'Workshop',   module: 'daily-poles', owner: 'Poles Leader',     description: 'Total poles units produced this month',                   target_value: 1000,     unit: 'units', direction: 'higher_better', review_freq: 'monthly' },
    { kpi_key: 'workshop-machine-util',  name: 'Machine Utilization Rate',   department: 'Workshop',   module: 'machine-logs',owner: 'Operations',       description: '% of machine capacity used (avg over last 30 days)',     target_value: 75,       unit: '%',   direction: 'higher_better', review_freq: 'weekly'   },
    // Logistics
    { kpi_key: 'logistics-stock-avail',  name: 'Stock Availability Rate',    department: 'Logistics',  module: 'stock-items', owner: 'Storekeeper',      description: '% of stock items at or above minimum stock level',        target_value: 85,       unit: '%',   direction: 'higher_better', review_freq: 'weekly'   },
    { kpi_key: 'logistics-mat-fulfil',   name: 'Material Request Fulfillment',department: 'Logistics', module: 'material-requests',owner: 'Storekeeper', description: '% of material requests approved within 30 days',          target_value: 80,       unit: '%',   direction: 'higher_better', review_freq: 'monthly'  },
    { kpi_key: 'logistics-transfer-rate',name: 'Stock Transfer Completion',  department: 'Logistics',  module: 'stock-transfers',owner: 'Storekeeper',   description: '% of stock transfers received or dispatched',             target_value: 80,       unit: '%',   direction: 'higher_better', review_freq: 'monthly'  },
    // HR
    { kpi_key: 'hr-casual-pending',      name: 'Pending Casual Requests',    department: 'HR',         module: 'casual-requests',owner: 'Operations',    description: 'Number of unanswered casual labour requests (lower better)',target_value: 5,       unit: 'requests', direction: 'lower_better', review_freq: 'weekly'   },
    { kpi_key: 'hr-casual-active',       name: 'Active Casual Workers',      department: 'HR',         module: 'casuals',    owner: 'Operations',       description: 'Number of casual workers currently active on the system',  target_value: 20,       unit: 'workers', direction: 'higher_better', review_freq: 'monthly' },
    // Security / Governance
    { kpi_key: 'security-sla-compliance',name: 'Approval SLA Compliance',   department: 'Security',   module: 'secgov',     owner: 'Admin',            description: '% of approval requests resolved within 48 hours',        target_value: 90,       unit: '%',   direction: 'higher_better', review_freq: 'monthly'  },
    { kpi_key: 'security-failed-logins', name: 'Failed Logins (24h)',        department: 'Security',   module: 'audit',      owner: 'Admin',            description: 'Number of failed login attempts in last 24 hours (lower better)', target_value: 3, unit: 'attempts', direction: 'lower_better', review_freq: 'daily'  },
    // Operations / Machines
    { kpi_key: 'ops-machine-avail',      name: 'Machine Availability Rate',  department: 'Operations', module: 'machines',   owner: 'Operations',       description: '% of active machines in Available or In Use status',     target_value: 80,       unit: '%',   direction: 'higher_better', review_freq: 'weekly'   },
    { kpi_key: 'ops-maintenance-compl',  name: 'Maintenance Compliance',     department: 'Operations', module: 'machines',   owner: 'Operations',       description: '% of active machines with no overdue scheduled maintenance', target_value: 90,    unit: '%',   direction: 'higher_better', review_freq: 'monthly'  },
    // Finance
    { kpi_key: 'finance-fuel-efficiency',name: 'Fuel Efficiency',            department: 'Finance',    module: 'machine-fuel',owner: 'Operations',      description: 'Production units per litre of fuel consumed (last 30d)', target_value: 0.5,      unit: 'u/L', direction: 'higher_better', review_freq: 'monthly'  },
    { kpi_key: 'finance-pending-approv', name: 'Pending Approvals',          department: 'Finance',    module: 'secgov',     owner: 'Admin',            description: 'Total pending edit + deletion approval requests (lower better)', target_value: 10, unit: 'items', direction: 'lower_better', review_freq: 'weekly'  },
  ];

  for (const k of kpis) {
    await pool.query(`
      INSERT INTO performance_kpis (kpi_key,name,department,module,owner,description,target_value,unit,direction,review_freq)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      ON CONFLICT (kpi_key) DO NOTHING
    `, [k.kpi_key,k.name,k.department,k.module,k.owner,k.description,k.target_value,k.unit,k.direction,k.review_freq]);
  }
  console.log('[migrate] performance KPIs seeded');
}

// ── HR Enterprise Phase 2 — Attendance ────────────────────────────────────────
// Phase 1 audited the whole repo and confirmed Attendance did not exist at
// any layer. This is a genuinely new entity, not an extension of an existing
// one — reuses app_users/casuals as the two person references (same
// num_nonnulls(...)=1 polymorphic-sibling pattern already established by
// quality_inspections/rejection_holds for production_offcut_id vs
// value_added_production_output_id) rather than creating a third employee
// registry. Statuses are exactly the 6 the brief itself specified — no
// invented HR states.
async function createAttendanceTables() {
  await pool.query(`
    create table if not exists attendance (
      id                bigserial primary key,
      attendance_date   date not null,
      workshop_id       bigint references warehouses(id),
      user_id           bigint references app_users(id),
      casual_id         bigint references casuals(id),
      status            text not null default 'Present',
      check_in          timestamptz,
      check_out         timestamptz,
      notes             text,
      created_by        bigint references app_users(id),
      created_at        timestamptz not null default now(),
      updated_by        bigint references app_users(id),
      updated_at        timestamptz,
      deleted_at        timestamptz,
      deleted_by        bigint references app_users(id),
      constraint attendance_person_check check (num_nonnulls(user_id, casual_id) = 1),
      constraint attendance_status_check check (status in ('Present','Absent','Late','Half Day','Leave','Off Day')),
      constraint attendance_checkout_after_checkin check (check_out is null or check_in is null or check_out > check_in)
    )
  `);
  // Priority 16 — duplicate attendance prevention: one record per person per
  // day, enforced at the database level (not just in application code).
  await pool.query(`
    create unique index if not exists uidx_attendance_user_date
      on attendance(user_id, attendance_date) where user_id is not null and deleted_at is null
  `);
  await pool.query(`
    create unique index if not exists uidx_attendance_casual_date
      on attendance(casual_id, attendance_date) where casual_id is not null and deleted_at is null
  `);
  await pool.query(`create index if not exists idx_attendance_workshop_date on attendance(workshop_id, attendance_date desc) where deleted_at is null`);
  await pool.query(`create index if not exists idx_attendance_date on attendance(attendance_date desc) where deleted_at is null`);
  console.log('[migrate] attendance table ready');
}

// Reuses the exact same role set Phase 1 established (and got explicit
// approval to widen) for the Casuals registry — admin/ceo/operations/
// supervisor — rather than inventing separate attendance-view/create/
// update/delete/review permissions. This codebase's permission model is
// page-based (one page id per module: 'casuals', 'sales', 'customers', …),
// never per-action, so a single 'attendance' page id matches the established
// convention exactly.
async function grantAttendancePermission() {
  const { rows } = await pool.query(
    `select role, permissions from role_definitions where role in ('admin','ceo','operations','supervisor')`
  );
  let updated = 0;
  for (const row of rows) {
    const existing = Array.isArray(row.permissions) ? row.permissions : [];
    if (existing.includes('attendance')) continue;
    const newPerms = [...existing, 'attendance'];
    await pool.query('update role_definitions set permissions=$1 where role=$2', [JSON.stringify(newPerms), row.role]);
    updated++;
  }
  console.log(`[migrate] attendance permission granted to ${updated} role(s)`);
}

// Payroll Enterprise Phase 2 — Discovery Phase 1 concluded no compensation
// model exists anywhere (zero rate/salary field on app_users, casuals'
// salary_per_action is stored-only) and that the codebase has no dedicated
// employee-identity or Finance/accounting infrastructure to build on. Rather
// than guess a compensation model (hourly vs daily vs piece-rate — Phase 1's
// PR-01/PR-03 explicitly found no evidence for any single one), payroll_rates
// stores a human-entered rate_type + rate_amount per person, append-only
// (each change inserts a new row and deactivates the previous one via the
// partial unique index below) so the current rate is always derivable AND a
// full rate history exists for free, without a separate effective-dated
// schema. Polymorphic user_id/casual_id follows the exact
// num_nonnulls(...)=1 pattern the `attendance` table already established —
// same reasoning: one person, two possible identity tables, never both.
async function createPayrollTables() {
  await pool.query(`
    create table if not exists payroll_rates (
      id              bigserial primary key,
      user_id         bigint references app_users(id),
      casual_id       bigint references casuals(id),
      rate_type       text not null,
      rate_amount     numeric(12,2) not null,
      workshop_id     bigint references warehouses(id),
      created_by      bigint references app_users(id),
      created_at      timestamptz not null default now(),
      active          boolean not null default true,
      constraint payroll_rate_person_check check (num_nonnulls(user_id, casual_id) = 1),
      constraint payroll_rate_type_check check (rate_type in ('hourly','daily','monthly','per_action','fixed')),
      constraint payroll_rate_amount_check check (rate_amount >= 0)
    )
  `);
  await pool.query(`
    create unique index if not exists uidx_payroll_rate_user
      on payroll_rates(user_id) where user_id is not null and active = true
  `);
  await pool.query(`
    create unique index if not exists uidx_payroll_rate_casual
      on payroll_rates(casual_id) where casual_id is not null and active = true
  `);

  // Period status vocabulary matches the brief's suggested lifecycle exactly
  // (Draft -> Calculating -> Pending Approval -> Approved -> Exported ->
  // Closed), plus 'rejected' — the approval engine's own terminal outcome
  // for a fully rejected entity (see procurementApprovalAction's
  // ENTITY_REJECT_STATUS fallback). No period_type/monthly/weekly column —
  // start_date/end_date are freely chosen per period, the same precedent
  // casual_labour_requests already establishes for arbitrary date ranges,
  // sidestepping the need to guess whether UFCL's real cadence is monthly or
  // weekly (Business Rules register, still open).
  await pool.query(`
    create table if not exists payroll_periods (
      id              bigserial primary key,
      workshop_id     bigint references warehouses(id),
      start_date      date not null,
      end_date        date not null,
      status          text not null default 'draft',
      notes           text,
      created_by      bigint references app_users(id),
      created_at      timestamptz not null default now(),
      closed_by       bigint references app_users(id),
      closed_at       timestamptz,
      deleted_at      timestamptz,
      deleted_by      bigint references app_users(id),
      constraint payroll_period_status_check check (status in
        ('draft','calculating','pending_approval','approved','rejected','exported','closed')),
      constraint payroll_period_dates_check check (end_date >= start_date)
    )
  `);
  await pool.query(`create index if not exists idx_payroll_periods_workshop on payroll_periods(workshop_id, start_date desc) where deleted_at is null`);
  await pool.query(`create index if not exists idx_payroll_periods_status on payroll_periods(status) where deleted_at is null`);

  // One line per person per period, DB-enforced via the partial unique
  // indexes below (same concurrency-protection idiom already proven live
  // for attendance's own per-person-per-day uniqueness) — recalculation is
  // an upsert, never a duplicate insert. rate_type_snapshot/
  // rate_amount_snapshot are copied from payroll_rates AT CALCULATION TIME
  // and never re-read live afterward, so a later rate change never silently
  // alters an already-calculated line — required for Priority 6/10's
  // "reproducible, traceable, no unexplained amounts" requirement.
  // source_summary records exactly which attendance rows (or, for
  // per_action/fixed rates with no attendance-derivable quantity, a manual
  // entry note) produced source_qty, so every gross_amount is traceable back
  // to its source without duplicating attendance data into this table.
  await pool.query(`
    create table if not exists payroll_lines (
      id                    bigserial primary key,
      period_id             bigint not null references payroll_periods(id),
      user_id               bigint references app_users(id),
      casual_id             bigint references casuals(id),
      workshop_id           bigint references warehouses(id),
      rate_type_snapshot    text not null,
      rate_amount_snapshot  numeric(12,2) not null,
      source_qty            numeric(10,2) not null default 0,
      source_summary        jsonb,
      gross_amount          numeric(14,2) not null default 0,
      adjustments_total     numeric(14,2) not null default 0,
      net_amount            numeric(14,2) not null default 0,
      status                text not null default 'calculated',
      created_by            bigint references app_users(id),
      created_at            timestamptz not null default now(),
      updated_at            timestamptz,
      constraint payroll_line_person_check check (num_nonnulls(user_id, casual_id) = 1),
      constraint payroll_line_status_check check (status in ('calculated','manual','adjusted'))
    )
  `);
  await pool.query(`create unique index if not exists uidx_payroll_line_user on payroll_lines(period_id, user_id) where user_id is not null`);
  await pool.query(`create unique index if not exists uidx_payroll_line_casual on payroll_lines(period_id, casual_id) where casual_id is not null`);
  await pool.query(`create index if not exists idx_payroll_lines_period on payroll_lines(period_id)`);

  // Adjustments are the ONLY mechanism for changing a line's net amount
  // after calculation (bonus/deduction/correction/other) — deliberately NOT
  // tax/pension/insurance/statutory (Priority 8's explicit exclusion; no
  // such rule is approved). Each adjustment carries its own approval status,
  // separate from the period's own multi-stage approval — a small,
  // proportionate role-gated approve/reject (same shape as
  // casualLabourRequestsReview), not a second multi-stage engine. Adjustments
  // remain possible even after a period is Closed (the brief's "explicit
  // controlled correction mechanism") without ever mutating the original
  // frozen rate/gross snapshot on payroll_lines.
  await pool.query(`
    create table if not exists payroll_adjustments (
      id            bigserial primary key,
      line_id       bigint not null references payroll_lines(id),
      category      text not null,
      amount        numeric(14,2) not null,
      reason        text not null,
      status        text not null default 'pending',
      created_by    bigint references app_users(id),
      created_at    timestamptz not null default now(),
      approved_by   bigint references app_users(id),
      approved_at   timestamptz,
      deleted_at    timestamptz,
      constraint payroll_adjustment_category_check check (category in ('bonus','deduction','correction','other')),
      constraint payroll_adjustment_status_check check (status in ('pending','approved','rejected'))
    )
  `);
  await pool.query(`create index if not exists idx_payroll_adjustments_line on payroll_adjustments(line_id) where deleted_at is null`);

  console.log('[migrate] payroll tables ready');
}

// Same page-based permission convention as grantAttendancePermission — one
// 'payroll' page id, granted to the same role tier already trusted with
// Attendance/Casuals (admin/ceo/operations/supervisor). This governs who can
// even open the module; WHO can actually approve a given payroll period stage
// is separately and more tightly gated by procurement_approval_steps'
// assigned_role column (operations/ceo only — see _payrollBuildApprovalStages
// in data.js), so a supervisor granted this page can prepare/view but cannot
// approve, without needing a second permission key.
async function grantPayrollPermission() {
  const { rows } = await pool.query(
    `select role, permissions from role_definitions where role in ('admin','ceo','operations','supervisor')`
  );
  let updated = 0;
  for (const row of rows) {
    const existing = Array.isArray(row.permissions) ? row.permissions : [];
    if (existing.includes('payroll')) continue;
    const newPerms = [...existing, 'payroll'];
    await pool.query('update role_definitions set permissions=$1 where role=$2', [JSON.stringify(newPerms), row.role]);
    updated++;
  }
  console.log(`[migrate] payroll permission granted to ${updated} role(s)`);
}

// Finance Enterprise Phase 2 — Phase 1 (Discovery) confirmed no General
// Ledger/Chart of Accounts/journal/double-entry infrastructure exists, and
// explicitly ruled it out as this phase's job to build (Finance is a
// CONTROL/OVERSIGHT layer over existing operational data, not a bookkeeping
// system — Sage remains the system of record). The only genuinely new table
// this phase needs is an export-tracking ledger for the Sage-preparation
// workflow (Section 13's explicit "prevent duplicate export, track
// exported/export date/exported by/reconciliation status" requirement) —
// everything else (dashboard, operations center, approval center, AR/AP
// summaries, reports) is computed at read time from existing tables, no new
// storage needed.
async function createFinanceTables() {
  // FIN-06 (Phase 1 Discovery, fixed this phase) — a duplicate-payment
  // application-level check was added to procurementPaymentCreate/Approve,
  // but Section 23's "no duplicate financial effect may occur" requirement
  // needs a DB-level guarantee, not just an app-level race-prone check (two
  // concurrent approvals could both pass a SELECT-based check before either
  // commits). Same partial-unique-index idiom already proven for
  // Attendance/Payroll's own duplicate-prevention — at most one 'paid'
  // payment can ever exist per invoice, enforced by Postgres itself.
  await pool.query(`
    create unique index if not exists uidx_procurement_payment_one_paid_per_invoice
      on procurement_payments(invoice_id) where status = 'paid'
  `);
  console.log('[migrate] duplicate-payment DB constraint ready');

  await pool.query(`
    create table if not exists finance_sage_exports (
      id                bigserial primary key,
      source_module     text not null,
      source_record_id  bigint not null,
      transaction_type  text,
      exported_by       bigint references app_users(id),
      exported_at       timestamptz not null default now(),
      sage_reference     text,
      reconciliation_status text not null default 'exported',
      notes             text,
      constraint finance_sage_export_recon_check check (reconciliation_status in ('exported','reconciled','disputed'))
    )
  `);
  // Duplicate-export prevention (Section 13) — one export record per source
  // record, DB-enforced, same partial-unique-index idiom already proven for
  // Attendance/Payroll's own duplicate-prevention.
  await pool.query(`
    create unique index if not exists uidx_finance_sage_export_source
      on finance_sage_exports(source_module, source_record_id)
  `);
  await pool.query(`create index if not exists idx_finance_sage_export_module on finance_sage_exports(source_module, exported_at desc)`);
  console.log('[migrate] finance tables ready');
}

// Same page-based permission convention as grantPayrollPermission. Granted
// to the same company-wide-privileged tier (admin/ceo/operations) PLUS the
// existing 'finance' role itself — 'finance-center' is a NEW page id
// distinct from 'finance' role's existing narrow page grants (weekly-cost/
// monthly/sage/procurement-*), additive only, does not touch or replace them.
async function grantFinanceCenterPermission() {
  const { rows } = await pool.query(
    `select role, permissions from role_definitions where role in ('admin','ceo','operations','finance')`
  );
  let updated = 0;
  for (const row of rows) {
    const existing = Array.isArray(row.permissions) ? row.permissions : [];
    if (existing.includes('finance-center')) continue;
    const newPerms = [...existing, 'finance-center'];
    await pool.query('update role_definitions set permissions=$1 where role=$2', [JSON.stringify(newPerms), row.role]);
    updated++;
  }
  console.log(`[migrate] finance-center permission granted to ${updated} role(s)`);
}

// ERP Remaining Departments Completion Program — a live audit found the
// database's role_definitions had drifted below what ROLE_PAGES (data.js)
// has documented as these roles' intended baseline access for a long time:
// supervisor/harvesting-leader missing 'stock-movements', sales missing
// 'customers'. No detection mechanism existed anywhere for this class of
// drift (getRolePages only ever reads the DB row when present, never diffs
// it against the fallback). User-approved restoration, not a new grant.
async function restoreRolePagesDrift() {
  const fixes = [
    { role: 'supervisor',         page: 'stock-movements' },
    { role: 'harvesting-leader',  page: 'stock-movements' },
    { role: 'sales',              page: 'customers' },
  ];
  let updated = 0;
  for (const { role, page } of fixes) {
    const { rows } = await pool.query('select permissions from role_definitions where role=$1', [role]);
    if (!rows.length) continue;
    const existing = Array.isArray(rows[0].permissions) ? rows[0].permissions : [];
    if (existing.includes(page)) continue;
    const newPerms = [...existing, page];
    await pool.query('update role_definitions set permissions=$1, updated_at=now() where role=$2', [JSON.stringify(newPerms), role]);
    updated++;
  }
  console.log(`[migrate] role_definitions drift restored for ${updated} role/page pair(s)`);
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

