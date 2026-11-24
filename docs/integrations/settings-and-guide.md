# یکپارچه‌سازی: قاب، تنظیمات، راهنمای نگاشت و قرار دادن محصول (۲.۱۵۶.۰)

بازطراحی بخش یکپارچه‌سازی هم‌شکل حسابداری، با تنظیمات متناسب با نوع کسب‌وکار،
راهنمای نگاشت در سه حالت حسابداری و صفحه‌ی «قرار دادن محصول».

## در یک نگاه

| چیز | کجا |
|---|---|
| فهرست بخش‌ها، دسته‌ها، پیش‌تنظیم‌ها، نام عملیات | `lib/integration/core/sections.ts` (بی‌وابستگی سرور) |
| پیکربندی سمت سرور: سرویس‌های فعال، بخش‌های خاموش، منبع موجودی | `lib/integration/core/config.ts` |
| قاب (نوار ماژول، «همه‌ی بخش‌ها»، نوار پایین موبایل) | `components/admin/integration/IntegrationShell.tsx` + `app/admin/integration/layout.tsx` |
| کاشی‌ها | `INTEGRATION_APPS` در `components/admin/apps.ts`؛ آیکن سه‌بعدی از `desktop/registry.ts` با همان مسیر |
| خانه | `app/admin/integration/page.tsx` — وضعیت کلی، کارهای مانده، کانال‌ها، کاشی در ۴ دسته، فعالیت اخیر |
| تنظیمات | `/admin/integration/settings` + `GET/PUT /api/integration/settings` |
| راهنمای نگاشت | `/admin/integration/guide` (`GuideClient.tsx`) |
| قرار دادن محصول | `/admin/integration/product-suggestions` + `GET/POST /api/integration/listing` (مسیر قدیمی حفظ شد؛ API قدیمی `product-suggestions` حذف شد) |
| موجودی | `/admin/integration/inventory` + `/api/integration/inventory` (جستجو، صفحه‌بندی، ورود دستی) |
| هشدار سرویس خاموش در صفحه‌ی اتصال | `components/admin/integration/PlatformOff.tsx` |

## تنظیمات (`IntegSettings`)

مهاجرت `20261126090000_integration_settings` (افزایشی):

- `hiddenSections String[]` — کلید بخش‌های خاموش (`HIDEABLE_SECTIONS`). هسته (`core`)
  خاموش‌شدنی نیست: خانه، سفارش، قرار دادن محصول، نگاشت، موجودی، اتصالات، تنظیمات، راهنما.
- `profile` — ساده / استاندارد / کامل (`INTEG_PROFILES`)؛ فقط کلید بخش‌ها را می‌چیند.
- `platformPrefs Json` — `{ [code]: { panelUrl } }` آدرس پنل فروشندگی بازارگاه دستی.

بخش خاموش: از قاب، خانه، پیشخوان (`app/admin/page.tsx` با `hiddenIntegrationHrefs`)
پنهان می‌شود؛ اگر کسی مستقیم برود، صفحه باز است با نوار «این بخش خاموش است». سایدبار
(`nav.tsx`) فقط بخش‌های هسته را دارد. `messages` خاموش = `FETCH_CHATS` صف نمی‌شود.

### سرویس خاموش (`IntegPlatform.isActive = false`)

- در هیچ فهرستی نمی‌آید (اتصالات، خانه، نگاشت، سفارش، پیام، قرار دادن محصول، `/api/integration/platforms`).
- worker: `ensureScheduledJobs` فقط اتصال‌های سرویس روشن؛ انتخاب job در `runWorkerCycle`
  شرط `platformCode IN (… isActive)` دارد؛ کارهای PENDING هنگام خاموش‌کردن `CANCELLED` می‌شوند.
- `pushMappingStock` (`getPlatformType` برای سرویس خاموش null) و `pushMappingPrice` چیزی نمی‌فرستند؛
  `processPendingInvoices` اتصال حسابانِ خاموش را نمی‌بیند.
- نگاشت‌ها پاک نمی‌شوند.
- **حسابان** تا وقتی `AccSettings.mode = HESABAN` است خاموش نمی‌شود (۴۰۹). وقتی خاموش است،
  گزینه‌ی «حسابان وب» در `AccModePanel` نمی‌آید و `PATCH /api/admin/accounting/settings` آن را رد می‌کند.
- سرویس بی‌آداپتور (دیوار) «هنوز پشتیبانی نمی‌شود» است و در فهرست‌ها نمی‌آید.

## منبع موجودی (`getStockSource`)

