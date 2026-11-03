import { NextResponse } from "next/server";
import { searchSizeCharts } from "@/lib/size-guide-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET ?q=&exclude= — محصولاتی که جدول سایز دارند، برای «کپی از محصول دیگر» */
export async function GET(req: Request) {
  const u = new URL(req.url).searchParams;
  return NextResponse.json({ items: await searchSizeCharts(u.get("q") ?? "", u.get("exclude") ?? undefined) });
}
