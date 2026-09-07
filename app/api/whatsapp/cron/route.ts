import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { WhatsAppManager } from '@/lib/whatsapp';
import { getTemplate, compileTemplate } from '@/lib/templates';

function getLocalTodayStr() {
  const now = new Date();
  // Use IST (UTC+5:30)
  const offset = 5.5 * 60 * 60 * 1000;
  const local = new Date(now.getTime() + offset);
  return local.toISOString().split('T')[0];
}

function daysBetween(dateStrA: string, dateStrB: string) {
  const a = new Date(dateStrA).getTime();
  const b = new Date(dateStrB).getTime();
  return Math.round((b - a) / (1000 * 60 * 60 * 24));
}

export async function GET(request: Request) {
  // Optional secret key protection to prevent unauthorized triggering
  const url = new URL(request.url);
  const secret = url.searchParams.get('secret');
  const expectedSecret = process.env.CRON_SECRET;
  if (expectedSecret && secret !== expectedSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const todayStr = getLocalTodayStr();
  const results = { remindersSent: 0, absenteesSent: 0, errors: [] as string[] };

  try {
    // RAM Fix: Only load gyms, load customers iteratively
    const gyms = await prisma.gym.findMany({
      include: { gymSettings: true }
    });

    for (const gym of gyms) {
      const settings = gym.gymSettings;
      if (!settings || !settings.waAutoMessages) continue;

      const reminderWindowDays = settings.waReminderWindowDays ?? 3;
      const absentThresholdDays = settings.absentThresholdDays ?? 3;
      const gymName = gym.name;

      const customers = await prisma.customer.findMany({
        where: { gymId: gym.id, status: 'active', waActive: true },
        include: { attendance: { orderBy: { checkInTime: 'desc' }, take: 1 } }
      });

      for (const customer of customers) {
        // ── 1. EXPIRY REMINDER ───────────────────────────────────────────
        try {
          const daysUntilDue = daysBetween(todayStr, customer.nextDueDate);

          // Send reminder if within the window or up to 7 days overdue
          if (daysUntilDue >= -7 && daysUntilDue <= reminderWindowDays) {
            const alreadySentReminder = customer.lastReminderSentDate &&
              daysBetween(customer.lastReminderSentDate, todayStr) < reminderWindowDays;

            if (!alreadySentReminder) {
              const template = getTemplate(settings, 'reminder');
              const message = compileTemplate(template, {
                name: customer.name,
                gymName,
                amount: customer.feeAmount.toString(),
                dueDate: customer.nextDueDate,
              });

              // Fire & Forget queue to prevent Nginx timeouts
              WhatsAppManager.sendMessage(gym.id, customer.phone, message).then((sent) => {
                if (sent) {
                  prisma.customer.update({
                    where: { id: customer.id },
                    data: { lastReminderSentDate: todayStr },
                  }).catch(() => {});
                }
              });
              
              results.remindersSent++;
              console.log(`[CRON] ✅ Expiry reminder queued for ${customer.name} (${customer.phone})`);
            }
          }
        } catch (err: any) {
          results.errors.push(`Reminder for ${customer.name}: ${err.message}`);
        }

        // ── 2. ABSENTEE REMINDER ─────────────────────────────────────────
        try {
          if (!settings.absentTrackingEnabled) continue;

          const lastCheckIn = customer.attendance[0]?.checkInTime;
          if (!lastCheckIn) continue; // Never visited at all, skip

          const lastCheckInDate = lastCheckIn.split('T')[0];
          const daysSinceLastVisit = daysBetween(lastCheckInDate, todayStr);

          // Only send if absent for more than threshold
          if (daysSinceLastVisit >= absentThresholdDays) {
            // Prevent spam: only send if we haven't reminded them SINCE their last check-in
            const alreadySentAbsentee = customer.lastAbsenteeSentDate &&
              (new Date(customer.lastAbsenteeSentDate).getTime() > new Date(lastCheckInDate).getTime() || customer.lastAbsenteeSentDate === todayStr);

            if (!alreadySentAbsentee) {
              const template = getTemplate(settings, 'absentee');
              const message = compileTemplate(template, {
                name: customer.name,
                gymName,
                days: daysSinceLastVisit.toString(),
              });

              // Fire & Forget queue to prevent Nginx timeouts
              WhatsAppManager.sendMessage(gym.id, customer.phone, message).then((sent) => {
                if (sent) {
                  prisma.customer.update({
                    where: { id: customer.id },
                    data: { lastAbsenteeSentDate: todayStr },
                  }).catch(() => {});
                }
              });
              
              results.absenteesSent++;
              console.log(`[CRON] ✅ Absentee reminder queued for ${customer.name} (${customer.phone}) — ${daysSinceLastVisit} days absent`);
            }
          }
        } catch (err: any) {
          results.errors.push(`Absentee for ${customer.name}: ${err.message}`);
        }
      }
    }

    return NextResponse.json({
      success: true,
      date: todayStr,
      ...results,
    });
  } catch (error: any) {
    console.error('[CRON] Fatal error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
