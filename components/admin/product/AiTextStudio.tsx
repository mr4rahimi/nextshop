"use client";

/**
 * نوشتن متن محصول با هوش مصنوعی — docs/features/ai-product-text.md
 *
 * عکس + چند مشخصه → عنوان استاندارد (سه پیشنهاد)، توضیح کوتاه، بررسی تخصصی با
 * مزایا، ویژگی‌ها، مشخصات فنی، FAQ و سئو. هر بخش پیش‌نمایش و تیک «اعمال» دارد؛
 * بخشی که در فرم پر است پیش‌فرض تیک نمی‌خورد. خودش چیزی ذخیره نمی‌کند.
 */
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { prepareInput } from "@/lib/ai/image-process";
import TextMeter from "@/components/admin/tools/TextMeter";
import { AI_TEXT_SECTIONS, type AiTextResult, type AiTextSection } from "@/lib/ai/text-presets";

interface SpecRow { specItemId: string; title: string; value: string }
interface SpecGroup { id: string; title: string; items: { id: string; title: string }[] }

/** فیلدهای فرم که این پنجره می‌خواند و می‌نویسد */
export interface AiTextFormSlice {
  title: string; categoryId: string; brandId: string;
  shortDescription: string; expertTitle: string; expertDescription: string;
  features: string[]; specs: SpecRow[]; faq: { q: string; a: string }[];
  seoTitle: string; seoDescription: string; seoKeywords: string;
}

const POLL_MS = 2500;
const inp = "w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-blue-500";

