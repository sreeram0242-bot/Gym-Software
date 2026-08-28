import { NextResponse } from 'next/server';
import { processDailyAutomatedReminders } from '@/lib/actions';

export async function POST(req: Request) {
  try {
    const { gymId } = await req.json();
    if (!gymId) {
      return NextResponse.json({ error: 'gymId is required' }, { status: 400 });
    }

    const result = await processDailyAutomatedReminders(gymId);
    return NextResponse.json(result);
  } catch (err: any) {
    console.error('Auto reminders API error:', err);
    return NextResponse.json({ error: err?.message || 'Internal Server Error' }, { status: 500 });
  }
}
