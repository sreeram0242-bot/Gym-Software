require('dotenv').config({ path: '.env.local' });
console.log('ENV LOCAL DB:', process.env.DATABASE_URL);
require('dotenv').config({ path: '.env' });
console.log('ENV DB:', process.env.DATABASE_URL);
