# دیجی‌کالا (Digikala Marketplace Open API)

> ✅ **مرجع کامل API در پوشه‌ی [`digikala/`](digikala/) است — منبع حقیقت `digikala/spec.yml`.**
> این فایل خلاصه‌ی چیزهایی است که پنل از آن استفاده می‌کند، به‌اضافه‌ی نکته‌هایی که
> در مستند رسمی نیامده و در عمل دیده شده.

## وضعیت (۱۴۰۵/۰۸/۰۷) — برای ادامه‌ی کار از این‌جا شروع کنید

| بخش | وضعیت |
|---|---|
| کلید RSA، فعال‌سازی توکن، تمدید خودکار | ✅ روی مای‌مونتا کار می‌کند (نسخه ۲.۱۱۲.۰) |
| User-Agent الزامی | ✅ `DigikalaTrustedBot/SelfToken/153053` — پاسخ ۲۰۰ |
| دریافت محصولات (تنوع‌ها) | ✅ ۱۰۸ تنوع مای‌مونتا دریافت شد |
| نگاشت | ⏳ با کاربر — در «نگاشت محصولات» |
| ارسال موجودی و قیمت (دسته‌ای) | ⚠️ پیاده‌شده، **هنوز با دیجی‌کالای واقعی اجرا نشده** — اولین اجرا را در «گزارش لاگ‌ها» ببینید؛ پاسخ واقعی `/batch/inquiry` باید تأیید شود |
| دریافت سفارش‌های فعال | ⚠️ پیاده‌شده، در زمان تست سفارش فعالی نبود — اولین سفارش را در «سفارش‌های بازارگاه» بررسی کنید |
| سفارش‌های ارسال توسط فروشنده، لغو، وب‌هوک، لینک ربات بله | ❌ انجام نشده — «کارهای مانده» پایین |

فروشنده‌ی تست: مای‌مونتا (بازرگانی اندیکا)، کد فروشندگی `153053`، سرور `188.212.97.138`.
تست مستقیم با توکن واقعی: credentials رمزشده در `IntegConnection` (platformCode `digikala`) با
`INTEGRATION_ENCRYPTION_KEY` همان سرور باز می‌شود — فقط خواندنی، و **refresh نکنید** مگر توکن تازه را
ذخیره کنید؛ هر refresh توکن قبلی را باطل می‌کند و اتصال پنل می‌شکند. سایت آکادمی سرویس‌هاب فقط از IP
ایران باز می‌شود (از سرور 9dm دریافت شد).

راهنمای «؟» صفحه‌ی اتصال: کلید `integrationDigikala` در `components/admin/integration/help.ts`.

| فایل پوشه‌ی `digikala/` | محتوا |
|---|---|
| `spec.yml` | OpenAPI 3.0 رسمی (`/open-api/v1/doc/specification.yml`) — ۲۵۷ مسیر؛ برای پیدا کردن یک endpoint اول این را بگردید |
| `doc02.md` | متن صفحه‌ی Swagger همان مستند (برای جستجوی متنی) |
| `Digikala.html` | خروجی ذخیره‌شده‌ی صفحه‌ی Swagger |
| `doc01` | متن صفحه‌ی «توکن اختصاصی» پنل فروشندگان |
| `01.png` – `03.png` | تصویر مراحل فعال‌سازی توکن در پنل فروشندگان |
| `servicehub/01-getting-started.md` | آکادمی سرویس‌هاب: شروع کار، **هدر الزامی User-Agent**، مدیریت خطاها |
| `servicehub/02-auth-guide.md` | آکادمی سرویس‌هاب: احراز هویت، کلید RSA، رمزگشایی (PKCS1)، refresh، لغو، نمونه‌کد ۵ زبان |
| `servicehub/03-rate-limits.md` | آکادمی سرویس‌هاب: لایه‌های سقف درخواست، `rate_limit`، `Retry-After`، بهترین شیوه‌ها |
| `hubservice.html` | خروجی ذخیره‌شده‌ی صفحه‌ی «شروع کار» (همان servicehub/01) |

## اتصال

