-- دستیار خرید: کد تخفیفی که مدیر اجازه‌ی معرفی‌اش به مشتری را داده (۲.۹۹.۰) — docs/plans/storefront-chat.md فاز ۲. افزایشی؛ پیش‌فرض خاموش.
-- AlterTable
ALTER TABLE "Coupon" ADD COLUMN "showInChat" BOOLEAN NOT NULL DEFAULT false;
