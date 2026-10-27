"use client";

/** سند ورود/خروج دستی کالا — ردیف‌ها (← کاردکس)، سند حسابداری و ابطال (webhesab-parity.md بخش ۷) */

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { formatJalali } from "@/lib/club/jalali";
import { faNum } from "@/lib/accounting/money";
import { api, Badge, btn, Card, ErrorText, PageHeader } from "../ui";
import { Amt } from "../reports/kit";

interface Data {
  doc: {
    id: string;
    number: number;
    date: string;
    direction: "IN" | "OUT";
    status: "POSTED" | "VOID";
    note: string | null;
    voucherId: string | null;
    voidReason: string | null;
    createdByName: string;
    createdAt: string;
    reason: { name: string };
  };
  lines: { id: string; productId: string; qty: number; note: string | null; item: { title: string; code: string; unit: string } | null; cost: string | null }[];
  warehouse: { id: string; name: string } | null;
  party: { id: string; name: string } | null;
  account: { code: string; name: string } | null;
  /** کسری دریافت این حواله — ابطال از خود حواله (webhesab-parity.md بخش ۸) */
  transfer: { id: string; number: number } | null;
  can: { manage: boolean; costs: boolean };
}

export default function AdjustmentDetail({ id }: { id: string }) {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => {
    api<Data>(`/api/admin/accounting/inventory/adjustments/${id}`)
      .then(setData)
      .catch((e) => setError(e.message));
  }, [id]);
  useEffect(load, [load]);

  async function voidIt() {
    const reason = window.prompt(data?.doc.direction === "OUT" ? "دلیل ابطال؟ کالاها به انبار برمی‌گردند." : "دلیل ابطال؟ کالاها از انبار کم می‌شوند.");
    if (!reason) return;
    setBusy(true);
    setError(null);
    try {
      await api(`/api/admin/accounting/inventory/adjustments/${id}`, { method: "POST", json: { action: "void", reason } });
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "باطل نشد");
    } finally {
      setBusy(false);
    }
  }

  if (!data) return error ? <ErrorText>{error}</ErrorText> : <p className="text-xs text-gray-400">در حال بارگذاری…</p>;
  const { doc } = data;
  const label = doc.direction === "IN" ? "ورود کالا" : "خروج کالا";
  const total = data.can.costs ? data.lines.reduce((s, l) => s + BigInt(l.cost ?? "0"), 0n) : null;

  return (
    <div className="space-y-4">
      <PageHeader
        title={`${label} ${faNum(doc.number)} — ${doc.reason.name}`}
        help="accountingAdjustments"
        desc={`${formatJalali(new Date(doc.date))} · ${data.warehouse?.name ?? ""} · ${doc.createdByName}`}
        back={{ href: "/admin/accounting/inventory/adjustments", label: "ورود و خروج" }}
      />
      <Card className="p-4 flex flex-wrap items-center gap-2 text-sm">
        <Badge tone={doc.direction === "IN" ? "green" : "amber"}>{label}</Badge>
        {doc.status === "VOID" ? <Badge tone="red">باطل</Badge> : <Badge tone="green">ثبت شد</Badge>}
        {data.account && (
          <span className="text-xs text-gray-500">
            سرفصل: {faNum(data.account.code)} {data.account.name}
          </span>
        )}
        {data.party && (
          <Link href={`/admin/accounting/parties/${data.party.id}`} className="text-xs font-bold text-blue-600">
            {data.party.name} ←
          </Link>
        )}
        {doc.voucherId && (
          <Link href={`/admin/accounting/vouchers/${doc.voucherId}`} className="text-xs font-bold text-blue-600">
            دیدن سند حسابداری ←
          </Link>
        )}
        {doc.note && <span className="w-full text-xs text-gray-600 dark:text-gray-300">{doc.note}</span>}
        {data.transfer && (
          <Link href={`/admin/accounting/inventory/transfers?id=${data.transfer.id}`} className="w-full text-xs font-bold text-amber-600">
            کسری دریافت حواله‌ی {faNum(data.transfer.number)} — ابطال فقط از خود حواله ←
          </Link>
        )}
        {doc.voidReason && <span className="w-full text-xs text-red-600">باطل: {doc.voidReason}</span>}
      </Card>

      <Card className="overflow-hidden divide-y divide-gray-100 dark:divide-white/5">
        {data.lines.map((l) => (
          <div key={l.id} className="flex items-center gap-3 px-4 py-2.5">
            <span className="flex-1 min-w-0">
              <Link href={`/admin/accounting/inventory/${l.productId}`} className="block truncate text-sm font-bold text-blue-700 dark:text-blue-300 hover:underline" title="کاردکس کالا">
                {l.item?.title ?? "کالای حذف‌شده"}
              </Link>
              <span className="block text-[11px] text-gray-400">
                {l.item?.code}
                {l.note ? ` · ${l.note}` : ""}
              </span>
            </span>
            <span className="text-base font-black tabular-nums">
              {faNum(l.qty)} <span className="text-[11px] font-normal text-gray-400">{l.item?.unit}</span>
            </span>
            {data.can.costs && (
              <span className="w-28 text-left text-xs">
                <Amt v={l.cost} />
              </span>
            )}
          </div>
        ))}
        <div className="flex items-center justify-between px-4 py-2.5 bg-gray-50 dark:bg-white/5 text-sm font-black">
          <span>جمع</span>
          <span className="flex gap-6">
            <span className="tabular-nums">{faNum(data.lines.reduce((s, l) => s + l.qty, 0))}</span>
            {total !== null && <Amt v={total.toString()} strong />}
          </span>
        </div>
      </Card>

      <ErrorText>{error}</ErrorText>
      {data.can.manage && doc.status === "POSTED" && !data.transfer && (
        <button onClick={voidIt} disabled={busy} className={btn.danger}>
          ابطال
        </button>
      )}
    </div>
  );
}
