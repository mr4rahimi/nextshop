"use client";

/**
 * بخش «اقساط» صفحه‌ی فاکتور — docs/plans/accounting.md بخش ۹.۳.
 * بی‌برنامه: دکمه‌ی «فروش/خرید اقساطی». با برنامه: جدول قسط‌ها با وضعیت پوشش،
 * چک هر قسط، «ثبت دریافت» قسط بعدی، زمان‌بندی تازه، چاپ و ابطال.
 */

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { CalendarClock, Printer } from "lucide-react";
import { formatJalali } from "@/lib/club/jalali";
import { faNum, formatAmount } from "@/lib/accounting/money";
import { dayValue } from "@/lib/accounting/dates";
import { FEE_MODE_LABELS, type FeeMode } from "@/lib/accounting/installments-calc";
import JalaliDatePicker from "@/components/admin/JalaliDatePicker";
import AmountInput from "../AmountInput";
import { api, Badge, btn, Card, ErrorText, Money, SectionTitle, Sheet } from "../ui";
import { StateBadge, type InstRow } from "./shared";

interface Data {
  invoice: { id: string; type: "SALES" | "PURCHASE"; status: string };
  settlement: { open: string } | undefined;
  plan: {
    plan: { id: string; principal: string; feeAmount: string; feeMode: FeeMode; feeRateBp: number; downPayment: string; count: number; intervalMonths: number; voucherId: string | null; note: string | null; createdByName: string; createdAt: string };
    rows: InstRow[];
  } | null;
  can: { write: boolean; pay: boolean };
}

