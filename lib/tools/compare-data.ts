/**
 * خواندن داده‌ی مقایسه‌ی محصولات — فروش سایت، تلفنی و بازارگاه‌ها، بها، موجودی، نظرها و بازدید.
 * شاخص‌های مشتق در `compare.ts` (خالص). docs/features/tools.md بخش ۲۱
 *
 * - فروش سایت: `OrderItem` سفارش‌هایی که از پرداخت گذشته‌اند (نه «در انتظار پرداخت»، لغو و برگشتی)؛
 *   سفارش با `createdByStaffId` «تلفنی و حضوری» است. محصول تنوع‌دار جمع همه‌ی تنوع‌هاست.
 * - بازارگاه‌ها: `IntegOrder` (غیر لغو) از راه `IntegMappingLink` با `platformCode = "shop"`؛ مبلغ همان
 *   تومانی است که بازارگاه گزارش کرده.
 * - بها: اول `OrderItemCost` (بهای ثبت‌شده‌ی خط سفارش)، بقیه‌ی واحدها با میانگین فعلی حسابداری
 *   (`AccProductCost` کالای هم‌شناسه یا کالاهای تنوع‌ها). بازارگاه‌ها همیشه با میانگین فعلی.
 * - بازدید: Umami، متریک `path` (۱۰۰۰ مسیر پربازدید) و تطبیق `/products/<slug>`؛ وصل نبودن → null.
 */

import { prisma } from "@/lib/prisma";
import { getAnalyticsSettings, umamiRead } from "@/lib/analytics/umami";
import { normalizePath, weekIndex, type ChannelSales, type CompareRaw } from "./compare";

const DAY = 86_400_000;
const SOLD: ("PAID" | "CONFIRMED" | "PROCESSING" | "PACKAGING" | "SHIPPED" | "DELIVERED" | "COMPLETED")[] = [
  "PAID", "CONFIRMED", "PROCESSING", "PACKAGING", "SHIPPED", "DELIVERED", "COMPLETED",
];
export const COMPARE_DAYS = [30, 90, 180, 365] as const;
export const COMPARE_MAX = 4;

/** بازدید هر مسیر محصول؛ null یعنی آمار بازدید وصل نیست یا خوانده نشد */
async function productViews(slugs: string[], startAt: number, endAt: number): Promise<Map<string, number> | null> {
  try {
    const share = (await getAnalyticsSettings()).umamiShareSlug;
    if (!share) return null;
    const rows = await umamiRead<{ x: string | null; y: number }[]>(share, "metrics", { startAt, endAt, type: "path", limit: 1000 });
    const want = new Map(slugs.map((s) => [normalizePath(`/products/${s}`), s]));
    const out = new Map<string, number>(slugs.map((s) => [s, 0]));
    for (const r of Array.isArray(rows) ? rows : []) {
      const slug = r?.x ? want.get(normalizePath(r.x)) : undefined;
      if (slug) out.set(slug, (out.get(slug) ?? 0) + (Number(r.y) || 0));
    }
    return out;
  } catch (e) {
    console.error("[tools/compare] views", e);
    return null;
  }
}

