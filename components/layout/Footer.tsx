"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";

interface FooterItem { id: string; label: string; url: string | null; }
interface FooterColumn {
  id: string; title: string; type: string; sortOrder: number;
  items: FooterItem[];
}
interface FooterSettings {
  storeName: string; storeLogo: string | null;
  siteDescription: string | null;
  siteEmail: string | null; sitePhone: string | null; siteAddress: string | null;
  footerText: string | null;
  socialInstagram: string | null; socialTelegram: string | null;
  socialWhatsapp: string | null; socialTwitter: string | null;
  enamadCode: string | null; samanCode: string | null;
  trustBadge3: string | null; trustBadge4: string | null;
}
interface FooterData {
  columns: FooterColumn[];
  settings: FooterSettings;
  categories: { id: string; title: string; slug: string }[];
}

function SocialIcon({ type }: { type: string }) {
  const icons: Record<string, string> = {
    instagram: "M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z",
    telegram: "M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.562 8.248l-2.026 9.546c-.148.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12L7.18 14.71l-2.965-.924c-.645-.204-.657-.645.136-.953l11.57-4.461c.537-.194 1.006.131.641.876z",
    whatsapp: "M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z",
    twitter: "M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.748l7.73-8.835L1.254 2.25H8.08l4.259 5.631z",
  };
  return <path d={icons[type] ?? ""} />;
}

