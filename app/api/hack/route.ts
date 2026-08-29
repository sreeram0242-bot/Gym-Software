import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const userId = url.searchParams.get("id") || "99";
  
  // @ts-ignore
  global.testEnrollUser = userId;
  
  return new NextResponse(`COMMAND QUEUED: Machine will ask to enroll User ID ${userId} in the next 10 seconds!`, { status: 200 });
}
