# PROJECT_GUIDE — راهنمای مرجع پروژه (برای Claude و توسعه‌دهنده)

## معرفی
فروشگاه اینترنتی Next.js (App Router) — نمونه مستقر: mahamprint.com
مولتی‌دیپلوی: یک کدبیس، چند سایت روی سرور با env متفاوت.

## استک
- Next.js (App Router, TS) + Tailwind — پکیج‌منیجر: pnpm
- Prisma + PostgreSQL (docker-compose فقط دیتابیس لوکال، پورت 54321)
- pm2 روی سرور (fork mode) — هر سایت یک پروسه و یک پورت
- nginx ریورس‌پراکسی جلوی همه سایت‌ها

## دیپلوی سرور (مهام‌پرینتر)
- IP سرور: 185.164.73.224
- مسیر: /var/www/mahamprinter — پروسه pm2: mahamprinter — پورت داخلی: 3002
- دامنه: mahamprint.com
- روند آپدیت: git push از لوکال → روی سرور git pull → pnpm install (در صورت نیاز)
  → npx prisma migrate deploy (در صورت migration جدید) → pnpm build → pm2 restart mahamprinter
- هشدار: چند سایت دیگر روی همین سرور بالاست — هرگز pm2 restart all و دستکاری دیتابیس سایر سایت‌ها انجام نشود.

## env های حیاتی (هر دیپلوی جدا)
- DATABASE_URL — دیتابیس همان سایت
- JWT_SECRET — احراز هویت ادمین (auth.ts / proxy.ts)
- NEXT_PUBLIC_BASE_URL / SITE_URL (lib/seo) — دامنه عمومی همان سایت (پورت پیش‌فرض 3000 نیست!)
- INTEGRATION_ENCRYPTION_KEY — hex ۶۴ کاراکتری، رمزنگاری credentials اتصال‌ها (در production اجباری)
- INTEGRATION_WORKER_SECRET — محافظ endpoint دستی worker

## ماژول‌های اصلی
- ترب: app/api/torob/v3/products/route.ts — JWT EdDSA با کلید عمومی ترب.
  نکته حل‌شده: audience باید از Host header/SITE_URL ساخته شود نه req.url (پشت پراکسی localhost می‌شود).
- درگاه پرداخت: آقای پرداخت (aghayepardakht.md) — sandbox روی لوکال
- چت هوشمند: GapGPT — کلید در DB هر سایت
- Integration Hub (نگاشت): جزئیات پایین ↓

## Integration Hub — نگاشت محصولات
هدف: حسابداری وب‌حسابان = منبع حقیقت موجودی/قیمت خرید → سینک به سایت (shop) و باسلام. قیمت فروش از قوانین قیمت (IntegPriceRule + tiers بر اساس موجودی) محاسبه می‌شود.

### جریان
1. اتصال‌ها در admin/integration/connections (تست + ذخیره؛ credentials رمز می‌شود)
2. FETCH_PRODUCTS → job در IntegJob → worker → آداپتر → IntegPlatformProduct + auto-match (IntegMappingSuggestion)
3. نگاشت‌ها: IntegMapping + IntegMappingLink (یک گروه = shop + hesaban + basalam با externalId)
4. سفارش باسلام (FETCH_ORDERS، status=3739) → کم‌کردن موجودی همه پلتفرم‌ها به‌جز حسابداری → پس از ثبت فاکتور در حسابداری، SYNC_ALL_STOCK موجودی را از حسابداری باز-همگام می‌کند
5. SYNC_ALL_PRICE: purchasePrice از حسابداری → فرمول قوانین قیمت → push به پلتفرم‌ها (باسلام قیمت×۱۰ = ریال)

### Worker
- instrumentation.ts → lib/integration/core/bootstrap.ts → هر workerIntervalSec ثانیه runWorkerCycle
- گیت اجرا: رکورد singleton در IntegSettings با workerEnabled=true — اگر رکورد نباشد worker هیچ کاری نمی‌کند (نقطه خرابی شناخته‌شده روی دیپلوی تازه)
- Endpoint دستی: POST /api/integration/worker با هدر x-worker-secret
- مانیتورینگ: /admin/integration/queue (وضعیت/خطای job ها) و IntegLog

### آداپترها
- hesaban: BASE https://app.hesabanweb.com — Bearer token — صفحه‌بندی /Product/PRODUCTS/false/{size}/{page} — کد کالا = platformId
- basalam: openapi.basalam.com (خواندن) + core.basalam.com (PATCH v3 bulk) — accessToken + vendorId — قیمت به ریال (تومان×۱۰)

## نقاط خطای شناخته‌شده / درس‌گرفته‌ها
1. پشت nginx حتماً proxy_set_header Host $host — وگرنه req.url در Next می‌شود localhost:PORT (باگ ترب ۴۰۱)
2. IntegSettings singleton باید وجود داشته باشد وگرنه worker ساکت است
3. INTEGRATION_ENCRYPTION_KEY در production اجباری است؛ عوض شدنش credentials قبلی را غیرقابل‌خواندن می‌کند (اتصال‌ها باید دوباره ذخیره شوند)
4. هر کد داخلی که localhost:3000 را پیش‌فرض گرفته (مثل app/api/chat) روی سایت‌هایی با پورت دیگر (3002) می‌شکند — همیشه از env بخوان
5. مستندات مرجع: torob (پوشه guid/پروژه)، basalam.md، hesabanweb.json، INTEGRATION_HUB.md
