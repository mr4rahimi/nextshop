# ابزارها — کیوآر کد، لینک کوتاه، لندینگ‌ساز، درخواست ثبت نظر (از ۲.۶۸.۰)، کاراکترشمار و ویرایشگر متن (۲.۶۹.۰–۲.۷۰.۰)، سبد رهاشده (۲.۷۲.۰)، «موجود شد خبرم کن» (۲.۷۳.۰)، ماشین‌حساب قیمت (۲.۷۴.۰)، پاپ‌آپ (۲.۷۵.۰)

> ابزارهای دور دوم (سبد رهاشده، «موجود شد خبرم کن»، ماشین‌حساب قیمت، پاپ‌آپ) با ترتیب و وضعیت در
> `docs/plans/store-tools-2.md` طراحی شده‌اند؛ هر کدام بعد از ساخت اینجا یک بخش می‌گیرد.

منوی مستقل **ابزارها** در سایدبار (`/admin/tools`). الگو از برتر CRM
(`bartar-crm/docs/76-tools.md`) گرفته و با فروشگاه تطبیق داده شد — تفاوت‌ها در
بخش آخر.

## چرا
تیم برای QR و لینک کوتاه سراغ سایت‌های رایگان بیرونی می‌رفت: مقصد QR چاپ‌شده قابل
تغییر نبود، آماری نبود، و زنجیره تا سفارش پاره بود. حالا همه روی دامنه‌ی خود
فروشگاه است:

```
QR پویا ← لینک کوتاه /s/… (+UTM) ← لندینگ /l/… یا صفحه‌ی محصول ← کوکی منبع ورود ← سفارش
```

## فایل‌ها

| فایل | نقش |
|---|---|
| `lib/tools/common.ts` | توکن بی‌ابهام، `normalizeTarget` (قاعده‌ی آدرس مجاز)، UTM، ساعت تهران — **بدون Prisma**، مرورگر هم می‌خواند |
| `lib/tools/visitor.ts` | تشخیص ربات پیش‌نمایش، دستگاه، سیستم‌عامل |
| `lib/tools/short-links.ts` | لینک کوتاه: ساخت، ویرایش، ریدایرکت، آمار |
| `lib/tools/qr-content.ts` | نوع‌های QR، متن داخل QR، ظاهر — **بدون Prisma** |
| `lib/tools/qr-codes.ts` | QRهای ذخیره‌شده؛ QR پویا = لینک کوتاه `kind=QR` |
| `lib/tools/landing-blocks.ts` | نوع بلوک‌ها، پاک‌سازی، اعتبارسنجی انتشار، «الان باز است» — **بدون Prisma** |
| `lib/tools/landings.ts` | لندینگ: پیش‌نویس/انتشار، صفحه‌ی عمومی، فرم تماس |
| `lib/tools/reviews.ts` | درخواست نظر: تنظیمات، صف، ارسال، صفحه‌ی لینک، گزارش |
| `lib/tools/scheduler.ts` | هر ۵ دقیقه `runReviewRequests` (ثبت در `instrumentation.ts`) |
| `lib/tools/route-helpers.ts` | `toolsGuard("view"\|"manage")`، `toolsError` |
| `components/tools/LandingPageView.tsx` | نمای لندینگ — صفحه‌ی عمومی **و** پیش‌نمایش ویرایشگر |
| `components/tools/qr-render.ts` | رسم QR در مرورگر (SVG/PNG، لوگو، متن زیر) |
| `lib/tools/text-stats.ts` | کاراکترشمار: شمارش، پیامک، کلمات پرتکرار، یکدست‌سازی — **خالص**، هم‌نسخه‌ی `bartar-crm/features/text-counter/utils/text-stats.ts` |
| `components/admin/tools/*` | قاب، خانه، QR، لینک‌ها، لندینگ‌ها، ویرایشگر، درخواست نظر، متن راهنما |
| `components/admin/apps.ts` → `TOOLS_APPS` | **رجیستری ابزارها**؛ کاشی‌های خانه و زیرمنوی سایدبار از همین |

ابزار تازه = یک ردیف در `TOOLS_APPS` + صفحه زیر `app/admin/tools/` + API زیر
`app/api/admin/tools/` (پیشوندها از قبل در `lib/admin-sections.ts` ثبت‌اند) + کلید
راهنما در `components/admin/tools/help.ts`.

## دسترسی

| مجوز | یعنی |
|---|---|
| `TOOLS_VIEW` | دیدن ابزارها و آمار، ساخت و دانلود QR **ثابت** بدون ذخیره، کپی لینک |
| `TOOLS_MANAGE` | ساختن/ویرایش لینک، QR (پویا هم)، لندینگ و تنظیمات درخواست نظر |

بخش `tools` در `lib/admin-sections.ts` (یکی از دو مجوز کافی است؛ هر route مجوز دقیق
را خودش با `toolsGuard` می‌سنجد). `TOOLS_MANAGE` به بخش «رسانه و آپلود» هم اضافه
شد چون عکس لندینگ از همان `/api/admin/upload` می‌گذرد. ادمینِ بی‌نقش مثل همیشه همه را دارد.

## مسیرها

| مسیر | چیست | احراز |
|---|---|---|
| `/admin/tools` · `/qr` · `/links` · `/landings` · `/landings/[id]` · `/reviews` · `/text-counter` | پنل | سشن + بخش ابزارها |
| `/api/admin/tools/{links,qr,landings,products,reviews,summary,text-check}` | API پنل | سشن + `toolsGuard` |
| `/s/[code]` | ریدایرکت لینک کوتاه (route handler) | عمومی، **بیرون از matcher پروکسی** |
| `/n/[token]` | لینک پیامک «موجود شد» (بخش ۷) | عمومی، **بیرون از matcher** |
| `/c/[token]` | بازگشت به سبد (بخش ۶) | عمومی، داخل matcher |
| `/l/[slug]` | لندینگ عمومی | عمومی، داخل matcher (کوکی منبع ورود ثبت می‌شود) |
| `/api/store/landing/[slug]/callback` | فرم درخواست تماس لندینگ | عمومی |
| `/r/[token]`، `/r/shop`، `/r/[token]/go/[platform]` | صفحه‌ی ثبت نظر و شمارش کلیک | عمومی، **بیرون از matcher** |

