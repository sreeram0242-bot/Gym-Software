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

    let command = commandId ? await prisma.biometricCommand.findFirst({
      where: { id: commandId, device: { gymId } }
    }) : null;

    // Fallback: If no commandId is provided, check if any recent ENROLL_FP command for this PIN succeeded
    if (!commandId && pin) {
      const cleanPin = pin.replace(/\D/g, '');
      const trimmedPin = cleanPin.replace(/^0+/, '') || cleanPin;
      const pinCmd = await prisma.biometricCommand.findFirst({
        where: {
          device: { gymId },
          AND: [
            {
              OR: [
                { commandString: { contains: `PIN=${cleanPin}` } },
                { commandString: { contains: `PIN=${trimmedPin}` } }
              ]
            },
            { commandString: { contains: 'ENROLL_FP' } },
          ],
          status: { in: ['SUCCESS', 'COMPLETED'] },
          createdAt: {
            gte: new Date(Date.now() - 5 * 60 * 1000) // Only check last 5 minutes
          }
        },
        orderBy: { createdAt: 'desc' }
      });
      if (pinCmd) {
        command = pinCmd;
      }
    }

    if (!command) {
      return NextResponse.json({ status: 'PENDING' });
    }

    const isEnrollFp = command.commandString?.includes('ENROLL_FP');
    let isSuccess = command.status === 'SUCCESS' || command.status === 'COMPLETED';
    let isError = !isSuccess && (command.status === 'FAILED' || command.status === 'ERROR');

    // If polling specific command didn't mark success yet, check if any recent ENROLL_FP for this PIN succeeded
    if (isEnrollFp && !isSuccess && pin) {
      const cleanPin = pin.replace(/\D/g, '');
      const trimmedPin = cleanPin.replace(/^0+/, '') || cleanPin;
      const pinSuccessCmd = await prisma.biometricCommand.findFirst({
        where: {
          device: { gymId },
          AND: [
            {
              OR: [
                { commandString: { contains: `PIN=${cleanPin}` } },
                { commandString: { contains: `PIN=${trimmedPin}` } }
              ]
            },
            { commandString: { contains: 'ENROLL_FP' } },
          ],
          status: { in: ['SUCCESS', 'COMPLETED'] },
          createdAt: { gte: new Date(Date.now() - 3 * 60 * 1000) }
        }
      });
      if (pinSuccessCmd) {
        isSuccess = true;
        isError = false;
      }
    }

    // For ENROLL_FP: if still SENT/PENDING after ENROLL_TIMEOUT_SECONDS without confirmation,
    // declare TIMEOUT so the UI shows a real failure instead of spinning forever.
    if (isEnrollFp && !isSuccess && !isError && (command.status === 'SENT' || command.status === 'PENDING')) {
      const ageSeconds = (Date.now() - new Date(command.createdAt).getTime()) / 1000;
      if (ageSeconds > ENROLL_TIMEOUT_SECONDS) {
        console.log(`[ENROLL TIMEOUT] Command ${command.id} for PIN ${pin} timed out after ${Math.round(ageSeconds)}s. Device never confirmed fingerprint data.`);
        await prisma.biometricCommand.update({
          where: { id: command.id },
          data: { status: 'FAILED', completedAt: new Date() }
        }).catch(console.error);
        return NextResponse.json({ 
          status: 'TIMEOUT', 
          message: 'Enrollment timed out. The device did not detect a fingerprint scan. Please try again.' 
        });
      }
    }

    return NextResponse.json({ status: isSuccess ? 'SUCCESS' : isError ? 'ERROR' : command.status });
  } catch (error) {
    console.error('Command Status Error:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
