"use client"; 

const VERSIONS = [

  {
    version: "2.6.0",
    date: "1405/04/09",
    tag: "minor",
    title: "یکپارچه‌سازی ایمالز، رفع باگ‌های Hero و نمایش قیمت",
    description: "افزودن API فید محصولات برای ایمالز، رفع عکس‌های ثابت و نسبت ابعاد اسلایدر Hero، اصلاح layout قیمت در کارت شگفت‌انگیز، بهبود پردازش تصاویر با sharp و SVG، و جایگزینی لیست ناقص شهرها با داده‌های کامل",
    changes: [
      { type: "feature", text: "API فید محصولات ایمالز: GET /api/imalz/list?page=1&item_per_page=50 با فرمت کامل ایمالز (title, price, price_old, category, image, available_is, url, guarantee, color)" },
      { type: "fix",     text: "حذف سه عکس ثابت hardcode شده (defaultSlides) از ویجت Hero — حالا فقط اسلایدهای ادمین نمایش داده می‌شوند" },
      { type: "fix",     text: "اصلاح نسبت ابعاد Hero Slider از min-h ثابت به aspect-[1400/500] — عکس‌های ۱۴۰۰×۵۰۰ کامل نمایش داده می‌شوند" },
      { type: "fix",     text: "یکسان‌سازی ارتفاع Hero Slider و باکس پیشنهادات لحظه‌ای با lg:h-[420px] روی grid" },
      { type: "fix",     text: "اضافه شدن loading state به Hero — نمایش skeleton هنگام fetch و پیام خالی اگر اسلایدی تنظیم نشده باشد" },
      { type: "fix",     text: "اصلاح layout قیمت در کارت Amazing Deals — min-w-0 روی بخش قیمت، flex-shrink-0 روی دکمه + و tabular-nums برای ارقام پهن" },
      { type: "improvement", text: "نصب sharp برای بهینه‌سازی صحیح AVIF/WebP در production" },
      { type: "improvement", text: "فعال‌سازی dangerouslyAllowSVG در next.config — فایل‌های SVG آپلودشده (مثل لوگو) از طریق Next.js Image صحیح نمایش داده می‌شوند" },
      { type: "improvement", text: "افزودن پروتکل http به remotePatterns — تصاویر با آدرس http:// هم بارگذاری می‌شوند" },
      { type: "improvement", text: "جایگزینی لیست ناقص شهرها با داده‌های کامل: ۳۱ استان و ۱۱۹۵ شهر از مخزن رسمی" },
    ],
  },

  {
    version: "2.5.0",
    date: "1404/04/06",
    tag: "minor",
    title: "انتخاب حالت نمایش محصولات در ویجت‌های دسته و برند",
    description: "ویجت‌های PRODUCTS_BY_CATEGORY و PRODUCTS_BY_BRAND اکنون سه حالت نمایش دارند: جدیدترین محصولات (خودکار)، پرفروش‌ترین (خودکار بر اساس تعداد سفارش) و انتخاب دستی توسط ادمین با جستجو و مرتب‌سازی",
    changes: [
      { type: "feature", text: "سه حالت نمایش در ویجت محصولات بر اساس دسته: جدیدترین، پرفروش‌ترین و انتخاب دستی" },
      { type: "feature", text: "سه حالت نمایش در ویجت محصولات بر اساس برند: جدیدترین، پرفروش‌ترین و انتخاب دستی" },
      { type: "feature", text: "کامپوننت ProductPicker — جستجوی محصول با debounce، toggle فیلتر دسته/برند، انتخاب چندگانه" },
      { type: "feature", text: "کامپوننت SortModeSelector — انتخاب بصری حالت نمایش با سه کارت آیکن‌دار" },
      { type: "feature", text: "مرتب‌سازی محصولات انتخاب‌شده با دکمه‌های ↑↓ و حذف تکی" },
      { type: "improvement", text: "API /api/store/products-by-category: پشتیبانی از sort=newest|best_sellers و productIds برای حالت دستی" },
      { type: "improvement", text: "API /api/store/products-by-brand: پشتیبانی از sort و productIds" },
      { type: "improvement", text: "API /api/admin/products-search: فیلتر اختیاری با categoryId و brandId" },
      { type: "improvement", text: "سازگاری کامل با داده‌های قبلی — ویجت‌های موجود بدون تغییر به حالت newest fallback می‌کنند" },
    ],
  },

  {
    version: "2.4.0",
    date: "1405/04/01",
    tag: "minor",
    title: "بهینه‌سازی جامع SEO",
    description: "پیاده‌سازی کامل استانداردهای SEO فنی: اسکیماهای Schema.org، متادیتای صفحات، بهینه‌سازی تصاویر با Next.js Image، Cache-Control هوشمند، sitemap و robots کامل و مدیریت لوکال بیزینس از ادمین",
    changes: [
      // ── Structured Data ───────────────────────────────────────────────
      { type: "feature", text: "اسکیمای Organization کامل در صفحه اصلی — آدرس، کدپستی، شهر، استان، شبکه‌های اجتماعی و ایمیل" },
      { type: "feature", text: "اسکیمای LocalBusiness (Store) در صفحه اصلی — ساعت کاری، لینک نقشه گوگل، اطلاعات تماس و sameAs" },
      { type: "feature", text: "اسکیمای WebSite با SearchAction — امکان جستجو مستقیم از نتایج گوگل (Sitelinks Searchbox)" },
      { type: "feature", text: "اسکیمای Product کامل در صفحه محصول — Offer، قیمت، موجودی، برند، SKU، شرایط ارسال و بازگشت کالا" },
      { type: "feature", text: "اسکیمای BreadcrumbList در صفحات محصول، دسته‌بندی، برند و مقاله" },
      { type: "feature", text: "اسکیمای FAQPage در صفحه محصول — پرسش و پاسخ‌های محصول نمایش داده می‌شوند" },
      { type: "feature", text: "اسکیمای Article در صفحات مقاله بلاگ — publishedAt، updatedAt، author، publisher" },
      { type: "feature", text: "اسکیمای ItemList در صفحات دسته‌بندی و برند — فهرست محصولات به Google ارسال می‌شود" },
      // ── Metadata ─────────────────────────────────────────────────────
      { type: "feature", text: "تابع buildBaseMetadata در lib/seo.ts — canonical، og:image، og:type، og:siteName، twitter:card برای همه صفحات" },
      { type: "feature", text: "title template در root layout — نام فروشگاه به‌صورت خودکار به عنوان همه صفحات اضافه می‌شود" },
      { type: "feature", text: "og:image برای صفحات دسته‌بندی و برند — تصویر دسته/لوگو برند، fallback به لوگو فروشگاه" },
      { type: "feature", text: "og:siteName در همه صفحات — خوانده‌شده از DB یا env var NEXT_PUBLIC_STORE_NAME" },
      { type: "feature", text: "noindex برای صفحات جستجو — متادیتای robots: index:false, follow:true" },
      { type: "feature", text: "تگ تأیید Google Search Console — از env var NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION" },
      { type: "feature", text: "متادیتا کامل برای صفحات محصول، دسته‌بندی، برند، جستجو، مجله و مقالات" },
      { type: "improvement", text: "metadataBase در root layout — تبدیل خودکار URL‌های نسبی به absolute برای og:image" },
      { type: "improvement", text: "viewport export در root layout — جایگزین meta viewport دستی" },
      // ── Admin Site Settings ───────────────────────────────────────────
      { type: "feature", text: "فیلدهای جدید در تنظیمات سایت ادمین: شهر، استان، کدپستی و ساعت کاری (فرمت schema.org)" },
      { type: "improvement", text: "اسکیماهای LocalBusiness و Organization اطلاعات را از تنظیمات سایت ادمین می‌خوانند" },
      // ── Image Optimization ────────────────────────────────────────────
      { type: "improvement", text: "فرمت‌های AVIF/WebP در next.config.ts — کاهش حجم تصاویر تا ۵۰٪" },
      { type: "improvement", text: "بهینه‌سازی تصاویر کارت محصول، صفحه جزئیات محصول، گالری و تامبنیل‌ها با Next.js Image" },
      { type: "improvement", text: "بهینه‌سازی تصاویر ویجت‌های صفحه اصلی — Hero، Newest، ProductsByCategory، ProductsByBrand" },
      { type: "improvement", text: "بهینه‌سازی تصاویر layout — لوگو Header، لوگو Footer، منو موبایل، منوی مگا" },
      { type: "improvement", text: "بهینه‌سازی تصاویر بلاگ — MagHomeClient، MagPostClient (cover، related articles)" },
      { type: "improvement", text: "بهینه‌سازی تصاویر Cart و Checkout — تامبنیل محصولات در سبد و خلاصه سفارش" },
      { type: "improvement", text: "priority روی تصاویر above-the-fold — hero slide اول، لوگو header، تصویر اصلی محصول" },
      { type: "improvement", text: "sizes hint مناسب روی همه Image‌ها — تولید srcset بهینه برای هر breakpoint" },
      // ── Performance ───────────────────────────────────────────────────
      { type: "improvement", text: "فعال‌سازی gzip compression — حذف compress:false از next.config.ts" },
      { type: "feature", text: "Cache-Control هوشمند برای همه API routes — ۵ سطح: config ثابت (۱h)، کاتالوگ (۵m)، محصولات (۱m)، private و no-store" },
      { type: "improvement", text: "API‌های layout (header-menu، footer، theme) کش ۱ ساعته — کاهش چشمگیر TTFB" },
      // ── Sitemap & Robots ──────────────────────────────────────────────
      { type: "improvement", text: "sitemap.xml کامل — محصولات، دسته‌بندی‌ها، برندها، مقالات، صفحات listing؛ revalidate هر ۱ ساعت" },
      { type: "improvement", text: "robots.txt — مسدود کردن admin، api، user، cart، checkout، auth؛ اجازه Googlebot به صفحه جستجو" },
      { type: "fix",         text: "اضافه شدن /categories و /brands به sitemap؛ حذف /cart از sitemap" },
      // ── 404 ──────────────────────────────────────────────────────────
      { type: "feature", text: "صفحه ۴۰۴ سفارشی فارسی — noindex، لینک به خانه و همه محصولات، سازگار با dark mode" },
    ],
  },

  {
    version: "2.3.0",
    date: "1405/03/29",
    tag: "minor",
    title: "پیوست فایل دانلودی به محصولات",
    description: "ادمین می‌تواند برای هر محصول یک فایل دانلودی (کاتالوگ، درایور، راهنما و ...) با عنوان دلخواه آپلود کند؛ دکمه دانلود به‌صورت حرفه‌ای در صفحه جزئیات محصول نمایش داده می‌شود",
    changes: [
      { type: "feature", text: "فیلدهای downloadTitle و downloadUrl به مدل محصول اضافه شد" },
      { type: "feature", text: "بخش «پیوست فایل دانلودی» در فرم ساخت و ویرایش محصول — عنوان دکمه + آپلود فایل" },
      { type: "feature", text: "پشتیبانی آپلود از انواع فایل غیر تصویری: PDF، ZIP، RAR، DOC، XLS و TXT (حداکثر ۱۰۰MB)" },
      { type: "feature", text: "نمایش کارت دانلود آبی‌رنگ در صفحه جزئیات محصول — عنوان، پسوند فایل و دکمه دانلود" },
      { type: "improvement", text: "نمایش نام فایل آپلودشده با آیکون سبز در فرم ادمین و دکمه حذف" },
      { type: "improvement", text: "جلوگیری از آپلود فایل‌های اجرایی (.exe, .bat, .sh و ...) به‌عنوان فایل دانلودی" },
    ],
  },

  {
    version: "2.2.0",
    date: "1405/03/21",
    tag: "minor",
    title: "درخواست تماس کارشناس در چت",
    description: "کاربران می‌توانند مستقیماً از پنجره چت درخواست تماس ثبت کنند؛ ادمین با صفحه اختصاصی می‌تواند درخواست‌ها را مدیریت، وضعیت‌بندی و یادداشت‌گذاری کند",
    changes: [
      { type: "feature", text: "مدل CallbackRequest در دیتابیس — phone، status، siteId، conversationId، یادداشت داخلی" },
      { type: "feature", text: "باکس درخواست تماس زیر پیام‌های چت — برای مهمان: ورود شماره، برای عضو: شماره از پروفایل pre-fill" },
      { type: "feature", text: "صفحه ادمین /admin/callback-requests با تب‌های فیلتر (جدید / تماس گرفته شد / تکمیل شد)" },
      { type: "feature", text: "پنل جزئیات در ادمین — تغییر وضعیت، یادداشت داخلی، لینک به مکالمه، حذف" },
      { type: "feature", text: "نمایش تعداد درخواست‌های جدید با نشانگر پالس‌زن در منوی ادمین" },
      { type: "feature", text: "API اختصاصی POST /api/store/callback-request با اعتبارسنجی شماره ایرانی" },
      { type: "improvement", text: "API my-chat اکنون شماره تلفن کاربر لاگین‌شده را برمی‌گرداند" },
    ],
  },

  {
    version: "2.1.0",
    date: "1405/03/14",
    tag: "minor",
    title: "چت هوشمند: جداسازی multi-site و مشاوره دقیق محصولات",
    description: "هر سایت روی دامنه مستقل تاریخچه چت جداگانه دارد؛ پاسخ‌های هوش مصنوعی درباره محصولات اکنون از داده‌های واقعی دیتابیس (مشخصات فنی، قیمت دقیق، برند) استفاده می‌کند",
    changes: [
      { type: "feature", text: "جداسازی کامل تاریخچه چت بین سایت‌های مختلف — فیلد siteId روی ChatConversation" },
      { type: "feature", text: "localStorage چت کاربر مهمان با namespace مجزا به ازای هر دامنه (chat_state_${host})" },
      { type: "feature", text: "راه‌اندازی دو مرحله‌ای چت — دکمه‌ها فوری نمایش داده می‌شوند، احراز هویت غیرمسدودکننده است" },
      { type: "feature", text: "مشاوره محصول با query مستقیم Prisma — ۳۰ محصول با مشخصات فنی کامل به AI ارسال می‌شود" },
      { type: "feature", text: "تشخیص هدف جستجو از کلمات کلیدی: ارزان‌ترین، گران‌ترین، جدیدترین" },
      { type: "feature", text: "API جدید GET /api/store/my-chat — بازیابی آخرین مکالمه کاربر لاگین‌شده به تفکیک سایت" },
      { type: "improvement", text: "ادمین تاریخچه چت اکنون فقط مکالمات همان سایت را نمایش می‌دهد" },
      { type: "fix", text: "رفع race condition دکمه‌های چت هنگام load همزمان config و احراز هویت" },
    ],
  },

  {
    version: "2.0.1",
    date: "1405/03/11",
    tag: "patch",
    title: "رفع باگ‌های Story، موبایل چت و مسیر API",
    description: "رفع سه باگ: خطای null در StoryPlayer هنگام navigate، موقعیت دکمه چت روی موبایل زیر منوی پایین، و مسیر اشتباه API فیلترهای صفحه محصولات",
    changes: [
      { type: "fix", text: "رفع TypeError: this.container is null در Story — اضافه کردن cancelled flag و بررسی DOM قبل از init" },
      { type: "fix", text: "دکمه چت روی موبایل اکنون ۹۹px از پایین قرار می‌گیرد — بالاتر از MobileBottomNav" },
      { type: "fix", text: "رفع خطای ۴۰۴ برای /api/products-meta — مسیر صحیح /api/store/products-meta" },
      { type: "improvement", text: "انتقال style رسپانسیو چت به بیرون از شرط open — همیشه در DOM حضور دارد" },
    ],
  },

  {
    version: "2.0.0",
    date: "1405/0/08",
    tag: "minor",
    title: "شش ویجت حرفه‌ای صفحه اصلی",
    description: "افزودن پنج ویجت محتوایی و یک ویجت جستجوی پیشرفته برای صفحه اصلی فروشگاه — همه قابل تنظیم از پنل ادمین",
    changes: [
      { type: "feature", text: "ویجت CALL_TO_ACTION — بنر دعوت به اقدام با رنگ‌بندی کاملاً قابل تنظیم (رنگ یکدست یا گرادیان، رنگ دکمه، رنگ متن)" },
      { type: "feature", text: "ویجت SPECIAL_OFFERS — اسلایدر افقی دارک‌مود با تایمر شمارش معکوس فارسی، ستاره‌بندی، نوار موجودی و دکمه سبد" },
      { type: "feature", text: "ویجت IMAGE_CONTENT — عکس و محتوا در کنار هم با قابلیت معکوس کردن جایگاه در دسکتاپ، badge، دکمه CTA و تزئینات blob" },
      { type: "feature", text: "ویجت IMAGE_CONTENT_DOUBLE — تصویر تمام‌عرض بالا و دو باکس محتوای شناور با badge فارسی شماره‌دار" },
      { type: "feature", text: "ویجت LAST_VISITED — آخرین محصولات بازدیدشده کاربر از localStorage با Skeleton loader و nav buttons" },
      { type: "feature", text: "ردیاب بازدید در صفحه محصول — هر بازدید به localStorage کاربر اضافه می‌شود (حداکثر ۱۲ محصول، بدون تکرار)" },
      { type: "feature", text: "ویجت ADVANCED_SEARCH — جستجوی پیشرفته با انتخاب دسته اصلی (کارت تصویردار)، زیردسته، برند با لوگو و ویژگی‌های قابل فیلتر دسته‌بندی" },
      { type: "feature", text: "ویجت ADVANCED_SEARCH — نتایج inline (حداکثر ۴ محصول) + دکمه «مشاهده همه» با URL کامل فیلترها" },
      { type: "feature", text: "API جدید /api/store/search-meta — دسته‌ها، برندها و گروه‌های ویژگی قابل فیلتر بر اساس CategoryAttributeGroup" },
      { type: "feature", text: "API جدید /api/store/search-results — فیلتر محصولات با categoryId، brandId و attributeValueId (سازگار با صفحه محصولات)" },
      { type: "improvement", text: "ادمین ویجت‌ها — ویرایشگر اختصاصی برای هر ویجت جدید با ColorField، آپلود عکس و انتخاب محصول" },
      { type: "fix", text: "Fallback defensive برای widget های ناشناخته در لیست ادمین — جلوگیری از crash کل لیست" },
    ],
  },

  {
    version: "1.9.0",
    date: "1405/03/01",
    tag: "minor",
    title: "بازطراحی کامل داشبورد ادمین با داده‌های واقعی",
    description: "داشبورد پنل ادمین از صفر بازطراحی شد — نمودارهای SVG تعاملی، داده‌های زنده از دیتابیس، layout جدید و پوشش کامل بخش‌های فروشگاه",
    changes: [
      { type: "feature", text: "نمودار فروش روزانه تمام‌عرض با toggle ۷/۳۰/۹۰ روز و tooltip hover تعاملی" },
      { type: "feature", text: "نمودار سفارشات تکمیل‌شده و کاربران ثبت‌نام‌شده — سری زمانی ۹۰ روزه با raw SQL" },
      { type: "feature", text: "بخش موجودی کالاها — بیشترین و کمترین موجودی با progress bar رنگ‌بندی‌شده" },
      { type: "feature", text: "بخش کاربران با بیشترین خرید — top buyers از groupBy سفارشات" },
      { type: "feature", text: "آخرین گفتگوها با زمان نسبی و آخرین پیام کاربر" },
      { type: "feature", text: "sparkline در ۴ کارت اصلی — روند ۱۴ روز گذشته" },
      { type: "improvement", text: "۴ کارت اصلی آمار به صورت ۲ ستونه (۲ کارت در هر ردیف)" },
      { type: "improvement", text: "۶ باکس ثانویه (بلاگ، دسته‌بندی، برند، گفتگو، موجودی کل، میانگین سبد) در ۳ ستون" },
      { type: "improvement", text: "نمودار وضعیت سفارشات با فیلتر چیپ تعاملی برای هایلایت هر وضعیت" },
      { type: "improvement", text: "جدول آخرین سفارشات با badge رنگ‌بندی‌شده برای ۱۰ وضعیت مختلف سفارش" },
      { type: "improvement", text: "لینک‌های سریع دسترسی به بخش‌های پرکاربرد ادمین" },
      { type: "improvement", text: "نمودارهای SVG با Catmull-Rom smoothing و gradient fill" },
    ],
  },

  {
    version: "1.8.9",
    date: "1405/03/21",
    tag: "minor",
    title: "رابط کاربری چت — Markdown و دکمه محصول",
    description: "پیام‌های دستیار هوشمند اکنون با قالب‌بندی کامل Markdown نمایش داده می‌شوند؛ لینک‌های محصول به دکمه‌های خرید تبدیل می‌شوند و متون bold و لیست‌ها به‌درستی رندر می‌شوند",
    changes: [
      { type: "feature", text: "رندر Markdown در پیام‌های دستیار — **bold**، لیست‌های آیتم‌دار و فاصله بین پاراگراف‌ها" },
      { type: "feature", text: "لینک‌های /products/* به دکمه بنفش «مشاهده محصول» با آیکون سبد خرید تبدیل می‌شوند" },
      { type: "improvement", text: "آواتار کوچک AI بنفش کنار هر پیام دستیار" },
      { type: "improvement", text: "سایه‌های bubble بهتر و padding بهینه‌تر برای خوانایی بالاتر" },
      { type: "improvement", text: "background پنجره چت: gradient ملایم لاوندری به‌جای خاکستری ساده" },
    ],
  },

  {
    version: "1.8.8",
    date: "1405/03/12",
    tag: "patch",
    title: "رفع دکمه‌های چت در multi-site + کلید API per-site",
    description: "در سرورهای production با چند سایت، دکمه‌های چت همیشه مقادیر تازه از دیتابیس همان سایت می‌خوانند نه مقادیر کش‌شده. کلید API GapGPT اکنون در دیتابیس هر سایت جداگانه ذخیره می‌شود",
    changes: [
      { type: "fix", text: "دکمه‌های quick-reply چت دیگر از localStorage کش نمی‌شوند — همیشه از DB سایت مربوطه می‌آیند" },
      { type: "fix", text: "حذف revalidate=60 از /api/store/chat-config — جایگزینی با force-dynamic برای دریافت تازه از DB" },
      { type: "feature", text: "کلید API GapGPT در دیتابیس هر سایت — هر سایت کلید مستقل خود را دارد" },
      { type: "feature", text: "فیلد «کلید API GapGPT» در صفحه تنظیمات چت ادمین با نمایش/پنهان و هشدار خالی بودن" },
      { type: "security", text: "کلید API هرگز از /api/store/chat-config به client ارسال نمی‌شود" },
    ],
  },

  {
    version: "1.8.7",
    date: "1405/03/04",
    tag: "patch",
    title: "رفع خطاهای TypeScript در احراز هویت",
    description: "رفع خطاهای نوع TypeScript مربوط به JWT_SECRET در فایل‌های auth.ts و proxy.ts",
    changes: [
      { type: "fix", text: "رفع خطای TypeScript: نوع JWT_SECRET از string | undefined به string با assertion تبدیل شد" },
      { type: "fix", text: "رفع خطا در proxy.ts برای پارامترهای JWT" },
    ],
  },

  {
    version: "1.8.6",
    date: "1405/02/28",
    tag: "patch",
    title: "رفع اسکرول افقی در موبایل",
    description: "جلوگیری از اسکرول افقی صفحه در تمام گوشی‌ها با اصلاح overflow سراسری و بازنویسی ساختار منوی موبایل",
    changes: [
      { type: "fix", text: "رفع اسکرول افقی در موبایل با اعمال overflow-x: hidden روی html" },
      { type: "fix", text: "بازنویسی ساختار MobileMenuPortal — panel و overlay از position:fixed به absolute داخل یک wrapper کلیپ‌شده" },
      { type: "improvement", text: "جلوگیری از تأثیر translateX انیمیشن منو بر عرض صفحه در مرورگرهای اندروید" },
    ],
  },

  {
    version: "1.8.5",
    date: "1405/02/25",
    tag: "minor",
    title: "امنیت، لوگو داینامیک و رفع باگ پیامک",
    description: "اعمال بررسی امنیتی کامل بر اساس OWASP Top 10، محافظت از تمام مسیرهای ادمین، ارتقای هش پسورد به bcrypt، rate limiting برای OTP و خواندن لوگو و اطلاعات سایت از تنظیمات",
    changes: [
      { type: "security", text: "محافظت از تمام مسیرهای /api/admin/* با JWT " },
      { type: "security", text: "اعتبارسنجی امضای HMAC توکن در middleware — جلوگیری از جعل توکن" },
      { type: "security", text: "ارتقای هش پسورد از SHA-256 به bcrypt (cost factor 12) با migration خودکار" },
      { type: "security", text: "محدودیت ارسال OTP: حداکثر ۳ بار در ۱۰ دقیقه برای هر شماره" },
      { type: "security", text: "محدودیت تلاش OTP: بعد از ۵ بار کد اشتباه، کد باطل می‌شود" },
      { type: "security", text: "حذف secret های hardcode شده (JWT_SECRET و PASSWORD_SALT) از سورس کد" },
      { type: "security", text: "محدودیت نوع فایل در آپلود: فقط تصاویر تا ۱۰MB مجاز" },
      { type: "fix", text: "رفع باگ عدم ارسال پیامک OTP — smsEnabled" },
      { type: "fix", text: "رفع باگ رشته‌های خالی تنظیمات SMS — تبدیل به NULL برای استفاده صحیح از env" },
      { type: "improvement", text: "لوگو، آیکن و نام سایت از تنظیمات ادمین خوانده می‌شود — اگر تنظیم نشده باشد چیزی نمایش داده نمی‌شود" },
    ],
  },

  {
    version: "1.8.0",
    date: "1405/02/20",
    tag: "minor",
    title: "دستیار هوشمند خرید (چت‌بات)",
    description: "راه‌اندازی کامل چت هوشمند با دکمه‌های هدایت‌گر، اتصال به محصولات و موضوعات فروشگاه و ذخیره تاریخچه گفتگوها",
    changes: [
      { type: "feature", text: "ویجت چت شناور در تمام صفحات فروشگاه با پیام خوش‌آمدگویی قابل تنظیم" },
      { type: "feature", text: "دکمه‌های هدایت‌گر چندسطحی — ساخت درخت نامحدود از دکمه‌ها در پنل ادمین" },
      { type: "feature", text: "اتصال هوشمند سوال کاربر به دسته‌بندی محصولات، گارانتی، ارسال، تماس و آدرس" },
      { type: "feature", text: "پاسخ‌های ثابت بدون مصرف هوش مصنوعی برای سوالات پرتکرار (پاسخ آنی)" },
      { type: "feature", text: "تشخیص هدف کاربر و پرسیدن سوالات تکمیلی قبل از پیشنهاد محصول" },
      { type: "feature", text: "پاسخ‌دهی استریم (لحظه‌ای) با مدل هوش مصنوعی" },
      { type: "feature", text: "صفحه تنظیمات چت در پنل ادمین — اطلاعات تماس، ساعات کاری، شبکه‌های اجتماعی، ارسال، گارانتی و سوالات متداول" },
      { type: "feature", text: "ویرایشگر بصری درخت دکمه‌ها با پیش‌نمایش زنده" },
      { type: "feature", text: "ذخیره تاریخچه گفتگوها در دیتابیس و مشاهده مکالمات کاربران و مهمان‌ها در پنل ادمین" },
      { type: "feature", text: "تنظیم تعداد پیام‌های تاریخچه ارسالی به هوش مصنوعی برای کنترل مصرف توکن" },
      { type: "improvement", text: "حفظ گفتگوی کاربران مهمان پس از رفرش صفحه و در تب‌های جدید" },
      { type: "improvement", text: "بهینه‌سازی مصرف توکن با ارسال هدفمند اطلاعات بر اساس موضوع انتخابی کاربر" },
    ],
  },

  {
    version: "1.7.0",
    date: "1405/02/04",
    tag: "minor",
    title: "تنظیمات ظاهری و رنگ‌بندی سایت و شروع سیستم چت",
    description: "افزودن سیستم کامل مدیریت رنگ‌بندی سایت از پنل ادمین",
    changes: [
      { type: "feature", text: "صفحه تنظیمات ظاهری در پنل ادمین با color picker حرفه‌ای" },
      { type: "feature", text: "پالت‌های رنگی آماده برای انتخاب سریع تم" },
      { type: "feature", text: "تولید خودکار ۱۱ شید رنگی از یک رنگ پایه (primary و secondary)" },
      { type: "feature", text: "پیش‌نمایش زنده تغییرات رنگ قبل از ذخیره" },
      { type: "feature", text: "اعمال رنگ‌بندی برای همه کاربران بدون نیاز به rebuild" },
      { type: "improvement", text: "جایگزینی رنگ‌های hardcoded با CSS variables در کامپوننت‌های فروشگاه" },
      { type: "improvement", text: "ذخیره تنظیمات ظاهری در دیتابیس و inject خودکار در layout" },
      { type: "improvement", text: "سیستم چت هوشمند راه اندازی اولیه" },
    ],
  },

  {
    version: "1.6.0",
    date: "1405/01/20",
    tag: "minor",
    title: "سیستم پیامکی و کیف پول",
    description: "افزودن سیستم پیامکی و مدیریت آن و کیف پول",
    changes: [
      { type: "feature", text: "سیستم کیف پول — مشاهده موجودی و تاریخچه تراکنش‌ها در پروفایل کاربر" },
      { type: "feature", text: "مدیریت کیف پول در پنل ادمین — افزایش و کاهش موجودی کاربران" },
      { type: "feature", text: "پرداخت از کیف پول در مرحله checkout با نمایش موجودی و کسر خودکار" },
      { type: "feature", text: "سیستم پیامک — مدیریت تنظیمات API و کدهای پترن از پنل ادمین" },
      { type: "feature", text: "ارسال خودکار پیامک هنگام تغییر وضعیت سفارش" },
      { type: "improvement", text: "OTP از طریق تنظیمات دیتابیس به‌جای env ثابت" },
    ],
  },

  {
    version: "1.5.0",
    date: "1405/01/06",
    tag: "minor",
    title: "کتابخانه رسانه و سیستم گارانتی",
    description: "افزودن کتابخانه مدیریت فایل‌ها و سیستم کامل گارانتی محصولات",
    changes: [
      { type: "feature", text: "کتابخانه رسانه — آپلود، مشاهده، جستجو و مدیریت انواع فایل (تصویر، ویدیو، صدا، سند)" },
      { type: "feature", text: "آپلود چندفایلی با Drag & Drop در کتابخانه رسانه" },
      { type: "feature", text: "مودال جزئیات فایل با امکان ویرایش عنوان/Alt و کپی آدرس" },
      { type: "feature", text: "حذف گروهی فایل‌ها از کتابخانه رسانه" },
      { type: "feature", text: "سیستم گارانتی — ثبت، مشاهده و ویرایش گارانتی توسط ادمین" },
      { type: "feature", text: "مدیریت درخواست‌های گارانتی با وضعیت‌بندی در پنل ادمین" },
      { type: "feature", text: "صفحه عمومی استعلام گارانتی با شماره ستومان یا موبایل" },
      { type: "feature", text: "ثبت مشکل گارانتی توسط کاربر بدون نیاز به لاگین" },
      { type: "feature", text: "صفحه گارانتی‌های من در پروفایل کاربر" },
      { type: "improvement", text: "صفحه‌بندی سرور-ساید در لیست محصولات ادمین (رفع کندی در سایت‌های با محصول زیاد)" },
      { type: "improvement", text: "جستجو و فیلتر سرور-ساید با debounce در لیست محصولات ادمین" },
    ],
  },

  {
    version: "1.4.3",
    date: "1404/12/21",
    tag: "minor",
    title: "رفع برخی از ایرادات جزئی و بهبودهای کوچک",
    description: "رفع برخی از ایرادات جزئی در نمایش محصولات زیر دسته‌ها، تکمیل Schema.org برای محصولات و اصلاح آدرس‌های canonical و نام فروشگاه در متادیتای سئو",
    changes: [
      { type: "fix", text: "نمایش محصولات زیردسته‌ها هنگام مشاهده دسته‌بندی والد" },
      { type: "fix", text: "تکمیل Schema.org محصولات با شرایط ارسال و بازگشت کالا برای Search Console" },
      { type: "fix", text: "اصلاح آدرس‌های canonical و نام فروشگاه در متادیتای سئو" },
    ],
  },

   {
    version: "1.4.0",
    date: "1404/12/15",
    tag: "minor",
    title: "سیستم ویژگی‌ها و فیلترهای پیشرفته",
    description: "افزودن ساختار کامل ویژگی‌ها، گروه‌بندی ویژگی‌ها، محصولات متغیر و فیلترهای داینامیک فروشگاه",
    changes: [
      { type: "feature", text: "مدیریت گروه ویژگی‌ها در پنل ادمین" },
      { type: "feature", text: "اتصال ویژگی‌ها به دسته‌بندی محصولات" },
      { type: "feature", text: "تعریف ویژگی‌های متغیر برای محصولات" },
      { type: "feature", text: "پشتیبانی از ساخت تنوع‌های محصول بر اساس ویژگی‌ها" },
      { type: "feature", text: "فیلتر ویژگی‌ها در بخش مدیریت محصولات" },
      { type: "feature", text: "فیلتر ویژگی‌های داینامیک در صفحات دسته‌بندی فروشگاه" },
      { type: "improvement", text: "بهینه‌سازی ساختار دیتابیس ویژگی‌ها و ارتباط با دسته‌بندی‌ها" },
      { type: "improvement", text: "بهبود تجربه کاربری فرم ساخت و ویرایش محصولات متغیر" },
      { type: "improvement", text: "نمایش هوشمند فیلترها بر اساس ویژگی‌های فعال هر دسته‌بندی" },
      { type: "improvement", text: "افزایش سرعت جستجو و فیلتر محصولات بر اساس ویژگی‌ها" },
    ],
  },
  
  {
    version: "1.3.0",
    date: "1404/12/01",
    tag: "minor",
    title: "مدیریت پیشرفته محصولات و پنل ادمین",
    description: "بازطراحی کامل رابط کاربری پنل ادمین، محصولات مرتبط، ویرایش گروهی و صفحات حرفه‌ای",
    changes: [
      { type: "feature", text: "محصولات مرتبط — سه ردیف: همین دسته، همین برند، انتخاب دستی" },
      { type: "feature", text: "ویرایش گروهی قیمت — افزایش/کاهش درصدی یا مبلغی برای چند محصول" },
      { type: "feature", text: "ویرایش گروهی موجودی — تنظیم، افزایش یا کاهش موجودی گروهی" },
      { type: "feature", text: "کپی محصول — ساخت کپی از محصول با یک کلیک" },
      { type: "feature", text: "فیلتر محصولات بر اساس دسته‌بندی، برند و وضعیت" },
      { type: "improvement", text: "بازطراحی کامل صفحه ساخت و ویرایش محصول با UX حرفه‌ای" },
      { type: "improvement", text: "بازطراحی صفحه مدیریت برندها با جستجو و UI مدرن" },
      { type: "improvement", text: "بازطراحی صفحه مدیریت دسته‌بندی‌ها با درخت حرفه‌ای" },
      { type: "improvement", text: "بازطراحی صفحه مدیریت جداول مشخصات فنی" },
      { type: "improvement", text: "نمایش محصولات مرتبط در صفحه جزئیات محصول فرانت" },
      { type: "improvement", text: "تب مشخصات فنی به‌عنوان تب پیش‌فرض در جزئیات محصول" },
      { type: "improvement", text: "پنهان شدن تب‌های خالی در صفحه جزئیات محصول" },
    ],
  },
  {
    version: "1.2.0",
    date: "1404/11/18",
    tag: "minor",
    title: "مدیریت موجودی و امنیت",
    description: "افزودن سیستم کنترل موجودی انبار، ورود امن به پنل ادمین و بهبودهای متعدد",
    changes: [
      { type: "feature", text: "سیستم مدیریت موجودی محصول با آستانه هشدار قابل تنظیم" },
      { type: "feature", text: "نمایش «ناموجود» در کارت‌های محصول و صفحه جزئیات" },
      { type: "feature", text: "کسر خودکار موجودی پس از ثبت سفارش" },
      { type: "feature", text: "سیستم احراز هویت پنل ادمین با یوزرنیم و پسورد" },
      { type: "feature", text: "middleware محافظت از مسیرهای ادمین" },
      { type: "feature", text: "صفحه مدیریت ادمین‌ها — افزودن، ویرایش، غیرفعال‌سازی" },
      { type: "feature", text: "آپلود تصویر مستقیم در گالری محصول" },
      { type: "improvement", text: "تم روشن/تاریک در تمام بخش‌های پنل ادمین" },
      { type: "improvement", text: "داشبورد ادمین با نمودار روزانه سفارشات SVG برداری" },
    ],
  },
  {
    version: "1.1.0",
    date: "1404/10/28",
    tag: "minor",
    title: "علاقه‌مندی‌ها و فوتر موبایل",
    description: "افزودن سیستم علاقه‌مندی‌ها، فوتر موبایل و بهبود تجربه کاربری",
    changes: [
      { type: "feature", text: "سیستم کامل علاقه‌مندی‌ها با Context و API" },
      { type: "feature", text: "آیکن علاقه‌مندی در هدر دسکتاپ با نمایش تعداد" },
      { type: "feature", text: "صفحه علاقه‌مندی‌های کاربر" },
      { type: "feature", text: "فوتر موبایل با دسترسی سریع به سبد خرید، علاقه‌مندی و پشتیبانی" },
      { type: "feature", text: "بازنویسی Hero با پیشنهادات لحظه‌ای داینامیک از DB" },
      { type: "improvement", text: "دکمه علاقه‌مندی در کارت محصولات و صفحه جزئیات" },
      { type: "improvement", text: "اضافه شدن ویجت HERO_SLIDER، STORY و LATEST_ARTICLES به ادمین" },
    ],
  },
  {
    version: "1.0.0",
    date: "1404/10/15",
    tag: "major",
    title: "اولین نسخه پایدار",
    description: "راه‌اندازی کامل فروشگاه اینترنتی با تمام امکانات پایه",
    changes: [
      { type: "feature", text: "فروشگاه اینترنتی کامل با Next.js 16 و Prisma 7" },
      { type: "feature", text: "سیستم سبد خرید و checkout کامل" },
      { type: "feature", text: "مدیریت سفارشات در پنل ادمین" },
      { type: "feature", text: "منوی هدر با مگامنو و جستجوی لایو" },
      { type: "feature", text: "بلاگ/مجله با TipTap" },
      { type: "feature", text: "فوتر داینامیک و تنظیمات سایت" },
      { type: "feature", text: "SEO کامل با Schema.org" },
      { type: "feature", text: "سیستم ویجت برای مدیریت صفحه اصلی" },
    ],
  },
];

