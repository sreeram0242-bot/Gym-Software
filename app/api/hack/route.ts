import { NextResponse } from "next/server";
import prisma from "@/lib/db";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const userId = url.searchParams.get("id") || "99";
  
  try {
    const gym = await prisma.gym.findFirst();
    if (!gym) return new NextResponse("No gym found in database", { status: 400 });

    const devId = "AMDB25062800133";
    let device = await prisma.biometricDevice.findUnique({
      where: { serialNumber: devId }
    });

    if (!device) {
      device = await prisma.biometricDevice.create({
        data: {
          serialNumber: devId,
          name: "Biomax Main",
          gymId: gym.id,
          status: "ONLINE",
          lastActive: new Date()
        }
      });
    }

    await prisma.biometricCommand.create({
      data: {
        deviceId: device.id,
        commandString: `ENROLL:${userId}`,
        status: "PENDING"
      }
    });

    return new NextResponse(`COMMAND QUEUED IN DATABASE! Machine will ask to enroll User ID ${userId} in the next 10 seconds!`, { status: 200 });
  } catch (error: any) {
    return new NextResponse("Error: " + error.message, { status: 500 });
  }
}
