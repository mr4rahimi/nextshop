import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { pushPriceForMapping } from "@/lib/integration/core/pricing";
import { tehranDayStart, tehranDayEnd, toTehranDate } from "@/lib/integration/core/discount";

export const dynamic = "force-dynamic";

// پلتفرم‌هایی که قیمت به آن‌ها پوش می‌شود — حسابداری و خود فروشگاه تخفیف بازارگاهی ندارند
const EXCLUDED = new Set(["shop", "hesaban"]);

// GET /api/integration/discounts?page=1&perPage=30&platform=snappshop
export async function GET(req: NextRequest) {
  const sp       = req.nextUrl.searchParams;
  const page     = Math.max(1, Number(sp.get("page") ?? 1));
  const perPage  = Math.min(100, Math.max(10, Number(sp.get("perPage") ?? 30)));
  const platform = sp.get("platform");

  const where = platform
    ? { isActive: true, links: { some: { platformCode: platform, isActive: true } } }
    : { isActive: true };

  const [total, mappings] = await Promise.all([
    prisma.integMapping.count({ where }),
    prisma.integMapping.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      skip:    (page - 1) * perPage,
      take:    perPage,
      include: { links: { where: { isActive: true }, orderBy: { platformCode: "asc" } } },
    }),
  ]);

  const shopIds = mappings.flatMap((m) =>
    m.links.filter((l) => l.platformCode === "shop").map((l) => l.externalId));
  const shopProducts = shopIds.length
    ? await prisma.product.findMany({ where: { id: { in: shopIds } }, select: { id: true, title: true } })
    : [];
  const shopMap = new Map(shopProducts.map((p) => [p.id, p]));

  const items = mappings.map((m) => {
    const shopLink = m.links.find((l) => l.platformCode === "shop");
    const title =
      (shopLink ? shopMap.get(shopLink.externalId)?.title : null) ??
      m.links.find((l) => l.externalTitle)?.externalTitle ??
      "(بدون عنوان)";

    return {
      id:    m.id,
      title,
      stock: m.stock,
      syncPriceEnabled: m.syncPriceEnabled,
      links: m.links
        .filter((l) => !EXCLUDED.has(l.platformCode) && (!platform || l.platformCode === platform))
        .map((l) => ({
          id:                l.id,
          platformCode:      l.platformCode,
          externalId:        l.externalId,
          externalTitle:     l.externalTitle,
          discountManaged:   l.discountManaged,
          discountPercent:   l.discountPercent,
          discountStartsAt:  toTehranDate(l.discountStartsAt) ?? null,
          discountEndsAt:    toTehranDate(l.discountEndsAt) ?? null,
          discountStock:     l.discountStock,
          discountPushedAt:  l.discountPushedAt?.toISOString() ?? null,
          discountPushError: l.discountPushError,
        })),
    };
  }).filter((m) => m.links.length > 0);

  return NextResponse.json({ total, page, perPage, items });
}

// PATCH — ذخیره‌ی تخفیف یک لینک و (اختیاری) ارسال فوری به پلتفرم
// body: { linkId, discountManaged?, discountPercent?, discountStartsAt?,
//         discountEndsAt?, discountStock?, push? }
// تاریخ‌ها رشته‌ی YYYY-MM-DD به وقت تهران‌اند؛ رشته‌ی خالی یعنی «پاک کن».
export async function PATCH(req: NextRequest) {
  const body = await req.json() as {
    linkId: string;
    discountManaged?:  boolean;
    discountPercent?:  number | null;
    discountStartsAt?: string | null;
    discountEndsAt?:   string | null;
    discountStock?:    number | null;
    push?:             boolean;
  };

  if (!body.linkId) return NextResponse.json({ error: "linkId الزامی است" }, { status: 400 });

  const link = await prisma.integMappingLink.findUnique({
    where:  { id: body.linkId },
    select: {
      id: true, mappingId: true, platformCode: true,
      discountStartsAt: true, discountEndsAt: true,
    },
  });
  if (!link) return NextResponse.json({ error: "لینک یافت نشد" }, { status: 404 });
  if (EXCLUDED.has(link.platformCode)) {
    return NextResponse.json({ error: "این پلتفرم تخفیف بازارگاهی ندارد" }, { status: 400 });
  }

  const current = link;
  const data: Record<string, unknown> = {};

  if (body.discountManaged !== undefined) data.discountManaged = body.discountManaged;

  if (body.discountPercent !== undefined) {
    const p = body.discountPercent;
    if (p != null && (!Number.isFinite(p) || p <= 0 || p >= 100)) {
      return NextResponse.json({ error: "درصد تخفیف باید بین ۱ تا ۹۹ باشد" }, { status: 400 });
    }
    data.discountPercent = p;
  }

  if (body.discountStartsAt !== undefined) {
    if (!body.discountStartsAt) data.discountStartsAt = null;
    else {
      const d = tehranDayStart(body.discountStartsAt);
      if (!d) return NextResponse.json({ error: "تاریخ شروع نامعتبر است" }, { status: 400 });
      data.discountStartsAt = d;
    }
  }

  if (body.discountEndsAt !== undefined) {
    if (!body.discountEndsAt) data.discountEndsAt = null;
    else {
      // پایان بازه یعنی «تا آخر آن روز»، نه نیمه‌شب ابتدای آن
      const d = tehranDayEnd(body.discountEndsAt);
      if (!d) return NextResponse.json({ error: "تاریخ پایان نامعتبر است" }, { status: 400 });
      data.discountEndsAt = d;
    }
  }

  if (body.discountStock !== undefined) {
    const v = body.discountStock;
    if (v != null && (!Number.isInteger(v) || v < 0)) {
      return NextResponse.json({ error: "موجودی تخفیف باید عدد صحیح نامنفی باشد" }, { status: 400 });
    }
    data.discountStock = v;
  }

  // ترتیب بازه پیش از نوشتن بررسی می‌شود؛ وگرنه ردیف نامعتبر ذخیره می‌شد و
  // خطا بعد از ذخیره برمی‌گشت.
  // `?? current` اینجا اشتباه است: پاک کردن عمدی تاریخ هم null می‌دهد
  const start = "discountStartsAt" in data
    ? data.discountStartsAt as Date | null : current.discountStartsAt;
  const end = "discountEndsAt" in data
    ? data.discountEndsAt as Date | null : current.discountEndsAt;
  if (start && end && start.getTime() > end.getTime()) {
    return NextResponse.json({ error: "تاریخ شروع بعد از تاریخ پایان است" }, { status: 400 });
  }

  await prisma.integMappingLink.update({ where: { id: link.id }, data });

  if (!body.push) return NextResponse.json({ ok: true, pricePush: null });

  // تخفیف فقط با یک ارسال قیمت به پلتفرم می‌رسد — ذخیره‌ی تنها چیزی را عوض نمی‌کند
  try {
    const pricePush = await pushPriceForMapping(link.mappingId);
    return NextResponse.json({ ok: true, pricePush });
  } catch (err) {
    return NextResponse.json({
      ok:             true,
      pricePush:      null,
      pricePushError: err instanceof Error ? err.message : String(err),
    });
  }
}
