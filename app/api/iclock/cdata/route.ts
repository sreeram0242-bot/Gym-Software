import { NextResponse } from 'next/server';
import prisma from '@/lib/db';

export async function POST(req: Request) {
  try {
    // ZKTeco/eSSL sends the serial number in the URL query params
    const url = new URL(req.url);
    const serialNumber = url.searchParams.get('SN');

    // Read the raw text data pushed by the biometric machine
    const rawData = await req.text();

    // Auto-register the device if it's the first time we see this serial number
    if (serialNumber) {
      const existingDevice = await prisma.biometricDevice.findUnique({
        where: { serialNumber }
      });
      if (!existingDevice) {
        // Find the active gym (defaulting to the first gym for single-gym systems)
        const gym = await prisma.gym.findFirst();
        if (gym) {
          await prisma.biometricDevice.create({
            data: {
              gymId: gym.id,
              serialNumber,
              name: `Device ${serialNumber}`,
              status: 'online'
            }
          });
          console.log(`[BIOMETRIC] Auto-registered new device: ${serialNumber}`);
        }
      }
    }

    console.log(`\n========================================`);
    console.log(`🟢 BIOMETRIC PUSH RECEIVED!`);
    console.log(`📡 Machine Serial: ${serialNumber}`);
    console.log(`========================================`);
    console.log(`RAW DATA PAYLOAD:`);
    console.log(rawData);
    console.log(`========================================\n`);

    // IMPORTANT: We MUST return "OK" in plain text. 
    // If the eSSL machine doesn't see "OK", it thinks the internet is down 
    // and will keep trying to send the same punch over and over again.
    return new NextResponse('OK', { 
      status: 200, 
      headers: { 'Content-Type': 'text/plain' } 
    });
  } catch (error) {
    console.error('Webhook Error:', error);
    return new NextResponse('ERROR', { status: 500 });
  }
}
