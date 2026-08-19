"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { useTheme } from "@/components/layout/ThemeProvider";
import CartIcon from "@/components/store/cart/CartIcon";
import WishlistIcon from "@/components/store/wishlist/WishlistIcon";
import SearchBox from "@/components/store/SearchBox";
import HeaderMenu from "@/components/layout/HeaderMenu";
import {
  DEFAULT_GLASS_CONFIG,
  hexToRgbChannels,
  normalizeGlassConfig,
  type GlassHeaderConfig,
} from "./registry";

/**
 * هدر شیشه‌ای — روی کل صفحات سایت اعمال می‌شود.
 *
 * تفاوت‌ها با هدر پیش‌فرض:
 *  ۱) پس‌زمینه‌ی شفاف/شیشه‌ای که با اسکرول شفافیت و شدت بلورش تغییر می‌کند
 *     (رنگ متن بر اساس حالت روز/شب سایت عوض می‌شود).
 *  ۲) در موبایل ابتدا دو ردیف است؛ ردیف دوم یک کادر جستجوی تمام‌عرض است.
 *     با اسکرول، کادر جستجو با انیمیشن به آیکن جستجوی ردیف اول تبدیل و هدر یک‌ردیفه می‌شود.
 *
 * شفافیت، بلور و رنگ‌بندی از پنل ادمین (تنظیمات سایت ← تب هدر) قابل ویرایش است.
 */

const CSS = `
/* رنگ‌ها با کلاس .dark روی <html> سوییچ می‌شوند تا هنگام لود flash نداشته باشیم */
.ghd-root{
  --ghd-tint:var(--ghd-tint-light);
  --ghd-text:var(--ghd-text-light);
  --ghd-text-rgb:var(--ghd-text-rgb-light);
  --ghd-alpha:var(--ghd-alpha-top);
  --ghd-blur:var(--ghd-blur-top);
  --ghd-border:rgba(var(--ghd-text-rgb), var(--ghd-border-alpha));
}
.dark .ghd-root{
  --ghd-tint:var(--ghd-tint-dark);
  --ghd-text:var(--ghd-text-dark);
  --ghd-text-rgb:var(--ghd-text-rgb-dark);
}
/* پس‌زمینه‌ی صفحه پشتِ هدر.
   در globals.css رنگ body همیشه سفید است و رنگ تیره فقط روی <main> (یعنی زیر هدر) می‌نشیند؛
   بدون این قانون، backdrop-filter هدر در بالای صفحه روی سفید محاسبه می‌شد و هدر در حالت شب روشن دیده می‌شد.
   این قوانین فقط تا وقتی روی صفحه هستند که هدر شیشه‌ای فعال باشد. */
html body:has(.ghd-root){background-color:#f3f4f6}
html.dark body:has(.ghd-root){background-color:#050505}

.ghd-root{
  position:sticky;top:0;z-index:40;
  /* clip (نه hidden) تا سرریز افقی به صفحه منتقل نشود ولی نتایج جستجو بتوانند عمودی بیرون بزنند */
  overflow-x:clip;
  color:var(--ghd-text);
  background:rgba(var(--ghd-tint), var(--ghd-alpha));
  -webkit-backdrop-filter:blur(var(--ghd-blur)) saturate(160%);
  backdrop-filter:blur(var(--ghd-blur)) saturate(160%);
  border-bottom:1px solid var(--ghd-border);
  transition:background-color .45s ease, backdrop-filter .45s ease, box-shadow .45s ease, border-color .45s ease;
}
.ghd-root[data-scrolled="true"]{
  --ghd-alpha:var(--ghd-alpha-scrolled);
  --ghd-blur:var(--ghd-blur-scrolled);
  box-shadow:0 8px 32px -12px rgba(0,0,0,.25);
}

/* رنگ متن و آیکن‌ها بر اساس تنظیمات ادمین (روز/شب) */
.ghd-root a,
.ghd-root button,
.ghd-actions > a{color:var(--ghd-text)}
.ghd-root .ghd-icon-btn{
  background:rgba(var(--ghd-tint), .10);
  border:1px solid var(--ghd-border);
  backdrop-filter:blur(6px);
  transition:background-color .25s, border-color .25s, transform .25s;
}
.ghd-root .ghd-icon-btn:hover{background:rgba(var(--ghd-tint), .22)}
.ghd-actions > a{
  background:rgba(var(--ghd-tint), .10)!important;
  border-color:var(--ghd-border)!important;
}

/* منوی دسکتاپ داخل هدر شیشه‌ای باید شفاف بماند */
.ghd-nav > nav{background:transparent;border-top:1px solid var(--ghd-border)}

/* ── ردیف جستجوی موبایل و انیمیشن تبدیل به آیکن ── */
.ghd-searchrow{
  overflow:hidden;
  height:var(--ghd-searchrow-h);
  opacity:1;
  transition:height .45s cubic-bezier(.4,0,.2,1), opacity .3s ease, transform .45s cubic-bezier(.4,0,.2,1);
  transform-origin:left center;
}
.ghd-root[data-scrolled="true"] .ghd-searchrow{
  height:0;
  opacity:0;
  transform:scale(.55) translateY(-14px);
}
.ghd-searchrow .ghd-msearch input{
  padding-top:.7rem;padding-bottom:.7rem;
  background:rgba(var(--ghd-tint), .16);
  border-color:var(--ghd-border);
  color:var(--ghd-text);
}

/* آیکن جستجوی ردیف اول — فقط بعد از اسکرول در موبایل ظاهر می‌شود */
.ghd-searchbtn{
  width:0;padding:0;margin:0;border-width:0;
  opacity:0;transform:scale(.4);pointer-events:none;
  overflow:hidden;
  transition:width .45s cubic-bezier(.4,0,.2,1), opacity .3s ease .12s, transform .45s cubic-bezier(.4,0,.2,1);
}
.ghd-root[data-scrolled="true"] .ghd-searchbtn{
  width:2.75rem;padding:.625rem;border-width:1px;
  opacity:1;transform:scale(1);pointer-events:auto;
}

@media (min-width:768px){
  .ghd-searchrow{display:none}
  .ghd-searchbtn{display:none}
}

/* ── ردیف منوی دسکتاپ: جمع‌شدن با اسکرول رو به پایین ── */
@media (min-width:1024px){
  .ghd-nav{
    height:var(--ghd-navrow-h);
    opacity:1;
    transition:height .4s cubic-bezier(.4,0,.2,1), opacity .25s ease;
  }
  /* فقط هنگام جمع‌بودن یا در حین انیمیشن کلیپ می‌شود؛
     در حالت باز باید overflow آزاد بماند تا مگامنو (absolute) بریده نشود */
  .ghd-nav.ghd-nav-clip{overflow:hidden}
  .ghd-root[data-navhidden="true"] .ghd-nav{height:0;opacity:0;pointer-events:none}
}

@media (prefers-reduced-motion:reduce){
  .ghd-nav{transition-duration:.01ms}
}
@media (prefers-reduced-motion:reduce){
  .ghd-root,.ghd-searchrow,.ghd-searchbtn{transition-duration:.01ms}
}
`;

