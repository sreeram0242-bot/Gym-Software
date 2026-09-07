const baileys = eval('require')('@whiskeysockets/baileys');
const { makeWASocket, useMultiFileAuthState, DisconnectReason, Browsers } = baileys;
const QRCode = eval('require')('qrcode');
const pino = eval('require')('pino');
// fs and path removed

// Supress verbose logging
const logger = pino({ level: 'silent' }) as any;

const globalAny: any = global;

if (!globalAny.WhatsAppSessions) {
  globalAny.WhatsAppSessions = new Map<string, any>();
  globalAny.WhatsAppQRs = new Map<string, string>();
  globalAny.WhatsAppStatuses = new Map<string, string>();
  
  // Anti-ban message queue
  globalAny.WhatsAppMessageQueue = [];
  globalAny.WhatsAppQueueProcessing = false;
}

import db from './db';
import { getTemplate, compileTemplate } from './templates';
import { formatDateDDMMYYYY } from './utils';

async function usePrismaAuthState(gymId: string) {
  const { initAuthCreds, BufferJSON, proto } = baileys;
  
  let creds: any;
  const credsId = `${gymId}-creds`;
  
  const existingCreds = await db.whatsAppSession.findUnique({ where: { id: credsId } });
  if (existingCreds) {
    creds = JSON.parse(existingCreds.data, BufferJSON.reviver);
  } else {
    creds = initAuthCreds();
  }

  const saveCreds = async () => {
    const data = JSON.stringify(creds, BufferJSON.replacer);
    await db.whatsAppSession.upsert({
      where: { id: credsId },
      update: { data },
      create: { id: credsId, gymId, data }
    });
  };

  const readData = async (type: string, id: string) => {
    const key = `${gymId}-${type}-${id}`;
    const record = await db.whatsAppSession.findUnique({ where: { id: key } });
    return record ? JSON.parse(record.data, BufferJSON.reviver) : null;
  };

  const writeData = async (data: any, type: string, id: string) => {
    const key = `${gymId}-${type}-${id}`;
    const value = JSON.stringify(data, BufferJSON.replacer);
    await db.whatsAppSession.upsert({
      where: { id: key },
      update: { data: value },
      create: { id: key, gymId, data: value }
    });
  };

  const removeData = async (type: string, id: string) => {
    const key = `${gymId}-${type}-${id}`;
    try { await db.whatsAppSession.delete({ where: { id: key } }); } catch(e) {}
  };

  return {
    state: {
      creds,
      keys: {
        get: async (type: string, ids: string[]) => {
          const data: any = {};
          await Promise.all(
            ids.map(async id => {
              let value = await readData(type, id);
              if (type === 'app-state-sync-key' && value) {
                value = proto.Message.AppStateSyncKeyData.fromObject(value);
              }
              data[id] = value;
            })
          );
          return data;
        },
        set: async (data: any) => {
          const tasks: Promise<any>[] = [];
          for (const category in data) {
            for (const id in data[category]) {
              const value = data[category][id];
              if (value) {
                tasks.push(writeData(value, category, id));
              } else {
                tasks.push(removeData(category, id));
              }
            }
          }
          await Promise.all(tasks);
        }
      }
    },
    saveCreds
  };
}

export class WhatsAppManager {
  static async initSession(gymId: string) {
    if (globalAny.WhatsAppStatuses.get(gymId) === 'initializing' || globalAny.WhatsAppSessions.has(gymId)) {
      return;
    }

    globalAny.WhatsAppStatuses.set(gymId, 'initializing');
    if (globalAny.WhatsAppErrors) {
      globalAny.WhatsAppErrors.delete(gymId);
    }
    
    try {
      const { state, saveCreds } = await usePrismaAuthState(gymId);

      const sock = makeWASocket({
        auth: state,
        printQRInTerminal: false,
        logger,
        browser: Browsers.macOS('Desktop'),
        syncFullHistory: false, // Save memory
        markOnlineOnConnect: false, // Anti-ban measure
      });

    globalAny.WhatsAppSessions.set(gymId, sock);

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update: any) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        try {
          const qrDataUrl = await QRCode.toDataURL(qr);
          globalAny.WhatsAppQRs.set(gymId, qrDataUrl);
          globalAny.WhatsAppStatuses.set(gymId, 'scan_qr');
        } catch (e) {
          console.error('QR Generate Error:', e);
        }
      }

