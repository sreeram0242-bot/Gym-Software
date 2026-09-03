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

    // Ensure we have a purely numeric PIN for the machine
    let numericPin = nfcCardId.replace(/\D/g, ''); // strip non-digits
    if (!numericPin || numericPin.length === 0 || numericPin.length > 8) {
       // if no digits or too long, generate a random 5 digit number
       numericPin = Math.floor(10000 + Math.random() * 90000).toString();
    }
    
    // Save this numericPin as the fingerprintId in the database!
    await prisma.customer.update({
      where: { id: memberId },
      data: { fingerprintId: numericPin }
    });

    // Trigger enrollment exactly as per the Biomax SKILL
    const command = await prisma.biometricCommand.create({
      data: {
        deviceId: device.id,
        // MUST exactly match SKILL: C:123:ENROLL_FP:PIN={userId}:FID=0:RETRY=3
        commandString: `ENROLL_FP:PIN=${numericPin}:FID=0:RETRY=3`,
        status: 'PENDING'
      }
    });

    return NextResponse.json({ success: true, commandId: command.id, numericPin });
  } catch (error) {
    console.error('API Biometric Enroll Error:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
