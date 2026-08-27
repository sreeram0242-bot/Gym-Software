export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Only run this initialization on the Node.js server (not Edge)
    try {
      console.log('🚀 [Instrumentation] Server starting, waking up WhatsApp Bot...');
      
      // Dynamic import to avoid loading Prisma at Edge
      const { default: db } = await import('./lib/db');
      const { WhatsAppManager } = await import('./lib/whatsapp');

      // Find all distinct Gyms that have an active WhatsApp session in the database
      const activeSessions = await db.whatsAppSession.findMany({
        where: { id: { endsWith: '-creds' } },
        distinct: ['gymId'],
        select: { gymId: true }
      });

      console.log(`[Instrumentation] Found ${activeSessions.length} unique gym WhatsApp session(s) to wake up.`);

      // Wake each unique gym session once
      for (const session of activeSessions) {
        console.log(`[Instrumentation] Waking up WhatsApp for Gym: ${session.gymId}`);
        WhatsAppManager.initSession(session.gymId);
      }
      
    } catch (e) {
      console.error('❌ [Instrumentation] Failed to wake up WhatsApp Bot:', e);
    }
  }
}
