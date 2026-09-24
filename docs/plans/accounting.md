# حسابداری — داخلی یا حسابان وب، با یک پنل

> **این سند زنده‌ی پروژه‌ی حسابداری است.** هر جلسه‌ی کار روی حسابداری با خواندن
> بخش ۰ و بخش ۱۹ (تله‌ها) شروع می‌شود. تصمیم‌ها در بخش ۲ قفل شده‌اند؛ برای عوض
> کردنشان اول همین سند به‌روز شود، بعد کد.
>
> **منشأ:** جلسه‌ی ۱۴۰۵/۰۷/۰۲ — بررسی مستندات حسابان (`integrations/vendors/hesaban/openapi.json`)
> و داده‌های مالی موجود فروشگاه، و جواب سؤال‌های طراحی.
>
> **تغییر جهت ۱۴۰۵/۰۷/۰۲ (همان جلسه، هنگام فاز ۰):** حسابداری پنل **هیچ وابستگی‌ای
> به حسابان وب ندارد.** حسابان فقط (۱) الگوی امکانات است و (۲) منبع انتقال داده‌ی
> تنها کسب‌وکاری که امروز رویش است — **مای مونتا**. اتصال فعلی حسابان دست‌نخورده
> می‌ماند تا آن انتقال. بعد از فاز ۰ تمرکز **فقط** روی تکمیل حسابداری مستقل پنل با
> بهترین رابط کاربری است؛ انتقال (اکسل یا API) آخر کار. بقیه‌ی کسب‌وکارها از صفر
> شروع می‌کنند یا انتقالشان جداگانه بررسی می‌شود. (تصمیم‌های ۱۴ تا ۱۶)
>
> **اصل حاکم:** صاحب کسب‌وکار «بدهکار/بستانکار» نمی‌نویسد. به زبان خودش ثبت
> می‌کند («دو میلیون از آقای رضایی گرفتم، کارت‌به‌کارت») و سیستم سند دوطرفه را
> خودش می‌سازد. حسابدار با کلید «نمای حسابدار» همه‌ی سندها، کدها و سند دستی را
> می‌بیند. **هیچ عدد مالی بدون سند دوطرفه‌ی متوازن در سیستم وجود ندارد.**

---

## ۰. وضعیت و شروع سریع

| فاز | موضوع | وضعیت |
|---|---|---|
| ۰ | زیرساخت: درگاه حسابداری، صف رویداد مالی، تنظیم حالت | ✅ انجام شد (۲.۵۳.۰) |
| ۱ | ~~بهبود حالت حسابان~~ | ❌ لغو شد (تصمیم ۱۴) |
| ۲ | هسته‌ی دفتر: سال مالی، سرفصل، سند، اشخاص | ✅ انجام شد (۲.۵۴.۰) |
| ۳ | کالا و انبار: چند انبار، کاردکس، میانگین موزون | ✅ انجام شد (۲.۵۵.۰) |
| ۴ | فاکتورها: فروش، خرید، برگشتی، پیش‌فاکتور، چاپ رسمی | ✅ انجام شد (۲.۵۶.۰) |
| ۵ | خزانه: صندوق، بانک، کارتخوان، دریافت و پرداخت، چک | ✅ انجام شد (۲.۵۷.۰) |
| ۶ | هزینه‌ها و وصل شدن اقساط، کیف پول، پورسانت و تسویه‌ی بازارگاه | ✅ انجام شد (۲.۵۸.۰) |
| ۷ | گزارش‌ها و داشبورد | ⏳ |
| ۸ | انتقال داده‌ی مای مونتا از حسابان (اکسل یا API) — **آخر کار** | ⏳ |
| ۹ | بستن سال مالی، سپس سامانه‌ی مودیان | ⏳ |

### استقرار

| نسخه | دمو (9dm) | پروداکشن |
|---|---|---|
| ۲.۵۳.۰ — فاز ۰ | ✅ ۱۴۰۵/۰۷/۰۲ | فرمان‌ها به کاربر داده شد |
| ۲.۵۴.۰ و ۲.۵۵.۰ — فاز ۲ و ۳ | ✅ ۱۴۰۵/۰۷/۰۴ (مهاجرت‌های `…_accounting_ledger` و `…_accounting_inventory`؛ همه‌ی صفحه‌ها و APIها ۲۰۰) | فرمان‌ها به کاربر داده شد |
| ۲.۵۶.۰ — فاز ۴ | ✅ ۱۴۰۵/۰۷/۰۴ (مهاجرت `…_accounting_invoices`) | فرمان‌ها به کاربر داده شد |
| ۲.۵۷.۰ — فاز ۵ | ✅ ۱۴۰۵/۰۷/۰۴ (مهاجرت `…_accounting_treasury`) | فرمان‌ها به کاربر داده شد |
| ۲.۵۸.۰ — فاز ۶ | ✅ ۱۴۰۵/۰۷/۰۴ (مهاجرت `…_accounting_expenses`؛ دمو بی‌کاربر است — مسیرهای تازه ۳۰۷/۴۰۱ و لاگ بی‌خطا؛ حساب ۸۱۰۵ چون سرفصل ندارد ساخته نشد، درست) | فرمان‌ها به کاربر داده شد |

> دمو در حالت «بدون حسابداری» مانده تا راه‌اندازی را خود کاربر امتحان کند.
> هیچ‌کدام از این نسخه‌ها سید لازم ندارد؛ `deploy.mjs` مهاجرت را اجرا می‌کند.
>
> ⚠️ **روی مای مونتا «راه‌اندازی حسابداری داخلی» زده نشود** تا انتقال داده‌اش
> (فاز ۸) آماده نشده: راه‌اندازی فاکتور خودکار حسابان و خواندن موجودی از حسابان
> را خاموش می‌کند (تصمیم ۱، تله‌ی ۳). حالت آن سایت از مهاجرت فاز ۰ «حسابان وب» است.

**برای ادامه‌ی کار در یک گفتگوی تازه:**
1. بخش ۲ (تصمیم‌ها، به‌ویژه ۱۴ تا ۱۶) و بخش ۱۹ (تله‌ها) را بخوان.
2. در جدول بالا اولین فاز ناتمام را پیدا کن و بخش ۲۰ همان فاز را بخوان.
3. کد حسابداری در `lib/accounting/` و صفحه‌ها در `app/admin/accounting/` است (بخش ۱۸).
4. هر صفحه‌ی تازه: `HelpButton` کنار عنوان + کلید `accounting*` در `components/admin/worklist/help-content.ts` (تصمیم ۱۶).
5. بعد از هر فاز: نسخه، changelog، این جدول، دیپلوی دمو (روند انتشار).
6. **فاز بعدی: ۷ — گزارش‌ها و داشبورد** (بخش ۱۱). همه‌ی اعداد از `AccVoucherLine` (بدون `isVoid`)؛ کمکی‌های موجود: `ledger/balances.ts` (`balancesBy`، `balanceOf`، `statement`). تفکیک هزینه‌ی سرفصل‌ها امروز در `GET /api/admin/accounting/expenses` از `AccMoneyLine` است — گزارش «هزینه‌ها»ی فاز ۷ باید از دفتر (حساب‌های کلاس `EXPENSE`) بخواند تا سند دستی هم دیده شود. معیار: ترازنامه تراز روی داده‌ی دمو.

---

## ۱. در یک نگاه

```
 سایت · سفارش تلفنی · بازارگاه‌ها · کارتابل («خرید شد») · اقساط اعتباری · پورسانت · کیف پول
                                      │
                                      ▼  (در همان تراکنش تغییر کسب‌وکار)
                         AccEvent — صف رویداد مالی (outbox)
                                      │
                           dispatcher در worker یکپارچه‌سازی
                                      │
              ┌───────────────────────┴───────────────────────┐
              ▼  mode = HESABAN                                ▼  mode = INTERNAL
     HesabanProvider                                   InternalProvider
     فاکتور / برگشت / ابطال / سند دستی از API           سند دوطرفه + کاردکس + خزانه + چک
     (گزارش‌گیری در خود حسابان)                         (همه‌ی گزارش‌ها در پنل)
```

- هر کسب‌وکار **یکی** را انتخاب می‌کند: حسابان وب یا حسابداری داخلی.
- بخش‌های فروشگاه هرگز مستقیم حسابان یا دفتر داخلی را صدا نمی‌زنند؛ فقط «رویداد»
  ثبت می‌کنند. همین باعث می‌شود تعویض حالت، کد بقیه‌ی فروشگاه را دست نزند.
- هر دیپلوی دیتابیس خودش را دارد؛ پس حسابداری داخلی هر سایت خودبه‌خود جداست
  (نیازی به `tenantId` نیست).

---

## ۲. تصمیم‌های قفل‌شده

| # | موضوع | تصمیم | دلیل |
|---|---|---|---|
| ۱ | رابطه‌ی داخلی و حسابان | **انحصاری.** `AccSettings.mode` یکی از `NONE` / `HESABAN` / `INTERNAL` | دو منبع حقیقت یعنی دو تراز که هیچ‌وقت نمی‌خوانند |
| ۲ | تعویض حالت | فقط از ابتدای یک سال مالی، یا با ویزارد انتقال (فاز ۸) و تأیید گزارش تطبیق | نیمی از سال در هر سیستم = حسابی که بسته نمی‌شود |
| ۳ | مخاطب | **دوسطحی:** پیش‌فرض ساده برای صاحب کسب‌وکار + «نمای حسابدار» | هم صاحب مغازه، هم حسابدار حرفه‌ای |
| ۴ | مودیان | داده از روز اول مطابق سامانه‌ی مودیان (اطلاعات خریدار، شناسه‌ی کالا، نرخ مالیات هر ردیف)؛ **اتصال واقعی فاز ۹** | اتصال بعدی مهاجرت داده نمی‌خواهد |
| ۵ | در دامنه | چرخه‌ی کامل چک، چند انبار + حواله، ویزارد انتقال از حسابان (کالا، فاکتورها، اسناد و …)، پیش‌فاکتور و فاکتور رسمی چاپی | جواب مستقیم کاربر |
| ۶ | واحد پول داخلی | **تومان، `BigInt`** — مثل کل فروشگاه. تبدیل ×۱۰ فقط در مرز حسابان | یک قرارداد در کل کدبیس |
| ۷ | روش بهای تمام‌شده | **میانگین موزون متحرک**، سراسری برای هر کالا (نه به‌ازای انبار) | همان روش حسابان (`oneAmount`)؛ ویزارد انتقال عدد را مستقیم می‌گیرد |
| ۸ | مالیات بر ارزش افزوده | نرخ در تنظیمات (`vatRateBp`، واحد صدم درصد) + قابل تغییر روی هر ردیف | نرخ هر سال با قانون بودجه عوض می‌شود |
| ۹ | بازارگاه‌ها | هر بازارگاه یک **شخص** است؛ طلب فروش از بازارگاه است نه از مشتری نهایی؛ کارمزد = هزینه | پول را بازارگاه واریز می‌کند، نه مشتری |
| ۱۰ | حقوق و دستمزد | خارج از دامنه. فقط تسویه‌ی پورسانت (`StaffPayout`) به دفتر می‌رود | پروژه‌ی جداگانه است |
| ۱۱ | ویرایش سند | سند ثبت‌شده تا قبل از **تاریخ قفل** قابل بازسازی است (سند خودکار با منبعش)؛ بعد از قفل فقط با سند معکوس | الگوی Xero/حسابان؛ هم راحت، هم ممیزی‌پذیر |
| ۱۲ | تفصیلی | «تفصیلی» = شخص یا حساب خزانه؛ ردیف سند FK صریح به `AccParty` / `AccTreasury` دارد، نه جدول عمومی تفصیلی | یکپارچگی داده با FK، نه با قرارداد |
| ۱۴ | وابستگی به حسابان | **هیچ.** حسابان فقط الگوی امکانات و منبع انتقال است. هیچ کدی در `lib/accounting/` آداپتور حسابان را صدا نمی‌زند، جز ابزار انتقال (فاز ۸). اتصال فعلی حسابان در یکپارچه‌سازی **دست‌نخورده** می‌ماند؛ فقط در حالت `INTERNAL` خاموش می‌شود | خواسته‌ی صریح کاربر |
| ۱۵ | ترتیب کار | بعد از فاز ۰ فقط حسابداری مستقل (فازهای ۲ تا ۷ و بستن سال)؛ انتقال **آخر**، فقط برای مای مونتا، با اکسل یا API — هرکدام که آن موقع ساده‌تر بود | کسب‌وکارهای دیگر از صفر شروع می‌کنند |
| ۱۶ | راهنما | **هر صفحه و هر بخش حسابداری** یک آیکن «؟» (`HelpButton`) کنار عنوانش دارد که پاپ‌آپ راهنما باز می‌کند؛ متن در `components/admin/worklist/help-content.ts` با کلید `accounting*` | خواسته‌ی صریح کاربر |
| ۱۷ | موجودی سایت و فاکتور کانال‌ها | فروشگاه موجودی سفارش را خودش کسر می‌کند (`deductStockForOrderItems`) و بازارگاه با نگاشت. پس **صدور** فاکتور خودکار و لغو بازارگاه `shopStock: false` می‌گیرند؛ لغو/مرجوعی سفارش سایت و هر فاکتور دستی `Product.stock` را تفاضلی تکان می‌دهند. خرید کارتابل (دراپ‌شیپ) هم `false` | کسر مستقیم خاموش نشد تا موجودی سایت در لحظه‌ی پرداخت درست بماند و صف رویداد در مسیر سفارش گلوگاه نشود |
| ۱۸ | فاکتور رسمی | قالب «صورت‌حساب فروش کالا و خدمات» به **ریال** (مثل فرم رسمی)؛ ×۱۰ فقط در مرز چاپ. قالب فروشگاهی و رسید تومان. لوگو فقط در قالب فروشگاهی (سؤال باز ۵) | فرم استاندارد سازمان امور مالیاتی ریالی است |
| ۱۹ | دریافت/پرداخت | **ویرایش ندارد** — ابطال و ثبت دوباره. تخصیص بعد از ثبت عوض می‌شود (`allocateExisting`). فقط دریافت ← فاکتور فروش و پرداخت ← فاکتور خرید؛ برگشتی‌ها از مانده‌ی فاکتور کم می‌شوند نه با تخصیص | ساده‌ترین مدل بی‌تناقض برای چک‌های ساخته‌شده |
| ۲۰ | دریافت خودکار سایت | فقط `Payment` موفق با درگاهی که در `AccTreasury.providers` یک صندوق/بانک آمده؛ نبودنش ← رویداد مسدود با پیام. `WALLET` و `credit` رد می‌شوند (فاز ۶). استرداد وجه خودکار **نیست** — پرداخت دستی به مشتری | فروشگاه مسیر استرداد ثبت‌شده‌ای ندارد |
| ۱۳ | مقدار کالا | `Int` (مثل `Product.stock` و `OrderItem.qty`) | کالاهای فعلی شمارشی‌اند؛ تغییر به اعشار در بخش ۱۹ تله‌ی ۹ |
| ۲۱ | هزینه | همان `AccMoneyDoc` با `kind = EXPENSE` و ردیف‌های `AccMoneyLine` («بابت چه»). بخش پرداخت‌نشده (`payable`) بدهی به شخص روی `AP` است، بی‌تخصیص — با «پرداخت» عادی به همان شخص تسویه می‌شود. ویرایش ندارد (مثل تصمیم ۱۹) | یک مدل برای هر پولی که جابه‌جا می‌شود؛ ابطال و چک همان مسیر فاز ۵ |
| ۲۲ | کیف پول | موجودی کیف پول = `WALLET_LIABILITY` با تفصیلی شخص. پرداخت سفارش از کیف پول = دریافت با روش `WALLET` (بدون خزانه). شارژ/کسر دستی ادمین «بابت» دارد: `credit` (طرف دیگر `AR` همان شخص) یا `gift` (هزینه‌ی `CUSTOMER_REWARD`). اول دوره خودکار: موجودی امروز − آنچه بعد از راه‌اندازی ثبت شده | کیف پول روش پرداخت است نه تخفیف (فاز ۴)؛ اول دوره‌ی قابل بازسازی بدون دو بار شمردن |
| ۲۳ | صندوقِ ثبت خودکار | اقساط کارتابل و تسویه‌ی پورسانت روی `AccSettings.installmentTreasuryId` / `payoutTreasuryId`؛ نبودش ← رویداد «مسدود» با پیام، و بعد از تنظیم خودش ثبت می‌شود (بررسی دوباره‌ی مسدودها). فرم کارتابل و پورسانت عوض **نشد** | دو فرم بیرون از حسابداری صندوق نمی‌پرسند؛ وصل کردن حسابداری نباید کار کارتابل را سخت کند |
| ۲۴ | تسویه‌ی بازارگاه | دریافت از شخصِ `isMarketplace` با `fee` روی ردیف: مبلغ ردیف = **فروش تسویه‌شده (ناخالص)**، بانک = مبلغ − کارمزد، کارمزد ← `MARKETPLACE_FEE`، `AR` به‌اندازه‌ی ناخالص. رویداد `MARKETPLACE_SETTLED` ساخته **نشد** — بازارگاه‌ها واریزشان را از API نمی‌دهند | تصمیم ۹؛ ثبت دستی از «ثبت سریع ← تسویه‌ی بازارگاه» |

