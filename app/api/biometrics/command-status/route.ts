export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { verifyUserExistsOnZkDevice } from '@/lib/zk-device';

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

    // Check if any recent ENROLL_FP command for this PIN succeeded (fingerprint data arrived via cdata/hdata)
    if ((!command || (command.status !== 'SUCCESS' && command.status !== 'COMPLETED')) && pin) {
      const pinCmd = await prisma.biometricCommand.findFirst({
        where: {
          device: { gymId },
          commandString: { contains: `PIN=${pin}` },
          // Only look at enroll commands that succeeded — not delete acks or card commands
          commandString: { contains: 'ENROLL_FP' },
          status: { in: ['SUCCESS', 'COMPLETED'] }
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

    // Fix Issue A: TCP Fallback — look up the gym's actual device IP before checking the physical device.
    // Previously called verifyUserExistsOnZkDevice(pin) with no IP → fell back to wrong env var.
    if (isError && pin && isEnrollFp) {
      const gymSettings = await prisma.gymSettings.findFirst({ where: { gymId } });
      const deviceIp = gymSettings?.deviceIpAddress || process.env.ZK_DEVICE_IP || '192.168.137.188';

      const existsOnDevice = await verifyUserExistsOnZkDevice(pin, deviceIp);
      if (existsOnDevice) {
        console.log(`[TCP FALLBACK] Command ${command.id} marked ERROR/FAILED, but PIN ${pin} exists on device ${deviceIp}! Forcing SUCCESS.`);
        prisma.biometricCommand.update({
          where: { id: command.id },
          data: { status: 'SUCCESS' }
        }).catch(console.error);
        
        isSuccess = true;
        isError = false;
      }
    }

    return NextResponse.json({ status: isSuccess ? 'SUCCESS' : isError ? 'ERROR' : command.status });
  } catch (error) {
    console.error('Command Status Error:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
