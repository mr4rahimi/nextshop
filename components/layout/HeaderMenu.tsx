"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

interface Sub { id: string; title: string; slug: string; imageUrl: string | null; }
interface MegaCat {
  id: string; isActive: boolean;
  category: { id: string; title: string; slug: string; imageUrl: string | null; children: Sub[]; };
}
interface MenuItem { id: string; title: string; url: string | null; openInNewTab: boolean; }

export default function HeaderMenu() {
  const [megaCats, setMegaCats]     = useState<MegaCat[]>([]);
  const [menuItems, setMenuItems]   = useState<MenuItem[]>([]);
  const [activeMega, setActiveMega] = useState<string | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    fetch("/api/store/header-menu").then(r => r.json()).then(d => {
      setMegaCats(d.megaMenuCats ?? []);
      setMenuItems(d.menuItems ?? []);
    });
  }, []);

  const activeCat = megaCats.find(m => m.category.id === activeMega)?.category ?? megaCats[0]?.category;

  function megaEnter(id: string) { clearTimeout(timeoutRef.current); setActiveMega(id); }
  function megaLeave() { timeoutRef.current = setTimeout(() => setActiveMega(null), 150); }

  return (
    <nav className="hidden lg:block bg-white/50 dark:bg-gray-950/50 border-t border-gray-100 dark:border-gray-800">
      <div className="container">
        <ul className="flex items-center gap-1 py-2" dir="rtl">

          {/* مگامنو */}
          {megaCats.length > 0 && (
            <li className="relative" onMouseLeave={megaLeave}>
              <button onMouseEnter={() => megaEnter(megaCats[0].category.id)}
                className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-black transition-all ${activeMega ? "bg-primary-500/10 text-primary-600 dark:text-primary-400" : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/5"}`}>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
                </svg>
                دسته‌بندی کالا
                <svg className={`w-3 h-3 transition-transform ${activeMega ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {activeMega && (
                <div
                  onMouseEnter={() => clearTimeout(timeoutRef.current)}
                  onMouseLeave={megaLeave}
                  className="absolute top-full right-0 mt-2 w-[900px] rounded-3xl border border-gray-100 dark:border-white/10 bg-white/95 dark:bg-gray-900/95 backdrop-blur-2xl shadow-2xl overflow-hidden z-50"
                >
                  <div className="flex" style={{ maxHeight: "min(500px, calc(100vh - 120px))" }}>
                    {/* ستون دسته‌ها */}
                    <div className="w-70 bg-gray-50/80 dark:bg-gray-800/40 border-l border-gray-100 dark:border-white/5 py-2 overflow-y-auto flex-shrink-0">
                      {megaCats.map(m => (
                        <button key={m.category.id} onMouseEnter={() => megaEnter(m.category.id)}
                          className={`w-full flex items-center gap-3 px-4 py-3 text-right transition-all ${activeMega === m.category.id ? "bg-white dark:bg-gray-900 text-primary-600 dark:text-primary-400" : "text-gray-700 dark:text-gray-300 hover:bg-white/80 dark:hover:bg-gray-900/60"}`}>
                          <div className="w-7 h-7 rounded-lg overflow-hidden flex-shrink-0 bg-primary-500/10 flex items-center justify-center">
                            {m.category.imageUrl
                              ? <img src={m.category.imageUrl} alt="" className="w-full h-full object-cover" />
                              : <span className="text-[10px] font-black text-primary-600">{m.category.title.charAt(0)}</span>
                            }
                          </div>
                          <span className="text-sm font-black truncate flex-1">{m.category.title}</span>
                          <svg className="w-3 h-3 opacity-30 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
                          </svg>
                        </button>
                      ))}
                    </div>

                    {/* محتوای دسته فعال */}
                    {activeCat && (
                      <div className="flex-1 flex gap-5 p-6 overflow-hidden">
                        <div className="flex-1 overflow-y-auto">
                          <div className="flex items-center gap-2 mb-4 pb-3 border-b border-gray-100 dark:border-white/5">
                            <span className="text-base font-black text-gray-900 dark:text-white">{activeCat.title}</span>
                            <Link href={`/categories/${activeCat.slug}`}
                              className="text-[10px] font-black text-primary-600 bg-primary-500/10 px-2.5 py-1 rounded-lg hover:bg-primary-500/20 transition-all mr-auto">
                              مشاهده همه ←
                            </Link>
                          </div>
                          <div className="grid grid-cols-3 gap-x-4 gap-y-0.5">
                            {activeCat.children.map(c => (
                              <Link key={c.id} href={`/categories/${c.slug}`}
                                className="flex items-center gap-2.5 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors group">
                                <span className="w-1.5 h-1.5 rounded-full bg-gray-300 dark:bg-gray-600 group-hover:bg-primary-500 transition-colors flex-shrink-0" />
                                {c.title}
                              </Link>
                            ))}
                          </div>
                        </div>
                        {/* تصویر */}
                        <div className="w-36 flex-shrink-0">
                          <Link href={`/categories/${activeCat.slug}`}
                            className="block relative rounded-2xl overflow-hidden bg-gray-100 dark:bg-gray-800 aspect-square group shadow-md">
                            {activeCat.imageUrl
                              ? <img src={activeCat.imageUrl} alt={activeCat.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                              : <div className="w-full h-full flex items-center justify-center">
                                  <svg className="w-14 h-14 text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                  </svg>
                                </div>
                            }
                            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                            <span className="absolute bottom-2 right-2 left-2 text-white text-[10px] font-black opacity-0 group-hover:opacity-100 transition-opacity">{activeCat.title}</span>
                          </Link>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </li>
          )}

          {/* لینک‌های منو */}
          {menuItems.map(item => (
            <li key={item.id}>
              <Link href={item.url ?? "#"} target={item.openInNewTab ? "_blank" : undefined} rel={item.openInNewTab ? "noopener noreferrer" : undefined}
                className="px-4 py-2.5 rounded-xl text-sm font-bold text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5 hover:text-primary-600 dark:hover:text-primary-400 transition-all">
                {item.title}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
}