`s/` و `r/` در matcher `proxy.ts` و `SKIP_PREFIXES` در `lib/redirects.ts` مستثنا
شدند: QR چاپ‌شده نباید به ریدایرکت‌های مدیریت‌شده یا کوکی منبع ورود گره بخورد.

## ۱. لینک کوتاه

- کد تصادفی ۵ حرفی از الفبای بی‌ابهام (`0/o/1/l/i` نیست) یا نامک دلخواه
  (`[a-z0-9-]`، حداکثر ۴۰). **کد پس از ساخت عوض نمی‌شود و پس از حذف هم آزاد نمی‌شود**
  (یکتایی روی کل جدول). کد ورودی آدرس کوچک می‌شود.
- مقصد مجاز: `https://`، `http://`، `tel:`، `mailto:` و مسیر سایت (`/products/…` →
  `SITE_URL` + مسیر). `javascript:` و `data:` و `//host` رد می‌شوند (`normalizeTarget`).
- UTM هنگام ریدایرکت به مقصد http(s) اضافه می‌شود مگر مقصد خودش داشته باشد.
- ⚠ **302 + `no-store`، نه 301** — مرورگر 301 را کش می‌کند و تغییر مقصد نمی‌رسد؛ CDN
  (WCDN روی 9dm) هم پاسخ بی‌هدر را کش می‌کند.
- ⚠ **ربات‌ها کلیک نیستند**: تلگرام، واتساپ، ایتا، بله و … برای پیش‌نمایش لینک را خودشان
  باز می‌کنند. `HEAD`، هدر `Purpose/Sec-Purpose: prefetch` و UAهای فهرست `visitor.ts`
  ریدایرکت می‌شوند ولی در `botCount` شمرده می‌شوند.
- هر کلیک انسانی یک `ShortLinkClick` (دستگاه، سیستم‌عامل، دامنه‌ی ارجاع). **IP ذخیره
  نمی‌شود.** شمارش بی‌سروصداست (await نمی‌شود).
- **سفارش‌ها:** اگر لینک UTM داشته باشد، آمار لینک سفارش‌های `BUYER_ORDER_STATUSES` با
  همان `utmSource`/`utmCampaign` از زمان ساخت لینک را می‌شمارد. منبع از کوکی `nx_src`
  (docs/plans/seo-marketing.md بخش ۱۳.۵) می‌آید، پس فقط وقتی مقصد خود فروشگاه است.
- فهرست فقط `kind=MANUAL`؛ لینک QRهای پویا از بخش QR مدیریت می‌شود.

## ۲. کیوآر کد

| حالت | داخل QR | مقصد قابل تغییر | آمار |
|---|---|---|---|
| ثابت | خود محتوا | ✗ | ✗ |
| پویا (پیش‌فرض برای لینک) | لینک کوتاه `/s/…` | ✓ | ✓ |

نوع‌ها: لینک، واتساپ (`wa.me`)، موقعیت (لینک گوگل‌مپ — `geo:` را دوربین آیفون نمی‌فهمد)
که پویا می‌شوند؛ تماس، پیامک (`SMSTO:`)، وای‌فای (`WIFI:` با escape)، کارت ویزیت
(vCard 3.0)، متن فقط ثابت.

- رسم در **مرورگر**: `qrcode` فقط ماتریس را می‌دهد، رسم SVG و PNG با `qr-render.ts`.
  حاشیه‌ی ۴ ماژول ثابت. با لوگو سطح خطا `H` و ناحیه‌ی وسط (~۲۲٪ عرض) خالی می‌ماند.
- لوگو در مرورگر مربع ۲۵۶ و data URL (سقف ۲۰۰ هزار نویسه) در `QrCode.style`.
- متن زیر QR در PNG جدا روی بوم با فونت صفحه نوشته می‌شود (SVG بارشده به‌صورت تصویر
  به فونت صفحه دسترسی ندارد). در SVG با `font-family` Vazirmatn/Tahoma.
- هشدار کنتراست (WCAG < ۴) و «نقطه‌ی روشن روی زمینه‌ی تیره».
- نوع و ثابت/پویا بعد از ساخت قفل؛ ویرایش QR پویا = تغییر مقصد لینکش؛ حذفش لینک را
  خاموش می‌کند. پویا تا ذخیره نشود دانلود ندارد.
- QR ثابت بدون ذخیره هم ساخته و دانلود می‌شود. `?url=` در `/admin/tools/qr` فرم را پر
  می‌کند (دکمه‌ی QR کنار لینک‌ها، لندینگ‌ها و لینک عمومی نظر).

## ۳. لندینگ‌ساز

صفحه‌ی بلوکی تک‌ستونه `/l/<slug>` — **با `LandingPage` (صفحات فرود سئوی دسته‌ها) فرق
دارد**؛ مدلش `ToolLanding` است.

بلوک‌ها: سربرگ، دکمه‌ها، **محصولات** (انتخاب دستی، قیمت/موجودی زنده)، شبکه‌های اجتماعی
(اینستاگرام، تلگرام، واتساپ، ایتا، روبیکا، بله)، **درخواست تماس**، متن، عکس/گالری،
آدرس (دکمه‌ی نشان/بلد/گوگل از مختصات — نقشه‌ی جاسازی‌شده نه)، ساعت کاری (۰=شنبه، «الان
باز است» با ساعت تهران، بستن بعد از نیمه‌شب مال روز قبل)، سؤالات متداول، ثبت نظر.

- ⚠ **CDN و ۴xx:** روی 9dm (ParsPack) بدنه‌ی **هر** پاسخ ۴xx با صفحه‌ی HTML خود CDN عوض
  می‌شود (APIهای قدیمی هم). پس ایرادهای انتشار و خطای فرم تماس عمومی با **۲۰۰ و
  `ok: false`** برمی‌گردند تا متن خطا به کاربر برسد. بقیه‌ی APIها روی چنین CDNی فقط پیام
  عمومی «انجام نشد» نشان می‌دهند — تنظیم «صفحه‌ی خطای سفارشی» CDN را خاموش کنید.
