# بسته و لایسنس گردانوس

> وضعیت: **فاز ۱ انجام شد — نسخه‌ی ۲.۱۰۰.۰ (۱۴۰۵/۰۸/۰۲)**
> صادرکننده‌ی لایسنس: مخزن جدای `~/Projects/gardanos-panel` (پنل کسب‌وکار و ادمین گردانوس،
> `panel.gardanos.ir`) — مستندات خودش در `gardanos-panel/docs/`.
> نقشه‌ی راه فروش: `~/Projects/gardanos/docs/sales-roadmap.md`. الگو: لایسنس برتر
> (`bartar-crm/docs/49-licensing.md`).

## قاعده‌ی طلایی

```
نبودِ لایسنس  ⟺  همه‌ی امکانات روشن، کاربر نامحدود  ⟺  رفتار پیش از ۲.۱۰۰.۰
```

همه‌ی سایت‌های فعلی (mahamprint، bartarjanebi، mymonta، uniqquestar، sezavar، 9dm) لایسنس
ندارند و هیچ تفاوتی حس نمی‌کنند. فقط نصب‌های تازه‌ی گردانوس لایسنس می‌گیرند.

## نقشه‌ی فایل‌ها

| فایل | نقش |
|---|---|
| `lib/plan/features.ts` | کلید امکان‌های فروختنی + **مسیرهای پنل هر امکان** (`featureForPath`). بدون Prisma؛ سایدبار هم می‌خواند |
| `lib/plan/license.ts` | تأیید امضا، وضعیت (`getLicenseState` با کش ۶۰ ثانیه)، `panelHas`، `shopHas`، `seatError` |
| `proxy.ts` | قفل مسیر: بعد از دروازه‌ی مجوز، امکانِ بیرون از بسته ← API `403 {planLocked}`، صفحه ← `/admin/plan?locked=<key>` |
| `app/admin/plan`، `app/api/admin/plan` | «بسته‌ی من»: وضعیت، امکانات، ثبت لایسنس تازه (`PANEL_SETTINGS`) |
| `app/api/admin/me` | فیلد `plan` برای سایدبار، جستجوی سریع، کاشی‌های `AppGrid` و نوار هشدار انقضا |
| `scripts/plan/features-json.ts` | خروجی فهرست امکانات برای `gardanos-panel/data/features.json` |
| `scripts/plan/sign-license.ts` | امضای لایسنس آزمایشی (فقط توسعه) |

ستون تازه: `StoreSettings.licenseToken` (مهاجرت `20261024120000_license`، افزایشی).

## شکل لایسنس

`GL1.<payload base64url>.<امضای ed25519 base64url>` — امضا روی رشته‌ی `GL1.<payload>`.

```json
{ "sub": "<شناسه‌ی اشتراک در پنل>", "domain": "shop.ir", "business": "…", "plan": "growth",
  "planName": "رشد", "features": ["club", "marketing", "ai"], "seats": 5,
  "issuedAt": "ISO", "expiresAt": "ISO | null", "graceDays": 14 }
```

- `features: "*"` یعنی همه، حتی امکانات آینده (بسته‌ی سازمانی). `seats: 0` یعنی نامحدود.
- کلید عمومی داخل `lib/plan/license.ts` است؛ کلید خصوصی فقط روی سرور پنل گردانوس.
  **گم شدن کلید خصوصی** یعنی تا عوض شدن کلید عمومی در کد و دیپلوی همه‌ی سایت‌ها، لایسنس تازه‌ای
  پذیرفته نمی‌شود — نسخه‌ی پشتیبانش جدا نگه داشته شود.
- منبع: `StoreSettings.licenseToken` (مدیر از «بسته‌ی من» می‌چسباند) یا `GARDANOS_LICENSE` در `.env`
  (نصاب). اگر هر دو معتبر باشند، `issuedAt` تازه‌تر برنده است.
- دامنه‌ی لایسنس با `SITE_URL` مقایسه می‌شود (بدون www). لایسنس قدیمی‌تر جای تازه‌تر را نمی‌گیرد.
- **راهی برای پاک کردن لایسنس نیست** — چون نبودنش یعنی همه‌چیز روشن.

## وضعیت‌ها

| وضعیت | کی | پنل | فروشگاه (باشگاه، چت، تنوع) |
|---|---|---|---|
| `none` | لایسنسی نیست | همه | همه |
| `active` | قبل از `expiresAt` | امکانات لایسنس | امکانات لایسنس |
| `grace` | تا `graceDays` روز بعد از انقضا | امکانات لایسنس + نوار هشدار | امکانات لایسنس |
| `expired` | بعد از مهلت | **فقط هسته** | امکانات لایسنس (فروشگاه هرگز به‌خاطر انقضا کم نمی‌شود) |
| `invalid` | امضای غلط، دامنه‌ی دیگر | فقط هسته | فقط هسته |

