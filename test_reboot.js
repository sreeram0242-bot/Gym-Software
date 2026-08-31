const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const device = await prisma.biometricDevice.findFirst({
    where: { status: 'ONLINE' }
  });

  if (!device) {
    console.log("No online device found.");
    return;
  }

  await prisma.biometricCommand.create({
    data: {
      deviceId: device.id,
      commandString: "REBOOT",
      status: "PENDING"
    }
  });

  console.log("Queued REBOOT command!");
}

main().catch(console.error).finally(() => prisma.$disconnect());