- بلوک‌ها یک ستون JSON‌اند. **پیش‌نویس** شکل آزاد (`sanitizeBlocks`)، ویرایشگر ۱٫۲ ثانیه
  بعد از آخرین تغییر خودکار ذخیره می‌کند. **انتشار** سخت‌گیر (`validateForPublish`، خطا با
  شماره‌ی بلوک، ۲۰۰ + `ok:false`). **رندر عمومی** بلوک خراب را کنار می‌گذارد.
- `draftBlocks/theme` جدا از `publishedBlocks/publishedTheme`. عنوان، نامک و سئو مستقیم.
- ⚠ «تغییر منتشرنشده» با `stableStringify` — `jsonb` ترتیب کلیدها را عوض می‌کند.
- نامک تا اولین انتشار (`publishedAt`) قابل تغییر و بعد قفل؛ پس از حذف آزاد نمی‌شود؛
  `admin/api/new/img/shop/static` رزرو.
- پیش‌فرض بلوک‌ها از `StoreSettings` (نام، لوگو، تلفن، شبکه‌ها). دکمه‌ی «تماس» با `tel:`
  خالی عمداً منتشر نمی‌شود تا شماره نوشته شود.
- عکس‌ها از همان `/api/admin/upload` (کتابخانه‌ی رسانه)؛ انتشار فقط `/uploads/…` یا
  `https://` می‌پذیرد.
- **درخواست تماس** → `CallbackRequest` (همان «درخواست‌های تماس» پنل) با `siteId` = host
  و یادداشت «از لندینگ «…» — نام: …». فقط لندینگ منتشرشده‌ای که بلوک فرم دارد؛ سقف ۳ در
  ساعت به‌ازای IP (در حافظه)؛ فیلد تله `website`.
- صفحه‌ی عمومی: `force-dynamic`، رنگ‌های هگز ثابت (نه تم شب سایت)، بدون هدر/فوتر
  فروشگاه، `noindex` پیش‌فرض روشن (قابل خاموش‌کردن)، متا و OG از تنظیمات. `viewCount`
  بی‌سروصدا با فیلتر ربات. چت هوشمند سایت (`AiChat` در layout ریشه) روی لندینگ هم هست.
- href دکمه‌ها در نما دوباره سنجیده می‌شود: هر چیزی جز http(s)/tel/mailto/مسیر سایت → `#`.

## ۴. درخواست ثبت نظر

بعد از تحویل سفارش پیامکی با لینک `/r/<token>` (توکن ۶ حرفی). صفحه دکمه‌ی نشان/بلد/
گوگل‌مپ را به ترتیب تنظیم‌شده نشان می‌دهد و اگر `askProducts` روشن باشد **محصولات همان
سفارش** با دکمه‌ی «ثبت نظر» → `/r/<token>/go/site?p=<slug>` → `/products/<slug>#reviews`
(صفحه‌ی محصول با `#reviews` زبانه‌ی نظرات را باز می‌کند). هر کلیک یک `ReviewPlatformClick`.
یک سکو و بدون محصول → ریدایرکت مستقیم. `/r/shop` لینک عمومی (فقط سکوها، `requestId` خالی؛
تا سکویی تنظیم نشده ۴۰۴).

**ساخت درخواست:** در `PUT /api/admin/orders/[id]` هنگام تغییر وضعیت
`enqueueReviewRequest(id, status)`: اگر روشن است و وضعیت «تحویل» است (`DELIVERED`، یا
`COMPLETED` برای سفارشی که مستقیم تکمیل شد؛ اگر تنظیم «تکمیل شد» باشد فقط `COMPLETED`)،
ردیف `PENDING` با `dueAt = now + delayHours`. **تنها مسیری که سفارش را تحویل‌شده می‌کند
همین route است** (مهر ۱۴۰۵). چون ردیف فقط در لحظه‌ی گذار ساخته می‌شود، روشن‌کردن به
سفارش‌های قدیمی پیامک نمی‌زند. **`ReviewRequest.orderId` یکتاست** — هر سفارش حداکثر یک
پیامک، حتی با رفت‌وبرگشت وضعیت.

**ارسال** (`runReviewRequests`، هر ۵ دقیقه، حداکثر ۲۰ در هر دور): فقط وقتی روشن است، کد
پترن دارد، `getSmsReadiness()` آماده است و ساعت تهران در `[sendFrom, sendTo)`. هر ردیف:
دیرتر از ۳ روز → SKIPPED؛ موبایل نامعتبر، `SmsOptOut`، یا پیامک نظرِ ارسال‌شده به همان
شماره در `cooldownDays` → SKIPPED؛ بعد قفل اتمی `updateMany(status: PENDING → SENT)` و
`sendPatternSms`. خطا → `FAILED` با دلیل، **بدون تلاش دوباره**.

- ⚠ `sendPatternSms` در نبود تنظیمات بی‌صدا برمی‌گردد؛ برای همین `getSmsReadiness()` به
  `lib/sms.ts` اضافه شد و پیش از علامت‌زدن SENT پرسیده می‌شود.
- متغیرهای پترن: `name` و (در حالت `VARIABLE`) `link` — لینک بدون `https://`.
  حالت `FIXED`: لینک عمومی `<دامنه>/r/shop` داخل خود متن پترن، فقط `name` متغیر است؛
  برای وقتی سامانه «لینک در متغیر» را تأیید نکند (در برتر CRM یک‌بار رد شد).
- ⚠ **فیلتر رضایت ممنوع** (review gating، سیاست گوگل): به همه‌ی واجدان شرایط می‌رود و
  متن پیشنهادی و صفحه خنثی‌اند.
- «پیامک آزمایشی» در صفحه‌ی تنظیمات با پترن ذخیره‌شده و لینک عمومی، بدون ثبت درخواست.
- بلوک «ثبت نظر» لندینگ دکمه‌هایش را از همین تنظیمات می‌گیرد (`reviewPlatformLinks(null)`).

