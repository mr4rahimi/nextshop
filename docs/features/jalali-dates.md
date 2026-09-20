# تاریخ و تقویم شمسی در پنل

از نسخه‌ی ۲.۴۵.۰. همه‌ی ورودی‌های تاریخ پنل با یک تقویم شمسی دست‌ساز کار
می‌کنند، نه `<input type="date">` بومی مرورگر.

## چرا فقط تقویم عوض شد، نه متن تاریخ‌ها

**متن تاریخ‌ها از قبل شمسی بود.** همه‌ی جاهای پنل از
`toLocaleDateString("fa-IR")` استفاده می‌کنند و ICU برای `fa-IR` تقویم پیش‌فرض
را `persian` می‌گیرد — یعنی خروجی بدون هیچ تنظیم اضافه‌ای شمسی است:

```js
new Date().toLocaleDateString("fa-IR")            // ۱۴۰۵/۶/۲۹
new Intl.DateTimeFormat("fa-IR").resolvedOptions() // { calendar: "persian", … }
```

میلادی بودن فقط در **انتخابگر** تاریخ دیده می‌شد: `<input type="date">` و
`<input type="datetime-local">` تقویم بومی مرورگر را باز می‌کنند و آن همیشه
میلادی است. پس کار روی همان ۶ نقطه انجام شد.

> اگر جایی خواستید تاریخ را با فرمت خاصی چاپ کنید، `fa-IR` کافی است و نیازی به
> `u-ca-persian` نیست. فقط یادتان باشد `toLocaleDateString` در سمت کلاینت با
> **منطقه‌زمانی مرورگر** کار می‌کند؛ توابع `lib/club/jalali.ts` همیشه تهران‌اند.

## قرارداد مقدار — هیچ تغییری در API و دیتابیس نیست

`JalaliDatePicker` عمداً همان قالب مقدارِ اینپوت بومی را می‌گیرد و می‌دهد:

| حالت | قالب `value` | یعنی |
|------|--------------|------|
| `mode="date"` (پیش‌فرض) | `"YYYY-MM-DD"` | تاریخ **میلادی**، بدون منطقه‌زمانی |
| `mode="datetime"` | `"YYYY-MM-DDTHH:mm"` | میلادی، ساعت به **وقت تهران** |

یعنی جایگزینی یک `<input type="date">` با این کامپوننت هیچ تغییری در route،
اسکیما یا داده‌ی ذخیره‌شده لازم ندارد. شمسی فقط لایه‌ی نمایش است.

## فایل‌ها

| فایل | نقش |
|------|-----|
| `lib/club/jalali.ts` | تبدیل‌های شمسی ↔ میلادی و تهران؛ از قبل بود، کمکی‌های تقویم به آن اضافه شد |
| `components/admin/JalaliDatePicker.tsx` | خود تقویم |
| `components/admin/sms/ui.tsx` → `DateField` | نسخه‌ی برچسب‌دار، هم‌خانواده‌ی `Field` |

توابعی که در این نسخه به `lib/club/jalali.ts` اضافه شدند:

- `parseDateValue(v)` / `toDateValue(y, m, d)` — `"YYYY-MM-DD"` ↔ اجزای شمسی
- `formatDateValue(v, withTime?)` — متن خوانا برای نمایش روی دکمه‌ی تقویم
- `jalaliWeekday(date)` — شماره‌ی روز هفته با مبنای **شنبه = ۰** (برای پدکردن
  ابتدای جدول ماه)
- `JALALI_WEEKDAYS` — سرستون‌های جدول
- `isoToTehranLocal(iso)` / `tehranLocalToIso(v)` — لحظه‌ی ISO ↔ ساعت دیواری تهران

## کجاها استفاده شده

| صفحه | فیلد |
|------|------|
| `app/admin/integration/discounts/DiscountsClient.tsx` | تاریخ شروع و پایان تخفیف |
| `app/admin/guaranty/page.tsx` | تاریخ شروع گارانتی |
| `app/admin/club/coupons/page.tsx` | تاریخ انقضای کوپن (از طریق `DateField`) |
| `app/admin/widgets/[id]/page.tsx` | زمان پایان در ویجت‌های `AMAZING_DEALS` و `SPECIAL_OFFERS` (`mode="datetime"`) |

## نحوه‌ی استفاده

```tsx
import JalaliDatePicker from "@/components/admin/JalaliDatePicker";

<JalaliDatePicker value={startDate} onChange={setStartDate} className={inp} />

// با ساعت
<JalaliDatePicker mode="datetime" value={endsAt} onChange={setEndsAt} />
```

داخل فرم‌هایی که از کیت `components/admin/sms/ui.tsx` استفاده می‌کنند، به‌جای
`<Field type="date" …>` از `<DateField label="…" …>` استفاده کنید تا برچسب و
فاصله‌ها با بقیه‌ی فیلدها یکی باشد.

پراپ‌ها: `value`, `onChange`, `mode`, `className`, `disabled`, `placeholder`,
`title`, `clearable`. اگر کنار فیلد خودتان دکمه‌ی «پاک کردن» دارید،
`clearable={false}` بدهید تا ضربدر تکراری نیاید (مثل صفحه‌ی ویجت‌ها).

## تله‌ها

**۱. بدون کتابخانه‌ی خارجی.** تقویم دستی نوشته شده چون هر وابستگی تازه حجم
باندل پنل را بالا می‌برد — همان قرارداد `components/admin/sms/ui.tsx`. تبدیل
تاریخ روی `Intl` با تقویم `persian` سوار است، نه جدول دستی، پس سال کبیسه
خودبه‌خود درست است (اسفند ۱۴۰۳ سی روز، اسفند ۱۴۰۴ بیست‌ونه روز).

**۲. `fromJalali` جستجوی دودویی است.** برای پرکردن یک ماه (۳۱ بار صدا زدن)
کاملاً سریع است، ولی در حلقه‌ی سنگین سمت سرور از آن پرهیز کنید.

**۳. ساعت دیواری، نه UTC.** برای `mode="datetime"` حتماً از
`isoToTehranLocal`/`tehranLocalToIso` استفاده کنید. کد قبلی ویجت‌ها
`new Date(iso).toISOString().slice(0, 16)` می‌زد که UTC است و زمان پایان را
۳:۳۰ ساعت جابه‌جا نشان می‌داد.

**۴. مبنای روز هفته شنبه است، نه یکشنبه.** `jalaliWeekday` روی `getUTCDay()`
سوار است و `(getUTCDay() + 1) % 7` می‌دهد. `fromJalali` تاریخ را روی نیمه‌شب
UTC نرمال می‌کند، پس این محاسبه پایدار است — با `Date` ساخته‌شده از منطقه‌زمانی
محلی این فرض می‌شکند.
