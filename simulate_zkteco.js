const http = require('http');

// We give our fake device a Serial Number
const SN = "SIMULATOR_100";
const SERVER_URL = `http://localhost:3000/hdata.aspx?dev_id=${SN}&cmd_id=ReceiveCommandAction`;

console.log(`======================================================`);
console.log(`[ZKTeco Simulator] Powering ON...`);
console.log(`[ZKTeco Simulator] Serial Number: ${SN}`);
console.log(`[ZKTeco Simulator] Polling Server for new commands every 3 seconds...`);
console.log(`======================================================\n`);
console.log(`👉 You can now go to your web browser and click "Enroll Member"!`);
console.log(`👉 Waiting for you to click the button in the UI...\n`);

setInterval(() => {
  http.get(SERVER_URL, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      data = data.trim();
      
      // If the server sends us something other than just "OK", it's a command!
      if (data && data !== 'OK') {
        const commands = data.split('\n');
        for (const cmd of commands) {
          if (cmd.includes('ENROLL_FP')) {
            console.log(`\n🚨 BEEP! BEEP! 🚨`);
            console.log(`======================================================`);
            console.log(`👉 SCREEN SAYS: "Please place your finger 3 times..."`);
            console.log(`✅ 100% AUTOMATION SUCCESS! Received Command from Web UI!`);
            console.log(`💻 Command Payload: ${cmd}`);
            console.log(`======================================================\n`);
          } else if (cmd.trim() !== '') {
             console.log(`[ZKTeco Simulator] Received Background Command: ${cmd}`);
          }
        }
      }
    });
  }).on('error', (err) => {
    console.error(`[ZKTeco Simulator] Cannot reach server. Make sure 'npm run dev' is running!`);
  });
}, 3000);
