export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { verifyUserExistsOnZkDevice } from '@/lib/zk-device';

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

    // Check if any recent command for this PIN succeeded
    if ((!command || (command.status !== 'SUCCESS' && command.status !== 'COMPLETED')) && pin) {
      const pinCmd = await prisma.biometricCommand.findFirst({
        where: {
          device: { gymId },
          commandString: { contains: `PIN=${pin}` },
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

    let isSuccess = command.status === 'SUCCESS' || command.status === 'COMPLETED';
    let isError = command.status === 'FAILED' || command.status === 'ERROR';

    // TCP Fallback: If DB thinks it failed (e.g. intermediate ADMS status)
    // but this is an ENROLL command, check the physical device directly.
    if (isError && pin && command.commandString?.includes('ENROLL_FP')) {
      const existsOnDevice = await verifyUserExistsOnZkDevice(pin);
      if (existsOnDevice) {
        console.log(`[TCP FALLBACK] Command ${command.id} was marked ERROR in DB, but PIN ${pin} exists on device! Forcing SUCCESS.`);
        // Correct the DB in background (fire-and-forget)
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
