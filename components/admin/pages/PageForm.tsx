"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import {
  PAGE_TEMPLATES, TEMPLATE_META, normalizePageBlocks,
  type PageBlocks, type PageTemplate,
} from "@/lib/pages";
import { slugify } from "@/lib/slug";

// ادیتور Tiptap فقط در کلاینت و در صورت نیاز لود می‌شود
const BlogEditor = dynamic(() => import("@/components/blog/BlogEditor"), {
  ssr: false,
  loading: () => <div className="h-96 rounded-2xl bg-gray-100 dark:bg-gray-800 animate-pulse" />,
});

export interface PageFormValue {
  id?: string;
  slug: string;
  title: string;
  subtitle: string;
  template: PageTemplate;
  contentHtml: string;
  coverImage: string;
  blocks: PageBlocks;
  seoTitle: string;
  seoDescription: string;
  isActive: boolean;
  isIndexable: boolean;
  showToc: boolean;
  sortOrder: number;
}

export const EMPTY_PAGE: PageFormValue = {
  slug: "", title: "", subtitle: "", template: "DEFAULT",
  contentHtml: "", coverImage: "",
  blocks: normalizePageBlocks(null),
  seoTitle: "", seoDescription: "",
  isActive: true, isIndexable: true, showToc: false, sortOrder: 0,
};

// ── تکه‌های کوچک رابط ───────────────────────────────────────────────────────