---

## ۳. وضعیت امروز — چه داریم، چه نداریم

### ۳.۱ حسابان وب — پوشش API (نسخه v3)

| حوزه | endpoint | امروز استفاده می‌شود؟ | محدودیت مهم |
|---|---|---|---|
| کاربر | `User/GetUserInfo`، `User/LoginToAccountingSPA` | ✅ تست اتصال | — |
| کالا | `Product/PRODUCTS`، `GetProductByCode/Barcode/Id`، `GetProductStock`، `Add`، `Edit`، `DeleteProductsByCode`، `Inquiry` | ✅ خواندن موجودی، ارسال قیمت | تصویر از API ثبت نمی‌شود |
| گروه کالا | `ProductGroup/Add`، `Inquiry` | ❌ | — |
| انبار | `Storage/GetAllStorages`، `GetStorage`، `Add`، `Edit`، `DeleteStorages` | ✅ فقط فهرست | — |
| انتقال بین انبار | `StorageTransfer/*` | ❌ | — |
| فاکتور فروش | `SalesInvoice/AddInvoice`، `GetInvoice(ById)`، `Inquiry`، `CancelInvoices` | ⚠️ فقط ثبت با اقلام | مدل ثبت (`APISalesInvoiceViewModel`) **دریافت نقد/چک، اضافات (کرایه) و تخفیف فاکتور ندارد** — فقط `discount` روی هر قلم و `payment.internetPaymentId` |
| برگشت از فروش | `SalesReturnInvoice/AddInvoice`، `AddInvoiceWithoutReference`، `CancelInvoices` | ❌ | مبلغ هر قلم باید **همان مبلغ فاکتور مرجع** باشد |
| فاکتور خرید | `PurchaseInvoice/AddInvoice`، `CancelInvoices` | ❌ | پرداخت ندارد؛ `transportCost` و `dueDate` دارد |
| برگشت از خرید | `PurchaseReturnInvoice/*` | ❌ | — |
| سند حسابداری | `Document/Add`، `GetDocumentById`، `GetDocumentByApiId`، `Inquiry` | ❌ | تنها راه ثبت دریافت/پرداخت جدا از فاکتور |
| حساب‌ها | `Account/Search`، `GetAccountsByFullCodes` | ❌ | **مانده برنمی‌گرداند** |
| مشتری | `UserAccount/AddCustomer` | ❌ | **فهرست مشتریان ندارد** |
| بارنامه | `BillOfLading/*` | ❌ | — |

**آنچه حسابان از API اصلاً ندارد:** دریافت و پرداخت مستقل، مدیریت چک، فهرست
فاکتورها یا اسناد (فقط دریافت با شماره‌ی سریال)، هیچ گزارشی (تراز، سود و زیان،
معین). پس در حالت حسابان، پنل ما **فرستنده** است، نه گزارش‌گیر.

### ۳.۲ داده‌ی مالی موجود فروشگاه (پراکنده، بدون دفتر)

| مفهوم | جدول | نقش در حسابداری داخلی |
|---|---|---|
| فروش سایت و تلفنی | `Order`، `OrderItem`، `Payment` | منبع فاکتور فروش و دریافت |
| فروش بازارگاه | `IntegOrder` | منبع فاکتور فروش با طرف حساب بازارگاه |
| بهای خرید هر ردیف | `OrderItemCost` | ورودی خرید (بهای واقعی از کاردکس می‌آید) |
| فروش اعتباری | `Order.paymentTerm`، `OrderCreditInstallment` | طلب از مشتری + سررسید |
| سود و پورسانت | `StaffDeal`، `StaffPayout` | تسویه‌ی پورسانت = سند هزینه |
| تأمین‌کننده | `StaffSupplier` | به شخص (`AccParty`) وصل می‌شود |
| کیف پول | `User.walletBalance`، `WalletTransaction` | بدهی فروشگاه به مشتری |
| موجودی | `Product.stock` (یک عدد) | در حالت داخلی **کش** جمع انبارهای قابل فروش می‌شود |
| فاکتور حسابان | `IntegOrder` + `lib/integration/core/invoicing.ts` | پشت `HesabanProvider` می‌رود |

---

## ۴. معماری

### ۴.۱ درگاه حسابداری — `lib/accounting/port.ts`

```ts
export interface AccountingProvider {
  readonly mode: "HESABAN" | "INTERNAL";
  /** یک رویداد را اعمال می‌کند. باید idempotent باشد (dedupeKey). */
  apply(event: AccEventRecord): Promise<ApplyResult>;
  /** قابلیت‌ها — UI بر اساسش دکمه‌ها را نشان می‌دهد یا پنهان می‌کند */
  capabilities(): ProviderCapabilities; // reports, cheques, multiWarehouse, …
}

type ApplyResult =
  | { ok: true; ref?: string }          // شناسه‌ی سند/فاکتور در مقصد
  | { ok: false; retry: boolean; error: string; blockedReason?: string };
```

- `getProvider()` از روی `AccSettings.mode` یکی از دو پیاده‌سازی را برمی‌گرداند؛ `NONE` = رویدادها `SKIPPED` می‌شوند.
- هیچ کدی بیرون از `lib/accounting/` نه `HesabanAdapter.createSalesInvoice` را صدا می‌زند و نه `AccVoucher` می‌سازد.

### ۴.۲ صف رویداد مالی — الگوی outbox

```ts
// هر جا تغییر مالی رخ می‌دهد — داخل همان prisma.$transaction
await emitAccEvent(tx, {
  type: "SALE_ISSUED",
  aggregate: { type: "Order", id: order.id },
  dedupeKey: `order:${order.id}:sale`,
  payload: { … },   // فقط شناسه‌ها + snapshot لازم، نه کل رکورد
});
```

- رویداد **در همان تراکنش** تغییر کسب‌وکار نوشته می‌شود؛ اگر سفارش ذخیره شد، رویدادش هم هست.
- dispatcher در چرخه‌ی worker یکپارچه‌سازی (`lib/integration/core/worker.ts`، هر ۳۰ ثانیه) + یک تلاش فوری بعد از commit.
- `dedupeKey` یکتا: گذار تکراری سفارش، رویداد دوم نمی‌سازد.
- ترتیب: رویدادهای یک `aggregate` به ترتیب `createdAt` و **پشت سر هم** اجرا می‌شوند (برگشت قبل از فروش اجرا نشود).
- خطای موقت (شبکه‌ی حسابان) → `retry` با backoff؛ خطای داده (کالا نگاشت ندارد) → `BLOCKED` با `blockedReason` و نمایش در پنل، مثل `NEEDS_MAPPING` امروز.

### ۴.۳ انواع رویداد

| نوع | منبع | معنی |
|---|---|---|
| `SALE_ISSUED` | سفارش سایت/تلفنی در لحظه‌ی کسر موجودی؛ `IntegOrder` بازارگاه | فاکتور فروش |
| `SALE_VOIDED` | لغو سفارش **قبل از ارسال** | ابطال فاکتور |
| `SALE_RETURNED` | مرجوعی **بعد از ارسال** | فاکتور برگشت از فروش |
| `PAYMENT_RECEIVED` | `Payment` موفق، قسط پرداخت‌شده، شارژ کیف پول | دریافت |
| `PAYMENT_REFUNDED` | استرداد وجه | پرداخت به مشتری |
| `PURCHASE_RECORDED` | «خرید شد» در کارتابل، فاکتور خرید دستی | فاکتور خرید |
| `PURCHASE_RETURNED` | برگشت به تأمین‌کننده | برگشت از خرید |
| `INSTALLMENT_PAID` | «پرداخت شد» قسط اعتباری (`payInstallment`) | دریافت روی صندوقِ تنظیمات، تخصیص به فاکتور سفارش |
| `COMMISSION_PAID` | `StaffPayout` (`recordPayout`) | هزینه‌ی پورسانت به نام کارمند |
| `WALLET_ADJUSTED` | شارژ/کسر دستی کیف پول در `/admin/wallet` | سند کیف پول (تصمیم ۲۲) |

پرداخت سفارش از کیف پول رویداد جدا ندارد — همان `PAYMENT_RECEIVED` با `provider = WALLET`.
تسویه‌ی بازارگاه دستی است (تصمیم ۲۴).
| `STOCK_TRANSFERRED` / `STOCK_ADJUSTED` | پنل انبار | حواله / انبارگردانی |

عملیاتی که **خودِ پنل حسابداری** ثبت می‌کند (هزینه، دریافت دستی، چک، سند دستی) در
حالت داخلی رویداد نمی‌سازد و مستقیم سرویس دفتر را صدا می‌زند — این‌ها در حالت
حسابان اصلاً در پنل ما ثبت نمی‌شوند.

### ۴.۴ حالت‌ها و منوی پنل

| حالت | منوی «حسابداری» |
|---|---|
| `NONE` | فقط «راه‌اندازی حسابداری» (انتخاب حالت) |
| `HESABAN` | وضعیت ارسال‌ها (صف رویداد، ناموفق‌ها، تلاش دوباره)، لینک ورود به حسابان (`LoginToAccountingSPA`)، تنظیمات اتصال. گزارش‌ها با پیام «گزارش‌ها در حسابان وب» |
| `INTERNAL` | پنل کامل (بخش ۱۳) |

---

## ۵. نگاشت رویداد به سند (حالت داخلی)

`AR` = حساب‌های دریافتنی تجاری، `AP` = حساب‌های پرداختنی تجاری. `(شخص)` یعنی
ردیف با `partyId`؛ `(خزانه)` یعنی با `treasuryId`. همه‌ی اعداد تومان.

| رویداد | بدهکار | بستانکار |
|---|---|---|
| **فاکتور فروش** | AR (شخص) ← جمع نهایی<br>تخفیفات فروش ← تخفیف اقلام و فاکتور | فروش کالا ← جمع ناخالص اقلام<br>درآمد ارسال ← کرایه (اضافات)<br>مالیات بر ارزش افزوده‌ی فروش ← مالیات |
| ↳ بهای تمام‌شده (هم‌زمان) | بهای تمام‌شده‌ی کالای فروش‌رفته | موجودی کالا ← Σ(تعداد × میانگین لحظه‌ی خروج) |
| **ابطال فاکتور** | سند معکوس همان فاکتور (در دوره‌ی باز: بازسازی) + کاردکس ورودی معکوس | |
| **برگشت از فروش** | برگشت از فروش ← مبلغ<br>مالیات فروش ← سهم مالیات<br>موجودی کالا ← با **همان بهای خروج اولیه** | AR (شخص)<br>بهای تمام‌شده |
| **دریافت** | خزانه (صندوق/بانک/کارتخوان/درگاه) یا اسناد دریافتنی (چک) | AR (شخص) |
| **استرداد وجه** | AR (شخص) | خزانه |
| **فاکتور خرید** | موجودی کالا ← خالص کالا (+ سهم کرایه‌ی حمل)<br>مالیات بر ارزش افزوده‌ی خرید<br>هزینه ← ردیف‌های خدمات | AP (شخص) |
| **برگشت از خرید** | AP (شخص) | موجودی کالا (به میانگین فعلی) + مالیات خرید |
| **پرداخت** | AP (شخص) یا حساب هزینه | خزانه یا اسناد پرداختنی (چک) |
| **هزینه** | حساب هزینه (یک یا چند ردیف) | خزانه، یا AP (شخص) اگر «بعداً پرداخت» |
| **انتقال وجه** | خزانه‌ی مقصد + کارمزد بانکی | خزانه‌ی مبدأ |
| **شارژ دستی کیف پول** | «طلب مشتری»: AR (شخص) / «هدیه»: هدیه و جبران به مشتری | کیف پول مشتریان (شخص) — کسر: برعکس |
| **پرداخت از کیف پول** | کیف پول مشتریان (شخص) | AR (شخص) |
| **قسط اعتباری** | خزانه‌ی تنظیمات | AR (شخص) |
| **تسویه‌ی پورسانت** | هزینه‌ی پورسانت فروش (شخص=کارمند) | خزانه‌ی تنظیمات |
| **تسویه‌ی بازارگاه** | بانک ← واریزی<br>کارمزد بازارگاه ← کسر شده | AR (شخص=بازارگاه) ← ناخالص |
| **انبارگردانی (کسری/اضافی)** | کسری: هزینه‌ی کسری انبار / اضافی: موجودی | برعکس |
| **حواله‌ی بین انبار** | — سند ندارد، فقط کاردکس (موجودی کالا یک حساب است) | |
| **افتتاحیه** | مانده‌های بدهکار | مانده‌های بستانکار؛ اختلاف ← تراز افتتاحیه |
| **اختتامیه** | بستن درآمد و هزینه به خلاصه‌ی سود و زیان → سود انباشته | |

**چک** (بخش ۹.۲) سندهای خودش را دارد.

**زمان صدور فاکتور فروش = لحظه‌ی خروج کالا** (همان جایی که `deductStockForOrderItems`
صدا زده می‌شود). بدون این، کاردکس و بهای تمام‌شده با فاکتور نمی‌خوانند. پرداخت
آنلاینِ پیش از فاکتور، طلب منفی (پیش‌دریافت) روی همان شخص می‌سازد و با صدور فاکتور
خودبه‌خود تسویه می‌شود. زمان دقیق هر کانال در فاز ۴ بررسی شود (تله‌ی ۴).

---

## ۶. مدل داده

همه با پیشوند `Acc`. قرارداد پروژه حفظ می‌شود: کنار هر شناسه‌ی کاربر اسنپ‌شات
نام، حذف نرم برای رکوردهای مرجع، و `ActivityLog` برای تاریخچه (با `ActivityEntity`
های تازه‌ی `ACC_*`).

### ۶.۱ تنظیمات و سال مالی

