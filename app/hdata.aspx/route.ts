import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const url = new URL(req.url);
  const text = await req.text();
  
  console.log("=======================================");
  console.log("🟢 BIOMAX HIT: /hdata.aspx");
  console.log("Query Params:", Object.fromEntries(url.searchParams.entries()));
  console.log("Body:", text);
  console.log("=======================================");

  // Tell the machine we received it successfully
  return new NextResponse("OK", { status: 200 });
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  console.log("=======================================");
  console.log("🟢 BIOMAX HIT (GET): /hdata.aspx");
  console.log("Query Params:", Object.fromEntries(url.searchParams.entries()));
  console.log("=======================================");
  
  return new NextResponse("OK", { status: 200 });
}