## ۵. کاراکترشمار و ویرایشگر متن (۲.۶۹.۰، کامل‌شده در ۲.۷۰.۰)

`/admin/tools/text-counter`. API و جدول تازه ندارد جز `POST /api/admin/tools/text-check`
(تکراری بودن). مجوز همان `TOOLS_VIEW`/`TOOLS_MANAGE`. پیش‌نویس، قالب و کلمه‌ی کلیدی در
`localStorage` (`tools.textCounter.draft` و `.prefs`).

### فایل‌ها
| فایل | نقش |
|---|---|
| `lib/tools/text-stats.ts` | شمارش، جمله/پاراگراف **با جایگاه** (`Span`)، `tokenize` (توکن یکسان‌شده با جایگاه؛ نیم‌فاصله جداکننده است)، کلمه‌ی کلیدی، پرتکرارها و n-gram، ترکیب نویسه‌ها، پیامک، طول وزنی ایکس، سادگی خواندن |
| `lib/tools/text-fix.ts` | اصلاح‌ها با شمارش: `FIXES` (ی/ک عربی، اصلاح نیم‌فاصله، علامت‌گذاری، فاصله‌ها، کشیده — جزء «استانداردسازی»؛ نیم‌فاصله←فاصله، ارقام فارسی/انگلیسی، حذف ایموجی — جدا) |
| `lib/tools/text-profiles.ts` | قالب‌ها (`PROFILES`) و `evaluateProfile` → نوار طول + فهرست بررسی + امتیاز |
| `lib/tools/text-similarity.ts` | شینگل ۵ کلمه‌ای، `createDuplicateScanner`، `stripHtml`، `jsonText` — خالص |
| `lib/tools/text-duplicates.ts` | منبع‌های سایت برای تکراری بودن (سرور، Prisma) |
| `components/admin/tools/TextCounterClient.tsx` | صفحه: قالب، کلمه‌ی کلیدی، ویرایشگر/علامت‌ها، نوار وضعیت، زبانه‌ها |
| `components/admin/tools/text/{charts,panels,MarkedText,handoff}` | نمودارهای SVG بی‌کتابخانه، زبانه‌ها، نمای علامت‌دار، تحویل متن از فرم‌های دیگر |
| `components/admin/tools/TextMeter.tsx` | شمارنده‌ی کوچک زیر فیلدها + «بررسی کامل» |

چهار فایل `lib/tools/text-{stats,fix,profiles,similarity}.ts` **هم‌نسخه‌ی CRM برتر**اند
(`bartar-crm/features/text-counter/utils/`)؛ تغییر در یکی، در دیگری هم لازم است.

### شمارش
| خروجی | قاعده |
|---|---|
| کلمه | توکن جداشده با فاصله/خط با دست‌کم یک حرف یا رقم؛ «می‌خواهم» یک کلمه؛ «،» تنها کلمه نیست |
| جمله | `. ! ? ؟ …` فقط اگر بعدش فاصله/پایان باشد + آخر هر پاراگراف |
| پاراگراف | هر خط غیرخالی |
| زمان‌ها | خواندن ۲۰۰، بلند ۱۳۰، تایپ ۳۵ کلمه در دقیقه |
| پیامک | یک نویسه‌ی غیر GSM-7 → ۷۰/۶۷؛ لاتین ۱۶۰/۱۵۳ |
| ایکس | twitter-text: بازه‌های ۰–۴۳۵۱ و چند بازه‌ی نقطه‌گذاری وزن ۱ (فارسی هم)، بقیه ۲، لینک ۲۳ |
| سادگی خواندن | فلش/دیانی هجا می‌خواهند که فارسی بی‌اعراب ندارد؛ نمره = ۱۰۰ − ۳×(میانگین جمله−۱۲) − ۰٫۴×٪جمله‌ی بلند − ۰٫۲۵×(میانگین پاراگراف−۹۰)، زیر ۳۰ کلمه «—» |
| جمله‌ی بلند | بیش از ۲۰ کلمه (`LONG_SENTENCE`) |

### قالب‌ها و بررسی‌ها (`text-profiles.ts`)
مقاله (≥۶۰۰ کلمه، کلیدی ۰٫۵–۲٫۵٪ و در پاراگراف اول، زیرعنوان هر ~۳۰۰ کلمه، پاراگراف ≤۱۵۰، شروع
تکراری جمله‌ها) · توضیح محصول (≥۱۵۰، کلیدی ≤۳٪، پاراگراف ≤۱۰۰) · عنوان سئو (۳۰–۶۰، سقف ۷۰، کلیدی نزدیک
ابتدا، یک خط) · متا (۱۲۰–۱۶۰، سقف ۱۷۰) · اینستاگرام (۲۲۰۰، خط اول ≤۱۲۵، **حداکثر ۵ هشتگ** از آذر ۱۴۰۴،
لینک کلیک‌خور نیست) · ایکس (۲۸۰ وزنی، ≤۲ هشتگ) · تلگرام (۴۰۹۶، کپشن ۱۰۲۴) · پیامک (تعداد بخش، ایموجی،
«لغو۱۱» برای تبلیغاتی). امتیاز = میانگین (سبز ۱، زرد ۰٫۵، قرمز ۰)، «info» بی‌اثر. زیرعنوان = خط ≤۱۲
کلمه بدون علامت پایانی که پاراگراف بلندتری بعدش است، یا خط با `#`.

### اصلاح نیم‌فاصله (`fixHalfSpace`)
نیم‌فاصله‌ی کنار فاصله ← فاصله؛ `(ن)می␣` + حرف ← نیم‌فاصله؛ پسوندهای جدا `ها/های/…/تر/ترین` و
بعد از «ه»: `ای/ام/ات/اش/ایم/اید/اند`؛ نیم‌فاصله‌ی اول/آخر کلمه حذف. «میخواهم» چسبیده دست نمی‌خورد (از
«میز» قابل تشخیص نیست). «نیم‌فاصله ← فاصله» به درخواست کاربر جدا هست. ارقام←فارسی کلمه‌ی لاتین، لینک،
ایمیل و عددِ بعد از کلمه‌ی لاتین (iPhone 15) را دست نمی‌زند. علامت‌گذاری لینک‌ها را موقتاً کنار می‌گذارد.

