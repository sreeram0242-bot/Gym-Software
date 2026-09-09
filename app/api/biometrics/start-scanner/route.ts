import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import path from 'path';

export async function POST() {
  try {
    const cwd = path.join(process.cwd(), 'GymScanner_Installer');
    const exePath = path.join(cwd, 'NativeGymScanner.exe');

    // Check if NativeGymScanner.exe is already active
    const isRunning = await new Promise<boolean>((resolve) => {
      exec('tasklist /FI "IMAGENAME eq NativeGymScanner.exe" /NH', (err, stdout) => {
        if (!err && stdout && stdout.toLowerCase().includes('nativegymscanner.exe')) {
          resolve(true);
        } else {
          resolve(false);
        }
      });
    });

    if (isRunning) {
      return NextResponse.json({ success: true, message: 'Native scanner is already running' });
    }

    // Launch NativeGymScanner.exe minimized directly in the background
    exec(`start "" /min "${exePath}"`, { cwd });

    return NextResponse.json({ success: true, message: 'Native scanner started in background' });
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