`invalid` عمداً «همه‌چیز روشن» نیست؛ وگرنه دست‌کاری لایسنس راه باز کردن همه‌چیز بود.
هیچ داده‌ای با قفل پاک نمی‌شود؛ ارتقا یا تمدید همه را برمی‌گرداند.

## امکانات و مسیرها

هسته (همه‌ی بسته‌ها): فروشگاه، محصول، سفارش، ارسال، محتوا، سئو، پیامک، **کد تخفیف**،
سفارش تلفنی، نقش‌ها و دسترسی‌ها، کاربران، تنظیمات.

| کلید | مسیرها / اعمال |
|---|---|
| `club` | `/admin/club` (جز `coupons`)، ربات بله؛ فروشگاه: عضویت و پروفایل باشگاه (`shopHas`) |
| `marketing` | `/admin/tools` (لینک، کیوآر، لندینگ، پاپ‌آپ، سبد رهاشده، …)، `/admin/worklist/analytics` |
| `ai` | متن و تصویر محصول، `/admin/ai-settings`؛ فروشگاه: `/api/chat` |
| `integration` | `/admin/integration`، `/api/integration` (کارگر و وب‌هوک آزادند) |
| `hesaban` | `/api/integration/hesaban` |
| `accounting` | `/admin/accounting` |
| `variants` | `variantsEnabled()` در `lib/variants.ts` |
| `worklist` | `/admin/worklist` (جز نقش‌ها، سفارش تلفنی، ضربان، صندوق پیام، فهرست کارکنان) |
| `business-tools` | ۱۲ ماشین‌حساب زیر `/admin/tools/*` |
| `team` | حضور، تسویه، امتیاز، گزارش تیم، پورسانت؛ `attendanceGate` و `getScoreSettings` |
| `seo-tasks` | `/admin/worklist/{seo,content,links}` |
| `activity-reports` | `/admin/reports`، `/api/admin/reports/{activity,timeline}` |

بسته‌ها (آغاز/رشد/حرفه‌ای/سازمانی) و اینکه کدام کلید را دارند در **پنل گردانوس** تعریف و از
ادمین آن ویرایش می‌شوند، نه اینجا.

**امکان تازه:** کلید در `FEATURES` + مسیرهایش در `PATHS` (هر دو در `features.ts`) + اگر سمت
فروشگاه است `shopHas` در همان نقطه + `npx tsx scripts/plan/features-json.ts >
../gardanos-panel/data/features.json` و تیک آن در بسته‌های پنل.

## سقف کاربر

`seatError()` در `app/api/admin/admins` (ساخت ادمین) و `app/api/admin/users/[id]` (ادمین یا فعال
کردن دوباره). فقط ادمینِ فعالِ تازه صندلی می‌گیرد؛ عوض کردن رمز ادمین موجود نه.
`scripts/setup-new-site.ts` (ادمین اول نصب) سقف را دور می‌زند و درست است.

## آزمون

```bash
# لایسنس آزمایشی (کلید خصوصی کنار پنل: gardanos-panel/license-private.pem)
GARDANOS_LICENSE_KEY_FILE=../gardanos-panel/license-private.pem npx tsx scripts/plan/sign-license.ts \
  --domain 9dm.ir --plan start --plan-name آغاز --features '' --seats 2 --days 30
```

روی 9dm آزموده شد (۱۴۰۵/۰۸/۰۲): بدون لایسنس همه‌چیز مثل قبل؛ با لایسنس «آغاز» حسابداری و
کارتابل به «بسته‌ی من» می‌روند، API آن‌ها ۴۰۳ با `planLocked`، کد تخفیف و سفارش باز. بعد از آزمون
`licenseToken` روی 9dm دوباره `NULL` شد (پاک کردن فقط با SQL ممکن است).

## مانده

- تمدید خودکار: سایت روزی یک بار لایسنس تازه را از پنل بگیرد (نقشه‌ی راه ۴.۳) — فعلاً دستی.
- ویجت چت فروشگاه وقتی `ai` نیست هنوز دکمه را نشان می‌دهد و فقط پیام «فعال نیست» می‌گیرد.
- سقف کاربر در نصب‌های فعلیِ با ادمین بیش از سقف اجرا نمی‌شود (فقط جلوی تازه را می‌گیرد) — درست است.
