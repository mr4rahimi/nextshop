"use client";

/**
 * موجودی کالا — docs/plans/accounting.md بخش ۸.
 * بها و ارزش فقط برای کسی که «دیدن بهای تمام‌شده» دارد (سرور نمی‌فرستد).
 */

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { faNum } from "@/lib/accounting/money";
import InventoryTabs from "./InventoryTabs";
import { api, Badge, Card, Chips, Empty, ErrorText, inputCls, Money, PageHeader, Stat } from "../ui";

interface Warehouse {
  id: string;
  name: string;
  sellable: boolean;
  isDefault: boolean;
  isActive: boolean;
}
interface Item {
  id: string;
  title: string;
  sku: string | null;
  image: string | null;
  siteStock: number;
  lowStockThreshold: number;
  qty: number;
  byWarehouse: Record<string, number>;
  avgCost?: string;
  value?: string;
}
interface Data {
  items: Item[];
  warehouses: Warehouse[];
  summary: { value: string | null; products: number; negative: number };
  can: { cost: boolean; manage: boolean };
}

type Filter = "instock" | "all" | "low" | "negative";

export default function InventoryClient() {
  const [q, setQ] = useState("");
  const sp = useSearchParams();
  // `?filter=negative|low` از «کارهای مانده»ی خانه‌ی حسابداری
  const [filter, setFilter] = useState<Filter>(() => (["all", "low", "negative"].includes(sp.get("filter") ?? "") ? (sp.get("filter") as Filter) : "instock"));
  const [wh, setWh] = useState("");
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    const p = new URLSearchParams({ filter });
    if (q.trim()) p.set("q", q.trim());
    if (wh) p.set("warehouseId", wh);
    api<Data>(`/api/admin/accounting/inventory?${p}`)
      .then((d) => {
        setData(d);
        setError(null);
      })
      .catch((e) => setError(e.message));
  }, [q, filter, wh]);
  useEffect(() => {
    const h = setTimeout(load, q ? 250 : 0);
    return () => clearTimeout(h);
  }, [load, q]);

  const active = data?.warehouses.filter((w) => w.isActive) ?? [];
  const multi = active.length > 1;

  return (
    <div className="space-y-4">
      <PageHeader title="کالا و انبار" help="accountingInventory" desc="موجودی هر کالا در هر انبار، با کاردکس کامل ورود و خروج." />
      <InventoryTabs />

      {data && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {data.can.cost && <Stat label="ارزش موجودی" value={<Money value={data.summary.value ?? "0"} />} />}
          <Stat label="کالای دارای موجودی" value={faNum(data.summary.products)} />
          <Stat label="موجودی منفی" value={faNum(data.summary.negative)} tone={data.summary.negative ? "red" : "gray"} sub="فروش بیش از موجودی ثبت‌شده" />
        </div>
      )}

      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="نام کالا، کد کالا یا بارکد" className={inputCls} />
      <div className="flex flex-wrap gap-2">
        <Chips<Filter>
          value={filter}
          onChange={setFilter}
          options={[
            { value: "instock", label: "دارای موجودی" },
            { value: "low", label: "رو به اتمام" },
            { value: "negative", label: "منفی" },
            { value: "all", label: "همه‌ی کالاها" },
          ]}
        />
        {multi && (
          <Chips
            value={wh}
            onChange={setWh}
            options={[{ value: "", label: "همه‌ی انبارها" }, ...active.map((w) => ({ value: w.id, label: w.name }))]}
          />
        )}
      </div>
      <ErrorText>{error}</ErrorText>

      <Card className="overflow-hidden divide-y divide-gray-100 dark:divide-white/5">
        {data?.items.map((i) => {
          const qty = wh ? i.byWarehouse[wh] ?? 0 : i.qty;
          const low = qty <= i.lowStockThreshold;
          return (
            <Link key={i.id} href={`/admin/accounting/inventory/${i.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-white/5">
              {i.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={i.image} alt="" className="w-11 h-11 rounded-xl object-cover bg-gray-100 shrink-0" />
              ) : (
                <span className="w-11 h-11 rounded-xl bg-gray-100 dark:bg-white/10 shrink-0" />
              )}
              <span className="flex-1 min-w-0">
                <span className="block text-sm font-bold truncate">{i.title}</span>
                <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-gray-400 mt-0.5">
                  {i.sku && <span>کد {faNum(i.sku)}</span>}
                  {multi &&
                    !wh &&
                    active
                      .filter((w) => i.byWarehouse[w.id])
                      .map((w) => (
                        <span key={w.id}>
                          {w.name}: {faNum(i.byWarehouse[w.id])}
                        </span>
                      ))}
                  {data.can.cost && i.avgCost && BigInt(i.avgCost) > 0n && (
                    <span>
                      میانگین بها <Money value={i.avgCost} className="text-[11px]" />
                    </span>
                  )}
                </span>
              </span>
              <span className="text-left shrink-0">
                <span className={`block text-lg font-black tabular-nums ${qty < 0 ? "text-red-600" : low ? "text-amber-600" : ""}`}>{faNum(qty)}</span>
                {qty < 0 ? <Badge tone="red">منفی</Badge> : low && qty >= 0 ? <Badge tone="amber">رو به اتمام</Badge> : null}
              </span>
            </Link>
          );
        })}
        {data && !data.items.length && (
          <Empty
            title={filter === "instock" && !q ? "هنوز موجودی‌ای در انبار ثبت نشده" : "کالایی با این شرایط نیست"}
            desc={filter === "instock" && !q ? "موجودی شروع را از زبانه‌ی «اول دوره» وارد کنید؛ از آن به بعد خرید و فروش و حواله خودشان موجودی را به‌روز می‌کنند." : undefined}
            action={
              filter === "instock" && !q && data.can.manage ? (
                <Link href="/admin/accounting/inventory/opening" className="text-sm font-bold text-blue-600">
                  ورود موجودی اول دوره ←
                </Link>
              ) : undefined
            }
          />
        )}
      </Card>
    </div>
  );
}
