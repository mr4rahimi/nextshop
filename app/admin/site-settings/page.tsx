"use client";

import { useEffect, useRef, useState } from "react";

interface SiteSettings {
  storeName: string; storeLogo: string; siteFavicon: string;
  siteDescription: string; siteKeywords: string;
  siteEmail: string; sitePhone: string; siteAddress: string;
  socialInstagram: string; socialTelegram: string;
  socialWhatsapp: string; socialTwitter: string;
  footerText: string; maintenanceMode: boolean;
  enamadCode: string; samanCode: string;
  trustBadge3: string; trustBadge4: string;
  smsApiKey: string;
  smsLineNumber: string;
  smsEnabled: boolean;
  smsPatternOtp: string;
  smsPatternOrderNew: string;
  smsPatternOrderPaid: string;
  smsPatternOrderConfirm: string;
  smsPatternOrderPrepare: string;
  smsPatternOrderPack: string;
  smsPatternOrderSent: string;
  smsPatternOrderDelivered: string;
  smsPatternOrderDone: string;
  smsPatternOrderCancel: string;
  walletEnabled: boolean;
}

const EMPTY: SiteSettings = {
  storeName: "", storeLogo: "", siteFavicon: "",
  siteDescription: "", siteKeywords: "",
  siteEmail: "", sitePhone: "", siteAddress: "",
  socialInstagram: "", socialTelegram: "", socialWhatsapp: "", socialTwitter: "",
  footerText: "", maintenanceMode: false,
  enamadCode: "", samanCode: "", trustBadge3: "", trustBadge4: "",
  smsApiKey: "", smsLineNumber: "", smsEnabled: false,
  smsPatternOtp: "", smsPatternOrderNew: "", smsPatternOrderPaid: "",
  smsPatternOrderConfirm: "", smsPatternOrderPrepare: "", smsPatternOrderPack: "",
  smsPatternOrderSent: "", smsPatternOrderDelivered: "", smsPatternOrderDone: "",
  smsPatternOrderCancel: "",
  walletEnabled: false,
};

type Tab = "general" | "social" | "advanced" | "sms" | "wallet";