| | |
|---|---|
| نوع | بازارگاه (marketplace) |
| Base URL | `https://seller.digikala.com/open-api/v1` |
| فرم ادمین | `/admin/integration/connections/digikala` |
| API فرم | `app/api/integration/connections/digikala/route.ts` |
| آداپتور | `lib/integration/adapters/marketplace/digikala.adapter.ts` |
| کد پلتفرم | `digikala` (در `prisma/seed-integration.ts` از قبل بود) |

## احراز هویت — توکن اختصاصی با کلید RSA

دیجی‌کالا توکن را مستقیم نشان نمی‌دهد. مسیر (پنل فروشندگان ← سرویس‌هاب ← توکن اختصاصی):

1. **پنل ما** یک جفت کلید RSA-4096 می‌سازد (`generate-key`). کلید عمومی (PEM، `spki`)
   نمایش داده و کپی می‌شود؛ کلید خصوصی (`pkcs8`) فقط رمزشده در `IntegConnection.credentials`
   می‌ماند و هیچ API آن را برنمی‌گرداند.
2. فروشنده در دیجی‌کالا «فعالسازی توکن» ← تأیید قوانین (تصویر `01.png`) ← چسباندن کلید
   عمومی و «ثبت کلید عمومی» (`02.png`).
3. دیجی‌کالا یک **کد اعتبارسنجی** Base64 نشان می‌دهد که با کلید عمومی رمز شده.
4. فروشنده کد را در مرحله‌ی ۳ فرم می‌چسباند (`activate`): Base64 ← رمزگشایی با کلید
   خصوصی ← `POST /auth/token {authorization_code}` ← `access_token` + `refresh_token`.
5. بلافاصله `GET /profile` به‌عنوان تست اجرا و وضعیت اتصال `CONNECTED` می‌شود.

**padding:** مستند نوع padding را نگفته. `decryptAuthorizationCode` به ترتیب PKCS#1 v1.5
(پیش‌فرض openssl در PHP)، OAEP-SHA1 و OAEP-SHA256 را امتحان می‌کند و خروجی را فقط اگر
ASCII چاپی باشد می‌پذیرد (OpenSSL 3.2+ برای PKCS#1 نامعتبر به‌جای خطا داده‌ی تصادفی
برمی‌گرداند). **Node سرورها (22.15 / OpenSSL 3.0) رمزگشایی PKCS#1 را کلاً رد می‌کند**
(`RSA_PKCS1_PADDING is no longer supported for private decryption` — حمله‌ی Marvin)؛ برای
همین آخرین تلاش RSA خام (`RSA_NO_PADDING`) و برداشتن دستی padding نوع ۲ است. هر سه
padding روی Node محلی (OpenSSL 3.5) و سرور 9dm آزموده شده‌اند. *هنوز با کد واقعی
دیجی‌کالا آزموده نشده — بعد از اولین فعال‌سازی واقعی این خط را به‌روز کنید.*

**اعتبار توکن‌ها:** access یک ساعت، refresh شش ماه. آداپتور زمان انقضا را از `exp` خود JWT
می‌خواند (`accessExpiresAt`) و ۵ دقیقه مانده به انقضا، یا روی ۴۰۱، با
`POST /auth/refresh-token {access_token, refresh_token}` تازه می‌کند. پاسخ refresh یک
`refresh_token` تازه هم دارد که **باید همیشه جایگزین شود** (مستند). refreshهای همزمان
مثل باسلام یکی می‌شوند و نتیجه با `patchConnectionCredentials` ذخیره می‌شود.

بعد از شش ماه فروشنده در دیجی‌کالا دوباره «فعالسازی توکن» می‌زند و کد تازه را وارد
می‌کند — **کلید عوض نمی‌شود**. تغییر کلید در دیجی‌کالا فقط با درخواست پشتیبانی است؛
برای همین «ساخت کلید جدید» در فرم تأیید صریح می‌خواهد.

credentials ذخیره‌شده:

| کلید | محتوا |
|---|---|
| `publicKey` / `privateKey` | PEM جفت کلید |
| `accessToken` / `refreshToken` | توکن‌ها |
| `accessExpiresAt` | میلی‌ثانیه‌ی انقضای access |
| `activatedAt` | زمان آخرین فعال‌سازی با کد |
| `scopes` | دسترسی‌های توکن، با ویرگول (مثل `variant,order,profile`) |
| `sellerCode` | «کد فروشندگی» فرم؛ خالی = claim `seller_id` توکن |
| `userAgent` | User-Agent دستی (پیشرفته)؛ خالی = `DigikalaTrustedBot/SelfToken/{sellerCode}` |

