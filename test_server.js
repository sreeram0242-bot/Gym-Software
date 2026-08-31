const http = require('http');

const responsesToTest = [
  "OK",
  "OK\n",
  "result=OK",
  "result=OK\n",
  "Return=OK",
  "Return=OK\n",
  "Return=0",
  "Return=0\n",
  "result=0",
  "result=0\n",
  "result=ok",
  "success",
  "0",
  "1",
  "",
  "\r\n",
  "CMD=OK",
  JSON.stringify({result:"OK"}),
  JSON.stringify({Return:"OK"}),
  JSON.stringify({Return:0}),
  Buffer.from([9, 0, 0, 0, ...Buffer.from("result=OK")]), // binary prefix
  Buffer.from([0, 0, 0, 9, ...Buffer.from("result=OK")]),
  "\x02OK\x03",
  "result=OK\r\n"
];

let testIndex = 0;
let lastTestTime = Date.now();

const server = http.createServer((req, res) => {
  let body = '';
  req.on('data', chunk => body += chunk.toString());
  req.on('end', () => {
    // If it's been more than 5 seconds since the last request, the loop BROKE!
    if (Date.now() - lastTestTime > 5000 && testIndex > 0) {
      console.log(`\n\n!!! LOOP BROKE !!! The successful response was: ${JSON.stringify(responsesToTest[testIndex - 1])}\n\n`);
    }
    lastTestTime = Date.now();

    const cmdId = req.headers['cmd_id'];
    
    // Test a new string only for RTLogSendAction or RTEnrollDataAction
    let resBody = responsesToTest[testIndex];
    
    if (cmdId === 'ReceiveCommandAction') {
       resBody = "OK"; // or whatever
    } else {
       console.log(`\n--- ${req.method} ${req.url} (Testing Index ${testIndex}: ${JSON.stringify(resBody)}) ---`);
       console.log(`Body: ${body.substring(0, 100)}...`);
       // Move to next string for next time if it fails
       testIndex = (testIndex + 1) % responsesToTest.length;
    }

    res.writeHead(200, {
      'Content-Type': 'text/plain',
      'Content-Length': Buffer.isBuffer(resBody) ? resBody.length.toString() : Buffer.byteLength(resBody).toString(),
      'Connection': 'close'
    });
    res.end(resBody);
  });
});

server.listen(3000, () => {
  console.log('Brute-force ADMS server listening on port 3000');
});