### تکراری بودن
اثر انگشت ۵ کلمه‌ای (هش cyrb53) روی توکن‌های یکسان‌شده (ی/ک، آ/ا، ارقام، نیم‌فاصله=فاصله). درصد =
کلمه‌هایی از متن که در دست‌کم یک شینگلِ پیداشده‌اند ÷ کل. منبع‌ها: محصول (short/summary/expert + FAQ)،
مقاله‌ی مجله (پیش‌نویس هم)، دسته، برند، برگه (`contentHtml` + `blocks`)، صفحه‌ی فرود `/collections`،
لندینگ ابزارها. دسته‌های ۳۰۰تایی با cursor، **بدون کش**؛ حافظه به اندازه‌ی متن ورودی. حداقل ۱۵ کلمه، حداکثر
۱۰۰ هزار کاراکتر. بازه‌ها اندیس توکن‌اند و مرورگر با همان `tokenize` به کاراکتر برمی‌گرداند (علامت قرمز).
**با اینترنت مقایسه نمی‌شود** و تشخیص متن هوش مصنوعی **عمداً نیامد** (تصمیم کاربر ۱۴۰۵/۰۷/۱۴): سرویس‌های
وب‌گرد و تشخیص AI پولی و دلاری‌اند، بیشترشان فارسی ندارند (Copyleaks AI ندارد؛ Pangram ادعا دارد) و دقتشان
روی فارسی ثابت نشده.

### شمارنده در فرم‌ها
`TextMeter` زیر: متن پیامک (`/admin/sms/send` و `advanced` — prop تازه‌ی `meter` در `TextArea` پیامک)،
عنوان و توضیحات سئوی محصول، دسته و برند (کلمه‌ی کلیدی = اولین مورد `seoKeywords`). «بررسی کامل» متن را با
`openTextCounter` از `localStorage` (`tools.textCounter.handoff`) به زبانه‌ی تازه می‌دهد.

### آزمون
منطق با tsx آزموده شد (نمونه‌های نیم‌فاصله، علامت‌گذاری با لینک، ارقام، پیامک، کلیدی، شینگل). رابط با
bundle مستقل esbuild در Chrome (دسکتاپ، تیره، موبایل ۳۹۰) دیده شد. **API تکراری بودن با سشن ادمین روی
دمو آزموده نشد** (ساخت ادمین موقت در این جلسه مجاز نشد).

## ۶. یادآوری سبد رهاشده (۲.۷۲.۰)

طرح کامل و دلیل تصمیم‌ها: `docs/plans/store-tools-2.md` بخش ۱.

| فایل | نقش |
|---|---|
| `lib/tools/cart-recovery.ts` | تنظیمات، `scanAbandonedCarts`، `runCartRecoveries`، کد تخفیف، `markCartRecovered`، `loadRecoveryPage`، گزارش، `listOpenCarts` |
| `lib/tools/scheduler.ts` | هر ۵ دقیقه: اسکن و بعد ارسال (بعد از درخواست نظر، با try جدا) |
| `app/api/admin/tools/cart-recovery/route.ts` | GET تنظیمات + آمار + سبدهای باز · PUT ذخیره · POST پیامک آزمایشی |
| `components/admin/tools/CartRecoveryClient.tsx` | صفحه‌ی پنل `/admin/tools/cart-recovery` |
| `app/(shop)/c/[token]/page.tsx` + `components/store/cart/CartRecoveryView.tsx` | صفحه‌ی بازگشت مشتری |
| `app/api/checkout/route.ts` | بعد از پاک کردن سبد: `markCartRecovered` |
| `components/store/cart/CheckoutClient.tsx` | پر کردن فیلد کد از `localStorage` (`nx_coupon`) و پاک کردنش بعد از سفارش |
| `components/store/cart/CartContext.tsx` | پرچم تازه‌ی `ready` — پیش از آن Provider نیست و `addItem` بی‌اثر است |

- **فقط سبد سروری** (کاربر واردشده). سبد مهمان در `localStorage` (`mymonta_cart`) است و شماره ندارد.
- **آخرین فعالیت = `max(CartItem.updatedAt)`** با `groupBy` + `having`؛ `Cart.updatedAt` با تغییر اقلام عوض نمی‌شود.
- **تشخیص:** فعالیت بین `max(now−3روز, enabledAt)` و `now − delayMinutes`، کاربر فعال، بدون ردیفی با
  `cartActivityAt >= فعالیت` (یک یادآوری برای هر دور سبد)، جمع با قیمت فعلی ≥ `minCartTotal`، بدون سفارش
  بعد از فعالیت. ردیف `PENDING` با `dueAt = now` و عکس اقلام.
- **ارسال:** گیت روشن/پترن/`getSmsReadiness`/بازه‌ی ساعت تهران؛ هر ردیف: بیش از ۲۴ ساعت در صف → SKIPPED؛
  شماره‌ی نامعتبر، سبد خالی‌شده، سفارش بعد از فعالیت، `SmsOptOut`، پیامک سبد در `cooldownDays` → SKIPPED؛ قفل
  اتمی `PENDING → SENT`؛ کد تخفیف (اگر روشن) و `sendPatternSms`. خطا → `FAILED` و **کد ساخته‌شده غیرفعال می‌شود**.
- **کد تخفیف:** `Coupon` با `CR` + ۶ نویسه، `userId` همان مشتری، `usageLimit=1`، `perUserLimit=1`، `expiresAt`،
  `note` «… سبد رهاشده» — در فهرست کدهای باشگاه هم دیده می‌شود. اعتبارسنجی همان `validateCoupon` است.
- **متغیرهای پترن:** `name`، `link` (حالت VARIABLE، بدون https)، `code` (فقط با تخفیف). حالت FIXED: `<دامنه>/cart`
  داخل متن. پیامک آزمایشی کد نمونه‌ی `CRTEST` می‌فرستد (کد واقعی ساخته نمی‌شود).
