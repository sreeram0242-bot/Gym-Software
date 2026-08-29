import { NextResponse } from 'next/server';
import prisma from '@/lib/db';

// Force dynamic so it always fetches fresh DB data
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const devices = await prisma.biometricDevice.findMany({
      orderBy: { lastActive: 'desc' }
    });

    const commands = await prisma.biometricCommand.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10
    });

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      devices,
      recentCommands: commands
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
