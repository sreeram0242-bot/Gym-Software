export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import prisma from '@/lib/db';

export async function GET() {
  const gyms = await prisma.gym.findMany({ select: { id: true, name: true } });
  const devices = await prisma.biometricDevice.findMany({ select: { id: true, serialNumber: true, gymId: true } });
  return NextResponse.json({ gyms, devices });
}
