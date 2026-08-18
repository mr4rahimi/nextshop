# تغییرات امنیتی — خلاصه کامل

تاریخ اعمال: ۲۰۲۶-۰۶-۱۸  
شاخه: `main`  
Commits: `5cdbdab` → `9d300f8`

---

## ۱. حذف کامنت‌های فارسی از سورس کد

- **۱۴۱ فایل** پاکسازی شد
- هیچ تغییری در منطق یا نمایش ایجاد نشد
- Commit: `chore: remove all Persian comments from source files`

---

## ۲. Admin Middleware — احراز هویت پنل ادمین

**فایل جدید:** `proxy.ts` (جایگزین `middleware.ts` قدیمی — convention جدید Next.js 16)

### چه کاری می‌کنه:
- تمام مسیرهای `/api/admin/*` نیاز به JWT معتبر دارن (قبلاً کاملاً باز بودن)
- تمام صفحات `/admin/*` بدون توکن به `/admin/login` redirect میشن
- تنها مسیر باز: `/api/admin/auth/login`
- امضای JWT با HMAC-SHA256 **واقعاً تأیید** میشه (قبلاً فقط decode می‌شد بدون verify)

### قبل از این تغییر:
هر کسی بدون احراز هویت می‌توانست:
- ادمین جدید بسازه
- موجودی کیف پول تغییر بده
- محصولات رو حذف/ویرایش کنه
- اطلاعات همه کاربران رو ببینه

### Commit: `security: add admin auth middleware and file upload validation`

---

## ۳. File Upload — محدودیت نوع فایل

**فایل:** `app/api/admin/upload/route.ts`

- فقط فایل‌های تصویری مجاز: `jpeg, png, webp, gif, svg, avif`
- حداکثر حجم: **۱۰ مگابایت**
- نام فایل sanitize میشه (جلوگیری از path traversal)
- قبلاً هر فایلی با هر نوعی قابل آپلود بود

---

## ۴. OTP Rate Limiting

**فایل:** `lib/otp.ts`  
**Schema:** فیلد `attempts` به جدول `OtpCode` اضافه شد

### محدودیت‌های اضافه‌شده:
| نوع | محدودیت |
|-----|---------|
| ارسال OTP | حداکثر **۳ بار** در **۱۰ دقیقه** برای هر شماره |
| تلاش برای verify | بعد از **۵ بار اشتباه** کد باطل میشه |

### قبل از این تغییر:
- می‌شد برای یک شماره هر ثانیه SMS فرستاد (هزینه بالا)
- ۹۰۰۰ ترکیب کد ۴ رقمی در ۲ دقیقه قابل brute force بود

### Commit: `security: add OTP rate limiting and brute force protection`

---

## ۵. حذف Secret های Hardcode شده

**فایل:** `lib/auth.ts`، `proxy.ts`

- `JWT_SECRET` و `PASSWORD_SALT` دیگه fallback hardcode ندارن
- اگه env var تنظیم نباشه، سرور با خطای واضح crash می‌کنه
- مقادیر به فایل `.env.local` (که gitignore شده) منتقل شدن

### Commit: `security: remove hardcoded JWT_SECRET and PASSWORD_SALT fallbacks`

---

## ۶. ارتقای Hash پسورد از SHA-256 به bcrypt

**فایل:** `lib/auth.ts`

### تغییرات:
- پسوردهای جدید با **bcrypt** (cost factor 12) هش میشن
- پسوردهای قدیمی SHA-256 **به‌صورت خودکار** در اولین لاگین بعدی به bcrypt تبدیل میشن (migration شفاف)
- کاربران هیچ تغییری احساس نمی‌کنن

### چرا مهمه:
SHA-256 یک hash سریعه — با GPU می‌شه میلیاردها ترکیب در ثانیه تست کرد.  
bcrypt به‌عمد کند طراحی شده و brute force رو بسیار دشوار می‌کنه.

### Commit: `security: replace SHA-256 with bcrypt for password hashing`

---

## ۷. رفع مشکل ارسال پیامک

- در دیتابیس `smsEnabled = false` بود → فعال شد
- فیلدهای خالی SMS در DB به `NULL` تبدیل شدن تا env var ها به‌درستی استفاده بشن

---

---

# راهنمای به‌روزرسانی سرور