export default function AiTextStudio({
  open, onClose, onApply, form, existingImages, specGroups, brands,
}: {
  open: boolean;
  onClose: () => void;
  onApply: (patch: Partial<AiTextFormSlice>) => void;
  form: AiTextFormSlice;
  existingImages: string[];
  specGroups: SpecGroup[];
  brands: { id: string; title: string }[];
}) {
  const [ready, setReady] = useState<boolean | null>(null);
  const [model, setModel] = useState("");
  const [imgUrl, setImgUrl] = useState<string>("");        // یکی از تصاویر فعلی
  const [imgFile, setImgFile] = useState<Blob | null>(null); // عکس تازه
  const [imgPreview, setImgPreview] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [sections, setSections] = useState<AiTextSection[]>(AI_TEXT_SECTIONS.map(s => s.value));
  const [specGroupId, setSpecGroupId] = useState("");
  const [phase, setPhase] = useState<"pick" | "running" | "result">("pick");
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [res, setRes] = useState<AiTextResult | null>(null);
  const [cost, setCost] = useState<number | null>(null);
  const [apply, setApply] = useState<Record<AiTextSection, boolean>>({} as Record<AiTextSection, boolean>);
  const [titlePick, setTitlePick] = useState(0);
  const cancelled = useRef(false);

  useEffect(() => {
    if (!open || ready !== null) return;
    fetch("/api/admin/ai-text").then(r => r.json()).then(c => { setReady(!!c.ready); setModel(c.model || ""); })
      .catch(() => setError("خواندن تنظیمات هوش مصنوعی ناموفق بود."));
  }, [open, ready]);

  useEffect(() => {
    if (open) {
      cancelled.current = false;
      setImgUrl(u => u || existingImages[0] || "");
      return;
    }
    cancelled.current = true;
    setPhase("pick"); setError(null); setRes(null); setImgFile(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!imgFile) { setImgPreview(null); return; }
    const u = URL.createObjectURL(imgFile);
    setImgPreview(u);
    return () => URL.revokeObjectURL(u);
  }, [imgFile]);

  useEffect(() => {
    if (phase !== "running") return;
    const t0 = Date.now();
    const iv = setInterval(() => setElapsed(Math.round((Date.now() - t0) / 1000)), 1000);
    return () => clearInterval(iv);
  }, [phase]);

  if (!open) return null;

  // ردیف‌های مشخصات: آنچه در فرم هست، وگرنه گروهی که همین‌جا انتخاب شود
  const specItems = form.specs.length
    ? form.specs.map(s => ({ id: s.specItemId, title: s.title, value: s.value }))
    : (specGroups.find(g => g.id === specGroupId)?.items ?? []).map(it => ({ id: it.id, title: it.title, value: "" }));

  const filled: Record<AiTextSection, boolean> = {
    title: !!form.title.trim(),
    short: !!form.shortDescription.trim(),
    expert: !!form.expertDescription.trim(),
    features: form.features.some(f => f.trim()),
    specs: false, // فقط ردیف‌های خالی پر می‌شوند
    faq: form.faq.some(f => f.q.trim()),
    seo: !!(form.seoTitle.trim() || form.seoDescription.trim()),
  };

  async function generate() {
    setError(null); setRes(null); setElapsed(0); setPhase("running");
    try {
      const fd = new FormData();
      if (imgFile) fd.append("image", await prepareInput(imgFile), "product.jpg");
      else if (imgUrl) fd.append("imageUrl", imgUrl);
      fd.append("notes", notes);
      fd.append("title", form.title);
      fd.append("categoryId", form.categoryId);
      fd.append("brandId", form.brandId);
      fd.append("sections", JSON.stringify(sections));
      fd.append("specItems", JSON.stringify(specItems));

      const r = await fetch("/api/admin/ai-text", { method: "POST", body: fd });
      const body = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(body?.error || `کد ${r.status}`);

      for (;;) {
        await new Promise(x => setTimeout(x, POLL_MS));
        if (cancelled.current) return;
        const st = await fetch(`/api/admin/ai-text/${body.jobId}`, { cache: "no-store" });
        const sb = await st.json().catch(() => ({}));
        if (!st.ok) throw new Error(sb?.error || `کد ${st.status}`);
        if (sb.status === "error") throw new Error(sb.error);
        if (sb.status === "done") {
          const result = sb.result as AiTextResult;
          setRes(result);
          setCost(sb.usage?.costUsd ?? null);
          setTitlePick(0);
          setApply(Object.fromEntries(sections.map(s => [s, !filled[s]])) as Record<AiTextSection, boolean>);
          setPhase("result");
          return;
        }
      }
    } catch (e) {
      if (cancelled.current) return;
      setError((e instanceof Error && e.message) || "نوشتن متن ناموفق بود.");
      setPhase("pick");
    }
  }

  function doApply() {
    if (!res) return;
    const p: Partial<AiTextFormSlice> = {};
    if (apply.title && res.titles[titlePick]?.trim()) {
      p.title = res.titles[titlePick].trim();
      // برند تشخیص‌داده‌شده — فقط وقتی فرم برند ندارد و همین برند در سیستم ثبت است
      if (!form.brandId && res.brandGuess) {
        const g = norm(res.brandGuess);
        const b = brands.find(x => norm(x.title) === g)
          ?? (g.length >= 3 ? brands.find(x => norm(x.title).length >= 3 && (norm(x.title).includes(g) || g.includes(norm(x.title)))) : undefined);
        if (b) p.brandId = b.id;
      }
    }
    if (apply.short) p.shortDescription = res.shortDescription;
    if (apply.expert) { p.expertDescription = res.expertDescription; if (res.expertTitle) p.expertTitle = res.expertTitle; }
    const feats = res.features.map(f => f.trim()).filter(Boolean);
    if (apply.features && feats.length) p.features = feats;
    if (apply.faq && res.faq.length) p.faq = res.faq;
    if (apply.seo) { p.seoTitle = res.seoTitle; p.seoDescription = res.seoDescription; p.seoKeywords = res.seoKeywords; }
    if (apply.specs && res.specs.length) {
      const got = new Map(res.specs.map(s => [s.specItemId, s.value]));
      // فقط ردیف‌های خالی؛ مقداری که کاربر نوشته دست نمی‌خورد
      p.specs = specItems.map(it => ({ specItemId: it.id, title: it.title, value: it.value?.trim() ? it.value : got.get(it.id) ?? "" }));
    }
    onApply(p);
    onClose();
  }

  const edit = (patch: Partial<AiTextResult>) => setRes(r => r && { ...r, ...patch });
  const chip = (active: boolean) =>
    `px-3 py-2 rounded-xl text-xs font-bold border transition-all ${active
      ? "bg-blue-600 border-blue-600 text-white"
      : "border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-300 hover:border-blue-400"}`;
  const preview = imgPreview || imgUrl;

  const blockProps = {
    sections, apply, filled,
    onToggle: (id: AiTextSection, v: boolean) => setApply(a => ({ ...a, [id]: v })),
  };

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm" dir="rtl"
      onClick={e => e.target === e.currentTarget && phase !== "running" && onClose()}>
      <div className="w-full sm:max-w-3xl max-h-[95dvh] overflow-y-auto bg-white dark:bg-[#0f1117] rounded-t-3xl sm:rounded-3xl p-4 sm:p-6 space-y-5 shadow-2xl">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-black text-gray-900 dark:text-white">✨ نوشتن متن محصول با هوش مصنوعی</h2>
          <button type="button" onClick={onClose} disabled={phase === "running"}
            className="w-8 h-8 rounded-xl text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5 disabled:opacity-30" aria-label="بستن">✕</button>
        </div>

        {ready === false && (
          <div className="px-4 py-3 rounded-2xl bg-amber-50 dark:bg-amber-500/10 text-amber-800 dark:text-amber-300 text-xs leading-6">
            کلید GapGPT برای این سایت تنظیم نشده.{" "}
            <a href="/admin/ai-settings" target="_blank" className="font-black underline">تنظیمات هوش مصنوعی</a>
          </div>
        )}

        {phase !== "result" && (
          <>
            {/* ۱. عکس */}
            <section className="space-y-2">
              <p className="text-xs font-black text-gray-700 dark:text-gray-300">۱. عکس محصول <span className="font-normal text-gray-400">(اختیاری ولی نتیجه را خیلی دقیق‌تر می‌کند)</span></p>
              <div className="flex gap-2 flex-wrap items-center">
                <label className={chip(false) + " cursor-pointer"}>
                  📷 گرفتن عکس
                  <input type="file" accept="image/*" capture="environment" className="hidden"
                    onChange={e => { const f = e.target.files?.[0]; if (f) { setImgFile(f); setImgUrl(""); } e.target.value = ""; }} />
                </label>
                <label className={chip(false) + " cursor-pointer"}>
                  🖼️ انتخاب فایل
                  <input type="file" accept="image/*" className="hidden"
                    onChange={e => { const f = e.target.files?.[0]; if (f) { setImgFile(f); setImgUrl(""); } e.target.value = ""; }} />
                </label>
                {existingImages.map(u => (
                  <button key={u} type="button" onClick={() => { setImgUrl(u); setImgFile(null); }}
                    className={`w-11 h-11 flex-shrink-0 rounded-xl overflow-hidden border-2 ${imgUrl === u && !imgFile ? "border-blue-500" : "border-transparent"}`}>
                    <img src={u} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
                {preview && (
                  <button type="button" onClick={() => { setImgFile(null); setImgUrl(""); }} className="text-[11px] text-gray-400 hover:text-red-500">بدون عکس</button>
                )}
              </div>
              {preview && <img src={preview} alt="" className="w-28 h-28 object-contain rounded-2xl bg-gray-100 dark:bg-white/5" />}
            </section>

            {/* ۲. مشخصات */}
            <section className="space-y-2">
              <p className="text-xs font-black text-gray-700 dark:text-gray-300">۲. مشخصات و اطلاعات اولیه</p>
              <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={4} className={inp + " leading-6"}
                placeholder={"هر چه می‌دانید، کوتاه و خط‌به‌خط. مثلاً:\nاچ پی مدل M141w، لیزری سیاه‌سفید، سه‌کاره، وای‌فای\nیا: پیراهن مردانه زارا، مدل رم، چهارخانه، نخ‌پنبه، آستین بلند"} />
              <p className="text-[11px] text-gray-400 leading-5">
                دسته {form.categoryId ? "✓" : "(انتخاب نشده)"} و برند {form.brandId ? "✓" : "(انتخاب نشده)"} فرم خودکار فرستاده می‌شوند.
                برند را در فرم انتخاب کنید تا املای آن در عنوان یکسان بماند.
              </p>
            </section>

            {/* ۳. بخش‌ها */}
            <section className="space-y-2">
              <p className="text-xs font-black text-gray-700 dark:text-gray-300">۳. چه بخش‌هایی نوشته شود؟</p>
              <div className="flex gap-2 flex-wrap">
                {AI_TEXT_SECTIONS.map(s => (
                  <button key={s.value} type="button" className={chip(sections.includes(s.value))}
                    onClick={() => setSections(x => x.includes(s.value) ? x.filter(v => v !== s.value) : [...x, s.value])}>
                    {s.label}
                  </button>
                ))}
              </div>
              {sections.includes("specs") && !form.specs.length && (
                <select value={specGroupId} onChange={e => setSpecGroupId(e.target.value)} className={inp}>
                  <option value="">گروه مشخصات فنی را انتخاب کنید…</option>
                  {specGroups.map(g => <option key={g.id} value={g.id}>{g.title}</option>)}
                </select>
              )}
            </section>
          </>
        )}

        {phase === "running" && (
          <div className="py-8 flex flex-col items-center gap-2 text-gray-500">
            <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-xs font-bold">در حال نوشتن… {elapsed} ثانیه</span>
            <span className="text-[10px] text-gray-400">معمولاً ۱۰ تا ۴۰ ثانیه. پنجره را نبندید.</span>
          </div>
        )}

        {/* نتیجه */}
        {phase === "result" && res && (
          <div className="space-y-3">
            {res.warnings.length > 0 && (
              <div className="px-4 py-3 rounded-2xl bg-amber-50 dark:bg-amber-500/10 text-amber-800 dark:text-amber-300 text-xs leading-6">
                <p className="font-black mb-1">قبل از انتشار چک کنید:</p>
                <ul className="list-disc pr-5">{res.warnings.map((w, i) => <li key={i}>{w}</li>)}</ul>
              </div>
            )}

            <Block {...blockProps} id="title" label="عنوان محصول">
              <div className="space-y-1.5">
                {res.titles.map((t, i) => (
                  <label key={i} className="flex items-center gap-2">
                    <input type="radio" checked={titlePick === i} onChange={() => setTitlePick(i)} />
                    <input value={t} className={inp + " flex-1"}
                      onChange={e => edit({ titles: res.titles.map((x, j) => j === i ? e.target.value : x) })} />
                  </label>
                ))}
                {!form.brandId && res.brandGuess && (
                  <p className="text-[11px] text-gray-500">برند تشخیص‌داده‌شده: «{res.brandGuess}» — اگر در فهرست برندها باشد انتخاب می‌شود.</p>
                )}
              </div>
            </Block>

            <Block {...blockProps} id="short" label="توضیح کوتاه">
              <textarea rows={2} value={res.shortDescription} className={inp} onChange={e => edit({ shortDescription: e.target.value })} />
            </Block>

            <Block {...blockProps} id="expert" label="بررسی تخصصی (توضیحات فروشگاهی + مزایا)">
              <input value={res.expertTitle} className={inp} onChange={e => edit({ expertTitle: e.target.value })} />
              <textarea rows={10} value={res.expertDescription} className={inp + " leading-7"} onChange={e => edit({ expertDescription: e.target.value })} />
            </Block>

            <Block {...blockProps} id="features" label="ویژگی‌های اصلی (هر خط یک ویژگی)">
              <textarea rows={Math.max(4, res.features.length)} value={res.features.join("\n")} className={inp + " leading-7"}
                onChange={e => edit({ features: e.target.value.split("\n") })} />
            </Block>

            <Block {...blockProps} id="specs" label="مشخصات فنی (فقط ردیف‌های خالی فرم)">
              {res.specs.length ? (
                <div className="space-y-1.5">
                  {res.specs.map((s, i) => (
                    <div key={s.specItemId} className="flex items-center gap-2">
                      <span className="w-32 text-[11px] font-bold text-gray-500 flex-shrink-0">{s.title}</span>
                      <input value={s.value} className={inp + " flex-1 py-1.5"}
                        onChange={e => edit({ specs: res.specs.map((x, j) => j === i ? { ...x, value: e.target.value } : x) })} />
                      {!s.fromInput && <span className="text-[10px] font-bold text-amber-600 whitespace-nowrap">نیاز به بررسی</span>}
                    </div>
                  ))}
                  <p className="text-[10px] text-gray-400">«نیاز به بررسی» یعنی از دانسته‌ی هوش مصنوعی درباره‌ی این مدل آمده، نه از ورودی شما.</p>
                </div>
              ) : (
                <p className="text-[11px] text-gray-400">مقداری با اطمینان پیدا نشد. مشخصات بیشتری در یادداشت بنویسید یا دستی پر کنید.</p>
              )}
            </Block>

            <Block {...blockProps} id="faq" label="سوالات متداول">
              {res.faq.map((f, i) => (
                <div key={i} className="space-y-1">
                  <input value={f.q} className={inp + " font-bold"} onChange={e => edit({ faq: res.faq.map((x, j) => j === i ? { ...x, q: e.target.value } : x) })} />
                  <textarea rows={2} value={f.a} className={inp} onChange={e => edit({ faq: res.faq.map((x, j) => j === i ? { ...x, a: e.target.value } : x) })} />
                </div>
              ))}
            </Block>

            <Block {...blockProps} id="seo" label="سئو">
              <input value={res.seoTitle} className={inp} onChange={e => edit({ seoTitle: e.target.value })} />
              <TextMeter text={res.seoTitle} profile="seoTitle" />
              <textarea rows={2} value={res.seoDescription} className={inp} onChange={e => edit({ seoDescription: e.target.value })} />
              <TextMeter text={res.seoDescription} profile="metaDesc" />
              <input value={res.seoKeywords} className={inp + " text-xs"} onChange={e => edit({ seoKeywords: e.target.value })} />
            </Block>

            {cost !== null && <p className="text-[10px] text-gray-400 text-left" dir="ltr">{model} · ≈{cost.toFixed(4)}$</p>}
          </div>
        )}

        {error && <div className="px-4 py-3 rounded-2xl bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 text-xs leading-6">{error}</div>}

        <div className="flex gap-2 flex-wrap">
          {phase === "result" ? (
            <>
              <button type="button" onClick={doApply} disabled={!Object.values(apply).some(Boolean)}
                className="flex-1 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-black disabled:opacity-40">
                اعمال بخش‌های تیک‌خورده در فرم
              </button>
              <button type="button" onClick={() => setPhase("pick")}
                className="px-4 py-2.5 rounded-xl border border-gray-200 dark:border-white/10 text-sm font-bold text-gray-600 dark:text-gray-300">
                ↻ تغییر ورودی و دوباره
              </button>
            </>
          ) : (
            <button type="button" onClick={generate}
              disabled={!ready || phase === "running" || !sections.length || (!preview && !notes.trim() && !form.title.trim())}
              className="w-full px-4 py-3 rounded-xl bg-gradient-to-l from-violet-600 to-blue-600 text-white text-sm font-black disabled:opacity-40">
              {phase === "running" ? "در حال نوشتن…" : "✨ نوشتن متن"}
            </button>
          )}
        </div>
        {phase === "result" && (
          <p className="text-[11px] text-gray-400 text-center">بعد از اعمال، محصول را با دکمه‌ی «ذخیره» فرم ذخیره کنید.</p>
        )}
      </div>
    </div>,
    document.body,
  );
}

/** بیرون از کامپوننت، تا با هر تایپ دوباره ساخته نشود و فوکوس ورودی‌ها نپرد */
function Block({ id, label, children, sections, apply, filled, onToggle }: {
  id: AiTextSection; label: string; children: React.ReactNode;
  sections: AiTextSection[]; apply: Record<AiTextSection, boolean>; filled: Record<AiTextSection, boolean>;
  onToggle: (id: AiTextSection, v: boolean) => void;
}) {
  if (!sections.includes(id)) return null;
  return (
    <div className={`rounded-2xl border p-3 space-y-2 transition-all ${apply[id] ? "border-blue-300 dark:border-blue-500/40" : "border-gray-200 dark:border-white/10 opacity-70"}`}>
      <label className="flex items-center gap-2 cursor-pointer">
        <input type="checkbox" checked={!!apply[id]} onChange={e => onToggle(id, e.target.checked)} />
        <span className="text-xs font-black text-gray-800 dark:text-gray-200 flex-1">{label}</span>
        {filled[id] && <span className="text-[10px] text-amber-600">این بخش در فرم پر است — با تیک جایگزین می‌شود</span>}
      </label>
      {children}
    </div>
  );
}

const norm = (s: string) => s.toLowerCase().replace(/[\s‌\-_.]+/g, "");
