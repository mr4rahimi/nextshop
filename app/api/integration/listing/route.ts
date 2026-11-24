import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { enqueue } from "@/lib/integration/core/queue";
import { getPlatformPrefs, listPlatforms } from "@/lib/integration/core/config";
import { SELLER_PANELS } from "@/lib/integration/core/sections";

export const dynamic = "force-dynamic";

/**
 * قرار دادن محصول در بازارگاه — docs/integrations/settings-and-guide.md
 *
 * GET ?platform=&q=&page=&stock=1  محصولات سایت که هنوز در این بازارگاه نگاشت ندارند
 * POST { platform }               «دریافت محصولات» تا محصول تازه‌ساخته پیدا و نگاشت شود
 */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const [platforms, prefs, connections] = await Promise.all([
    listPlatforms(),
    getPlatformPrefs(),
    prisma.integConnection.findMany({ select: { platformCode: true, status: true, lastSyncAt: true } }),
  ]);
  const conn = new Map(connections.map((c) => [c.platformCode, c]));
  const markets = platforms
    .filter((p) => p.type === "MARKETPLACE" && p.isActive && p.supported)
    .map((p) => ({
      code: p.code,
      name: p.name,
      method: p.canCreateProduct ? ("auto" as const) : ("manual" as const),
      connected: ["CONNECTED", "SYNCING"].includes(conn.get(p.code)?.status ?? ""),
      panelUrl: prefs[p.code]?.panelUrl || SELLER_PANELS[p.code] || null,
    }));

  const code = sp.get("platform") ?? markets.find((m) => m.connected)?.code ?? markets[0]?.code;
  if (!code) return NextResponse.json({ platforms: markets, platform: null, items: [], total: 0, counts: null });

  const page = Math.max(1, Number(sp.get("page") ?? 1));
  const perPage = 30;
  const q = (sp.get("q") ?? "").trim();
  const inStock = sp.get("stock") !== "0";

  const linkedIds = (
    await prisma.integMappingLink.findMany({
      where: { platformCode: "shop", isActive: true, mapping: { isActive: true, links: { some: { platformCode: code, isActive: true } } } },
      select: { externalId: true },
    })
  ).map((l) => l.externalId);

  const base: Prisma.ProductWhereInput = { isActive: true };
  const where: Prisma.ProductWhereInput = {
    ...base,
    id: { notIn: linkedIds },
    ...(inStock ? { stock: { gt: 0 } } : {}),
    ...(q ? { OR: [{ title: { contains: q, mode: "insensitive" } }, { sku: q }, { gtin13: q }] } : {}),
  };

  const [total, products, activeCount] = await Promise.all([
    prisma.product.count({ where }),
    prisma.product.findMany({
      where,
      orderBy: [{ stock: "desc" }, { createdAt: "desc" }],
      skip: (page - 1) * perPage,
      take: perPage,
      select: { id: true, title: true, slug: true, sku: true, gtin13: true, price: true, salePrice: true, stock: true, mainImage: true, shortDescription: true },
    }),
    prisma.product.count({ where: base }),
  ]);

  return NextResponse.json({
    platforms: markets,
    platform: code,
    counts: { active: activeCount, linked: linkedIds.length },
    total,
    page,
    perPage,
    items: products.map((p) => ({
      ...p,
      price: Number(p.price),
      salePrice: p.salePrice != null ? Number(p.salePrice) : null,
    })),
  });
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { platform?: string };
  if (!body.platform) return NextResponse.json({ error: "بازارگاه مشخص نیست" }, { status: 400 });
  const connection = await prisma.integConnection.findFirst({
    where: { platformCode: body.platform, status: { in: ["CONNECTED", "SYNCING"] }, platform: { isActive: true } },
  });
  if (!connection) return NextResponse.json({ error: "اول این بازارگاه را در «اتصالات» وصل کنید" }, { status: 400 });

  const busy = await prisma.integJob.findFirst({
    where: { platformCode: body.platform, type: "FETCH_PRODUCTS", status: { in: ["PENDING", "PROCESSING"] } },
    select: { id: true },
  });
  if (busy) return NextResponse.json({ ok: true, alreadyRunning: true });

  await enqueue({ type: "FETCH_PRODUCTS", platformCode: body.platform, payload: { page: 1 }, priority: 1 });
  return NextResponse.json({ ok: true });
}
