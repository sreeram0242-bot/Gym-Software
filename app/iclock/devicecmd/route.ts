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
            } else if (returnNum === -1003 || returnNum > 0) {
              // Return=-1003 or Return > 0 = Device acknowledged command and entered enrollment mode on screen (waiting for finger)
              console.log(`[ADMS] ENROLL_FP command ${command.id} acknowledged by device with Return=${returnCode} (awaiting finger on scanner)`);
              // Leave status as SENT so UI continues waiting for user to place finger
            } else if (returnNum < 0) {
              // Other negative return codes (-1, -2, -1004) = actual failure/cancellation on machine
              if (command.status !== 'SUCCESS') {
                finalStatus = 'FAILED';
                console.log(`[ADMS] ENROLL_FP command ${command.id} REJECTED/FAILED on device with Return=${returnCode}`);
              }
            }
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
