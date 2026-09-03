import { NextResponse } from 'next/server';
import prisma from '@/lib/db';

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const commandId = url.searchParams.get('id');
    const pin = url.searchParams.get('pin');

    if (!commandId && !pin) {
      return new NextResponse('Missing command ID or PIN', { status: 400 });
    }

    let command = commandId ? await prisma.biometricCommand.findUnique({
      where: { id: commandId }
    }) : null;

    // Check if any recent command for this PIN succeeded
    if ((!command || (command.status !== 'SUCCESS' && command.status !== 'COMPLETED')) && pin) {
      const pinCmd = await prisma.biometricCommand.findFirst({
        where: {
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

    const isSuccess = command.status === 'SUCCESS' || command.status === 'COMPLETED';
    const isError = command.status === 'FAILED' || command.status === 'ERROR';

    return NextResponse.json({ status: isSuccess ? 'SUCCESS' : isError ? 'ERROR' : command.status });
  } catch (error) {
    console.error('Command Status Error:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
