import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { loadCatalogConfig } from "@/lib/bale-bot/config";
import { listCatalogForAdmin } from "@/lib/bale-bot/catalog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * محصولات ربات بله — همان چیزی که مشتری در ربات می‌بیند، برای بازبینی در پنل.
 * `PATCH` لینک دستی صفحه‌ی محصول را روی لینک نگاشت (`meta.publicUrl`) می‌گذارد؛
 * وقتی الگوی لینک بازارگاه برای یک محصول جواب نمی‌دهد.
 */

// GET /api/integration/bale-bot/products?q=&page=1
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const cfg = await loadCatalogConfig();
  const { total, cards } = await listCatalogForAdmin(cfg, {
    q: sp.get("q") ?? "",
    page: Number(sp.get("page") ?? 1) || 1,
    perPage: 20,
  });
  return NextResponse.json({ ok: true, total, perPage: 20, cards });
}

// PATCH { linkId, url } — url خالی یعنی برگشت به الگو
export async function PATCH(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { linkId?: unknown; url?: unknown };
  const linkId = typeof body.linkId === "string" ? body.linkId : "";
  const url = typeof body.url === "string" ? body.url.trim() : "";

  if (!linkId) return NextResponse.json({ ok: false, error: "لینک نگاشت مشخص نیست" });
  if (url && !/^https?:\/\/\S+$/i.test(url)) {
    return NextResponse.json({ ok: false, error: "لینک باید با https:// شروع شود" });
  }

  const link = await prisma.integMappingLink.findUnique({
    where: { id: linkId },
    select: { meta: true },
  });
  if (!link) return NextResponse.json({ ok: false, error: "لینک نگاشت پیدا نشد" });

  // ⚠️ بقیه‌ی کلیدهای meta دست نمی‌خورند — فقط publicUrl
  const meta = { ...((link.meta && typeof link.meta === "object" ? link.meta : {}) as Record<string, unknown>) };
  if (url) meta.publicUrl = url;
  else delete meta.publicUrl;

  await prisma.integMappingLink.update({
    where: { id: linkId },
    data: { meta: meta as object },
  });

  return NextResponse.json({ ok: true });
}
