const { spawn } = require('child_process');
const fs = require('fs');

console.log("Starting Cloudflare tunnel...");
const cf = spawn('npx', ['cloudflared', 'tunnel', '--url', 'http://localhost:3000'], { shell: true });

cf.stderr.on('data', (data) => {
  const output = data.toString();
  console.log("CF LOG:", output);
  
  // Extract URL like https://xyz.trycloudflare.com
  const match = output.match(/https:\/\/[a-zA-Z0-9-]+\.trycloudflare\.com/);
  if (match) {
    fs.writeFileSync('cf_url.txt', match[0]);
    console.log("FOUND URL:", match[0]);
  }
});

setTimeout(() => {
  console.log("Exiting script (tunnel stays open in background)");
  process.exit(0);
}, 8000);
