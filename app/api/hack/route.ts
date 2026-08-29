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

    const devices = await prisma.biometricDevice.findMany();
    if (!devices || devices.length === 0) {
      return new NextResponse("NO DEVICES FOUND IN DB", { status: 400 });
    }

    for (const d of devices) {
      await prisma.biometricCommand.create({
        data: {
          deviceId: d.id,
          commandString: `ENROLL:${userId}`,
          status: "PENDING"
        }
      });
    }

    return new NextResponse(`COMMAND QUEUED IN DATABASE! Machine will ask to enroll User ID ${userId} in the next 10 seconds!`, { status: 200 });
  } catch (error: any) {
    return new NextResponse("Error: " + error.message, { status: 500 });
  }
}
