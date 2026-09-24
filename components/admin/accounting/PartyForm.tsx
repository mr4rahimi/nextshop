"use client";

/**
 * فرم شخص — اول فقط چیزهای لازم (نوع، نام، موبایل، نقش)؛ اطلاعات فاکتور
 * رسمی جمع‌شده زیر «اطلاعات تکمیلی».
 */

import { useState } from "react";
import AmountInput from "./AmountInput";
import { api, btn, ErrorText, Field, inputCls, Segmented, Sheet } from "./ui";
import { faNum } from "@/lib/accounting/money";

export interface PartyRecord {
  id: string;
  code: number;
  personType: "REAL" | "LEGAL";
  name: string;
  firstName: string | null;
  lastName: string | null;
  companyName: string | null;
  nationalId: string | null;
  economicCode: string | null;
  regNo: string | null;
  mobile: string | null;
  phone: string | null;
  postalCode: string | null;
  address: string | null;
  city: string | null;
  isCustomer: boolean;
  isSupplier: boolean;
  isEmployee: boolean;
  isMarketplace: boolean;
  creditLimit: string | null;
  note: string | null;
  isActive: boolean;
}

const ROLES = [
  { key: "isCustomer", label: "مشتری" },
  { key: "isSupplier", label: "تأمین‌کننده" },
  { key: "isEmployee", label: "کارمند" },
  { key: "isMarketplace", label: "بازارگاه" },
] as const;

type Form = Omit<PartyRecord, "id" | "code" | "creditLimit"> & { creditLimit: string };

function initial(p?: PartyRecord | null): Form {
  return {
    personType: p?.personType ?? "REAL",
    name: p?.name ?? "",
    firstName: p?.firstName ?? "",
    lastName: p?.lastName ?? "",
    companyName: p?.companyName ?? "",
    nationalId: p?.nationalId ?? "",
    economicCode: p?.economicCode ?? "",
    regNo: p?.regNo ?? "",
    mobile: p?.mobile ?? "",
    phone: p?.phone ?? "",
    postalCode: p?.postalCode ?? "",
    address: p?.address ?? "",
    city: p?.city ?? "",
    isCustomer: p?.isCustomer ?? true,
    isSupplier: p?.isSupplier ?? false,
    isEmployee: p?.isEmployee ?? false,
    isMarketplace: p?.isMarketplace ?? false,
    creditLimit: p?.creditLimit ?? "",
    note: p?.note ?? "",
    isActive: p?.isActive ?? true,
  };
}

