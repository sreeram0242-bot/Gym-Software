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

    // Check for pending commands (batch up to 10 data commands, or 1 enroll command)
    const pendingCommands = await prisma.biometricCommand.findMany({
      where: { 
        deviceId: device.id,
        status: 'PENDING'
      },
      orderBy: { createdAt: 'asc' },
      take: 10
    });

    if (pendingCommands.length === 0) {
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

    // If first command is ENROLL_FP, send it alone so device can prompt user cleanly.
    // If first command is DATA (e.g. DELETE or UPDATE), batch all consecutive DATA commands up to the first ENROLL_FP.
    const commandsToSend: typeof pendingCommands = [];
    if (pendingCommands[0].commandString.includes('ENROLL_FP')) {
      commandsToSend.push(pendingCommands[0]);
    } else {
      for (const cmd of pendingCommands) {
        if (cmd.commandString.includes('ENROLL_FP')) break;
        commandsToSend.push(cmd);
      }
    }

    // Try to claim the commands atomically
    const idsToClaim = commandsToSend.map(c => c.id);
    await prisma.biometricCommand.updateMany({
      where: { id: { in: idsToClaim }, status: 'PENDING' },
      data: { status: 'SENT', sentAt: new Date() }
    });

    // Format for ZKTeco ADMS (separated by newlines)
    const commandPayload = commandsToSend
      .map(c => `C:${c.deviceCommandId}:${c.commandString}`)
      .join('\n') + '\n';

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