const TAG_CONFIG = {
  major: { label: "Major", color: "bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800" },
  minor: { label: "Minor", color: "bg-blue-100 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800" },
  patch: { label: "Patch", color: "bg-emerald-100 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800" },
};

const CHANGE_CONFIG = {
  feature:     { label: "قابلیت جدید", color: "text-blue-600 dark:text-blue-400",    bg: "bg-blue-50 dark:bg-blue-900/10",    icon: "✦" },
  improvement: { label: "بهبود",        color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-900/10", icon: "↑" },
  fix:         { label: "رفع باگ",      color: "text-amber-600 dark:text-amber-400",  bg: "bg-amber-50 dark:bg-amber-900/10",  icon: "✓" },
  security:    { label: "امنیت",        color: "text-purple-600 dark:text-purple-400", bg: "bg-purple-50 dark:bg-purple-900/10", icon: "🔒" },
};

export default function ChangelogPage() {
  const latest = VERSIONS[0];

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-8" dir="rtl">

      {}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900 dark:text-white">نسخه‌های برنامه</h1>
          <p className="text-sm text-gray-500 mt-1">تاریخچه تغییرات و بروزرسانی‌های سیستم</p>
        </div>
        <div className="bg-gradient-to-br from-blue-600 to-indigo-600 rounded-2xl px-5 py-3 text-white shadow-lg shadow-blue-500/30">
          <p className="text-[10px] font-bold opacity-70 mb-0.5">نسخه فعلی</p>
          <p className="text-2xl font-black tracking-tight">{latest.version}</p>
          <p className="text-[10px] opacity-70 mt-0.5">{latest.date}</p>
        </div>
      </div>

      {}
      <div className="relative">
        <div className="absolute right-[22px] top-8 bottom-8 w-px bg-gray-200 dark:bg-white/[0.06]" />

        <div className="space-y-6">
          {VERSIONS.map((v, idx) => {
            const tag = TAG_CONFIG[v.tag as keyof typeof TAG_CONFIG];
            const isLatest = idx === 0;

            return (
              <div key={v.version} className="relative flex gap-6">
                <div className={`relative z-10 flex-shrink-0 w-11 h-11 rounded-full flex items-center justify-center font-black text-xs shadow-lg ${
                  isLatest
                    ? "bg-blue-600 text-white shadow-blue-500/40"
                    : "bg-white dark:bg-[#0f1117] border-2 border-gray-200 dark:border-white/10 text-gray-500 dark:text-gray-400"
                }`}>
                  {isLatest ? "🔥" : "●"}
                </div>

                <div className={`flex-1 rounded-2xl border overflow-hidden ${
                  isLatest
                    ? "bg-white dark:bg-[#0f1117] border-blue-200 dark:border-blue-500/20 shadow-xl shadow-blue-500/5"
                    : "bg-white dark:bg-[#0f1117] border-gray-200 dark:border-white/[0.06]"
                }`}>
                  <div className={`p-5 border-b ${isLatest ? "border-blue-100 dark:border-blue-500/10" : "border-gray-100 dark:border-white/[0.04]"}`}>
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="flex items-center gap-3">
                        <span className="text-xl font-black text-gray-900 dark:text-white tracking-tight">
                          v{v.version}
                        </span>
                        {isLatest && (
                          <span className="text-[10px] font-black px-2.5 py-1 rounded-full bg-blue-600 text-white shadow shadow-blue-500/30">
                            جدیدترین
                          </span>
                        )}
                        <span className={`text-[10px] font-black px-2.5 py-1 rounded-full border ${tag.color}`}>
                          {tag.label}
                        </span>
                      </div>
                      <span className="text-xs text-gray-400 font-bold">{v.date}</span>
                    </div>
                    <h3 className="text-base font-black text-gray-900 dark:text-white mt-2">{v.title}</h3>
                    <p className="text-sm text-gray-500 mt-1 leading-6">{v.description}</p>
                  </div>

                  <div className="p-5">
                    <div className="space-y-2">
                      {v.changes.map((change, i) => {
                        const cfg = CHANGE_CONFIG[change.type as keyof typeof CHANGE_CONFIG];
                        return (
                          <div key={i} className={`flex items-start gap-3 px-3 py-2.5 rounded-xl ${cfg.bg}`}>
                            <span className={`text-[11px] font-black flex-shrink-0 mt-0.5 ${cfg.color}`}>
                              {cfg.icon}
                            </span>
                            <span className="text-sm text-gray-700 dark:text-gray-300 leading-6">
                              {change.text}
                            </span>
                            <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-md flex-shrink-0 mt-1 ${cfg.color} opacity-60`}>
                              {cfg.label}
                            </span>
                          </div>
                        );
                      })}
                    </div>

                    <div className="flex items-center gap-4 mt-4 pt-4 border-t border-gray-100 dark:border-white/[0.04]">
                      {Object.entries(
                        v.changes.reduce((acc, c) => {
                          acc[c.type] = (acc[c.type] || 0) + 1;
                          return acc;
                        }, {} as Record<string, number>)
                      ).map(([type, count]) => {
                        const cfg = CHANGE_CONFIG[type as keyof typeof CHANGE_CONFIG];
                        if (!cfg) return null;
                        return (
                          <div key={type} className="flex items-center gap-1.5">
                            <span className={`text-[10px] font-black ${cfg.color}`}>{cfg.icon}</span>
                            <span className="text-[11px] font-bold text-gray-500">{count} {cfg.label}</span>
                          </div>
                        );
                      })}
                      <span className="text-[11px] text-gray-400 mr-auto">{v.changes.length} تغییر کل</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
