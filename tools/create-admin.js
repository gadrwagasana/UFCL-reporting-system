const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');
dotenv.config();
const { pool } = require('../db/pool');

async function run(username='admin', password='Rw@nda1234', name='System Admin') {
  const { rows } = await pool.query('select id from app_users where username=$1', [username]);
  if (rows.length) {
    console.log('User already exists:', username);
    await pool.end();
    return;
  }
  const hash = await bcrypt.hash(String(password), 10);
  await pool.query('insert into app_users(username,name,role,password_hash,active) values ($1,$2,$3,$4,$5)', [username, name, 'admin', hash, true]);
  console.log('Created user', username);
  await pool.end();
}

run(process.argv[2], process.argv[3], process.argv[4]).catch(e=>{ console.error(e); process.exit(1); });
