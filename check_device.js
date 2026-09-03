const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const devices = await prisma.biometricDevice.findMany({
    select: { serialNumber: true, lastActive: true, status: true }
  });
  console.log("DEVICES:");
  for (const d of devices) {
    const timeAgo = (new Date() - d.lastActive) / 1000;
    console.log(`SN: ${d.serialNumber}, Status: ${d.status}, LastActive: ${d.lastActive} (${timeAgo.toFixed(1)} seconds ago)`);
  }
}
check().finally(() => prisma.$disconnect());
