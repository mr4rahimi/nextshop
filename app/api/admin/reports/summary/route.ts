import { NextResponse } from "next/server";
import { parseRange } from "@/lib/reports";
import { activitySummary } from "@/lib/reports-activity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** خلاصه‌ی گزارش عملکرد برای یک بازه — منطق در `lib/reports-activity.ts` */
export async function GET(req: Request) {
  const url = new URL(req.url);
  return NextResponse.json(await activitySummary(parseRange(url.searchParams)));
}
