"use client";

/**
 * موجودی کالا — docs/plans/accounting.md بخش ۸.
 * بها و ارزش فقط برای کسی که «دیدن بهای تمام‌شده» دارد (سرور نمی‌فرستد).
 */

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CalendarDays, ListChecks, Plus } from "lucide-react";
import JalaliDatePicker from "@/components/admin/JalaliDatePicker";
import { faNum } from "@/lib/accounting/money";
import { formatJalali } from "@/lib/club/jalali";
import InventoryTabs from "./InventoryTabs";
import ItemForm, { useItemGroups } from "./ItemForm";
import ItemStatusSheet from "./ItemStatusSheet";
import { api, Badge, btn, Card, Chips, Empty, ErrorText, inputCls, Money, PageHeader, Stat } from "../ui";

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
  sku: string;
  image: string | null;
  hasProduct: boolean;
  link: { productId: string; product: string; variant: string | null } | null;
  sellOnline: boolean;
  isActive: boolean;
  createdAt: string;
  siteStock: number | null;
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
  more: boolean;
  can: { cost: boolean; manage: boolean };
}

type Filter = "instock" | "all" | "low" | "negative" | "noproduct" | "inactive";
const PAGE = 100;

export default function InventoryClient() {
  const [q, setQ] = useState("");
  const sp = useSearchParams();
  // `?filter=negative|low` از «کارهای مانده»ی خانه‌ی حسابداری
  const [filter, setFilter] = useState<Filter>(() => (["all", "low", "negative", "noproduct", "inactive"].includes(sp.get("filter") ?? "") ? (sp.get("filter") as Filter) : "instock"));
  const [creating, setCreating] = useState(false);
  const [groupId, setGroupId] = useState("");
  const groups = useItemGroups();
  const router = useRouter();
  const [wh, setWh] = useState("");
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  // تاریخ تعریف (webhesab-parity.md بخش ۱۲) — `?from=` از جای دیگر هم می‌آید
  const [dates, setDates] = useState(() => !!(sp.get("from") || sp.get("to")));
  const [from, setFrom] = useState(sp.get("from") ?? "");
  const [to, setTo] = useState(sp.get("to") ?? "");
  const [take, setTake] = useState(PAGE);
  const [picked, setPicked] = useState<Set<string> | null>(null);
  const [status, setStatus] = useState<string[] | null | undefined>(undefined);

  useEffect(() => setTake(PAGE), [q, filter, wh, groupId, from, to]);

  const load = useCallback(() => {
    const p = new URLSearchParams({ filter, take: String(take) });
    if (q.trim()) p.set("q", q.trim());
    if (wh) p.set("warehouseId", wh);
    if (groupId) p.set("groupId", groupId);
    if (dates && from) p.set("from", from);
    if (dates && to) p.set("to", to);
    api<Data>(`/api/admin/accounting/inventory?${p}`)
      .then((d) => {
        setData(d);
        setError(null);
      })
      .catch((e) => setError(e.message));
  }, [q, filter, wh, groupId, dates, from, to, take]);
  useEffect(() => {
    const h = setTimeout(load, q ? 250 : 0);
    return () => clearTimeout(h);
  }, [load, q]);

  const active = data?.warehouses.filter((w) => w.isActive) ?? [];
  const multi = active.length > 1;
  const toggle = (id: string) =>
    setPicked((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const allPicked = !!data?.items.length && data.items.every((i) => picked?.has(i.id));

  return (
    <div className="space-y-4">
      <PageHeader
        title="کالا و انبار"
        help="accountingInventory"
        desc="موجودی هر کالا در هر انبار، با کاردکس کامل ورود و خروج."
        actions={
          data?.can.manage && (
            <>
              <button onClick={() => setPicked(picked ? null : new Set())} className={btn.soft} aria-pressed={!!picked}>
                <ListChecks className="h-4 w-4" aria-hidden />
                {picked ? "پایان انتخاب" : "انتخاب"}
              </button>
              <button onClick={() => setCreating(true)} className={btn.primary}>
                <Plus className="h-4 w-4" aria-hidden />
                کالای تازه
              </button>
            </>
          )
        }
      />
      {status !== undefined && (
        <ItemStatusSheet
          ids={status}
          onClose={() => setStatus(undefined)}
          onDone={() => {
            setPicked((s) => (s ? new Set() : s));
            load();
          }}
        />
      )}
      {creating && <ItemForm itemId={null} onClose={() => setCreating(false)} onSaved={(id) => router.push(`/admin/accounting/inventory/${id}`)} />}
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
            { value: "noproduct", label: "بی‌محصول در سایت" },
            { value: "inactive", label: "غیرفعال" },
          ]}
        />
        {groups.length > 0 && (
          <select value={groupId} onChange={(e) => setGroupId(e.target.value)} className={`${inputCls} !w-auto !py-1.5 text-xs`} aria-label="گروه کالا">
            <option value="">همه‌ی گروه‌ها</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.path}
              </option>
            ))}
          </select>
        )}
        {multi && (
          <Chips
            value={wh}
            onChange={setWh}
            options={[{ value: "", label: "همه‌ی انبارها" }, ...active.map((w) => ({ value: w.id, label: w.name }))]}
          />
        )}
        <button onClick={() => setDates(!dates)} className={`${btn.small} ${dates ? "!bg-blue-50 !text-blue-700 dark:!bg-blue-500/15 dark:!text-blue-300" : ""}`} aria-pressed={dates}>
          <CalendarDays className="h-3.5 w-3.5" aria-hidden />
          تاریخ تعریف
        </button>
      </div>
      {dates && (
        <div className="grid grid-cols-2 gap-2 sm:max-w-md">
          <JalaliDatePicker value={from} onChange={(v: string) => setFrom(v)} placeholder="از تاریخ" />
          <JalaliDatePicker value={to} onChange={(v: string) => setTo(v)} placeholder="تا تاریخ" />
        </div>
      )}
      <ErrorText>{error}</ErrorText>

      <Card className="overflow-hidden divide-y divide-gray-100 dark:divide-white/5">
        {data?.items.map((i) => {
          const qty = wh ? i.byWarehouse[wh] ?? 0 : i.qty;
          const low = qty <= i.lowStockThreshold;
          const body = (
            <>
              {picked && <input type="checkbox" checked={picked.has(i.id)} onChange={() => toggle(i.id)} className="h-4 w-4 shrink-0" aria-label={`انتخاب ${i.title}`} />}
              {i.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={i.image} alt="" className="w-11 h-11 rounded-xl object-cover bg-gray-100 shrink-0" />
              ) : (
                <span className="w-11 h-11 rounded-xl bg-gray-100 dark:bg-white/10 shrink-0" />
              )}
              <span className="flex-1 min-w-0">
                <span className="block text-sm font-bold truncate">{i.title}</span>
                <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-gray-400 mt-0.5">
                  <span>
                    کد <span dir="ltr">{faNum(i.sku)}</span>
                  </span>
                  {!i.isActive && <Badge>غیرفعال</Badge>}
                  {dates && <span>تعریف {formatJalali(new Date(i.createdAt))}</span>}
                  {i.link?.variant && <span className="text-emerald-600">تنوع «{i.link.variant}» در {i.link.product}</span>}
                  {!i.hasProduct && (i.sellOnline ? <span className="text-amber-600">بی‌محصول</span> : <span>فروش آنلاین ندارد</span>)}
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
            </>
          );
          const row = "flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-white/5";
          return picked ? (
            <label key={i.id} className={`${row} cursor-pointer`}>
              {body}
            </label>
          ) : (
            <Link key={i.id} href={`/admin/accounting/inventory/${i.id}`} className={row}>
              {body}
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
      {data?.more && (
        <button onClick={() => setTake((t) => t + PAGE * 2)} className={`${btn.soft} w-full`}>
          نمایش بیشتر
        </button>
      )}

      {picked && (
        <div className="sticky bottom-3 z-10 flex flex-wrap items-center gap-2 rounded-2xl border border-[var(--adm-border)] bg-white/95 p-3 shadow-lg backdrop-blur dark:bg-[#111620]/95">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={allPicked}
              onChange={() => setPicked(allPicked ? new Set() : new Set(data?.items.map((i) => i.id)))}
              className="h-4 w-4"
            />
            همه‌ی این فهرست ({faNum(data?.items.length ?? 0)})
          </label>
          <span className="flex-1 text-sm font-bold">{faNum(picked.size)} انتخاب‌شده</span>
          <button onClick={() => setStatus(null)} className={btn.small}>
            با فهرست کد
          </button>
          <button onClick={() => setStatus([...picked])} disabled={!picked.size} className={`${btn.small} !bg-gray-900 !text-white dark:!bg-white dark:!text-gray-900`}>
            فعال / غیرفعال / حذف…
          </button>
        </div>
      )}
    </div>
  );
}
