"use client";

import Link from "next/link";
import SmsAccountCard from "@/components/admin/sms/SmsAccountCard";
import {
  Card,
  ErrorBox,
  Empty,
  Skeleton,
  Table,
  Badge,
  PageHeader,
  fa,
  faDate,
  useApi,
} from "@/components/admin/sms/ui";
import type { Line, SendRequestRow, Paged } from "@/lib/club/sms/panel-types";
import { statusTone, statusLabel } from "@/components/admin/sms/status";

/**
 * داشبورد پنل پیامک
 *
 * سه درخواست موازی و سبک: حساب، خطوط، آخرین ارسال‌ها. عمداً هیچ چیز سنگینی
 * (وضعیت تک‌تک گیرنده‌ها، مخاطبان) اینجا لود نمی‌شود.
 */
export default function SmsDashboard() {
  const lines = useApi<{ lines: Line[] }>("/api/admin/sms/lines");
  const recent = useApi<Paged<SendRequestRow>>("/api/admin/sms/reports?page=1&limit=5");

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <PageHeader
        title="پنل پیامک"
        hint="اعتبار، خطوط، ارسال و گزارش — بدون نیاز به ورود جداگانه به پنل ایران‌پیامک"
      />

      <SmsAccountCard />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Shortcut href="/admin/sms/send" label="ارسال پیامک" />
        <Shortcut href="/admin/sms/patterns" label="پترن‌ها" />
        <Shortcut href="/admin/sms/phonebook" label="دفترچه تلفن" />
        <Shortcut href="/admin/sms/wallet" label="خرید اعتبار" />
      </div>

      <Card title="خطوط در دسترس" hint="تعرفه‌ی هر صفحه پیامک روی این حساب">
        {lines.loading ? (
          <Skeleton rows={2} />
        ) : lines.err ? (
          <ErrorBox err={lines.err} onRetry={lines.reload} />
        ) : !lines.data?.lines.length ? (
          <Empty text="خطی روی این حساب فعال نیست" />
        ) : (
          <div className="flex flex-wrap gap-2">
            {lines.data.lines.map((l) => (
              <div
                key={l.number}
                className="px-3 py-2 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-800"
              >
                <p className="text-xs font-black text-gray-900 dark:text-white tabular-nums" dir="ltr">
                  {l.number}
                </p>
                <p className="text-[10px] font-bold text-gray-400 mt-0.5">
                  {fa(l.smsCost)} تومان
                  {l.isDedicated && " · اختصاصی"}
                </p>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card
        title="آخرین ارسال‌ها"
        action={
          <Link href="/admin/sms/reports" className="text-[10px] font-black text-primary-600 hover:underline">
            همه‌ی گزارش‌ها ←
          </Link>
        }
      >
        {recent.loading ? (
          <Skeleton rows={3} />
        ) : recent.err ? (
          <ErrorBox err={recent.err} onRetry={recent.reload} />
        ) : !recent.data?.items.length ? (
          <Empty text="هنوز ارسالی ثبت نشده است" />
        ) : (
          <Table head={["شناسه", "وضعیت", "خط", "گیرنده", "زمان"]}>
            {recent.data.items.map((r) => (
              <tr key={r.id}>
                <td className="py-2.5 text-[11px] font-black text-gray-700 dark:text-gray-200 tabular-nums">
                  {r.id}
                </td>
                <td className="py-2.5">
                  <Badge text={statusLabel(r.status)} tone={statusTone(r.status)} />
                </td>
                <td className="py-2.5 text-[11px] font-bold text-gray-500 tabular-nums" dir="ltr">
                  {r.lineNumber ?? "—"}
                </td>
                <td className="py-2.5 text-[11px] font-bold text-gray-500 tabular-nums">
                  {r.counts ? fa(r.counts.total) : "—"}
                </td>
                <td className="py-2.5 text-[10px] font-bold text-gray-400 whitespace-nowrap">
                  {faDate(r.createdAt ?? r.schedule)}
                </td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </div>
  );
}

function Shortcut({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="px-4 py-3.5 rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-center text-xs font-black text-gray-700 dark:text-gray-200 hover:border-primary-500 hover:text-primary-600 transition-all"
    >
      {label}
    </Link>
  );
}
