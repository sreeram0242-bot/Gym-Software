export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import prisma from '@/lib/db';

export async function GET() {
  const isSuperadmin = cookies().get('is_superadmin')?.value === 'true';
  if (!isSuperadmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const customers = await prisma.customer.findMany({
    select: { id: true, name: true, nfcCardId: true, fingerprintId: true, memberId: true }
  });
  return NextResponse.json(customers);
}
