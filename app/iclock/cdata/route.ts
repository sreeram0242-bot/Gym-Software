import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { toggleCheckIn, toggleStaffCheckIn } from '@/lib/actions';

export async function GET(req: Request) {
  // ADMS initialization handshake
  const url = new URL(req.url);
  const serialNumber = url.searchParams.get('SN') || 'UNKNOWN';
  
  // Force the device to poll every 2 seconds instead of the factory default 15s
  const res = `GET OPTION FROM: ${serialNumber}\nDelay=2\nErrorDelay=15\nRealtime=1\nTransTimes=00:00;14:00\nTransInterval=1\nTransFlag=1111000000\n`;
  
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

    // In a multi-tenant SaaS, we DO NOT auto-register devices.
    // The device must be explicitly registered by the Admin via the Settings page
    // using its Serial Number so we know exactly which gym it belongs to.
    const existingDevice = await prisma.biometricDevice.findUnique({
      where: { serialNumber: serialNumber || '' }
    });

    if (!existingDevice) {
      console.log(`[BIOMETRIC] Rejected unknown device SN: ${serialNumber}. Admin must register it in Settings first.`);
      return new NextResponse('OK', { status: 200 }); // Return OK so device doesn't crash, but ignore data
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
      // Newer ZKTeco firmwares send Fingerprint 10.0 data as "BIODATA PIN=" 
      // instead of "FP PIN=". Some send "USER PIN=". 
      // We look for fingerprint enrollment data lines containing "PIN=" followed by digits.
      // IMPORTANT: We must NOT match "DATA DELETE USERINFO PIN=" lines (delete ACKs from device)
      // as those would falsely mark an ENROLL_FP command as SUCCESS.
      const isDeleteAck = line.includes('DATA DELETE') || line.includes('DELETE USERINFO');
      const isUpdateAck = line.includes('DATA UPDATE') || line.includes('UPDATE USERINFO');
      if (!isDeleteAck && !isUpdateAck && line.includes('PIN=')) {
        const match = line.match(/PIN=(\d+)/);
        if (match) {
          const enrolledPin = match[1];
          // Only mark ENROLL_FP commands as SUCCESS — never card/delete commands
          const updated = await prisma.biometricCommand.updateMany({
            where: {
              deviceId: existingDevice.id,
              commandString: { contains: `ENROLL_FP PIN=${enrolledPin}` },
              status: { in: ['SENT', 'PENDING', 'FAILED'] }
            },
            data: { status: 'SUCCESS' }
          });
          fs.appendFileSync('biometric.log', `Enrollment Success callback processed for PIN: ${enrolledPin} (updated ${updated.count} command(s))\n`);
          continue; // Skip regular punch logic
        }
      }


      const parts = line.split(/\s+/);

      // Catch ZKTeco OPLOG 4 or 6 (New User Enrolled)
      if (parts[0] === 'OPLOG' && (parts[1] === '4' || parts[1] === '6')) {
        // OPLOG 4 has PIN at parts[6]. OPLOG 6 has PIN inside parts[5]
        let enrolledPin = null;
        if (parts[1] === '4' && parts.length > 6) {
          enrolledPin = parts[6];
        } else if (parts[1] === '6' && parts.length > 5) {
          enrolledPin = parts[5].split(':')[0]; // Extracts 111 from 111:FID=0...
        }
        
        if (enrolledPin) {
          await prisma.biometricCommand.updateMany({
            where: { deviceId: existingDevice.id, commandString: { contains: `PIN=${enrolledPin}` }, status: { in: ['SENT', 'PENDING', 'FAILED'] } },
            data: { status: 'SUCCESS' }
          });
          fs.appendFileSync('biometric.log', `Enrollment Success (OPLOG ${parts[1]}) processed for PIN: ${enrolledPin}\n`);
        }
        continue;
      }
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
            gymId: existingDevice.gymId,
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
            gymId: existingDevice.gymId,
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

    // IMPORTANT: We MUST return "result=OK" in plain text. 
    // If the eSSL machine doesn't see "result=OK", it thinks the internet is down 
    // and will keep trying to send the same punch over and over again.
    const res = "result=OK";
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
