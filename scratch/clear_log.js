const { PrismaClient } = require('../prisma/generated/client');
const prisma = new PrismaClient();
async function run() {
  const device = await prisma.biometricDevice.findFirst({ where: { serialNumber: 'AMDB25062800133' } });
  if (device) {
    await prisma.biometricCommand.create({
      data: {
        deviceId: device.id,
        commandString: 'DATA CLEAR LOG',
        status: 'PENDING'
      }
    });
    console.log('Inserted DATA CLEAR LOG command!');
  }
  await prisma.$disconnect();
}
run();
