"use client";

/**
 * پنجره‌ی پرداخت صندوق — نقد، کارت یا ترکیبی؛ باقی پول مشتری درشت.
 * مبلغ کارت را می‌نویسید، نقد «باقی» است (سرور حساب می‌کند). Enter = ثبت و چاپ.
 * مرجوعی بیشتر از خرید ← همین پنجره برای «پس دادن» (نقد یا برگشت به کارت).
 */

import { useEffect, useMemo, useState } from "react";
import { Banknote, CreditCard, Printer, X } from "lucide-react";
import { amountToWords } from "@/lib/accounting/money";
import { B, BigAmount, Kbd, abs, formatAmount } from "./shared";

export interface PayResult {
  card: bigint;
  /** null = باقی نقد (`"rest"`) */
  cash: bigint | null;
  tendered: bigint | null;
}

const QUICK = [50_000n, 100_000n, 200_000n, 500_000n, 1_000_000n];

export default function PaySheet({
  net,
  exact,
  hasCard,
  canCredit,
  start,
  busy,
  error,
  onSubmit,
  onClose,
}: {
  /** + مشتری می‌دهد، − پس می‌گیرد */
  net: bigint;
  /** جمع دقیق است (برای مرجوعی از پیش‌نمایش سرور) */
  exact: boolean;
  hasCard: boolean;
  /** مشتری انتخاب شده — بخشی نسیه ممکن است */
  canCredit: boolean;
  start: "cash" | "card";
  busy: boolean;
  error: string | null;
  onSubmit: (r: PayResult) => void;
  onClose: () => void;
}) {
  const refund = net < 0n;
  const due = abs(net);
  const [card, setCard] = useState(start === "card" && hasCard ? due.toString() : "");
  const [tendered, setTendered] = useState("");
  const [credit, setCredit] = useState(false);
  const [cashManual, setCashManual] = useState("");
  const cardB = B(card);
  const cash = credit ? B(cashManual) : due > cardB ? due - cardB : 0n;
  const tenderedB = B(tendered);
  const change = !refund && tenderedB > cash ? tenderedB - cash : 0n;
  const short = !refund && tenderedB > 0n && tenderedB < cash;
  const over = cardB > due;
  const left = credit ? due - cardB - cash : 0n;

  const quick = useMemo(() => {
    if (refund || cash <= 0n) return [];
    const ups = QUICK.map((q) => ((cash + q - 1n) / q) * q).filter((v) => v > cash);
    return [...new Set(ups.map(String))].slice(0, 4).map(BigInt);
  }, [cash, refund]);

  function submit() {
    if (busy || over || short || (credit && left < 0n)) return;
    onSubmit({ card: cardB, cash: credit ? cash : null, tendered: tenderedB > 0n ? tenderedB : null });
  }

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "Enter" && !(e.target as HTMLElement).closest("button")) {
        e.preventDefault();
        submit();
      } else if (e.key === "F10" && hasCard) {
        e.preventDefault();
        setCard(due.toString());
      } else if (e.key === "F9") {
        e.preventDefault();
        setCard("");
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  });

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-3" role="dialog" aria-modal="true">
      <div className="adm-fade-in absolute inset-0 bg-slate-950/50 backdrop-blur-sm" onClick={onClose} />
      <div className="adm-sheet-in relative w-full max-w-xl overflow-hidden rounded-3xl bg-white shadow-2xl dark:bg-[#111620]">
        <div className={`px-6 pb-5 pt-5 text-white ${refund ? "bg-gradient-to-br from-rose-500 to-rose-700" : "bg-gradient-to-br from-emerald-500 to-emerald-700"}`}>
          <div className="flex items-center justify-between">
            <p className="text-sm font-bold opacity-90">{refund ? "پس دادن به مشتری" : "مبلغ قابل پرداخت"}</p>
            <button onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15" aria-label="بستن">
              <X className="h-5 w-5" aria-hidden />
            </button>
          </div>
          <p className="mt-1 text-4xl font-black tabular-nums tracking-tight sm:text-5xl">
            {!exact && "≈ "}
            {formatAmount(due)}
            <span className="mr-2 text-base font-bold opacity-80">تومان</span>
          </p>
          {due > 0n && <p className="mt-1 text-[11px] opacity-80">{amountToWords(due)} تومان</p>}
        </div>

        <div className="space-y-4 p-5">
          {due > 0n && (
            <>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setCard("")}
                  className={`flex items-center justify-center gap-2 rounded-2xl border-2 py-3 text-sm font-black transition ${cardB === 0n ? "border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300" : "border-gray-200 text-gray-600 dark:border-white/10 dark:text-gray-300"}`}
                >
                  <Banknote className="h-5 w-5" aria-hidden /> همه نقد <Kbd>F9</Kbd>
                </button>
                <button
                  disabled={!hasCard}
                  onClick={() => setCard(due.toString())}
                  className={`flex items-center justify-center gap-2 rounded-2xl border-2 py-3 text-sm font-black transition disabled:opacity-40 ${cardB === due ? "border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300" : "border-gray-200 text-gray-600 dark:border-white/10 dark:text-gray-300"}`}
                >
                  <CreditCard className="h-5 w-5" aria-hidden /> {refund ? "برگشت به کارت" : "همه کارت"} <Kbd>F10</Kbd>
                </button>
              </div>

              {hasCard && (
                <div>
                  <p className="mb-1.5 text-xs font-bold text-gray-500">{refund ? "مبلغ برگشت به کارت" : "مبلغ کارتخوان"} — باقی نقد</p>
                  <BigAmount value={card} onChange={setCard} onEnter={submit} autoFocus={start === "card"} />
                  {over && <p className="mt-1 text-xs font-bold text-red-600">از مبلغ کل بیشتر است</p>}
                </div>
              )}

              <div className="flex items-center justify-between rounded-2xl bg-gray-50 px-4 py-3 dark:bg-white/5">
                <span className="text-sm font-bold text-gray-600 dark:text-gray-300">{refund ? "پس دادن نقد" : "نقد"}</span>
                {credit ? (
                  <BigAmount value={cashManual} onChange={setCashManual} className="w-56" />
                ) : (
                  <span className="text-2xl font-black tabular-nums text-gray-900 dark:text-white">{formatAmount(cash)}</span>
                )}
              </div>

              {!refund && cash > 0n && !credit && (
                <div>
                  <p className="mb-1.5 text-xs font-bold text-gray-500">پول دریافتی از مشتری (برای باقی پول — اختیاری)</p>
                  <BigAmount value={tendered} onChange={setTendered} onEnter={submit} autoFocus={start === "cash"} />
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <button onClick={() => setTendered(cash.toString())} className="rounded-xl bg-gray-100 px-3 py-2 text-xs font-black text-gray-700 dark:bg-white/5 dark:text-gray-200">
                      همان مبلغ
                    </button>
                    {quick.map((q) => (
                      <button key={String(q)} onClick={() => setTendered(q.toString())} className="rounded-xl bg-gray-100 px-3 py-2 text-xs font-black tabular-nums text-gray-700 dark:bg-white/5 dark:text-gray-200">
                        {formatAmount(q)}
                      </button>
                    ))}
                  </div>
                  {change > 0n && (
                    <div className="mt-3 flex items-center justify-between rounded-2xl bg-amber-50 px-4 py-3 dark:bg-amber-500/10">
                      <span className="text-sm font-black text-amber-700 dark:text-amber-300">باقی پول مشتری</span>
                      <span className="text-3xl font-black tabular-nums text-amber-700 dark:text-amber-300">{formatAmount(change)}</span>
                    </div>
                  )}
                  {short && <p className="mt-1 text-xs font-bold text-red-600">پول دریافتی کمتر از مبلغ نقد است</p>}
                </div>
              )}

              {canCredit && (
                <label className="flex items-center gap-2 text-xs font-bold text-gray-600 dark:text-gray-300">
                  <input type="checkbox" checked={credit} onChange={(e) => setCredit(e.target.checked)} className="h-4 w-4 accent-emerald-600" />
                  {refund ? "بخشی پس داده نشود و روی حساب مشتری بماند" : "بخشی نسیه روی حساب مشتری"}
                  {credit && <span className="mr-auto tabular-nums">{refund ? "روی حساب" : "نسیه"}: {formatAmount(left > 0n ? left : 0n)}</span>}
                </label>
              )}
            </>
          )}

          {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-xs font-bold text-red-600 dark:bg-red-500/10">{error}</p>}

          <button
            onClick={submit}
            disabled={busy || over || short || (credit && left < 0n)}
            className={`flex w-full items-center justify-center gap-2 rounded-2xl py-4 text-lg font-black text-white shadow-lg transition active:scale-[0.99] disabled:opacity-50 ${refund ? "bg-rose-600 shadow-rose-600/25" : "bg-emerald-600 shadow-emerald-600/25"}`}
          >
            <Printer className="h-5 w-5" aria-hidden />
            {busy ? "در حال ثبت…" : due === 0n ? "ثبت تعویض" : refund ? "پس دادن و چاپ رسید" : "ثبت و چاپ رسید"}
            <Kbd>Enter</Kbd>
          </button>
        </div>
      </div>
    </div>
  );
}
