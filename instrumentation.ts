export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Only run this initialization on the Node.js server (not Edge)
    try {
      console.log('🚀 [Instrumentation] Server starting, waking up WhatsApp Bot...');
      
      // Dynamic import to avoid loading Prisma at Edge
      const { default: db } = await import('./lib/db');
      const { WhatsAppManager } = await import('./lib/whatsapp');

      // Find all Gyms that have an active WhatsApp session in the database
      const activeSessions = await db.whatsAppSession.findMany({
        select: { gymId: true }
      });

      console.log(`[Instrumentation] Found ${activeSessions.length} active WhatsApp sessions to wake up.`);

      // Wake them all up
      for (const session of activeSessions) {
        console.log(`[Instrumentation] Waking up WhatsApp for Gym: ${session.gymId}`);
        WhatsAppManager.initSession(session.gymId);
      }
      
    } catch (e) {
      console.error('❌ [Instrumentation] Failed to wake up WhatsApp Bot:', e);
    }
  }
}
