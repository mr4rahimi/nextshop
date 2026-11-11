import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdapter } from "@/lib/integration/core/adapter-registry";
import { decryptCredentials } from "@/lib/integration/core/crypto";
import type { PlatformCategory } from "@/lib/integration/types";

export const dynamic = "force-dynamic";

// درخت دسته‌های بازارگاه کم عوض می‌شود — یک ساعت در حافظه
const cache = new Map<string, { at: number; items: PlatformCategory[] }>();
const TTL = 60 * 60_000;

// GET /api/integration/create-products/categories?platform=basalam — فقط دسته‌های برگ
export async function GET(req: NextRequest) {
  const platform = req.nextUrl.searchParams.get("platform") ?? "basalam";
  const hit = cache.get(platform);
  if (hit && Date.now() - hit.at < TTL) return NextResponse.json({ ok: true, items: hit.items });

  const adapter = getAdapter(platform);
  if (!adapter?.fetchCategories) return NextResponse.json({ ok: false, error: "این بازارگاه فهرست دسته ندارد" });
  const connection = await prisma.integConnection.findFirst({ where: { platformCode: platform } });
  if (!connection) return NextResponse.json({ ok: false, error: "اول اتصال این بازارگاه را بسازید" });

  try {
    const items = await adapter.fetchCategories(decryptCredentials(connection.credentials));
    cache.set(platform, { at: Date.now(), items });
    return NextResponse.json({ ok: true, items });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "دریافت دسته‌ها ناموفق بود" });
  }
}
