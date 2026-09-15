/**
 * تأمین‌کننده‌ها — فهرست مشترکِ کار و معامله.
 *
 * بخش ۱۹ مستندات، سؤال‌های ۳ و ۹: تا امروز جایی ثبت نبودند. انتخاب از فهرست
 * است و اگر نبود **همان‌جا سریع اضافه می‌شود** — فرمی که کارمند را برای
 * افزودن تأمین‌کننده به صفحه‌ی دیگری بفرستد، یعنی نام دوباره متن آزاد تایپ می‌شود.
 *
 * ⚠️ تکرار با `nameKey` یکتا گرفته می‌شود نه با جستجوی قبلی: «شركت الف» با
 * ک عربی و «شرکت  الف» با دو فاصله همان تأمین‌کننده‌اند.
 */

import { prisma } from "@/lib/prisma";
import type { StaffAccess } from "@/lib/permissions";
import { normalizePhone } from "@/lib/club/phone";

export const SUPPLIER_SELECT = {
  id: true,
  name: true,
  contactName: true,
  phone: true,
  city: true,
  note: true,
  isActive: true,
  createdByName: true,
  createdAt: true,
  _count: { select: { tasks: true } },
} as const;

/** کلید مقایسه: ی و ک عربی، نیم‌فاصله، فاصله‌ی تکراری و حروف بزرگ یکسان می‌شوند */
export function supplierKey(name: string): string {
  return name
    .replace(/ي/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/[‌‏‎]/g, " ")
    .replace(/[ً-ٰٟ]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function clean(v: unknown, max = 200): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim().slice(0, max);
  return t || null;
}

export interface SupplierInput {
  name?: unknown;
  contactName?: unknown;
  phone?: unknown;
  city?: unknown;
  note?: unknown;
  isActive?: unknown;
}

export async function listSuppliers(opts: { q?: string | null; includeInactive?: boolean; take?: number }) {
  const key = opts.q ? supplierKey(opts.q) : "";
  return prisma.staffSupplier.findMany({
    where: {
      ...(opts.includeInactive ? {} : { isActive: true }),
      ...(key
        ? {
            OR: [
              { nameKey: { contains: key } },
              { contactName: { contains: opts.q!.trim(), mode: "insensitive" } },
              { phone: { contains: opts.q!.trim() } },
            ],
          }
        : {}),
    },
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
    take: opts.take ?? 200,
    select: SUPPLIER_SELECT,
  });
}

/**
 * ساخت تأمین‌کننده. اگر همین نام (با کلید نرمال) از قبل باشد، همان برمی‌گردد
 * و `existed: true` — افزودن سریع از فرم کار نباید با خطای «تکراری» متوقف شود.
 * تأمین‌کننده‌ی غیرفعالِ هم‌نام دوباره فعال می‌شود.
 */
export async function createSupplier(input: SupplierInput, access: StaffAccess) {
  const name = clean(input.name, 120);
  if (!name) throw new Error("نام تأمین‌کننده لازم است");
  const nameKey = supplierKey(name);

  const existing = await prisma.staffSupplier.findUnique({ where: { nameKey }, select: { id: true, isActive: true } });
  if (existing) {
    const supplier = existing.isActive
      ? await prisma.staffSupplier.findUniqueOrThrow({ where: { id: existing.id }, select: SUPPLIER_SELECT })
      : await prisma.staffSupplier.update({ where: { id: existing.id }, data: { isActive: true }, select: SUPPLIER_SELECT });
    return { supplier, existed: true };
  }

  const rawPhone = clean(input.phone, 30);
  try {
    const supplier = await prisma.staffSupplier.create({
      data: {
        name,
        nameKey,
        contactName: clean(input.contactName, 120),
        // شماره‌ی ثابت هم مجاز است؛ فقط موبایل نرمال می‌شود (تله‌ی ۱۲)
        phone: rawPhone ? normalizePhone(rawPhone) ?? rawPhone : null,
        city: clean(input.city, 80),
        note: clean(input.note, 1000),
        createdById: access.userId,
        createdByName: access.name,
      },
      select: SUPPLIER_SELECT,
    });
    return { supplier, existed: false };
  } catch (e) {
    // دو نفر هم‌زمان همین نام را ساختند — مرز واقعی ایندکس یکتاست
    if ((e as { code?: string }).code === "P2002") {
      const supplier = await prisma.staffSupplier.findUniqueOrThrow({ where: { nameKey }, select: SUPPLIER_SELECT });
      return { supplier, existed: true };
    }
    throw e;
  }
}

export async function updateSupplier(id: string, input: SupplierInput) {
  const has = (k: keyof SupplierInput) => Object.prototype.hasOwnProperty.call(input, k);
  const data: Record<string, unknown> = {};

  if (has("name")) {
    const name = clean(input.name, 120);
    if (!name) throw new Error("نام تأمین‌کننده لازم است");
    data.name = name;
    data.nameKey = supplierKey(name);
  }
  if (has("contactName")) data.contactName = clean(input.contactName, 120);
  if (has("phone")) {
    const raw = clean(input.phone, 30);
    data.phone = raw ? normalizePhone(raw) ?? raw : null;
  }
  if (has("city")) data.city = clean(input.city, 80);
  if (has("note")) data.note = clean(input.note, 1000);
  if (has("isActive")) data.isActive = input.isActive === true;

  try {
    return await prisma.staffSupplier.update({ where: { id }, data, select: SUPPLIER_SELECT });
  } catch (e) {
    const code = (e as { code?: string }).code;
    if (code === "P2002") throw new Error("تأمین‌کننده‌ای با همین نام از قبل ثبت شده است");
    if (code === "P2025") throw new Error("تأمین‌کننده پیدا نشد");
    throw e;
  }
}

/** نام اسنپ‌شات برای `StaffTask.supplierName` — `null` یعنی شناسه نامعتبر است */
export async function supplierSnapshot(id: string): Promise<{ id: string; name: string } | null> {
  return prisma.staffSupplier.findUnique({ where: { id }, select: { id: true, name: true } });
}
