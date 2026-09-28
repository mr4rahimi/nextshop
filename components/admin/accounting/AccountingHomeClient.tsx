"use client";

/**
 * خانه‌ی حسابداری — docs/plans/accounting.md بخش ۴.۴ و ۱۳، docs/features/admin-ui.md.
 *
 * حالت داخلی: داشبورد (`InternalDashboard`) — اول کاشی بخش‌ها، بعد کارت‌های
 * خلاصه و نمودارها.
 * حالت‌های دیگر: کاشی بخش‌ها و یک کارت که به «تنظیمات › حسابداری کسب‌وکار»
 * می‌برد. انتخاب حالت، اتصال حسابان و شمارش رویدادهای مالی از ۲.۶۳.۰ آنجاست
 * (`AccModePanel`).
 */

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Plug, Rocket, Settings } from "lucide-react";
import { btn, Card, PageHeader } from "./ui";
import InternalDashboard from "./InternalDashboard";
import { useAccountingShell } from "./AccountingShell";
import { AppGrid } from "../AppGrid";

type Mode = "NONE" | "HESABAN" | "INTERNAL";

interface Data {
  mode: Mode;
  counts: Record<string, number>;
  can: { settings: boolean };
}

export default function AccountingHomeClient() {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const shell = useAccountingShell();

  const load = useCallback(() => {
    fetch("/api/admin/accounting/settings")
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error ?? "بارگذاری نشد");
        setData(d);
        setError(null);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "بارگذاری نشد"));
  }, []);

  useEffect(load, [load]);

  if (!data) {
    return error ? (
      <p className="text-xs font-bold text-red-600">{error}</p>
    ) : (
      <p className="text-xs text-gray-400">در حال بارگذاری…</p>
    );
  }

  if (data.mode === "INTERNAL") return <InternalDashboard />;

  const hesaban = data.mode === "HESABAN";
  const blocked = (data.counts.BLOCKED ?? 0) + (data.counts.FAILED ?? 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="حسابداری"
        help="accounting"
        desc={hesaban ? "حساب‌وکتاب این کسب‌وکار در حسابان وب نگه داشته می‌شود." : "هنوز حسابداری کسب‌وکار انتخاب نشده است."}
        actions={
          <Link href="/admin/accounting/settings?tab=mode" className={btn.soft}>
            <Settings className="h-4 w-4" aria-hidden />
            حسابداری کسب‌وکار
          </Link>
        }
      />

      {shell && (
        <Card className="px-2 py-3 sm:px-4">
          <AppGrid
            apps={shell.apps.filter((a) => a.href !== "/admin/accounting")}
            badges={blocked ? { "/admin/accounting/events": blocked } : undefined}
            wide
          />
        </Card>
      )}

      <section className="acc-hero rounded-3xl bg-blue-700 p-5 text-white sm:p-6">
        <div className="flex flex-wrap items-center gap-4">
          <span className="acc-hero-chip flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl">
            {hesaban ? <Plug className="h-7 w-7" aria-hidden /> : <Rocket className="h-7 w-7" aria-hidden />}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-base font-black">{hesaban ? "حسابان وب فعال است" : "حسابداری داخلی را راه‌اندازی کنید"}</p>
            <p className="mt-1 text-xs leading-6 text-blue-100">
              {hesaban
                ? "فروش‌ها به حسابان فرستاده می‌شوند و گزارش‌گیری در خود حسابان است. وضعیت اتصال و رویدادهای مالی در تنظیمات حسابداری است."
                : "فاکتور، دریافت و پرداخت، چک، انبار و همه‌ی گزارش‌ها داخل همین پنل — با چند قدم ساده."}
            </p>
          </div>
          {data.can.settings && (
            <Link
              href={hesaban ? "/admin/accounting/settings?tab=mode" : "/admin/accounting/setup"}
              className="acc-hero-chip inline-flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-bold text-white transition hover:bg-white/25"
            >
              {hesaban ? "وضعیت اتصال" : "شروع راه‌اندازی"}
              <ArrowLeft className="h-4 w-4" aria-hidden />
            </Link>
          )}
        </div>
      </section>
    </div>
  );
}
