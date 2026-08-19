import Link from "next/link";
import Image from "next/image";
import { normalizePageBlocks, withToc, type PageTemplate } from "@/lib/pages";
import PageToc from "./PageToc";
import FaqAccordion from "./FaqAccordion";

export interface PageData {
  slug: string;
  title: string;
  subtitle: string | null;
  template: PageTemplate;
  contentHtml: string | null;
  coverImage: string | null;
  blocks: unknown;
  showToc: boolean;
  updatedAt: Date | string;
}

const CARD = "bg-white dark:bg-gray-900/60 backdrop-blur-sm rounded-[2rem] border border-gray-100 dark:border-gray-800";

/** کارت راه ارتباطی — آیکن به‌صورت SVG خطی تا با بقیه‌ی سایت یکدست باشد */
function ContactCard({ icon, label, value, href }: {
  icon: React.ReactNode; label: string; value: string; href?: string;
}) {
  const body = (
    <div className={`${CARD} p-5 flex items-start gap-4 h-full transition-all hover:border-primary-300 dark:hover:border-primary-800 hover:-translate-y-0.5`}>
      <span className="w-11 h-11 rounded-2xl bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400 flex items-center justify-center flex-shrink-0">
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block text-[11px] font-black text-gray-400 mb-1">{label}</span>
        <span className="block text-sm font-black text-gray-900 dark:text-white break-words leading-7">{value}</span>
      </span>
    </div>
  );
  return href ? <a href={href} className="block h-full">{body}</a> : body;
}

const icons = {
  phone: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.95.68l1.5 4.5a1 1 0 01-.5 1.2l-2.26 1.13a11 11 0 005.5 5.5l1.13-2.26a1 1 0 011.2-.5l4.5 1.5a1 1 0 01.68.95V19a2 2 0 01-2 2h-1C9.72 21 3 14.28 3 6V5z" /></svg>,
  mail:  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 8l9 6 9-6M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>,
  pin:   <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17.66 16.66L12 22l-5.66-5.34a8 8 0 1111.32 0z" /><circle cx="12" cy="11" r="2.5" strokeWidth={1.8} /></svg>,
  clock: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" strokeWidth={1.8} /><path strokeLinecap="round" strokeWidth={1.8} d="M12 7v5l3 2" /></svg>,
  hash:  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeWidth={1.8} d="M5 9h14M5 15h14M10 4l-2 16M16 4l-2 16" /></svg>,
};

