const ZKLib = require('node-zklib');

async function setCard() {
  const zk = new ZKLib('192.168.137.188', 4370, 5000, 4000);
  await zk.createSocket();
  console.log("Setting card on device for UID 6 / userId '111:FID=0'...");
  
  // zk.setUser(uid, userid, name, password, role, cardno)
  const res = await zk.setUser(6, '111:FID=0', 'Newreg', '', 0, 4444634);
  console.log("setUser response:", res);

  console.log("Verifying user on device...");
  const users = await zk.getUsers();
  const u6 = users.data.find(u => u.uid === 6);
  console.log("Updated User 6 on device:", u6);

  await zk.disconnect();
}

setCard().catch(console.error);
