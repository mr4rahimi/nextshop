"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

interface Platform { code: string; name: string; connected: boolean }

interface Settings {
  categoryMap: Record<string, number>;
  preparationDays: number;
  weight: number;
  packageWeight: number;
  priceAdjustPercent: number;
  roundTo: number;
  untrackedStock: number;
  publish: boolean;
  autoSyncVariants: boolean;
}

interface Item {
  id: string;
  title: string;
  image: string | null;
  price: string;
  stock: number;
  trackStock: boolean;
  variants: number;
  images: number;
  categoryId: string;
  categoryMapped: boolean;
  platformProductId: string | null;
  platformVariants: number;
  queued: string | null;
  lastError: string | null;
  lastAt: string | null;
}

interface ListResponse {
  supported: boolean;
  connected: boolean;
  settings: Settings;
  shopCategories: { id: string; path: string; products: number }[];
  summary: { linked: number; queued: number; failed: number };
  total: number;
  page: number;
  perPage: number;
  items: Item[];
}

interface PlatformCategory { id: number; title: string; path: string }

const STATUS_TABS = [
  { key: "todo",   label: "آماده‌ی ساخت" },
  { key: "queued", label: "در صف" },
  { key: "failed", label: "ناموفق" },
  { key: "done",   label: "ساخته/نگاشت‌شده" },
  { key: "all",    label: "همه" },
] as const;

const card = "bg-white dark:bg-[#0f1117] rounded-2xl border border-gray-200 dark:border-white/[0.06] p-5";
const inp = "w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-white/[0.08] bg-gray-50 dark:bg-white/[0.03] text-sm text-gray-900 dark:text-white focus:outline-none focus:border-blue-500";
const btn = "px-4 py-2 rounded-xl text-sm font-bold transition-colors disabled:opacity-40 disabled:cursor-not-allowed";

const fa = (n: number | string) => Number(n).toLocaleString("fa-IR");

