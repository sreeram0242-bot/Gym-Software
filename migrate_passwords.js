const { PrismaClient } = require('./generated/prisma');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

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

main().catch(console.error).finally(() => prisma.$disconnect());
