"use client";

/** کاردکس یک کالا — ورود، خروج و مانده؛ بها فقط با مجوز */

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { formatJalali } from "@/lib/club/jalali";
import { faNum, formatAmount } from "@/lib/accounting/money";
import { RangeBar, rangeFor, rangeQuery, type Range } from "../Statement";
import { api, Badge, btn, Card, Chips, Empty, ErrorText, Money, PageHeader, Stat } from "../ui";
import ItemForm from "./ItemForm";

const MOVE_LABELS: Record<string, string> = {
  OPENING: "موجودی اول دوره",
  PURCHASE: "خرید",
  PURCHASE_RETURN: "برگشت از خرید",
  SALE: "فروش",
  SALE_RETURN: "برگشت از فروش",
  TRANSFER_IN: "حواله — ورود",
  TRANSFER_OUT: "حواله — خروج",
  ADJUST_IN: "انبارگردانی — اضافی",
  ADJUST_OUT: "انبارگردانی — کسری",
};

/** ورود/خروج دستی جهتش از نوع حرکت و دلیلش از `note` حرکت (webhesab-parity.md بخش ۷) */
function moveLabel(r: { type: string; sourceType: string; note?: string | null }): string {
  if (r.sourceType === "AccStockAdjust") return `${r.type === "ADJUST_IN" ? "ورود دستی" : "خروج دستی"}${r.note ? ` — ${r.note}` : ""}`;
  return MOVE_LABELS[r.type] ?? r.type;
}

function sourceHref(type: string, id: string): string | null {
  if (type === "AccTransfer") return `/admin/accounting/inventory/transfers?id=${id}`;
  if (type === "AccStockCount") return `/admin/accounting/inventory/counts/${id}`;
  if (type === "AccStockAdjust") return `/admin/accounting/inventory/adjustments/${id}`;
  if (type === "OpeningInventory") return "/admin/accounting/inventory/opening";
  return null;
}

interface Row {
  id: string;
  date: string;
  type: string;
  warehouseId: string;
  qty: number;
  running: number;
  sourceType: string;
  sourceId: string;
  unitCost?: string;
  totalCost?: string;
  balanceValue?: string;
  balanceQty?: number;
  note?: string | null;
}
interface Data {
  product: { id: string; title: string; sku: string; unit: string; mainImage: string | null; isActive: boolean; hasProduct: boolean; link: { productId: string; product: string; variant: string | null } | null; stock: number | null; lowStockThreshold: number };
  stocks: { warehouseId: string; qty: number }[];
  transit: { id: string; number: number; toWarehouseId: string; qty: number }[];
  warehouses: { id: string; name: string; sellable: boolean }[];
  opening: number;
  rows: Row[];
  cost: { avgCost: string; totalValue: string; qtyOnHand: number; lastCost: string } | null;
  can: { cost: boolean; manage: boolean };
}