```prisma
enum AccMode { NONE HESABAN INTERNAL }

model AccSettings {
  id                 String   @id @default("singleton")
  mode               AccMode  @default(NONE)
  modeChangedAt      DateTime?
  currentYearId      String?
  /// تا این روز (شامل) هیچ سندی ساخته، بازسازی یا ویرایش نمی‌شود
  lockDate           DateTime? @db.Date
  vatRateBp          Int      @default(1000)   // ۱۰٪ = 1000
  pricesIncludeVat   Boolean  @default(false)
  defaultWarehouseId String?
  /// اطلاعات فروشنده برای فاکتور رسمی و مودیان
  sellerName         String?
  sellerNationalId   String?   // شناسه‌ی ملی / کد ملی
  sellerEconomicCode String?
  sellerRegNo        String?
  sellerPostalCode   String?
  sellerAddress      String?
  sellerPhone        String?
  stampImage         String?   // مهر
  signatureImage     String?
  invoiceFooterNote  String?
  updatedAt          DateTime @updatedAt
}

enum AccYearStatus { OPEN CLOSING CLOSED }

model AccFiscalYear {
  id               String        @id @default(cuid())
  title            String        // «۱۴۰۵»
  startDate        DateTime      @db.Date
  endDate          DateTime      @db.Date
  status           AccYearStatus @default(OPEN)
  openingVoucherId String?       @unique
  closingVoucherId String?       @unique
  closedAt         DateTime?
  closedByName     String?
  @@unique([startDate])
}

/// شماره‌گذاری پیوسته — ردیف با SELECT … FOR UPDATE قفل می‌شود (تله‌ی ۵)
model AccSequence {
  yearId String
  key    String   // "voucher" | "SALES" | "PURCHASE" | "PROFORMA" | "RECEIPT" | …
  next   Int      @default(1)
  @@id([yearId, key])
}
```

### ۶.۲ سرفصل حساب‌ها

```prisma
enum AccLevel  { GROUP LEDGER SUBLEDGER }       // گروه، کل، معین
enum AccNature { DEBIT CREDIT BOTH }
enum AccClass  { ASSET LIABILITY EQUITY REVENUE EXPENSE }
enum AccDetailKind { NONE PARTY TREASURY }       // معین چه تفصیلی‌ای می‌پذیرد

model AccAccount {
  id           String        @id @default(cuid())
  code         String        @unique   // "1", "11", "1103"
  name         String
  level        AccLevel
  parentId     String?
  class        AccClass
  nature       AccNature
  /// فقط روی معین: تفصیلی لازم است؟
  detailKind   AccDetailKind @default(NONE)
  /// حساب سیستمی — کد از روی این کلید پیدا می‌شود، نه از روی کد حساب
  systemKey    String?       @unique
  isActive     Boolean       @default(true)
  hesabanId    Int?          // از ویزارد انتقال
  parent   AccAccount?  @relation("AccTree", fields: [parentId], references: [id])
  children AccAccount[] @relation("AccTree")
  lines    AccVoucherLine[]
  @@index([parentId])
}
```

**کلیدهای سیستمی** (کد هیچ‌وقت کد حساب را hardcode نمی‌کند):
`CASH`، `BANK`، `POS_CLEARING`، `GATEWAY_CLEARING`، `AR`، `CHEQUE_RECEIVABLE`،
`CHEQUE_IN_COLLECTION`، `INVENTORY`، `VAT_PURCHASE`، `AP`، `CHEQUE_PAYABLE`،
`VAT_SALES`، `WALLET_LIABILITY`، `CUSTOMER_ADVANCE`، `CAPITAL`، `RETAINED_EARNINGS`،
`PL_SUMMARY`، `OPENING_BALANCE`، `SALES`، `SALES_RETURN`، `SALES_DISCOUNT`،
`SHIPPING_REVENUE`، `OTHER_INCOME`، `COGS`، `INVENTORY_SHORTAGE`،
`MARKETPLACE_FEE`، `COMMISSION_EXPENSE`، `BANK_FEE`، `ROUNDING`.

### ۶.۳ اشخاص و خزانه

```prisma
enum AccPersonType { REAL LEGAL }

model AccParty {
  id            String        @id @default(cuid())
  code          Int           @unique            // کد تفصیلی نمایشی
  personType    AccPersonType @default(REAL)
  name          String                           // نام نمایشی
  firstName     String?
  lastName      String?
  companyName   String?
  nationalId    String?   // کد ملی / شناسه ملی
  economicCode  String?
  regNo         String?
  mobile        String?
  phone         String?
  postalCode    String?
  address       String?
  city          String?
  isCustomer    Boolean @default(false)
  isSupplier    Boolean @default(false)
  isEmployee    Boolean @default(false)
  isMarketplace Boolean @default(false)
  creditLimit   BigInt?                          // سقف اعتبار فروش اعتباری
  /// پیوند به موجودیت‌های فروشگاه — هرکدام حداکثر یک شخص
  userId        String?  @unique
  supplierId    String?  @unique                 // StaffSupplier
  platformCode  String?  @unique                 // بازارگاه
  hesabanId     Int?
  note          String?
  isActive      Boolean  @default(true)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  @@index([mobile])
  @@index([name])
}

enum AccTreasuryKind { CASH BANK POS GATEWAY }

model AccTreasury {
  id          String          @id @default(cuid())
  code        Int             @unique
  kind        AccTreasuryKind
  name        String          // «صندوق فروشگاه»، «ملت جاری ۱۲۳۴»
  bankName    String?
  accountNo   String?
  sheba       String?
  cardNo      String?
  /// کارتخوان/درگاه به کدام بانک تسویه می‌شود
  settleToId  String?
  /// درگاه‌های پرداخت سایت (Payment.provider) که به این خزانه می‌نشینند
  providers   String[]        @default([])
  isActive    Boolean         @default(true)
  hesabanId   Int?
}
```

مانده‌ی شخص و خزانه **ذخیره نمی‌شود**؛ از `AccVoucherLine` جمع زده می‌شود
(ایندکس روی `partyId` و `treasuryId`). اگر روزی کند شد، جدول مانده‌ی ماهانه‌ی
کش‌شده اضافه می‌شود — نه ستون مانده روی شخص (تله‌ی ۶).

### ۶.۴ سند

```prisma
enum AccVoucherStatus { POSTED VOID }
enum AccSource {
  MANUAL SALES_INVOICE PURCHASE_INVOICE SALES_RETURN PURCHASE_RETURN
  RECEIPT PAYMENT EXPENSE TRANSFER CHEQUE INVENTORY PAYOUT
  OPENING CLOSING IMPORT
}

model AccVoucher {
  id           String           @id @default(cuid())
  yearId       String
  number       Int                              // پیوسته در هر سال
  date         DateTime         @db.Date
  description  String
  status       AccVoucherStatus @default(POSTED)
  source       AccSource
  sourceId     String?                          // شناسه‌ی فاکتور/دریافت/چک/…
  reversalOfId String?          @unique
  totalDebit   BigInt                           // = totalCredit، برای فهرست سریع
  createdById  String?
  createdByName String
  createdAt    DateTime         @default(now())
  updatedAt    DateTime         @updatedAt
  lines        AccVoucherLine[]
  @@unique([yearId, number])
  @@index([source, sourceId])
  @@index([date])
}

model AccVoucherLine {
  id          String   @id @default(cuid())
  voucherId   String
  seq         Int
  accountId   String
  partyId     String?
  treasuryId  String?
  debit       BigInt   @default(0)
  credit      BigInt   @default(0)
  description String?
  /// denormalize برای گزارش بدون join — همیشه با سند هم‌زمان نوشته می‌شود
  date        DateTime @db.Date
  yearId      String
  isVoid      Boolean  @default(false)
  @@index([accountId, date])
  @@index([partyId, date])
  @@index([treasuryId, date])
  @@index([yearId, isVoid])
}
```

**ناوردا‌ها** (در `lib/accounting/ledger/post.ts` بررسی و در صورت نقض throw):
1. `Σdebit = Σcredit` و بزرگ‌تر از صفر.
2. هر ردیف دقیقاً یک طرف مثبت دارد.
3. حساب ردیف `SUBLEDGER` و فعال است؛ اگر `detailKind = PARTY` → `partyId` الزامی، و برعکس ممنوع.
4. تاریخ داخل سال مالی باز و بعد از `lockDate`.

### ۶.۵ کالا و انبار

```prisma
model AccWarehouse {
  id          String  @id @default(cuid())
  code        Int     @unique
  name        String
  address     String?
  /// موجودی این انبار در Product.stock (قابل فروش در سایت) حساب می‌شود؟
  sellable    Boolean @default(true)
  isActive    Boolean @default(true)
  hesabanId   Int?
}

model AccStock {                    // موجودی فعلی — کش کاردکس
  productId   String
  warehouseId String
  qty         Int     @default(0)
  @@id([productId, warehouseId])
}

model AccProductCost {              // میانگین موزون سراسری
  productId   String   @id
  qtyOnHand   Int      @default(0)
  avgCost     BigInt   @default(0)
  /// شناسه‌ی مالیاتی کالا/خدمت (مودیان) — ۱۳ رقمی
  taxCode     String?
  vatRateBp   Int?     // خالی = نرخ پیش‌فرض
  updatedAt   DateTime @updatedAt
}

enum AccMoveType {
  OPENING PURCHASE PURCHASE_RETURN SALE SALE_RETURN
  TRANSFER_IN TRANSFER_OUT ADJUST_IN ADJUST_OUT
}

model AccStockMove {                // کاردکس
  id          String      @id @default(cuid())
  productId   String
  warehouseId String
  date        DateTime    @db.Date
  seqInDay    Int                        // ترتیب پایدار در یک روز
  type        AccMoveType
  qty         Int                        // علامت‌دار: ورود مثبت، خروج منفی
  unitCost    BigInt                     // ورود: بهای خرید؛ خروج: میانگین لحظه
  /// بعد از این حرکت — برای نمایش کاردکس و بازسازی
  balanceQty  Int
  avgCostAfter BigInt
  sourceType  String                     // "AccInvoice" | "AccTransfer" | "AccCount"
  sourceId    String
  voucherId   String?
  createdAt   DateTime    @default(now())
  @@index([productId, date, seqInDay])
  @@index([sourceType, sourceId])
}

model AccTransfer { … }             // حواله: مبدأ، مقصد، تاریخ، اقلام
model AccStockCount { … }           // انبارگردانی: شمارش → اختلاف → سند
```

`Product.stock` در حالت داخلی = `Σ AccStock.qty` انبارهای `sellable`، و **فقط**
از `lib/accounting/inventory/` نوشته می‌شود (تله‌ی ۳).

### ۶.۶ فاکتور

```prisma
enum AccInvoiceType   { SALES PURCHASE SALES_RETURN PURCHASE_RETURN PROFORMA }
enum AccInvoiceStatus { DRAFT ISSUED VOID }       // پیش‌فاکتور: DRAFT/ISSUED + وضعیت پایین
enum AccProformaState { OPEN ACCEPTED EXPIRED CONVERTED }
enum AccChannel       { SHOP PHONE MARKETPLACE IN_STORE MANUAL }

model AccInvoice {
  id             String           @id @default(cuid())
  type           AccInvoiceType
  yearId         String
  number         Int?                           // در صدور گرفته می‌شود، نه در پیش‌نویس
  date           DateTime         @db.Date
  dueDate        DateTime?        @db.Date
  status         AccInvoiceStatus @default(DRAFT)
  proformaState  AccProformaState?
  validUntil     DateTime?        @db.Date      // اعتبار پیش‌فاکتور
  partyId        String
  channel        AccChannel       @default(MANUAL)
  platformCode   String?
  orderId        String?          @unique       // سفارش سایت/تلفنی
  sourceKey      String?          @unique       // "basalam:12345" برای بازارگاه
  refInvoiceId   String?                        // مرجع برگشتی
  convertedFromId String?         @unique       // پیش‌فاکتور مبدأ
  warehouseId    String?
  /// اسنپ‌شات خریدار در لحظه‌ی صدور — چاپ رسمی و مودیان
  buyerName      String
  buyerNationalId String?
  buyerEconomicCode String?
  buyerPostalCode String?
  buyerAddress   String?
  buyerPhone     String?
  isOfficial     Boolean @default(false)       // فاکتور رسمی (با مشخصات کامل)
  subtotal       BigInt  @default(0)           // Σ qty×unitPrice
  lineDiscount   BigInt  @default(0)
  invoiceDiscount BigInt @default(0)
  additions      BigInt  @default(0)           // کرایه و …
  vatTotal       BigInt  @default(0)
  total          BigInt  @default(0)
  paidTotal      BigInt  @default(0)           // کش تخصیص‌ها (تله‌ی ۶)
  note           String?
  voucherId      String?  @unique
  /// مودیان — فاز ۹
  taxId          String?
  taxStatus      String?
  createdById    String?
  createdByName  String
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
  lines          AccInvoiceLine[]
  charges        AccInvoiceCharge[]
  @@unique([yearId, type, number])
  @@index([partyId, date])
  @@index([type, status, date])
}

model AccInvoiceLine {
  id          String  @id @default(cuid())
  invoiceId   String
  seq         Int
  productId   String?               // خالی = خدمت (بدون کاردکس)
  title       String                // اسنپ‌شات
  unit        String?
  qty         Int
  unitPrice   BigInt
  discount    BigInt  @default(0)   // روی کل ردیف
  vatRateBp   Int     @default(0)
  vatAmount   BigInt  @default(0)
  lineTotal   BigInt                // (qty×unitPrice − discount) + vat
  warehouseId String?
  unitCost    BigInt?               // در صدور از کاردکس پر می‌شود (فروش)
  accountId   String?               // ردیف خدمت/هزینه در فاکتور خرید
  orderItemId String?  @unique
  taxCode     String?
}

model AccInvoiceCharge {            // اضافات و کسورات
  id        String  @id @default(cuid())
  invoiceId String
  kind      String  // "ADDITION" | "DEDUCTION"
  title     String  // «کرایه‌ی ارسال»
  amount    BigInt
  accountId String
}
```

**پیش‌فاکتور** سند نمی‌سازد و کاردکس را تکان نمی‌دهد؛ «تبدیل به فاکتور» یک
`SALES` تازه با `convertedFromId` می‌سازد.

### ۶.۷ دریافت، پرداخت، هزینه، انتقال

```prisma
enum AccMoneyKind   { RECEIPT PAYMENT EXPENSE TRANSFER }
enum AccMoneyMethod { CASH CARD_TRANSFER BANK_TRANSFER POS GATEWAY CHEQUE WALLET }

model AccMoneyDoc {
  id            String       @id @default(cuid())
  kind          AccMoneyKind
  yearId        String
  number        Int
  date          DateTime     @db.Date
  partyId       String?              // دریافت/پرداخت؛ هزینه‌ی نسیه
  total         BigInt
  description   String?
  status        AccInvoiceStatus @default(ISSUED)
  voucherId     String?      @unique
  /// پیوند به منبع فروشگاه (یکی از این‌ها)
  paymentId     String?      @unique   // Payment
  installmentId String?      @unique   // OrderCreditInstallment
  payoutId      String?      @unique   // StaffPayout
  walletTxId    String?      @unique
  createdByName String
  createdAt     DateTime     @default(now())
  items         AccMoneyItem[]       // از کجا/به کجا رفت
  lines         AccMoneyLine[]       // هزینه: به کدام حساب‌ها
  allocations   AccAllocation[]      // به کدام فاکتورها خورد
  @@unique([yearId, kind, number])
}

model AccMoneyItem {
  id           String         @id @default(cuid())
  moneyDocId   String
  method       AccMoneyMethod
  treasuryId   String?        // انتقال: مبدأ
  toTreasuryId String?        // انتقال: مقصد
  chequeId     String?        @unique
  amount       BigInt
  fee          BigInt         @default(0)
  trackingCode String?
}

model AccMoneyLine {                // فقط برای EXPENSE
  id          String @id @default(cuid())
  moneyDocId  String
  accountId   String
  amount      BigInt
  description String?
}

model AccAllocation {               // تسویه‌ی فاکتور
  id         String @id @default(cuid())
  moneyDocId String
  invoiceId  String
  amount     BigInt
  @@unique([moneyDocId, invoiceId])
}
```

