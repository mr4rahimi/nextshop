/**
 * مالکیت و دسته‌ی مشتری — لایه‌ی کارتابل روی باشگاه مشتریان (فاز ۸).
 *
 * مشتری‌ها فقط یک جا هستند: `ClubProfile`. صفحه‌ی جدای «مشتریان» در کارتابل
 * ساخته نشد تا دو فهرست مشتری کنار هم نباشند.
 *
 * ⚠️ سه قاعده که این فایل رویشان ایستاده (بخش ۲۱ مستندات کارتابل):
 *
 * **۱. تصاحب خودکار فقط روی مشتریِ بی‌صاحب.** شرط `ownerId: null` داخل خودِ
 * `updateMany` است، نه یک خواندن قبلی — دو تماس هم‌زمان نمی‌توانند هر دو برنده شوند.
 *
 * **۲. هیچ جابه‌جایی بی‌ردپا نیست.** هر تغییر صاحب یک ردیف `ClubOwnerTransfer`
 * می‌سازد، و پورسانت بخش ۲۲ به همین تاریخچه تکیه دارد.
 *
 * **۳. تصاحب هیچ‌وقت مسیر اصلی را نمی‌شکند** (تله‌ی ۸) — `claimIfUnowned`
 * خطا پرتاب نمی‌کند.
 */

import { prisma } from "@/lib/prisma";
import type { Prisma, StaffClaimSource } from "@prisma/client";
import { can, type StaffAccess } from "@/lib/permissions";
import { normalizePhone } from "./phone";
import { ensureClubProfile, upsertClubCustomer } from "./profile";

export const CLAIM_LABELS: Record<StaffClaimSource, string> = {
  MANUAL: "ثبت دستی",
  CALL: "نتیجه‌ی تماس",
  ORDER: "سفارش تلفنی",
  ADMIN: "تخصیص مدیر",
};

/** کانال‌هایی که «تماس» حساب می‌شوند و مالکیت می‌آورند */
export const CLAIMING_CHANNELS = ["CALL_IN", "CALL_OUT"] as const;

/**
 * مرز دسترسی فهرست اعضا.
 *
 * بدون `CUSTOMER_VIEW_ALL` فقط مشتریان خودِ کارمند. این شرط باید **کنار**
 * فیلترهای جستجو در `AND` بنشیند، نه جایشان (تله‌ی ۱۶).
 */
export function ownershipScope(access: StaffAccess): Prisma.ClubProfileWhereInput | null {
  if (can(access, "CUSTOMER_VIEW_ALL")) return null;
  return { ownerId: access.userId };
}

export async function canSeeProfile(access: StaffAccess, profileId: string): Promise<boolean> {
  if (can(access, "CUSTOMER_VIEW_ALL")) return true;
  const hit = await prisma.clubProfile.findFirst({
    where: { id: profileId, ownerId: access.userId },
    select: { id: true },
  });
  return !!hit;
}

/**
 * `ensureClubProfile` با تحمل ساخت هم‌زمان.
 *
 * دو تماس هم‌زمان روی کاربری که هنوز پروفایل ندارد هر دو `create` می‌زنند و
 * دومی به ایندکس یکتای `userId` می‌خورد. آن برخورد خطا نیست — یعنی پروفایل
 * همین حالا ساخته شد و باید همان را خواند.
 */
async function ensureProfileSafe(userId: string) {
  try {
    return await ensureClubProfile(userId, { source: "CALLER_ID" });
  } catch (e) {
    if ((e as { code?: string }).code !== "P2002") throw e;
    return prisma.clubProfile.findUniqueOrThrow({ where: { userId } });
  }
}

/**
 * تصاحب مشتریِ بی‌صاحب. `true` یعنی همین فراخوانی صاحبش کرد.
 *
 * برای تماس و سفارش تلفنی صدا زده می‌شود. هرگز throw نمی‌کند.
 */
export async function claimIfUnowned(opts: {
  userId: string;
  ownerId: string;
  ownerName: string;
  via: StaffClaimSource;
  taskId?: string | null;
}): Promise<boolean> {
  try {
    const profile = await ensureProfileSafe(opts.userId);
    const now = new Date();

    const { count } = await prisma.clubProfile.updateMany({
      where: { id: profile.id, ownerId: null },
      data: {
        ownerId: opts.ownerId,
        ownerName: opts.ownerName,
        claimedVia: opts.via,
        claimedAt: now,
        claimTaskId: opts.taskId ?? null,
      },
    });
    if (count === 0) return false;

    await prisma.clubOwnerTransfer.create({
      data: {
        profileId: profile.id,
        toId: opts.ownerId,
        toName: opts.ownerName,
        byId: opts.ownerId,
        byName: opts.ownerName,
        via: opts.via,
      },
    });
    return true;
  } catch (e) {
    console.error("[club] تصاحب مشتری شکست خورد:", e);
    return false;
  }
}

