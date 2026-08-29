const ZKLib = require('node-zklib');

const zk = new ZKLib('10.61.168.51', 4370, 10000, 4000);

async function test() {
  try {
    console.log('Connecting to Biomax device at 10.61.168.51:4370...');
    await zk.createSocket();
    console.log('✅ Connected!');

    const info = await zk.getInfo();
    console.log('Device Info:', JSON.stringify(info, null, 2));

    const users = await zk.getUsers();
    console.log(`✅ Users on device (${users.data.length}):`);
    users.data.forEach(u => console.log(`  - ID: ${u.userId}, Name: "${u.name}", Privilege: ${u.privilege}`));

    await zk.disconnect();
    console.log('Disconnected.');
  } catch (err) {
    console.error('❌ Error:', err);
  }
}

test();
