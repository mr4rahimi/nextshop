# سرویس‌های خارجی — فهرست مرجع

هر چیزی که به یک سرویس بیرونی وصل می‌شود اینجا فهرست شده: مستندات، کد آداپتور،
فرم ادمین، و آدرس API. **برای پیدا کردن هر سرویس اول همین جدول را ببینید.**

---

## جدول کامل

| سرویس | نوع | مستندات | آدرس API | کد آداپتور | فرم ادمین |
|-------|-----|---------|-----------|-------------|-----------|
| **باسلام** | بازارگاه | [basalam.md](vendors/basalam.md) | `openapi.basalam.com`<br>`core.basalam.com` | `lib/integration/adapters/marketplace/basalam.adapter.ts` | `/admin/integration/connections/basalam` |
| **تپسی‌شاپ** | بازارگاه | [tapsi.md](vendors/tapsi.md) | `vendorgw.tapsi.shop/Web/Hub/vendors/v1` | `lib/integration/adapters/marketplace/tapsi.adapter.ts` | `/admin/integration/connections/tapsi_shop` |
| **اسنپ‌شاپ** | بازارگاه | [snapp.md](vendors/snapp.md) | `apix.snappshop.ir/automation/v1` | `lib/integration/adapters/marketplace/snappshop.adapter.ts` | `/admin/integration/connections/snappshop` |
| **ترب** | موتور مقایسه قیمت | [torob/](vendors/torob/) — ۱۰ سند | `api.torob.com/update/webhook/v1/` | `lib/torob-webhook.ts` | — |
| **حسابان وب** | حسابداری | [hesaban/](vendors/hesaban/) — OpenAPI | `app.hesabanweb.com` | `lib/integration/adapters/accounting/hesaban.adapter.ts` | `/admin/integration/connections/hesaban` |
| **ایران پیامک** | پیامک | [iranpayamak/](vendors/iranpayamak/) — ۵۰+ سند | `api.iranpayamak.com` | `lib/club/sms/providers/iranpayamak.ts` | تنظیمات باشگاه مشتریان |
| **آقای پرداخت** | درگاه پرداخت | [aghayepardakht.md](vendors/aghayepardakht.md) | — | — | — |

---

## جزئیات هر سرویس

### باسلام
سند `vendors/basalam.md` متن کامل مستندات رسمی است (شروع سریع، احراز هویت، SDK).
مسیر وب‌هوک‌ها: `app/api/integration/webhooks/`.

### تپسی‌شاپ
سند `vendors/tapsi.md` متن مستندات وندور است — **متن از PDF کپی شده و جاهایی
به‌هم‌ریخته است**؛ برای جزئیات دقیق به فرم ادمین و کد آداپتور رجوع کنید.
وب‌هوک: `app/api/integration/webhooks/tapsi`.

### اسنپ‌شاپ
مستندات رسمی در پروژه موجود نیست. `vendors/snapp.md` خلاصه‌ای است که از روی کد
آداپتور نوشته شده — منبع حقیقت خود آداپتور است.

### ترب
پوشه‌ی `vendors/torob/` مستندات کامل API است:

| فایل | محتوا |
|------|-------|
| `Readme.md` | معرفی کلی |
| `torob-api-token-guide.md` | دریافت توکن |
| `product_api_v1.md` / `v2` / `v3` | نسخه‌های API محصولات |
| `torob-v3.md` | جزئیات نسخه ۳ |
| `product_webhook.md` | وب‌هوک محصولات |
| `order_tracking_api.md` | رهگیری سفارش |
| `action_tracking_api.md` | رهگیری اکشن |

خروجی محصولات سایت: `app/(shop)/torob-products` و `app/api/torob`.

### حسابان وب
`vendors/hesaban/openapi.json` مشخصات OpenAPI است — **منبع حقیقت همین فایل است**.
`swagger-ui.html` فقط یک نمایشگر آفلاین است؛ در مرورگر بازش کنید تا API را مرور کنید.

### ایران پیامک
پوشه‌ی `vendors/iranpayamak/` بیش از ۵۰ سند دارد، هر endpoint یک فایل — ارسال پیامک،
مدیریت مخاطبین، گزارش‌ها، اعتبار حساب. برای پیدا کردن یک endpoint، نام فایل را
جستجو کنید (مثلاً `Send-SMS`، `Account-Balance`).

### آقای پرداخت
`vendors/aghayepardakht.md` مستندات درگاه است.
نمونه کد Node.js: `docs/integrations/samples/aqayepardakht-nodejs/`

---

## معماری یکپارچه‌سازی

سند [hub.md](hub.md) توضیح می‌دهد این اتصالات چطور کنار هم کار می‌کنند: مدل اتصال،
نگاشت محصولات، صف همگام‌سازی، قوانین قیمت، و مدیریت موجودی.

سند [orders-and-invoicing.md](orders-and-invoicing.md) مخصوص مسیر سفارش تا فاکتور
است: نام مشتری در فاکتور، وضعیت‌های `IntegOrder`، و **حفظ تخفیف هنگام تغییر قیمت**
در هر سه بازارگاه. قبل از دست زدن به قیمت یا فاکتور، حتماً بخوانیدش.

پنل: `/admin/integration`

---

## قرارداد

- مستندات خام ارائه‌دهنده **ویرایش نمی‌شوند** — همان‌طور که گرفته شده‌اند می‌مانند
- سرویس جدید؟ سند در `vendors/` + یک ردیف در جدول بالا
- نمونه‌کدها در `samples/`
- کل `docs/` در استقرار مستثناست و روی سرور نمی‌رود
