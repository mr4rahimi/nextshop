"use client";

/** فهرست اسناد — نمای حسابدار */

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { formatJalali } from "@/lib/club/jalali";
import { faNum } from "@/lib/accounting/money";
import { RangeBar, rangeFor, rangeQuery, SOURCE_LABELS, type Range } from "./Statement";
import { api, Badge, btn, Card, Chips, Empty, ErrorText, inputCls, Money, PageHeader } from "./ui";

interface V {
  id: string;
  number: number;
  date: string;
  description: string;
  status: "POSTED" | "VOID";
  source: string;
  totalDebit: string;
  createdByName: string;
  _count: { lines: number };
}

type SrcF = "" | "MANUAL" | "OPENING";

export default function VouchersClient() {
  const [q, setQ] = useState("");
  const [src, setSrc] = useState<SrcF>("");
  const [range, setRange] = useState<Range>(() => rangeFor("year"));
  const [data, setData] = useState<{ vouchers: V[]; can: { manage: boolean } } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    const p = new URLSearchParams(rangeQuery(range));
    if (q.trim()) p.set("q", q.trim());
    if (src) p.set("source", src);
    api<{ vouchers: V[]; can: { manage: boolean } }>(`/api/admin/accounting/vouchers?${p}`)
      .then((d) => {
        setData(d);
        setError(null);
      })
      .catch((e) => setError(e.message));
  }, [q, src, range]);
  useEffect(() => {
    const h = setTimeout(load, q ? 250 : 0);
    return () => clearTimeout(h);
  }, [load, q]);

  return (
    <div className="space-y-4">
      <PageHeader
        title="اسناد حسابداری"
        help="accountingVouchers"
        desc="همه‌ی ثبت‌های مالی با شماره‌ی پیوسته. بیشترشان خودکار ساخته می‌شوند."
        actions={
          data?.can.manage && (
            <Link href="/admin/accounting/vouchers/new" className={btn.primary}>
              📝 سند دستی
            </Link>
          )
        }
      />
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="شماره یا شرح سند" className={inputCls} />
      <div className="flex flex-wrap gap-2 items-start">
        <Chips<SrcF>
          value={src}
          onChange={setSrc}
          options={[
            { value: "", label: "همه‌ی منابع" },
            { value: "MANUAL", label: "دستی" },
            { value: "OPENING", label: "اول دوره" },
          ]}
        />
      </div>
      <RangeBar value={range} onChange={setRange} />
      <ErrorText>{error}</ErrorText>

      <Card className="divide-y divide-gray-100 dark:divide-white/5 overflow-hidden">
        {data?.vouchers.map((v) => (
          <Link key={v.id} href={`/admin/accounting/vouchers/${v.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-white/5">
            <span className="w-12 shrink-0 text-center">
              <span className="block text-base font-black text-gray-900 dark:text-white tabular-nums">{faNum(v.number)}</span>
              <span className="block text-[9px] text-gray-400">سند</span>
            </span>
            <span className="flex-1 min-w-0">
              <span className={`block text-sm font-bold truncate ${v.status === "VOID" ? "line-through text-gray-400" : "text-gray-900 dark:text-white"}`}>{v.description}</span>
              <span className="flex items-center gap-1.5 mt-0.5 text-[11px] text-gray-400">
                {formatJalali(new Date(v.date))}
                <Badge tone={v.source === "MANUAL" ? "amber" : "blue"}>{SOURCE_LABELS[v.source] ?? v.source}</Badge>
                {v.status === "VOID" && <Badge tone="red">باطل</Badge>}
              </span>
            </span>
            <Money value={v.totalDebit} className="text-sm" />
          </Link>
        ))}
        {data && !data.vouchers.length && <Empty title="در این بازه سندی نیست" />}
      </Card>
    </div>
  );
}
