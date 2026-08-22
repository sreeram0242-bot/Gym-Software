import { NextResponse } from 'next/server';
import { WhatsAppManager } from '@/lib/whatsapp';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { gymId } = body;
    
    if (!gymId) {
      return NextResponse.json({ error: 'Missing gymId' }, { status: 400 });
    }

    WhatsAppManager.logout(gymId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Logout error:', error);
    return NextResponse.json({ success: false, error: 'Internal error' }, { status: 500 });
  }
}
