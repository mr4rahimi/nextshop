import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getAdapter } from "@/lib/integration/core/adapter-registry";
import { enqueueCreateProducts, linkedOnPlatform, pendingCreateJobs } from "@/lib/integration/core/create-product";
import { getCreateSettings } from "@/lib/integration/core/variant-links";

export const dynamic = "force-dynamic";

const PER_PAGE = 30;

// GET /api/integration/create-products?platform=basalam&q=&categoryId=&status=all|todo|done|failed|queued&page=1
// محصولات سایت با وضعیت ساختشان روی بازارگاه — docs/integrations/create-products.md
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const platform = sp.get("platform") ?? "basalam";
  const q = sp.get("q")?.trim() ?? "";
  const categoryId = sp.get("categoryId") ?? "";
  const status = sp.get("status") ?? "todo";
  const page = Math.max(1, Number(sp.get("page") ?? 1) || 1);

  const adapter = getAdapter(platform);
  const connection = await prisma.integConnection.findFirst({ where: { platformCode: platform }, select: { status: true } });

  const [linked, pending, settings] = await Promise.all([
    linkedOnPlatform(platform),
    pendingCreateJobs(platform),
    getCreateSettings(platform),
  ]);

  // آخرین نتیجه‌ی ساخت هر محصول — خطای بعد از آخرین موفقیت یعنی «ناموفق»
  const logs = await prisma.integLog.findMany({
    where: { platformCode: platform, operationType: "CREATE_PRODUCT", entityId: { not: null } },
    orderBy: { createdAt: "desc" },
    select: { entityId: true, status: true, errorMessage: true, createdAt: true },
    take: 5000,
  });
  const lastLog = new Map<string, (typeof logs)[number]>();
  for (const l of logs) if (l.entityId && !lastLog.has(l.entityId)) lastLog.set(l.entityId, l);
  const failedIds = [...lastLog.values()].filter((l) => l.status === "ERROR").map((l) => l.entityId!).filter((id) => !linked.has(id));

  const where: Prisma.ProductWhereInput = { isActive: true };
  if (q) where.OR = [{ title: { contains: q, mode: "insensitive" } }, { sku: { contains: q, mode: "insensitive" } }];
  if (categoryId) where.categoryId = categoryId;
  const linkedIds = [...linked.keys()];
  const queuedIds = [...pending.keys()];
  if (status === "done") where.id = { in: linkedIds };
  else if (status === "queued") where.id = { in: queuedIds };
  else if (status === "failed") where.id = { in: failedIds };
  else if (status === "todo") where.id = { notIn: [...linkedIds, ...queuedIds] };

  const [total, products, categories, counts] = await Promise.all([
    prisma.product.count({ where }),
    prisma.product.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PER_PAGE,
      take: PER_PAGE,
      select: {
        id: true, title: true, mainImage: true, price: true, salePrice: true, stock: true, trackStock: true, categoryId: true,
        _count: { select: { variants: { where: { isActive: true } }, images: true } },
      },
    }),
    prisma.category.findMany({ select: { id: true, title: true, parentId: true } }),
    prisma.product.groupBy({ by: ["categoryId"], where: { isActive: true }, _count: { _all: true } }),
  ]);

  // مسیر کامل دسته‌های سایت برای جدول نگاشت دسته
  const byId = new Map(categories.map((c) => [c.id, c]));
  const pathOf = (id: string) => {
    const parts: string[] = [];
    for (let c = byId.get(id), guard = 0; c && guard < 10; c = c.parentId ? byId.get(c.parentId) : undefined, guard++) parts.unshift(c.title);
    return parts.join(" › ");
  };
  const countBy = new Map(counts.map((c) => [c.categoryId, c._count._all]));
  const shopCategories = categories
    .filter((c) => countBy.has(c.id))
    .map((c) => ({ id: c.id, path: pathOf(c.id), products: countBy.get(c.id) ?? 0 }))
    .sort((a, b) => a.path.localeCompare(b.path, "fa"));

  return NextResponse.json({
    supported: !!adapter?.createProduct,
    connected: connection?.status === "CONNECTED" || connection?.status === "SYNCING",
    settings,
    shopCategories,
    summary: { linked: linked.size, queued: pending.size, failed: failedIds.length },
    total,
    page,
    perPage: PER_PAGE,
    items: products.map((p) => {
      const l = linked.get(p.id);
      const log = lastLog.get(p.id);
      return {
        id: p.id,
        title: p.title,
        image: p.mainImage,
        price: String(p.salePrice && p.salePrice > 0n && p.salePrice < p.price ? p.salePrice : p.price),
        stock: p.stock,
        trackStock: p.trackStock,
        variants: p._count.variants,
        images: p._count.images + (p.mainImage ? 1 : 0),
        categoryId: p.categoryId,
        categoryMapped: !!settings.categoryMap[p.categoryId],
        platformProductId: l?.externalId ?? null,
        platformVariants: l?.variants ?? 0,
        queued: pending.get(p.id) ?? null,
        lastError: !l && log?.status === "ERROR" ? log.errorMessage : null,
        lastAt: log?.createdAt ?? null,
      };
    }),
  });
}

// POST { platform, productIds } — ساخت گروهی: هر محصول یک job
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({})) as { platform?: string; productIds?: string[] };
  const platform = body.platform ?? "basalam";
  const ids = Array.isArray(body.productIds) ? body.productIds.filter((x): x is string => typeof x === "string" && !!x) : [];
  if (!ids.length) return NextResponse.json({ ok: false, error: "هیچ محصولی انتخاب نشده" });

  if (!getAdapter(platform)?.createProduct) {
    return NextResponse.json({ ok: false, error: "ساخت خودکار محصول برای این بازارگاه پشتیبانی نمی‌شود" });
  }
  const connection = await prisma.integConnection.findFirst({ where: { platformCode: platform }, select: { status: true } });
  if (!connection || !["CONNECTED", "SYNCING"].includes(connection.status)) {
    return NextResponse.json({ ok: false, error: "اول اتصال این بازارگاه را برقرار کنید" });
  }

  const settings = await getCreateSettings(platform);
  const products = await prisma.product.findMany({ where: { id: { in: ids } }, select: { id: true, categoryId: true } });
  const unmapped = products.filter((p) => !settings.categoryMap[p.categoryId]).length;
  if (unmapped) {
    return NextResponse.json({ ok: false, error: `دسته‌ی ${unmapped.toLocaleString("fa-IR")} محصول از انتخاب‌ها به دسته‌ی بازارگاه نگاشت نشده — اول در «نگاشت دسته‌ها» انتخابش کنید` });
  }

  const r = await enqueueCreateProducts(platform, products.map((p) => p.id));
  return NextResponse.json({ ok: true, ...r });
}
