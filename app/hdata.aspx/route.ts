import { NextResponse } from "next/server";
import prisma from "@/lib/db";

export async function POST(req: Request) {
  const url = new URL(req.url);
  const text = await req.text();
  const headers = Object.fromEntries(req.headers.entries());

  const cmdId = headers["cmd_id"];
  const devId = headers["dev_id"];

  if (!devId) {
    return new NextResponse("OK", { status: 200 });
  }

  // Extract JSON by finding the first '{' and the last '}'
  let jsonData = null;
  const jsonStart = text.indexOf('{');
  const jsonEnd = text.lastIndexOf('}');
  
  if (jsonStart !== -1 && jsonEnd !== -1) {
    try {
      const jsonStr = text.substring(jsonStart, jsonEnd + 1);
      jsonData = JSON.parse(jsonStr);
    } catch (e) {
      console.error("[BIOMETRIC] Failed to parse JSON body");
    }
  }

  console.log(`[BIOMAX] Received ${cmdId} from ${devId}`);

  // 1. Handle Device Heartbeat / Polling
  if (cmdId === "ReceiveCommandAction") {
    // Auto-register or update device status
    await prisma.biometricDevice.upsert({
      where: { serialNumber: devId },
      update: { lastPing: new Date(), status: "ONLINE" },
      create: {
        serialNumber: devId,
        name: jsonData?.fk_name || "Biomax Device",
        status: "ONLINE",
      }
    });

    // TODO: Send pending commands back to the device here
    return new NextResponse("OK", { status: 200 });
  }

  // 2. Handle Attendance Punch (Check-in / Check-out)
  if (cmdId === "RTLogSendAction" && jsonData) {
    const userIdStr = jsonData.user_id;
    const timeStr = jsonData.io_time; // Format: "YYYYMMDDHHMMSS"

    if (userIdStr && timeStr && timeStr.length === 14) {
      const year = parseInt(timeStr.substring(0, 4));
      const month = parseInt(timeStr.substring(4, 6)) - 1;
      const day = parseInt(timeStr.substring(6, 8));
      const hour = parseInt(timeStr.substring(8, 10));
      const min = parseInt(timeStr.substring(10, 12));
      const sec = parseInt(timeStr.substring(12, 14));
      const punchTime = new Date(year, month, day, hour, min, sec);

      console.log(`[BIOMETRIC] Punch received for User ${userIdStr} at ${punchTime.toISOString()}`);

      // Find the member in our database
      const member = await prisma.member.findFirst({
        where: { biometricId: userIdStr }
      });

      if (member) {
        // Record the attendance
        await prisma.attendanceRecord.create({
          data: {
            memberId: member.id,
            checkIn: punchTime,
            status: "PRESENT"
          }
        });
        console.log(`[BIOMETRIC] Successfully saved attendance for ${member.name}`);
      } else {
        console.log(`[BIOMETRIC] Warning: Unregistered User ID ${userIdStr} punched.`);
      }
    }
    
    return new NextResponse("OK", { status: 200 });
  }

  // 3. Handle Fingerprint Enrollment Data
  if (cmdId === "RTEnrollDataAction" && jsonData) {
    console.log(`[BIOMETRIC] Fingerprint enrolled for User ${jsonData.user_id}`);
    return new NextResponse("OK", { status: 200 });
  }

  // Catch-all response
  return new NextResponse("OK", { status: 200 });
}

export async function GET(req: Request) {
  return new NextResponse("OK", { status: 200 });
}