function Card({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-100 dark:border-gray-800 p-5 space-y-4">
      <div>
        <h3 className="text-sm font-black text-gray-900 dark:text-white">{title}</h3>
        {hint && <p className="text-[11px] text-gray-400 mt-1 leading-5">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

const inputCls =
  "w-full border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 text-sm bg-white dark:bg-gray-800 dark:text-white outline-none focus:border-primary-500 transition-colors";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-bold text-gray-600 dark:text-gray-400">{label}</span>
      {children}
    </label>
  );
}

function Toggle({ label, hint, checked, onChange }: {
  label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <button type="button" onClick={() => onChange(!checked)}
      className="w-full flex items-start gap-3 text-right">
      <span className={`mt-0.5 w-10 h-6 rounded-full flex-shrink-0 transition-colors relative ${checked ? "bg-primary-600" : "bg-gray-300 dark:bg-gray-700"}`}>
        <span className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${checked ? "right-1" : "right-5"}`} />
      </span>
      <span className="min-w-0">
        <span className="block text-xs font-bold text-gray-700 dark:text-gray-300">{label}</span>
        {hint && <span className="block text-[11px] text-gray-400 leading-5">{hint}</span>}
      </span>
    </button>
  );
}

/** ردیف‌های تکرارشونده (پرسش‌وپاسخ، آمار، ویژگی‌ها، شبکه‌های اجتماعی) */
function RepeatList<T>({ rows, onChange, empty, addLabel, render }: {
  rows: T[];
  onChange: (rows: T[]) => void;
  empty: T;
  addLabel: string;
  render: (row: T, set: (patch: Partial<T>) => void) => React.ReactNode;
}) {
  const move = (i: number, dir: -1 | 1) => {
    const next = [...rows];
    const j = i + dir;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };

  return (
    <div className="space-y-3">
      {rows.map((row, i) => (
        <div key={i} className="rounded-2xl border border-gray-100 dark:border-gray-800 p-3 space-y-2 bg-gray-50/60 dark:bg-gray-800/40">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black text-gray-400">#{i + 1}</span>
            <div className="flex items-center gap-1">
              <button type="button" onClick={() => move(i, -1)} disabled={i === 0}
                className="w-7 h-7 rounded-lg text-xs hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-30" title="بالا">▲</button>
              <button type="button" onClick={() => move(i, 1)} disabled={i === rows.length - 1}
                className="w-7 h-7 rounded-lg text-xs hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-30" title="پایین">▼</button>
              <button type="button" onClick={() => onChange(rows.filter((_, k) => k !== i))}
                className="w-7 h-7 rounded-lg text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20" title="حذف">✕</button>
            </div>
          </div>
          {render(row, patch => onChange(rows.map((r, k) => (k === i ? { ...r, ...patch } : r))))}
        </div>
      ))}
      <button type="button" onClick={() => onChange([...rows, { ...empty }])}
        className="w-full py-2.5 rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700 text-xs font-bold text-gray-500 hover:border-primary-500 hover:text-primary-600 transition-colors">
        + {addLabel}
      </button>
    </div>
  );
}

// ── فرم اصلی ───────────────────────────────────────────────────────────────

export default function PageForm({ initial, mode }: { initial: PageFormValue; mode: "create" | "edit" }) {
  const router = useRouter();
  const [form, setForm] = useState<PageFormValue>(initial);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  // اسلاگ فقط تا وقتی خودکار از عنوان ساخته می‌شود که ادمین دستی تغییرش نداده باشد
  const slugTouched = useRef(mode === "edit" && !!initial.slug);

  const set = <K extends keyof PageFormValue>(k: K, v: PageFormValue[K]) =>
    setForm(f => ({ ...f, [k]: v }));
  const setBlocks = (patch: Partial<PageBlocks>) =>
    setForm(f => ({ ...f, blocks: { ...f.blocks, ...patch } }));

  /** تغییر عنوان: تا وقتی ادمین اسلاگ را دستی نزده، اسلاگ هم با عنوان می‌آید */
  function setTitle(title: string) {
    setForm(f => ({ ...f, title, ...(slugTouched.current ? {} : { slug: slugify(title) }) }));
  }

  const meta = TEMPLATE_META[form.template];
  const showBlock = useMemo(() => new Set(meta.blocks), [meta]);

  async function upload(file: File) {
    setUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/admin/upload", { method: "POST", body: fd });
    const data = await res.json();
    if (data.url) set("coverImage", data.url);
    setUploading(false);
  }

  async function save() {
    if (!form.title.trim()) { setMsg({ type: "err", text: "عنوان برگه الزامی است" }); return; }
    setSaving(true);
    setMsg(null);

    const url = mode === "create" ? "/api/admin/pages" : `/api/admin/pages/${form.id}`;
    const res = await fetch(url, {
      method: mode === "create" ? "POST" : "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);

    if (!res.ok) { setMsg({ type: "err", text: data.message ?? "ذخیره نشد" }); return; }

    if (mode === "create") { router.push(`/admin/pages/${data.id}`); router.refresh(); return; }
    setForm(f => ({ ...f, slug: data.slug ?? f.slug }));
    setMsg({ type: "ok", text: "برگه ذخیره شد" });
  }

  return (
    <div className="space-y-5" dir="rtl">

      {/* نوار بالا */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-gray-900 rounded-3xl border border-gray-100 dark:border-gray-800 p-4">
        <div className="min-w-0">
          <h1 className="text-lg font-black text-gray-900 dark:text-white truncate">
            {mode === "create" ? "برگه جدید" : form.title || "ویرایش برگه"}
          </h1>
          {form.slug && (
            <a href={`/${form.slug}`} target="_blank" rel="noreferrer"
              className="text-[11px] font-mono text-primary-600 hover:underline">/{form.slug} ↗</a>
          )}
        </div>
        <div className="flex items-center gap-2">
          {msg && (
            <span className={`text-xs font-bold px-3 py-1.5 rounded-xl ${msg.type === "ok" ? "text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20" : "text-red-600 bg-red-50 dark:bg-red-900/20"}`}>
              {msg.text}
            </span>
          )}
          <button type="button" onClick={() => router.push("/admin/pages")}
            className="px-4 py-2.5 rounded-xl text-xs font-black text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800">
            بازگشت
          </button>
          <button type="button" onClick={save} disabled={saving}
            className="px-6 py-2.5 bg-primary-600 text-white rounded-xl text-xs font-black hover:bg-primary-700 disabled:opacity-60 transition-colors">
            {saving ? "در حال ذخیره..." : "ذخیره برگه"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">

        {/* ستون اصلی */}
        <div className="lg:col-span-2 space-y-5">

          <Card title="عنوان و نشانی">
            <Field label="عنوان برگه">
              <input className={inputCls} value={form.title} placeholder="مثلاً: تماس با ما"
                onChange={e => setTitle(e.target.value)} />
            </Field>
            <Field label="نشانی برگه (slug)">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono text-gray-400 flex-shrink-0">/</span>
                <input className={`${inputCls} font-mono`} value={form.slug} placeholder="contact-us"
                  onChange={e => { slugTouched.current = true; set("slug", e.target.value); }} />
              </div>
            </Field>
            <Field label="زیرعنوان (اختیاری)">
              <input className={inputCls} value={form.subtitle} placeholder="یک جمله‌ی کوتاه زیر عنوان برگه"
                onChange={e => set("subtitle", e.target.value)} />
            </Field>
          </Card>

          <Card title="متن برگه" hint="سرتیترها را با H2 و H3 بنویسید؛ فهرست مطالب خودکار از همین‌ها ساخته می‌شود.">
            <BlogEditor value={form.contentHtml} onChange={v => set("contentHtml", v)}
              placeholder="متن برگه را بنویسید..." />
          </Card>

          {/* ── بلوک‌های مخصوص قالب ── */}

          {showBlock.has("contact") && (
            <Card title="راه‌های ارتباطی" hint="هر فیلدی که خالی بماند در سایت نمایش داده نمی‌شود.">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Field label="تلفن ثابت">
                  <input className={inputCls} value={form.blocks.contact.phone}
                    onChange={e => setBlocks({ contact: { ...form.blocks.contact, phone: e.target.value } })} />
                </Field>
                <Field label="موبایل">
                  <input className={inputCls} value={form.blocks.contact.mobile}
                    onChange={e => setBlocks({ contact: { ...form.blocks.contact, mobile: e.target.value } })} />
                </Field>
                <Field label="ایمیل">
                  <input className={inputCls} dir="ltr" value={form.blocks.contact.email}
                    onChange={e => setBlocks({ contact: { ...form.blocks.contact, email: e.target.value } })} />
                </Field>
                <Field label="ساعات کاری">
                  <input className={inputCls} value={form.blocks.contact.workHours}
                    onChange={e => setBlocks({ contact: { ...form.blocks.contact, workHours: e.target.value } })} />
                </Field>
                <Field label="کد پستی">
                  <input className={inputCls} value={form.blocks.contact.postalCode}
                    onChange={e => setBlocks({ contact: { ...form.blocks.contact, postalCode: e.target.value } })} />
                </Field>
                <Field label="نشانی">
                  <input className={inputCls} value={form.blocks.contact.address}
                    onChange={e => setBlocks({ contact: { ...form.blocks.contact, address: e.target.value } })} />
                </Field>
              </div>

              <Field label="نشانی نقشه (مقدار src داخل iframe گوگل‌مپ یا نشان)">
                <input className={`${inputCls} font-mono text-[11px]`} dir="ltr" placeholder="https://www.google.com/maps/embed?pb=..."
                  value={form.blocks.contact.mapEmbed}
                  onChange={e => setBlocks({ contact: { ...form.blocks.contact, mapEmbed: e.target.value } })} />
              </Field>

              <div>
                <span className="text-xs font-bold text-gray-600 dark:text-gray-400 block mb-2">شبکه‌های اجتماعی</span>
                <RepeatList
                  rows={form.blocks.contact.socials}
                  onChange={rows => setBlocks({ contact: { ...form.blocks.contact, socials: rows } })}
                  empty={{ label: "", url: "" }}
                  addLabel="افزودن شبکه اجتماعی"
                  render={(row, setRow) => (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      <input className={inputCls} placeholder="اینستاگرام" value={row.label}
                        onChange={e => setRow({ label: e.target.value })} />
                      <input className={`${inputCls} font-mono text-xs`} dir="ltr" placeholder="https://instagram.com/..."
                        value={row.url} onChange={e => setRow({ url: e.target.value })} />
                    </div>
                  )}
                />
              </div>
            </Card>
          )}

          {showBlock.has("faq") && (
            <Card title="پرسش و پاسخ" hint="این فهرست علاوه بر نمایش آکاردئونی، اسکیمای FAQPage گوگل را هم می‌سازد.">
              <RepeatList
                rows={form.blocks.faq}
                onChange={rows => setBlocks({ faq: rows })}
                empty={{ q: "", a: "" }}
                addLabel="افزودن پرسش"
                render={(row, setRow) => (
                  <div className="space-y-2">
                    <input className={inputCls} placeholder="پرسش" value={row.q}
                      onChange={e => setRow({ q: e.target.value })} />
                    <textarea rows={3} className={`${inputCls} resize-none`} placeholder="پاسخ" value={row.a}
                      onChange={e => setRow({ a: e.target.value })} />
                  </div>
                )}
              />
            </Card>
          )}

          {showBlock.has("stats") && (
            <Card title="نوار آمار" hint="اعداد کلیدی که بالای برگه‌ی درباره ما نمایش داده می‌شوند.">
              <RepeatList
                rows={form.blocks.stats}
                onChange={rows => setBlocks({ stats: rows })}
                empty={{ value: "", label: "" }}
                addLabel="افزودن آمار"
                render={(row, setRow) => (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <input className={inputCls} placeholder="۱۰+" value={row.value}
                      onChange={e => setRow({ value: e.target.value })} />
                    <input className={inputCls} placeholder="سال تجربه" value={row.label}
                      onChange={e => setRow({ label: e.target.value })} />
                  </div>
                )}
              />
            </Card>
          )}

          {showBlock.has("features") && (
            <Card title="کارت‌های ویژگی" hint="برای آیکن می‌توانید یک ایموجی بگذارید — مثل ✅ یا 🚚">
              <RepeatList
                rows={form.blocks.features}
                onChange={rows => setBlocks({ features: rows })}
                empty={{ icon: "", title: "", text: "" }}
                addLabel="افزودن ویژگی"
                render={(row, setRow) => (
                  <div className="space-y-2">
                    <div className="grid grid-cols-[70px_1fr] gap-2">
                      <input className={`${inputCls} text-center`} placeholder="✅" value={row.icon}
                        onChange={e => setRow({ icon: e.target.value })} />
                      <input className={inputCls} placeholder="عنوان ویژگی" value={row.title}
                        onChange={e => setRow({ title: e.target.value })} />
                    </div>
                    <textarea rows={2} className={`${inputCls} resize-none`} placeholder="توضیح کوتاه" value={row.text}
                      onChange={e => setRow({ text: e.target.value })} />
                  </div>
                )}
              />
            </Card>
          )}
        </div>

        {/* ستون کناری */}
        <div className="space-y-5">

          <Card title="قالب نمایش" hint={meta.desc}>
            <div className="grid grid-cols-1 gap-2">
              {PAGE_TEMPLATES.map(t => {
                const m = TEMPLATE_META[t];
                const on = form.template === t;
                return (
                  <button key={t} type="button" onClick={() => set("template", t)}
                    className={`flex items-center gap-3 p-3 rounded-2xl border-2 text-right transition-all ${on
                      ? "border-primary-500 bg-primary-50/60 dark:bg-primary-900/20"
                      : "border-gray-100 dark:border-gray-800 hover:border-gray-200 dark:hover:border-gray-700"}`}>
                    <span className="text-xl flex-shrink-0">{m.icon}</span>
                    <span className="min-w-0">
                      <span className="block text-xs font-black text-gray-900 dark:text-white">{m.label}</span>
                      <span className="block text-[11px] text-gray-400 leading-5 line-clamp-2">{m.desc}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </Card>

          <Card title="انتشار">
            <div className="space-y-3">
              <Toggle label="برگه فعال است" hint="غیرفعال یعنی برای بازدیدکننده ۴۰۴."
                checked={form.isActive} onChange={v => set("isActive", v)} />
              <Toggle label="قابل ایندکس در گوگل" hint="برگه‌های تکراری یا کم‌محتوا را noindex کنید."
                checked={form.isIndexable} onChange={v => set("isIndexable", v)} />
              <Toggle label="فهرست مطالب چسبان" hint="از سرتیترهای H2/H3 متن ساخته می‌شود."
                checked={form.showToc} onChange={v => set("showToc", v)} />
              <Field label="ترتیب نمایش در لیست">
                <input type="number" className={inputCls} value={form.sortOrder}
                  onChange={e => set("sortOrder", Number(e.target.value) || 0)} />
              </Field>
            </div>
          </Card>

          <Card title="تصویر سربرگ" hint="اختیاری. اگر خالی بماند سربرگ با گرادیان رنگی نمایش داده می‌شود.">
            {form.coverImage && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={form.coverImage} alt="" className="w-full h-32 object-cover rounded-2xl" />
            )}
            <div className="flex items-center gap-2">
              <label className="flex-1 text-center py-2.5 rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700 text-xs font-bold text-gray-500 cursor-pointer hover:border-primary-500 hover:text-primary-600 transition-colors">
                {uploading ? "در حال آپلود..." : "انتخاب تصویر"}
                <input type="file" accept="image/*" className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) upload(f); }} />
              </label>
              {form.coverImage && (
                <button type="button" onClick={() => set("coverImage", "")}
                  className="px-3 py-2.5 rounded-xl text-xs font-bold text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20">حذف</button>
              )}
            </div>
          </Card>

          {showBlock.has("updatedLabel") && (
            <Card title="تاریخ بروزرسانی" hint="متنی که زیر عنوان برگه‌ی حقوقی نمایش داده می‌شود.">
              <input className={inputCls} placeholder="آخرین بروزرسانی: ۱۴۰۴/۰۵/۲۸"
                value={form.blocks.updatedLabel}
                onChange={e => setBlocks({ updatedLabel: e.target.value })} />
            </Card>
          )}

          {mode === "edit" && (
            <Card title="این برگه کجا دیده شود؟"
              hint="برگه بعد از ذخیره در نشانی خودش در دسترس است، ولی تا وقتی لینکش را در فوتر یا منو نگذارید کاربر آن را پیدا نمی‌کند.">
              <button type="button"
                onClick={() => {
                  navigator.clipboard?.writeText(`${location.origin}/${form.slug}`);
                  setMsg({ type: "ok", text: "نشانی برگه کپی شد" });
                }}
                className="w-full py-2.5 rounded-xl bg-gray-100 dark:bg-gray-800 text-[11px] font-mono text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
                کپی نشانی /{form.slug} ⧉
              </button>
              <div className="grid grid-cols-2 gap-2">
                <a href="/admin/footer" target="_blank" rel="noreferrer"
                  className="py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-center text-xs font-black text-gray-600 dark:text-gray-300 hover:border-primary-500 hover:text-primary-600 transition-colors">
                  افزودن به فوتر ↗
                </a>
                <a href="/admin/menu" target="_blank" rel="noreferrer"
                  className="py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-center text-xs font-black text-gray-600 dark:text-gray-300 hover:border-primary-500 hover:text-primary-600 transition-colors">
                  افزودن به منو ↗
                </a>
              </div>
            </Card>
          )}

          <Card title="سئو" hint="خالی بماند، از عنوان و ابتدای متن برگه استفاده می‌شود.">
            <Field label="عنوان سئو">
              <input className={inputCls} value={form.seoTitle} onChange={e => set("seoTitle", e.target.value)} />
            </Field>
            <Field label="توضیحات متا">
              <textarea rows={3} className={`${inputCls} resize-none`} value={form.seoDescription}
                onChange={e => set("seoDescription", e.target.value)} />
              <span className="text-[11px] text-gray-400">{form.seoDescription.length} کاراکتر — حدود ۱۵۰ مناسب است</span>
            </Field>
          </Card>
        </div>
      </div>
    </div>
  );
}