export default function InstallmentsPanel({ invoiceId, onChange }: { invoiceId: string; onChange?: () => void }) {
  const [d, setD] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [edit, setEdit] = useState<{ dueDate: string; amount: string; locked: boolean }[] | null>(null);

  const load = useCallback(() => {
    api<Data>(`/api/admin/accounting/invoices/${invoiceId}/installments`).then(setD).catch((e) => setError(e.message));
  }, [invoiceId]);
  useEffect(load, [load]);

  async function post(json: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    try {
      await api(`/api/admin/accounting/invoices/${invoiceId}/installments`, { method: "POST", json });
      setEdit(null);
      load();
      onChange?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "انجام نشد");
    } finally {
      setBusy(false);
    }
  }

  if (!d || d.invoice.status !== "ISSUED") return null;
  const sales = d.invoice.type === "SALES";
  const p = d.plan;

  if (!p) {
    if (!d.can.write || BigInt(d.settlement?.open ?? "0") <= 0n) return null;
    return (
      <Card className="p-4 flex flex-wrap items-center gap-3">
        <div className="w-10 h-10 rounded-2xl bg-blue-500/10 text-blue-600 flex items-center justify-center">
          <CalendarClock className="h-5 w-5" aria-hidden />
        </div>
        <div className="flex-1 min-w-[12rem]">
          <p className="text-sm font-black">{sales ? "فروش اقساطی" : "خرید اقساطی"}</p>
          <p className="text-xs text-gray-500 mt-0.5">مانده‌ی این فاکتور را با یا بی‌کارمزد، با یا بی‌چک قسط‌بندی کنید.</p>
        </div>
        <Link href={`/admin/accounting/invoices/${invoiceId}/installments`} className={btn.primary}>
          قسط‌بندی
        </Link>
      </Card>
    );
  }

  const plan = p.plan;
  const next = p.rows.find((r) => BigInt(r.left) > 0n);
  const left = p.rows.reduce((s, r) => s + BigInt(r.left), 0n);
  const paidCount = p.rows.filter((r) => r.state === "PAID").length;
  const overdue = p.rows.filter((r) => r.state === "OVERDUE");
  const pct = p.rows.length ? Math.round((paidCount / p.rows.length) * 100) : 0;

  return (
    <Card className="p-4 space-y-3">
      <div id="installments" className="scroll-mt-24" />
      <SectionTitle
        title={`اقساط (${faNum(paidCount)} از ${faNum(p.rows.length)} پرداخت شده)`}
        help="accountingInstallmentPlan"
        actions={
          <div className="flex flex-wrap gap-1.5">
            <Link href={`/admin/accounting/invoices/${invoiceId}/installments/print`} target="_blank" className={btn.small}>
              <Printer className="h-3.5 w-3.5" aria-hidden />
              چاپ
            </Link>
            {d.can.write && !edit && (
              <button
                onClick={() => setEdit(p.rows.map((r) => ({ dueDate: dayValue(new Date(r.dueDate)), amount: r.amount, locked: !!r.cheque })))}
                className={btn.small}
              >
                زمان‌بندی تازه
              </button>
            )}
          </div>
        }
      />

      <div className="h-2 rounded-full bg-gray-100 dark:bg-white/5 overflow-hidden" aria-hidden>
        <div className="h-full rounded-full bg-blue-500" style={{ width: `${pct}%` }} />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
        <div>
          <p className="text-[11px] text-gray-500">مبلغ قسطی</p>
          <Money value={plan.principal} />
        </div>
        <div>
          <p className="text-[11px] text-gray-500">کارمزد {plan.feeMode !== "NONE" && plan.feeRateBp ? `(${faNum(plan.feeRateBp / 100)}٪ ${plan.feeMode === "MONTHLY" ? "ماهانه" : "کل"})` : plan.feeMode === "FIXED" ? `(${FEE_MODE_LABELS.FIXED})` : ""}</p>
          <Money value={plan.feeAmount} />
        </div>
        <div>
          <p className="text-[11px] text-gray-500">مانده‌ی اقساط</p>
          <Money value={left} tone={left > 0n ? "red" : "gray"} />
        </div>
        <div>
          <p className="text-[11px] text-gray-500">سررسید گذشته</p>
          {overdue.length ? <Money value={overdue.reduce((s, r) => s + BigInt(r.left), 0n)} tone="red" /> : <span className="text-xs font-bold text-emerald-600">ندارد</span>}
        </div>
      </div>

      {next && d.can.pay && !edit && (
        <Link
          href={`/admin/accounting/money/new?kind=${sales ? "RECEIPT" : "PAYMENT"}&partyId=${next.party.id}&invoiceId=${invoiceId}&amount=${next.left}`}
          className={`${btn.primary} w-full sm:w-auto`}
        >
          {sales ? "📥 ثبت دریافت" : "📤 ثبت پرداخت"} قسط {faNum(next.seq)} — {formatAmount(next.left)} تومان
        </Link>
      )}
      <ErrorText>{error}</ErrorText>

      {!edit ? (
        <div className="divide-y divide-gray-100 dark:divide-white/5 -mx-4">
          {p.rows.map((r) => (
            <div key={r.id} className="flex items-center gap-3 px-4 py-2.5">
              <span className="w-8 h-8 rounded-xl bg-gray-100 dark:bg-white/5 text-xs font-black flex items-center justify-center shrink-0">{faNum(r.seq)}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold">{formatJalali(new Date(r.dueDate))}</p>
                <p className="text-[11px] text-gray-400 truncate">
                  {r.cheque ? (
                    <Link href={`/admin/accounting/cheques/${r.cheque.id}`} className="text-blue-600">
                      چک {faNum(r.cheque.serialNo)}
                    </Link>
                  ) : (
                    "بی‌چک"
                  )}
                  {BigInt(r.paid) > 0n && BigInt(r.left) > 0n && ` · ${formatAmount(r.paid)} پرداخت شده`}
                </p>
              </div>
              <div className="text-left space-y-1">
                <Money value={r.amount} className="text-sm" />
                <div>
                  <StateBadge row={r} />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {edit.map((r, i) => (
            <div key={i} className="grid grid-cols-[2rem_1fr_1fr] gap-2 items-center">
              <span className="text-xs font-black text-center">{faNum(i + 1)}</span>
              <JalaliDatePicker value={r.dueDate} onChange={(v) => setEdit((x) => x!.map((y, k) => (k === i ? { ...y, dueDate: v } : y)))} clearable={false} />
              <AmountInput value={r.amount} disabled={r.locked} onChange={(v) => setEdit((x) => x!.map((y, k) => (k === i ? { ...y, amount: v } : y)))} compact />
            </div>
          ))}
          {(() => {
            const sum = edit.reduce((s, r) => s + BigInt(r.amount || "0"), 0n);
            const want = BigInt(plan.principal) + BigInt(plan.feeAmount);
            return (
              <p className={`text-xs font-bold ${sum === want ? "text-emerald-600" : "text-red-600"}`}>
                جمع {formatAmount(sum)} از {formatAmount(want)} {sum !== want && `— اختلاف ${formatAmount(sum > want ? sum - want : want - sum)}`}
              </p>
            );
          })()}
          <p className="text-[11px] text-gray-400">قسطی که چک دارد، مبلغش عوض نمی‌شود. برای افزودن قسط، مبلغ یکی را کم کنید و ردیف تازه بزنید.</p>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setEdit((x) => [...x!, { dueDate: x![x!.length - 1]?.dueDate ?? "", amount: "", locked: false }])} className={btn.small}>
              + قسط
            </button>
            {edit.length > 1 && !edit[edit.length - 1].locked && (
              <button onClick={() => setEdit((x) => x!.slice(0, -1))} className={btn.small}>
                − قسط آخر
              </button>
            )}
            <span className="flex-1" />
            <button onClick={() => setEdit(null)} className={btn.soft}>
              انصراف
            </button>
            <button disabled={busy} onClick={() => post({ action: "reschedule", items: edit.map((r) => ({ dueDate: r.dueDate, amount: r.amount || "0" })) })} className={btn.primary}>
              ذخیره
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px] text-gray-400">
        <span>
          ساخته‌ی {plan.createdByName} · {formatJalali(new Date(plan.createdAt))}
        </span>
        {plan.voucherId && (
          <Link href={`/admin/accounting/vouchers/${plan.voucherId}`} className="text-blue-600">
            سند کارمزد
          </Link>
        )}
        {plan.note && <Badge>{plan.note}</Badge>}
        <span className="flex-1" />
        {d.can.write && !edit && <VoidPlan busy={busy} onVoid={(reason) => post({ action: "void", reason })} />}
      </div>
    </Card>
  );
}

function VoidPlan({ busy, onVoid }: { busy: boolean; onVoid: (reason: string) => void }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  return (
    <>
      <button onClick={() => setOpen(true)} className="text-red-600 font-bold">
        ابطال برنامه
      </button>
      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title="ابطال برنامه‌ی اقساط"
        footer={
          <button disabled={busy || !reason.trim()} onClick={() => onVoid(reason)} className={`${btn.danger} w-full`}>
            ابطال
          </button>
        }
      >
        <p className="text-sm leading-7 text-gray-700 dark:text-gray-200">
          کارمزد اقساط برمی‌گردد و فاکتور به حالت عادی (یک‌جا) برمی‌گردد. چک‌هایی که برای اقساط ثبت شده‌اند می‌مانند؛ اگر لازم است، دریافت همان چک‌ها را جدا باطل کنید.
        </p>
        <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="دلیل" className="mt-4 w-full px-3 py-2.5 rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-sm" />
      </Sheet>
    </>
  );
}