export default function PageView({ page }: { page: PageData }) {
  const blocks = normalizePageBlocks(page.blocks);
  const { html, toc } = withToc(page.contentHtml);
  const { contact, faq, stats, features, updatedLabel } = blocks;

  const wantsToc = (page.showToc || page.template === "LEGAL") && toc.length > 1;
  const hasContent = html.trim().length > 0;

  const content = hasContent && (
    <div className={`${CARD} p-6 md:p-9 overflow-x-auto`}>
      <div className="rich-content" dir="rtl" dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );

  return (
    <div dir="rtl">

      {/* ── سربرگ ── */}
      <header className="relative overflow-hidden">
        {page.coverImage ? (
          <>
            <Image src={page.coverImage} alt="" fill priority sizes="100vw" className="object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/60 to-black/40" />
          </>
        ) : (
          <>
            {/* گرادیان تزئینی — دو هاله‌ی رنگی محو روی پس‌زمینه‌ی صفحه */}
            <div className="absolute inset-0 bg-gradient-to-bl from-primary-50 via-white to-white dark:from-primary-950/40 dark:via-[#050505] dark:to-[#050505]" />
            <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-primary-200/40 dark:bg-primary-800/20 blur-3xl" />
            <div className="absolute -bottom-32 left-0 w-96 h-96 rounded-full bg-primary-100/50 dark:bg-primary-900/20 blur-3xl" />
          </>
        )}

        <div className={`container relative py-14 md:py-20 ${page.coverImage ? "text-white" : ""}`}>
          <nav className={`flex items-center gap-2 text-[11px] font-bold mb-5 ${page.coverImage ? "text-white/70" : "text-gray-400"}`}>
            <Link href="/" className="hover:text-primary-600 transition-colors">خانه</Link>
            <span>/</span>
            <span className={page.coverImage ? "text-white" : "text-gray-600 dark:text-gray-300"}>{page.title}</span>
          </nav>

          <h1 className={`text-2xl md:text-4xl font-black leading-relaxed ${page.coverImage ? "" : "text-gray-900 dark:text-white"}`}>
            {page.title}
          </h1>

          {page.subtitle && (
            <p className={`mt-3 text-sm md:text-base font-bold max-w-2xl leading-8 ${page.coverImage ? "text-white/80" : "text-gray-500 dark:text-gray-400"}`}>
              {page.subtitle}
            </p>
          )}

          {page.template === "LEGAL" && updatedLabel && (
            <p className={`mt-4 inline-block text-[11px] font-black px-3 py-1.5 rounded-xl ${page.coverImage ? "bg-white/15 text-white" : "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400"}`}>
              {updatedLabel}
            </p>
          )}
        </div>
      </header>

      {/* ── نوار آمار (درباره ما) ── */}
      {page.template === "ABOUT" && stats.length > 0 && (
        <div className="container -mt-6 md:-mt-8 relative z-10">
          <div className={`${CARD} p-6 grid grid-cols-2 md:grid-cols-4 gap-6 divide-y-0 md:divide-x md:divide-x-reverse divide-gray-100 dark:divide-gray-800`}>
            {stats.map((s, i) => (
              <div key={i} className="text-center px-2">
                <div className="text-2xl md:text-3xl font-black text-primary-600 dark:text-primary-400">{s.value}</div>
                <div className="text-[11px] font-bold text-gray-400 mt-1.5">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── بدنه ── */}
      <div className="container py-10 md:py-14 space-y-8">

        {wantsToc ? (
          <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-6 items-start">
            <aside className="order-2 lg:order-1"><PageToc items={toc} /></aside>
            <div className="order-1 lg:order-2 min-w-0">{content}</div>
          </div>
        ) : content}

        {/* ── تماس با ما ── */}
        {page.template === "CONTACT" && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {contact.phone && (
                <ContactCard icon={icons.phone} label="تلفن ثابت" value={contact.phone}
                  href={`tel:${contact.phone.replace(/[^\d+]/g, "")}`} />
              )}
              {contact.mobile && (
                <ContactCard icon={icons.phone} label="موبایل" value={contact.mobile}
                  href={`tel:${contact.mobile.replace(/[^\d+]/g, "")}`} />
              )}
              {contact.email && (
                <ContactCard icon={icons.mail} label="ایمیل" value={contact.email} href={`mailto:${contact.email}`} />
              )}
              {contact.workHours && <ContactCard icon={icons.clock} label="ساعات کاری" value={contact.workHours} />}
              {contact.address   && <ContactCard icon={icons.pin}   label="نشانی"      value={contact.address} />}
              {contact.postalCode && <ContactCard icon={icons.hash} label="کد پستی"    value={contact.postalCode} />}
            </div>

            {contact.socials.length > 0 && (
              <div className={`${CARD} p-6 flex flex-wrap items-center gap-3`}>
                <span className="text-xs font-black text-gray-400 ml-2">ما را دنبال کنید:</span>
                {contact.socials.map((s, i) => (
                  <a key={i} href={s.url} target="_blank" rel="noreferrer noopener"
                    className="px-4 py-2 rounded-xl bg-gray-100 dark:bg-white/5 text-xs font-black text-gray-600 dark:text-gray-300 hover:bg-primary-50 hover:text-primary-600 dark:hover:bg-primary-900/20 transition-colors">
                    {s.label}
                  </a>
                ))}
              </div>
            )}

            {contact.mapEmbed && (
              <div className={`${CARD} overflow-hidden`}>
                <iframe src={contact.mapEmbed} className="w-full h-[380px] border-0"
                  loading="lazy" referrerPolicy="no-referrer-when-downgrade" title="نقشه" />
              </div>
            )}
          </>
        )}

        {/* ── سوالات متداول ── */}
        {page.template === "FAQ" && faq.length > 0 && <FaqAccordion items={faq} />}

        {/* ── کارت‌های ویژگی (درباره ما) ── */}
        {page.template === "ABOUT" && features.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {features.map((f, i) => (
              <div key={i} className={`${CARD} p-6 transition-all hover:-translate-y-1 hover:border-primary-300 dark:hover:border-primary-800`}>
                {f.icon && <div className="text-3xl mb-3">{f.icon}</div>}
                <h3 className="text-sm font-black text-gray-900 dark:text-white mb-2">{f.title}</h3>
                {f.text && <p className="text-xs leading-7 text-gray-500 dark:text-gray-400">{f.text}</p>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
