"use client";

import { useEffect, useState } from "react";

interface Props {
  existingConnection?: {
    id: string; status: string; lastSyncAt: string | null; lastError: string | null;
    syncStockEnabled: boolean; syncPriceEnabled: boolean; syncIntervalMin: number;
  } | null;
}

interface AuthState {
  publicKey:       string | null;
  hasToken:        boolean;
  accessExpiresAt: number | null;
  activatedAt:     number | null;
  scopes:          string[];
  clientCode:      string | null;
  userAgent:       string | null;
}

interface Probe { label: string; userAgent: string; ok: boolean; message: string }

const API = "/api/integration/connections/digikala";
const SELLER_PANEL = "https://seller.digikala.com";

const card  = "bg-white dark:bg-[#0f1117] rounded-2xl border border-gray-200 dark:border-white/[0.06] p-5 space-y-4";
const input = "w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-white/[0.08] bg-gray-50 dark:bg-white/[0.03] text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 transition-colors font-mono";
const btnPrimary = "px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed";
const btnOutline = "px-4 py-2 rounded-xl border border-blue-500 text-blue-600 dark:text-blue-400 text-sm font-bold hover:bg-blue-50 dark:hover:bg-blue-900/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed";
const btnGhost = "px-4 py-2 rounded-xl border border-gray-300 dark:border-white/10 text-gray-700 dark:text-gray-300 text-sm font-bold hover:bg-gray-50 dark:hover:bg-white/5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed";

function Step({ n, title, done, children }: { n: number; title: string; done?: boolean; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <div className={`w-7 h-7 shrink-0 rounded-full flex items-center justify-center text-xs font-black ${
        done ? "bg-green-500 text-white" : "bg-blue-100 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400"
      }`}>
        {done ? "✓" : n.toLocaleString("fa-IR")}
      </div>
      <div className="flex-1 min-w-0 space-y-2">
        <p className="text-sm font-bold text-gray-800 dark:text-gray-200">{title}</p>
        {children}
      </div>
    </div>
  );
}

