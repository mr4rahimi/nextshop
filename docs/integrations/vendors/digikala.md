# دیجی‌کالا (Digikala Marketplace Open API)

> ✅ **مرجع کامل API در پوشه‌ی [`digikala/`](digikala/) است — منبع حقیقت `digikala/spec.yml`.**
> این فایل خلاصه‌ی چیزهایی است که پنل از آن استفاده می‌کند، به‌اضافه‌ی نکته‌هایی که
> در مستند رسمی نیامده و در عمل دیده شده.

| فایل پوشه‌ی `digikala/` | محتوا |
|---|---|
| `spec.yml` | OpenAPI 3.0 رسمی (`/open-api/v1/doc/specification.yml`) — ۲۵۷ مسیر؛ برای پیدا کردن یک endpoint اول این را بگردید |
| `doc02.md` | متن صفحه‌ی Swagger همان مستند (برای جستجوی متنی) |
| `Digikala.html` | خروجی ذخیره‌شده‌ی صفحه‌ی Swagger |
| `doc01` | متن صفحه‌ی «توکن اختصاصی» پنل فروشندگان |
| `01.png` – `03.png` | تصویر مراحل فعال‌سازی توکن در پنل فروشندگان |

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
| `clientCode` | «کد کلاینت» واردشده در فرم؛ خالی = claim `client_code` توکن |

> فرم دیجی‌کالا از `/api/integration/connections/test` استفاده **نمی‌کند**؛ آن مسیر
> credentials را با بدنه‌ی درخواست بازنویسی می‌کند و کلیدها را پاک می‌کرد. تست از
> `POST /api/integration/connections/digikala {action:"test"}` با توکن ذخیره‌شده است.
> ذخیره‌ی تنظیمات همگام‌سازی همان `POST /api/integration/connections` بدون credentials است.

## User-Agent = کد کلاینت (در مستند نیامده)

اولین فعال‌سازی واقعی (مای‌مونتا، ۱۴۰۵/۰۸/۰۷): تبادل کد و refresh موفق بودند ولی `GET /profile`
با توکن سالم ۴۰۱ داد:

```json
{"status":"error","message":"Invalid User-Agent!","code":401}
```

مسیرهای `/auth/*` بدون User-Agent کار می‌کنند، مسیرهای داده نه. پنل دیجی‌کالا کنار کد
اعتبارسنجی یک **«کد کلاینت»** هم نشان می‌دهد و JWT توکن claimهای
`token_id, seller_id, client_code, exp` دارد. آداپتور `User-Agent: <client_code>` می‌فرستد
(`clientCodeOf`: مقدار فرم، وگرنه claim توکن) — مثل «کد یکتای» اسنپ‌شاپ. *پذیرفته شدن این
مقدار هنوز با پاسخ موفق تأیید نشده؛ اگر رد شد، مقدار فرم را با کد کلاینت پنل عوض کنید
(«ذخیره کد کلاینت و تست» بدون فعال‌سازی دوباره).*

نکته‌ها:
- ۴۰۱ «Invalid User-Agent» دیگر refresh را صدا نمی‌زند (`isUserAgentError`) — قبلاً هر تست یک
  توکن تازه می‌سوزاند (زمان انقضا در فرم مدام عوض می‌شد).
- انقضای access در عمل **دو ساعت** بود، نه یک ساعت (exp منهای زمان فعال‌سازی).
- **کد اعتبارسنجی یک‌بارمصرف است** و پنل دیجی‌کالا فقط یک‌بار نشانش می‌دهد. استفاده‌ی دوباره:
  `400 seller.service.token.not.found`. فرم بعد از تبادل موفق کادر کد را پنهان می‌کند
  («وارد کردن کد تازه» برای فعال‌سازی دوباره).

## سقف درخواست

