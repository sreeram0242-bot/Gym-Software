const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const device = await prisma.biometricDevice.findFirst({
    where: { status: 'online' }
  });

  if (!device) {
    console.log("No online device found.");
    return;
  }

  // Send the Delay option to 2 seconds
  await prisma.biometricCommand.create({
    data: {
      deviceId: device.id,
      commandString: "SET OPTION Delay=2"
    }
  });

  console.log("Commands queued for device:", device.serialNumber);
}

main().catch(console.error).finally(() => prisma.$disconnect());
