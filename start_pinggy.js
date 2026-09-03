const { spawn } = require('child_process');
const fs = require('fs');

console.log("Starting Pinggy tunnel...");
const pinggy = spawn('ssh', ['-p', '443', '-R0:localhost:3000', '-o', 'StrictHostKeyChecking=no', 'a.pinggy.io']);

pinggy.stdout.on('data', (data) => {
  const output = data.toString();
  console.log(output);
  
  // Extract URLs like http://... or https://...
  const urls = output.match(/https?:\/\/[^\s]+/g);
  if (urls && urls.length > 0) {
    fs.writeFileSync('tunnel_url.txt', urls.join('\n'));
    console.log("Found URL:", urls[0]);
  }
});

pinggy.stderr.on('data', (data) => {
  console.log("ERR:", data.toString());
});

setTimeout(() => {
  console.log("Exiting script (tunnel stays open in background)");
  process.exit(0);
}, 8000);
