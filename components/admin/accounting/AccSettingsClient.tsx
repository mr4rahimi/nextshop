"use client";

/**
 * تنظیمات حسابداری — عمومی (مالیات، قفل دفاتر، ثبت خودکار)، اطلاعات کسب‌وکار، سال مالی.
 * `?tab=seller` مستقیم زبانه‌ی کسب‌وکار را باز می‌کند (از «شروع کار»).
 */

import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { formatJalali, toJalali } from "@/lib/club/jalali";
import { dayValue } from "@/lib/accounting/dates";
import { faNum } from "@/lib/accounting/money";
import JalaliDatePicker from "@/components/admin/JalaliDatePicker";
import { api, Badge, btn, Card, Chips, ErrorText, Field, inputCls, PageHeader, SectionTitle } from "./ui";
import { Plus } from "lucide-react";

interface Settings {
  vatRateBp: number;
  pricesIncludeVat: boolean;
  vatEnabled: boolean;
  lockDate: string | null;
  currentYearId: string | null;
  sellerName: string | null;
  sellerNationalId: string | null;
  sellerEconomicCode: string | null;
  sellerRegNo: string | null;
  sellerPostalCode: string | null;
  sellerAddress: string | null;
  sellerPhone: string | null;
  stampImage: string | null;
  signatureImage: string | null;
  invoiceFooterNote: string | null;
  installmentTreasuryId: string | null;
  payoutTreasuryId: string | null;
}
interface Year {
  id: string;
  title: string;
  startDate: string;
  endDate: string;
  status: "OPEN" | "CLOSED";
  _count: { vouchers: number };
}

type Tab = "general" | "seller" | "years";

