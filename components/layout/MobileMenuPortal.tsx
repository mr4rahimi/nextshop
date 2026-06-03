"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface Sub { id: string; title: string; slug: string; imageUrl: string | null; }
interface MegaCat {
  id: string; isActive: boolean;
  category: { id: string; title: string; slug: string; imageUrl: string | null; children: Sub[]; };
}
interface MenuItem { id: string; title: string; url: string | null; openInNewTab: boolean; }

export default function MobileMenuPortal({ logoUrl = "/assets/images/logo.png", siteName = "مانا شاپ" }: { logoUrl?: string; siteName?: string }) {
  const [open, setOpen]         = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [megaCats, setMegaCats] = useState<MegaCat[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);

  // لود منو
  useEffect(() => {
    fetch("/api/store/header-menu").then(r => r.json()).then(d => {
      setMegaCats(d.megaMenuCats ?? []);
      setMenuItems(d.menuItems ?? []);
    });
  }, []);

  // listen به event از HeaderTop
  useEffect(() => {
    const toggle = () => setOpen(o => !o);
    window.addEventListener("toggle-mobile-menu", toggle);
    return () => window.removeEventListener("toggle-mobile-menu", toggle);
  }, []);

  // ESC
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  // قفل scroll
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  function close() { setOpen(false); }

  return (
    // این div مستقیماً بعد از <header> در DOM قرار می‌گیره
    // position:fixed + z بالا + هیچ parent با transform/backdrop-filter نداره
    <div className="lg:hidden">
      {/* ── Overlay ─────────────────────────────── */}
      <div
        onClick={close}
        style={{
          position: "fixed", inset: 0, zIndex: 9000,
          background: "rgba(0,0,0,0.5)",
          backdropFilter: "blur(4px)",
          WebkitBackdropFilter: "blur(4px)",
          transition: "opacity 0.35s ease",
          opacity: open ? 1 : 0,
          pointerEvents: open ? "auto" : "none",
        }}
      />

      {/* ── Panel ───────────────────────────────── */}
      <div
        style={{
          position: "fixed",
          top: 0, right: 0, bottom: 0,
          zIndex: 9001,
          width: "min(85vw, 340px)",
          transform: open ? "translateX(0)" : "translateX(110%)",
          transition: "transform 0.4s cubic-bezier(0.32,0.72,0,1)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
        className="bg-white dark:bg-gray-950 shadow-2xl"
        dir="rtl"
      >
        {/* هدر panel */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-white/40 dark:border-gray-800 bg-white/30 dark:bg-gray-900/30 flex-shrink-0">
          <Link href="/" onClick={close}>
            <img src={logoUrl} className="h-8 w-auto max-w-[120px] object-contain" alt={siteName} />
          </Link>
          <button onClick={close}
            className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-400 hover:text-red-500 rounded-xl transition-all border border-transparent hover:border-red-100">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* محتوا */}
        <div className="flex-1 overflow-y-auto">

          {/* بنر ورود */}
          <div className="px-4 py-4">
            <Link href="/user" onClick={close}
              className="flex items-center justify-between p-4 rounded-[1.8rem] bg-gradient-to-br from-primary-600 to-indigo-700 text-white shadow-xl shadow-primary-500/20 active:scale-95 transition-all">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/30">
                  <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <div>
                  <span className="block font-black text-sm">پنل کاربری</span>
                  <span className="block text-[10px] opacity-70 mt-0.5">مشاهده سفارشات و تنظیمات</span>
                </div>
              </div>
              <svg className="w-5 h-5 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
          </div>

          {/* دکمه سبد */}
          <div className="px-4 pb-4">
            <Link href="/cart" onClick={close}
              className="flex items-center gap-3 p-3 rounded-2xl bg-gray-100 dark:bg-white/[0.06] text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-white/10 transition-all active:scale-95">
              <svg className="w-5 h-5 text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              <span className="font-black text-sm">سبد خرید</span>
            </Link>
          </div>

          <nav className="px-3 pb-8">
            {/* دسته‌بندی‌ها */}
            {megaCats.length > 0 && (
              <>
                <div className="flex items-center gap-2 px-3 mb-3">
                  <span className="w-1 h-4 bg-primary-600 rounded-full" />
                  <span className="text-[11px] font-black text-gray-400 uppercase tracking-widest">دسته‌بندی کالاها</span>
                </div>

                <ul className="space-y-2 mb-6">
                  {megaCats.map(m => (
                    <li key={m.category.id}>
                      <button
                        onClick={() => setExpanded(p => p === m.category.id ? null : m.category.id)}
                        className="w-full flex items-center justify-between p-4 rounded-2xl bg-white/40 dark:bg-white/5 border border-white/60 dark:border-white/10 shadow-sm hover:bg-white/60 dark:hover:bg-white/8 transition-all">
                        <div className="flex items-center gap-3 text-gray-800 dark:text-gray-200">
                          {m.category.imageUrl
                            ? <img src={m.category.imageUrl} alt={m.category.title} className="w-6 h-6 rounded-lg object-cover" />
                            : <div className="w-6 h-6 rounded-lg bg-primary-500/20 flex items-center justify-center text-[10px] font-black text-primary-600">{m.category.title.charAt(0)}</div>
                          }
                          <span className="font-black text-sm">{m.category.title}</span>
                        </div>
                        <svg className={`w-4 h-4 text-gray-400 transition-transform duration-300 ${expanded === m.category.id ? "rotate-180" : ""}`}
                          fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>

                      {/* زیردسته‌ها */}
                      <div className={`overflow-hidden transition-all duration-300 ${expanded === m.category.id ? "max-h-[600px]" : "max-h-0"}`}>
                        <ul className="mt-2 mr-2 space-y-1.5 border-r-2 border-primary-500/20 pr-2">
                          <li>
                            <Link href={`/categories/${m.category.slug}`} onClick={close}
                              className="flex items-center gap-2 p-2.5 rounded-xl text-xs font-black text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors">
                              مشاهده همه {m.category.title} ←
                            </Link>
                          </li>
                          {m.category.children.map(child => (
                            <li key={child.id}>
                              <Link href={`/categories/${child.slug}`} onClick={close}
                                className="flex items-center justify-between p-3 rounded-xl bg-white/30 dark:bg-white/5 border border-white/40 dark:border-white/5 hover:bg-primary-50/50 dark:hover:bg-white/8 transition-colors">
                                <span className="font-bold text-xs text-gray-700 dark:text-gray-300">{child.title}</span>
                              </Link>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </li>
                  ))}
                </ul>
              </>
            )}

            {/* لینک‌های منو */}
            {menuItems.length > 0 && (
              <>
                <div className="flex items-center gap-2 px-3 mb-3 mt-4">
                  <span className="w-1 h-4 bg-primary-600 rounded-full" />
                  <span className="text-[11px] font-black text-gray-400 uppercase tracking-widest">منو</span>
                </div>
                <ul className="space-y-2">
                  {menuItems.map(item => (
                    <li key={item.id}>
                      <Link href={item.url ?? "#"} target={item.openInNewTab ? "_blank" : undefined} onClick={close}
                        className="flex items-center gap-3 p-4 rounded-2xl bg-white/40 dark:bg-white/5 border border-white/60 dark:border-white/10 shadow-sm text-gray-800 dark:text-gray-200 font-black text-sm hover:bg-white/60 transition-all">
                        <span className="w-1.5 h-1.5 rounded-full bg-primary-500 flex-shrink-0" />
                        {item.title}
                        {item.openInNewTab && (
                          <svg className="w-3.5 h-3.5 text-gray-400 mr-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                          </svg>
                        )}
                      </Link>
                    </li>
                  ))}
                </ul>
              </>
            )}

            {/* لینک همه محصولات */}
            <div className="mt-6">
              <Link href="/products" onClick={close}
                className="flex items-center gap-3 p-4 rounded-2xl bg-gradient-to-r from-red-500 to-secondary-500 text-white shadow-lg shadow-red-500/20 active:scale-95 transition-all">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                </svg>
                <span className="font-black text-sm">مشاهده همه محصولات</span>
              </Link>
            </div>

            {/* خدمات مشتریان */}
            <div className="flex items-center gap-2 px-3 mt-8 mb-3">
              <span className="w-1 h-4 bg-primary-600 rounded-full" />
              <span className="text-[11px] font-black text-gray-400 uppercase tracking-widest">خدمات مشتریان</span>
            </div>
            <ul className="space-y-2">
              {[
                { label: "پشتیبانی ۲۴ ساعته", href: "#", color: "text-blue-500", icon: "M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" },
                { label: "سوالات متداول", href: "#", color: "text-green-500", icon: "M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" },
                { label: "گارانتی و ضمانت", href: "#", color: "text-purple-500", icon: "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" },
                { label: "بازگرداندن کالا", href: "#", color: "text-red-500", icon: "M3 10h11M3 14h7m10-8v8a2 2 0 01-2 2h-4.586l-1.707 1.707a1 1 0 01-1.414 0L7.586 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2z" },
              ].map(item => (
                <li key={item.label}>
                  <Link href={item.href} onClick={close}
                    className="flex items-center gap-3 p-3 rounded-xl bg-white/40 dark:bg-white/5 border border-white/60 dark:border-white/10 text-gray-700 dark:text-gray-300 text-xs font-bold hover:bg-white/60 transition-all">
                    <svg className={`w-4 h-4 ${item.color}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={item.icon} />
                    </svg>
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </div>
    </div>
  );
}