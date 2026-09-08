import { NextResponse } from 'next/server';
import prisma from '@/lib/db';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const gymId = searchParams.get('gymId');

  if (!gymId) {
    return NextResponse.json({ error: 'Missing gymId' }, { status: 400 });
  }

  try {
    const customers = await prisma.customer.findMany({
      where: {
        gymId,
        isArchived: false,
        mantraFpData: { not: null },
      },
      select: {
        id: true,
        name: true,
        mantraFpData: true,
      },
    });

    const staff = await prisma.staff.findMany({
      where: {
        gymId,
        isArchived: false,
        mantraFpData: { not: null },
      },
      select: {
        id: true,
        name: true,
        role: true,
        mantraFpData: true,
      },
    });

    const templates = [
      ...customers.map(c => ({
        id: c.id,
        name: c.name,
        role: 'Member',
        template: c.mantraFpData,
      })),
      ...staff.map(s => ({
        id: s.id,
        name: s.name,
        role: s.role,
        template: s.mantraFpData,
      })),
    ];

    return NextResponse.json({ success: true, templates });
  } catch (error: any) {
    console.error('Mantra Sync Error:', error);
    return NextResponse.json({ error: 'Failed to fetch templates' }, { status: 500 });
  }
}
