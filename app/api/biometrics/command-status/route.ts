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

    // 1. PRIMARY CHECK: If ANY recent ENROLL_FP command for this PIN succeeded in the last 5 minutes,
    // immediately return SUCCESS! This guarantees that as soon as the machine saves the finger,
    // the UI confirms success without getting stuck in a transient failure.
    if (pinVariants.size > 0) {
      const pinSuccessCmd = await prisma.biometricCommand.findFirst({
        where: {
          device: { gymId },
          commandString: { contains: 'ENROLL_FP' },
          OR: Array.from(pinVariants).flatMap(p => [
            { commandString: { contains: `PIN=${p}:` } },
            { commandString: { contains: `PIN=${p} ` } },
            { commandString: { contains: `PIN=${p}\t` } },
            { commandString: { contains: `PIN=${p}` } }
          ]),
          status: { in: ['SUCCESS', 'COMPLETED'] },
          createdAt: { gte: new Date(Date.now() - 5 * 60 * 1000) }
        },
        orderBy: { completedAt: 'desc' }
      });
      if (pinSuccessCmd) {
        return NextResponse.json({ status: 'SUCCESS', commandId: pinSuccessCmd.id });
      }
    }

    // 2. Fetch specific command if provided
    let command = commandId ? await prisma.biometricCommand.findFirst({
      where: { id: commandId, device: { gymId } }
    }) : null;

    if (!command) {
      return NextResponse.json({ status: 'PENDING' });
    }

    if (command.status === 'SUCCESS' || command.status === 'COMPLETED') {
      return NextResponse.json({ status: 'SUCCESS' });
    }

    const isEnrollFp = command.commandString?.includes('ENROLL_FP');
    const ageSeconds = (Date.now() - new Date(command.createdAt).getTime()) / 1000;

    // 3. For ENROLL_FP:
    if (isEnrollFp) {
      if (ageSeconds > ENROLL_TIMEOUT_SECONDS) {
        console.log(`[ENROLL TIMEOUT] Command ${command.id} for PIN ${pin} timed out after ${Math.round(ageSeconds)}s.`);
        await prisma.biometricCommand.update({
          where: { id: command.id },
          data: { status: 'FAILED', completedAt: new Date() }
        }).catch(console.error);
        return NextResponse.json({ 
          status: 'TIMEOUT', 
          message: 'Enrollment timed out. The device did not detect a fingerprint scan. Please try again.' 
        });
      }
      // While the user is within their 90-second enrollment window,
      // keep telling the frontend to keep polling (never prematurely declare failure)
      return NextResponse.json({ status: 'POLLING' });
    }

    // 4. For other commands (e.g. Card sync)
    if (command.status === 'FAILED' || command.status === 'ERROR') {
      return NextResponse.json({ status: 'ERROR' });
    }

    return NextResponse.json({ status: command.status });
  } catch (error) {
    console.error('Command Status Error:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