- **بازگشت:** `markCartRecovered` آخرین ردیف `SENT` همان کاربر در ۷ روز را `RECOVERED` می‌کند (`recoveredOrderId`،
  `recoveredTotal` = `grandTotal`). این «خرید بعد از پیامک» است، نه اثر قطعی پیامک — در پنل همین توضیح آمده.
- **صفحه‌ی `/c/<token>`:** زیر `(shop)` (هدر، فوتر، `CartProvider`)، `noindex`، اولین باز شدن `openedAt`. اقلام فعال با
  قیمت و موجودی فعلی؛ دکمه فقط اقلامی که در سبد نیستند را `addItem` می‌کند و به
  `/cart?utm_source=sms&utm_medium=sms&utm_campaign=cart-recovery` می‌رود. کد قابل‌استفاده (فعال، مصرف‌نشده،
  منقضی‌نشده) نشان داده و در `nx_coupon` گذاشته می‌شود؛ تسویه فقط فیلد را پر می‌کند، اعمال با مشتری.
  `/c/` از matcher پروکسی مستثنا **نیست** (صفحه‌ی عادی فروشگاه است و کوکی منبع ورود باید ثبت شود).
- **سبدهای باز همین حالا:** ۳۰ سبد تازه، حتی با ارسال خاموش؛ دکمه‌ی تماس و «پرونده» →
  `/admin/club/members?q=<موبایل>` (صفحه‌ی اعضا از این نسخه `?q=` را می‌خواند).

```
CartRecoverySetting  id "singleton", isEnabled, enabledAt?, patternCode?, linkMode, delayMinutes(120),
                     sendFrom(10), sendTo(21), minCartTotal BigInt, cooldownDays(7), couponEnabled,
                     couponType(PERCENT|FIXED), couponValue BigInt, couponMaxDiscount BigInt, couponValidHours(48)
CartRecovery         userId (بدون رابطه), phone, name?, token @unique, status(PENDING|SENT|FAILED|SKIPPED|RECOVERED),
                     reason?, items Json, cartTotal BigInt, cartActivityAt, dueAt, sentAt?, openedAt?,
                     couponId?, couponCode?, recoveredOrderId?, recoveredAt?, recoveredTotal BigInt?
```
مایگریشن `20261006150000_cart_recovery` افزایشی است.

## ۷. «موجود شد خبرم کن» (۲.۷۳.۰)

طرح: `docs/plans/store-tools-2.md` بخش ۲.

| فایل | نقش |
|---|---|
| `lib/tools/stock-alerts.ts` | تنظیمات، `stockAlertState`، `subscribeStockAlert`، `resolveAlertClick`، `runStockAlerts`، `cancelStockAlert`، گزارش |
| `components/store/product/StockAlertBox.tsx` | فرم جای دکمه‌ی خرید در `ProductDetailClient` (`isOutOfStock`)؛ خاموش → همان کادر «ناموجود» قبلی (`fallback`) |
| `app/api/store/stock-alert/route.ts` | GET وضعیت (`enabled`، شماره‌ی کاربر واردشده، `subscribed`) · POST ثبت — خطا با ۲۰۰ + `ok:false` |
| `app/n/[token]/route.ts` | لینک پیامک → `/products/<slug>?utm_source=sms&utm_campaign=back-in-stock`، 302 + `no-store`، اولین کلیک غیرربات |
| `app/api/admin/tools/stock-alerts/route.ts` · `components/admin/tools/StockAlertsClient.tsx` | پنل `/admin/tools/stock-alerts`؛ POST `{phone}` آزمایشی، `{cancelId}` لغو |

- «ناموجود» = `trackStock && stock <= 0` (همان صفحه‌ی محصول)؛ ثبت روی کالای موجود یا غیرفعال رد می‌شود. سقف ۱۰ ثبت در ساعت
  به‌ازای IP (در حافظه)، فیلد تله `website`. یکتایی `(productId, phone)`: ثبت دوباره‌ی ردیف غیرمنتظر آن را به WAITING
  برمی‌گرداند (`createdAt` تازه)؛ ردیف منتظر `already: true`.
- **ارسال با اسکن** (`runStockAlerts`، هر ۵ دقیقه، ۳۰ در هر دور): WAITING روی کالای فعالِ موجود (`!trackStock || stock > 0`)،
  قدیمی‌ترها اول. گیت روشن/پترن/`getSmsReadiness`/بازه‌ی ساعت. منتظرِ بیش از ۱۸۰ روز → CANCELLED؛ شماره‌ی نامعتبر و
  `SmsOptOut` → CANCELLED؛ قفل `WAITING → SENT`؛ خطا → FAILED بی‌تلاش دوباره. هیچ مسیر ویرایش موجودی قلاب ندارد.
- متغیرها: `product` (حداکثر ۴۰ نویسه) و در حالت `VARIABLE` `link` (`<دامنه>/n/<token>` بدون https). حالت `NONE` بی‌لینک.
- `/n/` مثل `/s/` و `/r/` از matcher `proxy.ts` و `SKIP_PREFIXES` بیرون است.
- **گزارش:** منتظرها، پرتقاضاترین‌ها (`groupBy productId`)، ارسال/کلیک ۳۰ روز، «همان کالا را خرید» = سفارش غیرلغو با همان
  کالا از کاربری با همان شماره تا ۷ روز بعد از پیامک (محاسبه‌ای، ستونی ذخیره نمی‌شود).

```
StockAlertSetting  id "singleton", isEnabled, patternCode?, linkMode(VARIABLE|NONE), sendFrom(10), sendTo(21)
StockAlert         productId → Product (Cascade), phone, userId?, token @unique, status(WAITING|SENT|FAILED|CANCELLED),
                   reason?, createdAt, notifiedAt?, clickedAt?   @@unique([productId, phone])
```
مایگریشن `20261006170000_stock_alerts` افزایشی است (فقط رابطه‌ی معکوس روی `Product`).

## ۸. ماشین‌حساب قیمت و سود (۲.۷۴.۰)

