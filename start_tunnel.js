const { exec } = require('child_process');
const fs = require('fs');

console.log("Starting localtunnel...");
const lt = exec('npx -y localtunnel --port 3000');

lt.stdout.on('data', (data) => {
  console.log("LT OUT:", data.toString());
  if (data.toString().includes('your url is:')) {
    fs.writeFileSync('tunnel_url.txt', data.toString().trim());
  }
});

lt.stderr.on('data', (data) => {
  console.log("LT ERR:", data.toString());
});

setTimeout(() => {
  console.log("Timeout reached. Exiting script, but keeping child process alive.");
  process.exit(0);
}, 5000);
