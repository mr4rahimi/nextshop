"use client";

import { useState } from "react";

interface ShopInfo {
  userId?:      number;
  name?:        string;
  vendorId?:    number;
  vendorTitle?: string;
  identifier?:  string;
}

interface Props {
  existingConnection?: {
    id:               string;
    status:           string;
    lastSyncAt:       string | null;
    lastError:        string | null;
    syncStockEnabled: boolean;
    syncPriceEnabled: boolean;
    syncIntervalMin:  number;
  } | null;
}

export default function BasalamForm({ existingConnection }: Props) {
  const [accessToken,   setAccessToken]   = useState("");
  const [refreshToken,  setRefreshToken]  = useState("");
  const [vendorId,      setVendorId]      = useState("");
  const [syncStock,     setSyncStock]     = useState(existingConnection?.syncStockEnabled ?? true);
  const [syncPrice,     setSyncPrice]     = useState(existingConnection?.syncPriceEnabled ?? false);
  const [interval,      setInterval]      = useState(String(existingConnection?.syncIntervalMin ?? 60));
  const [testResult,    setTestResult]    = useState<{ success: boolean; message?: string; shopInfo?: ShopInfo } | null>(null);
  const [testing,       setTesting]       = useState(false);
  const [saving,        setSaving]        = useState(false);
  const [saved,         setSaved]         = useState(false);
  const [syncing,       setSyncing]       = useState<string | null>(null);
  const [syncMsg,       setSyncMsg]       = useState<string | null>(null);

  const credentials: Record<string, string> = { accessToken };
  if (refreshToken.trim()) credentials.refreshToken = refreshToken.trim();
  if (vendorId.trim())     credentials.vendorId     = vendorId.trim();

  async function handleTest() {
    if (!accessToken.trim()) {
      setTestResult({ success: false, message: "Access Token را وارد کنید" });
      return;
    }
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/integration/connections/test", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ platformCode: "basalam", credentials }),
      });
      const data = await res.json() as { success: boolean; message?: string; shopInfo?: ShopInfo };
      setTestResult(data);

      // auto-fill vendorId از نتیجه تست
      if (data.success && data.shopInfo?.vendorId && !vendorId.trim()) {
        setVendorId(String(data.shopInfo.vendorId));
      }
    } catch {
      setTestResult({ success: false, message: "خطای شبکه" });
    } finally {
      setTesting(false);
    }
  }

  async function handleSave() {
    if (!accessToken.trim()) {
      alert("Access Token را وارد کنید");
      return;
    }
    if (!vendorId.trim()) {
      alert("شناسه فروشگاه (vendorId) را وارد کنید یا اتصال را تست کنید تا به‌صورت خودکار پر شود");
      return;
    }
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch("/api/integration/connections", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          platformCode:     "basalam",
          credentials,
          syncStockEnabled: syncStock,
          syncPriceEnabled: syncPrice,
          syncIntervalMin:  Number(interval) || 60,
        }),
      });
      if (res.ok) setSaved(true);
      else alert("خطا در ذخیره");
    } finally {
      setSaving(false);
    }
  }

  async function handleSync(type: "SYNC_ALL_STOCK" | "SYNC_ALL_PRICE" | "FETCH_PRODUCTS") {
    setSyncing(type);
    setSyncMsg(null);
    try {
      const res = await fetch("/api/integration/sync", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ platformCode: "basalam", type, priority: type === "FETCH_PRODUCTS" ? 1 : 5 }),
      });
      const data = await res.json() as { jobId?: string; error?: string };
      if (res.ok) setSyncMsg(`عملیات در صف قرار گرفت (job: ${data.jobId?.slice(-6)})`);
      else setSyncMsg(data.error ?? "خطا");
    } finally {
      setSyncing(null);
    }
  }

  return (
    <div className="space-y-6">
      {/* وضعیت فعلی */}
      {existingConnection && (
        <div className={`p-4 rounded-2xl border text-sm ${
          existingConnection.status === "CONNECTED"
            ? "bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800"
            : "bg-gray-50 dark:bg-white/[0.02] border-gray-200 dark:border-white/[0.06]"
        }`}>
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${
              existingConnection.status === "CONNECTED" ? "bg-green-500" : "bg-gray-400"
            }`} />
            <span className="font-bold text-gray-900 dark:text-white">
              {existingConnection.status === "CONNECTED" ? "متصل" : "غیر متصل"}
            </span>
          </div>
          {existingConnection.lastSyncAt && (
            <p className="text-gray-500 mt-1 text-xs">
              آخرین sync: {new Date(existingConnection.lastSyncAt).toLocaleString("fa-IR")}
            </p>
          )}
          {existingConnection.lastError && (
            <p className="text-red-500 mt-1 text-xs">خطا: {existingConnection.lastError}</p>
          )}
        </div>
      )}

      {/* فرم اعتبارنامه */}
      <div className="bg-white dark:bg-[#0f1117] rounded-2xl border border-gray-200 dark:border-white/[0.06] p-5 space-y-4">
        <h2 className="font-black text-sm text-gray-900 dark:text-white">اعتبارنامه</h2>

        <div>
          <label className="block text-xs font-bold text-gray-500 mb-1.5">
            Access Token باسلام
            <span className="text-red-500 mr-1">*</span>
          </label>
          <input
            type="password"
            value={accessToken}
            onChange={e => setAccessToken(e.target.value)}
            placeholder="Personal Access Token از پنل باسلام"
            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-white/[0.08] bg-gray-50 dark:bg-white/[0.03] text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 transition-colors font-mono"
            dir="ltr"
          />
          <p className="text-[11px] text-gray-400 mt-1.5">
            از پنل باسلام → تنظیمات → API → Personal Access Token دریافت کنید
          </p>
        </div>

        <div>
          <label className="block text-xs font-bold text-gray-500 mb-1.5">
            Refresh Token (اختیاری)
          </label>
          <input
            type="password"
            value={refreshToken}
            onChange={e => setRefreshToken(e.target.value)}
            placeholder="برای تجدید خودکار توکن"
            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-white/[0.08] bg-gray-50 dark:bg-white/[0.03] text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 transition-colors font-mono"
            dir="ltr"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-gray-500 mb-1.5">
            شناسه فروشگاه (Vendor ID)
            <span className="text-red-500 mr-1">*</span>
          </label>
          <input
            type="text"
            value={vendorId}
            onChange={e => setVendorId(e.target.value)}
            placeholder="پس از تست اتصال به‌صورت خودکار پر می‌شود"
            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-white/[0.08] bg-gray-50 dark:bg-white/[0.03] text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 transition-colors font-mono"
            dir="ltr"
          />
          <p className="text-[11px] text-gray-400 mt-1.5">
            با زدن «تست اتصال» به‌صورت خودکار از API باسلام دریافت می‌شود
          </p>
        </div>

        {/* نتیجه تست */}
        {testResult && (
          <div className={`p-3 rounded-xl text-sm ${
            testResult.success
              ? "bg-green-50 dark:bg-green-900/10 text-green-700 dark:text-green-400"
              : "bg-red-50 dark:bg-red-900/10 text-red-700 dark:text-red-400"
          }`}>
            {testResult.success ? "✓ " : "✗ "}{testResult.message}
            {testResult.success && testResult.shopInfo && (
              <div className="mt-2 space-y-0.5 text-xs opacity-70">
                {testResult.shopInfo.vendorTitle && (
                  <p>فروشگاه: {testResult.shopInfo.vendorTitle}</p>
                )}
                {testResult.shopInfo.vendorId && (
                  <p>شناسه: {testResult.shopInfo.vendorId}</p>
                )}
                {testResult.shopInfo.identifier && (
                  <p>نشانه: {testResult.shopInfo.identifier}</p>
                )}
              </div>
            )}
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={handleTest}
            disabled={testing || !accessToken.trim()}
            className="px-4 py-2 rounded-xl border border-blue-500 text-blue-600 dark:text-blue-400 text-sm font-bold hover:bg-blue-50 dark:hover:bg-blue-900/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {testing ? "در حال تست..." : "تست اتصال"}
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !accessToken.trim() || !vendorId.trim()}
            className="px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {saving ? "ذخیره..." : saved ? "✓ ذخیره شد" : "ذخیره"}
          </button>
        </div>
      </div>

      {/* تنظیمات sync */}
      <div className="bg-white dark:bg-[#0f1117] rounded-2xl border border-gray-200 dark:border-white/[0.06] p-5 space-y-4">
        <h2 className="font-black text-sm text-gray-900 dark:text-white">تنظیمات همگام‌سازی</h2>

        {/* توضیح جهت */}
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-50 dark:bg-blue-900/10 text-blue-700 dark:text-blue-300 text-xs">
          <span>فروشگاه → باسلام</span>
          <span className="opacity-50">—</span>
          <span>موجودی و قیمت از فروشگاه شما به باسلام ارسال می‌شود</span>
        </div>

        <div className="space-y-3">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={syncStock}
              onChange={e => setSyncStock(e.target.checked)}
              className="w-4 h-4 accent-blue-600 rounded"
            />
            <div>
              <p className="text-sm font-bold text-gray-800 dark:text-gray-200">همگام‌سازی موجودی</p>
              <p className="text-xs text-gray-400">موجودی فروشگاه به باسلام ارسال می‌شود</p>
            </div>
          </label>

          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={syncPrice}
              onChange={e => setSyncPrice(e.target.checked)}
              className="w-4 h-4 accent-blue-600 rounded"
            />
            <div>
              <p className="text-sm font-bold text-gray-800 dark:text-gray-200">همگام‌سازی قیمت</p>
              <p className="text-xs text-gray-400">قیمت فروش فروشگاه به باسلام ارسال می‌شود</p>
            </div>
          </label>
        </div>

        <div>
          <label className="block text-xs font-bold text-gray-500 mb-1.5">بازه خودکار (دقیقه)</label>
          <input
            type="number"
            value={interval}
            onChange={e => setInterval(e.target.value)}
            min={15}
            max={1440}
            className="w-32 px-3 py-2 rounded-xl border border-gray-200 dark:border-white/[0.08] bg-gray-50 dark:bg-white/[0.03] text-sm text-gray-900 dark:text-white focus:outline-none focus:border-blue-500 transition-colors"
            dir="ltr"
          />
        </div>
      </div>

      {/* اجرای دستی */}
      {existingConnection?.status === "CONNECTED" && (
        <div className="bg-white dark:bg-[#0f1117] rounded-2xl border border-gray-200 dark:border-white/[0.06] p-5 space-y-4">
          <h2 className="font-black text-sm text-gray-900 dark:text-white">اجرای دستی</h2>
          <p className="text-xs text-gray-400">برای sync فوری یا دریافت اولیه محصولات باسلام</p>

          {syncMsg && (
            <p className="text-sm text-blue-600 dark:text-blue-400 font-medium">{syncMsg}</p>
          )}

          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => handleSync("FETCH_PRODUCTS")}
              disabled={syncing !== null}
              className="px-4 py-2 rounded-xl border border-gray-300 dark:border-white/10 text-gray-700 dark:text-gray-300 text-sm font-bold hover:bg-gray-50 dark:hover:bg-white/5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {syncing === "FETCH_PRODUCTS" ? "در صف..." : "دریافت محصولات از باسلام"}
            </button>

            {syncStock && (
              <button
                onClick={() => handleSync("SYNC_ALL_STOCK")}
                disabled={syncing !== null}
                className="px-4 py-2 rounded-xl bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-sm font-bold hover:opacity-80 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {syncing === "SYNC_ALL_STOCK" ? "در صف..." : "ارسال موجودی به باسلام"}
              </button>
            )}

            {syncPrice && (
              <button
                onClick={() => handleSync("SYNC_ALL_PRICE")}
                disabled={syncing !== null}
                className="px-4 py-2 rounded-xl bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-sm font-bold hover:opacity-80 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {syncing === "SYNC_ALL_PRICE" ? "در صف..." : "ارسال قیمت به باسلام"}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
