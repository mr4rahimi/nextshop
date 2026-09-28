"use client";

/**
 * ساخت برنامه‌ی اقساط روی فاکتور فروش یا خرید — docs/plans/accounting.md بخش ۹.۳.
 *
 * بالا تنظیمات (پیش‌پرداخت، تعداد، فاصله، اولین سررسید، کارمزد، گرد کردن)، پایین
 * جدول قسط‌ها که با هر تغییر تنظیمات دوباره ساخته می‌شود و بعد هر ردیفش قابل
 * ویرایش است. «چک اقساط» برای هر قسط یک ردیف مشخصات چک باز می‌کند.
 * جمع قسط‌ها همیشه باید = مبلغ قسطی + کارمزد؛ اختلاف زیر جدول قرمز نشان داده می‌شود.
 */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { CalendarClock, Receipt, Wand2 } from "lucide-react";
import { faNum, formatAmount } from "@/lib/accounting/money";
import { dayValue } from "@/lib/accounting/dates";
import { addJalaliMonths, buildSchedule, calcFee, FEE_MODE_LABELS, type FeeMode } from "@/lib/accounting/installments-calc";
import JalaliDatePicker from "@/components/admin/JalaliDatePicker";
import AmountInput from "../AmountInput";
import { api, btn, Card, ErrorText, Field, inputCls, Money, PageHeader, Segmented, SectionTitle } from "../ui";

interface Data {
  invoice: { id: string; type: "SALES" | "PURCHASE"; number: number | null; date: string; status: string; total: string; partyName: string };
  settlement: { open: string; paid: string; total: string; returned: string } | undefined;
  plan: unknown;
  banks: { id: string; name: string; bankName: string | null; nextSerial: { serial: string; bookId: string } | null }[];
  today: string;
  can: { write: boolean; pay: boolean };
}
interface Row {
  dueDate: string;
  amount: string;
  serialNo: string;
  bankName: string;
  sayadId: string;
}

const ROUND = [
  { value: "1", label: "بی‌گرد" },
  { value: "1000", label: "هزار" },
  { value: "10000", label: "ده هزار" },
  { value: "100000", label: "صد هزار" },
];

const toDate = (v: string) => new Date(`${v}T00:00:00.000Z`);

