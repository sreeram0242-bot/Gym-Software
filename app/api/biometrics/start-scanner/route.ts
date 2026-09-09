import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import path from 'path';

export async function POST() {
  try {
    const scriptPath = path.join(process.cwd(), 'GymScanner_Installer', 'Start_Native_Scanner.bat');
    const cwd = path.join(process.cwd(), 'GymScanner_Installer');
    
    // Use start /min to run it minimized so it doesn't interrupt the user
    // The cmd /c wrapper ensures the window closes after execution if any errors occur
    exec(`start /min cmd /c "${scriptPath}"`, { cwd });
    
    return NextResponse.json({ success: true, message: 'Native scanner started in background' });
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
