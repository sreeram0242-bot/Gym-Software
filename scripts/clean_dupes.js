const fs = require('fs');
const path = require('path');
const filePath = path.join(__dirname, '..', 'lib', 'actions.ts');
let content = fs.readFileSync(filePath, 'utf8');

const regex = /(const authorizedGymId = verifyTenantAccess\(.*?\);\n\s*if \(\!authorizedGymId\) throw new Error\("Unauthorized"\);\n\s*(?:gymId|data\.gymId) = authorizedGymId;\n\s*)\1/g;

content = content.replace(regex, '$1');

// Also check for multiple callerGymId declarations
const regex2 = /(const callerGymId = verifyTenantAccess\(\);\n\s*if \(\!callerGymId\) throw new Error\("Unauthorized"\);\s*)\1/g;
content = content.replace(regex2, '$1');

// Also remove duplicate verifyTenantAccess helper if it exists
const helperRegex = /(\/\/ --- AUTHORIZATION HELPER ---\nfunction verifyTenantAccess[\s\S]*?return requestedGymId \|\| activeGymId;\n\}[^\n]*\n*)\1/g;
content = content.replace(helperRegex, '$1');

const superAdminRegex = /(export async function setSuperadminTenant[\s\S]*?return \{ success: true \};\n\}[^\n]*\n*)\1/g;
content = content.replace(superAdminRegex, '$1');


fs.writeFileSync(filePath, content, 'utf8');
console.log('Cleaned dupes');
