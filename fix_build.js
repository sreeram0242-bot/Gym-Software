const fs = require('fs');
const path = require('path');

const filesToFix = [
  path.join(__dirname, 'app', 'api', 'debug', 'db', 'route.ts'),
  path.join(__dirname, 'app', 'iclock', 'getrequest', 'route.ts')
];

for (const filePath of filesToFix) {
  if (fs.existsSync(filePath)) {
    let content = fs.readFileSync(filePath, 'utf-8');
    if (!content.includes('export const dynamic')) {
      content = `export const dynamic = 'force-dynamic';\n\n` + content;
      fs.writeFileSync(filePath, content, 'utf-8');
      console.log('Fixed:', filePath);
    } else {
      console.log('Already fixed:', filePath);
    }
  }
}
