"use client";

/**
 * اقساط سازمانی — اجزای مشترک رابط: فرم سازمان، پنجره‌ی قرارداد، رنگ و برچسب‌ها.
 * docs/plans/org-installments.md
 */

import { useEffect, useState } from "react";
import { Printer } from "lucide-react";
import { formatJalali } from "@/lib/club/jalali";
import { faNum, formatAmount, parseAmountInput } from "@/lib/accounting/money";
import { api, Badge, btn, ErrorText, Field, inputCls, Sheet } from "../ui";

export const B = (v: string | bigint | number | null | undefined) => {
  try {
    return BigInt(v ?? 0);
  } catch {
    return 0n;
  }
};
export const pct = (bp: number) => `${faNum(bp / 100)}٪`;
export const COLORS = ["#2563eb", "#059669", "#d97706", "#dc2626", "#7c3aed", "#0891b2", "#db2777", "#4b5563"];
export const orgColor = (c: string | null | undefined) => c || "#4f46e5";
/** «1405-09» ← «آذر ۱۴۰۵» */
const MONTHS = ["فروردین", "اردیبهشت", "خرداد", "تیر", "مرداد", "شهریور", "مهر", "آبان", "آذر", "دی", "بهمن", "اسفند"];
export const periodFa = (p: string) => {
  const [y, m] = p.split("-").map(Number);
  return `${MONTHS[m - 1] ?? ""} ${faNum(y)}`;
};

export interface Org {
  id: string;
  name: string;
  partyId: string;
  months: number;
  commissionBp: number;
  capPerCustomer: string | null;
  capTotal: string | null;
  minPurchase: string | null;
  firstDueMonths: number;
  dueDay: number;
  roundTo: number;
  requireRef: boolean;
  contractNo: string | null;
  contactName: string | null;
  contactPhone: string | null;
  note: string | null;
  color: string | null;
  isActive: boolean;
}

