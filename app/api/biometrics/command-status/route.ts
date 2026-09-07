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
      const pinCmd = await prisma.biometricCommand.findFirst({
        where: {
          device: { gymId },
          // Both conditions must match — use AND to avoid duplicate key TS error
          AND: [
            { commandString: { contains: `PIN=${pin}` } },
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
    // For ENROLL_FP: only 'SUCCESS' (set by cdata/hdata when fingerprint data arrives) counts.
    // 'COMPLETED' (set by devicecmd Return=0) is NOT a real success for fingerprint enrollment.
    let isSuccess = command.status === 'SUCCESS';
    // For non-FP commands (card sync, user data update), COMPLETED = success
    if (!isEnrollFp && command.status === 'COMPLETED') isSuccess = true;
    let isError = command.status === 'FAILED' || command.status === 'ERROR';

    // For ENROLL_FP: if still SENT/PENDING after ENROLL_TIMEOUT_SECONDS without fingerprint data,
    // declare TIMEOUT so the UI shows a real failure instead of spinning forever.
    if (isEnrollFp && !isSuccess && !isError && (command.status === 'SENT' || command.status === 'PENDING' || command.status === 'COMPLETED')) {
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

    // TCP Fallback removed — verifyUserExistsOnZkDevice only checks if the user PIN
    // exists on the device, NOT whether a fingerprint was actually enrolled. This caused
    // false "SUCCESS" when the device rejected a duplicate finger but the user already
    // existed from a prior enrollment or card registration.

    return NextResponse.json({ status: isSuccess ? 'SUCCESS' : isError ? 'ERROR' : command.status });
  } catch (error) {
    console.error('Command Status Error:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
