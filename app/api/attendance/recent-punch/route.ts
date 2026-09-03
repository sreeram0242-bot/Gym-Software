import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const gymId = searchParams.get('gymId') || cookies().get('active_gym_id')?.value;
    const since = searchParams.get('since') ? parseInt(searchParams.get('since')!, 10) : (Date.now() - 15000);
    const sinceIso = new Date(since).toISOString();

    if (!gymId) {
      return NextResponse.json({ hasPunch: false });
    }

    // 1. Fetch most recent member attendance
    const recentMember = await prisma.attendanceRecord.findFirst({
      where: {
        gymId,
        OR: [
          { checkInTime: { gte: sinceIso } },
          { checkOutTime: { gte: sinceIso } }
        ]
      },
      orderBy: { checkInTime: 'desc' }
    });

    // 2. Fetch most recent staff attendance
    const recentStaff = await prisma.staffAttendanceRecord.findFirst({
      where: {
        gymId,
        OR: [
          { checkInTime: { gte: sinceIso } },
          { checkOutTime: { gte: sinceIso } }
        ]
      },
      include: {
        staff: {
          select: { role: true }
        }
      },
      orderBy: { checkInTime: 'desc' }
    });

    let punch: any = null;

    // Helper to evaluate punch event
    const evalEvent = (rec: any, isStaff = false) => {
      if (!rec) return null;
      const inTime = new Date(rec.checkInTime).getTime();
      const outTime = rec.checkOutTime ? new Date(rec.checkOutTime).getTime() : 0;
      
      const isOutRecent = outTime >= since;
      const isInRecent = inTime >= since;

      if (!isOutRecent && !isInRecent) return null;

      const isOut = isOutRecent && (!isInRecent || outTime >= inTime);
      const actionTime = isOut ? outTime : inTime;

      return {
        timestamp: actionTime,
        type: isStaff ? 'staff' : 'member',
        id: rec.id + (isOut ? '-out' : '-in'),
        name: isStaff ? (rec.staffName || 'Staff') : (rec.customerName || 'Member'),
        role: isStaff ? (rec.staff?.role || 'Staff') : 'Member',
        action: isOut ? 'checkout' : 'checkin',
        time: new Date(actionTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        durationMinutes: rec.durationMinutes || null
      };
    };

    const memberEvent = evalEvent(recentMember, false);
    const staffEvent = evalEvent(recentStaff, true);

    if (memberEvent && staffEvent) {
      punch = memberEvent.timestamp >= staffEvent.timestamp ? memberEvent : staffEvent;
    } else {
      punch = memberEvent || staffEvent;
    }

    if (!punch) {
      return NextResponse.json({ hasPunch: false });
    }

    return NextResponse.json({ hasPunch: true, punch });
  } catch (error: any) {
    console.error('recent-punch error:', error);
    return NextResponse.json({ hasPunch: false }, { status: 500 });
  }
}