### ۶.۸ چک

```prisma
enum AccChequeDir { RECEIVED ISSUED }
enum AccChequeStatus {
  IN_HAND        // دریافتی: در صندوق
  IN_COLLECTION  // دریافتی: به بانک سپرده شد
  CLEARED        // وصول شد / پاس شد
  BOUNCED        // برگشتی
  ENDORSED       // دریافتی: خرج شد به شخص ثالث
  RETURNED       // عودت به صاحب چک / ابطال چک صادره
  ISSUED         // صادره: در انتظار سررسید
}

model AccCheque {
  id            String          @id @default(cuid())
  direction     AccChequeDir
  status        AccChequeStatus
  serialNo      String                     // شماره چک
  sayadId       String?                    // شناسه‌ی صیادی ۱۶ رقمی
  sayadRegistered Boolean @default(false)  // در سامانه‌ی صیاد ثبت/تأیید شد
  bankName      String
  branch        String?
  ownerName     String?                    // صاحب حساب (دریافتی)
  amount        BigInt
  issueDate     DateTime?  @db.Date
  dueDate       DateTime   @db.Date
  partyId       String                     // از چه کسی / به چه کسی
  holderPartyId String?                    // خرج‌شده به
  treasuryId    String?                    // صادره: حساب بانک؛ دریافتی: بانک وصول
  chequeBookId  String?
  reminderSentAt DateTime?
  followUpTaskId String?                   // کار پیگیری در کارتابل
  note          String?
  createdAt     DateTime  @default(now())
  events        AccChequeEvent[]
  @@index([direction, status, dueDate])
}

model AccChequeEvent {
  id        String          @id @default(cuid())
  chequeId  String
  from      AccChequeStatus?
  to        AccChequeStatus
  date      DateTime        @db.Date
  voucherId String?
  note      String?
  byName    String
  createdAt DateTime        @default(now())
}

model AccChequeBook {               // دسته‌چک صادره
  id          String @id @default(cuid())
  treasuryId  String
  fromSerial  String
  toSerial    String
  isActive    Boolean @default(true)
}
```

### ۶.۹ صف رویداد و انتقال

```prisma
enum AccEventStatus { PENDING DONE BLOCKED FAILED SKIPPED }

model AccEvent {
  id            String         @id @default(cuid())
  type          String
  aggregateType String
  aggregateId   String
  dedupeKey     String         @unique
  payload       Json
  status        AccEventStatus @default(PENDING)
  mode          AccMode?       // حالتی که با آن پردازش شد
  attempts      Int            @default(0)
  nextAttemptAt DateTime       @default(now())
  lastError     String?
  blockedReason String?
  resultRef     String?        // شناسه‌ی فاکتور حسابان یا AccVoucher
  createdAt     DateTime       @default(now())
  processedAt   DateTime?
  @@index([status, nextAttemptAt])
  @@index([aggregateType, aggregateId, createdAt])
}

model AccImportRun {                // ویزارد انتقال
  id         String   @id @default(cuid())
  source     String   // "HESABAN_API" | "EXCEL"
  step       String   // "accounts" | "parties" | "products" | "stock" | "invoices" | "documents" | …
  status     String   // RUNNING | PAUSED | DONE | FAILED
  cursor     Json     @default("{}")   // مثلاً آخرین سریال فاکتور خوانده‌شده
  stats      Json     @default("{}")
  report     Json?
  startedAt  DateTime @default(now())
  finishedAt DateTime?
}

model AccImportMap {                // idempotency انتقال
  source     String
  entity     String   // "account" | "party" | "salesInvoice" | "document" | …
  externalId String
  localId    String
  @@id([source, entity, externalId])
}
```

---

## ۷. سرفصل پیش‌فرض (قالب فروشگاهی)

با اسکریپت `scripts/seed-accounting.ts` ساخته می‌شود؛ حساب‌های با `systemKey`
حذف‌شدنی نیستند، فقط تغییر نام. کسب‌وکار می‌تواند معین و کل اضافه کند.

| گروه | کل | معین (کلید سیستمی) |
|---|---|---|
| ۱ دارایی‌های جاری | ۱۱ موجودی نقد و بانک | ۱۱۰۱ صندوق `CASH`، ۱۱۰۲ بانک‌ها `BANK`، ۱۱۰۳ کارتخوان در راه `POS_CLEARING`، ۱۱۰۴ درگاه در راه `GATEWAY_CLEARING` |
| | ۱۲ دریافتنی‌ها | ۱۲۰۱ حساب‌های دریافتنی `AR`، ۱۲۰۲ اسناد دریافتنی `CHEQUE_RECEIVABLE`، ۱۲۰۳ اسناد در جریان وصول `CHEQUE_IN_COLLECTION` |
| | ۱۳ موجودی کالا | ۱۳۰۱ موجودی کالا `INVENTORY` |
| | ۱۴ پیش‌پرداخت‌ها | ۱۴۰۱ مالیات بر ارزش افزوده‌ی خرید `VAT_PURCHASE`، ۱۴۰۲ پیش‌پرداخت |
| ۲ دارایی‌های غیرجاری | ۲۱ دارایی ثابت | ۲۱۰۱ اثاثه و تجهیزات |
| ۳ بدهی‌های جاری | ۳۱ پرداختنی‌ها | ۳۱۰۱ حساب‌های پرداختنی `AP`، ۳۱۰۲ اسناد پرداختنی `CHEQUE_PAYABLE` |
| | ۳۲ مالیات | ۳۲۰۱ مالیات بر ارزش افزوده‌ی فروش `VAT_SALES` |
| | ۳۳ پیش‌دریافت‌ها | ۳۳۰۱ کیف پول مشتریان `WALLET_LIABILITY`، ۳۳۰۲ پیش‌دریافت فروش `CUSTOMER_ADVANCE` |
| ۵ حقوق صاحبان سرمایه | ۵۱ سرمایه | ۵۱۰۱ سرمایه `CAPITAL`، ۵۱۰۲ برداشت |
| | ۵۲ سود انباشته | ۵۲۰۱ سود (زیان) انباشته `RETAINED_EARNINGS`، ۵۲۰۲ خلاصه‌ی سود و زیان `PL_SUMMARY`، ۵۲۰۳ تراز افتتاحیه `OPENING_BALANCE` |
| ۶ درآمدها | ۶۱ فروش | ۶۱۰۱ فروش کالا `SALES`، ۶۱۰۲ برگشت از فروش `SALES_RETURN`، ۶۱۰۳ تخفیفات فروش `SALES_DISCOUNT` |
| | ۶۲ سایر درآمدها | ۶۲۰۱ درآمد ارسال `SHIPPING_REVENUE`، ۶۲۰۲ درآمد خدمات/تعمیرات، ۶۲۰۳ سایر `OTHER_INCOME`، ۶۲۰۴ گرد کردن `ROUNDING` |
| ۷ بهای تمام‌شده | ۷۱ | ۷۱۰۱ بهای تمام‌شده‌ی کالای فروش‌رفته `COGS`، ۷۱۰۲ کسری و ضایعات انبار `INVENTORY_SHORTAGE` |
| ۸ هزینه‌ها | ۸۱ هزینه‌های فروش | ۸۱۰۱ کارمزد بازارگاه `MARKETPLACE_FEE`، ۸۱۰۲ پورسانت فروش `COMMISSION_EXPENSE`، ۸۱۰۳ تبلیغات، ۸۱۰۴ ارسال و بسته‌بندی |
| | ۸۲ هزینه‌های اداری | ۸۲۰۱ اجاره، ۸۲۰۲ حقوق، ۸۲۰۳ آب و برق و گاز، ۸۲۰۴ تلفن و اینترنت، ۸۲۰۵ پیامک و سرویس‌های آنلاین، ۸۲۰۶ ملزومات، ۸۲۰۷ متفرقه |
| | ۸۳ هزینه‌های مالی | ۸۳۰۱ کارمزد بانکی `BANK_FEE` |

در زبان ساده، صفحه‌ی «ثبت هزینه» فقط معین‌های گروه ۸ را با نام و آیکن نشان
می‌دهد («اجاره»، «قبض»، …)، نه کد.

---

## ۸. کالا و انبار

- **ورود:** فاکتور خرید، برگشت از فروش، انبارگردانی اضافی، افتتاحیه.
  میانگین جدید = `(qtyOnHand×avgCost + qty×unitCost) ÷ (qtyOnHand+qty)`.
  کرایه‌ی حمل فاکتور خرید به نسبت مبلغ بین اقلام پخش می‌شود و وارد `unitCost` می‌شود.
- **خروج:** فروش، برگشت از خرید، کسری. `unitCost` = میانگین لحظه‌ی خروج؛ میانگین عوض نمی‌شود.
- **حواله:** دو حرکت `TRANSFER_OUT`/`TRANSFER_IN` با همان میانگین، بدون سند.
- **ثبت با تاریخ گذشته** (مثلاً فاکتور خرید دیروز امروز وارد شود): کاردکس آن کالا
  از آن تاریخ دوباره حساب می‌شود و `unitCost` خروج‌های بعدی و سند بهای تمام‌شده‌شان
  بازسازی می‌شود — فقط اگر همه بعد از `lockDate` باشند؛ وگرنه ثبت رد می‌شود با
  پیام روشن (تله‌ی ۲).
- **موجودی منفی:** قابل تنظیم (پیش‌فرض: هشدار، نه منع — فروشگاه آنلاین نباید
  به‌خاطر ترتیب ورود داده سفارش را رد کند). خروج از موجودی صفر با آخرین میانگین
  شناخته‌شده ثبت و در داشبورد «کالای منفی» نشان داده می‌شود.
- **نقطه‌ی سفارش:** از `Product.lowStockThreshold` موجود استفاده می‌شود.
- **انبارگردانی:** فرم شمارش (موبایل: جستجو/اسکن بارکد + عدد) → اختلاف‌ها → تأیید → سند.
- `OrderItemCost` و «خرید شد» کارتابل: در حالت داخلی، قیمت خرید وارد‌شده در کارتابل
  **فاکتور خرید** می‌سازد (با تأمین‌کننده‌ی همان کار). سود معامله (`StaffDeal`)
  همچنان از `OrderItemCost` می‌آید تا پورسانت رفتار قبلی را حفظ کند؛ گزارش سود
  حسابداری از `COGS` کاردکس می‌آید. این دو عدد می‌توانند متفاوت باشند و در
  گزارش کنار هم نشان داده می‌شوند (تله‌ی ۸).

---

## ۹. خزانه و چک

### ۹.۱ دریافت و پرداخت

- یک فرم برای دریافت، یک فرم برای پرداخت؛ هر فرم چند «روش» می‌پذیرد (بخشی نقد، بخشی چک).
- بعد از انتخاب شخص، فاکتورهای باز او با مانده نمایش داده می‌شوند و مبلغ خودکار
  از قدیمی‌ترین تخصیص می‌یابد (قابل تغییر). مازاد = پیش‌دریافت.
- **پرداخت آنلاین سایت:** `Payment` موفق → دریافت خودکار روی خزانه‌ای که
  `providers` آن شامل `Payment.provider` است (نوع `GATEWAY`). تسویه‌ی درگاه به
  بانک با «انتقال وجه» و کارمزد ثبت می‌شود.
- **کارتخوان:** دریافت روی `POS` (در راه)؛ تسویه‌ی روزانه به بانک با انتقال.
- **قسط اعتباری:** «پرداخت شد» در `/admin/worklist/credit` یک دریافت با
  `installmentId` می‌سازد و به فاکتور همان سفارش تخصیص می‌یابد.

### ۹.۲ چرخه‌ی چک

```
دریافتی:
  IN_HAND ──واگذاری به بانک──▶ IN_COLLECTION ──وصول──▶ CLEARED
     │                              └──برگشت──▶ BOUNCED ──▶ IN_HAND (دوباره نزد ما) | RETURNED
     ├──خرج به شخص ثالث──▶ ENDORSED ──(برگشت از ثالث)──▶ BOUNCED
     └──عودت──▶ RETURNED
صادره:
  ISSUED ──پاس شد──▶ CLEARED
     ├──برگشت خورد──▶ BOUNCED ──▶ ISSUED (چک جایگزین جدا ثبت می‌شود) | RETURNED
     └──ابطال/پس گرفتن──▶ RETURNED
```

| گذار | بدهکار | بستانکار |
|---|---|---|
| دریافت چک | اسناد دریافتنی (شخص) | AR (شخص) |
| واگذاری به بانک | اسناد در جریان وصول (شخص) | اسناد دریافتنی (شخص) |
| وصول | بانک (خزانه) | اسناد در جریان وصول (شخص) |
| برگشت | AR (شخص) | اسناد در جریان وصول یا دریافتنی (شخص) |
| خرج به ثالث | AP (ثالث) | اسناد دریافتنی (صاحب چک) |
| عودت | AR (شخص) | اسناد دریافتنی (شخص) |
| صدور چک | AP (شخص) | اسناد پرداختنی (شخص) |
| پاس شدن | اسناد پرداختنی (شخص) | بانک (خزانه) |
| برگشت/ابطال صادره | اسناد پرداختنی (شخص) | AP (شخص) |

- هر گذار یک `AccChequeEvent` و سند خودش را دارد؛ گذار غیرمجاز در سرویس رد می‌شود.
- **یادآوری سررسید:** کرون روزانه‌ی worker — چک‌های دریافتی و صادره‌ی سررسید فردا
  → اعلان کارمند (`StaffNotification`) و کار پیگیری در کارتابل؛ مرز «دو بار نفرست»
  `reminderSentAt` است، **قبل از** ارسال نوشته می‌شود (همان الگوی اقساط).
- ثبت در سامانه‌ی صیاد دستی است؛ فقط تیک `sayadRegistered` و هشدار برای چک‌های ثبت‌نشده.

---

## ۱۰. فاکتور، پیش‌فاکتور و چاپ

- **ساخت خودکار:** سفارش سایت و تلفنی (`orderId`)، بازارگاه (`sourceKey`) — شخص
  خودکار پیدا یا ساخته می‌شود: مشتری سایت از `userId`، بازارگاه از `platformCode`.
- **ساخت دستی:** فروش حضوری، فروش عمده به ارگان، خرید از تأمین‌کننده.
- **ورود اقلام:** جستجو با نام، کد، بارکد (پشتیبانی از بارکدخوان که مثل کیبورد
  تایپ می‌کند)؛ قیمت پیش‌فرض از قیمت فروش سایت یا آخرین قیمت خرید از همان تأمین‌کننده.
- **پیش‌فاکتور:** شماره‌ی جدا، تاریخ اعتبار، ارسال لینک/PDF برای مشتری، «تبدیل به فاکتور» با یک کلیک.
- **چاپ:** سه قالب — رسید ساده (A5/حرارتی ۸۰ میلی‌متر)، فاکتور فروشگاهی (A4)،
  **فاکتور رسمی** (A4، قالب «صورت‌حساب فروش کالا و خدمات» با مشخصات کامل فروشنده و
  خریدار، شناسه‌ی کالا، مالیات، مبلغ به حروف، مهر و امضا). چاپ با CSS چاپی از
  مرورگر + خروجی PDF. قالب رسمی فقط وقتی فعال است که مشخصات فروشنده در تنظیمات کامل باشد.
