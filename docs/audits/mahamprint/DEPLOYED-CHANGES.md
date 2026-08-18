# تغییرات اعمال‌شده روی سرور — ۱۷ آگوست ۲۰۲۶

سرور: `185.164.73.224` · سایت: `mahamprint.com` · اپ: pm2 `mahamprinter` (Next.js 16.1.1، پورت ۳۰۰۲)

---

## ۱. بکاپ (قبل از هر تغییری)

```
/root/backups/mahamprint-20260817-132245/
├── mahamprinter_db.dump          4.4M   pg_dump فرمت custom
├── mahamprinter_db.sql.gz        4.1M   همان دیتابیس به‌صورت SQL متنی
├── nginx-full.tar.gz              11K   کل /etc/nginx
├── nginx-mahamprinter.com.conf          کانفیگ سایت قبل از تغییر
├── nginx-before-redirects-*.conf        نسخه‌ی دقیق پیش از افزودن ریدایرکت‌ها
├── app.env                              متغیرهای محیطی اپ
└── next.config.ts
```

**اعتبارسنجی بکاپ:** ۵۱۵ آبجکت قابل بازیابی، ۷۷ جدول، `gzip -t` سالم.
شمارش رکوردهای زنده هنگام بکاپ: **۲۷۶۱ محصول · ۷۷ دسته · ۹۳ برند**.

### بازگرداندن در صورت نیاز

```bash
# فقط کانفیگ nginx
cp /root/backups/mahamprint-20260817-132245/nginx-before-redirects-*.conf \
   /etc/nginx/sites-available/mahamprinter.com
rm -f /etc/nginx/conf.d/mahamprint-redirects.conf
nginx -t && systemctl reload nginx

# دیتابیس (فقط در شرایط اضطراری)
pg_restore -U postgres -d mahamprinter_db -c \
   /root/backups/mahamprint-20260817-132245/mahamprinter_db.dump
```

---

## ۲. فایل‌های اضافه‌شده

| مسیر | محتوا |
|------|-------|
| `/etc/nginx/conf.d/mahamprint-redirects.conf` | تعریف دو `map` + تنظیم اندازه‌ی hash |
| `/etc/nginx/mahamprint-redirects.map` | **۲۴۳۸ ریدایرکت** مسیر قدیم → جدید |
| `/etc/nginx/mahamprint-pid.map` | **۸۲ ریدایرکت** `?productID=N` → مسیر جدید |

`map` روی `$uri` کار می‌کند که percent-decoded است و query string ندارد — به همین دلیل کلیدها به شکل decode‌شده نوشته شده‌اند.

> **نکته:** کلیدهای `map` در nginx به بزرگی/کوچکی حروف حساس نیستند. یک تصادم پیدا شد و
> به نفع نسخه‌ی پرایمپرشن‌تر ادغام شد.

---

## ۳. تغییرات کانفیگ سایت

### الف) ریدایرکت www → non-www

قبلاً `www.mahamprint.com` در `server_name` بلوک ۴۴۳ بود و کد **۲۰۰** می‌داد (محتوای تکراری).
حالا بلوک جدا شده:

```nginx
server {
    listen 443 ssl http2;
    server_name www.mahamprint.com;
    ...
    return 301 https://mahamprint.com$request_uri;
}
```

### ب) جایگزینی ریدایرکت‌های دستی دسته

چهار بلوک `location =` قبلی حذف شدند — سه‌تای‌شان به اشتباه همه به `/categories/printer` می‌رفتند.
جایگزین:

```nginx
if ($maham_redirect != "")     { return 301 $maham_redirect; }
if ($maham_pid_redirect != "") { return 301 $maham_pid_redirect; }
```

---

## ۴. روش ساخت نگاشت

منبع حقیقت: **اسلاگ داخل آدرس ایندکس‌شده**، نه شناسه‌ی عددی.

دلیلش مهم است: **۷۷ شناسه‌ی قدیمی در بیش از یک آدرس ایندکس‌شده ظاهر شده‌اند** — یعنی
شناسه‌های محصول در طول زمان بازاستفاده شده‌اند. اگر کورکورانه به شناسه اعتماد می‌کردیم،
بازدیدکننده به محصول اشتباه می‌رفت. مثال واقعی:

```
/product/3077/لیبل-پرینتر-Gainscha-2408-dc
   دیتابیس برای شناسه‌ی ۳۰۷۷ می‌گوید: پرینتر چهارکاره لیزری HP MFP 4103fdw
```

زنجیره‌ی نگاشت:

| رده | معنی | تعداد |
|-----|------|-------|
| `certain` | اسلاگ آدرس **و** عنوان دیتابیس هر دو به یک محصول رسیدند | 2,341 |
| `strong` | فقط یکی از دو سیگنال، ولی با امتیاز بالا | 8 |
| `review` | دو سیگنال به محصولات متفاوت رسیدند یا تطبیق ضعیف بود | 44 |
| `none` | نامزد قابل قبولی پیدا نشد | 62 |

فقط `certain` و `strong` اعمال شدند.

---

## ۵. تست پس از اعمال

```
homepage              200
/products             200
/categories/printer   200
/brands/hp            200

www.mahamprint.com                       301 → https://mahamprint.com/
/product/58/پرینتر-لیزری-تک-کاره-HP-P1102  301 → /products/----hp-p1102   (۱ هاپ، مقصد ۲۰۰)
/product/1644/…MFP-M236dw                301 → /products/---hp--mfp-m236dw
/brand/35/plustek                        301 → /brands/plustek
/index.php?productID=2960                301 → /products/------zenpert----4t520
```

---

## ۶. کارهای باقی‌مانده

| مورد | تعداد | ایمپرشن | وضعیت |
|------|-------|---------|-------|
| دسته‌های قدیمی بدون معادل | 61 | 58,839 | پیشنهاد در `CATEGORY-MAPPING-REVIEW.csv` — **نیاز به تأیید** |
| آدرس‌های `/tag/` | 261 | 1,368 | معادل ندارند؛ پیشنهاد: 410 Gone |
| محصولات رده‌ی `review` | 44 | 1,038 | در `data/redirect_map_final.csv` |
| محصولات رده‌ی `none` | 62 | 835 | نامزدی پیدا نشد |

هیچ‌کدام از این‌ها اعمال نشده‌اند چون قضاوت کسب‌وکاری لازم دارند.

### مواردی که هنوز دست نخورده‌اند (از گزارش اصلی)

- کش خاموش (`no-store` روی همه‌ی صفحات)
- صفحه‌ی اصلی کلاینت‌ساید، بدون H1
- ۸۳٪ محصولات بدون قیمت → `price: 0` در اسکیما
- اسلاگ‌های خراب (۹۷٪ محصولات، ۳۸ دسته، ۲۵ برند)
- بهینه‌سازی تصاویر غیرفعال

---

## ۷. حذف ریدایرکت‌ها در آینده

وقتی Search Console نشان داد آدرس‌های قدیمی از ایندکس خارج شده‌اند (حدود دو ماه):

```bash
rm /etc/nginx/conf.d/mahamprint-redirects.conf
rm /etc/nginx/mahamprint-redirects.map /etc/nginx/mahamprint-pid.map
# و دو خط if(...) را از sites-available/mahamprinter.com بردار
nginx -t && systemctl reload nginx
```

بلوک `www` را نگه دارید — آن دائمی است.
