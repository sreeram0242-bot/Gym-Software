const { Pool } = require('pg');
require('dotenv').config({ path: '.env' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function run() {
  const res = await pool.query('SELECT * FROM "BiometricCommand" ORDER BY "createdAt" DESC LIMIT 5');
  console.log("COMMANDS:", JSON.stringify(res.rows, null, 2));
}

run().catch(console.error).finally(() => pool.end());
