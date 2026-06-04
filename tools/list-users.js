const dotenv = require('dotenv');
dotenv.config();
const { pool } = require('../db/pool');

async function run() {
  const { rows } = await pool.query("select id, username, name, role, active, to_char(created_at,'YYYY-MM-DD HH24:MI') as created from app_users order by id");
  console.table(rows);
  await pool.end();
}

run().catch(e=>{ console.error(e); process.exit(1); });
