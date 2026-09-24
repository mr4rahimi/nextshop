"use client";

/**
 * خانه‌ی حسابداری داخلی — docs/plans/accounting.md بخش ۱۱ (داشبورد) و ۱۳.
 *
 * بالا: سه عددی که صاحب کسب‌وکار هر روز می‌خواهد (پول نقد، طلب، بدهی).
 * «شروع کار»: تا وقتی کامل نشده، قدم بعدی را جلوی چشم نگه می‌دارد.
 */

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { formatJalali } from "@/lib/club/jalali";
import { api, BalanceLabel, Card, Money, PageHeader, SectionTitle, Stat, btn } from "./ui";
import { faNum, formatAmount } from "@/lib/accounting/money";

interface Summary {
  year: { title: string; startDate: string; endDate: string } | null;
  lockDate: string | null;
  cash: string;
  treasuries: { id: string; name: string; kind: string; balance: string }[];
  receivable: string;
  payable: string;
  topDebtors: { id: string; name: string; balance: string }[];
  checklist: { bank: boolean; opening: boolean; seller: boolean; parties: boolean };
  voucherCount: number;
  cheques: { in: { count: number; total: string }; out: { count: number; total: string } };
}

const KIND_ICON: Record<string, string> = { CASH: "💵", BANK: "🏦", POS: "💳", GATEWAY: "🌐" };

