export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import prisma from '@/lib/db';

export async function GET() {
  const customers = await prisma.customer.findMany({
    select: { id: true, name: true, nfcCardId: true, fingerprintId: true, memberId: true }
  });
  return NextResponse.json(customers);
}