export default function KardexClient({ productId }: { productId: string }) {
  const [wh, setWh] = useState("");
  const [range, setRange] = useState<Range>(() => rangeFor("year"));
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);

  const load = useCallback(() => {
    const p = new URLSearchParams(rangeQuery(range));
    if (wh) p.set("warehouseId", wh);
    api<Data>(`/api/admin/accounting/inventory/${productId}?${p}`)
      .then((d) => {
        setData(d);
        setError(null);
      })
      .catch((e) => setError(e.message));
  }, [productId, wh, range]);
  useEffect(load, [load]);

  if (!data) return error ? <ErrorText>{error}</ErrorText> : <p className="text-xs text-gray-400">در حال بارگذاری…</p>;
  const whName = new Map(data.warehouses.map((w) => [w.id, w.name]));
  const total = data.stocks.reduce((s, x) => s + x.qty, 0);
  const transit = data.transit.reduce((s, x) => s + x.qty, 0);
  const sellable = data.stocks.filter((s) => data.warehouses.find((w) => w.id === s.warehouseId)?.sellable).reduce((s, x) => s + x.qty, 0);

  return (
    <div className="space-y-4">
      <PageHeader
        title={data.product.title}
        help="accountingKardex"
        back={{ href: "/admin/accounting/inventory", label: "کالا و انبار" }}
        desc={
          <span className="flex flex-wrap items-center gap-1.5">
            <span>
              کد <span dir="ltr">{faNum(data.product.sku)}</span>
            </span>
            {!data.product.hasProduct && <Badge tone="amber">بی‌محصول در سایت</Badge>}
            {data.product.link?.variant && (
              <a href={`/admin/products/${data.product.link.productId}`} className="hover:underline">
                <Badge tone="green">
                  تنوع «{data.product.link.variant}» در {data.product.link.product}
                </Badge>
              </a>
            )}
            {!data.product.isActive && <Badge tone="red">غیرفعال</Badge>}
          </span>
        }
        actions={
          data.can.manage && (
            <button onClick={() => setEditing(true)} className={btn.soft}>
              ✏️ ویرایش کالا
            </button>
          )
        }
      />
      {editing && (
        <ItemForm
          itemId={productId}
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            load();
          }}
        />
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Stat label="موجودی دفتری" value={faNum(total)} sub={transit ? `+ ${faNum(transit)} در راه` : undefined} tone={total < 0 ? "red" : "gray"} />
        {data.product.stock !== null && (
          <Stat label="موجودی سایت" value={faNum(data.product.stock)} sub={sellable !== data.product.stock ? `انبارهای قابل فروش: ${faNum(sellable)}` : undefined} tone={sellable !== data.product.stock ? "amber" : "gray"} />
        )}
        {data.cost && <Stat label="میانگین بها" value={<Money value={data.cost.avgCost} />} />}
        {data.cost && <Stat label="ارزش موجودی" value={<Money value={data.cost.totalValue} />} />}
      </div>

      {(data.stocks.length > 1 || data.transit.length > 0) && (
        <Card className="p-3 flex flex-wrap gap-2">
          {data.stocks.map((s) => (
            <Badge key={s.warehouseId} tone={s.qty < 0 ? "red" : "gray"}>
              {whName.get(s.warehouseId)}: {faNum(s.qty)}
            </Badge>
          ))}
          {data.transit.map((t) => (
            <Link key={t.id} href={`/admin/accounting/inventory/transfers?id=${t.id}`} className="hover:opacity-80">
              <Badge tone="amber">
                در راه به {whName.get(t.toWarehouseId)}: {faNum(t.qty)} (حواله‌ی {faNum(t.number)})
              </Badge>
            </Link>
          ))}
        </Card>
      )}

      <div className="space-y-2">
        {data.warehouses.length > 1 && (
          <Chips value={wh} onChange={setWh} options={[{ value: "", label: "همه‌ی انبارها" }, ...data.warehouses.map((w) => ({ value: w.id, label: w.name }))]} />
        )}
        <RangeBar value={range} onChange={setRange} />
      </div>

      <Card className="overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2.5 bg-gray-50 dark:bg-white/5 text-xs">
          <span className="text-gray-500">موجودی از قبل</span>
          <b className="tabular-nums">{faNum(data.opening)}</b>
        </div>
        {!data.rows.length && <Empty title="در این بازه ورود و خروجی نیست" />}
        <div className="divide-y divide-gray-100 dark:divide-white/5">
          {data.rows.map((r) => {
            const href = sourceHref(r.sourceType, r.sourceId);
            const inbound = r.qty > 0;
            return (
              <div key={r.id} className="grid grid-cols-[1fr_auto] md:grid-cols-[110px_1.3fr_1fr_80px_80px_1fr] gap-2 items-center px-4 py-3 text-sm">
                <span className="hidden md:block text-xs text-gray-500">{formatJalali(new Date(r.date))}</span>
                <span className="min-w-0">
                  {href ? (
                    <Link href={href} className="font-bold hover:text-blue-600">
                      {moveLabel(r)}
                    </Link>
                  ) : (
                    <span className="font-bold">{moveLabel(r)}</span>
                  )}
                  <span className="block text-[11px] text-gray-400">
                    <span className="md:hidden">{formatJalali(new Date(r.date))} · </span>
                    {whName.get(r.warehouseId)}
                  </span>
                </span>
                <span className="hidden md:block text-xs text-gray-500 tabular-nums">
                  {data.can.cost && r.unitCost && BigInt(r.unitCost) > 0n ? `بها ${formatAmount(r.unitCost)}` : ""}
                </span>
                <span dir="ltr" className={`hidden md:block text-right tabular-nums font-bold ${inbound ? "text-emerald-600" : ""}`}>{inbound ? `+${faNum(r.qty)}` : ""}</span>
                <span dir="ltr" className="hidden md:block text-right tabular-nums font-bold text-red-600">{!inbound ? `−${faNum(-r.qty)}` : ""}</span>
                <span className="text-left">
                  <span dir="ltr" className={`md:hidden block text-right font-black tabular-nums ${inbound ? "text-emerald-600" : "text-red-600"}`}>
                    {inbound ? "+" : "−"}
                    {faNum(Math.abs(r.qty))}
                  </span>
                  <span className="block text-xs tabular-nums text-gray-500 md:text-sm md:font-bold md:text-inherit">مانده {faNum(r.running)}</span>
                  {data.can.cost && r.balanceValue !== undefined && !wh && (
                    <span className="hidden md:block text-[10px] text-gray-400 tabular-nums">ارزش {formatAmount(r.balanceValue)}</span>
                  )}
                </span>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