export default function AdminSiteSettingsPage() {
  const [settings, setSettings] = useState<SiteSettings>({ ...EMPTY });
  const [tab, setTab] = useState<Tab>("general");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const logoInputRef    = useRef<HTMLInputElement>(null);
  const faviconInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/admin/site-settings").then(r => r.json()).then(d => {
      setSettings({
        storeName:       d.storeName       ?? "",
        storeLogo:       d.storeLogo       ?? "",
        siteFavicon:     d.siteFavicon     ?? "",
        siteDescription: d.siteDescription ?? "",
        siteKeywords:    d.siteKeywords    ?? "",
        siteEmail:       d.siteEmail       ?? "",
        sitePhone:       d.sitePhone       ?? "",
        siteAddress:     d.siteAddress     ?? "",
        socialInstagram: d.socialInstagram ?? "",
        socialTelegram:  d.socialTelegram  ?? "",
        socialWhatsapp:  d.socialWhatsapp  ?? "",
        socialTwitter:   d.socialTwitter   ?? "",
        footerText:      d.footerText      ?? "",
        maintenanceMode: d.maintenanceMode ?? false,
        enamadCode:      d.enamadCode      ?? "",
        samanCode:       d.samanCode       ?? "",
        trustBadge3:     d.trustBadge3     ?? "",
        trustBadge4:     d.trustBadge4     ?? "",
        smsApiKey:             d.smsApiKey             ?? "",
        smsLineNumber:         d.smsLineNumber         ?? "",
        smsEnabled:            d.smsEnabled            ?? false,
        smsPatternOtp:         d.smsPatternOtp         ?? "",
        smsPatternOrderNew:    d.smsPatternOrderNew    ?? "",
        smsPatternOrderPaid:   d.smsPatternOrderPaid   ?? "",
        smsPatternOrderConfirm: d.smsPatternOrderConfirm ?? "",
        smsPatternOrderPrepare: d.smsPatternOrderPrepare ?? "",
        smsPatternOrderPack:   d.smsPatternOrderPack   ?? "",
        smsPatternOrderSent:   d.smsPatternOrderSent   ?? "",
        smsPatternOrderDelivered: d.smsPatternOrderDelivered ?? "",
        smsPatternOrderDone:   d.smsPatternOrderDone   ?? "",
        smsPatternOrderCancel: d.smsPatternOrderCancel ?? "",
        walletEnabled: d.walletEnabled ?? false,
      });
      setLoading(false);
    });
  }, []);

  async function handleSave() {
    setSaving(true); setSaved(false);
    await fetch("/api/admin/site-settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
    });
    setSaving(false); setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  function set(key: keyof SiteSettings, val: string | boolean) {
    setSettings(s => ({ ...s, [key]: val }));
  }

  // آپلود تصویر — به عنوان URL ذخیره میشه (ادمین URL وارد می‌کنه)
  // در آینده می‌شه به آپلود واقعی تبدیل کرد

  if (loading) return (
    <div className="p-6 space-y-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="h-16 bg-gray-100 dark:bg-gray-800 rounded-2xl animate-pulse" />
      ))}
    </div>
  );

  const inp = "w-full border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 text-sm bg-white dark:bg-gray-800 dark:text-white outline-none focus:border-blue-500 transition-colors";
  const lbl = "block text-xs font-bold text-gray-500 mb-1";

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-gray-900 dark:text-white">تنظیمات سایت</h1>
          <p className="text-sm text-gray-400 mt-1">اطلاعات عمومی، برندینگ و شبکه‌های اجتماعی</p>
        </div>
        <button onClick={handleSave} disabled={saving}
          className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-black hover:bg-blue-700 disabled:opacity-60 transition-all shadow-lg shadow-blue-500/20">
          {saving ? (
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          ) : saved ? (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
            </svg>
          )}
          {saving ? "در حال ذخیره..." : saved ? "ذخیره شد ✓" : "ذخیره تنظیمات"}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 p-1 bg-gray-100 dark:bg-gray-800 rounded-2xl w-fit">
        {[
          { key: "general", label: "عمومی و برندینگ" },
          { key: "social",  label: "شبکه‌های اجتماعی" },
          { key: "advanced", label: "تنظیمات پیشرفته" },
          { key: "sms", label: "پیامک" },
          { key: "wallet", label: "کیف پول" }
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key as Tab)}
            className={`px-5 py-2.5 rounded-xl text-sm font-black transition-all ${tab === t.key ? "bg-white dark:bg-gray-900 text-blue-600 shadow-sm" : "text-gray-500 hover:text-gray-900 dark:hover:text-white"}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── تب عمومی ───────────────────────────────────────────── */}
      {tab === "general" && (
        <div className="space-y-6">

          {/* لوگو و فاویکن */}
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 space-y-6">
            <h3 className="font-black text-sm text-gray-900 dark:text-white flex items-center gap-2">
              <span className="w-1.5 h-5 bg-blue-600 rounded-full" />
              هویت بصری
            </h3>

            {/* لوگو */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <label className={lbl}>لوگو سایت</label>
                <div className="flex items-start gap-4">
                  <div className="w-24 h-24 rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-700 flex items-center justify-center bg-gray-50 dark:bg-gray-800 overflow-hidden flex-shrink-0">
                    {settings.storeLogo
                      ? <img src={settings.storeLogo} alt="logo" className="w-full h-full object-contain p-2" />
                      : <svg className="w-10 h-10 text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                    }
                  </div>
                  <div className="flex-1 space-y-2">
                    <input className={inp} placeholder="آدرس URL لوگو (مثلاً /assets/images/logo.png)"
                      value={settings.storeLogo} onChange={e => set("storeLogo", e.target.value)} />
                    <p className="text-[10px] text-gray-400">فرمت‌های PNG, SVG, WebP — پیشنهاد: ۲۰۰×۶۰ پیکسل</p>
                  </div>
                </div>
              </div>

              {/* فاویکن */}
              <div className="space-y-3">
                <label className={lbl}>فاویکن (Favicon)</label>
                <div className="flex items-start gap-4">
                  <div className="w-16 h-16 rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-700 flex items-center justify-center bg-gray-50 dark:bg-gray-800 overflow-hidden flex-shrink-0">
                    {settings.siteFavicon
                      ? <img src={settings.siteFavicon} alt="favicon" className="w-full h-full object-contain p-1.5" />
                      : <svg className="w-7 h-7 text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                    }
                  </div>
                  <div className="flex-1 space-y-2">
                    <input className={inp} placeholder="آدرس URL فاویکن (مثلاً /favicon.ico)"
                      value={settings.siteFavicon} onChange={e => set("siteFavicon", e.target.value)} />
                    <p className="text-[10px] text-gray-400">فرمت ICO یا PNG — ۳۲×۳۲ پیکسل</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* اطلاعات سایت */}
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 space-y-4">
            <h3 className="font-black text-sm text-gray-900 dark:text-white flex items-center gap-2">
              <span className="w-1.5 h-5 bg-blue-600 rounded-full" />
              اطلاعات سایت
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className={lbl}>نام سایت / فروشگاه *</label>
                <input className={inp} placeholder="مانا شاپ"
                  value={settings.storeName} onChange={e => set("storeName", e.target.value)} />
              </div>
              <div>
                <label className={lbl}>ایمیل تماس</label>
                <input className={inp} dir="ltr" placeholder="info@example.com" type="email"
                  value={settings.siteEmail} onChange={e => set("siteEmail", e.target.value)} />
              </div>
              <div>
                <label className={lbl}>شماره تماس</label>
                <input className={inp} dir="ltr" placeholder="021-12345678"
                  value={settings.sitePhone} onChange={e => set("sitePhone", e.target.value)} />
              </div>
              <div>
                <label className={lbl}>آدرس فیزیکی</label>
                <input className={inp} placeholder="تهران، ..."
                  value={settings.siteAddress} onChange={e => set("siteAddress", e.target.value)} />
              </div>
            </div>
            <div>
              <label className={lbl}>توضیحات سایت (Meta Description)</label>
              <textarea rows={3} className={`${inp} resize-none`}
                placeholder="توضیح کوتاه درباره فروشگاه — برای SEO مهم است (حداکثر ۱۶۰ کاراکتر)"
                value={settings.siteDescription} onChange={e => set("siteDescription", e.target.value)} />
              <p className="text-[10px] text-gray-400 mt-1">{settings.siteDescription.length}/160 کاراکتر</p>
            </div>
            <div>
              <label className={lbl}>کلمات کلیدی (Meta Keywords)</label>
              <input className={inp} placeholder="فروشگاه اینترنتی، خرید آنلاین، ..."
                value={settings.siteKeywords} onChange={e => set("siteKeywords", e.target.value)} />
              <p className="text-[10px] text-gray-400 mt-1">با کاما جدا کنید</p>
            </div>
            <div>
              <label className={lbl}>متن فوتر</label>
              <input className={inp} placeholder="تمامی حقوق محفوظ است © ۱۴۰۴"
                value={settings.footerText} onChange={e => set("footerText", e.target.value)} />
            </div>
          </div>
        </div>
      )}

      {/* ── تب شبکه‌های اجتماعی ────────────────────────────────── */}
      {tab === "social" && (
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 space-y-5">
          <h3 className="font-black text-sm text-gray-900 dark:text-white flex items-center gap-2">
            <span className="w-1.5 h-5 bg-blue-600 rounded-full" />
            شبکه‌های اجتماعی
          </h3>
          <p className="text-xs text-gray-400">آدرس پروفایل یا لینک کانال/صفحه را وارد کنید</p>

          {[
            { key: "socialInstagram", label: "اینستاگرام", placeholder: "https://instagram.com/yourpage", color: "text-pink-500", icon: "M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" },
            { key: "socialTelegram", label: "تلگرام", placeholder: "https://t.me/yourchannel", color: "text-blue-500", icon: "M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.562 8.248l-2.026 9.546c-.148.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12L7.18 14.71l-2.965-.924c-.645-.204-.657-.645.136-.953l11.57-4.461c.537-.194 1.006.131.641.876z" },
            { key: "socialWhatsapp", label: "واتساپ", placeholder: "https://wa.me/989123456789", color: "text-green-500", icon: "M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" },
            { key: "socialTwitter", label: "توییتر / X", placeholder: "https://twitter.com/yourhandle", color: "text-sky-500", icon: "M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.748l7.73-8.835L1.254 2.25H8.08l4.259 5.631z" },
          ].map(item => (
            <div key={item.key} className="flex items-center gap-4">
              <div className={`w-10 h-10 rounded-xl bg-gray-50 dark:bg-gray-800 flex items-center justify-center flex-shrink-0 ${item.color}`}>
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d={item.icon} />
                </svg>
              </div>
              <div className="flex-1">
                <label className={lbl}>{item.label}</label>
                <input className={inp} dir="ltr" placeholder={item.placeholder}
                  value={(settings as any)[item.key]} onChange={e => set(item.key as keyof SiteSettings, e.target.value)} />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── تب پیشرفته ──────────────────────────────────────────── */}
      {tab === "advanced" && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 space-y-4">
            <h3 className="font-black text-sm text-gray-900 dark:text-white flex items-center gap-2">
              <span className="w-1.5 h-5 bg-blue-600 rounded-full" />
              تنظیمات پیشرفته
            </h3>

            {/* حالت تعمیر */}
            <div className={`flex items-center justify-between p-5 rounded-2xl border-2 transition-all ${settings.maintenanceMode ? "border-amber-400 bg-amber-50 dark:bg-amber-900/10" : "border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50"}`}>
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${settings.maintenanceMode ? "bg-amber-100 dark:bg-amber-900/30 text-amber-600" : "bg-gray-100 dark:bg-gray-800 text-gray-400"}`}>
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <div>
                  <p className={`font-black text-sm ${settings.maintenanceMode ? "text-amber-700 dark:text-amber-400" : "text-gray-700 dark:text-gray-300"}`}>
                    حالت تعمیر و نگهداری
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {settings.maintenanceMode ? "⚠️ سایت برای کاربران غیرفعال است" : "سایت برای همه کاربران در دسترس است"}
                  </p>
                </div>
              </div>
              <label className="cursor-pointer flex-shrink-0">
                <div className="relative">
                  <input type="checkbox" className="sr-only peer"
                    checked={settings.maintenanceMode}
                    onChange={e => set("maintenanceMode", e.target.checked)} />
                  <div className="w-14 h-7 bg-gray-200 dark:bg-gray-700 peer-checked:bg-amber-500 rounded-full transition-all shadow-inner" />
                  <div className="absolute top-1 left-1 w-5 h-5 bg-white rounded-full shadow transition-all peer-checked:translate-x-7" />
                </div>
              </label>
            </div>

            {settings.maintenanceMode && (
              <div className="p-4 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-2xl flex items-start gap-3">
                <svg className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <p className="text-xs font-bold text-amber-700 dark:text-amber-300">
                  حالت تعمیر فعال است. کاربران عادی به سایت دسترسی ندارند. فقط ادمین‌ها می‌توانند سایت را مشاهده کنند.
                </p>
              </div>
            )}
          </div>

          {/* پیش‌نمایش SEO */}
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 space-y-4">
            <h3 className="font-black text-sm text-gray-900 dark:text-white flex items-center gap-2">
              <span className="w-1.5 h-5 bg-blue-600 rounded-full" />
              پیش‌نمایش در گوگل
            </h3>
            <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700">
              <p className="text-[10px] text-gray-400 mb-2 uppercase tracking-widest">نمایش در نتایج جستجو</p>
              <div className="space-y-1">
                <p className="text-blue-700 dark:text-blue-400 text-base font-medium leading-tight">
                  {settings.storeName || "نام فروشگاه"} — خرید آنلاین
                </p>
                <p className="text-green-700 dark:text-green-500 text-[11px]">
                  example.com
                </p>
                <p className="text-gray-600 dark:text-gray-400 text-xs leading-relaxed line-clamp-2">
                  {settings.siteDescription || "توضیحات سایت اینجا نمایش داده می‌شود..."}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* نمادهای اعتماد — فقط در تب advanced */}
      {tab === "advanced" && (
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 space-y-4">
          <h3 className="font-black text-sm text-gray-900 dark:text-white flex items-center gap-2">
            <span className="w-1.5 h-5 bg-blue-600 rounded-full" />
            نمادهای اعتماد
          </h3>
          <p className="text-xs text-gray-400">کد HTML نمادها را از سایت مربوطه دریافت کنید یا آدرس تصویر وارد کنید</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              { key: "enamadCode",  label: "اینماد (کد HTML)",      placeholder: '<a referrerpolicy="origin" target="_blank" href="...' },
              { key: "samanCode",   label: "ساماندهی (کد HTML)",     placeholder: '<a href="https://trustseal.enamad.ir/..." ...>' },
              { key: "trustBadge3", label: "نماد سوم (URL تصویر)",   placeholder: "https://example.com/badge3.png" },
              { key: "trustBadge4", label: "نماد چهارم (URL تصویر)", placeholder: "https://example.com/badge4.png" },
            ].map(f => (
              <div key={f.key} className="space-y-1.5">
                <label className="block text-xs font-bold text-gray-500">{f.label}</label>
                <textarea rows={3} className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 text-sm bg-white dark:bg-gray-800 dark:text-white outline-none focus:border-blue-500 resize-none font-mono text-xs"
                  placeholder={f.placeholder} dir="ltr"
                  value={(settings as any)[f.key] ?? ""}
                  onChange={e => set(f.key as any, e.target.value)} />
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "sms" && (
        <div className="space-y-6">
          {/* تنظیمات اتصال */}
          <div className="bg-white dark:bg-[#0f1117] border border-gray-200 dark:border-white/[0.06] rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-black text-gray-900 dark:text-white">تنظیمات اتصال ایران پیامک</h3>
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-500">فعال</span>
                <button type="button" onClick={() => set("smsEnabled", !settings.smsEnabled)}
                  className={`w-10 h-6 rounded-full transition-colors relative ${settings.smsEnabled ? "bg-blue-600" : "bg-gray-200 dark:bg-white/10"}`}>
                  <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${settings.smsEnabled ? "translate-x-5" : "translate-x-1"}`} />
                </button>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-black text-gray-700 dark:text-gray-300">API Key</label>
                <input dir="ltr" value={settings.smsApiKey} onChange={e => set("smsApiKey", e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-blue-500 transition-all font-mono"
                  placeholder="API Key ایران پیامک" />
              </div>
              <div className="space-y-1.5">
                <label className="block text-xs font-black text-gray-700 dark:text-gray-300">شماره خط</label>
                <input dir="ltr" value={settings.smsLineNumber} onChange={e => set("smsLineNumber", e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-blue-500 transition-all font-mono"
                  placeholder="5000..." />
              </div>
            </div>
          </div>
      
          {/* کدهای پترن */}
          <div className="bg-white dark:bg-[#0f1117] border border-gray-200 dark:border-white/[0.06] rounded-2xl p-5">
            <h3 className="text-sm font-black text-gray-900 dark:text-white mb-4">کدهای پترن پیامک</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                { key: "smsPatternOtp",          label: "کد تایید / ثبت‌نام",      hint: "متغیر: {code}" },
                { key: "smsPatternOrderNew",     label: "ثبت سفارش - پرداخت موفق", hint: "متغیر: {order_id}, {name}" },
                { key: "smsPatternOrderPaid",    label: "پرداخت شده",              hint: "متغیر: {order_id}, {name}" },
                { key: "smsPatternOrderConfirm", label: "تأیید شده",               hint: "متغیر: {order_id}, {name}" },
                { key: "smsPatternOrderPrepare", label: "در حال آماده‌سازی",       hint: "متغیر: {order_id}, {name}" },
                { key: "smsPatternOrderPack",    label: "بسته‌بندی",               hint: "متغیر: {order_id}, {name}" },
                { key: "smsPatternOrderSent",    label: "ارسال شده",               hint: "متغیر: {order_id}, {name}, {tracking}" },
                { key: "smsPatternOrderDelivered", label: "تحویل داده شده",        hint: "متغیر: {order_id}, {name}" },
                { key: "smsPatternOrderDone",    label: "تکمیل شده",              hint: "متغیر: {order_id}, {name}" },
                { key: "smsPatternOrderCancel",  label: "لغو شده",                hint: "متغیر: {order_id}, {name}" },
              ].map(({ key, label, hint }) => (
                <div key={key} className="space-y-1.5">
                  <label className="block text-xs font-black text-gray-700 dark:text-gray-300">{label}</label>
                  <input dir="ltr" value={(settings as any)[key]} onChange={e => set(key as any, e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-blue-500 transition-all font-mono"
                    placeholder="کد پترن..." />
                  <p className="text-[10px] text-gray-400">{hint}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === "wallet" && (
        <div className="bg-white dark:bg-[#0f1117] border border-gray-200 dark:border-white/[0.06] rounded-2xl p-5">
          <div className={`flex items-center justify-between p-5 rounded-2xl border-2 transition-all ${settings.walletEnabled ? "border-blue-400 bg-blue-50 dark:bg-blue-900/10" : "border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50"}`}>
            <div className="flex items-center gap-4">
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${settings.walletEnabled ? "bg-blue-100 dark:bg-blue-900/30 text-blue-600" : "bg-gray-100 dark:bg-gray-800 text-gray-400"}`}>
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                </svg>
              </div>
              <div>
                <p className={`font-black text-sm ${settings.walletEnabled ? "text-blue-700 dark:text-blue-400" : "text-gray-700 dark:text-gray-300"}`}>
                  کیف پول
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {settings.walletEnabled ? "✓ کیف پول برای کاربران فعال است" : "کیف پول غیرفعال است"}
                </p>
              </div>
            </div>
            <button type="button" onClick={() => set("walletEnabled", !settings.walletEnabled)}
              className={`w-12 h-7 rounded-full transition-colors relative ${settings.walletEnabled ? "bg-blue-600" : "bg-gray-200 dark:bg-white/10"}`}>
              <div className={`absolute top-1 w-5 h-5 bg-white rounded-full shadow transition-transform ${settings.walletEnabled ? "translate-x-6" : "translate-x-1"}`} />
            </button>
          </div>
        </div>
      )}

      {/* دکمه ذخیره پایین صفحه */}
      <div className="flex justify-end pt-4 border-t border-gray-100 dark:border-gray-800">
        <button onClick={handleSave} disabled={saving}
          className="px-8 py-3 bg-blue-600 text-white rounded-xl text-sm font-black hover:bg-blue-700 disabled:opacity-60 transition-all shadow-lg shadow-blue-500/20">
          {saving ? "در حال ذخیره..." : saved ? "✓ ذخیره شد" : "ذخیره تمام تنظیمات"}
        </button>
      </div>
    </div>
  );
}