| منبع | شرط | موجودی | قیمت خرید «از حسابداری» |
|---|---|---|---|
| `internal` | `AccSettings.mode = INTERNAL` | کاردکس انبارهای فروش ← `Product.stock` | `AccProductCost.lastCost` (وگرنه `avgCost`) — `syncPurchasePricesFromInternal` |
| `hesaban` | اتصال حسابان روشن و CONNECTED، حالت ≠ داخلی | حسابان ← نگاشت ← سایت و بازارگاه | حسابان (`resyncPricesFromAccounting`) |
| `site` | بقیه | `Product.stock`؛ ورود دستی در «موجودی» (`setManualMappingStock`) | فقط دستی |

`purchasePriceSource = HESABAN` در پایگاه داده یعنی «از حسابداری»؛ در حالت داخلی همان مقدار
از بهای خرید داخلی پر می‌شود (`/api/integration/pricing/resync` بی `platformCode`).

### دور «فقط تغییرها» (منبع `internal` یا `site`)

پیش از این هیچ دور خودکاری `Product.stock` را به بازارگاه نمی‌برد — فقط سفارش‌ها و دکمه‌ی دستی.
فاکتور خرید، انبارگردانی و ویرایش محصول به بازارگاه نمی‌رسید. حالا `ensureScheduledJobs`
هر ۱۰ دقیقه (`CHANGED_STOCK_MS`) برای هر بازارگاه متصل با `syncStockEnabled` یک
`SYNC_ALL_STOCK` با `payload.changedOnly` صف می‌کند؛ `syncAllStock` فقط جفت‌هایی را
می‌فرستد که `Product.stock` با `IntegPlatformProduct.stock` (آخرین عدد ارسالی/دریافتی) فرق دارد.
لینک تنوع‌دار (`meta.variants`) را دور تنوع‌ها می‌فرستد. نگاشت با «همگام» خاموش هم در دور
کامل و هم در این دور کنار می‌ماند.

### موجودی پایه‌ی نگاشت (رفع صفر شدن)

نگاشت دستی/پیشنهادی با `stock = 0` ساخته می‌شد و در منبع `site`/`internal` کسی پرش نمی‌کرد؛
اولین سفارش بازارگاه `max(0, 0 − qty)` را به سایت و همه‌ی بازارگاه‌ها می‌فرستاد. حالا:

- ساخت نگاشت (`POST /api/integration/mapping`، `approveSuggestion`، نگاشت خودکار) موجودی
  اولیه را از محصول سایت می‌گیرد.
- `decrementMappingStockForOrder` / `restoreMappingStockForCancel` پایه را از `baseStock`
  می‌گیرند: موجودی واقعی محصول سایتِ بی‌تنوع؛ برای سفارش سایتِ محصول `trackStock` همان عدد
  (سایت خودش کم کرده)، وگرنه پایه ± تعداد. محصول تنوع‌دار و نگاشت بی‌سایت مثل قبل.

## قرار دادن محصول

- «خودکار» = آداپتور `createProduct` دارد (فعلاً باسلام) ← `/admin/integration/create-products`.
- «دستی» = بقیه: «کپی مشخصات» (نام، قیمت مؤثر سایت، موجودی، SKU، بارکد، توضیح کوتاه،
  آدرس صفحه)، «پنل فروشندگی» (`platformPrefs.panelUrl` یا `SELLER_PANELS`: باسلام، دیجی‌کالا)،
  «دریافت محصولات» (`FETCH_PRODUCTS` با اولویت ۱) — نگاشت خودکار با SKU/بارکد یکسان.
- فهرست: محصولات `isActive` که در این بازارگاه نگاشت فعال ندارند؛ پیش‌فرض «فقط موجودها».

## راهنما (help)

کلیدهای تازه/بازنویسی‌شده در `components/admin/integration/help.ts`: `integration`،
`integrationProductSuggestions`، `integrationPricing`، `integrationInventory`،
`integrationSettings`، `integrationGuide` (+ `TOPIC_PAGES` در `lib/assistant/help.ts`).
متن `GuideClient.tsx` باید با رفتار همین سند یکی بماند.

## کارهای بعدی پیشنهادی

- ~~بازطراحی صفحه‌ی «نگاشت محصولات»~~ — انجام شد، [mapping-page.md](mapping-page.md).
- ورود موجودی اولیه و قیمت خرید در همان ویزارد نگاشت (حالت `site`).
- پر کردن خودکار SKU/بارکد در «کپی مشخصات» با قیمت حساب‌شده‌ی قانون قیمت همان بازارگاه.
