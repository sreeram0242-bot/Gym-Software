import { NextResponse } from 'next/server';
import prisma from '@/lib/db';

export async function POST(req: Request) {
  try {
    const { gymId, memberId, nfcCardId } = await req.json();

    if (!gymId || !memberId || !nfcCardId) {
      return new NextResponse('Missing required fields', { status: 400 });
    }

    // Find the first registered online biometric device for this gym
    const device = await prisma.biometricDevice.findFirst({
      where: { 
        gymId,
      },
      orderBy: { lastActive: 'desc' }
    });

    if (!device) {
      return new NextResponse(JSON.stringify({ error: 'No biometric devices registered or active for this gym.' }), { status: 404 });
    }

    // Trigger enrollment exactly as per the Biomax SKILL
    const command = await prisma.biometricCommand.create({
      data: {
        deviceId: device.id,
        // MUST exactly match SKILL: C:123:ENROLL_FP:PIN={userId}:FID=0:RETRY=3
        commandString: `ENROLL_FP:PIN=${nfcCardId}:FID=0:RETRY=3`,
        status: 'PENDING'
      }
    });

    return NextResponse.json({ success: true, commandId: command.id });
  } catch (error) {
    console.error('API Biometric Enroll Error:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
