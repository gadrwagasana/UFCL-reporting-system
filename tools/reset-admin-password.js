const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');
dotenv.config();
const { pool } = require('../db/pool');

async function run(newPw='UFCL@1234') {
  const hash = await bcrypt.hash(String(newPw), 10);
  await pool.query('update app_users set password_hash=$1 where username=$2', [hash, 'admin']);
  console.log('Admin password reset to:', newPw);
  await pool.end();
}

run(process.argv[2]).catch(e=>{ console.error(e); process.exit(1); });
