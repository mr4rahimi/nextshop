"use client";

/**
 * شروع مرجوعی بیرون از صندوق — صفحه‌ی «فروش ← مرجوعی» و «برگشت از فروش» تازه بی‌مرجع.
 * مشتری یا رسید ← انتخاب اقلام و دلیل ← فرم «برگشت از فروش» با همان تعدادها
 * (`/invoices/new?ref&pick&reason`). docs/plans/webhesab-parity.md بخش ۳۴.۱.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { faNum, formatAmount } from "@/lib/accounting/money";
import { btn, Card } from "../ui";
import ReturnPicker, { ReturnReasonField, type ReturnPick, type Returnable } from "./ReturnPicker";

export default function ReturnStart({ onFree }: { onFree?: () => void }) {
  const router = useRouter();
  const [sel, setSel] = useState<{ src: Returnable | null; picks: ReturnPick[]; sum: bigint }>({ src: null, picks: [], sum: 0n });
  const [reason, setReason] = useState("");
  const qty = sel.picks.reduce((s, p) => s + p.qty, 0);

  const go = () => {
    if (!sel.src) return;
    const p = new URLSearchParams({ type: "SALES_RETURN", ref: sel.src.invoiceId, pick: sel.picks.map((x) => `${x.refLineId}:${x.qty}`).join(",") });
    if (reason) p.set("reason", reason);
    router.push(`/admin/accounting/invoices/new?${p}`);
  };

  return (
    <div className="space-y-3">
      <Card className="p-4">
        <ReturnPicker endpoint="/api/admin/accounting/returns" onSelection={(src, picks, sum) => setSel({ src, picks, sum })} />
      </Card>
      <div className="sticky bottom-2 z-10">
        <Card className="space-y-2 p-3 shadow-lg">
          {sel.src && <ReturnReasonField value={reason} onChange={setReason} />}
          <div className="flex flex-wrap items-center gap-2">
            {onFree && (
              <button type="button" onClick={onFree} className="text-xs font-bold text-gray-500 hover:text-blue-600">
                برگشت بی‌فاکتور (ردیف آزاد)
              </button>
            )}
            {sel.src && qty > 0 && (
              <span className="text-xs text-gray-500">
                {faNum(qty)} عدد از فاکتور {faNum(sel.src.invoiceNumber ?? 0)} — {sel.src.partyName}
              </span>
            )}
            <button type="button" disabled={!sel.src || !qty} onClick={go} className={`${btn.primary} mr-auto !bg-rose-600 hover:!bg-rose-700`}>
              ادامه: برگشت از فروش {sel.sum > 0n && `— ${formatAmount(sel.sum)}`}
            </button>
          </div>
        </Card>
      </div>
    </div>
  );
}
