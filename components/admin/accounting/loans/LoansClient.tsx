"use client";

/** فهرست وام‌ها و اقساط باز (docs/plans/webhesab-parity.md بخش ۲۱) */

import Link from "next/link";
import { useEffect, useState } from "react";
import { formatJalali } from "@/lib/club/jalali";
import { faNum, formatAmount } from "@/lib/accounting/money";
import { api, Badge, btn, Card, Chips, Empty, ErrorText, PageHeader, Stat } from "../ui";

interface Loan {
  id: string;
  number: number;
  title: string;
  lender: string;
  date: string;
  principal: string;
  status: "ACTIVE" | "SETTLED" | "VOID";
  paidCount: number;
  count: number;
  paidTotal: string;
  remaining: string;
  overdue: number;
  nextDue: string | null;
}
interface Inst {
  id: string;
  seq: number;
  dueDate: string;
  principal: string;
  interest: string;
  overdue: boolean;
  loan: { id: string; number: number; title: string; lender: string };
}
interface Data {
  loans: Loan[];
  installments: Inst[];
  totals: { remaining: string; overdue: number; nextAmount: string; nextDue: string | null };
  can: { manage: boolean };
}
type Tab = "loans" | "installments";

const BASE = "/admin/accounting/loans";

export default function LoansClient() {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("loans");

  useEffect(() => {
    api<Data>("/api/admin/accounting/loans")
      .then(setData)
      .catch((e) => setError(e.message));
  }, []);

  const add = data?.can.manage && (
    <Link href={`${BASE}/new`} className={btn.primary}>
      ➕ وام تازه
    </Link>
  );

  return (
    <div className="space-y-4">
      <PageHeader title="وام و تسهیلات" help="accountingLoans" desc="وام‌های دریافتی، جدول اقساط و مانده‌ی بدهی." actions={add} />
      <ErrorText>{error}</ErrorText>
      {data && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          <Stat label="مانده‌ی اصل بدهی" value={formatAmount(data.totals.remaining)} />
          <Stat label="قسط بعدی" value={formatAmount(data.totals.nextAmount)} sub={data.totals.nextDue ? formatJalali(new Date(data.totals.nextDue)) : "—"} />
          <Stat label="قسط معوق" value={faNum(data.totals.overdue)} tone={data.totals.overdue ? "red" : "gray"} />
        </div>
      )}
      <Chips<Tab>
        value={tab}
        onChange={setTab}
        options={[
          { value: "loans", label: "وام‌ها" },
          { value: "installments", label: "اقساط پرداخت‌نشده" },
        ]}
      />

      {tab === "loans" && data?.loans.length === 0 && <Empty title="وامی ثبت نشده" desc="وام دریافتی را با جدول اقساطش ثبت کنید تا سررسیدها در تقویم بیاید." action={add} />}
      {tab === "loans" && !!data?.loans.length && (
        <Card className="divide-y divide-gray-100 dark:divide-white/5 overflow-hidden">
          {data.loans.map((l) => (
            <Link key={l.id} href={`${BASE}/${l.id}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 text-sm hover:bg-gray-50 dark:hover:bg-white/5">
              <span className="font-bold">{l.title}</span>
              <span className="text-xs text-gray-500">{l.lender}</span>
              {l.status === "SETTLED" && <Badge tone="green">تسویه شد</Badge>}
              {l.status === "VOID" && <Badge tone="red">باطل</Badge>}
              {l.overdue > 0 && <Badge tone="red">{faNum(l.overdue)} قسط معوق</Badge>}
              <span className="mr-auto text-xs text-gray-500">
                {faNum(l.paidCount)} از {faNum(l.count)} قسط · مانده <b className="tabular-nums text-gray-900 dark:text-white">{formatAmount(l.remaining)}</b>
              </span>
            </Link>
          ))}
        </Card>
      )}

      {tab === "installments" && data?.installments.length === 0 && <Empty title="قسط پرداخت‌نشده‌ای نیست" />}
      {tab === "installments" && !!data?.installments.length && (
        <Card className="divide-y divide-gray-100 dark:divide-white/5 overflow-hidden">
          {data.installments.map((i) => (
            <Link key={i.id} href={`${BASE}/${i.loan.id}#i${i.seq}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 text-sm hover:bg-gray-50 dark:hover:bg-white/5">
              <span className="font-bold tabular-nums">{formatJalali(new Date(i.dueDate))}</span>
              <span className="text-xs text-gray-500">قسط {faNum(i.seq)} · {i.loan.title}</span>
              {i.overdue && <Badge tone="red">معوق</Badge>}
              <span className="mr-auto font-bold tabular-nums">{formatAmount(BigInt(i.principal) + BigInt(i.interest))}</span>
            </Link>
          ))}
        </Card>
      )}
    </div>
  );
}
