'use strict';
const { Pool } = require('pg');
const bcrypt   = require('bcryptjs');
require('dotenv').config();

const pool = new Pool();

// Workshop IDs resolved dynamically at runtime — safe after any full DB reset
let GATARE, NYANZA, SHOWROOM;

async function go() {
  const adminRes = await pool.query("SELECT id FROM app_users WHERE username='admin'");
  const adminId  = adminRes.rows[0].id;
  console.log('Admin id:', adminId);

  // Resolve warehouse IDs by name (avoids hardcoded ID drift after truncate + re-migrate)
  const whRes = await pool.query("SELECT id, name FROM warehouses WHERE active=true");
  for (const w of whRes.rows) {
    if (w.name === 'Gatare Workshop') GATARE   = Number(w.id);
    if (w.name === 'Nyanza Workshop') NYANZA   = Number(w.id);
    if (w.name === 'Showroom')        SHOWROOM = Number(w.id);
  }
  if (!GATARE || !NYANZA || !SHOWROOM) throw new Error('Workshop warehouses not found — run npm run migrate first');
  console.log('Workshops: Gatare=' + GATARE + ', Nyanza=' + NYANZA + ', Showroom=' + SHOWROOM);

  // Ensure admin password is always Admin@1234 (migration seeds UFCL@1234 by default)
  const adminHash = await bcrypt.hash('Admin@1234', 10);
  await pool.query('UPDATE app_users SET password_hash=$1 WHERE username=$2', [adminHash, 'admin']);
  console.log('✓ Admin password set to Admin@1234');

  // ── 1. UAT Test Users ──────────────────────────────────────────────────────
  const users = [
    { username:'ceo.rw',        name:'Jean-Paul Nkurunziza', role:'ceo',         dept:'Executive',  ws:null, pw:'Ceo@1234'   },
    { username:'ops.manager',   name:'Alice Uwimana',        role:'operations',  dept:'Operations', ws:null, pw:'Ops@1234'   },
    { username:'logistics.mgr', name:'Robert Habimana',      role:'logistics',   dept:'Logistics',  ws:null, pw:'Log@1234'   },
    { username:'sales.mgr',     name:'Grace Mukamana',       role:'sales',       dept:'Sales',      ws:null, pw:'Sales@1234' },
    { username:'finance.off',   name:'Patrick Niyonzima',    role:'finance',     dept:'Finance',    ws:null, pw:'Fin@1234'   },
    { username:'sup.gatare',    name:'Emmanuel Bizimana',    role:'supervisor',  dept:'Production', ws:GATARE, pw:'Sup1@1234' },
    { username:'sup.nyanza',    name:'Claudine Iradukunda',  role:'supervisor',  dept:'Production', ws:NYANZA, pw:'Sup2@1234' },
    { username:'store.gatare',  name:'Bernard Ntaganda',     role:'storekeeper', dept:'Logistics',  ws:GATARE, pw:'Str1@1234' },
    { username:'store.nyanza',  name:'Solange Mukashyaka',   role:'storekeeper', dept:'Logistics',  ws:NYANZA, pw:'Str2@1234' },
  ];
  for (const u of users) {
    const hash = await bcrypt.hash(u.pw, 10);
    await pool.query(
      'INSERT INTO app_users (username, name, role, password_hash, active, department, workshop_id) VALUES ($1,$2,$3,$4,true,$5,$6)',
      [u.username, u.name, u.role, hash, u.dept, u.ws]
    );
  }
  console.log('✓ 9 UAT users created');

  // ── 2. Machine Categories (ensure they exist) ───────────────────────────────
  const catNames = ['Sawmill','Kiln','Treatment','Debarker','Peeler','Excavator','Tractor'];
  const catMap   = {};
  const existCats = await pool.query('SELECT id, name FROM machine_categories');
  existCats.rows.forEach(r => { catMap[r.name.toLowerCase()] = Number(r.id); });
  for (const n of catNames) {
    if (!catMap[n.toLowerCase()]) {
      const r = await pool.query('INSERT INTO machine_categories (name) VALUES ($1) RETURNING id', [n]);
      catMap[n.toLowerCase()] = Number(r.rows[0].id);
    }
  }

  // ── 3. Machines ────────────────────────────────────────────────────────────
  const machines = [
    { code:'MCH-001', name:'Sawmill A — Band Saw',  cat:'Sawmill',   ws:GATARE, status:'Available',         cap:300, unit:'pcs/day'    },
    { code:'MCH-002', name:'Sawmill B — Circular',  cat:'Sawmill',   ws:GATARE, status:'Available',         cap:250, unit:'pcs/day'    },
    { code:'MCH-003', name:'Kiln Unit 1',            cat:'Kiln',      ws:GATARE, status:'Available',         cap:500, unit:'pcs/batch'  },
    { code:'MCH-004', name:'CCA Treatment Tank',     cat:'Treatment', ws:GATARE, status:'Available',         cap:400, unit:'pcs/batch'  },
    { code:'MCH-005', name:'Debarker D-1',           cat:'Debarker',  ws:NYANZA, status:'Available',         cap:200, unit:'poles/day'  },
    { code:'MCH-006', name:'Pole Peeler P-1',        cat:'Peeler',    ws:NYANZA, status:'Available',         cap:180, unit:'poles/day'  },
    { code:'MCH-007', name:'Excavator EX-01',        cat:'Excavator', ws:GATARE, status:'Available',         cap:0,   unit:''           },
    { code:'MCH-008', name:'Tractor TR-02',          cat:'Tractor',   ws:NYANZA, status:'Under Maintenance', cap:0,   unit:''           },
  ];
  for (const m of machines) {
    await pool.query(
      'INSERT INTO machines (machine_code, name, category_id, workshop_id, status, production_capacity, capacity_unit, active, created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,true,$8)',
      [m.code, m.name, catMap[m.cat.toLowerCase()], m.ws, m.status, m.cap, m.unit, adminId]
    );
  }
  console.log('✓ 8 machines created');

  // ── 4. Customers ───────────────────────────────────────────────────────────
  const customers = [
    { name:'Kigali Construction Ltd',  contact:'Denis Mugabo',         phone:'+250 788 111 222', addr:'Kigali',  notes:'Regular large builder — timber'  },
    { name:'Musanze Timber Merchants', contact:'Ange Uwamariya',        phone:'+250 722 333 444', addr:'Musanze', notes:'Poles buyer'                     },
    { name:'Rwanda Power Grid',        contact:'Gaspard Nsengumuremyi', phone:'+250 733 555 666', addr:'Kigali',  notes:'Utility poles only'              },
    { name:'Huye Housing Authority',   contact:'Beatrice Nyirasafari',  phone:'+250 788 777 888', addr:'Huye',    notes:'Government — 60-day credit'      },
  ];
  for (const c of customers) {
    await pool.query(
      'INSERT INTO customers (name, contact_person, phone, address, notes, active, created_by) VALUES ($1,$2,$3,$4,$5,true,$6)',
      [c.name, c.contact, c.phone, c.addr, c.notes, adminId]
    );
  }
  console.log('✓ 4 customers created');

  // ── 5. Compartments ────────────────────────────────────────────────────────
  const compts = [
    { name:'Block A — Gatare', sub:'Gatare', species:'Eucalyptus', area:25, vol:1800 },
    { name:'Block B — Gatare', sub:'Gatare', species:'Pine',       area:18, vol:1200 },
    { name:'Block A — Nyanza', sub:'Nyanza', species:'Eucalyptus', area:30, vol:2200 },
    { name:'Block C — Nyanza', sub:'Nyanza', species:'Eucalyptus', area:22, vol:1600 },
  ];
  for (const c of compts) {
    await pool.query(
      'INSERT INTO compartments (compt_name, sub_name, species, area_ha, volume_m3, entry_date, status, created_by) VALUES ($1,$2,$3,$4,$5,NOW(),$6,$7)',
      [c.name, c.sub, c.species, c.area, c.vol, 'Active', adminId]
    );
  }
  console.log('✓ 4 compartments created');

  // ── 6. Stock Catalog ───────────────────────────────────────────────────────
  const stockItems = [
    { name:'Diesel Fuel',       cat:'Fuel',        sku:'FUEL-DSL', uom:'Litre', cost:1400,  min:200 },
    { name:'Engine Oil 15W-40', cat:'Lubricants',  sku:'OIL-15W',  uom:'Litre', cost:4500,  min:20  },
    { name:'Band Saw Blade',    cat:'Spare Parts', sku:'BLADE-BS', uom:'Piece', cost:85000, min:3   },
    { name:'CCA Chemical',      cat:'Chemicals',   sku:'CHEM-CCA', uom:'kg',    cost:9500,  min:50  },
    { name:'Safety Gloves',     cat:'PPE',         sku:'PPE-GLV',  uom:'Pair',  cost:2500,  min:30  },
    { name:'Hydraulic Fluid',   cat:'Lubricants',  sku:'HYD-FL1',  uom:'Litre', cost:6200,  min:10  },
  ];
  const skuId = {};
  for (const s of stockItems) {
    const r = await pool.query(
      'INSERT INTO stock_catalog (name, category, sku, uom, unit_cost, min_stock, active, created_by) VALUES ($1,$2,$3,$4,$5,$6,true,$7) RETURNING id',
      [s.name, s.cat, s.sku, s.uom, s.cost, s.min, adminId]
    );
    skuId[s.sku] = Number(r.rows[0].id);
  }
  console.log('✓ 6 stock catalog items created');

  // ── 7. Initial Stock Levels ────────────────────────────────────────────────
  const levels = [
    { sku:'FUEL-DSL', wh:GATARE, qty:500 },
    { sku:'OIL-15W',  wh:GATARE, qty:40  },
    { sku:'BLADE-BS', wh:GATARE, qty:5   },
    { sku:'CHEM-CCA', wh:GATARE, qty:200 },
    { sku:'FUEL-DSL', wh:NYANZA, qty:400 },
    { sku:'OIL-15W',  wh:NYANZA, qty:25  },
    { sku:'PPE-GLV',  wh:NYANZA, qty:50  },
  ];
  for (const l of levels) {
    await pool.query(
      'INSERT INTO stock_levels (item_id, warehouse_id, quantity) VALUES ($1,$2,$3)',
      [skuId[l.sku], l.wh, l.qty]
    );
  }
  console.log('✓ 7 stock levels seeded');

  // ── 8. Product Catalog (machine sizes for daily production forms) ───────────
  const productSizes = [
    { machine:'Sawmill', size:'2x4x12ft'     },
    { machine:'Sawmill', size:'3x4x12ft'     },
    { machine:'Sawmill', size:'2x4x12ft KD'  },
    { machine:'Sawmill', size:'2x4x12ft CCA' },
    { machine:'Sawmill', size:'4x4x12ft'     },
    { machine:'Debarker', size:'4m Pole'     },
    { machine:'Debarker', size:'5m Pole'     },
    { machine:'Debarker', size:'6m Pole'     },
  ];
  for (const p of productSizes) {
    await pool.query('INSERT INTO product_catalog (machine, product_size, active) VALUES ($1,$2,true)', [p.machine, p.size]);
  }
  console.log('✓ 8 product sizes created');

  // ── 9. Refresh materialized views ──────────────────────────────────────────
  await pool.query('REFRESH MATERIALIZED VIEW mv_stock_summary');
  await pool.query('REFRESH MATERIALIZED VIEW mv_stock_by_workshop');
  console.log('✓ Materialized views refreshed');

  // ── Final Report ───────────────────────────────────────────────────────────
  console.log('\n══════════════════════════════════════════════════');
  console.log('            SYSTEM READY FOR UAT TESTING          ');
  console.log('══════════════════════════════════════════════════');

  const allUsers = await pool.query('SELECT username, role, workshop_id FROM app_users ORDER BY id');
  console.log('\nUsers (' + allUsers.rows.length + '):');
  allUsers.rows.forEach(r => {
    const ws = r.workshop_id == GATARE ? 'Gatare Workshop' : r.workshop_id == NYANZA ? 'Nyanza Workshop' : 'All workshops';
    console.log('  ' + r.username.padEnd(18) + r.role.padEnd(14) + ws);
  });

  const allMch = await pool.query('SELECT machine_code, name, workshop_id, status FROM machines ORDER BY id');
  console.log('\nMachines (' + allMch.rows.length + '):');
  allMch.rows.forEach(r => {
    const ws = r.workshop_id == GATARE ? 'Gatare' : r.workshop_id == NYANZA ? 'Nyanza' : 'HQ';
    console.log('  ' + r.machine_code.padEnd(12) + r.name.padEnd(28) + ws.padEnd(8) + r.status);
  });

  const allSL = await pool.query(
    'SELECT sc.name, sl.warehouse_id, sl.quantity, sc.uom FROM stock_levels sl JOIN stock_catalog sc ON sc.id=sl.item_id ORDER BY sl.warehouse_id, sc.name'
  );
  console.log('\nStock Levels (' + allSL.rows.length + '):');
  allSL.rows.forEach(r => {
    const ws = r.warehouse_id == GATARE ? 'Gatare' : r.warehouse_id == NYANZA ? 'Nyanza' : 'WH' + r.warehouse_id;
    console.log('  ' + r.name.padEnd(24) + ws.padEnd(10) + r.quantity + ' ' + r.uom);
  });

  console.log('\nCustomers: 4  |  Compartments: 4  |  Stock items: 6');
  console.log('\nLogin credentials (see UAT Package Section 2.1 for full list):');
  console.log('  admin          Admin@1234     (all workshops)');
  console.log('  sup.gatare     Sup1@1234      (Gatare only)');
  console.log('  sup.nyanza     Sup2@1234      (Nyanza only)');
  console.log('  store.gatare   Str1@1234      (Gatare only)');
  console.log('  store.nyanza   Str2@1234      (Nyanza only)');

  await pool.end();
}

go().catch(e => { console.error('\nERROR:', e.message, '\n', e.stack); process.exit(1); });
