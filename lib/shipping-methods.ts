/**
 * روش ارسال — تنها منبع حقیقتِ روش ارسال و باربری.
 *
 * دو مصرف‌کننده دارد و هیچ فهرست ثابتی در کد نمی‌ماند:
 *   • چک‌اوت سایت — `useInCheckout`
 *   • انتخابگر باربریِ کارتابل — `useInWorklist`
 *
 * تا پیش از این، باربری‌ها یک آرایه‌ی ثابت در `lib/worklist/types.ts` بودند و
 * فروشگاه بعدی یا باید با همان شش نام می‌ساخت یا کد عوض می‌شد.
 *
 * مستندات: docs/plans/business-config.md بخش ۱
 */

import type { Prisma, ShippingFeePayer, ShippingType } from "@prisma/client";

export const FEE_PAYER_LABELS: Record<ShippingFeePayer, string> = {
  COLLECT: "پس‌کرایه — مقصد می‌پردازد",
  PREPAID: "پیش‌کرایه — فروشگاه می‌دهد",
  FREE: "رایگان",
};

/** برچسب کوتاه برای کارت کار و جدول، جایی که جمله‌ی کامل جا نمی‌شود */
export const FEE_PAYER_SHORT: Record<ShippingFeePayer, string> = {
  COLLECT: "پس‌کرایه",
  PREPAID: "پیش‌کرایه",
  FREE: "رایگان",
};

const TYPES: ShippingType[] = ["EXPRESS", "STANDARD"];
const PAYERS: ShippingFeePayer[] = ["COLLECT", "PREPAID", "FREE"];

/** یک روز — بیشتر از این یعنی عدد اشتباه وارد شده، نه تعهد واقعی */
const MAX_SLA_MINUTES = 30 * 24 * 60;

function toInt(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n) : null;
}

/**
 * بدنه‌ی درخواست را به `data` امنِ Prisma تبدیل می‌کند — مشترک بین ساخت و ویرایش.
 *
 * ⚠️ مقدار نامعتبر **بی‌سروصدا به پیش‌فرض برمی‌گردد** و خطا نمی‌دهد، چون این
 * فرم سال‌هاست همین‌طور کار می‌کند و سخت‌گیر کردنش یعنی ادمین روش ارسال
 * قدیمی‌اش را دیگر نتواند ذخیره کند.
 */
export function shippingWriteData(data: Record<string, unknown>): Prisma.ShippingMethodUncheckedCreateInput {
  const sla = toInt(data.slaMinutes);
  const type = TYPES.includes(data.type as ShippingType) ? (data.type as ShippingType) : "STANDARD";
  const feePayer = PAYERS.includes(data.feePayer as ShippingFeePayer)
    ? (data.feePayer as ShippingFeePayer)
    : "COLLECT";

  return {
    title: String(data.title ?? "").trim(),
    type,
    cities: Array.isArray(data.cities) ? (data.cities as string[]) : [],
    fee: BigInt(toInt(data.fee) ?? 0),
    description: (data.description as string) || null,
    sortOrder: toInt(data.sortOrder) ?? 0,
    slaMinutes: sla !== null && sla > 0 && sla <= MAX_SLA_MINUTES ? sla : null,
    feePayer,
    // پیش‌فرض هر دو روشن است: روش ارسالی که قبل از این مهاجرت ساخته شده،
    // همان رفتار قبلی‌اش را دارد و جایی ناپدید نمی‌شود.
    useInWorklist: data.useInWorklist !== false,
    useInCheckout: data.useInCheckout !== false,
  };
}

/** «۲ ساعت» / «۲۴ ساعت» / «۹۰ دقیقه» — همان‌طور که آدم می‌گوید */
export function slaLabel(minutes: number | null | undefined): string | null {
  if (!minutes) return null;
  if (minutes % 60 !== 0) return `${minutes} دقیقه`;
  const hours = minutes / 60;
  return hours % 24 === 0 && hours >= 24 ? `${hours / 24} روز` : `${hours} ساعت`;
}
