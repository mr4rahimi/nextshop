"use client";

/**
 * تب «سئو» فرم مقاله: فیلدهای متا + پیش‌نمایش گوگل و شبکه‌های اجتماعی +
 * تحلیل زنده‌ی محتوا (lib/blog-seo.ts). امتیاز ذخیره نمی‌شود.
 */

import { useState } from "react";
import { CheckCircle2, AlertTriangle, XCircle, Monitor, Smartphone, Target, ChevronDown } from "lucide-react";
import { scoreTone, type SeoReport, type SeoCheck } from "@/lib/blog-seo";

export interface SeoFields {
  title: string;
  slug: string;
  excerpt: string;
  coverImage: string;
  seoTitle: string;
  seoDescription: string;
  seoKeywords: string;
  focusKeyword: string;
  canonicalUrl: string;
  noIndex: boolean;
}

const inp = "w-full border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 text-sm bg-white dark:bg-gray-800 dark:text-white outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/15";
const fa = (n: number) => n.toLocaleString("fa-IR");

export function ScoreRing({ score, size = 72 }: { score: number; size?: number }) {
  const tone = scoreTone(score);
  const r = (size - 8) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={7} className="stroke-gray-100 dark:stroke-gray-800" />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={7} strokeLinecap="round"
          stroke={tone.color} strokeDasharray={c} strokeDashoffset={c * (1 - score / 100)} style={{ transition: "stroke-dashoffset .5s" }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center leading-none">
        <span className="font-black text-gray-900 dark:text-white" style={{ fontSize: size / 3.6 }}>{fa(score)}</span>
        <span className="text-[9px] font-bold mt-0.5" style={{ color: tone.color }}>{tone.label}</span>
      </div>
    </div>
  );
}

function LengthBar({ len, min, max }: { len: number; min: number; max: number }) {
  const pct = Math.min(100, (len / (max * 1.15)) * 100);
  const color = len === 0 ? "#e5e7eb" : len < min ? "#f59e0b" : len <= max ? "#10b981" : "#ef4444";
  return (
    <div className="flex items-center gap-2 mt-1.5">
      <div className="flex-1 h-1.5 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="text-[10px] tabular-nums text-gray-400">{fa(len)} / {fa(max)}</span>
    </div>
  );
}

const ICON = {
  good: <CheckCircle2 size={16} className="text-emerald-500 shrink-0 mt-0.5" />,
  warn: <AlertTriangle size={16} className="text-amber-500 shrink-0 mt-0.5" />,
  bad:  <XCircle size={16} className="text-red-500 shrink-0 mt-0.5" />,
};
const GROUPS: { k: SeoCheck["group"]; l: string }[] = [
  { k: "keyword", l: "کلمه‌ی کلیدی" },
  { k: "meta", l: "عنوان و توضیحات" },
  { k: "content", l: "ساختار محتوا" },
  { k: "media", l: "تصاویر" },
  { k: "links", l: "لینک‌ها" },
];

