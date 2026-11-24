-- تنظیمات یکپارچه‌سازی: بخش‌های خاموش، نوع کسب‌وکار، تنظیم هر پلتفرم
ALTER TABLE "IntegSettings" ADD COLUMN IF NOT EXISTS "hiddenSections" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "IntegSettings" ADD COLUMN IF NOT EXISTS "profile" TEXT;
ALTER TABLE "IntegSettings" ADD COLUMN IF NOT EXISTS "platformPrefs" JSONB NOT NULL DEFAULT '{}';
