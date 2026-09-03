const { Pool } = require('pg');
require('dotenv').config({ path: '.env' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function checkCardDuplicate(card, gymId) {
  const clean = card.trim();
  const stripped = clean.replace(/^0+/, '');
  const padded10 = stripped ? stripped.padStart(10, '0') : clean;
  const match = Array.from(new Set([clean, stripped, padded10])).filter(Boolean);

  const res = await pool.query(
    `SELECT id, name, "nfcCardId", "nfcCardId2" FROM "Customer" 
     WHERE "gymId" = $1 AND ("nfcCardId" = ANY($2) OR "nfcCardId2" = ANY($2))`,
    [gymId, match]
  );
  return res.rows[0];
}

async function run() {
  const gymId = '17a5d460-2811-4d25-bd35-b54c15709205';
  
  // Test 1: Search for stripped '4444634' when '0004444634' is in DB
  const test1 = await checkCardDuplicate('4444634', gymId);
  console.log("Checking '4444634':", test1 ? `BLOCKED! Already belongs to ${test1.name} (DB card: ${test1.nfcCardId})` : "NOT FOUND");

  // Test 2: Search for padded '0004444634'
  const test2 = await checkCardDuplicate('0004444634', gymId);
  console.log("Checking '0004444634':", test2 ? `BLOCKED! Already belongs to ${test2.name} (DB card: ${test2.nfcCardId})` : "NOT FOUND");

  // Test 3: Search for non-existent card
  const test3 = await checkCardDuplicate('999888777', gymId);
  console.log("Checking '999888777':", test3 ? `FOUND: ${test3.name}` : "AVAILABLE (Can be registered)");
}

run().catch(console.error).finally(() => pool.end());