      if (connection === 'close') {
        const shouldReconnect = (lastDisconnect?.error as any)?.output?.statusCode !== DisconnectReason.loggedOut;
        globalAny.WhatsAppStatuses.set(gymId, 'disconnected');
        
        const oldSock = globalAny.WhatsAppSessions.get(gymId);
        if (oldSock) {
           try {
             if (oldSock.ws) oldSock.ws.close();
             if (oldSock.end) oldSock.end(undefined);
           } catch(e) {}
        }
        globalAny.WhatsAppSessions.delete(gymId);
        
        if (shouldReconnect) {
          // Auto reconnect
          setTimeout(() => this.initSession(gymId), 5000);
        } else {
          // Logged out, clean up auth
          try {
            await db.whatsAppSession.deleteMany({ where: { gymId } });
          } catch (e) {}
          globalAny.WhatsAppQRs.delete(gymId);
        }
      } else if (connection === 'open') {
        globalAny.WhatsAppStatuses.set(gymId, 'connected');
        globalAny.WhatsAppQRs.delete(gymId);
      }
    });

    sock.ev.on('messages.upsert', async ({ messages, type }: { messages: any[], type: string }) => {
      try {
      console.log('[WA DEBUG] messages.upsert triggered:', type);
      if (type !== 'notify') return;
      const m = messages[0];
      if (!m.message || m.key.fromMe) return;

      let senderJid = m.key.remoteJid;
      
      // Handle LID (Linked Identity JID) resolution
      if (senderJid && senderJid.includes('@lid')) {
        try {
           const pnJid = await (sock as any).signalRepository?.lidMapping?.getPNForLID?.(senderJid);
           if (pnJid) {
             console.log('[WA DEBUG] Resolved LID to PN:', pnJid);
             senderJid = pnJid;
           } else if (m.participant) {
             senderJid = m.participant;
           }
        } catch (e) {
           console.log('[WA DEBUG] LID resolution error:', e);
        }
      }
      
      console.log('[WA DEBUG] Sender JID:', senderJid);
      if (!senderJid || senderJid.includes('@g.us')) return;

      const text = m.message.conversation || m.message.extendedTextMessage?.text;
      console.log('[WA DEBUG] Received text:', text);
      if (!text) return;
      const cleanText = text.trim().toLowerCase();

      // Ensure auto-reply is on
      let waAutoReply = true;
      let settings: any = null;
      try {
        settings = await db.gymSettings.findUnique({ where: { gymId } });
        console.log('[WA DEBUG] Auto-reply setting:', settings?.waAutoReply);
        waAutoReply = settings?.waAutoReply ?? true;
      } catch (e) {
        console.log('[WA DEBUG] Could not fetch settings (schema mismatch?), defaulting to true');
      }
      
      if (!waAutoReply) return;

      // Extract phone (strip @s.whatsapp.net and any :deviceId)
      const fullPhone = senderJid.split('@')[0].split(':')[0];
      const shortPhone = fullPhone.length === 12 && fullPhone.startsWith('91') ? fullPhone.substring(2) : fullPhone;
      console.log('[WA DEBUG] Searching customer with phone:', shortPhone);

      // Find customer safely ignoring spaces/symbols in DB (Filtered at DB level to prevent RAM exhaustion)
      const customer = await db.customer.findFirst({
        where: { gymId, status: 'active', phone: { contains: shortPhone } }
      });
      
      if (!customer) {
        console.log('[WA DEBUG] Customer not found for phone:', shortPhone);
        if (senderJid.includes('@lid')) {
           console.log('[WA DEBUG] Full Unresolved LID Message Object:', JSON.stringify(m, null, 2));
        }
        return;
      }
      
      console.log('[WA DEBUG] Found customer:', customer.name, 'Processing keyword:', cleanText);

      const isStart = cleanText === 'start' || cleanText === 'menu' || cleanText === 'hi' || cleanText === 'hello';
      const isPlanOrDue = cleanText === 'plan' || cleanText === 'due date' || cleanText === 'due' || cleanText === '1';
      const isPayment = cleanText === 'payment' || cleanText === 'payments' || cleanText === '2';
      const isAttendance = cleanText === 'attendance' || cleanText === 'attend' || cleanText === '3';

      // WhatsApp services work ONLY after the member sends 'start'
      if (!customer.waActive) {
        if (isStart) {
          // Member sent 'start' -> Activate WhatsApp services
          try {
            await db.customer.update({
              where: { id: customer.id },
              data: { waActive: true }
            });
            console.log('[WA DEBUG] Customer activated WhatsApp services via start:', customer.name);
            customer.waActive = true;
          } catch (e) {
            console.error('[WA DEBUG] Failed to activate customer:', e);
          }
        } else {
          // Member has not activated WhatsApp services yet and sent something other than 'start'
          console.log('[WA DEBUG] Inactive customer messaged without start. Replying with activation instructions.');
          let gymName = 'Our Gym';
          try {
            const gym = await db.gym.findUnique({ where: { id: gymId } });
            if (gym) gymName = gym.name;
          } catch (e) {}

          const promptReply = `👋 Hello ${customer.name}!\nWelcome to *${gymName}*.\n\nTo activate WhatsApp services, attendance alerts, payment receipts, and account options, please reply with *start*.`;
          
          try {
            await sock.readMessages([m.key]);
          } catch (e) {}

          await WhatsAppManager.sendMessage(gymId, fullPhone, promptReply, undefined, true);
          return;
        }
      }

      const footer = '\n\n---\nReply *start* to see the main menu anytime.';
      let replyText = '';

      if (isPlanOrDue) {
        const balanceNotice = (customer.pendingBalance || 0) > 0 
          ? `\n⏳ *Pending Balance:* ₹${customer.pendingBalance}${customer.balanceDueDate ? ` (Due by ${formatDateDDMMYYYY(customer.balanceDueDate)})` : ''}`
          : '';
        replyText = `📋 *Your Plan Details*\n\n*Name:* ${customer.name}\n*Plan:* ${customer.planType}\n*Fee Amount:* ₹${customer.feeAmount}${balanceNotice}\n*Next Due Date:* ${formatDateDDMMYYYY(customer.nextDueDate)}`;
      } else if (isPayment) {
        const txs = await db.transaction.findMany({
          where: { customerId: customer.id, type: 'INCOME' },
          orderBy: { date: 'desc' },
          take: 3
        });
        if (txs.length === 0) {
          replyText = `💰 *Payment History for ${customer.name}*\n\nNo payments found.`;
        } else {
          replyText = `💰 *Last 3 Payments for ${customer.name}*\n\n` + txs.map(t => {
            const methodTag = t.paymentMethod ? ` [${t.paymentMethod}]` : '';
            return `• ₹${t.amount}${methodTag} on ${formatDateDDMMYYYY(t.date)}`;
          }).join('\n');
        }
      } else if (isAttendance) {
        const atts = await db.attendanceRecord.findMany({
          where: { customerId: customer.id, durationMinutes: { not: null } },
          orderBy: { checkInTime: 'desc' },
          take: 3
        });
        if (atts.length === 0) {
          replyText = `⏱️ *Recent Attendance for ${customer.name}*\n\nNo recent check-ins found.`;
        } else {
          replyText = `⏱️ *Last 3 Days Attendance for ${customer.name}*\n\n` + atts.map(a => {
            const date = formatDateDDMMYYYY(a.dateStr);
            const hrs = ((a.durationMinutes || 0) / 60).toFixed(1);
            return `• ${date}: ${hrs} hours`;
          }).join('\n');
        }
      } else if (isStart) {
        const rawTemplate = getTemplate(settings, 'welcome');
        
        let gymName = 'Our Gym';
        try {
          const gym = await db.gym.findUnique({ where: { id: gymId } });
          if (gym) gymName = gym.name;
        } catch (e) {}

        const joinDate = customer.joinedDate ? formatDateDDMMYYYY(customer.joinedDate) : 'N/A';
        
        replyText = compileTemplate(rawTemplate, {
          gymName: gymName,
          name: customer.name,
          phone: customer.phone,
          plan: customer.planType,
          amount: customer.feeAmount.toString(),
          joinDate: joinDate,
          dueDate: formatDateDDMMYYYY(customer.nextDueDate)
        });
        
        // Append menu options to the welcome message
        replyText += '\n\n---\nReply *plan* or *due date* to view your Plan Details\nReply *payment* for Payment History\nReply *attendance* for Attendance Logs';
      } else {
        console.log('[WA DEBUG] Keyword not matched. Ignore.');
        return; 
      }

      console.log('[WA DEBUG] Sending reply text:', replyText);

      // Read receipt simulation for two-way chat anti-ban
      try {
        await sock.readMessages([m.key]);
        console.log('[WA DEBUG] Read receipt sent');
      } catch (e) {
        console.log('[WA DEBUG] Read receipt failed', e);
      }

      // Send the auto-reply
      console.log('[WA DEBUG] Queuing message reply...');
      const finalReply = isStart ? replyText : replyText + footer;
      await WhatsAppManager.sendMessage(gymId, fullPhone, finalReply, undefined, true);
      console.log('[WA DEBUG] Message queued successfully');
      } catch (eventErr) {
        console.error('[WA DEBUG] Unhandled error in messages.upsert:', eventErr);
      }
    });

    } catch (error: any) {
      console.error("WhatsApp Init Error:", error);
      globalAny.WhatsAppStatuses.set(gymId, 'error');
      if (!globalAny.WhatsAppErrors) globalAny.WhatsAppErrors = new Map<string, string>();
      globalAny.WhatsAppErrors.set(gymId, error?.message || String(error));
      globalAny.WhatsAppSessions.delete(gymId);
    }
  }

  static getStatus(gymId: string) {
    return {
      status: globalAny.WhatsAppStatuses.get(gymId) || 'disconnected',
      qr: globalAny.WhatsAppQRs.get(gymId) || null,
      error: globalAny.WhatsAppErrors?.get(gymId) || null,
    };
  }
  
  static async logout(gymId: string) {
    const sock = globalAny.WhatsAppSessions.get(gymId);
    if (sock) {
      try {
        sock.logout();
      } catch (e) {}
      try {
        if (sock.ws) sock.ws.close();
        if (sock.end) sock.end(undefined);
      } catch (e) {}
    }
    
    globalAny.WhatsAppSessions.delete(gymId);
    globalAny.WhatsAppStatuses.set(gymId, 'disconnected');
    globalAny.WhatsAppQRs.delete(gymId);
    if (globalAny.WhatsAppErrors) {
      globalAny.WhatsAppErrors.delete(gymId);
    }
    
    try {
      await db.whatsAppSession.deleteMany({ where: { gymId } });
    } catch (e) {
      console.error('Logout DB cleanup error:', e);
    }
  }

  static async sendMessage(gymId: string, phone: string, text: string, mediaBase64?: string, isAutoReply: boolean = false) {
    const sock = globalAny.WhatsAppSessions.get(gymId);
    if (!sock) return false;
    
    let finalMessage = text;
    if (!isAutoReply) {
      try {
        const cleanDigits = phone.replace(/[^0-9]/g, '');
        const shortPhone = cleanDigits.length === 12 && cleanDigits.startsWith('91') ? cleanDigits.substring(2) : cleanDigits;

        // Check if recipient is a member of this gym
        const member = await db.customer.findFirst({
          where: { gymId, phone: { contains: shortPhone } },
          select: { id: true, name: true, waActive: true }
        });

        // Outbound WhatsApp services work ONLY if member has sent 'start' (waActive: true)
        if (member && !member.waActive) {
          console.log(`[WA] Outbound message skipped for ${member.name} (${phone}) — member has not sent 'start' yet.`);
          return false;
        }

        const settings = await db.gymSettings.findUnique({ where: { gymId } });
        if (settings?.waAutoReply) {
          finalMessage += '\n\n---\nReply *plan* or *due date* to view your Plan Details\nReply *payment* for Payment History\nReply *attendance* for Attendance Logs\nReply *start* to see this menu anytime!';
        }
      } catch (e) {}
    }

    // Add to global queue
    return new Promise((resolve) => {
      globalAny.WhatsAppMessageQueue.push({ gymId, phone, text: finalMessage, mediaBase64, resolve });
      this.processQueue();
    });
  }

  static async processQueue() {
    if (globalAny.WhatsAppQueueProcessing || globalAny.WhatsAppMessageQueue.length === 0) return;
    
    globalAny.WhatsAppQueueProcessing = true;
    
    try {
      if (!globalAny.WhatsAppHourlyStats) {
        globalAny.WhatsAppHourlyStats = new Map<string, { count: number, resetAt: number }>();
      }
      
      while (globalAny.WhatsAppMessageQueue.length > 0) {
        let taskIndex = -1;
        for (let i = 0; i < globalAny.WhatsAppMessageQueue.length; i++) {
          const qGymId = globalAny.WhatsAppMessageQueue[i].gymId;
          if (!globalAny.WhatsAppHourlyStats.has(qGymId)) {
             globalAny.WhatsAppHourlyStats.set(qGymId, { count: 0, resetAt: Date.now() + 60 * 60 * 1000 });
          }
          const stats = globalAny.WhatsAppHourlyStats.get(qGymId);
          if (Date.now() > stats.resetAt) {
             stats.count = 0;
             stats.resetAt = Date.now() + 60 * 60 * 1000;
          }
          if (stats.count < 20) {
             taskIndex = i;
             break;
          }
        }

        if (taskIndex === -1) {
          console.log('All queued gyms have reached their hourly limit. Sleeping queue for 5 mins.');
          setTimeout(() => {
            WhatsAppManager.processQueue();
          }, 5 * 60 * 1000);
          return;
        }

        const task = globalAny.WhatsAppMessageQueue.splice(taskIndex, 1)[0];
        const { gymId, phone, text, mediaBase64, resolve } = task;
        const sock = globalAny.WhatsAppSessions.get(gymId);
        
        if (!sock) {
          resolve(false);
          continue;
        }
      
      // Ensure country code is present
      let cleanPhone = phone.replace(/\D/g, '');
      if (cleanPhone.length === 10) cleanPhone = '91' + cleanPhone;
      
      const jid = `${cleanPhone}@s.whatsapp.net`;
      try {
        // Anti-ban measure: wait randomly between 2-4 seconds BEFORE starting typing
        const initialDelay = Math.floor(Math.random() * 2000) + 2000;
        await new Promise(r => setTimeout(r, initialDelay));

        // Simulate human typing safely (do not block message if presence fails)
        try {
          await sock.presenceSubscribe(jid);
          await sock.sendPresenceUpdate('composing', jid);
        } catch (e) {
          console.error('[WA DEBUG] Presence update failed, continuing anyway', e);
        }
        
        // 2. Anti-ban measure: Real-Time Typing Simulation
        // Calculate typing delay based on message length (approx 5 chars per second)
        const charCount = text.length;
        let dynamicTypingDelay = Math.floor((charCount / 5) * 1000);
        
        // Cap it between 2s and 12s, plus some random human jitter
        if (dynamicTypingDelay < 2000) dynamicTypingDelay = 2000;
        if (dynamicTypingDelay > 12000) dynamicTypingDelay = 12000;
        dynamicTypingDelay += Math.floor(Math.random() * 2000) - 1000;
        
        await new Promise(r => setTimeout(r, dynamicTypingDelay));
        
        try {
          await sock.sendPresenceUpdate('paused', jid);
        } catch (e) {}
        
        if (mediaBase64) {
          // Parse base64 string (e.g., "data:image/jpeg;base64,/9j/4AAQSkZ...")
          const base64Data = mediaBase64.split(',')[1] || mediaBase64;
          const buffer = Buffer.from(base64Data, 'base64');
          await sock.sendMessage(jid, { image: buffer, caption: text });
        } else {
          await sock.sendMessage(jid, { text });
        }
        
        // Auto-Archive Chat
        try {
          const settings = await db.gymSettings.findUnique({ where: { gymId } });
          if (settings?.waAutoArchive) {
            console.log(`[WA DEBUG] Archiving chat ${jid}`);
            await sock.chatModify({ archive: true }, jid);
          }
        } catch (e) {
          console.error('[WA DEBUG] Failed to archive chat:', e);
        }

        const stats = globalAny.WhatsAppHourlyStats.get(gymId);
        if (stats) stats.count++; // Increment our per-gym hourly limit tracker
        resolve(true);

        // Anti-ban measure: Massive cooldown between messages (10 to 25 seconds)
        // This prevents rapid firing that triggers WhatsApp spam algorithms.
        const cooldownDelay = Math.floor(Math.random() * 15000) + 10000;
        await new Promise(r => setTimeout(r, cooldownDelay));

      } catch (e) {
        console.error('Failed to send message:', e);
        resolve(false);
      }
    }
    } finally {
      globalAny.WhatsAppQueueProcessing = false;
    }
  }
}
