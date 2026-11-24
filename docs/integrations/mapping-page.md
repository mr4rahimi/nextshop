# صفحه‌ی نگاشت محصولات و وصل کردن کالا به محصول (۲.۱۵۸.۰)

## صفحه (`/admin/integration/mapping`)

| بخش | کجا |
|---|---|
| سرور: سرویس‌ها، آمار، زبانه‌ی آغازین | `app/admin/integration/mapping/page.tsx` |
| رابط | `MappingPageClient.tsx` (همه‌ی زبانه‌ها و پنجره‌ها در یک فایل) |
| `/admin/integration/mapping/suggestions` | ریدایرکت به `?tab=suggestions` |

زبانه‌ها (`?tab=` یا `?platform=`؛ پیش‌فرض: پیشنهادها اگر هست، وگرنه اولین سرویس):

- **پیشنهادها** — `GET /api/integration/mapping/suggestions` (حالا با `remote` = محصول بازارگاه و
  `shopProduct` با SKU/موجودی، یک‌جا نه N+1). `PATCH { ids[], action }` تأیید/رد گروهی (تا ۲۰۰،
  خطای یکی بقیه را نگه نمی‌دارد).
- **هر سرویس** — `GET /api/integration/platform-products?status=unmapped|suggested|mapped` با
  `counts` و `lastFetchedAt`. قبلاً فیلتر وضعیت روی همان ۵۰ ردیف بارشده بود و شمارش غلط می‌داد.
  جستجو روی نام، SKU و کد بازارگاه.
- **همه‌ی نگاشت‌ها** — `GET /api/integration/mapping?q=&missing=<code>&id=`. `missing` = نگاشت‌هایی
  که این سرویس را ندارند. برچسب خط‌چین ← `EditSheet` با همان سرویس باز.
- **کالای حسابداری** — فقط `source = internal`؛ پایین‌تر.

### پنجره‌ی نگاشت (`MappingSheet`)

یک صفحه به‌جای قدم‌به‌قدم. انتخابگر سایت `GET /api/integration/mapping/shop-search` (پیش‌نویس‌ها هم،
با SKU، موجودی، تنوع‌دار، و `mappingId`/`mappedOn` نگاشت فعلی). انتخابگر سرویس فقط محصولات
**بی‌نگاشت** آن سرویس را می‌آورد.

`POST /api/integration/mapping`: اگر محصول سایت انتخاب‌شده همین حالا نگاشت فعال دارد، لینک‌های
تازه **به همان نگاشت اضافه** می‌شوند (`{ attached: true }`) — قبلاً ۴۰۹ می‌داد و نمی‌شد محصولِ
نگاشت‌شده با باسلام را به اسنپ‌شاپ هم وصل کرد. اگر آن نگاشت در همان سرویس لینک دارد ← ۴۰۹.
لینک غیرفعال/یتیمِ همان محصول پاک و دوباره ساخته می‌شود.

## وصل کردن کالای حسابداری به محصول موجود

`lib/accounting/inventory/link-product.ts` + `GET/POST /api/admin/accounting/items/link`
(مجوز `ACC_INVENTORY`).

در حالت داخلی هر محصول ساده کالای هم‌شناسه دارد (`acc_ensure_item`)؛ کالایی که جدا ساخته شده
(فاکتور خرید، ورود سریع) با محصول سایت هیچ ارتباطی ندارد. شناسه‌ی محصول عوض‌شدنی نیست، پس
کالای جدا (X) در کالای هم‌شناسه‌ی محصول (P) ادغام می‌شود:

| حالت | شرط (`itemUses` بدون «محصول سایت») | کار |
|---|---|---|
| `absorb` | P گردش ندارد | ردیف‌های X به P؛ کد، عنوان، واحد، قیمت‌ها، گروه، تأمین‌کننده و سریال X روی P؛ کد قبلی P ← `AccItemAlias` («ادغام کالا»). کاردکس و بها دست نمی‌خورد |
| `alias` | X گردش ندارد | بارکد و کدهای X به P؛ کد X ← کد قبلی P؛ X پاک |
| `merge` | هر دو | ردیف‌ها منتقل، `rebuildItemFully` (کاردکس از اول، `AccStock`، سند منابعی که بهایشان عوض شد). اولین حرکت باید `assertPostable` باشد؛ هم‌انبارگردانی و سریال تکراری ← ۴۰۹ |

جدول‌های منتقل‌شده: `productId` در `AccStockMove`، `AccInvoiceLine`، `AccTransferLine`،
`AccStockAdjustLine`، `AccStockCountLine`، `AccStockCountEntry`، `AccPurchaseOrderLine`، `AccStock`،
`AccProductCost`؛ `itemId` در `AccSerial`، `AccPriceChange`، `AccLegacyItem`، `AccRelabelLog`،
`AccItemAttr`، `AccItemBarcode`، `AccItemPlace`، `AccItemAlias`. **جدول تازه‌ای که شناسه‌ی کالا
نگه دارد باید به این فهرست هم اضافه شود.**

بعدش در حالت داخلی `Product.stock` = جمع انبارهای فروش (مطلق) و `trackStock = true`؛ دور «فقط
تغییرها» آن را به بازارگاه‌ها می‌برد. قیمت فروش سایت عوض نمی‌شود.

رد می‌شود: محصول تنوع‌دار، کالای مدل‌دار (تنوع ← «ساخت محصول»)، کالایی که خودش محصول یا تنوع
است.

`linkCandidates`: کالای فعالِ فروش آنلاینِ بی‌مدل و بی‌محصول، جدیدترین اول، با پیشنهاد محصول
ساده‌ی هم‌کد (`sku` = کد کالا)، هم‌بارکد (`gtin13`/`sku` = بارکد) یا هم‌نام (`normName`).
`matched=1` پیشنهاد را برای حداکثر ۲۰۰۰ کالای اول حساب می‌کند.

## ساخت محصول از کالا ← بازارگاه

محصول ساخته‌شده از کالا هم‌شناسه‌ی کالاست، پس نگاشت حسابداری نمی‌خواهد. کارت «ساخته شد» در
`ToProductClient` دکمه‌ی «قرار دادن در بازارگاه‌ها» دارد (`/admin/integration/product-suggestions?q=`)؛
فهرست قرار دادن محصول جدیدترین اول است و محصول ۷ روز اخیر برچسب «تازه» دارد. محصول پیش‌نویس
تا فعال نشود در آن فهرست نمی‌آید.
