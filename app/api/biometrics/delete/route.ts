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

    // 1. Cancel in-flight enrollment and queue ADMS delete commands immediately
    const devices = await prisma.biometricDevice.findMany({
      where: { gymId }
    });

    if (devices.length > 0) {
      const pinNum = parseInt(numericPin, 10);
      const pinVariants = new Set<string>([cleanPin, numericPin, trimmedPin]);
      if (!isNaN(pinNum)) {
        pinVariants.add(String(pinNum));
        for (let len = 1; len <= 8; len++) {
          pinVariants.add(String(pinNum).padStart(len, '0'));
        }
      }
      const allPins = Array.from(pinVariants).filter(Boolean);

      // Cancel any active/in-flight ENROLL_FP commands for this PIN
      await prisma.biometricCommand.updateMany({
        where: {
          deviceId: { in: devices.map(d => d.id) },
          commandString: { contains: 'ENROLL_FP' },
          OR: allPins.map(p => ({ commandString: { contains: `PIN=${p}` } })),
          status: { in: ['PENDING', 'SENT'] }
        },
        data: { status: 'FAILED', completedAt: new Date() }
      }).catch(console.error);

      // Queue user delete for cleanPin and trimmedPin so device wipes templates
      const explicitPins = Array.from(new Set([cleanPin, trimmedPin])).filter(Boolean);
      for (const device of devices) {
        for (const p of explicitPins) {
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
