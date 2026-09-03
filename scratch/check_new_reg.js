const { Pool } = require('pg');
require('dotenv').config({ path: '.env' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function run() {
  const res = await pool.query(`
    SELECT id, name, phone, "memberId", "fingerprintId", "nfcCardId", "nfcCardId2", "planType", "feeAmount", "joinedDate"
    FROM "Customer" 
    WHERE LOWER(name) LIKE '%new reg%' OR "fingerprintId" = '111' OR "memberId" = '111' OR LOWER(name) LIKE '%reg%'
  `);
  console.log("MATCHED CUSTOMERS:", JSON.stringify(res.rows, null, 2));

  const allRecent = await pool.query(`
    SELECT id, name, phone, "memberId", "fingerprintId", "nfcCardId", "joinedDate" 
    FROM "Customer" 
    LIMIT 5
  `);
  console.log("ALL SAMPLE CUSTOMERS:", JSON.stringify(allRecent.rows, null, 2));
}

run().catch(console.error).finally(() => pool.end());
