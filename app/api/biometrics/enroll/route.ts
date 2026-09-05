import { NextResponse } from 'next/server';
import prisma from '@/lib/db';

export async function POST(req: Request) {
  try {
    const { gymId, memberId, nfcCardId, actualCardNumber, enrollType, pin } = await req.json();

    const targetPin = pin || nfcCardId;

    if (!gymId || !memberId || !targetPin) {
      return new NextResponse('Missing required fields (Member ID / PIN)', { status: 400 });
    }

    // Find the first registered online biometric device for this gym
    const device = await prisma.biometricDevice.findFirst({
      where: { 
        gymId,
      },
      orderBy: { lastActive: 'desc' }
    });

    if (!device) {
      return new NextResponse(JSON.stringify({ error: 'No biometric devices registered or active for this gym.' }), { status: 404 });
    }

    // Ensure we have a purely numeric PIN for the machine
    let numericPin = targetPin.replace(/\D/g, ''); // strip non-digits
    if (!numericPin || numericPin.length === 0 || numericPin.length > 8) {
       return new NextResponse(JSON.stringify({ error: 'Invalid Member ID. Must be numeric and max 8 digits.' }), { status: 400 });
    }

    const isCard = enrollType === 'card';
    const cleanCard = actualCardNumber ? actualCardNumber.replace(/^0+/, '') : '';

    if (isCard) {
      try {
        const gymSettings = await prisma.gymSettings.findFirst({ where: { gymId } });
        const ip = gymSettings?.deviceIpAddress || process.env.ZK_DEVICE_IP || '192.168.137.188';
        const cardInt = parseInt(cleanCard, 10);
        if (ip && !isNaN(cardInt) && cardInt > 0) {
          const ZKLib = require('node-zklib');
          const { COMMANDS } = require('node-zklib/constants');
          const zk = new ZKLib(ip, 4370, 5000, 4000);
          await zk.createSocket();
          const usersRes = await zk.getUsers();
          let u = usersRes?.data?.find((x: any) => x.userId === numericPin || x.userId.startsWith(numericPin + ':') || x.uid === parseInt(numericPin, 10));
          
          let targetUid = u ? u.uid : (usersRes?.data?.length ? Math.max(...usersRes.data.map((x: any) => x.uid)) + 1 : 1);
          let targetUserId = u ? u.userId : numericPin;

          const buf = Buffer.alloc(72);
          buf.writeUInt16LE(targetUid, 0);
          buf.writeUInt8(0, 2);
          buf.write('', 3, 8, 'ascii');
          buf.write('Member', 11, 24, 'ascii');
          buf.writeUInt32LE(cardInt, 35);
          buf.write(targetUserId, 48, 24, 'ascii');

          await zk.executeCmd(COMMANDS.CMD_USER_WRQ, buf);
          await zk.executeCmd(COMMANDS.CMD_REFRESHDATA, '');
          await zk.disconnect();

          console.log(`[ZK TCP 4370] Successfully wrote card ${cardInt} to PIN ${numericPin} on ${ip}`);
          return NextResponse.json({ success: true, directSync: true, numericPin });
        }
      } catch (err: any) {
        console.warn(`[ZK TCP 4370 Direct Write Warning]:`, err.message);
      }
    }

    // Fix Issue C: Cancel any stale PENDING or SENT ENROLL_FP commands for this PIN
    // before creating a new one. If left in DB, the device picks up the old command first
    // on the next heartbeat, activating the wrong enrollment slot.
    if (!isCard) {
      const cancelledCount = await prisma.biometricCommand.updateMany({
        where: {
          deviceId: device.id,
          commandString: { contains: `ENROLL_FP PIN=${numericPin}` },
          status: { in: ['PENDING', 'SENT'] }
        },
        data: { status: 'FAILED', completedAt: new Date() }
      });
      if (cancelledCount.count > 0) {
        console.log(`[Enroll] Cancelled ${cancelledCount.count} stale ENROLL_FP command(s) for PIN ${numericPin} before creating new one.`);
      }
    }

    const cmdStr = isCard ? `DATA UPDATE USERINFO PIN=${numericPin}\tCard=${cleanCard || ''}` : `ENROLL_FP PIN=${numericPin} FID=0 RETRY=3 OVERWRITE=1`;

    // Trigger enrollment exactly as per the Biomax SKILL
    const command = await prisma.biometricCommand.create({
      data: {
        deviceId: device.id,
        // MUST exactly match SKILL structure
        commandString: cmdStr,
        status: 'PENDING'
      }
    });

    return NextResponse.json({ success: true, commandId: command.id, numericPin });
  } catch (error) {
    console.error('API Biometric Enroll Error:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