export default function PartyForm({
  open,
  onClose,
  party,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  party?: PartyRecord | null;
  onSaved: (p: PartyRecord) => void;
}) {
  const [f, setF] = useState<Form>(() => initial(party));
  const [more, setMore] = useState(!!(party?.nationalId || party?.economicCode || party?.address));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((x) => ({ ...x, [k]: v }));

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const body = { ...f, name: f.personType === "REAL" ? null : f.companyName, creditLimit: f.creditLimit || null };
      const d = party
        ? await api<{ party: PartyRecord }>(`/api/admin/accounting/parties/${party.id}`, { method: "PATCH", json: body })
        : await api<{ party: PartyRecord }>("/api/admin/accounting/parties", { method: "POST", json: body });
      onSaved(d.party);
    } catch (e) {
      setError(e instanceof Error ? e.message : "ذخیره نشد");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={party ? `ویرایش ${party.name}` : "شخص تازه"}
      help="accountingParties"
      footer={
        <div className="flex gap-2">
          <button onClick={save} disabled={busy} className={`${btn.primary} flex-1`}>
            {busy ? "در حال ذخیره…" : "ذخیره"}
          </button>
          <button onClick={onClose} className={btn.soft}>
            انصراف
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        <Segmented
          value={f.personType}
          onChange={(v) => set("personType", v)}
          options={[
            { value: "REAL", label: "شخص حقیقی" },
            { value: "LEGAL", label: "شرکت / حقوقی" },
          ]}
        />
        {f.personType === "REAL" ? (
          <div className="grid grid-cols-2 gap-3">
            <Field label="نام">
              <input value={f.firstName ?? ""} onChange={(e) => set("firstName", e.target.value)} className={inputCls} autoFocus />
            </Field>
            <Field label="نام خانوادگی">
              <input value={f.lastName ?? ""} onChange={(e) => set("lastName", e.target.value)} className={inputCls} />
            </Field>
          </div>
        ) : (
          <Field label="نام شرکت یا فروشگاه">
            <input value={f.companyName ?? ""} onChange={(e) => set("companyName", e.target.value)} className={inputCls} autoFocus />
          </Field>
        )}
        <Field label="موبایل" hint="برای پیدا کردن سریع و جلوگیری از ثبت تکراری">
          <input value={f.mobile ?? ""} onChange={(e) => set("mobile", e.target.value)} className={inputCls} inputMode="tel" dir="ltr" placeholder="09…" />
        </Field>
        <div>
          <span className="block text-xs font-bold text-gray-600 dark:text-gray-300 mb-1.5">نقش</span>
          <div className="flex flex-wrap gap-2">
            {ROLES.map((r) => (
              <button
                key={r.key}
                type="button"
                onClick={() => set(r.key, !f[r.key])}
                className={`px-3 py-2 rounded-xl text-xs font-bold border transition ${
                  f[r.key] ? "bg-blue-600 border-blue-600 text-white" : "border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-300"
                }`}
              >
                {f[r.key] ? "✓ " : ""}
                {r.label}
              </button>
            ))}
          </div>
        </div>

        <button type="button" onClick={() => setMore(!more)} className="text-xs font-bold text-blue-600">
          {more ? "▾" : "◂"} اطلاعات تکمیلی (برای فاکتور رسمی)
        </button>
        {more && (
          <div className="space-y-3 rounded-2xl bg-gray-50 dark:bg-white/5 p-3">
            <div className="grid grid-cols-2 gap-3">
              <Field label={f.personType === "REAL" ? "کد ملی" : "شناسه‌ی ملی"}>
                <input value={f.nationalId ?? ""} onChange={(e) => set("nationalId", e.target.value)} className={inputCls} inputMode="numeric" dir="ltr" />
              </Field>
              <Field label="کد اقتصادی">
                <input value={f.economicCode ?? ""} onChange={(e) => set("economicCode", e.target.value)} className={inputCls} inputMode="numeric" dir="ltr" />
              </Field>
              {f.personType === "LEGAL" && (
                <Field label="شماره ثبت">
                  <input value={f.regNo ?? ""} onChange={(e) => set("regNo", e.target.value)} className={inputCls} inputMode="numeric" dir="ltr" />
                </Field>
              )}
              <Field label="تلفن ثابت">
                <input value={f.phone ?? ""} onChange={(e) => set("phone", e.target.value)} className={inputCls} inputMode="tel" dir="ltr" />
              </Field>
              <Field label="شهر">
                <input value={f.city ?? ""} onChange={(e) => set("city", e.target.value)} className={inputCls} />
              </Field>
              <Field label="کد پستی">
                <input value={f.postalCode ?? ""} onChange={(e) => set("postalCode", e.target.value)} className={inputCls} inputMode="numeric" dir="ltr" />
              </Field>
            </div>
            <Field label="آدرس">
              <textarea value={f.address ?? ""} onChange={(e) => set("address", e.target.value)} className={inputCls} rows={2} />
            </Field>
            <Field label="سقف اعتبار" hint="حداکثر بدهی مجاز این مشتری در خرید اعتباری — خالی یعنی بدون سقف">
              <AmountInput value={f.creditLimit} onChange={(v) => set("creditLimit", v)} />
            </Field>
          </div>
        )}
        <Field label="یادداشت">
          <textarea value={f.note ?? ""} onChange={(e) => set("note", e.target.value)} className={inputCls} rows={2} />
        </Field>
        {party && (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={!f.isActive} onChange={(e) => set("isActive", !e.target.checked)} />
            غیرفعال — در فهرست‌ها و انتخابگرها نیاید (کد {faNum(party.code)})
          </label>
        )}
        <ErrorText>{error}</ErrorText>
      </div>
    </Sheet>
  );
}
