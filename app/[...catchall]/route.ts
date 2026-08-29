import { NextResponse } from "next/server";

export async function GET(req: Request) {
  console.log(`[CATCH ALL GET] Unknown request to: ${req.url}`);
  return new NextResponse("Not Found", { status: 404 });
}

export async function POST(req: Request) {
  console.log(`[CATCH ALL POST] Unknown request to: ${req.url}`);
  return new NextResponse("Not Found", { status: 404 });
}
