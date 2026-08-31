const ZKLib = require('node-zklib');

const ip = process.argv[2];
if (!ip) {
  console.log('❌ Error: Please provide an IP address.');
  console.log('Usage: node zk_test.js <IP_ADDRESS>');
  console.log('Example: node zk_test.js 192.168.1.50');
  process.exit(1);
}

const zk = new ZKLib(ip, 4370, 10000, 4000);

async function test() {
  try {
    console.log(`Connecting to ZKTeco device at ${ip}:4370...`);
    await zk.createSocket();
    console.log('✅ SUCCESS! Connected to ZKTeco device!');

    const info = await zk.getInfo();
    console.log('Device Info:', JSON.stringify(info, null, 2));

    const users = await zk.getUsers();
    console.log(`✅ Users on device (${users.data.length}):`);
    users.data.forEach(u => console.log(`  - ID: ${u.userId}, Name: "${u.name}", Privilege: ${u.privilege}`));

    await zk.disconnect();
    console.log('Disconnected.');
  } catch (err) {
    console.error('❌ Error: Failed to connect to device. Ensure it is turned on and on the same network.');
    console.error(err.message);
  }
}

test();
