"use client";

/**
 * چاپ برچسب بارکد کالا — docs/plans/inventory-items.md بخش ۴.
 * `/admin/accounting/inventory/labels/print?items=id:تعداد,…` (پایان «/print» = بی‌قاب پنل). رول برچسب (هر برچسب یک صفحه به اندازه‌ی خودش) یا برگه‌ی A4.
 * بارکد: اولین بارکد کالا، وگرنه کد کالا (اسکن کد هم کالا را پیدا می‌کند).
 */

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { canEncode, code128Bars } from "@/lib/barcode/code128";
import { faNum, formatAmount } from "@/lib/accounting/money";
import { api } from "../ui";

interface L {
  id: string;
  title: string;
  code: string;
  price: string | null;
  barcode: string;
}

const SIZES = {
  "40x25": { w: 40, h: 25, label: "رول ۴۰×۲۵" },
  "50x30": { w: 50, h: 30, label: "رول ۵۰×۳۰" },
  "60x40": { w: 60, h: 40, label: "رول ۶۰×۴۰" },
  a4: { w: 70, h: 37, label: "برگه A4 — ۲۴تایی" },
} as const;
type Size = keyof typeof SIZES;

function Barcode({ value, height }: { value: string; height: number }) {
  if (!canEncode(value)) return <p className="text-[8px] text-red-600">کد «{value}» حرف غیرلاتین دارد — یک بارکد لاتین برای کالا بنویسید</p>;
  const { bars, width } = code128Bars(value);
  return (
    <svg viewBox={`0 0 ${width} 40`} preserveAspectRatio="none" style={{ width: "100%", height: `${height}mm` }} aria-label={value}>
      {bars.map((b, i) => (
        <rect key={i} x={b.x} y={0} width={b.w} height={40} fill="#000" />
      ))}
    </svg>
  );
}

export default function LabelsPrint() {
  const sp = useSearchParams();
  const wanted = useMemo(
    () =>
      (sp.get("items") ?? "")
        .split(",")
        .map((x) => x.split(":"))
        .filter(([id]) => id)
        .map(([id, n]) => ({ id, qty: Math.min(Math.max(Number(n) || 1, 0), 500) })),
    [sp],
  );
  const [items, setItems] = useState<L[]>([]);
  const [qty, setQty] = useState<Record<string, number>>(() => Object.fromEntries(wanted.map((w) => [w.id, w.qty])));
  const [size, setSize] = useState<Size>(() => {
    try {
      return (localStorage.getItem("acc-label-size") as Size) || "50x30";
    } catch {
      return "50x30";
    }
  });
  const [showPrice, setShowPrice] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!wanted.length) return;
    api<{ items: L[] }>(`/api/admin/accounting/items/labels?ids=${wanted.map((w) => w.id).join(",")}`)
      .then((d) => setItems(d.items))
      .catch((e) => setError(e.message));
  }, [wanted]);
  useEffect(() => {
    try {
      localStorage.setItem("acc-label-size", size);
    } catch {}
  }, [size]);

  const s = SIZES[size];
  const labels = items.flatMap((i) => Array.from({ length: qty[i.id] ?? 1 }, (_, k) => ({ ...i, k })));
  const roll = size !== "a4";
  const pageCss = roll
    ? `@page { size: ${s.w}mm ${s.h}mm; margin: 0; } .lbl { page-break-after: always; break-after: page; }`
    : `@page { size: A4; margin: 8mm 0 0 0; } .sheet { display: grid; grid-template-columns: repeat(3, ${s.w}mm); }`;

  const one = (l: (typeof labels)[number]) => (
    <div key={`${l.id}-${l.k}`} className="lbl overflow-hidden flex flex-col justify-between text-black bg-white" style={{ width: `${s.w}mm`, height: `${s.h}mm`, padding: "1.5mm 2mm" }}>
      <p className="font-bold leading-tight line-clamp-2" style={{ fontSize: s.h < 30 ? "7pt" : "8pt" }}>
        {l.title}
      </p>
      <Barcode value={l.barcode} height={s.h * 0.38} />
      <div className="flex items-center justify-between" style={{ fontSize: "7pt" }}>
        <span dir="ltr" className="font-mono">
          {l.barcode}
        </span>
        {showPrice && l.price && BigInt(l.price) > 0n && <b>{formatAmount(l.price)} ت</b>}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-100 print:bg-white text-black [color-scheme:light]" dir="rtl">
      <style>{`${pageCss} @media print { .sheet { gap: 0 !important; padding: 0 !important; } .lbl { box-shadow: none !important; } }`}</style>
      <div className="print:hidden sticky top-0 z-10 bg-white border-b border-gray-200 px-4 py-2.5 flex flex-wrap items-center gap-2">
        {(Object.keys(SIZES) as Size[]).map((k) => (
          <button key={k} onClick={() => setSize(k)} className={`px-3 py-1.5 rounded-lg text-xs font-bold ${size === k ? "bg-gray-900 text-white" : "bg-gray-100"}`}>
            {SIZES[k].label}
          </button>
        ))}
        <label className="flex items-center gap-1.5 text-xs">
          <input type="checkbox" checked={showPrice} onChange={(e) => setShowPrice(e.target.checked)} />
          قیمت
        </label>
        <span className="text-xs text-gray-500">{faNum(labels.length)} برچسب</span>
        <button onClick={() => window.print()} className="mr-auto px-4 py-1.5 rounded-lg bg-blue-600 text-white text-sm font-bold">
          چاپ
        </button>
      </div>
      {error && <p className="p-4 text-sm text-red-600">{error}</p>}
      {items.length > 1 && (
        <div className="print:hidden max-w-3xl mx-auto mt-4 px-4 space-y-1">
          {items.map((i) => (
            <div key={i.id} className="flex items-center gap-2 bg-white rounded-lg px-3 py-1.5 text-xs">
              <span className="flex-1 truncate">{i.title}</span>
              <input
                type="number"
                min={0}
                value={qty[i.id] ?? 1}
                onChange={(e) => setQty((q) => ({ ...q, [i.id]: Math.max(0, Math.min(500, Number(e.target.value) || 0)) }))}
                className="w-16 px-2 py-1 rounded border border-gray-200 text-center"
              />
            </div>
          ))}
        </div>
      )}
      {roll ? (
        <div className="sheet flex flex-wrap gap-3 p-4 print:p-0 justify-center">{labels.map((l) => <div key={`${l.id}-${l.k}`} className="shadow print:shadow-none">{one(l)}</div>)}</div>
      ) : (
        <div className="sheet mx-auto my-4 print:my-0 bg-white shadow print:shadow-none gap-0" style={{ width: "210mm" }}>
          {labels.map(one)}
        </div>
      )}
    </div>
  );
}
