"use client";

/**
 * چاپ برچسب بارکد کالا — docs/plans/inventory-items.md بخش ۴ و ۱۲.
 * `/admin/accounting/inventory/labels/print?items=id:تعداد,…` (پایان «/print» = بی‌قاب پنل).
 * اندازه و چیدمان از تنظیم مشترک (`AccSettings.labelConfig`)؛ تغییر اینجا برای
 * همین چاپ است و «ذخیره برای همه» آن را پیش‌فرض می‌کند.
 * بارکد: اولین بارکد کالا، وگرنه کد کالا (اسکن کد هم کالا را پیدا می‌کند).
 */

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { faNum } from "@/lib/accounting/money";
import { DEFAULT_LABEL, type LabelConfig } from "@/lib/accounting/inventory/label-config";
import { api } from "../ui";
import { LabelPages, LabelSettingsForm, type LabelData } from "./LabelSheet";

interface L {
  id: string;
  title: string;
  code: string;
  price: string | null;
  barcode: string;
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
  const [cfg, setCfg] = useState<LabelConfig>(DEFAULT_LABEL);
  const [showCfg, setShowCfg] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!wanted.length) return;
    api<{ items: L[]; config: LabelConfig }>(`/api/admin/accounting/items/labels?ids=${wanted.map((w) => w.id).join(",")}`)
      .then((d) => {
        setItems(d.items);
        setCfg(d.config);
      })
      .catch((e) => setError(e.message));
  }, [wanted]);

  async function saveDefault() {
    setSaved(null);
    try {
      await api("/api/admin/accounting/items/coding", { method: "PATCH", json: { labelConfig: cfg } });
      setSaved("تنظیم برای همه ذخیره شد");
    } catch (e) {
      setSaved(e instanceof Error ? e.message : "ذخیره نشد");
    }
  }

  const labels: LabelData[] = items.flatMap((i) =>
    Array.from({ length: qty[i.id] ?? 1 }, (_, k) => ({ key: `${i.id}-${k}`, title: i.title, barcode: i.barcode, price: i.price })),
  );

  return (
    <div className="min-h-screen bg-gray-100 print:bg-white text-black [color-scheme:light]" dir="rtl">
      <div className="print:hidden sticky top-0 z-10 bg-white border-b border-gray-200 px-4 py-2.5 flex flex-wrap items-center gap-2">
        <button onClick={() => setShowCfg((v) => !v)} className={`px-3 py-1.5 rounded-lg text-xs font-bold ${showCfg ? "bg-gray-900 text-white" : "bg-gray-100"}`}>
          ⚙️ تنظیم چاپ — {faNum(cfg.cols)}×{faNum(cfg.w)}×{faNum(cfg.h)}
        </button>
        <span className="text-xs text-gray-500">{faNum(labels.length)} برچسب</span>
        <button onClick={() => window.print()} disabled={!labels.length} className="mr-auto px-5 py-1.5 rounded-lg bg-blue-600 text-white text-sm font-bold disabled:opacity-50">
          چاپ
        </button>
      </div>
      {showCfg && (
        <div className="print:hidden max-w-3xl mx-auto mt-4 px-4">
          <div className="bg-white rounded-2xl p-4 space-y-3">
            <LabelSettingsForm value={cfg} onChange={setCfg} />
            <div className="flex items-center gap-2">
              <button onClick={saveDefault} className="px-4 py-1.5 rounded-lg bg-gray-900 text-white text-xs font-bold">
                ذخیره برای همه‌ی چاپ‌ها
              </button>
              {saved && <span className="text-xs text-gray-600">{saved}</span>}
            </div>
          </div>
        </div>
      )}
      {error && <p className="p-4 text-sm text-red-600">{error}</p>}
      {items.length > 1 && (
        <div className="print:hidden max-w-3xl mx-auto mt-4 px-4 space-y-1">
          {items.map((i) => (
            <div key={i.id} className="flex items-center gap-2 bg-white rounded-lg px-3 py-1.5 text-xs">
              <span className="flex-1 truncate">{i.title}</span>
              <span dir="ltr" className="font-mono text-gray-500">
                {i.code}
              </span>
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
      <LabelPages labels={labels} c={cfg} />
    </div>
  );
}
