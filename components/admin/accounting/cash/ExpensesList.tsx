"use client";

/**
 * فهرست هزینه‌ها — docs/plans/accounting.md بخش ۵ و ۱۱ («هزینه‌ها به تفکیک سرفصل»).
 * بالای فهرست جمع هر سرفصل در همان بازه؛ لمس یک سرفصل فهرست را فیلتر می‌کند.
 */

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { formatJalali } from "@/lib/club/jalali";
import { faNum, formatAmount } from "@/lib/accounting/money";
import { RangeBar, rangeFor, rangeQuery, type Range } from "../Statement";
import { api, Badge, btn, Card, Chips, Empty, ErrorText, inputCls, Money, PageHeader, SectionTitle } from "../ui";
import { Plus } from "lucide-react";

interface Row {
  id: string;
  number: number;
  date: string;
  total: string;
  payable: string;
  status: "POSTED" | "VOID";
  description: string | null;
  sourceKey: string | null;
  party: { id: string; name: string } | null;
  lines: { accountId: string; amount: string; description: string | null }[];
  items: { method: string }[];
}
interface Data {
  items: Row[];
  accounts: Record<string, { id: string; code: string; name: string }>;
  breakdown: { accountId: string; name: string; amount: string }[];
  summary: { count: number; total: string; payable: string };
  can: { write: boolean };
}

type View = "all" | "unpaid";

export default function ExpensesList() {
  const [view, setView] = useState<View>("all");
  const [accountId, setAccountId] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [range, setRange] = useState<Range>(() => rangeFor("month"));
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    const p = new URLSearchParams(rangeQuery(range));
    if (view === "unpaid") p.set("unpaid", "1");
    if (accountId) p.set("accountId", accountId);
    if (q.trim()) p.set("q", q.trim());
    api<Data>(`/api/admin/accounting/expenses?${p}`).then(setData).catch((e) => setError(e.message));
  }, [view, accountId, q, range]);
  useEffect(() => {
    const h = setTimeout(load, q ? 250 : 0);
    return () => clearTimeout(h);
  }, [load, q]);

  const max = data?.breakdown.reduce((m, b) => (BigInt(b.amount) > m ? BigInt(b.amount) : m), 0n) ?? 0n;
  const title = (r: Row) => [...new Set(r.lines.map((l) => data?.accounts[l.accountId]?.name).filter(Boolean))].join(" + ") || "هزینه";

  return (
    <div className="space-y-4">
      <PageHeader
        title="هزینه‌ها"
        help="accountingExpenses"
        desc="اجاره، قبض، تبلیغات، کارمزد و هر خرج دیگری که کالا نیست. تسویه‌ی پورسانت کارکنان خودکار اینجا می‌آید."
        actions={
          data?.can.write && (
            <Link href="/admin/accounting/expenses/new" className={btn.primary}>
              <Plus className="h-4 w-4" aria-hidden />
              ثبت هزینه
            </Link>
          )
        }
      />
      <Chips<View>
        value={view}
        onChange={setView}
        options={[
          { value: "all", label: "همه" },
          { value: "unpaid", label: "نسیه‌دار" },
        ]}
      />
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="جستجو: شخص، شماره یا شرح" className={inputCls} />
      <RangeBar value={range} onChange={setRange} />
      <ErrorText>{error}</ErrorText>

      {data && data.breakdown.length > 0 && (
        <Card className="p-4 space-y-2.5">
          <SectionTitle
            title="به تفکیک سرفصل"
            actions={
              accountId && (
                <button onClick={() => setAccountId(null)} className={btn.small}>
                  ✕ همه‌ی سرفصل‌ها
                </button>
              )
            }
          />
          {data.breakdown.map((b) => {
            const pct = max > 0n ? Number((BigInt(b.amount) * 100n) / max) : 0;
            return (
              <button
                key={b.accountId}
                onClick={() => setAccountId(accountId === b.accountId ? null : b.accountId)}
                className={`w-full text-right rounded-lg px-2 py-1.5 transition ${accountId === b.accountId ? "bg-blue-50 dark:bg-blue-500/10" : "hover:bg-gray-50 dark:hover:bg-white/5"}`}
              >
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="font-bold">{b.name}</span>
                  <Money value={b.amount} className="text-xs" />
                </div>
                <div className="h-1.5 rounded-full bg-gray-100 dark:bg-white/5 overflow-hidden">
                  <div className="h-full rounded-full bg-red-500/70" style={{ width: `${Math.max(pct, 2)}%` }} />
                </div>
              </button>
            );
          })}
        </Card>
      )}

      {data && (
        <p className="text-xs text-gray-500">
          {faNum(data.summary.count)} هزینه‌ی معتبر · جمع <Money value={data.summary.total} />
          {BigInt(data.summary.payable) > 0n && (
            <>
              {" "}
              · نسیه <Money value={data.summary.payable} tone="red" />
            </>
          )}
        </p>
      )}

      <Card className="overflow-hidden divide-y divide-gray-100 dark:divide-white/5">
        {data?.items.map((r) => (
          <Link key={r.id} href={`/admin/accounting/money/${r.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-white/5">
            <span className="w-9 h-9 rounded-xl flex items-center justify-center text-base shrink-0 bg-red-500/10">🧮</span>
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-bold truncate ${r.status === "VOID" ? "line-through text-gray-400" : ""}`}>{title(r)}</p>
              <p className="text-[11px] text-gray-400 truncate">
                هزینه {faNum(r.number)} · {formatJalali(new Date(r.date))}
                {r.party && ` · ${r.party.name}`}
                {r.sourceKey?.startsWith("payout:") && " · خودکار از تسویه‌ی پورسانت"}
                {r.description && ` · ${r.description}`}
              </p>
            </div>
            <div className="text-left shrink-0 space-y-1">
              <Money value={r.total} tone="red" className="text-sm" />
              {r.status === "VOID" ? (
                <div>
                  <Badge tone="red">باطل</Badge>
                </div>
              ) : (
                BigInt(r.payable) > 0n && (
                  <div>
                    <Badge tone="amber">نسیه {formatAmount(r.payable)}</Badge>
                  </div>
                )
              )}
            </div>
          </Link>
        ))}
        {data && !data.items.length && (
          <Empty
            title={view === "unpaid" ? "هزینه‌ی نسیه‌داری در این بازه نیست" : "هزینه‌ای در این بازه ثبت نشده"}
            desc="هر خرجی که کالا نیست — اجاره، قبض، تبلیغات، حمل — را اینجا ثبت کنید تا سود واقعی کسب‌وکار دیده شود."
            action={
              data.can.write && (
                <Link href="/admin/accounting/expenses/new" className={btn.primary}>
                  <Plus className="h-4 w-4" aria-hidden />
                  ثبت هزینه
                </Link>
              )
            }
          />
        )}
      </Card>
    </div>
  );
}