export default function AccSettingsClient() {
  const sp = useSearchParams();
  const [tab, setTab] = useState<Tab>((sp.get("tab") as Tab) || "general");
  const [s, setS] = useState<Settings | null>(null);
  const [years, setYears] = useState<Year[]>([]);
  const [can, setCan] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [treasuries, setTreasuries] = useState<{ id: string; name: string; kind: string }[]>([]);

  const load = useCallback(() => {
    api<{ settings: Settings; years: Year[]; can: { settings: boolean } }>("/api/admin/accounting/settings/general")
      .then((d) => {
        setS(d.settings);
        setYears(d.years);
        setCan(d.can.settings);
      })
      .catch((e) => setError(e.message));
  }, []);
  useEffect(load, [load]);
  useEffect(() => {
    api<{ items: { id: string; name: string; kind: string }[] }>("/api/admin/accounting/treasury")
      .then((d) => setTreasuries(d.items.filter((t) => t.kind === "CASH" || t.kind === "BANK")))
      .catch(() => {});
  }, []);

  async function save(patch: Partial<Settings> & { lockDate?: string | null }) {
    setBusy(true);
    setError(null);
    setSaved(null);
    try {
      await api("/api/admin/accounting/settings/general", { method: "PATCH", json: patch });
      setSaved("ذخیره شد");
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "ذخیره نشد");
    } finally {
      setBusy(false);
    }
  }

  async function addYear() {
    const last = years[0];
    const next = last ? toJalali(new Date(last.startDate)).year + 1 : toJalali(new Date()).year;
    if (!window.confirm(`سال مالی ${faNum(next)} تعریف شود؟`)) return;
    try {
      await api("/api/admin/accounting/years", { method: "POST", json: { jalaliYear: next } });
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "ساخته نشد");
    }
  }

  if (!s) return error ? <ErrorText>{error}</ErrorText> : <p className="text-xs text-gray-400">در حال بارگذاری…</p>;
  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => setS({ ...s, [k]: v });
  const ro = !can;

  return (
    <div className="space-y-4">
      <PageHeader title="تنظیمات حسابداری" help="accountingSettings" />
      <Chips<Tab>
        value={tab}
        onChange={(t) => {
          setTab(t);
          setSaved(null);
        }}
        options={[
          { value: "general", label: "عمومی و قفل دفاتر" },
          { value: "seller", label: "اطلاعات کسب‌وکار" },
          { value: "years", label: "سال مالی" },
        ]}
      />
      <ErrorText>{error}</ErrorText>
      {saved && <p className="text-xs font-bold text-emerald-600">✓ {saved}</p>}

      {tab === "general" && (
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="p-4 space-y-4">
            <SectionTitle title="مالیات بر ارزش افزوده" help="accountingVat" />
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" className="mt-1" checked={s.vatEnabled} onChange={(e) => set("vatEnabled", e.target.checked)} disabled={ro} />
              <span>
                کسب‌وکار مشمول ارزش افزوده است
                <span className="block text-[11px] text-gray-400 leading-5">خاموش: فاکتورها بی‌مالیات صادر می‌شوند. روشن: مالیات روی ردیف‌ها می‌آید و از فروش سایت جدا می‌شود.</span>
              </span>
            </label>
            <Field label="نرخ پیش‌فرض (درصد)" hint="روی هر ردیف فاکتور قابل تغییر است">
              <input
                value={s.vatRateBp / 100}
                onChange={(e) => set("vatRateBp", Math.round(Number(e.target.value.replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))) * 100) || 0)}
                className={inputCls}
                inputMode="decimal"
                dir="ltr"
                disabled={ro}
              />
            </Field>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={s.pricesIncludeVat} onChange={(e) => set("pricesIncludeVat", e.target.checked)} disabled={ro} />
              قیمت‌هایی که در فاکتور دستی وارد می‌شود شامل مالیات است
            </label>
            {!ro && (
              <button onClick={() => save({ vatEnabled: s.vatEnabled, vatRateBp: s.vatRateBp, pricesIncludeVat: s.pricesIncludeVat })} disabled={busy} className={btn.primary}>
                ذخیره
              </button>
            )}
          </Card>
          <Card className="p-4 space-y-4">
            <SectionTitle title="قفل دفاتر" help="accountingSettings" />
            <p className="text-xs text-gray-500 leading-6">
              تا این تاریخ هیچ ثبت، ویرایش یا ابطالی ممکن نیست. بعد از بستن حساب هر ماه، قفل را جلو ببرید.
            </p>
            <Field label="قفل تا تاریخ">
              <JalaliDatePicker value={s.lockDate ? dayValue(new Date(s.lockDate)) : ""} onChange={(v: string) => set("lockDate", v || null)} disabled={ro} />
            </Field>
            {!ro && (
              <button onClick={() => save({ lockDate: s.lockDate })} disabled={busy} className={btn.primary}>
                ذخیره‌ی قفل
              </button>
            )}
          </Card>
          <Card className="p-4 space-y-4 md:col-span-2">
            <SectionTitle title="ثبت خودکار از بخش‌های دیگر" help="accountingAutoPosting" />
            <p className="text-xs text-gray-500 leading-6">
              این پول‌ها بیرون از حسابداری ثبت می‌شوند و حسابداری باید بداند روی کدام صندوق یا بانک بنشانَدشان. تا انتخاب نکنید، در «رویدادها» منتظر می‌مانند و بعد از انتخاب خودشان ثبت می‌شوند.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="واریز اقساط اعتباری (کارتابل)" hint="«پرداخت شد» یک قسط ← دریافت از مشتری روی این حساب">
                <select value={s.installmentTreasuryId ?? ""} onChange={(e) => set("installmentTreasuryId", e.target.value || null)} className={inputCls} disabled={ro}>
                  <option value="">— انتخاب نشده —</option>
                  {treasuries.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="تسویه‌ی پورسانت کارکنان" hint="ثبت پرداخت پورسانت ← هزینه‌ی پورسانت از این حساب">
                <select value={s.payoutTreasuryId ?? ""} onChange={(e) => set("payoutTreasuryId", e.target.value || null)} className={inputCls} disabled={ro}>
                  <option value="">— انتخاب نشده —</option>
                  {treasuries.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <p className="text-[11px] text-gray-400 leading-5">
              پرداخت آنلاین سایت با نام درگاه روی هر حساب در «صندوق و بانک» تعیین می‌شود؛ پرداخت از کیف پول و شارژ دستی کیف پول به صندوق نیاز ندارند.
            </p>
            {!ro && (
              <button onClick={() => save({ installmentTreasuryId: s.installmentTreasuryId, payoutTreasuryId: s.payoutTreasuryId })} disabled={busy} className={btn.primary}>
                ذخیره
              </button>
            )}
          </Card>
        </div>
      )}

      {tab === "seller" && (
        <Card className="p-4 space-y-4">
          <SectionTitle title="اطلاعات کسب‌وکار برای فاکتور رسمی" />
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="نام رسمی کسب‌وکار" className="sm:col-span-2">
              <input value={s.sellerName ?? ""} onChange={(e) => set("sellerName", e.target.value)} className={inputCls} disabled={ro} />
            </Field>
            <Field label="شناسه‌ی ملی / کد ملی">
              <input value={s.sellerNationalId ?? ""} onChange={(e) => set("sellerNationalId", e.target.value)} className={inputCls} dir="ltr" inputMode="numeric" disabled={ro} />
            </Field>
            <Field label="کد اقتصادی">
              <input value={s.sellerEconomicCode ?? ""} onChange={(e) => set("sellerEconomicCode", e.target.value)} className={inputCls} dir="ltr" inputMode="numeric" disabled={ro} />
            </Field>
            <Field label="شماره ثبت">
              <input value={s.sellerRegNo ?? ""} onChange={(e) => set("sellerRegNo", e.target.value)} className={inputCls} dir="ltr" inputMode="numeric" disabled={ro} />
            </Field>
            <Field label="تلفن">
              <input value={s.sellerPhone ?? ""} onChange={(e) => set("sellerPhone", e.target.value)} className={inputCls} dir="ltr" inputMode="tel" disabled={ro} />
            </Field>
            <Field label="کد پستی">
              <input value={s.sellerPostalCode ?? ""} onChange={(e) => set("sellerPostalCode", e.target.value)} className={inputCls} dir="ltr" inputMode="numeric" disabled={ro} />
            </Field>
            <Field label="آدرس" className="sm:col-span-2">
              <textarea value={s.sellerAddress ?? ""} onChange={(e) => set("sellerAddress", e.target.value)} className={inputCls} rows={2} disabled={ro} />
            </Field>
            <ImageField label="تصویر مهر" value={s.stampImage} onChange={(v) => set("stampImage", v)} disabled={ro} />
            <ImageField label="تصویر امضا" value={s.signatureImage} onChange={(v) => set("signatureImage", v)} disabled={ro} />
            <Field label="متن پایین فاکتور" className="sm:col-span-2" hint="مثلاً شرایط گارانتی یا شماره حساب برای واریز">
              <textarea value={s.invoiceFooterNote ?? ""} onChange={(e) => set("invoiceFooterNote", e.target.value)} className={inputCls} rows={2} disabled={ro} />
            </Field>
          </div>
          {!ro && (
            <button
              onClick={() =>
                save({
                  sellerName: s.sellerName,
                  sellerNationalId: s.sellerNationalId,
                  sellerEconomicCode: s.sellerEconomicCode,
                  sellerRegNo: s.sellerRegNo,
                  sellerPhone: s.sellerPhone,
                  sellerPostalCode: s.sellerPostalCode,
                  sellerAddress: s.sellerAddress,
                  stampImage: s.stampImage,
                  signatureImage: s.signatureImage,
                  invoiceFooterNote: s.invoiceFooterNote,
                })
              }
              disabled={busy}
              className={btn.primary}
            >
              ذخیره‌ی اطلاعات کسب‌وکار
            </button>
          )}
        </Card>
      )}

      {tab === "years" && (
        <Card className="overflow-hidden">
          <div className="px-4 pt-4">
            <SectionTitle
              title="سال‌های مالی"
              actions={
                !ro && (
                  <button onClick={addYear} className={btn.small}>
                    <Plus className="h-4 w-4" aria-hidden />
                    سال بعد
                  </button>
                )
              }
            />
          </div>
          <div className="divide-y divide-gray-100 dark:divide-white/5">
            {years.map((y) => (
              <div key={y.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <span className="text-lg font-black tabular-nums w-16">{faNum(y.title)}</span>
                <span className="flex-1 text-xs text-gray-500">
                  {formatJalali(new Date(y.startDate))} تا {formatJalali(new Date(y.endDate))} · {faNum(y._count.vouchers)} سند
                </span>
                {y.status === "CLOSED" ? <Badge tone="gray">بسته</Badge> : <Badge tone="green">باز</Badge>}
                {s.currentYearId === y.id ? (
                  <Badge tone="blue">سال جاری</Badge>
                ) : (
                  !ro && (
                    <button onClick={() => save({ currentYearId: y.id })} className={btn.small}>
                      سال جاری کن
                    </button>
                  )
                )}
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

function ImageField({ label, value, onChange, disabled }: { label: string; value: string | null; onChange: (v: string | null) => void; disabled?: boolean }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  async function upload(file: File) {
    setBusy(true);
    setErr(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("type", "image");
      const r = await fetch("/api/admin/upload", { method: "POST", body: fd });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "آپلود نشد");
      onChange(d.url);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "آپلود نشد");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Field label={label} hint="PNG با پس‌زمینه‌ی شفاف بهترین نتیجه را روی فاکتور دارد">
      <div className="flex items-center gap-3">
        <div className="w-20 h-20 rounded-xl border border-dashed border-gray-300 dark:border-white/10 flex items-center justify-center overflow-hidden bg-gray-50 dark:bg-white/5">
          {value ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={value} alt={label} className="max-w-full max-h-full object-contain" />
          ) : (
            <span className="text-[10px] text-gray-400">ندارد</span>
          )}
        </div>
        {!disabled && (
          <div className="flex flex-col gap-1.5">
            <label className={`${btn.small} cursor-pointer`}>
              {busy ? "…" : "انتخاب تصویر"}
              <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
            </label>
            {value && (
              <button type="button" onClick={() => onChange(null)} className="text-[11px] text-red-600">
                حذف
              </button>
            )}
          </div>
        )}
      </div>
      {err && <span className="block text-[11px] text-red-600 mt-1">{err}</span>}
    </Field>
  );
}