export default function Footer() {
  const [data, setData] = useState<FooterData | null>(null);

  useEffect(() => {
    fetch("/api/store/footer").then(r => r.json()).then(setData);
  }, []);

  if (!data) return null;
  const { columns, settings, categories } = data;
  const activeColumns = columns.filter(c => c.type !== "LINKS" || true);
  const colCount = activeColumns.length;

  const socials = [
    { key: "instagram", url: settings.socialInstagram, label: "اینستاگرام", color: "hover:text-pink-500 hover:bg-pink-500/10" },
    { key: "telegram",  url: settings.socialTelegram,  label: "تلگرام",     color: "hover:text-primary-400 hover:bg-blue-400/10" },
    { key: "whatsapp",  url: settings.socialWhatsapp,  label: "واتساپ",     color: "hover:text-green-500 hover:bg-green-500/10" },
    { key: "twitter",   url: settings.socialTwitter,   label: "توییتر",     color: "hover:text-sky-400 hover:bg-sky-400/10" },
  ].filter(s => s.url);

  const trustBadges = [
    { code: settings.enamadCode, type: "enamad", label: "اینماد" },
    { code: settings.samanCode,  type: "saman",  label: "ساماندهی" },
    { code: settings.trustBadge3, type: "img",   label: "نماد ۳" },
    { code: settings.trustBadge4, type: "img",   label: "نماد ۴" },
  ].filter(b => b.code);

  return (
    <footer className="relative bg-gray-950 dark:bg-gray-950 text-gray-400 overflow-hidden" dir="rtl">

      {}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary-500/50 to-transparent" />

      {}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-96 bg-primary-600/5 rounded-full blur-[100px] pointer-events-none" />

      {}
      <div className="container relative z-10 py-16">
        {colCount === 0 ? (
          <p className="text-center text-sm opacity-40 py-8">فوتر پیکربندی نشده</p>
        ) : (
          <div className={`grid gap-12 ${
            colCount === 1 ? "grid-cols-1" :
            colCount === 2 ? "grid-cols-1 md:grid-cols-2" :
            colCount === 3 ? "grid-cols-1 md:grid-cols-3" :
            colCount === 4 ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4" :
            "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5"
          }`}>
            {activeColumns.map(col => (
              <div key={col.id} className={col.type === "BRAND" ? "sm:col-span-2 lg:col-span-1" : ""}>

                {/* ── BRAND ───────────────────────────────────── */}
                {col.type === "BRAND" && (
                  <div className="space-y-6">
                    {}
                    {settings.storeLogo ? (
                      <Link href="/">
                        <Image src={settings.storeLogo} alt={settings.storeName ?? ""} width={160} height={40} className="h-10 w-auto brightness-0 invert opacity-90 hover:opacity-100 transition-opacity" />
                      </Link>
                    ) : (
                      <Link href="/" className="text-2xl font-black text-white">{settings.storeName}</Link>
                    )}
                    {}
                    {settings.siteDescription && (
                      <p className="text-sm leading-relaxed text-gray-500 max-w-xs">{settings.siteDescription}</p>
                    )}
                    {}
                    {socials.length > 0 && (
                      <div className="flex items-center gap-2 flex-wrap">
                        {socials.map(s => (
                          <a key={s.key} href={s.url!} target="_blank" rel="noopener noreferrer"
                            title={s.label}
                            className={`w-10 h-10 rounded-xl bg-white/5 border border-white/10 text-gray-500 flex items-center justify-center transition-all ${s.color}`}>
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                              <SocialIcon type={s.key} />
                            </svg>
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* ── LINKS ───────────────────────────────────── */}
                {col.type === "LINKS" && (
                  <div className="space-y-5">
                    <div className="flex items-center gap-3">
                      <span className="w-1 h-5 bg-primary-500 rounded-full shadow-[0_0_8px_rgba(59,130,246,0.8)]" />
                      <h4 className="text-sm font-black text-white">{col.title}</h4>
                    </div>
                    <ul className="space-y-2.5">
                      {col.items.map(item => (
                        <li key={item.id}>
                          <Link href={item.url ?? "#"}
                            className="flex items-center gap-2.5 text-sm text-gray-500 hover:text-primary-400 transition-colors group">
                            <svg className="w-3 h-3 text-gray-700 group-hover:text-primary-500 transition-colors flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 19l-7-7 7-7" />
                            </svg>
                            {item.label}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* ── CATEGORIES ──────────────────────────────── */}
                {col.type === "CATEGORIES" && (
                  <div className="space-y-5">
                    <div className="flex items-center gap-3">
                      <span className="w-1 h-5 bg-primary-500 rounded-full shadow-[0_0_8px_rgba(59,130,246,0.8)]" />
                      <h4 className="text-sm font-black text-white">{col.title}</h4>
                    </div>
                    <ul className="space-y-2.5">
                      {categories.map(cat => (
                        <li key={cat.id}>
                          <Link href={`/categories/${cat.slug}`}
                            className="flex items-center gap-2.5 text-sm text-gray-500 hover:text-primary-400 transition-colors group">
                            <svg className="w-3 h-3 text-gray-700 group-hover:text-primary-500 transition-colors flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 19l-7-7 7-7" />
                            </svg>
                            {cat.title}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* ── CONTACT ─────────────────────────────────── */}
                {col.type === "CONTACT" && (
                  <div className="space-y-5">
                    <div className="flex items-center gap-3">
                      <span className="w-1 h-5 bg-primary-500 rounded-full shadow-[0_0_8px_rgba(59,130,246,0.8)]" />
                      <h4 className="text-sm font-black text-white">{col.title}</h4>
                    </div>

                    <div className="space-y-3">
                      {settings.sitePhone && (
                        <a href={`tel:${settings.sitePhone}`}
                          className="flex items-center gap-3 text-sm text-gray-500 hover:text-white transition-colors group">
                          <div className="w-8 h-8 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center flex-shrink-0 group-hover:bg-primary-500/20 group-hover:border-primary-500/30 transition-all">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                            </svg>
                          </div>
                          <span dir="ltr">{settings.sitePhone}</span>
                        </a>
                      )}
                      {settings.siteEmail && (
                        <a href={`mailto:${settings.siteEmail}`}
                          className="flex items-center gap-3 text-sm text-gray-500 hover:text-white transition-colors group">
                          <div className="w-8 h-8 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center flex-shrink-0 group-hover:bg-primary-500/20 group-hover:border-primary-500/30 transition-all">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                            </svg>
                          </div>
                          <span dir="ltr">{settings.siteEmail}</span>
                        </a>
                      )}
                      {settings.siteAddress && (
                        <div className="flex items-start gap-3 text-sm text-gray-500">
                          <div className="w-8 h-8 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                          </div>
                          <span className="leading-relaxed">{settings.siteAddress}</span>
                        </div>
                      )}
                    </div>

                    {}
                    {trustBadges.length > 0 && (
                      <div className="pt-2">
                        <p className="text-[10px] font-black text-gray-600 uppercase tracking-widest mb-3">نمادهای اعتماد</p>
                        <div className="flex items-center gap-2 flex-wrap">
                          {trustBadges.map((badge, i) => (
                            <div key={i} className="w-14 h-14 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center overflow-hidden hover:border-white/20 transition-all cursor-pointer"
                              title={badge.label}>
                              {badge.type === "img" ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={badge.code!} alt={badge.label} className="w-full h-full object-contain p-1" />
                              ) : (
                                <div className="text-center p-1"
                                  dangerouslySetInnerHTML={{ __html: badge.code! }} />
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

              </div>
            ))}
          </div>
        )}
      </div>

      {}
      <div className="relative">
        <div className="absolute inset-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      </div>

      {}
      <div className="container relative z-10 py-6">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-gray-600">
            {settings.footerText || `© ${new Date().getFullYear()} ${settings.storeName} — تمامی حقوق محفوظ است`}
          </p>
          <div className="flex items-center gap-4 text-xs text-gray-700">
            <Link href="/products" className="hover:text-gray-400 transition-colors">محصولات</Link>
            <span className="w-1 h-1 rounded-full bg-gray-700" />
            <Link href="#" className="hover:text-gray-400 transition-colors">قوانین و مقررات</Link>
            <span className="w-1 h-1 rounded-full bg-gray-700" />
            <Link href="#" className="hover:text-gray-400 transition-colors">حریم خصوصی</Link>
          </div>
        </div>
      </div>

    </footer>
  );
}
