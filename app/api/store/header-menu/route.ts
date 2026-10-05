import { NextResponse } from "next/server";
import { getHeaderMenu } from "@/lib/headerMenu";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json(await getHeaderMenu());
}