export function Progress({ value, total, color }: { value: bigint; total: bigint; color?: string }) {
  const p = total > 0n ? Number((value * 1000n) / total) / 10 : 0;
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-white/10">
      <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(100, p)}%`, background: color ?? "#10b981" }} />
    </div>
  );
}

export function Terms({ o }: { o: Pick<Org, "months" | "commissionBp" | "capPerCustomer" | "dueDay" | "firstDueMonths"> }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      <Badge tone="blue">{faNum(o.months)} قسط ماهانه</Badge>
      {o.commissionBp > 0 && <Badge tone="amber">پورسانت {pct(o.commissionBp)}</Badge>}
      {o.capPerCustomer && <Badge>سقف هر نفر {formatAmount(B(o.capPerCustomer))}</Badge>}
      <Badge>
        سررسید {faNum(o.dueDay)} هر ماه{o.firstDueMonths !== 1 ? ` · قسط اول ${faNum(o.firstDueMonths)} ماه بعد` : ""}
      </Badge>
    </div>
  );
}

// ── فرم سازمان ───────────────────────────────────────────────────────────

export function OrgForm({ org, onClose, onSaved }: { org: Org | null; onClose: () => void; onSaved: (id: string) => void }) {
  const [f, setF] = useState({
    name: org?.name ?? "",
    months: String(org?.months ?? 6),
    commissionPct: String((org?.commissionBp ?? 0) / 100),
    capPerCustomer: org?.capPerCustomer ?? "",
    capTotal: org?.capTotal ?? "",
    minPurchase: org?.minPurchase ?? "",
    firstDueMonths: String(org?.firstDueMonths ?? 1),
    dueDay: String(org?.dueDay ?? 25),
    roundTo: String(org?.roundTo ?? 1000),
    requireRef: org?.requireRef ?? true,
    contractNo: org?.contractNo ?? "",
    contactName: org?.contactName ?? "",
    contactPhone: org?.contactPhone ?? "",
    note: org?.note ?? "",
    color: org?.color ?? COLORS[0],
    isActive: org?.isActive ?? true,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((x) => ({ ...x, [k]: e.target.value }));
  const money = (k: "capPerCustomer" | "capTotal" | "minPurchase") => (e: { target: { value: string } }) => setF((x) => ({ ...x, [k]: parseAmountInput(e.target.value) }));
  // نمونه‌ی محاسبه برای ۱۰ میلیون
  const sample = 10_000_000n;
  const bp = BigInt(Math.round((Number(f.commissionPct.replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))) || 0) * 100));
  const net = sample - (sample * bp) / 10_000n;
  const months = BigInt(Math.max(1, Number(f.months) || 1));

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ org: { id: string } }>(org ? `/api/admin/accounting/installment-orgs/${org.id}` : "/api/admin/accounting/installment-orgs", {
        method: org ? "PATCH" : "POST",
        json: f,
      });
      onSaved(r.org.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "ذخیره نشد");
      setBusy(false);
    }
  }

  return (
    <Sheet
      open
      onClose={onClose}
      title={org ? `شرایط ${org.name}` : "سازمان تازه"}
      help="accountingOrgInstallments"
      footer={
        <button onClick={save} disabled={busy} className={`${btn.primary} w-full`}>
          {busy ? "…" : "ذخیره"}
        </button>
      }
    >
      <div className="space-y-3">
        <Field label="نام سازمان یا شرکت">
          <input value={f.name} onChange={set("name")} className={inputCls} placeholder="مثلاً آموزش و پرورش ساری" autoFocus={!org} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="تعداد قسط (ماه)">
            <input value={f.months} onChange={set("months")} inputMode="numeric" className={inputCls} />
          </Field>
          <Field label="پورسانت سازمان (٪)" hint="از مبلغ خرید کم و بقیه قسط می‌شود">
            <input value={f.commissionPct} onChange={set("commissionPct")} inputMode="decimal" className={inputCls} />
          </Field>
        </div>
        <div className="rounded-xl bg-blue-50 px-3 py-2 text-xs font-bold leading-6 text-blue-800 dark:bg-blue-500/10 dark:text-blue-200">
          نمونه: خرید {formatAmount(sample)} تومان ← {bp > 0n ? `پورسانت ${formatAmount(sample - net)} ← ` : ""}
          {faNum(Number(months))} قسط حدود {formatAmount(net / months)} تومان که سازمان هر ماه می‌پردازد.
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="سقف خرید هر نفر (تومان)" hint="جمع خریدهای اقساطی باز هر کارمند؛ خالی = بی‌سقف">
            <input value={f.capPerCustomer ? formatAmount(B(f.capPerCustomer)) : ""} onChange={money("capPerCustomer")} inputMode="numeric" className={inputCls} placeholder="مثلاً ۲۰٬۰۰۰٬۰۰۰" />
          </Field>
          <Field label="سقف کل اعتبار سازمان" hint="مانده‌ی اقساط همه؛ خالی = بی‌سقف">
            <input value={f.capTotal ? formatAmount(B(f.capTotal)) : ""} onChange={money("capTotal")} inputMode="numeric" className={inputCls} />
          </Field>
          <Field label="حداقل خرید اقساطی">
            <input value={f.minPurchase ? formatAmount(B(f.minPurchase)) : ""} onChange={money("minPurchase")} inputMode="numeric" className={inputCls} />
          </Field>
          <Field label="گرد کردن قسط (تومان)" hint="اختلاف در قسط آخر">
            <select value={f.roundTo} onChange={set("roundTo")} className={inputCls}>
              {[0, 100, 1000, 10000].map((r) => (
                <option key={r} value={r}>
                  {r ? formatAmount(r) : "گرد نشود"}
                </option>
              ))}
            </select>
          </Field>
          <Field label="روز سررسید هر ماه">
            <input value={f.dueDay} onChange={set("dueDay")} inputMode="numeric" className={inputCls} />
          </Field>
          <Field label="قسط اول چند ماه بعد؟">
            <select value={f.firstDueMonths} onChange={set("firstDueMonths")} className={inputCls}>
              {[0, 1, 2, 3].map((m) => (
                <option key={m} value={m}>
                  {m === 0 ? "همان ماه خرید" : m === 1 ? "ماه بعد" : `${faNum(m)} ماه بعد`}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <label className="flex items-center gap-2 text-sm font-bold">
          <input type="checkbox" checked={f.requireRef} onChange={(e) => setF((x) => ({ ...x, requireRef: e.target.checked }))} className="h-4 w-4" />
          کد پرسنلی یا شماره‌ی معرفی‌نامه هنگام فروش لازم است
        </label>
        <p className="pt-2 text-xs font-black text-gray-500">قرارداد و تماس</p>
        <div className="grid grid-cols-2 gap-3">
          <Field label="شماره‌ی قرارداد">
            <input value={f.contractNo} onChange={set("contractNo")} className={inputCls} />
          </Field>
          <Field label="مسئول طرف سازمان">
            <input value={f.contactName} onChange={set("contactName")} className={inputCls} />
          </Field>
          <Field label="تلفن">
            <input value={f.contactPhone} onChange={set("contactPhone")} inputMode="tel" dir="ltr" className={inputCls} />
          </Field>
          <Field label="رنگ">
            <div className="flex gap-1.5 pt-1.5">
              {COLORS.map((c) => (
                <button key={c} type="button" onClick={() => setF((x) => ({ ...x, color: c }))} className={`h-7 w-7 rounded-full ring-offset-2 dark:ring-offset-gray-900 ${f.color === c ? "ring-2 ring-gray-900 dark:ring-white" : ""}`} style={{ background: c }} aria-label={c} />
              ))}
            </div>
          </Field>
        </div>
        <Field label="یادداشت">
          <textarea value={f.note} onChange={set("note")} rows={2} className={inputCls} placeholder="مثلاً فهرست هر ماه تا ۲۰ام ایمیل می‌شود" />
        </Field>
        {org && (
          <label className="flex items-center gap-2 text-sm font-bold">
            <input type="checkbox" checked={f.isActive} onChange={(e) => setF((x) => ({ ...x, isActive: e.target.checked }))} className="h-4 w-4" /> فعال (در صندوق دیده می‌شود)
          </label>
        )}
        {org && <p className="text-[11px] text-gray-400">تغییر شرایط فقط روی خریدهای بعدی اثر دارد.</p>}
        <ErrorText>{error}</ErrorText>
      </div>
    </Sheet>
  );
}

// ── پنجره‌ی قرارداد ───────────────────────────────────────────────────────

interface ContractD {
  id: string;
  number: number;
  customerName: string;
  mobile: string | null;
  nationalId: string | null;
  employeeCode: string | null;
  letterNo: string | null;
  total: string;
  commission: string;
  commissionBp: number;
  net: string;
  months: number;
  status: "ACTIVE" | "DONE" | "VOID";
  voidReason: string | null;
  createdAt: string;
  createdByName: string;
  org: { id: string; name: string; color: string | null };
  invoice: { id: string; number: number | null } | null;
  ticket: { id: string; number: number } | null;
  items: { id: string; seq: number; dueDate: string; amount: string; paid: string; lines: { amount: string; settlement: { number: number; period: string; createdAt: string; voidedAt: string | null } }[] }[];
}

export const STATUS_LABEL = { ACTIVE: "در جریان", DONE: "تسویه", VOID: "باطل" } as const;

export function ContractSheet({ id, onClose, onChanged }: { id: string; onClose: () => void; onChanged?: () => void }) {
  const [d, setD] = useState<ContractD | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    api<{ contract: ContractD }>(`/api/admin/accounting/installment-orgs/contracts/${id}`)
      .then((r) => setD(r.contract))
      .catch((e) => setError(e.message));
  }, [id]);
  async function voidIt() {
    const reason = window.prompt("ابطال قرارداد: دریافت اقساطی باطل و فاکتور مشتری دوباره باز (بدهکار) می‌شود. دلیل؟");
    if (!reason) return;
    setBusy(true);
    try {
      await api(`/api/admin/accounting/installment-orgs/contracts/${id}`, { method: "POST", json: { reason } });
      onChanged?.();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "انجام نشد");
      setBusy(false);
    }
  }
  const paid = d ? d.items.reduce((s, i) => s + B(i.paid), 0n) : 0n;
  return (
    <Sheet open onClose={onClose} title={d ? `قرارداد اقساط ${faNum(d.number)} — ${d.customerName}` : "قرارداد"} wide>
      {!d ? (
        error ? <ErrorText>{error}</ErrorText> : <p className="text-xs text-gray-400">…</p>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={d.status === "DONE" ? "green" : d.status === "VOID" ? "red" : "blue"}>{STATUS_LABEL[d.status]}</Badge>
            <span className="text-xs font-bold" style={{ color: orgColor(d.org.color) }}>
              {d.org.name}
            </span>
            <span className="text-xs text-gray-400">
              {formatJalali(new Date(d.createdAt))} · {d.createdByName}
            </span>
            {d.ticket && (
              <a href={`/admin/accounting/pos/tickets/${d.ticket.id}/print`} target="_blank" rel="noreferrer" className="text-xs font-bold text-blue-600">
                رسید صندوق {faNum(d.ticket.number)}
              </a>
            )}
            {d.invoice && (
              <a href={`/admin/accounting/invoices/${d.invoice.id}`} className="text-xs font-bold text-blue-600">
                فاکتور فروش {faNum(d.invoice.number ?? 0)}
              </a>
            )}
          </div>
          {d.voidReason && <p className="text-xs text-red-600">دلیل ابطال: {d.voidReason}</p>}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Mini label="مبلغ خرید" value={formatAmount(B(d.total))} />
            <Mini label={`پورسانت ${pct(d.commissionBp)}`} value={formatAmount(B(d.commission))} />
            <Mini label="مبلغ قسطی" value={formatAmount(B(d.net))} />
            <Mini label="دریافت‌شده" value={formatAmount(paid)} tone="green" />
          </div>
          <div className="grid grid-cols-2 gap-x-6 gap-y-1 rounded-xl bg-gray-50 p-3 text-xs dark:bg-white/[0.03] sm:grid-cols-4">
            <span>موبایل: <b dir="ltr">{d.mobile ? faNum(d.mobile) : "—"}</b></span>
            <span>کد ملی: <b>{d.nationalId ? faNum(d.nationalId) : "—"}</b></span>
            <span>کد پرسنلی: <b>{d.employeeCode ? faNum(d.employeeCode) : "—"}</b></span>
            <span>معرفی‌نامه: <b>{d.letterNo ?? "—"}</b></span>
          </div>
          <div className="overflow-hidden rounded-xl border border-gray-100 dark:border-white/5">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-[11px] text-gray-500 dark:bg-white/5">
                <tr>
                  <th className="px-3 py-2 text-right">قسط</th>
                  <th className="px-3 py-2 text-right">سررسید</th>
                  <th className="px-3 py-2 text-left">مبلغ</th>
                  <th className="px-3 py-2 text-left">دریافت</th>
                  <th className="px-3 py-2 text-right">از</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                {d.items.map((i) => {
                  const done = B(i.paid) >= B(i.amount);
                  const late = !done && new Date(i.dueDate) < new Date();
                  return (
                    <tr key={i.id} className={done ? "text-gray-400" : ""}>
                      <td className="px-3 py-2 font-bold">{faNum(i.seq)}</td>
                      <td className={`px-3 py-2 ${late ? "font-bold text-red-600" : ""}`}>{formatJalali(new Date(i.dueDate))}</td>
                      <td className="px-3 py-2 text-left tabular-nums">{formatAmount(B(i.amount))}</td>
                      <td className={`px-3 py-2 text-left tabular-nums ${done ? "text-emerald-600" : ""}`}>{B(i.paid) > 0n ? formatAmount(B(i.paid)) : "—"}</td>
                      <td className="px-3 py-2 text-[11px] text-gray-500">
                        {i.lines
                          .filter((l) => !l.settlement.voidedAt)
                          .map((l) => `دریافت ${faNum(l.settlement.number)} (${periodFa(l.settlement.period)})`)
                          .join("، ") || "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap gap-2">
            <a href={`/admin/accounting/installment-orgs/contracts/${d.id}/print?auto=1`} target="_blank" rel="noreferrer" className={btn.soft}>
              <Printer className="h-4 w-4" aria-hidden /> چاپ قرارداد برای امضا
            </a>
            {d.status === "ACTIVE" && !d.ticket && paid === 0n && (
              <button onClick={voidIt} disabled={busy} className={`${btn.danger} mr-auto`}>
                ابطال قرارداد
              </button>
            )}
            {d.status === "ACTIVE" && d.ticket && paid === 0n && <p className="mr-auto self-center text-[11px] text-gray-400">برای ابطال، رسید صندوقش را باطل کنید.</p>}
          </div>
          <ErrorText>{error}</ErrorText>
        </div>
      )}
    </Sheet>
  );
}

export function Mini({ label, value, tone }: { label: string; value: string; tone?: "green" | "red" | "amber" }) {
  const c = tone === "green" ? "text-emerald-600" : tone === "red" ? "text-rose-600" : tone === "amber" ? "text-amber-600" : "text-gray-900 dark:text-white";
  return (
    <div className="rounded-xl border border-gray-100 p-2.5 dark:border-white/5">
      <p className="text-[11px] font-bold text-gray-500">{label}</p>
      <p className={`text-base font-black tabular-nums ${c}`}>{value}</p>
    </div>
  );
}
