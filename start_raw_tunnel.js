const { exec } = require('child_process');
const fs = require('fs');

console.log("Starting localhost.run tunnel...");
const tunnel = exec('ssh -o StrictHostKeyChecking=no -R 80:localhost:3000 nokey@localhost.run');

tunnel.stdout.on('data', (data) => {
  const output = data.toString();
  console.log("OUT:", output);
  
  // Extract URL like http://...
  const match = output.match(/http:\/\/[a-zA-Z0-9.-]+\.localhost\.run/);
  if (match) {
    fs.writeFileSync('raw_tunnel_url.txt', match[0]);
    console.log("FOUND HTTP URL:", match[0]);
  }
});

tunnel.stderr.on('data', (data) => {
  console.log("ERR:", data.toString());
});

setTimeout(() => {
  console.log("Exiting script (tunnel stays open in background)");
  process.exit(0);
}, 10000);
