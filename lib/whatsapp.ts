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
        globalAny.WhatsAppSessions.delete(gymId);
        
        if (shouldReconnect) {
          // Auto reconnect
          setTimeout(() => this.initSession(gymId), 5000);
        } else {
          // Logged out, clean up auth
          try {
            db.whatsAppSession.deleteMany({ where: { gymId } });
          } catch (e) {}
          globalAny.WhatsAppQRs.delete(gymId);
        }
      } else if (connection === 'open') {
        globalAny.WhatsAppStatuses.set(gymId, 'connected');
        globalAny.WhatsAppQRs.delete(gymId);
      }
    });
    } catch (error: any) {
      console.error("WhatsApp Init Error:", error);
      if (!globalAny.WhatsAppErrors) globalAny.WhatsAppErrors = new Map<string, string>();
      globalAny.WhatsAppErrors.set(gymId, error?.message || String(error));
      globalAny.WhatsAppStatuses.set(gymId, 'disconnected');
    }
  }

  static getStatus(gymId: string) {
    return {
      status: globalAny.WhatsAppStatuses.get(gymId) || 'disconnected',
      qr: globalAny.WhatsAppQRs.get(gymId) || null,
      error: globalAny.WhatsAppErrors?.get(gymId) || null,
    };
  }
  
  static logout(gymId: string) {
    const sock = globalAny.WhatsAppSessions.get(gymId);
    if (sock) {
      sock.logout();
      globalAny.WhatsAppSessions.delete(gymId);
      globalAny.WhatsAppStatuses.set(gymId, 'disconnected');
      globalAny.WhatsAppQRs.delete(gymId);
      
      try {
        db.whatsAppSession.deleteMany({ where: { gymId } });
      } catch (e) {}
    }
  }

  static async sendMessage(gymId: string, phone: string, text: string) {
    const sock = globalAny.WhatsAppSessions.get(gymId);
    if (!sock) return false;
    
    // Add to global queue
    return new Promise((resolve) => {
      globalAny.WhatsAppMessageQueue.push({ gymId, phone, text, resolve });
      this.processQueue();
    });
  }

  static async processQueue() {
    if (globalAny.WhatsAppQueueProcessing || globalAny.WhatsAppMessageQueue.length === 0) return;
    
    globalAny.WhatsAppQueueProcessing = true;
    
    while (globalAny.WhatsAppMessageQueue.length > 0) {
      const task = globalAny.WhatsAppMessageQueue.shift();
      if (!task) continue;
      
      const { gymId, phone, text, resolve } = task;
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

        // Simulate human typing
        await sock.presenceSubscribe(jid);
        await sock.sendPresenceUpdate('composing', jid);
        
        // Random typing delay between 2s and 4.5s
        const typingDelay = Math.floor(Math.random() * 2500) + 2000;
        await new Promise(r => setTimeout(r, typingDelay));
        
        await sock.sendPresenceUpdate('paused', jid);
        
        await sock.sendMessage(jid, { text });
        resolve(true);
      } catch (e) {
        console.error('Failed to send message:', e);
        resolve(false);
      }
    }
    
    globalAny.WhatsAppQueueProcessing = false;
  }
}
