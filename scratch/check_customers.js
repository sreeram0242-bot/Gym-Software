const { Pool } = require('pg');
require('dotenv').config({ path: '.env' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function run() {
  const res = await pool.query('SELECT id, name, phone, "fingerprintId", "nfcCardId" FROM "Customer" WHERE "fingerprintId" IS NOT NULL');
  console.log("EXISTING CUSTOMERS WITH MEMBER ID / FINGERPRINT ID:", JSON.stringify(res.rows, null, 2));
}

run().catch(console.error).finally(() => pool.end());
