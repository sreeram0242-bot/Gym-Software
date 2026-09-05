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

    // 1. Fetch recent member attendance
    const recentMembers = await prisma.attendanceRecord.findMany({
      where: {
        gymId,
        OR: [
          { checkInTime: { gte: sinceIso } },
          { checkOutTime: { gte: sinceIso } }
        ]
      },
      orderBy: { checkInTime: 'desc' }
    });

    // 2. Fetch recent staff attendance
    const recentStaffs = await prisma.staffAttendanceRecord.findMany({
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

    let punches: any[] = [];

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
        durationMinutes: rec.durationMinutes || null,
        profilePic: rec.customerProfilePic || null
      };
    };

    for (const rec of recentMembers) {
      const event = evalEvent(rec, false);
      if (event) punches.push(event);
    }
    
    for (const rec of recentStaffs) {
      const event = evalEvent(rec, true);
      if (event) punches.push(event);
    }

    // Sort punches by timestamp ascending so we process them in chronological order
    punches.sort((a, b) => a.timestamp - b.timestamp);

    if (punches.length === 0) {
      return NextResponse.json({ hasPunch: false });
    }

    // We still return 'punch' for backwards compatibility, but mainly 'punches'
    return NextResponse.json({ hasPunch: true, punch: punches[punches.length - 1], punches });
  } catch (error: any) {
    console.error('recent-punch error:', error);
    return NextResponse.json({ hasPunch: false }, { status: 500 });
  }
}
