"use client";

/**
 * فهرست اشخاص با مانده — docs/plans/accounting.md بخش ۱۳.
 * `?new=1` فرم شخص تازه را باز می‌کند (از «ثبت سریع»)، `?balance=debtor|creditor` فیلتر مانده.
 */

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { faNum } from "@/lib/accounting/money";
import PartyForm, { type PartyRecord } from "./PartyForm";
import { api, Badge, BalanceLabel, btn, Card, Chips, Empty, ErrorText, inputCls, Money, PageHeader, Stat } from "./ui";

type Row = PartyRecord & { balance: string };
interface Data {
  parties: Row[];
  total: number;
  summary: { receivable: string; payable: string };
  can: { manage: boolean };
}

type RoleF = "" | "customer" | "supplier" | "employee" | "marketplace";
type BalF = "" | "debtor" | "creditor";

export default function PartiesClient() {
  const sp = useSearchParams();
  const router = useRouter();
  const [q, setQ] = useState("");
  const [role, setRole] = useState<RoleF>("");
  const [bal, setBal] = useState<BalF>((sp.get("balance") as BalF) || "");
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(sp.get("new") === "1");

  const load = useCallback(() => {
    const p = new URLSearchParams();
    if (q.trim()) p.set("q", q.trim());
    if (role) p.set("role", role);
    if (bal) p.set("balance", bal);
    api<Data>(`/api/admin/accounting/parties?${p}`)
      .then((d) => {
        setData(d);
        setError(null);
      })
      .catch((e) => setError(e.message));
  }, [q, role, bal]);

  useEffect(() => {
    const h = setTimeout(load, q ? 250 : 0);
    return () => clearTimeout(h);
  }, [load, q]);

  return (
    <div className="space-y-4">
      <PageHeader
        title="اشخاص"
        help="accountingParties"
        desc="مشتری‌ها، تأمین‌کننده‌ها، کارمندان و هر کسی که با او حساب دارید."
        actions={
          data?.can.manage && (
            <button onClick={() => setFormOpen(true)} className={btn.primary}>
              ➕ شخص تازه
            </button>
          )
        }
      />

      {data && (
        <div className="grid grid-cols-2 gap-3">
          <Stat label="جمع طلب ما" value={<Money value={data.summary.receivable} tone="green" />} />
          <Stat label="جمع بدهی ما" value={<Money value={data.summary.payable} tone="red" />} />
        </div>
      )}

      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="جستجو با نام، موبایل، کد ملی یا کد شخص" className={inputCls} />
      <div className="flex flex-wrap gap-2">
        <Chips<RoleF>
          value={role}
          onChange={setRole}
          options={[
            { value: "", label: "همه" },
            { value: "customer", label: "مشتری" },
            { value: "supplier", label: "تأمین‌کننده" },
            { value: "employee", label: "کارمند" },
            { value: "marketplace", label: "بازارگاه" },
          ]}
        />
        <Chips<BalF>
          value={bal}
          onChange={setBal}
          options={[
            { value: "", label: "هر مانده" },
            { value: "debtor", label: "بدهکاران به ما" },
            { value: "creditor", label: "طلبکاران از ما" },
          ]}
        />
      </div>

      <ErrorText>{error}</ErrorText>

      <Card className="divide-y divide-gray-100 dark:divide-white/5 overflow-hidden">
        {data?.parties.map((p) => (
          <Link key={p.id} href={`/admin/accounting/parties/${p.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-white/5">
            <span className="w-10 h-10 shrink-0 rounded-full bg-gradient-to-br from-blue-500 to-indigo-500 text-white flex items-center justify-center text-sm font-black">
              {p.name.trim().charAt(0)}
            </span>
            <span className="flex-1 min-w-0">
              <span className="flex items-center gap-1.5 flex-wrap">
                <span className="text-sm font-bold text-gray-900 dark:text-white truncate">{p.name}</span>
                {!p.isActive && <Badge>غیرفعال</Badge>}
                {p.isSupplier && <Badge tone="blue">تأمین‌کننده</Badge>}
                {p.isEmployee && <Badge tone="amber">کارمند</Badge>}
                {p.isMarketplace && <Badge tone="blue">بازارگاه</Badge>}
              </span>
              <span className="block text-[11px] text-gray-400 mt-0.5">
                کد {faNum(p.code)}
                {p.mobile && <> · <span dir="ltr">{faNum(p.mobile)}</span></>}
              </span>
            </span>
            <BalanceLabel balance={p.balance} />
          </Link>
        ))}
        {data && !data.parties.length && (
          <Empty
            title={q || role || bal ? "کسی با این جستجو پیدا نشد" : "هنوز شخصی ثبت نشده"}
            desc="مشتری‌های سایت و تأمین‌کننده‌های کارتابل با اولین معامله خودشان اینجا می‌آیند؛ بقیه را خودتان اضافه کنید."
            action={
              data.can.manage && (
                <button onClick={() => setFormOpen(true)} className={btn.primary}>
                  ➕ شخص تازه
                </button>
              )
            }
          />
        )}
        {!data && !error && <p className="px-4 py-10 text-center text-xs text-gray-400">در حال بارگذاری…</p>}
      </Card>
      {data && data.total > data.parties.length && (
        <p className="text-[11px] text-gray-400 text-center">
          {faNum(data.parties.length)} از {faNum(data.total)} نفر — برای دیدن بقیه جستجو کنید
        </p>
      )}

      {formOpen && (
        <PartyForm
          open
          onClose={() => {
            setFormOpen(false);
            if (sp.get("new")) router.replace("/admin/accounting/parties");
          }}
          onSaved={(p) => router.push(`/admin/accounting/parties/${p.id}`)}
        />
      )}
    </div>
  );
}
