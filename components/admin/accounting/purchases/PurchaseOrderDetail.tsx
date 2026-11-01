"use client";

/**
 * یک سفارش خرید — docs/plans/webhesab-parity.md بخش ۱۳.
 * «فاکتور خرید از روی سفارش» پیش‌نویس فاکتوری با مانده‌ی هر کالا می‌سازد و فرمش را باز می‌کند.
 */

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, Pencil, Printer } from "lucide-react";
import { formatJalali } from "@/lib/club/jalali";
import { faNum } from "@/lib/accounting/money";
import { api, Badge, btn, Card, ErrorText, Money, PageHeader, SectionTitle } from "../ui";
import { PO_STATE, type PoState } from "./PurchaseOrdersList";

export interface PoLine {
  id: string;
  productId: string;
  title: string;
  code: string;
  unit: string | null;
  image: string | null;
  qty: number;
  unitPrice: string | null;
  note: string | null;
  received: number;
  draft: number;
}
export interface PoData {
  order: {
    id: string;
    number: number;
    date: string;
    dueDate: string | null;
    status: string;
    supplierRef: string | null;
    note: string | null;
    closedReason: string | null;
    createdByName: string;
    party: { id: string; code: number; name: string; mobile: string | null; phone: string | null; address: string | null; city: string | null };
    lines: PoLine[];
  };
  state: PoState;
  overdue: boolean;
  total: string | null;
  invoices: { id: string; number: number | null; date: string; status: "DRAFT" | "ISSUED" | "VOID"; total: string | null }[];
  warehouse: { id: string; name: string } | null;
  can: { write: boolean; price: boolean };
}

