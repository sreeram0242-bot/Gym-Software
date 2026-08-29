const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgres://postgres:ZPl8L5FGD9E07FWNzxMdtK7KQTx0sBMVH4VPBxzGvzZ6B104NmPJL4zsK9FJyG5l@129.225.83.15:5432/postgres'
});

async function run() {
  await client.connect();
  const res = await client.query('SELECT * FROM "BiometricCommand" ORDER BY "createdAt" DESC LIMIT 5');
  console.log(res.rows);
  await client.end();
}

run();
