# گزارش عملکرد ادمین

مسیر پنل: **`/admin/reports`** (منوی «اصلی» ← گزارش عملکرد)

هدف: وقتی ادمینی می‌گوید «این محصول را گذاشتم و نیست» یا «عکس را عوض کردم ولی
عوض نشده»، به‌جای حدس‌زدن، رکورد دقیقِ کار او را نشان بدهیم — با زمان، نام
ادمین، و مقدار قبل و بعد هر فیلد.

## دو منبع داده

| منبع | چه می‌دهد | از کِی درست است |
|------|-----------|------------------|
| جدول `Product` (`createdAt`/`updatedAt`) | «چند محصول ساخته/بروز شد» | همیشه — حتی قبل از نصب این قابلیت |
| جدول `ActivityLog` | «چه کسی، چه چیزی، قبل ← بعد» | فقط از لحظه‌ی فعال‌شدن ثبت فعالیت |

به همین دلیل اگر `ActivityLog` خالی باشد، صفحه یک پیام راهنما نشان می‌دهد و
کارت‌های شمارش محصول همچنان عدد درست می‌دهند.

## مدل داده

`ActivityLog` در `prisma/schema.prisma`:

- `actorName` / `actorPhone` **کپی می‌شوند**، نه رابطه — تا حذف یا تغییر نام
  حساب ادمین گزارش‌های قدیمی را نشکند.
- `changes` یک آرایه‌ی JSON از `{ field, label, before, after, kind }` است.
  `kind` تعیین می‌کند رابط کاربری چطور رندر کند: `image` (دو تامبنیل کنار هم)،
  `images` (تفکیک اضافه‌شده/حذف‌شده)، `price`، `bool` یا `text`.
- ایندکس‌ها: `createdAt`، `(actorId, createdAt)`، `(entity, entityId)`،
  `(action, createdAt)`.

## ثبت فعالیت

`lib/activity.ts`:

```ts
logActivityAsync({
  action: "UPDATE",
  entity: "PRODUCT",
  entityId: product.id,
  entityTitle: product.title,
  summary: summarizeChanges(changes),
  changes,
});
```

- `logActivity` **هیچ‌وقت خطا پرتاب نمی‌کند** — ثبت گزارش نباید ذخیره‌ی محصول
  را بشکند.
- `diffFields(before, after, FIELD_SPEC)` فقط فیلدهایی را برمی‌گرداند که واقعاً
  عوض شده‌اند؛ `BigInt` و آرایه را درست مقایسه و سریالایز می‌کند.
- برای مسیرهایی که کوکی هنوز خوانده نمی‌شود (خودِ لحظه‌ی ورود) می‌توان
  `actor` را دستی پاس داد.

### مسیرهای ابزارگذاری‌شده

| مسیر | فعالیت |
|------|--------|
| `POST /api/admin/products` | `CREATE PRODUCT` |
| `PUT /api/admin/products/[id]` | `UPDATE PRODUCT` با diff کامل (شامل گالری) |
| `DELETE /api/admin/products/[id]` | `DELETE PRODUCT` |
| `POST /api/admin/products/bulk-price` \| `bulk-stock` \| `bulk-status` | `BULK_UPDATE PRODUCT` |
| `POST /api/admin/upload` | `UPLOAD MEDIA` |
| `DELETE /api/admin/media/[id]`، `POST /api/admin/media/bulk-delete` | `DELETE MEDIA` |
| `POST/PUT/DELETE /api/admin/categories` | `CREATE/UPDATE/DELETE CATEGORY` |
| `POST/PUT/DELETE /api/admin/brands` | `CREATE/UPDATE/DELETE BRAND` |
| `POST /api/admin/auth/login` | `LOGIN USER` |

> **بخش تازه‌ای به ادمین اضافه کردید؟** یک `logActivityAsync` با `entity`
> مناسب به مسیر نوشتنش اضافه کنید. اگر موجودیت جدید است، عضو `ActivityEntity`
> را در schema اضافه کنید و برچسب فارسی‌اش را به `ENTITY_LABELS` در
> `lib/reports.ts` **و** `components/admin/reports/ReportsClient.tsx` ببرید.

## API

| مسیر | کار |
|------|-----|
| `GET /api/admin/reports/summary?preset=` | KPIها، سری زمانی روزانه، تفکیک بر اساس نوع/بخش/ادمین |
| `GET /api/admin/reports/activity?...` | فهرست فعالیت با فیلتر و صفحه‌بندی cursor |
| `GET /api/admin/reports/timeline?entity=&entityId=` | تاریخچه‌ی یک آیتم + وضعیت فعلی‌اش |

`preset` یکی از `7d` / `30d` / `90d` / `month` است؛ یا `from`/`to` دستی.

## نمودارها

`components/admin/reports/charts.tsx` — همه SVG خالص، **بدون هیچ کتابخانه‌ی
نموداری**. سه کامپوننت: `MultiLineChart` (چندسری با راهنمای قابل خاموش/روشن)،
`DonutChart`، `HBarChart`. رنگ‌ها و حس بصری با `DashboardClient` یکی است.

## چرا این بخش ساخته شد

مسئول محصولات مهام‌پرینت گزارش داد که «تصویر بعضی محصولات خودکار از دست
می‌رود». بررسی سرور نشان داد **هیچ حذف خودکاری در کار نیست** — ۲۷۱۴ ارجاع
تصویر، صفر فایل گم‌شده روی دیسک، و مقایسه با بکاپ‌های سه هفته هیچ محصولی که
تصویرش را از دست داده باشد پیدا نکرد. اما سه خرابی خاموش در کد وجود داشت که
همان حس را می‌ساخت و در همین نسخه رفع شدند:

| خرابی | اثری که کاربر می‌دید | اصلاح |
|-------|----------------------|--------|
| `upload()` در فرم محصول `res.ok` را چک نمی‌کرد | آپلود ناموفق ⇒ `undefined` ⇒ عکس بی‌صدا از فرم محو می‌شد | پرتاب خطا + نوار خطای قرمز + پیام فارسی از سمت سرور |
| `deleteMany` بیرون از تراکنش، قبل از `update` | خطای ذخیره ⇒ گالری و مشخصات فنی برای همیشه رفته | همه‌چیز داخل `$transaction` |
| `body.x \|\| []` در مسیر `PUT` | یک PUT ناقص قیمت، موجودی و ویژگی‌ها را صفر می‌کرد | نوشتن فقط فیلدهای موجود در بدنه (`has()`/`pick()`) |

به همین دلیل گزارش عملکرد فقط یک داشبورد نیست: از این به بعد هر ادعایی درباره‌ی
«گذاشتم و نیست» با یک جستجو در دفتر فعالیت قابل راستی‌آزمایی است.

> نقص جداگانه‌ای که ربطی به کد ندارد: ۲۵ لوگوی برند و ۲ تصویر دسته در
> مهام‌پرینت به `/upload/brnd_*` و `/upload/ct_*` اشاره می‌کنند که اصلاً در
> مهاجرت از لاراول منتقل نشده‌اند. حذف نیست، از اول نیامده.

## نگهداری

`ActivityLog` بی‌نهایت رشد می‌کند. اگر روزی حجمش زیاد شد، رکوردهای قدیمی‌تر از
یک سال را می‌توان پاک کرد — ایندکس `createdAt` این کار را ارزان می‌کند.
