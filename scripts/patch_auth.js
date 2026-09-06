const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'lib', 'actions.ts');
let content = fs.readFileSync(filePath, 'utf8');

const authCode = `
// --- AUTHORIZATION HELPER ---
function verifyTenantAccess(requestedGymId?: string) {
  const isSuperadmin = cookies().get('is_superadmin')?.value === 'true';
  const activeGymId = cookies().get('active_gym_id')?.value;

  if (!isSuperadmin && !activeGymId) {
    throw new Error('Unauthorized: No active session');
  }

  if (!isSuperadmin && requestedGymId && activeGymId !== requestedGymId) {
    throw new Error('Unauthorized: Tenant mismatch');
  }

  return requestedGymId || activeGymId;
}

export async function setSuperadminTenant(gymId: string) {
  const isSuperadmin = cookies().get('is_superadmin')?.value === 'true';
  if (!isSuperadmin) throw new Error('Unauthorized');
  
  cookies().set('active_gym_id', gymId, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/' });
  return { success: true };
}
`;

// Insert the auth helper after const store = globalAny.mockStore;
if (!content.includes('verifyTenantAccess')) {
    content = content.replace('const store = globalAny.mockStore;', 'const store = globalAny.mockStore;\n' + authCode);
}

// Function signatures to patch that take gymId
const readFunctions = [
    'getGymSettings', 'getCustomers', 'getAttendance', 'getTransactions',
    'getSubscriptionPlans', 'getProducts', 'getProductSales', 'getStaffs', 'getStaffAttendance',
    'getNextAvailableZkTecoId'
];

for (const fn of readFunctions) {
    const regex = new RegExp(`(export async function ${fn}\\(gymId[\\s\\S]*?\\)\\s*\\{)`);
    content = content.replace(regex, `$1\n  const authorizedGymId = verifyTenantAccess(gymId);\n  if (!authorizedGymId) throw new Error("Unauthorized");\n  gymId = authorizedGymId;\n`);
}

// Functions that take data (add*, update*)
const addFunctions = [
    'updateGymSettings', 'addCustomer', 'addTransaction', 'addSubscriptionPlan', 
    'addProduct', 'recordProductSale', 'addStaff'
];

for (const fn of addFunctions) {
    const regex = new RegExp(`(export async function ${fn}\\([^{]*data:\\s*(?:any|\\{[^}]*\\})\\)\\s*\\{)`);
    content = content.replace(regex, `$1\n  const authorizedGymId = verifyTenantAccess(data.gymId);\n  if (!authorizedGymId) throw new Error("Unauthorized");\n  data.gymId = authorizedGymId;\n`);
}

// For updateCustomer and deleteCustomer, which use callerGymId
content = content.replace(/const callerGymId = cookies\(\)\.get\('active_gym_id'\)\?\.value;\s*if \(\!callerGymId\) throw new Error\("Unauthorized"\);/g, `const callerGymId = verifyTenantAccess();\n  if (!callerGymId) throw new Error("Unauthorized");`);
// Same for others like deleteStaff
content = content.replace(/const callerGymId = cookies\(\)\.get\('active_gym_id'\)\?\.value;/g, `const callerGymId = verifyTenantAccess();`);

// Update authenticateSuperadmin
content = content.replace(/(export async function authenticateSuperadmin[\s\S]*?if \(isValid\) \{[\s\S]*?)resetFailedAttempts/, `$1cookies().set('is_superadmin', 'true', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/' });\n    resetFailedAttempts`);

// FIX: ensure the mock store fallback in authenticateGym also sets the active_gym_id cookie.
// We target the specific return inside the catch block of authenticateGym.
// The code looks like:
// resetFailedAttempts(userId);
// return { success: true, gym: { id: gym.id, userId: gym.userId } };
content = content.replace(/resetFailedAttempts\(userId\);\n\s*return \{ success: true, gym: \{ id: gym\.id, userId: gym\.userId \} \};\n\s*\}/, `resetFailedAttempts(userId);\n    cookies().set('active_gym_id', gym.id, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/' });\n    return { success: true, gym: { id: gym.id, userId: gym.userId } };\n  }`);


fs.writeFileSync(filePath, content, 'utf8');
console.log('Patched actions.ts');
