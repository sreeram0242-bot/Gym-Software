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
        const cmdNum = parseInt(commandId, 10);
        let cmdType = '';
        for (const part of parts) {
          if (part.startsWith('CMD=')) cmdType = part.split('=')[1]?.trim() || '';
        }

        let command = null;
        if (!isNaN(cmdNum) && device) {
          command = await prisma.biometricCommand.findFirst({
            where: {
              deviceId: device.id,
              deviceCommandId: cmdNum
            }
          });
        }

        // If not found by numeric ID, ONLY fallback if cmdType matches or is explicitly ENROLL_FP
        if (!command && device && cmdType === 'ENROLL_FP') {
          command = await prisma.biometricCommand.findFirst({
            where: {
              deviceId: device.id,
              commandString: { contains: 'ENROLL_FP' },
              status: 'SENT'
            },
            orderBy: { sentAt: 'desc' }
          });
        }

        if (command) {
          const isEnrollCmd = command.commandString.includes('ENROLL_FP');

          let finalStatus: string | null = null;
          if (isEnrollCmd) {
            const returnNum = parseInt(returnCode, 10);
            if (returnNum === 0) {
              // Return=0 from devicecmd = enrollment completed successfully on device
              finalStatus = 'SUCCESS';
              console.log(`[ADMS] ENROLL_FP command ${command.id} SUCCESS (Return=0)`);
            } else if (returnNum < 0) {
              // Only mark FAILED if cmdType was explicitly ENROLL_FP or user cancelled,
              // and only if command is not already SUCCESS
              if (command.status !== 'SUCCESS' && (cmdType === 'ENROLL_FP' || !cmdType)) {
                // If the command was sent less than 15s ago, negative return might just be command parsing ACK,
                // do not prematurely fail before the user even has time to place finger
                const ageMs = Date.now() - new Date(command.sentAt || command.createdAt).getTime();
                if (ageMs > 20000) {
                  finalStatus = 'FAILED';
                  console.log(`[ADMS] ENROLL_FP command ${command.id} FAILED with Return=${returnCode}`);
                } else {
                  console.log(`[ADMS] ENROLL_FP command ${command.id} ignored early negative Return=${returnCode} (age ${Math.round(ageMs/1000)}s), awaiting user finger tap.`);
                }
              }
            }
            // Return=1 or positive = intermediate acknowledgment, leave as SENT
          } else {
            if (returnCode === '0') {
              finalStatus = 'COMPLETED';
            } else {
              finalStatus = 'FAILED';
            }
          }

          if (finalStatus && command.status !== 'SUCCESS') {
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
