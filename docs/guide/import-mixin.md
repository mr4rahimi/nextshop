# انتقال فروشگاه از سایت‌ساز «میکسین»

نسخه ۲.۱۶۷.۰ (۱۴۰۵/۰۹/۰۴). اولین بار برای یک مشتری گردانوس (۷۶ محصول) استفاده شد.

میکسین (mixin.ir) سایت‌ساز Next.js است و به مشتری دسترسی سرور یا خروجی دیتابیس نمی‌دهد.
ولی هر صفحه داده‌ی کاملش را در payload خود Next (`self.__next_f`) دارد، پس انتقال
**بدون ادمین و فقط با خزیدن** ممکن است. ادمین میکسین فقط برای موجودی واقعی، قیمت خرید،
محصولات پنهان، مشتری‌ها و سفارش‌ها لازم است.

## دو مرحله

```bash
# ۱) خزیدن — روی سیستم توسعه؛ فقط کتابخانه‌ی استاندارد پایتون
python3 -I scripts/import/mixin-crawl.py https://example.ir /path/to/export

# ۲) درون‌ریزی — روی دیتابیس بی‌محصول (سایت تازه)، از ریشه‌ی پروژه
npx tsx scripts/import/mixin.ts /path/to/export --name example --brand-from-title --skip-empty-categories --dry-run
npx tsx scripts/import/mixin.ts /path/to/export --name example --brand-from-title --skip-empty-categories
```

`--dry-run` نام تمیزشده، اسلاگ، گارانتی و تعداد عکس هر محصول را چاپ می‌کند و چیزی نمی‌نویسد.

## خروجی خزنده (`export.json`)

| کلید | منبع |
|---|---|
| `products[]` | شیء کامل `ssrProductInfo` هر صفحه‌ی محصول (نقشه‌ی `sitemap-product.xml`) + `images[].local` |
| `categories[]` | درخت `searchData.all_categories` (تخت‌شده با `parentId`) + ترتیب منو + عکس |
| `brands[]` | نام از نشانی `sitemap-brand.xml` |
| `pages[]`، `blog[]` | عنوان، توضیح متا، `contentHtml` از ردیف‌های متنی RSC، HTML خام در `html/` |
| `home` | عکس‌های صفحه‌ی اول به ترتیب، با لینک و نزدیک‌ترین تیتر؛ تلفن، ایمیل و کد اینماد |

دسته‌هایی که در منو پنهان‌اند ولی محصول دارند، از `main_category` محصول ساخته می‌شوند.
فایل گم‌شده در فضای ذخیره‌ی میکسین XML خطای S3 برمی‌گرداند و رد می‌شود.

## نگاشت فیلدها

| میکسین | nextshop |
|---|---|
| `description` (HTML) | `summaryTitle` (اولین h2)، `summaryDescription` (متن)، `summaryFeatures` و `features` (آیتم‌های فهرست) |
| `analysis` (نقد و بررسی) | `expertTitle`، `expertDescription` |
| `seo_description` | اگر یادداشت سئو در آن چسبانده شده («نامک … کلمه کلیدی اصلی … توضیحات متا:») تجزیه می‌شود به `seoTitle`، `seoKeywords`، `seoDescription` و اسلاگ لاتین |
| `price` / `compare_at_price` | قیمت تومان؛ اگر قیمت قبل بیشتر است، `price` = قبل و `salePrice` = فعلی |
| `stock_type` / `max_available` | `limited` ← `trackStock` با موجودی همان سقف (عدد واقعی نیست)؛ `unlimited` ← بدون کنترل موجودی |
| `guarantee` و «(۱۲ ماه ضمانت)» در نام | `warranty` = «۱۲ ماه ضمانت» و از نام حذف می‌شود |

فیلدهای توضیح محصول در nextshop متن ساده‌اند (`whitespace-pre-line`)، نه HTML. برای همین
HTML به متن با «• » برای آیتم‌ها تبدیل می‌شود.

تمیزکاری نام: «-برندX» به «برند X»، فاصله میان فارسی و لاتین/عدد («پژو405» ← «پژو 405»)
و یکدست کردن شکل‌های مختلف نام برند. غلط تایپی خود سایت مبدأ را باید در اسکریپت مخصوص
همان مشتری درست کرد.

`--brand-from-title`: میکسین گاهی برند همه را یکی ثبت می‌کند. با این گزینه، برندی که نامش
در عنوان آمده بر برند ثبت‌شده مقدم است.

## عکس و ریدایرکت

- عکس‌ها WebP (ضلع بلند ۱۶۰۰، کیفیت ۸۴) در `public/uploads/import/<name>/`؛ ۱۵۱ مگ به ۹ مگ رسید.
- ریدایرکت REGEX ۳۰۱ برای `^/product/<id>(/.*)?$` و همین‌طور `category`، `brand`، `page` و `blog`.
  شناسه‌ی عددی میکسین در نشانی ثابت است و اسلاگ فارسی بعدش هر چیزی می‌تواند باشد.
  Next اول اسلش آخر را با ۳۰۸ برمی‌دارد و بعد ریدایرکت ما ۳۰۱ می‌دهد (دو گام).
- اسکریپت‌های بعدی که اسلاگ را عوض می‌کنند باید `Redirect.destination` را هم به‌روز کنند.

## اسکریپت مخصوص هر مشتری

چیدمان صفحه‌ی اول، برگه‌ها، رنگ‌ها، اسلاگ انگلیسی و اصلاح غلط‌ها داده‌ی مشتری‌اند و در git
نمی‌آیند. آن‌ها را در `scripts/local/` بگذارید. این پوشه در `.git/info/exclude` و در `EXCLUDES`
`deploy.mjs` است، پس استقرار نه آن را می‌فرستد و نه پاکش می‌کند. نمونه‌ی اول
`scripts/local/shahranyadak-site.ts` بود و این کارها را انجام می‌داد:

- ادغام و تغییر نام دسته‌ها و اسلاگ انگلیسی
- رنگ پوسته با همان فرمول OKLCH صفحه‌ی «ظاهر»
- اسلایدر، ۱۳ ویجت، مگامنوی خودروها، ستون‌های فوتر
- ۸ برگه با قالب‌های ABOUT، CONTACT، FAQ و LEGAL، و ۳ مقاله

## نصب سایت تازه روی سرور مشترک (همان روند demo.gardanos.ir)

۱. دیتابیس و کاربر هم‌نام، `.env` با رازهای `openssl rand` روی خود سرور.
۲. کد را با **همان `EXCLUDES` در `deploy.mjs`** بفرستید، نه rsync دستی. rsync دستی
   `public/uploads.zip`، zipهای پشتیبان و عکس‌های سایت‌های دیگر (`public/products`،
   `banners`…) را هم می‌برد. `node_modules` را اگر `.deps-hash` یکی است از سایت هم‌سرور کپی کنید.
۳. `prisma migrate deploy`، `scripts/setup-new-site.ts <موبایل> <رمز>` و سیدهای پیش‌فرض
   (همان `DEFAULT_SEEDS` در `scripts/demo/seed.ts` + `seed-customer-categories`).
۴. درون‌ریزی، بعد اسکریپت مشتری، بعد `next build` با `nohup` و `pm2 start ecosystem.config.js`.
۵. nginx با گواهی certbot webroot. تا وقتی سایت روی سابدامین آزمایشی است،
   `X-Robots-Tag: noindex` در nginx بماند و روز انتقال به دامنه‌ی اصلی برداشته شود.