export function SeoChecklist({ report }: { report: SeoReport }) {
  const [open, setOpen] = useState<Record<string, boolean>>({ keyword: true, meta: true, content: true, media: true, links: true });
  return (
    <div className="space-y-3">
      {GROUPS.map(g => {
        const items = report.checks.filter(c => c.group === g.k);
        if (!items.length) return null;
        const bad = items.filter(i => i.status === "bad").length;
        const warn = items.filter(i => i.status === "warn").length;
        return (
          <div key={g.k} className="rounded-2xl border border-gray-100 dark:border-gray-800 overflow-hidden">
            <button type="button" onClick={() => setOpen(o => ({ ...o, [g.k]: !o[g.k] }))}
              className="w-full flex items-center gap-2 px-4 py-2.5 bg-gray-50/70 dark:bg-gray-800/40 text-sm font-black text-gray-800 dark:text-gray-100">
              {g.l}
              {bad > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-red-50 text-red-600 dark:bg-red-900/20">{fa(bad)} مشکل</span>}
              {warn > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-amber-50 text-amber-600 dark:bg-amber-900/20">{fa(warn)} پیشنهاد</span>}
              {bad + warn === 0 && <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20">کامل</span>}
              <ChevronDown size={16} className={`mr-auto text-gray-400 transition-transform ${open[g.k] ? "rotate-180" : ""}`} />
            </button>
            {open[g.k] && (
              <ul className="divide-y divide-gray-50 dark:divide-gray-800/60">
                {items.map(c => (
                  <li key={c.id} className="flex items-start gap-2.5 px-4 py-2.5">
                    {ICON[c.status]}
                    <div className="min-w-0">
                      <p className="text-[13px] font-bold text-gray-700 dark:text-gray-200">{c.title}</p>
                      {c.hint && c.status !== "good" && <p className="text-[11px] text-gray-400 leading-5 mt-0.5">{c.hint}</p>}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function SeoPanel({ form, set, report, siteHost }: {
  form: SeoFields;
  set: (key: keyof SeoFields, val: any) => void;
  report: SeoReport;
  siteHost: string;
}) {
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const title = form.seoTitle || form.title || "عنوان مقاله";
  const desc = form.seoDescription || form.excerpt || "توضیح متا اینجا نمایش داده می‌شود. اگر خالی بماند گوگل خودش تکه‌ای از متن را انتخاب می‌کند.";
  const titleMax = device === "desktop" ? 60 : 70;
  const shortTitle = title.length > titleMax ? title.slice(0, titleMax - 1) + "…" : title;
  const shortDesc = desc.length > 160 ? desc.slice(0, 158) + "…" : desc;
  const { stats } = report;

  return (
    <div className="space-y-5">
      {/* امتیاز */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 flex flex-wrap items-center gap-5">
        <ScoreRing score={report.score} size={84} />
        <div className="flex-1 min-w-[12rem]">
          <h3 className="font-black text-gray-900 dark:text-white">امتیاز سئوی مقاله</h3>
          <p className="text-xs text-gray-500 mt-1 leading-6">با هر تغییر در متن، عنوان یا تنظیمات دوباره حساب می‌شود. موارد قرمز را اول درست کنید.</p>
        </div>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 w-full lg:w-auto text-center">
          {[
            { l: "کلمه", v: stats.words },
            { l: "H2", v: stats.headings.h2 },
            { l: "تصویر", v: stats.images },
            { l: "جدول", v: stats.tables },
            { l: "لینک داخلی", v: stats.internalLinks },
            { l: "لینک خارجی", v: stats.externalLinks },
          ].map(s => (
            <div key={s.l} className="px-3 py-2 rounded-xl bg-gray-50 dark:bg-gray-800">
              <div className="text-sm font-black text-gray-900 dark:text-white tabular-nums">{fa(s.v)}</div>
              <div className="text-[10px] text-gray-400 whitespace-nowrap">{s.l}</div>
            </div>
          ))}
        </div>
      </div>

      {/* فیلدها */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 space-y-4">
        <div>
          <label className="flex items-center gap-1.5 text-xs font-black text-gray-700 dark:text-gray-200 mb-1.5"><Target size={14} className="text-primary-500" />کلمه‌ی کلیدی اصلی</label>
          <input className={inp} placeholder="مثلاً: بهترین پرینتر لیزری" value={form.focusKeyword} onChange={e => set("focusKeyword", e.target.value)} />
          <p className="text-[10px] text-gray-400 mt-1">عبارتی که کاربر در گوگل جستجو می‌کند. تحلیل پایین بر پایه‌ی همین است.</p>
        </div>
        <div>
          <label className="block text-xs font-black text-gray-700 dark:text-gray-200 mb-1.5">عنوان سئو (Title)</label>
          <input className={inp} placeholder={form.title || "اگر خالی بماند، عنوان مقاله استفاده می‌شود"} value={form.seoTitle} onChange={e => set("seoTitle", e.target.value)} />
          <LengthBar len={(form.seoTitle || form.title).length} min={30} max={60} />
        </div>
        <div>
          <label className="block text-xs font-black text-gray-700 dark:text-gray-200 mb-1.5">توضیح متا (Meta Description)</label>
          <textarea rows={3} className={`${inp} resize-none`} placeholder={form.excerpt || "خلاصه‌ای جذاب با کلمه‌ی کلیدی و دعوت به خواندن"}
            value={form.seoDescription} onChange={e => set("seoDescription", e.target.value)} />
          <LengthBar len={(form.seoDescription || form.excerpt).length} min={110} max={160} />
        </div>
        <div>
          <label className="block text-xs font-black text-gray-700 dark:text-gray-200 mb-1.5">کلمات کلیدی فرعی</label>
          <input className={inp} placeholder="با ویرگول جدا کنید: پرینتر اچ پی، پرینتر اداری، ..." value={form.seoKeywords} onChange={e => set("seoKeywords", e.target.value)} />
          {form.seoKeywords.trim() && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {form.seoKeywords.split(/[,،]/).map(k => k.trim()).filter(Boolean).map(k => (
                <span key={k} className="px-2 py-0.5 rounded-lg bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300 text-[11px] font-bold">{k}</span>
              ))}
            </div>
          )}
        </div>
        <details className="group rounded-xl border border-gray-100 dark:border-gray-800 px-4 py-3">
          <summary className="text-xs font-black text-gray-600 dark:text-gray-300 cursor-pointer list-none flex items-center gap-1">
            تنظیمات پیشرفته <ChevronDown size={14} className="group-open:rotate-180 transition-transform" />
          </summary>
          <div className="space-y-4 pt-4">
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1.5">آدرس Canonical</label>
              <input className={inp} dir="ltr" placeholder={`/mag/${form.slug || "slug"}`} value={form.canonicalUrl} onChange={e => set("canonicalUrl", e.target.value)} />
              <p className="text-[10px] text-gray-400 mt-1">فقط وقتی این مطلب کپی صفحه‌ی دیگری است پر کنید؛ خالی = آدرس خود مقاله.</p>
            </div>
            <label className="flex items-start gap-2.5 cursor-pointer">
              <input type="checkbox" checked={form.noIndex} onChange={e => set("noIndex", e.target.checked)} className="accent-red-500 mt-1" />
              <span>
                <span className="block text-xs font-black text-gray-700 dark:text-gray-200">در گوگل نمایه نشود (noindex)</span>
                <span className="block text-[10px] text-gray-400">مقاله از sitemap حذف می‌شود؛ برای مطالب موقت یا تکراری.</span>
              </span>
            </label>
          </div>
        </details>
      </div>

      {/* پیش‌نمایش گوگل */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 space-y-4">
        <div className="flex items-center gap-2">
          <h3 className="font-black text-sm text-gray-900 dark:text-white">پیش‌نمایش در گوگل</h3>
          <div className="mr-auto flex gap-1 p-1 rounded-xl bg-gray-100 dark:bg-gray-800">
            {([["desktop", Monitor], ["mobile", Smartphone]] as const).map(([k, Icon]) => (
              <button key={k} type="button" onClick={() => setDevice(k)}
                className={`w-8 h-7 flex items-center justify-center rounded-lg ${device === k ? "bg-white dark:bg-gray-900 text-primary-600 shadow-sm" : "text-gray-400"}`}>
                <Icon size={15} />
              </button>
            ))}
          </div>
        </div>
        <div className={`rounded-2xl bg-white border border-gray-100 p-4 ${device === "mobile" ? "max-w-[360px] shadow-sm" : ""}`} dir="rtl">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="w-7 h-7 rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center text-[10px] font-black text-gray-500">{siteHost.slice(0, 1).toUpperCase()}</span>
            <div className="leading-tight">
              <div className="text-[13px] text-[#202124]">{siteHost}</div>
              <div className="text-[11px] text-[#4d5156]" dir="ltr">https://{siteHost} › mag › {form.slug || "slug"}</div>
            </div>
          </div>
          <div className={`text-[#1a0dab] ${device === "mobile" ? "text-[17px]" : "text-[19px]"} leading-snug hover:underline cursor-pointer`}>{shortTitle}</div>
          <div className="text-[13px] text-[#4d5156] leading-relaxed mt-1 line-clamp-2">{shortDesc}</div>
        </div>

        <h3 className="font-black text-sm text-gray-900 dark:text-white pt-2">پیش‌نمایش اشتراک (تلگرام، واتساپ، ایکس)</h3>
        <div className="max-w-md rounded-2xl overflow-hidden border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
          <div className="aspect-[1.91/1] bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-xs text-gray-400 overflow-hidden">
            {form.coverImage ? <img src={form.coverImage} alt="" className="w-full h-full object-cover" /> : "بدون تصویر شاخص"}
          </div>
          <div className="p-3 space-y-0.5">
            <div className="text-[11px] text-gray-400" dir="ltr">{siteHost}</div>
            <div className="text-sm font-black text-gray-900 dark:text-white line-clamp-1">{title}</div>
            <div className="text-xs text-gray-500 line-clamp-2">{desc}</div>
          </div>
        </div>
      </div>

      {/* تحلیل */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 space-y-3">
        <h3 className="font-black text-sm text-gray-900 dark:text-white">تحلیل سئو و خوانایی</h3>
        <SeoChecklist report={report} />
      </div>
    </div>
  );
}