- **شماره‌ی فاکتور رسمی** که امروز در کارتابل (`refNo`) دستی ثبت می‌شود، در حالت
  داخلی از شماره‌ی خود فاکتور پر می‌شود.

---

## ۱۱. گزارش‌ها

همه با فیلتر بازه‌ی تاریخ شمسی (`DateField`)، خروجی اکسل و چاپ/PDF.

| گزارش | محتوا |
|---|---|
| **داشبورد** | موجودی نقد و بانک؛ طلب از مشتریان (سررسید گذشته جدا)؛ بدهی به تأمین‌کنندگان؛ چک‌های ۷ روز آینده (دریافتی/صادره)؛ فروش، سود ناخالص و هزینه‌ی ماه با نمودار روزانه؛ کالای زیر نقطه‌ی سفارش و منفی؛ «کارهای مانده» (رویداد مسدود، فاکتور بی‌پرداخت سررسیدگذشته) |
| سود و زیان | فروش − برگشت و تخفیف − بهای تمام‌شده = سود ناخالص − هزینه‌ها = سود خالص؛ مقایسه با دوره‌ی قبل |
| ترازنامه | دارایی، بدهی، حقوق صاحبان سرمایه در یک تاریخ |
| تراز آزمایشی | دو، چهار و شش ستونی؛ سطح کل/معین/تفصیلی |
| دفتر کل و معین | گردش یک حساب با مانده‌ی جاری؛ کلیک روی ردیف → سند → منبع |
| صورت‌حساب شخص | گردش و مانده؛ ارسال PDF/لینک برای مشتری |
| سنی بدهی | طلب از مشتریان در ستون‌های ۰–۳۰، ۳۱–۶۰، ۶۱–۹۰، ۹۰+ روز |
| گردش خزانه | ورود و خروج هر صندوق/بانک |
| گزارش چک‌ها | بر اساس وضعیت و سررسید |
| ارزش موجودی | تعداد × میانگین، به تفکیک انبار و دسته |
| کاردکس کالا | ورود/خروج/مانده با بها |
| سود هر کالا/دسته/کانال | فروش، بهای تمام‌شده، سود؛ بازارگاه‌ها به‌عنوان کانال |
| ارزش افزوده (فصلی) | مالیات فروش − مالیات خرید؛ فهرست فاکتورهای مشمول |
| هزینه‌ها | به تفکیک سرفصل با نمودار |

محاسبه‌ی گزارش همیشه از `AccVoucherLine` است (بدون `isVoid`) — هیچ گزارشی عدد را
از جدول فاکتور یا سفارش جمع نمی‌زند، تا گزارش‌ها هیچ‌وقت با هم تناقض نداشته باشند.
(استثنا: گزارش‌های مقداری کالا از کاردکس.)

---

## ۱۲. حالت حسابان — بهبودها (فاز ۱) — ❌ لغو شد

> این بخش فقط برای سابقه مانده. تصمیم ۱۴: روی حالت حسابان سرمایه‌گذاری نمی‌شود؛
> اتصال فعلی همان‌طور که هست کار می‌کند تا مای مونتا منتقل شود. جدول زیر هنوز
> برای **ابزار انتقال** (فاز ۸) مفید است، چون نشان می‌دهد هر مفهوم در API حسابان کجاست.

| رویداد | API | نکته |
|---|---|---|
| `SALE_ISSUED` | `SalesInvoice/AddInvoice` | تخفیف هر قلم در `discount`؛ تخفیف فاکتور به نسبت بین اقلام پخش می‌شود؛ **کرایه** چون مدل API اضافات ندارد به‌صورت قلم خدمتی با کد ثابت (مثلاً `SHIPPING`) که یک بار با `Product/Add` در حسابان ساخته می‌شود — **در محیط واقعی آزموده شود** |
| پرداخت فاکتور | `payment.internetPaymentId` برای پرداخت آنلاین؛ بقیه با `Document/Add` (بدهکار بانک/صندوق، بستانکار حساب مشتری) | حساب‌ها از `Account/GetAccountsByFullCodes` با کدهایی که کاربر در فرم اتصال انتخاب می‌کند؛ حساب مشتری با `Account/Search` پس از ثبت فاکتور — **آزمون لازم** |
| `SALE_VOIDED` | `SalesInvoice/CancelInvoices` با همان GUID قطعی | GUID امروز در `invoicing.ts` قطعی ساخته می‌شود؛ همان حفظ شود |
| `SALE_RETURNED` | `SalesReturnInvoice/AddInvoice` با `referenceInvoiceId` | مبلغ هر قلم = مبلغ فاکتور مرجع |
| `PURCHASE_RECORDED` | `PurchaseInvoice/AddInvoice` | `seller` از `StaffSupplier`؛ `transportCost`؛ پرداخت ندارد → اگر نقدی خریده شد `Document/Add` |
| `COMMISSION_PAID`، قسط، تسویه‌ی بازارگاه | `Document/Add` | حساب‌های مقصد در فرم اتصال نگاشت می‌شوند |
| `STOCK_TRANSFERRED` | `StorageTransfer/AddStorageTransfer` | فقط اگر چند انبار نگاشت شده باشد |

- `IntegOrder` و صفحه‌ی `/admin/integration/orders` باقی می‌مانند (نمای بازارگاه)،
  ولی ارسال به حسابان از صف `AccEvent` انجام می‌شود. تنظیمات فعلی (`autoInvoiceEnabled`،
  `invoiceMode` AUTO/MANUAL، `autoInvoiceSince`، `invoiceStorageId`) به همان معنا
  منتقل می‌شوند — رفتار کاربران فعلی حسابان عوض نمی‌شود (تله‌ی ۱).
- قبل از هر ثبت، `Inquiry` با شناسه‌ی یکتا — همان الگوی `salesInvoiceExists`.

---

## ۱۳. رابط کاربری

### ۱۳.۱ نقشه‌ی صفحه‌ها — `/admin/accounting`

| مسیر | صفحه | نمای حسابدار؟ |
|---|---|---|
| `/admin/accounting` | داشبورد | — |
| `/sales` | فاکتورهای فروش — تب‌ها: فاکتور، پیش‌فاکتور، برگشتی | — |
| `/sales/new`، `/sales/[id]` | فرم و جزئیات + چاپ | — |
| `/purchases` | فاکتورهای خرید و برگشت از خرید | — |
| `/parties`، `/parties/[id]` | اشخاص؛ صفحه‌ی شخص = صورت‌حساب + فاکتورها + چک‌ها | — |
| `/treasury`، `/treasury/[id]` | صندوق و بانک‌ها با مانده؛ گردش هر کدام | — |
| `/money/new?kind=receipt|payment|expense|transfer` | فرم‌های سریع | — |
| `/cheques` | چک‌ها — تب دریافتی/صادره، فیلتر وضعیت و سررسید | — |
| `/expenses` | هزینه‌ها | — |
| `/inventory` | موجودی، کاردکس، حواله، انبارگردانی، انبارها | — |
| `/reports/*` | گزارش‌ها (بخش ۱۱) | — |
| `/vouchers`، `/vouchers/[id]`، `/vouchers/new` | اسناد و سند دستی | ✅ |
| `/accounts` | سرفصل حساب‌ها (درخت) | ✅ |
| `/settings` | حالت، سال مالی، تاریخ قفل، مالیات، اطلاعات فروشنده و مهر، شماره‌گذاری، خزانه‌ها | — |
| `/migrate` | ویزارد انتقال از حسابان | — |
| `/events` | صف رویداد (هر دو حالت) — مسدودها و تلاش دوباره | — |

### ۱۳.۲ اصول

1. **زبان کسب‌وکار، نه حسابداری.** «دریافت از مشتری»، «پرداخت به تأمین‌کننده»،
   «طلب»، «بدهی». کلمه‌ی «سند» فقط در نمای حسابدار. هر ثبت یک جمله‌ی خلاصه
   نشان می‌دهد: «۲٬۵۰۰٬۰۰۰ تومان از رضا احمدی — کارت‌به‌کارت به ملت جاری».
2. **مبلغ:** فیلد با جداکننده‌ی هزارگان هنگام تایپ، ارقام فارسی، پسوند «تومان»،
   و **مبلغ به حروف** زیر فیلد («دو میلیون و پانصد هزار تومان») — رایج‌ترین
   جلوگیری از صفر اضافه. میانبر «هزار» (`k`) و «میلیون» (`m`).
3. **تاریخ:** `JalaliDatePicker` با پیش‌فرض امروز و دکمه‌های «دیروز/امروز».
4. **انتخاب شخص:** جستجو با نام یا موبایل، مانده‌ی فعلی کنار نام، و «ساخت شخص تازه»
   داخل همان انتخابگر بدون ترک فرم.
5. **هیچ ثبت برگشت‌ناپذیر بی‌صدا نیست:** ابطال و برگشت با تأیید و دلیل؛ همه در
   `ActivityLog` با diff.
6. **وضعیت خالی آموزنده:** هر فهرست خالی یک دکمه‌ی عمل و یک جمله‌ی توضیح دارد.
7. **راهنمای «؟» در هر صفحه و هر بخش** (تصمیم ۱۶): `HelpButton` کنار عنوان صفحه، و
   برای بخش‌های درون صفحه (مثلاً کارت «نیازمند رسیدگی»، فرم چک) نسخه‌ی `size="sm"`
   کنار عنوان همان بخش. متن به زبان کاربر، بدون نام جدول یا فیلد.

### ۱۳.۳ موبایل

- نوار پایین مخصوص حسابداری: **خانه · فاکتورها · ➕ · اشخاص · بیشتر**.
- دکمه‌ی ➕ یک bottom sheet با شش کار پرتکرار باز می‌کند: دریافت، پرداخت، هزینه،
  فاکتور فروش، فاکتور خرید، چک.
- فهرست‌ها کارتی: نام شخص، مبلغ درشت، وضعیت با رنگ، تاریخ نسبی؛ لمس = جزئیات،
  کشیدن به چپ = عمل سریع (ثبت دریافت برای فاکتور، وصول چک).
- فرم‌ها تمام‌صفحه با **نوار ثابت پایین** (جمع + ذخیره)؛ کیبورد عددی برای مبلغ
  (`inputmode="numeric"`)؛ اقلام فاکتور به‌صورت کارت‌های قابل ویرایش در sheet.
- فیلترها در bottom sheet؛ فیلتر فعال به‌صورت chip بالای فهرست.
- داشبورد: کارت‌های افقی قابل اسکرول (نقد، طلب، بدهی، چک این هفته) + یک نمودار.

### ۱۳.۴ دسکتاپ

- فهرست + پنل جزئیات کناری (بدون ترک فهرست).
- جدول متراکم با مرتب‌سازی، ستون‌های قابل انتخاب، جمع پایین جدول.
- ورود اقلام فاکتور در جدول با Tab/Enter مثل اکسل؛ بارکدخوان مستقیم در فیلد جستجو.
- میانبرها: `N` ثبت تازه، `/` جستجو، `Ctrl+Enter` ذخیره، `P` چاپ؛ فهرست میانبرها با `?`.

### ۱۳.۵ طراحی

از اجزای موجود پنل (`components/admin/`) و توکن‌های رنگ همان پنل استفاده می‌شود؛
حسابداری ظاهر جداگانه نمی‌سازد. رنگ‌های معنایی ثابت: سبز = دریافت/طلب وصول‌شده،
قرمز = بدهی/سررسید گذشته، کهربایی = نزدیک سررسید. نمودارها طبق راهنمای موجود
گزارش‌های پنل.

---

## ۱۴. مجوزها و بخش پنل

گروه تازه‌ی `accounting` در `lib/permissions.ts`:

| کلید | برچسب |
|---|---|
| `ACC_VIEW` | دیدن داشبورد و فهرست‌های حسابداری |
| `ACC_PARTY_MANAGE` | افزودن و ویرایش اشخاص ✅ (فاز ۲، به فهرست اضافه شد) |
| `ACC_SALES` | ثبت و ویرایش فاکتور فروش و پیش‌فاکتور |
| `ACC_PURCHASE` | ثبت فاکتور خرید |
| `ACC_TREASURY` | ثبت دریافت، پرداخت و انتقال |
| `ACC_CHEQUE` | مدیریت چک‌ها |
| `ACC_EXPENSE` | ثبت هزینه ✅ (فاز ۶) |
| `ACC_INVENTORY` | حواله و انبارگردانی |
| `ACC_COST_VIEW` | دیدن بهای تمام‌شده و سود (hint: «حساس‌ترین عدد کسب‌وکار») |
| `ACC_VOUCHER` | نمای حسابدار: سند دستی و سرفصل |
| `ACC_REPORTS` | گزارش‌های مالی |
| `ACC_SETTINGS` | حالت، سال مالی، تاریخ قفل، سرفصل |
| `ACC_MIGRATE` | ویزارد انتقال |

- بخش `accounting` در `lib/admin-sections.ts` با پیشوندهای `/admin/accounting` و
  `/api/admin/accounting`؛ هر route مجوز دقیق را با `requirePermission` چک می‌کند.
- نقش پیش‌فرض «حسابدار» در `scripts/seed-staff-roles.ts`.
- گروه منوی «حسابداری» در `components/admin/nav.tsx`؛ زیرمنو بر اساس حالت (بخش ۴.۴).

---

## ۱۵. انتقال از حسابان (فاز ۸) — فقط مای مونتا، آخر کار

> تصمیم ۱۵: اول حسابداری پنل کامل می‌شود. بعد، برای مای مونتا، هرکدام از اکسل
> (خروجی خود حسابان) یا API که آن موقع ساده‌تر بود. لازم نیست ویزارد عمومی و
> قابل استفاده برای همه ساخته شود؛ یک ابزار دقیق برای یک کسب‌وکار کافی است، به
> شرط گزارش تطبیق. طرح زیر نقطه‌ی شروع است، نه تعهد.

مراحل، هرکدام قابل توقف و ادامه (`AccImportRun.cursor`) و idempotent (`AccImportMap`):

| # | مرحله | منبع | نکته |
|---|---|---|---|
| ۱ | انتخاب سال مالی مقصد و تاریخ شروع | — | معمولاً اول سال جاری |
| ۲ | سرفصل حساب‌ها | `Account/Search` (پیمایش `searchType`ها) | نگاشت با کلیدهای سیستمی: پیشنهاد خودکار با نام/کد + تأیید کاربر |
| ۳ | اشخاص | `Account/Search` (حساب‌های تفصیلی شخص) | تطبیق با `User` از روی موبایل و با `StaffSupplier` از روی نام نرمال |
| ۴ | انبارها | `Storage/GetAllStorages` | → `AccWarehouse` |
| ۵ | کالاها | `Product/PRODUCTS` | تطبیق با `Product` از نگاشت موجود `IntegMappingLink` (hesaban)؛ بقیه پیشنهاد ساخت |
| ۶ | موجودی و بها | `GetProductStock` هر انبار + `oneAmount` | حرکت کاردکس `OPENING` در تاریخ شروع |
| ۷ | فاکتورها | `SalesInvoice`، `PurchaseInvoice`، برگشتی‌ها — `GetInvoiceById/{id}` با **پیمایش سریال از ۱** تا N خطای پیاپی | API فهرست ندارد؛ در پس‌زمینه با نوار پیشرفت و محدودیت نرخ. فقط سال جاری در دفتر ثبت می‌شود؛ قبلی‌ها فقط بایگانی (نمایش) |
| ۸ | اسناد | `Document/GetDocumentById` با پیمایش سریال | اسناد سال جاری با حساب‌های نگاشت‌شده بازسازی می‌شوند |
| ۹ | چک‌ها | چک‌های داخل فاکتورها (`checkReceipts`) + **اکسل** | API چک ندارد |
| ۱۰ | مانده‌ی افتتاحیه | از اسناد واردشده؛ یا ورود دستی/اکسل تراز | برای «شروع تازه از اول سال» |
| ۱۱ | **گزارش تطبیق** | — | تراز آزمایشی ما کنار عددهای حسابان (کاربر از حسابان وارد می‌کند یا اکسل تراز)؛ جمع موجودی و ارزش کالا؛ مانده‌ی هر شخص |
| ۱۲ | تأیید و تعویض حالت | — | `mode = INTERNAL`، `modeChangedAt`؛ رویدادهای PENDING حسابان تا این لحظه یا تخلیه یا صریحاً رها می‌شوند |

