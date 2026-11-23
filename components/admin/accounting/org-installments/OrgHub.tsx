"use client";

/**
 * اقساط سازمانی — فهرست سازمان‌ها با بدهی، قسط این ماه، معوق و مشتری فعال.
 * docs/plans/org-installments.md
 */

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Building2, ChevronLeft, Plus, Users } from "lucide-react";
import { faNum, formatAmount } from "@/lib/accounting/money";
import { api, btn, Card, ErrorText, PageHeader, Stat } from "../ui";
import { B, OrgForm, Progress, Terms, orgColor, periodFa, type Org } from "./shared";

interface Row extends Org {
  stats: { debt: string; thisMonth: string; thisMonthPaid: string; overdue: string; customers: number; period: string };
}

export default function OrgHub() {
  const router = useRouter();
  const [d, setD] = useState<{ orgs: Row[]; can: { manage: boolean; settle: boolean } } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState(false);
  const load = useCallback(
    () =>
      api<NonNullable<typeof d>>("/api/admin/accounting/installment-orgs")
        .then(setD)
        .catch((e) => setError(e.message)),
    [],
  );
  useEffect(() => {
    load();
  }, [load]);

  const tot = (k: keyof Row["stats"]) => (d?.orgs ?? []).reduce((s, o) => s + B(o.stats[k] as string), 0n);
  const period = d?.orgs[0]?.stats.period;
  return (
    <div className="space-y-4">
      <PageHeader
        title="اقساط سازمانی"
        help="accountingOrgInstallments"
        desc="فروش قسطی به کارمندان سازمان‌های طرف قرارداد؛ سازمان ماه‌به‌ماه قسط همه را یک‌جا می‌پردازد."
        actions={
          d?.can.manage && (
            <button onClick={() => setForm(true)} className={btn.primary}>
              <Plus className="h-4 w-4" aria-hidden /> سازمان تازه
            </button>
          )
        }
      />
      <ErrorText>{error}</ErrorText>
      {d && d.orgs.length > 0 && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label="طلب کل از سازمان‌ها" value={formatAmount(tot("debt"))} tone="blue" />
          <Stat label={`قسط ${period ? periodFa(period) : "این ماه"}`} value={formatAmount(tot("thisMonth"))} sub={`دریافت‌شده ${formatAmount(tot("thisMonthPaid"))}`} />
          <Stat label="معوق ماه‌های قبل" value={formatAmount(tot("overdue"))} tone={tot("overdue") > 0n ? "red" : "gray"} />
          <Stat label="مشتری با قسط باز" value={faNum(d.orgs.reduce((s, o) => s + o.stats.customers, 0))} />
        </div>
      )}
      {!d ? (
        !error && <p className="text-xs text-gray-400">در حال بارگذاری…</p>
      ) : !d.orgs.length ? (
        <Card className="p-6">
          <div className="mx-auto max-w-xl text-center">
            <Building2 className="mx-auto h-12 w-12 text-indigo-500" aria-hidden />
            <p className="mt-3 text-lg font-black">هنوز سازمانی تعریف نشده</p>
            <ol className="mt-4 space-y-2 text-right text-sm leading-7 text-gray-600 dark:text-gray-300">
              <li>۱. سازمان طرف قرارداد را با تعداد قسط، پورسانت و سقف خرید هر نفر تعریف کنید.</li>
              <li>۲. در صندوق یا فاکتور فروش، روش پرداخت «اقساط» را بزنید و سازمان را انتخاب کنید.</li>
              <li>۳. هر ماه که سازمان واریز کرد، «ثبت دریافت» را بزنید و فایل اکسلش را بگذارید.</li>
            </ol>
            {d.can.manage && (
              <button onClick={() => setForm(true)} className={`${btn.primary} mt-5`}>
                <Plus className="h-4 w-4" aria-hidden /> تعریف اولین سازمان
              </button>
            )}
          </div>
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {d.orgs.map((o) => {
            const c = orgColor(o.color);
            const thisMonth = B(o.stats.thisMonth);
            const paid = B(o.stats.thisMonthPaid);
            const overdue = B(o.stats.overdue);
            return (
              <Link key={o.id} href={`/admin/accounting/installment-orgs/${o.id}`} className={`group block ${o.isActive ? "" : "opacity-60"}`}>
                <Card className="relative h-full overflow-hidden p-4 transition group-hover:shadow-lg">
                  <span className="absolute inset-y-0 right-0 w-1.5" style={{ background: c }} />
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-base font-black text-gray-900 dark:text-white">{o.name}</p>
                      {!o.isActive && <p className="text-[11px] font-bold text-gray-400">غیرفعال</p>}
                    </div>
                    <ChevronLeft className="h-5 w-5 shrink-0 text-gray-300 transition group-hover:text-gray-600" aria-hidden />
                  </div>
                  <div className="mt-2">
                    <Terms o={o} />
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-[11px] font-bold text-gray-500">بدهی کل سازمان</p>
                      <p className="text-xl font-black tabular-nums" style={{ color: c }}>
                        {formatAmount(B(o.stats.debt))}
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] font-bold text-gray-500">قسط {periodFa(o.stats.period)}</p>
                      <p className="text-xl font-black tabular-nums text-gray-900 dark:text-white">{formatAmount(thisMonth)}</p>
                    </div>
                  </div>
                  {thisMonth > 0n && (
                    <div className="mt-2 space-y-1">
                      <Progress value={paid} total={thisMonth} color={c} />
                      <p className="text-[11px] text-gray-500">
                        {paid >= thisMonth ? "✓ قسط این ماه رسید" : `${formatAmount(paid)} از ${formatAmount(thisMonth)} رسیده`}
                      </p>
                    </div>
                  )}
                  <div className="mt-3 flex flex-wrap items-center gap-3 text-xs font-bold text-gray-500">
                    <span className="inline-flex items-center gap-1">
                      <Users className="h-3.5 w-3.5" aria-hidden /> {faNum(o.stats.customers)} مشتری
                    </span>
                    {overdue > 0n && (
                      <span className="inline-flex items-center gap-1 text-red-600">
                        <AlertTriangle className="h-3.5 w-3.5" aria-hidden /> معوق {formatAmount(overdue)}
                      </span>
                    )}
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
      {form && (
        <OrgForm
          org={null}
          onClose={() => setForm(false)}
          onSaved={(id) => {
            setForm(false);
            router.push(`/admin/accounting/installment-orgs/${id}`);
          }}
        />
      )}
    </div>
  );
}
