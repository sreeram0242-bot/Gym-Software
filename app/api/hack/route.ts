import { NextResponse } from "next/server";
import prisma from "@/lib/db";

export async function GET(req: Request) {
  const url = new URL(req.url);
  
  try {
    const gym = await prisma.gym.findFirst();
    if (!gym) return new NextResponse("No gym found in database", { status: 400 });

    const searchParams = new URL(req.url).searchParams;
    const userId = searchParams.get('id');
    const customCmd = searchParams.get('cmd');
    
    if (!userId && !customCmd) {
      return NextResponse.json({ error: "Missing id or cmd parameter" }, { status: 400 });
    }

    const commandToQueue = customCmd ? customCmd : `ENROLL:${userId}`;

    // Update ALL devices in the gym to send the command
    // (In reality you'd target a specific device, but this ensures the active one gets it)
    const devices = await prisma.biometricDevice.findMany();
    
    for (const device of devices) {
      await prisma.biometricCommand.create({
        data: {
          deviceId: device.id,
          commandType: "ENROLL",
          commandString: commandToQueue,
          status: "PENDING"
        }
      });
    }

    return NextResponse.json({ 
      success: true, 
      message: `Command '${commandToQueue}' queued for ${devices.length} devices.` 
    }, { status: 200 });
  } catch (error: any) {
    return new NextResponse("Error: " + error.message, { status: 500 });
  }
}
