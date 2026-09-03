export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import prisma from '@/lib/db';

export async function GET() {
  const atts = await prisma.attendanceRecord.findMany({
    orderBy: { checkInTime: 'desc' },
    take: 10
  });
  return NextResponse.json(atts);
}
