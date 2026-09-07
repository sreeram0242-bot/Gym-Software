export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import prisma from '@/lib/db';

export async function GET() {
  const isSuperadmin = cookies().get('is_superadmin')?.value === 'true';
  if (!isSuperadmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const atts = await prisma.attendanceRecord.findMany({
    orderBy: { checkInTime: 'desc' },
    take: 10
  });
  return NextResponse.json(atts);
}
