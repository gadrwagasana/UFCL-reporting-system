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
  await pool.query(`alter table app_users add column if not exists deleted_at  timestamptz`);
  await pool.query(`alter table app_users add column if not exists deleted_by  bigint`);
  await pool.query(`alter table daily_logs add column if not exists operators text`);
  await pool.query(`alter table value_added_timber add column if not exists source_transfer_id bigint references stock_transfers(id)`);
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
  await pool.query(`alter table value_added_timber     add column if not exists workshop_id bigint references warehouses(id)`);
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
  await pool.query(`create index if not exists idx_vat_workshop            on value_added_timber(workshop_id)   where deleted_at is null`);
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
      select workshop_id,
             coalesce(sum(case when type_value_added='Kiln-dried timber'  then num_timber else 0 end),0)::int as kiln_dried,
             coalesce(sum(case when type_value_added='CCA treated timber' then num_timber else 0 end),0)::int as cca_treated
      from value_added_timber where deleted_at is null
      group by workshop_id
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
      select coalesce(sum(case when type_value_added='Kiln-dried timber'  then num_timber else 0 end),0)::int as kiln_dried,
             coalesce(sum(case when type_value_added='CCA treated timber' then num_timber else 0 end),0)::int as cca_treated
      from value_added_timber where deleted_at is null
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
            'machines', 'machine-logs', 'machine-kpi',
            'compartments', 'log-transport', 'value-added-timber',
            'machine-fuel', 'casual-requests', 'casuals',
            'weekly-cost', 'weekly-perf', 'monthly', 'kpi', 'sage'],
    ceo: ['dashboard', 'ceo', 'weekly-cost', 'weekly-perf', 'monthly', 'kpi', 'audit', 'export', 'users', 'notifications', 'changes',
          'secgov', 'executive', 'bi', 'automation', 'epm',
          'daily-harvest', 'value-added-timber', 'timber-inventory', 'products', 'customers', 'sales',
          'vehicles', 'deliveries', 'dispatch', 'transport', 'transport-jobs',
          'logistics-dashboard', 'workshop-overview',
          'warehouses', 'stock-items', 'stock-movements', 'stock-transfers', 'material-requests',
          'machines', 'machine-logs', 'machine-kpi', 'machine-fuel',
          'compartments', 'log-transport',
          'casual-requests', 'casuals'],
    operations: ['dashboard', 'daily', 'daily-timber', 'daily-poles', 'daily-harvest', 'products', 'sales', 'customers',
                 'weekly-cost', 'weekly-perf', 'inventory', 'audit', 'export', 'notifications', 'changes',
                 'secgov', 'executive', 'bi', 'automation', 'epm',
                 'timber-inventory', 'harvest', 'workshop-overview',
                 'stock-items', 'stock-movements', 'stock-transfers', 'material-requests', 'transport',
                 'machines', 'machine-logs', 'machine-kpi',
                 'compartments', 'log-transport', 'value-added-timber',
                 'machine-fuel', 'casual-requests', 'casuals'],
    sales: ['dashboard', 'sales', 'products', 'audit', 'export', 'notifications', 'changes', 'deliveries', 'transport'],
    finance: ['dashboard', 'weekly-cost', 'monthly', 'sage', 'audit', 'export', 'notifications', 'changes'],
    logistics: ['dashboard', 'logistics', 'logistics-dashboard', 'inventory', 'audit', 'export', 'notifications', 'changes',
                'warehouses', 'stock-items', 'stock-movements', 'stock-transfers', 'vehicles', 'deliveries', 'dispatch', 'transport',
                'machines', 'log-transport', 'machine-fuel',
                'casual-requests', 'casuals', 'material-requests'],
    supervisor: ['dashboard', 'bi', 'daily', 'daily-timber', 'daily-poles', 'daily-harvest',
                 'audit', 'export', 'notifications', 'changes', 'harvest', 'timber-inventory',
                 'machine-logs', 'compartments', 'log-transport', 'value-added-timber',
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
    'mechanician': ['dashboard', 'material-requests', 'notifications'],
    // Phase 2 — Operations leaders (all workshop-restricted, no approval rights)
    'harvesting-leader': ['dashboard', 'bi', 'daily-harvest', 'harvest', 'log-transport', 'compartments',
                          'casual-requests', 'workshop-overview',
                          'notifications', 'audit', 'export'],
    'sawmill-leader':    ['dashboard', 'bi', 'daily-timber', 'timber-inventory', 'machine-logs', 'machine-fuel',
                          'material-requests', 'casual-requests', 'workshop-overview',
                          'notifications', 'audit', 'export'],
    'poles-leader':      ['dashboard', 'bi', 'daily-poles', 'machine-logs', 'machine-fuel',
                          'material-requests', 'casual-requests', 'workshop-overview',
                          'notifications', 'audit', 'export'],
    'vat-leader':        ['dashboard', 'bi', 'value-added-timber', 'timber-inventory',
                          'material-requests', 'casual-requests', 'workshop-overview',
                          'notifications', 'audit', 'export'],
    'harvesting-supervisor': ['dashboard', 'bi', 'daily-harvest', 'log-transport',
                              'notifications', 'audit', 'export'],
    'sawmill-supervisor':    ['dashboard', 'bi', 'daily-timber',
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

async function migrate() {
  await ensureDatabaseExists();
  await ensureSchema();
  await auditLogEnhancement();
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

