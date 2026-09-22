/**
 * وضعیت کالا — نو، استوک، دست‌دوم، بازسازی‌شده.
 *
 * ⚠️ **عمداً فایل جداست و هیچ وابستگی‌ای ندارد.** برچسب‌ها هم در فیلتر سمت
 * کاربر لازم‌اند هم در لایه‌ی کاتالوگ سمت سرور؛ اگر از `lib/catalog` بیایند،
 * `prisma` وارد باندل مرورگر می‌شود و بیلد با «Can't resolve 'dns'» می‌شکند.
 *
 * فهرست ثابت در کد است چون enum دیتابیس است، نه داده‌ی قابل تنظیم. ولی
 * فیلترِ سایت فقط وقتی دیده می‌شود که دسته **بیش از یک وضعیت** داشته باشد.
 */

export const CONDITIONS = ["NEW", "STOCK", "USED", "REFURBISHED"] as const;
export type ConditionType = (typeof CONDITIONS)[number];

export const CONDITION_LABELS: Record<ConditionType, string> = {
  NEW: "نو",
  STOCK: "استوک",
  USED: "دست‌دوم",
  REFURBISHED: "بازسازی‌شده",
};