export async function loadCompare(ids: string[], daysIn: number, withCost: boolean): Promise<CompareRaw[]> {
  const days = (COMPARE_DAYS as readonly number[]).includes(daysIn) ? daysIn : 90;
  const endAt = Date.now();
  const startAt = endAt - days * DAY;
  const start = new Date(startAt);
  const weeks = Math.ceil(days / 7);

  const products = await prisma.product.findMany({
    where: { id: { in: ids.slice(0, COMPARE_MAX) } },
    select: {
      id: true, title: true, slug: true, mainImage: true, isActive: true, hasVariants: true, price: true, salePrice: true,
      stock: true, ratingAvg: true, ratingCount: true, variants: { select: { accItemId: true } },
    },
  });
  if (!products.length) return [];
  const pids = products.map((p) => p.id);

  const [lines, links, platforms, views] = await Promise.all([
    prisma.orderItem.findMany({
      where: { productId: { in: pids }, order: { status: { in: SOLD }, createdAt: { gte: start } } },
      select: {
        productId: true, qty: true, unitPrice: true, unitSalePrice: true, cost: { select: { cost: true } },
        order: { select: { id: true, createdAt: true, createdByStaffId: true } },
      },
    }),
    prisma.integMappingLink.findMany({ where: { platformCode: "shop", externalId: { in: pids } }, select: { mappingId: true, externalId: true } }),
    prisma.integPlatform.findMany({ select: { code: true, name: true } }),
    productViews(products.map((p) => p.slug), startAt, endAt),
  ]);
  const productOfMapping = new Map(links.map((l) => [l.mappingId, l.externalId]));
  const integ = links.length
    ? await prisma.integOrder.findMany({
        where: { mappingId: { in: [...productOfMapping.keys()] }, status: { not: "CANCELLED" }, createdAt: { gte: start } },
        select: { mappingId: true, platformCode: true, qty: true, unitPrice: true, createdAt: true },
      })
    : [];
  const platformName = new Map(platforms.map((p) => [p.code, p.name]));

  // بهای میانگین فعلی: کالای هم‌شناسه یا کالاهای تنوع‌ها، وزن‌دار با موجودی
  const itemsOf = new Map(products.map((p) => [p.id, [...new Set([p.id, ...p.variants.map((v) => v.accItemId).filter((x): x is string => !!x)])]]));
  const costs = withCost ? await prisma.accProductCost.findMany({ where: { productId: { in: [...itemsOf.values()].flat() } } }) : [];
  const costOfItem = new Map(costs.map((c) => [c.productId, c]));
  const unitCostOf = (pid: string): number | null => {
    const cs = (itemsOf.get(pid) ?? []).map((i) => costOfItem.get(i)).filter((c) => c && c.avgCost > 0n);
    if (!cs.length) return null;
    const qty = cs.reduce((s, c) => s + Math.max(0, c!.qtyOnHand), 0);
    return qty > 0
      ? cs.reduce((s, c) => s + Number(c!.avgCost) * Math.max(0, c!.qtyOnHand), 0) / qty
      : cs.reduce((s, c) => s + Number(c!.avgCost), 0) / cs.length;
  };

  return products.map((p) => {
    const ch = new Map<string, ChannelSales>();
    const add = (code: string, label: string, qty: number, revenue: number) => {
      const c = ch.get(code) ?? { code, label, qty: 0, revenue: 0 };
      c.qty += qty;
      c.revenue += revenue;
      ch.set(code, c);
    };
    const weekly = new Array<number>(weeks).fill(0);
    const online = new Set<string>();
    const unitCost = withCost ? unitCostOf(p.id) : null;
    let knownCost = 0;
    let knownQty = 0;
    let unknownQty = 0;

    for (const l of lines) {
      if (l.productId !== p.id) continue;
      const unit = Number(l.unitSalePrice ?? l.unitPrice);
      const staff = !!l.order.createdByStaffId;
      add(staff ? "staff" : "site", staff ? "تلفنی و حضوری" : "سایت", l.qty, unit * l.qty);
      if (!staff) online.add(l.order.id);
      weekly[weekIndex(l.order.createdAt.getTime(), startAt, weeks)] += l.qty;
      if (l.cost) {
        knownCost += Number(l.cost.cost);
        knownQty += l.qty;
      } else unknownQty += l.qty;
    }
    for (const o of integ) {
      if (!o.mappingId || productOfMapping.get(o.mappingId) !== p.id) continue;
      add(o.platformCode, platformName.get(o.platformCode) ?? o.platformCode, o.qty, (o.unitPrice ?? 0) * o.qty);
      weekly[weekIndex(o.createdAt.getTime(), startAt, weeks)] += o.qty;
      unknownQty += o.qty;
    }

    const price = Number(p.salePrice && p.salePrice > 0n ? p.salePrice : p.price);
    return {
      id: p.id,
      title: p.title,
      slug: p.slug,
      image: p.mainImage,
      isActive: p.isActive,
      hasVariants: p.hasVariants,
      price,
      listPrice: Number(p.price),
      stock: p.stock,
      ratingAvg: p.ratingAvg,
      ratingCount: p.ratingCount,
      channels: [...ch.values()].sort((a, b) => b.revenue - a.revenue),
      onlineOrders: online.size,
      costOfSales: !withCost ? null : unknownQty === 0 ? knownCost : unitCost === null ? null : knownCost + unknownQty * unitCost,
      costKnownQty: knownQty,
      unitCost,
      views: views ? (views.get(p.slug) ?? 0) : null,
      weekly,
    };
  });
}
