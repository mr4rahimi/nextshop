# ویجت «اسلایدر محصول کرافت»

**تاریخ:** ۱۴۰۵/۰۷/۰۷ (2026-09-29)
**نسخه:** 2.65.0

طرح از بخش «About The MagicCraft» یک سایت بازی گرفته شده: متن معرفی کنار اسلایدری
از کارت‌های گوشه‌بریده. تفاوت‌ها به خواست کاربر:

- تصویر هر اسلاید **مربع** است (در طرح اصلی کارت‌ها بلند بودند)
- باکس کنار اسلایدر مشخصات **محصولِ اسلاید فعال** را نشان می‌دهد: برند، عنوان،
  قیمت (با قیمت خط‌خورده و درصد تخفیف)، بخشی از توضیح کوتاه، «افزودن به سبد» و
  «مشاهده محصول»
- در دسکتاپ ارتفاع این باکس **دقیقاً برابر ضلع تصویر مربع** است
- در موبایل: عنوان بخش بالا، اسلایدر، و باکس مشخصات زیر آن

## فایل‌ها

| فایل | کار |
|---|---|
| `components/store/CraftProductSliderSection.tsx` | رندر ویجت، `normalizeCraftConfig`، `CRAFT_DEFAULT` |
| `app/admin/widgets/[id]/page.tsx` | `CraftProductSliderEditor` |
| `app/admin/widgets/page.tsx` | نام، آیکن 🎮 و توضیح در لیست ویجت‌ها |
| `components/store/StoreHomePageClient.tsx` | `case "CRAFT_PRODUCT_SLIDER"` |
| `app/api/store/products-by-{category,brand}/route.ts` | پارامتر اختیاری `withDesc=1` |
| `prisma/migrations/20261003120000_add_craft_product_slider_widget` | مقدار تازه‌ی enum `WidgetType` |

## config

| کلید | معنی |
|---|---|
| `source` | `manual` (پیش‌فرض ویجت تازه) / `category` / `brand` |
| `productIds` | در `manual` — ترتیب نمایش همان ترتیب انتخاب |
| `categoryId`… / `brandId`… / `count` / `sortMode` | مثل ویجت `PRODUCT_SHOWCASE` |
| `eyebrow` / `heading` | متن کوچک بالای عنوان و عنوان بخش (هر دو اختیاری) |
| `bgFrom` / `bgTo` | گرادیان پس‌زمینه؛ رنگ نوشته با `contrastTextColor` خودکار |
| `accentColor` | دکمه خرید، قاب کارت فعال، هاله‌ی پشت اسلایدر |
| `imageFit` | `cover` (پر کردن مربع) یا `contain` (تصویر کامل روی گرادیان رنگی کارت) |
| `showArrows` / `showBrandBadge` / `autoplay` / `autoplayDelay` | رفتار اسلایدر |

`normalizeCraftConfig` روی `normalizeShowcaseConfig` سوار است و `source=manual`
را جداگانه نگه می‌دارد. در ذخیره، فیلدهای منبع غیرفعال پاک می‌شوند و در
`manual` مقدار `sortMode` هم `manual` ذخیره می‌شود.

## نکته‌های پیاده‌سازی

- **هم‌قدی باکس با مربع:** ستون مشخصات `relative` است و محتوایش در دسکتاپ
  `lg:absolute lg:inset-0`؛ پس ارتفاع ردیف گرید را فقط اسلایدر تعیین می‌کند.
  توضیحات `flex-1 min-h-0 overflow-hidden` با ماسک محوشونده است — عنوان، قیمت و
  دکمه‌ها همیشه دیده می‌شوند و توضیحات تا جایی که جا باشد.
- **توضیحات:** API فقط با `withDesc=1` فیلد `excerpt` برمی‌گرداند
  (`shortDescription`، در نبودش `summaryDescription`، بدون تگ، حداکثر ۶۰۰ نویسه)
  تا ویجت‌های دیگر بار اضافه نگیرند.
- **کارت‌ها:** شکل گوشه‌بریده با `clip-path`؛ قاب رنگی کارت فعال یک لایه‌ی بیرونی
  با `padding: 2px` و همان clip-path است، و سایه با `filter: drop-shadow` روی
  والدِ بدون clip (چون `box-shadow` زیر clip-path دیده نمی‌شود).
- **اسلاید فعال:** کارت‌های غیرفعال `scale(0.86)` و کم‌رنگ‌اند. کلیک روی کارت
  غیرفعال به آن اسلاید می‌رود؛ کلیک روی کارت فعال به صفحه‌ی محصول.
- `slidesPerView`: موبایل ۱٫۳، از ۶۴۰px ۱٫۶، از ۱۰۲۴px ۱٫۷۵. `loop` فقط با
  اسلاید خودکار و دست‌کم ۴ محصول؛ ایندکس فعال از `realIndex`.
- دکمه‌ی خرید خودِ ویجت است (`useCart`) نه `AddToCartButton`، چون ظاهرش باید با
  رنگ تاکیدی و زمینه‌ی تیره‌ی ویجت جور باشد.
