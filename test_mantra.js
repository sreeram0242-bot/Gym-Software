const http = require('http');
function test(xml) {
  const req = http.request({
    hostname: '127.0.0.1', port: 11100, path: '/rd/capture', method: 'CAPTURE', headers: { 'Content-Type': 'text/xml' }
  }, (res) => {
    let d = ''; res.on('data', c => d+=c); res.on('end', () => console.log('XML:', xml, '\nRESP:', d));
  });
  req.on('error', console.error);
  req.write(xml);
  req.end();
}
test('<PidOptions ver="1.0"><Opts fCount="1" fType="0" iCount="0" iType="0" pCount="0" pType="0" format="0" pidVer="2.0" timeout="10000" otp="" wadh="" posh="" /><CustOpts><Param name="ExampleParam" value="ExampleValue" /></CustOpts></PidOptions>');
test('<?xml version="1.0"?><PidOptions ver="1.0"><Opts fCount="1" fType="0" iCount="0" iType="0" pCount="0" pType="0" format="0" pidVer="2.0" timeout="10000" otp="" wadh="" posh="" /></PidOptions>');
