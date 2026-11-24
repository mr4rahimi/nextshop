import { NextRequest, NextResponse } from "next/server";
import { serialize } from "@/lib/serialize";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// GET /api/integration/mapping?page=1&perPage=20&platform=hesaban
// Returns IntegMapping groups with all their links
export async function GET(req: NextRequest) {
  const sp       = req.nextUrl.searchParams;
  const page     = Math.max(1, Number(sp.get("page") ?? 1));
  const perPage  = Math.min(100, Math.max(10, Number(sp.get("perPage") ?? 20)));
  const platform = sp.get("platform");

  const q        = sp.get("q")?.trim() ?? "";
  const missing  = sp.get("missing"); // کد سرویسی که این نگاشت هنوز ندارد

  // فیلتر بر اساس پلتفرم: فقط mapping‌هایی که لینک این پلتفرم دارند
  const and: Prisma.IntegMappingWhereInput[] = [{ isActive: true }];
  const id = sp.get("id");
  if (id) and.push({ id });
  if (platform) and.push({ links: { some: { platformCode: platform, isActive: true } } });
  if (missing) and.push({ links: { none: { platformCode: missing, isActive: true } } });
  if (q) {
    const shopIds = (
      await prisma.product.findMany({
        where: { OR: [{ title: { contains: q, mode: "insensitive" } }, { sku: q }, { gtin13: q }] },
        select: { id: true },
        take: 500,
      })
    ).map((p) => p.id);
    and.push({
      links: {
        some: {
          isActive: true,
          OR: [
            { externalTitle: { contains: q, mode: "insensitive" } },
            { externalId: q },
            ...(shopIds.length ? [{ platformCode: "shop", externalId: { in: shopIds } }] : []),
          ],
        },
      },
    });
  }
  const where: Prisma.IntegMappingWhereInput = { AND: and };

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
        select: { id: true, title: true, price: true, stock: true, mainImage: true, sku: true },
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

  return NextResponse.json(serialize({ total, page, perPage, mappings: enriched }));
}

// POST /api/integration/mapping — ایجاد نگاشت جدید (wizard)
// body: { links: { platformCode, externalId, externalTitle }[], notes? }
export async function POST(req: NextRequest) {
  const body = await req.json() as {
    links: { platformCode: string; externalId: string; externalTitle?: string }[];
    notes?: string;
  };

  const links = (body.links ?? []).filter((l) => l?.platformCode && l?.externalId);
  if (new Set(links.map((l) => l.platformCode)).size !== links.length) {
    return NextResponse.json({ error: "از هر سرویس فقط یک محصول" }, { status: 400 });
  }

  // محصولی که همین حالا در نگاشتی است: اگر محصول سایت است، بقیه به همان نگاشت اضافه می‌شوند
  // (محصول سایت با باسلام نگاشت دارد و حالا اسنپ‌شاپ هم اضافه می‌شود)؛ غیر از آن تکراری است
  let attachTo: string | null = null;
  const fresh: typeof links = [];
  for (const link of links) {
    const existing = await prisma.integMappingLink.findUnique({
      where: { platformCode_externalId: { platformCode: link.platformCode, externalId: link.externalId } },
      include: { mapping: { select: { isActive: true } } },
    });
    if (existing && existing.isActive && existing.mapping.isActive) {
      if (link.platformCode === "shop") {
        attachTo = existing.mappingId;
        continue;
      }
      return NextResponse.json(
        { error: `«${link.externalTitle ?? link.externalId}» همین حالا در نگاشت دیگری است` },
        { status: 409 },
      );
    }
    if (existing) await prisma.integMappingLink.delete({ where: { id: existing.id } }); // لینک خاموش/یتیم
    fresh.push(link);
  }

  if (attachTo) {
    if (!fresh.length) return NextResponse.json({ error: "چیز تازه‌ای برای افزودن نیست" }, { status: 400 });
    const have = await prisma.integMappingLink.findMany({
      where: { mappingId: attachTo, platformCode: { in: fresh.map((l) => l.platformCode) }, isActive: true },
      select: { platformCode: true },
    });
    if (have.length) {
      return NextResponse.json(
        { error: "این محصول سایت در همین سرویس محصول نگاشت‌شده‌ی دیگری دارد؛ از «همه‌ی نگاشت‌ها» ویرایشش کنید" },
        { status: 409 },
      );
    }
    await prisma.integMappingLink.deleteMany({ where: { mappingId: attachTo, platformCode: { in: fresh.map((l) => l.platformCode) } } });
    await prisma.integMappingLink.createMany({
      data: fresh.map((l) => ({ mappingId: attachTo!, platformCode: l.platformCode, externalId: l.externalId, externalTitle: l.externalTitle ?? null })),
    });
    return NextResponse.json({ id: attachTo, attached: true }, { status: 200 });
  }

  if (fresh.length < 2) {
    return NextResponse.json({ error: "حداقل دو محصول برای نگاشت لازم است" }, { status: 400 });
  }

  // موجودی اولیه‌ی نگاشت = موجودی محصول سایت؛ نگاشت با موجودی ۰ با اولین سفارش
  // بازارگاه همه‌جا را صفر می‌کرد (docs/integrations/settings-and-guide.md)
  const shopId = fresh.find((l) => l.platformCode === "shop")?.externalId;
  const shopProduct = shopId ? await prisma.product.findUnique({ where: { id: shopId }, select: { stock: true } }) : null;

  const mapping = await prisma.integMapping.create({
    data: {
      stock: Math.max(0, shopProduct?.stock ?? 0),
      notes: body.notes ?? null,
      links: {
        create: fresh.map((l) => ({
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
