import { getGyms } from './lib/actions';
import prisma from './lib/db';

async function test() {
  const gyms = await getGyms();
  console.log('getGyms() length:', gyms?.length);
  
  const dbGyms = await prisma.gym.findMany();
  console.log('prisma.gym.findMany() length:', dbGyms?.length);
}

test().then(() => process.exit(0));
