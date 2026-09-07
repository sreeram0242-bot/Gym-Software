export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import prisma from '@/lib/db';

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const serialNumber = url.searchParams.get('SN');

    if (!serialNumber) {
      const res = "OK";
      return new NextResponse(res, { 
        status: 200, 
        headers: { 
          'Content-Type': 'text/plain',
          'Connection': 'close',
          'Content-Length': res.length.toString()
        } 
      });
    }

    // Find the device
    const device = await prisma.biometricDevice.findUnique({
      where: { serialNumber }
    });

    if (!device) {
      // If the device is not registered, we just return OK so it doesn't crash
      const res = "OK";
      return new NextResponse(res, { 
        status: 200, 
        headers: { 
          'Content-Type': 'text/plain',
          'Connection': 'close',
          'Content-Length': res.length.toString()
        } 
      });
    }

    // Update last active time
    await prisma.biometricDevice.update({
      where: { id: device.id },
      data: { lastActive: new Date(), status: 'online' }
    });

    // Reset commands stuck in 'SENT' for more than 5 minutes
    const fiveMinsAgo = new Date(Date.now() - 5 * 60 * 1000);
    await prisma.biometricCommand.updateMany({
      where: { deviceId: device.id, status: 'SENT', sentAt: { lt: fiveMinsAgo } },
      data: { status: 'PENDING', sentAt: null }
    });

    // Check for pending commands
    const pendingCommand = await prisma.biometricCommand.findFirst({
      where: { 
        deviceId: device.id,
        status: 'PENDING'
      },
      orderBy: { createdAt: 'asc' }
    });

    if (!pendingCommand) {
      // No commands waiting for this device
      const res = "OK";
      return new NextResponse(res, { 
        status: 200, 
        headers: { 
          'Content-Type': 'text/plain',
          'Connection': 'close',
          'Content-Length': res.length.toString()
        } 
      });
    }

    // Try to claim the command atomically
    const claim = await prisma.biometricCommand.updateMany({
      where: { id: pendingCommand.id, status: 'PENDING' },
      data: { status: 'SENT', sentAt: new Date() }
    });

    if (claim.count === 0) {
      // Another thread already claimed it. Return "OK" and let them handle it.
      const res = "OK";
      return new NextResponse(res, { 
        status: 200, 
        headers: { 
          'Content-Type': 'text/plain',
          'Connection': 'close',
          'Content-Length': res.length.toString()
        } 
      });
    }

    // We have a command! Format it for ZKTeco ADMS.
    // ZKTeco expects: C:<CommandId>:<CommandString>
    // e.g., C:1:ENROLL_FP PIN=105 FID=0 RETRY=3 OVERWRITE=1
    const commandPayload = `C:${pendingCommand.deviceCommandId}:${pendingCommand.commandString}\n`;

    console.log(`\n========================================`);
    console.log(`🚀 [ADMS COMMAND SENT to ${serialNumber}]`);
    console.log(`Payload: ${commandPayload}`);
    console.log(`========================================\n`);

    // Send the command payload to the device
    return new NextResponse(commandPayload, { 
      status: 200, 
      headers: { 
        'Content-Type': 'text/plain',
        'Connection': 'close',
        'Content-Length': commandPayload.length.toString()
      } 
    });

  } catch (error) {
    console.error('ADMS GetRequest Error:', error);
    const res = "SERVER ERROR";
    return new NextResponse(res, { 
      status: 500, 
      headers: { 
        'Content-Type': 'text/plain',
        'Connection': 'close',
        'Content-Length': res.length.toString()
      } 
    });
  }
}