export default function GlassHeader({
  logoUrl,
  siteName,
  config,
}: {
  logoUrl: string | null;
  siteName: string | null;
  config?: GlassHeaderConfig | null;
}) {
  const cfg = normalizeGlassConfig(config ?? DEFAULT_GLASS_CONFIG);
  const { toggle } = useTheme();
  const [scrolled, setScrolled] = useState(false);
  // ردیف منوی دسکتاپ: با اسکرول رو به پایین جمع می‌شود، با اسکرول رو به بالا یا در بالای صفحه برمی‌گردد
  const [navHidden, setNavHidden] = useState(false);
  const [navAnimating, setNavAnimating] = useState(false);
  const [navH, setNavH] = useState<number | null>(null);
  const lastY = useRef(0);
  const navWrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const SHOW_ABOVE = 90; // بالاتر از این نقطه، منو همیشه باز است
    const DELTA = 6;       // حداقل جابه‌جایی برای تشخیص جهت (لرزش اسکرول را نادیده می‌گیرد)

    const onScroll = () => {
      const y = window.scrollY;
      setScrolled(y > 40);

      if (y <= SHOW_ABOVE) {
        setNavHidden(false);
        lastY.current = y;
        return;
      }
      const diff = y - lastY.current;
      if (Math.abs(diff) < DELTA) return;
      setNavHidden(diff > 0);
      lastY.current = y;
    };

    lastY.current = window.scrollY;
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // ارتفاع واقعی نوار منو را اندازه می‌گیریم (محتوای منو با fetch می‌آید و ارتفاعش ثابت نیست)
  useEffect(() => {
    const el = navWrapRef.current?.firstElementChild as HTMLElement | null;
    if (!el) return;
    const update = () => setNavH(el.offsetHeight || null);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // overflow فقط در حین انیمیشن و در حالت جمع‌شده کلیپ می‌شود
  useEffect(() => {
    setNavAnimating(true);
    const t = setTimeout(() => setNavAnimating(false), 450);
    return () => clearTimeout(t);
  }, [navHidden]);

  // فقط مقادیر «ورودی» به‌صورت inline ست می‌شوند؛ متغیرهای فعال در CSS مشتق می‌شوند
  // (وگرنه inline style روی قانون [data-scrolled] غالب می‌شد و انیمیشن اسکرول کار نمی‌کرد)
  const vars = {
    "--ghd-tint-light": hexToRgbChannels(cfg.tintLight),
    "--ghd-tint-dark": hexToRgbChannels(cfg.tintDark),
    "--ghd-text-light": cfg.textLight,
    "--ghd-text-dark": cfg.textDark,
    "--ghd-text-rgb-light": hexToRgbChannels(cfg.textLight),
    "--ghd-text-rgb-dark": hexToRgbChannels(cfg.textDark),
    "--ghd-alpha-top": cfg.opacityTop / 100,
    "--ghd-alpha-scrolled": cfg.opacityScrolled / 100,
    "--ghd-blur-top": `${cfg.blurTop}px`,
    "--ghd-blur-scrolled": `${cfg.blurScrolled}px`,
    "--ghd-border-alpha": cfg.showBorder ? 0.16 : 0,
    "--ghd-searchrow-h": "3.75rem",
    "--ghd-navrow-h": navH ? `${navH}px` : "auto",
  } as React.CSSProperties;

  return (
    <>
      <header className="ghd-root" data-scrolled={scrolled} data-navhidden={navHidden} style={vars}>
        <style dangerouslySetInnerHTML={{ __html: CSS }} />

        {/* ── ردیف اول ── */}
        <div className="container">
          <div className="flex items-center justify-between h-20 gap-2 md:gap-8">

            {/* راست: همبرگری + لوگو */}
            <div className="flex items-center gap-2 md:gap-4 min-w-0">
              <button
                onClick={() => window.dispatchEvent(new Event("toggle-mobile-menu"))}
                className="ghd-icon-btn lg:hidden p-2 md:p-2.5 rounded-xl flex-shrink-0"
                aria-label="منو"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 12h16m-7 6h7" />
                </svg>
              </button>

              <Link href="/" className="flex items-center gap-2 min-w-0" aria-label={siteName ?? "صفحه اصلی"}>
                {logoUrl
                  ? <Image src={logoUrl} width={112} height={40} className="h-8 md:h-10 w-auto max-w-[100px] md:max-w-none object-contain" alt={siteName || "فروشگاه"} priority />
                  : <span className="text-base md:text-lg font-black truncate">{siteName || "فروشگاه"}</span>
                }
              </Link>
            </div>

            {/* وسط: جستجوی دسکتاپ */}
            <div className="hidden md:flex flex-1 max-w-4xl relative mx-auto">
              <SearchBox />
            </div>

            {/* چپ: حالت نمایش + حساب + علاقه‌مندی + جستجو + سبد */}
            <div className="ghd-actions flex items-center gap-2 md:gap-3 flex-shrink-0">

              <button
                onClick={toggle}
                aria-label="تغییر حالت نمایش"
                className="ghd-icon-btn p-2 md:p-2.5 rounded-xl shadow-sm flex-shrink-0"
              >
                {/* خورشید — حالت شب */}
                <svg className="w-5 h-5 hidden dark:block" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 9H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m12.728 0l-.707-.707M6.343 6.343l-.707-.707M12 8a4 4 0 100 8 4 4 0 000-8z" />
                </svg>
                {/* ماه — حالت روز */}
                <svg className="w-5 h-5 block dark:hidden" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
              </button>

              <Link href="/user" aria-label="حساب کاربری" className="ghd-icon-btn flex items-center gap-2 px-2 md:px-2.5 lg:px-4 py-2.5 rounded-xl shadow-sm flex-shrink-0">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                <span className="text-xs font-black hidden lg:block uppercase tracking-tighter">حساب کاربری</span>
              </Link>

              <div className="hidden md:block">
                <WishlistIcon />
              </div>

              {/* آیکن جستجو — نتیجه‌ی morph شدن نوار جستجوی ردیف دوم */}
              <Link href="/search" aria-label="جستجو" className="ghd-searchbtn ghd-icon-btn rounded-xl">
                <svg className="w-5 h-5 min-w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" strokeWidth={2.5} />
                </svg>
              </Link>

              <CartIcon />
            </div>
          </div>
        </div>

        {/* ── ردیف دوم (فقط موبایل): جستجوی تمام‌عرض ── */}
        <div className="ghd-searchrow">
          <div className="container pb-3">
            <div className="ghd-msearch">
              <SearchBox />
            </div>
          </div>
        </div>

        {/* ── منوی دسکتاپ ── */}
        <div
          ref={navWrapRef}
          className={`ghd-nav${navHidden || navAnimating ? " ghd-nav-clip" : ""}`}
        >
          <HeaderMenu />
        </div>
      </header>
    </>
  );
}
