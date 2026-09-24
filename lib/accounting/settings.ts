/**
 * حالت حسابداری — کدام حسابداری منبع حقیقت است.
 *
 * انحصاری است (docs/plans/accounting.md تصمیم ۱):
 *   NONE     حسابداری انتخاب نشده
 *   HESABAN  حسابداری بیرونی حسابان وب — همان اتصال قبلی یکپارچه‌سازی، دست‌نخورده
 *   INTERNAL حسابداری داخلی پنل — هیچ وابستگی‌ای به حسابان ندارد
 *
 * ⚠️ حسابان فقط الگوی امکانات و منبع انتقال داده است (تصمیم ۱۴). هیچ کدی در
 *    `lib/accounting/` آداپتور حسابان را صدا نمی‌زند، جز ویزارد انتقال.
 */

import type { AccMode } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type { AccMode };

export const ACC_MODE_LABELS: Record<AccMode, string> = {
  NONE: "انتخاب نشده",
  HESABAN: "حسابان وب (بیرونی)",
  INTERNAL: "حسابداری داخلی",
};

/** حالت‌هایی که فعلاً از پنل قابل انتخاب‌اند — داخلی با راه‌اندازی سال مالی باز می‌شود (فاز ۲) */
export const SELECTABLE_MODES: AccMode[] = ["NONE", "HESABAN"];

export async function getAccSettings() {
  return prisma.accSettings.upsert({
    where: { id: "singleton" },
    update: {},
    create: { id: "singleton" },
  });
}

export async function getAccMode(): Promise<AccMode> {
  const row = await prisma.accSettings.findUnique({
    where: { id: "singleton" },
    select: { mode: true },
  });
  return row?.mode ?? "NONE";
}

/**
 * آیا فاکتور خودکار حسابان باید اجرا شود؟
 *
 * فقط در حالت داخلی خاموش است. `NONE` عمداً خاموشش نمی‌کند: سایتی که بعد از
 * مهاجرت اتصال حسابان ساخته (و حالت را عوض نکرده) نباید بی‌صدا فاکتورش قطع شود.
 */
export async function isHesabanInvoicingAllowed(): Promise<boolean> {
  return (await getAccMode()) !== "INTERNAL";
}
