import { NextResponse } from 'next/server';
import prisma from '@/lib/db';

export async function POST(req: Request) {
  try {
    const url = new URL(req.url);
    const serialNumber = url.searchParams.get('SN');
    
    // The machine sends the result of the command in the raw body text
    // Example format: "ID=1234abcd&Return=0&CMD=ENROLL_FP"
    const rawData = await req.text();
    
    const fs = require('fs');
    fs.appendFileSync('biometric.log', `\n--- ADMS COMMAND RESPONSE ---\n${rawData}\n`);

    console.log(`\n========================================`);
    console.log(`🎯 [ADMS COMMAND RESPONSE from ${serialNumber}]`);
    console.log(`Payload: ${rawData}`);
    console.log(`========================================\n`);

    if (!serialNumber) {
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

    const device = await prisma.biometricDevice.findUnique({
      where: { serialNumber }
    });

    // Parse the raw body lines
    // It can contain multiple command returns separated by newlines
    const lines = rawData.split('\n');
    
    for (const line of lines) {
      if (!line.trim()) continue;
      
      // Parse key-value pairs separated by &
      const parts = line.split('&');
      let commandId = '';
      let returnCode = '';
      
      for (const part of parts) {
        if (part.startsWith('ID=')) commandId = part.split('=')[1];
        if (part.startsWith('Return=')) returnCode = part.split('=')[1];
      }

      if (commandId) {
        // Decode the numeric commandId back to the UUID start string
        const uuidStart = parseInt(commandId, 10).toString(16).padStart(8, '0');
        let command = await prisma.biometricCommand.findFirst({
          where: {
            id: {
              startsWith: `${uuidStart}-`
            }
          }
        });

        if (!command && device) {
          command = await prisma.biometricCommand.findFirst({
            where: {
              deviceId: device.id,
              status: 'SENT'
            },
            orderBy: { sentAt: 'desc' }
          });
        }

        if (command) {
          const isEnrollCmd = command.commandString.includes('ENROLL_FP');

          // For ENROLL_FP, ZKTeco devices send MULTIPLE callbacks:
          //   Return=1 → command acknowledged / enrollment started (intermediate, NOT a failure)
          //   Return=0 → for ENROLL_FP this means "placement acknowledged", NOT completion.
          //              Real success only comes when cdata receives fingerprint data (OPLOG 4/6 / BIODATA PIN=)
          //   Return=-1 or other negative → enrollment timeout or cancelled (FAILED)
          // For all other commands: Return=0 = success, anything else = fail.
          let finalStatus: string | null = null;
          if (isEnrollCmd) {
            const returnNum = parseInt(returnCode, 10);
            if (returnNum < 0) {
              // Negative return code = actual failure (user cancelled, timeout, finger rejected)
              finalStatus = 'FAILED';
              console.log(`[ADMS] ENROLL_FP command ${command.id} FAILED with Return=${returnCode}`);
            }
            // Return=0 or Return=1 for ENROLL_FP = intermediate — leave as SENT,
            // cdata/hdata will mark SUCCESS when fingerprint data actually arrives
          } else {
            if (returnCode === '0') {
              finalStatus = 'COMPLETED';
            } else {
              finalStatus = 'FAILED';
            }
          }

          if (finalStatus) {
            await prisma.biometricCommand.update({
              where: { id: command.id },
              data: { 
                status: finalStatus,
                completedAt: new Date()
              }
            });
          }
        }
      }
    }

    // Acknowledge receipt
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
    console.error('ADMS DeviceCmd Error:', error);
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
}
