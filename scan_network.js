const ZKLib = require('node-zklib');

async function fixDevice(ip) {
  let zkInstance = new ZKLib(ip, 4370, 1000, 4000);
  try {
    await zkInstance.createSocket();
    console.log(`\n>>> SUCCESS! Connected to ZK device at ${ip} <<<`);
    
    console.log("Sending CMD_CLEAR_ADMIN (20)...");
    await zkInstance.executeCmd(20, '');
    console.log("Admin privileges cleared!");

    console.log("Sending CMD_CLEAR_ATTLOG (15)...");
    await zkInstance.executeCmd(15, '');
    console.log("Attendance logs cleared!");
    
    await zkInstance.disconnect();
    return true;
  } catch (e) {
    console.log(`Failed on ${ip}: ${e.message}`);
    return false;
  }
}
n 
async function run() {
  console.log("Attempting to connect to 10.193.230.236 in a loop...");
  while (true) {
    const success = await fixDevice('10.193.230.236');
    if (success) {
      console.log("Successfully wiped device admin and logs! Exiting.");
      break;
    }
    // wait 500ms
    await new Promise(r => setTimeout(r, 500));
  }
}

run();
