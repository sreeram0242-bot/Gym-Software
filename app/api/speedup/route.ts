export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import prisma from '@/lib/db';

export async function GET() {
  try {
    const devices = await prisma.biometricDevice.findMany();
    
    if (devices.length === 0) {
      return NextResponse.json({ error: "No devices found in database" });
    }

    let count = 0;
    for (const device of devices) {
      await prisma.biometricCommand.create({
        data: {
          deviceId: device.id,
          commandString: "SET OPTION Delay=2",
          status: "PENDING"
        }
      });
      count++;
    }

    return NextResponse.json({ 
      success: true, 
      message: `Successfully queued Speed-Up command for ${count} device(s). The machine will speed up automatically within the next minute!` 
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message });
  }
}
