const ZKLib = require('zklib');

async function testWriteCard() {
  const zk = new ZKLib({ ip: '192.168.137.188', port: 4370, inport: 5200, timeout: 5000 });
  
  console.log("Connecting via TCP to 192.168.137.188:4370...");
  await new Promise((resolve, reject) => {
    zk.createTcpSocket((err) => {
      if (err) return reject(err);
      zk.connect((err, res) => {
        if (err) return reject(err);
        resolve(res);
      });
    });
  });

  console.log("Connected to ZKTeco device via port 4370!");

  // Command 72: CMD_USER_WRQ (Set user data)
  // Payload layout:
  // Offset 0 (2 bytes UInt16LE): UID
  // Offset 2 (1 byte): Role (0 = user, 14 = admin)
  // Offset 3 (8 bytes): Password
  // Offset 11 (28 bytes): Name
  // Offset 39 (1 byte): Card flag (1)
  // Offset 40 (4 bytes UInt32LE): Card Number!
  // Offset 44 (4 bytes): Group/timezone
  // Offset 48 (24 bytes): User ID string (e.g. '111:FID=0' or '111')
  
  const buf = Buffer.alloc(72);
  buf.writeUInt16LE(6, 0); // UID 6 is user 111
  buf[2] = 0; // role normal
  buf.write('', 3, 8); // password
  buf.write('Newreg', 11, 28); // name
  buf[39] = 1; // enable card
  buf.writeUInt32LE(4444634, 40); // CARD NUMBER: 4444634
  buf.write('111:FID=0', 48, 24); // userId

  // CMD_USER_WRQ = 8 (0x0008) in ZK protocol
  console.log("Sending CMD_USER_WRQ to set card 4444634 on UID 6...");
  await new Promise((resolve, reject) => {
    zk.executeCmd(8, buf, (err, ret) => {
      if (err) return reject(err);
      console.log("executeCmd (CMD_USER_WRQ) response:", ret);
      resolve(ret);
    });
  });

  // Refresh device data: CMD_REFRESHDATA = 1013 (0x03F5)
  await new Promise((resolve) => {
    zk.executeCmd(1013, '', () => resolve());
  });

  console.log("Reading back users from device to verify cardno...");
  const users = await new Promise((resolve, reject) => {
    zk.getUser((err, res) => {
      if (err) return reject(err);
      resolve(res);
    });
  });

  const u6 = users?.find(u => u.uid === 6 || u.id === '111:FID=0');
  console.log("VERIFIED USER 6 ON DEVICE:", u6);

  zk.disconnect();
}

testWriteCard().catch(console.error);
