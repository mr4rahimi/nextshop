"use client";

/**
 * فهرست سفارش‌های خرید — docs/plans/webhesab-parity.md بخش ۱۳.
 * `?productId=` سفارش‌های یک کالا (از کاردکس)، `?partyId=` یک عرضه‌کننده، `?state=`.
 */

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Plus } from "lucide-react";
import { formatJalali } from "@/lib/club/jalali";
import { faNum } from "@/lib/accounting/money";
import { api, Badge, btn, Card, Chips, Empty, ErrorText, inputCls, Money, PageHeader } from "../ui";

export type PoState = "OPEN" | "PARTIAL" | "RECEIVED" | "CLOSED" | "CANCELED";
export const PO_STATE: Record<PoState, { label: string; tone: "blue" | "amber" | "green" | "gray" | "red" }> = {
  OPEN: { label: "باز", tone: "blue" },
  PARTIAL: { label: "دریافت ناقص", tone: "amber" },
  RECEIVED: { label: "کامل دریافت شد", tone: "green" },
  CLOSED: { label: "بسته", tone: "gray" },
  CANCELED: { label: "باطل", tone: "red" },
};

interface Row {
  id: string;
  number: number;
  date: string;
  dueDate: string | null;
  party: { id: string; name: string };
  supplierRef: string | null;
  state: PoState;
  overdue: boolean;
  lineCount: number;
  ordered: number;
  received: number;
  hasDraft: boolean;
  total: string | null;
  product: { qty: number; received: number } | null;
}
type State = "open" | "overdue" | "done" | "all";

export default function PurchaseOrdersList() {
  const sp = useSearchParams();
  const router = useRouter();
  const productId = sp.get("productId");
  const partyId = sp.get("partyId");
  const [state, setState] = useState<State>(() => (["overdue", "done", "all"].includes(sp.get("state") ?? "") ? (sp.get("state") as State) : productId ? "all" : "open"));
  const [q, setQ] = useState("");
  const [data, setData] = useState<{ items: Row[]; product: { id: string; title: string; code: string } | null; can: { write: boolean; price: boolean } } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    const p = new URLSearchParams({ state });
    if (q.trim()) p.set("q", q.trim());
    if (productId) p.set("productId", productId);
    if (partyId) p.set("partyId", partyId);
    api<NonNullable<typeof data>>(`/api/admin/accounting/purchase-orders?${p}`)
      .then((d) => {
        setData(d);
        setError(null);
      })
      .catch((e) => setError(e.message));
  }, [state, q, productId, partyId]);
  useEffect(() => {
    const h = setTimeout(load, q ? 250 : 0);
    return () => clearTimeout(h);
  }, [load, q]);

  return (
    <div className="space-y-4">
      <PageHeader
        title="سفارش خرید"
        help="accountingPurchaseOrders"
        back={{ href: "/admin/accounting/purchases", label: "خرید" }}
        desc="چه چیزی از چه کسی سفارش داده‌اید و چقدرش رسیده. کالا که رسید «فاکتور خرید از روی سفارش» بزنید."
        actions={
          data?.can.write && (
            <Link href="/admin/accounting/purchases/orders/new" className={btn.primary}>
              <Plus className="h-4 w-4" aria-hidden />
              سفارش تازه
            </Link>
          )
        }
      />
      {data?.product && (
        <Card className="flex items-center gap-2 p-3 text-sm">
          <span className="flex-1">
            سفارش‌های کالای <b>{data.product.title}</b> <span className="text-xs text-gray-400" dir="ltr">{data.product.code}</span>
          </span>
          <button onClick={() => router.replace("/admin/accounting/purchases/orders")} className={btn.small}>
            همه‌ی کالاها
          </button>
        </Card>
      )}
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="شماره، عرضه‌کننده یا کد پیگیری" className={inputCls} />
      <Chips<State>
        value={state}
        onChange={setState}
        options={[
          { value: "open", label: "باز" },
          { value: "overdue", label: "موعد گذشته" },
          { value: "done", label: "تمام‌شده" },
          { value: "all", label: "همه" },
        ]}
      />
      <ErrorText>{error}</ErrorText>
      <Card className="overflow-hidden divide-y divide-gray-100 dark:divide-white/5">
        {data?.items.map((r) => {
          const qty = r.product ?? { qty: r.ordered, received: r.received };
          return (
            <Link key={r.id} href={`/admin/accounting/purchases/orders/${r.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-white/5">
              <span className="w-12 shrink-0 text-center text-sm font-black tabular-nums text-gray-500">{faNum(r.number)}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-bold">{r.party.name}</span>
                <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-gray-400">
                  <span>{formatJalali(new Date(r.date))}</span>
                  {r.dueDate && <span className={r.overdue ? "font-bold text-red-600" : ""}>موعد {formatJalali(new Date(r.dueDate))}</span>}
                  <span>{faNum(r.lineCount)} قلم</span>
                  {r.supplierRef && <span dir="ltr">{r.supplierRef}</span>}
                  {r.hasDraft && <span className="text-amber-600">پیش‌نویس فاکتور دارد</span>}
                </span>
              </span>
              <span className="shrink-0 text-left">
                <span className="block text-sm font-black tabular-nums">
                  {faNum(qty.received)} / {faNum(qty.qty)}
                </span>
                <Badge tone={r.overdue ? "red" : PO_STATE[r.state].tone}>{r.overdue ? "موعد گذشته" : PO_STATE[r.state].label}</Badge>
                {data.can.price && r.total && r.total !== "0" && <Money value={r.total} className="block text-[11px] text-gray-400" />}
              </span>
            </Link>
          );
        })}
        {data && !data.items.length && (
          <Empty
            title={state === "open" ? "سفارش باز ندارید" : "سفارشی با این شرایط نیست"}
            desc={state === "open" && data.can.write ? "با «سفارش تازه» شروع کنید؛ «پیشنهاد خرید» کالاهای رو به اتمام را خودش می‌آورد." : undefined}
          />
        )}
      </Card>
    </div>
  );
}
