"use client";

/**
 * استودیو تصویر هوش مصنوعی — docs/features/ai-product-image.md
 *
 * عکس معمولی گوشی → عکس صنعتی سفید / محیطی / پرامپت دلخواه با gpt-image-2.
 * خودش چیزی ذخیره نمی‌کند: فایل نهایی را به `onUse` می‌دهد و فرم محصول از
 * مسیر آپلود معمولی ذخیره‌اش می‌کند.
 */
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { prepareInput, finalizeOutput } from "@/lib/ai/image-process";
import type { AiImagePreset, AiImageQuality } from "@/lib/ai/image-presets";

interface StudioConfig {
  ready: boolean;
  quality: AiImageQuality;
  presets: AiImagePreset[];
  qualities: { value: AiImageQuality; label: string; hint: string }[];
}

type Target = "main" | "gallery";

const CUSTOM = "__custom";
const POLL_MS = 3000;

export default function AiImageStudio({
  open, onClose, onUse, productTitle, existingImages,
}: {
  open: boolean;
  onClose: () => void;
  /** فایل نهایی — فراخوان آپلود و جای‌گذاری می‌کند؛ true یعنی موفق */
  onUse: (file: File, target: Target) => Promise<boolean>;
  productTitle: string;
  /** تصاویر فعلی محصول — در ویرایش، می‌شود از روی همین‌ها ساخت */
  existingImages: string[];
}) {
  const [cfg, setCfg] = useState<StudioConfig | null>(null);
  const [source, setSource] = useState<Blob | null>(null);
  const [sourceUrl, setSourceUrl] = useState<string | null>(null);
  const [presetId, setPresetId] = useState<string>("");
  const [customPrompt, setCustomPrompt] = useState("");
  const [quality, setQuality] = useState<AiImageQuality>("medium");
  const [phase, setPhase] = useState<"pick" | "running" | "result">("pick");
  const [elapsed, setElapsed] = useState(0);
  const [result, setResult] = useState<{ file: File; url: string; cost?: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<Target | null>(null);
  const cancelled = useRef(false);

  useEffect(() => {
    if (!open || cfg) return;
    fetch("/api/admin/ai-image").then(r => r.json()).then((c: StudioConfig) => {
      setCfg(c);
      setQuality(c.quality);
      setPresetId(c.presets[0]?.id ?? CUSTOM);
    }).catch(() => setError("خواندن تنظیمات هوش مصنوعی ناموفق بود."));
  }, [open, cfg]);

  // پاکسازی هنگام بستن
  useEffect(() => {
    if (open) { cancelled.current = false; return; }
    cancelled.current = true;
    setPhase("pick"); setError(null); setResult(null); setSource(null);
  }, [open]);

  useEffect(() => {
    if (!source) { setSourceUrl(null); return; }
    const u = URL.createObjectURL(source);
    setSourceUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [source]);

  useEffect(() => {
    if (phase !== "running") return;
    const t0 = Date.now();
    const iv = setInterval(() => setElapsed(Math.round((Date.now() - t0) / 1000)), 1000);
    return () => clearInterval(iv);
  }, [phase]);

  if (!open) return null;

  const preset = cfg?.presets.find(p => p.id === presetId);
  const whiteBg = presetId === CUSTOM ? false : !!preset?.whiteBg;

  async function pickFile(f?: File | null) {
    if (!f) return;
    setError(null); setResult(null); setPhase("pick");
    setSource(f);
  }

  async function pickExisting(url: string) {
    setError(null); setResult(null); setPhase("pick");
    try {
      const r = await fetch(url);
      if (!r.ok) throw new Error();
      setSource(await r.blob());
    } catch { setError("خواندن این تصویر ممکن نشد."); }
  }

  async function generate() {
    if (!source) return;
    if (presetId === CUSTOM && !customPrompt.trim()) { setError("پرامپت دلخواه را بنویسید."); return; }
    setError(null); setResult(null); setElapsed(0); setPhase("running");
    try {
      const input = await prepareInput(source);
      const fd = new FormData();
      fd.append("image", input, "product.jpg");
      fd.append("quality", quality);
      if (presetId === CUSTOM) fd.append("prompt", customPrompt.trim());
      else fd.append("presetId", presetId);

      const res = await fetch("/api/admin/ai-image", { method: "POST", body: fd });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error || `کد ${res.status}`);

      // پرسیدن وضعیت تا تمام شود
      for (;;) {
        await new Promise(r => setTimeout(r, POLL_MS));
        if (cancelled.current) return;
        const st = await fetch(`/api/admin/ai-image/${body.jobId}`, { cache: "no-store" });
        const sb = await st.json().catch(() => ({}));
        if (!st.ok) throw new Error(sb?.error || `کد ${st.status}`);
        if (sb.status === "error") throw new Error(sb.error);
        if (sb.status === "done") {
          const baseName = slug(productTitle);
          const file = await finalizeOutput(sb.image, { whiteBg, baseName });
          if (cancelled.current) return;
          setResult({ file, url: URL.createObjectURL(file), cost: sb.usage?.costUsd });
          setPhase("result");
          return;
        }
      }
    } catch (e) {
      if (cancelled.current) return;
      setError((e instanceof Error && e.message) || "ساخت تصویر ناموفق بود.");
      setPhase("pick");
    }
  }

  async function use(target: Target) {
    if (!result) return;
    setSaving(target);
    const ok = await onUse(result.file, target);
    setSaving(null);
    if (ok) onClose();
  }

  const chip = (active: boolean) =>
    `px-3 py-2 rounded-xl text-xs font-bold border transition-all ${active
      ? "bg-blue-600 border-blue-600 text-white"
      : "border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-300 hover:border-blue-400"}`;

  // portal: بخش «تصاویر» فرم stacking context خودش را دارد و بخش‌های بعدی فرم روی پنجره می‌افتادند
  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm" dir="rtl"
      onClick={e => e.target === e.currentTarget && phase !== "running" && onClose()}>
      <div className="w-full sm:max-w-2xl max-h-[95dvh] overflow-y-auto bg-white dark:bg-[#0f1117] rounded-t-3xl sm:rounded-3xl p-4 sm:p-6 space-y-5 shadow-2xl">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-black text-gray-900 dark:text-white">✨ ساخت تصویر با هوش مصنوعی</h2>
          <button type="button" onClick={onClose} disabled={phase === "running"}
            className="w-8 h-8 rounded-xl text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5 disabled:opacity-30" aria-label="بستن">✕</button>
        </div>

        {cfg && !cfg.ready && (
          <div className="px-4 py-3 rounded-2xl bg-amber-50 dark:bg-amber-500/10 text-amber-800 dark:text-amber-300 text-xs leading-6">
            کلید GapGPT برای این سایت تنظیم نشده.{" "}
            <a href="/admin/ai-settings" target="_blank" className="font-black underline">تنظیمات هوش مصنوعی</a>
          </div>
        )}

        {/* ۱. عکس */}
        <section className="space-y-2">
          <p className="text-xs font-black text-gray-700 dark:text-gray-300">۱. عکس محصول</p>
          <div className="flex gap-2 flex-wrap">
            <label className={chip(false) + " cursor-pointer"}>
              📷 گرفتن عکس
              <input type="file" accept="image/*" capture="environment" className="hidden"
                onChange={e => { pickFile(e.target.files?.[0]); e.target.value = ""; }} />
            </label>
            <label className={chip(false) + " cursor-pointer"}>
              🖼️ انتخاب از گالری
              <input type="file" accept="image/*" className="hidden"
                onChange={e => { pickFile(e.target.files?.[0]); e.target.value = ""; }} />
            </label>
          </div>
          {existingImages.length > 0 && (
            <div className="flex gap-2 items-center overflow-x-auto pb-1">
              <span className="text-[11px] text-gray-400 whitespace-nowrap">یا از تصاویر فعلی:</span>
              {existingImages.map(u => (
                <button key={u} type="button" onClick={() => pickExisting(u)}
                  className="w-12 h-12 flex-shrink-0 rounded-xl overflow-hidden border border-gray-200 dark:border-white/10 hover:ring-2 ring-blue-500">
                  <img src={u} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
          {!source && (
            <p className="text-[11px] text-gray-400 leading-5">
              نکته: محصول کامل در کادر، از روبه‌رو، در نور کافی و بدون لرزش. هرچه عکس واضح‌تر، نتیجه به محصول واقعی وفادارتر.
            </p>
          )}
        </section>

        {/* ۲. سبک */}
        {cfg && (
          <section className="space-y-2">
            <p className="text-xs font-black text-gray-700 dark:text-gray-300">۲. سبک تصویر</p>
            <div className="flex gap-2 flex-wrap">
              {cfg.presets.map(p => (
                <button key={p.id} type="button" onClick={() => setPresetId(p.id)} className={chip(presetId === p.id)}>{p.label}</button>
              ))}
              <button type="button" onClick={() => setPresetId(CUSTOM)} className={chip(presetId === CUSTOM)}>✍️ پرامپت دلخواه</button>
            </div>
            {presetId === CUSTOM && (
              <textarea value={customPrompt} onChange={e => setCustomPrompt(e.target.value)} rows={3} dir="auto"
                placeholder="مثلاً: Product photo on a marble kitchen counter with morning light"
                className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-blue-500" />
            )}
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-gray-500">کیفیت:</span>
              <select value={quality} onChange={e => setQuality(e.target.value as AiImageQuality)}
                className="px-2 py-1.5 rounded-lg border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 text-xs text-gray-800 dark:text-gray-200">
                {cfg.qualities.map(q => <option key={q.value} value={q.value}>{q.label} — {q.hint}</option>)}
              </select>
            </div>
          </section>
        )}

        {/* پیش‌نمایش قبل / بعد */}
        {sourceUrl && (
          <div className="grid grid-cols-2 gap-3">
            <figure className="space-y-1">
              <img src={sourceUrl} alt="عکس اصلی" className="w-full aspect-square object-contain rounded-2xl bg-gray-100 dark:bg-white/5" />
              <figcaption className="text-[11px] text-center text-gray-400">قبل</figcaption>
            </figure>
            <figure className="space-y-1">
              {phase === "running" ? (
                <div className="w-full aspect-square rounded-2xl bg-gray-100 dark:bg-white/5 flex flex-col items-center justify-center gap-2 text-gray-500">
                  <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                  <span className="text-xs font-bold">در حال ساخت… {elapsed} ثانیه</span>
                  <span className="text-[10px] text-gray-400 px-4 text-center">معمولاً ۲۰ تا ۶۰ ثانیه. پنجره را نبندید.</span>
                </div>
              ) : result ? (
                <img src={result.url} alt="نتیجه" className="w-full aspect-square object-contain rounded-2xl border border-gray-100 dark:border-white/10" />
              ) : (
                <div className="w-full aspect-square rounded-2xl border-2 border-dashed border-gray-200 dark:border-white/10 flex items-center justify-center text-xs text-gray-400">نتیجه اینجا می‌آید</div>
              )}
              <figcaption className="text-[11px] text-center text-gray-400">
                {result ? `۱۰۲۴×۱۰۲۴ · ${Math.round(result.file.size / 1024)}KB${result.cost ? ` · ≈${result.cost.toFixed(3)}$` : ""}` : "بعد"}
              </figcaption>
            </figure>
          </div>
        )}

        {result && (
          <p className="text-[11px] text-amber-700 dark:text-amber-400 leading-5">
            قبل از ذخیره مطمئن شوید لوگو، نوشته، رنگ و شکل محصول درست مانده — هوش مصنوعی گاهی جزئیات را تغییر می‌دهد.
          </p>
        )}

        {error && (
          <div className="px-4 py-3 rounded-2xl bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 text-xs leading-6">{error}</div>
        )}

        {/* دکمه‌ها */}
        <div className="flex gap-2 flex-wrap">
          {result ? (
            <>
              <button type="button" onClick={() => use("main")} disabled={!!saving}
                className="flex-1 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-black disabled:opacity-50">
                {saving === "main" ? "در حال ذخیره…" : "تصویر اصلی شود"}
              </button>
              <button type="button" onClick={() => use("gallery")} disabled={!!saving}
                className="flex-1 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-black disabled:opacity-50">
                {saving === "gallery" ? "در حال ذخیره…" : "افزودن به گالری"}
              </button>
              <button type="button" onClick={generate} disabled={!!saving}
                className="px-4 py-2.5 rounded-xl border border-gray-200 dark:border-white/10 text-sm font-bold text-gray-600 dark:text-gray-300 disabled:opacity-50">
                ↻ دوباره
              </button>
            </>
          ) : (
            <button type="button" onClick={generate}
              disabled={!source || !cfg?.ready || phase === "running"}
              className="w-full px-4 py-3 rounded-xl bg-gradient-to-l from-violet-600 to-blue-600 text-white text-sm font-black disabled:opacity-40">
              {phase === "running" ? "در حال ساخت…" : "✨ ساخت تصویر"}
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

/** نام فایل خوانا از عنوان محصول (حروف فارسی هم می‌مانند) */
function slug(s: string) {
  return s.trim().replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "").slice(0, 60);
}
