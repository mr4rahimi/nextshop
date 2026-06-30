import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";

export const dynamic = "force-dynamic";

// GET /api/integration/mapping?platform=hesaban&page=1&perPage=20
export async function GET(req: NextRequest) {
  const sp       = req.nextUrl.searchParams;
  const platform = sp.get("platform");
  const page     = Math.max(1, Number(sp.get("page") ?? 1));
  const perPage  = Math.min(100, Math.max(10, Number(sp.get("perPage") ?? 20)));

  const where = platform ? { platformCode: platform, isActive: true } : { isActive: true };

  const [total, mappings] = await Promise.all([
    prisma.integProductMapping.count({ where }),
    prisma.integProductMapping.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip:    (page - 1) * perPage,
      take:    perPage,
      include: {
        shopProduct: {
          select: { id: true, title: true, price: true, stock: true, mainImage: true },
        },
        platform: { select: { name: true } },
      },
    }),
  ]);

  return NextResponse.json(serialize({ total, page, perPage, mappings }));
}

// POST /api/integration/mapping — ساخت mapping دستی
export async function POST(req: NextRequest) {
  const body = await req.json() as {
    shopProductId:     string;
    platformCode:      string;
    platformProductId: string;
    platformTitle?:    string;
  };

  if (!body.shopProductId || !body.platformCode || !body.platformProductId) {
    return NextResponse.json({ error: "فیلدهای الزامی وارد نشده" }, { status: 400 });
  }

  // بررسی تکراری
  const existShop = await prisma.integProductMapping.findFirst({
    where: { shopProductId: body.shopProductId, platformCode: body.platformCode },
  });
  if (existShop) {
    return NextResponse.json({ error: "این محصول فروشگاه قبلاً نگاشت دارد" }, { status: 409 });
  }
  const existPlatform = await prisma.integProductMapping.findFirst({
    where: { platformCode: body.platformCode, platformProductId: body.platformProductId },
  });
  if (existPlatform) {
    return NextResponse.json({ error: "این محصول پلتفرم قبلاً نگاشت دارد" }, { status: 409 });
  }

  const mapping = await prisma.integProductMapping.create({
    data: {
      shopProductId:     body.shopProductId,
      platformCode:      body.platformCode,
      platformProductId: body.platformProductId,
      platformTitle:     body.platformTitle,
      isActive:          true,
    },
  });

  return NextResponse.json(serialize(mapping), { status: 201 });
}

// DELETE /api/integration/mapping?id=...
export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id الزامی است" }, { status: 400 });

  await prisma.integProductMapping.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
