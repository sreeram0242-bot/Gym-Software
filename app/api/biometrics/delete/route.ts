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

    console.log(`[Biometrics Delete] Attempting to delete PIN ${pin} for gym ${gymId}`);

    // 1. Look up the gym's actual device IP from GymSettings
    const gymSettings = await prisma.gymSettings.findFirst({ where: { gymId } });
    const deviceIp = gymSettings?.deviceIpAddress || process.env.ZK_DEVICE_IP || '192.168.137.188';

    // 2. Direct TCP delete — uses the correct per-gym device IP
    try {
      const result = await deleteUserFromZkDevice(String(pin), deviceIp);
      if (result.success) {
        console.log(`[Biometrics Delete] TCP delete succeeded for PIN ${pin} on ${deviceIp}`);
      } else {
        console.warn(`[Biometrics Delete] TCP delete returned failure for PIN ${pin}:`, result.error);
      }
    } catch (e) {
      console.error('[Biometrics Delete] Direct TCP delete threw exception, falling back to ADMS queue:', e);
    }

    // 3. Also queue ADMS delete command as a secondary/backup mechanism
    // (executes on the next device heartbeat even if TCP failed or device was temporarily offline)
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
      console.log(`[Biometrics Delete] Queued ADMS delete command for PIN ${pin} on device ${device.id}`);
    } else {
      console.warn(`[Biometrics Delete] No active device found for gym ${gymId} — ADMS fallback skipped`);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('API Biometric Delete Error:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
