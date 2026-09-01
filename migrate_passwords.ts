import 'dotenv/config';
import prisma from './lib/db';
import bcrypt from 'bcryptjs';

async function main() {
  const gyms = await prisma.gym.findMany();
  let updatedCount = 0;
  for (const gym of gyms) {
    if (!gym.passwordHash.startsWith('$2a$') && !gym.passwordHash.startsWith('$2b$')) {
      const hashed = await bcrypt.hash(gym.passwordHash, 10);
      await prisma.gym.update({
        where: { id: gym.id },
        data: { passwordHash: hashed }
      });
      console.log(`Updated password for gym: ${gym.userId}`);
      updatedCount++;
    }
  }
  console.log(`Migration complete. Updated ${updatedCount} gyms.`);
}

main().catch(console.error).finally(() => process.exit(0));