`/admin/tools/price-calc` — ابزار سریع بدون جدول و API تازه (فقط `/api/admin/tools/products` برای انتخاب محصول).

| فایل | نقش |
|---|---|
| `lib/tools/price-calc.ts` | منطق خالص: `calcChannel`، `roundPrice`، پیش‌فرض‌ها |
| `components/admin/tools/PriceCalcClient.tsx` | فرم، کانال‌ها، کارت نتیجه‌ی هر کانال، انتخاب محصول |

مدل یک واحد روی یک کانال: `سود = k·P − F − C` با `k = 1/(1+v) − (c+g)`؛ `P` قیمت با مالیات، `v` مالیات، `c` کارمزد
درصدی، `g` درگاه (هر دو روی قیمت کامل)، `F` کارمزد ثابت، `C` = خرید + هزینه‌ی جانبی + ارسالِ با فروشنده.
- حاشیه‌ی `m`: `P = (F+C)/(k−m)` (اگر `k ≤ m` → «ممکن نیست»)؛ مارک‌آپ `u`: `P = (C(1+u)+F)/k`؛ مبلغ `A`: `P = (A+F+C)/k`.
- سربه‌سر `(F+C)/k`؛ بیشترین تخفیف `1 − (minProfit+F+C)/(k·P)`.
- گرد کردن همیشه **به بالا** (هزار، ده‌هزار، صدهزار، ختم به ۹۰۰: کوچک‌ترین عدد ≥ P که به ۹۰۰ ختم شود).
- **کارمزد بازارها و نرخ مالیات در کد نیست** (پیش‌فرض فقط کانال «سایت خودم» با صفر، مالیات خاموش با ۱۰ قابل ویرایش)؛
  ورودی و کانال‌ها در `localStorage` (`tools.priceCalc`). فرم تا خواندن آن رسم نمی‌شود (ورودی درصد متن خودش را نگه می‌دارد).
- قیمت خرید از حسابداری خوانده **نمی‌شود**: این ابزار با `TOOLS_VIEW` باز است و بهای تمام‌شده داده‌ی مالی است.
- آزمون: assertهای tsx روی گرد کردن، حاشیه/مارک‌آپ، کارمزد + مالیات (جمع اجزا = قیمت)، سربه‌سر، تخفیف و هدف ناممکن.

## ۹. پاپ‌آپ (۲.۷۵.۰)

`/admin/tools/popups`. نوار اعلان جدا و در «تنظیمات سایت» است (`docs/features/announcement-bar.md`)؛ در همین نسخه
شروع/پایان و شمارش معکوس گرفت.

| فایل | نقش |
|---|---|
| `lib/tools/popup-rules.ts` | **خالص**: نوع‌ها، `sanitizeContent`، `safeHref`/`safeImage`، `matchesPage`، `isExcludedPath`، `dueAgain`، `inWindow`، `contentVersion` |
| `lib/tools/popups.ts` | CRUD، `publicPopups`، `recordPopupEvent`، `submitPopupLead`، `popupLeads` |
| `components/tools/PopupView.tsx` | نمای مشترک سایت و پیش‌نمایش پنل |
| `components/store/PopupHost.tsx` | در `app/(shop)/layout.tsx`؛ انتخاب و trigger |
| `app/api/store/popups/route.ts` | GET فهرست (`s-maxage=60`) · POST `{id,type: view\|click\|close}` → 204 |
| `app/api/store/popups/lead/route.ts` | ثبت شماره — ۲۰۰ + `ok:false` برای خطا |
| `app/api/admin/tools/popups/…` · `components/admin/tools/PopupsClient.tsx` | پنل؛ PUT خطای اعتبارسنجی را با ۲۰۰ + `ok:false` می‌دهد |

- **انتخاب در مرورگر:** فهرست یک‌بار گرفته می‌شود؛ با هر تغییر مسیر: `matchesPage` + دستگاه (`max-width: 767px`) + `inWindow` +
  دفعات (`localStorage` `nx_popup` = `{id: {v: نسخه, t}}`، `sessionStorage` `nx_popup_s`) → اولین با بیشترین `priority`.
  حداکثر یکی در هر صفحه. EXIT (`mouseout` با `clientY <= 0`) در موبایل حذف می‌شود.
- **هرگز:** `/cart`، `/checkout`، `/c`، `/user`، `/auth`، `/account`، `/seller` (و زیرمسیرها).
- **نسخه = هش** نوع + عنوان + متن + لینک + کد؛ ویرایش این‌ها پاپ‌آپ را دوباره به همه نشان می‌دهد (همان روش نوار اعلان).
- **AUTO:** موبایل کارت پایین (`bottom-24`، بالای نوار پایین)، دسکتاپ پنجره‌ی وسط با پس‌زمینه. پیش‌فرض تأخیر ۸ ثانیه
  (گوگل پاپ‌آپ تمام‌صفحه‌ی فوری موبایل را مزاحم می‌داند).
- **کد تخفیف** (`content.couponCode`) باید در `Coupon` باشد و **شخصی نباشد** (`userId` خالی)؛ روشن کردن با کد غیرفعال یا منقضی
  رد می‌شود. در فهرست عمومی فقط پرچم `"1"` است — خود کد فقط در پاسخ ثبت شماره برمی‌گردد.
- **ثبت شماره:** سقف ۵ در ساعت به‌ازای IP، فیلد تله. اگر `clubEnabled`: `upsertClubCustomer({source: ONLINE, sourcePlatform:
  "popup", smsConsent})`. رضایت فقط با تیک (و فقط اگر `consentText` پر باشد). `PopupLead` یکتا روی `(popupId, phone)`؛
  `leadCount` فقط برای شماره‌ی تازه.
- **آمار** شمارنده‌های روی خود ردیف‌اند (بدون جدول رویداد)؛ از مرورگر می‌آیند و احراز ندارند — تقریبی.
- **UTM به لینک دکمه اضافه نمی‌شود** (برخلاف طرح اولیه): بازدیدکننده از قبل منبع ورود (`nx_src`) دارد و UTM داخلی آن را با
  «پاپ‌آپ» بازنویسی می‌کرد. برای همین «سفارش از پاپ‌آپ» هم شمرده نمی‌شود.