**راه‌های جایگزین:** ورود اکسل برای هر مرحله (قالب نمونه قابل دانلود)، و «شروع
تازه» که فقط کالا + موجودی + مانده‌ی افتتاحیه‌ی دستی می‌گیرد.

---

## ۱۶. مودیان (آماده‌سازی از فاز ۲، اتصال در فاز ۹)

از همین حالا ذخیره می‌شود: اطلاعات کامل فروشنده (`AccSettings`)، اسنپ‌شات خریدار
روی فاکتور، `taxCode` کالا (`AccProductCost`)، نرخ مالیات هر ردیف، و فیلدهای
`taxId`/`taxStatus` فاکتور. در فاز ۹: کلید خصوصی و گواهی کسب‌وکار، ساخت
صورت‌حساب الکترونیکی نوع ۱ (با اطلاعات خریدار) و نوع ۲ (بدون)، ارسال، استعلام،
ابطال و اصلاحی، و صف ارسال با همان الگوی `AccEvent`.

---

## ۱۷. سال مالی و بستن

- ساخت سال تازه: از تنظیمات؛ سال قبل تا بستن باز می‌ماند (ثبت در دو سال هم‌زمان مجاز).
- **بستن سال** (ویزارد):
  1. بررسی‌ها: رویداد مسدود نداشته باشد، پیش‌نویس نباشد، کاردکس منفی نباشد (هشدار).
  2. سند **اختتامیه‌ی حساب‌های موقت**: درآمد و هزینه → خلاصه‌ی سود و زیان → سود انباشته.
  3. سند **اختتامیه‌ی حساب‌های دائم** و **افتتاحیه‌ی** سال بعد با همان مانده‌ها (با تفصیلی).
  4. انتقال موجودی کالا به‌صورت حرکت `OPENING` در سال جدید.
  5. `status = CLOSED` و `lockDate = endDate`.
- بازگشایی سال بسته فقط با `ACC_SETTINGS` و حذف دو سند اختتامیه/افتتاحیه (با ثبت در لاگ).

---

## ۱۸. ساختار کد

```
lib/accounting/
  port.ts                 ← AccountingProvider، getProvider()
  events.ts               ← emitAccEvent(tx, …)، انواع رویداد
  dispatcher.ts           ← پردازش صف (از worker یکپارچه‌سازی صدا زده می‌شود)
  money.ts                ← تبدیل و قالب‌بندی تومان، به حروف
  providers/
    hesaban.ts            ← نگاشت رویداد → API حسابان (از HesabanAdapter استفاده می‌کند)
    internal.ts           ← نگاشت رویداد → سرویس‌های زیر
  ledger/
    post.ts               ← postVoucher / rebuildVoucher / reverseVoucher — تنها راه نوشتن سند
    accounts.ts           ← accountBySystemKey()، کش
    sequence.ts           ← nextNumber(yearId, key) با قفل ردیف
    fiscal-year.ts        ← سال مالی، تاریخ قفل، بستن
  inventory/
    stock.ts              ← applyMove، بازسازی میانگین، Product.stock
    transfer.ts, count.ts
  invoices/               ← صدور، ابطال، برگشت، پیش‌فاکتور، سند فاکتور
  treasury.ts             ← تعریف صندوق/بانک/کارتخوان/درگاه
  cash/                   ← docs.ts (دریافت، پرداخت، انتقال، هزینه)، allocation.ts، cheques.ts (ماشین وضعیت)، channel.ts (Payment سایت، قسط، پورسانت)، wallet.ts (سند کیف پول، اول دوره)، reminders.ts
  scheduler.ts            ← یادآوری سررسید چک (از instrumentation.ts)
  parties.ts              ← پیدا/ساختن شخص از User، StaffSupplier، بازارگاه
  reports/                ← هر گزارش یک فایل، همه از AccVoucherLine
  migrate/hesaban/        ← مراحل ویزارد
app/admin/accounting/…    ← بخش ۱۳.۱
app/api/admin/accounting/…
components/admin/accounting/  ← AmountInput، PartyPicker، InvoiceLinesEditor، QuickActionSheet، …
scripts/seed-accounting.ts   ← سرفصل پیش‌فرض، انبار پیش‌فرض، خزانه‌ی «صندوق»
```

نقاط اتصال به کد موجود (فقط `emitAccEvent` اضافه می‌شود):
`lib/order-stock.ts` (کسر موجودی)، `app/api/admin/orders/[id]/route.ts` (گذار وضعیت،
جایی که امروز `queueShopOrderForInvoicing` است)، دریافت سفارش بازارگاه در
`lib/integration/`، تأیید `Payment`، پرداخت قسط در کارتابل، «خرید شد» در کارتابل،
ساخت `StaffPayout`، `WalletTransaction`.

---

## ۱۹. تله‌ها — قبل از دست‌زدن به کد بخوان

1. **رفتار فعلی حسابان نشکند.** کاربران فعلی با `invoiceMode`، `autoInvoiceSince`
   و GUID قطعی (`deterministicUuid`) کار می‌کنند. انتقال به `AccEvent` باید همان
   GUID را تولید کند وگرنه فاکتورهای قبلی دوباره ثبت می‌شوند. در مهاجرت فاز ۰،
   ردیف‌های `IntegOrder` که `INVOICED` هستند رویداد `DONE` می‌گیرند، نه `PENDING`.
2. **ثبت با تاریخ گذشته بهای تمام‌شده را عوض می‌کند** (بخش ۸). بازسازی کاردکس
   باید در یک تراکنش، فقط بعد از `lockDate`، و با بازسازی سند COGS فاکتورهای
   متأثر باشد. هرگز `unitCost` یک خروج را بدون بازسازی سندش عوض نکن.
3. **`Product.stock` دو نویسنده نداشته باشد.** در حالت داخلی، sync موجودی حسابان
   (`lib/integration/core/inventory.ts`) باید برای منبع `hesaban` خاموش باشد و
   فقط `lib/accounting/inventory` بنویسد. push به بازارگاه‌ها همان مسیر فعلی را می‌رود.
4. **زمان فاکتور هر کانال.** سایت: کسر موجودی در گذار پرداخت. تلفنی و اعتباری:
   بررسی شود کسر موجودی کجاست — فاکتور باید دقیقاً همان‌جا صادر شود.
5. **شماره‌ی پیوسته بدون حفره.** `AccSequence` با `SELECT … FOR UPDATE` داخل
   تراکنش؛ نه `max(number)+1` (دو درخواست هم‌زمان یک شماره می‌گیرند).
6. **مانده ذخیره نمی‌شود.** `paidTotal` فاکتور تنها کش مجاز است و فقط در سرویس
   تخصیص نوشته می‌شود. هر کش دیگری که اضافه شد، اسکریپت بازسازی هم لازم دارد.
7. **BigInt در JSON.** پاسخ API‌ها از `lib/serialize.ts` رد شوند (همان تله‌ی
   BigInt در `StoreSettings`، کارتابل بخش ۱۸).
8. **دو عدد سود.** سود معامله‌ی کارتابل (`StaffDeal`) از قیمت خرید واردشده
   می‌آید و پورسانت به آن گره خورده؛ سود حسابداری از COGS کاردکس. یکی را با دیگری
   جایگزین نکن — کنار هم نشان بده و اختلاف را توضیح بده.
9. **مقدار اعشاری.** `qty` عمداً `Int` است. اگر کسب‌وکاری کالای وزنی/متری خواست،
   تغییر به `Decimal(18,3)` در `AccStock`، `AccStockMove`، `AccInvoiceLine` و
   تبدیل در مرز `Product.stock` لازم است — یک مهاجرت جدا، نه وصله.
10. **ساعت تهران.** همه‌ی تاریخ‌های مالی `@db.Date` و روز تهران‌اند؛ `new Date()`
    سرور UTC است. از کمکی‌های `docs/features/jalali-dates.md` استفاده شود.
11. **حسابان ریال است.** تبدیل ×۱۰ فقط در `providers/hesaban.ts` و `migrate/hesaban/`.
12. **گرد کردن مالیات.** مالیات هر ردیف گرد می‌شود؛ جمع فاکتور = جمع ردیف‌ها. اختلاف
    یک‌تومانی پخش تخفیف فاکتور به ردیف آخر داده می‌شود، نه حساب `ROUNDING`.
13. **متن بی‌رنگ در حالت تاریک.** پس‌زمینه‌ی پنل تیره است ولی رنگ پیش‌فرض متن
    نه؛ متنی که کلاس رنگ ندارد نامرئی می‌شود. `AccountingShell` رنگ پایه می‌دهد؛
    کامپوننتی که بیرون از این قاب رندر شود (portal) باید خودش رنگ بگیرد.
14. **`groupBy` روی `accountId`.** `accountId` اجباری است و `{ not: null }` را
    Prisma رد می‌کند؛ `balancesBy` فقط برای تفصیلی‌ها این شرط را می‌گذارد.
15. **`Product.stock` تفاضلی است، نه مطلق** — فروش سایت همچنان مستقیم از
    `Product.stock` کم می‌کند (`deductStockForOrderItems`) و بازارگاه از نگاشت؛
    نوشتن مطلق جمع کاردکس آن کسرها را پاک می‌کرد. هر حرکت، تفاضلش در انبار قابل
    فروش را به `Product.stock` اضافه می‌کند (هرگز زیر صفر). **استثنا: موجودی اول
    دوره** که مطلق است. فاکتورهایی که فروشگاه موجودی‌شان را خودش جابه‌جا کرده با
    `shopStock: false` ثبت می‌شوند (تصمیم ۱۷) — **ویرایش** همان فاکتور‌ها از فرم
    `shopStock` پیش‌فرض دارد و فقط تفاوت تعداد را به سایت می‌برد.
16. **بازساز سند با import ثبت می‌شود.** `registerCostRebuilder` در بدنه‌ی
    `inventory/docs.ts` صدا زده می‌شود؛ مسیری که کاردکس را تغییر می‌دهد باید
    `docs.ts` (و در فاز ۴ ماژول فاکتور) را import کرده باشد، وگرنه سند منبعِ
    متأثر بازسازی نمی‌شود.
17. **بعد از مهاجرت، dev server را دوباره راه بینداز.** کلاینت Prisma در حافظه‌ی
    `next dev` مدل‌های تازه را نمی‌شناسد (`Cannot read properties of undefined`).
18. **کسری و جبران.** خروجی بیش از موجودی، بخش بی‌پشتوانه را با آخرین بها برآورد
    می‌کند؛ اولین ورود بعدی (خرید/برگشت) همان واحدها را با بهای واقعی جبران و سند
    آن فروش را بازسازی می‌کند (`recalcProduct`). اگر پیش از شروع بازسازی موجودی
    منفی است، بازسازی به عقب می‌رود تا کسری‌ها دیده شوند — ولی نه پیش از تاریخ
    قفل؛ کسری پیش از قفل جبران نمی‌شود. `balanceValue` ردیف‌های بین فروش و خرید
    همان برآورد لحظه‌اند.
19. **برگشت از فروش با بهای خروج اولیه** — `unitCost` حرکت برگشت در لحظه‌ی ثبت از
    حرکت فروش مرجع خوانده می‌شود. اگر بعداً بهای آن فروش با خرید تاریخ‌گذشته عوض
    شود، برگشتی خودکار عوض نمی‌شود (با ویرایش و ذخیره‌ی برگشتی درست می‌شود).
20. **فاکتور بازارگاه بی‌قیمت** — اگر بازارگاه قیمت نفرستد، فاکتور با فی صفر صادر
    و در توضیحش نوشته می‌شود؛ ادمین ویرایشش می‌کند. ردیف بی‌نگاشت «مسدود» می‌ماند.
21. **رویداد یک بار است.** قیمت خریدی که بعد از «خرید شد» در کارتابل عوض شود، یا
    سفارشی که بعد از فاکتور ویرایش شود، فاکتور را عوض نمی‌کند؛ فاکتور را دستی
    ویرایش کنید. لغوِ لغو (برگرداندن سفارش لغوشده) فاکتور تازه نمی‌سازد.
22. **ترتیب رویداد پرداخت.** `emitPaymentsReceived` باید **بعد از**
    `deductStockForOrderItems` صدا زده شود تا روی aggregate سفارش پشت فاکتور فروش
    بیاید و به آن تخصیص یابد. اگر فاکتور هنوز نیست، دریافت بی‌تخصیص (پیش‌دریافت)
    ثبت می‌شود.
23. **`ALTER TYPE … ADD VALUE`** در مهاجرت فاز ۵ (`StaffNotificationType.ACC_CHEQUE`)
    — همان مقدار در همان تراکنش مهاجرت استفاده نمی‌شود؛ در مهاجرت‌های بعدی هم
    مقدار تازه‌ی enum را در همان مهاجرت به کار نبرید.
24. **یادآوری چک در پروسه‌ی سایت است** (`lib/accounting/scheduler.ts` از
    `instrumentation.ts`)، نه worker جدا؛ فقط در حالت داخلی. گذاری که چک را دوباره
    «نزد ما» یا «منتظر سررسید» می‌کند، `reminderSentAt` را پاک می‌کند.
25. **`pkill -f "next dev"` در یک فرمان bash، خود همان bash را هم می‌کشد** (الگو
    در خط فرمانش هست) و بقیه‌ی فرمان اجرا نمی‌شود — dev server را با PID ببندید.
26. **یک رویداد در هر aggregate در هر دور dispatcher.** سه شارژ کیف پول یک کاربر
    سه دور لازم دارد. در آزمون `dispatchAccEvents` را چند بار صدا بزنید؛ در سایت
    چرخه‌ی ۳۰ ثانیه‌ای و `kickAccDispatch` کافی است.
27. **تراکنش کیف پولی با `meta.orderId` سند نمی‌گیرد** (`voucherFromWalletTx`) —
    پرداخت سفارش است و از `Payment` ثبت می‌شود. شارژ دستی تازه‌ای که از جای دیگری
    بیاید باید `meta.purpose` بگذارد و `WALLET_ADJUSTED` بفرستد، وگرنه دفتر و
    `User.walletBalance` از هم جدا می‌شوند.
28. **کیف پولِ سفارش پرداخت‌نشده.** checkout کیف پول را همان لحظه‌ی ساخت سفارش کم
    می‌کند ولی `Payment` کیف پول فقط بعد از کسر موجودی (پرداخت کامل) به دفتر می‌رود.
    سفارشی که بخشش با کیف پول و بقیه‌اش هیچ‌وقت پرداخت نشد، کیف پول مشتری را کم
    کرده و دفتر هنوز بدهی را دارد — فروشگاه برگرداندن کیف پول سفارش رهاشده را ندارد.
    اختلاف با اول دوره‌ی کیف پول (دوباره ذخیره) یا شارژ دستی درست می‌شود.
