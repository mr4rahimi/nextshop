"use client";

import { useEffect, useState } from "react";

interface Storage { id: number; name: string }
type InvoiceMode = "AUTO" | "MANUAL";
interface InvoiceConfig {
  autoInvoiceEnabled?: boolean;
  invoiceStorageId?: number;
  autoInvoiceSince?: string;
  invoiceMode?: InvoiceMode;
}
interface ConnRow { platformCode: string; config?: InvoiceConfig | null }

export default function AutoInvoiceSettings() {
  const [enabled,   setEnabled]   = useState(false);
  const [mode,      setMode]      = useState<InvoiceMode>("AUTO");
  const [storageId, setStorageId] = useState<string>("");
  const [since,     setSince]     = useState<string | null>(null);
  const [storages,  setStorages]  = useState<Storage[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [saving,    setSaving]    = useState(false);
  const [msg,       setMsg]       = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [connRes, stRes] = await Promise.all([
          fetch("/api/integration/connections?platform=hesaban"),
          fetch("/api/integration/hesaban/storages"),
        ]);
        const conns = await connRes.json() as ConnRow[];
        const cfg = conns?.[0]?.config ?? {};
        setEnabled(!!cfg.autoInvoiceEnabled);
        setMode(cfg.invoiceMode === "MANUAL" ? "MANUAL" : "AUTO");
        setStorageId(cfg.invoiceStorageId ? String(cfg.invoiceStorageId) : "");
        setSince(cfg.autoInvoiceSince ?? null);
        const st = await stRes.json() as { storages?: Storage[] };
        setStorages(st.storages ?? []);
      } catch {
        setMsg("خطا در دریافت اطلاعات — اتصال حسابداری را بررسی کنید");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function handleSave() {
    if (enabled && !storageId) { setMsg("برای فعال‌سازی، انبار فاکتور را انتخاب کنید"); return; }
    setSaving(true); setMsg(null);
    try {
      // autoInvoiceSince: فقط سفارش‌های بعد از اولین فعال‌سازی فاکتور می‌خورند
      // تا برای سفارش‌های قدیمی که دستی فاکتور خورده‌اند فاکتور تکراری ثبت نشود
      const newSince = enabled ? (since ?? new Date().toISOString()) : since;
      const res = await fetch("/api/integration/connections", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          platformCode: "hesaban",
          config: {
            autoInvoiceEnabled: enabled,
            invoiceMode:        mode,
            invoiceStorageId:   storageId ? Number(storageId) : undefined,
            autoInvoiceSince:   newSince ?? undefined,
          },
        }),
      });
      if (res.ok) {
        setSince(newSince);
        setMsg("ذخیره شد ✓");
      } else {
        const d = await res.json().catch(() => ({})) as { error?: string };
        setMsg(d.error ?? "خطا در ذخیره");
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-5 rounded-2xl border border-gray-200 dark:border-white/[0.06] bg-white dark:bg-[#0f1117] space-y-4">
      <div>
        <h3 className="font-black text-gray-900 dark:text-white text-sm">ثبت خودکار فاکتور فروش</h3>
        <p className="text-xs text-gray-500 mt-1 leading-5">
          سفارش‌های تأییدشده سایت و سفارش‌های جدید بازارگاه‌ها به‌عنوان فاکتور فروش در
          وب‌حسابان ثبت می‌شوند و موجودی حسابداری کم می‌شود. با گزینه‌ی زیر انتخاب کنید
          این کار خودکار انجام شود یا با تأیید خودتان.
        </p>
      </div>

      {loading ? (
        <p className="text-xs text-gray-400">در حال بارگذاری...</p>
      ) : (
        <>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              className="w-4 h-4 accent-blue-600"
            />
            <span className="text-sm font-bold text-gray-700 dark:text-gray-300">ثبت فاکتور فروش فعال باشد</span>
          </label>

          {enabled && (
            <div className="space-y-2">
              <label className="block text-xs font-bold text-gray-500">شیوه ثبت فاکتور</label>

              <label className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                mode === "AUTO"
                  ? "border-blue-500 bg-blue-50/50 dark:bg-blue-900/10"
                  : "border-gray-200 dark:border-white/[0.08] hover:border-gray-300"
              }`}>
                <input
                  type="radio" name="invoiceMode" value="AUTO"
                  checked={mode === "AUTO"}
                  onChange={() => setMode("AUTO")}
                  className="mt-0.5 w-4 h-4 accent-blue-600"
                />
                <span>
                  <span className="block text-sm font-bold text-gray-800 dark:text-gray-100">خودکار</span>
                  <span className="block text-[11px] text-gray-500 mt-0.5 leading-5">
                    هر سفارشی که محصولش نگاشت حسابداری داشته باشد بدون دخالت شما فاکتور می‌خورد.
                    اگر بعداً محصولی را نگاشت کنید، سفارش‌های معطلِ آن هم خودکار فاکتور می‌شوند.
                  </span>
                </span>
              </label>

              <label className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                mode === "MANUAL"
                  ? "border-blue-500 bg-blue-50/50 dark:bg-blue-900/10"
                  : "border-gray-200 dark:border-white/[0.08] hover:border-gray-300"
              }`}>
                <input
                  type="radio" name="invoiceMode" value="MANUAL"
                  checked={mode === "MANUAL"}
                  onChange={() => setMode("MANUAL")}
                  className="mt-0.5 w-4 h-4 accent-blue-600"
                />
                <span>
                  <span className="block text-sm font-bold text-gray-800 dark:text-gray-100">دستی — با تأیید من</span>
                  <span className="block text-[11px] text-gray-500 mt-0.5 leading-5">
                    هیچ فاکتوری خودکار ثبت نمی‌شود. سفارش‌ها در صفحه‌ی «سفارش‌های بازارگاه»
                    جمع می‌شوند و هر کدام را که بخواهید با دکمه «ثبت فاکتور» می‌فرستید.
                  </span>
                </span>
              </label>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1.5">انبار فاکتور</label>
            <select
              value={storageId}
              onChange={(e) => setStorageId(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-white/[0.08] bg-gray-50 dark:bg-white/[0.03] text-sm text-gray-900 dark:text-white focus:outline-none focus:border-blue-500 transition-colors"
            >
              <option value="">— انتخاب انبار —</option>
              {storages.map((st) => (
                <option key={st.id} value={String(st.id)}>{st.name}</option>
              ))}
            </select>
          </div>

          {since && (
            <p className="text-[11px] text-gray-400">
              فاکتور خودکار برای سفارش‌های ثبت‌شده از {new Date(since).toLocaleString("fa-IR")} به بعد اعمال می‌شود
            </p>
          )}

          <div className="flex items-center gap-3">
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {saving ? "در حال ذخیره..." : "ذخیره تنظیمات فاکتور"}
            </button>
            {msg && <p className="text-xs text-gray-500">{msg}</p>}
          </div>
        </>
      )}
    </div>
  );
}