export default function InternalDashboard({ canLeave, onLeft }: { canLeave: boolean; onLeft: () => void }) {
  const [data, setData] = useState<Summary | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    api<Summary>("/api/admin/accounting/summary")
      .then((d) => {
        setData(d);
        setError(null);
      })
      .catch((e) => setError(e.message));
  }, []);
  useEffect(load, [load]);

  async function leave() {
    if (!window.confirm("حسابداری داخلی خاموش شود؟ هنوز سندی ثبت نشده، پس چیزی از دست نمی‌رود.")) return;
    try {
      await api("/api/admin/accounting/settings", { method: "PATCH", json: { mode: "NONE" } });
      onLeft();
    } catch (e) {
      setError(e instanceof Error ? e.message : "انجام نشد");
    }
  }

  if (!data) return error ? <p className="text-xs font-bold text-red-600">{error}</p> : <p className="text-xs text-gray-400">در حال بارگذاری…</p>;

  const steps = [
    { done: true, label: "حسابداری داخلی راه‌اندازی شد", href: null },
    { done: data.checklist.bank, label: "حساب‌های بانکی، کارتخوان و درگاه را اضافه کنید", href: "/admin/accounting/treasury?new=1" },
    { done: data.checklist.opening, label: "موجودی صندوق و بانک و طلب و بدهی اول دوره را وارد کنید", href: "/admin/accounting/opening" },
    { done: data.checklist.seller, label: "اطلاعات کسب‌وکار را برای فاکتور رسمی کامل کنید", href: "/admin/accounting/settings?tab=seller" },
  ];
  const pending = steps.filter((s) => !s.done).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="حسابداری"
        help="accounting"
        desc={
          data.year ? (
            <>
              سال مالی {faNum(data.year.title)} — از {formatJalali(new Date(data.year.startDate))} تا {formatJalali(new Date(data.year.endDate))}
              {data.lockDate && <> · دفاتر تا {formatJalali(new Date(data.lockDate))} قفل است</>}
            </>
          ) : (
            "سال مالی جاری تعریف نشده است"
          )
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Stat label="پول نقد و بانک" value={<Money value={data.cash} />} href="/admin/accounting/treasury" />
        <Stat label="طلب از اشخاص" value={<Money value={data.receivable} tone="green" />} href="/admin/accounting/parties?balance=debtor" />
        <Stat label="بدهی به اشخاص" value={<Money value={data.payable} tone="red" />} href="/admin/accounting/parties?balance=creditor" />
      </div>

      {(data.cheques.in.count > 0 || data.cheques.out.count > 0) && (
        <Card className="p-4">
          <SectionTitle title="چک‌های ۷ روز آینده" help="accountingCheques" />
          <div className="grid grid-cols-2 gap-3">
            <Stat
              label={`دریافتی — ${faNum(data.cheques.in.count)} چک`}
              value={<Money value={data.cheques.in.total} tone="green" />}
              sub="وصول کنید"
              href="/admin/accounting/cheques?dir=RECEIVED&view=week"
            />
            <Stat
              label={`صادره — ${faNum(data.cheques.out.count)} چک`}
              value={<Money value={data.cheques.out.total} tone="amber" />}
              sub="موجودی بانک را چک کنید"
              href="/admin/accounting/cheques?dir=ISSUED&view=week"
            />
          </div>
        </Card>
      )}

      {pending > 0 && (
        <Card className="p-4">
          <SectionTitle title={`شروع کار — ${formatAmount(pending)} قدم مانده`} help="accountingSetup" />
          <ol className="space-y-2">
            {steps.map((s, i) => (
              <li key={i} className="flex items-center gap-3">
                <span
                  className={`w-6 h-6 shrink-0 rounded-full flex items-center justify-center text-xs font-black ${
                    s.done ? "bg-emerald-500 text-white" : "bg-gray-100 dark:bg-white/10 text-gray-500"
                  }`}
                >
                  {s.done ? "✓" : formatAmount(i + 1)}
                </span>
                {s.done || !s.href ? (
                  <span className={`text-sm ${s.done ? "text-gray-400 line-through" : "text-gray-800 dark:text-gray-100"}`}>{s.label}</span>
                ) : (
                  <Link href={s.href} className="text-sm font-bold text-blue-600 hover:underline">
                    {s.label} ←
                  </Link>
                )}
              </li>
            ))}
          </ol>
        </Card>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <section>
          <SectionTitle
            title="صندوق و بانک"
            help="accountingTreasury"
            actions={
              <Link href="/admin/accounting/treasury" className="text-xs font-bold text-blue-600">
                همه ←
              </Link>
            }
          />
          <Card className="divide-y divide-gray-100 dark:divide-white/5">
            {data.treasuries.map((t) => (
              <Link key={t.id} href={`/admin/accounting/treasury/${t.id}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-white/5">
                <span className="flex items-center gap-2 min-w-0">
                  <span className="text-lg">{KIND_ICON[t.kind]}</span>
                  <span className="text-sm font-bold text-gray-800 dark:text-gray-100 truncate">{t.name}</span>
                </span>
                <BalanceLabel balance={t.balance} kind="treasury" />
              </Link>
            ))}
          </Card>
        </section>

        <section>
          <SectionTitle
            title="بیشترین طلب‌ها"
            actions={
              <Link href="/admin/accounting/parties?balance=debtor" className="text-xs font-bold text-blue-600">
                همه ←
              </Link>
            }
          />
          <Card className="divide-y divide-gray-100 dark:divide-white/5">
            {data.topDebtors.map((p) => (
              <Link key={p.id} href={`/admin/accounting/parties/${p.id}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-white/5">
                <span className="text-sm font-bold text-gray-800 dark:text-gray-100 truncate">{p.name}</span>
                <BalanceLabel balance={p.balance} />
              </Link>
            ))}
            {!data.topDebtors.length && <p className="px-4 py-6 text-center text-xs text-gray-400">فعلاً از کسی طلبی نیست.</p>}
          </Card>
        </section>
      </div>

      <Card className="p-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-gray-900 dark:text-white">در راه: هزینه‌ها، کیف پول و اقساط، گزارش‌های مالی</p>
          <p className="text-xs text-gray-500 mt-1 leading-6">
            فروش سایت، دریافت درگاه، فاکتور، انبار و چک همین حالا خودکار یا دستی در دفتر می‌نشینند. ثبت هزینه، کیف پول مشتریان،
            اقساط اعتباری و گزارش‌های سود و زیان در نسخه‌های بعدی می‌آیند.
          </p>
        </div>
        {canLeave && data.voucherCount === 0 && (
          <button onClick={leave} className={btn.soft}>
            خاموش کردن حسابداری داخلی
          </button>
        )}
      </Card>
    </div>
  );
}
