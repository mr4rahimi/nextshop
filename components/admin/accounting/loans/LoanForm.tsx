"use client";

/**
 * ثبت وام: مشخصات ← جدول اقساط پیشنهادی ← اصلاح دستی ردیف‌ها طبق برگه‌ی بانک.
 * تغییر ورودی‌های بالا جدول را از نو می‌سازد.
 */

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { dayValue, parseDay, todayKey } from "@/lib/accounting/dates";
import { faNum, formatAmount } from "@/lib/accounting/money";
import { addJalaliMonths } from "@/lib/accounting/installments-calc";
import { buildLoanSchedule } from "@/lib/accounting/loans-calc";
import { parsePercent } from "@/lib/accounting/ledger/template-calc";
import JalaliDatePicker from "@/components/admin/JalaliDatePicker";
import AmountInput from "../AmountInput";
import type { TreasuryRecord } from "../TreasuryForm";
import { api, btn, Card, Chips, ErrorText, Field, inputCls, PageHeader } from "../ui";

interface Row {
  dueDate: string;
  principal: string;
  interest: string;
}
type Mode = "rate" | "installment";

export default function LoanForm() {
  const router = useRouter();
  const today = dayValue(todayKey());
  const [title, setTitle] = useState("");
  const [lender, setLender] = useState("");
  const [date, setDate] = useState(today);
  const [treasuryId, setTreasuryId] = useState("");
  const [existing, setExisting] = useState(false);
  const [principal, setPrincipal] = useState("");
  const [fee, setFee] = useState("");
  const [mode, setMode] = useState<Mode>("rate");
  const [rate, setRate] = useState("");
  const [installment, setInstallment] = useState("");
  const [count, setCount] = useState("12");
  const [interval, setIntervalMonths] = useState("1");
  const [firstDue, setFirstDue] = useState(() => dayValue(addJalaliMonths(todayKey(), 1)));
  const [note, setNote] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [treasuries, setTreasuries] = useState<TreasuryRecord[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<{ items: TreasuryRecord[] }>("/api/admin/accounting/treasury").then((d) => setTreasuries(d.items.filter((t) => t.isActive))).catch(() => {});
  }, []);

  const rateBp = mode === "rate" ? (parsePercent(rate || "0") ?? -1) : 0;
  const n = Number(count) || 0;
  const every = Number(interval) || 1;

  useEffect(() => {
    const first = parseDay(firstDue);
    if (!first || rateBp < 0 || n > 240) return setRows([]);
    setRows(
      buildLoanSchedule({ principal: BigInt(principal || "0"), count: n, firstDue: first, intervalMonths: every, rateBp, installment: mode === "installment" ? BigInt(installment || "0") : undefined }).map((r) => ({
        dueDate: dayValue(r.dueDate),
        principal: r.principal.toString(),
        interest: r.interest.toString(),
      })),
    );
  }, [principal, n, firstDue, every, rateBp, installment, mode]);

  const patch = (i: number, p: Partial<Row>) => setRows((x) => x.map((r, j) => (j === i ? { ...r, ...p } : r)));
  const totals = useMemo(() => rows.reduce((s, r) => ({ p: s.p + BigInt(r.principal || "0"), i: s.i + BigInt(r.interest || "0") }), { p: 0n, i: 0n }), [rows]);
  const loanAmount = BigInt(principal || "0");
  const gap = loanAmount - totals.p;

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const d = await api<{ loan: { id: string } }>("/api/admin/accounting/loans", {
        method: "POST",
        json: { title, lender, date, treasuryId: existing ? null : treasuryId, existing, principal: principal || "0", upfrontFee: existing ? "0" : fee || "0", rateBp: Math.max(rateBp, 0), intervalMonths: every, note, items: rows },
      });
      router.push(`/admin/accounting/loans/${d.loan.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "ثبت نشد");
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader title="وام تازه" help="accountingLoans" back={{ href: "/admin/accounting/loans", label: "وام و تسهیلات" }} />

      <Card className="p-4 grid gap-3 sm:grid-cols-2">
        <Field label="عنوان وام">
          <input value={title} onChange={(e) => setTitle(e.target.value)} className={inputCls} placeholder="مثلاً: تسهیلات سرمایه در گردش" />
        </Field>
        <Field label="وام‌دهنده">
          <input value={lender} onChange={(e) => setLender(e.target.value)} className={inputCls} placeholder="مثلاً: بانک ملت شعبه‌ی مرکزی" />
        </Field>
        <Field label="تاریخ وام">
          <JalaliDatePicker value={date} onChange={setDate} />
        </Field>
        <Field label={existing ? "مانده‌ی اصل وام (تومان)" : "مبلغ وام (تومان)"}>
          <AmountInput value={principal} onChange={setPrincipal} />
        </Field>
        <label className="flex items-center gap-2 text-xs sm:col-span-2">
          <input type="checkbox" checked={existing} onChange={(e) => setExisting(e.target.checked)} />
          وام قدیمی است و پولش قبلاً گرفته شده (سند دریافت نمی‌خورد؛ مانده را در «مانده‌های اول دوره» روی «تسهیلات دریافتی» بگذارید)
        </label>
        {!existing && (
          <>
            <Field label="واریز به">
              <select value={treasuryId} onChange={(e) => setTreasuryId(e.target.value)} className={inputCls}>
                <option value="">— انتخاب حساب —</option>
                {treasuries.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="کارمزد اول کار (اختیاری)" hint="از مبلغ واریزی کم می‌شود">
              <AmountInput value={fee} onChange={setFee} />
            </Field>
          </>
        )}
      </Card>

      <Card className="p-4 space-y-3">
        <Chips<Mode>
          value={mode}
          onChange={setMode}
          options={[
            { value: "rate", label: "با نرخ سود" },
            { value: "installment", label: "با مبلغ قسط بانک" },
          ]}
        />
        <div className="grid gap-3 sm:grid-cols-4">
          {mode === "rate" ? (
            <Field label="نرخ سود سالانه ٪">
              <input value={rate} onChange={(e) => setRate(e.target.value)} inputMode="decimal" className={inputCls} placeholder="مثلاً ۲۳" />
            </Field>
          ) : (
            <Field label="مبلغ هر قسط">
              <AmountInput value={installment} onChange={setInstallment} />
            </Field>
          )}
          <Field label="تعداد اقساط">
            <input value={count} onChange={(e) => setCount(e.target.value.replace(/\D/g, ""))} inputMode="numeric" className={inputCls} />
          </Field>
          <Field label="فاصله (ماه)">
            <input value={interval} onChange={(e) => setIntervalMonths(e.target.value.replace(/\D/g, ""))} inputMode="numeric" className={inputCls} />
          </Field>
          <Field label="سررسید اولین قسط" hint="مهلت تنفس را با همین تاریخ بدهید">
            <JalaliDatePicker value={firstDue} onChange={setFirstDue} />
          </Field>
        </div>
      </Card>

      {rows.length > 0 && (
        <Card className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-gray-500 border-b border-gray-100 dark:border-white/5">
                <th className="px-3 py-2 text-right">#</th>
                <th className="px-2 py-2 text-right">سررسید</th>
                <th className="px-2 py-2 text-right">اصل</th>
                <th className="px-2 py-2 text-right">سود</th>
                <th className="px-3 py-2 text-left">قسط</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className="border-b border-gray-50 dark:border-white/5">
                  <td className="px-3 py-1.5 tabular-nums">{faNum(i + 1)}</td>
                  <td className="px-2 py-1.5 min-w-[140px]">
                    <JalaliDatePicker value={r.dueDate} onChange={(v) => patch(i, { dueDate: v })} />
                  </td>
                  <td className="px-2 py-1.5 min-w-[120px]">
                    <AmountInput compact value={r.principal} onChange={(v) => patch(i, { principal: v })} />
                  </td>
                  <td className="px-2 py-1.5 min-w-[120px]">
                    <AmountInput compact value={r.interest} onChange={(v) => patch(i, { interest: v })} />
                  </td>
                  <td className="px-3 py-1.5 text-left font-bold tabular-nums">{formatAmount(BigInt(r.principal || "0") + BigInt(r.interest || "0"))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <Field label="یادداشت (اختیاری)">
        <input value={note} onChange={(e) => setNote(e.target.value)} className={inputCls} />
      </Field>

      <div className="sticky bottom-20 md:bottom-4 z-30 rounded-2xl shadow-lg bg-white/95 dark:bg-gray-900/95 backdrop-blur border border-gray-200 dark:border-white/10 px-4 py-3">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs">
          <span>
            <span className="text-gray-500">جمع اصل </span>
            <b className="tabular-nums">{formatAmount(totals.p)}</b>
          </span>
          <span>
            <span className="text-gray-500">جمع سود </span>
            <b className="tabular-nums">{formatAmount(totals.i)}</b>
          </span>
          {rows.length > 0 && gap !== 0n && <span className="font-bold text-red-600">اختلاف با مبلغ وام {formatAmount(gap < 0n ? -gap : gap)}</span>}
          {mode === "installment" && loanAmount > 0n && rows.length === 0 && n > 0 && <span className="font-bold text-red-600">جمع اقساط از مبلغ وام کمتر است</span>}
          <button onClick={save} disabled={busy || !rows.length || gap !== 0n} className={`${btn.primary} mr-auto`}>
            {busy ? "در حال ثبت…" : "ثبت وام"}
          </button>
        </div>
        {error && (
          <div className="mt-2">
            <ErrorText>{error}</ErrorText>
          </div>
        )}
      </div>
    </div>
  );
}
