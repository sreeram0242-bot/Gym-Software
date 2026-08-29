import { NextResponse } from "next/server";
import fs from 'fs';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const userId = url.searchParams.get("id") || "99";
  
  // Write to a temporary file instead of memory so all workers can see it
  fs.writeFileSync('/tmp/enroll_hack.txt', userId);
  
  return new NextResponse(`COMMAND QUEUED in File System! Machine will ask to enroll User ID ${userId} in the next 10 seconds!`, { status: 200 });
}