هر پاسخ `rate_limit: {max, current, resetTime:{date, timezone:"Asia/Tehran"}}` دارد و سقف
**برای هر مسیر جداست** — مثلاً `/` حدود ۳۳ در ۳۰ ثانیه و `/auth/token` حدود ۲۲۱ در ساعت
(دیده‌شده ۱۴۰۵/۰۸/۰۷). آداپتور بین ارسال‌های تک‌تنوعی ۱ ثانیه صبر می‌کند و روی ۴۲۹ تا
`resetTime` (حداکثر ۶۰ ثانیه) صبر و یک‌بار دوباره تلاش می‌کند.

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
| `PATCH /variants/{id}/seller-stock` | `variant` | ارسال موجودی `{seller_stock}` |
| `PUT /variants/{id}` | `variant` | ارسال قیمت `{selling_price}` (ریال) |
| `GET /orders?page&size=50` | `order` | اقلام سفارش فعال |

اگر توکن scope لازم را نداشته باشد پاسخ ۴۰۳ است؛ scopeهای توکن در فرم نمایش داده می‌شوند.
توکن واقعی مای‌مونتا همه‌ی scopeها را داشت: `question, growth_coach, insight, profile, inventory,
order, product, variant, commission, sbs_shipment, sbs_orders, sbs_setting, shipment, package,
lightening_deal, ticketing, seller_page, sbs_order_change_status, search_ads, invoice, voucher, promotion`.

## فیلدهای تنوع (`GET /variants`)

واحد نگاشت در دیجی‌کالا **تنوع (DKPC)** است، نه محصول.

| فیلد دیجی‌کالا | در پنل |
|---|---|
| `id` (seller variant id) | `platformProductId` — همان شناسه‌ای که در `/variants/{variant_id}` می‌رود |
| `product_id`, `product_variant_id` | `rawData.refs.product` / `rawData.refs.variant` |
| `title` / `product_title` | عنوان |
| `supplier_code` | SKU (کد فروشنده) |
| `price_sale` | `salePrice` (ریال ÷ ۱۰) |
| `price_list` | ذخیره **نمی‌شود** — «قیمت مرجع» دیجی‌کالاست، نه تخفیف فروشنده |
| `marketplace_seller_stock` | `stock` — فقط موجودی نزد فروشنده؛ `warehouse_stock` (انبار دیجی‌کالا) دست ما نیست |
| `is_archived` | آرشیوشده‌ها کنار گذاشته می‌شوند |

## قیمت و تخفیف

- همه‌ی مبالغ دیجی‌کالا **ریالی** است؛ داخلی تومان (×۱۰ / ÷۱۰ در آداپتور).
- دیجی‌کالا فقط یک «قیمت فروش» دارد و فیلد تخفیف فروشنده ندارد. مثل تپسی‌شاپ، تخفیف پنل
  ما با ارسال قیمت نهایی (`applyDiscount(...).effective`) اعمال می‌شود و بازه‌اش را پنل
  اجرا می‌کند ([discounts.md](../discounts.md)).
- پروموشن‌ها، شگفت‌انگیز و تخفیف هوشمند در API جدا (`/pricing/...`) هستند و پنل فعلاً
  به آن‌ها دست نمی‌زند.
- `PATCH /variants/selling-price` هم وجود دارد ولی `credit_increase_percentage` را اجباری
  می‌خواهد؛ برای همین قیمت با `PUT /variants/{id}` (همه‌ی فیلدها اختیاری) فرستاده می‌شود.
- `PUT /variants/{id}` اگر تنوع عکس تأییدشده‌ی کافی نداشته باشد ۴۰۰ می‌دهد (spec).

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
- [ ] تأیید اینکه User-Agent = کد کلاینت پذیرفته می‌شود (اولین `/profile` موفق)
- [ ] بررسی اینکه `id` و `product_variant_id` تنوع در داده‌ی واقعی یکی‌اند یا نه
- [ ] سفارش‌های ارسال توسط فروشنده (`ship-by-seller-orders`) و لغو اقلام
- [ ] ارسال دسته‌ای با `/batch/variant/seller-stock/update` برای کاتالوگ بزرگ
- [ ] لینک دیجی‌کالا در کاتالوگ ربات بله (`https://www.digikala.com/product/dkp-{product}/`)
- [ ] وب‌هوک، اگر نشانی‌اش برای توکن اختصاصی قابل تنظیم باشد
