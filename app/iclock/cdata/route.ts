import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { toggleCheckIn, toggleStaffCheckIn } from '@/lib/actions';

export async function GET(req: Request) {
  // ADMS initialization handshake
  const res = "OK";
  return new NextResponse(res, { 
    status: 200, 
    headers: { 
      'Content-Type': 'text/plain',
      'Connection': 'close',
      'Content-Length': res.length.toString()
    } 
  });
}

export async function POST(req: Request) {
  try {
    // ZKTeco/eSSL sends the serial number in the URL query params
    const url = new URL(req.url);
    const serialNumber = url.searchParams.get('SN');

    // Read the raw text data pushed by the biometric machine
    const rawData = await req.text();

    // Auto-register the device if it's the first time we see this serial number
    if (serialNumber) {
      const existingDevice = await prisma.biometricDevice.findUnique({
        where: { serialNumber }
      });
      if (!existingDevice) {
        // Find the active gym (defaulting to the first gym for single-gym systems)
        const gym = await prisma.gym.findFirst();
        if (gym) {
          await prisma.biometricDevice.create({
            data: {
              gymId: gym.id,
              serialNumber,
              name: `Device ${serialNumber}`,
              status: 'online'
            }
          });
          console.log(`[BIOMETRIC] Auto-registered new device: ${serialNumber}`);
        }
      }
    }

    console.log(`\n========================================`);
    console.log(`🟢 BIOMETRIC PUSH RECEIVED!`);
    console.log(`📡 Machine Serial: ${serialNumber}`);
    console.log(`========================================`);
    console.log(`RAW DATA PAYLOAD:`);
    console.log(rawData);
    console.log(`========================================\n`);

    // PARSE PUNCHES (ADMS Format: PIN \t Time \t State \t VerifyMode)
    // PARSE PUNCHES (ADMS Format: PIN \t Time \t State \t VerifyMode)
    const fs = require('fs');
    fs.appendFileSync('biometric.log', `\n--- NEW PUNCH PAYLOAD ---\n${rawData}\n`);
    const lines = rawData.split('\n');
    for (let line of lines) {
      line = line.trim();
      if (!line) continue;
      if (line.startsWith('FP PIN=') || line.startsWith('USER PIN=')) {
        const match = line.match(/PIN=(\d+)/);
        if (match) {
          const enrolledPin = match[1];
          await prisma.biometricCommand.updateMany({
            where: { commandString: { contains: `PIN=${enrolledPin}` }, status: 'SENT' },
            data: { status: 'SUCCESS' }
          });
          fs.appendFileSync('biometric.log', `Enrollment Success callback processed for PIN: ${enrolledPin}\n`);
          continue; // Skip regular punch logic
        }
      }
      
      const parts = line.split(/\s+/);
      if (parts.length >= 2) {
        let pin = parts[0].trim();
        // Clean up malformed PINs (e.g. if the device literally saved "101:FID=0:RETRY=3" as the ID)
        if (pin.includes(':')) {
           pin = pin.split(':')[0];
        }
        // Also strip any non-numeric garbage just to be safe
        pin = pin.replace(/\D/g, '');
        
        fs.appendFileSync('biometric.log', `Parsed PIN: '${pin}'\n`);
        
        const strippedPin = pin.replace(/^0+/, '');
        const padded10Pin = strippedPin ? strippedPin.padStart(10, '0') : pin;
        
        // Find Customer
        const customer = await prisma.customer.findFirst({
          where: { 
            OR: [
              { nfcCardId: pin },
              { nfcCardId: strippedPin },
              { nfcCardId: padded10Pin },
              { nfcCardId2: pin },
              { nfcCardId2: strippedPin },
              { nfcCardId2: padded10Pin },
              { fingerprintId: pin },
              { fingerprintId: strippedPin },
              { memberId: pin },
              { memberId: strippedPin },
              { memberId: `M-${pin}` },
              { memberId: `M-${strippedPin}` }
            ]
          }
        });
        if (customer) {
          fs.appendFileSync('biometric.log', `Matched Customer: ${customer.name}\n`);
          console.log(`[BIOMETRIC] Customer punch matched: ${customer.name}`);
          try {
            const res = await toggleCheckIn(customer.id, false);
            fs.appendFileSync('biometric.log', `toggleCheckIn success: ${JSON.stringify(res)}\n`);
          } catch(e: any) {
            fs.appendFileSync('biometric.log', `toggleCheckIn error: ${e.message}\n`);
            console.error("CheckIn Error:", e.message);
          }
          continue;
        } else {
           fs.appendFileSync('biometric.log', `FAILED to match customer for PIN: '${pin}'\n`);
        }

        // Find Staff
        const staff = await prisma.staff.findFirst({
          where: { 
            OR: [
              { nfcCardId: pin },
              { nfcCardId: strippedPin },
              { nfcCardId: padded10Pin },
              { fingerprintId: pin },
              { fingerprintId: strippedPin }
            ]
          }
        });
        if (staff) {
          console.log(`[BIOMETRIC] Staff punch matched: ${staff.name}`);
          await toggleStaffCheckIn(staff.id, false).catch(e => console.error("Staff CheckIn Error:", e.message));
        }
      }
    }

    // IMPORTANT: We MUST return "OK" in plain text. 
    // If the eSSL machine doesn't see "OK", it thinks the internet is down 
    // and will keep trying to send the same punch over and over again.
    const res = "OK";
    return new NextResponse(res, { 
      status: 200, 
      headers: { 
        'Content-Type': 'text/plain',
        'Connection': 'close',
        'Content-Length': res.length.toString()
      } 
    });
  } catch (error) {
    console.error('Webhook Error:', error);
    const res = "ERROR";
    return new NextResponse(res, { 
      status: 500, 
      headers: { 
        'Content-Type': 'text/plain',
        'Connection': 'close',
        'Content-Length': res.length.toString()
      } 
    });
  }
}