/**
 * تعیین یا جابه‌جایی صاحب چند مشتری — کار صریح مدیر (`CUSTOMER_ASSIGN`).
 *
 * `toId = null` مشتری را بی‌صاحب می‌کند. هر پروفایلی که صاحبش واقعاً عوض
 * شده، یک ردیف تاریخچه می‌گیرد.
 */
export async function assignOwner(
  profileIds: string[],
  toId: string | null,
  access: StaffAccess,
  reason?: string | null,
): Promise<{ changed: number }> {
  let toName: string | null = null;
  if (toId) {
    const to = await prisma.user.findUnique({
      where: { id: toId },
      select: { firstName: true, lastName: true, phone: true, role: true, isActive: true },
    });
    if (!to || !to.isActive || (to.role !== "ADMIN" && to.role !== "SELLER")) {
      throw new Error("صاحب جدید باید یکی از کارکنان فعال باشد");
    }
    toName = [to.firstName, to.lastName].filter(Boolean).join(" ").trim() || to.phone;
  }

  const profiles = await prisma.clubProfile.findMany({
    where: { id: { in: profileIds.slice(0, 500) } },
    select: { id: true, ownerId: true, ownerName: true },
  });
  const moving = profiles.filter((p) => p.ownerId !== toId);
  if (moving.length === 0) return { changed: 0 };

  const now = new Date();
  await prisma.$transaction([
    prisma.clubProfile.updateMany({
      where: { id: { in: moving.map((p) => p.id) } },
      data: {
        ownerId: toId,
        ownerName: toName,
        claimedVia: toId ? "ADMIN" : null,
        claimedAt: toId ? now : null,
        claimTaskId: null,
      },
    }),
    prisma.clubOwnerTransfer.createMany({
      data: moving.map((p) => ({
        profileId: p.id,
        fromId: p.ownerId,
        fromName: p.ownerName,
        toId,
        toName,
        byId: access.userId,
        byName: access.name,
        via: "ADMIN" as const,
        reason: reason?.trim().slice(0, 500) || null,
      })),
    }),
  ]);

  return { changed: moving.length };
}

export async function setCategory(profileIds: string[], categoryId: string | null): Promise<number> {
  if (categoryId) {
    const cat = await prisma.clubCustomerCategory.findUnique({ where: { id: categoryId }, select: { isActive: true } });
    if (!cat?.isActive) throw new Error("دسته پیدا نشد یا غیرفعال است");
  }
  const { count } = await prisma.clubProfile.updateMany({
    where: { id: { in: profileIds.slice(0, 500) } },
    data: { categoryId },
  });
  return count;
}

export type AddCustomerResult =
  | { ok: true; profileId: string; created: boolean; alreadyMine: boolean }
  | { ok: false; error: string; ownerName?: string };

/**
 * ثبت دستی مشتری از فرم سه‌فیلدی (شماره، نام، دسته) — چهار حالت بخش ۲۱.۴.
 *
 * حالت «مال کس دیگری است» نام صاحب را برمی‌گرداند ولی هیچ اطلاعاتی از خود
 * مشتری نه؛ کارمند می‌رود با همکارش حرف می‌زند به‌جای پنج بار امتحان‌کردن.
 */
export async function addCustomer(
  input: { phone: string; firstName?: string | null; lastName?: string | null; categoryId?: string | null },
  access: StaffAccess,
): Promise<AddCustomerResult> {
  const phone = normalizePhone(input.phone);
  if (!phone) return { ok: false, error: "شماره‌ی موبایل معتبر نیست" };

  const existing = await prisma.user.findUnique({
    where: { phone },
    select: { id: true, clubProfile: { select: { id: true, ownerId: true, ownerName: true } } },
  });
  const owned = existing?.clubProfile;

  if (owned?.ownerId && owned.ownerId !== access.userId) {
    return {
      ok: false,
      error: `این شماره در فهرست مشتریان ${owned.ownerName ?? "همکار دیگری"} ثبت شده است`,
      ownerName: owned.ownerName ?? undefined,
    };
  }
  if (owned?.ownerId === access.userId) {
    return { ok: true, profileId: owned.id, created: false, alreadyMine: true };
  }

  const result = await upsertClubCustomer({
    phone,
    firstName: input.firstName?.trim() || null,
    lastName: input.lastName?.trim() || null,
    source: "CALLER_ID",
    registeredById: access.userId,
  });

  const claimed = await claimIfUnowned({
    userId: result.userId,
    ownerId: access.userId,
    ownerName: access.name,
    via: "MANUAL",
  });
  if (!claimed) {
    // بین خواندن و نوشتن کسی دیگر صاحبش شد
    const p = await prisma.clubProfile.findUnique({ where: { id: result.profileId }, select: { ownerId: true, ownerName: true } });
    if (p?.ownerId !== access.userId) {
      return { ok: false, error: `این شماره در فهرست مشتریان ${p?.ownerName ?? "همکار دیگری"} ثبت شده است` };
    }
  }

  if (input.categoryId) {
    await setCategory([result.profileId], input.categoryId).catch(() => {});
  }

  return { ok: true, profileId: result.profileId, created: result.isNewUser, alreadyMine: false };
}

