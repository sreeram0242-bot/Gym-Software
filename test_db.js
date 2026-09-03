const { PrismaClient } = require('./generated/prisma');
const prisma = new PrismaClient();

async function main() {
  const devices = await prisma.biometricDevice.findMany();
  console.log("DEVICES:", devices);
  
  const cmds = await prisma.biometricCommand.findMany({ orderBy: { createdAt: 'desc' }, take: 5 });
  console.log("COMMANDS:", cmds);
}
main();
