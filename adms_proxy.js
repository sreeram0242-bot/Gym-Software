const http = require('http');

const server = http.createServer((clientReq, clientRes) => {
  const options = {
    hostname: '127.0.0.1',
    port: 3000,
    path: clientReq.url,
    method: clientReq.method,
    headers: clientReq.headers,
  };

  const proxyReq = http.request(options, (proxyRes) => {
    clientRes.writeHead(proxyRes.statusCode, proxyRes.headers);
    proxyRes.pipe(clientRes, { end: true });
  });

  clientReq.pipe(proxyReq, { end: true });
  proxyReq.on('error', (e) => {
    clientRes.writeHead(500);
    clientRes.end();
  });
});

server.listen(80, '0.0.0.0', () => {
  console.log('✅ Local ADMS Proxy running! Listening on Port 80 -> Forwarding to Port 3000');
  console.log('👉 Put 192.168.137.1 in the ZKTeco device Cloud Server Address!');
}).on('error', (e) => {
  if (e.code === 'EACCES' || e.code === 'EADDRINUSE') {
    console.error('❌ Port 80 is blocked by Windows or in use (Skype/IIS).');
    console.error('Try running VS Code as Administrator, or we will have to use another method.');
  } else {
    console.error(e);
  }
});