29. **`AccError` حالا ۴۰۳ هم دارد** — `money/[id]` هزینه را با `ACC_EXPENSE` و بقیه
    را با `ACC_TREASURY` می‌نویسد.
30. **کارمزد روی دریافت فقط برای بازارگاه است** و `amount` ناخالص است، نه واریزی
    (برعکس انتقال وجه که `amount` رسیده به مقصد است و کارمزد اضافه از مبدأ کم می‌شود).

---

## ۲۰. فازبندی — با معیار «انجام شد»

### فاز ۰ — زیرساخت ✅ انجام شد (۲.۵۳.۰)

**آنچه ساخته شد:**

| چیز | کجا |
|---|---|
| مدل `AccSettings` (حالت) و `AccEvent` (صف) | مهاجرت `20260924120000_accounting_foundation` — سایتی که اتصال حسابان دارد با `HESABAN` شروع می‌کند، بقیه `NONE` |
| حالت و نگهبان حسابان | `lib/accounting/settings.ts` — `isHesabanInvoicingAllowed()` فقط در `INTERNAL` فاکتور حسابان را خاموش می‌کند؛ صدا زده‌شده در اول `processPendingInvoices` |
| ثبت رویداد | `lib/accounting/events.ts` — `emitAccEvent(input, tx?)`، `createMany + skipDuplicates` روی `dedupeKey` |
| قرارداد مصرف‌کننده | `lib/accounting/port.ts` — نتیجه‌ی `done` / `skipped` / `blocked` / `retry` |
| مصرف‌کننده‌ی داخلی | `lib/accounting/providers/internal.ts` — جدول `HANDLERS` خالی؛ نوع بی‌handler «مسدود» می‌شود، نه گم |
| پردازش صف | `lib/accounting/dispatcher.ts` — برداشت اتمیک با `FOR UPDATE SKIP LOCKED` + `lockedUntil`، ترتیب per-aggregate، backoff تا ۶۰ دقیقه، ۸ تلاش ← `FAILED`، بررسی دوباره‌ی مسدود هر ۱۰ دقیقه، غیرداخلی ← `SKIPPED` |
| اجرا | چرخه‌ی worker یکپارچه‌سازی (`lib/integration/core/worker.ts`)، بعد از فاکتور حسابان |
| API | `GET/PATCH /api/admin/accounting/settings`، `GET/POST /api/admin/accounting/events` (`retry`، `run`) |
| صفحه‌ها | `/admin/accounting` (انتخاب حالت، وضعیت اتصال حسابان، شمارش صف) و `/admin/accounting/events` (تب «نیازمند رسیدگی»، انتخاب و تلاش دوباره، اجرای فوری) — هر دو با `HelpButton` |
| مجوز و منو | `ACC_VIEW`، `ACC_SETTINGS`؛ بخش `accounting` در `lib/admin-sections.ts`؛ گروه «حسابداری» در `nav.tsx` |

**عمداً انجام نشد:**
- هیچ نقطه‌ای از فروشگاه هنوز `emitAccEvent` صدا نمی‌زند. هر رویداد **همراه با
  مصرف‌کننده‌اش** وصل می‌شود (فروش در فاز ۴، دریافت در ۵، …) تا payload دقیقاً
  همان باشد که مصرف‌کننده لازم دارد و رویداد بی‌مصرف در مسیر سفارش نیاید.
- حالت `INTERNAL` از پنل قابل انتخاب نیست (`SELECTABLE_MODES`)؛ با راه‌اندازی سال
  مالی در فاز ۲ باز می‌شود. خروج از `INTERNAL` از این فرم ممنوع است (۴۰۹).
- مسیر فاکتور حسابان (`invoicing.ts`، `IntegOrder`) به صف منتقل **نشد** (تصمیم ۱۴).

**آزمون (دیتابیس محلی):** رویداد تکراری ساخته نشد؛ در `INTERNAL` فروش مسدود شد و
برگشت همان سفارش پشتش ماند؛ فاکتور حسابان در `INTERNAL` خاموش شد؛ retry؛ در `NONE`
همه `SKIPPED` با قفل آزاد.

### فاز ۱ — ❌ لغو شد (تصمیم ۱۴)

### فاز ۲ — هسته‌ی دفتر ✅ انجام شد (۲.۵۴.۰)

**آنچه ساخته شد:**

| چیز | کجا |
|---|---|
| مدل‌ها | مهاجرت `20260925120000_accounting_ledger`: `AccFiscalYear`، `AccSequence`، `AccAccount`، `AccParty`، `AccTreasury`، `AccVoucher`، `AccVoucherLine`؛ `AccSettings` + سال جاری، تاریخ قفل، مالیات، اطلاعات فروشنده |
| سرفصل پیش‌فرض | `lib/accounting/chart.ts` (۶۶ ردیف، ۳۰ کلید سیستمی) — `seedDefaultChart` idempotent، ردیف موجود دست نمی‌خورد |
| شماره‌گذاری | `ledger/sequence.ts` — UPSERT اتمیک؛ کد شخص از ۱۰۰۱، کد خزانه از ۱۰۱، سند پیوسته در هر سال |
| سال مالی و قفل | `ledger/fiscal-year.ts` — `assertPostable` (سال باز + بعد از `lockDate`) |
| ثبت سند | `ledger/post.ts` — `postVoucher` / `rebuildVoucher` (سند خودکار، همان شماره) / `voidVoucher` (خودکار فقط `fromSource`) / `reverseVoucher` (فقط دستی) |
| مانده و گردش | `ledger/balances.ts` — `balancesBy`، `balanceOf`، `statement` با مانده‌ی ابتدا و جاری |
| اشخاص | `parties.ts` — اعتبارسنجی موبایل/کد ملی/کد پستی، جلوگیری از موبایل تکراری، `partyForUser` / `partyForSupplier` / `partyForPlatform` برای فاز ۴ |
| خزانه | `treasury.ts` — `TREASURY_ACCOUNT_KEY` نوع ← حساب سیستمی؛ فرم‌ها حساب نمی‌پرسند |
| راه‌اندازی و اول دوره | `setup.ts` — `activateInternal` (سرفصل + سال + صندوق + حالت، یک تراکنش)؛ `saveOpening` یک سند OPENING بازسازی‌شونده با اختلاف روی «تراز افتتاحیه» |
| API | `app/api/admin/accounting/`: `setup`، `summary`، `settings/general`، `years`، `accounts[/id]`، `parties[/id]`، `treasury[/id]`، `vouchers[/id]`، `opening` |
| UI مشترک | `components/admin/accounting/ui.tsx` (Card، Sheet پایین‌کش، Money، BalanceLabel، …)، `AmountInput` (جداکننده، به حروف، میانبر k/m)، `PartyPicker` (جستجو + ساخت درجا)، `AccountPicker`، `Statement` (گردش موبایل/دسکتاپ + بازه) |
| قاب | `app/admin/accounting/layout.tsx` ← `AccountingShell`: زبانه‌ها در دسکتاپ، نوار پایین + دکمه‌ی ➕ «ثبت سریع» در موبایل |
| صفحه‌ها | خانه (داشبورد داخلی + «شروع کار»)، `setup` (سه قدم)، `parties` و `parties/[id]`، `treasury` و `treasury/[id]`، `opening`، `vouchers`، `vouchers/new`، `vouchers/[id]`، `accounts` و `accounts/[id]`، `settings` (عمومی، کسب‌وکار با آپلود مهر و امضا، سال مالی) |
| راهنما | `components/admin/accounting/help.ts` — ۱۲ موضوع، در `help-content.ts` با `...ACCOUNTING_HELP` ادغام |
| مجوز | + `ACC_PARTY_MANAGE`، `ACC_VOUCHER` (بخش ۱۴) |

**تصمیم‌های این فاز:**
- حالت `INTERNAL` فقط از `setup` روشن می‌شود. خروج از آن تا وقتی **هیچ سند POSTED**
  نیست آزاد است (`canLeaveInternal`)؛ بعد از آن ۴۰۹.
- مانده‌ی اول دوره جدول ندارد؛ فرم از روی ردیف‌های همان سند OPENING پر می‌شود.
- اختلاف دارایی و بدهی اول دوره روی `OPENING_BALANCE` می‌نشیند، نه `CAPITAL`
  (سرمایه تفصیلی شخص/شریک می‌خواهد؛ حسابدار با سند دستی جابه‌جا می‌کند).
- رنگ متن پایه‌ی کل بخش در `AccountingShell` تعریف شده — متن بی‌رنگ در حالت
  تاریک نامرئی بود (تله‌ی ۱۳).

**آزمون:** `scratchpad/ledger-test.ts` (۳۱ بررسی: ناورداها، قفل، ابطال، معکوس،
افتتاحیه، شماره‌ی هم‌زمان، کاربر سایت) + آزمون API با کوکی ادمین (۱۱ بررسی) +
تصویر همه‌ی صفحه‌ها در ۱۴۰۰ و ۳۹۰ پیکسل.

### فاز ۳ — کالا و انبار ✅ انجام شد (۲.۵۵.۰)

**آنچه ساخته شد:**

| چیز | کجا |
|---|---|
| مدل‌ها | مهاجرت `20260926120000_accounting_inventory`: `AccWarehouse`، `AccStock`، `AccProductCost` (با `totalValue` و `lastCost`)، `AccStockMove`، `AccTransfer(+Line)`، `AccStockCount(+Line)`، enum `AccDocStatus` |
| موتور | `lib/accounting/inventory/stock.ts` — `applyMoves` / `removeMoves` (قفل advisory هر کالا، بازسازی از تاریخ تغییر، `AccStock`، `AccProductCost`، `Product.stock`)؛ `recalcProduct`؛ `registerCostRebuilder` برای بازسازی سند منابعی که بهای خروجشان عوض شد |
| روش بها | خروج به نسبت از **ارزش کل** (نه میانگین گرد‌شده)؛ موجودی منفی مجاز با آخرین بها (هشدار، نه منع)؛ حواله ارزش سراسری را تکان نمی‌دهد |
| اسناد انبار | `inventory/docs.ts` — انبار (پیش‌فرض، قابل فروش، غیرفعال فقط خالی)، حواله (بررسی موجودی مبدأ در تاریخ و امروز، ابطال با بررسی موجودی مقصد)، انبارگردانی (پیش‌نویس → ثبت با موجودی دفتری پایان روز شمارش → حرکت + سند کسری/اضافی روی `INVENTORY_ADJUSTMENT`)، موجودی اول دوره (سند OPENING روی `OPENING_BALANCE`) |
| نگهبان حسابان | `resyncStockFromAccounting` در حالت داخلی کاری نمی‌کند (تله‌ی ۳) |
| API | `app/api/admin/accounting/inventory/`: فهرست، `products` (انتخابگر + بارکد دقیق)، `[productId]` (کاردکس)، `warehouses[/id]`، `transfers[/id]`، `counts[/id]` (`PUT` شمارش، `fill`، `post`، `void`)، `opening` (`suggest=1` از موجودی سایت + قیمت خرید نگاشت) |
| رابط | `components/admin/accounting/inventory/*` و `ProductPicker` (اسکن بارکد = Enter)؛ صفحه‌ها زیر `/admin/accounting/inventory` با زبانه‌های موجودی، حواله‌ها، انبارگردانی، انبارها، اول دوره؛ برگه‌ی شمارش موبایل‌محور با + و − و ذخیره‌ی لحظه‌ای |
| مجوز | + `ACC_INVENTORY`، `ACC_COST_VIEW` — بها و ارزش سمت سرور حذف می‌شود |
| راهنما | + ۶ موضوع `accountingInventory` … `accountingOpeningInventory` |

**آزمون:** `scratchpad/inv-test.ts` (۱۹ بررسی — سناریوی بخش ۸: خرید ۱۰×۱۰۰ و ۱۰×۱۲۰،
فروش ۵ ← ۵۵۰؛ خرید با تاریخ گذشته ← ۶۵۰؛ موجودی منفی؛ حواله و ابطالش؛ انبارگردانی و
بازسازی خودکار سندش بعد از خرید با تاریخ گذشته؛ قفل؛ اول دوره‌ی مطلق) + آزمون API
(۱۰ بررسی) + تصویر صفحه‌ها در دسکتاپ و موبایل.

### فاز ۴ — فاکتورها ✅ انجام شد (۲.۵۶.۰)

**آنچه ساخته شد:**

| چیز | کجا |
|---|---|
| مدل‌ها | مهاجرت `20260927120000_accounting_invoices`: `AccInvoice`، `AccInvoiceLine`، enumهای `AccInvoiceType`/`AccInvoiceStatus`/`AccProformaState`/`AccChannel`؛ `AccSettings.vatEnabled`. جدول `AccInvoiceCharge` ساخته **نشد** — اضافات یک عدد (`additions` + `additionsTitle`) است: فروش ← درآمد ارسال، خرید ← پخش روی بهای کالا |
| محاسبه | `invoices/calc.ts` (سمت مرورگر هم) — تخفیف ردیف، پخش تخفیف فاکتور با باقی به ردیف آخر، مالیات هر ردیف گرد، حالت «قیمت با مالیات» |
| سرویس | `invoices/service.ts` — `saveInvoice` (پیش‌نویس/صدور/ویرایش صادرشده با همان شماره)، `voidInvoice`، `deleteDraft`، `convertProforma`، `buildInvoiceVoucher` (ثبت‌شده به‌عنوان بازساز `AccInvoice`)؛ شماره در هر سال و هر نوع (`invoice:<TYPE>`) |
| سندها | فروش: AR، تخفیفات فروش، فروش/حساب خدمت، درآمد ارسال، مالیات فروش، COGS/موجودی. برگشت از فروش: برعکس، کالا با بهای خروج اولیه. خرید: موجودی (بهای کاردکس) + «گرد کردن» برای خرده‌ی تقسیم + حساب هزینه‌ی ردیف خدمت + مالیات خرید / AP. برگشت از خرید: AP / مالیات، موجودی به میانگین روز، اختلاف به COGS |
| منابع خودکار | `invoices/channel.ts` + `providers/internal.ts`: `SALE_ISSUED` (سفارش سایت/تلفنی در `deductStockForOrderItems` — امضایش `orderId` گرفت؛ بازارگاه در `core/orders.ts` و وب‌هوک تپسی)، `SALE_VOIDED` (لغو پیش از ارسال؛ لغو بازارگاه)، `SALE_RETURNED` (لغو بعد از ارسال یا «مسترد شد» — همه‌ی اقلام مانده + کرایه)، `PURCHASE_RECORDED` (`costFromPurchaseTask` کارتابل). `AccError` در handler ← «مسدود» |
| سفارش سایت | خریدار = `partyForUser`؛ فی = قیمت مؤثر؛ تخفیف فاکتور = `discountTotal − کیف پول` (کیف پول روش پرداخت است، فاز ۶)؛ کرایه = `shippingFee`؛ همیشه «قیمت با مالیات». کانال `PHONE` اگر `createdByStaffId` دارد |
| اجرای فوری صف | `events.ts` — `emitAccEventSafe` + `kickAccDispatch` (بعد از commit، یک بار در ۳۰۰ میلی‌ثانیه) |
| کاردکس | `recalcProduct` بازنویسی شد: جبران کسری (تله‌ی ۱۸)؛ `applyMoves`/`removeMoves` گزینه‌ی `shopStock` گرفتند |
| API | `invoices` (GET `side`/`type`/`status`/`q`/`partyId`/بازه، POST)، `invoices/[id]` (GET با `print=1`، PUT، POST `issue`/`void`/`convert`، DELETE پیش‌نویس)، `invoices/form`؛ `inventory/products?for=sales|purchase&partyId` قیمت پیش‌فرض (آخرین خرید از همان فروشنده) |
| رابط | `components/admin/accounting/invoices/`: `InvoicesList` (زبانه‌ی نوع، وضعیت، بازه، میانبر N)، `InvoiceEditor` (بارکد، ردیف خدمت، نوار ثابت پایین، Ctrl+Enter، برگشتی با سقف تعداد)، `InvoiceDetail` (ارتباط‌ها، سود ناخالص، میانبر P)، `InvoicePrint` (سه قالب؛ مسیر `/print` بی‌قاب در `app/admin/layout.tsx` و `AccountingShell`) |
| صفحه‌ها | `/admin/accounting/sales`، `/purchases`، `/invoices/new?type=|ref=`، `/invoices/[id]`، `/[id]/edit`، `/[id]/print?tpl=shop|official|receipt` |
| جاهای دیگر | زبانه‌های فروش و خرید و نوار پایین موبایل «خانه · فروش · ➕ · اشخاص · بیشتر»؛ ثبت سریع فاکتور فروش/خرید/پیش‌فاکتور؛ فاکتورهای هر شخص در صفحه‌ی شخص؛ ردیف گردش و سند ← فاکتور؛ کلید «مشمول ارزش افزوده» در تنظیمات |
| مجوز | + `ACC_SALES`، `ACC_PURCHASE`؛ انتخابگر شخص/کالا/حساب/انبار برای همین دو هم باز شد، و ساخت شخص درجا |
| راهنما | + `accountingSales`، `accountingPurchases`، `accountingInvoiceForm`، `accountingInvoice`، `accountingVat`؛ `accountingQuick` به‌روز |

