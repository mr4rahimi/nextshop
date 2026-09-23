/**
 * زنجیره‌ی بعد از فروش — کار بعدی خودش ساخته می‌شود (بخش ۴ مستندات).
 *
 *   تأمین کالا ── «خرید شد» ──▶ هماهنگی ارسال با مشتری
 *   هماهنگی ارسال ── «پیک تهران» ──▶ ارسال پیک موتوری تهران (مهلت دوساعته)
 *                 ── «باربری شهرستان» یا «پست» ──▶ ارسال شهرستان (باربری انتخاب مشتری)
 *                 ── «تحویل حضوری» / «پاسخ نداد» ──▶ هیچ
 *
 * «کارمند چیزی تایپ نمی‌کند»: مشتری، سفارش و مسئول از کار قبلی کپی می‌شوند و
 * `parentId` به آن وصل است. مهلت از `slaMinutes` نوع کار (`createTask`).
 *
 * ⚠️ فقط کاری که به **سفارش** وصل است (`entity = ORDER`) زنجیره دارد — «ارسال»
 * بدون سفارش معنی ندارد.
 *
 * ⚠️ هر سفارش از هر نوع حداکثر یک کار زنجیره‌ای: `runKey = chain:{order}:{slug}`
 * ایندکس یکتا دارد. بازوبسته‌کردن کار یا دو کلیک هم‌زمان کار دوم نمی‌سازد. اگر
 * همان نوع کار برای همان سفارش از قبل دستی ساخته شده (مثلاً تیک «هماهنگی ارسال»
 * در فرم سفارش تلفنی)، زنجیره آن را تکرار نمی‌کند.
 */

import { prisma } from "@/lib/prisma";
import type { StaffAccess } from "@/lib/permissions";
import { createTask } from "./task-service";

interface Step {
  /** نوع کار بعدی */
  next: string;
  title: (orderNumber: string) => string;
  carrier?: string;
}

/** `{ نوع کار: { نتیجه: قدم بعد } }` — نتیجه‌ها همان مقادیر `seed-task-types.ts` */
const CHAIN: Record<string, Record<string, Step>> = {
  "purchase-coordination": {
    purchased: { next: "shipping-coordination", title: (n) => `هماهنگی ارسال سفارش ${n}` },
  },
  "shipping-coordination": {
    courier_tehran: { next: "dispatch-courier", title: (n) => `ارسال پیک سفارش ${n}` },
    freight: { next: "dispatch-intercity", title: (n) => `ارسال شهرستان سفارش ${n}` },
    post: { next: "dispatch-intercity", title: (n) => `ارسال پستی سفارش ${n}`, carrier: "پست" },
  },
};

export async function chainNext(taskId: string, access: StaffAccess): Promise<string | null> {
  const task = await prisma.staffTask.findUnique({
    where: { id: taskId },
    select: {
      id: true, status: true, outcome: true, entity: true, entityId: true,
      ownerId: true, ownerName: true, customerId: true, contactName: true, contactPhone: true, priority: true,
      type: { select: { slug: true } },
    },
  });
  if (!task || task.status !== "DONE" || !task.outcome) return null;
  if (task.entity !== "ORDER" || !task.entityId) return null;
  const step = CHAIN[task.type.slug]?.[task.outcome];
  if (!step) return null;

  const [type, order] = await Promise.all([
    prisma.staffTaskType.findUnique({ where: { slug: step.next }, select: { id: true, isActive: true } }),
    prisma.order.findUnique({ where: { id: task.entityId }, select: { orderNumber: true, status: true } }),
  ]);
  if (!type?.isActive || !order) return null;
  // سفارش لغوشده ارسال ندارد
  if (order.status === "CANCELED" || order.status === "REFUNDED") return null;

  const exists = await prisma.staffTask.count({
    where: { typeId: type.id, entity: "ORDER", entityId: task.entityId, status: { not: "CANCELED" } },
  });
  if (exists > 0) return null;

  try {
    const created = await createTask(
      {
        typeId: type.id,
        title: step.title(order.orderNumber),
        ownerId: task.ownerId,
        ownerName: task.ownerName,
        priority: task.priority === "URGENT" ? "HIGH" : task.priority,
        customerId: task.customerId,
        contactName: task.contactName,
        contactPhone: task.contactPhone,
        entity: "ORDER",
        entityId: task.entityId,
        carrier: step.carrier ?? null,
        parentId: task.id,
      },
      access,
      { runKey: `chain:${task.entityId}:${step.next}` },
    );
    return created.id;
  } catch (e) {
    // هم‌زمانی — کار زنجیره‌ای همین سفارش را مسیر دیگری ساخت
    if ((e as { code?: string }).code === "P2002") return null;
    throw e;
  }
}

/** نسخه‌ی بی‌خطر — بستن کار هیچ‌وقت به خاطر کار بعدی نمی‌شکند */
export function chainNextSafe(taskId: string, access: StaffAccess): void {
  chainNext(taskId, access).catch((e) => console.error("[worklist] ساخت کار بعدی زنجیره شکست خورد:", e));
}
