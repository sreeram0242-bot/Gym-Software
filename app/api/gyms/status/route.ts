import { NextResponse } from 'next/server';
import db from '@/lib/db';

export const dynamic = 'force-dynamic';

// Lightweight endpoint — returns only the gym's current status.
// Polled every 30s by the dashboard layout to detect live suspension.
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const gymId = searchParams.get('gymId');

    if (!gymId) {
      return NextResponse.json({ error: 'gymId is required' }, { status: 400 });
    }

    const gym = await db.gym.findUnique({
      where: { id: gymId },
      select: { status: true }
    });

    if (!gym) {
      return NextResponse.json({ error: 'Gym not found' }, { status: 404 });
    }

    return NextResponse.json({ status: gym.status });
  } catch (error) {
    console.error('[/api/gyms/status] Error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
