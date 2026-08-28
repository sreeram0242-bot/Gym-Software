/**
 * Seed script: Generate 40 days of realistic fake attendance for all staff in the active gym.
 * Run: npx ts-node --project tsconfig.json scripts/seed-staff-attendance.ts
 */

import { PrismaClient } from '../generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import * as dotenv from 'dotenv';
dotenv.config();

const connectionString = process.env.DATABASE_URL!;
const isSsl = connectionString?.includes('sslmode=require') || connectionString?.includes('ssl=true');
const pool = new pg.Pool({
  connectionString,
  connectionTimeoutMillis: 10000,
  ...(isSsl ? { ssl: { rejectUnauthorized: false } } : {}),
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

function pad(n: number) { return String(n).padStart(2, '0'); }
function toLocalDate(d: Date) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
function randomBetween(min: number, max: number) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function addMinutes(date: Date, minutes: number) { return new Date(date.getTime() + minutes * 60000); }

async function main() {
  // 1. Find the gym
  const gym = await prisma.gym.findFirst({ orderBy: { createdAt: 'desc' } });
  if (!gym) { console.error('❌ No gym found.'); process.exit(1); }
  console.log(`\n✅ Gym: ${gym.name} (${gym.id})`);

  // 2. Get all staff
  const staffList = await prisma.staff.findMany({ where: { gymId: gym.id } });
  if (staffList.length === 0) { console.error('❌ No staff found. Add staff members first.'); process.exit(1); }
  console.log(`👥 Staff: ${staffList.map((s: any) => s.name).join(', ')}\n`);

  // 3. Clear existing attendance
  const deleted = await prisma.staffAttendanceRecord.deleteMany({ where: { gymId: gym.id } });
  console.log(`🗑️  Cleared ${deleted.count} old records.`);

  // 4. Generate 40 days
  const DAYS = 40;
  const today = new Date();
  const records: any[] = [];

  for (let dayOffset = DAYS - 1; dayOffset >= 0; dayOffset--) {
    const date = new Date(today);
    date.setDate(today.getDate() - dayOffset);
    const dateStr = toLocalDate(date);
    const dayOfWeek = date.getDay(); // 0=Sun

    for (const staff of staffList) {
      if (dayOfWeek === 0) continue;       // Sundays off
      if (Math.random() < 0.10) continue; // ~10% random off-day

      const isTrainer = staff.role?.toLowerCase().includes('train');
      const numShifts = isTrainer && Math.random() < 0.3 ? 2 : 1;

      for (let shift = 0; shift < numShifts; shift++) {
        let checkInHour: number;
        let shiftDurationMins: number;

        if (isTrainer) {
          checkInHour = shift === 0 ? randomBetween(6, 9) : randomBetween(15, 17);
          shiftDurationMins = shift === 0 ? randomBetween(180, 330) : randomBetween(120, 240);
        } else {
          checkInHour = randomBetween(8, 10);
          shiftDurationMins = randomBetween(420, 540);
        }

        const checkIn = new Date(date);
        checkIn.setHours(checkInHour, randomBetween(0, 45), 0, 0);
        const checkOut = addMinutes(checkIn, shiftDurationMins);

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

  // 5. Insert
  const result = await prisma.staffAttendanceRecord.createMany({ data: records });
  console.log(`\n✅ Inserted ${result.count} attendance records for ${DAYS} days`);

  // 6. Summary
  console.log('\n📊 Summary:');
  for (const staff of staffList) {
    const staffRecs = records.filter((r: any) => r.staffId === staff.id);
    const totalMins = staffRecs.reduce((s: number, r: any) => s + (r.durationMinutes || 0), 0);
    const h = Math.floor(totalMins / 60), m = totalMins % 60;
    console.log(`  • ${staff.name} (${staff.role}): ${staffRecs.length} shifts → ${h}h ${m}m total`);
  }
  console.log('\n🎉 Done! Go to Staffs → Team Directory → Logs to view.\n');
}

main()
  .catch(e => { console.error('❌ Error:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