> **مهم:** قبل از deploy، همه مراحل زیر رو به ترتیب انجام بده.  
> سایت فعلی روی سرور در حال کار است — با دقت عمل کن.

---

## مرحله ۱ — تنظیم Environment Variables (ضروری)

دو متغیر جدید باید در محیط سرور تنظیم بشن. اگه تنظیم نشن **سایت بلافاصله crash می‌کنه.**

```
JWT_SECRET=f8b230e55a431339462dddd54e79a4712361a36286ce4f1104b06c958e222853
PASSWORD_SALT=mymonta-salt
```

محل تنظیم بسته به پنل هاستینگ متفاوته:
- **Liara:** پنل → تنظیمات → متغیرهای محیطی
- **فایل `.env.production`** روی سرور (اگه دسترسی مستقیم داری)

---

## مرحله ۲ — Migration دیتابیس (ضروری)

یک فیلد جدید به جدول `OtpCode` اضافه شده. این دستور رو روی دیتابیس سرور اجرا کن:

```sql
ALTER TABLE "OtpCode" ADD COLUMN IF NOT EXISTS "attempts" INTEGER NOT NULL DEFAULT 0;
```

یا با Prisma (اگه دسترسی به سرور داری):
```bash
NODE_TLS_REJECT_UNAUTHORIZED=0 ./node_modules/.bin/prisma db push
```

---

## مرحله ۳ — تنظیمات SMS در دیتابیس (ضروری)

فیلدهای SMS که در دیتابیس به‌صورت string خالی ذخیره شدن رو NULL کن تا از env var استفاده بشه:

```sql
UPDATE "StoreSettings"
SET
  "smsEnabled"   = true,
  "smsApiKey"    = NULLIF(TRIM("smsApiKey"), ''),
  "smsLineNumber" = NULLIF(TRIM("smsLineNumber"), ''),
  "smsPatternOtp" = NULLIF(TRIM("smsPatternOtp"), '')
WHERE id = 'singleton';
```

> اگه API Key و شماره خط و کد پترن OTP در پنل ادمین سایت (تنظیمات → SMS) وارد شده باشن، نیازی به این مرحله نیست.

---

## مرحله ۴ — تأیید پسورد ادمین

بعد از deploy، **حتماً** لاگین ادمین رو تست کن:

1. برو به `/admin/login`
2. با شماره و پسورد ادمین وارد شو
3. اگه لاگین موفق بود، hash پسورد از SHA-256 به bcrypt **خودکار** ارتقا می‌یابد

اگه پسورد ادمین‌ها رو نمیدونی، با دستور زیر ریست کن (روی سرور):
```bash
node -e "
const bcrypt = require('bcryptjs');
bcrypt.hash('NEW_PASSWORD_HERE', 12).then(h => {
  console.log('UPDATE \"User\" SET \"passwordHash\"=\'' + h + '\' WHERE phone=\'PHONE_HERE\';');
});
"
```
و SQL خروجی رو روی دیتابیس اجرا کن.

---

## مرحله ۵ — اجرا و تست بعد از Deploy

بعد از بالا اومدن سایت این موارد رو تست کن:

```
✅ صفحه اصلی فروشگاه باز میشه
✅ لیست محصولات نمایش داده میشه
✅ /admin/login → فرم لاگین نمایش داده میشه
✅ /admin → بدون لاگین به /admin/login هدایت میشه
✅ /api/admin/products بدون توکن → 401 برمیگردونه
✅ لاگین ادمین با پسورد صحیح → موفق
✅ پنل ادمین بعد از لاگین → کار می‌کنه
✅ ارسال OTP برای کاربر → پیامک می‌رسه
```

---

## خلاصه تغییرات از دید کاربر نهایی

| چه چیزی تغییر کرد | تأثیر روی کاربر |
|--------------------|-----------------|
| احراز هویت ادمین | ادمین باید لاگین کنه (اگه session قبلی داشت، باید دوباره وارد بشه) |
| bcrypt پسورد | اولین لاگین بعد از deploy ممکنه ۱-۲ ثانیه کندتر باشه |
| rate limit OTP | کاربری که بیش از ۳ بار در ۱۰ دقیقه OTP بگیره، پیام خطا می‌بینه |
| بقیه تغییرات | **هیچ تأثیری روی کاربر عادی ندارن** |

