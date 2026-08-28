import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';

const pad = (n: number) => String(n).padStart(2, '0');
const toDateStr = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const rand = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;
const addMins = (d: Date, m: number) => new Date(d.getTime() + m * 60000);

export async function GET(req: NextRequest) {
  try {
    // Find the gym
    const gym = await prisma.gym.findFirst({ orderBy: { createdAt: 'desc' } });
    if (!gym) return NextResponse.json({ error: 'No gym found' }, { status: 404 });

    // Get all staff
    const staffList = await prisma.staff.findMany({ where: { gymId: gym.id } });
    if (!staffList.length) return NextResponse.json({ error: 'No staff found' }, { status: 404 });

    // Clear old attendance
    const deleted = await prisma.staffAttendanceRecord.deleteMany({ where: { gymId: gym.id } });

    const DAYS = 40;
    const today = new Date();
    const records: any[] = [];

    for (let dayOffset = DAYS - 1; dayOffset >= 0; dayOffset--) {
      const date = new Date(today);
      date.setDate(today.getDate() - dayOffset);
      const dateStr = toDateStr(date);
      if (date.getDay() === 0) continue; // Skip Sundays

      for (const staff of staffList) {
        if (Math.random() < 0.10) continue; // ~10% random day off

        const isTrainer = staff.role?.toLowerCase().includes('train');
        const numShifts = isTrainer && Math.random() < 0.3 ? 2 : 1;

        for (let shift = 0; shift < numShifts; shift++) {
          let checkInHour: number, shiftDurationMins: number;

          if (isTrainer) {
            checkInHour = shift === 0 ? rand(6, 9) : rand(15, 17);
            shiftDurationMins = shift === 0 ? rand(180, 330) : rand(120, 240);
          } else {
            checkInHour = rand(8, 10);
            shiftDurationMins = rand(420, 540);
          }

          const checkIn = new Date(date);
          checkIn.setHours(checkInHour, rand(0, 45), 0, 0);
          const checkOut = addMins(checkIn, shiftDurationMins);

          records.push({
            gymId: gym.id,
            staffId: staff.id,
            staffName: staff.name,
            staffPhone: staff.phone,
            checkInTime: checkIn.toISOString(),
            checkOutTime: checkOut.toISOString(),
            durationMinutes: shiftDurationMins,
            dateStr,
          });
        }
      }
    }

    const result = await prisma.staffAttendanceRecord.createMany({ data: records });

    // Summary
    const summary = staffList.map(staff => {
      const recs = records.filter(r => r.staffId === staff.id);
      const totalMins = recs.reduce((s: number, r: any) => s + (r.durationMinutes || 0), 0);
      return {
        name: staff.name,
        role: staff.role,
        shifts: recs.length,
        totalHours: `${Math.floor(totalMins / 60)}h ${totalMins % 60}m`,
      };
    });

    return NextResponse.json({
      success: true,
      gym: gym.name,
      days: DAYS,
      deleted: deleted.count,
      inserted: result.count,
      summary,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
