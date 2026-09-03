const ZKLib = require('node-zklib');

async function test() {
  const ip = '192.168.137.188';
  const zk = new ZKLib(ip, 4370, 5000, 4000);
  console.log(`Connecting to ${ip}:4370...`);
  try {
    await zk.createSocket();
    console.log("Socket connected! Fetching device info...");
    const info = await zk.getInfo();
    console.log("Device Info:", info);
    
    console.log("Fetching users...");
    const users = await zk.getUsers();
    console.log("Device Users count:", users?.data?.length || users?.length || users);
    if (users?.data) {
      console.log("Sample users:", users.data.slice(0, 5));
      const u111 = users.data.find(u => u.userId == '111' || u.uid == 111);
      console.log("User 111 on device:", u111);
    }
    
    await zk.disconnect();
    console.log("Disconnected successfully!");
  } catch (err) {
    console.error("ZK Error:", err);
  }
}

test();
