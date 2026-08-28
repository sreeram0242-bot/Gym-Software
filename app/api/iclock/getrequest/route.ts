import { NextResponse } from 'next/server';
import prisma from '@/lib/db';

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const serialNumber = url.searchParams.get('SN');

    if (!serialNumber) {
      return new NextResponse('OK', { status: 200, headers: { 'Content-Type': 'text/plain' } });
    }

    // Find the device
    const device = await prisma.biometricDevice.findUnique({
      where: { serialNumber }
    });

    if (!device) {
      // If the device is not registered, we just return OK so it doesn't crash
      return new NextResponse('OK', { status: 200, headers: { 'Content-Type': 'text/plain' } });
    }

    // Update last active time
    await prisma.biometricDevice.update({
      where: { id: device.id },
      data: { lastActive: new Date(), status: 'online' }
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
      return new NextResponse('OK', { status: 200, headers: { 'Content-Type': 'text/plain' } });
    }

    // We have a command! Format it for ZKTeco ADMS.
    // ZKTeco expects: C:<CommandId>:<CommandString>
    // e.g., C:1:ENROLL_FP PIN=105 FID=0 RETRY=3 OVERWRITE=1
    
    // We will use the database ID as the Command ID (but ADMS requires numeric or short string, so we will just use a short hash or the first 8 chars of the UUID)
    const shortId = pendingCommand.id.substring(0, 8);
    const commandPayload = `C:${shortId}:${pendingCommand.commandString}`;

    // Mark the command as SENT
    await prisma.biometricCommand.update({
      where: { id: pendingCommand.id },
      data: { status: 'SENT', sentAt: new Date() }
    });

    console.log(`\n========================================`);
    console.log(`🚀 [ADMS COMMAND SENT to ${serialNumber}]`);
    console.log(`Payload: ${commandPayload}`);
    console.log(`========================================\n`);

    // Send the command payload to the device
    return new NextResponse(commandPayload, { 
      status: 200, 
      headers: { 'Content-Type': 'text/plain' } 
    });

  } catch (error) {
    console.error('ADMS GetRequest Error:', error);
    return new NextResponse('OK', { status: 200, headers: { 'Content-Type': 'text/plain' } });
  }
}
