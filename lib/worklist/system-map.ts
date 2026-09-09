/**
 * نگاشت کارِ خودکار به `ActivityLog`.
 *
 * ⚠️ تصمیم معماری: **`ActivityLog` در `StaffTask` کپی نمی‌شود.** دو دلیل:
 *  - هر ذخیره‌ی محصول یک نوشتنِ اضافه پیدا می‌کرد؛ روی ویرایش گروهی قیمت که
 *    صدها ردیف است، این هزینه‌ی واقعی است.
 *  - دو کپی از یک حقیقت همیشه از هم جدا می‌افتند و بعد از شش ماه هیچ‌کس
 *    نمی‌فهمد کدام درست است.
 *
 * پس ادغام در **لایه‌ی خواندن** انجام می‌شود: `aggregate.ts`.
 *
 * افزودن کارِ خودکار تازه: یک `logActivityAsync` با `entity` مناسب در مسیر
 * نوشتن بگذارید، و یک `StaffTaskType` با `source = SYSTEM` و همان `systemKey`
 * بسازید. هیچ کد گزارشی عوض نمی‌شود.
 *
 * مستندات: docs/features/staff-worklist.md بخش ۹
 */

import { prisma } from "@/lib/prisma";
import type { Prisma, ActivityAction, ActivityEntity } from "@prisma/client";

export interface SystemSource {
  /** همان `StaffTaskType.systemKey` */
  key: string;
  label: string;
  /** از `ActivityLog` می‌آید، یا کوئری اختصاصی دارد */
  from: "activity" | "custom";
  actions?: ActivityAction[];
  entity?: ActivityEntity;
}

export const SYSTEM_SOURCES: SystemSource[] = [
  { key: "PRODUCT_CREATE", label: "محصول‌گذاری", from: "activity", actions: ["CREATE"], entity: "PRODUCT" },
  { key: "PRODUCT_UPDATE", label: "ویرایش محصول", from: "activity", actions: ["UPDATE"], entity: "PRODUCT" },
  { key: "PRICE_BULK", label: "ویرایش گروهی قیمت و موجودی", from: "activity", actions: ["BULK_UPDATE"], entity: "PRODUCT" },
  { key: "BLOG_WRITE", label: "مقاله‌نویسی", from: "activity", actions: ["CREATE", "UPDATE"], entity: "BLOG" },
  { key: "MEDIA_UPLOAD", label: "آپلود رسانه", from: "activity", actions: ["UPLOAD"], entity: "MEDIA" },
  // این دو از `ActivityLog` نمی‌آیند و کوئری مستقیم دارند
  { key: "ORDER_BY_STAFF", label: "ثبت سفارش تلفنی", from: "custom" },
  { key: "ORDER_TRACKING", label: "ثبت بیجک و کد مرسوله", from: "custom" },
];

const BY_KEY = new Map(SYSTEM_SOURCES.map((s) => [s.key, s]));

export function systemSource(key: string): SystemSource | undefined {
  return BY_KEY.get(key);
}

/** شرط `ActivityLog` برای یک منبع — `null` یعنی از دفتر فعالیت نمی‌آید */
export function activityWhere(source: SystemSource): Prisma.ActivityLogWhereInput | null {
  if (source.from !== "activity" || !source.entity || !source.actions?.length) return null;
  return { entity: source.entity, action: { in: source.actions } };
}

export interface SystemCount {
  key: string;
  label: string;
  /** شناسه‌ی کارمند به تعداد */
  byActor: Record<string, number>;
  total: number;
}

/**
 * شمارش کارِ خودکار هر کارمند در یک بازه.
 *
 * مبنای زمان `ActivityLog.createdAt` است، همان‌طور که مبنای کار دستی
 * `StaffTask.createdAt` است. هر دو یعنی «کِی این کار ثبت شد».
 */
export async function countSystemWork(
  from: Date,
  to: Date,
  actorIds?: string[],
): Promise<SystemCount[]> {
  const out: SystemCount[] = [];

  for (const source of SYSTEM_SOURCES) {
    const where = activityWhere(source);
    if (!where) continue;

    const rows = await prisma.activityLog.groupBy({
      by: ["actorId"],
      where: {
        ...where,
        createdAt: { gte: from, lte: to },
        ...(actorIds?.length ? { actorId: { in: actorIds } } : {}),
      },
      _count: { _all: true },
    });

    const byActor: Record<string, number> = {};
    let total = 0;
    for (const r of rows) {
      if (!r.actorId) continue; // فعالیتِ بی‌صاحب در گزارش عملکرد جایی ندارد
      byActor[r.actorId] = r._count._all;
      total += r._count._all;
    }
    out.push({ key: source.key, label: source.label, byActor, total });
  }

  // ── سفارش تلفنی: مستقیم از جدول Order ─────────────────────────
  const orders = await prisma.order.groupBy({
    by: ["createdByStaffId"],
    where: {
      createdByStaffId: actorIds?.length ? { in: actorIds } : { not: null },
      createdAt: { gte: from, lte: to },
    },
    _count: { _all: true },
  });

  const orderByActor: Record<string, number> = {};
  let orderTotal = 0;
  for (const o of orders) {
    if (!o.createdByStaffId) continue;
    orderByActor[o.createdByStaffId] = o._count._all;
    orderTotal += o._count._all;
  }
  out.push({
    key: "ORDER_BY_STAFF",
    label: "ثبت سفارش تلفنی",
    byActor: orderByActor,
    total: orderTotal,
  });

  return out;
}
