const ZKLib = require('node-zklib');
const { COMMANDS } = require('node-zklib/constants');

async function main() {
  const ip = '192.168.137.188';
  const zk = new ZKLib(ip, 4370, 5000, 4000);
  await zk.createSocket();
  console.log("Connected to ZKTeco device via node-zklib!");

  // Find user 111 on device
  const res = await zk.getUsers();
  const u = res.data.find(x => x.userId.startsWith('111') || x.uid === 6);
  console.log("Found user on device:", u);

  if (!u) {
    console.error("User 111 not found on device!");
    await zk.disconnect();
    return;
  }

  // Construct 72 byte user packet exactly matching decodeUserData72
  const buf = Buffer.alloc(72);
  buf.writeUInt16LE(u.uid, 0);
  buf.writeUInt8(u.role || 0, 2);
  buf.write(u.password || '', 3, 8, 'ascii');
  buf.write(u.name || 'Newreg', 11, 24, 'ascii');
  buf.writeUInt32LE(4444634, 35); // Write card 4444634 at offset 35!
  buf.write(u.userId, 48, 24, 'ascii');

  console.log(`Writing card 4444634 to UID ${u.uid} (${u.userId})...`);
  const reply = await zk.executeCmd(COMMANDS.CMD_USER_WRQ, buf);
  console.log("CMD_USER_WRQ response:", reply);

  // Refresh device
  await zk.executeCmd(COMMANDS.CMD_REFRESHDATA, '');

  // Read back to verify
  console.log("Reading back users to verify...");
  const verifyRes = await zk.getUsers();
  const verifiedUser = verifyRes.data.find(x => x.uid === u.uid);
  console.log("UPDATED USER ON DEVICE:", verifiedUser);

  await zk.disconnect();
}

main().catch(console.error);
