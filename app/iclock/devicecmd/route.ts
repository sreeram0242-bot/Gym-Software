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
          // Return=0 usually means SUCCESS in ZKTeco protocol
          const finalStatus = returnCode === '0' ? 'COMPLETED' : 'FAILED';
          
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

    // Acknowledge receipt
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
    console.error('ADMS DeviceCmd Error:', error);
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
}
