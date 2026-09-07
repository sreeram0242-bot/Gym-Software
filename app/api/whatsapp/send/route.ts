import { NextResponse } from 'next/server';
import { WhatsAppManager } from '@/lib/whatsapp';
import db from '@/lib/db';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { gymId, phone, message } = body;
    
    if (!gymId || !phone || !message) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
    }

    const cleanDigits = String(phone).replace(/[^0-9]/g, '');
    const shortPhone = cleanDigits.length === 12 && cleanDigits.startsWith('91') ? cleanDigits.substring(2) : cleanDigits;

    const customer = await db.customer.findFirst({
      where: { gymId, phone: { contains: shortPhone } },
      select: { id: true, name: true, waActive: true }
    });

    if (customer && !customer.waActive) {
      return NextResponse.json({ 
        success: false, 
        error: `${customer.name} has not activated WhatsApp yet. They must message "start" first.` 
      }, { status: 400 });
    }

    const success = await WhatsAppManager.sendMessage(gymId, phone, message);
    return NextResponse.json({ success });
  } catch (error) {
    console.error('Send message error:', error);
    return NextResponse.json({ success: false, error: 'Internal error' }, { status: 500 });
  }
}
