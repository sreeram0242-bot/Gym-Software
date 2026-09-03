// Helper functions for direct communication with ZKTeco Biometric Device over TCP Port 4370

const DEVICE_IP = process.env.ZK_DEVICE_IP || '192.168.137.188';
const DEVICE_PORT = parseInt(process.env.ZK_DEVICE_PORT || '4370', 10);

/**
 * Directly writes an RFID/NFC card number into the user's record on the physical device.
 */
export async function writeCardToZkDevice(pin: string, cardNo: number, userName: string = '') {
  try {
    const ZKLib = require('node-zklib');
    const zk = new ZKLib(DEVICE_IP, DEVICE_PORT, 5000, 4000);
    await zk.createSocket();

    const users = await zk.getUsers();
    let targetUser = users.data?.find((u: any) => {
      const uPin = String(u.userId || '').split(':')[0];
      return uPin === String(pin) || String(u.uid) === String(pin);
    });

    let uid = targetUser ? targetUser.uid : (users.data?.length ? Math.max(...users.data.map((u: any) => u.uid)) + 1 : 1);
    let userIdStr = targetUser ? targetUser.userId : `${pin}:FID=0`;
    let nameToUse = userName || (targetUser ? targetUser.name : '');

    // Standard 72-byte User record for CMD_USER_WRQ (Command 8)
    const userBuf = Buffer.alloc(72, 0);
    userBuf.writeUInt16LE(uid, 0);                 // offset 0: UID
    userBuf.writeUInt8(0, 2);                      // offset 2: Role (0 = user)
    // offset 3..10: password (empty)
    userBuf.write(nameToUse.slice(0, 23), 11);     // offset 11..34: Name
    userBuf.writeUInt32LE(cardNo, 35);             // offset 35..38: Card number (UInt32LE)
    userBuf.write(userIdStr.slice(0, 23), 48);     // offset 48..71: User ID string

    // CMD_USER_WRQ = 8
    await zk.executeCmd(8, userBuf);
    // CMD_REFRESHDATA = 1013
    await zk.executeCmd(1013, '');

    await zk.disconnect();
    console.log(`[ZK_DEVICE] Successfully wrote card ${cardNo} to PIN ${pin} (UID ${uid})`);
    return { success: true, uid };
  } catch (err: any) {
    console.error(`[ZK_DEVICE] Error writing card to device:`, err);
    return { success: false, error: err.message };
  }
}

/**
 * Directly removes a user, their fingerprint, and card from the physical device memory.
 */
export async function deleteUserFromZkDevice(pin: string) {
  try {
    const ZKLib = require('node-zklib');
    const zk = new ZKLib(DEVICE_IP, DEVICE_PORT, 5000, 4000);
    await zk.createSocket();

    const users = await zk.getUsers();
    const targetUser = users.data?.find((u: any) => {
      const uPin = String(u.userId || '').split(':')[0];
      return uPin === String(pin) || String(u.uid) === String(pin);
    });

    if (targetUser) {
      // CMD_DELETE_USER = 18 takes 2-byte UID in LE format
      const buf = Buffer.alloc(2);
      buf.writeUInt16LE(targetUser.uid, 0);
      await zk.executeCmd(18, buf);
      // CMD_REFRESHDATA = 1013
      await zk.executeCmd(1013, '');
      console.log(`[ZK_DEVICE] Successfully deleted PIN ${pin} (UID ${targetUser.uid}) from device`);
    }

    await zk.disconnect();
    return { success: true };
  } catch (err: any) {
    console.error(`[ZK_DEVICE] Error deleting user from device:`, err);
    return { success: false, error: err.message };
  }
}
