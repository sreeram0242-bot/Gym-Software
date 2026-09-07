const { Pool } = require('pg');
require('dotenv').config();

async function check() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const res = await pool.query('SELECT * FROM "Gym"');
  console.log('GYMS:', res.rows);
  await pool.end();
}
check();
