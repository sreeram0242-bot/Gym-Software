export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import prisma from '@/lib/db';

export async function POST(req: Request) {
  try {
    const { gymId, pin } = await req.json();

    if (!gymId || !pin) {
      return new NextResponse('Missing required fields', { status: 400 });
    }

    // Find the first registered online biometric device for this gym
    const device = await prisma.biometricDevice.findFirst({
      where: { gymId },
      orderBy: { lastActive: 'desc' }
    });

    if (!device) {
      return new NextResponse(JSON.stringify({ error: 'No biometric devices registered or active for this gym.' }), { status: 404 });
    }

    // Queue the delete command (e.g. DATA DELETE USERINFO PIN=113)
    const command = await prisma.biometricCommand.create({
      data: {
        deviceId: device.id,
        commandString: `DATA DELETE USERINFO PIN=${pin}`,
        status: 'PENDING'
      }
    });

    return NextResponse.json({ success: true, commandId: command.id });
  } catch (error) {
    console.error('API Biometric Delete Error:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
