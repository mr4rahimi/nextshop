"use client";

import { useEffect, useState } from "react";

interface Storage { id: number; name: string }
interface InvoiceConfig { autoInvoiceEnabled?: boolean; invoiceStorageId?: number; autoInvoiceSince?: string }
interface ConnRow { platformCode: string; config?: InvoiceConfig | null }

export default function AutoInvoiceSettings() {
  const [enabled,   setEnabled]   = useState(false);
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
          با فعال بودن این گزینه، سفارش‌های تأییدشده سایت و سفارش‌های جدید باسلام به‌صورت خودکار
          به‌عنوان فاکتور فروش در وب‌حسابان ثبت می‌شوند و موجودی حسابداری خودکار کم می‌شود.
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
            <span className="text-sm font-bold text-gray-700 dark:text-gray-300">فعال</span>
          </label>

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
