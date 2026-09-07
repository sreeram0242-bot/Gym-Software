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
      const res = "result=OK";
      return new NextResponse(res, { 
        status: 200, 
        headers: { 
          'Content-Type': 'text/plain',
          'Connection': 'close',
          'Content-Length': res.length.toString()
        } 
      });
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
      // Strictly match fingerprint template pushes:
      // Must start with FP PIN=, BIODATA PIN=, or contain PIN= with TMP= (the biometric template)
      const isFpTemplate = (line.startsWith('FP PIN=') || line.startsWith('BIODATA PIN=') || (line.includes('PIN=') && line.includes('TMP=')))
        && !line.includes('DATA DELETE') && !line.includes('DATA UPDATE');

      if (isFpTemplate) {
        const pinMatch = line.match(/PIN=([^\t\r\n]+)/);
        if (pinMatch) {
          const rawPin = pinMatch[1].split('\t')[0].trim();
          // Extract the leading numeric PIN, cleanly ignoring any legacy suffixes like " FID=0..." or ":FID=0..."
          const cleanEnrolled = rawPin.split(/[\s:]/)[0].replace(/\D/g, '');
          if (cleanEnrolled) {
            const pinNum = parseInt(cleanEnrolled, 10);
            const pinVariants = new Set<string>([cleanEnrolled]);
            if (!isNaN(pinNum)) {
              pinVariants.add(String(pinNum));
              for (let len = 1; len <= 8; len++) {
                pinVariants.add(String(pinNum).padStart(len, '0'));
              }
            }
            const updated = await prisma.biometricCommand.updateMany({
              where: {
                deviceId: existingDevice.id,
                commandString: { contains: 'ENROLL_FP' },
                OR: Array.from(pinVariants).flatMap(p => [
                  { commandString: { contains: `PIN=${p}` } }
                ]),
                status: { in: ['SENT', 'PENDING', 'FAILED'] }
              },
              data: { status: 'SUCCESS', completedAt: new Date() }
            });
            fs.appendFileSync('biometric.log', `[FP ENROLL SUCCESS] Captured template for PIN: ${cleanEnrolled} (updated ${updated.count} command(s))\n`);
            console.log(`[ADMS] Fingerprint Template received for PIN: ${cleanEnrolled}. Command marked SUCCESS.`);
            continue; // Skip regular punch logic
          }
        }
      }

      const parts = line.split(/\s+/);

      // Catch ZKTeco OPLOG 6 (Fingerprint Enrolled audit log)
      if (parts[0] === 'OPLOG' && parts[1] === '6') {
        let rawPin = parts[5] || parts[4] || '';
        const cleanEnrolled = rawPin.split(/[\s:]/)[0].replace(/\D/g, '');
        if (cleanEnrolled) {
          const pinNum = parseInt(cleanEnrolled, 10);
          const pinVariants = new Set<string>([cleanEnrolled]);
          if (!isNaN(pinNum)) {
            pinVariants.add(String(pinNum));
            for (let len = 1; len <= 8; len++) {
              pinVariants.add(String(pinNum).padStart(len, '0'));
            }
          }
          const updated = await prisma.biometricCommand.updateMany({
            where: {
              deviceId: existingDevice.id,
              commandString: { contains: 'ENROLL_FP' },
              OR: Array.from(pinVariants).flatMap(p => [
                { commandString: { contains: `PIN=${p}` } }
              ]),
              status: { in: ['SENT', 'PENDING', 'FAILED'] }
            },
            data: { status: 'SUCCESS', completedAt: new Date() }
          });
          fs.appendFileSync('biometric.log', `[OPLOG 6 ENROLL SUCCESS] Confirmed for PIN: ${cleanEnrolled} (updated ${updated.count} command(s))\n`);
          console.log(`[ADMS] OPLOG 6 Fingerprint Enrollment confirmed for PIN: ${cleanEnrolled}. Command marked SUCCESS.`);
        }
        continue;
      }

      // Check for attendance punch: tab-delimited (PIN \t Time \t State \t VerifyMode)
      const tabParts = line.split('\t');
      if (tabParts.length >= 2) {
        const rawFirstCol = tabParts[0].trim();
        // Skip OPLOG, USER, BIODATA, or FP metadata lines
        if (rawFirstCol.startsWith('OPLOG') || rawFirstCol.startsWith('USER') || rawFirstCol.startsWith('FP') || rawFirstCol.startsWith('BIODATA')) {
          continue;
        }

        let pin = rawFirstCol.split(/[\s:]/)[0].replace(/\D/g, '');
        if (!pin) continue;
        
        fs.appendFileSync('biometric.log', `Parsed PIN: '${pin}'\n`);
        
        const strippedPin = pin.replace(/^0+/, '');
        const pinVariants = new Set<string>();
        if (pin) pinVariants.add(pin);
        if (strippedPin) {
          pinVariants.add(strippedPin);
          for (let len = 1; len <= 10; len++) {
            pinVariants.add(strippedPin.padStart(len, '0'));
          }
        }
        const pinArray = Array.from(pinVariants);
        
        // Find Customer
        const customer = await prisma.customer.findFirst({
          where: { 
            gymId: existingDevice.gymId,
            OR: [
              { nfcCardId: { in: pinArray } },
              { nfcCardId2: { in: pinArray } },
              { fingerprintId: { in: pinArray } },
              { memberId: { in: pinArray } },
              ...pinArray.map(p => ({ memberId: `M-${p}` }))
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
              { nfcCardId: { in: pinArray } },
              { fingerprintId: { in: pinArray } }
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
