export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import prisma from '@/lib/db';

// How long to wait for a fingerprint scan before declaring timeout (seconds)
const ENROLL_TIMEOUT_SECONDS = 90;

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const commandId = url.searchParams.get('id');
    const pin = url.searchParams.get('pin');
    const gymId = url.searchParams.get('gymId');

    if (!gymId) {
      return new NextResponse('Missing gymId for SaaS security', { status: 400 });
    }

    if (!commandId && !pin) {
      return new NextResponse('Missing command ID or PIN', { status: 400 });
    }

    // Generate all PIN variants (e.g. "002", "2", "02")
    const pinVariants = new Set<string>();
    if (pin) {
      const cleanPin = pin.replace(/\D/g, '');
      const pinNum = parseInt(cleanPin, 10);
      if (cleanPin) pinVariants.add(cleanPin);
      if (!isNaN(pinNum)) {
        pinVariants.add(String(pinNum));
        for (let len = 1; len <= 8; len++) {
          pinVariants.add(String(pinNum).padStart(len, '0'));
        }
      }
    }

    // Fetch specific command
    let command = commandId ? await prisma.biometricCommand.findFirst({
      where: { id: commandId, device: { gymId } }
    }) : null;

    if (!command) {
      return NextResponse.json({ status: 'PENDING' });
    }

    // 1. If this exact command was marked SUCCESS:
    if (command.status === 'SUCCESS' || command.status === 'COMPLETED') {
      return NextResponse.json({ status: 'SUCCESS' });
    }

    // 2. If this exact command was marked FAILED by device (e.g. duplicate finger, machine rejection, ESC):
    if (command.status === 'FAILED' || command.status === 'ERROR') {
      return NextResponse.json({ 
        status: 'FAILED', 
        message: 'Fingerprint rejected by device (fingerprint is already in use or scan was cancelled).' 
      });
    }

    const isEnrollFp = command.commandString?.includes('ENROLL_FP');
    const ageSeconds = (Date.now() - new Date(command.createdAt).getTime()) / 1000;

    // 3. For ENROLL_FP in SENT / PENDING status:
    if (isEnrollFp) {
      // Check if cdata or devicecmd confirmed an enrollment for this PIN completed AFTER this command was created
      if (pinVariants.size > 0) {
        const newerSuccess = await prisma.biometricCommand.findFirst({
          where: {
            deviceId: command.deviceId,
            commandString: { contains: 'ENROLL_FP' },
            OR: Array.from(pinVariants).flatMap(p => [
              { commandString: { contains: `PIN=${p} ` } },
              { commandString: { contains: `PIN=${p}:` } },
              { commandString: { contains: `PIN=${p}\t` } },
              { commandString: { contains: `PIN=${p}` } }
            ]),
            status: { in: ['SUCCESS', 'COMPLETED'] },
            completedAt: { gte: command.createdAt }
          }
        });
        if (newerSuccess) {
          return NextResponse.json({ status: 'SUCCESS' });
        }
      }

      // Check timeout (90s)
      if (ageSeconds > ENROLL_TIMEOUT_SECONDS) {
        console.log(`[ENROLL TIMEOUT] Command ${command.id} for PIN ${pin} timed out after ${Math.round(ageSeconds)}s.`);
        await prisma.biometricCommand.update({
          where: { id: command.id },
          data: { status: 'FAILED', completedAt: new Date() }
        }).catch(console.error);
        return NextResponse.json({ 
          status: 'TIMEOUT', 
          message: 'Enrollment timed out on device. Please try again.' 
        });
      }

      // Within 90s, keep polling
      return NextResponse.json({ status: 'POLLING' });
    }

    return NextResponse.json({ status: command.status });
  } catch (error) {
    console.error('Command Status Error:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
