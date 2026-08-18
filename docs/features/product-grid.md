# تغییرات — چیدمان دوستونه‌ی محصولات + رفع باگ hydration ویجت‌های اسلایدری

**تاریخ:** ۱۴۰۵/۰۵/۲۳ (2026-08-14)
**نسخه:** 2.20.0

دو کار در این تغییر انجام شد:

| # | موضوع | فایل اصلی |
|---|---|---|
| [۱](#۱--رفع-باگ-hydration-در-چهار-ویجت-اسلایدری) | رفع باگ hydration در چهار ویجت اسلایدری | `ProductsByCategorySection`, `ProductsByBrandSection`, `LatestArticlesSection`, `Hero` |
| [۲](#۲--تنظیم-چیدمان-لیست-محصولات) | تنظیم چیدمان تک‌ستونه / دوستونه | `lib/productGrid.ts`, `product/ProductLayoutContext.tsx` |

---

## ۱ — رفع باگ hydration در چهار ویجت اسلایدری

### مشکل

چهار ویجت برای ساختن کلاس یکتای Swiper از `Math.random()` استفاده می‌کردند:

```tsx
const uid = useRef(`pbc-${Math.random().toString(36).slice(2, 7)}`);
```

این مقدار روی سرور و کلاینت متفاوت تولید می‌شود، پس className رندرشده در HTML
سرور با چیزی که React در مرورگر می‌سازد فرق می‌کرد و خطای
«A tree hydrated but some attributes … didn't match» در کنسول ظاهر می‌شد.

### راه‌حل

هیچ کلاس یکتایی ساخته نمی‌شود؛ خود المان‌ها با `ref` به Swiper داده می‌شوند:

```tsx
const rootRef = useRef<HTMLDivElement>(null);
const prevRef = useRef<HTMLButtonElement>(null);
const nextRef = useRef<HTMLButtonElement>(null);

new win.Swiper(rootRef.current, {
  navigation: { nextEl: nextRef.current, prevEl: prevRef.current },
});
```

این همان الگویی است که در `ProductShowcaseSection` استفاده شده و هم SSR-safe است
و هم چند نمونه‌ی هم‌زمان از یک ویجت را بدون تداخل پشتیبانی می‌کند.

هم‌زمان `aria-label` فارسی («اسلاید قبلی» / «اسلاید بعدی») به دکمه‌های ناوبری
اضافه شد که قبلاً برای صفحه‌خوان‌ها بی‌نام بودند.

### ویجت‌های اصلاح‌شده

- `ProductsByCategorySection.tsx` — محصولات بر اساس دسته
- `ProductsByBrandSection.tsx` — محصولات بر اساس برند
- `LatestArticlesSection.tsx` — آخرین مقالات
- `Hero.tsx` — اسلایدر پیشنهادهای کنار بنر هرو

> اسلایدر اصلی Hero از کلاس‌های ثابت `.hero-next` / `.hero-prev` استفاده می‌کند و
> این مشکل را نداشت؛ دست نخورد.

---

## ۲ — تنظیم چیدمان لیست محصولات

### تنظیم جدید

**ادمین ← تنظیمات سایت ← تب «نمایش محصولات»**، ذخیره در
`StoreSettings.productGridMobile`:

| مقدار | رفتار |
|---|---|
| `single` (پیش‌فرض) | دقیقاً مثل قبل — موبایل یک ستون با `ManaProductCard`، دسکتاپ سه ستون |
| `double` | موبایل دو ستون با `ShowcaseProductCard`، دسکتاپ چهار ستون |

هر گزینه در ادمین یک پیش‌نمایش شماتیک از صفحه‌ی موبایل دارد.

### کجاها اعمال می‌شود

- صفحه‌ی همه محصولات — `products/ProductsPageClient.tsx`
- صفحات دسته‌بندی — `categories/CategoryPageClient.tsx`
- صفحات برند — `brands/BrandPageClient.tsx`
- ویجت «جدیدترین محصولات» — `NewestProductsSection.tsx`

صفحه‌ی جستجو و علاقه‌مندی‌ها از قبل دوستونه بودند و دست نخوردند.

### معماری

مقدار تنظیم یک‌بار در `app/(shop)/layout.tsx` خوانده و با یک Context در اختیار
همه‌ی صفحات قرار می‌گیرد، تا هر صفحه مجبور نباشد این تنظیم را جداگانه به‌صورت
prop رد کند:

```tsx
<ProductLayoutProvider mode={normalizeGridMode(settings?.productGridMobile)}>
```

**دو فایل جدا** لازم شد:

- `lib/productGrid.ts` — نوع `ProductGridMode` و تابع `normalizeGridMode()`.
  عمداً بدون `"use client"` تا هم لایوت سرور و هم route handler ادمین بتوانند
  از آن استفاده کنند.
- `components/store/product/ProductLayoutContext.tsx` — کانتکست و کامپوننت‌های
  کلاینتی.

از کانتکست سه چیز بیرون می‌آید:

| نام | کار |
|---|---|
| `useProductGridClass(variant)` | کلاس گرید متناسب با چیدمان |
| `useProductSkeletonClass()` | ارتفاع اسکلت لودینگ متناسب، تا هنگام لود پرش نداشته باشیم |
| `<ProductCardAuto product />` | کارت درست را بر اساس چیدمان رندر می‌کند |

پارامتر `variant` دو حالت دارد: `listing` برای صفحات لیست و `widget` برای ویجت
صفحه اصلی، چون نقطه‌شکست ستون‌هایشان از قبل فرق داشت.

### چرا دسکتاپ هم عوض می‌شود

کارت `ShowcaseProductCard` جمع‌وجورتر از `ManaProductCard` است؛ اگر در دسکتاپ
همان سه ستون می‌ماند، کارت‌ها بی‌خود پهن می‌شدند. پس در حالت دوستونه دسکتاپ چهار
ستون می‌شود تا تناسب حفظ شود.

---

## مشکلی که حین تست پیدا و برطرف شد

`normalizeGridMode` ابتدا داخل فایل کانتکست (`"use client"`) تعریف شده بود و
لایوت سرور آن را صدا می‌زد. نتیجه یک خطای runtime بود:

```
Attempted to call normalizeGridMode() from the server but normalizeGridMode is on the client.
```

به همین دلیل تابع و نوع به `lib/productGrid.ts` منتقل شدند که ماژول خنثی است.

> نکته‌ی محیطی: بعد از مایگریشن باید سرور توسعه ری‌استارت شود؛ Prisma Client
> قدیمی ستون تازه را برنمی‌گرداند و مقدار `undefined` می‌شود (یعنی `single`).

---

## تست انجام‌شده

`tsc --noEmit` بدون خطا. تست با مرورگر واقعی:

| سناریو | نتیجه |
|---|---|
| هر ۸ اسلایدر صفحه اصلی | همه init شدند و خطای hydration از کنسول حذف شد ✓ |
| کلیک روی فلش هر اسلایدر | همه اسلاید را جابه‌جا کردند ✓ |
| حالت `single` روی `/products` | کلاس گرید دقیقاً `grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6` — بدون تغییر ✓ |
| حالت `double` روی `/products` | کلاس `grid-cols-2 …`، کارت ۲۲۴px در ویوپورت ۵۰۰px ✓ |
| حالت `double` روی دسته‌بندی و برند | همان نتیجه ✓ |
| حالت `double` روی ویجت جدیدترین محصولات | `grid-cols-2 md:grid-cols-3 xl:grid-cols-4` ✓ |
| هم‌قد بودن کارت‌های هر ردیف | در هر ردیف دقیقاً برابر (۳۴۲/۳۴۲ و ۳۶۴/۳۶۴) ✓ |
| ذخیره از API ادمین | `single` و `double` درست ذخیره شدند ✓ |
| مقدار نامعتبر (`"triple"`) | به `single` تبدیل شد ✓ |
| تب جدید ادمین در مرورگر | دو گزینه با پیش‌نمایش شماتیک، درست رندر شد ✓ |

مقدار تنظیم در پایان به `single` (حالت اولیه) برگردانده شد.

---

## فایل‌های تغییریافته

```
lib/productGrid.ts                                ← جدید (نوع + normalize، بدون use client)
components/store/product/ProductLayoutContext.tsx ← جدید (کانتکست + ProductCardAuto)
app/(shop)/layout.tsx                             ← ProductLayoutProvider
components/store/products/ProductsPageClient.tsx  ← گرید و کارت پویا
components/store/categories/CategoryPageClient.tsx← گرید و کارت پویا
components/store/brands/BrandPageClient.tsx       ← گرید و کارت پویا
components/store/NewestProductsSection.tsx        ← گرید و کارت پویا
components/store/ProductsByCategorySection.tsx    ← رفع hydration + aria-label
components/store/ProductsByBrandSection.tsx       ← رفع hydration + aria-label
components/store/LatestArticlesSection.tsx        ← رفع hydration + aria-label
components/store/Hero.tsx                         ← رفع hydration
app/admin/site-settings/page.tsx                  ← تب «نمایش محصولات»
app/api/admin/site-settings/route.ts              ← ذخیره‌ی امن productGridMobile
prisma/schema.prisma                              ← productGridMobile
prisma/migrations/20260814122228_add_product_grid_mobile/
```

## استفاده در صفحات آینده

هر لیست محصول تازه‌ای که ساخته شود، فقط کافی است از کانتکست استفاده کند تا
خودکار از تنظیم ادمین پیروی کند:

```tsx
const gridCls = useProductGridClass();
...
<div className={gridCls}>
  {products.map(p => <ProductCardAuto key={p.id} product={p} />)}
</div>
```