// ─────────────────────────────────────────────────────────────────
// گزارش پخش مشتری بین کارکنان — بخش ۲۱.۶
// ─────────────────────────────────────────────────────────────────

export interface OwnerReportRow {
  ownerId: string | null;
  ownerName: string;
  customers: number;
  byCategory: Record<string, number>;
  lifetimeSpent: string;
  lifetimeOrders: number;
  rangeSpent: string;
  rangeOrders: number;
  lastPurchaseAt: string | null;
}

const PAID_STATUSES = ["PAID", "CONFIRMED", "PROCESSING", "PACKAGING", "SHIPPED", "DELIVERED", "COMPLETED"];

/**
 * یک ردیف به‌ازای هر صاحب، به‌علاوه‌ی ردیف «بی‌صاحب».
 *
 * کوئری خام آگاهانه است: کپیِ سوم از `totalSpent` روی جدول دیگر یعنی عددی که
 * روزی با واقعیت نمی‌خواند. «کل عمر» از پروفایل باشگاه، «بازه» از سفارش‌ها.
 */
export async function ownerReport(from: Date, to: Date): Promise<OwnerReportRow[]> {
  const [lifetime, categories, range] = await Promise.all([
    prisma.$queryRaw<
      { ownerId: string | null; ownerName: string | null; customers: bigint; spent: bigint | null; orders: bigint | null; last: Date | null }[]
    >`
      SELECT "ownerId", MAX("ownerName") AS "ownerName", COUNT(*) AS customers,
             SUM("totalSpent") AS spent, SUM("orderCount") AS orders, MAX("lastPurchaseAt") AS last
      FROM "ClubProfile"
      GROUP BY "ownerId"
    `,
    prisma.$queryRaw<{ ownerId: string | null; title: string | null; n: bigint }[]>`
      SELECT p."ownerId", c."title", COUNT(*) AS n
      FROM "ClubProfile" p
      LEFT JOIN "ClubCustomerCategory" c ON c."id" = p."categoryId"
      GROUP BY p."ownerId", c."title"
    `,
    prisma.$queryRaw<{ ownerId: string | null; spent: bigint | null; orders: bigint }[]>`
      SELECT p."ownerId", SUM(o."grandTotal") AS spent, COUNT(o."id") AS orders
      FROM "Order" o
      JOIN "ClubProfile" p ON p."userId" = o."userId"
      WHERE o."status"::text = ANY(${PAID_STATUSES})
        AND o."createdAt" >= ${from} AND o."createdAt" < ${to}
      GROUP BY p."ownerId"
    `,
  ]);

  const rangeBy = new Map(range.map((r) => [r.ownerId, r]));
  const catBy = new Map<string | null, Record<string, number>>();
  for (const c of categories) {
    const m = catBy.get(c.ownerId) ?? {};
    m[c.title ?? "بدون دسته"] = Number(c.n);
    catBy.set(c.ownerId, m);
  }

  return lifetime
    .map((r) => ({
      ownerId: r.ownerId,
      ownerName: r.ownerId ? r.ownerName ?? "نامشخص" : "بی‌صاحب",
      customers: Number(r.customers),
      byCategory: catBy.get(r.ownerId) ?? {},
      lifetimeSpent: String(r.spent ?? 0n),
      lifetimeOrders: Number(r.orders ?? 0n),
      rangeSpent: String(rangeBy.get(r.ownerId)?.spent ?? 0n),
      rangeOrders: Number(rangeBy.get(r.ownerId)?.orders ?? 0n),
      lastPurchaseAt: r.last?.toISOString() ?? null,
    }))
    .sort((a, b) => {
      // بی‌صاحب همیشه آخر، بقیه به ترتیب خرید کل عمر
      if (!a.ownerId) return 1;
      if (!b.ownerId) return -1;
      return Number(BigInt(b.lifetimeSpent) - BigInt(a.lifetimeSpent));
    });
}
