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
  return Math.floor((b - a) / (1000 * 60 * 60 * 24));
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
    const gyms = await prisma.gym.findMany({
      include: {
        gymSettings: true,
        customers: {
          where: {
            status: 'active',
            waActive: true, // ONLY customers who opted into WhatsApp service
          },
          include: {
            attendance: {
              orderBy: { checkInTime: 'desc' },
              take: 1,
            }
          }
        }
      }
    });

    for (const gym of gyms) {
      const settings = gym.gymSettings;
      if (!settings) continue;

      // Skip if auto messages are disabled for this gym
      if (!settings.waAutoMessages) continue;

      const reminderWindowDays = settings.waReminderWindowDays ?? 3;
      const absentThresholdDays = settings.absentThresholdDays ?? 3;
      const gymName = gym.name;

      for (const customer of gym.customers) {
        // ── 1. EXPIRY REMINDER ───────────────────────────────────────────
        try {
          const daysUntilDue = daysBetween(todayStr, customer.nextDueDate);

          // Only send reminder if within the window (e.g. 3 days before due)
          if (daysUntilDue >= 0 && daysUntilDue <= reminderWindowDays) {
            // Prevent spam: only send once per due cycle
            // Check if we already sent a reminder in the last 'reminderWindowDays' days
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

              const sent = await WhatsAppManager.sendMessage(gym.id, customer.phone, message);
              if (sent) {
                await prisma.customer.update({
                  where: { id: customer.id },
                  data: { lastReminderSentDate: todayStr },
                });
                results.remindersSent++;
                console.log(`[CRON] ✅ Expiry reminder sent to ${customer.name} (${customer.phone})`);
              }
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
            // Prevent spam: only send once per month (every 30 days)
            const alreadySentAbsentee = customer.lastAbsenteeSentDate &&
              daysBetween(customer.lastAbsenteeSentDate, todayStr) < 30;

            if (!alreadySentAbsentee) {
              const template = getTemplate(settings, 'absentee');
              const message = compileTemplate(template, {
                name: customer.name,
                gymName,
                days: daysSinceLastVisit.toString(),
              });

              const sent = await WhatsAppManager.sendMessage(gym.id, customer.phone, message);
              if (sent) {
                await prisma.customer.update({
                  where: { id: customer.id },
                  data: { lastAbsenteeSentDate: todayStr },
                });
                results.absenteesSent++;
                console.log(`[CRON] ✅ Absentee reminder sent to ${customer.name} (${customer.phone}) — ${daysSinceLastVisit} days absent`);
              }
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
