import { NextResponse } from 'next/server';
import { WhatsAppManager } from '@/lib/whatsapp';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const gymId = searchParams.get('gymId');
  
  if (!gymId) {
    return NextResponse.json({ error: 'Missing gymId' }, { status: 400 });
  }

  // Trigger initialization in the background if not already running
  WhatsAppManager.initSession(gymId);
  
  const status = WhatsAppManager.getStatus(gymId);
  return NextResponse.json(status);
}