> فرم دیجی‌کالا از `/api/integration/connections/test` استفاده **نمی‌کند**؛ آن مسیر
> credentials را با بدنه‌ی درخواست بازنویسی می‌کند و کلیدها را پاک می‌کرد. تست از
> `POST /api/integration/connections/digikala {action:"test"}` با توکن ذخیره‌شده است.
> ذخیره‌ی تنظیمات همگام‌سازی همان `POST /api/integration/connections` بدون credentials است.

## User-Agent الزامی — `DigikalaTrustedBot/SelfToken/{کد فروشندگی}`

**از ۴ مهر ۱۴۰۵** هر درخواست با توکن اختصاصی باید این هدر را داشته باشد، وگرنه ۴۰۱
`Invalid User-Agent!` — حتی با توکن سالم. منبع: پاسخ تیکت پشتیبانی (۱۴۰۵/۰۸/۰۷) و بخش «هدر الزامی:
User-Agent» در [servicehub/01-getting-started.md](digikala/servicehub/01-getting-started.md).

```
User-Agent: DigikalaTrustedBot/SelfToken/153053      ← توکن اختصاصی (کد فروشندگی)
User-Agent: DigikalaTrustedBot/MyAwesomeApp          ← سرویس‌دهنده‌ی ثبت‌شده (نام انگلیسی بی‌فاصله)
```

پیش‌فرض کتابخانه‌ها (`node`, `curl/8.x`, `PostmanRuntime/7.x`) رد می‌شوند. دیجی‌کالا اول توکن را
می‌سنجد، پس با توکن جعلی هر User-Agentی «Invalid token!» می‌گیرد — این خطا فقط با توکن واقعی دیده
می‌شود. آزموده با توکن واقعی مای‌مونتا: `/profile`, `/variants`, `/orders` همه ۲۰۰.

پیاده‌سازی (`userAgentOf` در آداپتور، روی همه‌ی درخواست‌ها از جمله refresh):
- کد فروشندگی = فیلد «کد فروشندگی دیجی‌کالا» فرم (`sellerCode`)، وگرنه claim `seller_id` توکن
  (JWT claimها: `token_id, seller_id, client_code, exp`). در تبادل کد، توکن هنوز نیست؛ اگر فرم کد
  داشته باشد همان فرستاده می‌شود (`/auth/*` بدون آن هم کار کرده).
- «تنظیمات پیشرفته ← User-Agent دستی» (`userAgent`) کل مقدار را جایگزین می‌کند — فقط اگر دیجی‌کالا
  فرمت را عوض کرد.
- ۴۰۱ با متن User-Agent باعث refresh نمی‌شود (`isUserAgentError`) — توکن تازه درستش نمی‌کند.

مسیر کشف (برای اینکه دوباره تکرار نشود): «کد کلاینت» پنل (= claim `client_code`)، Base64 بازشده‌اش،
User-Agent مرورگر فعال‌کننده و پیش‌فرض کتابخانه‌ها همه رد شدند. سورس پنل پرچم
`module_seller_service_check_user_agent_self_token` دارد. «کد کلاینت» برای توکن اختصاصی لازم نیست.

نکته‌های دیگر:
- انقضای access در عمل **دو ساعت** بود، نه یک ساعت.
- **کد اعتبارسنجی یک‌بارمصرف است**، کمتر از ۵ دقیقه اعتبار دارد و پنل فقط یک‌بار نشانش می‌دهد.
  استفاده‌ی دوباره: `400 seller.service.token.not.found`. فرم بعد از تبادل موفق کادر کد را پنهان
  می‌کند («وارد کردن کد تازه» برای فعال‌سازی دوباره).
- padding رمزگشایی طبق راهنمای رسمی `RSA/ECB/PKCS1Padding` است.

## سقف درخواست

مرجع: [servicehub/03-rate-limits.md](digikala/servicehub/03-rate-limits.md).

| لایه | خواندن (View) | نوشتن (Form) |
|---|---|---|
| سراسری، به ازای IP | ۵۰ در ۳ دقیقه | **۷۰ در ۳۰ دقیقه** |
| سرویس‌هاب، به ازای فروشنده+کلاینت+مسیر | ۳۰ در ۳۰ ثانیه | **۲۰۰ در ساعت** |