**عمداً انجام نشد:**
- دریافت/پرداخت و تخصیص به فاکتور (`paidTotal`) — فاز ۵. پرداخت آنلاین و کیف پول هنوز طلب را کم نمی‌کنند؛ طلب هر مشتری سایت تا فاز ۵ و ۶ بالا می‌ماند.
- `refNo` کار کارتابل از شماره‌ی فاکتور پر نمی‌شود (بخش ۱۰) — هنوز دستی.
- ارسال لینک/PDF پیش‌فاکتور برای مشتری؛ فعلاً چاپ و «ذخیره به PDF».
- ویرایش فاکتور از روی تغییر بعدی سفارش (تله‌ی ۲۱).

**آزمون:** `scratchpad/invoice-test.ts` (۳۳ بررسی: خرید با کرایه، فروش با تخفیف و کرایه، برگشت و سقفش، ویرایش با همان شماره، خرید تاریخ‌گذشته و بازسازی بها، کسری و جبران دراپ‌شیپ، مالیات روشن/خاموش، پیش‌نویس، پیش‌فاکتور و تبدیل و ابطال، برگشت از خرید، سفارش سایت از راه رویداد با کیف پول، لغو و مرجوعی، قفل، تراز آزمایشی صفر، حساب موجودی = ارزش کاردکس) + `channel-test.ts` (کارتابل و بازارگاه، ۶ بررسی) + آزمون فاز ۳ دوباره (۱۹ بررسی) + آزمون API (۲۱ بررسی) + تصویر صفحه‌ها در دسکتاپ و موبایل.

### فاز ۵ — خزانه و چک ✅ انجام شد (۲.۵۷.۰)

**آنچه ساخته شد:**

| چیز | کجا |
|---|---|
| مدل‌ها | مهاجرت `20260928120000_accounting_treasury`: `AccMoneyDoc` (RECEIPT/PAYMENT/TRANSFER؛ `EXPENSE` با فاز ۶)، `AccMoneyItem`، `AccAllocation`، `AccCheque`، `AccChequeEvent`، `AccChequeBook`؛ `StaffNotificationType.ACC_CHEQUE`. `AccMoneyLine` (هزینه) ساخته **نشد** — فاز ۶ |
| تخصیص | `cash/allocation.ts` — مانده‌ی باز = جمع − برگشتی‌های معتبر − تخصیص‌ها؛ `autoAllocate` از قدیمی‌ترین؛ `recalcPaid` تنها نویسنده‌ی `paidTotal` |
| دریافت/پرداخت/انتقال | `cash/docs.ts` — `createMoneyDoc`، `voidMoneyDoc`، `allocateExisting`؛ روش ↔ نوع خزانه (`METHOD_TREASURY`)؛ شماره در هر سال و نوع (`money:<KIND>`) |
| چک | `cash/cheques.ts` — جدول `RULES` هر گذار با ردیف‌های سندش (بخش ۹.۲ + «وصول مستقیم»، «خرج‌شده پاس شد»)؛ `createCheque`/`endorseCheque` فقط از `docs.ts`؛ `moveCheque`، `undoLastMove`؛ دسته‌چک و `nextChequeSerial` |
| دریافت خودکار | `cash/channel.ts` + `PAYMENT_RECEIVED` در `providers/internal.ts`؛ `emitPaymentsReceived(orderId)` در callback درگاه، تأیید دستی ادمین و ثبت سفارش تلفنی پرداخت‌شده |
| یادآوری | `cash/reminders.ts` + `lib/accounting/scheduler.ts` (هر ۱۰ دقیقه، حالت داخلی): اعلان به دارندگان `ACC_CHEQUE` و کار «پیگیری پرداخت» (`payment-followup`) اگر کارتابل روشن است |
| API | `money` (GET/POST)، `money/[id]` (GET، POST `void`/`allocate`)، `money/form`، `cheques` (نماهای open/week/overdue/bounced/closed/all)، `cheques/[id]` (POST `move`/`undo`/`sayad`)، `cheques/books`؛ `summary` + چک‌های ۷ روز؛ `invoices/[id]` + `settlement` |
| رابط | `components/admin/accounting/cash/`: `MoneyForm` (چند روش، چک تازه، خرج چک، تخصیص، جمله‌ی خلاصه)، `MoneyList`، `MoneyDetail` (تغییر تخصیص، ابطال)، `ChequesList` (+ دسته‌چک‌ها)، `ChequeDetail` (کار بعدی، تاریخچه با سند، صیاد) |
| صفحه‌ها | `/admin/accounting/money`، `/money/new?kind=&partyId=&invoiceId=`، `/money/[id]`، `/cheques`، `/cheques/[id]` |
| جاهای دیگر | زبانه‌های «دریافت و پرداخت» و «چک‌ها»؛ ثبت سریع دریافت/پرداخت/انتقال/چک؛ صفحه‌ی فاکتور: دریافت‌شده/برگشتی/مانده و «ثبت دریافت»؛ صفحه‌ی شخص: دریافت و پرداخت؛ خانه: چک‌های ۷ روز |
| مجوز | + `ACC_TREASURY`، `ACC_CHEQUE` |
| راهنما | + `accountingMoney`، `accountingMoneyForm`، `accountingCheques`، `accountingCheque` |

**عمداً انجام نشد:** ویرایش دریافت/پرداخت (تصمیم ۱۹)؛ استرداد خودکار (تصمیم ۲۰)؛ کیف پول و اقساط (فاز ۶)؛ پیامک یادآوری چک به مشتری.

**آزمون:** `scratchpad/cash-test.ts` (۲۵ بررسی: دریافت نقد+چک با تخصیص، قفل ابطال فاکتور پرداخت‌شده، گذار غیرمجاز، واگذاری/وصول/برگرداندن/برگشت/دوباره نزد ما، پرداخت با خرج چک + چک دسته‌چک، ابطال پرداخت با چک پاس‌شده رد و بعد از برگرداندن قبول، انتقال با کارمزد، تخصیص بعدی و سقفش، دریافت خودکار درگاه، درگاه ناشناخته مسدود، یادآوری یک‌باره، تراز) + آزمون API (۱۹ بررسی) + تصویر صفحه‌ها در دسکتاپ و موبایل.

### فاز ۶ — هزینه و اتصال بخش‌های موجود ✅ انجام شد (۲.۵۸.۰)

**آنچه ساخته شد:**

| چیز | کجا |
|---|---|
| مدل‌ها | مهاجرت `20260929120000_accounting_expenses`: `AccMoneyKind.EXPENSE`، `AccMoneyMethod.WALLET`، `AccSource.WALLET`، جدول `AccMoneyLine`، `AccMoneyDoc.payable` و `vatAmount`، `AccSettings.installmentTreasuryId` و `payoutTreasuryId`؛ حساب `8105` «هدیه و جبران به مشتری» (`CUSTOMER_REWARD`) برای سایت‌هایی که سرفصل دارند (در `chart.ts` هم) |
| هزینه | `cash/docs.ts` — `createMoneyDoc` با `lines` و `vatAmount`: فقط معین فعال کلاس `EXPENSE` جز `COGS`/`INVENTORY_ADJUSTMENT`؛ تفصیلی شخص (حقوق، پورسانت) ← شخص الزامی؛ کسری پرداخت ← `AP` شخص (`payable`)؛ روش‌ها مثل پرداخت (چک صادره و خرج چک هم) |
| کیف پول | `cash/channel.ts` (`receiptFromPayment` با `WALLET`)، `cash/wallet.ts` (`voucherFromWalletTx`، `walletOpeningLines`)؛ `setup.ts` اول دوره با `wallets` |
| قسط و پورسانت | `receiptFromInstallment`، `expenseFromPayout` در `cash/channel.ts`؛ `partyForEmployee` در `parties.ts`؛ emit در `payInstallment` (`lib/worklist/credit.ts`) و `recordPayout` (`lib/worklist/commission.ts`) |
| بازارگاه | `fee` روی ردیف دریافت شخص `isMarketplace` (تصمیم ۲۴) |
| نقاط اتصال | `emitPaymentsReceived` کیف پول را دیگر رد نمی‌کند؛ checkout پرداخت کامل با کیف پول و `checkout/wallet-pay` (که موجودی را اصلاً کم نمی‌کرد — درست شد) بعد از کسر موجودی صدایش می‌زنند؛ `/api/admin/wallet` با `purpose` و `WALLET_ADJUSTED` |
| API | `expenses` (GET فهرست + تفکیک سرفصل + `unpaid`، POST)، `expenses/form`؛ `money/[id]` + `lines` و مجوز بر اساس نوع؛ `money/form` + `isMarketplace`؛ `settings/general` + صندوق‌های ثبت خودکار؛ `opening` + `walletPreview` |
| رابط | `cash/ExpenseForm.tsx` (سرفصل‌های پرکاربرد، چند ردیف، پرداخت شد/نسیه، چند روش، Ctrl+Enter)، `cash/ExpensesList.tsx` (نوار تفکیک سرفصل، نسیه‌دار)؛ `MoneyDetail` (بابت چه، نسیه + «پرداخت بدهی»، کیف پول، کارمزد)؛ `MoneyForm` (`?role=marketplace` و «کارمزد کسرشده»)؛ تنظیمات «ثبت خودکار»؛ اول دوره «کیف پول مشتریان»؛ `/admin/wallet` «بابت» |
| صفحه‌ها | `/admin/accounting/expenses`، `/expenses/new`؛ جزئیات همان `/money/[id]` |
| جاهای دیگر | زبانه و منوی «هزینه‌ها»؛ ثبت سریع «ثبت هزینه» و «تسویه‌ی بازارگاه»؛ برچسب رویدادهای تازه |
| مجوز | + `ACC_EXPENSE`؛ ساخت شخص درجا برای `ACC_TREASURY` و `ACC_EXPENSE` هم باز شد |
| راهنما | + `accountingExpenses`، `accountingExpenseForm`، `accountingAutoPosting`؛ به‌روز: `accountingMoney`، `accountingMoneyForm`، `accountingOpening`، `accountingSettings`، `accountingQuick` |

**عمداً انجام نشد:**
- صندوق در فرم «پرداخت شد» کارتابل و فرم پورسانت (تصمیم ۲۳).
- استرداد کیف پول سفارش رهاشده (تله‌ی ۲۸) — رفتار فروشگاه است، نه حسابداری.
- دریافت خودکار واریز بازارگاه از API (تصمیم ۲۴).
- گزارش هزینه‌ها از دفتر — فاز ۷.

**آزمون:** `scratchpad/expense-test.ts` (۲۵ بررسی: هزینه‌ی نقد چندسرفصلی، نسیه‌ی بخشی و کامل، نسیه بی‌شخص، حقوق بی‌شخص، بهای تمام‌شده رد، پرداخت بیش از هزینه، مالیات + چک صادره + ابطال، بازارگاه با کارمزد و رد کارمزد غیربازارگاه، شارژ طلب/هدیه/کسر کیف پول، سفارش کیف‌پولی و تسویه‌ی فاکتور، اول دوره‌ی کیف پول و ذخیره‌ی دوباره بی‌دو‌برابر، قسط مسدود بی‌تنظیم و ثبت بعد از تنظیم، پورسانت به نام کارمند و رد تسویه‌ی صفر، تراز) + `expense-api.mjs` (۲۲ بررسی API و صفحه‌ها) + شارژ واقعی از `/api/admin/wallet` + آزمون فاز ۵ دوباره + تصویر صفحه‌ها در دسکتاپ و موبایل.

### فاز ۷ — گزارش‌ها و داشبورد
- همه‌ی گزارش‌های بخش ۱۱ + خروجی اکسل/PDF؛ داشبورد موبایل و دسکتاپ.
- ✅ **وقتی:** ترازنامه تراز است (دارایی = بدهی + سرمایه + سود جاری) روی داده‌ی دمو.

### فاز ۸ — انتقال مای مونتا (آخر کار، تصمیم ۱۵)
- اکسل یا API (بخش ۱۵) + گزارش تطبیق + تعویض حالت؛ فقط برای مای مونتا.
- ✅ **وقتی:** روی یک کپی داده‌ی واقعی حسابان، تراز آزمایشی و ارزش موجودی با حسابان
  می‌خواند (یا اختلاف با دلیل گزارش می‌شود).

### فاز ۹ — بستن سال و مودیان
- ویزارد بستن سال (بخش ۱۷)؛ سپس اتصال سامانه‌ی مودیان (بخش ۱۶).

---

## ۲۱. سؤال‌های باز (در فاز مربوط پرسیده شوند)

| # | سؤال | فاز |
|---|---|---|
| ۱ | ~~کسر موجودی سفارش تلفنی/اعتباری کجاست؟~~ جواب: همه در `deductStockForOrderItems` — ثبت سفارش تلفنی پرداخت‌شده/اعتباری، تأیید ادمین، callback درگاه، کیف پول. فاکتور همان‌جا | ۴ ✅ |
| ۲ | کرایه به‌صورت قلم خدمتی در حسابان پذیرفته می‌شود؟ حساب مشتری بعد از `AddInvoice` با `Account/Search` پیدا می‌شود؟ (آزمون روی حساب دمو) | ۱ |
| ۳ | `AccountSearchType` (۴۳ مقدار بی‌نام در مستندات) — کدام مقدار اشخاص، کدام بانک‌ها؟ با آزمون روی حساب واقعی | ۸ |
| ۴ | موجودی منفی: هشدار (پیش‌فرض) یا منع برای بعضی کسب‌وکارها؟ | ۳ |
| ۵ | قالب فاکتور رسمی: قالب استاندارد سازمان امور مالیاتی کافی است یا لوگوی کسب‌وکار هم لازم است؟ | ۴ |
