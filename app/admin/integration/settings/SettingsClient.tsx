"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Lock, Save } from "lucide-react";
import { Card, PageHeader, SectionTitle, api, btn, inputCls } from "@/components/admin/accounting/ui";
import {
  HIDEABLE_SECTIONS, INTEG_GROUPS, INTEG_PROFILES, SELLER_PANELS, STOCK_SOURCE_LABEL,
} from "@/lib/integration/core/sections";

interface Platform {
  code: string;
  name: string;
  type: "ACCOUNTING" | "MARKETPLACE";
  isActive: boolean;
  supported: boolean;
  canCreateProduct: boolean;
  status: string | null;
  mappedCount: number;
  locked: boolean;
}

interface Data {
  accMode: "NONE" | "HESABAN" | "INTERNAL";
  profile: string | null;
  hiddenSections: string[];
  platformPrefs: Record<string, { panelUrl?: string }>;
  worker: { workerEnabled: boolean; workerIntervalSec: number; logRetentionDays: number };
  platforms: Platform[];
}

const ACC_MODE: Record<Data["accMode"], string> = {
  INTERNAL: "حسابداری داخلی",
  HESABAN: "حسابان وب",
  NONE: "بدون حسابداری",
};

function Toggle({ on, onChange, disabled }: { on: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      disabled={disabled}
      onClick={() => onChange(!on)}
      className={`relative h-6 w-11 flex-shrink-0 rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
        on ? "bg-teal-500" : "bg-gray-300 dark:bg-white/15"
      }`}
    >
      <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${on ? "left-0.5" : "left-[22px]"}`} />
    </button>
  );
}

/** تنظیمات یکپارچه‌سازی — docs/integrations/settings-and-guide.md */
export default function SettingsClient() {
  const router = useRouter();
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // پیش‌نویس
  const [active, setActive] = useState<Record<string, boolean>>({});
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [profile, setProfile] = useState<string | null>(null);
  const [prefs, setPrefs] = useState<Record<string, string>>({});
  const [worker, setWorker] = useState<Data["worker"] | null>(null);

  const load = useCallback(() => {
    api<Data>("/api/integration/settings")
      .then((d) => {
        setData(d);
        setActive(Object.fromEntries(d.platforms.map((p) => [p.code, p.isActive])));
        setHidden(new Set(d.hiddenSections));
        setProfile(d.profile);
        setPrefs(Object.fromEntries(Object.entries(d.platformPrefs ?? {}).map(([k, v]) => [k, v?.panelUrl ?? ""])));
        setWorker(d.worker);
        setError(null);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "بارگذاری نشد"));
  }, []);
  useEffect(load, [load]);

  const dirty = useMemo(() => {
    if (!data || !worker) return false;
    const platformsChanged = data.platforms.some((p) => active[p.code] !== p.isActive);
    const hiddenChanged = [...hidden].sort().join() !== [...data.hiddenSections].sort().join();
    const prefsChanged = data.platforms.some((p) => (prefs[p.code] ?? "") !== (data.platformPrefs?.[p.code]?.panelUrl ?? ""));
    const workerChanged = JSON.stringify(worker) !== JSON.stringify(data.worker);
    return platformsChanged || hiddenChanged || prefsChanged || workerChanged || profile !== data.profile;
  }, [data, active, hidden, prefs, worker, profile]);

  function applyProfile(key: string) {
    const p = INTEG_PROFILES.find((x) => x.key === key);
    if (!p) return;
    setProfile(key);
    setHidden(new Set(p.hidden));
  }

  function toggleSection(key: string, on: boolean) {
    setProfile(null);
    setHidden((h) => {
      const n = new Set(h);
      if (on) n.delete(key);
      else n.add(key);
      return n;
    });
  }

  async function save() {
    if (!data || !worker) return;
    setSaving(true);
    setError(null);
    try {
      await api("/api/integration/settings", {
        method: "PUT",
        json: {
          platforms: data.platforms.map((p) => ({ code: p.code, isActive: !!active[p.code] })),
          hiddenSections: [...hidden],
          profile,
          platformPrefs: Object.fromEntries(Object.entries(prefs).map(([k, v]) => [k, { panelUrl: v }])),
          worker,
        },
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
      load();
      router.refresh(); // قاب و منوها بخش‌های تازه را بگیرند
    } catch (e) {
      setError(e instanceof Error ? e.message : "ذخیره نشد");
    } finally {
      setSaving(false);
    }
  }

  if (!data || !worker) {
    return error ? <p className="text-sm font-bold text-red-600">{error}</p> : <p className="text-sm text-gray-400">در حال بارگذاری…</p>;
  }

  const source = data.accMode === "INTERNAL" ? "internal" : data.platforms.some((p) => p.code === "hesaban" && active.hesaban && (p.status === "CONNECTED" || p.status === "SYNCING")) ? "hesaban" : "site";
  const groups: { type: Platform["type"]; title: string; hint: string }[] = [
    { type: "MARKETPLACE", title: "بازارگاه‌ها", hint: "فقط بازارگاه‌هایی را روشن بگذارید که در آن‌ها غرفه دارید." },
    { type: "ACCOUNTING", title: "حسابداری بیرونی", hint: "اگر از حسابداری داخلی پنل یا هیچ حسابداری استفاده می‌کنید، خاموشش کنید تا نامش هیچ‌جا نیاید." },
  ];

  return (
    <div className="space-y-6 pb-20">
      <PageHeader
        title="تنظیمات یکپارچه‌سازی"
        help="integrationSettings"
        desc="سرویس‌هایی که با آن‌ها کار می‌کنید و بخش‌هایی که در پنل می‌بینید را متناسب با کسب‌وکارتان انتخاب کنید."
      />

      {/* نوع کسب‌وکار */}
      <section>
        <SectionTitle title="نوع کسب‌وکار" />
        <div className="grid gap-3 sm:grid-cols-3">
          {INTEG_PROFILES.map((p) => {
            const on = profile === p.key;
            return (
              <button
                key={p.key}
                type="button"
                onClick={() => applyProfile(p.key)}
                className={`acc-card rounded-2xl border p-4 text-right transition ${
                  on ? "border-teal-400 bg-teal-50 ring-2 ring-teal-400/30 dark:bg-teal-500/10" : "border-[var(--adm-border)] bg-[var(--adm-surface)] hover:border-teal-300"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-black text-gray-900 dark:text-white">{p.label}</span>
                  {on && <Check className="h-4 w-4 text-teal-600" aria-hidden />}
                </div>
                <p className="mt-1.5 text-xs leading-6 text-gray-500">{p.desc}</p>
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-[11px] text-gray-400">انتخاب هر گزینه فقط بخش‌های زیر را روشن و خاموش می‌کند؛ بعدش هر بخش را جدا هم می‌توانید تغییر دهید.</p>
      </section>

      {/* منبع موجودی */}
      <Card className="flex flex-wrap items-center gap-3 p-4">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-black text-gray-900 dark:text-white">
            منبع موجودی و قیمت خرید: {STOCK_SOURCE_LABEL[source].title}
          </p>
          <p className="mt-1 text-xs leading-6 text-gray-500">
            حسابداری کسب‌وکار: <b>{ACC_MODE[data.accMode]}</b>. {STOCK_SOURCE_LABEL[source].short}. این را در «حسابداری ← تنظیمات ← حسابداری کسب‌وکار» عوض می‌کنید.
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/admin/integration/guide" className={btn.small}>راهنمای نگاشت</Link>
          <Link href="/admin/accounting/settings?tab=mode" className={btn.small}>حسابداری کسب‌وکار</Link>
        </div>
      </Card>

      {/* سرویس‌ها */}
      {groups.map((g) => {
        const list = data.platforms.filter((p) => p.type === g.type);
        if (!list.length) return null;
        return (
          <section key={g.type}>
            <SectionTitle title={g.title} />
            <p className="-mt-2 mb-3 text-xs text-gray-500">{g.hint}</p>
            <Card className="divide-y divide-[var(--adm-border)]">
              {list.map((p) => {
                const on = !!active[p.code];
                return (
                  <div key={p.code} className="p-4">
                    <div className="flex items-center gap-3">
                      <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-gray-100 font-black text-gray-500 dark:bg-white/5">{p.name[0]}</span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-black text-gray-900 dark:text-white">{p.name}</p>
                        <p className="mt-0.5 text-[11px] text-gray-400">
                          {!p.supported
                            ? "هنوز پشتیبانی نمی‌شود"
                            : [
                                p.status === "CONNECTED" || p.status === "SYNCING" ? "متصل" : p.status === "ERROR" ? "اتصال خطا دارد" : "وصل نشده",
                                p.mappedCount ? `${p.mappedCount.toLocaleString("fa-IR")} محصول نگاشت‌شده` : null,
                                p.type === "MARKETPLACE" ? (p.canCreateProduct ? "ساخت خودکار محصول" : "قرار دادن دستی محصول") : null,
                              ].filter(Boolean).join(" · ")}
                        </p>
                      </div>
                      {p.locked && (
                        <span className="flex items-center gap-1 text-[11px] font-bold text-gray-400" title="حالت حسابداری کسب‌وکار روی حسابان است">
                          <Lock className="h-3.5 w-3.5" aria-hidden />
                          در حال استفاده
                        </span>
                      )}
                      <Toggle
                        on={on}
                        disabled={p.locked || (!p.supported && !on)}
                        onChange={(v) => setActive((a) => ({ ...a, [p.code]: v }))}
                      />
                    </div>
                    {on && p.type === "MARKETPLACE" && p.supported && !p.canCreateProduct && (
                      <div className="mt-3 pr-[52px]">
                        <label className="text-[11px] font-bold text-gray-500">آدرس پنل فروشندگی (برای دکمه‌ی «باز کردن پنل» در قرار دادن محصول)</label>
                        <input
                          dir="ltr"
                          value={prefs[p.code] ?? ""}
                          onChange={(e) => setPrefs((x) => ({ ...x, [p.code]: e.target.value }))}
                          placeholder={SELLER_PANELS[p.code] ?? "https://…"}
                          className={`${inputCls} mt-1 text-left`}
                        />
                      </div>
                    )}
                    {!on && p.mappedCount > 0 && (
                      <p className="mt-2 pr-[52px] text-[11px] leading-5 text-amber-600">
                        نگاشت‌های این سرویس پاک نمی‌شوند؛ فقط چیزی برایش ارسال یا از آن دریافت نمی‌شود و نامش در پنل نمی‌آید.
                      </p>
                    )}
                  </div>
                );
              })}
            </Card>
          </section>
        );
      })}

      {/* بخش‌ها */}
      <section>
        <SectionTitle title="بخش‌های پنل" />
        <p className="-mt-2 mb-3 text-xs text-gray-500">بخش خاموش از منو، خانه و پیشخوان پنهان می‌شود. خاموش‌کردن «پیام بازارگاه» دریافت پیام‌ها را هم متوقف می‌کند.</p>
        <Card className="divide-y divide-[var(--adm-border)]">
          {INTEG_GROUPS.map((g) => {
            const list = HIDEABLE_SECTIONS.filter((s) => s.group === g.key);
            if (!list.length) return null;
            return (
              <div key={g.key} className="p-4">
                <p className="mb-2 text-xs font-black text-gray-400">{g.label}</p>
                <div className="space-y-3">
                  {list.map((s) => (
                    <div key={s.key} className="flex items-center gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-gray-800 dark:text-gray-100">{s.label}</p>
                        <p className="text-[11px] leading-5 text-gray-500">{s.desc}</p>
                      </div>
                      <Toggle on={!hidden.has(s.key)} onChange={(v) => toggleSection(s.key, v)} />
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </Card>
      </section>

      {/* پیشرفته */}
      <section>
        <SectionTitle title="پیشرفته" />
        <Card className="space-y-4 p-4">
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-gray-800 dark:text-gray-100">همگام‌سازی خودکار</p>
              <p className="text-[11px] leading-5 text-gray-500">خاموش = هیچ ارسال و دریافتی (سفارش، موجودی، قیمت، پیام) در پس‌زمینه انجام نمی‌شود. فقط برای عیب‌یابی.</p>
            </div>
            <Toggle on={worker.workerEnabled} onChange={(v) => setWorker({ ...worker, workerEnabled: v })} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="text-[11px] font-bold text-gray-500">فاصله‌ی بررسی صف (ثانیه)</span>
              <input type="number" min={10} max={600} value={worker.workerIntervalSec}
                onChange={(e) => setWorker({ ...worker, workerIntervalSec: Number(e.target.value) })} className={`${inputCls} mt-1`} />
            </label>
            <label className="block">
              <span className="text-[11px] font-bold text-gray-500">نگه‌داری گزارش عملیات (روز)</span>
              <input type="number" min={3} max={365} value={worker.logRetentionDays}
                onChange={(e) => setWorker({ ...worker, logRetentionDays: Number(e.target.value) })} className={`${inputCls} mt-1`} />
            </label>
          </div>
        </Card>
      </section>

      {/* ذخیره */}
      <div className="fixed inset-x-0 bottom-16 z-30 px-4 md:bottom-4">
        <div className="mx-auto flex max-w-3xl items-center gap-3 rounded-2xl border border-[var(--adm-border)] bg-[var(--adm-surface)] p-3 shadow-xl">
          <p className="min-w-0 flex-1 text-xs text-gray-500">
            {error ? <span className="font-bold text-red-600">{error}</span> : saved ? <span className="font-bold text-emerald-600">ذخیره شد</span> : dirty ? "تغییرات ذخیره نشده‌اند" : "همه‌چیز ذخیره است"}
          </p>
          <button type="button" onClick={save} disabled={!dirty || saving} className={btn.primary}>
            <Save className="h-4 w-4" aria-hidden />
            {saving ? "در حال ذخیره…" : "ذخیره"}
          </button>
        </div>
      </div>
    </div>
  );
}