مسیرهای `variant` سقف پویا بر اساس تعداد تنوع فعال دارند (۶۰۰ تنوع ≈ ۱۵ در دقیقه). سقف نوشتن یعنی
**ارسال تک‌تنوعی ممکن نیست** — موجودی و قیمت با API دسته‌ای می‌روند (پایین). هر پاسخ
`rate_limit: {max, current, resetTime}` دارد؛ روی ۴۲۹ آداپتور هدر `Retry-After` (ثانیه) یا
`resetTime` را می‌خواند، تا ۶۰ ثانیه صبر و یک‌بار دوباره تلاش می‌کند.

## خطاها

```json
{"status":"error","message":"Validation failed","code":400,
 "errors":["seller.service.token.authorization.code.invalid"]}
```

`errors` گاهی آرایه است (بالا) و گاهی شیء `{field: [msg]}` (طبق spec)؛ `errorText` هر دو را می‌خواند.

## مسیرهایی که پنل استفاده می‌کند

| مسیر | scope | کاربرد |
|---|---|---|
| `POST /auth/token` | — | کد رمزگشایی‌شده ← توکن‌ها |
| `POST /auth/refresh-token` | — | تمدید |
| `GET /profile` | `profile` | تست اتصال (نام و شناسه‌ی فروشنده) |
| `GET /variants?page&size=50` | `variant` | دریافت تنوع‌ها برای نگاشت |
| `POST /batch/variant/seller-stock/update` | `variant` | ارسال موجودی، دسته‌های ۱۰۰تایی `{seller_stock}` |
| `POST /batch/variant/update` | `variant` | ارسال قیمت، دسته‌های ۱۰۰تایی `{selling_price}` (ریال) |
| `POST /batch/inquiry` | `self_settings` | نتیجه‌ی هر قلم دسته |
| `GET /orders?page&size=50` | `order` | اقلام سفارش فعال |

اگر توکن scope لازم را نداشته باشد پاسخ ۴۰۳ است؛ scopeهای توکن در فرم نمایش داده می‌شوند.
توکن واقعی مای‌مونتا همه‌ی scopeها را داشت: `question, growth_coach, insight, profile, inventory,
order, product, variant, commission, sbs_shipment, sbs_orders, sbs_setting, shipment, package,
lightening_deal, ticketing, seller_page, sbs_order_change_status, search_ads, invoice, voucher, promotion`.

## فیلدهای تنوع (`GET /variants`)

واحد نگاشت در دیجی‌کالا **تنوع (DKPC)** است، نه محصول.

| فیلد دیجی‌کالا | در پنل |
|---|---|
| `id` (seller variant id) | `platformProductId` — در داده‌ی واقعی برابر `product_variant_id` است (سفارش‌ها مستقیم وصل می‌شوند) |
| `product_id`, `product_variant_id` | `rawData.refs.product` / `rawData.refs.variant` |
| `title` / `product_title` | عنوان |
| `supplier_code` | SKU (کد فروشنده) |
| `price_sale` | `salePrice` (ریال ÷ ۱۰) |
| `price_list` | ذخیره **نمی‌شود** — «قیمت مرجع» دیجی‌کالاست، نه تخفیف فروشنده |
| `marketplace_seller_stock` | `stock` — فقط موجودی نزد فروشنده؛ `warehouse_stock` (انبار دیجی‌کالا) دست ما نیست |
| `is_archived` | آرشیوشده‌ها کنار گذاشته می‌شوند |

## ارسال دسته‌ای

`{deadline: 600, items: [{variant_id, payload}]}` ← `{batch_id, status: "processing"}`. آداپتور
`/batch/inquiry` را با فاصله‌ی ۲ تا ۱۰ ثانیه تا ۲ دقیقه می‌پرسد؛ هر قلم
`{key: variant_id, status: "success"|..., errors}`. قلمی که تا پایان مهلت نتیجه نگرفت موفق حساب
می‌شود (در دیجی‌کالا ادامه دارد؛ ارسال دوباره فقط تکرارش می‌کند). *اینکه `key` همان variant_id
است از مثال spec برداشته شده و هنوز با پاسخ واقعی دیده نشده.*

