"use client";

import { useState } from "react";
import { api, btn, ErrorText, Field, inputCls, Sheet } from "./ui";

export type TreasuryKind = "CASH" | "BANK" | "POS" | "GATEWAY";

export interface TreasuryRecord {
  id: string;
  code: number;
  kind: TreasuryKind;
  name: string;
  bankName: string | null;
  accountNo: string | null;
  sheba: string | null;
  cardNo: string | null;
  settleToId: string | null;
  providers: string[];
  isActive: boolean;
}

export const KIND_META: Record<TreasuryKind, { label: string; icon: string; hint: string }> = {
  CASH: { label: "صندوق", icon: "💵", hint: "پول نقد داخل مغازه یا دفتر" },
  BANK: { label: "حساب بانکی", icon: "🏦", hint: "حساب جاری یا پس‌انداز" },
  POS: { label: "کارتخوان", icon: "💳", hint: "پولش بعداً به یک بانک واریز می‌شود" },
  GATEWAY: { label: "درگاه اینترنتی", icon: "🌐", hint: "پرداخت‌های آنلاین سایت" },
};

export default function TreasuryForm({
  open,
  onClose,
  item,
  banks,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  item?: TreasuryRecord | null;
  banks: TreasuryRecord[];
  onSaved: () => void;
}) {
  const [kind, setKind] = useState<TreasuryKind>(item?.kind ?? "BANK");
  const [f, setF] = useState({
    name: item?.name ?? "",
    bankName: item?.bankName ?? "",
    accountNo: item?.accountNo ?? "",
    cardNo: item?.cardNo ?? "",
    sheba: item?.sheba ?? "",
    settleToId: item?.settleToId ?? "",
    providers: (item?.providers ?? []).join("، "),
    isActive: item?.isActive ?? true,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof typeof f, v: string | boolean) => setF((x) => ({ ...x, [k]: v }));

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const body = {
        kind,
        ...f,
        settleToId: f.settleToId || null,
        providers: f.providers.split(/[،,]/).map((s) => s.trim()).filter(Boolean),
      };
      if (item) await api(`/api/admin/accounting/treasury/${item.id}`, { method: "PATCH", json: body });
      else await api("/api/admin/accounting/treasury", { method: "POST", json: body });
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "ذخیره نشد");
    } finally {
      setBusy(false);
    }
  }

  const isBankish = kind === "BANK";
  const settles = kind === "POS" || kind === "GATEWAY";

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={item ? `ویرایش ${item.name}` : "صندوق یا بانک تازه"}
      help="accountingTreasury"
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
        <div className="grid grid-cols-2 gap-2">
          {(Object.keys(KIND_META) as TreasuryKind[]).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setKind(k)}
              className={`rounded-2xl border p-3 text-right transition ${
                kind === k ? "border-blue-500 ring-1 ring-blue-500 bg-blue-500/5" : "border-gray-200 dark:border-white/10"
              }`}
            >
              <span className="text-xl">{KIND_META[k].icon}</span>
              <p className="text-sm font-bold mt-1">{KIND_META[k].label}</p>
              <p className="text-[10px] text-gray-400 leading-4">{KIND_META[k].hint}</p>
            </button>
          ))}
        </div>
        <Field label="نام" hint={isBankish ? "طوری که در یک نگاه بشناسید؛ مثلاً «ملت جاری ۱۲۳۴»" : undefined}>
          <input value={f.name} onChange={(e) => set("name", e.target.value)} className={inputCls} autoFocus />
        </Field>
        {(isBankish || kind === "POS") && (
          <Field label="نام بانک">
            <input value={f.bankName} onChange={(e) => set("bankName", e.target.value)} className={inputCls} placeholder="ملت، ملی، سامان…" />
          </Field>
        )}
        {isBankish && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="شماره حساب">
              <input value={f.accountNo} onChange={(e) => set("accountNo", e.target.value)} className={inputCls} inputMode="numeric" dir="ltr" />
            </Field>
            <Field label="شماره کارت">
              <input value={f.cardNo} onChange={(e) => set("cardNo", e.target.value)} className={inputCls} inputMode="numeric" dir="ltr" />
            </Field>
            <Field label="شبا" className="sm:col-span-2">
              <input value={f.sheba} onChange={(e) => set("sheba", e.target.value)} className={inputCls} dir="ltr" placeholder="IR…" />
            </Field>
          </div>
        )}
        {settles && (
          <Field label="تسویه به حساب بانکی" hint="پولی که اینجا می‌نشیند، بعداً به این حساب واریز می‌شود">
            <select value={f.settleToId} onChange={(e) => set("settleToId", e.target.value)} className={inputCls}>
              <option value="">— انتخاب کنید —</option>
              {banks.filter((b) => b.kind === "BANK" && b.id !== item?.id).map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </Field>
        )}
        {kind === "GATEWAY" && (
          <Field label="نام درگاه در سایت" hint="پرداخت‌های آنلاینِ این درگاه‌ها خودکار به اینجا می‌آیند (از نسخه‌ی دریافت و پرداخت). با ویرگول جدا کنید.">
            <input value={f.providers} onChange={(e) => set("providers", e.target.value)} className={inputCls} dir="ltr" placeholder="zarinpal, aqayepardakht" />
          </Field>
        )}
        {item && (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={!f.isActive} onChange={(e) => set("isActive", !e.target.checked)} />
            غیرفعال — در فرم‌ها نیاید
          </label>
        )}
        <ErrorText>{error}</ErrorText>
      </div>
    </Sheet>
  );
}
