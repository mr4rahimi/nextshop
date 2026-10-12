"use client";

/**
 * متن گروهی با هوش مصنوعی — docs/features/ai-product-text.md
 * محصولات بی‌متن را پیدا می‌کند و فقط بخش‌های خالی‌شان را می‌نویسد.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import HelpButton from "@/components/admin/worklist/HelpButton";
import { AI_TEXT_SECTIONS, type AiTextSection } from "@/lib/ai/text-presets";

interface Row {
  id: string; title: string; mainImage: string | null; isActive: boolean; category: string;
  has: { short: boolean; expert: boolean; seo: boolean; faq: boolean };
}
interface JobItem { productId: string; title: string; status: "pending" | "running" | "done" | "skipped" | "error"; note?: string }
interface Job { id: string; status: "running" | "done" | "error"; total: number; items: JobItem[]; costUsd: number; cancelled?: boolean; error?: string }

const MISSING = [
  { value: "any", label: "هر بخشی خالی باشد" },
  { value: "expert", label: "بی بررسی تخصصی" },
  { value: "short", label: "بی توضیح کوتاه" },
  { value: "seo", label: "بی توضیح سئو" },
  { value: "faq", label: "بی سوالات متداول" },
  { value: "all", label: "همه‌ی محصولات" },
];
const MAX = 100;
const JOB_KEY = "ai-text-bulk-job";
const fa = (n: number) => n.toLocaleString("fa-IR");
const card = "bg-white dark:bg-[#0f1117] border border-gray-200 dark:border-white/[0.06] rounded-2xl";
const inp = "px-3 py-2 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-blue-500";

const STATUS: Record<JobItem["status"], [string, string]> = {
  pending: ["در صف", "text-gray-400"],
  running: ["در حال نوشتن…", "text-blue-600"],
  done: ["✓ نوشته شد", "text-emerald-600"],
  skipped: ["رد شد", "text-gray-500"],
  error: ["خطا", "text-red-600"],
};

export default function AiTextBulkPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState("any");
  const [cat, setCat] = useState("");
  const [q, setQ] = useState("");
  const [cats, setCats] = useState<{ id: string; title: string }[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sections, setSections] = useState<AiTextSection[]>(["short", "expert", "features", "faq", "seo", "specs"]);
  const [retitle, setRetitle] = useState(false);
  const [job, setJob] = useState<Job | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState<boolean | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    const p = new URLSearchParams({ missing, ...(cat && { categoryId: cat }), ...(q.trim() && { q: q.trim() }) });
    fetch(`/api/admin/ai-text/bulk?${p}`).then(r => r.json())
      .then(d => { setRows(d.products ?? []); setTotal(d.total ?? 0); })
      .catch(() => setError("خواندن فهرست محصولات ناموفق بود."))
      .finally(() => setLoading(false));
  }, [missing, cat, q]);

  useEffect(() => { const h = setTimeout(load, 300); return () => clearTimeout(h); }, [load]);

  useEffect(() => {
    fetch("/api/admin/categories").then(r => (r.ok ? r.json() : [])).then(c => Array.isArray(c) && setCats(c)).catch(() => {});
    fetch("/api/admin/ai-text").then(r => r.json()).then(c => setReady(!!c.ready)).catch(() => setReady(false));
    // کار در جریان قبل از رفرش صفحه
    let saved: string | null = null;
    try { saved = sessionStorage.getItem(JOB_KEY); } catch {}
    if (saved) poll(saved);
    return () => { if (timer.current) clearTimeout(timer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function poll(id: string) {
    try {
      const r = await fetch(`/api/admin/ai-text/${id}`, { cache: "no-store" });
      const j = (await r.json().catch(() => null)) as (Job & { ok?: boolean }) | null;
      if (!r.ok || !j || j.ok === false) { try { sessionStorage.removeItem(JOB_KEY); } catch {} ; return; }
      setJob(j);
      if (j.status === "running") timer.current = setTimeout(() => poll(id), 3000);
      else { try { sessionStorage.removeItem(JOB_KEY); } catch {} ; load(); }
    } catch {
      timer.current = setTimeout(() => poll(id), 5000);
    }
  }

  async function start() {
    setError(null);
    const ids = [...selected].slice(0, MAX);
    const r = await fetch("/api/admin/ai-text/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productIds: ids, sections: retitle ? [...sections, "title"] : sections, retitle }),
    });
    const b = await r.json().catch(() => ({}));
    if (!r.ok || !b?.jobId) { setError(b?.error || `کد ${r.status}`); return; }
    try { sessionStorage.setItem(JOB_KEY, b.jobId); } catch {}
    setSelected(new Set());
    poll(b.jobId);
  }

  async function cancel() {
    if (job) await fetch(`/api/admin/ai-text/${job.id}`, { method: "DELETE" });
  }

  const running = job?.status === "running";
  const doneCount = job?.items.filter(i => i.status !== "pending" && i.status !== "running").length ?? 0;
  const allVisibleSelected = rows.length > 0 && rows.every(r => selected.has(r.id));
  const bulkSections = AI_TEXT_SECTIONS.filter(s => s.value !== "title");

  return (
    <div className="p-4 lg:p-6 space-y-5" dir="rtl">
      <div className="flex items-center gap-2">
        <div>
          <h1 className="text-xl font-black text-gray-900 dark:text-white">متن گروهی با هوش مصنوعی</h1>
          <p className="text-xs text-gray-500 mt-0.5">فقط بخش‌های خالی هر محصول نوشته می‌شود؛ متن موجود دست نمی‌خورد.</p>
        </div>
        <HelpButton topic="aiTextBulk" />
      </div>

      {ready === false && (
        <div className="px-4 py-3 rounded-2xl bg-amber-50 dark:bg-amber-500/10 text-amber-800 dark:text-amber-300 text-xs">
          کلید GapGPT تنظیم نشده. <Link href="/admin/ai-settings" className="font-black underline">تنظیمات هوش مصنوعی</Link>
        </div>
      )}

      {/* کار در جریان */}
      {job && (
        <div className={card + " p-4 space-y-3"}>
          <div className="flex items-center gap-3 flex-wrap">
            <p className="text-sm font-black text-gray-900 dark:text-white flex-1">
              {running ? `در حال نوشتن — ${fa(doneCount)} از ${fa(job.total)}` : `تمام شد — ${fa(job.items.filter(i => i.status === "done").length)} محصول نوشته شد`}
              <span className="text-[11px] font-normal text-gray-400 mr-2" dir="ltr">≈{job.costUsd.toFixed(3)}$</span>
            </p>
            {running && !job.cancelled && (
              <button onClick={cancel} className="px-3 py-1.5 rounded-xl border border-red-200 dark:border-red-500/20 text-xs font-bold text-red-600">لغو</button>
            )}
            {!running && <button onClick={() => setJob(null)} className="text-xs text-gray-400 hover:text-gray-600">بستن</button>}
          </div>
          <div className="h-2 rounded-full bg-gray-100 dark:bg-white/5 overflow-hidden">
            <div className="h-full bg-gradient-to-l from-violet-600 to-blue-600 transition-all" style={{ width: `${(doneCount / Math.max(1, job.total)) * 100}%` }} />
          </div>
          {job.error && <p className="text-xs text-red-600">{job.error}</p>}
          <div className="max-h-72 overflow-y-auto divide-y divide-gray-50 dark:divide-white/[0.04]">
            {job.items.map(it => (
              <div key={it.productId} className="flex items-center gap-3 py-2 text-xs">
                <Link href={`/admin/products/${it.productId}`} target="_blank" className="flex-1 truncate text-gray-700 dark:text-gray-300 hover:text-blue-600">
                  {it.title || rows.find(r => r.id === it.productId)?.title || it.productId}
                </Link>
                <span className={`font-bold whitespace-nowrap ${STATUS[it.status][1]}`}>{STATUS[it.status][0]}</span>
                {it.note && <span className="text-gray-400 truncate max-w-[45%]">{it.note}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* تنظیم کار */}
      <div className={card + " p-4 space-y-3"}>
        <p className="text-xs font-black text-gray-700 dark:text-gray-300">بخش‌هایی که نوشته شود (اگر خالی باشند)</p>
        <div className="flex gap-2 flex-wrap">
          {bulkSections.map(s => (
            <button key={s.value} type="button"
              onClick={() => setSections(x => x.includes(s.value) ? x.filter(v => v !== s.value) : [...x, s.value])}
              className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all ${sections.includes(s.value) ? "bg-blue-600 border-blue-600 text-white" : "border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-300"}`}>
              {s.label}
            </button>
          ))}
        </div>
        <label className="flex items-start gap-2 text-xs text-gray-700 dark:text-gray-300 cursor-pointer">
          <input type="checkbox" checked={retitle} onChange={e => setRetitle(e.target.checked)} className="mt-0.5" />
          <span>
            عنوان هم طبق الگو استاندارد شود
            <span className="block text-[11px] text-gray-400">نشانی (slug) فقط برای محصولات غیرفعال عوض می‌شود.</span>
          </span>
        </label>
        {error && <p className="text-xs text-red-600">{error}</p>}
        <button onClick={start} disabled={!ready || running || !selected.size || (!sections.length && !retitle)}
          className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-gradient-to-l from-violet-600 to-blue-600 text-white text-sm font-black disabled:opacity-40">
          ✨ شروع برای {fa(Math.min(selected.size, MAX))} محصول
        </button>
        {selected.size > MAX && <p className="text-[11px] text-amber-600">هر بار حداکثر {fa(MAX)} محصول؛ بقیه را دور بعد بزنید.</p>}
      </div>

      {/* فهرست */}
      <div className={card + " overflow-hidden"}>
        <div className="p-3 flex gap-2 flex-wrap border-b border-gray-100 dark:border-white/[0.06]">
          <select value={missing} onChange={e => setMissing(e.target.value)} className={inp}>
            {MISSING.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
          <select value={cat} onChange={e => setCat(e.target.value)} className={inp}>
            <option value="">همه‌ی دسته‌ها</option>
            {cats.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
          </select>
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="جست‌وجوی عنوان…" className={inp + " flex-1 min-w-[10rem]"} />
        </div>
        <div className="px-3 py-2 flex items-center gap-2 text-xs text-gray-500 border-b border-gray-100 dark:border-white/[0.06]">
          <input type="checkbox" checked={allVisibleSelected}
            onChange={e => setSelected(e.target.checked ? new Set([...selected, ...rows.map(r => r.id)]) : new Set([...selected].filter(id => !rows.some(r => r.id === id))))} />
          <span>{loading ? "در حال بارگذاری…" : `${fa(total)} محصول${total > rows.length ? ` (${fa(rows.length)} مورد اول نمایش داده شده)` : ""} · ${fa(selected.size)} انتخاب‌شده`}</span>
        </div>
        <div className="divide-y divide-gray-50 dark:divide-white/[0.04]">
          {rows.map(r => (
            <label key={r.id} className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50 dark:hover:bg-white/[0.02] cursor-pointer">
              <input type="checkbox" checked={selected.has(r.id)}
                onChange={e => setSelected(s => { const n = new Set(s); if (e.target.checked) n.add(r.id); else n.delete(r.id); return n; })} />
              <div className="w-9 h-9 rounded-lg overflow-hidden bg-gray-100 dark:bg-white/10 flex-shrink-0">
                {r.mainImage && <img src={r.mainImage} alt="" className="w-full h-full object-cover" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-gray-900 dark:text-white truncate">
                  {r.title} {!r.isActive && <span className="text-[10px] text-amber-600 font-normal">(غیرفعال)</span>}
                </p>
                <p className="text-[10px] text-gray-400">{r.category}</p>
              </div>
              <div className="hidden sm:flex gap-1 text-[10px]">
                {([["short", "کوتاه"], ["expert", "تخصصی"], ["faq", "FAQ"], ["seo", "سئو"]] as const).map(([k, l]) => (
                  <span key={k} className={`px-1.5 py-0.5 rounded ${r.has[k] ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400" : "bg-gray-100 text-gray-400 dark:bg-white/5"}`}>{l}</span>
                ))}
              </div>
            </label>
          ))}
          {!loading && !rows.length && <p className="p-6 text-center text-xs text-gray-400">محصولی با این فیلتر نیست.</p>}
        </div>
      </div>
    </div>
  );
}
