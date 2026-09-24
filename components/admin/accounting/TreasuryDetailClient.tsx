"use client";

/** گردش یک صندوق یا حساب بانکی */

import { useCallback, useEffect, useState } from "react";
import { faNum } from "@/lib/accounting/money";
import { KIND_META, type TreasuryRecord } from "./TreasuryForm";
import StatementView, { RangeBar, rangeFor, rangeQuery, type Range, type StatementData } from "./Statement";
import { api, Badge, BalanceLabel, Card, ErrorText, PageHeader, SectionTitle } from "./ui";

interface Data {
  item: TreasuryRecord;
  balance: string;
  statement: StatementData;
}

export default function TreasuryDetailClient({ id }: { id: string }) {
  const [range, setRange] = useState<Range>(() => rangeFor("month"));
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    api<Data>(`/api/admin/accounting/treasury/${id}?${rangeQuery(range)}`)
      .then((d) => {
        setData(d);
        setError(null);
      })
      .catch((e) => setError(e.message));
  }, [id, range]);
  useEffect(load, [load]);

  if (!data) return error ? <ErrorText>{error}</ErrorText> : <p className="text-xs text-gray-400">در حال بارگذاری…</p>;
  const t = data.item;
  const meta = KIND_META[t.kind];

  return (
    <div className="space-y-5">
      <PageHeader title={`${meta.icon} ${t.name}`} help="accountingTreasury" back={{ href: "/admin/accounting/treasury", label: "صندوق و بانک" }} />
      <Card className="p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1.5 text-xs">
          <div className="flex gap-1.5">
            <Badge>{meta.label}</Badge>
            <Badge>کد {faNum(t.code)}</Badge>
            {!t.isActive && <Badge tone="red">غیرفعال</Badge>}
          </div>
          {t.bankName && <p className="text-gray-500">بانک: {t.bankName}</p>}
          {t.accountNo && <p className="text-gray-500">حساب: <span dir="ltr">{faNum(t.accountNo)}</span></p>}
          {t.cardNo && <p className="text-gray-500">کارت: <span dir="ltr">{faNum(t.cardNo)}</span></p>}
          {t.sheba && <p className="text-gray-500">شبا: <span dir="ltr">{faNum(t.sheba)}</span></p>}
        </div>
        <div className="text-left">
          <p className="text-[11px] text-gray-500 mb-1">موجودی امروز</p>
          <div className="text-xl">
            <BalanceLabel balance={data.balance} kind="treasury" />
          </div>
        </div>
      </Card>
      <section>
        <SectionTitle title="گردش" />
        <div className="mb-3">
          <RangeBar value={range} onChange={setRange} />
        </div>
        <StatementView data={data.statement} kind="treasury" />
      </section>
    </div>
  );
}
