/**
 * Seed script: Generate 40 days of realistic fake attendance for all staff.
 * Run: node scripts/seed-staff-attendance.mjs
 */

import { PrismaClient } from '../generated/prisma/client.js';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import { config } from 'dotenv';
config();

const connectionString = process.env.DATABASE_URL;
const isSsl = connectionString?.includes('sslmode=require') || connectionString?.includes('ssl=true');
const pool = new pg.Pool({
  connectionString,
  connectionTimeoutMillis: 10000,
  ...(isSsl ? { ssl: { rejectUnauthorized: false } } : {}),
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const pad = (n) => String(n).padStart(2, '0');
const toDateStr = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const addMins = (d, m) => new Date(d.getTime() + m * 60000);

async function main() {
  const gym = await prisma.gym.findFirst({ orderBy: { createdAt: 'desc' } });
  if (!gym) { console.error('❌ No gym found.'); process.exit(1); }
  console.log(`\n✅ Gym: ${gym.name} (${gym.id})`);

  const staffList = await prisma.staff.findMany({ where: { gymId: gym.id } });
  if (!staffList.length) { console.error('❌ No staff found.'); process.exit(1); }
  console.log(`👥 Staff: ${staffList.map(s => s.name).join(', ')}\n`);

  const deleted = await prisma.staffAttendanceRecord.deleteMany({ where: { gymId: gym.id } });
  console.log(`🗑️  Cleared ${deleted.count} old records.`);

  const DAYS = 40;
  const today = new Date();
  const records = [];

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
        let checkInHour, shiftDurationMins;
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
  console.log(`\n✅ Inserted ${result.count} records for ${DAYS} days\n`);

  console.log('📊 Summary:');
  for (const staff of staffList) {
    const recs = records.filter(r => r.staffId === staff.id);
    const totalMins = recs.reduce((s, r) => s + (r.durationMinutes || 0), 0);
    const h = Math.floor(totalMins / 60), m = totalMins % 60;
    console.log(`  • ${staff.name} (${staff.role}): ${recs.length} shifts → ${h}h ${m}m`);
  }
  console.log('\n🎉 Done! Staffs → Team Directory → click Logs on any staff.\n');
}

main()
  .catch(e => { console.error('❌', e.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