- پاپ‌آپ تازه خاموش ساخته می‌شود؛ حذف نرم (`deletedAt`).

### نوار اعلان: زمان‌بندی (همین نسخه)
`startsAt`/`endsAt` («YYYY-MM-DDTHH:mm» تهران، خروجی `JalaliDatePicker` حالت datetime) و `countdown` در
`StoreSettings.announcementBar`. `tehranMs` با افست ثابت `+03:30`. سرور بعد از پایان رندر نمی‌کند؛ شروعِ آینده رندر
می‌شود و اسکریپت inline با ساعت مرورگر پنهانش می‌کند (همان کلاس `ann-off`). شمارش معکوس بعد از mount تیک می‌خورد و در
صفر نوار را پنهان می‌کند.

```
ToolPopup  name, kind(ANNOUNCE|LEAD), isActive, priority, content Json, trigger, triggerValue, pages, paths[], device,
           frequency, position, accent, startsAt?, endsAt?, viewCount, clickCount, closeCount, leadCount, deletedAt?
PopupLead  popupId → ToolPopup (Cascade), phone, userId?, consent   @@unique([popupId, phone])
```
مایگریشن `20261006190000_tool_popups` افزایشی است.

## مدل داده

```
ShortLink        code @unique, title, targetUrl, kind(MANUAL|QR), utm*, isActive, expiresAt?,
                 clickCount, botCount, lastClickedAt?, createdById?, deletedAt?
ShortLinkClick   linkId, at, device, os, referrerHost?        @@index([linkId, at])
QrCode           title, contentType, content Json, isDynamic, shortLinkId? @unique, style Json, deletedAt?
ToolLanding      slug @unique, title, status(DRAFT|PUBLISHED), theme, draftBlocks, publishedBlocks?,
                 publishedTheme?, publishedAt?, meta*, ogImage?, noindex, viewCount, lastViewedAt?, deletedAt?
ReviewRequestSetting  id "singleton", isEnabled, enabledAt?, neshanUrl?, baladUrl?, googleUrl?,
                 platformOrder Json, askProducts, patternCode?, linkMode, triggerStatus,
                 delayHours, sendFrom, sendTo, cooldownDays, pageTitle?, pageMessage?
ReviewRequest    orderId @unique, userId, phone, name?, token @unique, status, reason?, dueAt, sentAt?, openedAt?
ReviewPlatformClick  requestId?, platform(NESHAN|BALAD|GOOGLE|SITE), at
Order            + reviewRequest (رابطه‌ی معکوس، بدون ستون تازه)
```

مایگریشن `20261005120000_tools` فقط جدول و enum تازه می‌سازد (افزایشی).

## تفاوت با برتر CRM

| برتر CRM | فروشگاه | چرا |
|---|---|---|
| دامنه از `TrackingPageSetting.baseUrl` | `SITE_URL` هر دیپلوی | فروشگاه از قبل هر سایت را با env خودش می‌شناسد |
| لندینگ `/p/` | `/l/` | `/p/` در مهاجرت‌های وردپرسی مسیر قدیمی محصول است |
| عکس لندینگ در دیتابیس | کتابخانه‌ی رسانه (`/uploads`) | فروشگاه مسیر آپلود و پوشه‌ی مستثنا از rsync دارد |
| فرم سفارش آنلاین → `OnlineOrder` | بلوک «محصولات» + «درخواست تماس» → `CallbackRequest` | فروشگاه سبد خرید دارد؛ فرم تماس از قبل بود |
| کمپین و قیف تا قبض | UTM لینک + شمارش سفارش با همان UTM | منبع ورود سفارش از ۲.۶۴.۰ روی `Order` است |
| تحویل قبض تعمیر | گذار سفارش به `DELIVERED`/`COMPLETED` | |
| فقط نشان/بلد/گوگل | + نظر روی محصولات همان سفارش | نظر محصول سئو و اسکیمای Review دارد |
| قالب‌های چاپی، IMEI | نیامد | خواسته نشد |
| کاراکترشمار | کاراکترشمار | هر دو یک `text-stats.ts` دارند؛ تغییر در یکی، در دیگری هم لازم است |

## آزمون

- منطق خالص (آدرس، UTM، QR، ساعت کاری، اعتبارسنجی، ربات) با assert‌های tsx آزموده شد.
- **دمو 9dm، ۱۴۰۵/۰۷/۱۳ (۲.۶۸.۰)** — با ادمین موقت و داده‌ی آزمایشی که بعد پاک شد:
  - لینک کوتاه: `302` + `cache-control: no-store` + UTM؛ نامک با حروف بزرگ هم باز شد؛ UA
    تلگرام در `botCount` نشست نه کلیک؛ کد ناشناخته ۴۰۴؛ `javascript:` رد شد (روی دمو خود
    WAF ابر هم جلویش را می‌گیرد).
  - QR پویا: لینک کوتاه `kind=QR` ساخته شد و `payload` همان `/s/…` بود.
  - لندینگ: ساخت با پیش‌فرض‌ها، ایراد انتشار با شماره‌ی بلوک، انتشار، صفحه‌ی عمومی با
    `noindex, follow`، فرم تماس → `CallbackRequest`؛ پیش‌نویس خراب صفحه‌ی منتشرشده را
    دست نزد.
  - درخواست نظر: `/r/shop` تا تنظیم سکو ۴۰۴ و بعد ۲۰۰؛ `enqueueReviewRequest` تکراری و
    وضعیت غیرتحویل بی‌اثر؛ اجرای صف بدون کد پترن «کد پترن ثبت نشده» گفت و چیزی نفرستاد؛
    صفحه‌ی `/r/<token>` دو سکو و محصول سفارش را نشان داد؛ `go/site` → `/products/<slug>#reviews`.
  - ارسال واقعی پیامک آزموده **نشد** — پیامک دمو خاموش است و پترن ثبت‌شده‌ای نیست. پس از
    ثبت پترن روی سایت اصلی، اول «پیامک آزمایشی» را بزنید.
