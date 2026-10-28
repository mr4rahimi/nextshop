#!/usr/bin/env bash
# ریست شبانه‌ی دموی عمومی — docs/plans/demo.md بخش «ریست شبانه»
#
#   /var/www/gardanos-demo/scripts/demo/reset.sh
#   cron:  30 4 * * *  /var/www/gardanos-demo/scripts/demo/reset.sh >> /var/log/gardanos-demo-reset.log 2>&1
#
# دیتابیس از نو ساخته و سید دوباره اجرا می‌شود تا تاریخ سفارش‌ها و گزارش‌ها همیشه
# نسبت به امروز باشند. جدول `DemoLead` (شماره‌های ورود) پیش از پاک‌شدن بیرون
# کشیده و بعد برگردانده می‌شود. آپلودهای بازدیدکننده‌ها هم پاک می‌شوند.
#
# ⚠️ فقط روی نصبی که در .env خود `DEMO_MODE=1` دارد اجرا می‌شود.
# ⚠️ کاربر دیتابیس باید مالک schema ی public باشد (راهنمای نصب همین را می‌سازد).

set -euo pipefail
cd "$(dirname "$0")/../.."
PM2_NAME="${PM2_NAME:-gardanos-demo}"

envget() { node -e "require('dotenv').config({ quiet: true }); process.stdout.write(process.env['$1'] ?? '')"; }

if [ "$(envget DEMO_MODE)" != "1" ]; then
  echo "❌ DEMO_MODE=1 در .env نیست — ریست انجام نشد"
  exit 1
fi
# psql پارامترهای Prisma (?schema=…) را نمی‌شناسد
DB_URL="$(envget DATABASE_URL)"
DB_URL="${DB_URL%%\?*}"

echo "== $(date '+%F %T') ریست دمو"
LEADS="$(mktemp)"
COLS='id, phone, source, visits, ip, "userAgent", "firstAt", "lastAt", sections'
psql "$DB_URL" -qc "\\copy (SELECT $COLS FROM \"DemoLead\") TO '$LEADS' CSV" 2>/dev/null || : > "$LEADS"
echo "شماره‌های نگه‌داشته: $(wc -l < "$LEADS")"
# پشتیبان روزانه‌ی شماره‌ها — بیرون از مسیر وب
mkdir -p /var/backups/gardanos-demo 2>/dev/null && cp "$LEADS" "/var/backups/gardanos-demo/leads-$(date +%F).csv" 2>/dev/null || true

pm2 stop "$PM2_NAME" >/dev/null || true
trap 'pm2 start "$PM2_NAME" >/dev/null || true' EXIT

psql "$DB_URL" -qc 'DROP SCHEMA public CASCADE; CREATE SCHEMA public;' 2>/dev/null
npx prisma migrate deploy >/dev/null

# آپلودهای بازدیدکننده‌ها — سید تصویرهای خودش را دوباره کپی می‌کند
find public/uploads -mindepth 1 -delete 2>/dev/null || true
# کش صفحه‌ها شناسه‌های دیروز را دارد
rm -rf .next/cache

npx tsx scripts/demo/seed.ts
psql "$DB_URL" -qc "\\copy \"DemoLead\" ($COLS) FROM '$LEADS' CSV"
rm -f "$LEADS"
echo "✅ $(date '+%F %T') ریست کامل شد"
