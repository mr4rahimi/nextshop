"use client";

/** فهرست دریافت‌ها، پرداخت‌ها و انتقال‌ها — docs/plans/accounting.md بخش ۹.۱ */

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { formatJalali } from "@/lib/club/jalali";
import { faNum } from "@/lib/accounting/money";
import { RangeBar, rangeFor, rangeQuery, type Range } from "../Statement";
import { api, Badge, btn, Card, Chips, Empty, ErrorText, inputCls, Money, PageHeader } from "../ui";
import { KIND_LABELS } from "./MoneyForm";

type Kind = "RECEIPT" | "PAYMENT" | "TRANSFER";
interface Row {
  id: string;
  kind: Kind;
  number: number;
  date: string;
  total: string;
  status: "POSTED" | "VOID";
  description: string | null;
  paymentId: string | null;
  sourceKey: string | null;
  party: { id: string; name: string } | null;
  items: { method: string; treasuryId: string | null; toTreasuryId: string | null }[];
  _count: { allocations: number };
}

export const METHOD_FA: Record<string, string> = {
  CASH: "نقد",
  CARD_TRANSFER: "کارت‌به‌کارت",
  BANK_TRANSFER: "واریز بانکی",
  POS: "کارتخوان",
  GATEWAY: "درگاه",
  CHEQUE: "چک",
  WALLET: "کیف پول",
};

export default function MoneyList() {
  const router = useRouter();
  const sp = useSearchParams();
  const [kind, setKind] = useState<Kind>(((sp.get("kind") ?? "RECEIPT").toUpperCase() as Kind) || "RECEIPT");
  const [q, setQ] = useState("");
  const [range, setRange] = useState<Range>(() => rangeFor("month"));
  const [data, setData] = useState<{ items: Row[]; treasuries: Record<string, string>; summary: { count: number; total: string }; can: { write: boolean } } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    const p = new URLSearchParams(rangeQuery(range));
    p.set("kind", kind);
    if (q.trim()) p.set("q", q.trim());
    api<NonNullable<typeof data>>(`/api/admin/accounting/money?${p}`).then(setData).catch((e) => setError(e.message));
  }, [kind, q, range]);
  useEffect(() => {
    const h = setTimeout(load, q ? 250 : 0);
    return () => clearTimeout(h);
  }, [load, q]);

  const where = (r: Row) =>
    r.kind === "TRANSFER"
      ? `${data?.treasuries[r.items[0]?.treasuryId ?? ""] ?? ""} ← ${data?.treasuries[r.items[0]?.toTreasuryId ?? ""] ?? ""}`
      : [...new Set(r.items.map((i) => METHOD_FA[i.method] ?? i.method))].join(" + ");

  return (
    <div className="space-y-4">
      <PageHeader
        title="دریافت و پرداخت"
        help="accountingMoney"
        desc="پولی که گرفتید یا دادید، و جابه‌جایی بین صندوق و بانک. پرداخت آنلاین سایت خودکار اینجا می‌آید."
        actions={
          data?.can.write && (
            <Link href={`/admin/accounting/money/new?kind=${kind}`} className={btn.primary}>
              ➕ {KIND_LABELS[kind]} تازه
            </Link>
          )
        }
      />
      <Chips
        value={kind}
        onChange={(k) => {
          setKind(k);
          router.replace(`?kind=${k}`, { scroll: false });
        }}
        options={[
          { value: "RECEIPT", label: "دریافت‌ها" },
          { value: "PAYMENT", label: "پرداخت‌ها" },
          { value: "TRANSFER", label: "انتقال وجه" },
        ]}
      />
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="جستجو: نام شخص، شماره یا توضیح" className={inputCls} />
      <RangeBar value={range} onChange={setRange} />
      <ErrorText>{error}</ErrorText>
      {data && (
        <p className="text-xs text-gray-500">
          {faNum(data.summary.count)} مورد معتبر · جمع <Money value={data.summary.total} />
        </p>
      )}
      <Card className="overflow-hidden divide-y divide-gray-100 dark:divide-white/5">
        {data?.items.map((r) => (
          <Link key={r.id} href={`/admin/accounting/money/${r.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-white/5">
            <span className={`w-9 h-9 rounded-xl flex items-center justify-center text-base shrink-0 ${r.kind === "RECEIPT" ? "bg-emerald-500/10" : r.kind === "PAYMENT" ? "bg-red-500/10" : "bg-blue-500/10"}`}>
              {r.kind === "RECEIPT" ? "📥" : r.kind === "PAYMENT" ? "📤" : "🔁"}
            </span>
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-bold truncate ${r.status === "VOID" ? "line-through text-gray-400" : ""}`}>
                {r.party?.name ?? where(r)}
              </p>
              <p className="text-[11px] text-gray-400 truncate">
                {KIND_LABELS[r.kind]} {faNum(r.number)} · {formatJalali(new Date(r.date))} · {r.party ? where(r) : "بین صندوق و بانک"}
                {r.paymentId && " · خودکار از سایت"}
                {r.sourceKey?.startsWith("installment:") && " · خودکار از قسط"}
                {r.description && ` · ${r.description}`}
              </p>
            </div>
            <div className="text-left shrink-0 space-y-1">
              <Money value={r.total} tone={r.kind === "RECEIPT" ? "green" : r.kind === "PAYMENT" ? "red" : "gray"} className="text-sm" />
              {r.status === "VOID" && (
                <div>
                  <Badge tone="red">باطل</Badge>
                </div>
              )}
            </div>
          </Link>
        ))}
        {data && !data.items.length && (
          <Empty
            title={`${KIND_LABELS[kind]}ی در این بازه نیست`}
            desc={kind === "TRANSFER" ? "جابه‌جایی پول بین صندوق و بانک، یا تسویه‌ی کارتخوان و درگاه به بانک." : "پول گرفته یا داده‌شده را اینجا ثبت کنید تا طلب و بدهی اشخاص درست بماند."}
            action={
              data.can.write && (
                <Link href={`/admin/accounting/money/new?kind=${kind}`} className={btn.primary}>
                  ➕ {KIND_LABELS[kind]} تازه
                </Link>
              )
            }
          />
        )}
      </Card>
    </div>
  );
}
