const http = require('http');
const fs = require('fs');
const path = require('path');

const command = process.argv[2] || `C:123:DATA UPDATE USERINFO PIN=9999\tName=9999\nC:124:ENROLL_FP PIN=9999 FID=1 RETRY=3\n`;

const serverFile = path.join(__dirname, 'test_server.js');
let content = fs.readFileSync(serverFile, 'utf8');

// Replace commandPayload = ''; with our new command
content = content.replace(/let commandPayload = '.*';/g, `let commandPayload = ${JSON.stringify(command)};`);
if (!content.includes(`let commandPayload = ${JSON.stringify(command)};`)) {
    // If replace failed, find let commandPayload = ''; and replace it
    content = content.replace(/let commandPayload = '';/g, `let commandPayload = ${JSON.stringify(command)};`);
}

fs.writeFileSync(serverFile, content);
console.log(`Command injected into test_server.js: ${command}`);
console.log(`Now restart test_server.js to apply.`);
