import { NextResponse } from 'next/server';
import { WhatsAppManager } from '@/lib/whatsapp';
import db from '@/lib/db';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { gymId, message, mediaBase64, audience } = body;
    
    if (!gymId || !message || !audience) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
    }

    // Fetch customers based on audience
    let customers = [];
    if (audience === 'all') {
      customers = await db.customer.findMany({ where: { gymId, waActive: true } });
    } else {
      customers = await db.customer.findMany({ where: { gymId, status: audience, waActive: true } });
    }

    let queuedCount = 0;

    for (const customer of customers) {
      if (customer.phone) {
        // We do NOT await this because we want it to push to the queue instantly and respond to the frontend.
        WhatsAppManager.sendMessage(gymId, customer.phone, message, mediaBase64).catch(e => console.error(e));
        queuedCount++;
      }
    }

    return NextResponse.json({ success: true, queuedCount });
  } catch (error) {
    console.error('Broadcast error:', error);
    return NextResponse.json({ success: false, error: 'Internal error' }, { status: 500 });
  }
}
