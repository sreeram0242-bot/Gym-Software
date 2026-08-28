import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function POST(req: Request) {
  try {
    const url = new URL(req.url);
    const serialNumber = url.searchParams.get('SN');
    
    // The machine sends the result of the command in the raw body text
    // Example format: "ID=1234abcd&Return=0&CMD=ENROLL_FP"
    const rawData = await req.text();
    
    console.log(`\n========================================`);
    console.log(`🎯 [ADMS COMMAND RESPONSE from ${serialNumber}]`);
    console.log(`Payload: ${rawData}`);
    console.log(`========================================\n`);

    if (!serialNumber) {
      return new NextResponse('OK', { status: 200, headers: { 'Content-Type': 'text/plain' } });
    }

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
        // Find the command in DB by its short ID
        const command = await db.biometricCommand.findFirst({
          where: {
            id: {
              startsWith: commandId
            }
          }
        });

        if (command) {
          // Return=0 usually means SUCCESS in ZKTeco protocol
          const finalStatus = returnCode === '0' ? 'COMPLETED' : 'FAILED';
          
          await db.biometricCommand.update({
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
    return new NextResponse('OK', { 
      status: 200, 
      headers: { 'Content-Type': 'text/plain' } 
    });

  } catch (error) {
    console.error('ADMS DeviceCmd Error:', error);
    return new NextResponse('OK', { status: 200, headers: { 'Content-Type': 'text/plain' } });
  }
}
