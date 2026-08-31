const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgres://postgres:ZPl8L5FGD9E07FWNzxMdtK7KQTx0sBMVH4VPBxzGvzZ6B104NmPJL4zsK9FJyG5l@129.225.83.15:5432/postgres'
});

async function run() {
  await client.connect();

  // Find the device
  const devRes = await client.query(`SELECT id, "serialNumber" FROM "BiometricDevice" WHERE "serialNumber" = 'AMDB25062800133' LIMIT 1`);
  if (devRes.rows.length === 0) {
    console.log('Device not found!');
    await client.end();
    return;
  }
  const device = devRes.rows[0];
  console.log(`Found device: ${device.id} (${device.serialNumber})`);

  // Cancel old pending/sent commands
  const cancelled = await client.query(`UPDATE "BiometricCommand" SET status = 'CANCELLED' WHERE "deviceId" = $1 AND status IN ('PENDING', 'SENT') RETURNING id`, [device.id]);
  console.log(`Cancelled ${cancelled.rowCount} old commands.`);

  // Queue cmd=reboot command
  const newCmd = await client.query(
    `INSERT INTO "BiometricCommand" ("id", "deviceId", "commandString", "status", "createdAt") VALUES (gen_random_uuid(), $1, 'cmd=reboot', 'PENDING', NOW()) RETURNING id`,
    [device.id]
  );
  console.log(`\n✅ Queued cmd=reboot: ${newCmd.rows[0].id}`);
  console.log('The device will receive this on its next poll. Watch for the loop to stop!');

  await client.end();
}

run().catch(e => { console.error(e); process.exit(1); });
