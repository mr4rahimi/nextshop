import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { parseRange, eachDay, dayKey } from "@/lib/reports";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * خلاصه‌ی گزارش عملکرد برای یک بازه‌ی زمانی.
 *
 * دو منبع داده ترکیب می‌شوند:
 *
 * ۱. **جدول `Product`** — «چند محصول ساخته/بروز شده» را مستقیم از
 *    `createdAt`/`updatedAt` می‌خواند. این عدد از روز اول درست است، حتی برای
 *    تغییراتی که قبل از فعال‌شدن ثبت فعالیت انجام شده‌اند.
 *
 * ۲. **جدول `ActivityLog`** — «چه کسی چه کاری کرد» را می‌دهد. فقط از لحظه‌ی
 *    نصب این قابلیت به بعد پر می‌شود.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const range = parseRange(url.searchParams);

  const inRange = { gte: range.from, lte: range.to };

  const [
    productsCreated,
    productsUpdated,
    productsTotal,
    productsActive,
    productsNoImage,
    logs,
    createdRows,
    updatedRows,
  ] = await Promise.all([
    prisma.product.count({ where: { createdAt: inRange } }),
    // محصولی که در بازه ساخته شده «بروزرسانی» حساب نمی‌شود
    prisma.product.count({ where: { updatedAt: inRange, createdAt: { lt: range.from } } }),
    prisma.product.count(),
    prisma.product.count({ where: { isActive: true } }),
    prisma.product.count({ where: { OR: [{ mainImage: null }, { mainImage: "" }] } }),
    prisma.activityLog.findMany({
      where: { createdAt: inRange },
      select: { action: true, entity: true, actorId: true, actorName: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.product.findMany({
      where: { createdAt: inRange },
      select: { createdAt: true },
    }),
    prisma.product.findMany({
      where: { updatedAt: inRange, createdAt: { lt: range.from } },
      select: { updatedAt: true },
    }),
  ]);

  // ── سری زمانی روزانه ─────────────────────────────────────────────────────
  const days = eachDay(range);
  const blank = () => Object.fromEntries(days.map((d) => [d, 0])) as Record<string, number>;

  const seriesCreated = blank();
  const seriesUpdated = blank();
  const seriesUploads = blank();
  const seriesDeletes = blank();
  const seriesActivity = blank();

  for (const row of createdRows) {
    const k = dayKey(row.createdAt);
    if (k in seriesCreated) seriesCreated[k]++;
  }
  for (const row of updatedRows) {
    const k = dayKey(row.updatedAt);
    if (k in seriesUpdated) seriesUpdated[k]++;
  }

  const byAction: Record<string, number> = {};
  const byEntity: Record<string, number> = {};
  const byActor: Record<string, { name: string; count: number; actions: Record<string, number> }> = {};

  for (const log of logs) {
    const k = dayKey(log.createdAt);
    if (k in seriesActivity) seriesActivity[k]++;
    if (log.action === "UPLOAD" && k in seriesUploads) seriesUploads[k]++;
    if (log.action === "DELETE" && k in seriesDeletes) seriesDeletes[k]++;

    byAction[log.action] = (byAction[log.action] ?? 0) + 1;
    byEntity[log.entity] = (byEntity[log.entity] ?? 0) + 1;

    const actorKey = log.actorId ?? `name:${log.actorName}`;
    byActor[actorKey] ??= { name: log.actorName, count: 0, actions: {} };
    byActor[actorKey].count++;
    byActor[actorKey].actions[log.action] = (byActor[actorKey].actions[log.action] ?? 0) + 1;
  }

  return NextResponse.json({
    range: { from: range.from.toISOString(), to: range.to.toISOString() },
    kpi: {
      productsCreated,
      productsUpdated,
      productsTotal,
      productsActive,
      productsInactive: productsTotal - productsActive,
      productsNoImage,
      imagesUploaded: byAction.UPLOAD ?? 0,
      deletions: byAction.DELETE ?? 0,
      activityTotal: logs.length,
      activeAdmins: Object.keys(byActor).length,
    },
    days,
    series: {
      productsCreated: days.map((d) => seriesCreated[d]),
      productsUpdated: days.map((d) => seriesUpdated[d]),
      uploads: days.map((d) => seriesUploads[d]),
      deletions: days.map((d) => seriesDeletes[d]),
      activity: days.map((d) => seriesActivity[d]),
    },
    byAction,
    byEntity,
    byActor: Object.entries(byActor)
      .map(([id, v]) => ({ id, ...v }))
      .sort((a, b) => b.count - a.count),
    /** آیا ثبت فعالیت اصلاً داده‌ای دارد — برای نمایش پیام راهنما در رابط کاربری */
    hasActivityData: logs.length > 0,
  });
}
