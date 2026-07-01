import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// GET /api/integration/mapping?page=1&perPage=20&platform=hesaban
// Returns IntegMapping groups with all their links
export async function GET(req: NextRequest) {
  const sp       = req.nextUrl.searchParams;
  const page     = Math.max(1, Number(sp.get("page") ?? 1));
  const perPage  = Math.min(100, Math.max(10, Number(sp.get("perPage") ?? 20)));
  const platform = sp.get("platform");

  // فیلتر بر اساس پلتفرم: فقط mapping‌هایی که لینک این پلتفرم دارند
  const where = platform
    ? { isActive: true, links: { some: { platformCode: platform, isActive: true } } }
    : { isActive: true };

  const [total, mappings] = await Promise.all([
    prisma.integMapping.count({ where }),
    prisma.integMapping.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip:    (page - 1) * perPage,
      take:    perPage,
      include: { links: { where: { isActive: true }, orderBy: { platformCode: "asc" } } },
    }),
  ]);

  // Enrich shop links with product info
  const shopIds = [
    ...new Set(
      mappings.flatMap((m) =>
        m.links.filter((l) => l.platformCode === "shop").map((l) => l.externalId)
      )
    ),
  ];
  const shopProducts = shopIds.length
    ? await prisma.product.findMany({
        where:  { id: { in: shopIds } },
        select: { id: true, title: true, price: true, stock: true, mainImage: true },
      })
    : [];
  const shopMap = new Map(shopProducts.map((p) => [p.id, p]));

  const enriched = mappings.map((m) => ({
    id:        m.id,
    notes:     m.notes,
    isActive:  m.isActive,
    createdAt: m.createdAt,
    links:     m.links.map((l) => ({
      id:            l.id,
      platformCode:  l.platformCode,
      externalId:    l.externalId,
      externalTitle: l.externalTitle,
      isActive:      l.isActive,
      shopProduct:   l.platformCode === "shop" ? (shopMap.get(l.externalId) ?? null) : null,
    })),
  }));

  return NextResponse.json({ total, page, perPage, mappings: enriched });
}

// POST /api/integration/mapping — ایجاد نگاشت جدید (wizard)
// body: { links: { platformCode, externalId, externalTitle }[], notes? }
export async function POST(req: NextRequest) {
  const body = await req.json() as {
    links: { platformCode: string; externalId: string; externalTitle?: string }[];
    notes?: string;
  };

  if (!body.links || body.links.length < 2) {
    return NextResponse.json({ error: "حداقل دو لینک برای نگاشت نیاز است" }, { status: 400 });
  }

  // بررسی تکراری — هیچ externalId نباید قبلاً لینک شده باشد
  for (const link of body.links) {
    const existing = await prisma.integMappingLink.findUnique({
      where: { platformCode_externalId: { platformCode: link.platformCode, externalId: link.externalId } },
    });
    if (existing) {
      return NextResponse.json(
        { error: `محصول "${link.externalId}" در پلتفرم "${link.platformCode}" قبلاً نگاشت دارد` },
        { status: 409 },
      );
    }
  }

  const mapping = await prisma.integMapping.create({
    data: {
      notes: body.notes ?? null,
      links: {
        create: body.links.map((l) => ({
          platformCode:  l.platformCode,
          externalId:    l.externalId,
          externalTitle: l.externalTitle ?? null,
        })),
      },
    },
    include: { links: true },
  });

  return NextResponse.json(mapping, { status: 201 });
}

// DELETE /api/integration/mapping?id=... — حذف کل نگاشت
export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id الزامی است" }, { status: 400 });

  await prisma.integMapping.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
