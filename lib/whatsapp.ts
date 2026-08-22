import { makeWASocket, useMultiFileAuthState, DisconnectReason, Browsers } from '@whiskeysockets/baileys';
import * as QRCode from 'qrcode';
import pino from 'pino';
import fs from 'fs';
import path from 'path';

// Supress verbose logging
const logger = pino({ level: 'silent' }) as any;

const globalAny: any = global;

if (!globalAny.WhatsAppSessions) {
  globalAny.WhatsAppSessions = new Map<string, any>();
  globalAny.WhatsAppQRs = new Map<string, string>();
  globalAny.WhatsAppStatuses = new Map<string, string>();
}

export class WhatsAppManager {
  static async initSession(gymId: string) {
    if (globalAny.WhatsAppStatuses.get(gymId) === 'initializing' || globalAny.WhatsAppSessions.has(gymId)) {
      return;
    }

    globalAny.WhatsAppStatuses.set(gymId, 'initializing');
    
    try {
      const authFolder = path.join('/tmp', 'whatsapp-auth', gymId);
      
      if (!fs.existsSync(authFolder)) {
        fs.mkdirSync(authFolder, { recursive: true });
      }

      const { state, saveCreds } = await useMultiFileAuthState(authFolder);

    const sock = makeWASocket({
      auth: state,
      printQRInTerminal: false,
      logger,
      browser: Browsers.macOS('Desktop'),
      syncFullHistory: false, // Save memory
    });

    globalAny.WhatsAppSessions.set(gymId, sock);

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
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
          // Logged out, clean up auth folder
          try {
            fs.rmSync(authFolder, { recursive: true, force: true });
          } catch (e) {}
          globalAny.WhatsAppQRs.delete(gymId);
        }
      } else if (connection === 'open') {
        globalAny.WhatsAppStatuses.set(gymId, 'connected');
        globalAny.WhatsAppQRs.delete(gymId);
      }
    });
    } catch (error) {
      console.error("WhatsApp Init Error:", error);
      globalAny.WhatsAppStatuses.set(gymId, 'disconnected');
    }
  }

  static getStatus(gymId: string) {
    return {
      status: globalAny.WhatsAppStatuses.get(gymId) || 'disconnected',
      qr: globalAny.WhatsAppQRs.get(gymId) || null,
    };
  }
  
  static logout(gymId: string) {
    const sock = globalAny.WhatsAppSessions.get(gymId);
    if (sock) {
      sock.logout();
      globalAny.WhatsAppSessions.delete(gymId);
      globalAny.WhatsAppStatuses.set(gymId, 'disconnected');
      globalAny.WhatsAppQRs.delete(gymId);
      
      const authFolder = path.join('/tmp', 'whatsapp-auth', gymId);
      try {
        fs.rmSync(authFolder, { recursive: true, force: true });
      } catch (e) {}
    }
  }

  static async sendMessage(gymId: string, phone: string, text: string) {
    const sock = globalAny.WhatsAppSessions.get(gymId);
    if (!sock) return false;
    
    // Ensure country code is present (assuming India 91 for now if missing)
    let cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.length === 10) cleanPhone = '91' + cleanPhone;
    
    const jid = `${cleanPhone}@s.whatsapp.net`;
    try {
      await sock.sendMessage(jid, { text });
      return true;
    } catch (e) {
      console.error('Failed to send message:', e);
      return false;
    }
  }
}
