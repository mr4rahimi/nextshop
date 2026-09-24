/**
 * سال مالی و تاریخ قفل — docs/plans/accounting.md بخش ۱۷.
 *
 * هر ثبتی (سند، کاردکس) اول از `assertPostable` رد می‌شود: تاریخ باید داخل یک
 * سال مالی باز و بعد از تاریخ قفل باشد.
 */

import type { AccFiscalYear, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { AccError } from "../errors";
import { jalaliYearBounds, jalaliYearOf, todayKey } from "../dates";
import { formatJalali } from "@/lib/club/jalali";

type Db = Prisma.TransactionClient | typeof prisma;

export async function yearForDate(db: Db, day: Date): Promise<AccFiscalYear | null> {
  return db.accFiscalYear.findFirst({
    where: { startDate: { lte: day }, endDate: { gte: day } },
  });
}

/** سال باز همین تاریخ، یا خطای خوانا */
export async function assertPostable(db: Db, day: Date): Promise<AccFiscalYear> {
  const year = await yearForDate(db, day);
  if (!year) throw new AccError(`برای تاریخ ${formatJalali(day)} سال مالی تعریف نشده است`);
  if (year.status === "CLOSED") throw new AccError(`سال مالی ${year.title} بسته شده است`);
  const settings = await db.accSettings.findUnique({ where: { id: "singleton" }, select: { lockDate: true } });
  if (settings?.lockDate && day.getTime() <= settings.lockDate.getTime()) {
    throw new AccError(
      `دفاتر تا ${formatJalali(settings.lockDate)} قفل شده‌اند؛ ثبت یا تغییر با تاریخ ${formatJalali(day)} ممکن نیست`,
    );
  }
  return year;
}

/** ساخت سال مالی شمسی (فروردین تا اسفند). تکراری بودن خطا نیست. */
export async function ensureFiscalYear(db: Db, jy: number): Promise<AccFiscalYear> {
  const { start, end } = jalaliYearBounds(jy);
  const existing = await db.accFiscalYear.findUnique({ where: { startDate: start } });
  if (existing) return existing;
  const overlap = await db.accFiscalYear.findFirst({
    where: { startDate: { lte: end }, endDate: { gte: start } },
  });
  if (overlap) throw new AccError(`این بازه با سال مالی ${overlap.title} هم‌پوشانی دارد`);
  return db.accFiscalYear.create({
    data: { title: String(jy), startDate: start, endDate: end },
  });
}

export async function currentYear(db: Db = prisma): Promise<AccFiscalYear | null> {
  const s = await db.accSettings.findUnique({ where: { id: "singleton" }, select: { currentYearId: true } });
  if (s?.currentYearId) {
    const y = await db.accFiscalYear.findUnique({ where: { id: s.currentYearId } });
    if (y) return y;
  }
  return yearForDate(db, todayKey());
}

export { jalaliYearOf };