## قیمت و تخفیف

- همه‌ی مبالغ دیجی‌کالا **ریالی** است؛ داخلی تومان (×۱۰ / ÷۱۰ در آداپتور).
- دیجی‌کالا فقط یک «قیمت فروش» دارد و فیلد تخفیف فروشنده ندارد. مثل تپسی‌شاپ، تخفیف پنل
  ما با ارسال قیمت نهایی (`applyDiscount(...).effective`) اعمال می‌شود و بازه‌اش را پنل
  اجرا می‌کند ([discounts.md](../discounts.md)).
- پروموشن‌ها، شگفت‌انگیز و تخفیف هوشمند در API جدا (`/pricing/...`) هستند و پنل فعلاً
  به آن‌ها دست نمی‌زند.
- `PATCH /variants/selling-price` هم وجود دارد ولی `credit_increase_percentage` را اجباری
  می‌خواهد؛ قیمت با `batch/variant/update` (فیلدهای payload اختیاری) فرستاده می‌شود.
- ویرایش تنوع اگر عکس تأییدشده‌ی کافی نداشته باشد خطا می‌دهد (spec) — در نتیجه‌ی همان قلم.
- داده‌ی واقعی: `price_sale` گاهی **بزرگ‌تر** از `price_list` است، پس `price_list` تخفیف نیست.

## سفارش‌ها

`GET /orders` فقط اقلام **فعال** را می‌دهد (هنوز به انبار دیجی‌کالا نرسیده‌اند)، مرتب‌شده
با `order_created_at` نزولی. همه‌ی صفحه‌ها در هر دور خوانده می‌شوند؛ مکان‌نما شماره‌ی صفحه
است.

- کلید قلم: `{order_id}:{product_variant_id}` — تکرار در دورهای بعد بی‌اثر است.
- `product_variant_id` سفارش با `rawData.refs.variant` تنوع‌های دریافت‌شده به `id` ترجمه
  می‌شود؛ اگر پیدا نشد خودش کلید محصول می‌شود.
- `unitPrice` = `total_price / quantity / 10` (تومان؛ `total_price` بعد از تخفیف مدیر).
- مشتری دیجی‌کالاست — نام و تلفن خریدار نمی‌آید.
- لغو قلم از این فهرست قابل تشخیص نیست (قلم لغوشده فقط ناپدید می‌شود).
- سفارش‌های «ارسال توسط فروشنده» (`/ship-by-seller-orders`, scope `sbs_orders`) و
  تاریخچه (`/orders/history`) هنوز خوانده نمی‌شوند.

## وب‌هوک

`/webhook/subscription` رویدادهایی مثل `order_shipment`, `order_processed`,
`order_item_cancellation`, `order_return`, `product_variant_status_change` دارد، ولی
**نشانی وب‌هوک در API تعریف نمی‌شود** (احتمالاً هنگام ثبت Client در دیجی‌کالا) و بدنه‌ی
رویدادها در spec نیامده. فعلاً پنل polling می‌کند.

## کارهای مانده

- [x] فعال‌سازی با کد واقعی — padding درست بود، تبادل و refresh موفق (۱۴۰۵/۰۸/۰۷)
- [x] User-Agent: `DigikalaTrustedBot/SelfToken/{seller_id}` (پاسخ تیکت، ۱۴۰۵/۰۸/۰۷)
- [x] `id` و `product_variant_id` در داده‌ی واقعی یکی‌اند (۱۰۸ تنوع مای‌مونتا)
- [ ] سفارش‌های ارسال توسط فروشنده (`ship-by-seller-orders`) و لغو اقلام
- [x] ارسال دسته‌ای موجودی و قیمت
- [ ] دیدن پاسخ واقعی `/batch/inquiry` (کلید `key` = variant_id؟) در اولین ارسال موجودی/قیمت
- [ ] دیدن اولین سفارش واقعی در «سفارش‌های بازارگاه» (فیلدها، قیمت ریالی، تاریخ)
- [ ] لینک دیجی‌کالا در کاتالوگ ربات بله (`https://www.digikala.com/product/dkp-{product}/`)
- [ ] وب‌هوک، اگر نشانی‌اش برای توکن اختصاصی قابل تنظیم باشد
