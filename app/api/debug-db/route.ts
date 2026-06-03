import { NextResponse } from "next/server";
export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({
    DATABASE_URL: process.env.DATABASE_URL,
  });
}
