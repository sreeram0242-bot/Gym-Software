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

    const cleanPin = String(pin).trim();
    const numericPin = cleanPin.replace(/\D/g, '');
    const trimmedPin = numericPin.replace(/^0+/, '') || numericPin;

    console.log(`[Biometrics Delete] Attempting to delete PIN "${cleanPin}" (trimmed: "${trimmedPin}") for gym ${gymId}`);

    // 1. Queue ADMS delete commands immediately so device picks them up on next heartbeat (2s)
    const devices = await prisma.biometricDevice.findMany({
      where: { gymId }
    });

    if (devices.length > 0) {
      const pinsToDelete = Array.from(new Set([cleanPin, trimmedPin])).filter(Boolean);
      for (const device of devices) {
        for (const p of pinsToDelete) {
          await prisma.biometricCommand.create({
            data: {
              deviceId: device.id,
              commandString: `DATA DELETE USERINFO PIN=${p}`,
              status: 'PENDING'
            }
          });
          console.log(`[Biometrics Delete] Queued ADMS delete for PIN ${p} on device ${device.id} (${device.serialNumber})`);
        }
      }
    } else {
      console.warn(`[Biometrics Delete] No registered devices found for gym ${gymId}`);
    }

    // 2. Direct TCP delete — only if gym has an explicit local device IP configured
    const gymSettings = await prisma.gymSettings.findFirst({ where: { gymId } });
    if (gymSettings?.deviceIpAddress) {
      deleteUserFromZkDevice(cleanPin, gymSettings.deviceIpAddress).catch(e => {
        console.error('[Biometrics Delete] Direct TCP delete threw exception:', e);
      });
      if (trimmedPin !== cleanPin) {
        deleteUserFromZkDevice(trimmedPin, gymSettings.deviceIpAddress).catch(() => {});
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('API Biometric Delete Error:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
