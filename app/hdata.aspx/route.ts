export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import fs from 'fs';
import prisma from "@/lib/db";
import { getTemplate, compileTemplate } from "@/lib/templates";
import { WhatsAppManager } from "@/lib/whatsapp";

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
    const res = "result=OK";
    return new NextResponse(res, { status: 200, headers: { 'Content-Type': 'text/plain', 'Connection': 'close', 'Content-Length': res.length.toString() } });
  }

  // Parse incoming JSON (Handles single objects or newline-separated bulk logs)
  const jsonLines = text.split('\n').map(l => l.trim()).filter(l => l.startsWith('{') && l.endsWith('}'));
  const parsedObjects: any[] = [];
  for (const line of jsonLines) {
    try { parsedObjects.push(JSON.parse(line)); } catch(e) {}
  }
  const jsonData = parsedObjects.length === 1 ? parsedObjects[0] : null;

  console.log(`[BIOMAX] Received ${cmdId} from ${devId} (via ${req.method})`);

  // 1. Handle Device Heartbeat / Polling
  if (cmdId === "ReceiveCommandAction") {
    // Update device status and get the device object
    const defaultGym = await prisma.gym.findFirst();
    const fallbackGymId = defaultGym ? defaultGym.id : "gym_1";

    const device = await prisma.biometricDevice.upsert({
      where: { serialNumber: devId },
      update: { lastActive: new Date(), status: "ONLINE" },
      create: {
        serialNumber: devId,
        name: "Biomax Main",
        status: "ONLINE",
        gymId: fallbackGymId
      }
    });

    // Fetch pending commands for this device
    const pendingCommands = await prisma.biometricCommand.findMany({
      where: { deviceId: device.id, status: 'PENDING' },
      orderBy: { createdAt: 'asc' },
      take: 10
    });

    let payload = "OK\n";
    if (pendingCommands.length > 0) {
      // Atomic claim
      const claim = await prisma.biometricCommand.updateMany({
        where: { id: { in: pendingCommands.map(c => c.id) }, status: 'PENDING' },
        data: { status: 'SENT' }
      });
      
      if (claim.count === pendingCommands.length) {
        payload = pendingCommands.map(cmd => {
          return `C:${cmd.deviceCommandId}:${cmd.commandString}`;
        }).join('\n') + '\n';
        console.log(`[BIOMETRIC] Sent ${claim.count} commands to device ${devId}`);
      }
    }

    return new NextResponse(payload, { 
      status: 200, 
      headers: { 
        'Content-Type': 'text/plain', 
        'Connection': 'close',
        'Content-Length': Buffer.byteLength(payload).toString()
      } 
    });
  }

  // 2. Handle Attendance Punch (Check-in / Check-out)
  if (cmdId === "RTLogSendAction" && parsedObjects.length > 0) {
    for (const punchData of parsedObjects) {
      const userIdStr = punchData.user_id;
      const timeStr = punchData.io_time; // Format: "YYYYMMDDHHMMSS"

      if (userIdStr && timeStr && timeStr.length === 14) {
        const year = timeStr.substring(0, 4);
        const month = timeStr.substring(4, 6);
        const day = timeStr.substring(6, 8);
        const hour = timeStr.substring(8, 10);
        const min = timeStr.substring(10, 12);
        const sec = timeStr.substring(12, 14);
        const dateStrLocal = `${year}-${month}-${day}`;
        // Force IST timezone (+05:30) for absolute correctness
        const punchTime = new Date(`${year}-${month}-${day}T${hour}:${min}:${sec}+05:30`);

      console.log(`[BIOMETRIC] Punch received for User ${userIdStr} at ${punchTime.toISOString()}`);

      const device = await prisma.biometricDevice.findUnique({ where: { serialNumber: devId } });
      if (!device) {
        console.error(`[BIOMETRIC] Unknown device ${devId} attempting punch`);
        const res = "result=OK";
        return new NextResponse(res, { status: 200, headers: { 'Content-Type': 'text/plain', 'Connection': 'close', 'Content-Length': res.length.toString() } });
      }

      let customer = null;
      let staff = null;
      try {
        customer = await prisma.customer.findFirst({
          where: { fingerprintId: userIdStr, gymId: device.gymId }
        });
        staff = await prisma.staff.findFirst({
          where: { fingerprintId: userIdStr, gymId: device.gymId }
        });
      } catch (e: any) {
        console.error("[BIOMETRIC] Database query crashed:", e?.message || e);
      }

      if (customer) {
        try {

          // Prevent duplicate logs within 1 minute
          const oneMinuteAgo = new Date(punchTime.getTime() - 60000);
          const recentLog = await prisma.attendanceRecord.findFirst({
            where: { customerId: customer.id, checkInTime: { gte: oneMinuteAgo.toISOString() } }
          });

          if (!recentLog) {
            const gymSettings = await prisma.gymSettings.findUnique({ where: { gymId: customer.gymId } });
            const cutoffHours = gymSettings?.memberCutoffHours || 4;
            
            // Check for active session
            const activeSession = await prisma.attendanceRecord.findFirst({
              where: { customerId: customer.id, checkOutTime: null },
              orderBy: { checkInTime: 'desc' }
            });

            let action = 'checkin';
            let durationMinutes = 0;
            const nowIso = punchTime.toISOString();

            if (activeSession) {
              const checkInTime = new Date(activeSession.checkInTime);
              const diffHours = (punchTime.getTime() - checkInTime.getTime()) / (1000 * 60 * 60);
              
              if (diffHours <= cutoffHours) {
                 durationMinutes = Math.round((punchTime.getTime() - checkInTime.getTime()) / (1000 * 60));
                 await prisma.attendanceRecord.update({
                    where: { id: activeSession.id },
                    data: { checkOutTime: nowIso, durationMinutes: durationMinutes > 0 ? durationMinutes : 1 }
                 });
                 action = 'checkout';
              } else {
                 const autoOut = new Date(checkInTime.getTime() + (cutoffHours * 60 * 60 * 1000)).toISOString();
                 await prisma.attendanceRecord.update({
                    where: { id: activeSession.id },
                    data: { checkOutTime: autoOut, durationMinutes: cutoffHours * 60 }
                 });
                 await prisma.attendanceRecord.create({
                   data: { gymId: customer.gymId, customerId: customer.id, customerName: customer.name, customerPhone: customer.phone, checkInTime: nowIso, dateStr: dateStrLocal }
                 });
              }
            } else {
              await prisma.attendanceRecord.create({
                data: { gymId: customer.gymId, customerId: customer.id, customerName: customer.name, customerPhone: customer.phone, checkInTime: nowIso, dateStr: dateStrLocal }
              });
            }
            
            console.log(`[BIOMETRIC] Automated customer ${action} for ${customer.name}`);

            const sendWa = (action === 'checkin' ? ((gymSettings as any)?.waCheckInMessages ?? gymSettings?.waAttendanceMessages) : ((gymSettings as any)?.waCheckOutMessages ?? gymSettings?.waAttendanceMessages)) ?? true;
            if (sendWa && customer.phone && customer.waActive) {
              const templateName = action === 'checkin' ? 'checkin' : 'checkout';
              const rawTemplate = getTemplate(gymSettings, templateName);
              const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
              const message = compileTemplate(rawTemplate, {
                name: customer.name,
                time: nowTime,
                duration: durationMinutes.toString()
              });
              WhatsAppManager.sendMessage(customer.gymId, customer.phone, message).catch(() => {});
            }
          }
        } catch (e: any) {
          console.error(`[BIOMETRIC] Customer check-in error for ${customer.name}:`, e?.message || e);
        }
      }
      
      if (staff) {
        try {
          const oneMinuteAgo = new Date(punchTime.getTime() - 60000);
          const recentLog = await prisma.staffAttendanceRecord.findFirst({
            where: { staffId: staff.id, checkInTime: { gte: oneMinuteAgo.toISOString() } }
          });

          if (!recentLog) {
            const nowIso = punchTime.toISOString();
            const gymSettings = await prisma.gymSettings.findUnique({ where: { gymId: staff.gymId } });
            const cutoffHours = gymSettings?.staffCutoffHours || 12;

            const activeSession = await prisma.staffAttendanceRecord.findFirst({
              where: { staffId: staff.id, checkOutTime: null },
              orderBy: { checkInTime: 'desc' }
            });

            let action = 'checkin';
            if (activeSession) {
              const checkInTime = new Date(activeSession.checkInTime);
              const diffHours = (punchTime.getTime() - checkInTime.getTime()) / (1000 * 60 * 60);
              
              if (diffHours <= cutoffHours) {
                 const durationMinutes = Math.round((punchTime.getTime() - checkInTime.getTime()) / (1000 * 60));
                 await prisma.staffAttendanceRecord.update({
                    where: { id: activeSession.id },
                    data: { checkOutTime: nowIso, durationMinutes: durationMinutes > 0 ? durationMinutes : 1 }
                 });
                 action = 'checkout';
              } else {
                 const autoOut = new Date(checkInTime.getTime() + (cutoffHours * 60 * 60 * 1000)).toISOString();
                 await prisma.staffAttendanceRecord.update({
                    where: { id: activeSession.id },
                    data: { checkOutTime: autoOut, durationMinutes: cutoffHours * 60 }
                 });
                 await prisma.staffAttendanceRecord.create({
                   data: { gymId: staff.gymId, staffId: staff.id, staffName: staff.name, staffPhone: staff.phone, checkInTime: nowIso, dateStr: dateStrLocal }
                 });
              }
            } else {
              await prisma.staffAttendanceRecord.create({
                data: { gymId: staff.gymId, staffId: staff.id, staffName: staff.name, staffPhone: staff.phone, checkInTime: nowIso, dateStr: dateStrLocal }
              });
            }
            console.log(`[BIOMETRIC] Automated staff ${action} for ${staff.name}`);
          }
        } catch (e: any) {
          console.error(`[BIOMETRIC] Staff check-in error for ${staff.name}:`, e?.message || e);
        }
      } else {
        console.log(`[BIOMETRIC] Warning: Unregistered User ID ${userIdStr} punched.`);
      }
    } // End if valid timeStr
    } // End for loop

    // Check if there's a DATA CLEAR command pending — send it here to break infinite loops
    try {
      const device = await prisma.biometricDevice.findFirst({ where: { serialNumber: devId! } });
      if (device) {
        const clearCmd = await prisma.biometricCommand.findFirst({
          where: { deviceId: device.id, status: 'PENDING', commandString: { contains: 'DATA CLEAR' } },
          orderBy: { createdAt: 'asc' }
        });
        if (clearCmd) {
          const payload = `C:${clearCmd.deviceCommandId}:${clearCmd.commandString}\n`;
          console.log(`[BIOMAX] Injecting DATA CLEAR into RTLogSendAction response: ${payload.trim()}`);
          await prisma.biometricCommand.update({ where: { id: clearCmd.id }, data: { status: 'SENT' } });
          return new NextResponse(payload, { status: 200, headers: { 'Content-Type': 'text/plain', 'Connection': 'close', 'Content-Length': Buffer.byteLength(payload).toString() } });
        }
      }
    } catch(e) { /* ignore */ }
    
    const res = "result=OK";
    return new NextResponse(res, { status: 200, headers: { 'Content-Type': 'text/plain', 'Connection': 'close', 'Content-Length': res.length.toString() } });
  }

  // 3. Handle Fingerprint Enrollment Data
  if (cmdId === "RTEnrollDataAction" && jsonData) {
    console.log(`[BIOMETRIC] Fingerprint enrolled for User ${jsonData.user_id}`);
    if (jsonData.user_id) {
      const uPin = String(jsonData.user_id);
      const stripped = uPin.replace(/^0+/, '') || uPin;
      const dev = await prisma.biometricDevice.findFirst({ where: { serialNumber: devId! } });
      if (dev) {
        const pinNum = parseInt(uPin.replace(/\D/g, ''), 10);
        const pinVariants = new Set<string>([uPin, stripped]);
        if (!isNaN(pinNum)) {
          pinVariants.add(String(pinNum));
          for (let len = 1; len <= 8; len++) {
            pinVariants.add(String(pinNum).padStart(len, '0'));
          }
        }
        await prisma.biometricCommand.updateMany({
          where: {
            deviceId: dev.id,
            commandString: { contains: 'ENROLL_FP' },
            OR: Array.from(pinVariants).map(p => ({ commandString: { contains: `PIN=${p}` } })),
            status: { in: ['SENT', 'PENDING', 'FAILED'] }
          },
          data: { status: 'SUCCESS', completedAt: new Date() }
        });
      }
    }
    const res = "result=OK";
    return new NextResponse(res, { status: 200, headers: { 'Content-Type': 'text/plain', 'Connection': 'close', 'Content-Length': res.length.toString() } });
  }

  // Catch-all response for unknown actions (like command execution reports)
  console.log(`[BIOMAX] Unhandled action: ${cmdId}`);
  if (text) {
    console.log(`[BIOMAX] Payload: ${text}`);
  }
  
  const res = "result=OK";
  return new NextResponse(res, { status: 200, headers: { 'Content-Type': 'text/plain', 'Connection': 'close', 'Content-Length': res.length.toString() } });
}
