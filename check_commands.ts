import { PrismaClient } from './generated/prisma';

const prisma = new PrismaClient();

async function checkCommands() {
  const commands = await prisma.biometricCommand.findMany({
    orderBy: { createdAt: 'desc' },
    take: 5
  });
  console.log("Recent Commands:", commands);
  
  const devices = await prisma.biometricDevice.findMany();
  console.log("Registered Devices:", devices);
}

checkCommands().finally(() => prisma.$disconnect());
