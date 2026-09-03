const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'app', 'hdata.aspx', 'route.ts');
let content = fs.readFileSync(filePath, 'utf-8');

// 1. Fix line 26
content = content.replace(
  'return new NextResponse("result=OK", { status: 200 });',
  `const res = "result=OK";\n    return new NextResponse(res, { status: 200, headers: { 'Content-Type': 'text/plain', 'Connection': 'close', 'Content-Length': res.length.toString() } });`
);

// 2. Fix mapping (around line 71)
const oldMapStr = "payload = pendingCommands.map(cmd => `C:${cmd.id}:${cmd.commandString}`).join('\\n') + '\\n';";
const newMapStr = `payload = pendingCommands.map(cmd => {
        const numericId = Math.floor(Math.random() * 100000000);
        return \`C:\${numericId}:\${cmd.commandString}\`;
      }).join('\\n') + '\\n';`;
content = content.replace(oldMapStr, newMapStr);

// 3. Fix the catch block for punch loop (around line 265+)
content = content.replace(
  `    } catch(e) { /* ignore */ }\n    \n    return new NextResponse('OK', { status: 200, headers: { 'Content-Type': 'text/plain' } });`,
  `    } catch(e) { /* ignore */ }\n    \n    const res = "result=OK";\n    return new NextResponse(res, { status: 200, headers: { 'Content-Type': 'text/plain', 'Connection': 'close', 'Content-Length': res.length.toString() } });`
);

// 4. Fix RTEnrollDataAction (around line 272)
content = content.replace(
  `    return new NextResponse('OK', { status: 200, headers: { 'Content-Type': 'text/plain' } });\n  }\n\n  // Catch-all response for unknown actions`,
  `    const res = "result=OK";\n    return new NextResponse(res, { status: 200, headers: { 'Content-Type': 'text/plain', 'Connection': 'close', 'Content-Length': res.length.toString() } });\n  }\n\n  // Catch-all response for unknown actions`
);

// 5. Fix bottom Catch-all (around line 281)
content = content.replace(
  `  if (text) {\n    console.log(\`[BIOMAX] Payload: \${text}\`);\n  }\n  \n  return new NextResponse('OK', { status: 200, headers: { 'Content-Type': 'text/plain' } });\n}`,
  `  if (text) {\n    console.log(\`[BIOMAX] Payload: \${text}\`);\n  }\n  \n  const res = "result=OK";\n  return new NextResponse(res, { status: 200, headers: { 'Content-Type': 'text/plain', 'Connection': 'close', 'Content-Length': res.length.toString() } });\n}`
);

fs.writeFileSync(filePath, content, 'utf-8');
console.log('hdata.aspx logic bugs fixed!');
