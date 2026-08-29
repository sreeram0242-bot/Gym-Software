import { NextResponse } from "next/server";
import fs from 'fs';
import prisma from "@/lib/db";

export async function GET(req: Request) {
  return POST(req);
}

export async function POST(req: Request) {
  const url = new URL(req.url);
  let text = '';
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    text = await req.text();
  }
  
  const headers = Object.fromEntries(req.headers.entries());

  const cmdId = headers["cmd_id"] || url.searchParams.get("cmd_id");
  const devId = headers["dev_id"] || url.searchParams.get("dev_id");

  if (!devId) {
    return new NextResponse("result=OK", { status: 200 });
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

  console.log(`[BIOMAX] Received ${cmdId} from ${devId} (via ${req.method})`);

  // 1. Handle Device Heartbeat / Polling
  if (cmdId === "ReceiveCommandAction") {
    // Update device status and get the device object
    const device = await prisma.biometricDevice.upsert({
      where: { serialNumber: devId },
      update: { lastActive: new Date(), status: "ONLINE" },
      create: {
        serialNumber: devId,
        name: "Biomax Main",
        status: "ONLINE",
        gymId: "gym_1" // Fallback fallback
      }
    });

    // HACKER QUEUE: Check database for pending commands
    const pendingCommand = await prisma.biometricCommand.findFirst({
      where: {
        deviceId: device.id,
        status: "PENDING"
      },
      orderBy: { createdAt: 'asc' }
    });

    if (pendingCommand) {
      console.log(`[BIOMAX] 🚀 SENDING REMOTE COMMAND: ${pendingCommand.commandString}`);
      // ADMS requires purely numeric Command IDs
      // Using a quick hash or just a timestamp modulo
      const numericId = Math.floor(Math.random() * 100000000);
      let payload = `C:${numericId}:${pendingCommand.commandString}`;

      // Mark command as sent
      await prisma.biometricCommand.update({
        where: { id: pendingCommand.id },
        data: { status: "SENT" }
      });
      
      return new NextResponse(payload, { 
        status: 200, 
        headers: { 
          'Content-Type': payload.startsWith('{') || payload.startsWith('[') ? 'application/json' : 'text/plain', 
          'Connection': 'close',
          'Content-Length': payload.length.toString()
        } 
      });
    }

    const okResponse = "OK";
    return new NextResponse(okResponse, { 
      status: 200, 
      headers: { 
        'Content-Type': 'text/plain',
        'Connection': 'close',
        'Content-Length': okResponse.length.toString()
      } 
    });
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

      // Find the customer in our database
      const customer = await prisma.customer.findFirst({
        where: { fingerprintId: userIdStr }
      });

      if (customer) {
        // Record the attendance
        const dateStr = punchTime.toISOString().split('T')[0];
        
        // Prevent duplicate logs
        const existingLog = await prisma.attendanceRecord.findFirst({
          where: {
            customerId: customer.id,
            checkInTime: punchTime.toISOString()
          }
        });

        if (!existingLog) {
          await prisma.attendanceRecord.create({
            data: {
              gymId: customer.gymId,
              customerId: customer.id,
              customerName: customer.name,
              customerPhone: customer.phone,
              checkInTime: punchTime.toISOString(),
              dateStr: dateStr,
            }
          });
          console.log(`[BIOMETRIC] Successfully saved attendance for ${customer.name}`);
        }
      } else {
        console.log(`[BIOMETRIC] Warning: Unregistered User ID ${userIdStr} punched.`);
      }
    }
    
    const res = "result=OK";
    return new NextResponse(res, { status: 200, headers: { 'Content-Type': 'text/plain', 'Connection': 'close', 'Content-Length': res.length.toString() } });
  }

  // 3. Handle Fingerprint Enrollment Data
  if (cmdId === "RTEnrollDataAction" && jsonData) {
    console.log(`[BIOMETRIC] Fingerprint enrolled for User ${jsonData.user_id}`);
    const res = "result=OK";
    return new NextResponse(res, { status: 200, headers: { 'Content-Type': 'text/plain', 'Connection': 'close', 'Content-Length': res.length.toString() } });
  }

  // Catch-all response
  const res = "result=OK";
  return new NextResponse(res, { status: 200, headers: { 'Content-Type': 'text/plain', 'Connection': 'close', 'Content-Length': res.length.toString() } });
}
