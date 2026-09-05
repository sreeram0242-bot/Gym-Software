export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { deleteUserFromZkDevice } from '@/lib/zk-device';

export async function POST(req: Request) {
  try {
    const { gymId, pin } = await req.json();

    if (!gymId || !pin) {
      return new NextResponse('Missing required fields', { status: 400 });
    }

    // 1. Try direct TCP delete first (fastest & most reliable for ZKTeco devices)
    try {
      await deleteUserFromZkDevice(String(pin));
    } catch (e) {
      console.error('[Biometrics Delete] Direct TCP delete failed, falling back to ADMS queue:', e);
    }

    // 2. Also queue ADMS delete command as a secondary/backup mechanism
    // (works even if the device was offline when step 1 ran)
    const device = await prisma.biometricDevice.findFirst({
      where: { gymId },
      orderBy: { lastActive: 'desc' }
    });

    if (device) {
      await prisma.biometricCommand.create({
        data: {
          deviceId: device.id,
          commandString: `DATA DELETE USERINFO PIN=${pin}`,
          status: 'PENDING'
        }
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('API Biometric Delete Error:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}

