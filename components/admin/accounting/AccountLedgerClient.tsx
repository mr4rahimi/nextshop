"use client";

/** دفتر یک حساب — معین، یا جمع زیرمجموعه‌های کل و گروه */

import { useCallback, useEffect, useState } from "react";
import { faNum } from "@/lib/accounting/money";
import StatementView, { RangeBar, rangeFor, rangeQuery, type Range, type StatementData } from "./Statement";
import { api, ErrorText, PageHeader } from "./ui";

export default function AccountLedgerClient({ id }: { id: string }) {
  const [range, setRange] = useState<Range>(() => rangeFor("year"));
  const [data, setData] = useState<(StatementData & { account: { code: string; name: string; level: string } }) | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    api<StatementData & { account: { code: string; name: string; level: string } }>(`/api/admin/accounting/accounts/${id}?${rangeQuery(range)}`)
      .then((d) => {
        setData(d);
        setError(null);
      })
      .catch((e) => setError(e.message));
  }, [id, range]);
  useEffect(load, [load]);

  if (!data) return error ? <ErrorText>{error}</ErrorText> : <p className="text-xs text-gray-400">در حال بارگذاری…</p>;
  return (
    <div className="space-y-4">
      <PageHeader
        title={`${faNum(data.account.code)} — ${data.account.name}`}
        help="accountingAccounts"
        desc={data.account.level === "SUBLEDGER" ? "دفتر معین" : "جمع همه‌ی معین‌های زیرمجموعه"}
        back={{ href: "/admin/accounting/accounts", label: "سرفصل حساب‌ها" }}
      />
      <RangeBar value={range} onChange={setRange} />
      <StatementView data={data} kind="account" />
    </div>
  );
}
