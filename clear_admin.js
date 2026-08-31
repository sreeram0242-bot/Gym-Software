const ZKLib = require('node-zklib');

async function unlock(ip) {
  console.log(`Connecting to ${ip}...`);
  let zkInstance = new ZKLib(ip, 4370, 5200, 5000);
  try {
    await zkInstance.createSocket();
    console.log(`Connected to ${ip}! Clearing admins...`);
    
    // Most zklib implementations have a clearAdmin or similar function
    if (typeof zkInstance.clearAdmin === 'function') {
        await zkInstance.clearAdmin();
        console.log("Admin cleared using clearAdmin()!");
    } else {
        console.log("clearAdmin() not found on this version of zklib.");
    }
    
    // We also want to clear attendance logs because it's jammed!
    if (typeof zkInstance.clearAttendanceLog === 'function') {
        await zkInstance.clearAttendanceLog();
        console.log("Attendance logs cleared using clearAttendanceLog()!");
    } else {
        console.log("clearAttendanceLog() not found.");
    }

    await zkInstance.disconnect();
    return true;
  } catch (e) {
    console.log(`Failed to connect/clear on ${ip}: ${e.message}`);
    return false;
  }
}

async function run() {
  const ips = ['10.193.230.51', '10.193.230.236'];
  for (const ip of ips) {
    await unlock(ip);
  }
  console.log("Done.");
}

run();