export default function DigikalaForm({ existingConnection }: Props) {
  const [auth,       setAuth]       = useState<AuthState | null>(null);
  const [generating, setGenerating] = useState(false);
  const [copied,     setCopied]     = useState(false);
  const [code,       setCode]       = useState("");
  const [clientCode, setClientCode] = useState("");
  const [newCode,    setNewCode]    = useState(false);
  const [savingCc,   setSavingCc]   = useState(false);
  const [activating, setActivating] = useState(false);
  const [testing,    setTesting]    = useState(false);
  const [result,     setResult]     = useState<{ success: boolean; message?: string; probes?: Probe[] } | null>(null);

  const [syncStock, setSyncStock] = useState(existingConnection?.syncStockEnabled ?? true);
  const [syncPrice, setSyncPrice] = useState(existingConnection?.syncPriceEnabled ?? false);
  const [interval,  setInterval]  = useState(String(existingConnection?.syncIntervalMin ?? 60));
  const [saving,    setSaving]    = useState(false);
  const [saved,     setSaved]     = useState(false);
  const [syncing,   setSyncing]   = useState(false);
  const [syncMsg,   setSyncMsg]   = useState<string | null>(null);

  async function loadAuth() {
    const res = await fetch(API);
    if (res.ok) {
      const data = await res.json() as AuthState;
      setAuth(data);
      setClientCode(c => c || data.clientCode || "");
    }
  }
  useEffect(() => { void loadAuth(); }, []);

  async function post(body: Record<string, unknown>) {
    const res  = await fetch(API, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({})) as { success?: boolean; message?: string; error?: string; publicKey?: string; probes?: Probe[] };
    return { ok: res.ok, data };
  }

  async function handleGenerate() {
    const force = !!auth?.publicKey;
    if (force && !confirm(
      "کلید تازه ساخته شود؟\n\nکلید قبلی که در دیجی‌کالا ثبت کرده‌اید دیگر به کار نمی‌آید و برای ثبت کلید جدید باید در پنل دیجی‌کالا درخواست پشتیبانی بدهید. توکن فعلی تا انقضا کار می‌کند.",
    )) return;

    setGenerating(true); setResult(null);
    try {
      const { ok, data } = await post({ action: "generate-key", force });
      if (!ok) setResult({ success: false, message: data.error ?? "ساخت کلید ناموفق بود" });
      await loadAuth();
    } finally {
      setGenerating(false);
    }
  }

  async function handleCopy() {
    if (!auth?.publicKey) return;
    try {
      await navigator.clipboard.writeText(auth.publicKey);
    } catch {
      // http بدون TLS کلیپ‌بورد ندارد — متن انتخاب می‌شود تا دستی کپی شود
      (document.getElementById("dk-public-key") as HTMLTextAreaElement | null)?.select();
      return;
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleActivate() {
    setActivating(true); setResult(null);
    try {
      const { ok, data } = await post({ action: "activate", code, clientCode });
      setResult(ok ? { success: !!data.success, message: data.message, probes: data.probes } : { success: false, message: data.error });
      // کد یک‌بارمصرف است — بعد از تبادل موفق، حتی اگر تست شکست بخورد، دیگر به کار نمی‌آید
      if (ok) { setCode(""); setNewCode(false); }
      await loadAuth();
    } finally {
      setActivating(false);
    }
  }

  async function handleSaveClientCode() {
    setSavingCc(true); setResult(null);
    try {
      const { ok, data } = await post({ action: "client-code", clientCode });
      setResult(ok ? { success: !!data.success, message: data.message, probes: data.probes } : { success: false, message: data.error });
      await loadAuth();
    } finally {
      setSavingCc(false);
    }
  }

  async function handleTest() {
    setTesting(true); setResult(null);
    try {
      const { data } = await post({ action: "test" });
      setResult({ success: !!data.success, message: data.message ?? data.error, probes: data.probes });
      await loadAuth();
    } finally {
      setTesting(false);
    }
  }

  async function handleSaveSettings() {
    setSaving(true); setSaved(false);
    try {
      const res = await fetch("/api/integration/connections", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          platformCode:     "digikala",
          syncStockEnabled: syncStock,
          syncPriceEnabled: syncPrice,
          syncIntervalMin:  Number(interval) || 60,
        }),
      });
      if (res.ok) setSaved(true);
      else alert((await res.json().catch(() => ({})) as { error?: string }).error ?? "خطا در ذخیره");
    } finally {
      setSaving(false);
    }
  }

  async function handleFetchProducts() {
    setSyncing(true); setSyncMsg(null);
    try {
      const res = await fetch("/api/integration/sync", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ platformCode: "digikala", type: "FETCH_PRODUCTS", priority: 1 }),
      });
      const data = await res.json() as { jobId?: string; error?: string };
      setSyncMsg(res.ok ? `عملیات در صف قرار گرفت (job: ${data.jobId?.slice(-6)})` : (data.error ?? "خطا"));
    } finally {
      setSyncing(false);
    }
  }

  const hasKey   = !!auth?.publicKey;
  const hasToken = !!auth?.hasToken;

  return (
    <div className="space-y-6">
      {existingConnection && (
        <div className={`p-4 rounded-2xl border text-sm ${
          existingConnection.status === "CONNECTED"
            ? "bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800"
            : "bg-gray-50 dark:bg-white/[0.02] border-gray-200 dark:border-white/[0.06]"
        }`}>
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${existingConnection.status === "CONNECTED" ? "bg-green-500" : "bg-gray-400"}`} />
            <span className="font-bold text-gray-900 dark:text-white">
              {existingConnection.status === "CONNECTED" ? "متصل" : "غیر متصل"}
            </span>
          </div>
          {existingConnection.lastSyncAt && (
            <p className="text-gray-500 mt-1 text-xs">آخرین sync: {new Date(existingConnection.lastSyncAt).toLocaleString("fa-IR")}</p>
          )}
          {existingConnection.lastError && (
            <p className="text-red-500 mt-1 text-xs">خطا: {existingConnection.lastError}</p>
          )}
        </div>
      )}

      <div className={card}>
        <h2 className="font-black text-sm text-gray-900 dark:text-white">توکن اختصاصی دیجی‌کالا</h2>
        <p className="text-xs text-gray-500 leading-6">
          دیجی‌کالا توکن را مستقیم نمی‌دهد. این پنل یک جفت کلید RSA می‌سازد؛ کلید عمومی را در پنل
          فروشندگان ثبت می‌کنید و کدی که دیجی‌کالا نشان می‌دهد را این‌جا وارد می‌کنید. کلید خصوصی
          فقط روی سرور شما و رمزشده می‌ماند.
        </p>

        <Step n={1} title="ساخت کلید عمومی" done={hasKey}>
          {!auth ? (
            <p className="text-xs text-gray-400">در حال بارگذاری...</p>
          ) : hasKey ? (
            <>
              <textarea
                id="dk-public-key" readOnly value={auth.publicKey!} rows={6} dir="ltr"
                onFocus={e => e.currentTarget.select()}
                className={`${input} text-[11px] leading-5 resize-none`}
              />
              <div className="flex flex-wrap gap-2">
                <button onClick={handleCopy} className={btnPrimary}>
                  {copied ? "✓ کپی شد" : "کپی کلید عمومی"}
                </button>
                <button onClick={handleGenerate} disabled={generating} className={btnGhost}>
                  {generating ? "در حال ساخت..." : "ساخت کلید جدید"}
                </button>
              </div>
            </>
          ) : (
            <button onClick={handleGenerate} disabled={generating} className={btnPrimary}>
              {generating ? "در حال ساخت کلید (چند ثانیه)..." : "ساخت کلید عمومی"}
            </button>
          )}
        </Step>

        <Step n={2} title="ثبت کلید در پنل دیجی‌کالا" done={hasToken}>
          <ol className="text-xs text-gray-500 leading-6 list-decimal pr-4 space-y-0.5">
            <li>
              وارد <a href={SELLER_PANEL} target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 underline">پنل فروشندگان دیجی‌کالا</a> شوید
              و از منوی «سرویس‌هاب» بخش «توکن اختصاصی» را باز کنید.
            </li>
            <li>«فعالسازی توکن» را بزنید و قوانین را تأیید کنید.</li>
            <li>در مرحله‌ی «اطلاعات کلید عمومی»، کلید کپی‌شده را بچسبانید و «ثبت کلید عمومی» را بزنید.</li>
            <li>دیجی‌کالا یک «کد اعتبارسنجی» نشان می‌دهد — آن را کامل کپی کنید.</li>
          </ol>
        </Step>

        <Step n={3} title="وارد کردن کد اعتبارسنجی و کد کلاینت" done={hasToken && !newCode}>
          {hasToken && !newCode ? (
            <div className="space-y-2">
              <p className="text-xs text-gray-500 leading-6">
                توکن فعال است. کد اعتبارسنجی یک‌بارمصرف است و دوباره لازم نیست — فقط وقتی توکن را در
                پنل دیجی‌کالا حذف و دوباره فعال کردید یا شش ماه گذشت، کد تازه را وارد کنید.
              </p>
              <button onClick={() => setNewCode(true)} className={btnGhost}>وارد کردن کد تازه</button>
            </div>
          ) : (
            <>
              <textarea
                value={code} onChange={e => setCode(e.target.value)} rows={4} dir="ltr"
                placeholder="کد Base64 نمایش‌داده‌شده در پنل دیجی‌کالا"
                disabled={!hasKey}
                className={`${input} text-[11px] leading-5 resize-none disabled:opacity-50`}
              />
              <p className="text-[11px] text-amber-600 dark:text-amber-400 leading-5">
                دیجی‌کالا این کد را فقط یک‌بار نشان می‌دهد و هر کد فقط یک‌بار قابل استفاده است.
              </p>
            </>
          )}

          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1.5">کد کلاینت</label>
            <input
              value={clientCode} onChange={e => setClientCode(e.target.value)} dir="ltr"
              placeholder="کنار کد اعتبارسنجی در پنل دیجی‌کالا نشان داده می‌شود"
              className={input}
            />
            <p className="text-[11px] text-gray-400 mt-1.5 leading-5">
              دیجی‌کالا آن را در هر درخواست می‌خواهد. اگر خالی بماند از خود توکن خوانده می‌شود.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {(!hasToken || newCode) && (
              <button onClick={handleActivate} disabled={activating || !hasKey || !code.trim()} className={btnPrimary}>
                {activating ? "در حال فعال‌سازی..." : "فعال‌سازی توکن"}
              </button>
            )}
            {hasToken && (
              <button onClick={handleSaveClientCode} disabled={savingCc} className={btnOutline}>
                {savingCc ? "در حال ذخیره..." : "ذخیره کد کلاینت و تست"}
              </button>
            )}
            {hasToken && newCode && (
              <button onClick={() => { setNewCode(false); setCode(""); }} className={btnGhost}>انصراف</button>
            )}
          </div>
          {hasToken && (
            <p className="text-[11px] text-gray-400 leading-5">
              توکن دسترسی خودکار تمدید می‌شود و توکن تمدید شش ماه اعتبار دارد.
            </p>
          )}
        </Step>

        {hasToken && (
          <div className="text-xs text-gray-500 space-y-1 pt-1 border-t border-gray-100 dark:border-white/[0.06]">
            {auth?.activatedAt && <p className="pt-3">فعال‌شده: {new Date(auth.activatedAt).toLocaleString("fa-IR")}</p>}
            {auth?.accessExpiresAt && <p>انقضای توکن فعلی: {new Date(auth.accessExpiresAt).toLocaleString("fa-IR")}</p>}
            {auth?.userAgent && <p>User-Agent پذیرفته‌شده: <span dir="ltr" className="font-mono">{auth.userAgent.slice(0, 60)}</span></p>}
            {!!auth?.scopes.length && (
              <p className="flex flex-wrap gap-1 items-center">
                دسترسی‌ها:
                {auth.scopes.map(s => (
                  <span key={s} dir="ltr" className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-white/5 font-mono text-[10px]">{s}</span>
                ))}
              </p>
            )}
          </div>
        )}

        {result && (
          <div className={`p-3 rounded-xl text-sm ${
            result.success
              ? "bg-green-50 dark:bg-green-900/10 text-green-700 dark:text-green-400"
              : "bg-red-50 dark:bg-red-900/10 text-red-700 dark:text-red-400"
          }`}>
            {result.success ? "✓ " : "✗ "}{result.message}
            {!!result.probes?.length && (
              <div className="mt-3 space-y-1 text-[11px] text-gray-600 dark:text-gray-400">
                <p className="font-bold">User-Agentهای آزموده:</p>
                {result.probes.map((p, i) => (
                  <div key={i} className="flex gap-2 items-start">
                    <span className={p.ok ? "text-green-600" : "text-red-500"}>{p.ok ? "✓" : "✗"}</span>
                    <span className="shrink-0">{p.label}</span>
                    <span dir="ltr" className="font-mono break-all opacity-70">{p.userAgent.slice(0, 60)}</span>
                    {!p.ok && <span dir="ltr" className="opacity-70 mr-auto">{p.message}</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {hasToken && (
          <button onClick={handleTest} disabled={testing} className={btnOutline}>
            {testing ? "در حال تست..." : "تست اتصال"}
          </button>
        )}
      </div>

      <div className={card}>
        <h2 className="font-black text-sm text-gray-900 dark:text-white">تنظیمات همگام‌سازی</h2>
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-50 dark:bg-blue-900/10 text-blue-700 dark:text-blue-300 text-xs">
          <span>فروشگاه → دیجی‌کالا</span><span className="opacity-50">—</span>
          <span>قیمت‌ها به ریال ارسال می‌شوند</span>
        </div>
        <div className="space-y-3">
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" checked={syncStock} onChange={e => setSyncStock(e.target.checked)} className="w-4 h-4 accent-blue-600 rounded" />
            <div>
              <p className="text-sm font-bold text-gray-800 dark:text-gray-200">همگام‌سازی موجودی</p>
              <p className="text-xs text-gray-400">«موجودی نزد فروشنده» تنوع‌ها به‌روز می‌شود؛ موجودی انبار دیجی‌کالا دست‌نخورده می‌ماند</p>
            </div>
          </label>
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" checked={syncPrice} onChange={e => setSyncPrice(e.target.checked)} className="w-4 h-4 accent-blue-600 rounded" />
            <div>
              <p className="text-sm font-bold text-gray-800 dark:text-gray-200">همگام‌سازی قیمت</p>
              <p className="text-xs text-gray-400">قیمت محاسبه‌شده از قوانین قیمت به‌عنوان قیمت فروش ارسال می‌شود</p>
            </div>
          </label>
        </div>
        <div>
          <label className="block text-xs font-bold text-gray-500 mb-1.5">بازه خودکار (دقیقه)</label>
          <input type="number" value={interval} onChange={e => setInterval(e.target.value)} min={15} max={1440}
            className="w-32 px-3 py-2 rounded-xl border border-gray-200 dark:border-white/[0.08] bg-gray-50 dark:bg-white/[0.03] text-sm text-gray-900 dark:text-white focus:outline-none focus:border-blue-500 transition-colors" dir="ltr" />
        </div>
        <button onClick={handleSaveSettings} disabled={saving || !existingConnection && !hasKey} className={btnPrimary}>
          {saving ? "ذخیره..." : saved ? "✓ ذخیره شد" : "ذخیره تنظیمات"}
        </button>
      </div>

      {hasToken && (
        <div className={card}>
          <h2 className="font-black text-sm text-gray-900 dark:text-white">اجرای دستی</h2>
          <p className="text-xs text-gray-400">دریافت تنوع‌های دیجی‌کالا برای نگاشت (و لازم برای سینک موجودی/قیمت)</p>
          {syncMsg && <p className="text-sm text-blue-600 dark:text-blue-400 font-medium">{syncMsg}</p>}
          <button onClick={handleFetchProducts} disabled={syncing} className={btnGhost}>
            {syncing ? "در صف..." : "دریافت محصولات از دیجی‌کالا"}
          </button>
        </div>
      )}
    </div>
  );
}
