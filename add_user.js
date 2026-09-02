const ZKLib = require('node-zklib');

const ip = process.argv[2];
const userId = process.argv[3];
const name = process.argv[4];

if (!ip || !userId || !name) {
  console.log('❌ Error: Missing arguments.');
  console.log('Usage: node add_user.js <IP_ADDRESS> <USER_ID> <NAME>');
  console.log('Example: node add_user.js 192.168.137.128 1001 "John Doe"');
  process.exit(1);
}

const zk = new ZKLib(ip, 4370, 10000, 4000);

async function addTestUser() {
  try {
    console.log(`Connecting to ZKTeco device at ${ip}:4370...`);
    await zk.createSocket();
    
    console.log(`✅ Connected! Adding user: ${name} (ID: ${userId})`);
    
    // uid, userid, name, password, role (0 = normal user, 14 = super admin)
    // We use the same number for internal uid and display userid
    await zk.setUser(parseInt(userId), userId.toString(), name, '', 0);
    
    console.log(`✅ User "${name}" successfully added to the device!`);
    console.log(`👉 You can now go to the physical device, press Menu -> User Mgt -> All Users, find ${name}, and enroll their fingerprint!`);

    await zk.disconnect();
  } catch (err) {
    console.error('❌ Error:', err.message);
  }
}

addTestUser();
