"use client";

/** صندوق‌ها و حساب‌های بانکی با موجودی — docs/plans/accounting.md بخش ۹ */

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { faNum } from "@/lib/accounting/money";
import TreasuryForm, { KIND_META, type TreasuryKind, type TreasuryRecord } from "./TreasuryForm";
import { api, BalanceLabel, btn, Card, Empty, ErrorText, Money, PageHeader, SectionTitle, Stat } from "./ui";

type Row = TreasuryRecord & { balance: string };
interface Data {
  items: Row[];
  total: string;
  can: { manage: boolean };
}

export default function TreasuryClient() {
  const sp = useSearchParams();
  const router = useRouter();
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<{ item: TreasuryRecord | null } | null>(sp.get("new") === "1" ? { item: null } : null);
  const [showInactive, setShowInactive] = useState(false);

  const load = useCallback(() => {
    api<Data>(`/api/admin/accounting/treasury${showInactive ? "?inactive=1" : ""}`)
      .then((d) => {
        setData(d);
        setError(null);
      })
      .catch((e) => setError(e.message));
  }, [showInactive]);
  useEffect(load, [load]);

  const groups = (Object.keys(KIND_META) as TreasuryKind[])
    .map((k) => ({ kind: k, items: data?.items.filter((i) => i.kind === k) ?? [] }))
    .filter((g) => g.items.length);

  return (
    <div className="space-y-5">
      <PageHeader
        title="صندوق و بانک"
        help="accountingTreasury"
        desc="هر جایی که پول نگه می‌دارید یا پول به آن می‌رسد، با موجودی لحظه‌ای."
        actions={
          data?.can.manage && (
            <button onClick={() => setForm({ item: null })} className={btn.primary}>
              ➕ صندوق یا بانک تازه
            </button>
          )
        }
      />
      {data && <Stat label="جمع پول نقد و بانک" value={<Money value={data.total} />} />}
      <ErrorText>{error}</ErrorText>

      {groups.map((g) => (
        <section key={g.kind}>
          <SectionTitle title={`${KIND_META[g.kind].icon} ${KIND_META[g.kind].label}`} />
          <Card className="divide-y divide-gray-100 dark:divide-white/5 overflow-hidden">
            {g.items.map((t) => (
              <div key={t.id} className="flex items-center gap-3 px-4 py-3">
                <Link href={`/admin/accounting/treasury/${t.id}`} className="flex-1 min-w-0">
                  <p className={`text-sm font-bold truncate ${t.isActive ? "text-gray-900 dark:text-white" : "text-gray-400 line-through"}`}>{t.name}</p>
                  <p className="text-[11px] text-gray-400 truncate" dir="ltr">
                    {[t.bankName, t.cardNo && faNum(t.cardNo.replace(/(\d{4})(?=\d)/g, "$1-")), t.sheba && faNum(t.sheba)].filter(Boolean).join(" · ")}
                  </p>
                </Link>
                <BalanceLabel balance={t.balance} kind="treasury" />
                {data?.can.manage && (
                  <button onClick={() => setForm({ item: t })} className="text-gray-400 hover:text-blue-600 text-sm px-1" aria-label="ویرایش">
                    ✏️
                  </button>
                )}
              </div>
            ))}
          </Card>
        </section>
      ))}
      {data && !data.items.length && <Empty title="هنوز صندوق یا بانکی تعریف نشده" />}
      {data?.can.manage && (
        <label className="flex items-center gap-2 text-xs text-gray-500">
          <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />
          غیرفعال‌ها را هم نشان بده
        </label>
      )}

      {form && data && (
        <TreasuryForm
          open
          item={form.item}
          banks={data.items}
          onClose={() => {
            setForm(null);
            if (sp.get("new")) router.replace("/admin/accounting/treasury");
          }}
          onSaved={() => {
            setForm(null);
            load();
          }}
        />
      )}
    </div>
  );
}