// ── پیشنهاد دسته با شباهت دوحرفی (همان روش نگاشت محصولات) ──────────────
function norm(s: string) {
  return s.replace(/ي/g, "ی").replace(/ك/g, "ک").replace(/[‌\s]+/g, " ").trim().toLowerCase();
}
function bigrams(s: string) {
  const out = new Set<string>();
  for (let i = 0; i < s.length - 1; i++) out.add(s.slice(i, i + 2));
  return out;
}
function similarity(a: string, b: string) {
  const na = norm(a), nb = norm(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  const ba = bigrams(na), bb = bigrams(nb);
  let inter = 0;
  for (const g of ba) if (bb.has(g)) inter++;
  return (2 * inter) / (ba.size + bb.size || 1);
}

export default function CreateProductsClient({ platforms, platform }: { platforms: Platform[]; platform: Platform }) {
  const [status, setStatus] = useState<string>("todo");
  const [q, setQ] = useState("");
  const [query, setQuery] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<ListResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const [settings, setSettings] = useState<Settings | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [catsOpen, setCatsOpen] = useState(false);
  const [platformCats, setPlatformCats] = useState<PlatformCategory[] | null>(null);
  const [catsError, setCatsError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const sp = new URLSearchParams({ platform: platform.code, status, page: String(page) });
      if (query) sp.set("q", query);
      if (categoryId) sp.set("categoryId", categoryId);
      const res = await fetch(`/api/integration/create-products?${sp}`);
      const json = await res.json() as ListResponse;
      setData(json);
      setSettings((s) => s ?? json.settings);
    } finally {
      setLoading(false);
    }
  }, [platform.code, status, page, query, categoryId]);

  useEffect(() => { void load(); }, [load]);

  // تا وقتی چیزی در صف است، هر ۸ ثانیه تازه شود
  useEffect(() => {
    if (!data?.summary.queued) return;
    const t = setTimeout(() => void load(), 8000);
    return () => clearTimeout(t);
  }, [data, load]);

  const loadPlatformCats = useCallback(async () => {
    if (platformCats) return;
    setCatsError(null);
    const res = await fetch(`/api/integration/create-products/categories?platform=${platform.code}`);
    const json = await res.json() as { ok: boolean; items?: PlatformCategory[]; error?: string };
    if (json.ok && json.items) setPlatformCats(json.items);
    else setCatsError(json.error ?? "دریافت دسته‌ها ناموفق بود");
  }, [platform.code, platformCats]);

  useEffect(() => { if (catsOpen) void loadPlatformCats(); }, [catsOpen, loadPlatformCats]);

  const catById = useMemo(() => new Map((platformCats ?? []).map((c) => [c.id, c])), [platformCats]);
  const optionLabel = (c: PlatformCategory) => `${c.path} #${c.id}`;

  async function saveSettings(next: Settings) {
    setSaving(true);
    try {
      const res = await fetch("/api/integration/create-products/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform: platform.code, settings: next }),
      });
      const json = await res.json() as { ok: boolean; settings?: Settings; error?: string };
      if (json.ok && json.settings) {
        setSettings(json.settings);
        setSavedAt(Date.now());
        void load();
      } else setMsg({ ok: false, text: json.error ?? "ذخیره نشد" });
    } finally {
      setSaving(false);
    }
  }

  function setMap(shopCatId: string, platformCatId: number | null) {
    if (!settings) return;
    const map = { ...settings.categoryMap };
    if (platformCatId) map[shopCatId] = platformCatId;
    else delete map[shopCatId];
    setSettings({ ...settings, categoryMap: map });
  }

  function suggestAll() {
    if (!settings || !platformCats || !data) return;
    const map = { ...settings.categoryMap };
    let n = 0;
    for (const sc of data.shopCategories) {
      if (map[sc.id]) continue;
      const leaf = sc.path.split(" › ").pop() ?? sc.path;
      let best: { id: number; score: number } | null = null;
      for (const pc of platformCats) {
        const score = Math.max(similarity(leaf, pc.title), similarity(sc.path, pc.path) * 0.9);
        if (!best || score > best.score) best = { id: pc.id, score };
      }
      if (best && best.score >= 0.45) { map[sc.id] = best.id; n++; }
    }
    setSettings({ ...settings, categoryMap: map });
    setMsg({ ok: true, text: n ? `${fa(n)} دسته پیشنهاد شد — بررسی کنید و «ذخیره‌ی نگاشت دسته‌ها» را بزنید` : "پیشنهاد مطمئنی پیدا نشد؛ دستی انتخاب کنید" });
  }

  async function createSelected() {
    if (!selected.size) return;
    if (!confirm(`${fa(selected.size)} محصول در ${platform.name} ساخته شود؟`)) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/integration/create-products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform: platform.code, productIds: [...selected] }),
      });
      const json = await res.json() as { ok: boolean; queued?: number; skipped?: number; error?: string };
      if (json.ok) {
        setMsg({ ok: true, text: `${fa(json.queued ?? 0)} محصول در صف ساخت قرار گرفت${json.skipped ? ` — ${fa(json.skipped)} مورد از قبل ساخته یا در صف بود` : ""}. نتیجه‌ی هر محصول در همین فهرست می‌آید.` });
        setSelected(new Set());
        void load();
      } else setMsg({ ok: false, text: json.error ?? "خطا" });
    } finally {
      setBusy(false);
    }
  }

  const items = data?.items ?? [];
  const selectable = items.filter((i) => !i.platformProductId && !i.queued);
  const allOnPage = selectable.length > 0 && selectable.every((i) => selected.has(i.id));
  const pages = data ? Math.max(1, Math.ceil(data.total / data.perPage)) : 1;
  const unmappedCats = data && settings ? data.shopCategories.filter((c) => !settings.categoryMap[c.id]).length : 0;

  if (data && !data.supported) {
    return <div className={`${card} text-sm text-gray-500`}>ساخت خودکار محصول برای {platform.name} پشتیبانی نمی‌شود.</div>;
  }

  return (
    <div className="space-y-6">
      {platforms.length > 1 && (
        <div className="flex gap-2">
          {platforms.map((p) => (
            <Link key={p.code} href={`?platform=${p.code}`}
              className={`${btn} ${p.code === platform.code ? "bg-blue-600 text-white" : "border border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-300"}`}>
              {p.name}
            </Link>
          ))}
        </div>
      )}

      {!platform.connected && (
        <div className="p-4 rounded-2xl border border-amber-200 dark:border-amber-800/40 bg-amber-50/60 dark:bg-amber-900/10 text-sm text-amber-800 dark:text-amber-300">
          اتصال {platform.name} برقرار نیست. اول از <Link className="underline" href={`/admin/integration/connections/${platform.code}`}>صفحه‌ی اتصال</Link> توکن را وارد و ذخیره کنید.
        </div>
      )}

      {/* خلاصه */}
      {data && (
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "ساخته/نگاشت‌شده", value: data.summary.linked, tone: "text-green-600 dark:text-green-400", tab: "done" },
            { label: "در صف ساخت", value: data.summary.queued, tone: "text-blue-600 dark:text-blue-400", tab: "queued" },
            { label: "ناموفق", value: data.summary.failed, tone: data.summary.failed ? "text-red-500" : "text-gray-900 dark:text-white", tab: "failed" },
          ].map((s) => (
            <button key={s.tab} onClick={() => { setStatus(s.tab); setPage(1); }} className={`${card} text-right hover:border-blue-300 dark:hover:border-blue-500/30`}>
              <p className="text-xs text-gray-500 font-bold">{s.label}</p>
              <p className={`text-3xl font-black mt-1 ${s.tone}`}>{fa(s.value)}</p>
            </button>
          ))}
        </div>
      )}

      {/* تنظیمات پیش‌فرض */}
      {settings && (
        <div className={card}>
          <button onClick={() => setSettingsOpen((o) => !o)} className="w-full flex items-center justify-between">
            <h2 className="font-black text-sm text-gray-900 dark:text-white">تنظیمات ساخت</h2>
            <span className="text-xs text-gray-400">
              {settings.publish ? "منتشرشده" : "منتشرنشده"} · آماده‌سازی {fa(settings.preparationDays)} روز · وزن بسته {fa(settings.packageWeight)} گرم
              {settings.priceAdjustPercent ? ` · قیمت ${settings.priceAdjustPercent > 0 ? "+" : ""}${fa(settings.priceAdjustPercent)}٪` : ""} {settingsOpen ? "▲" : "▼"}
            </span>
          </button>
          {settingsOpen && (
            <div className="mt-4 space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {([
                  ["preparationDays", "زمان آماده‌سازی (روز)"],
                  ["weight", "وزن کالا (گرم)"],
                  ["packageWeight", "وزن با بسته‌بندی (گرم)"],
                  ["priceAdjustPercent", "تغییر قیمت نسبت به سایت (٪)"],
                  ["roundTo", "گرد کردن قیمت به بالا (تومان)"],
                  ["untrackedStock", "موجودی محصول بدون کنترل موجودی"],
                ] as const).map(([key, label]) => (
                  <label key={key} className="block">
                    <span className="block text-xs font-bold text-gray-500 mb-1.5">{label}</span>
                    <input type="number" dir="ltr" className={inp} value={settings[key]}
                      onChange={(e) => setSettings({ ...settings, [key]: Number(e.target.value) })} />
                  </label>
                ))}
              </div>
              <div className="flex flex-wrap gap-6 text-sm">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" checked={!settings.publish} onChange={() => setSettings({ ...settings, publish: false })} className="accent-blue-600" />
                  ساخت به‌صورت منتشرنشده
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" checked={settings.publish} onChange={() => setSettings({ ...settings, publish: true })} className="accent-blue-600" />
                  ساخت به‌صورت منتشرشده
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={settings.autoSyncVariants} onChange={(e) => setSettings({ ...settings, autoSyncVariants: e.target.checked })} className="accent-blue-600" />
                  ارسال خودکار موجودی و قیمت تنوع‌ها
                </label>
              </div>
              <p className="text-[11px] leading-5 text-gray-400">
                قیمت هر تنوع همان قیمت فروش سایت است (فروش ویژه اگر دارد) با «تغییر قیمت» و گرد کردن بالا. توضیح محصول از «توضیح کوتاه» می‌آید و اگر خالی بود از متن کامل، تا ۵۰۰۰ نویسه.
                {platform.code === "basalam" && " باسلام هر محصول تازه را پیش از نمایش بازبینی می‌کند."}
              </p>
              <button disabled={saving} onClick={() => void saveSettings(settings)} className={`${btn} bg-blue-600 text-white hover:bg-blue-700`}>
                {saving ? "ذخیره..." : savedAt && Date.now() - savedAt < 4000 ? "✓ ذخیره شد" : "ذخیره‌ی تنظیمات"}
              </button>
            </div>
          )}
        </div>
      )}

      {/* نگاشت دسته‌ها */}
      {settings && data && (
        <div className={card}>
          <button onClick={() => setCatsOpen((o) => !o)} className="w-full flex items-center justify-between">
            <h2 className="font-black text-sm text-gray-900 dark:text-white">نگاشت دسته‌ها</h2>
            <span className={`text-xs ${unmappedCats ? "text-amber-600" : "text-gray-400"}`}>
              {unmappedCats ? `${fa(unmappedCats)} دسته بدون نگاشت` : "همه‌ی دسته‌ها نگاشت شده‌اند"} {catsOpen ? "▲" : "▼"}
            </span>
          </button>
          {catsOpen && (
            <div className="mt-4 space-y-3">
              {catsError && <p className="text-sm text-red-500">{catsError}</p>}
              {!platformCats && !catsError && <p className="text-sm text-gray-400">در حال دریافت دسته‌های {platform.name}...</p>}
              {platformCats && (
                <>
                  <datalist id="platform-cats">
                    {platformCats.map((c) => <option key={c.id} value={optionLabel(c)} />)}
                  </datalist>
                  <div className="flex flex-wrap gap-2">
                    <button onClick={suggestAll} className={`${btn} border border-gray-300 dark:border-white/10 text-gray-700 dark:text-gray-300`}>پیشنهاد خودکار برای دسته‌های خالی</button>
                    <button disabled={saving} onClick={() => void saveSettings(settings)} className={`${btn} bg-blue-600 text-white hover:bg-blue-700`}>
                      {saving ? "ذخیره..." : "ذخیره‌ی نگاشت دسته‌ها"}
                    </button>
                  </div>
                  <div className="divide-y divide-gray-100 dark:divide-white/[0.04]">
                    {data.shopCategories.map((sc) => {
                      const mapped = settings.categoryMap[sc.id];
                      const pc = mapped ? catById.get(mapped) : undefined;
                      return (
                        <div key={sc.id} className="py-2.5 grid sm:grid-cols-2 gap-2 items-center">
                          <div className="text-sm text-gray-800 dark:text-gray-200">
                            {sc.path} <span className="text-xs text-gray-400">({fa(sc.products)} محصول)</span>
                          </div>
                          <div className="flex gap-2 items-center">
                            <input
                              key={`${sc.id}-${mapped ?? 0}`}
                              list="platform-cats"
                              className={`${inp} ${mapped ? "" : "border-amber-300 dark:border-amber-700/50"}`}
                              placeholder={`جستجوی دسته در ${platform.name}...`}
                              defaultValue={pc ? optionLabel(pc) : mapped ? `#${mapped}` : ""}
                              onChange={(e) => {
                                const m = e.target.value.match(/#(\d+)\s*$/);
                                if (m && catById.has(Number(m[1]))) setMap(sc.id, Number(m[1]));
                              }}
                            />
                            {mapped && (
                              <button onClick={() => setMap(sc.id, null)} className="text-xs text-gray-400 hover:text-red-500 flex-shrink-0">حذف</button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* فهرست محصولات */}
      <div className={`${card} space-y-4`}>
        <div className="flex flex-wrap gap-2">
          {STATUS_TABS.map((t) => (
            <button key={t.key} onClick={() => { setStatus(t.key); setPage(1); setSelected(new Set()); }}
              className={`${btn} ${status === t.key ? "bg-gray-900 text-white dark:bg-white dark:text-gray-900" : "border border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-300"}`}>
              {t.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-3">
          <form className="flex-1 min-w-[200px]" onSubmit={(e) => { e.preventDefault(); setQuery(q); setPage(1); }}>
            <input className={inp} placeholder="جستجوی نام یا کد محصول..." value={q} onChange={(e) => setQ(e.target.value)} />
          </form>
          <select className={`${inp} w-auto`} value={categoryId} onChange={(e) => { setCategoryId(e.target.value); setPage(1); }}>
            <option value="">همه‌ی دسته‌ها</option>
            {data?.shopCategories.map((c) => <option key={c.id} value={c.id}>{c.path}</option>)}
          </select>
        </div>

        {msg && <p className={`text-sm ${msg.ok ? "text-green-600 dark:text-green-400" : "text-red-500"}`}>{msg.text}</p>}

        <div className="flex items-center justify-between gap-3 flex-wrap">
          <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300 cursor-pointer">
            <input type="checkbox" className="accent-blue-600" checked={allOnPage} disabled={!selectable.length}
              onChange={(e) => {
                const next = new Set(selected);
                for (const i of selectable) { if (e.target.checked) next.add(i.id); else next.delete(i.id); }
                setSelected(next);
              }} />
            انتخاب همه‌ی این صفحه
          </label>
          <button disabled={busy || !selected.size || !platform.connected} onClick={() => void createSelected()}
            className={`${btn} bg-orange-500 text-white hover:bg-orange-600`}>
            {busy ? "در حال افزودن به صف..." : `ساخت ${selected.size ? fa(selected.size) + " " : ""}محصول در ${platform.name}`}
          </button>
        </div>

        <div className="divide-y divide-gray-100 dark:divide-white/[0.04]">
          {loading && !items.length && <p className="py-6 text-center text-sm text-gray-400">در حال بارگذاری...</p>}
          {!loading && !items.length && <p className="py-6 text-center text-sm text-gray-400">محصولی در این فهرست نیست.</p>}
          {items.map((i) => {
            const canSelect = !i.platformProductId && !i.queued;
            return (
              <div key={i.id} className="py-3 flex items-start gap-3">
                <input type="checkbox" className="accent-blue-600 mt-3" disabled={!canSelect} checked={selected.has(i.id)}
                  onChange={(e) => {
                    const next = new Set(selected);
                    if (e.target.checked) next.add(i.id); else next.delete(i.id);
                    setSelected(next);
                  }} />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {i.image ? <img src={i.image} alt="" className="w-12 h-12 rounded-lg object-cover flex-shrink-0" /> : <div className="w-12 h-12 rounded-lg bg-gray-100 dark:bg-white/5 flex-shrink-0" />}
                <div className="flex-1 min-w-0">
                  <Link href={`/admin/products/${i.id}`} className="text-sm font-bold text-gray-900 dark:text-white hover:text-blue-600 line-clamp-1">{i.title}</Link>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {fa(i.price)} تومان · موجودی {i.trackStock || i.variants ? fa(i.stock) : "بدون کنترل"}
                    {i.variants ? ` · ${fa(i.variants)} تنوع` : ""} · {fa(i.images)} عکس
                  </p>
                  {!i.categoryMapped && !i.platformProductId && <p className="text-xs text-amber-600 mt-1">دسته‌ی این محصول نگاشت نشده</p>}
                  {i.lastError && <p className="text-xs text-red-500 mt-1 break-words">✗ {i.lastError}</p>}
                </div>
                <div className="text-xs text-left flex-shrink-0 mt-1">
                  {i.platformProductId ? (
                    <span className="text-green-600 dark:text-green-400">✓ شناسه {i.platformProductId}{i.platformVariants ? ` · ${fa(i.platformVariants)} تنوع` : ""}</span>
                  ) : i.queued ? (
                    <span className="text-blue-600 dark:text-blue-400">{i.queued === "PROCESSING" ? "در حال ساخت..." : "در صف"}</span>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>

        {pages > 1 && (
          <div className="flex items-center justify-center gap-3 text-sm">
            <button disabled={page <= 1} onClick={() => setPage(page - 1)} className={`${btn} border border-gray-200 dark:border-white/10`}>قبلی</button>
            <span className="text-gray-500">صفحه {fa(page)} از {fa(pages)}</span>
            <button disabled={page >= pages} onClick={() => setPage(page + 1)} className={`${btn} border border-gray-200 dark:border-white/10`}>بعدی</button>
          </div>
        )}
      </div>
    </div>
  );
}
