const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const devices = await prisma.biometricDevice.findMany();
  console.log("Devices:", devices);

  const cmds = await prisma.biometricCommand.findMany({
    orderBy: { createdAt: 'desc' },
    take: 5
  });
  console.log("Recent Commands:", cmds);
}

main().catch(console.error).finally(() => prisma.$disconnect());
