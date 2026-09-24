"use client";

/**
 * موجودی کالای اول دوره — تعداد و بهای واحد هر کالا در هر انبار.
 * «پیشنهاد از موجودی سایت» کالاهای دارای موجودی را با قیمت خرید شناخته‌شده می‌آورد.
 */

import { useEffect, useMemo, useState } from "react";
import { formatJalali } from "@/lib/club/jalali";
import { faNum, toLatinDigits } from "@/lib/accounting/money";
import AmountInput from "../AmountInput";
import ProductPicker from "../ProductPicker";
import InventoryTabs from "./InventoryTabs";
import { api, btn, Card, ErrorText, Money, PageHeader } from "../ui";

interface Resp {
  year: { id: string; title: string; startDate: string };
  defaultWarehouseId: string;
  warehouses: { id: string; name: string }[];
  lines: { productId: string; warehouseId: string; qty: number; unitCost: string }[];
  suggestions: { productId: string; qty: number; unitCost: string }[];
  products: { id: string; title: string; sku: string | null; stock: number }[];
  can: { manage: boolean };
}
interface Row {
  key: string;
  productId: string;
  title: string;
  warehouseId: string;
  qty: string;
  unitCost: string;
}

export default function OpeningInventoryClient() {
  const [data, setData] = useState<Resp | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function hydrate(d: Resp, withSuggestions: boolean) {
    const title = new Map(d.products.map((p) => [p.id, p.title]));
    const base = d.lines.map((l) => ({ key: `${l.productId}|${l.warehouseId}`, productId: l.productId, title: title.get(l.productId) ?? "کالا", warehouseId: l.warehouseId, qty: String(l.qty), unitCost: l.unitCost }));
    const extra = withSuggestions
      ? d.suggestions.map((s) => ({ key: `${s.productId}|${d.defaultWarehouseId}`, productId: s.productId, title: title.get(s.productId) ?? "کالا", warehouseId: d.defaultWarehouseId, qty: String(s.qty), unitCost: s.unitCost === "0" ? "" : s.unitCost }))
      : [];
    setRows((cur) => {
      const have = new Set((withSuggestions ? cur : base).map((r) => r.key));
      return withSuggestions ? [...cur, ...extra.filter((e) => !have.has(e.key))] : base;
    });
  }

  useEffect(() => {
    api<Resp>("/api/admin/accounting/inventory/opening")
      .then((d) => {
        setData(d);
        hydrate(d, false);
      })
      .catch((e) => setError(e.message));
  }, []);

  async function suggest() {
    try {
      const d = await api<Resp>("/api/admin/accounting/inventory/opening?suggest=1");
      setData(d);
      hydrate(d, true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "انجام نشد");
    }
  }

  const total = useMemo(() => rows.reduce((s, r) => s + BigInt(r.unitCost || "0") * BigInt(r.qty || "0"), 0n), [rows]);
  const missingCost = rows.filter((r) => Number(r.qty) > 0 && !r.unitCost).length;

  async function save() {
    setBusy(true);
    setError(null);
    setSaved(null);
    try {
      const d = await api<{ voucher: { number: number } | null }>("/api/admin/accounting/inventory/opening", {
        method: "PUT",
        json: { lines: rows.filter((r) => Number(r.qty) > 0).map((r) => ({ productId: r.productId, warehouseId: r.warehouseId, qty: Number(r.qty), unitCost: r.unitCost || "0" })) },
      });
      setSaved(d.voucher ? `ذخیره شد — سند ${faNum(d.voucher.number)}؛ موجودی سایت هم با همین اعداد یکی شد` : "موجودی اول دوره پاک شد");
    } catch (e) {
      setError(e instanceof Error ? e.message : "ذخیره نشد");
    } finally {
      setBusy(false);
    }
  }

  if (!data) return error ? <ErrorText>{error}</ErrorText> : <p className="text-xs text-gray-400">در حال بارگذاری…</p>;
  const ro = !data.can.manage;
  const set = (key: string, p: Partial<Row>) => setRows((x) => x.map((r) => (r.key === key ? { ...r, ...p } : r)));

  return (
    <div className="space-y-4">
      <PageHeader
        title="کالا و انبار"
        help="accountingOpeningInventory"
        desc={`موجودی کالا در روز اول سال مالی ${faNum(data.year.title)} — ${formatJalali(new Date(data.year.startDate))}`}
      />
      <InventoryTabs />

      {!ro && (
        <Card className="p-3 space-y-2">
          <ProductPicker
            onPick={(p) => {
              const key = `${p.id}|${data.defaultWarehouseId}`;
              setRows((x) => (x.some((r) => r.key === key) ? x : [{ key, productId: p.id, title: p.title, warehouseId: data.defaultWarehouseId, qty: String(Math.max(0, p.siteStock)), unitCost: "" }, ...x]));
            }}
          />
          <button onClick={suggest} className={btn.small}>
            ✨ افزودن همه‌ی کالاهای دارای موجودی در سایت
          </button>
        </Card>
      )}

      <Card className="overflow-hidden divide-y divide-gray-100 dark:divide-white/5">
        {rows.map((r) => (
          <div key={r.key} className="grid gap-2 px-3 py-3 md:grid-cols-[1.5fr_1fr_90px_1.2fr_auto] items-center">
            <p className="text-sm font-bold truncate">{r.title}</p>
            {data.warehouses.length > 1 ? (
              <select value={r.warehouseId} disabled={ro} onChange={(e) => set(r.key, { warehouseId: e.target.value, key: `${r.productId}|${e.target.value}` })} className="px-2 py-2 rounded-lg bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-xs">
                {data.warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
            ) : (
              <span className="hidden md:block text-xs text-gray-400">{data.warehouses[0]?.name}</span>
            )}
            <div className="grid grid-cols-[90px_1fr_auto] md:contents gap-2 items-center">
              <input
                value={faNum(r.qty)}
                disabled={ro}
                onChange={(e) => set(r.key, { qty: toLatinDigits(e.target.value).replace(/\D/g, "") })}
                inputMode="numeric"
                placeholder="تعداد"
                className="h-10 rounded-lg bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-center font-bold"
              />
              <AmountInput compact value={r.unitCost} onChange={(v) => set(r.key, { unitCost: v })} placeholder="بهای واحد" disabled={ro} />
              {!ro && (
                <button onClick={() => setRows((x) => x.filter((y) => y.key !== r.key))} className="text-gray-300 hover:text-red-600 px-2" aria-label="حذف">
                  ✕
                </button>
              )}
            </div>
          </div>
        ))}
        {!rows.length && <p className="px-4 py-10 text-center text-xs text-gray-400">کالایی اضافه نشده. جستجو کنید یا همه‌ی کالاهای دارای موجودی سایت را اضافه کنید.</p>}
      </Card>

      <Card className="p-3 md:p-4 sticky bottom-20 md:bottom-4 z-20 shadow-lg">
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
          <span>
            {faNum(rows.length)} ردیف · ارزش <Money value={total} tone="blue" />
          </span>
          {missingCost > 0 && <span className="text-xs font-bold text-amber-600">{faNum(missingCost)} ردیف بها ندارد (صفر ثبت می‌شود)</span>}
          {!ro && (
            <button onClick={save} disabled={busy} className={btn.primary}>
              {busy ? "در حال ذخیره…" : "ذخیره‌ی موجودی اول دوره"}
            </button>
          )}
        </div>
        <ErrorText>{error}</ErrorText>
        {saved && <p className="text-xs font-bold text-emerald-600 mt-2">✓ {saved}</p>}
      </Card>
    </div>
  );
}
