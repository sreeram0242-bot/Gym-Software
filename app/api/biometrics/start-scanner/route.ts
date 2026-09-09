import { NextRequest, NextResponse } from 'next/server';
import { exec, spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import net from 'net';

function isPortOpen(port = 8765, timeoutMs = 600): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(timeoutMs);
    socket.once('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.once('timeout', () => {
      socket.destroy();
      resolve(false);
    });
    socket.once('error', () => {
      resolve(false);
    });
    socket.connect(port, '127.0.0.1');
  });
}

function checkTaskRunning(processName = 'NativeGymScanner.exe'): Promise<boolean> {
  return new Promise((resolve) => {
    exec(`tasklist /FI "IMAGENAME eq ${processName}" /NH`, (err, stdout) => {
      if (!err && stdout && stdout.toLowerCase().includes(processName.toLowerCase())) {
        resolve(true);
      } else {
        resolve(false);
      }
    });
  });
}

function killProcess(processName = 'NativeGymScanner.exe'): Promise<void> {
  return new Promise((resolve) => {
    exec(`taskkill /F /IM ${processName}`, () => {
      resolve();
    });
  });
}

export async function GET(req: NextRequest) {
  try {
    const portOpen = await isPortOpen(8765);
    const processRunning = process.platform === 'win32' ? await checkTaskRunning() : false;
    return NextResponse.json({
      portOpen,
      processRunning,
      platform: process.platform,
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const force = url.searchParams.get('force') === 'true';

    // If on non-Windows (e.g. cloud/Coolify Linux container), inform caller
    if (process.platform !== 'win32') {
      return NextResponse.json({
        success: false,
        isRemote: true,
        message: 'Server is running on Linux/Cloud. Mantra agent runs locally on Windows PC where scanner is connected.',
      });
    }

    const cwd = path.join(process.cwd(), 'GymScanner_Installer');
    const exePath = path.join(cwd, 'NativeGymScanner.exe');

    if (!fs.existsSync(exePath)) {
      return NextResponse.json(
        { success: false, message: `Executable not found at ${exePath}` },
        { status: 404 }
      );
    }

    // 1. Check if port 8765 is already actively listening
    const portActive = await isPortOpen(8765, 500);

    if (portActive && !force) {
      return NextResponse.json({
        success: true,
        alreadyRunning: true,
        message: 'Mantra Native Scanner is already active on port 8765',
      });
    }

    // 2. If force restart or port not listening, terminate any lingering zombie process
    const isRunning = await checkTaskRunning();
    if (isRunning) {
      await killProcess();
      await new Promise((r) => setTimeout(r, 400));
    }

    // 3. Launch NativeGymScanner.exe in background
    // PowerShell Start-Process launches cleanly in desktop session without interrupting window
    await new Promise<void>((resolve) => {
      const psCommand = `Start-Process -FilePath "${exePath}" -WorkingDirectory "${cwd}" -WindowStyle Minimized`;
      exec(`powershell -Command "${psCommand}"`, { cwd }, () => {
        resolve();
      });
    });

    // 4. Wait briefly and verify startup
    await new Promise((r) => setTimeout(r, 800));
    const finalCheck = await isPortOpen(8765, 800);

    return NextResponse.json({
      success: true,
      portReady: finalCheck,
      message: finalCheck
        ? 'Mantra Native Scanner started successfully'
        : 'Scanner process launched. Awaiting port bind...',
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
