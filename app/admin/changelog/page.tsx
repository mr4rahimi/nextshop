"use client";

const VERSIONS = [

  {
    version: "1.4.3",
    date: "۱۴۰۴/۰۳/24",
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
    date: "۱۴۰۴/۰۳/۱۸",
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
    date: "۱۴۰۴/۰۳/۰۷",
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
    date: "۱۴۰۴/۰۳/۰۵",
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
    date: "۱۴۰۴/۰۲/۲۸",
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
    date: "۱۴۰۴/۰۲/۱۰",
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

      {/* هدر */}
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

      {/* لیست نسخه‌ها */}
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