export default function PurchaseOrderDetail({ id }: { id: string }) {
  const router = useRouter();
  const [d, setD] = useState<PoData | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showInv, setShowInv] = useState(false);

  const load = useCallback(() => {
    api<PoData>(`/api/admin/accounting/purchase-orders/${id}`)
      .then(setD)
      .catch((e) => setError(e.message));
  }, [id]);
  useEffect(load, [load]);

  async function act(action: "invoice" | "close" | "cancel" | "reopen") {
    let reason: string | null = null;
    if (action === "close") {
      reason = window.prompt("بستن سفارش: مانده دیگر انتظار نمی‌رود. دلیل (اختیاری):", "");
      if (reason === null) return;
    }
    if (action === "cancel" && !window.confirm("سفارش باطل شود؟")) return;
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ id?: string }>(`/api/admin/accounting/purchase-orders/${id}`, { method: "POST", json: { action, reason } });
      if (action === "invoice" && r.id) return router.push(`/admin/accounting/invoices/${r.id}/edit`);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "انجام نشد");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!window.confirm("سفارش برای همیشه پاک شود؟")) return;
    try {
      await api(`/api/admin/accounting/purchase-orders/${id}`, { method: "DELETE" });
      router.push("/admin/accounting/purchases/orders");
    } catch (e) {
      setError(e instanceof Error ? e.message : "پاک نشد");
    }
  }

  if (!d) return error ? <ErrorText>{error}</ErrorText> : <p className="text-sm text-gray-400">در حال بارگذاری…</p>;
  const o = d.order;
  const open = o.status === "OPEN";
  const left = o.lines.reduce((s, l) => s + Math.max(l.qty - l.received, 0), 0);
  const draft = d.invoices.find((i) => i.status === "DRAFT");
  const st = PO_STATE[d.state];

  return (
    <div className="space-y-4">
      <PageHeader
        title={`سفارش خرید ${faNum(o.number)}`}
        help="accountingPurchaseOrders"
        back={{ href: "/admin/accounting/purchases/orders", label: "سفارش خرید" }}
        actions={
          <>
            {d.can.write && open && left > 0 && (
              <button onClick={() => act("invoice")} disabled={busy} className={btn.primary}>
                <FileText className="h-4 w-4" aria-hidden />
                {draft ? "ادامه‌ی پیش‌نویس فاکتور" : "فاکتور خرید از روی سفارش"}
              </button>
            )}
            <Link href={`/admin/accounting/purchases/orders/${id}/print`} className={btn.soft}>
              <Printer className="h-4 w-4" aria-hidden />
              چاپ
            </Link>
            {d.can.write && open && (
              <Link href={`/admin/accounting/purchases/orders/${id}/edit`} className={btn.soft}>
                <Pencil className="h-4 w-4" aria-hidden />
                ویرایش
              </Link>
            )}
          </>
        }
      />

      <Card className="grid gap-3 p-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <p className="text-[11px] text-gray-400">عرضه‌کننده</p>
          <Link href={`/admin/accounting/parties/${o.party.id}`} className="font-bold text-blue-600">
            {o.party.name}
          </Link>
        </div>
        <div>
          <p className="text-[11px] text-gray-400">وضعیت</p>
          <Badge tone={d.overdue ? "red" : st.tone}>{d.overdue ? `موعد گذشته · ${st.label}` : st.label}</Badge>
          {o.closedReason && <p className="mt-1 text-[11px] text-gray-500">{o.closedReason}</p>}
        </div>
        <div>
          <p className="text-[11px] text-gray-400">تاریخ / موعد تحویل</p>
          <p className="font-bold">
            {formatJalali(new Date(o.date))}
            {o.dueDate && <span className={d.overdue ? "text-red-600" : "text-gray-500"}> ← {formatJalali(new Date(o.dueDate))}</span>}
          </p>
        </div>
        <div>
          <p className="text-[11px] text-gray-400">انبار · ثبت</p>
          <p>
            {d.warehouse?.name ?? "انبار پیش‌فرض"} · {o.createdByName}
          </p>
        </div>
        {(o.supplierRef || o.note) && (
          <p className="text-xs text-gray-500 sm:col-span-2 lg:col-span-4">
            {o.supplierRef && (
              <>
                کد پیگیری عرضه‌کننده: <span dir="ltr">{o.supplierRef}</span>
                {o.note && " — "}
              </>
            )}
            {o.note}
          </p>
        )}
      </Card>

      <Card className="overflow-hidden">
        <div className="px-4 pt-4">
          <SectionTitle title={`کالاها — ${faNum(o.lines.reduce((s, l) => s + Math.min(l.received, l.qty), 0))} از ${faNum(o.lines.reduce((s, l) => s + l.qty, 0))} رسیده`} />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[40rem] text-sm">
            <thead className="text-[11px] text-gray-400">
              <tr className="border-b border-gray-100 dark:border-white/5">
                <th className="px-4 py-2 text-right font-normal">کالا</th>
                <th className="px-2 py-2 font-normal">سفارش</th>
                <th className="px-2 py-2 font-normal">رسیده</th>
                <th className="px-2 py-2 font-normal">مانده</th>
                {d.can.price && <th className="px-2 py-2 font-normal">فی</th>}
                {d.can.price && <th className="px-4 py-2 text-left font-normal">جمع</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-white/5">
              {o.lines.map((l) => {
                const rest = l.qty - l.received;
                return (
                  <tr key={l.id}>
                    <td className="px-4 py-2">
                      <Link href={`/admin/accounting/inventory/${l.productId}`} className="font-bold hover:text-blue-600">
                        {l.title}
                      </Link>
                      <span className="block text-[11px] text-gray-400" dir="ltr">
                        {l.code}
                      </span>
                    </td>
                    <td className="px-2 py-2 text-center tabular-nums">{faNum(l.qty)}</td>
                    <td className="px-2 py-2 text-center tabular-nums">
                      <button onClick={() => setShowInv(true)} className={l.received ? "font-bold text-emerald-600" : "text-gray-400"}>
                        {faNum(l.received)}
                      </button>
                      {l.draft > 0 && <span className="block text-[10px] text-amber-600">پیش‌نویس {faNum(l.draft)}</span>}
                    </td>
                    <td className={`px-2 py-2 text-center font-bold tabular-nums ${rest > 0 && open ? "text-amber-600" : "text-gray-400"}`}>{faNum(Math.max(rest, 0))}</td>
                    {d.can.price && <td className="px-2 py-2 text-center">{l.unitPrice && l.unitPrice !== "0" ? <Money value={l.unitPrice} /> : "—"}</td>}
                    {d.can.price && (
                      <td className="px-4 py-2 text-left">{l.unitPrice && l.unitPrice !== "0" ? <Money value={(BigInt(l.unitPrice) * BigInt(l.qty)).toString()} /> : "—"}</td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {d.can.price && d.total && d.total !== "0" && (
          <p className="border-t border-gray-100 px-4 py-3 text-left text-sm font-black dark:border-white/5">
            جمع سفارش <Money value={d.total} />
          </p>
        )}
      </Card>

      <Card className="p-4" >
        <button onClick={() => setShowInv((x) => !x)} className="w-full text-right">
          <SectionTitle title={`فاکتورهای خرید این سفارش (${faNum(d.invoices.length)})`} />
        </button>
        {(showInv || d.invoices.length <= 5) && (
          <div className="mt-2 divide-y divide-gray-100 dark:divide-white/5">
            {d.invoices.map((i) => (
              <Link key={i.id} href={`/admin/accounting/invoices/${i.id}`} className="flex items-center gap-2 py-2 text-sm hover:text-blue-600">
                <span className="flex-1 font-bold">فاکتور خرید {i.number ? faNum(i.number) : ""}</span>
                <span className="text-xs text-gray-400">{formatJalali(new Date(i.date))}</span>
                {i.status === "DRAFT" && <Badge tone="amber">پیش‌نویس</Badge>}
                {i.status === "VOID" && <Badge tone="red">باطل</Badge>}
                {i.total && <Money value={i.total} />}
              </Link>
            ))}
            {!d.invoices.length && <p className="py-2 text-xs text-gray-400">هنوز کالایی از این سفارش نرسیده.</p>}
          </div>
        )}
      </Card>

      <ErrorText>{error}</ErrorText>
      {d.can.write && (
        <div className="flex flex-wrap gap-2">
          {open && d.state !== "OPEN" && (
            <button onClick={() => act("close")} disabled={busy} className={btn.soft}>
              بستن سفارش (بقیه نمی‌آید)
            </button>
          )}
          {open && d.state === "OPEN" && (
            <button onClick={() => act("cancel")} disabled={busy} className={btn.soft}>
              باطل کردن سفارش
            </button>
          )}
          {!open && (
            <button onClick={() => act("reopen")} disabled={busy} className={btn.soft}>
              بازگشایی
            </button>
          )}
          {!d.invoices.length && (
            <button onClick={remove} disabled={busy} className={btn.danger}>
              حذف
            </button>
          )}
        </div>
      )}
    </div>
  );
}
