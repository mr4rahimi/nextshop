"use client";

/**
 * مرجوعی صندوق — قاب پنجره دور `ReturnPicker` (رسید، یا موبایل/نام مشتری ← همه‌ی خریدها)،
 * با دلیل مرجوعی. docs/plans/webhesab-parity.md بخش ۳۳ و ۳۴.۱.
 * مدیر صندوق «مرجوعی بی‌رسید» دارد: بعد از آن هر اسکن یک ردیف مرجوعی با قیمت امروز است.
 */

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import ReturnPicker, { ReturnReasonField, type ReturnPick, type Returnable } from "../returns/ReturnPicker";
import { faNum, formatAmount } from "./shared";

export type { Returnable };

export default function ReturnSheet({
  initialCode,
  party,
  canBlind,
  onAdd,
  onBlind,
  onClose,
}: {
  initialCode?: string;
  /** مشتری انتخاب‌شده در صندوق — خریدهایش همان اول باز می‌شود */
  party?: { id: string; name: string } | null;
  canBlind: boolean;
  onAdd: (src: Returnable, picks: ReturnPick[], reason: string) => void;
  onBlind: () => void;
  onClose: () => void;
}) {
  const [sel, setSel] = useState<{ src: Returnable | null; picks: ReturnPick[]; sum: bigint }>({ src: null, picks: [], sum: 0n });
  const [reason, setReason] = useState("");

  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  const qty = sel.picks.reduce((s, p) => s + p.qty, 0);

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-3" role="dialog" aria-modal="true">
      <div className="adm-fade-in absolute inset-0 bg-slate-950/50 backdrop-blur-sm" onClick={onClose} />
      <div className="adm-sheet-in relative flex max-h-[94vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl dark:bg-gray-900">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3.5 dark:border-white/5">
          <h3 className="text-lg font-black text-rose-600">مرجوعی</h3>
          <button onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-gray-500 dark:bg-white/5" aria-label="بستن">
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 sm:p-5">
          <ReturnPicker endpoint="/api/admin/accounting/pos/returnable" initialCode={initialCode} party={party} onSelection={(src, picks, sum) => setSel({ src, picks, sum })} />
        </div>
        <div className="space-y-2 border-t border-gray-100 px-5 py-3 dark:border-white/5">
          {sel.src && <ReturnReasonField value={reason} onChange={setReason} />}
          <div className="flex flex-wrap items-center gap-2">
            {canBlind && (
              <button onClick={onBlind} className="rounded-xl px-3 py-2 text-xs font-bold text-gray-500 hover:bg-gray-100 dark:hover:bg-white/5">
                مرجوعی بی‌رسید (مدیر)
              </button>
            )}
            {sel.src && qty > 0 && (
              <span className="text-xs text-gray-500">
                {faNum(qty)} عدد از فاکتور {faNum(sel.src.invoiceNumber ?? 0)}
              </span>
            )}
            <button
              disabled={!sel.src || !sel.picks.length}
              onClick={() => sel.src && onAdd(sel.src, sel.picks, reason)}
              className="mr-auto rounded-2xl bg-rose-600 px-6 py-3 text-sm font-black text-white shadow-lg shadow-rose-600/25 disabled:opacity-40"
            >
              افزودن به سبد {sel.sum > 0n && `— ${formatAmount(sel.sum)}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
