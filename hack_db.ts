import { PrismaClient } from './generated/prisma';

const prisma = new PrismaClient();

async function main() {
  console.log("Starting DB Hack...");

  // 1. Get the first gym
  const gym = await prisma.gym.findFirst();
  if (!gym) {
    console.log("No gym found in database!");
    return;
  }
  console.log("Found Gym:", gym.name, gym.id);

  // 2. Create the BiometricDevice if it doesn't exist
  const devId = "AMDB25062800133";
  let device = await prisma.biometricDevice.findUnique({
    where: { serialNumber: devId }
  });

  if (!device) {
    console.log("Device not found. Creating device...");
    device = await prisma.biometricDevice.create({
      data: {
        serialNumber: devId,
        name: "Biomax Main",
        gymId: gym.id,
        status: "ONLINE",
        lastActive: new Date()
      }
    });
    console.log("Device created:", device);
  } else {
    console.log("Device already exists:", device);
  }

  // 3. Create a pending command!
  const cmd = await prisma.biometricCommand.create({
    data: {
      deviceId: device.id,
      commandType: "ENROLL",
      userId: "99",
      status: "PENDING"
    }
  });
  console.log("Created pending command:", cmd);
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