export default function PlanEditor({ invoiceId }: { invoiceId: string }) {
  const router = useRouter();
  const [d, setD] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [down, setDown] = useState("");
  const [count, setCount] = useState("6");
  const [interval, setIntervalM] = useState("1");
  const [first, setFirst] = useState("");
  const [feeMode, setFeeMode] = useState<FeeMode>("NONE");
  const [rate, setRate] = useState("");
  const [fixedFee, setFixedFee] = useState("");
  const [round, setRound] = useState("10000");
  const [rows, setRows] = useState<Row[]>([]);
  const [touched, setTouched] = useState(false);
  const [withCheques, setWithCheques] = useState(false);
  const [bankId, setBankId] = useState("");
  const [note, setNote] = useState("");

  useEffect(() => {
    api<Data>(`/api/admin/accounting/invoices/${invoiceId}/installments`)
      .then((x) => {
        setD(x);
        // اولین سررسید پیش‌فرض: یک ماه بعد از امروز
        setFirst(dayValue(addJalaliMonths(toDate(x.today), 1)));
        setBankId(x.banks[0]?.id ?? "");
      })
      .catch((e) => setError(e.message));
  }, [invoiceId]);

  const sales = d?.invoice.type === "SALES";
  const open = BigInt(d?.settlement?.open ?? "0");
  const principal = open - BigInt(down || "0");
  const n = Math.max(0, Math.min(120, Number(count) || 0));
  const iv = Math.max(1, Math.min(12, Number(interval) || 1));
  const rateBp = Math.round((Number(rate.replace(/[٫,]/g, ".")) || 0) * 100);
  const fee = feeMode === "FIXED" ? BigInt(fixedFee || "0") : calcFee(principal > 0n ? principal : 0n, feeMode, rateBp, n, iv);
  const total = principal + fee;

  // جدول از روی تنظیمات — تا وقتی کاربر خود ردیف‌ها را دست نزده
  const auto = useMemo(() => (first && n > 0 && total > 0n ? buildSchedule({ total, count: n, firstDue: toDate(first), intervalMonths: iv, roundTo: BigInt(round) }) : []), [first, n, total, iv, round]);
  useEffect(() => {
    if (touched) return;
    setRows((prev) =>
      auto.map((r, i) => ({ dueDate: dayValue(r.dueDate), amount: r.amount.toString(), serialNo: prev[i]?.serialNo ?? "", bankName: prev[i]?.bankName ?? "", sayadId: prev[i]?.sayadId ?? "" })),
    );
  }, [auto, touched]);

  // خرید با چک: شماره‌های پشت‌سرهم از دسته‌چک
  useEffect(() => {
    if (!withCheques || sales) return;
    const next = d?.banks.find((b) => b.id === bankId)?.nextSerial;
    if (!next) return;
    setRows((x) => x.map((r, i) => ({ ...r, serialNo: r.serialNo || (BigInt(next.serial) + BigInt(i)).toString() })));
  }, [withCheques, bankId, sales, d, rows.length]);

  const sum = rows.reduce((s, r) => s + BigInt(r.amount || "0"), 0n);
  const diff = total - sum;
  const patch = (i: number, p: Partial<Row>) => {
    setTouched(true);
    setRows((x) => x.map((r, k) => (k === i ? { ...r, ...p } : r)));
  };
  const regenerate = () => {
    setTouched(false);
    setRows(auto.map((r) => ({ dueDate: dayValue(r.dueDate), amount: r.amount.toString(), serialNo: "", bankName: "", sayadId: "" })));
  };

  async function save() {
    if (!d) return;
    setBusy(true);
    setError(null);
    try {
      const bank = d.banks.find((b) => b.id === bankId);
      await api(`/api/admin/accounting/invoices/${invoiceId}/installments`, {
        method: "POST",
        json: {
          action: "create",
          downPayment: down || "0",
          feeMode,
          feeRatePercent: rate || "0",
          feeAmount: fixedFee || "0",
          intervalMonths: iv,
          note,
          items: rows.map((r) => ({ dueDate: r.dueDate, amount: r.amount || "0" })),
          cheques: withCheques
            ? rows.map((r) =>
                r.serialNo.trim()
                  ? sales
                    ? { serialNo: r.serialNo, bankName: r.bankName, sayadId: r.sayadId || null }
                    : { serialNo: r.serialNo, sayadId: r.sayadId || null, treasuryId: bankId, chequeBookId: bank?.nextSerial?.bookId ?? null }
                  : null,
              )
            : null,
        },
      });
      router.push(`/admin/accounting/invoices/${invoiceId}#installments`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "ثبت نشد");
      setBusy(false);
    }
  }

  if (!d) return error ? <ErrorText>{error}</ErrorText> : <p className="text-xs text-gray-400">در حال بارگذاری…</p>;
  const invLabel = `فاکتور ${sales ? "فروش" : "خرید"} ${faNum(d.invoice.number ?? 0)} — ${d.invoice.partyName}`;
  if (d.plan) {
    return (
      <Card className="p-6 text-center space-y-3">
        <p className="text-sm font-bold">این فاکتور برنامه‌ی اقساط دارد.</p>
        <Link href={`/admin/accounting/invoices/${invoiceId}#installments`} className={btn.primary}>
          دیدن اقساط
        </Link>
      </Card>
    );
  }
  const canSave = !busy && d.can.write && principal > 0n && rows.length > 0 && diff === 0n && rows.every((r) => r.dueDate && BigInt(r.amount || "0") > 0n) && (!withCheques || d.can.pay);

  return (
    <div className="space-y-4 max-w-4xl">
      <PageHeader
        title={sales ? "فروش اقساطی" : "خرید اقساطی"}
        help="accountingInstallmentPlan"
        back={{ href: `/admin/accounting/invoices/${invoiceId}`, label: invLabel }}
        desc={
          <>
            مانده‌ی این فاکتور <b className="text-gray-800 dark:text-gray-100">{formatAmount(open)} تومان</b> است. پیش‌پرداخت را جدا با «{sales ? "ثبت دریافت" : "ثبت پرداخت"}» بزنید؛ بقیه اینجا
            قسط‌بندی می‌شود.
          </>
        }
      />
      <ErrorText>{error}</ErrorText>
      {open <= 0n && <ErrorText>این فاکتور مانده‌ای ندارد که قسطی شود.</ErrorText>}

      <Card className="p-4 sm:p-5 space-y-4">
        <SectionTitle title="تنظیمات" help="accountingInstallmentPlan" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="پیش‌پرداخت (اختیاری)" hint="بخشی که همین حالا نقد گرفته/داده می‌شود">
            <AmountInput value={down} onChange={(v) => { setDown(v); setTouched(false); }} compact />
          </Field>
          <Field label="تعداد قسط">
            <input value={count} onChange={(e) => { setCount(e.target.value.replace(/\D/g, "")); setTouched(false); }} className={inputCls} inputMode="numeric" />
          </Field>
          <Field label="هر چند ماه یک قسط">
            <select value={interval} onChange={(e) => { setIntervalM(e.target.value); setTouched(false); }} className={inputCls}>
              {[1, 2, 3, 4, 6, 12].map((m) => (
                <option key={m} value={m}>
                  {m === 1 ? "ماهانه" : `هر ${faNum(m)} ماه`}
                </option>
              ))}
            </select>
          </Field>
          <Field label="سررسید اولین قسط">
            <JalaliDatePicker value={first} onChange={(v) => { setFirst(v); setTouched(false); }} clearable={false} />
          </Field>
        </div>

        <div className="grid gap-3 lg:grid-cols-[1fr_auto] items-end">
          <Field label="کارمزد">
            <Segmented<FeeMode>
              value={feeMode}
              onChange={(m) => { setFeeMode(m); setTouched(false); }}
              options={(Object.keys(FEE_MODE_LABELS) as FeeMode[]).map((m) => ({ value: m, label: FEE_MODE_LABELS[m] }))}
            />
          </Field>
          {(feeMode === "MONTHLY" || feeMode === "TOTAL") && (
            <Field label={feeMode === "MONTHLY" ? "درصد در ماه" : "درصد کل"}>
              <div className="relative w-36">
                <input value={rate} onChange={(e) => { setRate(e.target.value); setTouched(false); }} className={`${inputCls} pl-8`} inputMode="decimal" placeholder="۳" />
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">٪</span>
              </div>
            </Field>
          )}
          {feeMode === "FIXED" && (
            <Field label="مبلغ کارمزد">
              <div className="w-48">
                <AmountInput value={fixedFee} onChange={(v) => { setFixedFee(v); setTouched(false); }} compact />
              </div>
            </Field>
          )}
        </div>

        <Field label="گرد کردن مبلغ قسط‌ها" hint="باقی‌مانده روی قسط آخر می‌آید">
          <Segmented value={round} onChange={(v) => { setRound(v); setTouched(false); }} options={ROUND} />
        </Field>

        {/* خلاصه */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 rounded-2xl bg-gray-50 dark:bg-white/[0.03] p-3">
          <Figure label="مبلغ قسطی" value={principal > 0n ? principal : 0n} />
          <Figure label="کارمزد" value={fee} tone={fee > 0n ? (sales ? "green" : "red") : undefined} sub={feeMode === "MONTHLY" && rateBp ? `${faNum(rate)}٪ × ${faNum(n * iv)} ماه` : undefined} />
          <Figure label="جمع اقساط" value={total > 0n ? total : 0n} strong />
          <Figure label="هر قسط حدوداً" value={n > 0 && total > 0n ? total / BigInt(n) : 0n} />
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="px-4 pt-4 flex flex-wrap items-center gap-2 justify-between">
          <SectionTitle title={`جدول اقساط (${faNum(rows.length)})`} />
          <div className="flex flex-wrap items-center gap-2 mb-3">
            {touched && (
              <button onClick={regenerate} className={btn.small}>
                <Wand2 className="h-3.5 w-3.5" aria-hidden />
                ساخت دوباره از تنظیمات
              </button>
            )}
            <label className="inline-flex items-center gap-2 text-xs font-bold cursor-pointer select-none">
              <input type="checkbox" checked={withCheques} onChange={(e) => setWithCheques(e.target.checked)} className="accent-blue-600 w-4 h-4" />
              {sales ? "برای اقساط چک می‌گیرم" : "برای اقساط چک می‌دهم"}
            </label>
          </div>
        </div>
        {withCheques && !sales && (
          <div className="px-4 pb-3">
            <Field label="از حساب بانکی" hint="شماره‌ها از دسته‌چک همین حساب پشت‌سرهم پیشنهاد می‌شوند">
              <select value={bankId} onChange={(e) => { setBankId(e.target.value); setRows((x) => x.map((r) => ({ ...r, serialNo: "" }))); }} className={inputCls}>
                {d.banks.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
              {!d.banks.length && <span className="block text-[11px] text-amber-600 mt-1">حساب بانکی تعریف نشده.</span>}
            </Field>
          </div>
        )}
        {withCheques && !d.can.pay && <p className="px-4 pb-3 text-xs text-amber-600">ثبت چک دسترسی «دریافت و پرداخت» می‌خواهد.</p>}

        <div className="divide-y divide-gray-100 dark:divide-white/5 border-t border-gray-100 dark:border-white/5">
          {rows.map((r, i) => (
            <div key={i} className={`grid gap-2 px-4 py-3 items-center ${withCheques ? "sm:grid-cols-[2.5rem_11rem_11rem_1fr]" : "sm:grid-cols-[2.5rem_11rem_1fr]"}`}>
              <span className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-600 text-xs font-black flex items-center justify-center">{faNum(i + 1)}</span>
              <JalaliDatePicker value={r.dueDate} onChange={(v) => patch(i, { dueDate: v })} clearable={false} />
              <AmountInput value={r.amount} onChange={(v) => patch(i, { amount: v })} compact />
              {withCheques && (
                <div className={`grid gap-2 ${sales ? "grid-cols-3" : "grid-cols-2"}`}>
                  <input value={r.serialNo} onChange={(e) => patch(i, { serialNo: e.target.value })} placeholder="شماره‌ی چک" className={inputCls} inputMode="numeric" dir="ltr" />
                  {sales && <input value={r.bankName} onChange={(e) => patch(i, { bankName: e.target.value })} placeholder="بانک" className={inputCls} />}
                  <input value={r.sayadId} onChange={(e) => patch(i, { sayadId: e.target.value })} placeholder="صیادی (اختیاری)" className={inputCls} inputMode="numeric" dir="ltr" />
                </div>
              )}
            </div>
          ))}
          {!rows.length && <p className="px-4 py-8 text-center text-xs text-gray-400">تعداد قسط و اولین سررسید را بدهید.</p>}
        </div>
        {rows.length > 0 && (
          <div className={`px-4 py-3 border-t border-gray-100 dark:border-white/5 text-xs font-bold flex items-center justify-between ${diff === 0n ? "text-emerald-600" : "text-red-600"}`}>
            <span>جمع قسط‌ها {formatAmount(sum)}</span>
            <span>{diff === 0n ? "✓ برابر جمع اقساط" : `${diff > 0n ? "کم" : "زیاد"} است: ${formatAmount(diff < 0n ? -diff : diff)}`}</span>
          </div>
        )}
      </Card>

      <Card className="p-4">
        <Field label="یادداشت (اختیاری)" hint="روی چاپ جدول اقساط می‌آید — مثلاً شرایط دیرکرد">
          <input value={note} onChange={(e) => setNote(e.target.value)} className={inputCls} />
        </Field>
      </Card>

      <div className="sticky bottom-16 md:bottom-0 z-30 -mx-4 lg:-mx-6 bg-white/95 dark:bg-gray-900/95 backdrop-blur border-t border-gray-200 dark:border-white/10">
        <div className="px-4 lg:px-6 py-2.5 flex items-center gap-3">
          <CalendarClock className="h-5 w-5 text-blue-600 shrink-0" aria-hidden />
          <div className="flex-1 min-w-0">
            <p className="text-[11px] text-gray-500 truncate">
              {rows.length ? `${faNum(rows.length)} قسط${fee > 0n ? ` با ${formatAmount(fee)} کارمزد` : " بی‌کارمزد"}${withCheques ? " — با چک" : ""}` : "برنامه‌ی اقساط"}
            </p>
            <Money value={total > 0n ? total : 0n} className="text-base" />
          </div>
          <button onClick={save} disabled={!canSave} className={btn.primary}>
            <Receipt className="h-4 w-4" aria-hidden />
            {busy ? "در حال ثبت…" : "ثبت برنامه"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Figure({ label, value, sub, tone, strong }: { label: string; value: bigint; sub?: string; tone?: "green" | "red"; strong?: boolean }) {
  return (
    <div>
      <p className="text-[11px] font-bold text-gray-500">{label}</p>
      <Money value={value} tone={tone} className={strong ? "text-base" : "text-sm"} />
      {sub && <p className="text-[10px] text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}
