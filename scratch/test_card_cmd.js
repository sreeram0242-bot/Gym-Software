const { Pool } = require('pg');
require('dotenv').config({ path: '.env' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function run() {
  const deviceId = 'bbcded3d-892e-489b-b277-4bb0ff5daaaf';
  // Try DATA UPDATE USER PIN=111\tCard=4444634
  const cmd = `DATA UPDATE USER PIN=111\tCard=4444634`;
  const res = await pool.query(
    `INSERT INTO "BiometricCommand" ("id", "deviceId", "commandString", "status", "createdAt") 
     VALUES (gen_random_uuid(), $1, $2, 'PENDING', NOW()) RETURNING *`,
    [deviceId, cmd]
  );
  console.log("QUEUED COMMAND:", res.rows[0]);
}

run().catch(console.error).finally(() => pool.end());
